# CLAUDE.md — Project Context for AI-Assisted Development

## Project Overview

@ahs-id adalah open source calculation engine & structured data bundles untuk Analisa Harga Satuan Pekerjaan (AHSP) Indonesia berdasarkan Permen PUPR. Monorepo TypeScript (pnpm workspaces + Turborepo).

## Architecture Reference

Semua keputusan teknis mengacu pada dokumen arsitektur: `docs/architecture.md`
Jangan deviate dari spec tanpa konfirmasi eksplisit dari maintainer.

## Current Phase

**Phase 1: MVP — "One Chain Works"** ✅ COMPLETE (2026-05-16)
- 35 tests passing (28 unit + 7 golden)
- AHSP 3.2.1 + 3.1.1 full chain verified
- Distance sensitivity, Fpr berat, volume conversion all tested

**Next: Phase 2 — "Usable by Others"**
Entry requirement: Phase 1 complete ✅
Exit criteria: External developer can `npm install`, calculate HSP for any Bina Marga item, and export to Excel.

Lihat `PROGRESS.md` untuk status terkini setiap task.

## Monorepo Structure

```
packages/
├── core/              ← Engine: calculator, productivity, volume conversion, validator
├── pupr-2023/         ← Data bundle: Permen PUPR 8/2023 coefficients
└── hsd-kaltim-2025/   ← Regional HSD: Kalimantan Timur Q1 2025

tests/golden/          ← Cross-engine golden test fixtures
docs/                  ← Architecture spec, legal, calculation reference
```

## Phase 2 Scope

### New in Phase 2:
- `@ahs-id/core`: produktivitas/throughput.ts (AMP, batching plant), hsd-peralatan.ts → add mode sewa, sub-ahsp resolver (nesting + circular dependency check), mode estimasi-kasar (koef_referensi with warnings), exporter/excel.ts (RAB format), validate-refs.ts (cross-bundle integrity)
- `@ahs-id/pupr-2023` (Bina Marga COMPLETE): ahsp/bina-marga/ → all divisi (1-7+)
- `@ahs-id/hsd-[region]-[year]` (≥3 regions)
- `apps/cli/` (basic commands: calc-hsp, export-rab, validate)
- Published to npm (first public release)
- Golden tests: ≥10 fixtures

### Known technical debt from Phase 1:
- Equipment E.11 (Wheel Loader), E.19 (Motor Grader), E.25 (Water Tanker) use placeholder specs — need research
- JSON Schema validation at build time (deferred from Phase 1)

## Key Technical Constraints

1. **TypeScript strict mode** — no `any`, strict null checks
2. **Unit conversion critical** — kecepatan_operasi stored in km/jam, formula needs m/jam. lintasan.ts MUST convert: `v_m = v_km × 1000`. Without this → productivity off by 1000×.
3. **Overhead/profit split** — Schema stores `overhead_pct` + `profit_pct` as separate fields with constraint `10 ≤ sum ≤ 15`. Engine exposes `overheadProfitValue` as combined computed field.
4. **Volume state awareness** — bank → loose → compacted conversion must be explicit. Conversion factors from faktor-konversi.json.
5. **Golden tests are the truth** — Same input → same output. ε = 0.01 Rp tolerance.
6. **Branded domain types** — Use `IDR`, `Percentage`, `Volume` branded types for type safety.

## Coding Standards

- pnpm workspaces + Turborepo
- Vitest for unit tests
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- No default exports (named exports only)
- All public API functions must have JSDoc
- JSON data files validated against JSON Schema at build time

## AI Attribution Rules

- NEVER add `Co-Authored-By` to commit messages
- NEVER add AI branding to PR descriptions, README, or any file
- Commits and PRs must look like they were written by a human

## Progress Tracking

All task progress is tracked in `PROGRESS.md`. Update it after completing each task.
