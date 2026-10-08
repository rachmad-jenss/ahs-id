import type {
  HsdBahanEntry,
  HsdPeralatanSewaEntry,
  HsdRegional,
  HsdTenagaKerjaEntry,
} from '../types/index.js';

function indexByRef<T extends { readonly ref: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.ref, row]));
}

/**
 * Keep every ref from `base` (e.g. Permen `hsd-bm-2022`), overlay prices from
 * `overlay` only when the same `ref` exists in both catalogs.
 *
 * Region metadata and fuels come from `overlay` so the result is labeled as the
 * selected regional HSD. Unmapped refs stay on Permen prices — never invent rows.
 */
export function mergeHsdBaseWithRegionalOverlay(
  base: HsdRegional,
  overlay: HsdRegional,
): HsdRegional {
  const overlayTk = indexByRef(overlay.tenaga_kerja);
  const overlayBahan = indexByRef(overlay.bahan);
  const overlaySewa = indexByRef(overlay.peralatan_sewa);

  const tenaga_kerja: HsdTenagaKerjaEntry[] = base.tenaga_kerja.map((row) => {
    const next = overlayTk.get(row.ref);
    return next ? { ...row, harga_rp: next.harga_rp, sumber_data: next.sumber_data } : row;
  });

  const bahan: HsdBahanEntry[] = base.bahan.map((row) => {
    const next = overlayBahan.get(row.ref);
    return next
      ? {
          ...row,
          nama: next.nama,
          harga_rp: next.harga_rp,
          satuan: next.satuan,
          sumber_data: next.sumber_data,
        }
      : row;
  });

  const peralatan_sewa: HsdPeralatanSewaEntry[] = base.peralatan_sewa.map((row) => {
    const next = overlaySewa.get(row.ref);
    return next
      ? {
          ...row,
          nama: next.nama,
          harga_rp: next.harga_rp,
          sumber_data: next.sumber_data,
        }
      : row;
  });

  return {
    version: overlay.version,
    region: {
      ...overlay.region,
      verification_note:
        `${overlay.region.verification_note} — BM-2022: Permen refs retained; ` +
        `regional overlay applied only for matching L/M/E refs.`,
    },
    tenaga_kerja,
    bahan,
    peralatan_sewa,
    bahan_bakar: overlay.bahan_bakar,
  };
}
