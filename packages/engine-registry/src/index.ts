import type { DataBundle, FixedCoefficientItem, HsdRegional, PackageDataMode } from '@ahs-id/core';

export type BundleStrategy = 'dynamic-bundle' | 'fixed-coefficient' | 'hsd-only';

interface PackageBase {
  readonly name: string;
  readonly specifier: string;
  readonly validation: PackageDataMode;
  readonly displayName: string;
}

export type PackageRecord =
  | (PackageBase & {
      readonly strategy: 'dynamic-bundle';
      readonly loadBundle: () => Promise<{ bundle: DataBundle }>;
      readonly defaultHsd: string;
      readonly compatibleHsd: readonly string[];
    })
  | (PackageBase & {
      readonly strategy: 'fixed-coefficient';
      readonly loadItems: () => Promise<{ ahspItems: readonly FixedCoefficientItem[] }>;
    })
  | (PackageBase & {
      readonly strategy: 'hsd-only';
      readonly loadHsd: () => Promise<{ hsd: HsdRegional }>;
    });

/** Shared CLI ↔ web package registry (loaders are dynamic imports; no Node fs). */
export const PACKAGES: readonly PackageRecord[] = [
  {
    name: 'pupr-2023',
    specifier: '@ahs-id/pupr-2023',
    strategy: 'dynamic-bundle',
    validation: 'schema',
    displayName: 'Permen PUPR 8/2023',
    defaultHsd: 'hsd-kaltim-2025',
    compatibleHsd: ['hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025', 'hsd-jakarta-2026'],
    loadBundle: () => import('@ahs-id/pupr-2023'),
  },
  {
    name: 'bina-marga-2016',
    specifier: '@ahs-id/bina-marga-2016',
    strategy: 'dynamic-bundle',
    validation: 'syntax',
    displayName: 'Bina Marga 2016',
    defaultHsd: 'hsd-kaltim-2025',
    compatibleHsd: ['hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025', 'hsd-jakarta-2026'],
    loadBundle: () => import('@ahs-id/bina-marga-2016'),
  },
  {
    name: 'bina-marga-2022',
    specifier: '@ahs-id/bina-marga-2022',
    strategy: 'dynamic-bundle',
    validation: 'syntax',
    displayName: 'Bina Marga 2022',
    defaultHsd: 'hsd-bm-2022',
    // Regional catalogs use PUPR-scheme refs; loaders keep Permen BM base and overlay
    // only when ref+nama+satuan match (labor stays Permen). Fuels/region come from overlay.
    compatibleHsd: [
      'hsd-bm-2022',
      'hsd-kaltim-2025',
      'hsd-jabar-2025',
      'hsd-papua-2025',
      'hsd-jakarta-2026',
    ],
    loadBundle: () => import('@ahs-id/bina-marga-2022'),
  },
  {
    name: 'cipta-karya-2024',
    specifier: '@ahs-id/cipta-karya-2024',
    strategy: 'fixed-coefficient',
    validation: 'schema',
    displayName: 'Cipta Karya 2024',
    loadItems: () => import('@ahs-id/cipta-karya-2024'),
  },
  {
    name: 'sda-se-binkon-47-2026',
    specifier: '@ahs-id/ahsp-se-binkon-47-2026',
    strategy: 'fixed-coefficient',
    validation: 'schema',
    displayName: 'SDA — SE Binkon 47/2026',
    loadItems: async () => {
      const mod = await import('@ahs-id/ahsp-se-binkon-47-2026');
      return { ahspItems: mod.ahspItemsSda };
    },
  },
  {
    name: 'bina-marga-se-binkon-47-2026',
    specifier: '@ahs-id/ahsp-se-binkon-47-2026',
    strategy: 'fixed-coefficient',
    validation: 'schema',
    displayName: 'Bina Marga — SE Binkon 47/2026',
    loadItems: async () => {
      const mod = await import('@ahs-id/ahsp-se-binkon-47-2026');
      return { ahspItems: mod.ahspItemsBinaMarga };
    },
  },
  {
    name: 'cipta-karya-se-binkon-47-2026',
    specifier: '@ahs-id/ahsp-se-binkon-47-2026',
    strategy: 'fixed-coefficient',
    validation: 'schema',
    displayName: 'Cipta Karya — SE Binkon 47/2026',
    loadItems: async () => {
      const mod = await import('@ahs-id/ahsp-se-binkon-47-2026');
      return { ahspItems: mod.ahspItemsCiptaKarya };
    },
  },
  {
    name: 'hsd-kaltim-2025',
    specifier: '@ahs-id/hsd-kaltim-2025',
    strategy: 'hsd-only',
    validation: 'schema',
    displayName: 'HSD Kalimantan Timur 2025',
    loadHsd: () => import('@ahs-id/hsd-kaltim-2025'),
  },
  {
    name: 'hsd-jabar-2025',
    specifier: '@ahs-id/hsd-jabar-2025',
    strategy: 'hsd-only',
    validation: 'schema',
    displayName: 'HSD Jawa Barat 2025',
    loadHsd: () => import('@ahs-id/hsd-jabar-2025'),
  },
  {
    name: 'hsd-papua-2025',
    specifier: '@ahs-id/hsd-papua-2025',
    strategy: 'hsd-only',
    validation: 'schema',
    displayName: 'HSD Papua 2025',
    loadHsd: () => import('@ahs-id/hsd-papua-2025'),
  },
  {
    name: 'hsd-bm-2022',
    specifier: '@ahs-id/hsd-bm-2022',
    strategy: 'hsd-only',
    validation: 'schema',
    displayName: 'HSD Bina Marga 2022',
    loadHsd: () => import('@ahs-id/hsd-bm-2022'),
  },
  {
    name: 'hsd-jakarta-2026',
    specifier: '@ahs-id/hsd-jakarta-2026',
    strategy: 'hsd-only',
    validation: 'schema',
    displayName: 'HSD DKI Jakarta Q1 2026',
    loadHsd: () => import('@ahs-id/hsd-jakarta-2026'),
  },
];

/** Return registered package names in registry order. */
export function packageNames(): readonly string[] {
  return PACKAGES.map((pkg) => pkg.name);
}

/** Look up a package record by short name. */
export function findPackage(name: string): PackageRecord | undefined {
  return PACKAGES.find((pkg) => pkg.name === name);
}

/** Exhaustive guard for package strategy discriminants. */
export function assertKnownStrategy(strategy: BundleStrategy): void {
  switch (strategy) {
    case 'dynamic-bundle':
    case 'fixed-coefficient':
    case 'hsd-only':
      return;
    default: {
      const unreachable: never = strategy;
      throw new Error(`Unhandled package strategy: ${String(unreachable)}`);
    }
  }
}

/** Calculation-capable packages (excludes HSD-only). */
export function calculationPackages(): readonly PackageRecord[] {
  return PACKAGES.filter((pkg) => pkg.strategy !== 'hsd-only');
}

/** HSD-only packages. */
export function hsdPackages(): readonly PackageRecord[] {
  return PACKAGES.filter((pkg) => pkg.strategy === 'hsd-only');
}
