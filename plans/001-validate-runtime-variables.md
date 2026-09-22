# Plan 001: Reject invalid runtime variables before calculation

> **Executor instructions**: Follow every step and verification gate. Do not
> improvise past a STOP condition. When complete, update this plan's row in
> `plans/README.md` unless a reviewer owns the index.
>
> **Drift check (run first)**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/calculator/hsp.ts packages/core/src/types/index.ts packages/core/src/calculator/__tests__/hsp.test.ts apps/cli/src/utils/loader.ts apps/cli/src/utils/loader.test.ts`
> If current code no longer matches the excerpts below, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

`createCalculator` casts untrusted runtime values but validates only presence.
Invalid enum values and zero efficiency currently produce non-finite prices;
JSON output turns `NaN` into `null`. The engine must reject invalid inputs before
any productivity or HSD formula runs while preserving documented defaults and
`estimasi-kasar` fallback behavior.

## Current state

- `packages/core/src/calculator/hsp.ts:288-317` reads values with casts, checks
  only `variabel[v] !== undefined`, then computes `1 / produktivitas`.
- `packages/core/src/types/index.ts:253-264` already defines each variable's
  `tipe`, `options`, `required`, `default`, `min`, and `max`.
- `apps/cli/src/utils/loader.ts:31-40` converts an empty string with `Number('')`,
  producing zero.
- Existing calculator-test style is `packages/core/src/calculator/__tests__/hsp.test.ts`.
- Domain constraints: keep km/hour-to-m/hour conversion unchanged; monetary
  outputs must be finite; overhead plus profit remains 10–15%.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Core test | `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/hsp.test.ts` | all tests pass |
| CLI test | `pnpm --filter @ahs-id/cli exec vitest run src/utils/loader.test.ts` | all tests pass |
| Full gates | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on the first failure; every command exits 0 |

## Scope

**In scope**
- `packages/core/src/calculator/hsp.ts`
- `packages/core/src/types/index.ts` only if a reusable validation-result type is needed
- `packages/core/src/calculator/__tests__/hsp.test.ts`
- `apps/cli/src/utils/loader.ts`
- `apps/cli/src/utils/loader.test.ts`

**Out of scope**
- Formula changes or corrected golden values
- Bundle JSON edits
- New CLI options
- Branded-unit migration

## Git workflow

- Use the operator-assigned GitHub issue. If none exists, STOP; this repository
  requires a DAS issue and Notion task before coding.
- Branch: `fix/DAS-N-validate-runtime-variables`
- Commit: `DAS-N: validate runtime calculation variables`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add failing boundary tests

In `hsp.test.ts`, add cases for: invalid enum; unknown key; empty numeric value;
`NaN`, `Infinity`, zero/negative denominator inputs; below-min and above-max
numbers; omitted optional values using defaults; required values missing in
`penuh`; and missing values using `koef_referensi` only in `estimasi-kasar`.
Assert thrown messages name the variable and violated contract.

**Verify**: core test command must fail only on the new cases.

### Step 2: Validate and normalize item variables once

Add a focused helper in `hsp.ts` that validates the root item's supplied keys
once, applies non-null defaults, and validates number finiteness/range or enum
membership. Pass that normalized object into recursion, but validate each child
against only the variables it declares; parent-only keys must not make nested
AHSP resolution fail. Keep the existing margin keys as explicit root
exceptions. After result assembly, defensively reject any non-finite component,
subtotal, margin, or grand total.

**Verify**: core test command exits 0.

### Step 3: Reject malformed CLI key/value input

Update `parseKeyValue` to reject empty keys, empty values, and non-finite numeric
spellings. Keep ordinary strings such as `kondisi_jalan=sedang`.

**Verify**: CLI test command exits 0 with new empty-key/value cases.

### Step 4: Run repository gates

Run all full gates in the order listed. Do not update golden fixtures unless a
reviewer confirms a legitimate formula change; this plan should not change
valid-input totals.

## Test plan

- Model core tests after the existing variable/margin cases in `hsp.test.ts`.
- Add at least eight invalid-input assertions and three valid default/fallback
  assertions.
- Add a nested parent/child regression where each item declares different
  variables and the shared normalized input does not trigger an unknown-key error.
- Add CLI tests for `=1`, `key=`, `key=Infinity`, and a normal enum.

## Done criteria

- [ ] Invalid values throw before calculations run.
- [ ] Every returned monetary number is finite.
- [ ] Existing valid-input golden tests remain unchanged and pass.
- [ ] All full gates exit 0.
- [ ] `git status --short` shows only in-scope files and the
  `plans/README.md` status-row change.

## STOP conditions

- Validation would reject an existing checked-in fixture using a documented value.
- Preserving `estimasi-kasar` requires silently accepting an invalid supplied value.
- A formula or bundle-data change appears necessary.

## Maintenance notes

Future variable types must be added exhaustively to this validator. Reviewers
should scrutinize default application versus “required” semantics and ensure
validation occurs in the public library, not only in the CLI.
