import type { AuditEntry } from '../../types/index.js';

/**
 * HSD derivasi untuk pengangkutan tanaman/material satuan (Lansekap/Taman).
 *
 * Formula SE Bina Konstruksi No. 68/2024 — Sheet Lansekap:
 *   T_muat   = V × 2 / Qz                            (menit; ×2 = muat + bongkar)
 *   T_jalan  = L / V1 × 60                           (menit; satu arah)
 *   Ts       = T_muat + T_jalan
 *   Biaya_angkut = (HSD_alat × Ts/60 + HSD_TK × T_muat/60) / V   (Rp/item)
 *   HSD_final    = HSD_dasar + Biaya_angkut
 *
 * Catatan: HSD_TK hanya dihitung selama T_muat (pekerja muat/bongkar di lokasi,
 * tidak ikut perjalanan).
 */
export interface TransportSatuanParams {
  /** Kapasitas angkut per trip (satuan: item/polybag/batang) */
  readonly kapasitas_angkut: number;
  /** Kapasitas angkat pekerja: item/menit (Qz) */
  readonly kapasitas_angkat_per_menit: number;
  /** Jarak satu arah (km) */
  readonly jarak_km: number;
  /** Kecepatan bermuatan (km/jam) */
  readonly kecepatan_km_jam: number;
  /** Harga sewa alat angkut per jam (Rp) */
  readonly hsd_alat_per_jam: number;
  /** Harga upah tenaga kerja muat/bongkar per jam (Rp); default 0 */
  readonly hsd_tk_per_jam?: number;
  /** Harga dasar beli di nursery/pengadaan per item (Rp) */
  readonly hsd_dasar_per_item: number;
}

export interface TransportSatuanResult {
  /** Waktu muat + bongkar satu trip (menit) */
  readonly t_muat_menit: number;
  /** Waktu perjalanan satu arah (menit) */
  readonly t_jalan_menit: number;
  /** Total waktu siklus (menit) */
  readonly ts_menit: number;
  /** Biaya angkut per item termasuk TK (Rp) */
  readonly biaya_angkut_per_item: number;
  /** HSD turunan per item = hsd_dasar + biaya_angkut (Rp) */
  readonly hsd_per_item: number;
  readonly audit: readonly AuditEntry[];
}

/**
 * Menghitung HSD turunan pengangkutan tanaman/material satuan.
 * Digunakan untuk pekerjaan lansekap/taman di mana tanaman dibeli di nursery
 * dan perlu dihitung biaya angkutnya ke lokasi pekerjaan.
 */
export function hitungHsdTransportSatuan(params: TransportSatuanParams): TransportSatuanResult {
  const { kapasitas_angkut: V, kapasitas_angkat_per_menit: Qz, jarak_km: L, kecepatan_km_jam: V1 } = params;
  const hsd_tk = params.hsd_tk_per_jam ?? 0;

  const audit: AuditEntry[] = [];

  const t_muat = (V * 2) / Qz;
  audit.push({
    step: 't_muat_bongkar',
    detail: `T_muat = V×2/Qz = ${V}×2/${Qz}`,
    value: t_muat,
    unit: 'menit',
  });

  const t_jalan = (L / V1) * 60;
  audit.push({
    step: 't_perjalanan',
    detail: `T_jalan = L/V1×60 = ${L}/${V1}×60`,
    value: t_jalan,
    unit: 'menit',
  });

  const ts = t_muat + t_jalan;
  audit.push({
    step: 'ts_total',
    detail: `Ts = T_muat + T_jalan = ${t_muat.toFixed(3)} + ${t_jalan.toFixed(3)}`,
    value: ts,
    unit: 'menit',
  });

  const biaya_alat = params.hsd_alat_per_jam * (ts / 60);
  const biaya_tk = hsd_tk * (t_muat / 60);
  audit.push({
    step: 'biaya_alat',
    detail: `HSD_alat × Ts/60 = ${params.hsd_alat_per_jam} × ${(ts / 60).toFixed(4)}`,
    value: biaya_alat,
    unit: 'Rp/trip',
  });
  if (hsd_tk > 0) {
    audit.push({
      step: 'biaya_tk',
      detail: `HSD_TK × T_muat/60 = ${hsd_tk} × ${(t_muat / 60).toFixed(4)}`,
      value: biaya_tk,
      unit: 'Rp/trip',
    });
  }

  const biaya_angkut = (biaya_alat + biaya_tk) / V;
  audit.push({
    step: 'biaya_angkut_per_item',
    detail: `(biaya_alat + biaya_tk) / V = (${biaya_alat.toFixed(2)} + ${biaya_tk.toFixed(2)}) / ${V}`,
    value: biaya_angkut,
    unit: 'Rp/item',
  });

  const hsd_per_item = params.hsd_dasar_per_item + biaya_angkut;
  audit.push({
    step: 'hsd_turunan',
    detail: `HSD = hsd_dasar + biaya_angkut = ${params.hsd_dasar_per_item} + ${biaya_angkut.toFixed(2)}`,
    value: hsd_per_item,
    unit: 'Rp/item',
  });

  return {
    t_muat_menit: t_muat,
    t_jalan_menit: t_jalan,
    ts_menit: ts,
    biaya_angkut_per_item: biaya_angkut,
    hsd_per_item,
    audit,
  };
}
