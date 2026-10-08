import { describe, expect, it } from 'vitest';
import { brandHsdRegional } from '../brand-hsd.js';
import { mergeHsdBaseWithRegionalOverlay } from '../merge-hsd.js';

describe('mergeHsdBaseWithRegionalOverlay', () => {
  it('keeps base refs and overlays matching prices only', () => {
    const base = brandHsdRegional({
      version: 'bm',
      region: {
        provinsi: 'Nasional',
        kode_provinsi: '00',
        kabupaten: null,
        tahun_berlaku: 2022,
        kuartal: 1,
        dasar_hukum: 'Permen',
        tanggal_terbit: '2022-01-01',
        verification_tier: 'verified',
        verification_note: 'Permen BM',
      },
      tenaga_kerja: [
        { ref: 'L.01', harga_rp: 100_000, satuan: 'OH', sumber_data: 'permen' },
        { ref: 'L.99', harga_rp: 50_000, satuan: 'OH', sumber_data: 'permen' },
      ],
      bahan: [{ ref: 'M.01', nama: 'Agregat', harga_rp: 10_000, satuan: 'm3', sumber_data: 'permen' }],
      peralatan_sewa: [
        { ref: 'E.09', nama: 'Dump Truck 10T', harga_rp: 692_885, satuan: 'jam', sumber_data: 'permen' },
        { ref: 'E.08', nama: 'Dump Truck 12T', harga_rp: 500_000, satuan: 'jam', sumber_data: 'permen' },
      ],
      bahan_bakar: {
        solar_industri_rp_per_liter: 6800,
        oli_mesin_rp_per_liter: 45000,
        oli_hidrolik_rp_per_liter: 55000,
        grease_rp_per_kg: 60000,
      },
    });

    const overlay = brandHsdRegional({
      version: 'kaltim',
      region: {
        provinsi: 'Kalimantan Timur',
        kode_provinsi: '64',
        kabupaten: null,
        tahun_berlaku: 2025,
        kuartal: 1,
        dasar_hukum: 'HSD Kaltim',
        tanggal_terbit: '2025-01-01',
        verification_tier: 'verified',
        verification_note: 'HSD Kaltim',
      },
      tenaga_kerja: [{ ref: 'L.01', harga_rp: 200_000, satuan: 'OH', sumber_data: 'kaltim' }],
      bahan: [],
      peralatan_sewa: [
        { ref: 'E.08', nama: 'Dump Truck 12T', harga_rp: 285_000, satuan: 'jam', sumber_data: 'kaltim' },
      ],
      bahan_bakar: {
        solar_industri_rp_per_liter: 7000,
        oli_mesin_rp_per_liter: 46000,
        oli_hidrolik_rp_per_liter: 56000,
        grease_rp_per_kg: 61000,
      },
    });

    const merged = mergeHsdBaseWithRegionalOverlay(base, overlay);
    expect(merged.region.provinsi).toBe('Kalimantan Timur');
    expect(merged.tenaga_kerja.find((r) => r.ref === 'L.01')?.harga_rp).toBe(200_000);
    expect(merged.tenaga_kerja.find((r) => r.ref === 'L.99')?.harga_rp).toBe(50_000);
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.09')?.harga_rp).toBe(692_885);
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.08')?.harga_rp).toBe(285_000);
    expect(merged.bahan_bakar.solar_industri_rp_per_liter).toBe(7000);
  });
});
