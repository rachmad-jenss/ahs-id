import type { AhspComponent, AhspGroup, AuditEntry, HSPResult, SubAhspLine } from '../types/index.js';
import { idr, percentagePoints } from '../types/domain.js';
import { hitungMargin } from './margin.js';

/** Unbranded component used while prices are still plain numbers. */
export interface PricedComponent {
  readonly ref: string;
  readonly type: 'M' | 'L' | 'E';
  readonly nama: string;
  readonly satuan: string;
  readonly coefficient: number;
  readonly unit_price: number;
  readonly total_price: number;
  readonly fallback_level?: number;
}

/** Unbranded group used while prices are still plain numbers. */
export interface PricedGroup {
  readonly type: 'M' | 'L' | 'E';
  readonly title: string;
  readonly components: readonly PricedComponent[];
  readonly total: number;
}

/** Unbranded nested line used while prices are still plain numbers. */
export interface PricedSubAhsp {
  readonly ref_ahsp: string;
  readonly nama: string;
  readonly koefisien: number;
  readonly unit_price: number;
  readonly total_price: number;
}

export interface AssembleHspInput {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly satuan_bayar: string;
  readonly groups: readonly PricedGroup[];
  readonly subAhsp: readonly PricedSubAhsp[];
  readonly nestedTotal: number;
  readonly overheadPct: number;
  readonly profitPct: number;
  readonly isLumpSum: boolean;
  readonly warnings: readonly string[];
  readonly audit: AuditEntry[];
}

function brandComponent(component: PricedComponent): AhspComponent {
  return {
    ...component,
    unit_price: idr(component.unit_price),
    total_price: idr(component.total_price),
  };
}

function brandGroup(group: PricedGroup): AhspGroup {
  return {
    ...group,
    total: idr(group.total),
    components: group.components.map(brandComponent),
  };
}

function brandSubAhsp(line: PricedSubAhsp): SubAhspLine {
  return {
    ...line,
    unit_price: idr(line.unit_price),
    total_price: idr(line.total_price),
  };
}

/**
 * Sum resolved groups and nested work, then apply margin.
 * Callers resolve prices and productivity before calling this.
 * Money and overhead/profit leave this function as branded units.
 */
export function assembleHspResult(input: AssembleHspInput): HSPResult {
  const groupTotal = input.groups.reduce((sum, group) => sum + group.total, 0);
  const baseTotal = groupTotal + input.nestedTotal;
  const margin = hitungMargin(
    baseTotal,
    { overhead_pct: input.overheadPct, profit_pct: input.profitPct },
    input.isLumpSum,
  );
  input.audit.push(...margin.audit);
  return {
    kode_ahsp: input.kode_ahsp,
    nama: input.nama,
    satuan_bayar: input.satuan_bayar,
    groups: input.groups.map(brandGroup),
    subAhsp: input.subAhsp.map(brandSubAhsp),
    baseTotal: idr(baseTotal),
    overheadPct: percentagePoints(input.overheadPct),
    profitPct: percentagePoints(input.profitPct),
    overheadProfitValue: margin.overhead_profit_total,
    grandTotal: margin.grand_total,
    warnings: input.warnings,
    audit_trail: input.audit,
  };
}
