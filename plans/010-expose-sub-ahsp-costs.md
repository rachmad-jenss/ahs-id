# Plan 010: Make sub-AHSP costs reconcile in results, CLI, and Excel

> **Executor instructions**: This changes a public result shape. Preserve
> backward compatibility where practical and verify all renderers.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/calculator/sub-ahsp.ts packages/core/src/types/index.ts packages/core/src/exporter apps/cli/src/commands tests/golden`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/007-establish-independent-golden-oracles.md`
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Resolved sub-AHSP totals are included in `baseTotal` but omitted from the
returned groups. CLI and Excel label direct cost as A+B+C even when those three
subtotals do not add up. Nested work must be visible and reconcilable.

## Current state

- `packages/core/src/calculator/hsp.ts:98-108` resolves and adds sub-AHSP total.
- `hsp.ts:116-127` returns only labor, material, and equipment groups.
- `packages/core/src/exporter/excel.ts:127-149` renders those groups and labels
  base total “A+B+C”.
- `apps/cli/src/commands/calc-hsp.ts:51-69` does the same.
- `packages/core/src/calculator/sub-ahsp.ts` already returns typed resolved
  components; unit tests exist in `__tests__/sub-ahsp.test.ts`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Core | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/hsp.test.ts src/calculator/__tests__/sub-ahsp.test.ts src/exporter/__tests__/excel.test.ts` | all pass |
| CLI | `pnpm --filter @ahs-id/cli exec vitest run` | all pass |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- HSP result types and calculator assembly
- CLI text/JSON output
- Excel RAB layout
- Focused tests and one synthetic nested fixture

**Out of scope**
- Changing recursive pricing semantics or circular detection
- Introducing real bundle nesting data
- Calculator-pipeline consolidation (Plan 014)

## Git workflow

Require a DAS issue. Branch `fix/DAS-N-expose-sub-ahsp-costs`; commit
`DAS-N: expose sub-AHSP costs in results`.

## Steps

### Step 1: Define the public representation

Add a dedicated required `subAhsp: readonly SubAhspResolvedComponent[]` field
to `HSPResult`; return an empty array for non-nested items. Keep `groups`
strictly L/M/E so existing group switches remain compatible. Document
coefficient, child unit price, and total semantics. In rendered RAB output,
label non-empty nested work as section D and recap as A+B+C+D.

**Verify**: TypeScript declaration tests compile for old three-group consumers.

### Step 2: Assemble and reconcile

Map `resolveSubAhsp().components` into the public representation. Add an
invariant test that visible group/sub-AHSP totals sum to `baseTotal` within
floating-point tolerance.

**Verify**: synthetic nested calculator test passes.

### Step 3: Render every surface

Add a clearly labeled nested-work section to CLI and Excel. Change the direct
cost label from A+B+C to include the new section only when present.

**Verify**: inspect parsed workbook rows and captured CLI output in tests.

## Test plan

- No-sub-AHSP result remains backward compatible.
- One and multiple children render and reconcile.
- Volume-converted child values are displayed.
- Excel and CLI labels match arithmetic.

## Done criteria

- [ ] Every amount included in `baseTotal` is visible to consumers.
- [ ] Old non-nested results are unchanged.
- [ ] CLI, JSON, and Excel tests pass.
- [ ] Full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- A compatible public shape cannot be added without a major-version break.
- Renderer requirements conflict with the RAB column contract.
- Existing child pricing semantics appear incorrect.

## Maintenance notes

Reviewers should add subtotal-reconciliation assertions to any new output
surface. Plan 014 may later share this result assembly across calculators.
