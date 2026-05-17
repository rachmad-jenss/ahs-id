# PROGRESS.md — Phase 1 Task Tracker

> Auto-updated setiap kali task selesai. Refer ke `docs/architecture.md` untuk detail spec.

## Phase 1: MVP — "One Chain Works"

### Milestone 1: Project Setup
| Task | Status | Notes |
|------|--------|-------|
| Init monorepo (pnpm workspaces + turbo) | ✅ | 5 workspace projects |
| Setup TypeScript config (strict) | ✅ | ES2022, NodeNext, noUncheckedIndexedAccess |
| Setup Vitest | ✅ | vitest.workspace.ts |
| Setup ESLint + Prettier | ✅ | Flat config, no-explicit-any: error |
| Create packages/core scaffold | ✅ | |
| Create packages/pupr-2023 scaffold | ✅ | |
| Create packages/hsd-kaltim-2025 scaffold | ✅ | |
| Create tests/golden scaffold | ✅ | |
| Write README.md | ✅ | |
| Write CONTRIBUTING.md | ✅ | |
| Write LICENSE (MIT) | ✅ | |
| Write LEGAL.md | ✅ | |
| Write docs/architecture.md (copy from spec) | ✅ | v2.3.1 |

### Milestone 2: Types & Schema
| Task | Status | Notes |
|------|--------|-------|
| Define core types (types/index.ts) | ✅ | ~400 lines, all spec Section 4 types |
| Define branded domain types (types/domain.ts) | ✅ | IDR, Percentage, Volume |
| Define bundle types (BundleMeta, AhspItem, etc.) | ✅ | |
| Define HSD types (HsdRegional, HsdPeralatanEntry, etc.) | ✅ | |
| Define input/config types (CalculatorConfig, VariabelInput) | ✅ | |
| Create JSON Schemas for validation | ⬜ | Deferred — using TS types + validate-bundle.ts |

### Milestone 3: Data Entry (AHSP 3.2.1 first)
| Task | Status | Notes |
|------|--------|-------|
| tenaga-kerja.json (L.01-L.06) | ✅ | 8 entries (L.01 + L.02a-c + L.03-L.06) |
| peralatan-master.json (E.01, E.08, E.11, E.19, E.22, E.25) | ✅ | E.11/E.19/E.25 use placeholder specs |
| bahan-master.json (items for 3.2.1 + 3.1.1) | ✅ | M.09.a |
| faktor-konversi.json | ✅ | 5 materials |
| ahsp/bina-marga/divisi-3/3.2.1-lapis-pondasi-agregat.json | ✅ | Proof item — full AHSP |
| ahsp/bina-marga/divisi-3/3.1.1-galian-biasa.json | ✅ | Second item |
| hsd-kaltim-2025/hsd.json | ✅ | Full Kaltim HSD Q1 2025 |

### Milestone 4: Engine Core
| Task | Status | Notes |
|------|--------|-------|
| hsd-peralatan.ts (ownership mode) | ✅ | Biaya pasti + operasi, 3 tests |
| produktivitas/index.ts (dispatcher) | ✅ | Re-exports all functions |
| produktivitas/siklus.ts | ✅ | Excavator, DT, WL, WT — 4 tests |
| produktivitas/lintasan.ts | ✅ | VR (km→m verified), MG (area-based) — 3 tests |
| konversi-volume.ts | ✅ | bank ↔ loose ↔ compacted — 8 tests |
| koefisien.ts (resolver) | ✅ | Static + dynamic — 4 tests |
| margin.ts | ✅ | Split overhead/profit, lump sum aware — 6 tests |
| hsp.ts (main calculator) | ✅ | Full orchestration chain |
| createCalculator() API | ✅ | Public API entry point |

### Milestone 5: Validation
| Task | Status | Notes |
|------|--------|-------|
| validate-bundle.ts | ✅ | Ref integrity + cross-bundle + range + provenance |
| validate-input.ts | ⬜ | Phase 2 |
| validate-refs.ts | ⬜ | Merged into validate-bundle.ts |

### Milestone 6: Testing & Verification
| Task | Status | Notes |
|------|--------|-------|
| Unit tests: hsd-peralatan | ✅ | 3 tests (hand-calc, Fpr berat, audit) |
| Unit tests: produktivitas/siklus | ✅ | 4 tests (DT, Excavator, WL, WT) |
| Unit tests: produktivitas/lintasan | ✅ | 3 tests (VR, VR km→m, MG) |
| Unit tests: konversi-volume | ✅ | 8 tests |
| Unit tests: margin | ✅ | 6 tests |
| Unit tests: koefisien resolver | ✅ | 4 tests |
| Golden test: 3.2.1 proof-of-engine | ✅ | Full chain + distance sensitivity |
| Golden test: 3.1.1 galian biasa | ✅ | Excavator + DT + distance sensitivity |
| Golden test: volume conversion chain | ✅ | Verifies loose→compacted conversion |
| Golden test: bundle validation | ✅ | pupr-2023 + kaltim HSD passes |
| Golden test: Fpr berat mode | ✅ | kondisi_operasi=berat costs more |

### Milestone 7: Proof of Engine (DoD Checklist)
| Task | Status | Notes |
|------|--------|-------|
| Engine loads bundle tanpa error | ✅ | |
| Engine loads HSD tanpa error | ✅ | |
| validateBundle() returns valid: true | ✅ | Golden test verifies |
| Static coefficients resolved (TK + Bahan) | ✅ | |
| HSD peralatan ownership calculated | ✅ | |
| Produktivitas DT (siklus, 25km, sedang) | ✅ | |
| Produktivitas WL (siklus, agregat) | ✅ | |
| Produktivitas VR (lintasan, 0.20m, 6 pass) | ✅ | |
| Produktivitas MG (lintasan, 3.0m, 6 lint) | ✅ | |
| Produktivitas WT (siklus, 8km) | ✅ | |
| Volume state conversion applied | ✅ | loose→compacted verified |
| Biaya langsung = Σ(koef × HSD) correct | ✅ | |
| Overhead+profit (15%) applied | ✅ | |
| Audit trail in output | ✅ | |
| All golden tests passing | ✅ | 12 golden + 39 unit = 51 tests |

## Test Summary (Phase 1 + Phase 2)
- **Unit tests**: 39 passing (6 test files in packages/core)
- **Golden tests**: 12 passing (1 test file in tests/golden)
- **Total**: 51 tests passing

---

## Phase 2: Functional Library — "Usable by Others"

> Entry: Phase 1 complete ✅. Exit: External dev can npm install, calc HSP for any Bina Marga item, export to Excel.

### Milestone 8: Technical Debt & Data Quality
| Task | Status | Notes |
|------|--------|-------|
| Research E.11 Wheel Loader actual specs | ✅ | 154HP, 17.0t, Rp1.6B (CAT 950 class) |
| Research E.19 Motor Grader actual specs | ✅ | 135HP, 13.3t, Rp2.2B, blade 2.5m |
| Research E.25 Water Tanker actual specs | ✅ | 133HP, 9.5t, Rp550M, 54L/m³ |
| JSON Schema validation at build time | ✅ | 6 schemas, ajv, runs in `pnpm build` |

### Milestone 9: Engine Extensions
| Task | Status | Notes |
|------|--------|-------|
| produktivitas/throughput.ts (AMP, batching plant) | ✅ | Q=Kapasitas×Fa, hsp.ts integrated, 2 tests |
| hsd-peralatan.ts → add mode sewa | ✅ | hitungHsdPeralatanSewa + hitungHsdPeralatanAny dispatcher, 4 tests |
| sub-ahsp resolver (nesting + circular dep check) | ✅ | resolveSubAhsp + hsp.ts integration, 5 tests |
| Mode estimasi-kasar (koef_referensi + warnings) | ✅ | CalculatorConfig.mode, penuh errors, kasar fallback, 2 golden tests |
| validate-refs.ts (cross-bundle integrity) | ✅ | Sub-AHSP refs, namespace L./E./M., FK coverage — merged into validate-bundle.ts |

### Milestone 10: Data Expansion (Bina Marga Complete)
| Task | Status | Notes |
|------|--------|-------|
| ahsp/bina-marga/divisi-3 (all 12 items) | ✅ | 3.1.1-3.1.6, 3.2.1-3.2.3, 3.3.1-3.3.3 |
| Additional peralatan-master entries | ✅ | E.02 Bulldozer, E.14 Compressor, E.15 Jack Hammer (9 total) |
| Additional bahan-master entries | ✅ | M.09.b Agregat Kelas B, M.09.s Agregat Kelas S (3 total) |
| Additional faktor-konversi entries | ✅ | agregat_kelas_b, agregat_kelas_s, batu (8 total) |
| ahsp/bina-marga/divisi-1 (all items) | ⬜ | |
| ahsp/bina-marga/divisi-2 (all items) | ⬜ | |
| ahsp/bina-marga/divisi-4 (all items) | ⬜ | |
| ahsp/bina-marga/divisi-5 (all items) | ⬜ | |
| ahsp/bina-marga/divisi-6 (all items) | ⬜ | |
| ahsp/bina-marga/divisi-7+ (all items) | ⬜ | |
| HSD region 2 (Jawa Barat) | ✅ | hsd-jabar-2025, lowest prices (Java accessibility) |
| HSD region 3 (Papua) | ✅ | hsd-papua-2025, highest prices (remote logistics) |

### Milestone 13: Bundle @ahs-id/bina-marga-2022 (NEW)
| Task | Status | Notes |
|------|--------|-------|
| Python extraction script (scripts/extract-bina-marga-2022.py) | ✅ | Parses D2-D10 sheets, 422 items extracted |
| packages/bina-marga-2022 package scaffold | ✅ | package.json, tsconfig.json, src/index.ts |
| AHSP data: Divisi 2 (41 items) | ✅ | D2 sheet: galian, gorong-gorong, saluran |
| AHSP data: Divisi 3 (23 items) | ✅ | D3 sheet: perkerasan berbutir |
| AHSP data: Divisi 4 (38 items) | ✅ | D4 sheet: perkerasan aspal |
| AHSP data: Divisi 5 (17 items) | ✅ | D5 sheet: perkerasan beton |
| AHSP data: Divisi 6 (35 items) | ✅ | D6 sheet: struktur |
| AHSP data: Divisi 7 (113 items) | ✅ | D7(1)+D7(2) sheets: jembatan |
| AHSP data: Divisi 8 (72 items) | ✅ | D8 sheet: drainase & rehabilitasi |
| AHSP data: Divisi 9 (61 items) | ✅ | D9(1)+D9(2) sheets: pekerjaan harian |
| AHSP data: Divisi 10 (22 items) | ✅ | D10 sheet: pekerjaan pemeliharaan rutin |
| tenaga-kerja.json (L01-L25 codes) | ✅ | 32 labor codes with hourly rates |
| bahan-master.json (M01-M122 codes) | ✅ | 311 bahan codes with prices |
| TypeScript build passes | ✅ | tsc --noEmit clean |
| Total: 422 items across 9 divisi | ✅ | D2-D10, Permen PUPR 1/2022 |

### Milestone 11: Export & CLI
| Task | Status | Notes |
|------|--------|-------|
| exporter/excel.ts (RAB format) | ⬜ | |
| apps/cli/ scaffold | ⬜ | |
| CLI: calc-hsp command | ⬜ | |
| CLI: export-rab command | ⬜ | |
| CLI: validate command | ⬜ | |

### Milestone 12: Publish & Tests
| Task | Status | Notes |
|------|--------|-------|
| Golden tests ≥10 fixtures | ✅ | 12 golden tests (3.1.5 jack hammer, 3.3.1 timbunan, cross-region) |
| npm publish setup | ⬜ | |
| First public release | ⬜ | |

### Milestone 13: Bundle Tambahan (Historis)
| Task | Status | Notes |
|------|--------|-------|
| @ahs-id/bina-marga-2016 — Divisi 3 (23 item) | ✅ | Permen PUPR 28/2016 & Spesif. Umum 2010 Rev.3 via BIMTEK v5.0 2019 |
| @ahs-id/bina-marga-2016 — Divisi 1, 2, 4-10 | ⬜ | Dapat diekstrak dari file Excel BIMTEK yang sama |

## Legend
- ⬜ Not started
- 🔨 In progress
- ✅ Done
- ❌ Blocked
