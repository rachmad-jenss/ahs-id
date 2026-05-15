import { describe, it, expect } from 'vitest';
import {
  produktivitasDumpTruck,
  produktivitasExcavator,
  produktivitasWheelLoader,
  produktivitasWaterTanker,
  produktivitasVibroRoller,
  produktivitasMotorGrader,
} from '../produktivitas/index.js';

describe('siklus: Dump Truck', () => {
  it('calculates DT productivity for 25km sedang', () => {
    const result = produktivitasDumpTruck({
      kapasitas_m3: 8,
      jarak_km: 25,
      kecepatan_isi_km_jam: 30,
      kecepatan_kosong_km_jam: 40,
      waktu_muat_menit: 2.5,
      waktu_bongkar_menit: 1.5,
      waktu_tunggu_menit: 1.0,
      faktor_muatan: 0.95,
      faktor_efisiensi: 0.83,
    });

    // Ts = 2.5 + (25/30)*60 + (25/40)*60 + 1.5 + 1.0
    //    = 2.5 + 50 + 37.5 + 1.5 + 1.0 = 92.5 menit
    // Q = (8 × 0.95 × 0.83 × 60) / 92.5
    const Ts = 2.5 + 50 + 37.5 + 1.5 + 1.0;
    const Q = (8 * 0.95 * 0.83 * 60) / Ts;

    expect(result.produktivitas).toBeCloseTo(Q, 4);
    expect(result.satuan).toBe('m3/jam');
  });
});

describe('siklus: Excavator', () => {
  it('calculates Excavator productivity', () => {
    const result = produktivitasExcavator({
      kapasitas_bucket_m3: 0.93,
      faktor_bucket: 1.00,
      faktor_efisiensi: 0.83,
      waktu_siklus_menit: 0.45,
    });

    // Q = (0.93 × 1.00 × 0.83 × 60) / 0.45
    const Q = (0.93 * 1.00 * 0.83 * 60) / 0.45;
    expect(result.produktivitas).toBeCloseTo(Q, 4);
  });
});

describe('siklus: Wheel Loader', () => {
  it('calculates WL productivity', () => {
    const result = produktivitasWheelLoader({
      kapasitas_bucket_m3: 1.5,
      faktor_bucket: 0.85,
      faktor_efisiensi: 0.83,
      waktu_siklus_menit: 0.50,
    });

    const Q = (1.5 * 0.85 * 0.83 * 60) / 0.5;
    expect(result.produktivitas).toBeCloseTo(Q, 4);
  });
});

describe('siklus: Water Tanker', () => {
  it('calculates WT productivity for 8km', () => {
    const result = produktivitasWaterTanker({
      kapasitas_liter: 4000,
      jarak_km: 8,
      kecepatan_isi_km_jam: 25,
      kecepatan_kosong_km_jam: 35,
      waktu_muat_menit: 3.0,
      waktu_bongkar_menit: 5.0,
      waktu_tunggu_menit: 1.0,
      faktor_efisiensi: 0.83,
      kebutuhan_air_liter_per_m3: 70,
    });

    // Ts = 3.0 + (8/25)*60 + (8/35)*60 + 5.0 + 1.0
    const Ts = 3.0 + (8 / 25) * 60 + (8 / 35) * 60 + 5.0 + 1.0;
    const Q_liter = (4000 * 0.83 * 60) / Ts;
    const Q_m3 = Q_liter / 70;

    expect(result.produktivitas).toBeCloseTo(Q_m3, 4);
    expect(result.satuan).toBe('m3/jam');
  });
});

describe('lintasan: Vibratory Roller', () => {
  it('converts km/jam to m/jam and calculates correctly', () => {
    const result = produktivitasVibroRoller({
      kecepatan_operasi_km_jam: 2.5,
      lebar_efektif_m: 2.00,
      tebal_hamparan_m: 0.20,
      faktor_efisiensi: 0.83,
      jumlah_passing: 6,
    });

    // v_m = 2.5 × 1000 = 2500 m/jam
    // Q = (2500 × 2.00 × 0.20 × 0.83) / 6 = 138.33...
    const v_m = 2500;
    const Q = (v_m * 2.0 * 0.2 * 0.83) / 6;

    expect(result.produktivitas).toBeCloseTo(Q, 4);
    expect(result.satuan).toBe('m3/jam');
    expect(result.produktivitas).toBeGreaterThan(100);
  });

  it('would be 1000x wrong without km→m conversion', () => {
    const result = produktivitasVibroRoller({
      kecepatan_operasi_km_jam: 2.5,
      lebar_efektif_m: 2.00,
      tebal_hamparan_m: 0.20,
      faktor_efisiensi: 0.83,
      jumlah_passing: 6,
    });

    // If someone forgot the ×1000, result would be ~0.138 instead of ~138
    expect(result.produktivitas).toBeGreaterThan(1);
  });
});

describe('lintasan: Motor Grader', () => {
  it('calculates area-based productivity in m2/jam', () => {
    const result = produktivitasMotorGrader({
      kecepatan_operasi_km_jam: 3.0,
      lebar_efektif_m: 2.4,
      faktor_efisiensi: 0.83,
      jumlah_lintasan: 6,
    });

    // v_m = 3.0 × 1000 = 3000 m/jam
    // Q = (3000 × 2.4 × 0.83) / 6 = 996 m2/jam
    const Q = (3000 * 2.4 * 0.83) / 6;

    expect(result.produktivitas).toBeCloseTo(Q, 4);
    expect(result.satuan).toBe('m2/jam');
  });
});
