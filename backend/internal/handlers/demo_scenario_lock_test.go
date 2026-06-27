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

func setupScenarioAPI(t *testing.T) (*handlers.API, *simulator.Simulator, *store.Store) {
	t.Helper()
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	demo.ApplySessionPlan(st, sc.Seed, 1, nil)
	hub := sse.NewHub()
	sim := simulator.New(st, hub.Broadcast)
	api := &handlers.API{Store: st, Hub: hub, Sim: sim, ControlsEnabled: true, SessionNonce: 1}
	return api, sim, st
}

func postScenario(t *testing.T, mux *http.ServeMux, path, scenarioID string, confirmReset bool) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]interface{}{
		"scenario_id":   scenarioID,
		"confirm_reset": confirmReset,
	})
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestScenarioLockBlocksSecondScriptedPreview(t *testing.T) {
	api, _, _ := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	previewRec := postScenario(t, mux, "/api/demo/preview-scenario", "double_stale", false)
	if previewRec.Code != http.StatusOK {
		t.Fatalf("preview status %d: %s", previewRec.Code, previewRec.Body.String())
	}
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(previewRec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if preview.CanApply {
		t.Fatal("expected scripted preview blocked while lock active")
	}
	if preview.BlockReason == "" {
		t.Fatal("expected block_reason")
	}
}

func TestScenarioLockClearsAfterAdvance(t *testing.T) {
	api, sim, st := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	maxTick := 0
	for _, sc := range st.Scenario().Scripts {
		if sc.Tick > maxTick {
			maxTick = sc.Tick
		}
	}
	sim.TickN(maxTick - st.Tick() + 1)

	previewRec := postScenario(t, mux, "/api/demo/preview-scenario", "double_stale", false)
	if previewRec.Code != http.StatusOK {
		t.Fatalf("preview status %d: %s", previewRec.Code, previewRec.Body.String())
	}
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(previewRec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.CanApply {
		t.Fatalf("expected preview allowed after lock expired: %s", preview.BlockReason)
	}
}

func TestScenarioLockClearsOnReset(t *testing.T) {
	api, _, _ := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	resetReq := httptest.NewRequest(http.MethodPost, "/api/demo/reset", nil)
	resetRec := httptest.NewRecorder()
	mux.ServeHTTP(resetRec, resetReq)
	if resetRec.Code != http.StatusOK {
		t.Fatalf("reset status %d: %s", resetRec.Code, resetRec.Body.String())
	}

	previewRec := postScenario(t, mux, "/api/demo/preview-scenario", "double_stale", false)
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(previewRec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.CanApply {
		t.Fatalf("expected preview allowed after reset: %s", preview.BlockReason)
	}
}

func TestScenarioLockBlocksManualTrigger(t *testing.T) {
	api, _, st := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	liveID := demo.LiveCourierIDs(st)[0]
	body, _ := json.Marshal(map[string]string{"courier_id": liveID, "action": "go_stale"})
	req := httptest.NewRequest(http.MethodPost, "/api/demo/trigger", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestVisualScenarioAllowedWhileLockActive(t *testing.T) {
	api, _, _ := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	previewRec := postScenario(t, mux, "/api/demo/preview-scenario", "explore_routes", false)
	if previewRec.Code != http.StatusOK {
		t.Fatalf("preview status %d: %s", previewRec.Code, previewRec.Body.String())
	}
	var preview domain.ScenarioPreview
	if err := json.NewDecoder(previewRec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.CanApply {
		t.Fatalf("expected visual scenario allowed: %s", preview.BlockReason)
	}
}

func TestDemoInfoExposesScenarioLock(t *testing.T) {
	api, _, _ := setupScenarioAPI(t)
	mux := http.NewServeMux()
	api.Register(mux)

	applyRec := postScenario(t, mux, "/api/demo/apply-scenario", "network_surprise", false)
	if applyRec.Code != http.StatusOK {
		t.Fatalf("apply status %d: %s", applyRec.Code, applyRec.Body.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/api/demo/info", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var info domain.DemoInfo
	if err := json.NewDecoder(rec.Body).Decode(&info); err != nil {
		t.Fatal(err)
	}
	if info.ScenarioLock == nil || info.ScenarioLock.ActiveID != "network_surprise" {
		t.Fatalf("expected scenario_lock, got %+v", info.ScenarioLock)
	}
	if info.ScenarioLock.RemainingEvents <= 0 {
		t.Fatalf("expected remaining events > 0, got %d", info.ScenarioLock.RemainingEvents)
	}
}
