import { describe, it, expect } from 'vitest';
import { hitungHsdPeralatan, hitungHsdPeralatanSewa, hitungHsdPeralatanAny } from '../hsd-peralatan.js';
import type { PeralatanMaster, HsdRegional } from '../../types/index.js';

const excavator: PeralatanMaster = {
  kode: 'E.01',
  nama: 'Excavator',
  tipe_default: 'PC-200',
  kapasitas_bucket_m3: 0.93,
  daya_hp: 138,
  berat_operasi_ton: 20.3,
  tipe_produksi: 'siklus',
  hsd_params: {
    harga_pokok_rp: 1750000000,
    umur_ekonomis_tahun: 5,
    jam_kerja_per_tahun: 2000,
    nilai_sisa_pct: 0.10,
    faktor_angsuran: 0.2638,
    asuransi_pajak_pct: 0.02,
    bahan_bakar_ch: 0.175,
    pelumas: {
      mesin: { cp: 0.0032, satuan: 'liter/HP/jam' },
      hidrolik: { cp: 0.0015, satuan: 'liter/HP/jam' },
      grease: { cp: 0.10, satuan: 'kg/ton/jam', basis: 'berat_operasi' },
    },
    perawatan_pct: 0.065,
    perbaikan_pct: 0.125,
    fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' },
  },
  produktivitas_params: {
    volume_state_output: 'bank',
  },
};

const hsdKaltim: HsdRegional = {
  version: '2025.1.0',
  region: {
    provinsi: 'Kalimantan Timur',
    kode_provinsi: '64',
    kabupaten: null,
    tahun_berlaku: 2025,
    kuartal: 1,
    dasar_hukum: 'SK Gubernur Kaltim',
    tanggal_terbit: '2025-01-15',
  },
  tenaga_kerja: [
    { ref: 'L.05', harga_rp: 195000, satuan: 'OH', sumber_data: 'Survei' },
    { ref: 'L.06', harga_rp: 155000, satuan: 'OH', sumber_data: 'Survei' },
  ],
  bahan: [],
  peralatan_sewa: [
    { ref: 'E.01', nama: 'Excavator PC-200', harga_rp: 450000, satuan: 'jam' as const, sumber_data: 'Survei rental' },
    { ref: 'E.08', nama: 'Dump Truck 12T', harga_rp: 285000, satuan: 'jam' as const, sumber_data: 'Survei rental' },
  ],
  bahan_bakar: {
    solar_industri_rp_per_liter: 18500,
    oli_mesin_rp_per_liter: 65000,
    oli_hidrolik_rp_per_liter: 72000,
    grease_rp_per_kg: 45000,
  },
};

describe('hitungHsdPeralatan', () => {
  it('calculates E.01 Excavator ownership HSD correctly', () => {
    const result = hitungHsdPeralatan(excavator, hsdKaltim);

    // Biaya Pasti
    const B = 1750000000;
    const C = 0.10 * B; // 175_000_000
    const expectedModal = ((B - C) * 0.2638) / 2000; // (1_575_000_000 × 0.2638) / 2000 = 207_742.5
    const expectedAsuransi = (0.02 * B) / 2000; // 17_500

    expect(result.breakdown.biaya_pasti.pengembalian_modal).toBeCloseTo(expectedModal, 1);
    expect(result.breakdown.biaya_pasti.asuransi_pajak).toBeCloseTo(expectedAsuransi, 1);

    // Biaya Operasi
    const expectedBBM = 0.175 * 138 * 18500; // 446_775
    expect(result.breakdown.biaya_operasi.bahan_bakar).toBeCloseTo(expectedBBM, 1);

    const expectedPelumasMesin = 0.0032 * 138 * 65000; // 28_704
    const expectedOliHidrolik = 0.0015 * 138 * 72000; // 14_904
    const expectedGrease = 0.10 * 20.3 * 45000; // 91_350
    expect(result.breakdown.biaya_operasi.pelumas_mesin).toBeCloseTo(expectedPelumasMesin, 1);
    expect(result.breakdown.biaya_operasi.oli_hidrolik).toBeCloseTo(expectedOliHidrolik, 1);
    expect(result.breakdown.biaya_operasi.grease).toBeCloseTo(expectedGrease, 1);

    // Perawatan/Perbaikan (Fpr = 1.0 normal)
    const expectedPerawatan = (0.065 * B * 1.0) / 2000; // 56_875
    const expectedPerbaikan = (0.125 * B * 1.0) / 2000; // 109_375
    expect(result.breakdown.biaya_operasi.perawatan).toBeCloseTo(expectedPerawatan, 1);
    expect(result.breakdown.biaya_operasi.perbaikan).toBeCloseTo(expectedPerbaikan, 1);

    // Operator/Pembantu (divide by jam_efektif = 7, NOT 8)
    const expectedOperator = 195000 / 7; // 27_857.14...
    const expectedPembantu = 155000 / 7; // 22_142.86...
    expect(result.breakdown.biaya_operasi.operator).toBeCloseTo(expectedOperator, 1);
    expect(result.breakdown.biaya_operasi.pembantu_operator).toBeCloseTo(expectedPembantu, 1);

    // Total
    const expectedTotal =
      expectedModal +
      expectedAsuransi +
      expectedBBM +
      expectedPelumasMesin +
      expectedOliHidrolik +
      expectedGrease +
      expectedPerawatan +
      expectedPerbaikan +
      expectedOperator +
      expectedPembantu;

    expect(result.hsd_rp_per_jam).toBeCloseTo(expectedTotal, 0);
  });

  it('applies Fpr for kondisi berat', () => {
    const result = hitungHsdPeralatan(excavator, hsdKaltim, { kondisi_operasi: 'berat' });
    const B = 1750000000;

    const expectedPerawatan = (0.065 * B * 1.2) / 2000;
    const expectedPerbaikan = (0.125 * B * 1.2) / 2000;
    expect(result.breakdown.biaya_operasi.perawatan).toBeCloseTo(expectedPerawatan, 1);
    expect(result.breakdown.biaya_operasi.perbaikan).toBeCloseTo(expectedPerbaikan, 1);
  });

  it('produces audit trail entries', () => {
    const result = hitungHsdPeralatan(excavator, hsdKaltim);
    expect(result.audit.length).toBeGreaterThan(0);
    expect(result.audit.some((a) => a.step === 'hsd_total')).toBe(true);
  });
});

describe('hitungHsdPeralatanSewa', () => {
  it('returns sewa rate from HSD regional data', () => {
    const result = hitungHsdPeralatanSewa('E.01', hsdKaltim);
    expect(result.hsd_rp_per_jam).toBe(450000);
    expect(result.mode).toBe('sewa');
    expect(result.audit).toHaveLength(1);
    expect(result.audit[0]!.step).toBe('hsd_peralatan_sewa');
  });

  it('throws when sewa ref not found', () => {
    expect(() => hitungHsdPeralatanSewa('E.99', hsdKaltim)).toThrow(
      'HSD peralatan sewa "E.99" not found',
    );
  });
});

describe('hitungHsdPeralatanAny', () => {
  it('dispatches to sewa when mode_biaya is sewa', () => {
    const result = hitungHsdPeralatanAny('E.01', excavator, hsdKaltim, {
      mode_biaya: 'sewa',
    });
    expect(result.mode).toBe('sewa');
    expect(result.hsd_rp_per_jam).toBe(450000);
  });

  it('dispatches to ownership when mode_biaya is ownership', () => {
    const result = hitungHsdPeralatanAny('E.01', excavator, hsdKaltim, {
      mode_biaya: 'ownership',
    });
    expect(result.mode).toBe('ownership');
    expect(result.hsd_rp_per_jam).toBeGreaterThan(450000);
  });
});
