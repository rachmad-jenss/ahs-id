import { describe, expect, it } from 'vitest';
import { calculateHspInBrowser, listCalculatorBundles } from '../src/lib/calculator.js';

describe('web calculator registry', () => {
  it('lists dynamic and fixed-coefficient bundles from engine-registry', () => {
    const bundles = listCalculatorBundles();
    expect(bundles.some((row) => row.name === 'pupr-2023' && row.strategy === 'dynamic-bundle')).toBe(true);
    expect(bundles.some((row) => row.name === 'cipta-karya-2024' && row.strategy === 'fixed-coefficient')).toBe(true);
    expect(bundles.some((row) => row.name === 'sda-se-binkon-47-2026')).toBe(true);
  });

  it('spot-checks HSP totals for sample codes across strategies', async () => {
    const priced = await calculateHspInBrowser({
      bundle: 'bina-marga-2016',
      item: '3.1.1',
      hsd: 'hsd-kaltim-2025',
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
