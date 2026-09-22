import type { AhspGroup, AuditEntry, HSPResult, SubAhspLine } from '../types/index.js';
import { hitungMargin } from './margin.js';

export interface AssembleHspInput {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly satuan_bayar: string;
  readonly groups: readonly AhspGroup[];
  readonly subAhsp: readonly SubAhspLine[];
  readonly nestedTotal: number;
  readonly overheadPct: number;
  readonly profitPct: number;
  readonly isLumpSum: boolean;
  readonly warnings: readonly string[];
  readonly audit: AuditEntry[];
}

/**
 * Sum resolved groups and nested work, then apply margin.
 * Callers resolve prices and productivity before calling this.
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
    groups: input.groups,
    subAhsp: input.subAhsp,
    baseTotal,
    overheadPct: input.overheadPct,
    profitPct: input.profitPct,
    overheadProfitValue: margin.overhead_profit_total,
    grandTotal: margin.grand_total,
    warnings: input.warnings,
    audit_trail: input.audit,
  };
}
