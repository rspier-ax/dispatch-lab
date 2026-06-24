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
