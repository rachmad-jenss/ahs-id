import type {
  AhspItem,
  HSPResult,
  DataBundle,
  HsdRegional,
  VariabelInput,
  CalculatorConfig,
  AuditEntry,
  KondisiOperasi,
  FaktorKonversiEntry,
  VolumeState,
} from '../types/index.js';
import { volume as cubicMetres } from '../types/domain.js';
import { brandHsdRegional } from './brand-hsd.js';
import { hitungHsdPeralatanAny } from './hsd-peralatan.js';
import { assembleHspResult, type PricedComponent, type PricedGroup } from './assemble-result.js';
import { convertVolume } from './konversi-volume.js';
import { resolveSubAhsp } from './sub-ahsp.js';
import {
  assertFiniteMoney,
  validateDeclaredVariabel,
  validateRootVariabel,
} from './validate-runtime.js';
import {
  produktivitasDumpTruck,
  produktivitasExcavator,
  produktivitasWheelLoader,
  produktivitasWaterTanker,
  produktivitasVibroRoller,
  produktivitasMotorGrader,
  produktivitasThroughput,
  type ProduktivitasResult,
} from './produktivitas/index.js';
import type { SiklusDumpTruckParams, SiklusExcavatorParams, SiklusWheelLoaderParams, SiklusWaterTankerParams } from './produktivitas/siklus.js';
import type { LintasanVibroRollerParams, LintasanMotorGraderParams } from './produktivitas/lintasan.js';
import type { ThroughputParams } from './produktivitas/throughput.js';

export interface Calculator {
  readonly hitungHSP: (kodeAhsp: string, variabel: VariabelInput) => HSPResult;
}

export function createCalculator(
  bundle: DataBundle,
  hsdInput: HsdRegional,
  config?: CalculatorConfig,
): Calculator {
  const hsd = brandHsdRegional(hsdInput);
  const alatMap = new Map(bundle.peralatan.items.map((a) => [a.kode, a]));
  const bahanMasterMap = new Map(bundle.bahan.items.map((b) => [b.kode, b]));
  const fkMap = new Map(bundle.faktor_konversi.items.map((f) => [f.material, f]));
  const mode = config?.mode ?? 'penuh';
  const stalenessDays = config?.hsd_staleness_warning_days;

  function hitungHSPInternal(
    kodeAhsp: string,
    variabel: VariabelInput,
    resolveStack: readonly string[],
  ): HSPResult {
    const item = bundle.ahsp_items.find((a) => a.kode_ahsp === kodeAhsp);
    if (!item) {
      throw new Error(`AHSP item "${kodeAhsp}" not found in bundle`);
    }

    if (resolveStack.length === 0) {
      validateRootVariabel(item, variabel);
    } else {
      validateDeclaredVariabel(item, variabel);
    }
    assertModelledItem(item);

    const audit: AuditEntry[] = [];
    const warnings: string[] = [];

    if (stalenessDays !== undefined && stalenessDays > 0) {
      const stalenessMs = stalenessDays * 24 * 60 * 60 * 1000;
      const sourceDate = new Date(hsd.region.tanggal_terbit);
      const ageMs = Date.now() - sourceDate.getTime();
      if (ageMs > stalenessMs) {
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        warnings.push(
          `HSD "${hsd.region.provinsi}" (${hsd.region.tahun_berlaku} Q${hsd.region.kuartal}) is ${ageDays} days old — last updated ${hsd.region.tanggal_terbit}`,
        );
      }
    }

    const tkComponents = calcTenagaKerja(item, hsd, audit);
    const bahanComponents = calcBahan(item, hsd, fkMap, bahanMasterMap, item.volume_state_bayar, variabel, audit);
    const alatComponents = calcPeralatan(item, hsd, variabel, alatMap, fkMap, audit, warnings, mode);

    const tkGroup: PricedGroup = {
      type: 'L',
      title: 'Tenaga Kerja',
      components: tkComponents,
      total: tkComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const bahanGroup: PricedGroup = {
      type: 'M',
      title: 'Bahan',
      components: bahanComponents,
      total: bahanComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const alatGroup: PricedGroup = {
      type: 'E',
      title: 'Peralatan',
      components: alatComponents,
      total: alatComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const materialKey = (variabel['jenis_material'] as string | undefined) ?? 'agregat_kelas_a';
    const subAhspResult = resolveSubAhsp(
      item,
      (childKode) => hitungHSPInternal(childKode, variabel, [...resolveStack, item.kode_ahsp]),
      fkMap,
      materialKey,
      resolveStack,
    );
    audit.push(...subAhspResult.audit);

    const overheadPct = variabel['overhead_pct'] as number | undefined ?? item.margin.overhead_pct.default;
    const profitPct = variabel['profit_pct'] as number | undefined ?? item.margin.profit_pct.default;
    const result = assembleHspResult({
      kode_ahsp: item.kode_ahsp,
      nama: item.nama,
      satuan_bayar: item.satuan_bayar,
      groups: [tkGroup, bahanGroup, alatGroup],
      subAhsp: subAhspResult.components,
      nestedTotal: subAhspResult.total,
      overheadPct,
      profitPct,
      isLumpSum: item.is_lump_sum,
      warnings,
      audit,
    });
    assertFiniteMoney(item.kode_ahsp, 'grandTotal', result.grandTotal);
    return result;
  }

  function hitungHSP(kodeAhsp: string, variabel: VariabelInput): HSPResult {
    return hitungHSPInternal(kodeAhsp, variabel, []);
  }

  return { hitungHSP };
}

function assertModelledItem(item: AhspItem): void {
  const componentCount = item.tenaga_kerja.length
    + item.bahan.length
    + item.peralatan.length
    + item.sub_ahsp.length;
  if (componentCount > 0) return;
  const priced = (item as AhspItem & { hsp_referensi?: number }).hsp_referensi;
  if (typeof priced === 'number' && priced > 0) {
    throw new Error(
      `AHSP "${item.kode_ahsp}" has reference price ${priced} but no components`,
    );
  }
}

function calcTenagaKerja(
  item: AhspItem,
  hsd: HsdRegional,
  audit: AuditEntry[],
): PricedComponent[] {
  return item.tenaga_kerja.map((tk) => {
    const hsdEntry = hsd.tenaga_kerja.find((h) => h.ref === tk.ref);
    if (!hsdEntry) {
      throw new Error(`HSD tenaga kerja "${tk.ref}" not found`);
    }
    const total = tk.koefisien * hsdEntry.harga_rp;
    audit.push({
      step: 'hsp_tenaga_kerja',
      detail: `${tk.ref}: ${tk.koefisien} × ${hsdEntry.harga_rp} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: tk.ref,
      type: 'L' as const,
      nama: tk.ref,
      satuan: 'OH',
      coefficient: tk.koefisien,
      unit_price: hsdEntry.harga_rp,
      total_price: total,
    };
  });
}

function calcBahan(
  item: AhspItem,
  hsd: HsdRegional,
  fkMap: Map<string, FaktorKonversiEntry>,
  bahanMasterMap: Map<string, DataBundle['bahan']['items'][number]>,
  itemVolumeState: VolumeState,
  variabel: VariabelInput,
  audit: AuditEntry[],
): PricedComponent[] {
  return item.bahan.map((bahan) => {
    const hsdEntry = hsd.bahan.find((h) => h.ref === bahan.ref);
    if (!hsdEntry) {
      throw new Error(`HSD bahan "${bahan.ref}" not found`);
    }

    // Apply volume conversion if bahan has a volume_state different from item's bayar state
    let coefficient = bahan.koefisien;
    if (bahan.volume_state !== null && bahan.volume_state !== itemVolumeState) {
      const materialKey = resolveBahanMaterialKey(bahan.ref, item, variabel, bahanMasterMap, fkMap);
      const fk = fkMap.get(materialKey);
      if (!fk) {
        throw new Error(`Faktor konversi for material "${materialKey}" not found`);
      }
      const result = convertVolume(cubicMetres(1), fk, bahan.volume_state, itemVolumeState);
      coefficient = bahan.koefisien * result.factor;
      audit.push({
        step: 'volume_conversion_bahan',
        detail: `${bahan.ref}: koef ${bahan.koefisien} × ${result.factor} (${bahan.volume_state}→${itemVolumeState}, ${materialKey}) = ${coefficient.toFixed(6)}`,
        value: coefficient,
      });
    }

    const total = coefficient * hsdEntry.harga_rp;
    audit.push({
      step: 'hsp_bahan',
      detail: `${bahan.ref}: ${coefficient.toFixed(6)} × ${hsdEntry.harga_rp} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: bahan.ref,
      type: 'M' as const,
      nama: bahan.nama_override ?? hsdEntry.nama,
      satuan: hsdEntry.satuan,
      coefficient,
      unit_price: hsdEntry.harga_rp,
      total_price: total,
    };
  });
}

function calcPeralatan(
  item: AhspItem,
  hsd: HsdRegional,
  variabel: VariabelInput,
  alatMap: Map<string, DataBundle['peralatan']['items'][number]>,
  fkMap: Map<string, FaktorKonversiEntry>,
  audit: AuditEntry[],
  warnings: string[],
  mode: 'penuh' | 'estimasi-kasar',
): PricedComponent[] {
  return item.peralatan.map((entry) => {
    const alat = alatMap.get(entry.ref);
    if (!alat) {
      throw new Error(`Peralatan master "${entry.ref}" not found`);
    }

    const kondisi = (variabel['kondisi_operasi'] as KondisiOperasi | undefined) ?? 'normal';
    if (entry.mode_biaya === 'ownership' && isPlaceholderOwnership(alat)) {
      throw new Error(
        `Peralatan "${entry.ref}" has placeholder ownership parameters and no Permen sewa rate`,
      );
    }
    const hsdResult = hitungHsdPeralatanAny(entry.ref, alat, hsd, {
      mode_biaya: entry.mode_biaya,
      kondisi_operasi: kondisi,
    });
    const unitPrice = hsdResult.hsd_rp_per_jam;
    audit.push(...hsdResult.audit);

    let coefficient: number;
    if (entry.koef_sumber === 'tabel') {
      coefficient = entry.koef_referensi?.value ?? 0;
    } else {
      coefficient = resolveKalkulasiKoef(entry, alat, item, variabel, fkMap, audit, warnings, mode);
    }

    const total = coefficient * unitPrice;
    audit.push({
      step: 'hsp_peralatan',
      detail: `${entry.ref}: koef=${coefficient.toFixed(6)} × ${unitPrice.toFixed(0)} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });

    return {
      ref: entry.ref,
      type: 'E' as const,
      nama: entry.nama,
      satuan: 'jam',
      coefficient,
      unit_price: unitPrice,
      total_price: total,
    };
  });
}

// ============================================================
// Coefficient resolution — productivity-based (kalkulasi)
// ============================================================

function resolveKalkulasiKoef(
  entry: AhspItem['peralatan'][number],
  alat: DataBundle['peralatan']['items'][number],
  item: AhspItem,
  variabel: VariabelInput,
  fkMap: Map<string, FaktorKonversiEntry>,
  audit: AuditEntry[],
  warnings: string[],
  mode: 'penuh' | 'estimasi-kasar',
): number {
  const fa = (variabel['faktor_efisiensi'] as number | undefined) ?? 0.83;
  const hasFull = hasAllVariabelInput(entry, variabel);

  // Pre-calculated items (bina-marga-2022 style): variabel_input is empty,
  // coefficient is stored in koef_referensi. Use it directly.
  if (entry.variabel_input.length === 0 && entry.koef_referensi !== null) {
    let koef = entry.koef_referensi.value;
    koef = applyVolumeConversion(koef, entry, item, variabel, fkMap, audit);
    return koef;
  }

  if (!hasFull && entry.koef_referensi !== null && mode === 'estimasi-kasar') {
    warnings.push(`${entry.ref}: using koef_referensi fallback (${entry.koef_referensi.value}) — mode estimasi-kasar`);
    audit.push({
      step: 'koef_fallback',
      detail: `${entry.ref}: fallback to koef_referensi = ${entry.koef_referensi.value} (estimasi-kasar)`,
      value: entry.koef_referensi.value,
    });

    let koef = entry.koef_referensi.value;
    koef = applyVolumeConversion(koef, entry, item, variabel, fkMap, audit);
    return koef;
  }

  if (!hasFull) {
    const missing = entry.variabel_input.filter((v) => variabel[v] === undefined);
    throw new Error(`${entry.ref}: missing required variabel_input: ${missing.join(', ')}`);
  }

  const prodResult = calcProduktivitas(alat, variabel, fa, item.satuan_bayar);
  if (item.satuan_bayar === 'm2' && prodResult.satuan.startsWith('m3')) {
    throw new Error(`${entry.ref}: productivity ${prodResult.satuan} cannot price payment unit m2`);
  }
  if (!Number.isFinite(prodResult.produktivitas) || prodResult.produktivitas <= 0) {
    throw new Error(`${entry.ref}: productivity must be a positive finite number`);
  }
  const rawKoef = 1 / prodResult.produktivitas;
  audit.push(...prodResult.audit);
  audit.push({
    step: 'koef_from_productivity',
    detail: `${entry.ref}: 1/${prodResult.produktivitas.toFixed(4)} = ${rawKoef.toFixed(6)}`,
    value: rawKoef,
  });

  const koef = applyVolumeConversion(rawKoef, entry, item, variabel, fkMap, audit);
  return koef;
}

function hasAllVariabelInput(
  entry: AhspItem['peralatan'][number],
  variabel: VariabelInput,
): boolean {
  return entry.variabel_input.every((v) => variabel[v] !== undefined);
}

// ============================================================
// Productivity calculation — delegates to produktivitas/ modules
// ============================================================

function calcProduktivitas(
  alat: DataBundle['peralatan']['items'][number],
  variabel: VariabelInput,
  fa: number,
  satuanBayar: string,
): ProduktivitasResult {
  const pp = alat.produktivitas_params;
  const model = alat.model_produktivitas ?? (alat.tipe_produksi === 'throughput' ? 'throughput' : undefined);

  switch (model) {
    case 'excavator-cycle': {
      const params: SiklusExcavatorParams = {
        kapasitas_bucket_m3: alat.kapasitas_bucket_m3 ?? 0,
        faktor_bucket: resolveMapParam(pp['faktor_bucket'] as Record<string, number>, variabel['jenis_material'] as string, 1.0),
        faktor_efisiensi: fa,
        waktu_siklus_menit: resolveMapParam(pp['waktu_siklus_menit'] as Record<string, number>, null, 0.45),
      };
      return produktivitasExcavator(params);
    }
    case 'dump-truck-cycle': {
      const params: SiklusDumpTruckParams = {
        kapasitas_m3: alat.kapasitas_m3 ?? 8,
        faktor_muatan: resolveMapParam(pp['faktor_muatan'] as Record<string, number> | undefined, variabel['jenis_material'] as string | undefined, 0.95),
        jarak_km: (variabel['jarak_quarry_km'] ?? variabel['jarak_buang_km'] ?? variabel['jarak_angkut_km']) as number,
        kecepatan_isi_km_jam: resolveSpeedParam(pp['kecepatan_isi_km_jam'] as Record<string, number>, variabel['kondisi_jalan'] as string, 30),
        kecepatan_kosong_km_jam: resolveSpeedParam(pp['kecepatan_kosong_km_jam'] as Record<string, number>, variabel['kondisi_jalan'] as string, 40),
        waktu_muat_menit: (pp['waktu_muat_menit'] as number) ?? 2.5,
        waktu_bongkar_menit: (pp['waktu_bongkar_menit'] as number) ?? 1.5,
        waktu_tunggu_menit: (pp['waktu_tunggu_menit'] as number) ?? 1.0,
        faktor_efisiensi: fa,
      };
      return produktivitasDumpTruck(params);
    }
    case 'wheel-loader-cycle': {
      const params: SiklusWheelLoaderParams = {
        kapasitas_bucket_m3: alat.kapasitas_bucket_m3 ?? 1.5,
        faktor_bucket: resolveMapParam(pp['faktor_bucket'] as Record<string, number> | undefined, variabel['jenis_material'] as string | undefined, 0.85),
        faktor_efisiensi: fa,
        waktu_siklus_menit: (pp['waktu_siklus_menit'] as number) ?? 0.50,
      };
      return produktivitasWheelLoader(params);
    }
    case 'water-tanker-cycle': {
      const perM2 = pp['kebutuhan_air_liter_per_m2'];
      if (satuanBayar === 'm2' && (typeof perM2 !== 'number' || !Number.isFinite(perM2) || perM2 <= 0)) {
        throw new Error(`${alat.kode}: payment unit m2 requires kebutuhan_air_liter_per_m2`);
      }
      const params: SiklusWaterTankerParams = {
        kapasitas_liter: (pp['kapasitas_liter'] as number) ?? 4000,
        jarak_km: (variabel['jarak_sumber_air_km'] as number) ?? 5,
        kecepatan_isi_km_jam: 25,
        kecepatan_kosong_km_jam: 35,
        waktu_muat_menit: 3.0,
        waktu_bongkar_menit: 5.0,
        waktu_tunggu_menit: 1.0,
        faktor_efisiensi: fa,
        kebutuhan_air_liter_per_m3: (pp['kebutuhan_air_liter_per_m3'] as number) ?? 70,
        ...(satuanBayar === 'm2' ? { kebutuhan_air_liter_per_m2: perM2 as number } : {}),
      };
      return produktivitasWaterTanker(params);
    }
    case 'vibro-roller-pass': {
      const params: LintasanVibroRollerParams = {
        kecepatan_operasi_km_jam: resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 2.5),
        lebar_efektif_m: (pp['lebar_efektif_m'] as number) ?? 2.0,
        tebal_hamparan_m: (variabel['tebal_hamparan_m'] as number | undefined) ?? 0.20,
        jumlah_passing: (variabel['jumlah_passing'] as number | undefined) ?? 6,
        faktor_efisiensi: fa,
        ...(satuanBayar === 'm2' ? { mode: 'area' as const } : {}),
      };
      return produktivitasVibroRoller(params);
    }
    case 'motor-grader-pass': {
      const params: LintasanMotorGraderParams = {
        kecepatan_operasi_km_jam: resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 3.0),
        lebar_efektif_m: typeof variabel['lebar_hamparan_m'] === 'number'
          && Number.isFinite(variabel['lebar_hamparan_m'])
          && variabel['lebar_hamparan_m'] > 0
          ? variabel['lebar_hamparan_m']
          : ((pp['lebar_efektif_m'] as number) ?? 2.4),
        jumlah_lintasan: (variabel['jumlah_lintasan'] as number | undefined) ?? 6,
        faktor_efisiensi: fa,
      };
      return produktivitasMotorGrader(params);
    }
    case 'throughput': {
      const kapasitas = (pp['kapasitas_rated_ton_jam'] as number | undefined)
        ?? (pp['kapasitas_rated_m3_jam'] as number | undefined)
        ?? (pp['kapasitas_rated'] as number | undefined)
        ?? 0;
      const params: ThroughputParams = {
        kapasitas_rated: kapasitas,
        satuan_kapasitas: pp['kapasitas_rated_ton_jam'] !== undefined ? 'ton/jam' : 'm3/jam',
        faktor_efisiensi: fa,
      };
      return produktivitasThroughput(params);
    }
    case undefined:
      throw new Error(`Unsupported equipment productivity calculation for ${alat.kode} (${alat.tipe_produksi})`);
    default: {
      const unreachable: never = model;
      throw new Error(`Unsupported productivity model ${String(unreachable)} for ${alat.kode}`);
    }
  }
}

// ============================================================
// Volume conversion
// ============================================================

/** Map bahan-master kategori to faktor-konversi material key. */
const BAHAN_KATEGORI_TO_FK_MATERIAL: Readonly<Record<string, string>> = {
  tanah: 'tanah_biasa',
  agregat: 'agregat_kelas_a',
  pasir: 'agregat_kelas_a',
  batu: 'batu',
};

function resolveItemJenisMaterial(item: AhspItem, variabel: VariabelInput): string | undefined {
  if (!('jenis_material' in item.variabel)) return undefined;
  const fromInput = variabel['jenis_material'] as string | undefined;
  if (fromInput !== undefined) return fromInput;
  const def = item.variabel['jenis_material'];
  if (def?.tipe === 'enum' && typeof def.default === 'string') {
    return def.default;
  }
  return undefined;
}

function resolveBahanMaterialKey(
  bahanRef: string,
  item: AhspItem,
  variabel: VariabelInput,
  bahanMasterMap: Map<string, DataBundle['bahan']['items'][number]>,
  fkMap: Map<string, FaktorKonversiEntry>,
): string {
  const itemMaterial = resolveItemJenisMaterial(item, variabel);
  if (itemMaterial !== undefined) return itemMaterial;

  const master = bahanMasterMap.get(bahanRef);
  const fromKategori = master?.kategori ? BAHAN_KATEGORI_TO_FK_MATERIAL[master.kategori] : undefined;
  if (fromKategori !== undefined && fkMap.has(fromKategori)) return fromKategori;

  return 'agregat_kelas_a';
}

function applyVolumeConversion(
  koef: number,
  entry: AhspItem['peralatan'][number],
  item: AhspItem,
  variabel: VariabelInput,
  fkMap: Map<string, FaktorKonversiEntry>,
  audit: AuditEntry[],
): number {
  if (entry.volume_state === null) return koef;
  if (entry.volume_state === item.volume_state_bayar) return koef;

  const materialKey = (variabel['jenis_material'] as string | undefined) ?? 'agregat_kelas_a';
  const fk = fkMap.get(materialKey);
  if (!fk) {
    throw new Error(`Faktor konversi for material "${materialKey}" not found`);
  }

  const result = convertVolume(cubicMetres(1), fk, entry.volume_state as VolumeState, item.volume_state_bayar);
  const converted = koef * result.factor;
  audit.push({
    step: 'volume_conversion',
    detail: `${entry.ref}: koef ${koef.toFixed(6)} × ${result.factor.toFixed(6)} (${entry.volume_state}→${item.volume_state_bayar}) = ${converted.toFixed(6)}`,
    value: converted,
  });
  return converted;
}

// ============================================================
// Helpers
// ============================================================

/** Values stamped by scripts/normalize-bina-marga.mjs when no real ownership sheet exists. */
function isPlaceholderOwnership(alat: DataBundle['peralatan']['items'][number]): boolean {
  const params = alat.hsd_params;
  return params.harga_pokok_rp === 500_000_000
    && params.bahan_bakar_ch === 12
    && alat.daya_hp === 100;
}

function resolveMapParam(
  map: Record<string, number> | undefined,
  key: string | null | undefined,
  fallback: number,
): number {
  if (!map) return fallback;
  if (key != null && key !== '') {
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]!;
    return fallback;
  }
  // No key selected: the first row is the map default. Callers rely on this
  // when jenis_material is omitted (golden fixtures).
  const values = Object.values(map);
  if (values.length > 0) return values[0]!;
  return fallback;
}

function resolveSpeedParam(
  map: Record<string, number>,
  kondisi: string,
  fallback: number,
): number {
  const key = Object.keys(map).find((k) => k.includes(kondisi));
  if (key) return map[key]!;
  if (kondisi !== '') {
    throw new Error(
      `kondisi_jalan "${kondisi}" has no operating speed. Known keys: ${Object.keys(map).join(', ')}`,
    );
  }
  return fallback;
}
