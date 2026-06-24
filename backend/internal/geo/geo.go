package geo

import "math"

const earthRadiusM = 6371000

func HaversineM(aLat, aLng, bLat, bLng float64) float64 {
	lat1 := aLat * math.Pi / 180
	lat2 := bLat * math.Pi / 180
	dLat := (bLat - aLat) * math.Pi / 180
	dLng := (bLng - aLng) * math.Pi / 180

	sinDLat := math.Sin(dLat / 2)
	sinDLng := math.Sin(dLng / 2)
	h := sinDLat*sinDLat + math.Cos(lat1)*math.Cos(lat2)*sinDLng*sinDLng
	return 2 * earthRadiusM * math.Asin(math.Sqrt(h))
}

func Interpolate(aLat, aLng, bLat, bLng, t float64) (lat, lng float64) {
	if t <= 0 {
		return aLat, aLng
	}
	if t >= 1 {
		return bLat, bLng
	}
	return aLat + (bLat-aLat)*t, aLng + (bLng-aLng)*t
}

func RouteRemainingM(route []struct{ Lat, Lng float64 }, index int, progress float64, posLat, posLng float64) float64 {
	if len(route) == 0 {
		return 0
	}
	remaining := 0.0
	if index < len(route)-1 {
		a := route[index]
		b := route[index+1]
		segLen := HaversineM(a.Lat, a.Lng, b.Lat, b.Lng)
		remaining += segLen * (1 - progress)
		for i := index + 1; i < len(route)-1; i++ {
			remaining += HaversineM(route[i].Lat, route[i].Lng, route[i+1].Lat, route[i+1].Lng)
		}
	}
	_ = posLat
	_ = posLng
	return remaining
}

func ETASeconds(distanceM, speedMPS float64) int {
	if speedMPS <= 0 {
		return 0
	}
	eta := int(distanceM / speedMPS)
	if eta < 1 && distanceM > 0 {
		return 1
	}
	return eta
}

func WithinBounds(lat, lng, minLat, maxLat, minLng, maxLng float64) bool {
	return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
}
