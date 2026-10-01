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
