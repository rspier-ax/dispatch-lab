# ARCHITECTURE.md — DispatchLab

## Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Angular 19+, TypeScript strict | Standalone components, signals-friendly, enterprise SPA |
| Map | Leaflet + OpenStreetMap | No API key; deployable demo |
| Backend | Go 1.22+ | Concurrency, SSE hub, small binary |
| Streaming | Server-Sent Events | Push updates, auto-reconnect, one-way server→client |
| Tests | Go test, Karma/Jasmine, Playwright | Unit + one critical E2E path |
| Data (demo) | In-memory store + static scenario JSON | Deterministic POA Centro simulation |

## Problem statement

Operator dispatch consoles suffer a **visibility gap** when courier GPS or connectivity drops: the map point freezes or vanishes, ETAs stop updating, and disputes lack an event timeline. DispatchLab demonstrates live/stale/offline tracking states and an append-only event log for a fictional POA Centro operator.

## Boundaries

```
[Pages app/*]              → routes, layout, error handling
[Features features/*]      → dispatch facade, stream subscription, page composition
[Components components/*]  → props-in UI: map, list, detail, connection badge
[Services services/*]    → DispatchProvider contract, HTTP client, types
[Backend handlers/*]     → REST snapshot + SSE stream
[Backend simulator/*]    → deterministic tick loop, POA scenario scripts
[Backend internal/store] → in-memory courier/delivery/timeline state
```

Components must not call `fetch` or `EventSource` directly. Features use `DispatchProvider` or `DispatchStreamService`.

## Remote-state strategy

- **Snapshot:** `GET /api/scenario` on boot; couriers and deliveries refreshed via provider.
- **Streaming:** `DispatchStreamService` consumes SSE from `/api/stream`; merges `position_update`, `tracking_state_change`, `delivery_event`, `eta_update` into local state.
- **Selection:** selected courier ID held in feature service; detail panel reads from merged stream state.

## SSE event types

| Event | Payload | UI effect |
|-------|---------|-----------|
| `position_update` | courier id, lat, lng, timestamp | marker move, ETA recalc |
| `tracking_state_change` | courier id, state, last_seen_at | marker color, stale badge |
| `delivery_event` | delivery id, type, message | timeline append |
| `eta_update` | delivery id, eta_seconds | list + detail ETA |

## Connection states (client SSE)

| State | Meaning |
|-------|---------|
| `connected` | EventSource open, receiving events |
| `reconnecting` | EventSource closed, browser retrying |
| `disconnected` | Manual close or unrecoverable error |

## Error-handling strategy

- Route-level error component for unexpected failures.
- Section-level error states with retry for scenario load and stream.
- API returns structured `{ "error": "message" }` with appropriate HTTP status.
- CORS enabled for configured frontend origin.

## Demo scenario (POA-07)

Courier `#POA-07` follows Rua dos Andradas. At tick 45 the simulator sets `tracking_state` to `stale` (GPS/internet loss). At tick 90 it reconnects to `live`. E2E and README demo rely on this deterministic script.

## Replacing simulation with production systems

1. Replace in-memory store with PostgreSQL + Redis pub/sub.
2. Ingest real telematics via Kafka consumers (ADR roadmap v3).
3. Add OIDC auth at API gateway.
4. Integrate OSRM/GraphHopper for real ETAs and polylines.
5. Keep SSE/WebSocket contract stable behind versioned API.

## Authentication (production)

- OIDC at reverse proxy or Go middleware.
- Session carries operator ID and role.
- SSE endpoint requires valid session token.

## Scaling path

```
v1 in-memory SSE → v2 Redis pub/sub → v3 Kafka event log → v4 Postgres + auth → v5 OSRM routing
```

See README roadmap and ADRs for rationale at each step.
