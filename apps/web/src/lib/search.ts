import Fuse from 'fuse.js';
import { catalogItemKey, catalogItemPath, type CatalogItem } from './catalog.js';
import { parseCatalogSearchParams } from './catalog-url.js';
import type { SearchIndexEntry } from './search-index.js';

export { parseCatalogSearchParams };
export { paginateCatalogItems, loadSearchIndex } from './search-client.js';
export type { SearchIndexEntry, SearchKind, SearchManifest } from './search-index.js';

export interface CatalogFilterParams {
  readonly q?: string;
  readonly bundle?: string;
  readonly bidang?: string;
  readonly unit?: string;
  readonly kind?: SearchIndexEntry['kind'];
}

/** Convert national catalog items into unified search entries (build-time helper). */
export function toSearchIndex(items: readonly CatalogItem[]): readonly SearchIndexEntry[] {
  return items.map((item) => ({
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

/** Filter unified search entries by kind/bundle/bidang/unit + Fuse query. */
export function filterSearchEntries(
  entries: readonly SearchIndexEntry[],
  filters: CatalogFilterParams,
): readonly SearchIndexEntry[] {
  const narrowed = entries.filter((entry) => {
    if (filters.kind && entry.kind !== filters.kind) return false;
    if (filters.bundle && entry.bundleId !== filters.bundle) return false;
    if (filters.bidang && entry.bidang !== filters.bidang) return false;
    if (filters.unit && entry.unit !== filters.unit) return false;
    return true;
  });
  const query = filters.q?.trim();
  if (!query) return narrowed;
  return new Fuse(narrowed, {
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.36,
    keys: [
      { name: 'code', weight: 1.4 },
      { name: 'name', weight: 1.2 },
      { name: 'badge', weight: 0.5 },
      { name: 'subtitle', weight: 0.6 },
      { name: 'bundleName', weight: 0.5 },
    ],
  })
    .search(query)
    .map((result) => result.item);
}
