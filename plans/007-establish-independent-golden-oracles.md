# Plan 007: Establish independent, provenance-backed golden expectations

> **Executor instructions**: Do not regenerate expected values from the engine
> and call them verified. This plan changes the authority model for golden data.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- tests/golden docs/architecture.md CONTRIBUTING.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The current generator computes expectations with `createCalculator`, the same
implementation under test. Regenerating after a formula defect can bless the
defect. Architecture section 10.2 requires an independent manual spreadsheet;
golden files need provenance and review controls that enforce that decision.

## Current state

- `tests/golden/README.md:17-20` tells maintainers to regenerate expected files
  through the engine.
- `tests/golden/gen-expected.test.ts:51-69` runs `createCalculator` and writes
  those results.
- `tests/golden/fixture-golden.test.ts:39-89` correctly enforces Rp0.01 once an
  expectation exists, but does not establish its independence.
- `docs/architecture.md:1330-1368` specifies engine versus independent manual
  calculation.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Golden | `pnpm --filter @ahs-id/golden-tests exec vitest run` | all pass; diagnostic generator skipped |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `tests/golden/README.md`
- `tests/golden/fixtures/` and `expected/`
- `tests/golden/fixture-golden.test.ts`
- `tests/golden/gen-expected.test.ts`
- A compact provenance manifest under `tests/golden/`
- `CONTRIBUTING.md` golden-change rules

**Out of scope**
- Correcting formulas or source bundle coefficients
- Increasing tolerance above Rp0.01
- Committing proprietary spreadsheets or copyrighted source pages

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-independent-golden-oracles`; commit
`DAS-N: add independent golden provenance`.

## Steps

### Step 1: Define a machine-readable provenance contract

For each expected file, record calculation method, source regulation/page,
reviewer/sign-off state, creation date, and whether values were independently
calculated. Never record secrets or inaccessible local paths.

**Verify**: a test fails for any expected file without a provenance entry.

### Step 2: Recalculate the minimum benchmark set independently

Download cited regulations from JDIH PUPR (`https://jdih.pu.go.id/`) into
gitignored `tools/docling/sources/`. The operator must name two reviewers before
authoritative expectations are marked reviewed; until then, provenance may be
recorded as `pending-review` but the plan remains BLOCKED rather than DONE.
Start with the architecture's critical cases that already exist. Calculate
component totals and margins outside `createCalculator` using a reviewed
spreadsheet or a deliberately independent arithmetic worksheet/script that does
not import core. Two reviewers should sign coefficient changes above 20%.

**Verify**: independent totals match current engine outputs within Rp0.01 or
produce an explicit discrepancy for a follow-up fix.

### Step 3: Demote the generator to diagnostics

Rename/document `gen-expected.test.ts` so it writes candidate output outside
authoritative `expected/` by default. Require an explicit second command and
provenance update to promote a candidate.

**Verify**: running the documented generator cannot overwrite committed oracle
files accidentally.

### Step 4: Enforce review rules

Update README and CONTRIBUTING with the oracle workflow. Add tests for
fixture/expected/provenance one-to-one correspondence.

## Test plan

- Missing expected file, missing provenance, duplicate ID, and unreviewed
  engine-generated candidate all fail.
- At least three existing fixtures have independent reviewed arithmetic.
- Existing epsilon assertions remain Rp0.01.

## Done criteria

- [ ] Every authoritative expected file identifies an independent oracle.
- [ ] Generator cannot silently bless engine output.
- [ ] Fixture/expected/provenance sets match exactly.
- [ ] Full gates pass.
- [ ] Two named reviewers have signed the authoritative baseline.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Independent source material is unavailable.
- Current output disagrees with manual arithmetic.
- Provenance would require committing restricted source content.

## Maintenance notes

Any future golden change should be reviewed as financial data, not snapshot
churn. Reviewers should reject “updated expected values” without derivation.
