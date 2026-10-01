export type CatalogSearchParams = Readonly<{
  readonly q?: string;
  readonly bundle?: string;
  readonly bidang?: string;
  readonly unit?: string;
  readonly page?: number;
}>;

export function parseCatalogSearchParams(params: URLSearchParams): CatalogSearchParams {
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  const result: { -readonly [Key in keyof CatalogSearchParams]?: CatalogSearchParams[Key] } = {
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
  const q = params.get('q')?.trim();
  const bundle = params.get('bundle');
  const bidang = params.get('bidang');
  const unit = params.get('unit');
  if (q) result.q = q;
  if (bundle) result.bundle = bundle;
  if (bidang) result.bidang = bidang;
  if (unit) result.unit = unit;
  return result;
}

export function catalogUrl(params: CatalogSearchParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.bundle) query.set('bundle', params.bundle);
  if (params.bidang) query.set('bidang', params.bidang);
  if (params.unit) query.set('unit', params.unit);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const serialized = query.toString();
  return serialized ? `/katalog/?${serialized}` : '/katalog/';
}
