import { describe, it, expect } from 'vitest';
import { calcHspFromBundle } from '../bundle-calc.js';
import type { AhspItem, HsdRegional } from '../../types/index.js';

function makeItem(overrides: Partial<AhspItem> = {}): AhspItem {
  return {
    kode_ahsp: '3.1.(1)',
    nama: 'Galian Biasa',
    bidang: 'bina-marga',
    divisi: 3,
    sub_divisi: '3.1',
    satuan_bayar: 'm3',
    volume_state_bayar: 'bank',
    jenis_pekerjaan: 'mekanis',
    is_lump_sum: false,
    sub_ahsp: [],
    tenaga_kerja: [
      { ref: 'L.01', koefisien: 0.01, koef_sumber: 'tabel', catatan: null },
    ],
    bahan: [],
    peralatan: [
      {
        ref: 'E.09',
        nama: 'Dump Truck',
        koef_sumber: 'kalkulasi',
        mode_biaya: 'sewa',
        volume_state: null,
        variabel_input: [],
        koef_referensi: { value: 0.04, asumsi: {} },
        catatan: null,
      },
    ],
    variabel: {},
    margin: {
      overhead_pct: { label: 'Overhead', min: 0, max: 10, default: 10 },
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

const hsd: HsdRegional = {
  version: '1',
  region: {
    provinsi: 'Nasional',
    kode_provinsi: '00',
    kabupaten: null,
    tahun_berlaku: 2022,
    kuartal: 1,
    dasar_hukum: 'test',
    tanggal_terbit: '2022-01-01',
  },
  tenaga_kerja: [
    { ref: 'L.01', satuan: 'OH', harga_rp: 100000, sumber_data: 'test' },
  ],
  bahan: [],
  peralatan_sewa: [],
  bahan_bakar: {
    solar_industri_rp_per_liter: 6800,
    oli_mesin_rp_per_liter: 25000,
    oli_hidrolik_rp_per_liter: 30000,
    grease_rp_per_kg: 45000,
  },
};

describe('calcHspFromBundle', () => {
  it('prices peralatan from the supplied map', () => {
    const result = calcHspFromBundle(makeItem(), hsd, new Map([['E.09', 692885]]));
    const alat = result.groups.find((group) => group.type === 'E');
    expect(alat?.components[0]?.unit_price).toBe(692885);
    expect(alat?.components[0]?.total_price).toBeCloseTo(0.04 * 692885, 6);
    expect(result.baseTotal).toBeCloseTo(0.01 * 100000 + 0.04 * 692885, 6);
  });

  it('throws when an alat price is missing', () => {
    expect(() => calcHspFromBundle(makeItem(), hsd, new Map())).toThrow('HSD peralatan "E.09" not found');
  });

  it('throws when koef_referensi is missing', () => {
    const item = makeItem({
      peralatan: [
        {
          ref: 'E.09',
          nama: 'Dump Truck',
          koef_sumber: 'kalkulasi',
          mode_biaya: 'sewa',
          volume_state: null,
          variabel_input: [],
          koef_referensi: null,
          catatan: null,
        },
      ],
    });
    expect(() => calcHspFromBundle(item, hsd, new Map([['E.09', 692885]]))).toThrow('koef_referensi is required');
  });
});
