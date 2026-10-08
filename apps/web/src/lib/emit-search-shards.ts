import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { buildCatalog, catalogItemKey, catalogItemPath, catalogItemSlug } from './catalog.js';
import type { SearchIndexEntry, SearchKind, SearchManifest } from './search-index.js';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = join(webRoot, '../..');

function slugCode(code: string): string {
  return catalogItemSlug(code);
}

async function readJsonl(path: string): Promise<readonly Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(JSON.parse(trimmed) as Record<string, unknown>);
  }
  return rows;
}

async function readJson<T>(path: string): Promise<T> {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function nationalAhspEntries(): SearchIndexEntry[] {
  const catalog = buildCatalog();
  return catalog.items.map((item) => ({
    key: `ahsp:${catalogItemKey(item)}`,
    kind: 'ahsp-coef' as const,
    badge: 'AHSP nasional',
    code: item.code,
    name: item.name,
    subtitle: `${item.bundleName} · ${item.bidang} · Divisi ${item.divisi}`,
    href: catalogItemPath(item.bundleId, item.code),
    bundleId: item.bundleId,
    bundleName: item.bundleName,
    bidang: item.bidang,
    divisi: item.divisi,
    unit: item.unit,
  }));
}

async function dcktrpAhspEntries(): Promise<SearchIndexEntry[]> {
  const indexPath = join(repoRoot, 'packages/ahsp-dcktrp-by-source/data/bundle-index.json');
  const bundles = await readJson<
    readonly {
      readonly source_id: string;
      readonly title: string;
      readonly path: string;
    }[]
  >(indexPath);
  const entries: SearchIndexEntry[] = [];
  for (const bundle of bundles) {
    const itemsPath = join(repoRoot, 'packages/ahsp-dcktrp-by-source', bundle.path, 'items.json');
    const raw = await readJson<unknown>(itemsPath);
    const items = Array.isArray(raw)
      ? (raw as readonly Record<string, unknown>[])
      : ((raw as { readonly items?: readonly Record<string, unknown>[] }).items ?? []);
    const codeOccurrences = new Map<string, number>();
    for (const item of items) {
      const code = String(item.kode_ahsp ?? item.kode ?? '');
      if (!code) continue;
      const name = String(item.nama ?? '');
      const occurrence = codeOccurrences.get(code) ?? 0;
      codeOccurrences.set(code, occurrence + 1);
      const bidang = String(item.bidang ?? 'portal');
      const divisi = typeof item.divisi === 'number' ? item.divisi : Number(item.divisi ?? 0);
      const unit = String(item.satuan_bayar ?? item.satuan ?? '');
      const keySuffix = occurrence === 0 ? code : `${code}:${occurrence}`;
      // Detail pages use code slug; duplicates share the first path (portal data quirk).
      entries.push({
        key: `ahsp-dcktrp:${bundle.source_id}:${keySuffix}`,
        kind: 'ahsp-coef',
        badge: 'AHSP portal DCKTRP',
        code,
        name,
        subtitle: `${bundle.title} · ${bidang}`,
        href: `/ahsp/sumber/${bundle.source_id}/${slugCode(code)}/`,
        bundleId: `dcktrp:${bundle.source_id}`,
        bundleName: bundle.title,
        sourceId: bundle.source_id,
        bidang,
        divisi: Number.isFinite(divisi) ? divisi : 0,
        unit,
      });
    }
  }
  return entries;
}

async function hspPortalEntries(): Promise<{
  readonly entries: SearchIndexEntry[];
  readonly details: ReadonlyMap<string, Record<string, unknown>>;
}> {
  const index = await readJson<
    readonly {
      readonly source_id: number;
      readonly kode: string | null;
      readonly nama: string;
      readonly kategori: string | null;
      readonly satuan_bayar: string | null;
      readonly dasar_hukum: string | null;
      readonly harga_satuan_rp: number | null;
    }[]
  >(join(repoRoot, 'packages/hsp-jakarta-dcktrp/data/index.json'));
  const details = new Map<string, Record<string, unknown>>();
  const jsonlPath = join(repoRoot, 'packages/hsp-jakarta-dcktrp/data/items.jsonl');
  for (const row of await readJsonl(jsonlPath)) {
    details.set(String(row.source_id), row);
  }
  const entries = index.map((row) => {
    const code = row.kode?.trim() || `id-${row.source_id}`;
    return {
      key: `hsp-jakarta:${row.source_id}`,
      kind: 'hsp-portal' as const,
      badge: 'HSP portal',
      code,
      name: row.nama,
      subtitle: [row.kategori, row.dasar_hukum].filter(Boolean).join(' · ') || 'HSP DKI Jakarta (DCKTRP)',
      href: `/hsp/jakarta/${row.source_id}/`,
      sourceId: String(row.source_id),
      bundleId: 'hsp-jakarta-dcktrp',
      bundleName: 'HSP Jakarta (DCKTRP)',
      unit: row.satuan_bayar ?? undefined,
      meta: {
        harga_satuan_rp: row.harga_satuan_rp,
        kategori: row.kategori,
      },
    };
  });
  return { entries, details };
}

async function resourceAndProductivityEntries(): Promise<{
  resources: SearchIndexEntry[];
  productivity: SearchIndexEntry[];
}> {
  const masterFiles = [
    { bundleId: 'pupr-2023', bundleName: 'Permen PUPR 8/2023', kind: 'tenaga', file: 'packages/pupr-2023/data/tenaga-kerja.json' },
    { bundleId: 'pupr-2023', bundleName: 'Permen PUPR 8/2023', kind: 'bahan', file: 'packages/pupr-2023/data/bahan-master.json' },
    { bundleId: 'pupr-2023', bundleName: 'Permen PUPR 8/2023', kind: 'peralatan', file: 'packages/pupr-2023/data/peralatan-master.json' },
    { bundleId: 'bina-marga-2016', bundleName: 'Bina Marga 2016', kind: 'tenaga', file: 'packages/bina-marga-2016/data/tenaga-kerja.json' },
    { bundleId: 'bina-marga-2016', bundleName: 'Bina Marga 2016', kind: 'bahan', file: 'packages/bina-marga-2016/data/bahan-master.json' },
    { bundleId: 'bina-marga-2016', bundleName: 'Bina Marga 2016', kind: 'peralatan', file: 'packages/bina-marga-2016/data/peralatan-master.json' },
    { bundleId: 'bina-marga-2022', bundleName: 'Bina Marga 2022', kind: 'tenaga', file: 'packages/bina-marga-2022/data/tenaga-kerja.json' },
    { bundleId: 'bina-marga-2022', bundleName: 'Bina Marga 2022', kind: 'bahan', file: 'packages/bina-marga-2022/data/bahan-master.json' },
    { bundleId: 'bina-marga-2022', bundleName: 'Bina Marga 2022', kind: 'peralatan', file: 'packages/bina-marga-2022/data/peralatan-master.json' },
  ] as const;

  const catalog = buildCatalog();
  /** First national item href that actually contains this component ref. */
  const anchorByRef = new Map<string, string>();
  for (const item of catalog.items) {
    for (const component of item.components) {
      if (!component.ref) continue;
      const kindPrefix =
        component.kind === 'tenaga kerja' ? 'tenaga' : component.kind === 'bahan' ? 'bahan' : 'peralatan';
      const mapKey = `${item.bundleId}:${kindPrefix}:${component.ref}`;
      if (anchorByRef.has(mapKey)) continue;
      anchorByRef.set(
        mapKey,
        `${catalogItemPath(item.bundleId, item.code)}#${kindPrefix}-${encodeURIComponent(component.ref)}`,
      );
    }
  }

  const resources: SearchIndexEntry[] = [];
  const productivity: SearchIndexEntry[] = [];
  const seenResource = new Set<string>();
  const seenProd = new Set<string>();

  for (const master of masterFiles) {
    const data = await readJson<{ readonly items?: readonly Record<string, unknown>[] }>(
      join(repoRoot, master.file),
    );
    for (const item of data.items ?? []) {
      const code = String(item.kode ?? '');
      if (!code) continue;
      const name = String(item.nama ?? code);
      const unit = item.satuan != null ? String(item.satuan) : null;
      const resourceKey = `${master.kind}:${code}`;
      if (!seenResource.has(resourceKey)) {
        seenResource.add(resourceKey);
        const anchor =
          anchorByRef.get(`${master.bundleId}:${master.kind}:${code}`) ??
          `/katalog/?q=${encodeURIComponent(code)}&bundle=${encodeURIComponent(master.bundleId)}`;
        resources.push({
          key: `resource:${resourceKey}`,
          kind: 'resource',
          badge: 'Resource',
          code,
          name,
          subtitle: `${master.kind} · ${master.bundleName}`,
          href: anchor,
          bundleId: master.bundleId,
          bundleName: master.bundleName,
          unit: unit ?? undefined,
          meta: { resourceKind: master.kind },
        });
      }

      if (master.kind === 'peralatan') {
        const tipe = item.tipe_produksi != null ? String(item.tipe_produksi) : '';
        if (tipe && tipe !== 'none' && !seenProd.has(code)) {
          seenProd.add(code);
          productivity.push({
            key: `productivity:${code}`,
            kind: 'productivity',
            badge: 'Produktivitas',
            code,
            name,
            subtitle: `${tipe} · ${master.bundleName}`,
            href: `/kalkulator/?bundle=${encodeURIComponent(master.bundleId)}&focus=${encodeURIComponent(code)}`,
            bundleId: master.bundleId,
            bundleName: master.bundleName,
            meta: { tipe_produksi: tipe },
          });
        }
      }
    }
  }

  return { resources, productivity };
}

async function writeShard(
  outDir: string,
  fileName: string,
  entries: readonly SearchIndexEntry[],
): Promise<void> {
  await writeFile(join(outDir, fileName), `${JSON.stringify(entries)}\n`, 'utf8');
}

/** Build searchable shards under `apps/web/public/search` (+ HSP detail shards). */
export async function emitSearchShards(options?: {
  readonly searchOutDir?: string;
  readonly hspOutDir?: string;
}): Promise<SearchManifest> {
  const searchOutDir = options?.searchOutDir ?? join(webRoot, 'public/search');
  const hspOutDir = options?.hspOutDir ?? join(webRoot, 'public/hsp/jakarta');
  await mkdir(searchOutDir, { recursive: true });
  await mkdir(hspOutDir, { recursive: true });

  const national = nationalAhspEntries();
  const dcktrp = await dcktrpAhspEntries();
  const ahspCoef = [...national, ...dcktrp];
  const { entries: hspEntries, details } = await hspPortalEntries();
  const { resources, productivity } = await resourceAndProductivityEntries();

  // HSP detail shards by last digit of source_id (avoids thousands of tiny files).
  const hspShards = new Map<string, Record<string, unknown>>();
  for (const [sourceId, row] of details) {
    const shardKey = sourceId.slice(-1);
    const bucket = hspShards.get(shardKey) ?? {};
    bucket[sourceId] = {
      source_id: row.source_id,
      kode: row.kode,
      nama: row.nama,
      uraian_lengkap: row.uraian_lengkap,
      kategori: row.kategori,
      satuan_bayar: row.satuan_bayar,
      dasar_hukum: row.dasar_hukum,
      harga_satuan_rp: row.harga_satuan_rp,
      profit_pct: row.profit_pct,
      profit_rp: row.profit_rp,
      tenaga_kerja: row.tenaga_kerja,
      bahan: row.bahan,
      peralatan: row.peralatan,
      provenance: row.provenance,
    };
    hspShards.set(shardKey, bucket);
  }
  for (const [shardKey, bucket] of hspShards) {
    await writeFile(join(hspOutDir, `shard-${shardKey}.json`), `${JSON.stringify(bucket)}\n`, 'utf8');
  }

  await writeShard(searchOutDir, 'ahsp.json', ahspCoef);
  await writeShard(searchOutDir, 'hsp-jakarta.json', hspEntries);
  await writeShard(searchOutDir, 'resources.json', resources);
  await writeShard(searchOutDir, 'productivity.json', productivity);

  const catalog = buildCatalog();
  const counts: Record<SearchKind, number> = {
    'ahsp-coef': ahspCoef.length,
    'hsp-portal': hspEntries.length,
    resource: resources.length,
    productivity: productivity.length,
  };
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const manifest: SearchManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total,
    counts,
    shards: [
      { id: 'ahsp', kind: 'ahsp-coef', path: '/search/ahsp.json', count: ahspCoef.length },
      { id: 'hsp-jakarta', kind: 'hsp-portal', path: '/search/hsp-jakarta.json', count: hspEntries.length },
      { id: 'resources', kind: 'resource', path: '/search/resources.json', count: resources.length },
      { id: 'productivity', kind: 'productivity', path: '/search/productivity.json', count: productivity.length },
    ],
    bundles: [
      ...catalog.bundles.map((bundle) => ({ id: bundle.id, name: bundle.name })),
      { id: 'hsp-jakarta-dcktrp', name: 'HSP Jakarta (DCKTRP)' },
      ...dcktrp
        .reduce<{ id: string; name: string }[]>((acc, entry) => {
          if (!entry.bundleId || acc.some((row) => row.id === entry.bundleId)) return acc;
          acc.push({ id: entry.bundleId, name: entry.bundleName ?? entry.bundleId });
          return acc;
        }, []),
    ],
  };
  await writeFile(join(searchOutDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
