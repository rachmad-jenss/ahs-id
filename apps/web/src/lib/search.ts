import Fuse from 'fuse.js';
import { catalogItemKey, catalogItemPath, type CatalogItem } from './catalog.js';
import { parseCatalogSearchParams } from './catalog-url.js';
import type { SearchIndexEntry } from './search-client.js';

export { parseCatalogSearchParams };
export { paginateCatalogItems } from './search-client.js';
export type { SearchIndexEntry } from './search-client.js';

export interface CatalogFilterParams {
  readonly q?: string;
  readonly bundle?: string;
  readonly bidang?: string;
  readonly unit?: string;
}

export function toSearchIndex(items: readonly CatalogItem[]): readonly SearchIndexEntry[] {
  return items.map((item) => ({
    key: catalogItemKey(item),
    code: item.code,
    name: item.name,
    bundleId: item.bundleId,
    bundleName: item.bundleName,
    bidang: item.bidang,
    divisi: item.divisi,
    unit: item.unit,
    href: catalogItemPath(item.bundleId, item.code),
  }));
}

export function filterCatalogItems(
  items: readonly CatalogItem[],
  filters: CatalogFilterParams,
): readonly CatalogItem[] {
  const narrowed = items.filter((item) => {
    if (filters.bundle && item.bundleId !== filters.bundle) return false;
    if (filters.bidang && item.bidang !== filters.bidang) return false;
    if (filters.unit && item.unit !== filters.unit) return false;
    return true;
  });

  const query = filters.q?.trim();
  if (!query) return narrowed;

  const fuse = new Fuse(narrowed, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.36,
    keys: [
      { name: 'code', weight: 1.4 },
      { name: 'name', weight: 1.2 },
      { name: 'bundleName', weight: 0.6 },
      { name: 'regulation', weight: 0.4 },
    ],
  });

  return fuse.search(query).map((result) => result.item);
}
