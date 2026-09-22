import { describe, expect, it } from 'vitest';
import type { DataBundle, HsdRegional } from '../../types/index.js';
import { validateBundle } from '../validate-bundle.js';

function item(kode: string) {
  return {
    kode_ahsp: kode,
    tenaga_kerja: [{ ref: 'L.01', koefisien: 1 }],
    bahan: [{ ref: 'M.01', koefisien: 1 }],
    peralatan: [{ ref: 'E.01', mode_biaya: 'ownership', volume_state: null }],
    sub_ahsp: [],
    volume_state_bayar: 'bank',
    margin: { overhead_pct: { default: 10 }, profit_pct: { default: 5 } },
    provenance: {
      sumber_regulasi: 'test',
      halaman: '1',
      verification_tier: 'verified',
    },
  };
}

function bundle(items: ReturnType<typeof item>[]): DataBundle {
  return {
    tenaga_kerja: { items: [{ kode: 'L.01' }] },
    bahan: { items: [{ kode: 'M.01' }] },
    peralatan: { items: [{ kode: 'E.01' }] },
    faktor_konversi: { items: [] },
    ahsp_items: items,
  } as unknown as DataBundle;
}

function hsd(overrides?: {
  tenaga?: string[];
  bahan?: string[];
  sewa?: string[];
}): HsdRegional {
  return {
    tenaga_kerja: (overrides?.tenaga ?? ['L.01']).map((ref) => ({ ref })),
    bahan: (overrides?.bahan ?? ['M.01']).map((ref) => ({ ref })),
    peralatan_sewa: (overrides?.sewa ?? ['E.01']).map((ref) => ({ ref })),
  } as unknown as HsdRegional;
}

describe('validateBundle duplicate keys', () => {
  it('accepts unique AHSP and HSD refs', () => {
    const report = validateBundle(bundle([item('1.1')]), hsd());
    expect(report.errors.map((error) => error.code)).not.toContain('DUPLICATE_AHSP');
    expect(report.errors.map((error) => error.code)).not.toContain('DUPLICATE_HSD_REF');
  });

  it('reports a repeated AHSP code and repeated HSD refs', () => {
    const report = validateBundle(
      bundle([item('1.1'), item('1.1')]),
      hsd({ tenaga: ['L.01', 'L.01'], bahan: ['M.01', 'M.01'], sewa: ['E.01', 'E.01'] }),
    );
    expect(report.valid).toBe(false);
    expect(report.errors.filter((error) => error.code === 'DUPLICATE_AHSP')).toHaveLength(1);
    expect(report.errors.filter((error) => error.code === 'DUPLICATE_HSD_REF')).toHaveLength(3);
    expect(report.errors.some((error) => error.message.includes('Duplicate key "1.1"'))).toBe(true);
  });
});
