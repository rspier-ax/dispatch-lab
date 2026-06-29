# Demo guide

Step-by-step walkthrough for the DispatchLab operator console demo. UI labels below match the current **pt-BR** interface; repository documentation stays English-only (see [i18n roadmap](./i18n-roadmap.md)).

## Prerequisites

- Backend and frontend running — `./scripts/dev.sh` enables demo controls automatically.
- Viewport width ≥ 768px (desktop/tablet layout).

## Demo center panel

1. Open http://localhost:4200.
2. On the map, click **Central da demo** to open the docked panel on the left.

### Status strip (above tabs)

- **Ao vivo** badge, elapsed operation time (`Tempo de operação · 1m 42s`), discrete tick counter, and a secondary line for the next scheduled network event (or a count of upcoming events).
- No simulated wall clock or fixed 0–90 progress bar — events vary per session.

### Controle (Control)

- Select a courier on the map or delivery list — quick actions target that selection (no separate focus dropdown).
- **Forçar sinal atrasado** only works when the selected courier is **Ao vivo**; **Reconectar** only when **Sinal atrasado**.
- Map display toggles (bbox, polyline).

### Cenários (Scenarios)

- Banner **Modo atual · Operação ao vivo** shows the live session summary.
- Each card has an **Executar** button — no footer apply step.
- **Surpresa de rede** / **Dois entregadores** — confirmation modal, schedules 2–4 network events from the current tick (does not reset the simulation).
- **Enquadrar mapa** — instant, fits map to Centro Histórico.
- **Estados de tracking** — opens Controle tab; focuses a stale courier if one exists.
- **Fila na operação** — filters the delivery list to **Na fila** items only.

### Eventos (Events)

Compact summary inside the demo center (panel stays 480px wide):

- Mini stats: scheduled agenda count, queue count, and scenario lock / live mode.
- **Próximo evento** card for the next scripted action (courier, action, ETA).
- **Últimos eventos** — up to five recent SSE items as stacked cards (badge, time, title; courier is clickable).
- **Ver auditoria completa** opens the full audit workspace on the map (see below).

Clicking the status strip (when events are scheduled) switches to this tab without opening the full overlay.

### Eventos operacionais (map overlay)

- Map button **Eventos operacionais** (top-left, next to **Central da demo**) opens a full-width overlay between the map controls and legend.
- KPI strip plus stacked sections: **Agenda**, **Fila na operação**, **Histórico ao vivo** (single column, scroll per section).
- Close with **×** or toggle the map button again.
- Only one of **Central da demo** or **Eventos operacionais** is open at a time; **Ver auditoria completa** closes the center and opens the overlay.

### Reset

- **Resetar demo** opens a confirmation dialog with three concise bullets (restart, restore state, new random event plan) before restarting the simulation.
- Confirm with **Confirmar reset** — full-screen loader shows **Reiniciando demo…** until the operation reloads.
- Requires demo controls (enabled by default locally).

### Confirmation before destructive actions

**Resetar demo** and scripted scenarios (**Surpresa de rede**, **Dois entregadores**) use the confirmation dialog:

| Action | Dialog title | Primary button |
|--------|--------------|----------------|
| Reset | Resetar demo | Confirmar reset (red) |
| Scripted scenario | Aplicar cenário | Confirmar |

Visual scenarios (**Enquadrar mapa**, **Estados de tracking**, **Fila na operação**) run immediately via **Executar**.

Quick actions (force stale / reconnect) apply immediately without confirmation when the courier state allows it.

### Map controls

- **Enquadrar mapa** (top-left of map) fits the viewport to the scenario bounds.
- **Eventos operacionais** — full operations audit overlay (agenda, queue, live history).
- **Central da demo** — docked demo center panel; mutually exclusive with **Eventos operacionais**.

- Scenario bbox and demo version appear as a discrete overlay at the bottom of the map (no fixed footer).

## Operator flow

1. **Refresh (F5):** a full-screen boot loader avoids a flash of zero metrics or a disconnected SSE state before the stream is ready.
2. **Select a courier** on the map: the blue route polyline shows the **remaining** segment; the gray dashed segment is already traveled.
3. **Queued deliveries:** items with the **Na fila** badge share a courier in the scenario (20 deliveries / 15 couriers). The simulator animates only the primary active delivery per courier.
4. **Delivery list filters:** phase (Na fila / Coletando / Em rota), courier, tracking state, sort by ETA or restaurant.

## Live session (network events)

On server boot and on every **Resetar demo**, the backend rolls a **session plan** of 2–4 scripted network events (`go_stale` / `reconnect`) on 1–2 live couriers. Plans are deterministic for a given session nonce but differ between resets.

Courier positions, routes, and delivery lifecycle remain fixed (seed 42). Use **Surpresa de rede** or **Dois entregadores** to re-roll during a presentation, or **Forçar sinal atrasado** / **Reconectar** for manual control.

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
  -d '{"scenario_id":"network_surprise"}'

curl -X POST http://localhost:8080/api/demo/apply-scenario \
  -H 'Content-Type: application/json' \
  -d '{"scenario_id":"network_surprise"}'
```

## Disabled controls (roadmap)

Removed from the demo center until backend support lands: no-signal simulation, per-courier route reset, seek slider, playback speed, auto-event toggles.

## E2E and tick speed

Playwright E2E uses `SIM_TICK_MS=200` and `DEMO_CONTROLS=true` via CI config.

From the repo root:

```bash
npm run test:e2e
```

See [README test strategy](../../README.md#test-strategy) for the full testing matrix.
