import { describe, expect, it } from 'vitest';
import { catalogItemSlug, type CatalogItem } from '../src/lib/catalog.js';
import {
  filterCatalogItems,
  paginateCatalogItems,
  parseCatalogSearchParams,
  toSearchIndex,
} from '../src/lib/search.js';

const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
  bundleId: 'pupr-2023',
  bundleName: 'Permen PUPR 8/2023',
  bundleVersion: '1.0.0',
  regulation: 'Permen PUPR No. 8 Tahun 2023',
  occurrence: 0,
  code: '3.1.1',
  name: 'Galian Biasa',
  bidang: 'bina-marga',
  divisi: 3,
  subDivision: '3.1',
  unit: 'm3',
  calculationType: 'dynamic_hsd',
  workType: 'mekanis',
  isLumpSum: false,
  components: [],
  variables: {},
  subAhsp: [],
  margin: {} as CatalogItem['margin'],
  provenance: {} as CatalogItem['provenance'],
  notes: [],
  referencePrice: null,
  ...overrides,
});

describe('catalog search model', () => {
  it('filters exact code and name while retaining bundle metadata', () => {
    const entries = [
      item({ code: '3.1.1', name: 'Galian Biasa' }),
      item({ code: '3.2.1', name: 'Lapis Pondasi Agregat Kelas A' }),
    ];

    const result = filterCatalogItems(entries, { q: 'pondasi' });

    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe('3.2.1');
    expect(toSearchIndex(result)[0]?.href).toBe(`/item/pupr-2023/${catalogItemSlug('3.2.1')}/`);
  });

  it('encodes punctuation that would make a filesystem route unsafe', () => {
    const result = toSearchIndex([item({ code: '3.1.(10).' })]);

    expect(result[0]?.href).toBe(`/item/pupr-2023/${catalogItemSlug('3.1.(10).')}/`);
  });

  it('applies bundle and unit filters and paginates deterministically', () => {
    const entries = [
      item({ code: 'a', unit: 'm3' }),
      item({ code: 'b', unit: 'm3', bundleId: 'bina-marga-2022' }),
      item({ code: 'c', unit: 'ton' }),
    ];

    const filtered = filterCatalogItems(entries, {
      bundle: 'bina-marga-2022',
      unit: 'm3',
    });

    expect(filtered.map((entry) => entry.code)).toEqual(['b']);
    expect(paginateCatalogItems(entries, 2, 1).items.map((entry) => entry.code)).toEqual(['b']);
  });

  it('normalizes invalid URL page values to page one', () => {
    const params = parseCatalogSearchParams(new URLSearchParams('q=galian&page=-4'));

    expect(params).toEqual({ q: 'galian', page: 1 });
  });
});
