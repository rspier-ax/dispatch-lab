package handlers

import (
	"net/http"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
)

func (a *API) handleDemoPreviewReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	preview := buildResetPreview(a.ControlsEnabled)
	writeJSON(w, http.StatusOK, preview)
}

func buildResetPreview(controlsEnabled bool) domain.ActionPreview {
	if !controlsEnabled {
		return domain.ActionPreview{
			CanApply:    false,
			BlockReason: "Controles de demo indisponíveis neste backend.",
		}
	}

	lines := []string{
		"Reinicia a operação do zero.",
		"Restaura entregas e posições iniciais.",
		"Novo plano de eventos será sorteado — o progresso atual será perdido.",
	}

	return domain.ActionPreview{
		CanApply:     true,
		SummaryLines: lines,
	}
}
