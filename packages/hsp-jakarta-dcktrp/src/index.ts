import manifestData from '../data/manifest.json' with { type: 'json' };
import indexData from '../data/index.json' with { type: 'json' };

/** Metadata for the Bangun Jakarta HSP scrape bundle. */
export interface HspJakartaManifest {
  readonly version: string;
  readonly source: {
    readonly portal: string;
    readonly url: string;
    readonly api_base: string;
    readonly scraped_at: string;
  };
  readonly region: {
    readonly provinsi: string;
    readonly kode_provinsi: string;
  };
  readonly item_count: number;
  readonly total_reported_by_api: number;
  readonly verification_tier: string;
  readonly verification_note: string;
  readonly dasar_hukum_summary?: readonly {
    readonly label: string;
    readonly item_count: number;
    readonly source_id: string;
    readonly jenis: string | null;
    readonly dokumen_url: string | null;
    readonly dokumen_pencarian_url?: string | null;
    readonly portal_url: string | null;
  }[];
  readonly legal_sources_catalog?: string;
  readonly portal?: {
    readonly id: string;
    readonly label: string;
    readonly portal_url: string;
    readonly api_hsp_base: string;
  };
  readonly data_layers?: Readonly<Record<string, string>>;
}

/** Summary row from the HSP list API (one per pekerjaan). */
export interface HspJakartaIndexEntry {
  readonly source_id: number;
  readonly kode: string | null;
  readonly nama: string;
  readonly uraian_lengkap: string;
  readonly kategori: string | null;
  readonly satuan_bayar: string | null;
  readonly dasar_hukum: string | null;
  readonly harga_satuan_rp: number | null;
  readonly profit_pct: number | null;
  readonly profit_rp: number | null;
}

export const manifest = manifestData as HspJakartaManifest;
export const index = indexData as HspJakartaIndexEntry[];

/**
 * Lookup a summary row by PUPR-style kode prefix (e.g. `3.1.1`) or exact match.
 */
export function findHspByKode(kode: string): HspJakartaIndexEntry | undefined {
  const normalized = kode.trim();
  return index.find(
    (row) => row.kode === normalized || row.kode?.startsWith(`${normalized}.`) || row.kode?.startsWith(normalized),
  );
}
