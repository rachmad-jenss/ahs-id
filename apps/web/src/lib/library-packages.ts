import type { HsdRegional, VerificationTier } from '@ahs-id/core';
import { hsd as hsdBm2022 } from '@ahs-id/hsd-bm-2022';
import { hsd as hsdJabar2025 } from '@ahs-id/hsd-jabar-2025';
import { hsd as hsdJakarta2026 } from '@ahs-id/hsd-jakarta-2026';
import { hsd as hsdKaltim2025 } from '@ahs-id/hsd-kaltim-2025';
import { hsd as hsdPapua2025 } from '@ahs-id/hsd-papua-2025';
import { bundleIndex as ahspBySourceIndex } from '@ahs-id/ahsp-dcktrp-by-source';
import { manifest as hspJakartaManifest } from '@ahs-id/hsp-jakarta-dcktrp';

export type LibraryPackageKind = 'engine' | 'cli' | 'ahsp' | 'hsp' | 'hsd';

export interface LibraryPackageSummary {
  readonly id: string;
  readonly npmName: string;
  readonly kind: LibraryPackageKind;
  readonly title: string;
  readonly description: string;
  readonly githubPath: string;
  readonly npmUrl: string;
  readonly verificationTier?: VerificationTier;
  readonly verificationLabel?: string;
  readonly legalBasis?: string;
  readonly verificationNote?: string;
  /** Item count for catalog-style bundles (e.g. HSP portal). */
  readonly itemCount?: number;
}

/** Tiga lapisan data Jakarta — dipakai di metodologi & bundles. */
export const JAKARTA_DATA_LAYERS = {
  ahspRegulasi: {
    title: 'AHSP menurut regulasi sumber',
    description:
      'Koefisien per dasar hukum: @ahs-id/ahsp-dcktrp-by-source (sub-bundel SE/Permen dari breakdown portal) plus bundel nasional (pupr-2023, cipta-karya-2024, …).',
    npmName: '@ahs-id/ahsp-dcktrp-by-source',
  },
  hsdDaerah: {
    title: 'HSD daerah DKI',
    description:
      'Harga komponen (L/M/E) untuk wilayah Jakarta — dipasang ke createCalculator bersama bundel AHSP nasional.',
    npmName: '@ahs-id/hsd-jakarta-2026',
  },
  hspPortal: {
    title: 'HSP jadi (portal DCKTRP)',
    description:
      'Katalog harga satuan pekerjaan yang sudah dihitung di Bangun Jakarta; tiap item punya dasar_hukum sendiri (banyak SE dalam satu indeks).',
    npmName: '@ahs-id/hsp-jakarta-dcktrp',
  },
} as const;

export const VERIFICATION_TIER_LABELS: Record<VerificationTier, string> = {
  'auto-extracted': 'Ekstraksi otomatis',
  'spot-checked': 'Diperiksa sampel',
  verified: 'Terverifikasi',
  executed: 'Teruji',
};

export const ENGINE_AND_CLI_PACKAGES: readonly LibraryPackageSummary[] = [
  {
    id: 'core',
    npmName: '@ahs-id/core',
    kind: 'engine',
    title: 'Engine kalkulasi',
    description: 'createCalculator, hitungHSP, produktivitas, validasi bundel, export RAB Excel, peringatan HSD usang.',
    githubPath: 'packages/core',
    npmUrl: 'https://www.npmjs.com/package/@ahs-id/core',
  },
  {
    id: 'cli',
    npmName: '@ahs-id/cli',
    kind: 'cli',
    title: 'CLI ahs-id',
    description: 'calc-hsp, export-rab, dan validate dari terminal — cocok untuk CI dan skrip lokal.',
    githubPath: 'apps/cli',
    npmUrl: 'https://www.npmjs.com/package/@ahs-id/cli',
  },
];

export function summarizeHsdPackage(
  id: string,
  npmName: string,
  title: string,
  description: string,
  hsd: HsdRegional,
): LibraryPackageSummary {
  const { region } = hsd;
  return {
    id,
    npmName,
    kind: 'hsd',
    title,
    description,
    githubPath: `packages/${id}`,
    npmUrl: `https://www.npmjs.com/package/${npmName}`,
    verificationTier: region.verification_tier,
    verificationLabel: VERIFICATION_TIER_LABELS[region.verification_tier],
    legalBasis: region.dasar_hukum,
    verificationNote: region.verification_note,
  };
}

export function buildAhspBySourceLibraryPackages(): LibraryPackageSummary[] {
  return [
    {
      id: 'ahsp-dcktrp-by-source',
      npmName: '@ahs-id/ahsp-dcktrp-by-source',
      kind: 'ahsp',
      title: 'AHSP per dasar hukum (portal DCKTRP)',
      description: `${ahspBySourceIndex.length} sub-bundel SE/Permen — koefisien fixed_coefficient + provenance & tautan dokumen.`,
      githubPath: 'packages/ahsp-dcktrp-by-source',
      npmUrl: 'https://www.npmjs.com/package/@ahs-id/ahsp-dcktrp-by-source',
      verificationTier: 'auto-extracted',
      verificationLabel: VERIFICATION_TIER_LABELS['auto-extracted'],
      legalBasis: ahspBySourceIndex.map((b) => b.title).join(' · '),
      verificationNote:
        'Derived dari breakdown HSP Bangun Jakarta; bandingkan dengan PDF lampiran SE resmi sebelum tender.',
      itemCount: ahspBySourceIndex.reduce((sum, b) => sum + b.item_count, 0),
    },
  ];
}

export function buildHspLibraryPackages(): LibraryPackageSummary[] {
  const topRefs = hspJakartaManifest.dasar_hukum_summary?.slice(0, 2) ?? [];
  const legalSnippet =
    topRefs.length > 0
      ? topRefs.map((r) => `${r.label} (${r.item_count.toLocaleString('id-ID')} item)`).join('; ')
      : 'Beragam SE Binkon & Permen PUPR per item';

  return [
    {
      id: 'hsp-jakarta-dcktrp',
      npmName: '@ahs-id/hsp-jakarta-dcktrp',
      kind: 'hsp',
      title: 'HSP DKI — portal Bangun Jakarta',
      description:
        'Katalog harga satuan pekerjaan jadi + breakdown komponen (JSONL). Untuk lookup & benchmark, bukan jalur hitungHSP dari koefisien.',
      githubPath: 'packages/hsp-jakarta-dcktrp',
      npmUrl: 'https://www.npmjs.com/package/@ahs-id/hsp-jakarta-dcktrp',
      verificationTier: 'auto-extracted',
      verificationLabel: VERIFICATION_TIER_LABELS['auto-extracted'],
      legalBasis: legalSnippet,
      verificationNote: hspJakartaManifest.verification_note,
      itemCount: hspJakartaManifest.item_count,
    },
  ];
}

export function sortLibraryPackages(packages: readonly LibraryPackageSummary[]): LibraryPackageSummary[] {
  const order: Record<LibraryPackageKind, number> = { engine: 0, cli: 1, ahsp: 2, hsp: 3, hsd: 4 };
  return [...packages].sort((left, right) => order[left.kind] - order[right.kind] || left.title.localeCompare(right.title, 'id'));
}

/** HSD bundles published on npm with verification metadata from each `hsd.json`. */
export function buildHsdLibraryPackages(): LibraryPackageSummary[] {
  return [
    summarizeHsdPackage(
      'hsd-jabar-2025',
      '@ahs-id/hsd-jabar-2025',
      'HSD Jawa Barat Q1 2025',
      'Dataset referensi band harga rendah untuk uji lintas wilayah.',
      hsdJabar2025,
    ),
    summarizeHsdPackage(
      'hsd-kaltim-2025',
      '@ahs-id/hsd-kaltim-2025',
      'HSD Kalimantan Timur Q1 2025',
      'Dataset referensi band harga menengah; dipakai di golden test engine.',
      hsdKaltim2025,
    ),
    summarizeHsdPackage(
      'hsd-papua-2025',
      '@ahs-id/hsd-papua-2025',
      'HSD Papua Q1 2025',
      'Dataset referensi band harga tinggi untuk skenario wilayah jauh.',
      hsdPapua2025,
    ),
    summarizeHsdPackage(
      'hsd-bm-2022',
      '@ahs-id/hsd-bm-2022',
      'HSD Bina Marga 2022',
      'Tarif lampiran Permen PUPR 1/2022 untuk jalur kalkulasi Bina Marga 2022.',
      hsdBm2022,
    ),
    summarizeHsdPackage(
      'hsd-jakarta-2026',
      '@ahs-id/hsd-jakarta-2026',
      'HSD DKI Jakarta Q1 2026',
      'Harga komponen agregasi dari portal DCKTRP; dipakai dengan bundel AHSP nasional.',
      hsdJakarta2026,
    ),
  ];
}

/** Engine, CLI, katalog HSP portal, dan paket HSD regional. */
export function buildEngineAndHsdLibraryPackages(): LibraryPackageSummary[] {
  return sortLibraryPackages([
    ...ENGINE_AND_CLI_PACKAGES,
    ...buildAhspBySourceLibraryPackages(),
    ...buildHspLibraryPackages(),
    ...buildHsdLibraryPackages(),
  ]);
}
