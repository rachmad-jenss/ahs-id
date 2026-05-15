import { describe, it, expect } from 'vitest';
import { resolveSubAhsp } from '../sub-ahsp.js';
import type { AhspItem, FaktorKonversiEntry } from '../../types/index.js';

function makeItem(overrides: Partial<AhspItem> = {}): AhspItem {
  return {
    kode_ahsp: '1.0.0',
    nama: 'Test Item',
    bidang: 'bina-marga',
    divisi: 1,
    sub_divisi: '1.0',
    satuan_bayar: 'm3',
    volume_state_bayar: 'compacted',
    jenis_pekerjaan: 'mekanis',
    is_lump_sum: false,
    sub_ahsp: [],
    tenaga_kerja: [],
    bahan: [],
    peralatan: [],
    variabel: {},
    margin: {
      overhead_pct: { label: 'Overhead', min: 0, max: 15, default: 10 },
      profit_pct: { label: 'Profit', min: 0, max: 5, default: 5 },
      constraint: { rule: 'overhead_pct + profit_pct <= 15' },
    },
    provenance: {
      sumber_regulasi: 'Test',
      halaman: '1',
      diverifikasi_oleh: null,
      tanggal_verifikasi: null,
    },
    catatan_umum: [],
    ...overrides,
  };
}

const fkMap = new Map<string, FaktorKonversiEntry>([
  [
    'agregat_kelas_a',
    {
      material: 'agregat_kelas_a',
      bank_to_loose: 1.20,
      bank_to_compacted: 0.90,
      berat_jenis_bank_ton_m3: 2.2,
    },
  ],
]);

describe('resolveSubAhsp', () => {
  it('returns empty result for items with no sub_ahsp', () => {
    const item = makeItem();
    const result = resolveSubAhsp(item, () => ({ grandTotal: 0 }), fkMap, 'agregat_kelas_a', []);
    expect(result.components).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('resolves single child and computes cost', () => {
    const item = makeItem({
      kode_ahsp: 'parent',
      sub_ahsp: [
        {
          ref_ahsp: 'child',
          nama: 'Child AHSP',
          koefisien: 0.5,
          satuan_koefisien: 'm3',
          satuan_konteks: 'parent',
          volume_state: null,
        },
      ],
    });

    const resolveHsp = (kode: string) => {
      if (kode === 'child') return { grandTotal: 100000 };
      throw new Error(`Unexpected: ${kode}`);
    };

    const result = resolveSubAhsp(item, resolveHsp, fkMap, 'agregat_kelas_a', []);

    expect(result.components).toHaveLength(1);
    expect(result.components[0]!.ref_ahsp).toBe('child');
    expect(result.components[0]!.total_price).toBe(50000);
    expect(result.total).toBe(50000);
    expect(result.audit.some((a) => a.step === 'sub_ahsp_resolve')).toBe(true);
  });

  it('detects circular dependency A → B → A', () => {
    const itemA = makeItem({
      kode_ahsp: 'A',
      sub_ahsp: [
        {
          ref_ahsp: 'B',
          nama: 'Item B',
          koefisien: 1,
          satuan_koefisien: 'm3',
          satuan_konteks: 'parent',
          volume_state: null,
        },
      ],
    });

    const resolveHsp = (_kode: string): { grandTotal: number } => {
      throw new Error('should not reach here');
    };

    expect(() =>
      resolveSubAhsp(itemA, resolveHsp, fkMap, 'agregat_kelas_a', ['B']),
    ).toThrow('Circular sub-AHSP dependency detected: B → A → B');
  });

  it('applies volume conversion when child and parent states differ', () => {
    const item = makeItem({
      kode_ahsp: 'parent',
      volume_state_bayar: 'compacted',
      sub_ahsp: [
        {
          ref_ahsp: 'child',
          nama: 'Child AHSP',
          koefisien: 1.0,
          satuan_koefisien: 'm3',
          satuan_konteks: 'parent',
          volume_state: 'bank',
        },
      ],
    });

    const resolveHsp = () => ({ grandTotal: 100000 });
    const result = resolveSubAhsp(item, resolveHsp, fkMap, 'agregat_kelas_a', []);

    const fk = fkMap.get('agregat_kelas_a')!;
    const expectedFactor = fk.bank_to_compacted!;
    expect(result.components[0]!.unit_price).toBeCloseTo(100000 * expectedFactor, 2);
    expect(result.audit.some((a) => a.step === 'sub_ahsp_volume_conversion')).toBe(true);
  });

  it('sums multiple sub-AHSP entries', () => {
    const item = makeItem({
      kode_ahsp: 'parent',
      sub_ahsp: [
        {
          ref_ahsp: 'child1',
          nama: 'Child 1',
          koefisien: 2.0,
          satuan_koefisien: 'm3',
          satuan_konteks: 'parent',
          volume_state: null,
        },
        {
          ref_ahsp: 'child2',
          nama: 'Child 2',
          koefisien: 0.5,
          satuan_koefisien: 'm3',
          satuan_konteks: 'parent',
          volume_state: null,
        },
      ],
    });

    const resolveHsp = (kode: string) => {
      if (kode === 'child1') return { grandTotal: 50000 };
      if (kode === 'child2') return { grandTotal: 80000 };
      throw new Error(`Unexpected: ${kode}`);
    };

    const result = resolveSubAhsp(item, resolveHsp, fkMap, 'agregat_kelas_a', []);
    expect(result.components).toHaveLength(2);
    expect(result.total).toBe(2.0 * 50000 + 0.5 * 80000);
  });
});
