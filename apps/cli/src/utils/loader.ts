import type { DataBundle, HsdRegional } from '@ahs-id/core';

export interface CalculatorBundle {
  bundle: DataBundle;
  hsd: HsdRegional;
  hsdName: string;
}

export const BUNDLE_NAMES = ['pupr-2023', 'bina-marga-2022'] as const;
export const HSD_NAMES = ['hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025', 'hsd-bm-2022'] as const;

const DEFAULT_HSD: Record<(typeof BUNDLE_NAMES)[number], (typeof HSD_NAMES)[number]> = {
  'pupr-2023': 'hsd-kaltim-2025',
  'bina-marga-2022': 'hsd-bm-2022',
};

type BundleModule = { bundle: DataBundle };
type HsdModule = { hsd: HsdRegional };

const BUNDLE_LOADERS: Record<(typeof BUNDLE_NAMES)[number], () => Promise<BundleModule>> = {
  'pupr-2023': () => import('@ahs-id/pupr-2023'),
  'bina-marga-2022': () => import('@ahs-id/bina-marga-2022'),
};

const HSD_LOADERS: Record<(typeof HSD_NAMES)[number], () => Promise<HsdModule>> = {
  'hsd-kaltim-2025': () => import('@ahs-id/hsd-kaltim-2025'),
  'hsd-jabar-2025': () => import('@ahs-id/hsd-jabar-2025'),
  'hsd-papua-2025': () => import('@ahs-id/hsd-papua-2025'),
  'hsd-bm-2022': () => import('@ahs-id/hsd-bm-2022'),
};

export function parseKeyValue(value: string): Record<string, string | number> {
  const eqIndex = value.indexOf('=');
  if (eqIndex === -1) {
    throw new Error(`Invalid key=value pair: "${value}". Use format key=value`);
  }
  const k = value.slice(0, eqIndex);
  const v = value.slice(eqIndex + 1);
  const num = Number(v);
  return { [k]: Number.isNaN(num) ? v : num };
}

export function resolveHsdName(bundleName: string, hsdName: string | undefined): string {
  if (!(BUNDLE_NAMES as readonly string[]).includes(bundleName)) {
    throw new Error(`Unknown bundle "${bundleName}". Available: ${BUNDLE_NAMES.join(', ')}`);
  }
  if (hsdName === undefined) {
    return DEFAULT_HSD[bundleName as (typeof BUNDLE_NAMES)[number]];
  }
  if (!(HSD_NAMES as readonly string[]).includes(hsdName)) {
    throw new Error(`Unknown HSD "${hsdName}". Available: ${HSD_NAMES.join(', ')}`);
  }
  return hsdName;
}

export async function resolveBundle(bundleName: string, hsdName?: string): Promise<CalculatorBundle> {
  const resolvedHsd = resolveHsdName(bundleName, hsdName);
  const bundleLoader = BUNDLE_LOADERS[bundleName as (typeof BUNDLE_NAMES)[number]];
  const hsdLoader = HSD_LOADERS[resolvedHsd as (typeof HSD_NAMES)[number]];
  const [bundleMod, hsdMod] = await Promise.all([bundleLoader(), hsdLoader()]);
  return {
    bundle: bundleMod.bundle,
    hsd: hsdMod.hsd,
    hsdName: resolvedHsd,
  };
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function listAvailableBundles(): string[] {
  return [...BUNDLE_NAMES];
}

export function listAvailableHsd(): string[] {
  return [...HSD_NAMES];
}
