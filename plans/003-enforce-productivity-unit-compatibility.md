# Plan 003: Enforce dimensional compatibility between productivity and payment units

> **Executor instructions**: Treat this as a financial-formula change. Follow
> every verification and do not invent source assumptions. Update the index on
> completion.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/calculator/produktivitas packages/core/src/calculator/__tests__ packages/pupr-2023/data/ahsp/bina-marga/divisi-3/3.3.3-penyiapan-badan-jalan.json tests/golden`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/001-validate-runtime-variables.md`
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

AHSP `3.3.3` is paid per m², but vibratory-roller and water-tanker helpers
return m³/hour. `hsp.ts` blindly inverts productivity, treating hours/m³ as
hours/m². This is dimensionally invalid and can materially misprice work.

## Current state

- `3.3.3-penyiapan-badan-jalan.json:6,52-82,160-162` explicitly says the
  payment unit is area, not volume.
- `packages/core/src/calculator/produktivitas/lintasan.ts:31-54` returns roller
  productivity in `m3/jam`.
- `packages/core/src/calculator/produktivitas/siklus.ts:121-143` returns tanker
  productivity in watered-material `m3/jam`.
- `packages/core/src/calculator/hsp.ts:315-326` computes `1 / produktivitas`
  without inspecting `ProduktivitasResult.satuan`.
- Existing unit-conversion tests are in
  `packages/core/src/calculator/__tests__/produktivitas.test.ts`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Productivity tests | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/produktivitas.test.ts src/calculator/__tests__/hsp.test.ts` | all pass |
| Golden | `pnpm --filter @ahs-id/golden-tests exec vitest run` | all pass |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `packages/core/src/calculator/hsp.ts`
- `packages/core/src/calculator/produktivitas/lintasan.ts`
- `packages/core/src/calculator/produktivitas/siklus.ts`
- Related core tests
- `3.3.3-penyiapan-badan-jalan.json` only if source-backed parameters are required
- A dedicated golden fixture and independently derived expected file for `3.3.3`

**Out of scope**
- Formula dispatch refactor (Plan 015)
- Other AHSP data corrections
- Relaxing Rp0.01 golden tolerance

## Git workflow

Require a DAS issue. Branch `fix/DAS-N-productivity-unit-contract`; commit
`DAS-N: enforce productivity unit compatibility`.

## Steps

### Step 1: Add explicit dimensional regression tests

Add a test that calculates `3.3.3` and asserts every dynamic coefficient's
productivity denominator is compatible with `m2`. Add a generic mismatch test
that must throw rather than silently invert incompatible units.

**Verify**: focused tests fail on current behavior.

### Step 2: Verify authoritative area formulas

Download the official Permen PUPR 8/2023 attachment from JDIH PUPR
(`https://jdih.pu.go.id/`) into the gitignored `tools/docling/sources/`
directory and inspect provenance page `III-35`. For roller, determine whether
the correct area formula is `(v_m × width × efficiency) / passes`. For tanker,
obtain or derive a source-backed water requirement in liters/m²; do not silently
reuse liters/m³. Record the source page and derivation in code JSDoc and fixture
provenance; never commit the PDF unless licensing policy explicitly allows it.

**Verify**: a reviewer can reproduce both coefficients from written units.

### Step 3: Encode output units in coefficient resolution

Make unit compatibility explicit and exhaustive. Add area-specific helper
parameters/functions if needed; preserve existing volume helpers for m³-paid
items. Before inversion, assert the productivity unit matches the item payment
unit.

**Verify**: focused tests pass; a synthetic mismatch throws.

### Step 4: Add an independent golden fixture

Create a `3.3.3` fixture and manually derived expected values. Do not use
`gen-expected.test.ts` as the oracle.

## Test plan

- Roller area productivity with known hand calculation.
- Tanker area productivity with source-backed water rate.
- Existing roller/tanker m³ formulas unchanged.
- End-to-end `3.3.3` HSP within Rp0.01 of independent expected output.
- Incompatible output/payment unit throws with both units in the message.

## Done criteria

- [ ] No hours/m³ coefficient is accepted for an m² item.
- [ ] `3.3.3` has an independent golden fixture.
- [ ] Existing volume-paid golden fixtures remain unchanged.
- [ ] Full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- The source does not establish an area-based tanker requirement.
- Fixing the item requires a guessed thickness or conversion factor.
- More than the scoped item changes without a documented shared root cause.

## Maintenance notes

Every future productivity helper must declare a machine-checkable output unit.
Reviewers must inspect dimensions and source derivations, not only test snapshots.
