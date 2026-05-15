import { describe, it, expect } from 'vitest';
import { hitungMargin } from '../margin.js';

describe('hitungMargin', () => {
  it('applies split overhead + profit correctly', () => {
    const result = hitungMargin(1000000, { overhead_pct: 10, profit_pct: 5 }, false);

    expect(result.overhead_value).toBeCloseTo(100000, 0);
    expect(result.profit_value).toBeCloseTo(50000, 0);
    expect(result.overhead_profit_total).toBeCloseTo(150000, 0);
    expect(result.grand_total).toBeCloseTo(1150000, 0);
  });

  it('skips indirect cost for lump sum items', () => {
    const result = hitungMargin(1000000, { overhead_pct: 10, profit_pct: 5 }, true);

    expect(result.overhead_value).toBe(0);
    expect(result.profit_value).toBe(0);
    expect(result.grand_total).toBe(1000000);
  });

  it('throws when sum < 10%', () => {
    expect(() => hitungMargin(1000000, { overhead_pct: 5, profit_pct: 3 }, false)).toThrow(
      '10-15%',
    );
  });

  it('throws when sum > 15%', () => {
    expect(() => hitungMargin(1000000, { overhead_pct: 10, profit_pct: 8 }, false)).toThrow(
      '10-15%',
    );
  });

  it('accepts edge case sum = 10%', () => {
    const result = hitungMargin(1000000, { overhead_pct: 7, profit_pct: 3 }, false);
    expect(result.grand_total).toBeCloseTo(1100000, 0);
  });

  it('accepts edge case sum = 15%', () => {
    const result = hitungMargin(1000000, { overhead_pct: 10, profit_pct: 5 }, false);
    expect(result.grand_total).toBeCloseTo(1150000, 0);
  });
});
