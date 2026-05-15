import type {
  PeralatanMaster,
  HsdRegional,
  KondisiOperasi,
  AuditEntry,
} from '../types/index.js';

export interface HsdPeralatanBreakdown {
  readonly biaya_pasti: {
    readonly pengembalian_modal: number;
    readonly asuransi_pajak: number;
    readonly total: number;
  };
  readonly biaya_operasi: {
    readonly bahan_bakar: number;
    readonly pelumas_mesin: number;
    readonly oli_hidrolik: number;
    readonly grease: number;
    readonly perawatan: number;
    readonly perbaikan: number;
    readonly operator: number;
    readonly pembantu_operator: number;
    readonly total: number;
  };
}

export interface HsdPeralatanResult {
  readonly hsd_rp_per_jam: number;
  readonly breakdown: HsdPeralatanBreakdown;
  readonly audit: readonly AuditEntry[];
}

export interface HsdPeralatanConfig {
  readonly kondisi_operasi?: KondisiOperasi;
}

/**
 * Calculate HSD Peralatan using ownership mode.
 *
 * Biaya Pasti: pengembalian modal + asuransi
 * Biaya Operasi: BBM + pelumas(3) + perawatan×Fpr + perbaikan×Fpr + operator + pembantu
 */
export function hitungHsdPeralatan(
  alat: PeralatanMaster,
  hsd: HsdRegional,
  config?: HsdPeralatanConfig,
): HsdPeralatanResult {
  const p = alat.hsd_params;
  const audit: AuditEntry[] = [];
  const kondisi = config?.kondisi_operasi ?? p.fpr.default;

  const B = p.harga_pokok_rp;
  const C = p.nilai_sisa_pct * B;
  const D = p.faktor_angsuran;
  const W = p.jam_kerja_per_tahun;

  // --- Biaya Pasti ---
  const pengembalian_modal = ((B - C) * D) / W;
  audit.push({
    step: 'pengembalian_modal',
    detail: `(${B} - ${C}) × ${D} / ${W}`,
    value: pengembalian_modal,
    unit: 'Rp/jam',
  });

  const asuransi_pajak = (p.asuransi_pajak_pct * B) / W;
  audit.push({
    step: 'asuransi_pajak',
    detail: `${p.asuransi_pajak_pct} × ${B} / ${W}`,
    value: asuransi_pajak,
    unit: 'Rp/jam',
  });

  const biaya_pasti_total = pengembalian_modal + asuransi_pajak;

  // --- Biaya Operasi ---
  const solar = hsd.bahan_bakar.solar_industri_rp_per_liter;
  const bahan_bakar = p.bahan_bakar_ch * alat.daya_hp * solar;
  audit.push({
    step: 'bahan_bakar',
    detail: `${p.bahan_bakar_ch} × ${alat.daya_hp} HP × ${solar} Rp/liter`,
    value: bahan_bakar,
    unit: 'Rp/jam',
  });

  const pelumas_mesin =
    p.pelumas.mesin.cp * alat.daya_hp * hsd.bahan_bakar.oli_mesin_rp_per_liter;
  const oli_hidrolik =
    p.pelumas.hidrolik.cp * alat.daya_hp * hsd.bahan_bakar.oli_hidrolik_rp_per_liter;
  const grease =
    p.pelumas.grease.cp * alat.berat_operasi_ton * hsd.bahan_bakar.grease_rp_per_kg;

  audit.push({
    step: 'pelumas',
    detail: `mesin=${pelumas_mesin.toFixed(0)}, hidrolik=${oli_hidrolik.toFixed(0)}, grease=${grease.toFixed(0)}`,
    value: pelumas_mesin + oli_hidrolik + grease,
    unit: 'Rp/jam',
  });

  const fpr = getFpr(p.fpr, kondisi);
  const perawatan = (p.perawatan_pct * B * fpr) / W;
  const perbaikan = (p.perbaikan_pct * B * fpr) / W;
  audit.push({
    step: 'perawatan_perbaikan',
    detail: `Fpr=${fpr} (${kondisi}), perawatan=${perawatan.toFixed(0)}, perbaikan=${perbaikan.toFixed(0)}`,
    value: perawatan + perbaikan,
    unit: 'Rp/jam',
  });

  // Operator and pembantu: HSD_TK / jam_efektif (7, not 8)
  const JAM_EFEKTIF = 7;
  const operatorHsd = findTenagaKerja(hsd, 'L.05');
  const pembantuHsd = findTenagaKerja(hsd, 'L.06');
  const operator = operatorHsd / JAM_EFEKTIF;
  const pembantu_operator = pembantuHsd / JAM_EFEKTIF;
  audit.push({
    step: 'operator_pembantu',
    detail: `L.05=${operatorHsd}/${JAM_EFEKTIF}=${operator.toFixed(0)}, L.06=${pembantuHsd}/${JAM_EFEKTIF}=${pembantu_operator.toFixed(0)}`,
    value: operator + pembantu_operator,
    unit: 'Rp/jam',
  });

  const biaya_operasi_total =
    bahan_bakar +
    pelumas_mesin +
    oli_hidrolik +
    grease +
    perawatan +
    perbaikan +
    operator +
    pembantu_operator;

  const hsd_rp_per_jam = biaya_pasti_total + biaya_operasi_total;
  audit.push({
    step: 'hsd_total',
    detail: `biaya_pasti=${biaya_pasti_total.toFixed(0)} + biaya_operasi=${biaya_operasi_total.toFixed(0)}`,
    value: hsd_rp_per_jam,
    unit: 'Rp/jam',
  });

  return {
    hsd_rp_per_jam,
    breakdown: {
      biaya_pasti: {
        pengembalian_modal,
        asuransi_pajak,
        total: biaya_pasti_total,
      },
      biaya_operasi: {
        bahan_bakar,
        pelumas_mesin,
        oli_hidrolik,
        grease,
        perawatan,
        perbaikan,
        operator,
        pembantu_operator,
        total: biaya_operasi_total,
      },
    },
    audit,
  };
}

function getFpr(
  fpr: { readonly normal: number; readonly berat: number; readonly sangat_berat?: number },
  kondisi: KondisiOperasi,
): number {
  switch (kondisi) {
    case 'normal':
      return fpr.normal;
    case 'berat':
      return fpr.berat;
    case 'sangat_berat':
      if (fpr.sangat_berat === undefined) {
        throw new Error('Equipment does not define sangat_berat Fpr');
      }
      return fpr.sangat_berat;
  }
}

function findTenagaKerja(hsd: HsdRegional, ref: string): number {
  const entry = hsd.tenaga_kerja.find((tk) => tk.ref === ref);
  if (!entry) {
    throw new Error(`HSD tenaga kerja "${ref}" not found in regional data`);
  }
  return entry.harga_rp;
}
