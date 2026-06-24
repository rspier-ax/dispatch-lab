# DispatchLab

Read **`docs/README.md`** for architecture, standards, and ADRs.

## Product

Fictional **operator dispatch console** for monitoring active deliveries in Porto Alegre's Centro Histórico. Demo data only — header includes connection status and simulated courier tracking.

Workflow: map overview → select courier → inspect route, tracking state, ETA, and event timeline → observe stale/reconnect scenario on `#POA-07`.

## Stack

- Angular 19+, TypeScript strict, standalone components
- Go 1.22+ backend with SSE streaming
- Leaflet + OpenStreetMap
- Karma/Jasmine, Playwright

## Structure

```
frontend/src/app/     routes, features, components, services
backend/cmd/server/   HTTP + SSE entrypoint
backend/internal/     domain, simulator, sse, handlers, scenario
docs/                 architecture, standards, ADRs
e2e/                  Playwright specs
```

## Domain boundaries

**DispatchProvider** (`frontend/src/app/services/dispatch/`) — synchronous snapshot operations:

- `getScenario`, `getCouriers`, `getDeliveries`, `getCourierDetail`

**DispatchStream** — separate SSE integration:

- `GET /api/stream` via `EventSource`
- Hook: `features/dispatch/hooks/dispatch-stream.service.ts`
- Do not merge streaming into `DispatchProvider` without a new ADR.

**Types** — `services/dispatch/types.ts` is canonical; validate at boundaries.

**Simulation (demo)** — in-memory store in Go backend, deterministic seed `42`, scenario `poa_centro.json`. See ADR-0002 and ADR-0003.

## Quality expectations

- Desktop viewport ≥768px; no mobile layout in v1.
- Loading, empty, and error states on data-bound UI; retry when recoverable.
- Tracking timeline is append-only in the UI (no edit/delete).
- Read existing code before adding services or components.
- Contract or schema changes need tests; architectural shifts need an ADR in `docs/decisions/`.

## Validation

```bash
# Backend
cd backend && go vet ./... && go test ./...

# Frontend
cd frontend && npm run typecheck && npm run lint && npm run test -- --watch=false && npm run build

# E2E (from repo root)
npm run test:e2e
```

Playwright: `npx playwright install chromium` on first run.

## Further reading

| Document | Topic |
|----------|--------|
| [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | Boundaries, streaming, errors |
| [docs/frontend-standards.md](./docs/frontend-standards.md) | Components, a11y, testing |
| [docs/WORKFLOW.md](./docs/WORKFLOW.md) | Branches and PRs |
| [docs/engineering-practice.md](./docs/engineering-practice.md) | Implementation order |
| [docs/decisions/](./docs/decisions/) | ADRs |
