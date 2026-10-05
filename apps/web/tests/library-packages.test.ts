import { describe, expect, it } from 'vitest';
import {
  buildEngineAndHsdLibraryPackages,
  buildHsdLibraryPackages,
  ENGINE_AND_CLI_PACKAGES,
} from '../src/lib/library-packages.js';

describe('library package catalog', () => {
  it('lists engine, cli, and regional HSD packages including Jakarta', () => {
    const hsd = buildHsdLibraryPackages();
    const all = buildEngineAndHsdLibraryPackages();

    expect(ENGINE_AND_CLI_PACKAGES).toHaveLength(2);
    expect(hsd).toHaveLength(5);
    expect(all).toHaveLength(9);
    expect(all.some((pkg) => pkg.kind === 'ahsp' && pkg.id === 'ahsp-dcktrp-by-source')).toBe(true);
    expect(all.some((pkg) => pkg.kind === 'hsp' && pkg.id === 'hsp-jakarta-dcktrp')).toBe(true);
    expect(hsd.every((pkg) => pkg.verificationTier && pkg.verificationLabel && pkg.legalBasis)).toBe(true);
    expect(hsd.find((pkg) => pkg.id === 'hsd-bm-2022')?.verificationTier).toBe('spot-checked');
    expect(hsd.find((pkg) => pkg.id === 'hsd-jakarta-2026')?.npmName).toBe('@ahs-id/hsd-jakarta-2026');
    expect(hsd.filter((pkg) => pkg.verificationTier === 'auto-extracted')).toHaveLength(4);
  });
});
