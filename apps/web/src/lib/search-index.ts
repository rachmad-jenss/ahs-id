/** Kind of a unified catalog search hit. */
export type SearchKind = 'ahsp-coef' | 'hsp-portal' | 'resource' | 'productivity';

/** One row in the fetchable multi-kind search index. */
export interface SearchIndexEntry {
  readonly key: string;
  readonly kind: SearchKind;
  readonly badge: string;
  readonly code: string;
  readonly name: string;
  readonly subtitle: string;
  readonly href: string;
  readonly bundleId?: string;
  readonly bundleName?: string;
  readonly sourceId?: string;
  readonly bidang?: string;
  readonly divisi?: number;
  readonly unit?: string;
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Shard file listed in the search manifest. */
export interface SearchShardInfo {
  readonly id: string;
  readonly kind: SearchKind | 'mixed';
  readonly path: string;
  readonly count: number;
}

/** Manifest written to `public/search/manifest.json`. */
export interface SearchManifest {
  readonly version: 1;
  readonly generatedAt: string;
  readonly total: number;
  readonly counts: Readonly<Record<SearchKind, number>>;
  readonly shards: readonly SearchShardInfo[];
  readonly bundles: readonly { readonly id: string; readonly name: string }[];
}

export const SEARCH_KINDS: readonly SearchKind[] = [
  'ahsp-coef',
  'hsp-portal',
  'resource',
  'productivity',
];

export const SEARCH_KIND_LABELS: Readonly<Record<SearchKind, string>> = {
  'ahsp-coef': 'AHSP koefisien',
  'hsp-portal': 'HSP portal',
  resource: 'Resource',
  productivity: 'Produktivitas',
};
