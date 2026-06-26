# Internationalization roadmap

This document separates **repository language** from **application UI language** and outlines a future English locale for the operator console.

## Language conventions

| Surface | Language | Notes |
|---------|----------|-------|
| Repository docs (`README.md`, `docs/`, `AGENTS.md`, ADRs) | **English only** | No pt-BR prose in documentation |
| Application UI (templates, labels, aria text) | **pt-BR today** | POA Centro operator narrative |
| API payloads and IDs | English / neutral | Courier IDs, event types, JSON fields |

When quoting UI copy in docs, use the exact label as shown in the app (e.g. **Central da demo**, **Na fila**).

## Current pt-BR UI scope

Hardcoded Portuguese strings appear in:

- Angular templates (`demo-center-panel`, `dispatch-map`, `delivery-list`, `connection-indicator`, etc.)
- Formatting helpers in `frontend/src/app/lib/dispatch-view.utils.ts` (`toLocaleString('pt-BR')`, `toLocaleTimeString('pt-BR')`)
- Playwright E2E selectors that match visible labels in `e2e/dispatch-flow.spec.ts`

## Planned English locale

**Target:** add `en` alongside default `pt-BR` using [`@angular/localize`](https://angular.dev/guide/i18n).

The Angular CLI `extract-i18n` target is already defined in `frontend/angular.json`. Implementation steps (future work):

1. Mark user-visible strings with `i18n` attributes (or migrate to translation keys).
2. Run `ng extract-i18n` to produce XLIFF message catalogs (`messages.pt-BR.xlf`, `messages.en.xlf`).
3. Build locale-specific bundles (`pt-BR` default, `en` optional).
4. Centralize date/number formatting on `Intl` with an injected locale (replace hardcoded `'pt-BR'` in view utils).
5. Add a locale switcher or deploy separate URLs per locale (decision deferred).

## Testing impact

Before shipping English UI:

- Prefer stable `data-testid` attributes or role-based selectors that do not depend on translated copy where possible.
- When locale builds land, run E2E against the default locale or duplicate critical paths per locale.
- Keep unit tests locale-agnostic (assert behavior, not Portuguese strings) unless testing i18n plumbing.

## Out of scope

- Backend error message localization (HTTP/API remains English).
- Translating fictional restaurant or street names in the POA scenario (proper nouns stay as authored).
- Mobile layout or additional locales beyond `en` in the first i18n slice.

## Related docs

- [Frontend standards](../frontend-standards.md) — component and a11y conventions
- [Demo guide](./demo-guide.md) — operator walkthrough with current pt-BR labels
