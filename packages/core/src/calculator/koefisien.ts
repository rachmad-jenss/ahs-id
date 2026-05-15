import type { AuditEntry, KoefSumber } from '../types/index.js';

export interface ResolvedKoefisien {
  readonly koefisien: number;
  readonly sumber: KoefSumber;
  readonly detail: string;
  readonly audit: readonly AuditEntry[];
}

/**
 * Resolve a static coefficient (from regulation table).
 * Returns the value as-is.
 */
export function resolveStaticKoefisien(
  ref: string,
  koefisien: number,
): ResolvedKoefisien {
  return {
    koefisien,
    sumber: 'tabel',
    detail: `${ref}: static koef = ${koefisien}`,
    audit: [
      {
        step: 'resolve_koef_static',
        detail: `${ref}: koef = ${koefisien} (tabel)`,
        value: koefisien,
      },
    ],
  };
}

/**
 * Resolve a dynamic coefficient from equipment productivity.
 * koefisien = 1 / produktivitas (jam/satuan from satuan/jam)
 */
export function resolveDynamicKoefisien(
  ref: string,
  produktivitas: number,
  satuanProduksi: string,
): ResolvedKoefisien {
  if (produktivitas <= 0) {
    throw new Error(`Productivity for ${ref} must be positive, got ${produktivitas}`);
  }

  const koefisien = 1 / produktivitas;

  return {
    koefisien,
    sumber: 'kalkulasi',
    detail: `${ref}: 1/${produktivitas.toFixed(4)} ${satuanProduksi} = ${koefisien.toFixed(6)} jam/satuan`,
    audit: [
      {
        step: 'resolve_koef_dynamic',
        detail: `${ref}: 1/${produktivitas.toFixed(4)} = ${koefisien.toFixed(6)}`,
        value: koefisien,
        unit: 'jam/satuan',
      },
    ],
  };
}
