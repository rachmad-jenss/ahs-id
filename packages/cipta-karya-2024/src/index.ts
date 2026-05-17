import type { BundleMeta, FixedCoefficientItem } from '@ahs-id/core';

import d1GalianTanahData from '../data/ahsp/divisi-1/galian-tanah.json' with { type: 'json' };
import d1PersiapanData from '../data/ahsp/divisi-1/persiapan.json' with { type: 'json' };
import d10StrukturRishaData from '../data/ahsp/divisi-10/struktur-risha.json' with { type: 'json' };
import d2AngkutMaterialData from '../data/ahsp/divisi-2/angkut-material.json' with { type: 'json' };
import d2GeotekstilGeomembranData from '../data/ahsp/divisi-2/geotekstil-geomembran.json' with { type: 'json' };
import d2TimbunanPemadatanData from '../data/ahsp/divisi-2/timbunan-pemadatan.json' with { type: 'json' };
import d3PembongkaranData from '../data/ahsp/divisi-3/pembongkaran.json' with { type: 'json' };
import d3RangkaAtapData from '../data/ahsp/divisi-3/rangka-atap.json' with { type: 'json' };
import d4BajaData from '../data/ahsp/divisi-4/baja.json' with { type: 'json' };
import d4BetonPracetakData from '../data/ahsp/divisi-4/beton-pracetak.json' with { type: 'json' };
import d4BetonPrategangData from '../data/ahsp/divisi-4/beton-prategang.json' with { type: 'json' };
import d4BetonData from '../data/ahsp/divisi-4/beton.json' with { type: 'json' };
import d4DindingPenahanTanahData from '../data/ahsp/divisi-4/dinding-penahan-tanah.json' with { type: 'json' };
import d4PondasiData from '../data/ahsp/divisi-4/pondasi.json' with { type: 'json' };
import d4StrukturKayuData from '../data/ahsp/divisi-4/struktur-kayu.json' with { type: 'json' };
import d5BesiAluminiumData from '../data/ahsp/divisi-5/besi-aluminium.json' with { type: 'json' };
import d5KacaData from '../data/ahsp/divisi-5/kaca.json' with { type: 'json' };
import d5KayuData from '../data/ahsp/divisi-5/kayu.json' with { type: 'json' };
import d5OrnamenData from '../data/ahsp/divisi-5/ornamen.json' with { type: 'json' };
import d5PasanganDindingData from '../data/ahsp/divisi-5/pasangan-dinding.json' with { type: 'json' };
import d5PengecatanPelituranData from '../data/ahsp/divisi-5/pengecatan-pelituran.json' with { type: 'json' };
import d5PenutupAtapData from '../data/ahsp/divisi-5/penutup-atap.json' with { type: 'json' };
import d5PenutupLantaiDindingData from '../data/ahsp/divisi-5/penutup-lantai-dinding.json' with { type: 'json' };
import d5PintuJendelaData from '../data/ahsp/divisi-5/pintu-jendela.json' with { type: 'json' };
import d5PlafonData from '../data/ahsp/divisi-5/plafon.json' with { type: 'json' };
import d5PlesteranAcianData from '../data/ahsp/divisi-5/plesteran-acian.json' with { type: 'json' };
import d5SignageData from '../data/ahsp/divisi-5/signage.json' with { type: 'json' };
import d6LansekapData from '../data/ahsp/divisi-6/lansekap.json' with { type: 'json' };
import d6SanitairData from '../data/ahsp/divisi-6/sanitair.json' with { type: 'json' };
import d7JaringanListrikData from '../data/ahsp/divisi-7/jaringan-listrik.json' with { type: 'json' };
import d8BakKontrolData from '../data/ahsp/divisi-8/bak-kontrol.json' with { type: 'json' };
import d8PerpipaanDalamGedungData from '../data/ahsp/divisi-8/perpipaan-dalam-gedung.json' with { type: 'json' };
import d8PerpipaanProteksiKebakaranData from '../data/ahsp/divisi-8/perpipaan-proteksi-kebakaran.json' with { type: 'json' };
import d8SistemAirHujanData from '../data/ahsp/divisi-8/sistem-air-hujan.json' with { type: 'json' };
import d8SistemAirLimbahData from '../data/ahsp/divisi-8/sistem-air-limbah.json' with { type: 'json' };
import d8SistemAirMinumData from '../data/ahsp/divisi-8/sistem-air-minum.json' with { type: 'json' };
import d9DrainaseData from '../data/ahsp/divisi-9/drainase.json' with { type: 'json' };
import d9JalanPemukimanData from '../data/ahsp/divisi-9/jalan-pemukiman.json' with { type: 'json' };
import d9JaringanPipaLuarGedungData from '../data/ahsp/divisi-9/jaringan-pipa-luar-gedung.json' with { type: 'json' };

export const meta: BundleMeta = {
  name: '@ahs-id/cipta-karya-2024',
  version: '1.0.0',
  ahs_meta: {
    permen_nomor: null,
    permen_tahun: 2024,
    regulation: 'SE Bina Konstruksi No. 68/SE/Dk/2024',
    supplement: null,
    effective_date: '2024-01-01',
    supersedes: null,
    bidang: ['cipta-karya'],
    data_source: 'SE Bina Konstruksi No. 68/SE/Dk/2024 — DHSP Bidang Cipta Karya',
    last_verified: '2026-05-16',
  },
};

export const ahspItems: readonly FixedCoefficientItem[] = [
  ...d1GalianTanahData,
  ...d1PersiapanData,
  ...d10StrukturRishaData,
  ...d2AngkutMaterialData,
  ...d2GeotekstilGeomembranData,
  ...d2TimbunanPemadatanData,
  ...d3PembongkaranData,
  ...d3RangkaAtapData,
  ...d4BajaData,
  ...d4BetonPracetakData,
  ...d4BetonPrategangData,
  ...d4BetonData,
  ...d4DindingPenahanTanahData,
  ...d4PondasiData,
  ...d4StrukturKayuData,
  ...d5BesiAluminiumData,
  ...d5KacaData,
  ...d5KayuData,
  ...d5OrnamenData,
  ...d5PasanganDindingData,
  ...d5PengecatanPelituranData,
  ...d5PenutupAtapData,
  ...d5PenutupLantaiDindingData,
  ...d5PintuJendelaData,
  ...d5PlafonData,
  ...d5PlesteranAcianData,
  ...d5SignageData,
  ...d6LansekapData,
  ...d6SanitairData,
  ...d7JaringanListrikData,
  ...d8BakKontrolData,
  ...d8PerpipaanDalamGedungData,
  ...d8PerpipaanProteksiKebakaranData,
  ...d8SistemAirHujanData,
  ...d8SistemAirLimbahData,
  ...d8SistemAirMinumData,
  ...d9DrainaseData,
  ...d9JalanPemukimanData,
  ...d9JaringanPipaLuarGedungData,
] as unknown as FixedCoefficientItem[];
