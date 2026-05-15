import { describe, it, expect } from 'vitest';
import { createCalculator, validateBundle } from '@ahs-id/core';
import { bundle } from '@ahs-id/pupr-2023';
import { hsd } from '@ahs-id/hsd-kaltim-2025';

describe('validateBundle', () => {
  it('pupr-2023 + kaltim HSD passes validation', () => {
    const report = validateBundle(bundle, hsd);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});

describe('HSP golden tests', () => {
  const calc = createCalculator(bundle, hsd);

  describe('3.2.1 Lapis Pondasi Agregat Kelas A', () => {
    it('produces HSP with default variabel and 25km quarry distance', () => {
      const result = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 25,
        jarak_sumber_air_km: 8,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      expect(result.kode_ahsp).toBe('3.2.1');
      expect(result.satuan_bayar).toBe('m3');
      expect(result.groups).toHaveLength(3);

      expect(result.groups[0]!.type).toBe('L');
      expect(result.groups[1]!.type).toBe('M');
      expect(result.groups[2]!.type).toBe('E');

      expect(result.baseTotal).toBeGreaterThan(0);
      expect(result.grandTotal).toBeGreaterThan(result.baseTotal);
      expect(result.overheadPct).toBe(10);
      expect(result.profitPct).toBe(5);

      // TK: L.01 × 0.065 × 135000 + L.04 × 0.007 × 210000
      const tkExpected = 0.065 * 135000 + 0.007 * 210000;
      expect(result.groups[0]!.total).toBeCloseTo(tkExpected, 0);

      // Bahan: M.09.a × 1.025 × 425000
      const bahanExpected = 1.025 * 425000;
      expect(result.groups[1]!.total).toBeCloseTo(bahanExpected, 0);

      // Grand total = baseTotal × 1.15 (10% overhead + 5% profit)
      expect(result.grandTotal).toBeCloseTo(result.baseTotal * 1.15, 0);

      // Audit trail should have entries
      expect(result.audit_trail.length).toBeGreaterThan(10);
    });

    it('HSP increases with longer quarry distance', () => {
      const result10 = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 10,
        jarak_sumber_air_km: 5,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      const result50 = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 50,
        jarak_sumber_air_km: 5,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      expect(result50.grandTotal).toBeGreaterThan(result10.grandTotal);
    });

    it('uses Fpr berat when kondisi_operasi=berat', () => {
      const normal = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 25,
        jarak_sumber_air_km: 8,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      const berat = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 25,
        jarak_sumber_air_km: 8,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'berat',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      expect(berat.grandTotal).toBeGreaterThan(normal.grandTotal);
    });
  });

  describe('3.1.1 Galian Biasa', () => {
    it('produces HSP with 10km disposal distance', () => {
      const result = calc.hitungHSP('3.1.1', {
        jarak_buang_km: 10,
        kondisi_jalan: 'sedang',
        jenis_material: 'tanah_biasa',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
      });

      expect(result.kode_ahsp).toBe('3.1.1');
      expect(result.satuan_bayar).toBe('m3');

      // TK: L.01 × 0.075 × 135000 + L.04 × 0.025 × 210000
      const tkExpected = 0.075 * 135000 + 0.025 * 210000;
      expect(result.groups[0]!.total).toBeCloseTo(tkExpected, 0);

      // No bahan for galian biasa
      expect(result.groups[1]!.total).toBe(0);

      // Peralatan group should have 2 entries (E.01 + E.08)
      expect(result.groups[2]!.components).toHaveLength(2);

      expect(result.grandTotal).toBeCloseTo(result.baseTotal * 1.15, 0);
    });

    it('sensitivity: 50km disposal costs more than 10km', () => {
      const result10 = calc.hitungHSP('3.1.1', {
        jarak_buang_km: 10,
        kondisi_jalan: 'sedang',
        jenis_material: 'tanah_biasa',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
      });

      const result50 = calc.hitungHSP('3.1.1', {
        jarak_buang_km: 50,
        kondisi_jalan: 'sedang',
        jenis_material: 'tanah_biasa',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
      });

      expect(result50.grandTotal).toBeGreaterThan(result10.grandTotal);

      // DT coefficient should be proportionally higher for 50km
      const dtCoef10 = result10.groups[2]!.components.find((c) => c.ref === 'E.08')!.coefficient;
      const dtCoef50 = result50.groups[2]!.components.find((c) => c.ref === 'E.08')!.coefficient;
      expect(dtCoef50).toBeGreaterThan(dtCoef10 * 2);
    });
  });

  describe('volume state conversion chain', () => {
    it('3.2.1 equipment coefficients account for volume state differences', () => {
      const result = calc.hitungHSP('3.2.1', {
        jarak_quarry_km: 25,
        jarak_sumber_air_km: 8,
        kondisi_jalan: 'sedang',
        jenis_material: 'agregat_kelas_a',
        faktor_efisiensi: 0.83,
        kondisi_operasi: 'normal',
        tebal_hamparan_m: 0.20,
        jumlah_passing: 6,
        lebar_hamparan_m: 3.0,
        jumlah_lintasan: 6,
      });

      // E.11 WL outputs loose, AHSP pays compacted → needs conversion
      // E.08 DT outputs loose, AHSP pays compacted → needs conversion
      // E.22 VR outputs compacted, AHSP pays compacted → no conversion
      const volumeAuditEntries = result.audit_trail.filter(
        (a) => a.step === 'volume_conversion',
      );
      expect(volumeAuditEntries.length).toBeGreaterThan(0);
    });
  });
});
