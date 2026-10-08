import { describe, expect, it } from 'vitest';
import { brandHsdRegional } from '../brand-hsd.js';
import { mergeHsdBaseWithRegionalOverlay } from '../merge-hsd.js';

describe('mergeHsdBaseWithRegionalOverlay', () => {
  it('overlays only when ref+nama+satuan match; keeps base otherwise', () => {
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
        { ref: 'L.04', harga_rp: 210_464, satuan: 'OH', sumber_data: 'permen' },
      ],
      bahan: [
        { ref: 'M.01', nama: 'Pasir (umum)', harga_rp: 254_600, satuan: 'M3', sumber_data: 'permen' },
        {
          ref: 'M.99',
          nama: 'Agregat kasar',
          harga_rp: 10_000,
          satuan: 'm3',
          sumber_data: 'permen',
        },
      ],
      peralatan_sewa: [
        {
          ref: 'E.01',
          nama: 'ASPHALT MIXING PLANT',
          harga_rp: 9_947_497,
          satuan: 'jam',
          sumber_data: 'permen',
        },
        {
          ref: 'E.09',
          nama: 'DUMP TRUCK 10 TON (6-8 M3)',
          harga_rp: 692_885,
          satuan: 'jam',
          sumber_data: 'permen',
        },
        {
          ref: 'E.50',
          nama: 'Dump Truck 12T',
          harga_rp: 500_000,
          satuan: 'jam',
          sumber_data: 'permen',
        },
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
      // Same L.* codes ≠ same roles across catalogs — labor must stay on base.
      tenaga_kerja: [
        { ref: 'L.01', harga_rp: 135_000, satuan: 'OH', sumber_data: 'kaltim' },
        { ref: 'L.04', harga_rp: 210_000, satuan: 'OH', sumber_data: 'kaltim' },
      ],
      bahan: [
        // Same ref, different material + satuan — must NOT overlay.
        {
          ref: 'M.01',
          nama: 'Semen Portland 50 kg',
          harga_rp: 75_000,
          satuan: 'zak',
          sumber_data: 'kaltim',
        },
        // Compatible identity — overlay price only.
        {
          ref: 'M.99',
          nama: 'Agregat kasar',
          harga_rp: 12_500,
          satuan: 'm3',
          sumber_data: 'kaltim',
        },
      ],
      peralatan_sewa: [
        // Same ref+satuan, different machine — must NOT overlay.
        {
          ref: 'E.01',
          nama: 'Excavator PC-200',
          harga_rp: 450_000,
          satuan: 'jam',
          sumber_data: 'kaltim',
        },
        {
          ref: 'E.50',
          nama: 'Dump Truck 12T',
          harga_rp: 285_000,
          satuan: 'jam',
          sumber_data: 'kaltim',
        },
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
    expect(merged.tenaga_kerja.find((r) => r.ref === 'L.01')?.harga_rp).toBe(100_000);
    expect(merged.tenaga_kerja.find((r) => r.ref === 'L.04')?.harga_rp).toBe(210_464);
    expect(merged.bahan.find((r) => r.ref === 'M.01')?.harga_rp).toBe(254_600);
    expect(merged.bahan.find((r) => r.ref === 'M.01')?.nama).toBe('Pasir (umum)');
    expect(merged.bahan.find((r) => r.ref === 'M.99')?.harga_rp).toBe(12_500);
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.01')?.harga_rp).toBe(9_947_497);
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.01')?.nama).toBe('ASPHALT MIXING PLANT');
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.09')?.harga_rp).toBe(692_885);
    expect(merged.peralatan_sewa.find((r) => r.ref === 'E.50')?.harga_rp).toBe(285_000);
    expect(merged.bahan_bakar.solar_industri_rp_per_liter).toBe(7000);
  });
});
