# @ahs-id/cli

## 0.1.1

### Patch Changes

- 3646e80: Add national SE Binkon 47/2026 AHSP data bundles (SDA, Bina Marga, Cipta Karya) from Docling promote pipeline.
- Updated dependencies [3646e80]
  - @ahs-id/ahsp-se-binkon-47-2026@0.2.0
  - @ahs-id/core@0.1.1
  - @ahs-id/bina-marga-2016@0.1.2
  - @ahs-id/bina-marga-2022@0.0.3
  - @ahs-id/cipta-karya-2024@0.0.3
  - @ahs-id/hsd-bm-2022@0.0.2
  - @ahs-id/hsd-jabar-2025@0.0.3
  - @ahs-id/hsd-jakarta-2026@0.1.1
  - @ahs-id/hsd-kaltim-2025@0.0.3
  - @ahs-id/hsd-papua-2025@0.0.3
  - @ahs-id/pupr-2023@0.0.3

## 0.1.0

### Minor Changes

- Phase 2 exit: CLI, productivity exports, calculator tests, cross-bundle CI

  **cli (new):**
  - `apps/cli` scaffold with `calc-hsp`, `export-rab`, `validate` commands

  **core:**
  - Export all 7 productivity helper functions (`produktivitasExcavator`, `produktivitasDumpTruck`, etc.)
  - 16 unit tests for `createCalculator` and `hitungHSP` (62 total, up from 46)
  - Refactor `calcProduktivitas` to delegate to produktivitas modules
  - HSD staleness warnings (`hsd_staleness_warning_days` in CalculatorConfig)

  **ci:**
  - Cross-bundle validation script + GitHub Actions step
  - JSON schema validation for all data packages

### Patch Changes

- Updated dependencies
  - @ahs-id/core@0.1.0
  - @ahs-id/pupr-2023@0.0.2
  - @ahs-id/hsd-kaltim-2025@0.0.2
  - @ahs-id/hsd-jabar-2025@0.0.2
  - @ahs-id/hsd-papua-2025@0.0.2
  - @ahs-id/bina-marga-2016@0.1.1
  - @ahs-id/bina-marga-2022@0.0.2
  - @ahs-id/cipta-karya-2024@0.0.2
