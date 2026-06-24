import type {
  BundleMeta,
  AhspItem,
  DataBundle,
  TenagaKerjaBundle,
  BahanMasterBundle,
  PeralatanMasterBundle,
  FaktorKonversi,
} from '@ahs-id/core';

import tenagaKerjaData from '../data/tenaga-kerja.json' with { type: 'json' };
import bahanMasterData from '../data/bahan-master.json' with { type: 'json' };
import peralatanMasterData from '../data/peralatan-master.json' with { type: 'json' };
import faktorKonversiData from '../data/faktor-konversi.json' with { type: 'json' };

import divisi2Data from '../data/ahsp/divisi-2/items.json' with { type: 'json' };
import divisi3Data from '../data/ahsp/divisi-3/items.json' with { type: 'json' };
import divisi4Data from '../data/ahsp/divisi-4/items.json' with { type: 'json' };
import divisi5Data from '../data/ahsp/divisi-5/items.json' with { type: 'json' };
import divisi6Data from '../data/ahsp/divisi-6/items.json' with { type: 'json' };
import divisi7Data from '../data/ahsp/divisi-7/items.json' with { type: 'json' };
import divisi8Data from '../data/ahsp/divisi-8/items.json' with { type: 'json' };
import divisi9Data from '../data/ahsp/divisi-9/items.json' with { type: 'json' };
import divisi10Data from '../data/ahsp/divisi-10/items.json' with { type: 'json' };

export const meta: BundleMeta = {
  name: '@ahs-id/bina-marga-2022',
  version: '1.0.0',
  ahs_meta: {
    permen_nomor: 1,
    permen_tahun: 2022,
    regulation: 'Permen PUPR No. 1 Tahun 2022',
    supplement: null,
    effective_date: '2022-01-01',
    supersedes: null,
    bidang: ['bina-marga'],
    data_source: 'Lampiran Permen PUPR 1/2022 via JDIH',
    last_verified: '2026-05-16',
  },
};

export const tenagaKerja = tenagaKerjaData as unknown as TenagaKerjaBundle;
export const bahanMaster = bahanMasterData as unknown as BahanMasterBundle;
export const peralatanMaster = peralatanMasterData as unknown as PeralatanMasterBundle;
export const faktorKonversi = faktorKonversiData as unknown as FaktorKonversi;

export const ahspItems: readonly AhspItem[] = [
  ...(divisi2Data as unknown as AhspItem[]),
  ...(divisi3Data as unknown as AhspItem[]),
  ...(divisi4Data as unknown as AhspItem[]),
  ...(divisi5Data as unknown as AhspItem[]),
  ...(divisi6Data as unknown as AhspItem[]),
  ...(divisi7Data as unknown as AhspItem[]),
  ...(divisi8Data as unknown as AhspItem[]),
  ...(divisi9Data as unknown as AhspItem[]),
  ...(divisi10Data as unknown as AhspItem[]),
];

export const bundle: DataBundle = {
  meta,
  tenaga_kerja: tenagaKerja,
  bahan: bahanMaster,
  peralatan: peralatanMaster,
  faktor_konversi: faktorKonversi,
  ahsp_items: ahspItems as unknown as DataBundle['ahsp_items'],
};
