package scenario

import (
	"math"
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
)

func TestExpandRouteAddsIntermediatePoints(t *testing.T) {
	in := []domain.RoutePoint{
		{Lat: -30.0320, Lng: -51.2300},
		{Lat: -30.0345, Lng: -51.2405},
		{Lat: -30.0295, Lng: -51.2250},
	}
	out := expandRoute(in)
	if len(out) < 8 {
		t.Fatalf("expected denser route, got %d points", len(out))
	}
}

func TestExpandLegIsOrthogonal(t *testing.T) {
	a := domain.RoutePoint{Lat: -30.0320, Lng: -51.2300}
	b := domain.RoutePoint{Lat: -30.0295, Lng: -51.2250}
	leg := expandLeg(a, b, 3)
	for i := 1; i < len(leg); i++ {
		prev := leg[i-1]
		cur := leg[i]
		dLat := math.Abs(cur.Lat - prev.Lat)
		dLng := math.Abs(cur.Lng - prev.Lng)
		if dLat > 1e-9 && dLng > 1e-9 {
			t.Fatalf("segment %d is diagonal: %+v -> %+v", i, prev, cur)
		}
	}
}
