import type { AuditEntry } from '../types/index.js';

export interface MarginParams {
  readonly overhead_pct: number;
  readonly profit_pct: number;
}

export interface MarginResult {
  readonly biaya_langsung: number;
  readonly overhead_value: number;
  readonly profit_value: number;
  readonly overhead_profit_total: number;
  readonly grand_total: number;
  readonly audit: readonly AuditEntry[];
}

/**
 * Calculate overhead + profit margin on direct cost.
 *
 * Constraint: 10 <= overhead_pct + profit_pct <= 15
 * Lump sum items: returns biaya_langsung unmodified (no indirect cost).
 */
export function hitungMargin(
  biayaLangsung: number,
  params: MarginParams,
  isLumpSum: boolean,
): MarginResult {
  const audit: AuditEntry[] = [];

  if (isLumpSum) {
    audit.push({
      step: 'margin_lump_sum',
      detail: 'Lump sum item — indirect cost skipped',
      value: 0,
    });
    return {
      biaya_langsung: biayaLangsung,
      overhead_value: 0,
      profit_value: 0,
      overhead_profit_total: 0,
      grand_total: biayaLangsung,
      audit,
    };
  }

  const sum = params.overhead_pct + params.profit_pct;
  if (sum < 10 || sum > 15) {
    throw new Error(
      `Overhead + profit must be 10-15%, got ${params.overhead_pct}% + ${params.profit_pct}% = ${sum}%`,
    );
  }

  const overhead_value = biayaLangsung * (params.overhead_pct / 100);
  const profit_value = biayaLangsung * (params.profit_pct / 100);
  const overhead_profit_total = overhead_value + profit_value;
  const grand_total = biayaLangsung + overhead_profit_total;

  audit.push({
    step: 'margin',
    detail: `overhead=${params.overhead_pct}% (${overhead_value.toFixed(0)}), profit=${params.profit_pct}% (${profit_value.toFixed(0)}), total=${sum}%`,
    value: overhead_profit_total,
    unit: 'Rp',
  });

  return {
    biaya_langsung: biayaLangsung,
    overhead_value,
    profit_value,
    overhead_profit_total,
    grand_total,
    audit,
  };
}
