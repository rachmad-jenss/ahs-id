import { describe, expect, it } from 'vitest';
import {
  buildCatalog,
  catalogItemKey,
  getPublicCatalogItems,
  QUARANTINED_CIPTA_KEYS,
} from '../src/lib/catalog.js';

describe('public catalog adapter', () => {
  it('keeps a complete source count and excludes the seven approved quarantines', () => {
    const catalog = buildCatalog();

    expect(catalog.sourceItemCount).toBe(5_881);
    expect(catalog.quarantinedItemCount).toBe(7);
    expect(catalog.items).toHaveLength(5_874);
    expect(QUARANTINED_CIPTA_KEYS).toHaveLength(7);
    expect(new Set(QUARANTINED_CIPTA_KEYS).size).toBe(7);
  });

  it('gives every public item a stable bundle and code key', () => {
    const items = getPublicCatalogItems();
    const keys = items.map((item) => catalogItemKey(item));

    expect(new Set(keys).size).toBe(items.length);
    expect(keys).toContain('pupr-2023:3.1.1');
    expect(keys).toContain('bina-marga-2022:2.1.(1)');
    expect(keys).toContain('cipta-karya-2024:1.2.1.1.1');
    expect(keys).toContain('sda-se-binkon-47-2026:A.1.01.a');
    expect(keys).toContain('bina-marga-se-binkon-47-2026:10.1.(1)');
  });

  it('preserves provenance and verification status for published items', () => {
    const item = getPublicCatalogItems().find(
      (candidate) => catalogItemKey(candidate) === 'pupr-2023:3.1.1',
    );

    expect(item?.provenance.sumber_regulasi).toContain('Permen PUPR');
    expect(item?.provenance.halaman).toBeTruthy();
    expect(item?.provenance.verification_tier).toBe('auto-extracted');
  });

  it('normalizes every displayed component coefficient to a finite number or explicit dynamic value', () => {
    const catalog = buildCatalog();

    for (const item of catalog.items) {
      for (const component of item.components) {
        if (component.coefficient !== null && !Number.isFinite(component.coefficient)) {
          throw new Error(`${item.bundleId}:${item.code} ${component.kind}:${component.name} coefficient=${String(component.coefficient)}`);
        }
      }
    }
  });
});
