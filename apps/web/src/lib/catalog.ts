import type {
  AhspItem,
  BundleMeta,
  FixedCoefficientItem,
  MarginDefinition,
  Provenance,
  SubAhspEntry,
  VariabelDefinition,
} from '@ahs-id/core';
import {
  ahspItems as binaMarga2016Items,
  bahanMaster as binaMarga2016Bahan,
  meta as binaMarga2016Meta,
  peralatanMaster as binaMarga2016Peralatan,
  tenagaKerja as binaMarga2016Tenaga,
} from '@ahs-id/bina-marga-2016';
import {
  ahspItems as binaMarga2022Items,
  bahanMaster as binaMarga2022Bahan,
  meta as binaMarga2022Meta,
  peralatanMaster as binaMarga2022Peralatan,
  tenagaKerja as binaMarga2022Tenaga,
} from '@ahs-id/bina-marga-2022';
import {
  ahspItems as ciptaKaryaItems,
  meta as ciptaKaryaMeta,
} from '@ahs-id/cipta-karya-2024';
import {
  ahspItems as puprItems,
  bahanMaster as puprBahan,
  meta as puprMeta,
  peralatanMaster as puprPeralatan,
  tenagaKerja as puprTenaga,
} from '@ahs-id/pupr-2023';

export type CatalogComponentKind = 'tenaga kerja' | 'bahan' | 'peralatan';

export interface CatalogComponent {
  readonly kind: CatalogComponentKind;
  readonly ref: string | null;
  readonly name: string;
  readonly unit: string | null;
  readonly coefficient: number | null;
  readonly source: 'tabel' | 'kalkulasi' | 'fixed';
  readonly note: string | null;
  readonly referencePrice: number | null;
  readonly volumeState: string | null;
  readonly costMode: string | null;
  readonly variables: readonly string[];
}

export interface CatalogItem {
  readonly bundleId: string;
  readonly bundleName: string;
  readonly bundleVersion: string;
  readonly regulation: string;
  readonly occurrence: number;
  readonly code: string;
  readonly name: string;
  readonly bidang: string;
  readonly divisi: number;
  readonly subDivision: string;
  readonly unit: string;
  readonly calculationType: 'dynamic_hsd' | 'fixed_coefficient';
  readonly workType: string;
  readonly isLumpSum: boolean;
  readonly components: readonly CatalogComponent[];
  readonly variables: Readonly<Record<string, VariabelDefinition>>;
  readonly subAhsp: readonly SubAhspEntry[];
  readonly margin: MarginDefinition;
  readonly provenance: Provenance;
  readonly notes: readonly string[];
  readonly referencePrice: number | null;
}

export interface CatalogBundleSummary {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly regulation: string;
  readonly bidang: readonly string[];
  readonly source: string;
  readonly sourceItemCount: number;
  readonly publicItemCount: number;
  readonly verificationTiers: readonly string[];
}

export interface Catalog {
  readonly items: readonly CatalogItem[];
  readonly bundles: readonly CatalogBundleSummary[];
  readonly sourceItemCount: number;
  readonly quarantinedItemCount: number;
}

interface MasterEntry {
  readonly kode: string;
  readonly nama: string;
  readonly satuan?: string;
}

interface MasterBundle {
  readonly items: readonly MasterEntry[];
}

interface DynamicBundleSource {
  readonly id: string;
  readonly displayName: string;
  readonly meta: BundleMeta;
  readonly items: readonly AhspItem[];
  readonly tenagaKerja: MasterBundle;
  readonly bahanMaster: MasterBundle;
  readonly peralatanMaster: MasterBundle;
}

interface FixedBundleSource {
  readonly id: string;
  readonly displayName: string;
  readonly meta: BundleMeta;
  readonly items: readonly FixedCoefficientItem[];
}

type BundleSource = DynamicBundleSource | FixedBundleSource;

interface QuarantineRule {
  readonly code: string;
  readonly name: string;
  readonly referencePrice?: number;
  readonly reason: string;
}

export const CIPTA_KARYA_QUARANTINE: readonly QuarantineRule[] = [
  { code: '6.6.1.1', name: 'Pembuatan 1 buah sumur Resapan Air Hujan diameter 80 cm, t=100 cm', reason: 'duplicate code with a different source row' },
  { code: '6.6.1.1', name: 'Pemasangan 1 buah gate velve (10,16,20) K, dia. 1/2" (15 mm)', reason: 'duplicate code with a different source row' },
  { code: '6.6.5.4', name: 'Pemasangan 1 buah Floater Velve Dia. 1-1/4 " (32 mm)', reason: 'duplicate code with a different source row' },
  { code: '6.6.5.4', name: 'Pemasangan 1 buah Foot Velve, Dia. 1-1/4 " (32 mm)', reason: 'duplicate code with a different source row' },
  { code: '6.6.5.5', name: 'Pemasangan 1 buah Floater Velve, Dia. 1-1/2 " (40 mm)', referencePrice: 862700, reason: 'duplicate code with a different source row' },
  { code: '6.6.5.5', name: 'Pemasangan 1 buah Floater Velve, Dia. 1-1/2 " (40 mm)', referencePrice: 321300, reason: 'duplicate code with a different source row' },
  { code: '51.1.12.7', name: 'Pemasangan 1 unit kabel tray (vertikal) 500 x 100 mm', reason: 'source row declares an outlier division 51' },
];

export const QUARANTINED_CIPTA_KEYS: readonly string[] = CIPTA_KARYA_QUARANTINE.map(
  (rule) => `cipta-karya-2024:${rule.code}:${rule.name}:${rule.referencePrice ?? 'any'}`,
);

const SOURCES: readonly BundleSource[] = [
  {
    id: 'pupr-2023',
    displayName: 'Permen PUPR 8/2023',
    meta: puprMeta,
    items: puprItems,
    tenagaKerja: puprTenaga,
    bahanMaster: puprBahan,
    peralatanMaster: puprPeralatan,
  },
  {
    id: 'bina-marga-2016',
    displayName: 'Bina Marga 2016',
    meta: binaMarga2016Meta,
    items: binaMarga2016Items,
    tenagaKerja: binaMarga2016Tenaga,
    bahanMaster: binaMarga2016Bahan,
    peralatanMaster: binaMarga2016Peralatan,
  },
  {
    id: 'bina-marga-2022',
    displayName: 'Bina Marga 2022',
    meta: binaMarga2022Meta,
    items: binaMarga2022Items,
    tenagaKerja: binaMarga2022Tenaga,
    bahanMaster: binaMarga2022Bahan,
    peralatanMaster: binaMarga2022Peralatan,
  },
  {
    id: 'cipta-karya-2024',
    displayName: 'Cipta Karya 2024',
    meta: ciptaKaryaMeta,
    items: ciptaKaryaItems,
  },
];

function masterLookup(bundle: MasterBundle | undefined): ReadonlyMap<string, MasterEntry> {
  return new Map((bundle?.items ?? []).map((entry) => [entry.kode, entry]));
}

function component(
  kind: CatalogComponentKind,
  input: {
    readonly ref?: string | null;
    readonly name: string;
    readonly unit?: string | null;
    readonly coefficient: number | null;
    readonly source: CatalogComponent['source'];
    readonly note?: string | null;
    readonly referencePrice?: number | null;
    readonly volumeState?: string | null;
    readonly costMode?: string | null;
    readonly variables?: readonly string[];
  },
): CatalogComponent {
  return {
    kind,
    ref: input.ref ?? null,
    name: input.name,
    unit: input.unit ?? null,
    coefficient: input.coefficient,
    source: input.source,
    note: input.note ?? null,
    referencePrice: input.referencePrice ?? null,
    volumeState: input.volumeState ?? null,
    costMode: input.costMode ?? null,
    variables: input.variables ?? [],
  };
}

function normalizeDynamicItem(
  source: DynamicBundleSource,
  raw: AhspItem,
  occurrence: number,
): CatalogItem {
  const tenaga = masterLookup(source.tenagaKerja);
  const bahan = masterLookup(source.bahanMaster);
  const peralatan = masterLookup(source.peralatanMaster);

  return {
    bundleId: source.id,
    bundleName: source.displayName,
    bundleVersion: source.meta.version,
    regulation: source.meta.ahs_meta.regulation,
    occurrence,
    code: raw.kode_ahsp,
    name: raw.nama,
    bidang: raw.bidang,
    divisi: raw.divisi,
    subDivision: raw.sub_divisi,
    unit: raw.satuan_bayar,
    calculationType: 'dynamic_hsd',
    workType: raw.jenis_pekerjaan,
    isLumpSum: raw.is_lump_sum,
    components: [
      ...raw.tenaga_kerja.map((entry) => {
        const master = tenaga.get(entry.ref);
        return component('tenaga kerja', {
          ref: entry.ref,
          name: master?.nama ?? entry.ref,
          unit: master?.satuan ?? 'OH',
          coefficient: entry.koefisien,
          source: entry.koef_sumber,
          note: entry.catatan,
        });
      }),
      ...raw.bahan.map((entry) => {
        const master = bahan.get(entry.ref);
        return component('bahan', {
          ref: entry.ref,
          name: entry.nama_override ?? master?.nama ?? entry.ref,
          unit: master?.satuan ?? null,
          coefficient: entry.koefisien,
          source: entry.koef_sumber,
          note: entry.catatan,
          volumeState: entry.volume_state,
        });
      }),
      ...raw.peralatan.map((entry) => {
        const master = peralatan.get(entry.ref);
        return component('peralatan', {
          ref: entry.ref,
          name: entry.nama || master?.nama || entry.ref,
          unit: 'jam',
          coefficient: entry.koef_referensi?.value ?? null,
          source: entry.koef_sumber,
          note: entry.catatan,
          volumeState: entry.volume_state,
          costMode: entry.mode_biaya,
          variables: entry.variabel_input,
        });
      }),
    ],
    variables: raw.variabel,
    subAhsp: raw.sub_ahsp,
    margin: raw.margin,
    provenance: raw.provenance,
    notes: raw.catatan_umum,
    referencePrice: null,
  };
}

function normalizeFixedItem(
  source: FixedBundleSource,
  raw: FixedCoefficientItem,
  occurrence: number,
): CatalogItem {
  return {
    bundleId: source.id,
    bundleName: source.displayName,
    bundleVersion: source.meta.version,
    regulation: source.meta.ahs_meta.regulation,
    occurrence,
    code: raw.kode_ahsp,
    name: raw.nama,
    bidang: raw.bidang,
    divisi: raw.divisi,
    subDivision: raw.sub_divisi,
    unit: raw.satuan_bayar,
    calculationType: 'fixed_coefficient',
    workType: raw.jenis_pekerjaan,
    isLumpSum: raw.is_lump_sum,
    components: [
      ...raw.tenaga_kerja.map((entry) =>
        component('tenaga kerja', {
          ref: entry.ref,
          name: entry.nama,
          unit: entry.satuan,
          coefficient: entry.koefisien,
          source: 'fixed',
          referencePrice: entry.harga_satuan_ref,
        }),
      ),
      ...raw.bahan.map((entry) =>
        component('bahan', {
          ref: entry.ref,
          name: entry.nama,
          unit: entry.satuan,
          coefficient: entry.koefisien,
          source: 'fixed',
          referencePrice: entry.harga_satuan_ref,
        }),
      ),
      ...raw.peralatan.map((entry) =>
        component('peralatan', {
          ref: entry.ref,
          name: entry.nama,
          unit: entry.satuan,
          coefficient: entry.koefisien,
          source: 'fixed',
          referencePrice: entry.harga_satuan_ref,
        }),
      ),
    ],
    variables: {},
    subAhsp: [],
    margin: raw.margin,
    provenance: raw.provenance,
    notes: [],
    referencePrice: raw.harga_satuan_pekerjaan_ref ?? null,
  };
}

function isQuarantined(source: BundleSource, item: CatalogItem): boolean {
  if (source.id !== 'cipta-karya-2024') return false;
  return CIPTA_KARYA_QUARANTINE.some(
    (rule) =>
      rule.code === item.code &&
      rule.name === item.name &&
      (rule.referencePrice === undefined || rule.referencePrice === item.referencePrice),
  );
}

function normalizeSource(source: BundleSource): readonly CatalogItem[] {
  const occurrences = new Map<string, number>();
  const normalized = source.items.map((raw) => {
    const occurrence = occurrences.get(raw.kode_ahsp) ?? 0;
    occurrences.set(raw.kode_ahsp, occurrence + 1);
    return 'variabel' in raw
      ? normalizeDynamicItem(source as DynamicBundleSource, raw, occurrence)
      : normalizeFixedItem(source as FixedBundleSource, raw, occurrence);
  });
  return normalized.filter((item) => !isQuarantined(source, item));
}

function bundleSummary(source: BundleSource, items: readonly CatalogItem[]): CatalogBundleSummary {
  const tiers = new Set(source.items.map((item) => item.provenance.verification_tier));
  return {
    id: source.id,
    name: source.displayName,
    version: source.meta.version,
    regulation: source.meta.ahs_meta.regulation,
    bidang: source.meta.ahs_meta.bidang,
    source: source.meta.ahs_meta.data_source,
    sourceItemCount: source.items.length,
    publicItemCount: items.length,
    verificationTiers: [...tiers],
  };
}

export function catalogItemKey(item: CatalogItem): string {
  return item.occurrence === 0
    ? `${item.bundleId}:${item.code}`
    : `${item.bundleId}:${item.code}:${item.occurrence}`;
}

export function catalogItemSlug(code: string): string {
  const readable = code.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
  const fingerprint = [...code]
    .map((character) => (character.codePointAt(0) ?? 0).toString(16).padStart(4, '0'))
    .join('');
  return `${readable}-${fingerprint}`;
}

export function catalogItemPath(bundleId: string, code: string): string {
  return `/item/${bundleId}/${catalogItemSlug(code)}/`;
}

export function buildCatalog(): Catalog {
  const sourceItemCount = SOURCES.reduce((count, source) => count + source.items.length, 0);
  const items = SOURCES.flatMap((source) => normalizeSource(source));
  const bundles = SOURCES.map((source) => {
    const publicItems = items.filter((item) => item.bundleId === source.id);
    return bundleSummary(source, publicItems);
  });

  return {
    items,
    bundles,
    sourceItemCount,
    quarantinedItemCount: sourceItemCount - items.length,
  };
}

export function getPublicCatalogItems(): readonly CatalogItem[] {
  return buildCatalog().items;
}

export function catalogSearchText(item: CatalogItem): string {
  return [item.code, item.name, item.bundleName, item.regulation, item.bidang].join(' ');
}

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
