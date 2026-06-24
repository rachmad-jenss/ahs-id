import type {
  AhspItem,
  AhspComponent,
  AhspGroup,
  HSPResult,
  AuditEntry,
  HsdRegional,
} from '../types/index.js';
import { hitungMargin } from './margin.js';

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
 */
export function calcHspFromBundle(
  item: AhspItem,
  hsd: HsdRegional,
  alatPrices: Map<string, number>,
  opts?: { overhead_pct?: number; profit_pct?: number },
): HSPResult {
  const audit: AuditEntry[] = [];
  const warnings: string[] = [];

  const tkComponents = calcTk(item, hsd, audit);
  const bahanComponents = calcBahan(item, hsd, audit);
  const alatComponents = calcAlat(item, alatPrices, audit, warnings);

  const tkGroup: AhspGroup = {
    type: 'L', title: 'Tenaga Kerja',
    components: tkComponents,
    total: tkComponents.reduce((s, c) => s + c.total_price, 0),
  };
  const bahanGroup: AhspGroup = {
    type: 'M', title: 'Bahan',
    components: bahanComponents,
    total: bahanComponents.reduce((s, c) => s + c.total_price, 0),
  };
  const alatGroup: AhspGroup = {
    type: 'E', title: 'Peralatan',
    components: alatComponents,
    total: alatComponents.reduce((s, c) => s + c.total_price, 0),
  };

  const baseTotal = tkGroup.total + bahanGroup.total + alatGroup.total;

  const overheadPct = opts?.overhead_pct ?? item.margin.overhead_pct.default;
  const profitPct = opts?.profit_pct ?? item.margin.profit_pct.default;

  const marginResult = hitungMargin(baseTotal, { overhead_pct: overheadPct, profit_pct: profitPct }, item.is_lump_sum);
  audit.push(...marginResult.audit);

  return {
    kode_ahsp: item.kode_ahsp,
    nama: item.nama,
    satuan_bayar: item.satuan_bayar,
    groups: [tkGroup, bahanGroup, alatGroup],
    baseTotal,
    overheadPct,
    profitPct,
    overheadProfitValue: marginResult.overhead_profit_total,
    grandTotal: marginResult.grand_total,
    warnings,
    audit_trail: audit,
  };
}

function calcTk(item: AhspItem, hsd: HsdRegional, audit: AuditEntry[]): AhspComponent[] {
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

function calcBahan(item: AhspItem, hsd: HsdRegional, audit: AuditEntry[]): AhspComponent[] {
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
  warnings: string[],
): AhspComponent[] {
  return item.peralatan.map((entry) => {
    const koef = entry.koef_referensi?.value ?? 0;
    const hsdRp = alatPrices.get(entry.ref) ?? 0;

    if (hsdRp === 0) {
      warnings.push(`${entry.ref}: alat HSD price not found, using 0`);
    }

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
