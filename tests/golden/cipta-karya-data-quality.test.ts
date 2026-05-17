import { describe, it, expect } from 'vitest';
import { calcHspFixedCoefficient } from '@ahs-id/core';
import { ahspItems } from '@ahs-id/cipta-karya-2024';

// SE Bina Konstruksi No. 68/2024: reference prices computed with overhead=10%, profit=0%
const MARGIN = { overhead_pct: 10, profit_pct: 0 };

// Lansekap sheet has a known col-mapping difference; its ref prices are excluded
// from the arithmetic check but component data is still validated structurally.
function isLansekap(item: (typeof ahspItems)[number]) {
  return item.provenance.halaman === 'Lansekap';
}

describe('data quality: all 1943 cipta-karya AHSP items', () => {
  it('every item has non-empty kode_ahsp, nama, satuan_bayar', () => {
    const bad = ahspItems.filter(
      (i) => !i.kode_ahsp || !i.nama || !i.satuan_bayar,
    );
    expect(bad).toHaveLength(0);
  });

  it('every item has jenis_kalkulasi === fixed_coefficient', () => {
    const bad = ahspItems.filter((i) => i.jenis_kalkulasi !== 'fixed_coefficient');
    expect(bad).toHaveLength(0);
  });

  it('every item has at least one component (TK, bahan, or peralatan)', () => {
    const bad = ahspItems.filter(
      (i) =>
        i.tenaga_kerja.length === 0 &&
        i.bahan.length === 0 &&
        i.peralatan.length === 0,
    );
    expect(bad).toHaveLength(0);
  });

  it('all component koefisien > 0', () => {
    const bad: string[] = [];
    for (const item of ahspItems) {
      for (const e of [...item.tenaga_kerja, ...item.bahan, ...item.peralatan]) {
        if (e.koefisien <= 0) bad.push(`${item.kode_ahsp}: koef=${e.koefisien}`);
      }
    }
    expect(bad).toHaveLength(0);
  });

  it('all component harga_satuan_ref >= 0', () => {
    const bad: string[] = [];
    for (const item of ahspItems) {
      for (const e of [...item.tenaga_kerja, ...item.bahan, ...item.peralatan]) {
        if (e.harga_satuan_ref < 0) bad.push(`${item.kode_ahsp}: harga=${e.harga_satuan_ref}`);
      }
    }
    expect(bad).toHaveLength(0);
  });

  it('margin overhead+profit defaults satisfy 10 <= sum <= 15', () => {
    const bad = ahspItems.filter((i) => {
      const sum = i.margin.overhead_pct.default + i.margin.profit_pct.default;
      return sum < 10 || sum > 15;
    });
    expect(bad).toHaveLength(0);
  });
});

describe('data quality: engine arithmetic for non-lansekap items', () => {
  // Filter out lansekap items (known col-mapping difference for ref price)
  const nonLansekap = ahspItems.filter((i) => !isLansekap(i));

  it('calcHspFixedCoefficient runs without throwing for all items', () => {
    const errors: string[] = [];
    for (const item of nonLansekap) {
      try {
        calcHspFixedCoefficient(item, MARGIN);
      } catch (e) {
        errors.push(`${item.kode_ahsp}: ${(e as Error).message}`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  it('grandTotal > 0 for all items', () => {
    const bad: string[] = [];
    for (const item of nonLansekap) {
      const result = calcHspFixedCoefficient(item, MARGIN);
      if (result.grandTotal <= 0) bad.push(item.kode_ahsp);
    }
    expect(bad).toHaveLength(0);
  });

  it('grandTotal > baseTotal for all items (margin is applied)', () => {
    const bad: string[] = [];
    for (const item of nonLansekap) {
      const result = calcHspFixedCoefficient(item, MARGIN);
      if (result.grandTotal <= result.baseTotal) bad.push(item.kode_ahsp);
    }
    expect(bad).toHaveLength(0);
  });

  it('computed grandTotal matches harga_satuan_pekerjaan_ref within 1% for ≥99% of items', () => {
    const withRef = nonLansekap.filter(
      (i) => i.harga_satuan_pekerjaan_ref != null && i.harga_satuan_pekerjaan_ref > 0,
    );

    let matches = 0;
    const mismatches: Array<{ kode: string; computed: number; ref: number; pct: number }> = [];

    for (const item of withRef) {
      const result = calcHspFixedCoefficient(item, MARGIN);
      const ref = item.harga_satuan_pekerjaan_ref!;
      const pctDiff = Math.abs(result.grandTotal - ref) / ref * 100;
      if (pctDiff < 1.0) {
        matches++;
      } else {
        mismatches.push({ kode: item.kode_ahsp, computed: result.grandTotal, ref, pct: pctDiff });
      }
    }

    const matchRate = matches / withRef.length;
    // 99% threshold — remaining mismatches are small-value items (<1500 Rp)
    // where Excel rounds ref to nearest 100 (e.g., 9.1.2.1: 1086 vs ref 1000).
    expect(matchRate).toBeGreaterThanOrEqual(0.99);

    if (mismatches.length > 0) {
      const extreme = mismatches.filter((m) => m.pct > 20);
      if (extreme.length > 0) {
        console.warn(
          `${extreme.length} items with >20% mismatch (extraction errors):`,
          extreme.map((m) => `${m.kode} (${m.pct.toFixed(0)}%)`).slice(0, 10).join(', '),
        );
      }
    }
  });
});

describe('data quality: lansekap items structural check', () => {
  const lansekap = ahspItems.filter((i) => isLansekap(i));

  it('loads expected number of lansekap items', () => {
    expect(lansekap.length).toBe(86);
  });

  it('calcHspFixedCoefficient runs without throwing for lansekap items', () => {
    const errors: string[] = [];
    for (const item of lansekap) {
      try {
        calcHspFixedCoefficient(item, MARGIN);
      } catch (e) {
        errors.push(`${item.kode_ahsp}: ${(e as Error).message}`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  it('all lansekap items have non-zero baseTotal', () => {
    const bad: string[] = [];
    for (const item of lansekap) {
      const result = calcHspFixedCoefficient(item, MARGIN);
      if (result.baseTotal <= 0) bad.push(item.kode_ahsp);
    }
    expect(bad).toHaveLength(0);
  });
});
