# Plan 017: Pre-index stable calculator and validator lookups

> **Executor instructions**: Optimize only measured repeated lookups and keep
> duplicate-key behavior explicit.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/calculator/hsd-peralatan.ts packages/core/src/validator/validate-bundle.ts packages/core/src/calculator/__tests__`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/014-consolidate-calculator-pipelines.md`,
  `plans/015-decouple-productivity-dispatch.md`,
  `plans/016-apply-branded-units.md`
- **Category**: perf
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Root/nested calculations and validation repeatedly scan stable bundle/HSD
arrays. The current 422-item bundle is manageable, so this is a low-priority
batch-calculation improvement; it should land only with measured benefit and
without changing first-match semantics accidentally.

## Current state

- `packages/core/src/calculator/hsp.ts:53` linearly finds each AHSP item.
- `hsp.ts:143-177` repeatedly finds HSD labor/material entries.
- `packages/core/src/calculator/hsd-peralatan.ts:194-198,241-247` scans rental
  and labor arrays.
- `packages/core/src/validator/validate-bundle.ts:76` rebuilds the complete AHSP
  code set for every item.
- Equipment, material-master, and conversion maps are already built once in
  `createCalculator`, providing the style to follow.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Core | `pnpm --filter @ahs-id/core exec vitest run` | all pass |
| Benchmark | `node scripts/benchmark-calculator.mjs --iterations 50 --rounds 5 --json` | JSON reports identical result checksum and post-change median ≤80% of recorded baseline |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- Per-calculator AHSP/HSD indexes
- One-time validator sets/maps
- Duplicate-key validation required before maps
- Deterministic micro-benchmark or operation-count test
- `scripts/benchmark-calculator.mjs` (create)

**Out of scope**
- Caching across calculator instances
- Global mutable caches
- Parallelism/workers
- Formula or public API changes

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-preindex-lookups`; commit
`DAS-N: pre-index calculator lookups`.

## Steps

### Step 1: Establish baseline and duplicate semantics

Create `scripts/benchmark-calculator.mjs` with the command shown above. Warm up,
then measure five 50-iteration rounds calculating the same representative
BM-2022 batch; emit median milliseconds and a checksum of all totals. Record
the baseline JSON in the PR description, not as a machine-specific committed
golden. Add validator errors for duplicate AHSP, HSD labor/material/equipment
refs before maps replace linear first-match behavior.

**Verify**: duplicate tests fail on current validator and baseline is recorded.

### Step 2: Build immutable indexes once

At `createCalculator` construction, build AHSP and HSD maps alongside existing
maps and pass them to focused helpers. In `validateBundle`, construct
`ahspCodes` once outside the loop.

**Verify**: core and golden tests pass with unchanged totals.

### Step 3: Re-measure

Run the exact same command on the same machine. Keep the change only if result
checksums match and post-change median time is at most 80% of baseline. Otherwise
mark this plan `REJECTED: measured gain below 20%` and revert its code changes.

## Test plan

- Duplicate keys fail clearly.
- Missing refs retain existing errors.
- Nested calculations use the index and preserve circular detection.
- Benchmark compares identical item/result sets.

## Done criteria

- [x] Repeated target `.find()` calls and per-item set construction are removed.
- [x] Duplicate behavior is explicit.
- [x] Numeric outputs are unchanged.
- [x] Measured batch improvement is recorded; full gates pass.
- [x] `plans/README.md` status row is updated.

## STOP conditions

- No material measured improvement.
- Map construction changes accepted duplicate semantics without validator coverage.
- Consolidation from Plan 014 has moved the relevant boundaries.

## Maintenance notes

Do not add global caching: bundles and regional HSDs are caller-supplied. Revisit
indexes if mutable bundle support is ever introduced.
