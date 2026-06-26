package handlers

import (
	"fmt"
	"net/http"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/scenario"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

func (a *API) handleDemoPreviewReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	intervalMS := 1000
	if a.Sim != nil {
		intervalMS = a.Sim.IntervalMS()
	}
	preview := buildResetPreview(a.Store, a.ControlsEnabled, intervalMS)
	writeJSON(w, http.StatusOK, preview)
}

func buildResetPreview(st *store.Store, controlsEnabled bool, intervalMS int) domain.ActionPreview {
	if !controlsEnabled {
		return domain.ActionPreview{
			CanApply:    false,
			BlockReason: "Controles de demo indisponíveis neste backend.",
		}
	}

	tick := st.Tick()
	active := len(st.Deliveries())
	completed := len(st.CompletedDeliveries())

	sc, err := scenario.Load()
	defaultScripts := []domain.ScriptAction{}
	if err == nil {
		defaultScripts = sc.Scripts
	}

	lines := []string{
		fmt.Sprintf("Simulação volta ao tick 0 (agora: tick %d).", tick),
		"Relógio simulado reinicia em 14:30:00.",
		fmt.Sprintf("Restaura %d entregas ativas e posições iniciais dos entregadores.", active),
	}

	if completed > 0 {
		lines = append(lines, fmt.Sprintf("Remove %d entregas concluídas da aba até evoluírem de novo.", completed))
	}

	if len(defaultScripts) > 0 {
		for _, script := range defaultScripts {
			action := scriptActionLabel(script.Action)
			lines = append(lines, fmt.Sprintf("Scripts voltam ao padrão: %s · %s no tick %d.", script.CourierID, action, script.Tick))
		}
	} else {
		lines = append(lines, "Scripts agendados são restaurados ao padrão do cenário.")
	}

	lines = append(lines,
		"Eventos recentes no painel podem não refletir o ciclo reiniciado imediatamente.",
		"Seleção no mapa pode mudar após o reload.",
	)

	_ = intervalMS // reserved for future copy with ~seconds
	return domain.ActionPreview{
		CanApply:     true,
		SummaryLines: lines,
	}
}
