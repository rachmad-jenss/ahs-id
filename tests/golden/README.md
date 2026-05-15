# Golden Tests

Same input, same output — across engines and versions.

## Structure

- `fixtures/` — Input JSON files (AHSP item code + variabel input + config)
- `expected/` — Expected output JSON files (HSP breakdown, computed independently)
- `run-ts.test.ts` — Runs fixtures against the TypeScript engine

## Tolerance

All comparisons use epsilon = 0.01 Rp (ΔRp ≤ 1 for final HSP).

## Adding a Test

1. Create `fixtures/NN-description.json` with input parameters
2. Compute expected output independently (spreadsheet, NOT from existing Excel)
3. Create `expected/NN-description.json` with expected HSP breakdown
4. The test runner picks up new fixtures automatically
