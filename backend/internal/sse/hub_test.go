package sse

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBroadcastDeliversToSubscriber(t *testing.T) {
	h := NewHub()
	ch := h.Subscribe()
	defer h.Unsubscribe(ch)

	h.Broadcast("position_update", map[string]string{"courier_id": "POA-01"})

	select {
	case msg := <-ch:
		if len(msg) == 0 {
			t.Fatal("empty message")
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for broadcast")
	}
}

func TestFormatSSEValidJSON(t *testing.T) {
	data, _ := json.Marshal(map[string]int{"tick": 1})
	msg := formatSSE("tick", data)
	if len(msg) == 0 {
		t.Fatal("expected formatted SSE message")
	}
}
