# Golden Tests

Same input, same output — across engines and versions.

## Structure

- `fixtures/` — Input JSON (`kode_ahsp`, `bundle`, `hsd_region`, `variabel`)
- `expected/` — Expected numeric totals (`baseTotal`, `grandTotal`, group totals)
- `fixture-golden.test.ts` — Loads fixtures, runs `createCalculator(bundle, hsd)`, compares with ε = 0.01 Rp
- `gen-expected.test.ts` — Regenerate `expected/` from fixtures (`GEN_GOLDEN=1 pnpm test gen-expected`)

## Tolerance

All comparisons use epsilon = 0.01 Rp (ΔRp ≤ 1 for final HSP).

## Adding a Test

1. Create `fixtures/NN-description.json` with input parameters
2. Run `GEN_GOLDEN=1 pnpm test gen-expected` (or compute via engine) to create `expected/NN-description.json`
3. Commit both fixture and expected files
4. The test runner picks up new fixtures automatically
