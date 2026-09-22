import { describe, it, expect } from 'vitest';
import { parseKeyValue, formatIdr, resolveHsdName } from './loader.js';

describe('parseKeyValue', () => {
  it('parses numeric value', () => {
    expect(parseKeyValue('jarak_quarry_km=25')).toEqual({ jarak_quarry_km: 25 });
  });

  it('parses string value', () => {
    expect(parseKeyValue('kondisi_jalan=sedang')).toEqual({ kondisi_jalan: 'sedang' });
  });

  it('throws on invalid format', () => {
    expect(() => parseKeyValue('noequalsign')).toThrow('Invalid key=value pair');
    expect(() => parseKeyValue('faktor_efisiensi=')).toThrow('Invalid key=value pair');
  });
});

describe('resolveHsdName', () => {
  it('defaults pupr-2023 to Kalimantan Timur', () => {
    expect(resolveHsdName('pupr-2023', undefined)).toBe('hsd-kaltim-2025');
  });

  it('defaults bina-marga-2022 to the Permen HSD bundle', () => {
    expect(resolveHsdName('bina-marga-2022', undefined)).toBe('hsd-bm-2022');
  });

  it('honors an explicit HSD name', () => {
    expect(resolveHsdName('pupr-2023', 'hsd-jabar-2025')).toBe('hsd-jabar-2025');
  });

  it('rejects an unknown HSD name', () => {
    expect(() => resolveHsdName('pupr-2023', 'hsd-unknown')).toThrow('Unknown HSD');
  });

  it('rejects an unknown bundle', () => {
    expect(() => resolveHsdName('not-a-bundle', undefined)).toThrow('Unknown bundle');
  });

  it('defaults bina-marga-2016 to Kalimantan Timur', () => {
    expect(resolveHsdName('bina-marga-2016', undefined)).toBe('hsd-kaltim-2025');
  });

  it('rejects an HSD that belongs to another bundle', () => {
    expect(() => resolveHsdName('pupr-2023', 'hsd-bm-2022')).toThrow('not compatible');
  });

  it('rejects HSD selection for Cipta Karya', () => {
    expect(() => resolveHsdName('cipta-karya-2024', undefined)).toThrow('does not use an HSD');
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
