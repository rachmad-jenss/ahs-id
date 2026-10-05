# 019 — Web audit wave 4 (motion, form controls, typography)

- **Status**: IN PROGRESS
- **Commit**: a71fbdf
- **Issue**: DAS-53
- **Severity**: mixed (closes residual audit findings post wave-3)

## Scope

| ID | Fix |
| --- | --- |
| F51 | `Input` keeps `md:text-sm` → force `text-base` (iOS zoom) |
| F52 | Native `<select>` duplicated → shared `NativeSelect` / `selectFieldClassName` |
| F53 | Coefficient columns → `tabular-nums` |
| F54 | `font-optical-sizing: auto` on `body` |
| F55 | Catalog list/empty swap → `.catalog-surface-enter` with `@starting-style` |
| F56 | Featured cards → `.featured-card-enter` stagger (reduced-motion safe) |
| F57 | `ui-residual` dist contract → `pretest` runs `astro build` |

## Verification

- `pnpm --filter @ahs-id/web test`
- In-app browser: home, katalog, theme toggle, mobile menu
