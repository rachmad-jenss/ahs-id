import { calcHspFixedCoefficient, createCalculator, type DataBundle, type FixedCoefficientItem, type HsdRegional, type HSPResult } from '@ahs-id/core';
import { findPackage, PACKAGES, type PackageRecord } from './registry.js';

export interface CalculatorBundle {
  bundle: DataBundle;
  hsd: HsdRegional;
  hsdName: string;
}

export interface FixedBundle {
  items: readonly FixedCoefficientItem[];
}

export type ResolvedCalculation =
  | ({ kind: 'dynamic-bundle' } & CalculatorBundle)
  | ({ kind: 'fixed-coefficient' } & FixedBundle);

function calculationPackages(): readonly PackageRecord[] {
  return PACKAGES.filter((pkg) => pkg.strategy !== 'hsd-only');
}

export function listAvailableBundles(): string[] {
  return calculationPackages().map((pkg) => pkg.name);
}

export function listAvailableHsd(): string[] {
  return PACKAGES.filter((pkg) => pkg.strategy === 'hsd-only').map((pkg) => pkg.name);
}

export function parseKeyValue(value: string): Record<string, string | number> {
  const eqIndex = value.indexOf('=');
  if (eqIndex === -1) {
    throw new Error(`Invalid key=value pair: "${value}". Use format key=value`);
  }
  const k = value.slice(0, eqIndex).trim();
  const v = value.slice(eqIndex + 1).trim();
  if (k.length === 0 || v.length === 0) {
    throw new Error(`Invalid key=value pair: "${value}". Use format key=value`);
  }
  const num = Number(v);
  return { [k]: Number.isNaN(num) ? v : num };
}

export function resolveHsdName(bundleName: string, hsdName: string | undefined): string {
  const pkg = findPackage(bundleName);
  if (!pkg || pkg.strategy === 'hsd-only') {
    throw new Error(`Unknown bundle "${bundleName}". Available: ${listAvailableBundles().join(', ')}`);
  }
  if (pkg.strategy === 'fixed-coefficient') {
    throw new Error(`${bundleName} does not use an HSD bundle`);
  }
  if (hsdName === undefined) return pkg.defaultHsd;
  const hsd = findPackage(hsdName);
  if (!hsd || hsd.strategy !== 'hsd-only') {
    throw new Error(`Unknown HSD "${hsdName}". Available: ${listAvailableHsd().join(', ')}`);
  }
  if (!pkg.compatibleHsd.includes(hsdName)) {
    throw new Error(`HSD "${hsdName}" is not compatible with ${bundleName}. Available: ${pkg.compatibleHsd.join(', ')}`);
  }
  return hsdName;
}

export async function resolveBundle(bundleName: string, hsdName?: string): Promise<CalculatorBundle> {
  const resolved = await resolveCalculation(bundleName, hsdName);
  if (resolved.kind !== 'dynamic-bundle') {
    throw new Error(`${bundleName} does not use an HSD bundle`);
  }
  return resolved;
}

export async function resolveCalculation(bundleName: string, hsdName?: string): Promise<ResolvedCalculation> {
  const pkg = findPackage(bundleName);
  if (!pkg || pkg.strategy === 'hsd-only') {
    throw new Error(`Unknown bundle "${bundleName}". Available: ${listAvailableBundles().join(', ')}`);
  }
  switch (pkg.strategy) {
    case 'dynamic-bundle': {
      const resolvedHsd = resolveHsdName(bundleName, hsdName);
      const hsdPkg = findPackage(resolvedHsd);
      if (!hsdPkg || hsdPkg.strategy !== 'hsd-only') {
        throw new Error(`Unknown HSD "${resolvedHsd}"`);
      }
      const [bundleMod, hsdMod] = await Promise.all([pkg.loadBundle(), hsdPkg.loadHsd()]);
      return { kind: 'dynamic-bundle', bundle: bundleMod.bundle, hsd: hsdMod.hsd, hsdName: resolvedHsd };
    }
    case 'fixed-coefficient': {
      if (hsdName !== undefined) {
        throw new Error(`${bundleName} does not use an HSD bundle`);
      }
      const loaded = await pkg.loadItems();
      return { kind: 'fixed-coefficient', items: loaded.ahspItems };
    }
    default: {
      const unreachable: never = pkg;
      throw new Error(`Unhandled bundle strategy: ${String(unreachable)}`);
    }
  }
}

export function findFixedItem(items: readonly FixedCoefficientItem[], kode: string): FixedCoefficientItem {
  const matches = items.filter((item) => item.kode_ahsp === kode);
  const found = matches[0];
  if (!found) throw new Error(`AHSP "${kode}" not found`);
  if (matches.length > 1) {
    throw new Error(`AHSP "${kode}" matches ${matches.length} items. Item codes in this bundle are not unique.`);
  }
  return found;
}

export async function calculateHsp(
  bundleName: string,
  kode: string,
  hsdName: string | undefined,
  variables: Record<string, string | number>,
): Promise<{ result: HSPResult; hsdName: string | null }> {
  const resolved = await resolveCalculation(bundleName, hsdName);
  switch (resolved.kind) {
    case 'dynamic-bundle': {
      const calc = createCalculator(resolved.bundle, resolved.hsd);
      return { result: calc.hitungHSP(kode, variables), hsdName: resolved.hsdName };
    }
    case 'fixed-coefficient': {
      const unknown = Object.keys(variables).filter((key) => key !== 'overhead_pct' && key !== 'profit_pct');
      if (unknown.length > 0) {
        throw new Error(`Unsupported variable for ${bundleName}: ${unknown.join(', ')}`);
      }
      const overhead = variables['overhead_pct'];
      const profit = variables['profit_pct'];
      const opts: { overhead_pct?: number; profit_pct?: number } = {};
      if (typeof overhead === 'number') opts.overhead_pct = overhead;
      if (typeof profit === 'number') opts.profit_pct = profit;
      return {
        result: calcHspFixedCoefficient(findFixedItem(resolved.items, kode), opts),
        hsdName: null,
      };
    }
    default: {
      const unreachable: never = resolved;
      throw new Error(`Unhandled calculation: ${String(unreachable)}`);
    }
  }
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
