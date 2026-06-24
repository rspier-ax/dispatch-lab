# ADR-0002: Deterministic simulation

Date: 2026-06-24  
Status: accepted

## Context

DispatchLab is a demonstration console. E2E tests, README GIFs, and operator demos must show the same courier positions, stale event on `#POA-07`, and timeline entries on every run.

## Decision

Use a fixed random seed (`42`), static scenario file `poa_centro.json`, and scripted tick actions (stale at tick 45, reconnect at tick 90 for `#POA-07`). The simulator advances one tick per second from process start.

## Alternatives considered

- **Random walk each boot** — rejected; breaks E2E and demo repeatability.
- **Recorded GPS trace replay** — rejected for v1; adds file size and privacy concerns without benefit for fictional data.
- **Client-side simulation** — rejected; would not demonstrate backend streaming and concurrency.

## Consequences

+ Stable Playwright assertions and portfolio demo.
+ Simulator unit tests can assert exact positions at tick N.
- Not representative of production GPS noise; document in README limitations.
- Restarting the server resets simulation clock.

## References

- [architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- `backend/internal/simulator/`
- `backend/internal/scenario/poa_centro.json`
