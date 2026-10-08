import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calcHspFixedCoefficient } from '@ahs-id/core';
import { ahspItemsBinaMarga, ahspItemsCiptaKarya, ahspItemsSda } from '../index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const report = JSON.parse(
  readFileSync(join(root, 'data/dcktrp-price-enrich-report.json'), 'utf8'),
) as {
  bidang: {
    sda: { matched: number; componentsFilled: number };
    'bina-marga': { matched: number; componentsFilled: number };
    'cipta-karya': {
      matched: number;
      componentsFilled: number;
      componentsSkipped: number;
      samples: string[];
    };
  };
};

function componentPrices(items: typeof ahspItemsSda): number[] {
  const prices: number[] = [];
  for (const item of items) {
    for (const section of ['tenaga_kerja', 'bahan', 'peralatan'] as const) {
      for (const row of item[section] ?? []) {
        prices.push(row.harga_satuan_ref);
      }
    }
  }
  return prices;
}

describe('SE47 DCKTRP price enrich', () => {
  it('pins CK enrich report counts', () => {
    expect(report.bidang['cipta-karya'].matched).toBe(63);
    expect(report.bidang['cipta-karya'].componentsFilled).toBe(313);
    expect(report.bidang['cipta-karya'].componentsSkipped).toBe(73);
  });

  it('keeps SDA and Bina Marga component prices at zero', () => {
    expect(report.bidang.sda.matched).toBe(0);
    expect(report.bidang['bina-marga'].matched).toBe(0);
    expect(componentPrices(ahspItemsSda).every((price) => price === 0)).toBe(true);
    expect(componentPrices(ahspItemsBinaMarga).every((price) => price === 0)).toBe(true);
  });

  it('spot-checks sample 1.6.46 portal prices and non-zero HSP', () => {
    const code = '1.6.46';
    expect(report.bidang['cipta-karya'].samples).toContain(code);
    const item = ahspItemsCiptaKarya.find((row) => row.kode_ahsp === code);
    expect(item).toBeDefined();
    // Portal labor unit prices for this kode (nama fallback — national refs are null).
    expect(item!.tenaga_kerja.map((row) => row.harga_satuan_ref)).toEqual([
      13637.1, 14978, 1663.43,
    ]);
    const result = calcHspFixedCoefficient(item!);
    expect(result.grandTotal).toBeGreaterThan(0);
  });
});
