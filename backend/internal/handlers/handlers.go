package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/simulator"
	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

type API struct {
	Store           *store.Store
	Hub             *sse.Hub
	Sim             *simulator.Simulator
	ControlsEnabled bool
}

func (a *API) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /api/scenario", a.handleScenario)
	mux.HandleFunc("GET /api/couriers", a.handleCouriers)
	mux.HandleFunc("GET /api/deliveries", a.handleDeliveries)
	mux.HandleFunc("GET /api/couriers/{id}", a.handleCourierDetail)
	mux.HandleFunc("GET /api/demo/info", a.handleDemoInfo)
	mux.HandleFunc("GET /api/stream", a.Hub.ServeHTTP)

	if a.ControlsEnabled {
		mux.HandleFunc("POST /api/demo/reset", a.handleDemoReset)
		mux.HandleFunc("POST /api/demo/advance", a.handleDemoAdvance)
		mux.HandleFunc("POST /api/demo/trigger", a.handleDemoTrigger)
	}
}

func DemoControlsEnabled() bool {
	return os.Getenv("DEMO_CONTROLS") == "true"
}

func (a *API) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *API) handleScenario(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.Store.Snapshot())
}

func (a *API) handleCouriers(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"couriers": a.Store.Couriers()})
}

func (a *API) handleDeliveries(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"deliveries": a.Store.Deliveries()})
}

func (a *API) handleCourierDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	detail, ok := a.Store.CourierDetail(id)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "courier not found"})
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (a *API) handleDemoInfo(w http.ResponseWriter, _ *http.Request) {
	sc := a.Store.Scenario()
	intervalMS := 1000
	if a.Sim != nil {
		intervalMS = a.Sim.IntervalMS()
	}
	writeJSON(w, http.StatusOK, domain.DemoInfo{
		Tick:            a.Store.Tick(),
		IntervalMS:      intervalMS,
		Scripts:         sc.Scripts,
		ControlsEnabled: a.ControlsEnabled,
		ScenarioSeed:    sc.Seed,
		Scenarios:       demoScenarios(),
	})
}

func demoScenarios() []domain.DemoScenario {
	return []domain.DemoScenario{
		{
			ID:          "poa07_stale",
			Title:       "POA-07 — sinal atrasado",
			Description: "Selecione DEL-007 e aguarde o tick 45 (~45s) para ver o entregador ficar com sinal atrasado na Rua dos Andradas.",
			CourierID:   "POA-07",
			DeliveryID:  "DEL-007",
		},
		{
			ID:          "explore_routes",
			Title:       "Explorar rotas nas ruas",
			Description: "Selecione qualquer entregador ao vivo e observe a rota restante seguindo o grid viário do Centro Histórico.",
		},
		{
			ID:          "tracking_states",
			Title:       "Estados de tracking",
			Description: "Compare badges Ao vivo, Sinal atrasado e Sem sinal na lista e no mapa.",
		},
	}
}

func (a *API) handleDemoReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	sc, err := scenario.Load()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	a.Sim.Reset(sc)
	writeJSON(w, http.StatusOK, map[string]string{"status": "reset"})
}

type advanceRequest struct {
	Ticks int `json:"ticks"`
}

func (a *API) handleDemoAdvance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req advanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Ticks <= 0 {
		req.Ticks = 10
	}
	if req.Ticks > 200 {
		req.Ticks = 200
	}
	a.Sim.TickN(req.Ticks)
	writeJSON(w, http.StatusOK, map[string]int{"tick": a.Store.Tick()})
}

type triggerRequest struct {
	CourierID string `json:"courier_id"`
	Action    string `json:"action"`
}

func (a *API) handleDemoTrigger(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req triggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if !a.Sim.TriggerAction(req.CourierID, req.Action) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown action"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func CORS(next http.Handler, allowedOrigin string, demoControls bool) http.Handler {
	methods := "GET, OPTIONS"
	if demoControls {
		methods = "GET, POST, OPTIONS"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", methods)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func NewTestServer(st *store.Store, hub *sse.Hub) *httptest.Server {
	api := &API{Store: st, Hub: hub}
	mux := http.NewServeMux()
	api.Register(mux)
	return httptest.NewServer(CORS(mux, "*", false))
}

func DecodeJSON[T any](body string) (T, error) {
	var v T
	err := json.NewDecoder(strings.NewReader(body)).Decode(&v)
	return v, err
}
