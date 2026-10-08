import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calcHspFixedCoefficient } from '@ahs-id/core';
import { ahspItemsCiptaKarya } from '../index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const report = JSON.parse(
  readFileSync(join(root, 'data/dcktrp-price-enrich-report.json'), 'utf8'),
) as {
  bidang: { 'cipta-karya': { matched: number; componentsFilled: number; samples: string[] } };
};

describe('SE47 DCKTRP price enrich', () => {
  it('filled component prices for overlapping CK codes', () => {
    expect(report.bidang['cipta-karya'].matched).toBeGreaterThan(0);
    expect(report.bidang['cipta-karya'].componentsFilled).toBeGreaterThan(0);
  });

  it('spot-checks a DCKTRP-matched CK item yields non-zero HSP', () => {
    const code = report.bidang['cipta-karya'].samples[0] ?? '1.6.46';
    const item = ahspItemsCiptaKarya.find((row) => row.kode_ahsp === code);
    expect(item).toBeDefined();
    const priced = (item!.tenaga_kerja ?? []).some((row) => row.harga_satuan_ref > 0)
      || (item!.bahan ?? []).some((row) => row.harga_satuan_ref > 0);
    expect(priced).toBe(true);
    const result = calcHspFixedCoefficient(item!);
    expect(result.grandTotal).toBeGreaterThan(0);
  });
});
