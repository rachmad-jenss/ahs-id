import {
  calcHspFixedCoefficient,
  createCalculator,
  type FixedCoefficientItem,
  type HSPResult,
  type VariabelDefinition,
} from '@ahs-id/core';
import {
  calculationPackages,
  findPackage,
  hsdPackages,
  loadResolvedHsdForBundle,
  type PackageRecord,
} from '@ahs-id/engine-registry';

export interface CalculatorBundleOption {
  readonly name: string;
  readonly displayName: string;
  readonly strategy: 'dynamic-bundle' | 'fixed-coefficient';
  readonly defaultHsd?: string;
  readonly compatibleHsd?: readonly string[];
}

/** Item metadata used to render kalkulator variable fields. */
export interface CalculatorItemMeta {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly strategy: 'dynamic-bundle' | 'fixed-coefficient';
  /** Declared AHSP variabel that can change the computed HSP for this item. */
  readonly variables: Readonly<Record<string, VariabelDefinition>>;
  readonly marginDefaults: {
    readonly overhead_pct: number;
    readonly profit_pct: number;
  };
}

/** Minimal peralatan shape for deciding which declared variabel affect HSP. */
export interface EffectiveVariablePeralatan {
  readonly koef_sumber: 'tabel' | 'kalkulasi';
  readonly variabel_input: readonly string[];
}

/**
 * Keep only variabel keys the engine can consume for this item.
 * Tabel-coefficient peralatan ignore haul inputs; kalkulasi reads `variabel_input`.
 * `kondisi_operasi` / `jenis_material` still affect HSD rate / bahan conversion when declared.
 */
export function effectiveVariablesFromAhsp(item: {
  readonly variabel: Readonly<Record<string, VariabelDefinition>>;
  readonly peralatan: readonly EffectiveVariablePeralatan[];
}): Readonly<Record<string, VariabelDefinition>> {
  const keys = new Set<string>();
  let hasKalkulasi = false;
  for (const entry of item.peralatan) {
    if (entry.koef_sumber !== 'kalkulasi') continue;
    hasKalkulasi = true;
    for (const key of entry.variabel_input) keys.add(key);
  }
  if (hasKalkulasi && 'faktor_efisiensi' in item.variabel) {
    keys.add('faktor_efisiensi');
  }
  if ('kondisi_operasi' in item.variabel) keys.add('kondisi_operasi');
  if ('jenis_material' in item.variabel) keys.add('jenis_material');

  const next: Record<string, VariabelDefinition> = {};
  for (const key of keys) {
    const def = item.variabel[key];
    if (def) next[key] = def;
  }
  return next;
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

/** Load AHSP item variable definitions for the calculator form. */
export async function loadCalculatorItemMeta(input: {
  readonly bundle: string;
  readonly item: string;
}): Promise<CalculatorItemMeta> {
  const pkg = assertCalcPackage(findPackage(input.bundle), input.bundle);
  const code = input.item.trim();
  if (!code) {
    throw new Error('Kode AHSP kosong');
  }
  switch (pkg.strategy) {
    case 'dynamic-bundle': {
      const { bundle } = await pkg.loadBundle();
      const matches = bundle.ahsp_items.filter((row) => row.kode_ahsp === code);
      const found = matches[0];
      if (!found) throw new Error(`AHSP "${code}" tidak ditemukan di ${pkg.name}`);
      if (matches.length > 1) {
        throw new Error(`AHSP "${code}" tidak unik di ${pkg.name}`);
      }
      return {
        kode_ahsp: found.kode_ahsp,
        nama: found.nama,
        strategy: 'dynamic-bundle',
        variables: effectiveVariablesFromAhsp(found),
        marginDefaults: {
          overhead_pct: found.margin.overhead_pct.default,
          profit_pct: found.margin.profit_pct.default,
        },
      };
    }
    case 'fixed-coefficient': {
      const loaded = await pkg.loadItems();
      const matches = loaded.ahspItems.filter((row: FixedCoefficientItem) => row.kode_ahsp === code);
      const found = matches[0];
      if (!found) throw new Error(`AHSP "${code}" tidak ditemukan di ${pkg.name}`);
      if (matches.length > 1) {
        throw new Error(`AHSP "${code}" tidak unik di ${pkg.name}`);
      }
      return {
        kode_ahsp: found.kode_ahsp,
        nama: found.nama,
        strategy: 'fixed-coefficient',
        variables: {},
        marginDefaults: {
          overhead_pct: found.margin.overhead_pct.default,
          profit_pct: found.margin.profit_pct.default,
        },
      };
    }
    default: {
      const unreachable: never = pkg;
      throw new Error(`Unhandled strategy: ${String(unreachable)}`);
    }
  }
}

/** Seed form values from item variable defaults (skips null defaults). */
export function defaultsFromItemMeta(meta: CalculatorItemMeta): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, def] of Object.entries(meta.variables)) {
    if (def.default === null || def.default === undefined) continue;
    next[key] = String(def.default);
  }
  return next;
}

/** Parse form strings into typed variabel payload for hitungHSP / fixed margin. */
export function parseCalculatorVariables(
  meta: CalculatorItemMeta,
  raw: Readonly<Record<string, string>>,
  margin?: { readonly overhead: string; readonly profit: string },
): Record<string, number | string> {
  const variables: Record<string, number | string> = {};
  for (const [key, def] of Object.entries(meta.variables)) {
    const text = raw[key]?.trim() ?? '';
    if (!text) {
      if (def.required) {
        throw new Error(`Variabel "${key}" wajib diisi`);
      }
      continue;
    }
    if (def.tipe === 'number') {
      const value = Number(text);
      if (!Number.isFinite(value)) {
        throw new Error(`Variabel "${key}" harus angka`);
      }
      variables[key] = value;
      continue;
    }
    if (def.tipe === 'enum') {
      variables[key] = text;
      continue;
    }
    const unreachable: never = def.tipe;
    throw new Error(`Tipe variabel tidak didukung: ${String(unreachable)}`);
  }
  if (meta.strategy === 'fixed-coefficient' && margin) {
    const overheadText = margin.overhead.trim();
    const profitText = margin.profit.trim();
    if (overheadText) {
      const overheadPct = Number(overheadText);
      if (!Number.isFinite(overheadPct)) throw new Error('Overhead % harus angka');
      variables.overhead_pct = overheadPct;
    }
    if (profitText) {
      const profitPct = Number(profitText);
      if (!Number.isFinite(profitPct)) throw new Error('Profit % harus angka');
      variables.profit_pct = profitPct;
    }
  }
  return variables;
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
      const [bundleMod, hsd] = await Promise.all([
        pkg.loadBundle(),
        loadResolvedHsdForBundle(input.bundle, hsdName),
      ]);
      const calculator = createCalculator(bundleMod.bundle, hsd);
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
