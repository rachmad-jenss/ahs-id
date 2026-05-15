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
import ahsp321Data from '../data/ahsp/bina-marga/divisi-3/3.2.1-lapis-pondasi-agregat.json' with { type: 'json' };
import ahsp311Data from '../data/ahsp/bina-marga/divisi-3/3.1.1-galian-biasa.json' with { type: 'json' };

export const meta: BundleMeta = {
  name: '@ahs-id/pupr-2023',
  version: '1.0.0',
  ahs_meta: {
    permen_nomor: 8,
    permen_tahun: 2023,
    regulation: 'Permen PUPR No. 8 Tahun 2023',
    supplement: 'SE Dirjen Bina Konstruksi No. 73/2023',
    effective_date: '2023-08-30',
    supersedes: null,
    bidang: ['umum', 'sda', 'bina-marga', 'cipta-karya'],
    data_source: 'Lampiran Permen PUPR 8/2023 via JDIH',
    last_verified: '2026-05-14',
  },
};

export const tenagaKerja = tenagaKerjaData as unknown as TenagaKerjaBundle;
export const bahanMaster = bahanMasterData as unknown as BahanMasterBundle;
export const peralatanMaster = peralatanMasterData as unknown as PeralatanMasterBundle;
export const faktorKonversi = faktorKonversiData as unknown as FaktorKonversi;

export const ahspItems: readonly AhspItem[] = [
  ahsp321Data as unknown as AhspItem,
  ahsp311Data as unknown as AhspItem,
];

export const bundle: DataBundle = {
  meta,
  tenaga_kerja: tenagaKerja,
  bahan: bahanMaster,
  peralatan: peralatanMaster,
  faktor_konversi: faktorKonversi,
  ahsp_items: ahspItems,
};
