# Demo guide

Step-by-step walkthrough for the DispatchLab operator console demo. UI labels below match the current **pt-BR** interface; repository documentation stays English-only (see [i18n roadmap](./i18n-roadmap.md)).

## Prerequisites

- Backend and frontend running (two terminals — see [Run locally](../../README.md#run-locally)).
- Viewport width ≥ 768px (desktop/tablet layout).

## Demo center panel

1. Open http://localhost:4200.
2. On the map, click **Central da demo** to open the docked panel on the left.

### Controle (Control)

- Simulation controls, map display options, playback, and progress toward the POA-07 stale/reconnect script.
- Optional dev controls when `DEMO_CONTROLS=true` is set on the backend (see below).

### Cenários (Scenarios)

- Pick a scenario card and click **Aplicar cenário** (e.g. POA-07 selects delivery DEL-007).

### Eventos (Events)

- Structured SSE event feed with a per-courier filter.

### Map overlay

- Scenario bbox and demo version appear as a discrete overlay at the bottom of the map (no fixed footer).

## Operator flow

1. **Refresh (F5):** a full-screen boot loader avoids a flash of zero metrics or a disconnected SSE state before the stream is ready.
2. **Select a courier** on the map: the blue route polyline shows the **remaining** segment; the gray dashed segment is already traveled.
3. **Queued deliveries:** items with the **Na fila** badge share a courier in the scenario (20 deliveries / 15 couriers). The simulator animates only the primary active delivery per courier.

## Recommended script: `#POA-07`

Courier `#POA-07` follows Rua dos Andradas. At simulation tick 45 tracking becomes `stale` (GPS/connectivity loss). At tick 90 it reconnects to `live`. This path is deterministic (seed 42) and covered by E2E.

## Dev controls (optional)

Set `DEMO_CONTROLS=true` on the backend to enable reset, quick stale/reconnect simulations, and **Resetar demo** in the panel.

```bash
# Windows (PowerShell)
$env:DEMO_CONTROLS="true"; go run ./cmd/server

# bash
DEMO_CONTROLS=true go run ./cmd/server
```

**Do not** enable `DEMO_CONTROLS` in CI.

## Disabled controls (roadmap)

These UI controls exist but remain disabled until backend support lands:

- No-signal simulation
- Per-courier route reset
- Seek slider
- Playback speed x2 / x5
- Auto-event toggles

## E2E and tick speed

Playwright E2E uses `SIM_TICK_MS=200` to accelerate simulation ticks. Do not combine accelerated ticks with `DEMO_CONTROLS` in CI.

From the repo root:

```bash
npm run test:e2e
```

See [README test strategy](../../README.md#test-strategy) for the full testing matrix.
