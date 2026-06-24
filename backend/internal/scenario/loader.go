package scenario

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
)

//go:embed poa_centro.json
var poaCentroJSON []byte

func Load() (*domain.Scenario, error) {
	var s domain.Scenario
	if err := json.Unmarshal(poaCentroJSON, &s); err != nil {
		return nil, fmt.Errorf("parse scenario: %w", err)
	}
	if s.Seed == 0 {
		return nil, fmt.Errorf("scenario missing seed")
	}
	if len(s.Couriers) == 0 {
		return nil, fmt.Errorf("scenario has no couriers")
	}
	return &s, nil
}
