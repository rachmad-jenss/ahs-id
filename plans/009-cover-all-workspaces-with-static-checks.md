# Plan 009: Include every TypeScript workspace in lint and typecheck

> **Executor instructions**: Change workspace scripts and verification tests
> only. Do not reformat unrelated source.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/cipta-karya-2024/package.json tests/golden/package.json turbo.json eslint.config.mjs .github/workflows/ci.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Turbo reports 11 workspaces but `pnpm lint` executes only nine tasks:
Cipta Karya has no lint script and golden tests have neither lint nor typecheck.
Financial regression tests therefore bypass static analysis.

## Current state

- `packages/cipta-karya-2024/package.json:18-22` has build/typecheck but no lint.
- `tests/golden/package.json:6-9` has only `test`.
- Root `turbo.json:12-18` runs only scripts declared by each workspace.
- Root ESLint config already targets TypeScript and ignores generated output.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Lint scope | `pnpm lint` | 11 successful lint tasks |
| Typecheck scope | `pnpm typecheck` | golden tests included; exit 0 |
| Scope check | `node scripts/check-workspace-tasks.mjs` | exit 0; all TS workspaces report required tasks |
| Full | Run separately: `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `packages/cipta-karya-2024/package.json`
- `tests/golden/package.json`
- `scripts/check-workspace-tasks.mjs` (create)
- Minimal source/test corrections required by newly active checks

**Out of scope**
- Changing global lint rules
- Reformatting data files
- Suppressing real errors with broad ignores

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-static-check-coverage`; commit
`DAS-N: cover all workspaces with static checks`.

## Steps

### Step 1: Add standard scripts

Match existing package conventions: `lint: eslint src/` for Cipta Karya; for
golden tests lint their `.ts` files and add `typecheck: tsc --noEmit`.

**Verify**: Turbo output shows 11 lint tasks and all intended typecheck tasks.

### Step 2: Fix only newly exposed violations

Make surgical fixes in the affected package/test files. Do not weaken rules or
touch unrelated workspaces.

**Verify**: `pnpm lint` and `pnpm typecheck` exit 0.

### Step 3: Lock scope in a tooling test

Create `scripts/check-workspace-tasks.mjs`. Read workspace package manifests,
identify packages containing TypeScript source/test files, and require
`lint`/`typecheck` scripts according to a small explicit rule in the script.
Run `pnpm turbo run lint typecheck --dry=json` from the script and verify those
packages appear. Use Node APIs only so the check is cross-platform.

**Verify**: `node scripts/check-workspace-tasks.mjs` exits 0; removing either
new package script makes it exit nonzero with the package and missing task.

## Test plan

- Turbo dry-run/scope assertion on Windows and CI bash.
- Existing full test suite unchanged.

## Done criteria

- [ ] All 11 workspaces participate where applicable.
- [ ] No broad lint/typecheck exclusion added.
- [ ] Full gates pass.
- [ ] Only scoped files and necessary exposed-error fixes changed.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Golden tests cannot typecheck under their current `tsconfig`.
- Cross-platform scope checking requires shell-specific parsing.
- Newly exposed errors indicate a separate behavioral defect.

## Maintenance notes

Every new TypeScript workspace should declare build/test/lint/typecheck as
applicable. Reviewers should inspect Turbo task counts in CI logs.
