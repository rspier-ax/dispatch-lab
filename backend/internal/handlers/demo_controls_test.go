package handlers_test

import (
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/handlers"
)

func TestDemoControlsEnabled(t *testing.T) {
	t.Setenv("DEMO_CONTROLS", "")
	if !handlers.DemoControlsEnabled() {
		t.Fatal("expected default enabled")
	}

	t.Setenv("DEMO_CONTROLS", "false")
	if handlers.DemoControlsEnabled() {
		t.Fatal("expected disabled when DEMO_CONTROLS=false")
	}

	t.Setenv("DEMO_CONTROLS", "true")
	if !handlers.DemoControlsEnabled() {
		t.Fatal("expected enabled when DEMO_CONTROLS=true")
	}
}
