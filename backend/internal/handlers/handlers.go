package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

type API struct {
	Store *store.Store
	Hub   *sse.Hub
}

func (a *API) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", a.handleHealth)
	mux.HandleFunc("GET /api/scenario", a.handleScenario)
	mux.HandleFunc("GET /api/couriers", a.handleCouriers)
	mux.HandleFunc("GET /api/deliveries", a.handleDeliveries)
	mux.HandleFunc("GET /api/couriers/{id}", a.handleCourierDetail)
	mux.HandleFunc("GET /api/stream", a.Hub.ServeHTTP)
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

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func CORS(next http.Handler, allowedOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
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
	return httptest.NewServer(CORS(mux, "*"))
}

func DecodeJSON[T any](body string) (T, error) {
	var v T
	err := json.NewDecoder(strings.NewReader(body)).Decode(&v)
	return v, err
}
