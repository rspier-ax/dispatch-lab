# Frontend standards

## Layout and viewport

- **Minimum viewport:** 768px. Below that width, show a static “Larger screen required” message.
- **Shell:** full-height layout with map (main) + sidebar (deliveries + detail).
- **Shared controls:** consistent button, badge, and panel styles in `components/ui/`.

## Component ownership

- **`components/`** — presentational, props-in. Group by domain: `map`, `delivery-list`, `courier-detail`, `connection`, `ui`.
- **`features/`** — dispatch facade, stream subscription, page composition.
- **`app/`** — routes and layout only.

Keep components under ~150 lines. Split when a file owns more than one visual section.

## State management

| State type | Where |
|------------|-------|
| Snapshot data | `DispatchProvider` + feature service |
| Stream merge | `DispatchStreamService` |
| Selected courier | `DispatchFacadeService` signal/state |
| UI ephemeral | local component state |

Do not fetch or open EventSource inside presentational components.

## Accessibility

- Semantic HTML: `main`, `nav`, `aside`, `table`, `button`.
- Skip link to `#main-content`.
- Visible `:focus-visible` outlines.
- `aria-live="polite"` on connection status and timeline updates.
- Map markers: accessible list alternative in sidebar.

## Loading, empty, error

Every data-bound section must handle:

- **Loading** — skeleton or spinner with label.
- **Empty** — “No active deliveries” with context.
- **Error** — message + retry action.

## Map conventions

- Leaflet map centered on Mercado Público (`-30.0277, -51.2284`), zoom 15.
- Marker colors: green = `live`, amber = `stale`, gray = `offline`.
- Selected courier: highlighted marker + route polyline.

## Testing

| Change | Minimum |
|--------|---------|
| Service / stream logic | Jasmine unit test |
| Component behavior | `TestBed` + DOM assertions |
| Critical operator path | Playwright E2E |

Run `npm run test -- --watch=false` before PR.

## PR checklist

- [ ] No fetch/EventSource in `components/`
- [ ] Loading / empty / error states
- [ ] Tests for changed behavior
- [ ] ADR if architectural boundary shifts
