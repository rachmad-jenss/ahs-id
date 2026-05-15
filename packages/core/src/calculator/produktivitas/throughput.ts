import type { AuditEntry } from '../../types/index.js';

export interface ThroughputParams {
  readonly kapasitas_rated: number;
  readonly satuan_kapasitas: string;
  readonly faktor_efisiensi: number;
}

export interface ThroughputResult {
  readonly produktivitas: number;
  readonly satuan: string;
  readonly audit: readonly AuditEntry[];
}

/**
 * Throughput productivity for AMP, Batching Plant, Stone Crusher, etc.
 * Q = Kapasitas_Rated × Fa
 */
export function produktivitasThroughput(params: ThroughputParams): ThroughputResult {
  const { kapasitas_rated, satuan_kapasitas, faktor_efisiensi } = params;
  const Q = kapasitas_rated * faktor_efisiensi;

  const audit: AuditEntry[] = [
    {
      step: 'produktivitas_throughput',
      detail: `Q = ${kapasitas_rated} × ${faktor_efisiensi} = ${Q.toFixed(4)}`,
      value: Q,
      unit: satuan_kapasitas,
    },
  ];

  return { produktivitas: Q, satuan: satuan_kapasitas, audit };
}
