import { loadHspPortalSearchEntries, type SearchIndexEntry } from '@/lib/search-client';

export const PORTAL_BUNDLE_ID = 'hsp-jakarta-dcktrp';
export const PORTAL_BUNDLE_DISPLAY = 'HSP portal DCKTRP (DKI Jakarta)';

export interface PortalComponentRow {
  readonly nama: string;
  readonly koefisien: number | null;
  readonly harga_satuan_rp: number | null;
  readonly jumlah_rp: number | null;
  readonly satuan: string | null;
}

export interface PortalHspResult {
  readonly sourceId: string;
  readonly kode: string;
  readonly nama: string;
  readonly satuan_bayar: string | null;
  readonly kategori: string | null;
  readonly dasar_hukum: string | null;
  readonly harga_satuan_rp: number | null;
  readonly profit_pct: number | null;
  readonly profit_rp: number | null;
  readonly detailHref: string;
  readonly apiUrl: string | null;
  readonly tenaga_kerja: readonly PortalComponentRow[];
  readonly bahan: readonly PortalComponentRow[];
  readonly peralatan: readonly PortalComponentRow[];
}

function portalEntries(entries: readonly SearchIndexEntry[]): SearchIndexEntry[] {
  return entries.filter((row) => row.kind === 'hsp-portal' && row.bundleId === PORTAL_BUNDLE_ID);
}

/** Resolve one portal row by kode AHSP or `id-{sourceId}`. */
export async function findPortalIndexEntry(code: string): Promise<SearchIndexEntry> {
  const q = code.trim();
  if (!q) {
    throw new Error('Kode atau ID pekerjaan kosong');
  }
  const entries = await loadHspPortalSearchEntries();
  const scoped = portalEntries(entries);
  const exact = scoped.filter((row) => row.code === q);
  const sole = exact[0];
  if (exact.length === 1 && sole) return sole;
  if (exact.length > 1) {
    throw new Error(`Kode "${q}" tidak unik di portal DCKTRP`);
  }
  const idMatch = /^id-(\d+)$/i.exec(q);
  if (idMatch) {
    const bySource = scoped.find((row) => row.sourceId === idMatch[1]);
    if (bySource) return bySource;
  }
  throw new Error(`Pekerjaan portal "${q}" tidak ditemukan`);
}

function mapPortalRows(
  rows: readonly Record<string, unknown>[] | undefined,
): readonly PortalComponentRow[] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    nama: String(row.nama ?? row.kode ?? '—'),
    koefisien: typeof row.koefisien === 'number' ? row.koefisien : null,
    harga_satuan_rp: typeof row.harga_satuan_rp === 'number' ? row.harga_satuan_rp : null,
    jumlah_rp: typeof row.jumlah_rp === 'number' ? row.jumlah_rp : null,
    satuan: typeof row.satuan === 'string' ? row.satuan : null,
  }));
}

/** Load portal HSP for the calculator (summary + optional shard breakdown). */
export async function lookupPortalHspInBrowser(item: string): Promise<PortalHspResult> {
  const entry = await findPortalIndexEntry(item);
  const sourceId = entry.sourceId ?? '';
  if (!sourceId) {
    throw new Error('Entri portal tanpa source ID');
  }

  let detail: Record<string, unknown> = {};
  const shardKey = sourceId.slice(-1);
  try {
    const res = await fetch(`/hsp/jakarta/shard-${shardKey}.json`);
    if (res.ok) {
      const shard = (await res.json()) as Record<string, Record<string, unknown>>;
      detail = shard[sourceId] ?? {};
    }
  } catch {
    // Summary from search index is enough when shards are missing.
  }

  const kode =
    (typeof detail.kode === 'string' && detail.kode.trim())
    || entry.code;
  const hargaIndex = entry.meta?.harga_satuan_rp;
  const hargaDetail = detail.harga_satuan_rp;
  const harga_satuan_rp =
    typeof hargaDetail === 'number'
      ? hargaDetail
      : typeof hargaIndex === 'number'
        ? hargaIndex
        : null;

  const provenance = detail.provenance as { api_url?: string } | undefined;

  return {
    sourceId,
    kode,
    nama: typeof detail.nama === 'string' ? detail.nama : entry.name,
    satuan_bayar:
      typeof detail.satuan_bayar === 'string'
        ? detail.satuan_bayar
        : entry.unit ?? null,
    kategori:
      typeof detail.kategori === 'string'
        ? detail.kategori
        : typeof entry.meta?.kategori === 'string'
          ? entry.meta.kategori
          : null,
    dasar_hukum:
      typeof detail.dasar_hukum === 'string'
        ? detail.dasar_hukum
        : entry.subtitle.split(' · ').pop() ?? null,
    harga_satuan_rp,
    profit_pct: typeof detail.profit_pct === 'number' ? detail.profit_pct : null,
    profit_rp: typeof detail.profit_rp === 'number' ? detail.profit_rp : null,
    detailHref: entry.href,
    apiUrl: provenance?.api_url ?? null,
    tenaga_kerja: mapPortalRows(detail.tenaga_kerja as readonly Record<string, unknown>[] | undefined),
    bahan: mapPortalRows(detail.bahan as readonly Record<string, unknown>[] | undefined),
    peralatan: mapPortalRows(detail.peralatan as readonly Record<string, unknown>[] | undefined),
  };
}
