import {
  calcHspFixedCoefficient,
  createCalculator,
  type FixedCoefficientItem,
  type HSPResult,
} from '@ahs-id/core';
import {
  calculationPackages,
  findPackage,
  hsdPackages,
  type PackageRecord,
} from '@ahs-id/engine-registry';

export interface CalculatorBundleOption {
  readonly name: string;
  readonly displayName: string;
  readonly strategy: 'dynamic-bundle' | 'fixed-coefficient';
  readonly defaultHsd?: string;
  readonly compatibleHsd?: readonly string[];
}

export function listCalculatorBundles(): readonly CalculatorBundleOption[] {
  return calculationPackages().map((pkg) => {
    if (pkg.strategy === 'dynamic-bundle') {
      return {
        name: pkg.name,
        displayName: pkg.displayName,
        strategy: 'dynamic-bundle',
        defaultHsd: pkg.defaultHsd,
        compatibleHsd: pkg.compatibleHsd,
      };
    }
    return {
      name: pkg.name,
      displayName: pkg.displayName,
      strategy: 'fixed-coefficient',
    };
  });
}

export function listCalculatorHsd(): readonly { name: string; displayName: string }[] {
  return hsdPackages().map((pkg) => ({ name: pkg.name, displayName: pkg.displayName }));
}

type CalcPackage = Exclude<PackageRecord, { strategy: 'hsd-only' }>;

function assertCalcPackage(pkg: PackageRecord | undefined, name: string): CalcPackage {
  if (!pkg || pkg.strategy === 'hsd-only') {
    throw new Error(`Unknown calculation bundle "${name}"`);
  }
  return pkg;
}

/** Run HSP calculation for a registry bundle (browser-safe dynamic imports). */
export async function calculateHspInBrowser(input: {
  readonly bundle: string;
  readonly item: string;
  readonly hsd?: string;
  readonly variables?: Readonly<Record<string, number | string>>;
}): Promise<HSPResult> {
  const pkg = assertCalcPackage(findPackage(input.bundle), input.bundle);
  switch (pkg.strategy) {
    case 'dynamic-bundle': {
      const hsdName = input.hsd ?? pkg.defaultHsd;
      if (!pkg.compatibleHsd.includes(hsdName)) {
        throw new Error(`HSD "${hsdName}" tidak kompatibel dengan ${pkg.name}`);
      }
      const hsdPkg = findPackage(hsdName);
      if (!hsdPkg || hsdPkg.strategy !== 'hsd-only') {
        throw new Error(`Unknown HSD "${hsdName}"`);
      }
      const [bundleMod, hsdMod] = await Promise.all([pkg.loadBundle(), hsdPkg.loadHsd()]);
      const calculator = createCalculator(bundleMod.bundle, hsdMod.hsd);
      return calculator.hitungHSP(input.item, { ...(input.variables ?? {}) });
    }
    case 'fixed-coefficient': {
      if (input.hsd) {
        throw new Error(`${pkg.name} tidak memakai HSD`);
      }
      const loaded = await pkg.loadItems();
      const matches = loaded.ahspItems.filter((row: FixedCoefficientItem) => row.kode_ahsp === input.item);
      const found = matches[0];
      if (!found) throw new Error(`AHSP "${input.item}" tidak ditemukan di ${pkg.name}`);
      if (matches.length > 1) {
        throw new Error(`AHSP "${input.item}" tidak unik di ${pkg.name}`);
      }
      const overhead = input.variables?.overhead_pct;
      const profit = input.variables?.profit_pct;
      return calcHspFixedCoefficient(found, {
        overhead_pct: typeof overhead === 'number' ? overhead : undefined,
        profit_pct: typeof profit === 'number' ? profit : undefined,
      });
    }
    default: {
      const unreachable: never = pkg;
      throw new Error(`Unhandled strategy: ${String(unreachable)}`);
    }
  }
}
