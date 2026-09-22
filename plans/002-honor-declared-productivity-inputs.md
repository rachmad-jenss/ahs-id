# Plan 002: Make every declared productivity input affect or leave the contract

> **Executor instructions**: Execute in order, run each verification, and stop
> on the conditions below. Update `plans/README.md` when done.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/calculator/__tests__/hsp.test.ts packages/pupr-2023/data/ahsp/bina-marga/divisi-3 packages/pupr-2023/data/peralatan-master.json tests/golden`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: `plans/001-validate-runtime-variables.md`
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The public item contract declares `lebar_hamparan_m` and `kondisi_jalan=rusak`,
but changing either currently leaves HSP unchanged. A parameter that appears to
be accepted while being ignored is more dangerous than a rejected parameter in
a financial calculator.

## Current state

- `packages/core/src/calculator/hsp.ts:412-418` always uses master
  `lebar_efektif_m`, not runtime `lebar_hamparan_m`.
- `packages/core/src/calculator/hsp.ts:534-542` returns a fallback when no speed
  map key contains the selected road condition.
- `packages/pupr-2023/data/ahsp/bina-marga/divisi-3/3.2.1-lapis-pondasi-agregat.json:145-212`
  declares `baik`, `sedang`, `rusak` and width 1–10 m.
- `packages/pupr-2023/data/peralatan-master.json:191-204` has speed rows for
  `baik` and `sedang`, not `rusak`.
- At commit `96b2e85`, width 1 and 10 both produce `740113.4778088927`; `sedang`
  and `rusak` also produce that same total.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Core regression | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/hsp.test.ts` | all pass |
| Golden | `pnpm --filter @ahs-id/golden-tests exec vitest run` | all pass; 1 generator skipped |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `packages/core/src/calculator/hsp.ts`
- `packages/core/src/calculator/__tests__/hsp.test.ts`
- Only the exact PUPR item/master JSON needed to correct unsupported options
- Corresponding golden fixture/expected files if reviewed numeric changes require them

**Out of scope**
- New productivity models
- BM-2022 normalization
- Unit mismatch for area-paid roller/tanker work (Plan 003)

## Git workflow

Require an assigned DAS issue; otherwise STOP. Branch
`fix/DAS-N-productivity-input-contract`; commit
`DAS-N: honor declared productivity inputs`.

## Steps

### Step 1: Lock the regression

Add sensitivity tests proving grader coefficient and grand total change when
width changes, and that every accepted road condition either changes speed or
throws a clear unsupported-condition error.

**Verify**: focused core test fails on current behavior.

### Step 2: Use width consistently

Pass validated `lebar_hamparan_m` to `LintasanMotorGraderParams`, falling back
to the item/master default only when the contract permits omission. Do not alter
the km/hour conversion in `produktivitas/lintasan.ts`.

**Verify**: width sensitivity test passes.

### Step 3: Resolve the `rusak` contract

Obtain the official regulation from JDIH PUPR (`https://jdih.pu.go.id/`) and
check the provenance page before choosing one of two valid outcomes:
(a) add explicit loaded/empty `rusak` speeds to master data, or (b) remove
`rusak` from item options and reject it. Never map it silently to `sedang`.

**Verify**: schema validation passes and each accepted enum has explicit behavior.

### Step 4: Review numeric locks

Run golden tests. If totals change, independently calculate expected values,
document the source and arithmetic in the fixture review, then update only the
affected expected files.

## Test plan

- Width values 1, default, and 10.
- Road conditions `baik`, `sedang`, and the chosen `rusak` behavior.
- Omitted optional width still uses the documented default.
- Existing km/hour-to-m/hour productivity tests remain green.

## Done criteria

- [ ] No accepted declared input is silently ignored.
- [ ] Sensitivity tests demonstrate expected monotonic behavior.
- [ ] Golden changes, if any, have independent arithmetic evidence.
- [ ] Full gates pass and only scoped files changed.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- The source says `rusak` must remain accepted but provides no defensible speed
  or derivation; absence of `rusak` from the source is sufficient evidence to
  remove that option and is not itself a STOP.
- Width meaning differs from grader effective width and requires a new domain concept.
- Numeric changes cannot be independently reproduced within Rp0.01.

## Maintenance notes

When adding enum options, require explicit map coverage or rejection tests.
Reviewers should compare physical monotonicity, not only snapshot totals.
