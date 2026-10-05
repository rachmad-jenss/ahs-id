import type { HsdRegional, VerificationTier } from '@ahs-id/core';
import { hsd as hsdBm2022 } from '@ahs-id/hsd-bm-2022';
import { hsd as hsdJabar2025 } from '@ahs-id/hsd-jabar-2025';
import { hsd as hsdKaltim2025 } from '@ahs-id/hsd-kaltim-2025';
import { hsd as hsdPapua2025 } from '@ahs-id/hsd-papua-2025';

export type LibraryPackageKind = 'engine' | 'cli' | 'ahsp' | 'hsd';

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
}

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

export function sortLibraryPackages(packages: readonly LibraryPackageSummary[]): LibraryPackageSummary[] {
  const order: Record<LibraryPackageKind, number> = { engine: 0, cli: 1, ahsp: 2, hsd: 3 };
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
  ];
}

export function buildEngineAndHsdLibraryPackages(): LibraryPackageSummary[] {
  return sortLibraryPackages([...ENGINE_AND_CLI_PACKAGES, ...buildHsdLibraryPackages()]);
}
