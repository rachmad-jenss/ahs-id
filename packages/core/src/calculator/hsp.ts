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
      nama: hsdEntry.ref,
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

  const produktivitas = calcProduktivitas(alat, variabel, fa, audit);
  const rawKoef = 1 / produktivitas;
  audit.push({
    step: 'koef_from_productivity',
    detail: `${entry.ref}: 1/${produktivitas.toFixed(4)} = ${rawKoef.toFixed(6)}`,
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

function calcProduktivitas(
  alat: DataBundle['peralatan']['items'][number],
  variabel: VariabelInput,
  fa: number,
  audit: AuditEntry[],
): number {
  const pp = alat.produktivitas_params;

  if (alat.tipe_produksi === 'siklus') {
    if (alat.kode === 'E.01') {
      const V = alat.kapasitas_bucket_m3 ?? 0;
      const Fb = resolveMapParam(pp['faktor_bucket'] as Record<string, number>, variabel['jenis_material'] as string, 1.0);
      const Ts = resolveMapParam(pp['waktu_siklus_menit'] as Record<string, number>, null, 0.45);
      const Q = (V * Fb * fa * 60) / Ts;
      audit.push({ step: 'produktivitas_excavator', detail: `Q = (${V} × ${Fb} × ${fa} × 60) / ${Ts} = ${Q.toFixed(4)}`, value: Q, unit: 'm3/jam' });
      return Q;
    }

    if (alat.kode === 'E.08') {
      const V = alat.kapasitas_m3 ?? 8;
      const Fm = resolveMapParam(pp['faktor_muatan'] as Record<string, number> | undefined, variabel['jenis_material'] as string | undefined, 0.95);
      const jarakKm = (variabel['jarak_quarry_km'] ?? variabel['jarak_buang_km'] ?? variabel['jarak_angkut_km']) as number;
      const kondisiJalan = (variabel['kondisi_jalan'] as string) ?? 'sedang';
      const Vi = resolveSpeedParam(pp['kecepatan_isi_km_jam'] as Record<string, number>, kondisiJalan, 30);
      const Vk = resolveSpeedParam(pp['kecepatan_kosong_km_jam'] as Record<string, number>, kondisiJalan, 40);
      const Tmuat = (pp['waktu_muat_menit'] as number) ?? 2.5;
      const Tbongkar = (pp['waktu_bongkar_menit'] as number) ?? 1.5;
      const Ttunggu = (pp['waktu_tunggu_menit'] as number) ?? 1.0;
      const Ts = Tmuat + (jarakKm / Vi) * 60 + (jarakKm / Vk) * 60 + Tbongkar + Ttunggu;
      const Q = (V * Fm * fa * 60) / Ts;
      audit.push({ step: 'produktivitas_dump_truck', detail: `Ts=${Ts.toFixed(2)} min, Q = (${V} × ${Fm} × ${fa} × 60) / ${Ts.toFixed(2)} = ${Q.toFixed(4)}`, value: Q, unit: 'm3/jam' });
      return Q;
    }

    if (alat.kode === 'E.11') {
      const V = alat.kapasitas_bucket_m3 ?? 1.5;
      const Fb = resolveMapParam(pp['faktor_bucket'] as Record<string, number> | undefined, variabel['jenis_material'] as string | undefined, 0.85);
      const Ts = (pp['waktu_siklus_menit'] as number) ?? 0.50;
      const Q = (V * Fb * fa * 60) / Ts;
      audit.push({ step: 'produktivitas_wheel_loader', detail: `Q = (${V} × ${Fb} × ${fa} × 60) / ${Ts} = ${Q.toFixed(4)}`, value: Q, unit: 'm3/jam' });
      return Q;
    }

    if (alat.kode === 'E.25') {
      const kapLiter = (pp['kapasitas_liter'] as number) ?? 4000;
      const kebutuhanAir = (pp['kebutuhan_air_liter_per_m3'] as number) ?? 70;
      const jarakKm = (variabel['jarak_sumber_air_km'] as number) ?? 5;
      const Vi = 25;
      const Vk = 35;
      const Tmuat = 3.0;
      const Tbongkar = 5.0;
      const Ttunggu = 1.0;
      const Ts = Tmuat + (jarakKm / Vi) * 60 + (jarakKm / Vk) * 60 + Tbongkar + Ttunggu;
      const Qliter = (kapLiter * fa * 60) / Ts;
      const Q = Qliter / kebutuhanAir;
      audit.push({ step: 'produktivitas_water_tanker', detail: `Ts=${Ts.toFixed(2)} min, Q = ${Qliter.toFixed(2)} l/jam / ${kebutuhanAir} = ${Q.toFixed(4)}`, value: Q, unit: 'm3/jam' });
      return Q;
    }
  }

  if (alat.tipe_produksi === 'lintasan') {
    if (alat.kode === 'E.22') {
      const vKm = resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 2.5);
      const vM = vKm * 1000;
      const b = (pp['lebar_efektif_m'] as number) ?? 2.0;
      const t = (variabel['tebal_hamparan_m'] as number | undefined) ?? 0.20;
      const n = (variabel['jumlah_passing'] as number | undefined) ?? 6;
      const Q = (vM * b * t * fa) / n;
      audit.push({ step: 'produktivitas_vibro_roller', detail: `Q = (${vM} × ${b} × ${t} × ${fa}) / ${n} = ${Q.toFixed(4)}`, value: Q, unit: 'm3/jam' });
      return Q;
    }

    if (alat.kode === 'E.19') {
      const vKm = resolveMapParam(pp['kecepatan_operasi_km_jam'] as Record<string, number>, variabel['jenis_material'] as string | undefined, 3.0);
      const vM = vKm * 1000;
      const b = (pp['lebar_efektif_m'] as number) ?? 2.4;
      const n = (variabel['jumlah_lintasan'] as number | undefined) ?? 6;
      const Q = (vM * b * fa) / n;
      audit.push({ step: 'produktivitas_motor_grader', detail: `Q = (${vM} × ${b} × ${fa}) / ${n} = ${Q.toFixed(4)} m2/jam`, value: Q, unit: 'm2/jam' });
      return Q;
    }
  }

  if (alat.tipe_produksi === 'throughput') {
    const kapasitas = (pp['kapasitas_rated_ton_jam'] as number | undefined)
      ?? (pp['kapasitas_rated_m3_jam'] as number | undefined)
      ?? (pp['kapasitas_rated'] as number | undefined)
      ?? 0;
    const satuan = pp['kapasitas_rated_ton_jam'] !== undefined ? 'ton/jam' : 'm3/jam';
    const Q = kapasitas * fa;
    audit.push({
      step: 'produktivitas_throughput',
      detail: `Q = ${kapasitas} × ${fa} = ${Q.toFixed(4)}`,
      value: Q,
      unit: satuan,
    });
    return Q;
  }

  throw new Error(`Unsupported equipment productivity calculation for ${alat.kode} (${alat.tipe_produksi})`);
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

  const result = convertVolume(1.0, fk, entry.volume_state as VolumeState, item.volume_state_bayar);
  const converted = koef * result.factor;
  audit.push({
    step: 'volume_conversion',
    detail: `${entry.ref}: koef ${koef.toFixed(6)} × ${result.factor.toFixed(6)} (${entry.volume_state}→${item.volume_state_bayar}) = ${converted.toFixed(6)}`,
    value: converted,
  });
  return converted;
}

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
