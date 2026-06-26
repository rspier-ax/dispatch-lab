package store

import (
	"sync"
	"time"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/geo"
)

type Store struct {
	mu          sync.RWMutex
	scenario    *domain.Scenario
	couriers    map[string]*domain.Courier
	deliveries  map[string]*domain.Delivery
	timelines   map[string][]domain.TimelineEvent
	milestones  map[string]map[string]bool
	tick        int
	startedAt   time.Time
	eventSeq    int
}

func New(sc *domain.Scenario) *Store {
	s := &Store{
		scenario:   sc,
		couriers:   make(map[string]*domain.Courier),
		deliveries: make(map[string]*domain.Delivery),
		timelines:  make(map[string][]domain.TimelineEvent),
		milestones: make(map[string]map[string]bool),
		startedAt:  time.Now().UTC(),
	}
	s.initFromScenario()
	return s
}

func (s *Store) initFromScenario() {
	courierNames := make(map[string]string)
	for _, def := range s.scenario.Couriers {
		courierNames[def.ID] = def.Name
		start := def.Route[0]
		c := &domain.Courier{
			ID:            def.ID,
			Name:          def.Name,
			Position:      domain.Position{Lat: start.Lat, Lng: start.Lng},
			TrackingState: domain.TrackingLive,
			LastSeenAt:    s.startedAt,
			Route:         def.Route,
			RouteIndex:    0,
			RouteProgress: 0,
			SpeedMPS:      def.SpeedMPS,
			DeliveryID:    def.DeliveryID,
		}
		c.ETASeconds = s.computeCourierETA(c)
		s.couriers[def.ID] = c
		s.timelines[def.ID] = []domain.TimelineEvent{
			{
				ID:        s.nextEventID(),
				CourierID: def.ID,
				Type:      "started",
				Message:   "Rota iniciada no Centro Histórico",
				Timestamp: s.startedAt,
			},
		}
		s.milestones[def.ID] = make(map[string]bool)
	}
	for _, d := range s.scenario.Deliveries {
		name := courierNames[d.CourierID]
		del := &domain.Delivery{
			ID:           d.ID,
			CourierID:    d.CourierID,
			CourierName:  name,
			Restaurant:   d.Restaurant,
			Street:       d.Street,
			Pickup:       d.Pickup,
			Dropoff:      d.Dropoff,
			Status:       d.Status,
			CustomerName: d.CustomerName,
		}
		if c, ok := s.couriers[d.CourierID]; ok {
			del.ETASeconds = c.ETASeconds
		}
		s.deliveries[d.ID] = del
	}
	for _, def := range s.scenario.Couriers {
		del, ok := s.deliveries[def.DeliveryID]
		if !ok || del.Status != domain.StatusInTransit {
			continue
		}
		msg := "Pedido já coletado em " + del.Restaurant + " — em rota para " + del.Street
		s.timelines[def.ID] = append(s.timelines[def.ID], domain.TimelineEvent{
			ID:        s.nextEventID(),
			CourierID: def.ID,
			Type:      "picked_up",
			Message:   msg,
			Timestamp: s.startedAt,
		})
		s.milestones[def.ID]["picked_up"] = true
	}
}

func (s *Store) nextEventID() string {
	s.eventSeq++
	return fmtEventID(s.eventSeq)
}

func fmtEventID(n int) string {
	return "EVT-" + padInt(n)
}

func padInt(n int) string {
	if n < 10 {
		return "000" + itoa(n)
	}
	if n < 100 {
		return "00" + itoa(n)
	}
	if n < 1000 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	const digits = "0123456789"
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = digits[n%10]
		n /= 10
	}
	return string(buf[i:])
}

func (s *Store) computeCourierETA(c *domain.Courier) int {
	if len(c.Route) == 0 {
		return 0
	}
	remaining := remainingDistance(c)
	return geo.ETASeconds(remaining, c.SpeedMPS)
}

func remainingDistance(c *domain.Courier) float64 {
	if len(c.Route) < 2 {
		return 0
	}
	total := 0.0
	idx := c.RouteIndex
	if idx >= len(c.Route)-1 {
		return 0
	}
	a := c.Route[idx]
	b := c.Route[idx+1]
	segLen := geo.HaversineM(a.Lat, a.Lng, b.Lat, b.Lng)
	total += segLen * (1 - c.RouteProgress)
	for i := idx + 1; i < len(c.Route)-1; i++ {
		total += geo.HaversineM(c.Route[i].Lat, c.Route[i].Lng, c.Route[i+1].Lat, c.Route[i+1].Lng)
	}
	return total
}

func (s *Store) Scenario() *domain.Scenario {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.scenario
}

func (s *Store) Tick() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.tick
}

func (s *Store) Snapshot() domain.ScenarioSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return domain.ScenarioSnapshot{
		MapBounds:  s.scenario.MapBounds,
		Landmarks:  s.scenario.Landmarks,
		Couriers:   s.copyCouriersLocked(),
		Deliveries: s.allDeliveriesLocked(),
		Tick:       s.tick,
	}
}

func (s *Store) copyCouriersLocked() []domain.Courier {
	out := make([]domain.Courier, 0, len(s.couriers))
	for _, c := range s.couriers {
		cp := *c
		out = append(out, cp)
	}
	return out
}

func (s *Store) allDeliveriesLocked() []domain.Delivery {
	out := make([]domain.Delivery, 0, len(s.deliveries))
	for _, d := range s.deliveries {
		cp := *d
		out = append(out, cp)
	}
	return out
}

func (s *Store) activeDeliveriesLocked() []domain.Delivery {
	out := make([]domain.Delivery, 0)
	for _, d := range s.deliveries {
		if d.Status != domain.StatusDelivered {
			cp := *d
			out = append(out, cp)
		}
	}
	return out
}

func (s *Store) completedDeliveriesLocked() []domain.Delivery {
	out := make([]domain.Delivery, 0)
	for _, d := range s.deliveries {
		if d.Status == domain.StatusDelivered {
			cp := *d
			out = append(out, cp)
		}
	}
	return out
}

func (s *Store) copyCouriers() []domain.Courier {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.copyCouriersLocked()
}

func (s *Store) activeDeliveries() []domain.Delivery {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeDeliveriesLocked()
}

func (s *Store) CompletedDeliveries() []domain.Delivery {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.completedDeliveriesLocked()
}

func (s *Store) Deliveries() []domain.Delivery {
	return s.activeDeliveries()
}

func (s *Store) Couriers() []domain.Courier {
	return s.copyCouriers()
}

func (s *Store) CourierDetail(id string) (domain.CourierDetail, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.couriers[id]
	if !ok {
		return domain.CourierDetail{}, false
	}
	cp := *c
	var del *domain.Delivery
	if d, ok := s.deliveries[c.DeliveryID]; ok && d.Status != domain.StatusDelivered {
		copyDel := *d
		del = &copyDel
	}
	timeline := append([]domain.TimelineEvent(nil), s.timelines[id]...)
	if len(timeline) > 5 {
		timeline = timeline[len(timeline)-5:]
	}
	return domain.CourierDetail{Courier: cp, Delivery: del, Timeline: timeline}, true
}

func (s *Store) GetCourier(id string) (*domain.Courier, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.couriers[id]
	return c, ok
}

func (s *Store) SetTick(t int) {
	s.mu.Lock()
	s.tick = t
	s.mu.Unlock()
}

func (s *Store) IncrementTick() int {
	s.mu.Lock()
	s.tick++
	t := s.tick
	s.mu.Unlock()
	return t
}

func (s *Store) UpdateCourier(id string, fn func(*domain.Courier)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.couriers[id]; ok {
		fn(c)
	}
}

func (s *Store) AppendTimeline(courierID, eventType, message string, at time.Time) domain.TimelineEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	ev := domain.TimelineEvent{
		ID:        s.nextEventID(),
		CourierID: courierID,
		Type:      eventType,
		Message:   message,
		Timestamp: at,
	}
	s.timelines[courierID] = append(s.timelines[courierID], ev)
	return ev
}

func (s *Store) UpdateDeliveryETA(deliveryID string, eta int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if d, ok := s.deliveries[deliveryID]; ok {
		d.ETASeconds = eta
	}
}

func (s *Store) ScriptsForTick(tick int) []domain.ScriptAction {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []domain.ScriptAction
	for _, sc := range s.scenario.Scripts {
		if sc.Tick == tick {
			out = append(out, sc)
		}
	}
	return out
}

func (s *Store) UpcomingScripts(fromTick int) []domain.ScriptAction {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []domain.ScriptAction
	for _, sc := range s.scenario.Scripts {
		if sc.Tick >= fromTick {
			out = append(out, sc)
		}
	}
	return out
}

func (s *Store) HasMilestone(courierID, eventType string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if m, ok := s.milestones[courierID]; ok {
		return m[eventType]
	}
	return false
}

func (s *Store) SetMilestone(courierID, eventType string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.milestones[courierID] == nil {
		s.milestones[courierID] = make(map[string]bool)
	}
	s.milestones[courierID][eventType] = true
}

func (s *Store) GetDelivery(id string) (*domain.Delivery, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	d, ok := s.deliveries[id]
	if !ok {
		return nil, false
	}
	cp := *d
	return &cp, true
}

func (s *Store) UpdateDeliveryStatus(deliveryID string, status domain.DeliveryStatus) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	d, ok := s.deliveries[deliveryID]
	if !ok {
		return false
	}
	d.Status = status
	return true
}

func (s *Store) Reset(sc *domain.Scenario) {
	s.mu.Lock()
	s.scenario = sc
	s.couriers = make(map[string]*domain.Courier)
	s.deliveries = make(map[string]*domain.Delivery)
	s.timelines = make(map[string][]domain.TimelineEvent)
	s.milestones = make(map[string]map[string]bool)
	s.tick = 0
	s.eventSeq = 0
	s.startedAt = time.Now().UTC()
	s.mu.Unlock()
	s.initFromScenario()
}
