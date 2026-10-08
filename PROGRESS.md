# AHS-ID — Phase 2 Progress

> Public checklist for **Phase 2: Functional Library — "Usable by Others"**.  
> Last updated: 2026-09-23 (DAS-8: npm publish live on `@ahs-id/*`; README quick start).

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

## Phase 2 exit — CLI, Excel, npm ✅

Epic: [DAS-1](https://github.com/rachmad-jenss/ahs-id/issues/1).

| Issue | Task | Status |
|-------|------|--------|
| DAS-4 | RAB Excel exporter (`packages/core` `exporter/excel.ts`) | ✅ Done |
| DAS-5 | Scaffold `apps/cli` — `calc-hsp` | ✅ Done |
| DAS-6 | CLI `export-rab` | ✅ Done |
| DAS-7 | CLI `validate` for bundles | ✅ Done |
| DAS-8 | npm publish workflow & package metadata | ✅ Done — release gate #34; first publish [workflow run](https://github.com/rachmad-jenss/ahs-id/actions/runs/35719103687) (10 packages on [npm](https://www.npmjs.com/org/ahs-id)) |
| DAS-9 | Changesets & CHANGELOG | ✅ Done |

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
| `@ahs-id/ahsp-se-binkon-47-2026` | SE Binkon 47/2026 — SDA / Bina Marga / Cipta Karya (npm `0.2.0`) |
| `@ahs-id/hsd-jabar-2025` | HSD Jawa Barat Q1 2025 |
| `@ahs-id/hsd-kaltim-2025` | HSD Kalimantan Timur Q1 2025 |
| `@ahs-id/hsd-papua-2025` | HSD Papua Q1 2025 |
| `@ahs-id/hsd-bm-2022` | Permen PUPR 1/2022 embedded HSD (Bina Marga 2022) |
| `@ahs-id/cli` | `ahs-id` CLI (`calc-hsp`, `export-rab`, `validate`) |
| `@ahs-id/engine-registry` | Shared AHSP/HSD registry for CLI + web `/kalkulator` (npm pending DAS-65) |

All published engine/data rows above (except engine-registry) are on npm. Bina Marga 2022 uses `@ahs-id/hsd-bm-2022` sewa rates in the CLI default path.

## Web catalog (DAS-63 / epic DAS-57)

- [x] Unified search shards (`public/search/*`) — AHSP nasional + DCKTRP, HSP portal, resource, productivity
- [x] `CatalogBrowser` fetch + `?kind=` badges (no giant HTML props)
- [x] HSP Jakarta detail `/hsp/jakarta/[sourceId]/`
- [x] AHSP DCKTRP detail `/ahsp/sumber/[sourceId]/[code]/`
- [x] `@ahs-id/engine-registry` + `/kalkulator`
- [x] Docs: `docs/web-catalog.md`
- [x] Production verify (`ahs-id.jenss.me`) — katalog/kalkulator/search manifest live after DAS-63 merge

## Follow-ups

- [ ] **DAS-65** — Hero autocomplete + kalkulator item variables + publish `@ahs-id/engine-registry`
- [ ] **DAS-66** — BM-2022 regional HSD via Permen-base overlay (in progress)
- [ ] **DAS-67** — Fill SE Binkon 47/2026 `harga_satuan_ref` where source available
- [x] Epics DAS-2 / DAS-3 closed (children done); DAS-1 remains open until npm/CLI exit complete
