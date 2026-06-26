# ADR-0002: Deterministic simulation

Date: 2026-06-24  
Status: accepted (amended 2026-06-24)

## Context

DispatchLab is a demonstration console. E2E tests, README GIFs, and operator demos must show the same courier positions, delivery lifecycle, and timeline entries on every run.

## Decision

Use a fixed random seed (`42`) and static scenario file `poa_centro.json` for courier routes, deliveries, and map bounds. The simulator advances one tick per second from process start.

**Network events** (stale / reconnect) are no longer fixed in the JSON. Instead, each server boot and each demo reset rolls a **session plan** of 2–4 scripted actions on 1–2 live couriers (`backend/internal/demo/session.go`). Plans are deterministic for a given session nonce but vary between sessions.

## Alternatives considered

- **Random walk each boot** — rejected for positions; breaks E2E and demo repeatability.
- **Fixed POA-07 script in JSON** — rejected; repetitive for live presentations.
- **Recorded GPS trace replay** — rejected for v1; adds file size and privacy concerns without benefit for fictional data.
- **Client-side simulation** — rejected; would not demonstrate backend streaming and concurrency.

## Consequences

+ Stable Playwright assertions for map, deliveries, and UI flows.
+ Simulator unit tests can assert exact positions at tick N.
+ Demo presentations get varied network-event timing without changing geography.
- Not representative of production GPS noise; document in README limitations.
- Restarting the server resets simulation clock and rolls a new session plan.

## References

- [architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- `backend/internal/simulator/`
- `backend/internal/demo/session.go`
- `backend/internal/scenario/poa_centro.json`
