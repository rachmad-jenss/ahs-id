import { describe, expect, it } from 'vitest';
import { idr, percentage, percentagePoints, volume } from '../domain.js';

describe('branded unit constructors', () => {
  it('keeps JSON serialization as plain numbers', () => {
    expect(JSON.parse(JSON.stringify({ harga: idr(135_000), volume: volume(1.25) }))).toEqual({
      harga: 135_000,
      volume: 1.25,
    });
  });

  it('rejects non-finite money', () => {
    expect(() => idr(Number.NaN)).toThrow(/finite/);
    expect(() => idr(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('keeps Percentage as a 0..1 fraction and PercentagePoints as 0..100', () => {
    expect(percentage(0.1)).toBe(0.1);
    expect(percentagePoints(10)).toBe(10);
    expect(() => percentage(10)).toThrow(/fraction from 0 to 1/);
    expect(() => percentagePoints(101)).toThrow(/0 to 100/);
    expect(() => percentagePoints(Number.NaN)).toThrow(/finite/);
  });

  it('rejects a negative volume', () => {
    expect(volume(0)).toBe(0);
    expect(() => volume(-0.01)).toThrow(/Volume must be >= 0/);
  });
});
