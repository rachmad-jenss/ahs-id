# Plan 011: Drive CLI calculation, export, listing, and validation from one registry

> **Executor instructions**: Extend behavior only for package strategies that
> can be tested end to end. Do not invent HSD pairings.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- apps/cli/src apps/cli/package.json packages/bina-marga-2016/src packages/cipta-karya-2024/src`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/006-fix-cli-validation-boundary.md`,
  `plans/010-expose-sub-ahsp-costs.md`
- **Category**: tech-debt
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The CLI installs BM-2016 and Cipta Karya but calculation/export loaders expose
only PUPR-2023 and BM-2022, while validation keeps a separate eight-name list.
Package additions already require lockstep edits and have drifted.

## Current state

- `apps/cli/package.json:21-29` depends on four AHSP bundles and four HSD bundles.
- `apps/cli/src/utils/loader.ts:9-29` exposes two calculation bundles.
- `apps/cli/src/commands/validate.ts:20-27` has a separate package list.
- BM-2016 exports a `DataBundle`; Cipta Karya uses
  `calcHspFixedCoefficient` and does not need regional HSD.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| CLI | `pnpm --filter @ahs-id/cli exec vitest run` | all pass |
| Build | `pnpm build` | exit 0; CLI and all workspace dependencies are built |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- One typed registry under `apps/cli/src/`
- Loader/list/validate/calc/export command integration
- BM-2016 CLI support with verified default HSD
- Cipta Karya support only if fixed-coefficient item lookup is unambiguous
- Integration tests

**Out of scope**
- New bundle formats
- BM-2022 regional-HSD compatibility
- Remote package discovery/plugins

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-cli-bundle-registry`. Commit
`DAS-N: unify CLI bundle registry`.

## Steps

### Step 1: Define an exhaustive strategy union

Extend the registry introduced by Plan 006. Keep its exhaustive union:
`dynamic-bundle`, `fixed-coefficient`, and `hsd-only`. AHSP entries include
item lookup, compatible/default HSD policy, calculation adapter, validation
adapter, and display name; HSD-only entries expose validation and compatibility.
Use a `never` check for exhaustive TypeScript switches.

**Verify**: registry typecheck rejects an entry missing a strategy handler.

### Step 2: Derive all lists and loaders

Replace `BUNDLE_NAMES`, package allowlists, and duplicated dynamic imports with
registry-derived values. Preserve current names and defaults exactly.

**Verify**: existing CLI tests pass unchanged.

### Step 3: Enable BM-2016

Add its verified regional default and test `calc-hsp` plus `export-rab` for a
known golden item. List all compatible HSD names explicitly.

**Verify**: command output matches the existing BM-2016 golden total.

### Step 4: Add fixed-coefficient routing

If Cipta Karya has unique stable item codes, route it through
`calcHspFixedCoefficient`; reject `--hsd` for this strategy. If duplicate item
codes make lookup ambiguous, STOP and report the required identifier design.

## Test plan

- Registry-derived listing and validation.
- Existing PUPR/BM-2022 behavior.
- BM-2016 calculation and Excel output.
- Cipta fixed-coefficient calculation or explicit ambiguity STOP.
- Exhaustive strategy switch compile-time assertion.

## Done criteria

- [ ] No second hard-coded bundle/package list remains in CLI source.
- [ ] Installed supported bundles are listed and usable.
- [ ] Unsupported bundle/HSD combinations fail clearly.
- [ ] Full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- BM-2016 has no defensible default HSD.
- Cipta item codes are ambiguous.
- Registry requires changing core public APIs beyond adapters.

## Maintenance notes

Every future bundle should require one registry entry. Reviewers should reject
new command-local package lists.
