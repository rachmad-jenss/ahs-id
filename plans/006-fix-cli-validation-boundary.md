# Plan 006: Make `ahs-id validate` perform real installed-package validation

> **Executor instructions**: Build and test the CLI as an installed artifact,
> not only from the monorepo root. Update the plan index when complete.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- apps/cli/src/commands/validate.ts apps/cli/src/utils apps/cli/package.json packages/core/src/validator scripts/validate-data.mjs scripts/validate-bundles.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/005-make-bundle-validation-fail-closed.md`
- **Category**: bug
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

The CLI advertises JSON Schema validation but merely parses files under
`process.cwd()/packages`. Installed users run outside the repository, and JSON
mode returns status 0 even when results contain failures. The command must use
installed package resources and the same validators trusted by CI.

## Current state

- `apps/cli/src/commands/validate.ts:11-13` promises schema validation.
- `validate.ts:18-40` derives monorepo-relative package directories.
- `validate.ts:50-65` calls only `JSON.parse`.
- `validate.ts:69-72` returns before computing failed results.
- CLI tests currently cover only loader utilities in
  `apps/cli/src/utils/loader.test.ts`.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| CLI tests | `pnpm --filter @ahs-id/cli exec vitest run` | all pass |
| Build | `pnpm build` | exit 0; CLI and workspace dependencies are built |
| External CWD | `node <absolute-repo-path>/apps/cli/dist/index.js validate --json` from a temporary directory | stdout parses as JSON; exit 0 for valid installed bundles |
| Full | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- `apps/cli/src/commands/validate.ts`
- A shared typed package registry under `apps/cli/src/utils/`
- New CLI integration tests and temporary fixtures
- `apps/cli/package.json` package-resource declarations if required
- Reusable validator extraction in `packages/core/src/validator/`, exported as
  the documented root API `validatePackageData`, required
  schema assets or compiled validators, `packages/core/package.json`, and Ajv
  runtime dependency if schema validation remains runtime-dynamic

**Out of scope**
- Arbitrary remote URLs
- Cipta Karya conversion to `DataBundle`
- Calculation/export registry expansion (Plan 011)

## Git workflow

Require a DAS issue. Branch `fix/DAS-N-cli-real-validation`; commit
`DAS-N: validate installed bundle packages`.

## Steps

### Step 1: Add process-boundary tests

Spawn the built CLI from a temporary working directory. Cover default success,
one selected package, unknown package, invalid fixture, `--json` success, and
`--json` failure status. Assert stdout is valid JSON with no banners in JSON mode.

**Verify**: tests expose current CWD dependence and status-zero bug.

### Step 2: Define validation strategies

Create a typed registry describing each installed package as `dynamic-bundle`,
`fixed-coefficient`, or `hsd-only`. Resolve data via package exports/resources
using `import.meta.url` or package-exported values, never caller CWD. Extract
the schema-validation logic currently trapped in `scripts/validate-data.mjs`
into reusable core code and export `validatePackageData` from
`packages/core/src/index.ts`. Either compile validators into `dist` or publish
the required schemas and move Ajv to a runtime dependency; add a
tarball-content test for whichever contract is selected. Do not duplicate
validators in CLI.

**Verify**: integration tests pass from outside the repo.

### Step 3: Correct status and output flow

Compute all results, emit text or JSON, then set `process.exitCode = 1` if any
failed. Avoid `process.exit()` inside reusable command logic so tests can observe
cleanup and output.

**Verify**: failed JSON invocation has valid JSON stdout and nonzero status.

### Step 4: Run from an external working directory

Build all workspaces, change to a temporary directory, and invoke the CLI by its
absolute built path. Assert it does not read `<cwd>/packages`. Full tarball
installation is owned by Plan 012 because the interdependent packages are not
yet published.

## Test plan

- Real child-process tests for exit status and output format.
- Installed-package test from a non-repo CWD.
- One valid and one structurally invalid fixture per strategy.

## Done criteria

- [ ] Command behavior matches its description.
- [ ] No path assumes a monorepo checkout.
- [ ] JSON failures exit nonzero without corrupting JSON output.
- [ ] External-CWD test and full gates pass.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Required data are absent from package tarballs.
- The truthful validator requires a broader public schema API than the approved
  `validatePackageData` entrypoint.
- A package strategy cannot be validated truthfully with existing metadata.

## Maintenance notes

Plans 011 and 012 should derive from this registry rather than adding another
package list. Reviewers should run tests from a clean temporary directory.
