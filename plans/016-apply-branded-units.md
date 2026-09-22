# Plan 016: Apply branded monetary and unit types at public boundaries

> **Executor instructions**: This is a staged API-hardening migration. Do not
> convert the whole repository in one unreviewable change.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- packages/core/src/types packages/core/src/calculator packages/core/src/exporter packages/core/src/index.ts apps/cli/src tests/golden`

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/014-consolidate-calculator-pipelines.md`
- **Category**: tech-debt
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

`IDR`, `Percentage`, and `Volume` are advertised and exported but all prices,
percentages, volumes, and totals in public contracts remain plain `number`.
The compiler therefore cannot prevent mixing Rupiah, percentage points,
fractions, coefficients, or cubic metres.

## Current state

- `packages/core/src/types/domain.ts:1-23` defines brands and unchecked
  constructors.
- Repository search at commit `96b2e85` finds brands only in declarations and
  exports.
- `packages/core/src/types/index.ts:335-410` uses plain numbers for HSD entries,
  components, group totals, and HSP results.
- JSON serialization must remain ordinary numbers; no wrapper objects.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Type-level tests | `pnpm --filter @ahs-id/core typecheck` | `@ts-expect-error` misuse cases are consumed; exit 0 |
| Full | Run separately: `pnpm lint`, `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0; numeric JSON unchanged |

## Scope

**In scope**
- Brand definitions/constructors and public calculation result contracts
- Internal boundary conversions needed to satisfy those contracts
- Type-level tests and migration documentation

**Out of scope**
- Runtime decimal/currency library adoption
- Changing JSON Schema numeric representation
- Changing percentage convention silently
- Unrelated bundle-data edits

## Git workflow

Require a DAS issue and explicit maintainer approval for public type changes.
Branch `chore/DAS-N-branded-units`; commit
`DAS-N: apply branded units to calculation boundaries`.

## Steps

### Step 1: Write a unit-convention decision

Keep `Percentage` as a fraction (`0.10`) per its existing JSDoc and introduce
`PercentagePoints` for calculator fields that store `10`. Document both with
examples. If the maintainer rejects this explicit convention, STOP rather than
silently redefining the existing exported brand.

**Verify**: decision includes examples for overhead, unit price, total, volume,
and coefficient.

### Step 2: Add safe constructors and operations

Replace blind casts at ingress with finite/range-checked constructors where
runtime data enter the engine. Add small named operations only when needed;
avoid a general numeric abstraction.

**Verify**: runtime invalid-value tests from Plan 001 remain green.

### Step 3: Migrate output boundaries first

Brand `unit_price`, `total_price`, group/base/grand totals, and margin outputs.
Then migrate HSD inputs and explicit volume values in a separate commit. Keep
serialization as numeric primitives.

**Verify**: existing JSON snapshots/fixtures are byte-compatible.

### Step 4: Add compile-time misuse tests

Create `packages/core/src/types/brands.type-test.ts`, included by the core
tsconfig. Use accepted assignments plus `// @ts-expect-error` cases to assert
IDR cannot be passed where Volume or percentage points are required and raw
numbers require explicit construction at public boundaries.

## Test plan

- Type-level accepted/rejected examples.
- Runtime constructor range/finiteness.
- Existing financial and serialization tests unchanged.
- Consumer-style TypeScript fixture importing built declarations.

## Done criteria

- [x] Public monetary results use `IDR`.
- [x] Percentage convention is unambiguous and enforced.
- [x] JSON remains plain numeric data.
- [x] Full gates pass with no numeric changes.
- [x] `plans/README.md` status row is updated.

## STOP conditions

- Maintainers do not approve a percentage convention.
- Migration requires a major-version break before the planned release strategy.
- Brands leak into JSON as objects or strings.

## Maintenance notes

Brands protect compile-time boundaries, not arithmetic precision. Reviewers
should reject pervasive casts that recreate the current decorative-only state.
