package simulator

import (
	"os"
	"strconv"
	"time"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/geo"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
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
	sim.applyScripts(tick, now)
	sim.moveCouriers(now)
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

func (sim *Simulator) setTrackingState(id string, state domain.TrackingState, now time.Time, timelineMsg string) {
	var change domain.TrackingStateChange
	sim.store.UpdateCourier(id, func(c *domain.Courier) {
		c.TrackingState = state
		if state == domain.TrackingLive {
			c.LastSeenAt = now
		}
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
			CourierID: id,
			Type:      eventType,
			Message:   timelineMsg,
			Timestamp: now,
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
	if len(c.Route) < 2 {
		return
	}
	idx := c.RouteIndex
	if idx >= len(c.Route)-1 {
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

	update := domain.PositionUpdate{
		CourierID: c.ID,
		Lat:       lat,
		Lng:       lng,
		Timestamp: now,
	}

	sim.store.UpdateCourier(c.ID, func(cur *domain.Courier) {
		cur.Position = domain.Position{Lat: lat, Lng: lng}
		cur.RouteIndex = newIdx
		cur.RouteProgress = prog
		cur.LastSeenAt = now
		cur.ETASeconds = sim.computeETA(cur)
	})

	if !geo.WithinBounds(lat, lng, bounds.MinLat, bounds.MaxLat, bounds.MinLng, bounds.MaxLng) {
		return
	}

	if sim.emit != nil {
		sim.emit("position_update", update)
		var eta int
		sim.store.UpdateCourier(c.ID, func(cur *domain.Courier) {
			eta = cur.ETASeconds
		})
		sim.store.UpdateDeliveryETA(c.DeliveryID, eta)
		sim.emit("eta_update", domain.ETAUpdate{
			DeliveryID: c.DeliveryID,
			CourierID:  c.ID,
			ETASeconds: eta,
		})
	}
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
