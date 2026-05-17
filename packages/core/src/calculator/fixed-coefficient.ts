import type {
  FixedCoefficientItem,
  AhspComponent,
  AhspGroup,
  HSPResult,
  AuditEntry,
} from '../types/index.js';
import { hitungMargin } from './margin.js';

/**
 * Menghitung HSP untuk item AHSP bertipe fixed_coefficient.
 *
 * Berbeda dengan dynamic_hsd (yang lookup HSD regional + hitung produktivitas),
 * item fixed_coefficient menyimpan harga_satuan_ref di setiap komponen.
 * Kalkulasi murni: koefisien × harga_satuan_ref, tanpa perlu data eksternal.
 *
 * Digunakan untuk @ahs-id/cipta-karya-2024.
 */
export function calcHspFixedCoefficient(
  item: FixedCoefficientItem,
  opts?: { overhead_pct?: number; profit_pct?: number },
): HSPResult {
  const audit: AuditEntry[] = [];

  const tkComponents: AhspComponent[] = item.tenaga_kerja.map((tk) => {
    const total = tk.koefisien * tk.harga_satuan_ref;
    audit.push({
      step: 'hsp_tk',
      detail: `${tk.nama}: ${tk.koefisien} × ${tk.harga_satuan_ref} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: tk.ref ?? '',
      type: 'L' as const,
      nama: tk.nama,
      satuan: tk.satuan,
      coefficient: tk.koefisien,
      unit_price: tk.harga_satuan_ref,
      total_price: total,
    };
  });

  const bahanComponents: AhspComponent[] = item.bahan.map((b) => {
    const total = b.koefisien * b.harga_satuan_ref;
    audit.push({
      step: 'hsp_bahan',
      detail: `${b.nama}: ${b.koefisien} × ${b.harga_satuan_ref} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: b.ref ?? '',
      type: 'M' as const,
      nama: b.nama,
      satuan: b.satuan,
      coefficient: b.koefisien,
      unit_price: b.harga_satuan_ref,
      total_price: total,
    };
  });

  const alatComponents: AhspComponent[] = item.peralatan.map((e) => {
    const total = e.koefisien * e.harga_satuan_ref;
    audit.push({
      step: 'hsp_alat',
      detail: `${e.nama}: ${e.koefisien} × ${e.harga_satuan_ref} = ${total.toFixed(0)}`,
      value: total,
      unit: 'Rp',
    });
    return {
      ref: e.ref ?? '',
      type: 'E' as const,
      nama: e.nama,
      satuan: e.satuan,
      coefficient: e.koefisien,
      unit_price: e.harga_satuan_ref,
      total_price: total,
    };
  });

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

  const baseTotal = tkGroup.total + bahanGroup.total + alatGroup.total;

  const overheadPct = opts?.overhead_pct ?? item.margin.overhead_pct.default;
  const profitPct = opts?.profit_pct ?? item.margin.profit_pct.default;

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
    warnings: [],
    audit_trail: audit,
  };
}
