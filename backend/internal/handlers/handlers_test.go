package handlers

import (
	"io"
	"net/http"
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func TestScenarioEndpoint(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	hub := sse.NewHub()
	srv := NewTestServer(st, hub)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/scenario")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	snap, err := DecodeJSON[domain.ScenarioSnapshot](string(body))
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Couriers) != 15 {
		t.Fatalf("expected 15 couriers, got %d", len(snap.Couriers))
	}
	if snap.MapBounds.CenterLat != -30.0277 {
		t.Fatalf("unexpected center lat %f", snap.MapBounds.CenterLat)
	}
}

func TestCourierDetailNotFound(t *testing.T) {
	sc, _ := scenario.Load()
	st := store.New(sc)
	srv := NewTestServer(st, sse.NewHub())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/couriers/INVALID")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestHealthEndpoint(t *testing.T) {
	sc, _ := scenario.Load()
	st := store.New(sc)
	srv := NewTestServer(st, sse.NewHub())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
