# AHS-ID: Architecture Specification v2.3

> **Revision:** v2.3 — Complete project plan. Added README structure, phase scopes, proof-of-engine definition, release strategy, legal framework, risk register, success metrics, and EstiMara integration guide.
> **Regulatory basis:** Permen PUPR No. 8 Tahun 2023 & SE Dirjen Bina Konstruksi No. 73/2023
> **Changelog:** See [Appendix A](#appendix-a-audit-resolution-log-v1--v2) (v1→v2), [Appendix B](#appendix-b-round-2-refinements-v2--v21) (v2→v2.1), [Appendix C](#appendix-c-round-3-additions-v21--v22) (v2.1→v2.2), [Appendix D](#appendix-d-round-4-project-plan-v22--v23) (v2.2→v2.3).

---

## 1. Project Overview

**AHS-ID** is a proposed open source library that models Indonesia's Analisa Harga Satuan Pekerjaan (AHSP) system as installable, versioned data bundles with a calculation engine.

**Design goals:**
- Provide machine-readable, structured JSON data for AHSP coefficients (currently only available as PDF/Excel)
- Separate static coefficients (manual work) from dynamic coefficients (mechanized work calculated from equipment productivity)
- Support multiple regulation versions as installable bundles (e.g. `@ahs-id/pupr-2023`, `@ahs-id/pupr-2022`)
- Support regional HSD (Harga Satuan Dasar) price data as separate bundles
- Include a calculation engine for HSD equipment costs, equipment productivity, and HSP (Harga Satuan Pekerjaan)
- Serve as the open source foundation layer for **EstiMara** (estimara.id), a commercial SaaS platform for auditable construction project control

**Language strategy:** Core engine and JSON bundles are **language-agnostic data + TypeScript engine** (for EstiMara web integration), with a **Python wrapper as a first-class target** consuming the same JSON bundles. The JSON data is the source of truth; language-specific engines are consumers.

**Author context:** Practicing civil engineer at an EPC company (mining & infrastructure), with hands-on experience building AHS Excel workbooks for haul roads, spillways, sub-drain installations, and road construction projects.

---

## 2. Anatomi Perhitungan AHSP (Dari Regulasi)

### 2.1 Hierarki Perhitungan (Revised)

```
                    ┌─────────────────────────┐
                    │    HARGA PENAWARAN       │
                    │   (Bid Price / RAB)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     HPS / HPP / RAB      │
                    │  (Owner Estimate / EE)   │
                    └────────────┬────────────┘
                                 │
         ┌───────────────┬───────┼───────┬───────────────┐
         ▼               ▼       ▼       ▼               ▼
  ┌─────────────┐ ┌───────────┐ ┌───┐ ┌──────────┐ ┌─────────┐
  │ HSP per Item│ │ Mob/Demob │ │PPN│ │Biaya SMKK│ │ Biaya   │
  │ Pekerjaan   │ │ (Divisi 1)│ │   │ │ (K3)     │ │Tak Terd.│
  └──────┬──────┘ └───────────┘ └───┘ └──────────┘ └─────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌───────────┐
│ Biaya  │ │ Biaya Tdk │
│Langsung│ │ Langsung  │
│(Direct)│ │ (Indirect)│
└───┬────┘ └─────┬─────┘
    │            │
    │      ┌─────┴──────┐
    │      │ Overhead + │
    │      │ Profit     │
    │      │ (10-15%)   │
    │      │ *Tidak utk │
    │      │  lump sum  │
    │      └────────────┘
    │
    ├── Tenaga Kerja: Σ (Koef_TK × HSD_TK)
    ├── Bahan:        Σ (Koef_Bahan × HSD_Bahan) [× faktor konversi volume]
    └── Peralatan:    Σ (Koef_Alat × HSD_Alat)
                          │
                          ├── HSD via Ownership (kalkulasi biaya pasti + operasi)
                          └── HSD via Sewa (harga sewa regional / jam)
```

**Perubahan dari v1:** Ditambahkan Mob/Demob sebagai direct cost terpisah (Divisi 1 Bina Marga), Biaya Tak Terduga, catatan lump sum exclusion pada overhead, dan dual-mode HSD peralatan.

### 2.2 Dua Jenis Koefisien

| Aspek | Pekerjaan Manual | Pekerjaan Mekanis/Semi-Mekanis |
|-------|------------------|-------------------------------|
| **Koefisien** | Statis, ditetapkan di tabel lampiran | Dinamis, dihitung dari produktivitas |
| **Sumber** | Tabel permanen, berlaku nasional | Perhitungan analisis per project |
| **Variabel** | Tetap | Kapasitas alat, faktor efisiensi, waktu siklus, kondisi lapangan |
| **Contoh** | Pekerja = 0,667 OH per m³ pasangan batu | Excavator = f(kapasitas, bucket, siklus, jarak, Fa) |
| **Di library** | → **Bundle data** (JSON statis) | → **Calculation engine** (formula) |

**Catatan:** Ada kasus hybrid (semi-mekanis) dimana sebagian koefisien statis (TK manual) dan sebagian dinamis (alat) dalam satu AHSP item. Schema mendukung ini via mixed `koef_sumber` per komponen.

### 2.3 Komponen HSD Peralatan (Revised — Fixed Critical #4)

```
HSD_Alat (Rp/jam) = Biaya Pasti + Biaya Operasi

═══ MODE: OWNERSHIP (Kalkulasi) ═══

Biaya Pasti:
├── Biaya Pengembalian Modal = (B - C) × D / W
│   ├── B   = Harga pokok alat (Rp)
│   ├── C   = Nilai sisa = (3-10%) × B
│   ├── D   = Faktor angsuran modal
│   └── W   = Jam kerja per tahun (2000 jam std)
└── Biaya Asuransi & Pajak  = Ins% × B / W

Biaya Operasi:
├── Bahan Bakar Utama  H1 = Ch × Pw × Ms
│   ├── Ch  = 0.125-0.175 (ringan) atau 0.20 (berat)
│   ├── Pw  = Daya mesin (HP)
│   └── Ms  = Harga solar (Rp/liter)
│
│   ── Khusus AMP/Plant: komponen pemanas (Refined R2) ──
├── Bahan Bakar Pemanas Agregat  H2 = f(kapasitas, kadar_air, ΔT) × Ms
│   └── Berlaku jika bahan_bakar_pemanas.agregat.enabled = true
├── Bahan Bakar/Oli Pemanas Aspal H3 = f(kapasitas, suhu_target) × Mo
│   └── Berlaku jika bahan_bakar_pemanas.aspal.enabled = true
│   └── Total Bahan Bakar AMP = H1 + H2 + H3
│
├── Pelumas Mesin     I1 = Cp_mesin × Pw × Mp_mesin
├── Oli Hidrolik      I2 = Cp_hidro × Pw × Mp_hidro
├── Grease            I3 = Cp_grease × Berat × Mg
│   ├── Cp  = Faktor konsumsi per jenis pelumas
│   └── Mp/Mg = Harga pelumas/grease per liter/kg
├── Perawatan         = Fp% × B × Fpr / W
├── Perbaikan         = Fr% × B × Fpr / W
│   └── Fpr = Faktor kondisi operasi (1.0 normal, 1.2 berat, 1.5 sangat berat)
├── Upah Operator     = HSD_TK_Operator / Tk
└── Upah Pemb.Opr    = HSD_TK_PembOpr / Tk

═══ MODE: SEWA (Regional Rate) ═══

HSD_Alat = harga_sewa_per_jam (dari HSD Regional Bundle)
```

### 2.4 Model Produktivitas per Tipe Alat (Revised — Fixed Critical #2)

```
Koefisien Alat (jam/satuan) = 1 / Produktivitas (satuan/jam)

═══ TIPE A: SIKLUS (Excavator, Dump Truck, Wheel Loader, Crane) ═══

Produktivitas = (V × Fb × Fa × Fk) / Ts  (satuan/jam)

├── V   = Kapasitas alat (m³, ton)
├── Fb  = Faktor bucket/blade (0.80-1.20)
├── Fa  = Faktor efisiensi alat (0.70-0.83)
├── Fk  = Faktor kondisi kerja
└── Ts  = Waktu siklus (menit)
    ├── T_muat     = waktu loading
    ├── T_angkut   = Jarak / Kecepatan_isi
    ├── T_kembali  = Jarak / Kecepatan_kosong
    ├── T_bongkar  = waktu dumping
    └── T_tunggu   = idle/maneuver time


═══ TIPE B: LINTASAN (Vibro Roller, Motor Grader, Finisher) ═══

Produktivitas = (v × b × t × Fa) / n  (m³/jam)

├── v   = Kecepatan operasi (km/jam → HARUS dikonversi ke m/jam: v_m = v_km × 1000)
├── b   = Lebar efektif (drum width / blade width) (m)
├── t   = Tebal hamparan (m) — hanya untuk roller
├── Fa  = Faktor efisiensi alat
└── n   = Jumlah lintasan / passing

⚠️  UNIT CONVERSION CRITICAL:
    Input kecepatan_operasi_km_jam disimpan dalam km/jam (2.0, 2.5, 3.0).
    Formula menghasilkan m³/jam HANYA jika v dalam m/jam.
    lintasan.ts WAJIB convert: v_m = kecepatan_operasi_km_jam × 1000
    Tanpa konversi → produktivitas off by 1000×.
    Golden test akan langsung catch error ini.


═══ TIPE C: THROUGHPUT (AMP, Batching Plant, Stone Crusher, Concrete Pump) ═══

Produktivitas = Kapasitas_Rated × Fa  (satuan/jam)

├── Kapasitas_Rated = Kapasitas desain pabrik (ton/jam, m³/jam)
└── Fa              = Faktor efisiensi (termasuk downtime, setup)
```

### 2.5 Faktor Konversi Volume (NEW — Fixed Critical #3)

```
Material berubah volume tergantung kondisi:

┌──────────┐     ×Fk_swell      ┌──────────┐    ×Fk_compact     ┌──────────┐
│  BANK    │ ──────────────────► │  LOOSE   │ ─────────────────► │ COMPACTED│
│ (asli)   │   (1.20-1.40)      │ (gembur) │   (0.80-0.90)      │ (padat)  │
└──────────┘                     └──────────┘                     └──────────┘

Contoh tanah biasa:
  1 m³ bank = 1.25 m³ loose = 0.85 m³ compacted

Implikasi di AHSP:
  - Excavator bekerja di volume BANK
  - Dump Truck mengangkut volume LOOSE
  - Roller memadatkan ke volume COMPACTED
  - Satuan bayar (satuan_bayar) harus diketahui state-nya

Engine harus convert antar volume state saat aggregating koefisien
dari alat berbeda dalam satu AHSP chain.
```

---

## 3. Peta Domain (Revised)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AHS-ID DOMAIN MAP v2                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────┐       ┌───────────────────────────────┐  │
│  │    BUNDLE DATA         │       │    CALCULATION ENGINE         │  │
│  │    (Installable)       │       │    (@ahs-id/core)             │  │
│  ├────────────────────────┤       ├───────────────────────────────┤  │
│  │                        │       │                               │  │
│  │  A. Koefisien Manual   │       │  1. HSD Calculator            │  │
│  │     ├── Tenaga Kerja   │       │     ├── HSD Tenaga Kerja      │  │
│  │     └── Bahan          │       │     ├── HSD Bahan (+loss fct) │  │
│  │                        │       │     └── HSD Peralatan          │  │
│  │  B. Master Bahan       │       │        ├── Mode: Ownership    │  │
│  │     ├── Kode (M.*)     │       │        └── Mode: Sewa         │  │
│  │     ├── Nama           │       │                               │  │
│  │     └── Satuan         │       │  2. Produktivitas Engine      │  │
│  │                        │       │     ├── Siklus (Exc, DT, WL)  │  │
│  │  C. Master Alat        │       │     ├── Lintasan (VR, MG, Fn) │  │
│  │     ├── Kode (E.*)     │       │     └── Throughput (AMP, BP)  │  │
│  │     ├── Tipe Produksi  │       │                               │  │
│  │     └── Spesifikasi    │       │  3. Volume Converter   ← NEW  │  │
│  │                        │       │     bank ↔ loose ↔ compacted  │  │
│  │  D. Master TK          │       │                               │  │
│  │     ├── Kode (L.*)     │       │  4. HSP Calculator            │  │
│  │     └── Kualifikasi    │       │     = Σ(koef × HSD) + margin  │  │
│  │                        │       │                               │  │
│  │  E. AHSP Templates     │       │  5. RAB Generator             │  │
│  │     ├── Umum           │       │     = Σ(Vol × HSP)            │  │
│  │     ├── SDA            │       │     + Mob/Demob               │  │
│  │     ├── Bina Marga     │       │     + SMKK                    │  │
│  │     └── Cipta Karya    │       │     + PPN                     │  │
│  │                        │       │                               │  │
│  │  F. HSD Regional       │       │  6. Margin Calculator         │  │
│  │     ├── Per Provinsi   │       │     ├── Overhead+Profit (%)   │  │
│  │     └── Per Kab/Kota   │       │     └── Lump sum exclusion    │  │
│  │                        │       │                               │  │
│  │  G. Faktor Konversi    │ ←NEW  │  7. Ref Integrity Checker     │  │
│  │     └── Swell/Shrink   │       │     └── Cross-ref validation  │  │
│  │                        │       │                               │  │
│  └────────────────────────┘       └───────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Struktur Data (JSON Schema) — Revised

### 4.1 Bundle Metadata

```jsonc
{
  "name": "@ahs-id/pupr-2023",
  "version": "1.0.0",             // ← Standard semver (Fixed Minor #16)
  "ahs_meta": {
    "permen_nomor": 8,             // Nomor Permen disimpan di sini, bukan di semver
    "permen_tahun": 2023,
    "regulation": "Permen PUPR No. 8 Tahun 2023",
    "supplement": "SE Dirjen Bina Konstruksi No. 73/2023",
    "effective_date": "2023-08-30",
    "supersedes": "@ahs-id/pupr-2022",
    "bidang": ["umum", "sda", "bina-marga", "cipta-karya"],
    "data_source": "Lampiran Permen PUPR 8/2023 via JDIH",
    "last_verified": "2026-05-14"
  }
}
```

### 4.2 Master Tenaga Kerja (Revised — Fixed Important #8, Minor #13)

```jsonc
{
  "$schema": "https://ahs-id.dev/schema/tenaga-kerja.json",
  "version": "1.0.0",
  "items": [
    {
      "kode": "L.01",
      "nama": "Pekerja / Buruh Tak Terampil",
      "satuan": "OH",
      "kualifikasi": "non-terampil",
      "jam_kerja_nominal": 8,       // ← Definisi OH = 8 jam (Fixed #8)
      "jam_efektif": 7,             // ← Jam produktif setelah istirahat
      "catatan": "Koefisien regulasi sudah memperhitungkan produktivitas dalam 8 jam OH"
    },
    {
      "kode": "L.02a",              // ← Sub-typed (Fixed #13)
      "nama": "Tukang Batu",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02b",
      "nama": "Tukang Kayu",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02c",
      "nama": "Tukang Besi",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02d",
      "nama": "Tukang Cat",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02e",
      "nama": "Tukang Las",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02f",
      "nama": "Tukang Pipa",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02g",
      "nama": "Tukang Listrik",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.02h",
      "nama": "Tukang Jahit Geotekstil",
      "satuan": "OH",
      "kualifikasi": "terampil",
      "rumpun": "L.02",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.03",
      "nama": "Kepala Tukang",
      "satuan": "OH",
      "kualifikasi": "terampil-senior",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.04",
      "nama": "Mandor",
      "satuan": "OH",
      "kualifikasi": "pengawas",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.05",
      "nama": "Operator Alat Berat",
      "satuan": "OH",
      "kualifikasi": "operator",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    },
    {
      "kode": "L.06",
      "nama": "Pembantu Operator",
      "satuan": "OH",
      "kualifikasi": "semi-terampil",
      "jam_kerja_nominal": 8,
      "jam_efektif": 7
    }
  ]
}
```

### 4.3 Master Peralatan (Revised — Fixed Critical #2, #4)

```jsonc
{
  "$schema": "https://ahs-id.dev/schema/peralatan.json",
  "version": "1.0.0",
  "items": [
    {
      "kode": "E.01",
      "nama": "Excavator",
      "tipe_default": "PC-200",
      "kapasitas_bucket_m3": 0.93,
      "daya_hp": 138,
      "berat_operasi_ton": 20.3,
      "tipe_produksi": "siklus",              // ← NEW: dispatch key (Fixed #2)

      "hsd_params": {
        "harga_pokok_rp": 1750000000,
        "umur_ekonomis_tahun": 5,
        "jam_kerja_per_tahun": 2000,
        "nilai_sisa_pct": 0.10,
        "faktor_angsuran": 0.2638,
        "asuransi_pajak_pct": 0.02,
        "bahan_bakar_ch": 0.175,

        // ← REVISED: Separated pelumas detail (Fixed #4)
        "pelumas": {
          "mesin":    { "cp": 0.0032, "satuan": "liter/HP/jam" },
          "hidrolik": { "cp": 0.0015, "satuan": "liter/HP/jam" },
          "grease":   { "cp": 0.10,   "satuan": "kg/ton/jam", "basis": "berat_operasi" }
        },

        // ← REVISED: Perawatan/perbaikan with Fpr (Fixed #4)
        "perawatan_pct": 0.065,
        "perbaikan_pct": 0.125,
        "fpr": {
          "normal": 1.0,
          "berat": 1.2,
          "sangat_berat": 1.5,
          "default": "normal",
          "catatan": "Fpr menyesuaikan biaya perawatan/perbaikan berdasarkan kondisi operasi (terrain, cuaca, abrasivitas material)"
        }
      },

      "produktivitas_params": {
        // Tipe siklus: V × Fb × Fa × Fk / Ts
        "faktor_bucket": {
          "tanah_biasa": 1.00,
          "tanah_lempung_keras": 0.80,
          "batu_pecah": 0.75
        },
        "waktu_siklus_menit": {
          "kedalaman_0_2m": 0.45,
          "kedalaman_2_4m": 0.55,
          "kedalaman_4_6m": 0.65
        },
        "sudut_putar_koreksi": {
          "45": 1.00,
          "90": 0.85,
          "135": 0.72,
          "180": 0.65
        },
        "volume_state_output": "bank"         // ← NEW (Fixed #3)
      }
    },

    {
      "kode": "E.08",
      "nama": "Dump Truck",
      "tipe_default": "DT-12T",
      "kapasitas_ton": 12,
      "kapasitas_m3": 8,
      "daya_hp": 200,
      "berat_operasi_ton": 15.0,
      "tipe_produksi": "siklus",

      "hsd_params": {
        "harga_pokok_rp": 850000000,
        "umur_ekonomis_tahun": 5,
        "jam_kerja_per_tahun": 2000,
        "nilai_sisa_pct": 0.10,
        "faktor_angsuran": 0.2638,
        "asuransi_pajak_pct": 0.02,
        "bahan_bakar_ch": 0.175,
        "pelumas": {
          "mesin":    { "cp": 0.0032, "satuan": "liter/HP/jam" },
          "hidrolik": { "cp": 0.0008, "satuan": "liter/HP/jam" },
          "grease":   { "cp": 0.05,   "satuan": "kg/ton/jam", "basis": "berat_operasi" }
        },
        "perawatan_pct": 0.065,
        "perbaikan_pct": 0.10,
        "fpr": { "normal": 1.0, "berat": 1.2, "sangat_berat": 1.5, "default": "normal" }
      },

      "produktivitas_params": {
        "kecepatan_isi_km_jam": {
          "datar_baik": 40, "datar_sedang": 30,
          "menanjak_baik": 25, "menanjak_sedang": 20
        },
        "kecepatan_kosong_km_jam": {
          "datar_baik": 50, "datar_sedang": 40,
          "menurun_baik": 45, "menurun_sedang": 35
        },
        "waktu_muat_menit": 2.5,
        "waktu_bongkar_menit": 1.5,
        "waktu_tunggu_menit": 1.0,
        "faktor_muatan": {
          "tanah_gembur": 1.00, "kerikil": 0.95, "batu_pecah": 0.85
        },
        "volume_state_output": "loose"        // ← DT handles loose volume
      }
    },

    {
      "kode": "E.22",
      "nama": "Vibratory Roller",
      "tipe_default": "8-10 Ton",
      "lebar_drum_m": 2.13,
      "daya_hp": 100,
      "berat_operasi_ton": 9.0,
      "tipe_produksi": "lintasan",            // ← Tipe B (Fixed #2)

      "hsd_params": {
        "harga_pokok_rp": 1200000000,
        "umur_ekonomis_tahun": 5,
        "jam_kerja_per_tahun": 2000,
        "nilai_sisa_pct": 0.10,
        "faktor_angsuran": 0.2638,
        "asuransi_pajak_pct": 0.02,
        "bahan_bakar_ch": 0.15,
        "pelumas": {
          "mesin":    { "cp": 0.0028, "satuan": "liter/HP/jam" },
          "hidrolik": { "cp": 0.0010, "satuan": "liter/HP/jam" },
          "grease":   { "cp": 0.08,   "satuan": "kg/ton/jam", "basis": "berat_operasi" }
        },
        "perawatan_pct": 0.065,
        "perbaikan_pct": 0.10,
        "fpr": { "normal": 1.0, "berat": 1.2, "sangat_berat": 1.5, "default": "normal" }
      },

      "produktivitas_params": {
        // Tipe lintasan: v × b × t × Fa / n
        // ⚠️ v MUST be converted: v_m = v_km × 1000 before formula
        "kecepatan_operasi_km_jam": {
          "tanah": 2.0, "agregat": 2.5, "aspal": 3.0
        },
        "lebar_efektif_m": 2.00,
        "overlap_m": 0.13,
        "jumlah_passing": {
          "tanah_pondasi": 8, "agregat_kelas_a": 6, "aspal": 4
        },
        "volume_state_output": "compacted"    // ← Roller outputs compacted
      }
    },

    {
      "kode": "E.30",
      "nama": "Asphalt Mixing Plant",
      "tipe_default": "AMP 800 kg/batch",
      "kapasitas_rated_ton_jam": 60,
      "daya_hp": 400,
      "berat_operasi_ton": 50,
      "tipe_produksi": "throughput",           // ← Tipe C (Fixed #2)

      "hsd_params": {
        "harga_pokok_rp": 8500000000,
        "umur_ekonomis_tahun": 10,
        "jam_kerja_per_tahun": 2000,
        "nilai_sisa_pct": 0.05,
        "faktor_angsuran": 0.1627,
        "asuransi_pajak_pct": 0.02,
        "bahan_bakar_ch": 0.20,

        // ← REFINED R2: Replaced boolean flags with calculable params
        "bahan_bakar_pemanas": {
          "agregat": {
            "enabled": true,
            "konsumsi_liter_per_ton": 2.5,
            "catatan": "Tergantung kadar air agregat (2-8%) dan ΔT target (~150°C). Nilai default 2.5 l/ton untuk kadar air ~4%"
          },
          "aspal": {
            "enabled": true,
            "konsumsi_liter_per_ton": 1.8,
            "media": "oli_pemanas",
            "catatan": "Oli thermal untuk memanaskan aspal ke suhu pencampuran (~155-165°C). Dihitung terpisah dari bahan bakar mesin"
          }
        },

        "pelumas": {
          "mesin":    { "cp": 0.0025, "satuan": "liter/HP/jam" },
          "hidrolik": { "cp": 0.0010, "satuan": "liter/HP/jam" },
          "grease":   { "cp": 0.05,   "satuan": "kg/ton/jam", "basis": "berat_operasi" }
        },
        "perawatan_pct": 0.065,
        "perbaikan_pct": 0.10,
        "fpr": { "normal": 1.0, "berat": 1.2, "default": "normal" }
      },

      "produktivitas_params": {
        // Tipe throughput: Kapasitas_Rated × Fa
        "kapasitas_rated_ton_jam": 60,
        "volume_state_output": null
      }
    }
  ]
}
```

### 4.4 Faktor Konversi Volume (NEW — Fixed Critical #3)

```jsonc
// faktor-konversi.json
// DESIGN RULE (Refined R2): Store only bank_to_loose and bank_to_compacted.
// The engine DERIVES loose_to_compacted = bank_to_compacted / bank_to_loose.
// This eliminates rounding inconsistencies (e.g. 0.786 vs 0.79).
// validateBundle() checks consistency if loose_to_compacted is optionally provided.
{
  "$schema": "https://ahs-id.dev/schema/faktor-konversi.json",
  "version": "1.0.0",
  "derivation_rule": "loose_to_compacted = bank_to_compacted / bank_to_loose (derived by engine, not stored)",
  "items": [
    {
      "material": "tanah_biasa",
      "bank_to_loose": 1.25,
      "bank_to_compacted": 0.85,
      // loose_to_compacted = 0.85 / 1.25 = 0.680 (derived)
      "berat_jenis_bank_ton_m3": 1.60
    },
    {
      "material": "tanah_lempung",
      "bank_to_loose": 1.30,
      "bank_to_compacted": 0.90,
      // loose_to_compacted = 0.90 / 1.30 = 0.692 (derived)
      "berat_jenis_bank_ton_m3": 1.75
    },
    {
      "material": "kerikil",
      "bank_to_loose": 1.12,
      "bank_to_compacted": 0.88,
      // loose_to_compacted = 0.88 / 1.12 = 0.786 (derived, NOT 0.79)
      "berat_jenis_bank_ton_m3": 1.85
    },
    {
      "material": "batu_pecah",
      "bank_to_loose": 1.40,
      "bank_to_compacted": null,
      // loose_to_compacted = not derivable (no compacted state for batu pecah)
      "berat_jenis_bank_ton_m3": 2.60
    },
    {
      "material": "agregat_kelas_a",
      "bank_to_loose": 1.20,
      "bank_to_compacted": 0.95,
      // loose_to_compacted = 0.95 / 1.20 = 0.792 (derived)
      "berat_jenis_bank_ton_m3": 2.10
    }
  ]
}
```

### 4.5 AHSP Work Item (Revised — Fixed Critical #1, Important #5, #6, #9)

```jsonc
{
  "$schema": "https://ahs-id.dev/schema/ahsp-item.json",
  "version": "1.0.0",
  "kode_ahsp": "3.2.1",
  "nama": "Lapis Pondasi Agregat Kelas A (CBR Min 90%)",
  "bidang": "bina-marga",
  "divisi": 3,
  "sub_divisi": "3.2",
  "satuan_bayar": "m3",
  "volume_state_bayar": "compacted",           // ← NEW (Fixed #3)
  "jenis_pekerjaan": "mekanis",
  "is_lump_sum": false,                        // ← NEW: lump sum → skip indirect cost

  // === SUB-AHSP NESTING (Fixed #5, Refined R2 with real example) ===
  // Contoh nyata: Beton K-250 mereferensi AHSP Campuran Beton sebagai sub-komponen.
  // Koefisien sub_ahsp dinyatakan dalam satuan_bayar PARENT (m3 beton).
  // Engine resolve secara rekursif: parent HSP = own components + Σ(sub.koef × sub.HSP).
  // volume_state propagation: jika child punya volume_state_bayar berbeda,
  //   engine HARUS convert via faktor_konversi sebelum aggregasi.
  // Circular dependency: engine tracks resolve stack dan throw error jika
  //   kode_ahsp muncul lebih dari sekali dalam chain.
  "sub_ahsp": [
    // Contoh (jika ini adalah AHSP Beton K-250):
    // {
    //   "ref_ahsp": "1.2.1",
    //   "nama": "Campuran Beton K-250 (1 m³)",
    //   "koefisien": 1.025,
    //   "satuan_koefisien": "m3",
    //   "satuan_konteks": "parent",
    //   "volume_state": null,
    //   "catatan": "1 m³ beton membutuhkan 1.025 m³ campuran (faktor kehilangan 2.5%)"
    // },
    // {
    //   "ref_ahsp": "1.2.5",
    //   "nama": "Mortar 1:3 (untuk bonding)",
    //   "koefisien": 0.05,
    //   "satuan_koefisien": "m3",
    //   "satuan_konteks": "parent",
    //   "volume_state": null,
    //   "catatan": "Lapisan bonding agent per m³ beton"
    // }
  ],

  // === TENAGA KERJA ===
  "tenaga_kerja": [
    {
      "ref": "L.01",
      "koefisien": 0.065,
      "koef_sumber": "tabel",
      "catatan": null
    },
    {
      "ref": "L.04",
      "koefisien": 0.007,
      "koef_sumber": "tabel",
      "catatan": null
    }
  ],

  // === BAHAN ===
  "bahan": [
    {
      "ref": "M.09.a",
      "nama_override": "Agregat Kelas A (CBR Min 90%)",
      "koefisien": 1.025,
      "koef_sumber": "tabel",
      "faktor_kehilangan_pct": 2.5,
      "volume_state": "compacted",
      "catatan": "Koefisien sudah termasuk faktor kehilangan"
    }
  ],

  // === PERALATAN (Revised — Fixed #1: no more koef_default) ===
  "peralatan": [
    {
      "ref": "E.11",
      "nama": "Wheel Loader 1.5 m³",
      "koef_sumber": "kalkulasi",
      "mode_biaya": "ownership",               // ← NEW (Fixed #9)
      "volume_state": "loose",                  // ← NEW (Fixed #3)
      "variabel_input": ["jenis_material"],
      "koef_referensi": {                       // ← REPLACED koef_default (Fixed #1)
        "value": 0.020,
        "asumsi": {
          "fa": 0.83,
          "jenis_material": "agregat",
          "kapasitas_bucket_m3": 1.5
        }
      },
      "catatan": "Koefisien tergantung kapasitas dan jenis material"
    },
    {
      "ref": "E.08",
      "nama": "Dump Truck 12 Ton",
      "koef_sumber": "kalkulasi",
      "mode_biaya": "ownership",
      "volume_state": "loose",
      "variabel_input": ["jarak_quarry_km", "kondisi_jalan"],
      "koef_referensi": null,                   // ← null = WAJIB hitung, tidak ada fallback
      "catatan": "Koefisien sangat tergantung jarak quarry ke lokasi"
    },
    {
      "ref": "E.19",
      "nama": "Motor Grader >100 HP",
      "koef_sumber": "kalkulasi",
      "mode_biaya": "ownership",
      "volume_state": null,                     // ← area-based, bukan volume
      "variabel_input": ["lebar_hamparan_m", "jumlah_lintasan"],
      "koef_referensi": {
        "value": 0.030,
        "asumsi": {
          "fa": 0.83,
          "lebar_hamparan_m": 3.0,
          "jumlah_lintasan": 6,
          "kecepatan_km_jam": 3.0
        }
      }
    },
    {
      "ref": "E.22",
      "nama": "Vibratory Roller 8-10 Ton",
      "koef_sumber": "kalkulasi",
      "mode_biaya": "ownership",
      "volume_state": "compacted",
      "variabel_input": ["tebal_hamparan_m", "jumlah_passing"],
      "koef_referensi": {
        "value": 0.020,
        "asumsi": {
          "fa": 0.83,
          "tebal_hamparan_m": 0.20,
          "jumlah_passing": 6,
          "kecepatan_km_jam": 2.5
        }
      }
    },
    {
      "ref": "E.25",
      "nama": "Water Tank Truck 4000L",
      "koef_sumber": "kalkulasi",
      "mode_biaya": "ownership",
      "volume_state": null,
      "variabel_input": ["jarak_sumber_air_km"],
      "koef_referensi": null                    // ← distance-dependent, wajib hitung
    }
  ],

  // === PARAMETER PROYEK (User Input) ===
  "variabel": {
    "jarak_quarry_km": {
      "label": "Jarak Quarry ke Lokasi",
      "satuan": "km",
      "tipe": "number",
      "required": true,
      "default": null,
      "min": 0.5,
      "max": 200
    },
    "jarak_sumber_air_km": {
      "label": "Jarak Sumber Air ke Lokasi",
      "satuan": "km",
      "tipe": "number",
      "required": true,
      "default": null,
      "min": 0.5,
      "max": 100,
      "catatan": "Intentionally required (Refined R2): jarak sumber air HARUS diketahui untuk setiap project. Tidak ada 'default' yang aman — asumsi 5 km bisa menyebabkan underestimate 3-10× di site remote. Kontraktor/HPS wajib survei sumber air sebelum menyusun RAB."
    },
    "kondisi_jalan": {
      "label": "Kondisi Jalan Hauling",
      "tipe": "enum",
      "options": ["baik", "sedang", "rusak"],
      "default": "sedang"
    },
    "jenis_material": {
      "label": "Jenis Material",
      "tipe": "enum",
      "options": ["tanah_biasa", "tanah_lempung", "kerikil", "batu_pecah", "agregat_kelas_a"],
      "default": "agregat_kelas_a"
    },
    "faktor_efisiensi": {
      "label": "Faktor Efisiensi Alat (Fa)",
      "tipe": "number",
      "default": 0.83,
      "min": 0.60,
      "max": 0.90,
      "catatan": "0.83 untuk HPP/HPS (kondisi operasi baik sekali)"
    },
    "kondisi_operasi": {
      "label": "Kondisi Operasi (untuk Fpr)",
      "tipe": "enum",
      "options": ["normal", "berat", "sangat_berat"],
      "default": "normal",
      "catatan": "Mempengaruhi biaya perawatan/perbaikan alat"
    },
    "tebal_hamparan_m": {
      "label": "Tebal Hamparan",
      "satuan": "m",
      "tipe": "number",
      "default": 0.20,
      "min": 0.10,
      "max": 0.50
    },
    "jumlah_passing": {
      "label": "Jumlah Passing Roller",
      "tipe": "number",
      "default": 6,
      "min": 2,
      "max": 16
    },
    "lebar_hamparan_m": {
      "label": "Lebar Hamparan",
      "satuan": "m",
      "tipe": "number",
      "default": 3.0,
      "min": 1.0,
      "max": 10.0
    },
    "jumlah_lintasan": {
      "label": "Jumlah Lintasan Grader",
      "tipe": "number",
      "default": 6,
      "min": 2,
      "max": 12
    }
  },

  // === MARGIN — Split overhead & profit, PPN to engine config (Fixed #6, Review Fix) ===
  "margin": {
    "overhead_pct": {
      "label": "Biaya Umum (Overhead)",
      "min": 0,
      "max": 15,
      "default": 10,
      "catatan": "Komponen biaya umum/tidak langsung"
    },
    "profit_pct": {
      "label": "Keuntungan (Profit)",
      "min": 0,
      "max": 15,
      "default": 5,
      "catatan": "Komponen keuntungan kontraktor"
    },
    "constraint": {
      "rule": "10 <= overhead_pct + profit_pct <= 15",
      "catatan": "Permen PUPR: total Biaya Umum dan Keuntungan maks 15%, min 10%. Engine MUST validate sum constraint. Schema stores split, engine can expose combined via overhead_profit_total_pct computed field."
    }
    // PPN REMOVED from here → moved to createCalculator() engine config
  },

  // === PROVENANCE (NEW — Minor #15) ===
  "provenance": {
    "sumber_regulasi": "Permen PUPR 8/2023 Lampiran III Bina Marga",
    "halaman": "III-45",
    "diverifikasi_oleh": null,
    "tanggal_verifikasi": null
  },

  "catatan_umum": [
    "AHSP ini bersifat informatif, koefisien dapat disesuaikan kondisi lapangan",
    "Untuk HPS gunakan Fa = 0.83 (kondisi operasi baik sekali)",
    "Koefisien Dump Truck dan Water Tanker WAJIB dihitung berdasarkan jarak aktual",
    "Volume state: satuan bayar dalam m³ compacted"
  ]
}
```

### 4.6 HSD Regional Bundle (Revised — Minor #15)

```jsonc
{
  "$schema": "https://ahs-id.dev/schema/hsd-regional.json",
  "version": "2025.1.0",
  "region": {
    "provinsi": "Kalimantan Timur",
    "kode_provinsi": "64",
    "kabupaten": null,
    "tahun_berlaku": 2025,
    "kuartal": 1,                              // ← NEW: quarterly tracking
    "dasar_hukum": "SK Gubernur Kaltim No. XXX/2025",
    "tanggal_terbit": "2025-01-15"
  },

  "tenaga_kerja": [
    { "ref": "L.01",  "harga_rp": 135000, "satuan": "OH", "sumber_data": "UMK Kaltim 2025" },
    { "ref": "L.02a", "harga_rp": 165000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.02b", "harga_rp": 165000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.02c", "harga_rp": 170000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.03",  "harga_rp": 185000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.04",  "harga_rp": 210000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.05",  "harga_rp": 195000, "satuan": "OH", "sumber_data": "Survei Dinas PU" },
    { "ref": "L.06",  "harga_rp": 155000, "satuan": "OH", "sumber_data": "Survei Dinas PU" }
  ],

  "bahan": [
    { "ref": "M.01",   "nama": "Semen Portland 50 kg", "harga_rp": 75000,  "satuan": "zak",  "sumber_data": "Survei distributor" },
    { "ref": "M.02",   "nama": "Pasir Pasang",         "harga_rp": 285000, "satuan": "m3",   "sumber_data": "Survei quarry lokal" },
    { "ref": "M.03",   "nama": "Pasir Beton",          "harga_rp": 350000, "satuan": "m3",   "sumber_data": "Survei quarry lokal" },
    { "ref": "M.04",   "nama": "Kerikil/Agregat Kasar","harga_rp": 375000, "satuan": "m3",   "sumber_data": "Survei quarry lokal" },
    { "ref": "M.09.a", "nama": "Agregat Kelas A",      "harga_rp": 425000, "satuan": "m3",   "sumber_data": "Survei quarry lokal" },
    { "ref": "M.50",   "nama": "Besi Beton Polos",     "harga_rp": 14500,  "satuan": "kg",   "sumber_data": "Harga pasar" },
    { "ref": "M.51",   "nama": "Besi Beton Ulir",      "harga_rp": 15200,  "satuan": "kg",   "sumber_data": "Harga pasar" },
    { "ref": "M.80",   "nama": "Aspal AC-60/70",       "harga_rp": 8750,   "satuan": "kg",   "sumber_data": "Pertamina" }
  ],

  "peralatan_sewa": [
    { "ref": "E.01", "nama": "Excavator PC-200",    "harga_rp": 450000, "satuan": "jam", "sumber_data": "Survei rental" },
    { "ref": "E.08", "nama": "Dump Truck 12T",      "harga_rp": 285000, "satuan": "jam", "sumber_data": "Survei rental" },
    { "ref": "E.19", "nama": "Motor Grader >100HP", "harga_rp": 525000, "satuan": "jam", "sumber_data": "Survei rental" },
    { "ref": "E.22", "nama": "Vibro Roller 8-10T",  "harga_rp": 385000, "satuan": "jam", "sumber_data": "Survei rental" },
    { "ref": "E.25", "nama": "Water Tanker 4000L",  "harga_rp": 275000, "satuan": "jam", "sumber_data": "Survei rental" }
  ],

  "bahan_bakar": {
    "solar_industri_rp_per_liter": 18500,
    "oli_mesin_rp_per_liter": 65000,
    "oli_hidrolik_rp_per_liter": 72000,
    "grease_rp_per_kg": 45000
  }
}
```

---

## 5. Arsitektur Package (Revised)

```
@ahs-id/
├── packages/
│   │
│   ├── core/                           ← ENGINE
│   │   ├── src/
│   │   │   ├── calculator/
│   │   │   │   ├── hsd-tenaga.ts
│   │   │   │   ├── hsd-bahan.ts
│   │   │   │   ├── hsd-peralatan.ts    # Ownership mode (biaya pasti + operasi)
│   │   │   │   ├── produktivitas/      # ← REVISED: per-type dispatch (Fixed #2)
│   │   │   │   │   ├── index.ts        # dispatcher: siklus | lintasan | throughput
│   │   │   │   │   ├── siklus.ts       # Excavator, DT, Wheel Loader, Crane
│   │   │   │   │   ├── lintasan.ts     # Vibro Roller, Motor Grader, Finisher
│   │   │   │   │   └── throughput.ts   # AMP, Batching Plant, Stone Crusher
│   │   │   │   ├── konversi-volume.ts  # ← NEW (Fixed #3)
│   │   │   │   ├── koefisien.ts        # Resolver: statis vs dinamis
│   │   │   │   ├── hsp.ts             
│   │   │   │   ├── margin.ts           # Overhead + profit (lump sum aware)
│   │   │   │   ├── mob-demob.ts        # ← NEW (Fixed #10)
│   │   │   │   └── rab.ts              # Aggregator: HSP + mob/demob + SMKK + PPN
│   │   │   ├── schema/
│   │   │   │   ├── tenaga-kerja.schema.json
│   │   │   │   ├── bahan.schema.json
│   │   │   │   ├── peralatan.schema.json
│   │   │   │   ├── ahsp-item.schema.json
│   │   │   │   ├── hsd-regional.schema.json
│   │   │   │   ├── faktor-konversi.schema.json   # ← NEW
│   │   │   │   └── bundle-meta.schema.json
│   │   │   ├── validator/
│   │   │   │   ├── validate-bundle.ts
│   │   │   │   ├── validate-input.ts
│   │   │   │   └── validate-refs.ts    # ← NEW: cross-ref integrity (Fixed #7)
│   │   │   ├── exporter/
│   │   │   │   ├── excel.ts
│   │   │   │   ├── json.ts
│   │   │   │   └── pdf.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── pupr-2023/                      ← BUNDLE: Permen PUPR 8/2023
│   │   ├── data/
│   │   │   ├── tenaga-kerja.json
│   │   │   ├── bahan-master.json
│   │   │   ├── peralatan-master.json
│   │   │   ├── faktor-konversi.json    # ← NEW
│   │   │   ├── ahsp/
│   │   │   │   ├── umum/
│   │   │   │   ├── sda/
│   │   │   │   ├── bina-marga/
│   │   │   │   └── cipta-karya/
│   │   │   └── faktor-efisiensi/
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── hsd-kaltim-2025/
│   │   └── ...
│   │
│   └── hsd-jateng-2025/
│       └── ...
│
├── bindings/
│   └── python/                         # ← Python wrapper (Fixed Risk #3)
│       ├── ahs_id/
│       │   ├── __init__.py
│       │   ├── calculator.py           # Python engine consuming same JSON bundles
│       │   ├── loader.py               # Bundle loader (JSON → Python dataclass)
│       │   ├── produktivitas.py        # Siklus/lintasan/throughput calculators
│       │   ├── konversi_volume.py      # Volume state converter
│       │   └── types.py               
│       ├── setup.py
│       └── README.md
│
├── tests/
│   └── golden/                         # ← NEW: Golden test suite (Refined R2)
│       ├── README.md                   # Explains: same input → same output across engines
│       ├── fixtures/
│       │   ├── input-3.2.1-lapis-pondasi.json    # Standard test input
│       │   ├── input-1.2.1-beton-k250.json       # Nesting test
│       │   └── input-6.1.1-ac-wc.json            # AMP throughput test
│       ├── expected/
│       │   ├── output-3.2.1.json                  # Expected HSP breakdown
│       │   ├── output-1.2.1.json
│       │   └── output-6.1.1.json
│       ├── run-ts.ts                   # Run fixtures against TS engine
│       └── run-py.py                   # Run fixtures against Python engine
│       # CI: both must produce identical output (within ε = 0.01 Rp tolerance)
│
├── apps/
│   └── cli/
│       ├── src/
│       │   ├── commands/
│       │   │   ├── calc-hsd.ts
│       │   │   ├── calc-hsp.ts
│       │   │   ├── calc-produktivitas.ts  # ← Accepts JSON scenario file (Fixed #14)
│       │   │   ├── export-rab.ts
│       │   │   ├── validate.ts
│       │   │   └── info.ts
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── getting-started.md
│   ├── creating-bundles.md
│   ├── calculation-reference.md
│   ├── api-reference.md
│   └── LEGAL.md                        # ← NEW (Fixed #17)
│
├── package.json
├── turbo.json
├── LICENSE (MIT)
├── README.md
└── CONTRIBUTING.md
```

---

## 6. Alur Penggunaan (Revised)

### 6.1 Engine Configuration (PPN moved here — Fixed #6)

```typescript
import { createCalculator } from '@ahs-id/core';
import pupr2023 from '@ahs-id/pupr-2023';
import hsdKaltim from '@ahs-id/hsd-kaltim-2025';

const calc = createCalculator({
  bundle: pupr2023,
  hsd: hsdKaltim,

  // Project-level config (not per-AHSP)
  config: {
    ppn_pct: 11,                    // ← PPN is engine config, not bundle data
    mode_kalkulasi: "penuh",        // "penuh" | "estimasi-kasar"
    overhead_profit_default_pct: 15,
  }
});
```

### 6.2 Mode Penuh (Semua Variabel Required)

```typescript
const hsp = calc.hitungHSP('3.2.1', {
  jarak_quarry_km: 25,
  jarak_sumber_air_km: 8,
  kondisi_jalan: 'sedang',
  jenis_material: 'agregat_kelas_a',
  faktor_efisiensi: 0.83,
  kondisi_operasi: 'berat',         // Fpr = 1.2
  tebal_hamparan_m: 0.20,
  jumlah_passing: 6,
  lebar_hamparan_m: 3.0,
  jumlah_lintasan: 6,
});

// Engine:
// 1. Resolve koefisien statis (TK, bahan) dari bundle
// 2. Hitung produktivitas per alat (dispatch by tipe_produksi)
// 3. Convert volume states (bank → loose → compacted)
// 4. Derive koefisien alat = 1/produktivitas (adjusted for volume)
// 5. Resolve HSD: ownership (kalkulasi) atau sewa (regional rate)
// 6. Kalikan semua koefisien × HSD
// 7. Tambah overhead+profit (skip jika lump sum)
// 8. Return HSP with full audit trail
```

### 6.3 Mode Estimasi Kasar (Pakai koef_referensi — Fixed #1)

```typescript
const calc = createCalculator({
  bundle: pupr2023,
  hsd: hsdKaltim,
  config: {
    ppn_pct: 11,
    mode_kalkulasi: "estimasi-kasar",  // ← opt-in to reference values
  }
});

const hsp = calc.hitungHSP('3.2.1', {
  jarak_quarry_km: 25,               // DT & WT tetap WAJIB (koef_referensi = null)
  jarak_sumber_air_km: 8,
  // sisanya pakai koef_referensi dari bundle
});

// Output includes mandatory warning:
// {
//   hsp: 557750,
//   warnings: [
//     "ESTIMASI-KASAR: E.11 (Wheel Loader) menggunakan koef_referensi 0.020 dengan asumsi Fa=0.83, material=agregat",
//     "ESTIMASI-KASAR: E.22 (Vibro Roller) menggunakan koef_referensi 0.020 dengan asumsi tebal=0.20m, 6 passing",
//   ],
//   audit_trail: { ... }
// }
```

### 6.4 Ref Integrity Check (NEW — Fixed #7)

```typescript
import { validateBundle } from '@ahs-id/core';

const report = validateBundle(pupr2023, hsdKaltim);

// report: {
//   valid: false,
//   missing_refs: [
//     { ahsp: "3.2.1", ref: "E.25", type: "peralatan", missing_in: "hsd_regional" }
//   ],
//   orphaned_refs: [
//     { bundle: "hsd-kaltim", ref: "M.99", type: "bahan", not_used_by: "any_ahsp" }
//   ],
//   namespace_collisions: [],
//   ref_namespaces: { "L.*": "tenaga_kerja", "E.*": "peralatan", "M.*": "bahan" }
// }
```

---

## 7. Edge Cases (Revised)

| Kasus | Handling |
|-------|----------|
| Koefisien DT/WT tanpa jarak | **Error** — `koef_referensi: null` → forced calculation |
| Other alat tanpa variabel di mode "penuh" | **Error** — semua variabel_input wajib |
| Other alat tanpa variabel di mode "estimasi-kasar" | **Warning** — pakai koef_referensi + annotate output |
| HSD bahan missing di bundle regional | **Error** at `validateBundle()` time, not calculation time |
| Faktor efisiensi di luar range | **Warning**, tetap hitung |
| Pekerjaan campuran manual + mekanis | Supported via mixed `koef_sumber` per komponen |
| Koefisien negatif atau nol | **Validation error** |
| HSD peralatan: sewa vs ownership | Per-item `mode_biaya` field |
| SMKK cost | Terpisah dari AHSP, ditambahkan di RAB level |
| Pekerjaan lump sum (`is_lump_sum: true`) | Skip biaya tidak langsung |
| Mob/Demob | Separate module, direct cost line item |
| Volume state mismatch antar alat | Auto-convert via `faktor-konversi.json` |
| AHSP referensi AHSP lain (nesting) | Recursive resolve via `sub_ahsp` with circular dependency check |
| PPN rate change | Update `config.ppn_pct` — no bundle change needed |

---

## 8. Versioning Strategy (Revised — Fixed #16)

```
@ahs-id/pupr-2023@1.2.3        ← Standard semver
          │       │ │ │
          │       │ │ └── Patch: typo fix, koefisien correction
          │       │ └──── Minor: tambahan AHSP baru, SE revision
          │       └────── Major: breaking schema change
          │
          └── Permen identifier (in ahs_meta.permen_nomor = 8)

@ahs-id/hsd-kaltim-2025@2025.2.0
                          │    │ │
                          │    │ └── Patch: koreksi harga
                          │    └──── Minor: update kuartal (Q1→Q2)
                          └──────── Major: tahun berlaku
```

**Deprecation:** Old bundles are never deleted — engineers need them for legacy project audits. Mark as `deprecated` in npm with a notice pointing to the successor.

---

## 9. Open Source vs EstiMara Boundary (Revised)

| Open Source (@ahs-id) | EstiMara SaaS |
|-----------------------|---------------|
| JSON schema & validator | Visual AHS builder UI |
| Calculation engine (TS + Python) | WBS integration |
| CLI tool | Audit trail per perubahan koefisien |
| Static bundles (community-maintained) | **Auto-sync HSD regional dari PUPR** |
| Excel/JSON export | Approval workflow |
| Custom bundle loader | Portfolio analytics |
| Ref integrity checker | AI-assisted koefisien suggestion |
| Volume conversion engine | Team collaboration |
| Produktivitas calculator | Gantt + schedule linkage |
| | **Managed coefficient bundles** (verified, curated) |
| | **Real-time collaboration** |
| | **Historical audit trail** |

---

## 10. QA & Testing Strategy

Testing di AHS-ID berbeda dari software testing biasa — ini **financial accuracy testing** dimana discrepancy kecil di koefisien, dikalikan volume ribuan m³ dan harga jutaan Rp, bisa menghasilkan selisih miliaran. Testing harus menjamin dua hal yang berbeda secara fundamental: (1) apakah data yang di-extract dari regulasi benar, dan (2) apakah engine menghitung dengan benar dari data tersebut.

### 10.1 Layer 1: Extraction Fidelity (Data vs Sumber Regulasi)

**Tujuan:** Memastikan koefisien di JSON bundle identik dengan lampiran Permen PUPR asli.

Ini layer paling fundamental. Kalau koefisien di PDF halaman III-45 adalah 0.065 tapi di JSON ter-extract sebagai 0.650, maka semua output downstream salah 10×. Error di layer ini **tidak bisa di-detect oleh engine** — engine hanya tahu koefisien yang diberikan kepadanya.

```
Validation flow:

  PDF Lampiran Permen PUPR 8/2023 (sumber kebenaran)
           │
           ▼
  ┌─────────────────────────────────┐
  │  Extraction (manual / OCR /     │
  │  semi-automated PDF parser)     │
  │                                 │
  │  Setiap entry WAJIB include:    │
  │  • provenance.halaman           │
  │  • provenance.tabel             │
  │  • provenance.baris             │
  └──────────┬──────────────────────┘
             │
             ▼
  ┌─────────────────────────────────┐
  │  JSON Bundle (koefisien.json)   │
  └──────────┬──────────────────────┘
             │
             ▼
  ┌─────────────────────────────────┐
  │  Verification (Layer 1 test)    │
  │                                 │
  │  Method A: Human spot-check     │
  │  → Reviewer buka PDF halaman X  │
  │  → Compare digit per digit      │
  │  → Sign off per batch           │
  │                                 │
  │  Method B: Semi-automated       │
  │  → OCR extract PDF → raw text   │
  │  → Diff raw text vs JSON values │
  │  → Flag discrepancies           │
  │  → Human resolve flagged items  │
  └─────────────────────────────────┘

Acceptance criteria:
  ✅ Setiap koefisien di JSON exact match dengan PDF sumber
  ✅ Setiap entry punya provenance traceable ke halaman + tabel + baris
  ✅ Tidak ada rounding, pembulatan, atau "penyesuaian" tanpa catatan
  ✅ PR yang menambah/ubah data WAJIB include screenshot PDF sumber
```

**Coverage target:**
- 100% koefisien yang di-bundle harus verified terhadap sumber
- Minimum 2 independent verifier per bidang (4-eyes principle)
- Re-verification wajib saat regulasi baru terbit

### 10.2 Layer 2: Calculation Correctness (Engine Accuracy)

**Tujuan:** Memastikan engine menghitung HSP dengan benar dari data yang sudah terverifikasi (Layer 1).

Ini pure mathematical validation — given koefisien X dan HSD Y, apakah engine menghasilkan HSP yang benar secara aritmatika?

```
Test flow:

  ┌────────────────────────────────────────────────────┐
  │  Input (dari bundle yang sudah lolos Layer 1):     │
  │  • Koefisien AHSP item 3.2.1                      │
  │  • HSD regional (harga satuan TK/Bahan/Alat)      │
  │  • Variabel proyek (jarak, Fa, kondisi, dll)       │
  └────────────────────┬───────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
  ┌───────────────┐        ┌───────────────┐
  │  AHS-ID       │        │  Hitungan     │
  │  Engine       │        │  Manual       │
  │  (TS/Python)  │        │  (Spreadsheet │
  │               │        │   independen) │
  └───────┬───────┘        └───────┬───────┘
          │                        │
          ▼                        ▼
  ┌───────────────┐        ┌───────────────┐
  │  Output A     │        │  Output B     │
  │  (HSP engine) │        │  (HSP manual) │
  └───────┬───────┘        └───────┬───────┘
          │                        │
          └──────────┬─────────────┘
                     ▼
            ┌─────────────────┐
            │   Compare A = B │
            │                 │
            │   ΔRp ≤ 1       │ → PASS (floating point rounding)
            │   ΔRp ≤ 100     │ → WARN (investigate rounding chain)
            │   ΔRp > 100     │ → FAIL (bug in formula/logic)
            └─────────────────┘

PENTING: Hitungan manual dibuat independen dari data yang SAMA (bundle koefisien +
HSD yang sama), BUKAN dari Excel perusahaan. Excel perusahaan mungkin pakai
koefisien custom yang sah tapi berbeda dari Permen PUPR. Membandingkan output engine
(pakai koefisien PUPR) vs Excel perusahaan (pakai koefisien custom) akan selalu
menghasilkan perbedaan yang bukan bug.
```

**Benchmark test cases minimum:**

| # | Test Case | Tipe Produksi | Yang Di-test |
|---|-----------|---------------|-------------|
| 1 | Lapis Pondasi Agregat (3.2.1) | Siklus + Lintasan | Full chain, volume conversion, multi-equipment |
| 2 | Galian Biasa (3.1.1) | Siklus | Excavator + DT, distance-dependent DT coefficient |
| 3 | Galian Biasa jarak 10 km | Siklus | Same item, different distance → coefficient sensitivity |
| 4 | Galian Biasa jarak 50 km | Siklus | Same item, extreme distance → verify proportionality |
| 5 | Lapis AC-WC (6.1.1) | Throughput | AMP productivity, pemanas fuel, asphalt mix |
| 6 | Pasangan Batu 1:4 (1.3.2) | Manual | Pure static coefficient, no equipment |
| 7 | Beton K-250 (1.2.1) | Manual + Nesting | sub_ahsp recursive resolution |
| 8 | Pek. Minor (lump sum) | N/A | is_lump_sum = true → overhead excluded |
| 9 | Item dengan mode sewa | Siklus | HSD from peralatan_sewa, not ownership calc |
| 10 | Volume state chain | Mixed | bank(excavator) → loose(DT) → compacted(roller) |

### 10.3 Layer 3: Schema & Bundle Validation

```
validateBundle() — automated checks at CI and runtime:

├── Structural Validation
│   ├── Semua required fields ada
│   ├── Tipe data benar (number bukan string, etc.)
│   └── Enum values valid (tipe_produksi, volume_state, mode_biaya)
│
├── Ref Integrity
│   ├── Namespace check: L.* hanya di tenaga_kerja, E.* di peralatan, M.* di bahan
│   ├── No orphaned refs: setiap ref di AHSP ada di master data
│   ├── No orphaned HSD: setiap ref di HSD regional ada di master data
│   └── Cross-bundle: HSD regional covers semua ref yang dipakai AHSP bundle
│
├── Range & Sanity Checks
│   ├── Koefisien > 0 (kecuali jika documented exception)
│   ├── Harga > 0
│   ├── Fa dalam range 0.60 - 0.90
│   ├── overhead_pct + profit_pct sum dalam range 10 - 15
│   └── HSD peralatan ownership vs sewa: selisih < 5× (sanity)
│
├── Faktor Konversi Consistency
│   └── Jika loose_to_compacted provided: |stored - (bank_to_compacted/bank_to_loose)| < 0.001
│
└── Provenance Completeness
    ├── Setiap AHSP item punya provenance.sumber_regulasi
    └── Warning jika provenance.halaman = null (belum di-verify)

Execution points:
  • CI: setiap PR yang modify data JSON
  • npm publish: pre-publish gate (block publish jika validation fail)
  • Runtime: opsional di createCalculator() — bisa di-skip via config.skip_validation = true
```

### 10.4 Layer 4: Engine Unit Tests

```
Per-module testing — standard software unit tests:

hsd-peralatan.test.ts:
├── Ownership: biaya pasti + operasi = expected Rp/jam
├── Sewa: pass-through harga regional
├── Fpr impact: normal(1.0) vs berat(1.2) → perawatan/perbaikan naik 20%
├── Pelumas: mesin + hidrolik + grease dihitung terpisah, sum = total
├── AMP pemanas: H1 + H2 + H3 ≠ H1 saja (verify pemanas included)
└── Edge: harga_pokok = 0 → error, bukan NaN/Infinity

produktivitas/siklus.test.ts:
├── Excavator: V(0.93) × Fb(1.0) × Fa(0.83) × 60 / Ts(0.50) = known m³/jam
├── DT jarak 10 km: Ts = muat + 10/30*60 + 10/40*60 + bongkar + tunggu
├── DT jarak 50 km: koefisien naik proporsional dengan jarak
└── Volume state: excavator output = "bank" (verified)

produktivitas/lintasan.test.ts:
├── Vibro Roller: v(2.5km/h) × b(2.0m) × t(0.20m) × Fa(0.83) / n(6) = known m³/jam
├── Motor Grader: v × b × Fa / n = known m²/jam (area-based, no thickness)
└── Overlap: lebar_efektif = lebar_drum - overlap

produktivitas/throughput.test.ts:
├── AMP: 60 ton/jam × 0.83 = 49.8 ton/jam
└── Batching Plant: similar structure

konversi-volume.test.ts:
├── bank → loose: 1 m³ × 1.25 = 1.25 m³
├── loose → compacted: derived = bank_to_compacted / bank_to_loose
├── Full chain: excavator(bank) → DT(loose) → roller(compacted)
├── Null compacted (batu_pecah): convert to compacted → error
└── Same state: bank → bank = factor 1.0

margin.test.ts:
├── Normal: biaya_langsung × 1.15 = total
├── Lump sum: is_lump_sum = true → return biaya_langsung tanpa markup
└── Custom %: overhead_pct=8, profit_pct=4 (sum=12) → × 1.12

sub-ahsp.test.ts:
├── Single nesting: parent + child HSP combined
├── Volume state propagation through nesting
├── Circular dependency: A refs B refs A → error
└── Missing ref_ahsp: referenced AHSP not in bundle → error
```

### 10.5 Layer 5: Golden Test Suite (Dual-Engine Parity)

```
tests/golden/
├── README.md
│   "Setiap fixture file berisi input lengkap dan expected output.
│    Kedua engine (TypeScript dan Python) HARUS produce output identik.
│    Toleransi: ε = 0.01 Rp (floating point arithmetic).
│    Fixture ditambah setiap kali AHSP item baru di-support."
│
├── fixtures/
│   ├── 01-galian-biasa-10km.json
│   ├── 02-galian-biasa-50km.json
│   ├── 03-lapis-pondasi-agregat.json
│   ├── 04-lapis-ac-wc.json
│   ├── 05-pasangan-batu-manual.json
│   ├── 06-beton-k250-nested.json
│   ├── 07-lump-sum-item.json
│   ├── 08-sewa-mode.json
│   ├── 09-volume-chain.json
│   └── 10-fpr-berat.json
│
├── expected/
│   ├── 01-galian-biasa-10km.expected.json
│   ├── 02-galian-biasa-50km.expected.json
│   └── ... (matching each fixture)
│
├── run-ts.ts           # Load fixture → TS engine → compare vs expected
├── run-py.py           # Load fixture → Python engine → compare vs expected
│
└── CI pipeline:
    • Run both on every PR
    • Fail if any fixture Δ > ε
    • Report per-fixture pass/fail with actual vs expected values
```

### 10.6 Layer 6: Community Contribution Validation

```
Ketika kontributor submit PR yang menambah/mengubah data koefisien:

┌─────────────────────────────────────────────────────────────────┐
│ AUTOMATED (CI bot)                                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. validateBundle() pass?                                       │
│ 2. Schema valid? All required fields present?                   │
│ 3. Ref integrity intact?                                        │
│ 4. Diff analysis:                                               │
│    → Koefisien mana yang berubah?                               │
│    → Naik/turun berapa %?                                       │
│    → Apakah perubahan > 20% dari sebelumnya? → Flag for review  │
│ 5. Semua golden tests masih pass?                               │
│ 6. HSP output sanity: apakah masuk akal untuk jenis pekerjaan?  │
│    → HSP Galian < Rp 500,000/m³? (warn jika exceed)             │
│    → HSP Aspal < Rp 5,000,000/ton? (warn jika exceed)           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ MANUAL (Reviewer / Engineer)                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. PR WAJIB include:                                            │
│    → Screenshot halaman PDF sumber regulasi                     │
│    → Atau link ke JDIH halaman spesifik                         │
│ 2. Reviewer verify koefisien terhadap screenshot/link           │
│ 3. Reviewer check catatan dan provenance fields                 │
│ 4. Sign-off: "Verified against Permen PUPR 8/2023 hal. III-45" │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Storage & Hosting Architecture

### 11.1 Data Size Estimation

```
Per regulation bundle (@ahs-id/pupr-2023):
├── tenaga-kerja.json          ~2 KB
├── bahan-master.json          ~15 KB (200+ items)
├── peralatan-master.json      ~30 KB (50+ items with detailed params)
├── faktor-konversi.json       ~3 KB
├── ahsp/ (all bidang)         ~2.2 MB (550 items × ~4 KB avg)
└── faktor-efisiensi/          ~10 KB
    Subtotal: ~2.3 MB

Per HSD regional bundle:
├── hsd.json                   ~15-25 KB
    Subtotal per kabupaten: ~20 KB

Growth projection:
├── Phase 1 (MVP):         1 regulation × 1 region       = ~2.3 MB
├── Phase 2 (Multi-reg):   2 regulations × 20 regions    = ~5 MB
├── Phase 3 (National):    3 regulations × 100 regions   = ~8 MB
├── Phase 4 (Full coverage): 5 regulations × 514 regions = ~22 MB
└── Phase 5 (+ Historical): + quarterly HSD archive      = ~50-100 MB

Kesimpulan: ukurannya KECIL. Ini bukan big data problem — ini data
curation & maintenance problem. Yang berat bukan storage-nya, tapi
siapa yang extract, verify, dan maintain.
```

### 11.2 Hosting Strategy: Hybrid (Offline-First + Optional CDN)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     HYBRID STORAGE ARCHITECTURE                      │
│                                                                      │
│   ┌───────────────────────┐        ┌──────────────────────────────┐  │
│   │   STATIC LAYER        │        │   DYNAMIC LAYER (opsional)   │  │
│   │   (npm packages)      │        │   (CDN → API)                │  │
│   │                       │        │                              │  │
│   │   Offline-first       │        │   Online-optional            │  │
│   │   Versioned (semver)  │        │   Always-latest              │  │
│   │   Reproducible        │        │   Fallback to static         │  │
│   │   Zero infra cost     │        │   Progressive enhancement    │  │
│   │                       │        │                              │  │
│   │   Contains:           │        │   Contains:                  │  │
│   │   • Koefisien AHSP    │        │   • HSD regional terbaru     │  │
│   │   • Master TK/Bhn/Alt │        │   • Community bundles        │  │
│   │   • Faktor konversi   │        │   • Historical HSD archive   │  │
│   │   • HSD snapshot      │        │   • EstiMara managed data    │  │
│   └───────────┬───────────┘        └──────────────┬───────────────┘  │
│               │                                   │                  │
│               └─────────────┬─────────────────────┘                  │
│                             ▼                                        │
│                    ┌────────────────┐                                 │
│                    │ createCalc()   │                                 │
│                    │ Engine merges  │                                 │
│                    │ static + dyn.  │                                 │
│                    │ with fallback  │                                 │
│                    └────────────────┘                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Prinsip desain:**
- **Offline-first:** npm packages selalu bekerja tanpa internet. Engineer di site remote mining area harus bisa pakai library tanpa koneksi.
- **Progressive enhancement:** Kalau online, bisa fetch HSD terbaru. Kalau tidak, pakai snapshot dari npm.
- **Reproducible builds:** `package-lock.json` menjamin exact same data. RAB yang dihitung hari ini harus identik jika dihitung ulang tahun depan dengan lock file yang sama.
- **Zero infrastructure at Phase 1:** Tidak perlu server, database, atau CDN di awal. Semuanya npm. CDN dan API ditambahkan saat requirement-nya terpenuhi.

### 11.3 Data Type → Storage Mapping per Phase

```
┌──────────────────────────┬───────────────┬───────────────┬───────────────┐
│ Data Type                │ Phase 1       │ Phase 2       │ Phase 3       │
│                          │ (MVP)         │ (CDN Ready)   │ (API Ready)   │
│                          │               │               │               │
│                          │ Prereq:       │ Prereq:       │ Prereq:       │
│                          │ Engine works, │ ≥5 HSD regions│ EstiMara API  │
│                          │ 1 bundle      │ need quarterly│ deployed,     │
│                          │ validated     │ updates       │ auth system   │
│                          │               │               │ live          │
├──────────────────────────┼───────────────┼───────────────┼───────────────┤
│ Koefisien AHSP (PUPR)    │ npm package   │ npm package   │ npm package   │
│ Master TK/Bahan/Alat     │ npm package   │ npm package   │ npm package   │
│ Faktor Konversi          │ npm package   │ npm package   │ npm package   │
│ HSD Regional (snapshot)  │ npm package   │ npm package   │ npm package   │
│ HSD Regional (latest)    │ —             │ GitHub Pages  │ EstiMara API  │
│ Custom company bundles   │ local JSON    │ local JSON    │ EstiMara UI   │
│ Community bundles        │ —             │ npm package   │ npm + API     │
│ Historical HSD archive   │ —             │ —             │ EstiMara DB   │
└──────────────────────────┴───────────────┴───────────────┴───────────────┘

Phase triggers (requirement-based, not time-based):
  Phase 1 → Phase 2:  When ≥5 HSD regional bundles exist AND quarterly
                       update cycle creates npm publish overhead.
  Phase 2 → Phase 3:  When EstiMara backend is deployed AND there is
                       demand for authenticated/premium data access.
```

### 11.4 Engine Data Loading (Code Example)

```typescript
import { createCalculator, fetchHSD } from '@ahs-id/core';
import pupr2023 from '@ahs-id/pupr-2023';
import hsdKaltimSnapshot from '@ahs-id/hsd-kaltim-2025';

// ═══ MODE 1: Pure Offline (Phase 1 — MVP) ═══
const calc = createCalculator({
  bundle: pupr2023,
  hsd: hsdKaltimSnapshot,          // from npm (snapshot)
  config: { ppn_pct: 11 }
});


// ═══ MODE 2: Online-Enhanced with Fallback (Phase 2 — CDN Ready) ═══
let hsd;
try {
  hsd = await fetchHSD({
    source: "https://data.ahs-id.dev/hsd/kaltim/2025-q2.json",
    timeout_ms: 5000,
  });
  console.log("Using latest HSD: Q2 2025");
} catch (e) {
  hsd = hsdKaltimSnapshot;           // fallback to npm snapshot
  console.warn("Offline: using HSD snapshot from npm");
}

const calc = createCalculator({
  bundle: pupr2023,
  hsd: hsd,
  config: {
    ppn_pct: 11,
    hsd_staleness_warning_days: 90,   // warn jika HSD > 90 hari dari tanggal_terbit
  }
});

// Output akan include warning jika HSD stale:
// warnings: ["HSD Kaltim terbit 2025-01-15 (122 hari lalu). Versi terbaru tersedia online."]


// ═══ MODE 3: EstiMara API (Phase 3 — API Ready) ═══
const calc = createCalculator({
  bundle: pupr2023,
  hsd: await fetchHSD({
    source: "https://api.estimara.id/v1/hsd/kaltim/latest",
    auth: "bearer <estimara-api-key>",
    fallback: hsdKaltimSnapshot,
  }),
  config: { ppn_pct: 11 }
});
```

### 11.5 CDN/API Hosting Options

```
Phase 2: Static CDN (Trigger: ≥5 HSD regions with quarterly update needs)
┌─────────────────────────────────────────────────────────────────┐
│ GitHub Pages (recommended)                                       │
│ ├── Repo: github.com/ahs-id/data                                │
│ ├── Branch: gh-pages                                             │
│ ├── URL: https://data.ahs-id.dev/hsd/kaltim/2025-q2.json        │
│ ├── Update: CI/CD auto-deploy saat data JSON di-merge ke main    │
│ ├── Cost: $0                                                     │
│ ├── Limit: 100 GB/month bandwidth (lebih dari cukup)             │
│ └── Pros: Git-backed, auditable, free, reliable                  │
│                                                                  │
│ Alternatives:                                                    │
│ ├── Cloudflare Pages — 500 builds/month free, edge CDN           │
│ └── Vercel — familiar stack, free tier adequate                   │
└─────────────────────────────────────────────────────────────────┘

Phase 3: API (Trigger: EstiMara backend deployed + auth system live)
┌─────────────────────────────────────────────────────────────────┐
│ Supabase (recommended — already in stack for EstiMara)           │
│ ├── Storage: HSD JSON files in Supabase Storage                  │
│ ├── Edge Functions: API endpoint for fetchHSD()                  │
│ ├── Auth: API key per user/org                                   │
│ ├── DB: Historical HSD archive in Postgres                       │
│ ├── Analytics: Track which bundles/regions most downloaded        │
│ ├── Cost: Free tier sufficient for initial volume                │
│ └── Pros: Shared infra with EstiMara, RLS for premium bundles    │
│                                                                  │
│ Alternatives:                                                    │
│ ├── Cloudflare R2 + Workers — cheap storage + compute            │
│ └── Self-hosted VPS — full control, existing infra               │
└─────────────────────────────────────────────────────────────────┘
```

### 11.6 Data Maintenance: Who Updates What?

```
┌──────────────────────┬──────────────────────┬──────────────────────┐
│ Data Type            │ Update Trigger       │ Who Updates          │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Koefisien AHSP       │ Permen PUPR baru     │ Core maintainer      │
│ (regulasi)           │ (~setiap 1-3 tahun)  │ + community PR       │
│                      │                      │ + engineer reviewer  │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Master Peralatan     │ Tipe alat baru       │ Core maintainer      │
│ (spesifikasi)        │ atau parameter update│ + PR from industry   │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ HSD Regional         │ SK Gubernur/Bupati   │ Community per region │
│ (harga satuan)       │ (~setiap kuartal     │ → verify → publish   │
│                      │  atau semester)       │                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ Faktor Konversi      │ Jarang berubah       │ Core maintainer      │
│ (swell/shrink)       │ (data empiris stabil)│                      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ HSD Bahan Bakar      │ Harga BBM berubah    │ Automated scraper    │
│ (solar, oli)         │ (~beberapa kali/thn) │ atau manual update   │
└──────────────────────┴──────────────────────┴──────────────────────┘

Key insight: Koefisien AHSP adalah data yang PALING STABIL (berubah
hanya saat regulasi baru terbit, ~setiap beberapa tahun). HSD Regional
adalah data yang PALING SERING berubah (quarterly). Hybrid strategy
menempatkan masing-masing di layer yang tepat:
  • Stabil → npm (versioned, reproducible)
  • Sering berubah → CDN/API (always-latest, with offline fallback)
```

---

## Appendix A: Audit Resolution Log (v1 → v2)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | **Critical** | `koef_default` silent fallback | Replaced with `koef_referensi` (explicit assumptions) + `mode_kalkulasi` opt-in + mandatory warnings |
| 2 | **Critical** | Productivity formula only covers excavator/DT | Added `tipe_produksi: "siklus" \| "lintasan" \| "throughput"` with per-type formula and params |
| 3 | **Critical** | No volume conversion (swell/shrink/compaction) | Added `faktor-konversi.json`, `volume_state` per equipment and material, `volume_state_bayar` on AHSP |
| 4 | **Critical** | HSD formula missing Cp, Fpr, hydraulic oil | Expanded `hsd_params.pelumas` (mesin/hidrolik/grease), added `fpr` object with condition-based factors |
| 5 | **Important** | No AHSP-to-AHSP nesting | Added `sub_ahsp` array with recursive resolve + circular dependency detection |
| 6 | **Important** | PPN hardcoded in bundle | Moved PPN to `createCalculator()` engine config |
| 7 | **Important** | No ref integrity checking | Added `validate-refs.ts`, defined `L.*/E.*/M.*` namespaces, `BundleIntegrityReport` |
| 8 | **Important** | `jam_kerja_per_hari: 7` conflicts with OH=8 | Changed to `jam_kerja_nominal: 8` + `jam_efektif: 7` with documentation |
| 9 | **Important** | No sewa vs ownership toggle | Added `mode_biaya: "ownership" \| "sewa"` per equipment line in AHSP |
| 10 | **Important** | Missing mob/demob cost model | Added `mob-demob.ts` module in engine, direct cost line item in RAB |
| 11 | **Minor** | `koef_formula` string is un-evaluable | Removed `koef_formula` string — engine dispatches by `ref` code + `tipe_produksi` |
| 12 | **Minor** | Divisi-based file org assumes static structure | Retained for Bina Marga (stable), flexible naming for SDA/CK |
| 13 | **Minor** | `sub_jenis` on L.02 is free string | Sub-typed to `L.02a`, `L.02b`, etc. with own ref codes and HSD rates |
| 14 | **Minor** | CLI calc-produktivitas needs JSON scenario | Added JSON scenario file input for CLI |
| 15 | **Minor** | No data provenance fields | Added `sumber_data` on HSD entries, `provenance` on AHSP items |
| 16 | **Minor** | Semver = Permen number breaks conventions | Changed to standard semver; Permen number stored in `ahs_meta` only |
| 17 | **Minor** | MIT license + govt data IP question | Added `LEGAL.md` to repo structure |

---

## Appendix B: Round 2 Refinements (v2 → v2.1)

| # | Finding | Resolution |
|---|---------|------------|
| R1 | `loose_to_compacted` stored separately creates rounding inconsistency (0.786 vs 0.79) | Removed `loose_to_compacted` from data. Engine derives it as `bank_to_compacted / bank_to_loose`. `validateBundle()` checks consistency if optionally provided. Eliminates audit mismatch risk. |
| R2 | AMP `bahan_bakar_pemanas_agregat/aspal: true` flags are inert — no calculation path | Replaced boolean flags with `bahan_bakar_pemanas` object containing `konsumsi_liter_per_ton` per pemanas type. HSD formula expanded with H2 (pemanas agregat) and H3 (pemanas aspal) components. Total AMP fuel = H1 + H2 + H3. |
| R3 | `sub_ahsp` array is empty — no real nesting example to validate recursive resolution | Added documented real-world example (Beton K-250 → Campuran Beton + Mortar). Clarified: `koefisien` in parent's `satuan_bayar`, `volume_state` propagation rules, circular dependency detection via resolve stack. Added `satuan_konteks: "parent"` field. |
| R4 | Dual Python/TS engines risk calculation divergence | Added `tests/golden/` directory with shared fixture files (input JSON + expected output JSON). Both engines run against same fixtures in CI. Tolerance: ε = 0.01 Rp. Python bindings expanded with `produktivitas.py` and `konversi_volume.py`. |
| R5 | Water Tanker `jarak_sumber_air_km` changed from `required: false, default: 5` to `required: true, default: null` — confirmation needed | Confirmed intentional. Added explicit `catatan` explaining rationale: default 5 km can cause 3-10× underestimate in remote mining sites. Kontraktor/HPS wajib survei sumber air. Consistent with DT treatment. |

---

## Appendix C: Round 3 Additions (v2.1 → v2.2)

| # | Addition | Description |
|---|----------|-------------|
| S1 | **QA Layer 1: Extraction Fidelity** | Data accuracy testing yang benar: compare JSON bundle vs PDF lampiran Permen PUPR asli (sumber regulasi), bukan vs Excel perusahaan. Setiap entry harus traceable ke halaman+tabel+baris di dokumen sumber. 4-eyes verification principle. |
| S2 | **QA Layer 2: Calculation Correctness** | Engine math validation: same koefisien (from verified bundle) + same HSD → engine output vs independent manual calculation. Tolerance ΔRp ≤ 1 (pass), ≤ 100 (warn), > 100 (fail). 10 benchmark test cases defined. |
| S3 | **QA Layer 3: Schema & Bundle Validation** | Automated `validateBundle()` checks: structural, ref integrity, range sanity, faktor konversi consistency, provenance completeness. Runs at CI, pre-publish, and optionally at runtime. |
| S4 | **QA Layer 4: Engine Unit Tests** | Per-module unit tests for hsd-peralatan, produktivitas (siklus/lintasan/throughput), konversi-volume, margin, sub-ahsp. Edge cases documented. |
| S5 | **QA Layer 5: Golden Test Suite** | Expanded from R4 with 10 specific fixture files covering all calculation paths. CI runs both TS and Python engines against same fixtures. |
| S6 | **QA Layer 6: Community Contribution Validation** | Automated CI checks (schema, diff analysis, sanity) + manual reviewer verification against PDF source. PR must include screenshot/link to regulation page. |
| S7 | **Storage: Hybrid Architecture** | Offline-first (npm) + optional CDN (GitHub Pages → EstiMara API). Requirement-based phases: Phase 1 (MVP) pure npm, Phase 2 (≥5 HSD regions needing quarterly updates) add static CDN, Phase 3 (EstiMara API deployed + auth live) add premium data source. |
| S8 | **Storage: Data Loading Modes** | Three modes in `createCalculator()`: pure offline (npm snapshot), online-enhanced with fallback, EstiMara API with auth. HSD staleness warning when snapshot > 90 days old. |
| S9 | **Storage: Data Maintenance Matrix** | Defined who updates what and when: koefisien (core maintainer, per-Permen), HSD regional (community per-region, quarterly), faktor konversi (core, rarely), BBM (scraper/manual, per-change). |
# AHS-ID: Project Plan Addendum (Sections 12-19)

> Addendum to Architecture Specification v2.2. Covers: README structure, scope per phase, proof-of-engine definition, release strategy, legal framework, risk register, success metrics, and EstiMara integration guide.

---

## 12. README & Developer Onboarding

### 12.1 README Structure

```markdown
# @ahs-id — Analisa Harga Satuan for Indonesia 🇮🇩

> Open source calculation engine & structured data bundles for Indonesian
> construction cost estimation (AHSP) based on Permen PUPR.

[![npm](https://img.shields.io/npm/v/@ahs-id/core)](...)
[![license](https://img.shields.io/npm/l/@ahs-id/core)](...)
[![tests](https://img.shields.io/github/actions/workflow/status/...)](...)

## What is this?

AHS-ID turns Indonesia's construction cost coefficients (currently locked
in PDF/Excel) into machine-readable JSON data + a calculation engine.

**For engineers:** Calculate HSP from koefisien AHSP × HSD, with full
productivity analysis for mechanized work. Export to Excel RAB format.

**For developers:** npm install, import, calculate. Typed API, validated
bundles, offline-first.

## Quick Start

    npm install @ahs-id/core @ahs-id/pupr-2023 @ahs-id/hsd-kaltim-2025

    import { createCalculator } from '@ahs-id/core';
    import pupr2023 from '@ahs-id/pupr-2023';
    import hsdKaltim from '@ahs-id/hsd-kaltim-2025';

    const calc = createCalculator({
      bundle: pupr2023,
      hsd: hsdKaltim,
      config: { ppn_pct: 11 }
    });

    const hsp = calc.hitungHSP('3.2.1', {
      jarak_quarry_km: 25,
      jarak_sumber_air_km: 8,
      kondisi_jalan: 'sedang',
      faktor_efisiensi: 0.83,
      // ... other variables
    });

## Python

    pip install ahs-id-core ahs-id-pupr-2023

    from ahs_id import create_calculator
    # Same JSON bundles, same results

## Available Bundles

| Package | Description | Status |
|---------|-------------|--------|
| @ahs-id/core | Calculation engine | ✅ |
| @ahs-id/pupr-2023 | Permen PUPR 8/2023 coefficients | 🔨 Bina Marga |
| @ahs-id/hsd-kaltim-2025 | HSD Kalimantan Timur Q1 2025 | 🔨 |

## Key Concepts

- **Static coefficients** — fixed values from regulation tables (manual work)
- **Dynamic coefficients** — calculated from equipment productivity (mechanized work)
- **Bundles** — installable packages of coefficient data, versioned per regulation
- **HSD** — regional base prices for labor, materials, equipment

## Documentation

- [Getting Started](docs/getting-started.md)
- [Creating Custom Bundles](docs/creating-bundles.md)
- [Calculation Reference](docs/calculation-reference.md)
- [API Reference](docs/api-reference.md)
- [Architecture Specification](docs/architecture.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues are labeled
`good-first-issue`. Data contributions (new AHSP items, HSD regions)
are especially welcome — see [Creating Bundles](docs/creating-bundles.md).

## Relationship to EstiMara

AHS-ID is the open source engine. [EstiMara](https://estimara.id) is the
commercial platform that adds WBS management, approval workflows, audit
trails, and team collaboration on top.

## License

MIT — see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md) for government data usage.
```

### 12.2 CONTRIBUTING.md Key Sections

```
1. Types of Contributions
   ├── Code: engine modules, validators, exporters, CLI commands
   ├── Data: AHSP coefficients, HSD regional prices, equipment specs
   └── Docs: calculation reference, translation, tutorials

2. Data Contribution Requirements
   ├── PR MUST include provenance (PDF source page/table/row)
   ├── PR MUST include screenshot of regulation source
   ├── Koefisien changes > 20% from previous → require 2 reviewers
   └── All data PRs auto-run validateBundle() in CI

3. Code Contribution Requirements
   ├── All golden tests must pass
   ├── New calculation modules require benchmark test case
   └── TypeScript strict mode, no any

4. Good First Issues
   ├── "data-entry" label: add AHSP items from PDF lampiran
   ├── "hsd-region" label: add HSD for a new kabupaten/kota
   └── "docs" label: improve calculation reference documentation
```

---

## 13. Scope Boundary per Phase

### Phase 1: MVP — "One Chain Works"

**Entry requirement:** None (starting point).
**Exit requirement:** One complete AHSP calculation chain produces correct HSP, validated against independent manual calculation.

```
Deliverables:
├── @ahs-id/core
│   ├── createCalculator() API
│   ├── hsd-peralatan.ts (ownership mode only)
│   ├── produktivitas/siklus.ts (excavator + dump truck)
│   ├── produktivitas/lintasan.ts (vibro roller + motor grader)
│   ├── konversi-volume.ts
│   ├── koefisien.ts (resolver: statis + dinamis)
│   ├── hsp.ts
│   ├── margin.ts
│   ├── validate-bundle.ts (structural + ref integrity)
│   └── types/index.ts
│
├── @ahs-id/pupr-2023 (PARTIAL — Bina Marga only)
│   ├── tenaga-kerja.json (L.01-L.06)
│   ├── peralatan-master.json (E.01, E.08, E.11, E.19, E.22, E.25)
│   ├── bahan-master.json (items referenced by test AHSP only)
│   ├── faktor-konversi.json
│   └── ahsp/bina-marga/
│       ├── divisi-3/3.2.1-lapis-pondasi-agregat.json  ← proof item
│       └── divisi-3/3.1.1-galian-biasa.json           ← second item
│
├── @ahs-id/hsd-kaltim-2025 (1 region)
│   └── hsd.json
│
├── tests/golden/ (minimum 5 fixtures)
│
├── README.md, CONTRIBUTING.md, LICENSE, LEGAL.md
└── package.json (monorepo root)

NOT included in Phase 1:
  ✗ CLI tool
  ✗ Python bindings
  ✗ Excel/PDF exporter
  ✗ Mode sewa
  ✗ sub_ahsp nesting
  ✗ Mode estimasi-kasar
  ✗ Throughput productivity (AMP)
  ✗ Mob/demob module
  ✗ CDN/API fetching
```

### Phase 2: Functional Library — "Usable by Others"

**Entry requirement:** Phase 1 complete + proof-of-engine validated.
**Exit requirement:** External developer can `npm install`, calculate HSP for any Bina Marga item, and export to Excel.

```
Adds to Phase 1:
├── @ahs-id/core
│   ├── produktivitas/throughput.ts (AMP, batching plant)
│   ├── hsd-peralatan.ts → add mode sewa
│   ├── sub-ahsp resolver (nesting + circular dependency check)
│   ├── mode estimasi-kasar (koef_referensi with warnings)
│   ├── exporter/excel.ts (RAB format export)
│   └── validate-refs.ts (cross-bundle integrity)
│
├── @ahs-id/pupr-2023 (Bina Marga COMPLETE)
│   └── ahsp/bina-marga/ → all divisi (1-7+)
│
├── @ahs-id/hsd-[region]-[year] (≥3 regions)
│
├── apps/cli/ (basic commands: calc-hsp, export-rab, validate)
│
├── Published to npm (first public release)
└── Golden tests: ≥10 fixtures
```

### Phase 3: Multi-Bidang + Python — "Industry Adoption"

**Entry requirement:** Phase 2 complete + ≥3 HSD regional bundles + external users providing feedback.
**Exit requirement:** All 4 bidang have data, Python wrapper works, community contributions flowing.

```
Adds to Phase 2:
├── @ahs-id/pupr-2023 (ALL bidang)
│   ├── ahsp/umum/
│   ├── ahsp/sda/
│   └── ahsp/cipta-karya/
│
├── bindings/python/ (full engine parity)
├── tests/golden/ → run against both TS + Python
│
├── @ahs-id/hsd-[region]-[year] (≥10 regions)
│
├── mob-demob.ts module
├── exporter/pdf.ts
├── exporter/json.ts (structured output)
└── docs/ (complete documentation site)
```

### Phase 4: Platform Integration — "EstiMara Bridge"

**Entry requirement:** Phase 3 complete + EstiMara API deployed + auth system live.
**Exit requirement:** EstiMara consumes @ahs-id/core via adapter, fetchHSD() works with API, premium bundles gated.

```
Adds to Phase 3:
├── fetchHSD() with online/fallback modes
├── GitHub Pages CDN for HSD data
├── EstiMara adapter layer
├── @ahs-id/pupr-2022 (legacy regulation bundle)
├── @ahs-id/hsd-[region]-[year] (≥20 regions)
└── rab.ts full aggregator (HSP + mob/demob + SMKK + PPN)
```

---

## 14. Proof of Engine — Definition of Done

### 14.1 Target Item

**AHSP 3.2.1 — Lapis Pondasi Agregat Kelas A (CBR Min 90%)**

Dipilih karena:
- Sudah fully specified di architecture spec (Section 4.5)
- Melibatkan semua jenis komponen: TK (statis), bahan (statis), peralatan (dinamis)
- Melibatkan 3 tipe produksi: siklus (DT, WL), lintasan (VR, MG), dan non-cycle (WT)
- Membutuhkan volume state conversion (bank → loose → compacted)
- Distance-dependent coefficients (DT, WT)

### 14.2 Test Scenario

```jsonc
{
  "test_id": "proof-of-engine-3.2.1",
  "kode_ahsp": "3.2.1",
  "variabel": {
    "jarak_quarry_km": 25,
    "jarak_sumber_air_km": 8,
    "kondisi_jalan": "sedang",
    "jenis_material": "agregat_kelas_a",
    "faktor_efisiensi": 0.83,
    "kondisi_operasi": "normal",
    "tebal_hamparan_m": 0.20,
    "jumlah_passing": 6,
    "lebar_hamparan_m": 3.0,
    "jumlah_lintasan": 6
  },
  "config": {
    "ppn_pct": 11,
    "mode_kalkulasi": "penuh",
    "overhead_pct": 10,
    "profit_pct": 5
  }
}
```

### 14.3 Definition of Done Checklist

```
□ Engine loads bundle (@ahs-id/pupr-2023) tanpa error
□ Engine loads HSD (@ahs-id/hsd-kaltim-2025) tanpa error
□ validateBundle() returns valid: true (no missing refs, no orphans)
□ Engine resolves static coefficients (TK: L.01=0.065, L.04=0.007)
□ Engine resolves static coefficients (Bahan: M.09.a=1.025)
□ Engine calculates HSD peralatan (ownership) for each equipment
  □ Biaya pasti (pengembalian modal + asuransi)
  □ Biaya operasi (BBM + pelumas 3 jenis + perawatan×Fpr + perbaikan×Fpr + operator)
□ Engine calculates produktivitas for each equipment
  □ DT (siklus): with jarak 25 km, kondisi sedang
  □ WL (siklus): with material agregat
  □ VR (lintasan): with tebal 0.20m, 6 passing
  □ MG (lintasan): with lebar 3.0m, 6 lintasan
  □ WT (siklus): with jarak air 8 km
□ Engine derives koefisien alat = 1/produktivitas for each
□ Engine applies volume state conversion where needed
□ Engine calculates biaya langsung = Σ(koef × HSD) for TK + Bahan + Alat
□ Engine applies overhead+profit (15%)
□ Engine returns HSP with breakdown per komponen
□ HSP output matches independent manual calculation (ΔRp ≤ 1)
□ Output includes audit_trail object with full calculation chain
□ Output does NOT include warnings (mode penuh, all variables provided)
□ Golden test fixture created and passing
```

### 14.4 Validation Method

```
1. Buat spreadsheet independen (bukan dari Excel OPP/perusahaan)
2. Input: koefisien dari JSON bundle (yang sudah lolos Layer 1 vs PDF PUPR)
3. Input: HSD dari JSON bundle HSD Kaltim
4. Hitung manual di spreadsheet: setiap cell = formula eksplisit
5. Compare engine output vs spreadsheet per-komponen
6. Semua cell match → proof-of-engine DONE
```

---

## 15. Release & Publish Strategy

### 15.1 Version Lifecycle

```
Development:
  main branch → latest stable
  dev branch → next release candidate

Release tags:
  @ahs-id/core@0.1.0-alpha.1    ← Phase 1 internal testing
  @ahs-id/core@0.1.0-beta.1     ← Phase 1 external preview
  @ahs-id/core@1.0.0            ← Phase 2 first stable public release
  @ahs-id/core@1.1.0            ← Phase 2 feature additions
  @ahs-id/core@2.0.0            ← Phase 3 breaking change (if schema evolves)
```

### 15.2 npm Publish Workflow

```
Trigger: git tag push matching v*

CI pipeline:
├── 1. Lint + type check (strict TS)
├── 2. Run all unit tests
├── 3. Run all golden tests (TS)
├── 4. Run validateBundle() on all data packages
├── 5. Build (tsc → dist/)
├── 6. npm publish --access public
│   ├── @ahs-id/core
│   ├── @ahs-id/pupr-2023
│   └── @ahs-id/hsd-*
└── 7. Auto-generate changelog from conventional commits

Pre-publish gate (MUST pass):
  ✅ All golden tests pass
  ✅ validateBundle() = valid for ALL bundles
  ✅ No TypeScript errors
  ✅ Package size < 10 MB per bundle
```

### 15.3 Changelog Convention

```
Conventional commits:
  feat(core): add produktivitas lintasan calculator
  fix(pupr-2023): correct E.22 faktor_perawatan_pct from 0.065 to 0.060
  data(hsd-kaltim): add Q2 2025 prices
  docs: add volume conversion calculation reference
  test: add golden fixture for AC-WC item

Changelog auto-generated per release:
  ## [1.1.0] - 2026-XX-XX
  ### Features
  - add produktivitas lintasan calculator (#12)
  ### Data Updates
  - add HSD Kaltim Q2 2025 (#15)
  ### Fixes
  - correct E.22 maintenance factor (#14)
```

---

## 16. Legal Framework (LEGAL.md)

### 16.1 Government Data Usage

```markdown
# LEGAL.md

## Regulatory Data

AHS-ID contains coefficient data extracted from official Indonesian
government regulations, specifically:

- Permen PUPR No. 8 Tahun 2023 and its appendices (Lampiran I-IV)
- SE Dirjen Bina Konstruksi No. 73/2023

### Legal Basis for Republication

Under Indonesian law:

1. **PP No. 70 Tahun 2019** tentang Perencanaan, Penganggaran,
   Pelaksanaan, Pelaporan, dan Evaluasi atas Penerimaan dan
   Pengeluaran Negara:
   Government regulations are public documents intended for public use.

2. **UU No. 14 Tahun 2008** tentang Keterbukaan Informasi Publik:
   Government regulations and their appendices are classified as
   "Informasi Publik yang Wajib Disediakan dan Diumumkan" (Article 9).

3. **UU No. 28 Tahun 2014** tentang Hak Cipta, Pasal 43 huruf (b):
   "Tidak merupakan pelanggaran Hak Cipta: (b) pengambilan berita aktual,
   baik seluruhnya maupun sebagian, dari kantor berita, Lembaga Penyiaran,
   dan surat kabar atau sumber sejenis lainnya dengan ketentuan sumbernya
   harus disebutkan secara lengkap."

   Additionally, Pasal 42:
   "Tidak ada Hak Cipta atas: (a) hasil rapat terbuka lembaga negara;
   (b) peraturan perundang-undangan; (c) pidato kenegaraan atau pidato
   pejabat pemerintah; (d) putusan pengadilan atau penetapan hakim;
   (e) kitab suci atau simbol keagamaan."

   Point (b) directly exempts government regulations from copyright.

### Attribution

While government regulations are not copyrighted, AHS-ID provides
full attribution as good practice:

- Every coefficient entry includes `provenance.sumber_regulasi`
  tracing to the specific Permen, Lampiran, and page number.
- The data source is clearly stated in bundle metadata (`ahs_meta`).

### Disclaimer

AHS-ID data is provided "as is" for informational and computational
purposes. This data does not constitute official government documents.
For authoritative regulatory text, always refer to the original
publications on JDIH (jdih.pu.go.id) or Peraturan BPK (peraturan.bpk.go.id).

Users are responsible for verifying coefficients against the latest
applicable regulations before using them in official HPS/RAB documents.

### HSD Regional Data

HSD (Harga Satuan Dasar) prices are published by regional governments
via SK Gubernur/Bupati. These are public procurement reference prices
intended for government project cost estimation. The same legal basis
(UU 14/2008, UU 28/2014 Pasal 42) applies.

### Software License

The AHS-ID calculation engine, schemas, validators, and CLI tools are
licensed under the MIT License. See LICENSE file.

The coefficient data in bundle packages is public domain (government
regulation data). The structured JSON representation is MIT-licensed.
```

---

## 17. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | **Data accuracy error in published bundle** — koefisien salah masuk npm, user produce RAB yang salah | Medium | Critical | Layer 1 verification (PDF source check), 4-eyes review policy, validateBundle() CI gate, disclaimer di README dan output |
| R2 | **Maintainer burnout** — solo developer maintaining engine + data + community | High | High | **Ruthless phase discipline.** Concrete rules: (1) Do NOT touch CLI, Python bindings, or demo site until proof-of-engine golden test passes. (2) Do NOT start data entry for Divisi 4+ until Divisi 3 is 100% Layer-1 verified. (3) Do NOT merge Phase 2 scope into Phase 1 backlog. Phase scope boundaries are hard gates, not suggestions. Additionally: automate everything possible (CI, validation, publish), design data entry for crowdsource from Phase 2 onward. |
| R3 | **Regulation change** — Permen PUPR baru terbit, semua koefisien berubah | Low (setiap ~3 tahun) | Medium | Bundle architecture sudah handle ini: create new @ahs-id/pupr-20XX package. Old bundle tetap available. Schema evolution via major semver bump. |
| R4 | **Zero adoption** — library dibuat tapi tidak ada yang pakai | Medium | Medium | Solve your own problem first (EstiMara integration). Publish proof-of-engine demo page (ala pasal.id). Target niche community (forum teknik sipil Indonesia, LinkedIn). |
| R5 | **npm package takeover / supply chain attack** — malicious actor publishes poisoned version | Low | Critical | Enable npm 2FA, use `npm audit`, publish from CI only (not local machine), use package-lock.json pinning. Consider npm provenance attestation. |
| R6 | **Scope creep** — library tries to do everything (scheduling, invoicing, BIM integration) | Medium | Medium | Hard boundary: @ahs-id = calculation engine + data only. Everything else = EstiMara or external tools. CONTRIBUTING.md explicitly states scope. |
| R7 | **Dual-engine divergence** — TS and Python produce different results | Medium | High | Golden test suite in CI. Both engines run same fixtures every PR. ε = 0.01 Rp tolerance. Any divergence = blocking CI failure. |
| R8 | **Legal challenge on government data republication** — despite public domain argument | Very Low | Medium | LEGAL.md with full legal basis (UU 28/2014 Pasal 42). Full attribution via provenance. Disclaimer on all outputs. Data is factual/numerical, not creative work. |
| R9 | **HSD regional data staleness** — snapshot in npm becomes outdated, user unaware | Medium | Medium | `hsd_staleness_warning_days` config. Warning annotation in output when HSD age > threshold. fetchHSD() for online update when available. |
| R10 | **Competitor builds same thing but funded** — VC-backed startup builds commercial AHS platform | Low | Low | Open source moat: community data contributions compound over time. EstiMara as commercial layer. First-mover in structured AHSP data = defensive position. |

---

## 18. Success Metrics

Fokus utama: **coverage** (seberapa banyak domain yang ter-cover oleh library).

### 18.1 Primary Metrics (Coverage + Verification)

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target | Phase 4 Target |
|--------|---------------|---------------|---------------|---------------|
| AHSP items digitized (Bina Marga) | 2 items | All divisi (~200) | All (~200) | All (~200) |
| AHSP items digitized (Umum) | 0 | 0 | All (~80) | All (~80) |
| AHSP items digitized (SDA) | 0 | 0 | All (~120) | All (~120) |
| AHSP items digitized (Cipta Karya) | 0 | 0 | All (~150) | All (~150) |
| **Total AHSP coverage** | **2 / ~550** | **~200 / ~550** | **~550 / ~550** | **~550 / ~550** |
| **AHSP items L1-verified** | **2 / 2 (100%)** | **~200 / ~200 (100%)** | **~550 / ~550 (100%)** | **~550 / ~550 (100%)** |
| HSD regional bundles | 1 | ≥3 | ≥10 | ≥20 |
| Equipment types in master | 6 | ≥15 | ≥30 | ≥40 |
| Regulation versions supported | 1 (PUPR 2023) | 1 | 1 | 2 (+ PUPR 2022) |
| Golden test fixtures | 5 | ≥10 | ≥20 | ≥30 |

> **Critical rule:** An item that is digitized but not L1-verified is **worse** than no item — it gives false confidence. The "AHSP items L1-verified" row tracks how many digitized items have been independently checked against the PDF source. No item may be published to npm without L1 verification. Digitized ≠ verified.

### 18.2 Secondary Metrics (Adoption — tracked but not targeted)

| Metric | Notes |
|--------|-------|
| npm weekly downloads | Organic indicator, not a goal to optimize for |
| GitHub stars | Social proof, helps discoverability |
| GitHub contributors (unique) | Community health signal |
| GitHub issues opened by external users | Indicates real usage beyond author |
| PyPI downloads (Python wrapper) | Adoption in engineer audience |
| EstiMara signups attributed to @ahs-id | Commercial funnel conversion |

### 18.3 Quality Metrics (Gating — must maintain)

| Metric | Threshold | Action if Breached |
|--------|-----------|-------------------|
| Golden test pass rate | 100% | Block release |
| validateBundle() pass rate | 100% | Block release |
| Layer 1 verification coverage | 100% of published data | Block npm publish for unverified items |
| Dual-engine parity (TS vs Python) | ε ≤ 0.01 Rp | Block release |

---

## 19. EstiMara Integration Guide

> This section describes **how @ahs-id/core integrates into EstiMara** — the adapter layer, type mapping, and migration path. Full EstiMara codebase details (directory tree, tech stack, cross-cutting concerns) live in a separate `ESTIMARA-INTEGRATION.md` file to keep this open source spec focused on what contributors need to know.

### 19.1 Integration Model

EstiMara is a private, proprietary project-control platform (estimation, WBS, contracts, invoicing, scheduling, progress, reporting). Its estimation module currently implements AHSP calculation logic **built-in** — the same types and formulas that @ahs-id/core will formalize as an open source library.

```
┌──────────────────────────────────────────────────────────────────┐
│                         EstiMara Platform                         │
│                                                                   │
│  ┌───────────────┐  ┌───────────┐  ┌──────────────────────────┐  │
│  │  WBS Manager  │  │ Schedule  │  │ Audit & Approval Engine  │  │
│  └───────┬───────┘  └───────────┘  └──────────────────────────┘  │
│          │                                                        │
│  ┌───────▼────────────────────────────────────────────────────┐   │
│  │              EstiMara Estimation Module                     │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐    │   │
│  │  │  @ahs-id/core (npm dependency — future)           │    │   │
│  │  │  ├── createCalculator(config)                     │    │   │
│  │  │  ├── hitungHSP(item, params, hsd)                 │    │   │
│  │  │  └── validateBundle(bundle)                       │    │   │
│  │  └────────────────────────────────────────────────────┘    │   │
│  │                                                            │   │
│  │  ┌────────────────────────────────────────────────────┐    │   │
│  │  │  EstiMara Adapter Layer (proprietary)              │    │   │
│  │  │  ├── WBS ↔ AHSP item mapping                      │    │   │
│  │  │  ├── Audit trail per coefficient change            │    │   │
│  │  │  ├── Multi-user approval workflow                  │    │   │
│  │  │  ├── AI-assisted coefficient suggestion            │    │   │
│  │  │  ├── Region price fallback chain                   │    │   │
│  │  │  └── Custom bundle management (per-org)            │    │   │
│  │  └────────────────────────────────────────────────────┘    │   │
│  │                                                            │   │
│  │  Data sources:                                             │   │
│  │  ├── @ahs-id/pupr-2023 (npm — open source bundle)         │   │
│  │  ├── Managed pricebook (Supabase — per-region resources)   │   │
│  │  └── Custom org bundles (Supabase — per-org pricing)       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 19.2 Repo Strategy

```
Separate repos (current and planned):

github.com/ahs-id/ahs-id              ← Open source monorepo
  ├── packages/core/
  ├── packages/pupr-2023/
  ├── packages/hsd-*/
  ├── bindings/python/
  └── tests/golden/

github.com/rachmad-jenss/cost-your-project  ← Private EstiMara repo
  ├── package.json
  │   └── dependencies: { "@ahs-id/core": "^1.0.0" }  // future
  └── (proprietary modules)

CURRENT STATE:
  EstiMara's AHSP types (AhspComponent, AhspGroup, AhspCalculation)
  are defined inline in lib/types/index.ts. These serve as the
  living specification for what @ahs-id/core will export.
  When @ahs-id/core reaches v1.0.0, EstiMara replaces inline types
  with: import type { AhspCalculation } from '@ahs-id/core';

Rationale:
  • @ahs-id evolves independently — community PRs don't touch EstiMara
  • EstiMara pins @ahs-id version via package.json
  • Breaking changes in @ahs-id → EstiMara updates adapter when ready
  • Open source contributors never see proprietary code
```

### 19.3 Shared Type Definitions

Types that will flow from @ahs-id/core into EstiMara's adapter layer:

```typescript
// ===== @ahs-id/core exports =====
// These are the types EstiMara will import.
// Currently defined inline in EstiMara's lib/types/index.ts.

interface AhspComponent {
  ref: string;             // resource code (M.09.a, L.01, E.08)
  type: 'M' | 'L' | 'E';
  coefficient: number;
  unit_price: number;
  total_price: number;
  fallback_level?: number; // price resolution depth
}

interface AhspGroup {
  type: 'M' | 'L' | 'E';
  title: string;
  components: AhspComponent[];
  total: number;
}

interface AhspCalculation {
  groups: AhspGroup[];
  baseTotal: number;       // A (Labor) + B (Material) + C (Equipment)
  overheadPct: number;     // split: overhead component
  profitPct: number;       // split: profit component
  overheadProfitValue: number;
  grandTotal: number;      // baseTotal + overheadProfitValue
  warnings: string[];
  audit_trail: AuditEntry[];
}

// ===== EstiMara adapter extends these (proprietary) =====
// import type { AhspCalculation } from '@ahs-id/core';
//
// interface EstimaraEstimateLine extends AhspCalculation {
//   wbs_node_id: string;
//   estimate_version_id: string;
//   approved_by: string | null;
//   approved_at: Date | null;
//   revision: number;
// }
```

### 19.4 What Contributors Need to Know

External contributors to @ahs-id **do not need to understand** EstiMara internals. The boundary is:

| Layer | Responsibility | Visibility |
|-------|---------------|-----------|
| `@ahs-id/core` | Calculation engine, types, bundle validation | Open source |
| `@ahs-id/pupr-2023` | Regulation data (AHSP items, coefficients) | Open source |
| `@ahs-id/hsd-*` | Regional price data | Open source |
| EstiMara adapter | WBS mapping, audit, approval, org-scoping | Private |
| EstiMara platform | UI, auth, invoicing, scheduling, etc. | Private |

> Full EstiMara codebase documentation (directory tree, tech stack, Supabase schema, domain model) is maintained in `ESTIMARA-INTEGRATION.md` within the private `cost-your-project` repo.

---

## 20. AHS-ID Demo Site — Public Showcase & Developer Playground

> Standalone public-facing site yang berfungsi sebagai: (1) showcase @ahs-id/core engine capabilities, (2) interactive playground buat engineer Indonesia nyobain AHSP calculation tanpa install, (3) marketing funnel ke EstiMara, dan (4) SEO anchor untuk domain authority di niche cost engineering Indonesia.

> ⚠️ **HARD DEPENDENCY: This site MUST NOT be built before @ahs-id/core Phase 1 proof-of-engine golden test passes.** A demo site has zero value if `hitungHSP()` doesn't produce correct numbers. The temptation to build the shiny Next.js showcase before the engine is proven is real — resist it. Ship Phase 1 → validate with golden tests → then build the showcase. See Risk R2 (maintainer burnout) and Phase 1 exit criteria in Section 13.

### 20.1 Positioning & Goals

```
Inspirasi:   pasal.id (search bar + structured browsing UU Indonesia)
Domain:      ahs.estimara.id  atau  ahs.jenss.dev  atau  demo.ahs-id.dev
Tagline:     "Kalkulator AHSP Indonesia — Gratis, Transparan, Open Source"

Goals:
  G1  Prove the engine works — live, no install, no signup
  G2  SEO capture untuk "AHSP online", "kalkulator RAB", "harga satuan pekerjaan"
  G3  Developer adoption — npm install confidence dari seeing it work
  G4  EstiMara lead gen — "Butuh fitur lengkap? → estimara.id"
  G5  Community trust — semua perhitungan transparan, coefficient visible

Non-goals:
  ✗  Multi-user auth / org management (itu EstiMara)
  ✗  Persistent data storage (session-only, localStorage max)
  ✗  Mobile-first (desktop-first, responsive secondary)
```

### 20.2 Site Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  ahs.estimara.id                                                      │
│                                                                       │
│  PAGES:                                                               │
│                                                                       │
│  /                          ← Landing + Hero search bar               │
│  /kalkulator                ← Full interactive AHSP calculator        │
│  /browse                    ← Structured AHSP catalog browser         │
│  /browse/[bidang]           ← Bidang detail (Bina Marga, Cipta Karya) │
│  /browse/[bidang]/[divisi]  ← Divisi items (Divisi 3 — Tanah)        │
│  /item/[kode-ahsp]         ← Individual AHSP detail page (SEO)       │
│  /hsd                       ← HSD region browser & comparator         │
│  /hsd/[region]             ← Region detail (prices per resource)      │
│  /docs                      ← How it works, methodology, formulas     │
│  /docs/api                 ← @ahs-id/core API reference               │
│  /docs/contributing        ← How to contribute data/code              │
│  /changelog                ← Version history, what's new              │
│  /about                    ← About AHS-ID project, legal basis        │
│                                                                       │
│  STATIC ASSETS:                                                       │
│  /og/[kode-ahsp].png       ← Auto-generated OG images per item       │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 20.3 Page Detail — Homepage (`/`)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─ Hero ──────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │          AHS-ID                                              │ │
│  │          Kalkulator AHSP Indonesia                           │ │
│  │          Open source. Transparan. Gratis.                    │ │
│  │                                                              │ │
│  │  ┌──────────────────────────────────────────────────┐       │ │
│  │  │  🔍 Cari item pekerjaan...                       │       │ │
│  │  │  ┌────────────────────────────────────────────┐  │       │ │
│  │  │  │ ▸ 3.2.1 Lapis Pondasi Agregat Kelas A     │  │       │ │
│  │  │  │ ▸ 3.1.1 Galian Biasa                       │  │       │ │
│  │  │  │ ▸ 6.1.1 Lapis Aspal Beton (Laston)        │  │       │ │
│  │  │  └──────────────────── (autocomplete dropdown) ┘  │       │ │
│  │  └──────────────────────────────────────────────────┘       │ │
│  │                                                              │ │
│  │  [Buka Kalkulator]        [Browse Katalog]                   │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Stats Banner ──────────────────────────────────────────────┐ │
│  │  📊 XXX Item AHSP  │  📍 XX Region HSD  │  🔧 XX Peralatan  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Quick Access Cards ────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │ │
│  │  │ 🛣️ Bina Marga│  │ 🏗️ Cipta    │  │ 💧 SDA      │         │ │
│  │  │ XX items     │  │ Karya       │  │ XX items     │         │ │
│  │  │ Div 1-10     │  │ XX items    │  │              │         │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ How It Works (3-step) ─────────────────────────────────────┐ │
│  │  1. Pilih item AHSP        → Katalog lengkap per bidang     │ │
│  │  2. Set parameter proyek   → Jarak, kondisi, region HSD     │ │
│  │  3. Lihat hasil transparan → Setiap koefisien terlihat      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ CTA Footer ───────────────────────────────────────────────┐  │
│  │  Butuh fitur lengkap? WBS, kontrak, invoice, S-curve?       │  │
│  │  [Coba EstiMara →]                                          │  │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Footer: Powered by @ahs-id/core v1.x.x                         │
│  [GitHub] [npm] [EstiMara] [Dokumentasi]                         │
│  Dasar hukum: Permen PUPR 8/2023 | UU 14/2008 (KIP)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 20.4 Page Detail — Kalkulator (`/kalkulator`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  AHS-ID Kalkulator                                         [← Home] │
│                                                                      │
│  ┌─ Step 1: Pilih Item ─────────────────────────────────────────────┐│
│  │  Bidang:  [Bina Marga ▼]                                         ││
│  │  Item:    [🔍 3.2.1 Lapis Pondasi Agregat Kelas A          ▼]    ││
│  │           Satuan: m³ (compacted)                                  ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─ Step 2: Parameter Proyek ────────────────────────────────────────┐│
│  │                                                                    ││
│  │  ┌─ Jarak & Kondisi ──────┐  ┌─ Harga Dasar ─────────────────┐  ││
│  │  │ Jarak Quarry:  [25] km │  │ Region HSD: [Kaltim 2025   ▼] │  ││
│  │  │ Jarak Air:     [8 ] km │  │ Sumber:     HSPK Prov. Kaltim │  ││
│  │  │ Jarak Base:    [5 ] km │  │                                │  ││
│  │  │ Kondisi Jalan: [Sedang]│  │ ☐ Bandingkan dengan region lain│  ││
│  │  │ Fa (alat):     [0.83]  │  │                                │  ││
│  │  │ Fk (kondisi):  [0.90]  │  │ Override harga (opsional):     │  ││
│  │  └────────────────────────┘  │ Solar: [________] /liter       │  ││
│  │                               └──────────────────────────────┘   ││
│  │  ┌─ Markup ───────────────────────────────────────────────────┐  ││
│  │  │ Overhead:  [10] %    Profit: [5 ] %    PPN: [11] %        │  ││
│  │  └────────────────────────────────────────────────────────────┘  ││
│  │                                                                   ││
│  │  [Hitung HSP]  [Reset]                                            ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─ Step 3: Hasil Perhitungan ───────────────────────────────────────┐│
│  │                                                                    ││
│  │  3.2.1 Lapis Pondasi Agregat Kelas A                              ││
│  │  Satuan: m³ (compacted)  │  Region: Kaltim 2025                   ││
│  │                                                                    ││
│  │  ┌─ A. Tenaga Kerja ─────────────────────────────────────────────┐││
│  │  │ Kode   │ Uraian          │ Sat │ Koefisien │ Harga    │ Jumlah│││
│  │  │ L.01   │ Pekerja         │ OH  │ 0.06500   │ 135,000  │ 8,775 │││
│  │  │ L.02   │ Tukang          │ OH  │ 0.01300   │ 165,000  │ 2,145 │││
│  │  │ L.04   │ Mandor          │ OH  │ 0.00650   │ 210,000  │ 1,365 │││
│  │  │────────┼─────────────────┼─────┼───────────┼──────────┼───────│││
│  │  │        │                 │     │ Subtotal A│          │12,285 │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ┌─ B. Bahan ────────────────────────────────────────────────────┐││
│  │  │ M.09.a │ Agregat Kelas A │ m³  │ 1.02500   │ 425,000  │ ...  │││
│  │  │ M.25   │ Air             │ ltr │ 0.08000   │ 35       │ ...  │││
│  │  │────────┼─────────────────┼─────┼───────────┼──────────┼───────│││
│  │  │        │                 │     │ Subtotal B│          │ ...  │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ┌─ C. Peralatan ────────────────────────────────────────────────┐││
│  │  │ E.08   │ Dump Truck      │ jam │ 0.XXXXX   │ XXX,XXX  │ ...  │││
│  │  │        │ ↳ Kapasitas: 8 m³, V=40 km/h, jarak 25 km           │││
│  │  │        │ ↳ Produktivitas: XX.XX m³/jam (formula visible)      │││
│  │  │ E.15   │ Wheel Loader    │ jam │ 0.XXXXX   │ XXX,XXX  │ ...  │││
│  │  │ E.19   │ Motor Grader    │ jam │ 0.XXXXX   │ XXX,XXX  │ ...  │││
│  │  │ E.20   │ Vibratory Roller│ jam │ 0.XXXXX   │ XXX,XXX  │ ...  │││
│  │  │ E.21   │ Water Tanker    │ jam │ 0.XXXXX   │ XXX,XXX  │ ...  │││
│  │  │────────┼─────────────────┼─────┼───────────┼──────────┼───────│││
│  │  │        │                 │     │ Subtotal C│          │ ...  │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ┌─ Rekapitulasi ────────────────────────────────────────────────┐││
│  │  │ A. Tenaga Kerja                              Rp    12,285    │││
│  │  │ B. Bahan                                     Rp   XXX,XXX    │││
│  │  │ C. Peralatan                                 Rp   XXX,XXX    │││
│  │  │ ──────────────────────────────────────────────────────────    │││
│  │  │ Biaya Langsung (A+B+C)                       Rp   XXX,XXX    │││
│  │  │ Overhead (10%)                               Rp    XX,XXX    │││
│  │  │ Profit (5%)                                  Rp    XX,XXX    │││
│  │  │ ──────────────────────────────────────────────────────────    │││
│  │  │ Harga Satuan Pekerjaan                       Rp   XXX,XXX    │││
│  │  │ PPN (11%)                                    Rp    XX,XXX    │││
│  │  │ ──────────────────────────────────────────────────────────    │││
│  │  │ HSP + PPN                                    Rp X,XXX,XXX    │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ┌─ Audit Trail ─────────────────────────────────────────────────┐││
│  │  │ Calculation ID: calc_abc123                                    ││
│  │  │ Engine version: @ahs-id/core@1.2.3                            ││
│  │  │ Bundle: pupr-2023@1.0.0                                       ││
│  │  │ HSD source: kaltim-2025-q1                                    ││
│  │  │ Timestamp: 2026-05-15T10:30:00Z                               ││
│  │  │ All coefficients: Permen PUPR 8/2023 Lampiran                 ││
│  │  │ [Copy JSON] [Download Audit PDF]                               ││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  [📥 Export Excel]  [📄 Export PDF]  [📋 Copy JSON]  [🔗 Share URL]││
│  │                                                                    ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─ Region Comparison (jika dicentang) ──────────────────────────────┐│
│  │  ┌──────────────────────────────────────────────────────────────┐ ││
│  │  │ Region          │ Biaya Langsung │ HSP/m³     │ Δ vs Kaltim │ ││
│  │  │ Kaltim 2025     │ Rp XXX,XXX     │ Rp XXX,XXX │ baseline    │ ││
│  │  │ Kalimantan Sel.  │ Rp XXX,XXX     │ Rp XXX,XXX │ +3.2%      │ ││
│  │  │ DKI Jakarta     │ Rp XXX,XXX     │ Rp XXX,XXX │ +18.7%     │ ││
│  │  └──────────────────────────────────────────────────────────────┘ ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 20.5 Page Detail — AHSP Catalog Browser (`/browse`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browse Katalog AHSP                                       [← Home] │
│                                                                      │
│  ┌─ Filter Bar ──────────────────────────────────────────────────────┐│
│  │  Bidang: [Semua ▼]  Cari: [🔍 _______________]  Sumber: PUPR 2023││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─ Bina Marga ──────────────────────────────────────────────────────┐│
│  │                                                                    ││
│  │  ▼ Divisi 3 — Pekerjaan Tanah & Geosintetik (12 items)           ││
│  │  ┌────────────────────────────────────────────────────────────────┐││
│  │  │  3.1.1  Galian Biasa                          m³    [Hitung →]│││
│  │  │  3.1.2  Galian Batu                           m³    [Hitung →]│││
│  │  │  3.1.3  Galian Struktur dgn Kedalaman 0-2m    m³    [Hitung →]│││
│  │  │  3.2.1  Lapis Pondasi Agregat Kelas A         m³    [Hitung →]│││
│  │  │  3.2.2  Lapis Pondasi Agregat Kelas B         m³    [Hitung →]│││
│  │  │  3.2.3  Lapis Pondasi Agregat Kelas S         m³    [Hitung →]│││
│  │  │  ...                                                           │││
│  │  └────────────────────────────────────────────────────────────────┘││
│  │                                                                    ││
│  │  ▶ Divisi 4 — Pekerjaan Preventif & Minor (8 items)              ││
│  │  ▶ Divisi 5 — Perkerasan Berbutir & Beton Semen (15 items)       ││
│  │  ▶ Divisi 6 — Perkerasan Aspal (22 items)                        ││
│  │  ▶ Divisi 7 — Struktur (18 items)                                ││
│  │  ▶ Divisi 8 — Pengembalian Kondisi & Minor (6 items)             ││
│  │  ▶ Divisi 9 — Pekerjaan Harian (4 items)                        ││
│  │  ▶ Divisi 10 — Pekerjaan Pemeliharaan Rutin (10 items)           ││
│  │                                                                    ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─ Cipta Karya (coming soon) ───────────────────────────────────────┐│
│  │  🔒 Phase 3 — Contributions welcome!                              ││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 20.6 Page Detail — Individual Item (`/item/[kode-ahsp]`)

Setiap item AHSP punya halaman sendiri — penting untuk SEO. URL pattern: `/item/3-2-1-lapis-pondasi-agregat-kelas-a`

```
Konten:
  • Judul + kode + satuan
  • Deskripsi metode kerja (dari Permen PUPR)
  • Daftar komponen default (koefisien standar, bisa di-override di kalkulator)
  • Formula produktivitas (untuk peralatan) — rendered LaTeX/MathJax
  • Parameter yang mempengaruhi (jarak, kondisi, Fa, dll.)
  • Link ke kalkulator dengan item ini pre-selected
  • Structured data (JSON-LD) untuk Google rich snippets

SEO meta:
  <title>AHSP 3.2.1 Lapis Pondasi Agregat Kelas A — Kalkulator Harga Satuan</title>
  <meta name="description" content="Hitung harga satuan pekerjaan lapis pondasi
    agregat kelas A per m³. Koefisien resmi Permen PUPR 8/2023 dengan HSD regional." />

OG image:
  Auto-generated card showing item code, name, component count, dan HSP range
```

### 20.7 Tech Stack & Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Demo Site (Static/SSG)                                          │
│                                                                  │
│  Framework:   Next.js 15 (Static Export / ISR)                   │
│  Engine:      @ahs-id/core (npm — runs client-side)              │
│  Bundles:     @ahs-id/pupr-2023 (embedded at build time)         │
│  HSD data:    Static JSON files (bundled per region)             │
│  Styling:     Tailwind CSS + shadcn/ui (same as EstiMara)        │
│  Export:      SheetJS (xlsx), @react-pdf/renderer                │
│  Math render: KaTeX (for productivity formulas)                  │
│  Search:      Client-side fuzzy search (fuse.js)                 │
│  Analytics:   PostHog (same instance as EstiMara)                │
│  Deploy:      Vercel (or GitHub Pages via static export)         │
│                                                                  │
│  Key constraint:                                                 │
│    NO backend / NO database / NO auth                            │
│    Semua perhitungan di browser via @ahs-id/core                 │
│    State via URL params (shareable calculation links)             │
│    localStorage untuk "recent calculations" (optional)           │
│                                                                  │
│  URL-driven state (shareable):                                   │
│    /kalkulator?item=3.2.1&region=kaltim-2025&jarak_quarry=25     │
│    &fa=0.83&overhead=10&profit=5                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 20.8 Data Flow

```
Build time:
  @ahs-id/pupr-2023 bundle ─┐
  HSD JSON files ────────────┤
  AHSP metadata ─────────────┤──→  Next.js static build
  Item descriptions ──────────┘     ├── /browse pages (SSG)
                                    ├── /item/[slug] pages (SSG)
                                    └── /kalkulator (CSR)

Runtime (browser):
  User input (item, params) ──→ @ahs-id/core.hitungHSP()
                                    │
                                    ├── coefficient lookup (from bundle)
                                    ├── productivity calculation
                                    ├── HSD price resolution
                                    ├── margin application
                                    │
                                    ▼
                               AhspCalculation result
                                    │
                                    ├── Render table UI
                                    ├── Update URL params (shareable)
                                    ├── Export to Excel/PDF/JSON
                                    └── Audit trail generation
```

### 20.9 SEO Strategy

```
Target keywords (ID):
  Primary:    "AHSP online", "kalkulator harga satuan pekerjaan",
              "analisa harga satuan PUPR 2023"
  Secondary:  "RAB jalan", "harga satuan pekerjaan jalan",
              "koefisien AHSP Bina Marga"
  Long-tail:  "cara menghitung AHSP lapis pondasi agregat",
              "koefisien dump truck PUPR 2023"

Technical SEO:
  • SSG pages for /browse and /item/* (crawlable by Google)
  • JSON-LD structured data (HowTo, Dataset schemas)
  • Sitemap.xml auto-generated from AHSP catalog
  • OG images per item (auto-generated at build time)
  • Canonical URLs to prevent param duplication
  • Indonesian language hreflang tags

Content strategy:
  • Each /item page = unique content page (formula, components, method)
  • /docs pages with methodology explanations (indexable)
  • Potential blog posts: "Panduan Lengkap AHSP Bina Marga 2023"
```

### 20.10 Development Phases

```
Phase A — Static Showcase (depends on: @ahs-id/core Phase 1 MVP)
  ├── Landing page with search
  ├── /browse for Bina Marga items (Divisi 3 initially)
  ├── /item pages for available items
  ├── Basic /kalkulator with 1 item working end-to-end
  └── Deploy to Vercel

Phase B — Full Calculator (depends on: @ahs-id/core Phase 2)
  ├── All Bina Marga items in /kalkulator
  ├── Region selector with HSD data
  ├── Excel/PDF/JSON export
  ├── URL-driven shareable state
  ├── Region comparison feature
  └── Audit trail display

Phase C — SEO & Content (parallel)
  ├── OG image generation pipeline
  ├── JSON-LD structured data
  ├── Sitemap generation
  ├── /docs with methodology content
  └── Analytics (PostHog) integration

Phase D — Multi-bidang (depends on: @ahs-id/core Phase 3)
  ├── Cipta Karya items
  ├── SDA items
  ├── Additional HSD regions
  └── Community contribution workflow
```

---

## Appendix D: Round 4 — Project Plan (v2.2 → v2.3)

| # | Addition | Description |
|---|----------|-------------|
| P1 | **Section 12: README & Onboarding** | Full README.md structure with quickstart, available bundles table, key concepts, and CONTRIBUTING.md outline with data contribution requirements and good-first-issue labels. |
| P2 | **Section 13: Scope per Phase** | Requirement-based phase boundaries. Phase 1 (MVP): 1 chain works. Phase 2 (Functional): usable by others, npm published. Phase 3 (Multi-bidang): all 4 bidang + Python. Phase 4 (Platform): EstiMara integration + CDN. Each phase has explicit entry/exit requirements and deliverable lists. |
| P3 | **Section 14: Proof of Engine DoD** | Definition of Done for AHSP 3.2.1 proof-of-engine: 20-item checklist covering bundle loading, coefficient resolution, productivity calculation, volume conversion, HSD computation, margin application, and accuracy validation (ΔRp ≤ 1 vs independent manual calc). |
| P4 | **Section 15: Release Strategy** | Version lifecycle (alpha → beta → stable), npm publish CI pipeline with pre-publish gates (golden tests + validateBundle + type check), conventional commit changelog generation. |
| P5 | **Section 16: Legal Framework** | Full LEGAL.md content with legal basis for government data republication (UU 28/2014 Pasal 42, UU 14/2008, PP 70/2019), attribution policy, disclaimer, and license clarification (MIT for engine, public domain for regulation data). |
| P6 | **Section 17: Risk Register** | 10 identified risks with likelihood, impact, and mitigation. Top risks: data accuracy error (medium/critical), maintainer burnout (high/high), zero adoption (medium/medium). |
| P7 | **Section 18: Success Metrics** | Coverage-focused primary metrics (AHSP items digitized per bidang, HSD regions, equipment types, golden test count). Secondary metrics (npm downloads, GitHub stars — tracked not targeted). Quality gating metrics (100% golden tests, 100% validateBundle, 100% Layer 1 verification). |
| P8 | **Section 19: EstiMara Integration (Revised)** | Trimmed to adapter-layer only per review feedback. Full codebase details moved to separate ESTIMARA-INTEGRATION.md. Section now covers: integration model diagram, repo strategy (current inline vs future @ahs-id/core npm), shared type definitions (AhspCalculation with split overhead/profit), and contributor visibility table. |
| P9 | **Section 20: AHS-ID Demo Site** | Standalone public showcase & developer playground. Full site architecture (10 page types), detailed wireframes for homepage, kalkulator (3-step with full AHSP table mockup, region comparison, audit trail), catalog browser (accordion per divisi), individual item pages (SEO-optimized with JSON-LD). Tech stack (static Next.js, no backend, URL-driven state). SEO strategy (target keywords, structured data, OG images). 4-phase development roadmap aligned to @ahs-id/core phases. Hard dependency gate: MUST NOT build before Phase 1 golden test passes. |

---

## Appendix E: Review Response Log (v2.3 → v2.3.1)

External review feedback received and incorporated. Each point maps to a specific fix applied to the document.

| # | Review Point | Severity | Fix Applied | Sections Modified |
|---|-------------|----------|-------------|-------------------|
| F1 | **Roller productivity unit mismatch risk** — `kecepatan_operasi_km_jam` values (2.0, 2.5, 3.0 km/h) must be converted to m/h before formula `v × b × t × Fa / n`. Without conversion → productivity off by 1000×. | Critical | Already present: explicit `⚠️ UNIT CONVERSION CRITICAL` warning block in Section 2.4 (lines 162-167) and inline comment in Section 4.3 roller `produktivitas_params` (line 541). Golden test will catch this immediately. | 2.4, 4.3 |
| F2 | **Section 19 too detailed for open source doc** — Full directory tree of `cost-your-project` (40+ entries, CSRF middleware, PostHog setup, etc.) is noise for open source contributors. | Medium | Trimmed Section 19 to adapter-layer only: integration model, repo strategy, shared types, contributor visibility table. Full codebase details referenced via `ESTIMARA-INTEGRATION.md` within private repo. | 19.1–19.4 |
| F3 | **R2 (maintainer burnout) mitigation weak** — "Jangan commit ke timeline" is insufficient for solo dev. | High | Replaced with concrete phase discipline rules: (1) No CLI/Python/demo until golden test passes, (2) No Divisi 4+ data until Divisi 3 100% L1-verified, (3) Phase scope boundaries are hard gates not suggestions. | 17 (R2) |
| F4 | **Demo site should not be parallel workstream** — Temptation to build shiny Next.js site before engine proven is real. Demo site has zero value if `hitungHSP()` doesn't produce correct numbers. | High | Added `⚠️ HARD DEPENDENCY` callout at Section 20 opening. Explicit: "MUST NOT be built before Phase 1 proof-of-engine golden test passes." Cross-references R2 and Section 13 phase exit criteria. | 20 (intro) |
| F5 | **Missing accuracy-per-item metric** — "AHSP items digitized" tracked but not "AHSP items verified at Layer 1." Digitized ≠ verified; unverified items give false confidence. | High | Added "AHSP items L1-verified" row to primary metrics table (Section 18.1) with per-phase targets showing 100% verification ratio. Added critical rule note: "An item that is digitized but not L1-verified is worse than no item." | 18.1 |
| F6 | **overhead_profit_pct split inconsistency** — Schema (Section 4.5) stores combined, but kalkulator wireframe shows split fields. Permen PUPR defines combined "Biaya Umum dan Keuntungan" range, but practice splits them. | Medium | Schema already had split (`overhead_pct` + `profit_pct`) with sum constraint `10 ≤ sum ≤ 15` (Section 4.5). Fixed 3 remaining combined `overhead_profit_pct` references elsewhere: Section 10.3 validation (→ `overhead_pct + profit_pct sum`), Section 10.4 margin test (→ `overhead_pct=8, profit_pct=4`), Section 14.2 test scenario config (→ `"overhead_pct": 10, "profit_pct": 5`). AhspCalculation type in Section 19.3 already had `overheadPct` + `profitPct` split. | 4.5, 10.3, 10.4, 14.2, 19.3 |
