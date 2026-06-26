package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/handlers"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/simulator"
	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func TestDemoPreviewReset(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	hub := sse.NewHub()
	sim := simulator.New(st, hub.Broadcast)
	api := &handlers.API{Store: st, Hub: hub, Sim: sim, ControlsEnabled: true}

	req := httptest.NewRequest(http.MethodPost, "/api/demo/preview-reset", nil)
	rec := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var preview domain.ActionPreview
	if err := json.NewDecoder(rec.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if !preview.CanApply {
		t.Fatalf("expected can_apply true: %s", preview.BlockReason)
	}
	if len(preview.SummaryLines) != 3 {
		t.Fatalf("expected 3 summary lines, got %+v", preview.SummaryLines)
	}
	if preview.SummaryLines[0] != "Reinicia a operação do zero." {
		t.Fatalf("unexpected first line: %s", preview.SummaryLines[0])
	}
}

func TestDemoPreviewResetControlsDisabled(t *testing.T) {
	sc, err := scenario.Load()
	if err != nil {
		t.Fatal(err)
	}
	st := store.New(sc)
	api := &handlers.API{Store: st, ControlsEnabled: false}

	req := httptest.NewRequest(http.MethodPost, "/api/demo/preview-reset", nil)
	rec := httptest.NewRecorder()
	mux := http.NewServeMux()
	api.Register(mux)
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound && rec.Code != http.StatusMethodNotAllowed {
		if rec.Code == http.StatusOK {
			t.Fatal("expected preview-reset route unavailable when controls disabled")
		}
	}
	_ = rec
}
