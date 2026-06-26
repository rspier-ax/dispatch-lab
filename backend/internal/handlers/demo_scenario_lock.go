package handlers

import (
	"fmt"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func (a *API) clearScenarioLock() {
	a.ActiveScenarioID = ""
	a.ScenarioLockUntilTick = 0
}

func (a *API) setScenarioLock(scenarioID string, scripts []domain.ScriptAction) {
	a.ActiveScenarioID = scenarioID
	a.ScenarioLockUntilTick = maxScriptTick(scripts)
}

func (a *API) isScenarioLockActive() bool {
	if a.ActiveScenarioID == "" {
		return false
	}
	return a.ScenarioLockUntilTick > a.Store.Tick()
}

func (a *API) scenarioLockInfo() *domain.ScenarioLockInfo {
	if !a.isScenarioLockActive() {
		return nil
	}
	tick := a.Store.Tick()
	remaining := countRemainingScripts(a.Store, tick)
	return &domain.ScenarioLockInfo{
		ActiveID:        a.ActiveScenarioID,
		UntilTick:       a.ScenarioLockUntilTick,
		RemainingEvents: remaining,
	}
}

func scenarioLockBlockReason(remaining int) string {
	return fmt.Sprintf(
		"Cenário anterior ainda em andamento (%d evento(s) restante(s)). Aguarde ou resete a demo.",
		remaining,
	)
}

func countRemainingScripts(st *store.Store, tick int) int {
	n := 0
	for _, sc := range st.Scenario().Scripts {
		if sc.Tick > tick {
			n++
		}
	}
	return n
}

func maxScriptTick(scripts []domain.ScriptAction) int {
	max := 0
	for _, sc := range scripts {
		if sc.Tick > max {
			max = sc.Tick
		}
	}
	return max
}
