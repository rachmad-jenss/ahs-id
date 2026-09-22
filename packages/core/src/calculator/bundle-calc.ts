import type {
  AhspItem,
  HSPResult,
  AuditEntry,
  HsdRegional,
} from '../types/index.js';
import { assembleHspResult, type PricedComponent, type PricedGroup } from './assemble-result.js';
import { brandHsdRegional } from './brand-hsd.js';

/**
 * Calculate HSP for items that carry pre-computed koef_referensi
 * and use external HSD price lookups (bina-marga-2022 style).
 *
 * Unlike createCalculator (which requires alat master data with hsd_params
 * and produktivitas_params for dynamic computation), this function:
 * - Uses koef_referensi.value for peralatan coefficients
 * - Looks up HSD prices from the provided HSD regional data
 * - Does NOT require alat master data or productivity formulas
 *
 * Best for regulation bundles where coefficients are pre-calculated
 * and stored in koef_referensi (e.g. Permen PUPR 1/2022).
 *
 * @deprecated Prefer `createCalculator` for bundles that expose a `DataBundle`.
 * This entry point remains for callers that already hold a precomputed item.
 */
export function calcHspFromBundle(
  item: AhspItem,
  hsd: HsdRegional,
  alatPrices: Map<string, number>,
  opts?: { overhead_pct?: number; profit_pct?: number },
): HSPResult {
  const pricedHsd = brandHsdRegional(hsd);
  const audit: AuditEntry[] = [];
  const warnings: string[] = [];

  const tkComponents = calcTk(item, pricedHsd, audit);
  const bahanComponents = calcBahan(item, pricedHsd, audit);
  const alatComponents = calcAlat(item, alatPrices, audit);

  const tkGroup: PricedGroup = {
    type: 'L', title: 'Tenaga Kerja',
    components: tkComponents,
    total: tkComponents.reduce((s, c) => s + c.total_price, 0),
  };
  const bahanGroup: PricedGroup = {
    type: 'M', title: 'Bahan',
    components: bahanComponents,
    total: bahanComponents.reduce((s, c) => s + c.total_price, 0),
  };
  const alatGroup: PricedGroup = {
    type: 'E', title: 'Peralatan',
    components: alatComponents,
    total: alatComponents.reduce((s, c) => s + c.total_price, 0),
  };

  const overheadPct = opts?.overhead_pct ?? item.margin.overhead_pct.default;
  const profitPct = opts?.profit_pct ?? item.margin.profit_pct.default;
  return assembleHspResult({
    kode_ahsp: item.kode_ahsp,
    nama: item.nama,
    satuan_bayar: item.satuan_bayar,
    groups: [tkGroup, bahanGroup, alatGroup],
    subAhsp: [],
    nestedTotal: 0,
    overheadPct,
    profitPct,
    isLumpSum: item.is_lump_sum,
    warnings,
    audit,
  });
}

function calcTk(item: AhspItem, hsd: HsdRegional, audit: AuditEntry[]): PricedComponent[] {
  return item.tenaga_kerja.map((tk) => {
    const hsdEntry = hsd.tenaga_kerja.find((h) => h.ref === tk.ref);
    if (!hsdEntry) {
      throw new Error(`HSD tenaga kerja "${tk.ref}" not found`);
    }
    const total = tk.koefisien * hsdEntry.harga_rp;
    audit.push({
      step: 'hsp_tenaga_kerja',
      detail: `${tk.ref}: ${tk.koefisien} × ${hsdEntry.harga_rp} = ${total.toFixed(0)}`,
      value: total, unit: 'Rp',
    });
    return {
      ref: tk.ref, type: 'L' as const, nama: tk.ref,
      satuan: 'OH', coefficient: tk.koefisien,
      unit_price: hsdEntry.harga_rp, total_price: total,
    };
  });
}

function calcBahan(item: AhspItem, hsd: HsdRegional, audit: AuditEntry[]): PricedComponent[] {
  return item.bahan.map((bahan) => {
    const hsdEntry = hsd.bahan.find((h) => h.ref === bahan.ref);
    if (!hsdEntry) {
      throw new Error(`HSD bahan "${bahan.ref}" not found`);
    }
    const total = bahan.koefisien * hsdEntry.harga_rp;
    audit.push({
      step: 'hsp_bahan',
      detail: `${bahan.ref}: ${bahan.koefisien} × ${hsdEntry.harga_rp} = ${total.toFixed(0)}`,
      value: total, unit: 'Rp',
    });
    return {
      ref: bahan.ref, type: 'M' as const,
      nama: bahan.nama_override ?? hsdEntry.nama,
      satuan: hsdEntry.satuan, coefficient: bahan.koefisien,
      unit_price: hsdEntry.harga_rp, total_price: total,
    };
  });
}

function calcAlat(
  item: AhspItem,
  alatPrices: Map<string, number>,
  audit: AuditEntry[],
): PricedComponent[] {
  return item.peralatan.map((entry) => {
    if (entry.koef_referensi == null) {
      throw new Error(`${entry.ref}: koef_referensi is required for precomputed peralatan`);
    }
    const hsdRp = alatPrices.get(entry.ref);
    if (hsdRp === undefined) {
      throw new Error(`HSD peralatan "${entry.ref}" not found`);
    }
    const koef = entry.koef_referensi.value;

    const total = koef * hsdRp;
    audit.push({
      step: 'hsp_peralatan',
      detail: `${entry.ref}: koef=${koef.toFixed(6)} × ${hsdRp.toFixed(0)} = ${total.toFixed(0)}`,
      value: total, unit: 'Rp',
    });

    return {
      ref: entry.ref, type: 'E' as const, nama: entry.nama,
      satuan: 'jam', coefficient: koef,
      unit_price: hsdRp, total_price: total,
    };
  });
}
