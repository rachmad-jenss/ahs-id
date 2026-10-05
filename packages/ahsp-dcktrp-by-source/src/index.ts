import bundleIndexData from '../data/bundle-index.json' with { type: 'json' };

export interface AhspSourceBundleSummary {
  readonly source_id: string;
  readonly title: string;
  readonly item_count: number;
  readonly path: string;
  readonly dokumen_url: string | null;
  readonly dokumen_pencarian_url?: string | null;
  readonly portal_url: string | null;
}

export const bundleIndex = bundleIndexData as AhspSourceBundleSummary[];

/** List AHSP sub-bundles grouped by legal source (SE / Permen). */
export function listAhspSourceBundles(): readonly AhspSourceBundleSummary[] {
  return bundleIndex;
}

export function findAhspSourceBundle(sourceId: string): AhspSourceBundleSummary | undefined {
  return bundleIndex.find((entry) => entry.source_id === sourceId);
}
