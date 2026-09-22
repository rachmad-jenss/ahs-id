# Plan 004: Model or reject every empty priced Bina Marga 2022 item

> **Executor instructions**: This is a data-fidelity task. Never infer mappings
> from item names alone. Follow the source and STOP when provenance is missing.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/bina-marga-2022 packages/hsd-bm-2022 packages/core/src/validator packages/core/src/calculator/__tests__ tests/golden`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-validate-runtime-variables.md`
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Twenty-eight BM-2022 items have no labor, material, equipment, or sub-AHSP
components while carrying nonzero `hsp_referensi`. The public calculator
therefore returns Rp0 without warning. Empty priced items must either have a
source-backed representation or make validation/calculation fail closed.

## Current state

- Example: `packages/bina-marga-2022/data/ahsp/divisi-9/items.json:3665-3706`
  defines `9.1.(1)` with four empty component arrays and reference Rp33,731.96.
- At commit `96b2e85`, 28 items match this shape; examples include daywork labor,
  equipment, and codes outside Division 9.
- `packages/core/src/calculator/hsp.ts:73-108` sums empty groups to zero.
- `packages/core/src/validator/validate-bundle.ts:20-101` validates only
  components that exist.
- Cipta Karya's structural precedent rejects empty items in
  `tests/golden/cipta-karya-data-quality.test.ts:25-34`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| BM tests | `pnpm --filter @ahs-id/bina-marga-2022 exec vitest run` | all pass |
| Core tests | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/hsp.test.ts` | all pass |
| Data gates | Run separately: `pnpm validate-data`, `pnpm validate-bundles` | stop on first failure; both exit 0 |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- The 28 confirmed empty BM-2022 items
- Relevant BM master/HSD rows
- `scripts/extract-bina-marga-2022.py` when source-correct regeneration is required
- `packages/core/src/validator/validate-bundle.ts`
- Focused core/BM tests and source-backed expected fixtures

**Out of scope**
- Recalculating unrelated BM items
- Introducing an arbitrary “use hsp_referensi as final price” fallback
- Regional-HSD interoperability

## Git workflow

Require an assigned DAS issue. Branch `fix/DAS-N-bm-empty-priced-items`;
commit `DAS-N: model empty Bina Marga priced items`.

## Steps

### Step 1: Inventory and classify all 28 items

Download Permen PUPR 1/2022 from JDIH PUPR (`https://jdih.pu.go.id/`) into
gitignored `tools/docling/sources/`. Write a test/helper that lists empty items
and classifies each from the regulation source as direct labor, direct
equipment, direct material, composite, or intentionally non-calculable. Record
page/table/row evidence for every item.

**Verify**: inventory count is exactly 28 at the planned commit.

### Step 2: Add fail-closed validation first

Add a validator error for an item with no components/sub-AHSP and a positive
reference price. Add tests for rejection and for an explicitly allowed
zero/lump-sum case if the schema supports one.

**Verify**: `validate-bundles` fails before data correction.

### Step 3: Encode source-backed components

For direct hourly labor, use the correct HSD labor ref and coefficient/unit
conversion shown by the regulation. For equipment, use the matching rental ref.
For any category not representable by current types, STOP and propose the
smallest schema addition with migration impact; do not abuse `hsp_referensi`.

**Verify**: every corrected item has at least one component and a traceable ref.

### Step 4: Add calculation checks

Assert all 28 results are finite and greater than zero. Compare each against its
reference under the documented margin, using explicit per-item tolerances only
where the source rounds values.

## Test plan

- Validator rejects an empty priced item.
- Representative direct labor and direct equipment daywork items.
- All 28 items produce nonzero finite HSP.
- References and units resolve against `hsd-bm-2022`.

## Done criteria

- [ ] Zero empty priced items remain.
- [ ] No generic reference-price fallback was added.
- [ ] Every mapping has provenance.
- [ ] Full gates pass and unrelated golden values are unchanged.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Source files/pages are unavailable for any item.
- An item needs a new pricing concept not represented in current types.
- Correct calculation disagrees materially with reference and the reason is unknown.

## Maintenance notes

Keep the empty-priced-item validator permanent. Review data diffs against source
rows and require the repository's four-eyes rule for coefficient changes.
