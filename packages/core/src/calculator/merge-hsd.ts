import type {
  HsdBahanEntry,
  HsdPeralatanSewaEntry,
  HsdRegional,
  HsdTenagaKerjaEntry,
} from '../types/index.js';

function indexByRef<T extends { readonly ref: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.ref, row]));
}

/** Normalize identity strings for cross-catalog comparison. */
function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Same `ref` is not enough across AHSP catalogs (Permen BM vs PUPR-scheme regional).
 * Require matching satuan + nama so we never price AMP as excavator or Pasir as semen.
 */
function isCompatibleResource(
  base: { readonly nama: string; readonly satuan: string },
  overlay: { readonly nama: string; readonly satuan: string },
): boolean {
  return (
    normalizeIdentity(base.satuan) === normalizeIdentity(overlay.satuan) &&
    normalizeIdentity(base.nama) === normalizeIdentity(overlay.nama)
  );
}

/**
 * Keep every ref from `base` (e.g. Permen `hsd-bm-2022`). Overlay regional prices only when
 * the same `ref` exists **and** satuan + nama match (catalog-safe).
 *
 * Tenaga kerja HSD rows have no `nama`, so labor prices stay on `base` — PUPR L.* roles
 * are not interchangeable with Permen BM L.* roles for the same code.
 *
 * Region metadata and fuels come from `overlay` so the result is labeled as the selected
 * regional HSD. Unmapped / incompatible refs stay on Permen prices — never invent rows.
 */
export function mergeHsdBaseWithRegionalOverlay(
  base: HsdRegional,
  overlay: HsdRegional,
): HsdRegional {
  const overlayBahan = indexByRef(overlay.bahan);
  const overlaySewa = indexByRef(overlay.peralatan_sewa);

  const tenaga_kerja: HsdTenagaKerjaEntry[] = base.tenaga_kerja.map((row) => row);

  const bahan: HsdBahanEntry[] = base.bahan.map((row) => {
    const next = overlayBahan.get(row.ref);
    if (!next || !isCompatibleResource(row, next)) return row;
    return {
      ...row,
      harga_rp: next.harga_rp,
      sumber_data: next.sumber_data,
    };
  });

  const peralatan_sewa: HsdPeralatanSewaEntry[] = base.peralatan_sewa.map((row) => {
    const next = overlaySewa.get(row.ref);
    if (!next || !isCompatibleResource(row, next)) return row;
    return {
      ...row,
      harga_rp: next.harga_rp,
      sumber_data: next.sumber_data,
    };
  });

  return {
    version: overlay.version,
    region: {
      ...overlay.region,
      verification_note:
        `${overlay.region.verification_note} — BM-2022: Permen refs retained; ` +
        `regional overlay only when ref+nama+satuan match (labor stays Permen).`,
    },
    tenaga_kerja,
    bahan,
    peralatan_sewa,
    bahan_bakar: overlay.bahan_bakar,
  };
}
