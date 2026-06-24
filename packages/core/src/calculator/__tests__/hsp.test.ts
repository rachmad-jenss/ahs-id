import { describe, it, expect } from 'vitest';
import { createCalculator } from '../hsp.js';
import type { VariabelInput, DataBundle, HsdRegional } from '../../types/index.js';

const testBundle: DataBundle = {
  meta: {
    name: 'test-pupr-2023', version: '1.0.0',
    ahs_meta: {
      permen_nomor: 8, permen_tahun: 2023,
      regulation: 'Permen PUPR 8/2023', supplement: null,
      effective_date: '2023-08-30', supersedes: null,
      bidang: ['bina-marga'], data_source: 'test',
      last_verified: '2026-05-14',
    },
  },
  tenaga_kerja: {
    version: '1',
    items: [
      { kode: 'L.01', nama: 'Pekerja', satuan: 'OH' as const, kualifikasi: 'non-terampil' as const, jam_kerja_nominal: 40, jam_efektif: 7 },
      { kode: 'L.04', nama: 'Mandor', satuan: 'OH' as const, kualifikasi: 'terampil' as const, jam_kerja_nominal: 40, jam_efektif: 7 },
    ],
  },
  bahan: {
    version: '1',
    items: [
      { kode: 'M.01', nama: 'Agregat Kelas A', satuan: 'm3', kategori: 'material' },
      { kode: 'M.02', nama: 'Semen Portland', satuan: 'kg', kategori: 'material' },
    ],
  },
  peralatan: {
    version: '1',
    items: [
      {
        kode: 'E.01', nama: 'Excavator 100 HP', tipe_default: 'tracked',
        daya_hp: 100, berat_operasi_ton: 12, tipe_produksi: 'siklus' as const,
        kapasitas_bucket_m3: 0.8,
        hsd_params: {
          harga_pokok_rp: 850000000, umur_ekonomis_tahun: 5,
          jam_kerja_per_tahun: 2000, nilai_sisa_pct: 10,
          faktor_angsuran: 0.2005, asuransi_pajak_pct: 0.5,
          bahan_bakar_ch: 15, pelumas: {
            mesin: { cp: 0.5, satuan: 'liter/jam' },
            hidrolik: { cp: 0.3, satuan: 'liter/jam' },
            grease: { cp: 0.1, satuan: 'liter/jam' },
          },
          perawatan_pct: 5, perbaikan_pct: 3,
          fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' as const },
        },
        produktivitas_params: {
          faktor_bucket: { tanah_biasa: 1.0, batu_pecah: 0.8 },
          waktu_siklus_menit: 0.45,
          volume_state_output: 'loose',
        },
      },
      {
        kode: 'E.08', nama: 'Dump Truck 12 Ton', tipe_default: 'standard',
        daya_hp: 180, berat_operasi_ton: 8, tipe_produksi: 'siklus' as const,
        kapasitas_m3: 8,
        hsd_params: {
          harga_pokok_rp: 650000000, umur_ekonomis_tahun: 5,
          jam_kerja_per_tahun: 2000, nilai_sisa_pct: 10,
          faktor_angsuran: 0.2005, asuransi_pajak_pct: 0.5,
          bahan_bakar_ch: 12, pelumas: {
            mesin: { cp: 0.4, satuan: 'liter/jam' },
            hidrolik: { cp: 0.2, satuan: 'liter/jam' },
            grease: { cp: 0.05, satuan: 'liter/jam' },
          },
          perawatan_pct: 5, perbaikan_pct: 3,
          fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' as const },
        },
        produktivitas_params: {
          faktor_muatan: { agregat_kelas_a: 0.95, tanah_biasa: 1.0 },
          kecepatan_isi_km_jam: { jalan_baik: 40, jalan_sedang: 30, jalan_rusak: 20 },
          kecepatan_kosong_km_jam: { jalan_baik: 50, jalan_sedang: 40, jalan_rusak: 30 },
          waktu_muat_menit: 2.5, waktu_bongkar_menit: 1.5, waktu_tunggu_menit: 1.0,
          volume_state_output: 'loose',
        },
      },
      {
        kode: 'E.11', nama: 'Wheel Loader 1.5 m3', tipe_default: 'standard',
        daya_hp: 120, berat_operasi_ton: 8, tipe_produksi: 'siklus' as const,
        kapasitas_bucket_m3: 1.5,
        hsd_params: {
          harga_pokok_rp: 550000000, umur_ekonomis_tahun: 5,
          jam_kerja_per_tahun: 2000, nilai_sisa_pct: 10,
          faktor_angsuran: 0.2005, asuransi_pajak_pct: 0.5,
          bahan_bakar_ch: 10, pelumas: {
            mesin: { cp: 0.3, satuan: 'liter/jam' },
            hidrolik: { cp: 0.2, satuan: 'liter/jam' },
            grease: { cp: 0.05, satuan: 'liter/jam' },
          },
          perawatan_pct: 5, perbaikan_pct: 3,
          fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' as const },
        },
        produktivitas_params: {
          faktor_bucket: { agregat_kelas_a: 0.85, tanah_biasa: 0.95 },
          waktu_siklus_menit: 0.50,
          volume_state_output: 'loose',
        },
      },
    ],
  },
  faktor_konversi: {
    version: '1', derivation_rule: 'permen',
    items: [
      { material: 'agregat_kelas_a', bank_to_loose: 1.025, bank_to_compacted: 1.15, berat_jenis_bank_ton_m3: 1.8 },
    ],
  },
  ahsp_items: [
    {
      kode_ahsp: '3.2.1',
      nama: 'Lapis Pondasi Agregat Kelas A',
      bidang: 'bina-marga', divisi: 3, sub_divisi: '3.2',
      satuan_bayar: 'm3', volume_state_bayar: 'bank',
      jenis_pekerjaan: 'mekanis', is_lump_sum: false,
      sub_ahsp: [],
      tenaga_kerja: [
        { ref: 'L.01', koefisien: 0.065, koef_sumber: 'tabel', catatan: null },
        { ref: 'L.04', koefisien: 0.007, koef_sumber: 'tabel', catatan: null },
      ],
      bahan: [
        { ref: 'M.01', koefisien: 1.0, koef_sumber: 'tabel', faktor_kehilangan_pct: 0, volume_state: 'loose', catatan: null },
      ],
      peralatan: [
        { ref: 'E.11', nama: 'Wheel Loader 1.5 m3', koef_sumber: 'kalkulasi', mode_biaya: 'ownership', volume_state: 'loose', variabel_input: ['faktor_efisiensi', 'jenis_material'], koef_referensi: { value: 0.0085, asumsi: { faktor_efisiensi: 0.83, jenis_material: 'agregat_kelas_a' } }, catatan: null },
        { ref: 'E.08', nama: 'Dump Truck 12 Ton', koef_sumber: 'kalkulasi', mode_biaya: 'ownership', volume_state: 'loose', variabel_input: ['jarak_quarry_km', 'kondisi_jalan', 'faktor_efisiensi', 'jenis_material'], koef_referensi: { value: 0.185, asumsi: { jarak_quarry_km: 25, kondisi_jalan: 'sedang', faktor_efisiensi: 0.83, jenis_material: 'agregat_kelas_a' } }, catatan: null },
      ],
      variabel: {
        jarak_quarry_km: { label: 'Jarak Quarry ke Lokasi', satuan: 'km', tipe: 'number', required: true, default: null, min: 0.5, max: 200 },
        kondisi_jalan: { label: 'Kondisi Jalan', tipe: 'enum', options: ['baik', 'sedang', 'rusak'], default: 'sedang' },
        jenis_material: { label: 'Jenis Material', tipe: 'enum', options: ['tanah_biasa', 'agregat_kelas_a'], default: 'agregat_kelas_a' },
        faktor_efisiensi: { label: 'Faktor Efisiensi', tipe: 'number', default: 0.83, min: 0.6, max: 0.9 },
      },
      margin: {
        overhead_pct: { label: 'Overhead', min: 5, max: 12, default: 10 },
        profit_pct: { label: 'Profit', min: 2, max: 10, default: 5 },
        constraint: { rule: 'Sum 10-15%' },
      },
      provenance: { sumber_regulasi: 'PUPR 8/2023', halaman: 'Lampiran III', verification_tier: 'auto-extracted', diverifikasi_oleh: null, tanggal_verifikasi: null },
      catatan_umum: [],
    },
  ],
};

const testHsd: HsdRegional = {
  version: '1',
  region: { provinsi: 'Kalimantan Timur', kode_provinsi: '64', kabupaten: 'Samarinda', tahun_berlaku: 2025, kuartal: 1, dasar_hukum: 'SK Gubernur 2025', tanggal_terbit: '2025-01-01' },
  periode: { tahun: 2025, kuartal: 1 },
  tenaga_kerja: [
    { ref: 'L.01', satuan: 'OH' as const, harga_rp: 135000, sumber_data: 'SK Gubernur 2025' },
    { ref: 'L.04', satuan: 'OH' as const, harga_rp: 210000, sumber_data: 'SK Gubernur 2025' },
    { ref: 'L.05', satuan: 'OH' as const, harga_rp: 225000, sumber_data: 'SK Gubernur 2025' },
    { ref: 'L.06', satuan: 'OH' as const, harga_rp: 175000, sumber_data: 'SK Gubernur 2025' },
  ],
  bahan: [
    { ref: 'M.01', nama: 'Agregat Kelas A', satuan: 'm3', harga_rp: 425000, sumber_data: 'SK Gubernur 2025' },
    { ref: 'M.02', nama: 'Semen Portland', satuan: 'kg', harga_rp: 1500, sumber_data: 'SK Gubernur 2025' },
  ],
  peralatan_sewa: [],
  peralatan: [
    { ref: 'E.01', nama: 'Excavator 100 HP', satuan: 'jam' },
    { ref: 'E.08', nama: 'Dump Truck 12 Ton', satuan: 'jam' },
    { ref: 'E.11', nama: 'Wheel Loader 1.5 m3', satuan: 'jam' },
  ],
  bahan_bakar: {
    solar_industri_rp_per_liter: 6800,
    oli_mesin_rp_per_liter: 25000,
    oli_hidrolik_rp_per_liter: 30000,
    grease_rp_per_kg: 45000,
  },
};

const BASE_VARS: VariabelInput = {
  jarak_quarry_km: 25,
  kondisi_jalan: 'sedang',
  jenis_material: 'agregat_kelas_a',
  faktor_efisiensi: 0.83,
};

describe('createCalculator', () => {
  it('creates from valid bundle and HSD', () => {
    const calc = createCalculator(testBundle, testHsd);
    expect(calc).toBeDefined();
    expect(typeof calc.hitungHSP).toBe('function');
  });

  it('throws on unknown AHSP item code', () => {
    const calc = createCalculator(testBundle, testHsd);
    expect(() => calc.hitungHSP('99.99', {})).toThrow('not found in bundle');
  });

  it('throws on missing required variables', () => {
    const calc = createCalculator(testBundle, testHsd);
    expect(() => calc.hitungHSP('3.2.1', {})).toThrow('missing required variabel_input');
  });
});

describe('hitungHSP', () => {
  const calc = createCalculator(testBundle, testHsd);

  it('returns correct result structure', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.kode_ahsp).toBe('3.2.1');
    expect(result.nama).toContain('Lapis Pondasi Agregat');
    expect(result.groups).toHaveLength(3);
    expect(result.grandTotal).toBeGreaterThan(0);
    expect(result.baseTotal).toBeGreaterThan(0);
  });

  it('groups are L, M, E order', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.groups.map(g => g.type)).toEqual(['L', 'M', 'E']);
    expect(result.groups[0].title).toContain('Tenaga Kerja');
    expect(result.groups[1].title).toContain('Bahan');
    expect(result.groups[2].title).toContain('Peralatan');
  });

  it('tenaga kerja has correct totals', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    const tk = result.groups[0];
    expect(tk.components).toHaveLength(2);
    for (const c of tk.components) {
      expect(c.total_price).toBe(c.coefficient * c.unit_price);
    }
    expect(tk.total).toBe(tk.components.reduce((s, c) => s + c.total_price, 0));
  });

  it('bahan uses raw koefisien from item (volume conversion planned)', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    const bahan = result.groups[1];
    // Bahan coefficient = raw koefisien (1.0) — volume conversion
    // belum diimplementasi untuk bahan, hanya untuk peralatan
    expect(bahan.components[0].coefficient).toBe(1.0);
  });

  it('peralatan uses productivity formulas', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    const alat = result.groups[2];
    const wl = alat.components.find(c => c.ref === 'E.11');
    expect(wl).toBeDefined();
    expect(wl!.coefficient).toBeGreaterThan(0);
    const dt = alat.components.find(c => c.ref === 'E.08');
    expect(dt).toBeDefined();
    expect(dt!.coefficient).toBeGreaterThan(0);
  });

  it('margin is between 10-15%', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.overheadPct + result.profitPct).toBe(15);
  });

  it('grand total = base + overhead + profit', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    const marginAmt = result.baseTotal * ((result.overheadPct + result.profitPct) / 100);
    expect(result.grandTotal).toBeCloseTo(result.baseTotal + marginAmt, -1);
  });

  it('generates audit trail with all step types', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.audit_trail.length).toBeGreaterThan(5);
    const steps = result.audit_trail.map(a => a.step);
    expect(steps.some(s => s.includes('tenaga_kerja'))).toBe(true);
    expect(steps.some(s => s.includes('bahan'))).toBe(true);
    expect(steps.some(s => s.startsWith('produktivitas'))).toBe(true);
    expect(steps.some(s => s.includes('volume'))).toBe(true);
  });

  it('no warnings for valid input', () => {
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.warnings).toHaveLength(0);
  });

  it('is deterministic', () => {
    const r1 = calc.hitungHSP('3.2.1', BASE_VARS);
    const r2 = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(r1.grandTotal).toBe(r2.grandTotal);
    expect(r1.audit_trail).toEqual(r2.audit_trail);
  });
});

describe('estimasi-kasar mode', () => {
  it('falls back with warnings on partial input', () => {
    const calc = createCalculator(testBundle, testHsd, { mode: 'estimasi-kasar' });
    // Only provide jarak_quarry_km — E.08 (DT) needs it but E.11 (WL) doesn't.
    // Without faktor_efisiensi, both peralatan fall back to koef_referensi.
    const partial: VariabelInput = {
      jarak_quarry_km: 25,
      kondisi_jalan: 'sedang',
      jenis_material: 'agregat_kelas_a',
    };
    const result = calc.hitungHSP('3.2.1', partial);
    expect(result.grandTotal).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    result.warnings.forEach(w => expect(w).toContain('estimasi-kasar'));
  });
});

describe('error handling', () => {
  it('throws when HSD tenaga_kerja ref not found', () => {
    const badHsd: HsdRegional = { ...testHsd, version: '1', tenaga_kerja: [], peralatan_sewa: [] };
    const calc = createCalculator(testBundle, badHsd);
    expect(() => calc.hitungHSP('3.2.1', BASE_VARS)).toThrow('HSD tenaga kerja');
  });

  it('throws when HSD bahan ref not found', () => {
    const badHsd: HsdRegional = {
      ...testHsd, version: '1',
      tenaga_kerja: testHsd.tenaga_kerja,
      bahan: [], peralatan_sewa: [],
    };
    const calc = createCalculator(testBundle, badHsd);
    expect(() => calc.hitungHSP('3.2.1', BASE_VARS)).toThrow('HSD bahan');
  });
});

describe('HSD staleness warnings', () => {
  it('warns when HSD is older than threshold', () => {
    const oldHsd: HsdRegional = {
      ...testHsd, version: '1',
      region: { ...testHsd.region, tanggal_terbit: '2020-01-01' },
    };
    const calc = createCalculator(testBundle, oldHsd, { hsd_staleness_warning_days: 1 });
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('HSD');
    expect(result.warnings[0]).toContain('days old');
  });

  it('does not warn when staleness check is disabled', () => {
    const oldHsd: HsdRegional = {
      ...testHsd, version: '1',
      region: { ...testHsd.region, tanggal_terbit: '2020-01-01' },
    };
    const calc = createCalculator(testBundle, oldHsd);
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn for recent HSD', () => {
    const freshHsd: HsdRegional = {
      ...testHsd, version: '1',
      region: { ...testHsd.region, tanggal_terbit: new Date().toISOString().split('T')[0] },
    };
    const calc = createCalculator(testBundle, freshHsd, { hsd_staleness_warning_days: 365 * 10 });
    const result = calc.hitungHSP('3.2.1', BASE_VARS);
    expect(result.warnings).toHaveLength(0);
  });
});
