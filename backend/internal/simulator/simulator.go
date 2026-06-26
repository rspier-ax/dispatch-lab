package simulator

import (
	"os"
	"strconv"
	"time"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/geo"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

const (
	pickupArriveM  = 35
	pickupDepartM  = 45
	dropoffNearM   = 50
	dropoffArriveM = 20
)

type EventEmitter func(eventType string, data interface{})

type Simulator struct {
	store    *store.Store
	interval time.Duration
	emit     EventEmitter
}

func New(st *store.Store, emit EventEmitter) *Simulator {
	interval := time.Second
	if ms := os.Getenv("SIM_TICK_MS"); ms != "" {
		if n, err := strconv.Atoi(ms); err == nil && n > 0 {
			interval = time.Duration(n) * time.Millisecond
		}
	}
	return &Simulator{
		store:    st,
		interval: interval,
		emit:     emit,
	}
}

func (sim *Simulator) IntervalMS() int {
	return int(sim.interval / time.Millisecond)
}

func (sim *Simulator) Store() *store.Store {
	return sim.store
}

func (sim *Simulator) Run(stop <-chan struct{}) {
	ticker := time.NewTicker(sim.interval)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			sim.tick()
		}
	}
}

func (sim *Simulator) tick() {
	tick := sim.store.IncrementTick()
	now := time.Now().UTC()
	sim.emitTickUpdate(tick)
	sim.applyScripts(tick, now)
	sim.moveCouriers(now)
}

func (sim *Simulator) emitTickUpdate(tick int) {
	if sim.emit == nil {
		return
	}
	sim.emit("tick_update", domain.TickUpdate{
		Tick:        tick,
		IntervalMS:  sim.IntervalMS(),
		NextScripts: sim.store.UpcomingScripts(tick),
	})
}

func (sim *Simulator) applyScripts(tick int, now time.Time) {
	for _, script := range sim.store.ScriptsForTick(tick) {
		switch script.Action {
		case "go_stale":
			sim.setTrackingState(script.CourierID, domain.TrackingStale, now,
				"Sinal GPS instável — última posição conhecida na Rua dos Andradas")
		case "reconnect":
			sim.setTrackingState(script.CourierID, domain.TrackingLive, now,
				"Conexão restabelecida — retomando transmissão de posição")
		}
	}
}

func (sim *Simulator) TriggerAction(courierID, action string) bool {
	now := time.Now().UTC()
	switch action {
	case "go_stale":
		sim.setTrackingState(courierID, domain.TrackingStale, now,
			"Sinal GPS instável — última posição conhecida na Rua dos Andradas")
		return true
	case "reconnect":
		sim.setTrackingState(courierID, domain.TrackingLive, now,
			"Conexão restabelecida — retomando transmissão de posição")
		return true
	default:
		return false
	}
}

func (sim *Simulator) setTrackingState(id string, state domain.TrackingState, now time.Time, timelineMsg string) {
	var change domain.TrackingStateChange
	var deliveryID string
	sim.store.UpdateCourier(id, func(c *domain.Courier) {
		c.TrackingState = state
		if state == domain.TrackingLive {
			c.LastSeenAt = now
		}
		deliveryID = c.DeliveryID
		change = domain.TrackingStateChange{
			CourierID:     id,
			TrackingState: state,
			LastSeenAt:    c.LastSeenAt,
		}
	})
	eventType := "went_stale"
	if state == domain.TrackingLive {
		eventType = "reconnected"
	}
	sim.store.AppendTimeline(id, eventType, timelineMsg, now)
	if sim.emit != nil {
		sim.emit("tracking_state_change", change)
		sim.emit("delivery_event", domain.DeliveryEventPayload{
			DeliveryID: deliveryID,
			CourierID:  id,
			Type:       eventType,
			Message:    timelineMsg,
			Timestamp:  now,
		})
	}
}

func (sim *Simulator) moveCouriers(now time.Time) {
	sc := sim.store.Scenario()
	for _, c := range sim.store.Couriers() {
		if c.TrackingState != domain.TrackingLive {
			continue
		}
		sim.advanceCourier(&c, now, sc.MapBounds)
	}
}

func (sim *Simulator) advanceCourier(c *domain.Courier, now time.Time, bounds domain.MapBounds) {
	if delivery, ok := sim.store.GetDelivery(c.DeliveryID); ok && delivery.Status == domain.StatusDelivered {
		return
	}
	if len(c.Route) < 2 {
		return
	}
	idx := c.RouteIndex
	if idx >= len(c.Route)-1 {
		sim.tryCompleteDelivery(c.ID, c.Position.Lat, c.Position.Lng, now, true)
		return
	}
	a := c.Route[idx]
	b := c.Route[idx+1]
	segLen := geo.HaversineM(a.Lat, a.Lng, b.Lat, b.Lng)
	if segLen == 0 {
		c.RouteIndex++
		c.RouteProgress = 0
		return
	}
	advance := c.SpeedMPS / segLen
	newProgress := c.RouteProgress + advance

	lat, lng := geo.Interpolate(a.Lat, a.Lng, b.Lat, b.Lng, newProgress)
	newIdx := idx
	prog := newProgress
	for prog >= 1 && newIdx < len(c.Route)-2 {
		prog -= 1
		newIdx++
		a = c.Route[newIdx]
		b = c.Route[newIdx+1]
		segLen = geo.HaversineM(a.Lat, a.Lng, b.Lat, b.Lng)
		if segLen > 0 {
			lat, lng = geo.Interpolate(a.Lat, a.Lng, b.Lat, b.Lng, prog)
		} else {
			lat, lng = b.Lat, b.Lng
		}
	}

	sim.store.UpdateCourier(c.ID, func(cur *domain.Courier) {
		cur.Position = domain.Position{Lat: lat, Lng: lng}
		cur.RouteIndex = newIdx
		cur.RouteProgress = prog
		cur.LastSeenAt = now
		cur.ETASeconds = sim.computeETA(cur)
	})

	sim.checkMilestones(c.ID, lat, lng, now)

	if newIdx >= len(c.Route)-1 {
		sim.tryCompleteDelivery(c.ID, lat, lng, now, true)
	}

	if !geo.WithinBounds(lat, lng, bounds.MinLat, bounds.MaxLat, bounds.MinLng, bounds.MaxLng) {
		return
	}

	if sim.emit != nil {
		sim.emit("position_update", domain.PositionUpdate{
			CourierID: c.ID,
			Lat:       lat,
			Lng:       lng,
			Timestamp: now,
		})
		var eta int
		var deliveryID string
		sim.store.UpdateCourier(c.ID, func(cur *domain.Courier) {
			eta = cur.ETASeconds
			deliveryID = cur.DeliveryID
		})
		sim.store.UpdateDeliveryETA(deliveryID, eta)
		sim.emit("eta_update", domain.ETAUpdate{
			DeliveryID: deliveryID,
			CourierID:  c.ID,
			ETASeconds: eta,
		})
	}
}

func (sim *Simulator) checkMilestones(courierID string, lat, lng float64, now time.Time) {
	courier, ok := sim.store.GetCourier(courierID)
	if !ok {
		return
	}
	delivery, ok := sim.store.GetDelivery(courier.DeliveryID)
	if !ok {
		return
	}

	distPickup := geo.HaversineM(lat, lng, delivery.Pickup.Lat, delivery.Pickup.Lng)
	distDropoff := geo.HaversineM(lat, lng, delivery.Dropoff.Lat, delivery.Dropoff.Lng)

	if delivery.Status == domain.StatusPickingUp {
		if distPickup <= pickupArriveM && !sim.store.HasMilestone(courierID, "arrived_pickup") {
			msg := "Chegou ao restaurante " + delivery.Restaurant
			sim.emitMilestone(courierID, delivery.ID, "arrived_pickup", msg, delivery.Status, now)
		}
		if sim.store.HasMilestone(courierID, "arrived_pickup") && distPickup >= pickupDepartM &&
			!sim.store.HasMilestone(courierID, "picked_up") {
			msg := "Pedido coletado — em rota para " + delivery.Street
			sim.store.UpdateDeliveryStatus(delivery.ID, domain.StatusInTransit)
			sim.emitMilestone(courierID, delivery.ID, "picked_up", msg, domain.StatusInTransit, now)
		}
	}

	if delivery.Status == domain.StatusInTransit || sim.store.HasMilestone(courierID, "picked_up") {
		if delivery.Status == domain.StatusDelivered {
			return
		}
		if distDropoff <= dropoffNearM && !sim.store.HasMilestone(courierID, "approaching_dropoff") {
			msg := "Próximo ao destino — " + delivery.Street
			sim.emitMilestone(courierID, delivery.ID, "approaching_dropoff", msg, domain.StatusInTransit, now)
		}
		if delivery.Status != domain.StatusDelivered {
			sim.tryCompleteDelivery(courierID, lat, lng, now, false)
		}
	}
}

func (sim *Simulator) tryCompleteDelivery(courierID string, lat, lng float64, now time.Time, atRouteEnd bool) {
	if sim.store.HasMilestone(courierID, "delivered") {
		return
	}
	courier, ok := sim.store.GetCourier(courierID)
	if !ok {
		return
	}
	delivery, ok := sim.store.GetDelivery(courier.DeliveryID)
	if !ok || delivery.Status == domain.StatusDelivered {
		return
	}

	distDropoff := geo.HaversineM(lat, lng, delivery.Dropoff.Lat, delivery.Dropoff.Lng)
	if !atRouteEnd && distDropoff > dropoffArriveM {
		return
	}

	if !sim.store.HasMilestone(courierID, "approaching_dropoff") {
		msg := "Próximo ao destino — " + delivery.Street
		sim.emitMilestone(courierID, delivery.ID, "approaching_dropoff", msg, domain.StatusInTransit, now)
	}

	msg := "Entrega concluída — " + delivery.Street
	sim.store.UpdateDeliveryStatus(delivery.ID, domain.StatusDelivered)
	sim.emitMilestone(courierID, delivery.ID, "delivered", msg, domain.StatusDelivered, now)

	sim.store.UpdateCourier(courierID, func(cur *domain.Courier) {
		cur.ETASeconds = 0
	})
	sim.store.UpdateDeliveryETA(delivery.ID, 0)

	if sim.emit != nil {
		sim.emit("eta_update", domain.ETAUpdate{
			DeliveryID: delivery.ID,
			CourierID:  courierID,
			ETASeconds: 0,
		})
	}
}

func (sim *Simulator) emitMilestone(
	courierID, deliveryID, eventType, message string,
	status domain.DeliveryStatus,
	now time.Time,
) {
	sim.store.SetMilestone(courierID, eventType)
	sim.store.AppendTimeline(courierID, eventType, message, now)
	if sim.emit == nil {
		return
	}
	sim.emit("delivery_event", domain.DeliveryEventPayload{
		DeliveryID: deliveryID,
		CourierID:  courierID,
		Type:       eventType,
		Message:    message,
		Status:     status,
		Timestamp:  now,
	})
}

func (sim *Simulator) computeETA(c *domain.Courier) int {
	if len(c.Route) < 2 {
		return 0
	}
	idx := c.RouteIndex
	if idx >= len(c.Route)-1 {
		return 0
	}
	total := 0.0
	a := c.Route[idx]
	b := c.Route[idx+1]
	segLen := geo.HaversineM(a.Lat, a.Lng, b.Lat, b.Lng)
	total += segLen * (1 - c.RouteProgress)
	for i := idx + 1; i < len(c.Route)-1; i++ {
		total += geo.HaversineM(c.Route[i].Lat, c.Route[i].Lng, c.Route[i+1].Lat, c.Route[i+1].Lng)
	}
	return geo.ETASeconds(total, c.SpeedMPS)
}

// TickOnce exposes a single tick for tests.
func (sim *Simulator) TickOnce() {
	sim.tick()
}

func (sim *Simulator) TickN(n int) {
	for i := 0; i < n; i++ {
		sim.tick()
	}
}

func (sim *Simulator) Reset(sc *domain.Scenario) {
	sim.store.Reset(sc)
}
