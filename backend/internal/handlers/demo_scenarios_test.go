package handlers_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/demo"
	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/handlers"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/simulator"
	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func TestDemoPreviewScenarioNetworkSurprise(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	demo.ApplySessionPlan(st, sc.Seed, 1, nil)
	hub := sse.NewHub()
	sim := simulator.New(st, hub.Broadcast)
	api := &handlers.API{Store: st, Hub: hub, Sim: sim, ControlsEnabled: true, SessionNonce: 1}

	body := []byte(`{"scenario_id":"network_surprise"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/demo/preview-scenario", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(rec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.CanApply {
		t.Fatalf("expected can_apply true, got false: %s", preview.BlockReason)
	}
	if len(preview.Scripts) < 2 || len(preview.Scripts) > 4 {
		t.Fatalf("expected 2–4 scripts, got %d", len(preview.Scripts))
	}
}

func TestDemoPreviewScenarioDoubleStale(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	hub := sse.NewHub()
	sim := simulator.New(st, hub.Broadcast)
	api := &handlers.API{Store: st, Hub: hub, Sim: sim, ControlsEnabled: true, SessionNonce: 2}

	body := []byte(`{"scenario_id":"double_stale"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/demo/preview-scenario", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(rec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if len(preview.Scripts) != 4 {
		t.Fatalf("expected 4 scripts for double_stale, got %d", len(preview.Scripts))
	}
}

func TestStoreSetScripts(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	st.SetScripts([]domain.ScriptAction{
		{CourierID: "POA-01", Tick: 10, Action: "go_stale"},
	})
	upcoming := st.UpcomingScripts(0)
	if len(upcoming) != 1 || upcoming[0].CourierID != "POA-01" {
		t.Fatalf("unexpected scripts: %+v", upcoming)
	}
}

func TestDemoApplyScenarioExploreRoutes(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	hub := sse.NewHub()
	sim := simulator.New(st, hub.Broadcast)
	api := &handlers.API{Store: st, Hub: hub, Sim: sim, ControlsEnabled: true}

	body := []byte(`{"scenario_id":"explore_routes","confirm_reset":false}`)
	req := httptest.NewRequest(http.MethodPost, "/api/demo/apply-scenario", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var result domain.ScenarioApplyResult
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if !result.FitMap {
		t.Fatal("expected fit_map true")
	}
}
