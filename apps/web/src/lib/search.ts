import Fuse from 'fuse.js';
import { catalogItemKey, catalogItemPath, type CatalogItem, parseCatalogSearchParams } from './catalog.js';

export { parseCatalogSearchParams };

export interface SearchIndexEntry {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly bundleId: string;
  readonly bundleName: string;
  readonly bidang: string;
  readonly divisi: number;
  readonly unit: string;
  readonly href: string;
}

export interface CatalogFilterParams {
  readonly q?: string;
  readonly bundle?: string;
  readonly bidang?: string;
  readonly unit?: string;
}

export interface CatalogPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
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
