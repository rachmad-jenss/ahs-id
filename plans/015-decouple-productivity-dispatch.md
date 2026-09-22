# Plan 015: Dispatch productivity by an explicit exhaustive model

> **Executor instructions**: Preserve every formula and numeric output. This is
> a dispatch refactor, not a productivity rewrite.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/calculator/produktivitas packages/core/src/types packages/core/schemas packages/pupr-2023/data/peralatan-master.json packages/core/src/calculator/__tests__ tests/golden`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/003-enforce-productivity-unit-compatibility.md`,
  `plans/014-consolidate-calculator-pipelines.md`
- **Category**: tech-debt
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The central calculator dispatches six formula variants using exact equipment
codes in addition to broad `tipe_produksi`. A new equipment row cannot reuse an
existing formula without editing `hsp.ts`, increasing expansion risk.

## Current state

- `packages/core/src/calculator/hsp.ts:348-437` checks exact codes `E.01`,
  `E.08`, `E.11`, `E.25`, `E.22`, and `E.19`.
- Formula implementations already live in focused files under
  `packages/core/src/calculator/produktivitas/`.
- `docs/architecture.md:985-1004` intends dispatch by productivity type/module.
- TypeScript switches over unions must include a `never` exhaustiveness check.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Productivity | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/produktivitas.test.ts src/calculator/__tests__/hsp.test.ts` | all pass |
| Schemas | `pnpm validate-data` | exit 0 |
| Golden/full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0; numeric locks unchanged |

## Scope

**In scope**
- A discriminated productivity-model type/schema
- Equipment master entries that currently use dynamic formulas
- Exhaustive dispatcher and focused tests

**Out of scope**
- Formula arithmetic changes
- New equipment/formula models
- Correcting data not required for the discriminant

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-productivity-dispatch`; commit
`DAS-N: decouple productivity dispatch from equipment codes`.

## Steps

### Step 1: Characterize all six mappings

Add tests proving each current equipment code reaches its present helper and
produces the same productivity/audit output. Add an unsupported-model test.

**Verify**: tests pass before schema/type changes.

### Step 2: Add an explicit model discriminant

Define values such as `excavator-cycle`, `dump-truck-cycle`,
`wheel-loader-cycle`, `water-tanker-cycle`, `vibro-roller-pass`,
`motor-grader-pass`, and `throughput`. Use names matching domain vocabulary.
Update JSON Schema and current master rows.

**Verify**: `pnpm validate-data` passes and missing/unknown models fail schema.

### Step 3: Implement exhaustive dispatch

Switch on the discriminant and construct the existing typed parameters. Include
`const unreachable: never = model` in the default branch. Remove exact-code
conditions only after all current rows have model values.

**Verify**: focused tests and typecheck pass.

### Step 4: Prove numeric parity

Run all golden tests; expected files must not change.

## Test plan

- One test per discriminant.
- Unknown/missing discriminant schema failure.
- Compile-time exhaustiveness.
- Existing golden outputs unchanged.

## Done criteria

- [ ] No productivity helper dispatch depends on an equipment code.
- [ ] Switch is exhaustive.
- [ ] Formula source files are unchanged except unit-contract work from Plan 003.
- [ ] Full gates pass with no numeric fixture changes.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- A single equipment code legitimately needs multiple models at runtime.
- Existing master data cannot distinguish models without new parameters.
- Any numeric output changes.

## Maintenance notes

New equipment can reuse a model by data configuration; a truly new model still
requires type, schema, dispatcher, and tests in one reviewed change.
