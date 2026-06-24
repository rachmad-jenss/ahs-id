# @ahs-id/hsd-kaltim-2025

## 0.0.2

### Patch Changes

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

- Updated dependencies
  - @ahs-id/core@0.1.0
