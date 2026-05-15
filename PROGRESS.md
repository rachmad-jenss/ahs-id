# PROGRESS.md — Phase 1 Task Tracker

> Auto-updated setiap kali task selesai. Refer ke `docs/architecture.md` untuk detail spec.

## Phase 1: MVP — "One Chain Works"

### Milestone 1: Project Setup
| Task | Status | Notes |
|------|--------|-------|
| Init monorepo (pnpm workspaces + turbo) | ⬜ | |
| Setup TypeScript config (strict) | ⬜ | |
| Setup Vitest | ⬜ | |
| Setup ESLint + Prettier | ⬜ | |
| Create packages/core scaffold | ⬜ | |
| Create packages/pupr-2023 scaffold | ⬜ | |
| Create packages/hsd-kaltim-2025 scaffold | ⬜ | |
| Create tests/golden scaffold | ⬜ | |
| Write README.md | ⬜ | |
| Write CONTRIBUTING.md | ⬜ | |
| Write LICENSE (MIT) | ⬜ | |
| Write LEGAL.md | ⬜ | |
| Write docs/architecture.md (copy from spec) | ⬜ | |

### Milestone 2: Types & Schema
| Task | Status | Notes |
|------|--------|-------|
| Define core types (types/index.ts) | ⬜ | AhspComponent, AhspGroup, AhspCalculation, HSPResult, etc. |
| Define branded domain types (types/domain.ts) | ⬜ | IDR, Percentage, Volume |
| Define bundle types (BundleMeta, AhspItem, etc.) | ⬜ | |
| Define HSD types (HsdRegional, HsdPeralatanEntry, etc.) | ⬜ | |
| Define input/config types (CalculatorConfig, VariabelInput) | ⬜ | |
| Create JSON Schemas for validation | ⬜ | ahsp-item, peralatan, hsd-regional, etc. |

### Milestone 3: Data Entry (AHSP 3.2.1 first)
| Task | Status | Notes |
|------|--------|-------|
| tenaga-kerja.json (L.01-L.06) | ⬜ | Layer 1 verified vs PDF |
| peralatan-master.json (E.01, E.08, E.11, E.19, E.22, E.25) | ⬜ | Full ownership params |
| bahan-master.json (items for 3.2.1 + 3.1.1) | ⬜ | |
| faktor-konversi.json | ⬜ | bank/loose/compacted factors |
| ahsp/bina-marga/divisi-3/3.2.1-lapis-pondasi-agregat.json | ⬜ | Proof item |
| ahsp/bina-marga/divisi-3/3.1.1-galian-biasa.json | ⬜ | Second item |
| hsd-kaltim-2025/hsd.json | ⬜ | 1 region |

### Milestone 4: Engine Core
| Task | Status | Notes |
|------|--------|-------|
| hsd-peralatan.ts (ownership mode) | ⬜ | Biaya pasti + operasi |
| produktivitas/index.ts (dispatcher) | ⬜ | siklus / lintasan dispatch |
| produktivitas/siklus.ts | ⬜ | Excavator, DT, Wheel Loader, Water Tanker |
| produktivitas/lintasan.ts | ⬜ | Vibro Roller, Motor Grader |
| konversi-volume.ts | ⬜ | bank ↔ loose ↔ compacted |
| koefisien.ts (resolver) | ⬜ | Static + dynamic coefficient resolution |
| margin.ts | ⬜ | Overhead + profit with split + lump sum aware |
| hsp.ts (main calculator) | ⬜ | Orchestrates all modules |
| createCalculator() API | ⬜ | Public API entry point |

### Milestone 5: Validation
| Task | Status | Notes |
|------|--------|-------|
| validate-bundle.ts | ⬜ | Structural + ref integrity |
| validate-input.ts | ⬜ | Runtime input validation |
| validate-refs.ts | ⬜ | Cross-bundle reference check |

### Milestone 6: Testing & Verification
| Task | Status | Notes |
|------|--------|-------|
| Unit tests: hsd-peralatan | ⬜ | |
| Unit tests: produktivitas/siklus | ⬜ | |
| Unit tests: produktivitas/lintasan | ⬜ | ⚠️ km/h → m/h conversion |
| Unit tests: konversi-volume | ⬜ | |
| Unit tests: margin | ⬜ | Split overhead/profit |
| Unit tests: koefisien resolver | ⬜ | |
| Unit tests: hsp (integration) | ⬜ | |
| Unit tests: validate-bundle | ⬜ | |
| Golden test: 3.2.1 proof-of-engine | ⬜ | ΔRp ≤ 1 vs independent spreadsheet |
| Golden test: 3.1.1 galian biasa | ⬜ | |
| Golden tests: 3 additional fixtures | ⬜ | |
| Independent spreadsheet verification | ⬜ | NOT from OPP Excel |

### Milestone 7: Proof of Engine (DoD Checklist)
| Task | Status | Notes |
|------|--------|-------|
| Engine loads bundle tanpa error | ⬜ | |
| Engine loads HSD tanpa error | ⬜ | |
| validateBundle() returns valid: true | ⬜ | |
| Static coefficients resolved (TK + Bahan) | ⬜ | |
| HSD peralatan ownership calculated | ⬜ | Biaya pasti + operasi |
| Produktivitas DT (siklus, 25km, sedang) | ⬜ | |
| Produktivitas WL (siklus, agregat) | ⬜ | |
| Produktivitas VR (lintasan, 0.20m, 6 pass) | ⬜ | |
| Produktivitas MG (lintasan, 3.0m, 6 lint) | ⬜ | |
| Produktivitas WT (siklus, 8km) | ⬜ | |
| Volume state conversion applied | ⬜ | |
| Biaya langsung = Σ(koef × HSD) correct | ⬜ | |
| Overhead+profit (15%) applied | ⬜ | |
| HSP matches independent calc (ΔRp ≤ 1) | ⬜ | |
| Audit trail in output | ⬜ | |
| No warnings in penuh mode | ⬜ | |
| All golden tests passing | ⬜ | |

## Legend
- ⬜ Not started
- 🔨 In progress
- ✅ Done
- ❌ Blocked
