import { describe, it, expect } from 'vitest';
import { meta, ahspItems } from '../index.js';

describe('@ahs-id/bina-marga-2022 bundle structure', () => {
  it('exports valid meta', () => {
    expect(meta.name).toBe('@ahs-id/bina-marga-2022');
    expect(meta.ahs_meta.permen_nomor).toBe(1);
    expect(meta.ahs_meta.permen_tahun).toBe(2022);
    expect(meta.ahs_meta.bidang).toContain('bina-marga');
  });

  it('exports 422 AHSP items (D2-D10)', () => {
    expect(ahspItems).toHaveLength(422);
  });

  it('all items have required fields', () => {
    for (const item of ahspItems) {
      expect(item.kode_ahsp, `kode missing for ${item.nama}`).toBeTruthy();
      expect(item.nama, `nama missing for ${item.kode_ahsp}`).toBeTruthy();
      expect(item.divisi, `divisi missing for ${item.kode_ahsp}`).toBeGreaterThan(0);
      expect(item.satuan_bayar, `satuan_bayar missing for ${item.kode_ahsp}`).toBeTruthy();
      expect(item.bidang).toBe('bina-marga');
      expect(item.jenis_pekerjaan).toMatch(/^(mekanis|manual|semi-mekanis)$/);
    }
  });

  it('divisi counts match expected extraction', () => {
    const counts: Record<number, number> = {};
    for (const item of ahspItems) {
      counts[item.divisi] = (counts[item.divisi] ?? 0) + 1;
    }
    expect(counts[2]).toBe(41);   // D2 Drainase
    expect(counts[3]).toBe(23);   // D3 Pekerjaan Tanah
    expect(counts[4]).toBe(38);   // D4 Preventif
    expect(counts[5]).toBe(17);   // D5 Perkerasan Berbutir
    expect(counts[6]).toBe(35);   // D6 Perkerasan Aspal
    expect(counts[7]).toBe(113);  // D7 Struktur
    expect(counts[8]).toBe(72);   // D8 Rehabilitasi Jembatan
    expect(counts[9]).toBe(61);   // D9 Pekerjaan Harian + Marka
    expect(counts[10]).toBe(22);  // D10 Pemeliharaan Rutin
  });

  it('all peralatan koef_referensi values are positive', () => {
    for (const item of ahspItems) {
      for (const e of item.peralatan) {
        if (e.koef_referensi !== null) {
          expect(
            e.koef_referensi.value,
            `${item.kode_ahsp} alat ${e.ref} koef should be > 0`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all tenaga_kerja koefisien are positive OH values', () => {
    for (const item of ahspItems) {
      for (const tk of item.tenaga_kerja) {
        expect(
          tk.koefisien,
          `${item.kode_ahsp} TK ${tk.ref} should be > 0`
        ).toBeGreaterThan(0);
        // OH koefisien should be < 50 for any realistic construction item
        // (labor-intensive items like bridge scaffolding can reach ~10 OH/m3)
        expect(
          tk.koefisien,
          `${item.kode_ahsp} TK ${tk.ref} koef_OH unreasonably large (>50)`
        ).toBeLessThan(50);
      }
    }
  });

  it('all items have koef_sumber set', () => {
    for (const item of ahspItems) {
      for (const e of item.peralatan) {
        expect(e.koef_sumber).toMatch(/^(tabel|kalkulasi)$/);
      }
      for (const tk of item.tenaga_kerja) {
        expect(tk.koef_sumber).toMatch(/^(tabel|kalkulasi)$/);
      }
    }
  });

  describe('coefficient spot-check against D-sheet values', () => {
    it('3.1.(1) Galian Biasa — Excavator + DT koefisien', () => {
      const item = ahspItems.find(i => i.kode_ahsp === '3.1.(1)');
      expect(item).toBeDefined();

      const e09 = item!.peralatan.find(e => e.ref === 'E09');
      const e10 = item!.peralatan.find(e => e.ref === 'E10');
      expect(e09?.koef_referensi?.value).toBeCloseTo(0.042364825, 6);
      expect(e10?.koef_referensi?.value).toBeCloseTo(0.010076147, 6);

      const l01 = item!.tenaga_kerja.find(t => t.ref === 'L01');
      const l03 = item!.tenaga_kerja.find(t => t.ref === 'L03');
      // Original Jam koef = 0.020152 / 7 jam = 0.002879
      expect(l01?.koefisien).toBeCloseTo(0.002879, 4);
      // Original Jam koef = 0.010076 / 7 jam = 0.001439
      expect(l03?.koefisien).toBeCloseTo(0.001439, 4);
    });

    it('3.2.(1a) Lapis Pondasi Agregat A — memiliki peralatan dan bahan', () => {
      const item = ahspItems.find(i => i.kode_ahsp === '3.2.(1a)');
      expect(item).toBeDefined();
      expect(item!.peralatan.length).toBeGreaterThan(0);
      expect(item!.tenaga_kerja.length).toBeGreaterThan(0);
      // Should have bahan (aggregat)
      expect(item!.bahan.length).toBeGreaterThan(0);
    });

    it('8.1.(1) Cairan perekat epoxy — L01, L03, M125 terekstrak dari D8', () => {
      const item = ahspItems.find(i => i.kode_ahsp === '8.1.(1)');
      expect(item).toBeDefined();

      // D8 uses code without parens (L01 not (L01)) — verify extraction worked
      const l01 = item!.tenaga_kerja.find(t => t.ref === 'L01');
      const l03 = item!.tenaga_kerja.find(t => t.ref === 'L03');
      expect(l01).toBeDefined();
      expect(l03).toBeDefined();

      // M125 = epoxy resin koef = 1.02 (= 1 × Fh 1.02)
      const m125 = item!.bahan.find(b => b.ref === 'M125');
      expect(m125?.koefisien).toBeCloseTo(1.02, 3);
    });

    it('provenance references correct sheet for D2/D3/D8 items', () => {
      const d2Item = ahspItems.find(i => i.divisi === 2);
      expect(d2Item?.provenance.halaman).toBe('D2');

      const d3Item = ahspItems.find(i => i.divisi === 3);
      expect(d3Item?.provenance.halaman).toBe('D3');

      const d8Item = ahspItems.find(i => i.kode_ahsp === '8.1.(1)');
      expect(d8Item?.provenance.halaman).toBe('D8');
    });
  });
});
