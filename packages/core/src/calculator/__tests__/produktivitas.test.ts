import { describe, it, expect } from 'vitest';
import {
  produktivitasDumpTruck,
  produktivitasExcavator,
  produktivitasWheelLoader,
  produktivitasWaterTanker,
  produktivitasVibroRoller,
  produktivitasMotorGrader,
  produktivitasThroughput,
  hitungHsdTransportSatuan,
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

describe('produktivitasThroughput', () => {
  it('calculates AMP productivity as rated capacity × efficiency', () => {
    const result = produktivitasThroughput({
      kapasitas_rated: 60,
      satuan_kapasitas: 'ton/jam',
      faktor_efisiensi: 0.83,
    });

    expect(result.produktivitas).toBeCloseTo(60 * 0.83, 4);
    expect(result.satuan).toBe('ton/jam');
    expect(result.audit).toHaveLength(1);
    expect(result.audit[0]!.step).toBe('produktivitas_throughput');
  });

  it('works with m3/jam capacity', () => {
    const result = produktivitasThroughput({
      kapasitas_rated: 30,
      satuan_kapasitas: 'm3/jam',
      faktor_efisiensi: 0.75,
    });

    expect(result.produktivitas).toBeCloseTo(30 * 0.75, 4);
    expect(result.satuan).toBe('m3/jam');
  });
});

describe('hitungHsdTransportSatuan', () => {
  it('calculates derived HSD without TK cost (backward-compat)', () => {
    // V=5 polybag/trip, Qz=2 polybag/menit, L=5km, V1=20km/jam
    // HSD_alat=80_000/jam, no TK
    const result = hitungHsdTransportSatuan({
      kapasitas_angkut: 5,
      kapasitas_angkat_per_menit: 2,
      jarak_km: 5,
      kecepatan_km_jam: 20,
      hsd_alat_per_jam: 80_000,
      hsd_dasar_per_item: 150_000,
    });

    // T_muat = 5×2/2 = 5 menit, T_jalan = 5/20×60 = 15, Ts = 20
    // biaya_alat = 80_000 × 20/60 = 26_666.67
    // biaya_angkut = 26_666.67 / 5 = 5_333.33
    const t_muat = (5 * 2) / 2;
    const t_jalan = (5 / 20) * 60;
    const ts = t_muat + t_jalan;
    const biaya_angkut = (80_000 * (ts / 60)) / 5;

    expect(result.t_muat_menit).toBeCloseTo(t_muat, 4);
    expect(result.t_jalan_menit).toBeCloseTo(t_jalan, 4);
    expect(result.ts_menit).toBeCloseTo(ts, 4);
    expect(result.biaya_angkut_per_item).toBeCloseTo(biaya_angkut, 2);
    expect(result.hsd_per_item).toBeCloseTo(150_000 + biaya_angkut, 2);
    // audit: t_muat, t_jalan, ts, biaya_alat, biaya_angkut, hsd = 6 entries (no biaya_tk)
    expect(result.audit).toHaveLength(6);
  });

  it('zero transport distance yields only muat/bongkar cost', () => {
    const result = hitungHsdTransportSatuan({
      kapasitas_angkut: 10,
      kapasitas_angkat_per_menit: 5,
      jarak_km: 0,
      kecepatan_km_jam: 20,
      hsd_alat_per_jam: 60_000,
      hsd_dasar_per_item: 200_000,
    });

    expect(result.t_jalan_menit).toBeCloseTo(0, 6);
    expect(result.ts_menit).toBeCloseTo(4, 4);
    // biaya_angkut = (60_000 × 4/60) / 10 = 400
    expect(result.biaya_angkut_per_item).toBeCloseTo(400, 2);
    expect(result.hsd_per_item).toBeCloseTo(200_400, 2);
  });

  it('larger capacity reduces per-item cost', () => {
    const base = hitungHsdTransportSatuan({
      kapasitas_angkut: 5,
      kapasitas_angkat_per_menit: 2,
      jarak_km: 3,
      kecepatan_km_jam: 20,
      hsd_alat_per_jam: 80_000,
      hsd_dasar_per_item: 100_000,
    });
    const bigger = hitungHsdTransportSatuan({
      kapasitas_angkut: 10,
      kapasitas_angkat_per_menit: 2,
      jarak_km: 3,
      kecepatan_km_jam: 20,
      hsd_alat_per_jam: 80_000,
      hsd_dasar_per_item: 100_000,
    });
    expect(bigger.biaya_angkut_per_item).toBeLessThan(base.biaya_angkut_per_item);
  });

  // ── Real data from SE Bina Konstruksi No. 68/2024 Sheet Lansekap ──────────
  // All three items use L=100km, V1=40km/jam, HSD_TK=25,000/jam

  it('4.1.1.1 Pohon Kecil Polybag 25L → ~80,642 Rp/buah', () => {
    // V=100 polybag, Qz=2 polybag/menit, HSD_DT=365,412.21/jam, nursery=65,000/buah
    // T_muat = 100×2/2 = 100 menit
    // T_jalan = 100/40×60 = 150 menit  →  Ts = 250 menit
    // biaya_DT = 365,412.21 × 250/60 = 1,522,550.875
    // biaya_TK = 25,000 × 100/60 = 41,666.67
    // biaya/polybag = (1,522,550.875 + 41,666.67) / 100 = 15,642.18
    // HSD = 65,000 + 15,642.18 = 80,642.18
    const result = hitungHsdTransportSatuan({
      kapasitas_angkut: 100,
      kapasitas_angkat_per_menit: 2,
      jarak_km: 100,
      kecepatan_km_jam: 40,
      hsd_alat_per_jam: 365_412.21,
      hsd_tk_per_jam: 25_000,
      hsd_dasar_per_item: 65_000,
    });

    expect(result.ts_menit).toBeCloseTo(250, 4);
    expect(result.hsd_per_item).toBeCloseTo(80_642.18, 1);
  });

  it('4.1.1.2 Pohon Sedang Polybag 50L → ~1,528,992 Rp/buah', () => {
    // V=200, Qz=1, HSD_DT=614,377.5/jam, nursery=1,500,000/buah
    // T_muat = 200×2/1 = 400 menit, T_jalan = 150  →  Ts = 550 menit
    // biaya_DT = 614,377.5 × 550/60 = 5,631,793.75
    // biaya_TK = 25,000 × 400/60 = 166,666.67
    // biaya/polybag = 5,798,460.42 / 200 = 28,992.30
    // HSD = 1,500,000 + 28,992.30 = 1,528,992.30
    const result = hitungHsdTransportSatuan({
      kapasitas_angkut: 200,
      kapasitas_angkat_per_menit: 1,
      jarak_km: 100,
      kecepatan_km_jam: 40,
      hsd_alat_per_jam: 614_377.5,
      hsd_tk_per_jam: 25_000,
      hsd_dasar_per_item: 1_500_000,
    });

    expect(result.ts_menit).toBeCloseTo(550, 4);
    expect(result.hsd_per_item).toBeCloseTo(1_528_992.3, 1);
  });

  it('4.1.1.3 Pohon Besar Polybag 100L → ~13,017,601 Rp/buah', () => {
    // V=5, Qz=0.03, HSD_DT=614,377.5/jam, nursery=12,000,000/buah
    // T_muat = 5×2/0.03 = 333.33 menit, T_jalan = 150  →  Ts = 483.33 menit
    // biaya_DT = 614,377.5 × 483.33/60 = 4,949,117.95
    // biaya_TK = 25,000 × 333.33/60 = 138,887.5
    // biaya/polybag = 5,088,005.45 / 5 = 1,017,601.09
    // HSD = 12,000,000 + 1,017,601.09 = 13,017,601.09
    const result = hitungHsdTransportSatuan({
      kapasitas_angkut: 5,
      kapasitas_angkat_per_menit: 0.03,
      jarak_km: 100,
      kecepatan_km_jam: 40,
      hsd_alat_per_jam: 614_377.5,
      hsd_tk_per_jam: 25_000,
      hsd_dasar_per_item: 12_000_000,
    });

    // Excel rounds T_muat to 333.33 in cells; exact arithmetic gives ~13,017,608.
    // Verify within 10 Rp of the rounded display value (0.0001% tolerance).
    expect(Math.abs(result.hsd_per_item - 13_017_601)).toBeLessThan(10);
  });
});
