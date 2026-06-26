# DispatchLab frontend

Angular operator console for the DispatchLab demo. See the [project README](../README.md) and [documentation index](../docs/README.md) for architecture, ADRs, and workflow.

The **UI is pt-BR** today (POA Centro operator narrative). **Repository docs are English only** — see [i18n roadmap](../docs/guides/i18n-roadmap.md).

## Commands

From this directory:

```bash
npm start                    # Dev server (proxies /api → :8080)
npm run typecheck
npm run lint
npm run test -- --watch=false
npm run build
```

E2E tests run from the repo root: `npm run test:e2e`.
