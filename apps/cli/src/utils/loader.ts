import type { DataBundle, HsdRegional } from '@ahs-id/core';

export interface CalculatorBundle {
  bundle: DataBundle;
  hsd: HsdRegional;
}

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

const BUNDLE_REGISTRY: Record<string, () => Promise<CalculatorBundle>> = {
  'pupr-2023': async () => {
    const [{ bundle }, { hsd }] = await Promise.all([
      import('@ahs-id/pupr-2023'),
      import('@ahs-id/hsd-kaltim-2025'),
    ]);
    return { bundle: bundle as DataBundle, hsd: hsd as HsdRegional };
  },
  'bina-marga-2022': async () => {
    const [bmMod, hsdMod] = await Promise.all([
      import('@ahs-id/bina-marga-2022'),
      import('@ahs-id/hsd-bm-2022'),
    ]);
    return { bundle: bmMod.bundle as DataBundle, hsd: hsdMod.hsd as HsdRegional, note: 'pre-calculated (calcHspFromBundle)' };
  },
};

export async function resolveBundle(bundleName: string): Promise<CalculatorBundle> {
  const loader = BUNDLE_REGISTRY[bundleName];
  if (!loader) {
    const available = Object.keys(BUNDLE_REGISTRY).join(', ');
    throw new Error(
      `Unknown bundle "${bundleName}". Available: ${available}`,
    );
  }
  return loader();
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function listAvailableBundles(): string[] {
  return Object.keys(BUNDLE_REGISTRY);
}
