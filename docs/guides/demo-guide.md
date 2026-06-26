# Demo guide

Step-by-step walkthrough for the DispatchLab operator console demo. UI labels below match the current **pt-BR** interface; repository documentation stays English-only (see [i18n roadmap](./i18n-roadmap.md)).

## Prerequisites

- Backend and frontend running — `./scripts/dev.sh` enables demo controls automatically.
- Viewport width ≥ 768px (desktop/tablet layout).

## Demo center panel

1. Open http://localhost:4200.
2. On the map, click **Central da demo** to open the docked panel on the left.

### Status strip (above tabs)

- Simulated clock with **· Ao vivo**, current **Tick**, next scheduled script (or **Todos os scripts executados**), and a compact progress bar.

### Controle (Control)

- **Entregador em foco** selects and highlights the courier on the map (no separate highlight toggle).
- Quick actions: force stale / reconnect when demo controls are enabled.
- Map display toggles (bbox, polyline).

### Cenários (Scenarios)

- Pick a scenario card; **Aplicar cenário** stays disabled until you change the selection.
- Click **Aplicar cenário** to open a confirmation dialog with a summary of effects (focus courier, scheduled scripts, reset warning, or block reason).
- Scenarios:
  - **POA-07 — sinal atrasado** — fixed scripts at ticks 45 and 90; focuses POA-07.
  - **Sinal atrasado — entregador aleatório** — picks a live courier and schedules stale/reconnect at tick+20 and tick+50.
  - **Explorar rotas** — fits the map to the operation area (visual only).
  - **Estados de tracking** — guidance for comparing tracking badges.

### Eventos (Events)

- Structured SSE event feed with a per-courier filter.

### Reset

- **Resetar demo** opens a confirmation dialog summarizing what will change (tick back to 0, deliveries restored, default scripts, etc.) before restarting the simulation.
- Confirm with **Confirmar reset** — the dialog shows **Reiniciando demo…** while the reload completes.
- Requires demo controls (enabled by default locally).

### Confirmation before destructive actions

Both **Resetar demo** and **Aplicar cenário** use the same confirmation dialog pattern:

| Action | Dialog title | Primary button |
|--------|--------------|----------------|
| Reset | Resetar demo | Confirmar reset (red) |
| Apply scenario | Aplicar cenário | Confirmar |

The dialog lists bullet points describing effects. Scenario apply may show an extra warning when the simulation must restart first. Blocked actions show a reason instead of the confirm button.

Quick actions (force stale / reconnect) apply immediately without confirmation.

### Map overlay

- Scenario bbox and demo version appear as a discrete overlay at the bottom of the map (no fixed footer).

## Operator flow

1. **Refresh (F5):** a full-screen boot loader avoids a flash of zero metrics or a disconnected SSE state before the stream is ready.
2. **Select a courier** on the map: the blue route polyline shows the **remaining** segment; the gray dashed segment is already traveled.
3. **Queued deliveries:** items with the **Na fila** badge share a courier in the scenario (20 deliveries / 15 couriers). The simulator animates only the primary active delivery per courier.
4. **Delivery list filters:** phase (Na fila / Coletando / Em rota), courier, tracking state, sort by ETA or restaurant.

## Recommended script: `#POA-07`

Courier `#POA-07` follows Rua dos Andradas. At simulation tick 45 tracking becomes `stale` (GPS/connectivity loss). At tick 90 it reconnects to `live`. This path is deterministic (seed 42) and covered by E2E.

## Dev controls

Demo controls (**Resetar demo**, simulações rápidas, aplicar cenários) are **enabled by default** when running the backend locally. `./scripts/dev.sh` still sets `DEMO_CONTROLS=true` explicitly.

To disable (e.g. production-like run):

```bash
DEMO_CONTROLS=false go run ./cmd/server
```

Production deploy (`fly.toml`) sets `DEMO_CONTROLS=false`.

## API (demo controls enabled)

```bash
curl -X POST http://localhost:8080/api/demo/preview-reset \
  -H 'Content-Type: application/json' \
  -d '{}'

curl -X POST http://localhost:8080/api/demo/preview-scenario \
  -H 'Content-Type: application/json' \
  -d '{"scenario_id":"random_stale"}'

curl -X POST http://localhost:8080/api/demo/apply-scenario \
  -H 'Content-Type: application/json' \
  -d '{"scenario_id":"random_stale"}'
```

## Disabled controls (roadmap)

These UI controls exist but remain disabled until backend support lands:

- No-signal simulation
- Per-courier route reset
- Seek slider
- Playback speed x2 / x5
- Auto-event toggles

## E2E and tick speed

Playwright E2E uses `SIM_TICK_MS=200` and `DEMO_CONTROLS=true` via CI config.

From the repo root:

```bash
npm run test:e2e
```

See [README test strategy](../../README.md#test-strategy) for the full testing matrix.
