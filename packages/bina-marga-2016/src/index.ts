import type {
  BundleMeta,
  TenagaKerjaBundle,
  BahanMasterBundle,
  PeralatanMasterBundle,
  FaktorKonversi,
  AhspItem,
  DataBundle,
} from '@ahs-id/core';

import tenagaKerjaData from '../data/tenaga-kerja.json' with { type: 'json' };
import bahanMasterData from '../data/bahan-master.json' with { type: 'json' };
import peralatanMasterData from '../data/peralatan-master.json' with { type: 'json' };
import faktorKonversiData from '../data/faktor-konversi.json' with { type: 'json' };

// Divisi 3 — Sub-divisi 3.1 Galian
import ahsp311 from '../data/ahsp/bina-marga/divisi-3/3.1.1-galian-biasa.json' with { type: 'json' };
import ahsp312 from '../data/ahsp/bina-marga/divisi-3/3.1.2-galian-batu-lunak.json' with { type: 'json' };
import ahsp313 from '../data/ahsp/bina-marga/divisi-3/3.1.3-galian-batu.json' with { type: 'json' };
import ahsp314 from '../data/ahsp/bina-marga/divisi-3/3.1.4-galian-struktur-0-2m.json' with { type: 'json' };
import ahsp315 from '../data/ahsp/bina-marga/divisi-3/3.1.5-galian-struktur-2-4m.json' with { type: 'json' };
import ahsp316 from '../data/ahsp/bina-marga/divisi-3/3.1.6-galian-struktur-4-6m.json' with { type: 'json' };
import ahsp317 from '../data/ahsp/bina-marga/divisi-3/3.1.7-galian-perkerasan-beraspal-cmm.json' with { type: 'json' };
import ahsp318 from '../data/ahsp/bina-marga/divisi-3/3.1.8-galian-perkerasan-beraspal-manual.json' with { type: 'json' };
import ahsp319 from '../data/ahsp/bina-marga/divisi-3/3.1.9-galian-perkerasan-berbutir.json' with { type: 'json' };
import ahsp3110 from '../data/ahsp/bina-marga/divisi-3/3.1.10-galian-perkerasan-beton.json' with { type: 'json' };

// Divisi 3 — Sub-divisi 3.2 Timbunan
import ahsp321a from '../data/ahsp/bina-marga/divisi-3/3.2.1a-timbunan-biasa-sumber-galian.json' with { type: 'json' };
import ahsp321b from '../data/ahsp/bina-marga/divisi-3/3.2.1b-timbunan-biasa-hasil-galian.json' with { type: 'json' };
import ahsp322a from '../data/ahsp/bina-marga/divisi-3/3.2.2a-timbunan-pilihan-sumber-galian.json' with { type: 'json' };
import ahsp322b from '../data/ahsp/bina-marga/divisi-3/3.2.2b-timbunan-pilihan-hasil-galian.json' with { type: 'json' };
import ahsp323a from '../data/ahsp/bina-marga/divisi-3/3.2.3a-timbunan-pilihan-berbutir-bak.json' with { type: 'json' };
import ahsp323b from '../data/ahsp/bina-marga/divisi-3/3.2.3b-timbunan-pilihan-berbutir-rod.json' with { type: 'json' };
import ahsp324 from '../data/ahsp/bina-marga/divisi-3/3.2.4-penimbunan-kembali-berbutir.json' with { type: 'json' };

// Divisi 3 — Sub-divisi 3.3 Penyiapan
import ahsp331 from '../data/ahsp/bina-marga/divisi-3/3.3.1-penyiapan-badan-jalan.json' with { type: 'json' };

// Divisi 3 — Sub-divisi 3.4 Pembersihan & Pembebasan
import ahsp341 from '../data/ahsp/bina-marga/divisi-3/3.4.1-pembersihan-pengupasan-lahan.json' with { type: 'json' };
import ahsp342 from '../data/ahsp/bina-marga/divisi-3/3.4.2-pemotongan-pohon-15-30cm.json' with { type: 'json' };
import ahsp343 from '../data/ahsp/bina-marga/divisi-3/3.4.3-pemotongan-pohon-30-50cm.json' with { type: 'json' };
import ahsp344 from '../data/ahsp/bina-marga/divisi-3/3.4.4-pemotongan-pohon-50-75cm.json' with { type: 'json' };
import ahsp345 from '../data/ahsp/bina-marga/divisi-3/3.4.5-pemotongan-pohon-gt75cm.json' with { type: 'json' };

export const meta: BundleMeta = {
  name: '@ahs-id/bina-marga-2016',
  version: '0.1.0',
  ahs_meta: {
    permen_nomor: 28,
    permen_tahun: 2016,
    regulation: 'Permen PUPR No. 28/PRT/M/2016',
    supplement: 'Spesifikasi Umum Bina Marga 2010 Rev.3 & AHS BIMTEK v5.0 (21 Okt 2019)',
    effective_date: '2016-01-01',
    supersedes: null,
    bidang: ['bina-marga'],
    data_source: 'AHS_ver_5.0_NEW_Finalisasi_BIMTEK_AHSP_21_OCT_2019.xlsx (Sheet D3)',
    last_verified: '2026-05-17',
  },
};

export const tenagaKerja = tenagaKerjaData as unknown as TenagaKerjaBundle;
export const bahanMaster = bahanMasterData as unknown as BahanMasterBundle;
export const peralatanMaster = peralatanMasterData as unknown as PeralatanMasterBundle;
export const faktorKonversi = faktorKonversiData as unknown as FaktorKonversi;

export const ahspItems: readonly AhspItem[] = [
  // 3.1 Galian
  ahsp311 as unknown as AhspItem,
  ahsp312 as unknown as AhspItem,
  ahsp313 as unknown as AhspItem,
  ahsp314 as unknown as AhspItem,
  ahsp315 as unknown as AhspItem,
  ahsp316 as unknown as AhspItem,
  ahsp317 as unknown as AhspItem,
  ahsp318 as unknown as AhspItem,
  ahsp319 as unknown as AhspItem,
  ahsp3110 as unknown as AhspItem,
  // 3.2 Timbunan
  ahsp321a as unknown as AhspItem,
  ahsp321b as unknown as AhspItem,
  ahsp322a as unknown as AhspItem,
  ahsp322b as unknown as AhspItem,
  ahsp323a as unknown as AhspItem,
  ahsp323b as unknown as AhspItem,
  ahsp324 as unknown as AhspItem,
  // 3.3 Penyiapan
  ahsp331 as unknown as AhspItem,
  // 3.4 Pembersihan & Pemotongan
  ahsp341 as unknown as AhspItem,
  ahsp342 as unknown as AhspItem,
  ahsp343 as unknown as AhspItem,
  ahsp344 as unknown as AhspItem,
  ahsp345 as unknown as AhspItem,
];

export const bundle: DataBundle = {
  meta,
  tenaga_kerja: tenagaKerja,
  bahan: bahanMaster,
  peralatan: peralatanMaster,
  faktor_konversi: faktorKonversi,
  ahsp_items: ahspItems,
};
