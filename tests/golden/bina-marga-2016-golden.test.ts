import { describe, it, expect } from 'vitest';
import { createCalculator, validateBundle } from '@ahs-id/core';
import { bundle } from '@ahs-id/bina-marga-2016';
import { hsd } from '@ahs-id/hsd-kaltim-2025';
import { hsd as hsdJabar } from '@ahs-id/hsd-jabar-2025';
import { hsd as hsdPapua } from '@ahs-id/hsd-papua-2025';

// Tolerance: Rp 1 (rounding dari floating point konversi OH)
const RP_TOLERANCE = 1;

describe('bina-marga-2016 bundle', () => {
  it('loads 23 AHSP items and validates structure', () => {
    expect(bundle.meta.name).toBe('@ahs-id/bina-marga-2016');
    expect(bundle.ahsp_items).toHaveLength(23);
    expect(bundle.tenaga_kerja.items.length).toBeGreaterThan(0);
    expect(bundle.peralatan.items.length).toBeGreaterThan(0);
    expect(bundle.bahan.items.length).toBeGreaterThan(0);
  });

  it('validates against HSD Kaltim without errors', () => {
    const report = validateBundle(bundle, hsd);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});

describe('bina-marga-2016 golden HSP — Kaltim Q1 2025', () => {
  const calc = createCalculator(bundle, hsd);

  // ──────────────────────────────────────────────
  // 3.1 GALIAN
  // ──────────────────────────────────────────────

  describe('3.1.1 Galian Biasa', () => {
    it('produces correct HSP (pre-computed koef, asumsi Excavator PC-200 + DT L=2km)', () => {
      const r = calc.hitungHSP('3.1.1', {});

      expect(r.kode_ahsp).toBe('3.1.1');
      expect(r.satuan_bayar).toBe('m3');
      expect(r.warnings).toHaveLength(0);

      // TK: L.01 × (0.007677/7) × 135000 + L.03 × (0.003838/7) × 135000
      expect(r.groups[0]!.total).toBeCloseTo(250, 0);
      // Bahan: none
      expect(r.groups[1]!.total).toBe(0);
      // Peralatan: E.10 + E.09
      expect(r.groups[2]!.components).toHaveLength(2);
      expect(r.groups[2]!.total).toBeCloseTo(27925, 0);

      expect(r.grandTotal).toBeCloseTo(32401.25, 2);
      expect(r.grandTotal).toBeCloseTo(r.baseTotal * 1.15, 0);
    });
  });

  describe('3.1.3 Galian Batu', () => {
    it('HSP reflects Rock Drill (E.37) + Excavator + DT', () => {
      const r = calc.hitungHSP('3.1.3', {});

      expect(r.kode_ahsp).toBe('3.1.3');
      const refs = r.groups[2]!.components.map((c) => c.ref);
      expect(refs).toContain('E.37');
      expect(refs).toContain('E.10');
      expect(refs).toContain('E.09');

      expect(r.grandTotal).toBeCloseTo(115915.45, 2);
    });
  });

  describe('3.1.7 Galian Perkerasan Beraspal (Cold Milling)', () => {
    it('HSP includes Cold Milling Machine (E.36) and Motor Grader (E.08)', () => {
      const r = calc.hitungHSP('3.1.7', {});

      expect(r.kode_ahsp).toBe('3.1.7');
      const refs = r.groups[2]!.components.map((c) => c.ref);
      expect(refs).toContain('E.36');
      expect(refs).toContain('E.08');

      expect(r.grandTotal).toBeCloseTo(345493.35, 2);
    });
  });

  describe('3.1.8 Galian Perkerasan Beraspal tanpa CMM', () => {
    it('semi-mekanis: high TK koef + only DT equipment', () => {
      const r = calc.hitungHSP('3.1.8', {});

      expect(r.kode_ahsp).toBe('3.1.8');
      // Semi-mekanis: pekerja harian tinggi
      expect(r.groups[0]!.total).toBeGreaterThan(100000);
      expect(r.groups[2]!.components).toHaveLength(1);
      expect(r.groups[2]!.components[0]!.ref).toBe('E.09');

      expect(r.grandTotal).toBeCloseTo(421120.43, 2);
    });
  });

  // ──────────────────────────────────────────────
  // 3.2 TIMBUNAN
  // ──────────────────────────────────────────────

  describe('3.2.1a Timbunan Biasa dari Sumber Galian', () => {
    it('includes M.08 bahan + 4 equipment items', () => {
      const r = calc.hitungHSP('3.2.1a', {});

      expect(r.kode_ahsp).toBe('3.2.1a');
      // Bahan: M.08 × 1.2 × 35000 = 42000
      expect(r.groups[1]!.total).toBeCloseTo(42000, 0);

      const eRefs = r.groups[2]!.components.map((c) => c.ref);
      expect(eRefs).toContain('E.10');
      expect(eRefs).toContain('E.09');
      expect(eRefs).toContain('E.13');
      expect(eRefs).toContain('E.19');

      expect(r.grandTotal).toBeCloseTo(175384.98, 2);
    });
  });

  describe('3.2.2a Timbunan Pilihan dari Sumber Galian', () => {
    it('includes M.09 bahan + Water Tanker (E.17) + Pedestrian Roller (E.23)', () => {
      const r = calc.hitungHSP('3.2.2a', {});

      // Bahan: M.09 × 1.2 × 55000 = 66000
      expect(r.groups[1]!.total).toBeCloseTo(66000, 0);

      const eRefs = r.groups[2]!.components.map((c) => c.ref);
      expect(eRefs).toContain('E.17');
      expect(eRefs).toContain('E.23');

      expect(r.grandTotal).toBeCloseTo(216001.28, 2);
    });
  });

  describe('3.2.3a Timbunan Pilihan Berbutir (bak truk)', () => {
    it('includes M.16 Sirtu', () => {
      const r = calc.hitungHSP('3.2.3a', {});

      // Bahan: M.16 × 1.05 × 185000 = 194250
      expect(r.groups[1]!.total).toBeCloseTo(194250, 0);
      expect(r.grandTotal).toBeCloseTo(344740.19, 2);
    });
  });

  describe('3.2.3b vs 3.2.3a — pengukuran rod and plate lebih mahal', () => {
    it('koef M.16 lebih tinggi (1.155 vs 1.05) dan DT koef lebih tinggi', () => {
      const ra = calc.hitungHSP('3.2.3a', {});
      const rb = calc.hitungHSP('3.2.3b', {});

      expect(rb.grandTotal).toBeGreaterThan(ra.grandTotal);
      // Bahan 3b > 3a karena faktor 1.155 vs 1.05
      expect(rb.groups[1]!.total).toBeGreaterThan(ra.groups[1]!.total);
    });
  });

  // ──────────────────────────────────────────────
  // 3.3 PENYIAPAN
  // ──────────────────────────────────────────────

  describe('3.3.1 Penyiapan Badan Jalan', () => {
    it('satuan m2 — HSP per meter persegi', () => {
      const r = calc.hitungHSP('3.3.1', {});

      expect(r.satuan_bayar).toBe('m2');
      expect(r.groups[1]!.total).toBe(0);
      expect(r.grandTotal).toBeCloseTo(3506.65, 2);
    });
  });

  // ──────────────────────────────────────────────
  // 3.4 PEMOTONGAN POHON
  // ──────────────────────────────────────────────

  describe('3.4 Pemotongan Pohon — skala naik dengan diameter', () => {
    it('HSP meningkat dari 15-30cm → 30-50cm → 50-75cm', () => {
      const r2 = calc.hitungHSP('3.4.2', {}); // 15-30cm
      const r3 = calc.hitungHSP('3.4.3', {}); // 30-50cm
      const r4 = calc.hitungHSP('3.4.4', {}); // 50-75cm

      expect(r3.grandTotal).toBeGreaterThan(r2.grandTotal);
      expect(r4.grandTotal).toBeGreaterThan(r3.grandTotal);
    });

    it('3.4.4 (50-75cm) dan 3.4.5 (>75cm) memiliki equipment mix berbeda', () => {
      // 3.4.4 menggunakan E.08 dgn koef tinggi (0.778 jam/buah)
      // 3.4.5 menggunakan Crane (E.11) + koef E.08 lebih rendah (0.25 jam/buah)
      // → tidak monoton berdasarkan harga Kaltim 2025
      const r4 = calc.hitungHSP('3.4.4', {}); // 50-75cm
      const r5 = calc.hitungHSP('3.4.5', {}); // >75cm

      expect(r4.grandTotal).toBeCloseTo(943597.87, 2);
      expect(r5.grandTotal).toBeCloseTo(548625.22, 2);
    });

    it('3.4.5 (>75cm) menggunakan Crane (E.11)', () => {
      const r = calc.hitungHSP('3.4.5', {});
      const refs = r.groups[2]!.components.map((c) => c.ref);
      expect(refs).toContain('E.11');
      expect(r.grandTotal).toBeCloseTo(548625.22, 2);
    });
  });

  // ──────────────────────────────────────────────
  // FULL SWEEP — semua 23 item harus berhasil tanpa error
  // ──────────────────────────────────────────────

  describe('full sweep — semua 23 item', () => {
    const allKode = [
      '3.1.1','3.1.2','3.1.3','3.1.4','3.1.5','3.1.6',
      '3.1.7','3.1.8','3.1.9','3.1.10',
      '3.2.1a','3.2.1b','3.2.2a','3.2.2b','3.2.3a','3.2.3b','3.2.4',
      '3.3.1',
      '3.4.1','3.4.2','3.4.3','3.4.4','3.4.5',
    ];

    it('seluruh item kalkulasi tanpa error dan grandTotal > 0', () => {
      for (const kode of allKode) {
        const r = calc.hitungHSP(kode, {});
        expect(r.grandTotal, `${kode} grandTotal should be > 0`).toBeGreaterThan(0);
        expect(r.baseTotal, `${kode} baseTotal should be > 0`).toBeGreaterThan(0);
        expect(r.grandTotal, `${kode} grandTotal = baseTotal × 1.15`).toBeCloseTo(r.baseTotal * 1.15, 0);
      }
    });
  });

  // ──────────────────────────────────────────────
  // CROSS-REGION
  // ──────────────────────────────────────────────

  describe('cross-region: Papua > Kaltim > Jabar untuk item yang sama', () => {
    it('3.1.1 Galian Biasa — harga Papua tertinggi', () => {
      const calcJabar = createCalculator(bundle, hsdJabar);
      const calcPapua = createCalculator(bundle, hsdPapua);

      const jabar = calcJabar.hitungHSP('3.1.1', {});
      const kaltim = calc.hitungHSP('3.1.1', {});
      const papua = calcPapua.hitungHSP('3.1.1', {});

      expect(papua.grandTotal).toBeGreaterThan(kaltim.grandTotal);
      expect(kaltim.grandTotal).toBeGreaterThan(jabar.grandTotal);
    });

    it('3.2.1a Timbunan Biasa — bahan + alat keduanya lebih mahal di Papua', () => {
      const calcJabar = createCalculator(bundle, hsdJabar);
      const calcPapua = createCalculator(bundle, hsdPapua);

      const jabar = calcJabar.hitungHSP('3.2.1a', {});
      const papua = calcPapua.hitungHSP('3.2.1a', {});

      // Bahan lebih mahal di Papua
      expect(papua.groups[1]!.total).toBeGreaterThan(jabar.groups[1]!.total);
      // Alat lebih mahal di Papua
      expect(papua.groups[2]!.total).toBeGreaterThan(jabar.groups[2]!.total);
    });
  });
});
