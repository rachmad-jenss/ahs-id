import type { AuditEntry } from '../../types/index.js';

export interface LintasanVibroRollerParams {
  readonly kecepatan_operasi_km_jam: number;
  readonly lebar_efektif_m: number;
  readonly tebal_hamparan_m: number;
  readonly faktor_efisiensi: number;
  readonly jumlah_passing: number;
}

export interface LintasanMotorGraderParams {
  readonly kecepatan_operasi_km_jam: number;
  readonly lebar_efektif_m: number;
  readonly faktor_efisiensi: number;
  readonly jumlah_lintasan: number;
}

export interface ProduktivitasResult {
  readonly produktivitas: number;
  readonly satuan: string;
  readonly audit: readonly AuditEntry[];
}

/**
 * Vibratory Roller lintasan productivity.
 * Q = (v_m × b × t × Fa) / n
 *
 * CRITICAL: v MUST be converted from km/jam to m/jam.
 * v_m = v_km × 1000
 */
export function produktivitasVibroRoller(params: LintasanVibroRollerParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const v_m = params.kecepatan_operasi_km_jam * 1000;

  audit.push({
    step: 'konversi_kecepatan_vr',
    detail: `${params.kecepatan_operasi_km_jam} km/jam × 1000 = ${v_m} m/jam`,
    value: v_m,
    unit: 'm/jam',
  });

  const Q =
    (v_m * params.lebar_efektif_m * params.tebal_hamparan_m * params.faktor_efisiensi) /
    params.jumlah_passing;

  audit.push({
    step: 'produktivitas_vr',
    detail: `(${v_m} × ${params.lebar_efektif_m} × ${params.tebal_hamparan_m} × ${params.faktor_efisiensi}) / ${params.jumlah_passing}`,
    value: Q,
    unit: 'm3/jam',
  });

  return { produktivitas: Q, satuan: 'm3/jam', audit };
}

/**
 * Motor Grader lintasan productivity (area-based).
 * Q = (v_m × b × Fa) / n
 *
 * Output is m2/jam (area), not m3/jam.
 * CRITICAL: v MUST be converted from km/jam to m/jam.
 */
export function produktivitasMotorGrader(params: LintasanMotorGraderParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const v_m = params.kecepatan_operasi_km_jam * 1000;

  audit.push({
    step: 'konversi_kecepatan_mg',
    detail: `${params.kecepatan_operasi_km_jam} km/jam × 1000 = ${v_m} m/jam`,
    value: v_m,
    unit: 'm/jam',
  });

  const Q =
    (v_m * params.lebar_efektif_m * params.faktor_efisiensi) / params.jumlah_lintasan;

  audit.push({
    step: 'produktivitas_mg',
    detail: `(${v_m} × ${params.lebar_efektif_m} × ${params.faktor_efisiensi}) / ${params.jumlah_lintasan}`,
    value: Q,
    unit: 'm2/jam',
  });

  return { produktivitas: Q, satuan: 'm2/jam', audit };
}
