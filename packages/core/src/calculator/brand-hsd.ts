import { idr } from '../types/domain.js';
import type {
  HsdBahanBakar,
  HsdBahanEntry,
  HsdPeralatanSewaEntry,
  HsdRegional,
  HsdRegionInfo,
  HsdTenagaKerjaEntry,
} from '../types/index.js';

interface RawMoneyEntry {
  readonly ref: string;
  readonly nama?: string;
  readonly harga_rp: number;
  readonly satuan: string;
  readonly sumber_data: string;
}

/** HSD JSON before money fields are branded. */
export interface HsdPriceInput {
  readonly version: string;
  readonly region: HsdRegionInfo;
  readonly tenaga_kerja: readonly RawMoneyEntry[];
  readonly bahan: readonly RawMoneyEntry[];
  readonly peralatan_sewa: readonly RawMoneyEntry[];
  readonly bahan_bakar: {
    readonly solar_industri_rp_per_liter: number;
    readonly oli_mesin_rp_per_liter: number;
    readonly oli_hidrolik_rp_per_liter: number;
    readonly grease_rp_per_kg: number;
  };
}

function brandEntrySatuan(entry: RawMoneyEntry, satuan: 'OH' | 'jam'): void {
  if (entry.satuan !== satuan) {
    throw new Error(`HSD "${entry.ref}" satuan must be ${satuan}, got ${entry.satuan}`);
  }
}

function brandTenaga(entry: RawMoneyEntry): HsdTenagaKerjaEntry {
  brandEntrySatuan(entry, 'OH');
  return {
    ref: entry.ref,
    harga_rp: idr(entry.harga_rp),
    satuan: 'OH',
    sumber_data: entry.sumber_data,
  };
}

function brandBahan(entry: RawMoneyEntry): HsdBahanEntry {
  if (entry.nama === undefined) {
    throw new Error(`HSD bahan "${entry.ref}" is missing nama`);
  }
  return {
    ref: entry.ref,
    nama: entry.nama,
    harga_rp: idr(entry.harga_rp),
    satuan: entry.satuan,
    sumber_data: entry.sumber_data,
  };
}

function brandSewa(entry: RawMoneyEntry): HsdPeralatanSewaEntry {
  brandEntrySatuan(entry, 'jam');
  if (entry.nama === undefined) {
    throw new Error(`HSD peralatan sewa "${entry.ref}" is missing nama`);
  }
  return {
    ref: entry.ref,
    nama: entry.nama,
    harga_rp: idr(entry.harga_rp),
    satuan: 'jam',
    sumber_data: entry.sumber_data,
  };
}

function brandFuel(fuel: HsdPriceInput['bahan_bakar']): HsdBahanBakar {
  return {
    solar_industri_rp_per_liter: idr(fuel.solar_industri_rp_per_liter),
    oli_mesin_rp_per_liter: idr(fuel.oli_mesin_rp_per_liter),
    oli_hidrolik_rp_per_liter: idr(fuel.oli_hidrolik_rp_per_liter),
    grease_rp_per_kg: idr(fuel.grease_rp_per_kg),
  };
}

/**
 * Copy an HSD bundle and brand every Rupiah field.
 *
 * JSON stays plain numbers on disk. Call this when a bundle is loaded or
 * when a calculator accepts caller-supplied prices.
 */
export function brandHsdRegional(data: HsdPriceInput): HsdRegional {
  return {
    version: data.version,
    region: data.region,
    tenaga_kerja: data.tenaga_kerja.map(brandTenaga),
    bahan: data.bahan.map(brandBahan),
    peralatan_sewa: data.peralatan_sewa.map(brandSewa),
    bahan_bakar: brandFuel(data.bahan_bakar),
  };
}
