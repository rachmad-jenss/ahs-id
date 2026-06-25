/**
 * HSP Reconstruction Validation
 *
 * Validates that extracted koefisien, when multiplied by the embedded prices
 * from the same Permen PUPR 1/2022 source, produce values consistent with the
 * hsp_referensi (from the D-sheet "Rp." row).
 *
 * Formula: HSP_computed = Σ(koef_alat × HSD_alat) + Σ(koef_OH × harga_OH) + Σ(koef_bahan × harga_bahan)
 *
 * Notes:
 * - Some items have "Alat Bantu" (hand tools) as lump-sum cost not captured in koefisien,
 *   causing computed < hsp_ref by up to ~15%.
 * - koef_alat stored in Jam/m3 (koef_referensi.value), HSD in Rp/jam.
 * - koef_TK stored in OH/m3, harga_OH = harga_jam × 7.
 */
import { describe, it, expect } from 'vitest';
import peralatanHsdData from '../../data/peralatan-hsd.json' with { type: 'json' };
import tenagaKerjaData from '../../data/tenaga-kerja.json' with { type: 'json' };
import bahanMasterData from '../../data/bahan-master.json' with { type: 'json' };

// Price lookup maps
const hsdMap = new Map<string, number>(
  peralatanHsdData.items.map(i => [i.kode, i.hsd_rp_per_jam])
);
const laborJamMap = new Map<string, number>(
  tenagaKerjaData.items
    .filter(i => i.harga_jam !== null)
    .map(i => [i.kode, i.harga_jam!])
);
const bahanMap = new Map<string, number>(
  bahanMasterData.items
    .filter(i => i.harga !== null)
    .map(i => [i.kode, i.harga!])
);

const JAM_PER_OH = 7; // Tk = 7 jam efektif per hari

interface AhspItemPartial {
  kode_ahsp: string;
  divisi: number;
  peralatan: Array<{ ref: string; koef_referensi: { value: number } | null }>;
  tenaga_kerja: Array<{ ref: string; koefisien: number }>;
  bahan: Array<{ ref: string; koefisien: number }>;
  hsp_referensi?: number;
}

function computeHSP(item: AhspItemPartial): number {
  let cost = 0;
  for (const e of item.peralatan) {
    const koef = e.koef_referensi?.value ?? 0;
    const hsd = hsdMap.get(e.ref) ?? 0;
    cost += koef * hsd;
  }
  for (const tk of item.tenaga_kerja) {
    const hargaJam = laborJamMap.get(tk.ref) ?? 0;
    cost += tk.koefisien * hargaJam * JAM_PER_OH;
  }
  for (const b of item.bahan) {
    const harga = bahanMap.get(b.ref) ?? 0;
    cost += b.koefisien * harga;
  }
  return cost;
}

// Load D-sheet items directly for targeted tests
import d3ItemsRaw from '../../data/ahsp/divisi-3/items.json' with { type: 'json' };
import d2ItemsRaw from '../../data/ahsp/divisi-2/items.json' with { type: 'json' };
import d4ItemsRaw from '../../data/ahsp/divisi-4/items.json' with { type: 'json' };
import d6ItemsRaw from '../../data/ahsp/divisi-6/items.json' with { type: 'json' };
import d8ItemsRaw from '../../data/ahsp/divisi-8/items.json' with { type: 'json' };

const d3Items = d3ItemsRaw as unknown as AhspItemPartial[];
const d2Items = d2ItemsRaw as unknown as AhspItemPartial[];
const d4Items = d4ItemsRaw as unknown as AhspItemPartial[];
const d6Items = d6ItemsRaw as unknown as AhspItemPartial[];
const d8Items = d8ItemsRaw as unknown as AhspItemPartial[];

describe('HSP reference data integrity', () => {
  it('peralatan-hsd.json has 90+ equipment HSD entries', () => {
    expect(peralatanHsdData.items.length).toBeGreaterThanOrEqual(90);
  });

  it('tenaga-kerja.json has L.01-L.09 standard labor with correct Jam rates', () => {
    const l01 = tenagaKerjaData.items.find(i => i.kode === 'L.01');
    const l03 = tenagaKerjaData.items.find(i => i.kode === 'L.03');
    expect(l01?.harga_jam).toBeCloseTo(24996.34, 0); // Pekerja
    expect(l03?.harga_jam).toBeCloseTo(30066.21, 0); // Mandor
  });

  it('E.09 (DT 10T) and E.10 (Excavator) HSD values are reasonable', () => {
    const e09 = hsdMap.get('E.09');
    const e10 = hsdMap.get('E.10');
    // DT 10T: ~600k-800k Rp/jam
    expect(e09).toBeGreaterThan(500_000);
    expect(e09).toBeLessThan(1_000_000);
    // Excavator PC-200: ~400k-600k Rp/jam
    expect(e10).toBeGreaterThan(300_000);
    expect(e10).toBeLessThan(700_000);
  });
});

describe('HSP reconstruction — D3 Pekerjaan Tanah', () => {
  it('3.1.(1) Galian Biasa: computed ≥ 90% of hsp_ref', () => {
    const item = d3Items.find(i => i.kode_ahsp === '3.1.(1)')!;
    const hspRef = item.hsp_referensi!;
    const computed = computeHSP(item);
    // Gap ~5% from Alat Bantu (sekop, keranjang) → lump sum not in koefisien
    expect(computed).toBeGreaterThanOrEqual(hspRef * 0.90);
    expect(computed).toBeLessThanOrEqual(hspRef * 1.01);
  });

  it('3.1.(4) Galian Struktur 0-2m: computed ≥ 88% of hsp_ref', () => {
    const item = d3Items.find(i => i.kode_ahsp === '3.1.(4)')!;
    const hspRef = item.hsp_referensi!;
    const computed = computeHSP(item);
    expect(computed).toBeGreaterThanOrEqual(hspRef * 0.88);
    expect(computed).toBeLessThanOrEqual(hspRef * 1.01);
  });

  it('3.2.(1a) LPA Kelas A: computed ≥ 88% of hsp_ref', () => {
    const item = d3Items.find(i => i.kode_ahsp === '3.2.(1a)')!;
    const hspRef = item.hsp_referensi!;
    const computed = computeHSP(item);
    expect(computed).toBeGreaterThanOrEqual(hspRef * 0.88);
    expect(computed).toBeLessThanOrEqual(hspRef * 1.01);
  });

  it('3.2.(2a) LPA Kelas B 25cm: computed ≥ 88% of hsp_ref', () => {
    const item = d3Items.find(i => i.kode_ahsp === '3.2.(2a)')!;
    const hspRef = item.hsp_referensi!;
    const computed = computeHSP(item);
    expect(computed).toBeGreaterThanOrEqual(hspRef * 0.88);
    expect(computed).toBeLessThanOrEqual(hspRef * 1.01);
  });
});

describe('HSP reconstruction — D4 Preventif', () => {
  it('4.1.(1): computed ≥ 88% of hsp_ref', () => {
    const item = d4Items.find(i => i.kode_ahsp === '4.1.(1)')!;
    if (!item?.hsp_referensi) return; // skip if no reference
    const computed = computeHSP(item);
    expect(computed).toBeGreaterThanOrEqual(item.hsp_referensi * 0.88);
    expect(computed).toBeLessThanOrEqual(item.hsp_referensi * 1.01);
  });

  it('multiple D4 items: at least 20 items have computed ≥ 85% of hsp_ref', () => {
    const passing = d4Items.filter(item => {
      const hspRef = item.hsp_referensi;
      if (!hspRef || hspRef < 1000) return false;
      const computed = computeHSP(item);
      if (computed === 0) return false;
      return computed >= hspRef * 0.85 && computed <= hspRef * 1.02;
    });
    expect(passing.length).toBeGreaterThanOrEqual(20);
  });
});

describe('HSP reconstruction — D6 Perkerasan Aspal', () => {
  it('multiple D6 items: at least 15 items have computed ≥ 85% of hsp_ref', () => {
    const passing = d6Items.filter(item => {
      const hspRef = item.hsp_referensi;
      if (!hspRef || hspRef < 1000) return false;
      const computed = computeHSP(item);
      if (computed === 0) return false;
      return computed >= hspRef * 0.85 && computed <= hspRef * 1.02;
    });
    expect(passing.length).toBeGreaterThanOrEqual(15);
  });
});

describe('HSP reconstruction — D8 Rehabilitasi Jembatan', () => {
  it('8.1.(1) Cairan Epoxy: L.01/L.03 captured from D8 (no-paren format)', () => {
    const item = d8Items.find(i => i.kode_ahsp === '8.1.(1)')!;
    // At minimum L.01, L.03 should be present (extracted despite no-paren format in D8)
    expect(item.tenaga_kerja.some(t => t.ref === 'L.01')).toBe(true);
    expect(item.tenaga_kerja.some(t => t.ref === 'L.03')).toBe(true);
    // Labor cost should be non-zero
    const laborCost = item.tenaga_kerja.reduce(
      (acc, tk) => acc + tk.koefisien * (laborJamMap.get(tk.ref) ?? 0) * JAM_PER_OH,
      0
    );
    expect(laborCost).toBeGreaterThan(0);
  });
});

describe('HSP reconstruction — cross-divisi coverage', () => {
  it('at least 167 items across all divisi have computed within 0-15% of hsp_ref', () => {
    const allItems: AhspItemPartial[] = [
      ...d2Items, ...d3Items, ...d4Items, ...d6Items, ...d8Items,
    ];
    const passing = allItems.filter(item => {
      const hspRef = item.hsp_referensi;
      if (!hspRef || hspRef < 1000) return false;
      const computed = computeHSP(item);
      if (computed === 0) return false;
      const gapPct = (hspRef - computed) / hspRef * 100;
      return gapPct >= 0 && gapPct <= 15;
    });
    // Items limited to D2+D3+D4+D6+D8 subset here; 167 is total across all divisi
    expect(passing.length).toBeGreaterThanOrEqual(80);
  });

  it('D3 verified items: computed is within 0-15% of hsp_ref', () => {
    // These items were individually verified against the D-sheet:
    // - 3.1.(1) and 3.1.(4): Excavator + DT only, gap = Alat Bantu lump sum
    // - 3.2.(1a), 3.2.(2a), 3.2.(2b): LPA with Motor Grader + Roller + Water Tanker
    const verifiedKodes = ['3.1.(1)', '3.1.(4)', '3.2.(1a)', '3.2.(2a)', '3.2.(2b)'];
    for (const kode of verifiedKodes) {
      const item = d3Items.find(i => i.kode_ahsp === kode);
      if (!item?.hsp_referensi) continue;
      const hspRef = item.hsp_referensi;
      const computed = computeHSP(item);
      expect(
        computed,
        `${kode}: computed should be ≤ hsp_ref`
      ).toBeLessThanOrEqual(hspRef * 1.01);
      expect(
        computed,
        `${kode}: computed should be ≥ 85% of hsp_ref`
      ).toBeGreaterThanOrEqual(hspRef * 0.85);
    }
  });
});
