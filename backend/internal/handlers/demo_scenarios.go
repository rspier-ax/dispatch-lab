package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

type scenarioDef struct {
	id          string
	title       string
	description string
	kind        string // visual | scripted | random_scripted
	courierID   string
	deliveryID  string
	fixedScripts []domain.ScriptAction
}

func scenarioRegistry() []scenarioDef {
	return []scenarioDef{
		{
			id:          "poa07_stale",
			title:       "POA-07 — sinal atrasado",
			description: "Selecione DEL-007 e aguarde o tick 45 (~45s) para ver o entregador ficar com sinal atrasado na Rua dos Andradas.",
			kind:        "scripted",
			courierID:   "POA-07",
			deliveryID:  "DEL-007",
			fixedScripts: []domain.ScriptAction{
				{CourierID: "POA-07", Tick: 45, Action: "go_stale"},
				{CourierID: "POA-07", Tick: 90, Action: "reconnect"},
			},
		},
		{
			id:          "random_stale",
			title:       "Sinal atrasado — entregador aleatório",
			description: "Escolhe um entregador ao vivo e agenda perda de sinal e reconexão nos próximos ticks.",
			kind:        "random_scripted",
		},
		{
			id:          "explore_routes",
			title:       "Explorar rotas nas ruas",
			description: "Selecione qualquer entregador ao vivo e observe a rota restante seguindo o grid viário do Centro Histórico.",
			kind:        "visual",
		},
		{
			id:          "tracking_states",
			title:       "Estados de tracking",
			description: "Compare badges Ao vivo, Sinal atrasado e Sem sinal na lista e no mapa.",
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
	ScenarioID string `json:"scenario_id"`
	CourierID  string `json:"courier_id,omitempty"`
	ConfirmReset bool `json:"confirm_reset,omitempty"`
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
	preview := buildScenarioPreview(a.Store, req.ScenarioID, req.CourierID)
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

	preview := buildScenarioPreview(a.Store, req.ScenarioID, req.CourierID)
	if !preview.CanApply {
		writeJSON(w, http.StatusConflict, preview)
		return
	}
	if preview.RequiresReset && !req.ConfirmReset {
		writeJSON(w, http.StatusConflict, preview)
		return
	}

	result := domain.ScenarioApplyResult{
		FocusedCourierID: preview.FocusedCourierID,
		DeliveryID:       preview.DeliveryID,
		FitMap:           preview.FitMap,
		Scripts:          preview.Scripts,
	}

	if preview.RequiresReset {
		sc, err := scenario.Load()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		a.Sim.Reset(sc)
		result.ResetPerformed = true
	}

	if len(preview.Scripts) > 0 {
		a.Store.SetScripts(preview.Scripts)
		result.Scripts = preview.Scripts
	}

	writeJSON(w, http.StatusOK, result)
}

func buildScenarioPreview(st *store.Store, scenarioID, courierOverride string) domain.ScenarioPreview {
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
		lines := []string{def.description}
		preview := domain.ScenarioPreview{
			CanApply:     true,
			SummaryLines: lines,
		}
		if def.id == "explore_routes" {
			preview.FitMap = true
			preview.SummaryLines = append([]string{"Ajustará a visão do mapa para a área de operação."}, lines...)
		}
		if def.id == "tracking_states" {
			preview.SummaryLines = append([]string{
				"Use a lista de entregas e o mapa para comparar estados de tracking.",
				"Dica: use “Forçar sinal atrasado” na aba Controle para simular manualmente.",
			}, lines...)
		}
		return preview

	case "scripted":
		scripts := append([]domain.ScriptAction(nil), def.fixedScripts...)
		return previewForScripts(st, def.courierID, def.deliveryID, scripts, tick, intervalMS)

	case "random_scripted":
		courierID := courierOverride
		if courierID == "" {
			courierID = pickRandomLiveCourier(st, seed, tick)
		}
		if courierID == "" {
			return domain.ScenarioPreview{
				CanApply:    false,
				BlockReason: "Nenhum entregador ao vivo disponível para este cenário.",
			}
		}
		scripts := []domain.ScriptAction{
			{CourierID: courierID, Tick: tick + 20, Action: "go_stale"},
			{CourierID: courierID, Tick: tick + 50, Action: "reconnect"},
		}
		deliveryID := primaryDeliveryID(st, courierID)
		return previewForScripts(st, courierID, deliveryID, scripts, tick, intervalMS)

	default:
		return domain.ScenarioPreview{
			CanApply:    false,
			BlockReason: "Tipo de cenário não suportado.",
		}
	}
}

func previewForScripts(
	st *store.Store,
	courierID, deliveryID string,
	scripts []domain.ScriptAction,
	tick, intervalMS int,
) domain.ScenarioPreview {
	lines := []string{
		fmt.Sprintf("Focará o entregador %s.", courierID),
	}
	if deliveryID != "" {
		lines = append(lines, fmt.Sprintf("Entrega associada: %s.", deliveryID))
	}

	pastScript := false
	for _, sc := range scripts {
		action := scriptActionLabel(sc.Action)
		secs := (sc.Tick - tick) * intervalMS / 1000
		if sc.Tick <= tick {
			pastScript = true
			lines = append(lines, fmt.Sprintf("%s · %s no tick %d (já passou).", sc.CourierID, action, sc.Tick))
		} else {
			lines = append(lines, fmt.Sprintf("%s · %s no tick %d (~%ds).", sc.CourierID, action, sc.Tick, secs))
		}
	}

	preview := domain.ScenarioPreview{
		CanApply:         true,
		SummaryLines:     lines,
		FocusedCourierID: courierID,
		DeliveryID:       deliveryID,
		Scripts:          scripts,
	}

	if pastScript {
		preview.RequiresReset = true
		preview.SummaryLines = append([]string{
			"Reiniciará a simulação para reagendar os scripts.",
		}, preview.SummaryLines...)
	}

	return preview
}

func scriptActionLabel(action string) string {
	switch action {
	case "go_stale":
		return "sinal atrasado"
	case "reconnect":
		return "reconexão"
	default:
		return action
	}
}

func pickRandomLiveCourier(st *store.Store, seed, tick int) string {
	couriers := st.Couriers()
	var live []domain.Courier
	for _, c := range couriers {
		if c.TrackingState == domain.TrackingLive && c.DeliveryID != "" {
			live = append(live, c)
		}
	}
	if len(live) == 0 {
		return ""
	}
	sort.Slice(live, func(i, j int) bool { return live[i].ID < live[j].ID })
	idx := (seed + tick) % len(live)
	return live[idx].ID
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
