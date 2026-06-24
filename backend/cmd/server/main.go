package main

import (
	"log"
	"net/http"
	"os"

	"github.com/rspier-ax/dispatch-lab/backend/internal/handlers"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/simulator"
	"github.com/rspier-ax/dispatch-lab/backend/internal/sse"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func main() {
	addr := envOr("PORT", "8080")
	origin := envOr("CORS_ORIGIN", "http://localhost:4200")

	sc, err := scenario.Load()
	if err != nil {
		log.Fatalf("load scenario: %v", err)
	}

	st := store.New(sc)
	hub := sse.NewHub()
	emit := func(eventType string, data interface{}) {
		hub.Broadcast(eventType, data)
	}
	sim := simulator.New(st, emit)

	stop := make(chan struct{})
	go sim.Run(stop)

	api := &handlers.API{Store: st, Hub: hub}
	mux := http.NewServeMux()
	api.Register(mux)

	log.Printf("DispatchLab backend listening on :%s (CORS %s)", addr, origin)
	if err := http.ListenAndServe(":"+addr, handlers.CORS(mux, origin)); err != nil {
		close(stop)
		log.Fatal(err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
