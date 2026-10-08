import type { SearchIndexEntry, SearchManifest } from './search-index.js';

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

/** Fetch search manifest + all shards from `/search/`. */
export async function loadSearchIndex(baseUrl = ''): Promise<{
  readonly manifest: SearchManifest;
  readonly entries: readonly SearchIndexEntry[];
}> {
  const manifestRes = await fetch(`${baseUrl}/search/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`Failed to load search manifest (${manifestRes.status})`);
  }
  const manifest = (await manifestRes.json()) as SearchManifest;
  const shards = await Promise.all(
    manifest.shards.map(async (shard) => {
      const response = await fetch(`${baseUrl}${shard.path}`);
      if (!response.ok) {
        throw new Error(`Failed to load search shard ${shard.path} (${response.status})`);
      }
      return (await response.json()) as SearchIndexEntry[];
    }),
  );
  return { manifest, entries: shards.flat() };
}
