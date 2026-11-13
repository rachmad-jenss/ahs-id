import type { SearchIndexEntry, SearchManifest } from './search-index.js';

async function readPublicSearchJson(assetPath: string): Promise<unknown> {
  if (import.meta.env.MODE !== 'test') {
    throw new Error('Filesystem search index is only available in vitest');
  }
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const webPublicDir = join(fileURLToPath(new URL('../..', import.meta.url)), 'public');
  const normalized = assetPath.replace(/^\//, '');
  const raw = await readFile(join(webPublicDir, normalized), 'utf8');
  return JSON.parse(raw) as unknown;
}

export type { SearchIndexEntry, SearchKind, SearchManifest } from './search-index.js';

export interface CatalogPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export function paginateCatalogItems<T>(
  items: readonly T[],
  page: number,
  pageSize = 20,
): CatalogPage<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total: items.length,
    totalPages,
  };
}

let manifestCache: SearchManifest | null = null;
const shardCache = new Map<string, SearchIndexEntry[]>();

/** Fetch `/search/manifest.json` once per session. */
export async function loadSearchManifest(baseUrl = ''): Promise<SearchManifest> {
  if (manifestCache) return manifestCache;
  if (baseUrl) {
    const manifestRes = await fetch(`${baseUrl}/search/manifest.json`);
    if (!manifestRes.ok) {
      throw new Error(`Failed to load search manifest (${manifestRes.status})`);
    }
    manifestCache = (await manifestRes.json()) as SearchManifest;
    return manifestCache;
  }
  try {
    const manifestRes = await fetch('/search/manifest.json');
    if (manifestRes.ok) {
      manifestCache = (await manifestRes.json()) as SearchManifest;
      return manifestCache;
    }
  } catch {
    // Node/vitest — relative fetch URL unsupported; read static assets from disk.
  }
  manifestCache = (await readPublicSearchJson('search/manifest.json')) as SearchManifest;
  return manifestCache;
}

/** Load only the listed shards (deduped, cached). */
export async function loadSearchShards(
  shardIds: readonly string[],
  baseUrl = '',
): Promise<readonly SearchIndexEntry[]> {
  const manifest = await loadSearchManifest(baseUrl);
  const unique = [...new Set(shardIds)];
  const missing = unique.filter((id) => !shardCache.has(id));

  await Promise.all(
    missing.map(async (id) => {
      const shard = manifest.shards.find((row) => row.id === id);
      if (!shard) {
        throw new Error(`Unknown search shard: ${id}`);
      }
      let entries: SearchIndexEntry[];
      if (baseUrl) {
        const response = await fetch(`${baseUrl}${shard.path}`);
        if (!response.ok) {
          throw new Error(`Failed to load search shard ${shard.path} (${response.status})`);
        }
        entries = (await response.json()) as SearchIndexEntry[];
      } else {
        try {
          const response = await fetch(shard.path);
          if (response.ok) {
            entries = (await response.json()) as SearchIndexEntry[];
          } else {
            entries = (await readPublicSearchJson(shard.path)) as SearchIndexEntry[];
          }
        } catch {
          entries = (await readPublicSearchJson(shard.path)) as SearchIndexEntry[];
        }
      }
      shardCache.set(id, entries);
    }),
  );

  return unique.flatMap((id) => shardCache.get(id) ?? []);
}

/** AHSP coefficient rows only (~3 MB) — kalkulator & combobox. */
export async function loadAhspSearchEntries(baseUrl = ''): Promise<readonly SearchIndexEntry[]> {
  return loadSearchShards(['ahsp'], baseUrl);
}

/** Portal Jakarta HSP rows only. */
export async function loadHspPortalSearchEntries(baseUrl = ''): Promise<readonly SearchIndexEntry[]> {
  return loadSearchShards(['hsp-jakarta'], baseUrl);
}

/** Fetch search manifest + all shards from `/search/`. */
export async function loadSearchIndex(baseUrl = ''): Promise<{
  readonly manifest: SearchManifest;
  readonly entries: readonly SearchIndexEntry[];
}> {
  const manifest = await loadSearchManifest(baseUrl);
  const shardIds = manifest.shards.map((shard) => shard.id);
  const entries = await loadSearchShards(shardIds, baseUrl);
  return { manifest, entries };
}

/** Reset caches (tests). */
export function resetSearchClientCacheForTests(): void {
  manifestCache = null;
  shardCache.clear();
}
