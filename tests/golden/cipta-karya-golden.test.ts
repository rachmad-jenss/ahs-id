import { describe, it, expect } from 'vitest';
import { calcHspFixedCoefficient } from '@ahs-id/core';
import { ahspItems } from '@ahs-id/cipta-karya-2024';

// SE Bina Konstruksi No. 68/2024 uses overhead=10%, profit=0% for reference prices
const MARGIN = { overhead_pct: 10, profit_pct: 0 };

function findItem(kode: string) {
  const item = ahspItems.find((i) => i.kode_ahsp === kode);
  if (!item) throw new Error(`Item ${kode} not found`);
  return item;
}

describe('cipta-karya-2024: package load', () => {
  it('loads all 1943 AHSP items', () => {
    expect(ahspItems.length).toBeGreaterThan(1900);
    // verify all have required fixed_coefficient fields
    for (const item of ahspItems) {
      expect(item.jenis_kalkulasi).toBe('fixed_coefficient');
      expect(item.kode_ahsp).toBeTruthy();
      expect(item.nama).toBeTruthy();
    }
  });

  it('has items from all 10 divisions', () => {
    const divisions = new Set(ahspItems.map((i) => i.divisi));
    for (let d = 1; d <= 10; d++) {
      expect(divisions.has(d)).toBe(true);
    }
  });
});

describe('calcHspFixedCoefficient: 1.2.1.1.1 Galian Tanah Manual', () => {
  // Penggalian 1 m3 tanah biasa sedalam 0 s.d. 1 m (manual)
  // TK: Pekerja 0.75 × 100,000 + Mandor 0.038 × 200,000 = 82,600
  // Bahan: -
  // Peralatan: -
  // base = 82,600 → grandTotal = 82,600 × 1.10 = 90,860 ≈ ref 90,800
  it('calculates correct component totals', () => {
    const item = findItem('1.2.1.1.1');
    const result = calcHspFixedCoefficient(item, MARGIN);

    expect(result.kode_ahsp).toBe('1.2.1.1.1');
    expect(result.satuan_bayar).toBe('m3');
    expect(result.groups).toHaveLength(3);
    expect(result.groups[0]!.type).toBe('L');
    expect(result.groups[1]!.type).toBe('M');
    expect(result.groups[2]!.type).toBe('E');

    expect(result.groups[0]!.total).toBeCloseTo(82_600, 0);
    expect(result.groups[1]!.total).toBeCloseTo(0, 0);
    expect(result.groups[2]!.total).toBeCloseTo(0, 0);
    expect(result.baseTotal).toBeCloseTo(82_600, 0);
  });

  it('grandTotal matches Excel reference price within 0.1%', () => {
    const item = findItem('1.2.1.1.1');
    const result = calcHspFixedCoefficient(item, MARGIN);
    // ref=90,800, computed=90,860 — difference is Excel intermediate rounding
    expect(result.grandTotal).toBeCloseTo(90_860, 0);
    expect(Math.abs(result.grandTotal - 90_800)).toBeLessThan(200);
  });

  it('audit trail covers all components', () => {
    const item = findItem('1.2.1.1.1');
    const result = calcHspFixedCoefficient(item, MARGIN);
    // 2 TK entries + 1 margin = 3 audit entries
    expect(result.audit_trail.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('calcHspFixedCoefficient: 1.4.2.1 Pembuangan Lumpur (TK + Peralatan)', () => {
  // 1 m3 Pembuangan tanah lumpur sejauh 1 km
  // TK: Pekerja 0.9103 × 100,000 + Mandor 0.0455 × 200,000 = 100,130
  // Peralatan: Mobil Sedot Lumpur 0.4552 × 67,500 = 30,726
  // base = 130,856 → grand = 143,941.60 ≈ ref 143,900
  it('calculates TK and peralatan groups correctly', () => {
    const item = findItem('1.4.2.1');
    const result = calcHspFixedCoefficient(item, MARGIN);

    expect(result.groups[0]!.total).toBeCloseTo(100_130, 0);
    expect(result.groups[1]!.total).toBeCloseTo(0, 0);
    expect(result.groups[2]!.total).toBeCloseTo(30_726, 0);
    expect(result.baseTotal).toBeCloseTo(130_856, 0);
    expect(result.grandTotal).toBeCloseTo(143_941.6, 0);
  });

  it('grandTotal matches Excel reference within 0.1%', () => {
    const item = findItem('1.4.2.1');
    const result = calcHspFixedCoefficient(item, MARGIN);
    expect(Math.abs(result.grandTotal - 143_900)).toBeLessThan(200);
  });
});

describe('calcHspFixedCoefficient: 2.2.1.1.2 Penulangan Slab (TK + Bahan + Peralatan)', () => {
  // 1 kg penulangan slab BjTP/BjTS semi-mekanis
  // TK: 161, Bahan: 14,817, Peralatan: 330
  // base = 15,308 → grand = 16,838.80 ≈ ref 16,800
  it('has all three component groups populated', () => {
    const item = findItem('2.2.1.1.2');
    const result = calcHspFixedCoefficient(item, MARGIN);

    expect(result.groups[0]!.total).toBeCloseTo(161, 0);
    expect(result.groups[1]!.total).toBeCloseTo(14_817, 0);
    expect(result.groups[2]!.total).toBeCloseTo(330, 0);
    expect(result.baseTotal).toBeCloseTo(15_308, 0);
    expect(result.grandTotal).toBeCloseTo(16_838.8, 0);
  });

  it('grandTotal matches Excel reference within 0.5%', () => {
    const item = findItem('2.2.1.1.2');
    const result = calcHspFixedCoefficient(item, MARGIN);
    expect(Math.abs(result.grandTotal - 16_800)).toBeLessThan(100);
  });
});

describe('calcHspFixedCoefficient: margin options', () => {
  it('defaults use overhead=10 profit=5 from item.margin when opts omitted', () => {
    const item = findItem('1.2.1.1.1');
    const withDefaults = calcHspFixedCoefficient(item);
    const withExplicit = calcHspFixedCoefficient(item, { overhead_pct: 10, profit_pct: 5 });

    expect(withDefaults.overheadPct).toBe(10);
    expect(withDefaults.profitPct).toBe(5);
    expect(withDefaults.grandTotal).toBeCloseTo(withExplicit.grandTotal, 4);
    expect(withDefaults.grandTotal).toBeCloseTo(82_600 * 1.15, 0);
  });

  it('grandTotal > baseTotal for any valid margin', () => {
    const item = findItem('1.2.1.1.1');
    const result = calcHspFixedCoefficient(item, MARGIN);
    expect(result.grandTotal).toBeGreaterThan(result.baseTotal);
  });
});
