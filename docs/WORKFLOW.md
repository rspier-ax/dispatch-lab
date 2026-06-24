# Development workflow

Branch format: **`rspier/<type>/<short-description>`**

| Type | Use for |
|------|---------|
| `chore` | Scaffold, tooling, config |
| `design` | UI shell, layout, visual polish |
| `feature` | User-facing behavior |
| `docs` | Documentation-only changes |
| `bugfix` | Defect fixes |

## Flow

```
Plan / README intent
       ↓
Feature branch (rspier/*)
       ↓
Small PR with tests
       ↓
Update living docs only if behavior changed
```

## Pull requests

- One logical bucket per PR (map, SSE hub, CI, etc.).
- Include test plan: unit tests run, E2E if workflow changed.
- Do not commit directly to `main`.

## Anti-patterns

- Monolithic PR covering entire app
- Docs that duplicate code line-by-line
- ADR for every minor styling choice
