package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	"github.com/rspier-ax/dispatch-lab/backend/internal/demo"
	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

type scenarioDef struct {
	id          string
	title       string
	description string
	kind        string // visual | random_scripted
	courierID   string
	deliveryID  string
	planOpts    *demo.PlanOptions
}

func scenarioRegistry() []scenarioDef {
	return []scenarioDef{
		{
			id:          "network_surprise",
			title:       "Surpresa de rede",
			description: "Agenda 2–4 eventos de sinal atrasado/reconexão em entregadores ao vivo. Use para criar tensão durante a apresentação.",
			kind:        "random_scripted",
		},
		{
			id:          "double_stale",
			title:       "Dois entregadores",
			description: "Dois entregadores perdem sinal em sequência rápida — ideal para mostrar impacto na lista de entregas.",
			kind:        "random_scripted",
			planOpts:    &demo.PlanOptions{ForceTwoCouriers: true, CloserTicks: true},
		},
		{
			id:          "explore_routes",
			title:       "Enquadrar mapa",
			description: "Centraliza o mapa na área do Centro Histórico. Use no início da demo para contextualizar a operação.",
			kind:        "visual",
		},
		{
			id:          "tracking_states",
			title:       "Estados de tracking",
			description: "Foca um entregador com sinal atrasado (se houver) e abre a aba Controle para comparar badges e simulações manuais.",
			kind:        "visual",
		},
		{
			id:          "queue_focus",
			title:       "Fila na operação",
			description: "Filtra a lista de entregas para mostrar apenas itens na fila — entregas aguardando rota do entregador.",
			kind:        "visual",
		},
	}
}

func findScenarioDef(id string) (scenarioDef, bool) {
	for _, s := range scenarioRegistry() {
		if s.id == id {
			return s, true
		}
	}
	return scenarioDef{}, false
}

func demoScenarios() []domain.DemoScenario {
	out := make([]domain.DemoScenario, 0, len(scenarioRegistry()))
	for _, s := range scenarioRegistry() {
		out = append(out, domain.DemoScenario{
			ID:          s.id,
			Title:       s.title,
			Description: s.description,
			CourierID:   s.courierID,
			DeliveryID:  s.deliveryID,
		})
	}
	return out
}

type scenarioRequest struct {
	ScenarioID   string `json:"scenario_id"`
	CourierID    string `json:"courier_id,omitempty"`
	ConfirmReset bool   `json:"confirm_reset,omitempty"`
}

func (a *API) handleDemoPreviewScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req scenarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ScenarioID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	preview := a.buildScenarioPreview(req.ScenarioID, req.CourierID, previewNonce(a.SessionNonce, req.ScenarioID))
	writeJSON(w, http.StatusOK, preview)
}

func (a *API) handleDemoApplyScenario(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req scenarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ScenarioID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	def, ok := findScenarioDef(req.ScenarioID)
	if !ok {
		writeJSON(w, http.StatusConflict, domain.ScenarioPreview{
			CanApply:    false,
			BlockReason: "Cenário desconhecido.",
		})
		return
	}

	preview := a.buildScenarioPreview(req.ScenarioID, req.CourierID, previewNonce(a.SessionNonce, req.ScenarioID))
	if !preview.CanApply {
		writeJSON(w, http.StatusConflict, preview)
		return
	}
	if preview.RequiresReset && !req.ConfirmReset {
		writeJSON(w, http.StatusConflict, preview)
		return
	}

	result := applyScenario(a, def, preview, req.ConfirmReset)
	writeJSON(w, http.StatusOK, result)
}

func previewNonce(sessionNonce int, scenarioID string) int {
	def, ok := findScenarioDef(scenarioID)
	if ok && def.kind == "random_scripted" {
		return sessionNonce + 1
	}
	return sessionNonce
}

func applyScenario(a *API, def scenarioDef, preview domain.ScenarioPreview, confirmReset bool) domain.ScenarioApplyResult {
	result := domain.ScenarioApplyResult{
		FocusedCourierID: preview.FocusedCourierID,
		DeliveryID:       preview.DeliveryID,
		FitMap:           preview.FitMap,
		UIHint:           uiHintFromPreview(def.id, preview),
	}

	switch def.kind {
	case "random_scripted":
		var scripts []domain.ScriptAction
		if preview.RequiresReset && confirmReset {
			sc, err := scenario.Load()
			if err != nil {
				return result
			}
			a.Sim.Reset(sc)
			a.SessionNonce++
			a.clearScenarioLock()
			result.ResetPerformed = true
			scripts = demo.RollSessionPlan(sc.Seed, a.SessionNonce, 0, demo.LiveCourierIDs(a.Store), def.planOpts)
			a.Store.SetScripts(scripts)
			result.Scripts = scripts
			result.UIHint = summarizeUIHint(scripts, 0, 1000)
		} else {
			a.SessionNonce++
			tick := a.Store.Tick()
			scripts = demo.RollSessionPlan(a.Store.Scenario().Seed, a.SessionNonce, tick, demo.LiveCourierIDs(a.Store), def.planOpts)
			a.Store.SetScripts(scripts)
			result.Scripts = scripts
			result.UIHint = summarizeUIHint(scripts, tick, 1000)
		}
		a.setScenarioLock(def.id, scripts)

	case "visual":
		switch def.id {
		case "explore_routes":
			result.FitMap = true
			result.UIHint = "Mapa enquadrado na área do Centro Histórico."
		case "tracking_states":
			if id := firstStaleCourierID(a.Store); id != "" {
				result.FocusedCourierID = id
				result.DeliveryID = primaryDeliveryID(a.Store, id)
			}
			result.OpenControlTab = true
			result.UIHint = "Aba Controle aberta — use Forçar sinal atrasado no entregador selecionado."
		case "queue_focus":
			n := queuedDeliveryCount(a.Store)
			result.QueueFocus = true
			result.UIHint = fmt.Sprintf("Lista filtrada: %d entrega(s) na fila.", n)
		}
	}

	return result
}

func uiHintFromPreview(scenarioID string, preview domain.ScenarioPreview) string {
	if len(preview.SummaryLines) > 0 {
		switch scenarioID {
		case "network_surprise", "double_stale":
			return preview.SummaryLines[0]
		case "explore_routes":
			return "Mapa enquadrado na área do Centro Histórico."
		case "queue_focus":
			for _, line := range preview.SummaryLines {
				if len(line) > 10 {
					return line
				}
			}
		}
	}
	return ""
}

func summarizeUIHint(scripts []domain.ScriptAction, tick, intervalMS int) string {
	lines := demo.SummarizeScripts(scripts, tick, intervalMS)
	if len(lines) > 0 {
		return lines[0]
	}
	return "Eventos de rede agendados."
}

func (a *API) buildScenarioPreview(scenarioID, courierOverride string, rollNonce int) domain.ScenarioPreview {
	st := a.Store
	def, ok := findScenarioDef(scenarioID)
	if !ok {
		return domain.ScenarioPreview{
			CanApply:    false,
			BlockReason: "Cenário desconhecido.",
		}
	}

	tick := st.Tick()
	seed := st.Scenario().Seed
	intervalMS := 1000

	switch def.kind {
	case "visual":
		return previewForVisual(def, st)

	case "random_scripted":
		live := demo.LiveCourierIDs(st)
		if len(live) == 0 {
			return domain.ScenarioPreview{
				CanApply:    false,
				BlockReason: "Nenhum entregador ao vivo disponível para este cenário.",
			}
		}
		if def.id == "double_stale" && len(live) < 2 {
			return domain.ScenarioPreview{
				CanApply:    false,
				BlockReason: "São necessários pelo menos 2 entregadores ao vivo para este cenário.",
			}
		}

		baseTick := tick
		pastScript := scriptsWouldBePast(st, rollNonce, baseTick, seed, live, def.planOpts)
		if pastScript {
			baseTick = 0
		}

		if a.isScenarioLockActive() && !pastScript {
			remaining := countRemainingScripts(st, tick)
			return domain.ScenarioPreview{
				CanApply:    false,
				BlockReason: scenarioLockBlockReason(remaining),
			}
		}

		scripts := demo.RollSessionPlan(seed, rollNonce, baseTick, live, def.planOpts)
		focused := firstScriptCourier(scripts)
		if courierOverride != "" {
			focused = courierOverride
		}
		deliveryID := primaryDeliveryID(st, focused)

		lines := demo.SummarizeScripts(scripts, tick, intervalMS)
		if pastScript {
			lines = append([]string{"Reiniciará a simulação para reagendar os eventos."}, lines...)
		}

		return domain.ScenarioPreview{
			CanApply:         true,
			SummaryLines:     lines,
			FocusedCourierID: focused,
			DeliveryID:       deliveryID,
			Scripts:          scripts,
			RequiresReset:    pastScript,
		}

	default:
		return domain.ScenarioPreview{
			CanApply:    false,
			BlockReason: "Tipo de cenário não suportado.",
		}
	}
}

func firstScriptCourier(scripts []domain.ScriptAction) string {
	for _, sc := range scripts {
		if sc.Action == "go_stale" {
			return sc.CourierID
		}
	}
	if len(scripts) > 0 {
		return scripts[0].CourierID
	}
	return ""
}

func previewForVisual(def scenarioDef, st *store.Store) domain.ScenarioPreview {
	lines := []string{def.description}
	preview := domain.ScenarioPreview{
		CanApply:     true,
		SummaryLines: lines,
	}

	switch def.id {
	case "explore_routes":
		preview.FitMap = true
		preview.SummaryLines = []string{
			"Enquadrará o mapa na área do Centro Histórico.",
			def.description,
		}
	case "tracking_states":
		staleID := firstStaleCourierID(st)
		if staleID != "" {
			preview.FocusedCourierID = staleID
			preview.DeliveryID = primaryDeliveryID(st, staleID)
			preview.SummaryLines = []string{
				fmt.Sprintf("Focará %s (sinal atrasado) e abrirá a aba Controle.", staleID),
				"Use Forçar sinal atrasado / Reconectar no entregador selecionado.",
			}
		} else {
			preview.SummaryLines = []string{
				"Abrirá a aba Controle para comparar badges na lista e no mapa.",
				"Selecione um entregador ao vivo e use Forçar sinal atrasado para simular.",
			}
		}
	case "queue_focus":
		queued := queuedDeliveryCount(st)
		if queued == 0 {
			return domain.ScenarioPreview{
				CanApply:    false,
				BlockReason: "Não há entregas na fila no momento.",
			}
		}
		preview.SummaryLines = []string{
			fmt.Sprintf("Filtrará a lista para %d entrega(s) na fila.", queued),
			"Nenhum script automático será agendado.",
		}
	}
	return preview
}

func firstStaleCourierID(st *store.Store) string {
	var stale []domain.Courier
	for _, c := range st.Couriers() {
		if c.TrackingState == domain.TrackingStale && c.DeliveryID != "" {
			stale = append(stale, c)
		}
	}
	if len(stale) == 0 {
		return ""
	}
	sort.Slice(stale, func(i, j int) bool { return stale[i].ID < stale[j].ID })
	return stale[0].ID
}

func scriptsWouldBePast(st *store.Store, sessionNonce, baseTick, seed int, live []string, opts *demo.PlanOptions) bool {
	scripts := demo.RollSessionPlan(seed, sessionNonce, baseTick, live, opts)
	tick := st.Tick()
	for _, sc := range scripts {
		if sc.Tick <= tick {
			return true
		}
	}
	return false
}

func queuedDeliveryCount(st *store.Store) int {
	courierPrimary := map[string]string{}
	for _, c := range st.Couriers() {
		courierPrimary[c.ID] = c.DeliveryID
	}
	n := 0
	for _, d := range st.Deliveries() {
		if primary, ok := courierPrimary[d.CourierID]; ok && primary != d.ID {
			n++
		}
	}
	return n
}

func primaryDeliveryID(st *store.Store, courierID string) string {
	for _, d := range st.Deliveries() {
		if d.CourierID == courierID && d.Status != domain.StatusDelivered {
			return d.ID
		}
	}
	for _, c := range st.Couriers() {
		if c.ID == courierID {
			return c.DeliveryID
		}
	}
	return ""
}
