import { describe, it, expect } from 'vitest';
import { convertVolume } from '../konversi-volume.js';
import type { FaktorKonversiEntry } from '../../types/index.js';

const agregatKelasA: FaktorKonversiEntry = {
  material: 'agregat_kelas_a',
  bank_to_loose: 1.20,
  bank_to_compacted: 0.95,
  berat_jenis_bank_ton_m3: 2.10,
};

const batuPecah: FaktorKonversiEntry = {
  material: 'batu_pecah',
  bank_to_loose: 1.40,
  bank_to_compacted: null,
  berat_jenis_bank_ton_m3: 2.60,
};

describe('convertVolume', () => {
  it('returns factor 1.0 for same state', () => {
    const result = convertVolume(100, agregatKelasA, 'bank', 'bank');
    expect(result.converted).toBe(100);
    expect(result.factor).toBe(1.0);
  });

  it('converts bank to loose', () => {
    const result = convertVolume(100, agregatKelasA, 'bank', 'loose');
    expect(result.converted).toBeCloseTo(120, 2);
    expect(result.factor).toBe(1.20);
  });

  it('converts bank to compacted', () => {
    const result = convertVolume(100, agregatKelasA, 'bank', 'compacted');
    expect(result.converted).toBeCloseTo(95, 2);
    expect(result.factor).toBe(0.95);
  });

  it('derives loose to compacted = bank_to_compacted / bank_to_loose', () => {
    const result = convertVolume(100, agregatKelasA, 'loose', 'compacted');
    const expectedFactor = 0.95 / 1.20;
    expect(result.factor).toBeCloseTo(expectedFactor, 10);
    expect(result.converted).toBeCloseTo(100 * expectedFactor, 6);
  });

  it('converts compacted to bank (inverse)', () => {
    const result = convertVolume(95, agregatKelasA, 'compacted', 'bank');
    expect(result.converted).toBeCloseTo(100, 2);
  });

  it('converts loose to bank (inverse)', () => {
    const result = convertVolume(120, agregatKelasA, 'loose', 'bank');
    expect(result.converted).toBeCloseTo(100, 2);
  });

  it('throws for material with null compacted when targeting compacted', () => {
    expect(() => convertVolume(100, batuPecah, 'bank', 'compacted')).toThrow(
      'compacted state not applicable',
    );
  });

  it('throws for material with null compacted when converting from compacted', () => {
    expect(() => convertVolume(100, batuPecah, 'compacted', 'bank')).toThrow(
      'compacted state not applicable',
    );
  });
});
