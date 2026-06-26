package demo

import (
	"fmt"
	"testing"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
)

func liveIDs() []string {
	return []string{"POA-01", "POA-02", "POA-03", "POA-04", "POA-05", "POA-06", "POA-07"}
}

func TestRollSessionPlanDeterministic(t *testing.T) {
	a := RollSessionPlan(42, 1, 0, liveIDs(), nil)
	b := RollSessionPlan(42, 1, 0, liveIDs(), nil)
	if len(a) == 0 {
		t.Fatal("expected scripts")
	}
	if len(a) < 2 || len(a) > 4 {
		t.Fatalf("expected 2–4 actions, got %d", len(a))
	}
	for i := range a {
		if a[i].CourierID != b[i].CourierID || a[i].Tick != b[i].Tick || a[i].Action != b[i].Action {
			t.Fatalf("non-deterministic roll: %+v vs %+v", a, b)
		}
	}
}

func TestRollSessionPlanVariesByNonce(t *testing.T) {
	a := RollSessionPlan(42, 1, 0, liveIDs(), nil)
	b := RollSessionPlan(42, 2, 0, liveIDs(), nil)
	if len(a) == 0 || len(b) == 0 {
		t.Fatal("expected scripts")
	}
	same := len(a) == len(b)
	if same {
		for i := range a {
			if a[i] != b[i] {
				same = false
				break
			}
		}
	}
	if same {
		t.Fatal("expected different plans for different session nonces")
	}
}

func TestRollSessionPlanDoubleStale(t *testing.T) {
	opts := &PlanOptions{ForceTwoCouriers: true, CloserTicks: true}
	scripts := RollSessionPlan(42, 5, 0, liveIDs(), opts)
	if len(scripts) != 4 {
		t.Fatalf("expected 4 actions for two couriers, got %d", len(scripts))
	}
	couriers := map[string]int{}
	for _, sc := range scripts {
		couriers[sc.CourierID]++
	}
	if len(couriers) != 2 {
		t.Fatalf("expected 2 couriers, got %d: %+v", len(couriers), couriers)
	}
	for _, sc := range scripts {
		if sc.Tick < 0 {
			t.Fatalf("invalid tick %d", sc.Tick)
		}
	}
}

func TestRollSessionPlanNoDuplicateCourierTick(t *testing.T) {
	scripts := RollSessionPlan(42, 99, 10, liveIDs(), nil)
	seen := map[string]struct{}{}
	for _, sc := range scripts {
		key := sc.CourierID + ":" + itoaTick(sc.Tick)
		if _, ok := seen[key]; ok {
			t.Fatalf("duplicate courier/tick: %s", key)
		}
		seen[key] = struct{}{}
	}
}

func TestRollSessionPlanStaleBeforeReconnect(t *testing.T) {
	scripts := RollSessionPlan(42, 3, 0, liveIDs(), nil)
	byCourier := map[string][]domain.ScriptAction{}
	for _, sc := range scripts {
		byCourier[sc.CourierID] = append(byCourier[sc.CourierID], sc)
	}
	for id, list := range byCourier {
		if len(list) != 2 {
			t.Fatalf("courier %s expected 2 actions, got %d", id, len(list))
		}
		if list[0].Action != "go_stale" || list[1].Action != "reconnect" {
			t.Fatalf("unexpected action order for %s: %+v", id, list)
		}
		if list[1].Tick-list[0].Tick < 15 {
			t.Fatalf("reconnect too close to stale for %s: gap %d", id, list[1].Tick-list[0].Tick)
		}
	}
}

func TestSummarizeScripts(t *testing.T) {
	scripts := []domain.ScriptAction{
		{CourierID: "POA-03", Tick: 30, Action: "go_stale"},
		{CourierID: "POA-03", Tick: 60, Action: "reconnect"},
	}
	lines := SummarizeScripts(scripts, 10, 1000)
	if len(lines) == 0 {
		t.Fatal("expected summary lines")
	}
	if lines[0] == "" {
		t.Fatal("empty summary")
	}
}

func itoaTick(n int) string {
	return fmt.Sprintf("%d", n)
}
