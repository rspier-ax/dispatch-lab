package simulator

import (
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func TestPOA07GoesStaleAtTick45(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	var states []domain.TrackingState
	emit := func(eventType string, data interface{}) {
		if eventType == "tracking_state_change" {
			ch := data.(domain.TrackingStateChange)
			if ch.CourierID == "POA-07" {
				states = append(states, ch.TrackingState)
			}
		}
	}
	sim := New(st, emit)
	for i := 0; i < 44; i++ {
		sim.TickOnce()
	}
	c, _ := st.GetCourier("POA-07")
	if c.TrackingState != domain.TrackingLive {
		t.Fatalf("expected live before tick 45, got %s", c.TrackingState)
	}
	sim.TickOnce()
	c, _ = st.GetCourier("POA-07")
	if c.TrackingState != domain.TrackingStale {
		t.Fatalf("expected stale at tick 45, got %s", c.TrackingState)
	}
	for i := 0; i < 45; i++ {
		sim.TickOnce()
	}
	c, _ = st.GetCourier("POA-07")
	if c.TrackingState != domain.TrackingLive {
		t.Fatalf("expected live after reconnect at tick 90, got %s", c.TrackingState)
	}
}

func TestCouriersMoveWithinBounds(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	sim := New(st, nil)
	for i := 0; i < 10; i++ {
		sim.TickOnce()
	}
	b := sc.MapBounds
	for _, c := range st.Couriers() {
		if c.Position.Lat < b.MinLat || c.Position.Lat > b.MaxLat {
			t.Fatalf("courier %s lat out of bounds", c.ID)
		}
		if c.Position.Lng < b.MinLng || c.Position.Lng > b.MaxLng {
			t.Fatalf("courier %s lng out of bounds", c.ID)
		}
	}
}

func TestEmitsTickUpdate(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	var ticks []int
	sim := New(st, func(eventType string, data interface{}) {
		if eventType == "tick_update" {
			ticks = append(ticks, data.(domain.TickUpdate).Tick)
		}
	})
	sim.TickOnce()
	if len(ticks) != 1 || ticks[0] != 1 {
		t.Fatalf("expected tick_update 1, got %v", ticks)
	}
}

func TestPickingUpCourierGetsMilestones(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	sim := New(st, nil)
	for i := 0; i < 120; i++ {
		sim.TickOnce()
		if st.HasMilestone("POA-03", "arrived_pickup") {
			return
		}
	}
	t.Fatal("expected POA-03 arrived_pickup milestone within 120 ticks")
}

func TestDeliveryCompletesAtRouteEnd(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	sim := New(st, nil)
	for i := 0; i < 800; i++ {
		sim.TickOnce()
	}
	courier, ok := st.GetCourier("POA-06")
	if !ok {
		t.Fatal("missing POA-06")
	}
	delivery, ok := st.GetDelivery("DEL-006")
	if !ok {
		t.Fatal("missing DEL-006")
	}
	if delivery.Status != domain.StatusDelivered {
		t.Fatalf("expected DEL-006 delivered, got %s after 800 ticks", delivery.Status)
	}
	if !st.HasMilestone("POA-06", "delivered") {
		t.Fatal("expected delivered milestone on POA-06")
	}
	if courier.ETASeconds != 0 {
		t.Fatalf("expected ETA 0 after delivery, got %d", courier.ETASeconds)
	}
}

func TestInTransitStarterHasPickupTimeline(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	detail, ok := st.CourierDetail("POA-06")
	if !ok {
		t.Fatal("missing POA-06 detail")
	}
	found := false
	for _, ev := range detail.Timeline {
		if ev.Type == "picked_up" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected picked_up timeline seed for in_transit starter POA-06")
	}
	if !st.HasMilestone("POA-06", "picked_up") {
		t.Fatal("expected picked_up milestone for POA-06")
	}
}
