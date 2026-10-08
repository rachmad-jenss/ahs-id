import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catalogItemSlug } from './catalog.js';

export interface DcktrpAhspItem {
  readonly sourceId: string;
  readonly sourceTitle: string;
  readonly code: string;
  readonly name: string;
  readonly bidang: string;
  readonly divisi: number;
  readonly subDivision: string;
  readonly unit: string;
  readonly tenagaKerja: readonly Record<string, unknown>[];
  readonly bahan: readonly Record<string, unknown>[];
  readonly peralatan: readonly Record<string, unknown>[];
  readonly referencePrice: number | null;
  readonly dokumenUrl: string | null;
}

interface BundleIndexRow {
  readonly source_id: string;
  readonly title: string;
  readonly path: string;
  readonly dokumen_url: string | null;
}

function packagesRoot(): string {
  // Astro build cwd is apps/web; vitest may be the same.
  return join(process.cwd(), '../../packages');
}

let cached: readonly DcktrpAhspItem[] | null = null;

/** Load AHSP portal (DCKTRP-by-source) items for SSG detail pages. */
export async function loadDcktrpAhspItems(): Promise<readonly DcktrpAhspItem[]> {
  if (cached) return cached;
  const index = JSON.parse(
    await readFile(join(packagesRoot(), 'ahsp-dcktrp-by-source/data/bundle-index.json'), 'utf8'),
  ) as BundleIndexRow[];
  const items: DcktrpAhspItem[] = [];
  const seenPath = new Set<string>();
  for (const bundle of index) {
    const raw = JSON.parse(
      await readFile(join(packagesRoot(), 'ahsp-dcktrp-by-source', bundle.path, 'items.json'), 'utf8'),
    ) as { items?: Record<string, unknown>[] } | Record<string, unknown>[];
    const rows = Array.isArray(raw) ? raw : (raw.items ?? []);
    for (const row of rows) {
      const code = String(row.kode_ahsp ?? row.kode ?? '');
      if (!code) continue;
      const pathKey = `${bundle.source_id}:${catalogItemSlug(code)}`;
      if (seenPath.has(pathKey)) continue;
      seenPath.add(pathKey);
      items.push({
        sourceId: bundle.source_id,
        sourceTitle: bundle.title,
        code,
        name: String(row.nama ?? ''),
        bidang: String(row.bidang ?? 'portal'),
        divisi: Number(row.divisi ?? 0) || 0,
        subDivision: String(row.sub_divisi ?? ''),
        unit: String(row.satuan_bayar ?? row.satuan ?? ''),
        tenagaKerja: (row.tenaga_kerja as Record<string, unknown>[] | undefined) ?? [],
        bahan: (row.bahan as Record<string, unknown>[] | undefined) ?? [],
        peralatan: (row.peralatan as Record<string, unknown>[] | undefined) ?? [],
        referencePrice:
          typeof row.harga_satuan_pekerjaan_ref === 'number'
            ? row.harga_satuan_pekerjaan_ref
            : typeof row.harga_satuan_ref === 'number'
              ? row.harga_satuan_ref
              : null,
        dokumenUrl: bundle.dokumen_url,
      });
    }
  }
  cached = items;
  return items;
}

export function dcktrpItemPath(sourceId: string, code: string): string {
  return `/ahsp/sumber/${sourceId}/${catalogItemSlug(code)}/`;
}
