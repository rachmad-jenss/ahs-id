# AHS-ID — Phase 2 Progress

> Public checklist for **Phase 2: Functional Library — "Usable by Others"**.  
> Last updated: 2026-05-29 (Wave 1 merged).

**Exit criteria:** External developer can `npm install`, calculate HSP for any Bina Marga item (PUPR path), and export to Excel.

## Phase 1 — MVP ✅

**"One Chain Works"** — complete (2026-05-16).

## Phase 2 — Engine & bundles (done)

- [x] `@ahs-id/core`: throughput, mode sewa, sub-ahsp, estimasi-kasar, cross-bundle validation, JSON Schema validation
- [x] `@ahs-id/pupr-2023`: Divisi 3 (12 items), equipment/bahan extensions
- [x] Regional HSD: Kaltim, Jabar, Papua (`@ahs-id/hsd-*-2025`)
- [x] Golden tests package (`tests/golden`)
- [x] Extra bundles: `bina-marga-2016`, `bina-marga-2022`, `cipta-karya-2024`

## Infra & security

- [x] **DAS-10** — GitHub Actions CI on `main` (lint, typecheck, validate-data, test; draft PR skip; docs paths-ignore)
- [x] **DAS-20** — Purge `AGENTS.md`, `TEMPLATES.md`, `.opencode/` from public git history (`git filter-repo`)

## Wave 1 — Engineering quality ✅

Epic: [DAS-2](https://github.com/rachmad-jenss/ahs-id/issues/2) — CI, validation, golden.

| Issue | Task | Status |
|-------|------|--------|
| DAS-10 | Land CI on main | ✅ Done |
| DAS-11 | Extend `validate-data.mjs` to all bundle packages | ✅ Done |
| DAS-12 | CI `validateBundle` for all DataBundle packages | ✅ Done |
| DAS-13 | File-based golden fixtures with numeric lock | ✅ Done |
| DAS-14 | `PROGRESS.md` + local `AGENTS.md` sync | ✅ Done |

## Phase 2 exit — CLI, Excel, npm (remaining)

Epic: [DAS-1](https://github.com/rachmad-jenss/ahs-id/issues/1).

| Issue | Task | Status |
|-------|------|--------|
| DAS-4 | RAB Excel exporter (`packages/core` `exporter/excel.ts`) | ✅ Done |
| DAS-5 | Scaffold `apps/cli` — `calc-hsp` | ✅ Done |
| DAS-6 | CLI `export-rab` | ✅ Done |
| DAS-7 | CLI `validate` for bundles | ✅ Done |
| DAS-8 | npm publish workflow & package metadata | ⬜ Open |
| DAS-9 | Changesets & CHANGELOG | ⬜ Open |

**Optional (post-exit):** Bina Marga divisi 1–7+ expansion; unify `bina-marga-2022` calculation path with regional HSD bundles.

## Engine consistency (backlog)

Epic: [DAS-3](https://github.com/rachmad-jenss/ahs-id/issues/3) — DAS-15–18 (productivity refactor, calculator tests, HSD staleness, public API exports).

## Test suite (Vitest)

Run: `pnpm test` (9 packages in scope; 4 run tests today).

| Package | Tests |
|---------|------:|
| `@ahs-id/core` | 65 |
| `@ahs-id/bina-marga-2022` | 24 |
| `@ahs-id/golden-tests` | 57 (+1 skipped gen helper) |
| **Total** | **146** |

Completed: DAS-18 (export produktivitas helpers), DAS-17 (createCalculator + hitungHSP unit tests),
DAS-15 (refactor calcProduktivitas), DAS-16 (HSD staleness warnings)

Golden tolerance: ε = 0.01 Rp.

## Packages (monorepo)

| Package | Role |
|---------|------|
| `@ahs-id/core` | Calculator engine, validator, types |
| `@ahs-id/pupr-2023` | Permen PUPR 8/2023 (12 items) |
| `@ahs-id/bina-marga-2016` | Bina Marga 2016 (createCalculator path) |
| `@ahs-id/bina-marga-2022` | Bina Marga 2022 (422 items, separate calc path) |
| `@ahs-id/cipta-karya-2024` | Fixed-coefficient Cipta Karya |
| `@ahs-id/hsd-jabar-2025` | HSD Jawa Barat Q1 2025 |
| `@ahs-id/hsd-kaltim-2025` | HSD Kalimantan Timur Q1 2025 |
| `@ahs-id/hsd-papua-2025` | HSD Papua Q1 2025 |

`apps/cli/` — not scaffolded yet (Phase 2 exit).
