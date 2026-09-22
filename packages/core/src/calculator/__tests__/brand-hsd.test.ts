import { describe, expect, it } from 'vitest';
import { brandHsdRegional } from '../brand-hsd.js';

const region = {
  provinsi: 'Kalimantan Timur',
  kode_provinsi: '64',
  kabupaten: null,
  tahun_berlaku: 2025,
  kuartal: 1,
  dasar_hukum: 'SK',
  tanggal_terbit: '2025-01-01',
};

describe('brandHsdRegional', () => {
  it('brands money and still serializes as plain numbers', () => {
    const branded = brandHsdRegional({
      version: '1',
      region,
      tenaga_kerja: [{ ref: 'L.01', harga_rp: 135_000, satuan: 'OH', sumber_data: 'SK' }],
      bahan: [{ ref: 'M.01', nama: 'Pasir', harga_rp: 1000, satuan: 'm3', sumber_data: 'SK' }],
      peralatan_sewa: [{ ref: 'E.08', nama: 'Dump Truck', harga_rp: 2000, satuan: 'jam', sumber_data: 'SK' }],
      bahan_bakar: {
        solar_industri_rp_per_liter: 6800,
        oli_mesin_rp_per_liter: 25000,
        oli_hidrolik_rp_per_liter: 30000,
        grease_rp_per_kg: 45000,
      },
    });
    expect(branded.tenaga_kerja[0]?.harga_rp).toBe(135_000);
    expect(JSON.parse(JSON.stringify(branded.bahan_bakar))).toEqual({
      solar_industri_rp_per_liter: 6800,
      oli_mesin_rp_per_liter: 25000,
      oli_hidrolik_rp_per_liter: 30000,
      grease_rp_per_kg: 45000,
    });
  });

  it('rejects a non-finite price and a wrong labour unit', () => {
    const base = {
      version: '1',
      region,
      tenaga_kerja: [{ ref: 'L.01', harga_rp: 1, satuan: 'OH', sumber_data: 'SK' }],
      bahan: [],
      peralatan_sewa: [],
      bahan_bakar: {
        solar_industri_rp_per_liter: 1,
        oli_mesin_rp_per_liter: 1,
        oli_hidrolik_rp_per_liter: 1,
        grease_rp_per_kg: 1,
      },
    };
    expect(() => brandHsdRegional({
      ...base,
      tenaga_kerja: [{ ref: 'L.01', harga_rp: Number.POSITIVE_INFINITY, satuan: 'OH', sumber_data: 'SK' }],
    })).toThrow(/finite/);
    expect(() => brandHsdRegional({
      ...base,
      tenaga_kerja: [{ ref: 'L.01', harga_rp: 1, satuan: 'jam', sumber_data: 'SK' }],
    })).toThrow(/satuan must be OH/);
  });
});
