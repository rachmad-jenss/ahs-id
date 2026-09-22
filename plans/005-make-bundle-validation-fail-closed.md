# Plan 005: Make cross-bundle validation fail closed

> **Executor instructions**: Fix validator orchestration only; do not normalize
> unrelated bundle data while executing this plan.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- scripts/validate-bundles.mjs packages/core/src/validator tests/golden/bina-marga-2016-golden.test.ts package.json .github/workflows/ci.yml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

CI prints a failure when a package no longer exports `bundle` but records no
failed result, so it can exit zero. It also skips BM-2016 despite an existing
test proving `validateBundle(bundle, hsd)` succeeds. Validation gates must fail
closed and accurately report what they did not validate.

## Current state

- `scripts/validate-bundles.mjs:76-79` logs a missing export and continues
  without appending a failed result.
- Exit status at `scripts/validate-bundles.mjs:113-130` depends only on recorded
  `failed` and `invalid` results.
- `scripts/validate-bundles.mjs:50-53` skips BM-2016.
- `tests/golden/bina-marga-2016-golden.test.ts:20-24` validates BM-2016 against
  Kaltim successfully.
- CI invokes this script in both jobs at `.github/workflows/ci.yml:75-77,115-117`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Validator | `pnpm validate-bundles` | exit 0 and BM-2016 appears as validated |
| JSON result | `pnpm validate-bundles -- --json` | machine-readable summary; no false “all valid” |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `scripts/validate-bundles.mjs`
- A new script-level test file under `scripts/` or `tests/golden/`
- `package.json` only if needed to expose that test

**Out of scope**
- CLI `validate` behavior (Plan 006)
- Cipta Karya conversion into `DataBundle`
- BM data normalization unrelated to validator orchestration

## Git workflow

Require a DAS issue. Branch `fix/DAS-N-fail-closed-bundle-validation`; commit
`DAS-N: make bundle validation fail closed`.

## Steps

### Step 1: Extract testable orchestration

Refactor only enough to inject package loaders or validate a supplied pair list.
Keep production output and Windows file-URL behavior.

**Verify**: current success path still exits 0.

### Step 2: Cover every failure branch

Add tests for core load failure, bundle load failure, missing bundle export,
HSD load failure, invalid report, and success. Every failure must be represented
in JSON summary and produce nonzero exit status. In `--json` mode, stdout must
contain exactly one parseable JSON document; send diagnostics to stderr and
omit banners, ANSI formatting, and human summaries.

**Verify**: test suite passes; removing result recording makes a test fail.

### Step 3: Enable BM-2016 pairings

Move BM-2016 from `SKIPPED` into `PAIRS`, using all compatible regional HSDs
already exercised by its golden suite. Keep Cipta Karya explicitly skipped with
its fixed-coefficient reason.

**Verify**: `pnpm validate-bundles` validates BM-2016 and exits 0.

## Test plan

- One test per load/export/report failure branch.
- JSON summary counts exactly match emitted entries.
- Real integration run includes PUPR, BM-2016, and BM-2022.

## Done criteria

- [ ] Any missing expected export makes the command exit nonzero.
- [ ] BM-2016 is not listed as skipped.
- [ ] Remaining skips are explicit and counted.
- [ ] Full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- BM-2016 fails against a supposedly compatible HSD.
- Testability requires replacing the script with a new framework.
- Cipta Karya would need schema/engine redesign to remove its skip.

## Maintenance notes

Every new bundle package must enter either `PAIRS` or an explicit skip with a
tracked reason. Reviewers should test process status, not only console text.
