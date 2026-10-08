## Summary

- Enrich SE Binkon 47/2026 Cipta Karya `harga_satuan_ref` from DCKTRP by matching component `kode` (63 matched items / 313 prices filled).
- Add `scripts/enrich-se47-prices-from-dcktrp.mjs` + `pnpm national:se47-enrich-dcktrp-prices`.
- Document limits in package README; SDA/Bina Marga stay at 0 (no reliable kode overlap).
- Lock with `dcktrp-prices.test.ts` + enrich report JSON.

Closes #67

## Test plan

- [ ] `pnpm --filter @ahs-id/ahsp-se-binkon-47-2026 test`
- [ ] `pnpm validate-data` (SE47 package in scope)
- [ ] Spot-check report: `packages/ahsp-se-binkon-47-2026/reports/dcktrp-price-enrich-report.json`
- [ ] Confirm SDA/BM items still have zero component prices
