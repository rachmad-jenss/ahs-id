import { describe, it, expect } from 'vitest';
import { resolveStaticKoefisien, resolveDynamicKoefisien } from '../koefisien.js';

describe('resolveStaticKoefisien', () => {
  it('returns the value unchanged', () => {
    const result = resolveStaticKoefisien('L.01', 0.065);
    expect(result.koefisien).toBe(0.065);
    expect(result.sumber).toBe('tabel');
  });
});

describe('resolveDynamicKoefisien', () => {
  it('computes 1/productivity', () => {
    const result = resolveDynamicKoefisien('E.08', 4.09, 'm3/jam');
    expect(result.koefisien).toBeCloseTo(1 / 4.09, 6);
    expect(result.sumber).toBe('kalkulasi');
  });

  it('throws on zero productivity', () => {
    expect(() => resolveDynamicKoefisien('E.01', 0, 'm3/jam')).toThrow('must be positive');
  });

  it('throws on negative productivity', () => {
    expect(() => resolveDynamicKoefisien('E.01', -10, 'm3/jam')).toThrow('must be positive');
  });
});
