# Plan 012: Publish only freshly built, verified, installable packages

> **Executor instructions**: This is supply-chain-sensitive. Use least
> privilege, never print tokens, and perform dry runs before any real publish.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- package.json apps/cli packages/*/package.json .github/workflows .changeset README.md PROGRESS.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-validate-runtime-variables.md`,
  `plans/002-honor-declared-productivity-inputs.md`,
  `plans/003-enforce-productivity-unit-compatibility.md`,
  `plans/004-model-empty-priced-bm-items.md`,
  `plans/005-make-bundle-validation-fail-closed.md`,
  `plans/006-fix-cli-validation-boundary.md`,
  `plans/007-establish-independent-golden-oracles.md`,
  `plans/008-close-cipta-karya-data-discrepancies.md`,
  `plans/009-cover-all-workspaces-with-static-checks.md`,
  `plans/010-expose-sub-ahsp-costs.md`, and
  `plans/011-unify-cli-bundle-registry.md`,
  `plans/014-consolidate-calculator-pipelines.md`, and
  `plans/016-apply-branded-units.md`
- **Category**: migration
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Root `release` invokes `changeset publish` without a clean build or verification,
while public packages ship only ignored `dist` output. The CLI executable also
lacks a Unix shebang. README currently advertises npm installation although
PROGRESS records publishing as unfinished.

## Current state

- `package.json:9-12` runs `changeset publish` directly.
- Public package manifests, e.g. `packages/core/package.json:7-22`, publish
  `dist` but have no prepack verification.
- `apps/cli/package.json:7-15` maps `ahs-id` to `dist/index.js`;
  `apps/cli/src/index.ts:1` starts with an import, not a shebang.
- `docs/architecture.md:2160-2181` requires lint, typecheck, tests, validation,
  build, publish, changelog, and package size under 10 MB.
- `PROGRESS.md:40-48` tracks npm publishing as the remaining Phase 2 exit item.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Verify | Run separately: `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test`, `pnpm build` | stop on first failure; all exit 0 |
| Pack | From each public workspace run `pnpm pack --json --pack-destination <absolute-temp-dir>` | JSON names one tarball and contents; each tarball is under 10 MB |
| Install smoke | Create a temporary project and install all produced tarball paths together | install exits 0 with no registry fallback for `@ahs-id/*` |

## Scope

**In scope**
- Root release/verify scripts
- `scripts/clean.mjs` (create) for cross-platform artifact cleanup
- Public package metadata and CLI shebang/version source
- A GitHub Actions trusted-publish workflow
- Pack/install/import/CLI smoke tests
- README/PROGRESS only as part of the real release change

**Out of scope**
- Performing a production npm publish without explicit operator approval
- Version 1.0 if the maintainer chooses prerelease versions
- Unrelated documentation cleanup

## Git workflow

Use the existing DAS-8 issue if still open and synchronize Notion before coding.
Branch `chore/DAS-8-npm-publish`; commit `DAS-8: add verified npm publishing`.
Do not publish or tag without explicit maintainer approval.

## Steps

### Step 1: Confirm release scope and version against architecture

Architecture section 15 currently names `1.0.0` as the first stable release and
lists a narrower package set than the current monorepo. Before implementation,
the maintainer must approve the exact first-release version and package list.
If the current expanded scope is chosen, update `docs/architecture.md` in this
same substantive release change; do not silently deviate.

**Verify**: the approved package/version matrix is recorded in the DAS issue and
matches architecture plus Changesets.

### Step 2: Make artifacts reproducible

Add a root `verify` command covering all six gates. Ensure release starts from a
clean workspace, removes stale `dist`, runs verify/build, and fails if tracked
or generated package contents differ unexpectedly. Replace package `rm -rf`
clean scripts with `node scripts/clean.mjs ...`; use Node filesystem APIs so
cleanup works on Windows self-hosted CI and Ubuntu fork jobs.

**Verify**: pre-seed `dist` with a sentinel/stale file, run release preparation,
and confirm cleanup removes the sentinel and a fresh build recreates every
required entrypoint before packing. A pack step without the rebuild must fail
the package-content smoke test.

### Step 3: Fix package executability and metadata

Add `#!/usr/bin/env node` to CLI source and assert compiled output preserves it.
Unify CLI displayed version with package metadata. Verify `exports`, `types`,
`files`, license, repository, provenance, and inter-package version ranges.

**Verify**: packed CLI executes on Windows and an Ubuntu CI job.

### Step 4: Add package smoke tests

Pack all public packages, enforce the 10 MB limit, install tarballs into a clean
temporary project, import each package, calculate representative HSPs, export
Excel, and run `ahs-id --version`/`calc-hsp`.

**Verify**: smoke test uses tarballs, not workspace links.

### Step 5: Add trusted publishing workflow

Follow current npm/GitHub trusted-publishing documentation. Use environment
protection and minimal `contents: read` plus `id-token: write`; never store or
log a long-lived npm token if OIDC is available. Make publishing depend on the
same verified artifacts.

**Verify**: validate workflow YAML, run the full pack/install smoke job on a
branch, and confirm no publish job is eligible without the approved release
event/environment.

### Step 6: Correct onboarding only when availability is real

Before first publish, mark npm commands as forthcoming. After verified publish,
restore them and test the exact README quick start from a clean directory.

## Test plan

- Missing/stale artifact fails.
- Tarball content and size assertions.
- Cross-platform CLI shebang execution.
- Clean-project imports and representative calculations.
- Workflow dry run with no registry mutation.

## Done criteria

- [ ] Release cannot bypass verification and clean build.
- [ ] Every tarball installs and runs outside the monorepo.
- [ ] CLI works on Ubuntu and Windows.
- [ ] No secret is committed or printed.
- [ ] Production publish remains operator-gated.
- [ ] Release version/package scope matches approved architecture.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Any prerequisite correctness plan remains unresolved.
- Trusted publishing configuration is ambiguous or unavailable.
- Tarball smoke tests use workspace links.
- The task reaches a real publish/tag step without explicit approval.

## Maintenance notes

The release workflow should be the only supported publish path. Reviewers should
inspect permissions, artifact identity, provenance, and dry-run evidence.
