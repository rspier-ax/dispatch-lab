package geo

import "testing"

func TestHaversineM_samePoint(t *testing.T) {
	d := HaversineM(-30.0277, -51.2284, -30.0277, -51.2284)
	if d != 0 {
		t.Fatalf("expected 0, got %f", d)
	}
}

func TestHaversineM_knownDistance(t *testing.T) {
	// Mercado Público to Praça da Matriz ~350m apart
	d := HaversineM(-30.0277, -51.2284, -30.0285, -51.2270)
	if d < 100 || d > 800 {
		t.Fatalf("unexpected distance: %f", d)
	}
}

func TestWithinBounds(t *testing.T) {
	if !WithinBounds(-30.0277, -51.2284, -30.0475, -30.0208, -51.2426, -51.2110) {
		t.Fatal("expected point inside POA centro bbox")
	}
	if WithinBounds(-30.1, -51.3, -30.0475, -30.0208, -51.2426, -51.2110) {
		t.Fatal("expected point outside bbox")
	}
}

func TestETASeconds(t *testing.T) {
	if ETASeconds(800, 8) != 100 {
		t.Fatalf("expected 100, got %d", ETASeconds(800, 8))
	}
}
