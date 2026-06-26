package demo

import (
	"fmt"
	"sort"

	"github.com/rspier-ax/dispatch-lab/backend/internal/domain"
	"github.com/rspier-ax/dispatch-lab/backend/internal/store"
)

// PlanOptions tweaks session roll behaviour (e.g. double_stale scenario).
type PlanOptions struct {
	ForceTwoCouriers bool
	CloserTicks      bool
}

func hashMix(a, b, c int) int {
	x := uint32(a)*2654435761 + uint32(b)*2246822519 + uint32(c)*3266489917
	x ^= x << 13
	x ^= x >> 17
	x ^= x << 5
	return int(x & 0x7fffffff)
}

// BootNonce derives an initial session nonce from store boot time and scenario seed.
func BootNonce(st *store.Store) int {
	return int(st.StartedAt().Unix()) + st.Scenario().Seed*1000
}

// LiveCourierIDs returns sorted IDs of couriers that are live with an active delivery.
func LiveCourierIDs(st *store.Store) []string {
	var ids []string
	for _, c := range st.Couriers() {
		if c.TrackingState == domain.TrackingLive && c.DeliveryID != "" {
			ids = append(ids, c.ID)
		}
	}
	sort.Strings(ids)
	return ids
}

func pickCouriers(seed, sessionNonce int, live []string, count int) []string {
	if count <= 0 || len(live) == 0 {
		return nil
	}
	if count > len(live) {
		count = len(live)
	}
	order := append([]string(nil), live...)
	sort.SliceStable(order, func(i, j int) bool {
		hi := hashMix(seed, sessionNonce, i)
		hj := hashMix(seed, sessionNonce, j)
		if hi != hj {
			return hi < hj
		}
		return order[i] < order[j]
	})
	return order[:count]
}

// RollSessionPlan builds a deterministic 2–4 action session plan for live couriers.
func RollSessionPlan(seed, sessionNonce, baseTick int, liveCourierIDs []string, opts *PlanOptions) []domain.ScriptAction {
	if len(liveCourierIDs) == 0 {
		return nil
	}
	if opts == nil {
		opts = &PlanOptions{}
	}

	courierCount := 1
	if opts.ForceTwoCouriers && len(liveCourierIDs) >= 2 {
		courierCount = 2
	} else if len(liveCourierIDs) >= 2 {
		courierCount = 1 + hashMix(seed, sessionNonce, 1)%2
	}

	picked := pickCouriers(seed, sessionNonce, liveCourierIDs, courierCount)
	var scripts []domain.ScriptAction
	prevStale := baseTick

	for i, courierID := range picked {
		salt := i * 10
		var staleTick, gap int

		if opts.CloserTicks {
			if i == 0 {
				staleTick = baseTick + 15 + hashMix(seed, sessionNonce, salt+2)%11
			} else {
				staleTick = baseTick + 18 + hashMix(seed, sessionNonce, salt+2)%8
				if staleTick <= prevStale {
					staleTick = prevStale + 3
				}
			}
			gap = 15 + hashMix(seed, sessionNonce, salt+3)%11
		} else {
			if i == 0 {
				staleTick = baseTick + 20 + hashMix(seed, sessionNonce, salt+2)%36
			} else {
				offset := 15 + hashMix(seed, sessionNonce, salt+4)%11
				staleTick = prevStale + offset
			}
			gap = 25 + hashMix(seed, sessionNonce, salt+3)%21
		}

		reconnectTick := staleTick + gap
		prevStale = staleTick

		scripts = append(scripts,
			domain.ScriptAction{CourierID: courierID, Tick: staleTick, Action: "go_stale"},
			domain.ScriptAction{CourierID: courierID, Tick: reconnectTick, Action: "reconnect"},
		)
	}

	sort.Slice(scripts, func(i, j int) bool {
		if scripts[i].Tick != scripts[j].Tick {
			return scripts[i].Tick < scripts[j].Tick
		}
		return scripts[i].CourierID < scripts[j].CourierID
	})
	return scripts
}

// ApplySessionPlan rolls and stores a session plan at tick 0.
func ApplySessionPlan(st *store.Store, seed, sessionNonce int, opts *PlanOptions) []domain.ScriptAction {
	scripts := RollSessionPlan(seed, sessionNonce, 0, LiveCourierIDs(st), opts)
	st.SetScripts(scripts)
	return scripts
}

// SummarizeScripts returns short human-readable lines for previews (max 3 bullets).
func SummarizeScripts(scripts []domain.ScriptAction, tick, intervalMS int) []string {
	if len(scripts) == 0 {
		return []string{"Nenhum evento de rede agendado."}
	}
	upcoming := 0
	couriers := map[string]struct{}{}
	for _, sc := range scripts {
		if sc.Tick > tick {
			upcoming++
			couriers[sc.CourierID] = struct{}{}
		}
	}
	if upcoming == 0 {
		return []string{"Todos os eventos agendados já ocorreram — reinicie para sortear novamente."}
	}
	lines := []string{
		fmt.Sprintf("Agendará %d evento(s) de rede em %d entregador(es) ao vivo.", upcoming, len(couriers)),
	}
	if intervalMS <= 0 {
		intervalMS = 1000
	}
	if next := nextScript(scripts, tick); next != nil {
		secs := (next.Tick - tick) * intervalMS / 1000
		action := scriptActionLabel(next.Action)
		lines = append(lines, fmt.Sprintf("Primeiro evento: %s · %s em ~%ds.", next.CourierID, action, secs))
	}
	if len(lines) > 3 {
		lines = lines[:3]
	}
	return lines
}

func nextScript(scripts []domain.ScriptAction, tick int) *domain.ScriptAction {
	for i := range scripts {
		if scripts[i].Tick > tick {
			cp := scripts[i]
			return &cp
		}
	}
	return nil
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

