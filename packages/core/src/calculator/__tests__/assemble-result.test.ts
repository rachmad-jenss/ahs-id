import { describe, expect, it } from 'vitest';
import { assembleHspResult } from '../assemble-result.js';
import type { AhspGroup } from '../../types/index.js';

function group(type: AhspGroup['type'], total: number): AhspGroup {
  return { type, title: type, components: [], total };
}

describe('assembleHspResult', () => {
  it('adds nested work once and applies a 15% margin', () => {
    const audit: { step: string; detail: string; value?: number; unit?: string }[] = [];
    const result = assembleHspResult({
      kode_ahsp: '1.1',
      nama: 'Uji',
      satuan_bayar: 'm3',
      groups: [group('L', 100), group('M', 50), group('E', 0)],
      subAhsp: [{ ref_ahsp: '1.2', nama: 'Anak', koefisien: 1, unit_price: 10, total_price: 10 }],
      nestedTotal: 10,
      overheadPct: 10,
      profitPct: 5,
      isLumpSum: false,
      warnings: [],
      audit,
    });
    expect(result.baseTotal).toBe(160);
    expect(result.overheadProfitValue).toBe(24);
    expect(result.grandTotal).toBe(184);
    expect(result.groups.reduce((sum, item) => sum + item.total, 0) + result.subAhsp[0]!.total_price).toBe(result.baseTotal);
  });

  it('leaves lump-sum totals unchanged', () => {
    const result = assembleHspResult({
      kode_ahsp: '9.9',
      nama: 'Lump',
      satuan_bayar: 'ls',
      groups: [group('L', 80), group('M', 0), group('E', 0)],
      subAhsp: [],
      nestedTotal: 0,
      overheadPct: 10,
      profitPct: 0,
      isLumpSum: true,
      warnings: ['cek'],
      audit: [],
    });
    expect(result.grandTotal).toBe(80);
    expect(result.overheadProfitValue).toBe(0);
    expect(result.warnings).toEqual(['cek']);
  });
});
