# DispatchLab

![CI](https://github.com/rspier-ax/dispatch-lab/actions/workflows/ci.yml/badge.svg)

Real-time operator dispatch console for monitoring active deliveries in **Porto Alegre Centro Histórico** — live map, tracking states, and append-only event timelines.

> **Demonstration project.** All couriers, restaurants, and delivery IDs are fictional. This is not a production system and is not affiliated with iFood, Uber, or any logistics operator.

## Key capabilities

- **Live map** — 15 simulated couriers moving across POA Centro on OpenStreetMap (Leaflet).
- **Active delivery list** — restaurant, street, status, courier, and dynamic ETA.
- **Courier detail** — route polyline, `live` / `stale` / `offline` tracking state, last seen, event timeline.
- **Visibility gap demo** — courier `#POA-07` goes stale on Rua dos Andradas (tick 45) and reconnects (tick 90).
- **Connection resilience** — SSE stream with connected / reconnecting / disconnected indicator.

## Problem we demonstrate

When courier GPS or connectivity drops, operators lose visibility — the map point freezes and disputes lack a timeline. DispatchLab shows **last known position**, **stale duration**, and an **append-only event log** instead of silent disappearance.

## Demo workflow

Map overview → select delivery / courier → inspect route and timeline → observe `#POA-07` stale → reconnect.

## Architecture

```
Angular UI (operator console)
    ↓ DispatchProvider / DispatchStreamService
Go REST + SSE (/api/scenario, /api/stream)
    ↓
Deterministic simulator (seed 42, poa_centro.json)
    ↓
In-memory store (couriers, deliveries, timelines)
```

- **UI** — presentational components in `frontend/src/app/components/`; facade in `features/dispatch/`.
- **Domain** — canonical types in `services/dispatch/types.ts`.
- **Integration** — `DispatchProvider` for snapshots; `DispatchStreamService` for SSE (separate lifecycle — ADR-0001).
- **Simulation** — embedded POA Centro scenario with SMU/GIS bbox and real landmarks.

See [docs/README.md](./docs/README.md) for architecture notes and ADRs.

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Angular 19, TypeScript strict, standalone components |
| Map | Leaflet + OpenStreetMap |
| Backend | Go 1.22, SSE hub, goroutine tick loop |
| Tests | Go test, Karma/Jasmine, Playwright |

## Run locally

**Requirements:** Node.js ≥ 22, Go ≥ 1.22, viewport ≥ **768px**.

```bash
# Terminal 1 — backend
cd backend && go run ./cmd/server

# Terminal 2 — frontend (proxies /api → :8080)
cd frontend && npm install && npm start
```

Open http://localhost:4200

Or use `./scripts/dev.sh` (bash).

## Scripts

| Command | Location | Description |
|---------|----------|-------------|
| `go run ./cmd/server` | `backend/` | Start API + SSE simulator |
| `npm start` | `frontend/` | Dev server with API proxy |
| `go test ./...` | `backend/` | Go unit tests |
| `npm run test -- --watch=false` | `frontend/` | Angular unit tests |
| `npm run test:e2e` | repo root | Playwright E2E (starts both servers) |

## Test strategy

- **Go:** geo math, simulator stale/reconnect at ticks 45/90, SSE hub, REST handlers.
- **Angular:** stream merge logic, connection indicator labels.
- **E2E:** load map → select `#POA-07` → verify stale badge → verify reconnect.

## Limitations (v1)

- No authentication, database, Kafka, or real routing engine.
- Couriers follow straight-line waypoint segments (not road-snapped).
- Single-process in-memory state; restart resets simulation clock.
- Desktop/tablet layout only (≥768px).

## Production path

```
v1 in-memory SSE → v2 Redis pub/sub → v3 Kafka → v4 Postgres + auth → v5 OSRM routing
```

## Deploy

| Layer | Target | Notes |
|-------|--------|-------|
| Frontend | Cloudflare Pages | Build `frontend/`, output `dist/frontend/browser` |
| Backend | Fly.io | `backend/fly.toml`, set `CORS_ORIGIN` to Pages URL |

Update `frontend/src/environments/environment.prod.ts` with your Fly.io API URL.

## License

MIT — see [LICENSE](./LICENSE).
