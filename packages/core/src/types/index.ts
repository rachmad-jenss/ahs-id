export type { IDR, Percentage, Volume } from './domain.js';
export { idr, percentage, volume } from './domain.js';

// ============================================================
// Volume State
// ============================================================

export type VolumeState = 'bank' | 'loose' | 'compacted';

// ============================================================
// Bundle Metadata
// ============================================================

export interface AhsMeta {
  readonly permen_nomor: number | null;
  readonly permen_tahun: number;
  readonly regulation: string;
  readonly supplement: string | null;
  readonly effective_date: string;
  readonly supersedes: string | null;
  readonly bidang: readonly string[];
  readonly data_source: string;
  readonly last_verified: string;
}

export interface BundleMeta {
  readonly name: string;
  readonly version: string;
  readonly ahs_meta: AhsMeta;
}

// ============================================================
// Master Tenaga Kerja
// ============================================================

export type KualifikasiTK =
  | 'non-terampil'
  | 'terampil'
  | 'terampil-senior'
  | 'pengawas'
  | 'operator'
  | 'semi-terampil';

export interface TenagaKerja {
  readonly kode: string;
  readonly nama: string;
  readonly satuan: 'OH';
  readonly kualifikasi: KualifikasiTK;
  readonly rumpun?: string;
  readonly jam_kerja_nominal: number;
  readonly jam_efektif: number;
}

export interface TenagaKerjaBundle {
  readonly version: string;
  readonly items: readonly TenagaKerja[];
}

// ============================================================
// Master Bahan
// ============================================================

export interface BahanMaster {
  readonly kode: string;
  readonly nama: string;
  readonly satuan: string;
  readonly kategori?: string;
}

export interface BahanMasterBundle {
  readonly version: string;
  readonly items: readonly BahanMaster[];
}

// ============================================================
// Master Peralatan
// ============================================================

export type TipeProduksi = 'siklus' | 'lintasan' | 'throughput';
export type KondisiOperasi = 'normal' | 'berat' | 'sangat_berat';

export interface PelumasEntry {
  readonly cp: number;
  readonly satuan: string;
  readonly basis?: 'berat_operasi';
}

export interface PelumasParams {
  readonly mesin: PelumasEntry;
  readonly hidrolik: PelumasEntry;
  readonly grease: PelumasEntry;
}

export interface FprParams {
  readonly normal: number;
  readonly berat: number;
  readonly sangat_berat?: number;
  readonly default: KondisiOperasi;
  readonly catatan?: string;
}

export interface HsdParams {
  readonly harga_pokok_rp: number;
  readonly umur_ekonomis_tahun: number;
  readonly jam_kerja_per_tahun: number;
  readonly nilai_sisa_pct: number;
  readonly faktor_angsuran: number;
  readonly asuransi_pajak_pct: number;
  readonly bahan_bakar_ch: number;
  readonly pelumas: PelumasParams;
  readonly perawatan_pct: number;
  readonly perbaikan_pct: number;
  readonly fpr: FprParams;
}

export interface ProduktivitasParams {
  readonly [key: string]: unknown;
  readonly volume_state_output: VolumeState | null;
}

export interface PeralatanMaster {
  readonly kode: string;
  readonly nama: string;
  readonly tipe_default: string;
  readonly daya_hp: number;
  readonly berat_operasi_ton: number;
  readonly tipe_produksi: TipeProduksi;
  readonly kapasitas_bucket_m3?: number;
  readonly kapasitas_ton?: number;
  readonly kapasitas_m3?: number;
  readonly lebar_drum_m?: number;
  readonly hsd_params: HsdParams;
  readonly produktivitas_params: ProduktivitasParams;
}

export interface PeralatanMasterBundle {
  readonly version: string;
  readonly items: readonly PeralatanMaster[];
}

// ============================================================
// Faktor Konversi Volume
// ============================================================

export interface FaktorKonversiEntry {
  readonly material: string;
  readonly bank_to_loose: number;
  readonly bank_to_compacted: number | null;
  readonly berat_jenis_bank_ton_m3: number;
}

export interface FaktorKonversi {
  readonly version: string;
  readonly derivation_rule: string;
  readonly items: readonly FaktorKonversiEntry[];
}

// ============================================================
// AHSP Item
// ============================================================

export type KoefSumber = 'tabel' | 'kalkulasi';
export type ModeBiaya = 'ownership' | 'sewa';

export interface AhspTenagaKerjaEntry {
  readonly ref: string;
  readonly koefisien: number;
  readonly koef_sumber: KoefSumber;
  readonly catatan: string | null;
}

export interface AhspBahanEntry {
  readonly ref: string;
  readonly nama_override?: string;
  readonly koefisien: number;
  readonly koef_sumber: KoefSumber;
  readonly faktor_kehilangan_pct?: number;
  readonly volume_state: VolumeState | null;
  readonly catatan: string | null;
}

export interface KoefReferensi {
  readonly value: number;
  readonly asumsi: Readonly<Record<string, unknown>>;
}

export interface AhspPeralatanEntry {
  readonly ref: string;
  readonly nama: string;
  readonly koef_sumber: KoefSumber;
  readonly mode_biaya: ModeBiaya;
  readonly volume_state: VolumeState | null;
  readonly variabel_input: readonly string[];
  readonly koef_referensi: KoefReferensi | null;
  readonly catatan?: string | null;
}

// ============================================================
// Fixed-Coefficient AHSP (Cipta Karya)
// ============================================================

export interface FixedCoeffTkEntry {
  readonly ref?: string | null;
  readonly nama: string;
  readonly satuan: string;
  readonly koefisien: number;
  readonly harga_satuan_ref: number;
}

export interface FixedCoeffBahanEntry {
  readonly ref?: string | null;
  readonly nama: string;
  readonly satuan: string;
  readonly koefisien: number;
  readonly harga_satuan_ref: number;
}

export interface FixedCoeffPeralatanEntry {
  readonly ref?: string | null;
  readonly nama: string;
  readonly satuan: string;
  readonly koefisien: number;
  readonly harga_satuan_ref: number;
}

export interface FixedCoefficientItem {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly bidang: string;
  readonly divisi: number;
  readonly sub_divisi: string;
  readonly satuan_bayar: string;
  readonly jenis_kalkulasi: 'fixed_coefficient';
  readonly jenis_pekerjaan: 'manual' | 'mekanis' | 'semi-mekanis';
  readonly is_lump_sum: boolean;
  readonly tenaga_kerja: readonly FixedCoeffTkEntry[];
  readonly bahan: readonly FixedCoeffBahanEntry[];
  readonly peralatan: readonly FixedCoeffPeralatanEntry[];
  readonly harga_satuan_pekerjaan_ref?: number | null;
  readonly margin: MarginDefinition;
  readonly provenance: Provenance;
}

export interface SubAhspEntry {
  readonly ref_ahsp: string;
  readonly nama: string;
  readonly koefisien: number;
  readonly satuan_koefisien: string;
  readonly satuan_konteks: 'parent';
  readonly volume_state: VolumeState | null;
  readonly catatan?: string | null;
}

export interface VariabelDefinition {
  readonly label: string;
  readonly satuan?: string;
  readonly tipe: 'number' | 'enum';
  readonly options?: readonly string[];
  readonly required?: boolean;
  readonly default: number | string | null;
  readonly min?: number;
  readonly max?: number;
  readonly catatan?: string;
}

export interface MarginDefinition {
  readonly overhead_pct: {
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly default: number;
    readonly catatan?: string;
  };
  readonly profit_pct: {
    readonly label: string;
    readonly min: number;
    readonly max: number;
    readonly default: number;
    readonly catatan?: string;
  };
  readonly constraint: {
    readonly rule: string;
    readonly catatan?: string;
  };
}

export type VerificationTier =
  | 'auto-extracted'
  | 'spot-checked'
  | 'verified'
  | 'executed';

export interface Provenance {
  readonly sumber_regulasi: string;
  readonly halaman: string;
  readonly verification_tier: VerificationTier;
  readonly diverifikasi_oleh: string | null;
  readonly tanggal_verifikasi: string | null;
}

export interface AhspItem {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly bidang: string;
  readonly divisi: number;
  readonly sub_divisi: string;
  readonly satuan_bayar: string;
  readonly volume_state_bayar: VolumeState;
  readonly jenis_pekerjaan: 'manual' | 'mekanis' | 'semi-mekanis';
  readonly is_lump_sum: boolean;
  readonly sub_ahsp: readonly SubAhspEntry[];
  readonly tenaga_kerja: readonly AhspTenagaKerjaEntry[];
  readonly bahan: readonly AhspBahanEntry[];
  readonly peralatan: readonly AhspPeralatanEntry[];
  readonly variabel: Readonly<Record<string, VariabelDefinition>>;
  readonly margin: MarginDefinition;
  readonly provenance: Provenance;
  readonly catatan_umum: readonly string[];
}

// ============================================================
// HSD Regional
// ============================================================

export interface HsdRegionInfo {
  readonly provinsi: string;
  readonly kode_provinsi: string;
  readonly kabupaten: string | null;
  readonly tahun_berlaku: number;
  readonly kuartal: number;
  readonly dasar_hukum: string;
  readonly tanggal_terbit: string;
}

export interface HsdTenagaKerjaEntry {
  readonly ref: string;
  readonly harga_rp: number;
  readonly satuan: 'OH';
  readonly sumber_data: string;
}

export interface HsdBahanEntry {
  readonly ref: string;
  readonly nama: string;
  readonly harga_rp: number;
  readonly satuan: string;
  readonly sumber_data: string;
}

export interface HsdPeralatanSewaEntry {
  readonly ref: string;
  readonly nama: string;
  readonly harga_rp: number;
  readonly satuan: 'jam';
  readonly sumber_data: string;
}

export interface HsdBahanBakar {
  readonly solar_industri_rp_per_liter: number;
  readonly oli_mesin_rp_per_liter: number;
  readonly oli_hidrolik_rp_per_liter: number;
  readonly grease_rp_per_kg: number;
}

export interface HsdRegional {
  readonly version: string;
  readonly region: HsdRegionInfo;
  readonly tenaga_kerja: readonly HsdTenagaKerjaEntry[];
  readonly bahan: readonly HsdBahanEntry[];
  readonly peralatan_sewa: readonly HsdPeralatanSewaEntry[];
  readonly bahan_bakar: HsdBahanBakar;
}

// ============================================================
// Calculation Results
// ============================================================

export interface AhspComponent {
  readonly ref: string;
  readonly type: 'M' | 'L' | 'E';
  readonly nama: string;
  readonly satuan: string;
  readonly coefficient: number;
  readonly unit_price: number;
  readonly total_price: number;
  readonly fallback_level?: number;
}

export interface AhspGroup {
  readonly type: 'M' | 'L' | 'E';
  readonly title: string;
  readonly components: readonly AhspComponent[];
  readonly total: number;
}

export interface AhspCalculation {
  readonly groups: readonly AhspGroup[];
  readonly baseTotal: number;
  readonly overheadPct: number;
  readonly profitPct: number;
  readonly overheadProfitValue: number;
  readonly grandTotal: number;
  readonly warnings: readonly string[];
  readonly audit_trail: readonly AuditEntry[];
}

export interface HSPResult extends AhspCalculation {
  readonly kode_ahsp: string;
  readonly nama: string;
  readonly satuan_bayar: string;
}

// ============================================================
// Calculator Config & Input
// ============================================================

export interface CalculatorConfig {
  readonly ppn_pct?: number;
  readonly mode?: 'penuh' | 'estimasi-kasar';
  readonly hsd_staleness_warning_days?: number;
}

export type VariabelInput = Readonly<Record<string, number | string>>;

// ============================================================
// Data Bundle (assembled)
// ============================================================

export interface DataBundle {
  readonly meta: BundleMeta;
  readonly tenaga_kerja: TenagaKerjaBundle;
  readonly bahan: BahanMasterBundle;
  readonly peralatan: PeralatanMasterBundle;
  readonly faktor_konversi: FaktorKonversi;
  readonly ahsp_items: readonly AhspItem[];
}

// ============================================================
// Audit Trail
// ============================================================

export interface AuditEntry {
  readonly step: string;
  readonly detail: string;
  readonly value?: number;
  readonly unit?: string;
}

export type AuditTrail = readonly AuditEntry[];

// ============================================================
// Validation
// ============================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly severity: ValidationSeverity;
  readonly code: string;
}

export interface ValidationReport {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationError[];
  readonly checked_at: string;
}
