# CLAUDE.md — Project Context for AI-Assisted Development

## Project Overview

@ahs-id adalah open source calculation engine & structured data bundles untuk Analisa Harga Satuan Pekerjaan (AHSP) Indonesia berdasarkan Permen PUPR. Monorepo TypeScript (pnpm workspaces + Turborepo).

## Architecture Reference

Semua keputusan teknis mengacu pada dokumen arsitektur: `docs/architecture.md`
Jangan deviate dari spec tanpa konfirmasi eksplisit dari maintainer.

## Current Phase

**Phase 1: MVP — "One Chain Works"**
Exit criteria: Satu AHSP calculation chain (3.2.1 Lapis Pondasi Agregat Kelas A) menghasilkan HSP yang benar, tervalidasi terhadap kalkulasi manual independen (ΔRp ≤ 1).

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

## Phase 1 Scope (STRICT — do NOT exceed)

### Included:
- `@ahs-id/core`: createCalculator(), hsd-peralatan.ts (ownership only), produktivitas/siklus.ts, produktivitas/lintasan.ts, konversi-volume.ts, koefisien.ts, hsp.ts, margin.ts, validate-bundle.ts, types/index.ts
- `@ahs-id/pupr-2023` (PARTIAL): tenaga-kerja.json (L.01-L.06), peralatan-master.json (E.01, E.08, E.11, E.19, E.22, E.25), bahan-master.json (items for test AHSP only), faktor-konversi.json, ahsp/bina-marga/divisi-3/3.2.1 + 3.1.1
- `@ahs-id/hsd-kaltim-2025`: 1 region HSD
- tests/golden/: minimum 5 fixtures
- README.md, CONTRIBUTING.md, LICENSE (MIT), LEGAL.md

### NOT included in Phase 1 (hard boundary):
- ✗ CLI tool
- ✗ Python bindings
- ✗ Excel/PDF exporter
- ✗ Mode sewa (rental)
- ✗ sub_ahsp nesting
- ✗ Mode estimasi-kasar
- ✗ Throughput productivity (AMP)
- ✗ Mob/demob module
- ✗ CDN/API fetching
- ✗ Demo site

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
