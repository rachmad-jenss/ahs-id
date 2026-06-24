import { describe, it, expect } from 'vitest';
import { parseKeyValue, formatIdr } from './loader.js';

describe('parseKeyValue', () => {
  it('parses numeric value', () => {
    expect(parseKeyValue('jarak_quarry_km=25')).toEqual({ jarak_quarry_km: 25 });
  });

  it('parses string value', () => {
    expect(parseKeyValue('kondisi_jalan=sedang')).toEqual({ kondisi_jalan: 'sedang' });
  });

  it('throws on invalid format', () => {
    expect(() => parseKeyValue('noequalsign')).toThrow('Invalid key=value pair');
  });
});

describe('formatIdr', () => {
  it('formats number with ID locale', () => {
    expect(formatIdr(740113)).toBe('740.113');
  });

  it('formats zero', () => {
    expect(formatIdr(0)).toBe('0');
  });

  it('rounds decimals', () => {
    expect(formatIdr(123456.789)).toBe('123.457');
  });
});
