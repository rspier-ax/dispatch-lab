# Engineering practice

How we implement and review changes on DispatchLab.

## Implementation order

1. Domain types (Go `internal/domain`, Angular `services/dispatch/types.ts`)
2. Scenario JSON and simulator tick loop
3. REST handlers and SSE hub
4. `DispatchProvider` and `DispatchStreamService`
5. Presentational components (map, list, detail)
6. Tests at the layer that changed

Prefer extending existing files over parallel implementations.

## Before proposing changes

State explicitly:

- What exists today in the relevant area
- What will be reused vs added
- Which files will change

Do not add a new service or component if an equivalent already covers the use case.

## Review standards

Changes that typically require revision:

- Fetch or EventSource inside `components/` instead of `features/` or services
- Missing loading, empty, or error states on new data-bound UI
- Monolithic page files owning map + list + detail without separation
- API or event schema changes without tests or ADR when architectural

## Manual verification

After substantive UI or workflow changes:

```bash
cd backend && go test ./...
cd frontend && npm run typecheck && npm run lint && npm run test -- --watch=false
```

Smoke the operator path: load map → see couriers moving → select `#POA-07` → observe stale state → wait for reconnect → confirm timeline.

## Tests expected by change type

| Change | Minimum |
|--------|---------|
| Simulator / geo math | Go unit test |
| SSE hub | Go unit test |
| Stream merge logic | Jasmine unit test |
| Map / selection UX | Component test or E2E |
| Full workflow | Playwright E2E |
