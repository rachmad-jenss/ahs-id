import { describe, expect, it } from 'vitest';
import {
  calculateHspInBrowser,
  defaultsFromItemMeta,
  listCalculatorBundles,
  loadCalculatorItemMeta,
  parseCalculatorVariables,
} from '../src/lib/calculator.js';

describe('web calculator registry', () => {
  it('lists dynamic and fixed-coefficient bundles from engine-registry', () => {
    const bundles = listCalculatorBundles();
    expect(bundles.some((row) => row.name === 'pupr-2023' && row.strategy === 'dynamic-bundle')).toBe(true);
    expect(bundles.some((row) => row.name === 'cipta-karya-2024' && row.strategy === 'fixed-coefficient')).toBe(true);
    expect(bundles.some((row) => row.name === 'sda-se-binkon-47-2026')).toBe(true);
  });

  it('loads declared item variables and parses only those keys', async () => {
    const meta = await loadCalculatorItemMeta({
      bundle: 'bina-marga-2016',
      item: '3.1.1',
    });
    expect(meta.strategy).toBe('dynamic-bundle');
    expect(meta.variables.L_km?.tipe).toBe('number');
    const seeded = defaultsFromItemMeta(meta);
    expect(seeded.L_km).toBe('2');
    const parsed = parseCalculatorVariables(meta, { ...seeded, unknown_key: '9' }, {
      overhead: '12',
      profit: '3',
    });
    expect(parsed).toEqual({ L_km: 2 });
    expect(parsed).not.toHaveProperty('unknown_key');
    expect(parsed).not.toHaveProperty('overhead_pct');

    const fixedMeta = await loadCalculatorItemMeta({
      bundle: 'cipta-karya-2024',
      item: '1.2.1.1.1',
    });
    expect(fixedMeta.strategy).toBe('fixed-coefficient');
    expect(
      parseCalculatorVariables(fixedMeta, {}, { overhead: '11', profit: '4' }),
    ).toEqual({ overhead_pct: 11, profit_pct: 4 });
    expect(
      parseCalculatorVariables(fixedMeta, {}, { overhead: '  ', profit: '' }),
    ).toEqual({});
  }, 30_000);

  it('spot-checks HSP totals for sample codes across strategies', async () => {
    const priced = await calculateHspInBrowser({
      bundle: 'bina-marga-2016',
      item: '3.1.1',
      hsd: 'hsd-kaltim-2025',
      variables: { L_km: 2 },
    });
    expect(priced.kode_ahsp).toBe('3.1.1');
    expect(priced.grandTotal).toBeGreaterThan(0);

    const fixed = await calculateHspInBrowser({
      bundle: 'cipta-karya-2024',
      item: '1.2.1.1.1',
    });
    expect(fixed.kode_ahsp).toBe('1.2.1.1.1');
    expect(fixed.grandTotal).toBeGreaterThan(0);

    // SE47 national templates may ship harga_satuan_ref=0 (PDF without prices).
    const se47 = await calculateHspInBrowser({
      bundle: 'sda-se-binkon-47-2026',
      item: 'A.1.01.a',
    });
    expect(se47.kode_ahsp).toBe('A.1.01.a');
    expect(Number.isFinite(se47.grandTotal)).toBe(true);
  }, 60_000);
});
