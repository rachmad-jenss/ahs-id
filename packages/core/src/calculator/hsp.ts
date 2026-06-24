import type {
  AhspItem,
  AhspComponent,
  AhspGroup,
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
import { hitungHsdPeralatanAny } from './hsd-peralatan.js';
import { hitungMargin } from './margin.js';
import { convertVolume } from './konversi-volume.js';
import { resolveSubAhsp } from './sub-ahsp.js';
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
  hsd: HsdRegional,
  config?: CalculatorConfig,
): Calculator {
  const alatMap = new Map(bundle.peralatan.items.map((a) => [a.kode, a]));
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
    const bahanComponents = calcBahan(item, hsd, audit);
    const alatComponents = calcPeralatan(item, hsd, variabel, alatMap, fkMap, audit, warnings, mode);

    const tkGroup: AhspGroup = {
      type: 'L',
      title: 'Tenaga Kerja',
      components: tkComponents,
      total: tkComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const bahanGroup: AhspGroup = {
      type: 'M',
      title: 'Bahan',
      components: bahanComponents,
      total: bahanComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const alatGroup: AhspGroup = {
      type: 'E',
      title: 'Peralatan',
      components: alatComponents,
      total: alatComponents.reduce((s, c) => s + c.total_price, 0),
    };

    const materialKey = (variabel['jenis_material'] as string | undefined) ?? 'agregat_kelas_a';
    const subAhspResult = resolveSubAhsp(
      item,
      (childKode) => hitungHSPInternal(childKode, variabel, resolveStack),
      fkMap,
      materialKey,
      resolveStack,
    );
    audit.push(...subAhspResult.audit);

    const baseTotal = tkGroup.total + bahanGroup.total + alatGroup.total + subAhspResult.total;

    const overheadPct = variabel['overhead_pct'] as number | undefined ?? item.margin.overhead_pct.default;
    const profitPct = variabel['profit_pct'] as number | undefined ?? item.margin.profit_pct.default;

    const marginResult = hitungMargin(baseTotal, { overhead_pct: overheadPct, profit_pct: profitPct }, item.is_lump_sum);
    audit.push(...marginResult.audit);

    return {
      kode_ahsp: item.kode_ahsp,
      nama: item.nama,
      satuan_bayar: item.satuan_bayar,
      groups: [tkGroup, bahanGroup, alatGroup],
      baseTotal,
      overheadPct,
      profitPct,
      overheadProfitValue: marginResult.overhead_profit_total,
      grandTotal: marginResult.grand_total,
      warnings,
      audit_trail: audit,
    };
  }

  function hitungHSP(kodeAhsp: string, variabel: VariabelInput): HSPResult {
    return hitungHSPInternal(kodeAhsp, variabel, []);
  }

  return { hitungHSP };
}

function calcTenagaKerja(
  item: AhspItem,
  hsd: HsdRegional,
  audit: AuditEntry[],
): AhspComponent[] {
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
  audit: AuditEntry[],
): AhspComponent[] {
  return item.bahan.map((bahan) => {
    const hsdEntry = hsd.bahan.find((h) => h.ref === bahan.ref);
    if (!hsdEntry) {
      throw new Error(`HSD bahan "${bahan.ref}" not found`);
    }
    const total = bahan.koefisien * hsdEntry.harga_rp;
    audit.push({
      step: 'hsp_bahan',
      detail: `${bahan.ref}: ${bahan.koefisien} × ${hsdEntry.harga_rp} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: bahan.ref,
      type: 'M' as const,
      nama: bahan.nama_override ?? hsdEntry.nama,
      satuan: hsdEntry.satuan,
      coefficient: bahan.koefisien,
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
): AhspComponent[] {
  return item.peralatan.map((entry) => {
    const alat = alatMap.get(entry.ref);
    if (!alat) {
      throw new Error(`Peralatan master "${entry.ref}" not found`);
    }

    const kondisi = (variabel['kondisi_operasi'] as KondisiOperasi | undefined) ?? 'normal';
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

  const prodResult = calcProduktivitas(alat, variabel, fa);
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
): ProduktivitasResult {
  const pp = alat.produktivitas_params;

  if (alat.tipe_produksi === 'siklus') {
    if (alat.kode === 'E.01') {
      const params: SiklusExcavatorParams = {
        kapasitas_bucket_m3: alat.kapasitas_bucket_m3 ?? 0,
        faktor_bucket: resolveMapParam(pp['faktor_bucket'] as Record<string, number>, variabel['jenis_material'] as string, 1.0),
        faktor_efisiensi: fa,
        waktu_siklus_menit: resolveMapParam(pp['waktu_siklus_menit'] as Record<string, number>, null, 0.45),
      };
      return produktivitasExcavator(params);
    }

    if (alat.kode === 'E.08') {
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

    if (alat.kode === 'E.11') {
      const params: SiklusWheelLoaderParams = {
        kapasitas_bucket_m3: alat.kapasitas_bucket_m3 ?? 1.5,
        faktor_bucket: resolveMapParam(pp['faktor_bucket'] as Record<string, number> | undefined, variabel['jenis_material'] as string | undefined, 0.85),
        faktor_efisiensi: fa,
        waktu_siklus_menit: (pp['waktu_siklus_menit'] as number) ?? 0.50,
      };
      return produktivitasWheelLoader(params);
    }

    if (alat.kode === 'E.25') {
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
      };
      return produktivitasWaterTanker(params);
    }
  }

  if (alat.tipe_produksi === 'lintasan') {
    if (alat.kode === 'E.22') {
      const params: LintasanVibroRollerParams = {
        kecepatan_operasi_km_jam: resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 2.5),
        lebar_efektif_m: (pp['lebar_efektif_m'] as number) ?? 2.0,
        tebal_hamparan_m: (variabel['tebal_hamparan_m'] as number | undefined) ?? 0.20,
        jumlah_passing: (variabel['jumlah_passing'] as number | undefined) ?? 6,
        faktor_efisiensi: fa,
      };
      return produktivitasVibroRoller(params);
    }

    if (alat.kode === 'E.19') {
      const params: LintasanMotorGraderParams = {
        kecepatan_operasi_km_jam: resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 3.0),
        lebar_efektif_m: (pp['lebar_efektif_m'] as number) ?? 2.4,
        jumlah_lintasan: (variabel['jumlah_lintasan'] as number | undefined) ?? 6,
        faktor_efisiensi: fa,
      };
      return produktivitasMotorGrader(params);
    }
  }

  if (alat.tipe_produksi === 'throughput') {
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

  throw new Error(`Unsupported equipment productivity calculation for ${alat.kode} (${alat.tipe_produksi})`);
}

// ============================================================
// Volume conversion
// ============================================================

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

  const result = convertVolume(1.0, fk, entry.volume_state as VolumeState, item.volume_state_bayar);
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

function resolveMapParam(
  map: Record<string, number> | undefined,
  key: string | null | undefined,
  fallback: number,
): number {
  if (!map) return fallback;
  if (key && key in map) return map[key]!;
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
  return fallback;
}
