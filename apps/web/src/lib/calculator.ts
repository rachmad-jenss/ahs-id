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
import { findPortalIndexEntry, PORTAL_BUNDLE_DISPLAY, PORTAL_BUNDLE_ID } from '@/lib/portal-hsp';
import { loadAhspSearchEntries, type SearchIndexEntry } from '@/lib/search-client';

type FixedCoefficientPackage = Extract<PackageRecord, { strategy: 'fixed-coefficient' }>;

const fixedItemsLoadCache = new Map<string, Promise<{ ahspItems: readonly FixedCoefficientItem[] }>>();

function loadFixedItemsCached(pkg: FixedCoefficientPackage): Promise<{ ahspItems: readonly FixedCoefficientItem[] }> {
  const existing = fixedItemsLoadCache.get(pkg.name);
  if (existing) return existing;
  const pending = pkg.loadItems();
  fixedItemsLoadCache.set(pkg.name, pending);
  return pending;
}

/** Warm bundle JSON in the background when the browser is idle (calc still loads on demand). */
export function prefetchCalculatorBundle(bundleName: string): void {
  if (bundleName === PORTAL_BUNDLE_ID) return;
  const pkg = findPackage(bundleName);
  if (!pkg || pkg.strategy === 'hsd-only') return;
  const warm = (): void => {
    if (pkg.strategy === 'fixed-coefficient') {
      void loadFixedItemsCached(pkg);
      return;
    }
    void pkg.loadBundle();
  };
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(warm, { timeout: 12_000 });
  } else {
    globalThis.setTimeout(warm, 2_000);
  }
}

function marginDefaultsFromSearchMeta(
  meta: SearchIndexEntry['meta'] | undefined,
): { readonly overhead_pct: number; readonly profit_pct: number } {
  const overhead = meta?.overhead_pct;
  const profit = meta?.profit_pct;
  return {
    overhead_pct: typeof overhead === 'number' && Number.isFinite(overhead) ? overhead : 10,
    profit_pct: typeof profit === 'number' && Number.isFinite(profit) ? profit : 5,
  };
}

export interface CalculatorBundleOption {
  readonly name: string;
  readonly displayName: string;
  readonly strategy: 'dynamic-bundle' | 'fixed-coefficient' | 'portal-lookup';
  readonly defaultHsd?: string;
  readonly compatibleHsd?: readonly string[];
}

/** Item metadata used to render kalkulator variable fields. */
export interface CalculatorItemMeta {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly strategy: 'dynamic-bundle' | 'fixed-coefficient' | 'portal-lookup';
  readonly bundleDisplayName: string;
  /** Item-level regulation citation from bundle provenance (when present). */
  readonly sumberRegulasi?: string;
  /** Declared AHSP variabel that can change the computed HSP for this item. */
  readonly variables: Readonly<Record<string, VariabelDefinition>>;
  readonly marginDefaults: {
    readonly overhead_pct: number;
    readonly profit_pct: number;
  };
}

/** Shown beside RAB breakdown so users know which bundles fed the calculation. */
export interface HspCalculationSources {
  readonly ahspBundle: string;
  readonly ahspRegulation?: string;
  readonly hsdCatalog?: string;
  readonly hsdDetail?: string;
  readonly fixedPriceNote?: string;
  readonly overlayNote?: string;
}

export interface CalculatorHsdMeta {
  readonly displayName: string;
  readonly wilayah: string;
  readonly dasarHukum: string;
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
  const engine = calculationPackages().map((pkg) => {
    if (pkg.strategy === 'dynamic-bundle') {
      return {
        name: pkg.name,
        displayName: pkg.displayName,
        strategy: 'dynamic-bundle' as const,
        defaultHsd: pkg.defaultHsd,
        compatibleHsd: pkg.compatibleHsd,
      };
    }
    return {
      name: pkg.name,
      displayName: pkg.displayName,
      strategy: 'fixed-coefficient' as const,
    };
  });
  return [
    ...engine,
    {
      name: PORTAL_BUNDLE_ID,
      displayName: PORTAL_BUNDLE_DISPLAY,
      strategy: 'portal-lookup' as const,
    },
  ];
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

/**
 * @deprecated Use {@link loadCalculatorItemMeta} — fixed bundles now resolve from the AHSP search shard only.
 */
export async function loadCalculatorItemMetaProvisional(input: {
  readonly bundle: string;
  readonly item: string;
}): Promise<CalculatorItemMeta | null> {
  try {
    return await loadCalculatorItemMeta(input);
  } catch {
    return null;
  }
}

function findAhspCoefInSearch(
  entries: readonly SearchIndexEntry[],
  bundleId: string,
  code: string,
): SearchIndexEntry {
  const matches = entries.filter(
    (row) => row.kind === 'ahsp-coef' && row.bundleId === bundleId && row.code === code,
  );
  const hit = matches[0];
  if (!hit) {
    throw new Error(`AHSP "${code}" tidak ditemukan di indeks ${bundleId}`);
  }
  if (matches.length > 1) {
    throw new Error(`AHSP "${code}" tidak unik di indeks ${bundleId}`);
  }
  return hit;
}

function dynamicMetaFromBundleRow(
  pkg: Extract<PackageRecord, { strategy: 'dynamic-bundle' }>,
  found: {
    readonly kode_ahsp: string;
    readonly nama: string;
    readonly provenance: { readonly sumber_regulasi?: string };
    readonly margin: {
      readonly overhead_pct: { readonly default: number };
      readonly profit_pct: { readonly default: number };
    };
    readonly variabel: Readonly<Record<string, VariabelDefinition>>;
    readonly peralatan: readonly EffectiveVariablePeralatan[];
  },
  base?: CalculatorItemMeta,
): CalculatorItemMeta {
  return {
    kode_ahsp: found.kode_ahsp,
    nama: found.nama,
    strategy: 'dynamic-bundle',
    bundleDisplayName: pkg.displayName,
    sumberRegulasi: found.provenance.sumber_regulasi || base?.sumberRegulasi,
    variables: effectiveVariablesFromAhsp(found),
    marginDefaults: {
      overhead_pct: found.margin.overhead_pct.default,
      profit_pct: found.margin.profit_pct.default,
    },
  };
}

/**
 * Fast path for the kalkulator form — search shards only (no full AHSP bundle JSON).
 * Dynamic bundles ship with `variables: {}` until {@link enrichDynamicCalculatorItemMeta}.
 */
export async function loadCalculatorItemMetaFromSearch(input: {
  readonly bundle: string;
  readonly item: string;
}): Promise<CalculatorItemMeta> {
  const code = input.item.trim();
  if (!code) {
    throw new Error('Kode AHSP kosong');
  }
  if (input.bundle === PORTAL_BUNDLE_ID) {
    const entry = await findPortalIndexEntry(code);
    return {
      kode_ahsp: entry.code,
      nama: entry.name,
      strategy: 'portal-lookup',
      bundleDisplayName: PORTAL_BUNDLE_DISPLAY,
      sumberRegulasi: entry.subtitle || undefined,
      variables: {},
      marginDefaults: { overhead_pct: 0, profit_pct: 0 },
    };
  }
  const pkg = assertCalcPackage(findPackage(input.bundle), input.bundle);
  switch (pkg.strategy) {
    case 'dynamic-bundle': {
      const entries = await loadAhspSearchEntries();
      try {
        const hit = findAhspCoefInSearch(entries, input.bundle, code);
        const sumber =
          typeof hit.meta?.sumber_regulasi === 'string'
            ? hit.meta.sumber_regulasi
            : undefined;
        return {
          kode_ahsp: hit.code,
          nama: hit.name,
          strategy: 'dynamic-bundle',
          bundleDisplayName: pkg.displayName,
          sumberRegulasi: sumber,
          variables: {},
          marginDefaults: marginDefaultsFromSearchMeta(hit.meta),
        };
      } catch {
        return loadDynamicCalculatorItemMetaFromBundle(pkg, code);
      }
    }
    case 'fixed-coefficient': {
      const entries = await loadAhspSearchEntries();
      const hit = findAhspCoefInSearch(entries, input.bundle, code);
      const sumber =
        typeof hit.meta?.sumber_regulasi === 'string'
          ? hit.meta.sumber_regulasi
          : undefined;
      return {
        kode_ahsp: hit.code,
        nama: hit.name,
        strategy: 'fixed-coefficient',
        bundleDisplayName: pkg.displayName,
        sumberRegulasi: sumber,
        variables: {},
        marginDefaults: marginDefaultsFromSearchMeta(hit.meta),
      };
    }
    default: {
      const unreachable: never = pkg;
      throw new Error(`Unhandled strategy: ${String(unreachable)}`);
    }
  }
}

async function loadDynamicCalculatorItemMetaFromBundle(
  pkg: Extract<PackageRecord, { strategy: 'dynamic-bundle' }>,
  code: string,
): Promise<CalculatorItemMeta> {
  const { bundle } = await pkg.loadBundle();
  const matches = bundle.ahsp_items.filter((row) => row.kode_ahsp === code);
  const found = matches[0];
  if (!found) throw new Error(`AHSP "${code}" tidak ditemukan di ${pkg.name}`);
  if (matches.length > 1) {
    throw new Error(`AHSP "${code}" tidak unik di ${pkg.name}`);
  }
  return dynamicMetaFromBundleRow(pkg, found);
}

/** Merge AHSP bundle variabel definitions after the search index quick path. */
export async function enrichDynamicCalculatorItemMeta(
  input: { readonly bundle: string; readonly item: string },
  base: CalculatorItemMeta,
): Promise<CalculatorItemMeta> {
  if (base.strategy !== 'dynamic-bundle') return base;
  const code = input.item.trim();
  const pkg = assertCalcPackage(findPackage(input.bundle), input.bundle);
  if (pkg.strategy !== 'dynamic-bundle') return base;
  const { bundle } = await pkg.loadBundle();
  const matches = bundle.ahsp_items.filter((row) => row.kode_ahsp === code);
  const found = matches[0];
  if (!found) throw new Error(`AHSP "${code}" tidak ditemukan di ${pkg.name}`);
  if (matches.length > 1) {
    throw new Error(`AHSP "${code}" tidak unik di ${pkg.name}`);
  }
  return dynamicMetaFromBundleRow(pkg, found, base);
}

/** Load AHSP item variable definitions for the calculator form. */
export async function loadCalculatorItemMeta(input: {
  readonly bundle: string;
  readonly item: string;
}): Promise<CalculatorItemMeta> {
  const base = await loadCalculatorItemMetaFromSearch(input);
  if (base.strategy === 'dynamic-bundle') {
    return enrichDynamicCalculatorItemMeta(input, base);
  }
  return base;
}

/** Load wilayah + legal basis text for the selected HSD catalog. */
export async function loadCalculatorHsdMeta(hsdName: string): Promise<CalculatorHsdMeta> {
  const pkg = findPackage(hsdName);
  if (!pkg || pkg.strategy !== 'hsd-only') {
    throw new Error(`Unknown HSD "${hsdName}"`);
  }
  const { hsd } = await pkg.loadHsd();
  const { region } = hsd;
  const wilayahParts = [
    region.provinsi,
    region.kuartal ? `Q${region.kuartal} ${region.tahun_berlaku}` : String(region.tahun_berlaku),
  ].filter(Boolean);
  return {
    displayName: pkg.displayName,
    wilayah: wilayahParts.join(' · '),
    dasarHukum: region.dasar_hukum,
  };
}

/** Build provenance labels for the calculator result panel. */
export function buildHspCalculationSources(input: {
  readonly bundleName: string;
  readonly hsdName?: string;
  readonly itemMeta: CalculatorItemMeta;
  readonly hsdMeta?: CalculatorHsdMeta | null;
}): HspCalculationSources {
  const base: HspCalculationSources = {
    ahspBundle: input.itemMeta.bundleDisplayName,
    ahspRegulation: input.itemMeta.sumberRegulasi,
  };
  if (input.itemMeta.strategy === 'portal-lookup') {
    return {
      ...base,
      fixedPriceNote:
        'Harga satuan publikasi portal Bangun Jakarta (DCKTRP). Bukan hasil hitung koefisien nasional + HSD regional.',
    };
  }
  if (input.itemMeta.strategy === 'fixed-coefficient') {
    return {
      ...base,
      fixedPriceNote:
        'Koefisien dan harga acuan komponen (`harga_satuan_ref`) dari bundel ini — tanpa katalog HSD regional.',
    };
  }
  let hsdCatalog: string | undefined;
  let hsdDetail: string | undefined;
  if (input.hsdMeta) {
    hsdDetail = [input.hsdMeta.wilayah, input.hsdMeta.dasarHukum].filter(Boolean).join(' — ');
    hsdCatalog = input.hsdMeta.displayName;
  } else if (input.hsdName) {
    hsdCatalog = hsdPackages().find((row) => row.name === input.hsdName)?.displayName ?? input.hsdName;
  }
  const overlayNote =
    input.bundleName === 'bina-marga-2022' && input.hsdName && input.hsdName !== 'hsd-bm-2022'
      ? 'Harga L/M/E mengikuti Permen (hsd-bm-2022) kecuali ref+nama+satuan cocok dengan HSD regional; '
        + 'wilayah dan bahan bakar mengikuti katalog regional yang dipilih.'
      : undefined;
  return {
    ...base,
    hsdCatalog,
    hsdDetail,
    overlayNote,
  };
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
  if (margin) {
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
      const loaded = await loadFixedItemsCached(pkg);
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
