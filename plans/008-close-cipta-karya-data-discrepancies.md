# Plan 008: Replace Cipta Karya aggregate tolerance with reviewed exceptions

> **Executor instructions**: Treat every changed coefficient or reference as
> regulated data. Do not “fix” tests by widening tolerances.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- tests/golden/cipta-karya-data-quality.test.ts tests/golden/cipta-karya-golden.test.ts packages/cipta-karya-2024/data scripts/extract-cipta-karya.py scripts/extract-cipta-karya-hsd.py scripts/extract-lansekap.py`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/007-establish-independent-golden-oracles.md`
- **Category**: tests
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The suite allows up to one percent of items to miss a one-percent arithmetic
tolerance and excludes all 86 Lansekap items from price comparison. At the
planned commit, 16 of 1,857 checked items differ by at least 1% (largest 8.625%).
Aggregate pass rates can hide newly introduced errors.

## Current state

- `tests/golden/cipta-karya-data-quality.test.ts:100-131` asserts only a 99%
  match rate and warns rather than fails for large differences.
- `cipta-karya-data-quality.test.ts:8-11,137-160` excludes 86 Lansekap items
  from arithmetic comparison.
- Structural component checks already exist at lines 14-63.
- Extraction source is `scripts/extract-cipta-karya.py`; changes to generated
  package files must trace back to extraction/source evidence.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Cipta tests | `pnpm --filter @ahs-id/golden-tests exec vitest run cipta-karya-data-quality.test.ts cipta-karya-golden.test.ts` | all pass |
| Data schema | `pnpm validate-data` | exit 0 |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- Cipta Karya discrepancy tests
- A reviewed exception manifest with reason/source/owner
- Corrected extraction logic and only source-proven data rows
- `scripts/extract-cipta-karya.py`, `scripts/extract-cipta-karya-hsd.py`, and
  `scripts/extract-lansekap.py`
- Arithmetic oracle coverage for Lansekap where source mapping permits

**Out of scope**
- Blanket tolerance increases
- Other regulation bundles
- UI/CLI features

## Git workflow

Require a DAS issue and data-review assignment. Branch
`fix/DAS-N-cipta-data-discrepancies`; commit
`DAS-N: close Cipta Karya data discrepancies`.

## Steps

### Step 1: Freeze the discrepancy inventory

Obtain SE Bina Konstruksi 68/2024 from the official PUPR/JDIH source and store
it only under gitignored `tools/docling/sources/`. Generate a report with code,
computed value, reference, percent difference,
source page/sheet, and suspected cause for all ≥1% mismatches plus all Lansekap
items. Store only the reviewed exception data needed by tests.

**Verify**: inventory reports 16 current mismatches and 86 Lansekap items, or
STOP if drift changed the counts.

### Step 2: Replace aggregate acceptance

Make every non-exempt item fail at the chosen source-appropriate tolerance.
Exceptions must be keyed by item code and include reason, expected discrepancy,
source reference, and review status. New unlisted mismatches fail immediately.

**Verify**: inserting a synthetic mismatch causes a deterministic test failure.

### Step 3: Correct source-backed extraction defects

For each exception caused by extraction, fix the extractor first, regenerate
the smallest affected data file, inspect the diff, and obtain required review.
Do not hand-edit generated data without recording why regeneration is impossible.

**Verify**: corrected item leaves the exception list and passes arithmetic.

### Step 4: Resolve Lansekap mapping

Document its column layout from the source workbook and add an independent
calculation oracle. If source columns cannot be mapped confidently, keep a
named quarantine entry per item rather than one broad category exclusion.

## Test plan

- No unlisted ≥1% mismatch passes.
- Exception entries correspond to real item codes and expire when fixed.
- Lansekap has item-level oracle or item-level quarantine.
- Extraction rerun is deterministic for touched sheets.

## Done criteria

- [ ] Aggregate 99% threshold and warning-only branch are removed.
- [ ] Every remaining discrepancy is explicit and reviewed.
- [ ] No broad Lansekap exclusion remains.
- [ ] Full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Original workbook/source pages are unavailable.
- Regeneration changes unrelated sheets/items.
- A correction exceeds 20% without two independent reviewers.

## Maintenance notes

Keep exception entries scarce and time-bounded. Reviewers should inspect source
screenshots/provenance and generated diffs together.
