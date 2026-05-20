# AGENTS.md — Project Context for AI-Assisted Development

## Project Overview

@ahs-id adalah open source calculation engine & structured data bundles untuk Analisa Harga Satuan Pekerjaan (AHSP) Indonesia berdasarkan Permen PUPR. Monorepo TypeScript (pnpm workspaces + Turborepo).

## Architecture Reference

Semua keputusan teknis mengacu pada dokumen arsitektur: `docs/architecture.md`
Jangan deviate dari spec tanpa konfirmasi eksplisit dari maintainer.

## Current Phase

**Phase 1: MVP — "One Chain Works"** ✅ COMPLETE (2026-05-16)

**Phase 2: Functional Library — "Usable by Others"** 🔨 IN PROGRESS
- 51 tests passing (39 unit + 12 golden)
- Divisi 3 complete (12 AHSP items), 3 HSD regions (Kaltim, Jabar, Papua)
- Engine extensions done: throughput, mode sewa, sub-ahsp, estimasi-kasar, cross-bundle validation
- Remaining: Excel exporter, CLI app, npm publish

Exit criteria: External developer can `npm install`, calculate HSP for any Bina Marga item, and export to Excel.

Lihat `PROGRESS.md` untuk status terkini setiap task.

## Monorepo Structure

```
packages/
├── core/              ← Engine: calculator, productivity, volume conversion, validator
├── pupr-2023/         ← Data bundle: Permen PUPR 8/2023 coefficients (12 AHSP items, 9 equipment, 3 bahan)
├── hsd-kaltim-2025/   ← Regional HSD: Kalimantan Timur Q1 2025
├── hsd-jabar-2025/    ← Regional HSD: Jawa Barat Q1 2025 (lowest prices)
└── hsd-papua-2025/    ← Regional HSD: Papua Q1 2025 (highest prices)

scripts/               ← Build-time validation (validate-data.mjs)
tests/golden/          ← Cross-engine golden test fixtures (12 tests)
docs/                  ← Architecture spec, legal, calculation reference
```

## Phase 2 Scope

### Done in Phase 2:
- `@ahs-id/core`: throughput productivity ✅, mode sewa ✅, sub-ahsp resolver ✅, estimasi-kasar ✅, cross-bundle validation ✅, JSON Schema validation ✅
- `@ahs-id/pupr-2023`: Divisi 3 complete (12 items) ✅, E.02/E.14/E.15 added ✅, M.09.b/M.09.s added ✅
- `@ahs-id/hsd-jabar-2025` + `@ahs-id/hsd-papua-2025` ✅ (3 regions total)
- Golden tests: 12 fixtures ✅

### Remaining in Phase 2:
- `@ahs-id/core`: exporter/excel.ts (RAB format)
- `apps/cli/` (basic commands: calc-hsp, export-rab, validate)
- Published to npm (first public release)
- Optional: Bina Marga divisi 1-2, 4-7+ data expansion

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

## Peer Review Multi-Model (WAJIB sebelum merge)

Sebelum merge ke branch utama, lakukan review multi-model dengan agent yang sudah dikonfigurasi:

1. Panggil `@reviewer-kimi` untuk review #1 — otomatis menggunakan Kimi K2.6
2. Panggil `@reviewer-glm` untuk review #2 — otomatis menggunakan GLM 5.1
3. Jika keduanya menemukan critical issue yang sama → **wajib fix** sebelum merge
4. Jika ada medium/low issue → fix atau catat sebagai tech debt
5. Compile hasil kedua review dan pastikan semua critical issue resolved

## AI Attribution Rules

- NEVER add `Co-Authored-By` to commit messages
- NEVER add AI branding to PR descriptions, README, or any file
- Commits and PRs must look like they were written by a human

## Progress Tracking

All task progress is tracked in `PROGRESS.md`. Update it after completing each task.
