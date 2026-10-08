import type { BundleMeta, FixedCoefficientItem } from '@ahs-id/core';

import binaMargaItems from '../data/bina-marga/items.json' with { type: 'json' };
import ciptaKaryaItems from '../data/cipta-karya/items.json' with { type: 'json' };
import bundleIndexData from '../data/bundle-index.json' with { type: 'json' };
import sdaItems from '../data/sda/items.json' with { type: 'json' };

/** Slug regulasi: `se-binkon-{nomor}-{tahun}`. Tahun baru → paket npm baru (mis. `ahsp-se-binkon-48-2027`). */
export const regulationSlug = 'se-binkon-47-2026';

export interface SeBinkonAhspBundleSummary {
  readonly source_id: string;
  readonly title: string;
  readonly item_count: number;
  readonly path: string;
  readonly bidang?: string;
  readonly lampiran?: string;
  readonly regulation_slug?: string;
  /** ID unduhan PDF di portal Bina Konstruksi (SDM), bukan kode pekerjaan AHSP. */
  readonly download_id?: string;
  readonly kind?: string;
  readonly dokumen_url?: string | null;
}

export const bundleIndex = bundleIndexData as SeBinkonAhspBundleSummary[];

export const meta: BundleMeta = {
  name: '@ahs-id/ahsp-se-binkon-47-2026',
  version: '0.1.0',
  ahs_meta: {
    permen_nomor: null,
    permen_tahun: 2026,
    regulation: 'SE Dirjen Binkon No. 47/SE/Dk/2026',
    supplement: null,
    effective_date: '2026-01-01',
    supersedes: null,
    bidang: ['sda', 'bina-marga', 'cipta-karya'],
    data_source: 'Lampiran IV–VI SE 47/2026 — Docling PDF nasional (hsp-linked)',
    last_verified: '2026-10-08',
  },
};

export const ahspItemsSda = sdaItems as unknown as readonly FixedCoefficientItem[];
export const ahspItemsBinaMarga = binaMargaItems as unknown as readonly FixedCoefficientItem[];
export const ahspItemsCiptaKarya = ciptaKaryaItems as unknown as readonly FixedCoefficientItem[];

export const ahspItemsByBidang = {
  sda: ahspItemsSda,
  'bina-marga': ahspItemsBinaMarga,
  'cipta-karya': ahspItemsCiptaKarya,
} as const;

/** Gabungan ketiga bidang (hindari duplikat kode antar-bidang). */
export const ahspItems = [
  ...ahspItemsSda,
  ...ahspItemsBinaMarga,
  ...ahspItemsCiptaKarya,
] as unknown as readonly FixedCoefficientItem[];

export function listAhspBundles(): readonly SeBinkonAhspBundleSummary[] {
  return bundleIndex;
}

export function findAhspBundle(sourceId: string): SeBinkonAhspBundleSummary | undefined {
  return bundleIndex.find((entry) => entry.source_id === sourceId);
}
