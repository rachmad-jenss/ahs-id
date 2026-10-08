import type { SearchKind } from './search-index.js';
import { SEARCH_KINDS } from './search-index.js';

export type CatalogSearchParams = Readonly<{
  readonly q?: string;
  readonly bundle?: string;
  readonly bidang?: string;
  readonly unit?: string;
  readonly kind?: SearchKind;
  readonly page?: number;
}>;

function parseKind(value: string | null): SearchKind | undefined {
  if (!value) return undefined;
  return SEARCH_KINDS.includes(value as SearchKind) ? (value as SearchKind) : undefined;
}

export function parseCatalogSearchParams(params: URLSearchParams): CatalogSearchParams {
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const result: { -readonly [Key in keyof CatalogSearchParams]?: CatalogSearchParams[Key] } = {
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
  const q = params.get('q')?.trim();
  const bundle = params.get('bundle');
  const bidang = params.get('bidang');
  const unit = params.get('unit');
  const kind = parseKind(params.get('kind'));
  if (q) result.q = q;
  if (bundle) result.bundle = bundle;
  if (bidang) result.bidang = bidang;
  if (unit) result.unit = unit;
  if (kind) result.kind = kind;
  return result;
}

export function catalogUrl(params: CatalogSearchParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.bundle) query.set('bundle', params.bundle);
  if (params.bidang) query.set('bidang', params.bidang);
  if (params.unit) query.set('unit', params.unit);
  if (params.kind) query.set('kind', params.kind);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const serialized = query.toString();
  return serialized ? `/katalog/?${serialized}` : '/katalog/';
}
