package scenario

import (
	"math"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
)

// ExpandStreetRoutes replaces each courier leg with an L-shaped polyline so
// movement follows street-like paths instead of cutting across blocks.
func ExpandStreetRoutes(s *domain.Scenario) {
	for i := range s.Couriers {
		s.Couriers[i].Route = expandRoute(s.Couriers[i].Route)
	}
}

func expandRoute(points []domain.RoutePoint) []domain.RoutePoint {
	if len(points) < 2 {
		return points
	}
	var out []domain.RoutePoint
	for i := 0; i < len(points)-1; i++ {
		leg := expandLeg(points[i], points[i+1], 4)
		if len(out) > 0 {
			leg = leg[1:]
		}
		out = append(out, leg...)
	}
	if len(out) < 2 {
		return points
	}
	return out
}

func expandLeg(a, b domain.RoutePoint, steps int) []domain.RoutePoint {
	if steps < 1 {
		steps = 1
	}
	mid := domain.RoutePoint{Lat: a.Lat, Lng: b.Lng}
	if math.Abs(a.Lat-b.Lat) > math.Abs(a.Lng-b.Lng) {
		mid = domain.RoutePoint{Lat: b.Lat, Lng: a.Lng}
	}
	first := interpolatePoints(a, mid, steps)
	second := interpolatePoints(mid, b, steps)
	if len(second) > 0 {
		second = second[1:]
	}
	return append(first, second...)
}

func interpolatePoints(a, b domain.RoutePoint, steps int) []domain.RoutePoint {
	out := make([]domain.RoutePoint, 0, steps+1)
	for i := 0; i <= steps; i++ {
		t := float64(i) / float64(steps)
		out = append(out, domain.RoutePoint{
			Lat: a.Lat + (b.Lat-a.Lat)*t,
			Lng: a.Lng + (b.Lng-a.Lng)*t,
		})
	}
	return out
}
