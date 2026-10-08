## Summary

- Add `mergeHsdBaseWithRegionalOverlay` in `@ahs-id/core`: keep Permen `hsd-bm-2022` refs; overlay regional prices only when `ref` + normalized `nama` + `satuan` match (labor stays Permen).
- Expose `loadResolvedHsdForBundle` in `@ahs-id/engine-registry` (CLI/web use it for `compatibleHsd` pairs).
- Expand `bina-marga-2022` `compatibleHsd` to Kaltim/Jabar/Papua/Jakarta; default path still pure Permen.
- Kalkulator hint: regional pick for BM-2022 is mostly region label + fuels until identity-aligned L/M/E rows exist.
- Changeset for core / engine-registry / cli / web.

Closes #66

## Test plan

- [x] `pnpm --filter @ahs-id/core exec vitest run src/calculator/__tests__/merge-hsd.test.ts`
- [x] `pnpm --filter @ahs-id/bina-marga-2022 test`
- [x] Spot-check `3.1.(1)` with Kaltim overlay keeps E.09 = 692885; E.01 stays AMP (not excavator)
- [ ] CI green on tip
