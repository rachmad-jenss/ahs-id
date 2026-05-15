import type { AuditEntry } from '../../types/index.js';

export interface SiklusDumpTruckParams {
  readonly kapasitas_m3: number;
  readonly jarak_km: number;
  readonly kecepatan_isi_km_jam: number;
  readonly kecepatan_kosong_km_jam: number;
  readonly waktu_muat_menit: number;
  readonly waktu_bongkar_menit: number;
  readonly waktu_tunggu_menit: number;
  readonly faktor_muatan: number;
  readonly faktor_efisiensi: number;
}

export interface SiklusExcavatorParams {
  readonly kapasitas_bucket_m3: number;
  readonly faktor_bucket: number;
  readonly faktor_efisiensi: number;
  readonly waktu_siklus_menit: number;
}

export interface SiklusWheelLoaderParams {
  readonly kapasitas_bucket_m3: number;
  readonly faktor_bucket: number;
  readonly faktor_efisiensi: number;
  readonly waktu_siklus_menit: number;
}

export interface SiklusWaterTankerParams {
  readonly kapasitas_liter: number;
  readonly jarak_km: number;
  readonly kecepatan_isi_km_jam: number;
  readonly kecepatan_kosong_km_jam: number;
  readonly waktu_muat_menit: number;
  readonly waktu_bongkar_menit: number;
  readonly waktu_tunggu_menit: number;
  readonly faktor_efisiensi: number;
  readonly kebutuhan_air_liter_per_m3: number;
}

export interface ProduktivitasResult {
  readonly produktivitas: number;
  readonly satuan: string;
  readonly audit: readonly AuditEntry[];
}

/**
 * Dump Truck siklus productivity.
 * Q = (V × Fm × Fa) / Ts
 * Ts = T_muat + jarak/V_isi×60 + jarak/V_kosong×60 + T_bongkar + T_tunggu
 */
export function produktivitasDumpTruck(params: SiklusDumpTruckParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const T_angkut = (params.jarak_km / params.kecepatan_isi_km_jam) * 60;
  const T_kembali = (params.jarak_km / params.kecepatan_kosong_km_jam) * 60;
  const Ts =
    params.waktu_muat_menit + T_angkut + T_kembali + params.waktu_bongkar_menit + params.waktu_tunggu_menit;

  audit.push({
    step: 'waktu_siklus_dt',
    detail: `T_muat=${params.waktu_muat_menit} + T_angkut=${T_angkut.toFixed(1)} + T_kembali=${T_kembali.toFixed(1)} + T_bongkar=${params.waktu_bongkar_menit} + T_tunggu=${params.waktu_tunggu_menit}`,
    value: Ts,
    unit: 'menit',
  });

  const Q = (params.kapasitas_m3 * params.faktor_muatan * params.faktor_efisiensi * 60) / Ts;

  audit.push({
    step: 'produktivitas_dt',
    detail: `(${params.kapasitas_m3} × ${params.faktor_muatan} × ${params.faktor_efisiensi} × 60) / ${Ts.toFixed(2)}`,
    value: Q,
    unit: 'm3/jam',
  });

  return { produktivitas: Q, satuan: 'm3/jam', audit };
}

/**
 * Excavator siklus productivity.
 * Q = (V × Fb × Fa × 60) / Ts
 */
export function produktivitasExcavator(params: SiklusExcavatorParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const Q =
    (params.kapasitas_bucket_m3 * params.faktor_bucket * params.faktor_efisiensi * 60) /
    params.waktu_siklus_menit;

  audit.push({
    step: 'produktivitas_excavator',
    detail: `(${params.kapasitas_bucket_m3} × ${params.faktor_bucket} × ${params.faktor_efisiensi} × 60) / ${params.waktu_siklus_menit}`,
    value: Q,
    unit: 'm3/jam',
  });

  return { produktivitas: Q, satuan: 'm3/jam', audit };
}

/**
 * Wheel Loader siklus productivity.
 * Q = (V × Fb × Fa × 60) / Ts
 */
export function produktivitasWheelLoader(params: SiklusWheelLoaderParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const Q =
    (params.kapasitas_bucket_m3 * params.faktor_bucket * params.faktor_efisiensi * 60) /
    params.waktu_siklus_menit;

  audit.push({
    step: 'produktivitas_wheel_loader',
    detail: `(${params.kapasitas_bucket_m3} × ${params.faktor_bucket} × ${params.faktor_efisiensi} × 60) / ${params.waktu_siklus_menit}`,
    value: Q,
    unit: 'm3/jam',
  });

  return { produktivitas: Q, satuan: 'm3/jam', audit };
}

/**
 * Water Tanker siklus productivity (in m3 of watered material, not liters).
 * Q_liter = (V_liter × Fa × 60) / Ts
 * Q_m3 = Q_liter / kebutuhan_air_liter_per_m3
 */
export function produktivitasWaterTanker(params: SiklusWaterTankerParams): ProduktivitasResult {
  const audit: AuditEntry[] = [];

  const T_angkut = (params.jarak_km / params.kecepatan_isi_km_jam) * 60;
  const T_kembali = (params.jarak_km / params.kecepatan_kosong_km_jam) * 60;
  const Ts =
    params.waktu_muat_menit + T_angkut + T_kembali + params.waktu_bongkar_menit + params.waktu_tunggu_menit;

  const Q_liter = (params.kapasitas_liter * params.faktor_efisiensi * 60) / Ts;
  const Q_m3 = Q_liter / params.kebutuhan_air_liter_per_m3;

  audit.push({
    step: 'produktivitas_water_tanker',
    detail: `Q_liter=(${params.kapasitas_liter} × ${params.faktor_efisiensi} × 60) / ${Ts.toFixed(2)} = ${Q_liter.toFixed(1)}, Q_m3=${Q_liter.toFixed(1)} / ${params.kebutuhan_air_liter_per_m3}`,
    value: Q_m3,
    unit: 'm3/jam',
  });

  return { produktivitas: Q_m3, satuan: 'm3/jam', audit };
}
