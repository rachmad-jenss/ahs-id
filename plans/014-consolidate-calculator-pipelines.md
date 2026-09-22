# Plan 014: Consolidate HSP result assembly without merging pricing strategies

> **Executor instructions**: Preserve all public numeric outputs. Add
> characterization tests before moving code.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator packages/core/src/types packages/core/src/index.ts packages/core/src/calculator/__tests__ tests/golden`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/007-establish-independent-golden-oracles.md`, `plans/010-expose-sub-ahsp-costs.md`
- **Category**: tech-debt
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

`createCalculator`, `calcHspFromBundle`, and `calcHspFixedCoefficient`
independently build groups, margins, audit output, and final results. Their
capabilities have drifted: the parallel BM path lacks newer volume/sub-AHSP
semantics. Pricing strategies should stay distinct, but common result assembly
should have one implementation.

## Current state

- `packages/core/src/calculator/hsp.ts:73-127` assembles dynamic results.
- `bundle-calc.ts:24-72` repeats assembly for precomputed equipment coefficients.
- `fixed-coefficient.ts:82-120` repeats the same pattern.
- `packages/core/src/index.ts:108-112` exports all three paths.
- Existing characterization tests:
  `__tests__/hsp.test.ts`, `bundle-calc.test.ts`, and golden Cipta tests.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Core | `pnpm --filter @ahs-id/core exec vitest run` | all pass |
| Golden | `pnpm --filter @ahs-id/golden-tests exec vitest run` | all pass unchanged |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- Internal shared result/group assembly in `packages/core/src/calculator/`
- Characterization tests for all three public calculators
- Deprecation JSDoc for `calcHspFromBundle` if superseded
- Public exports only for backward-compatible deprecation

**Out of scope**
- Removing a public function in 0.x without explicit maintainer approval
- Combining fixed-coefficient and HSD price resolution
- Numeric formula changes
- Branded-unit migration (Plan 016)

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-consolidate-calculators`; commit
`DAS-N: consolidate HSP result assembly`.

## Steps

### Step 1: Add cross-path characterization

For equivalent synthetic component inputs, assert group totals, margin behavior,
warnings, audits, and result shape. Snapshot only stable structured values, not
timestamps or incidental messages.

**Verify**: all characterization tests pass before refactor.

### Step 2: Extract a private result assembler

Create an internal function accepting item identity, resolved component groups,
resolved nested-work section, margin inputs, warnings, and audit. It may sum and
assemble but must not perform HSD lookup, productivity, or fixed pricing.

**Verify**: dynamic calculator uses it with byte-for-byte numeric parity.

### Step 3: Migrate fixed and precomputed paths

Switch one path at a time, running focused and golden tests after each. If
`createCalculator` fully covers BM precomputed items, mark `calcHspFromBundle`
deprecated and document migration; do not delete it.

**Verify**: no expected numeric file changes.

### Step 4: Remove duplicated assembly

Name the shared function `assembleHspResult`. Run
`rg "const baseTotal =" packages/core/src/calculator --glob "*.ts"`; after the
refactor it must report one production match in the assembler (test fixture
matches may be excluded with `--glob "!**/__tests__/**"`).

## Test plan

- Characterization of normal, lump-sum, warnings, and nested-work result.
- All three calculator paths.
- Public deprecated path remains callable.
- Golden outputs unchanged within Rp0.01.

## Done criteria

- [ ] One internal result-assembly implementation remains.
- [ ] Pricing strategies remain separate and explicit.
- [ ] No public export is removed.
- [ ] Full gates pass with no golden-value edits.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Characterization reveals intentional semantic differences not documented.
- Consolidation requires a public breaking change.
- Any monetary output changes.

## Maintenance notes

Future result fields should be added in the shared assembler. Reviewers should
reject abstractions that also merge fundamentally different price resolution.
