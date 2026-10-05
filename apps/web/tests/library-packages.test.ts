import { describe, expect, it } from 'vitest';
import {
  buildEngineAndHsdLibraryPackages,
  buildHsdLibraryPackages,
  ENGINE_AND_CLI_PACKAGES,
} from '../src/lib/library-packages.js';

describe('library package catalog', () => {
  it('lists engine, cli, and four regional HSD packages', () => {
    const hsd = buildHsdLibraryPackages();
    const all = buildEngineAndHsdLibraryPackages();

    expect(ENGINE_AND_CLI_PACKAGES).toHaveLength(2);
    expect(hsd).toHaveLength(4);
    expect(all).toHaveLength(6);
    expect(hsd.every((pkg) => pkg.verificationTier && pkg.verificationLabel && pkg.legalBasis)).toBe(true);
    expect(hsd.find((pkg) => pkg.id === 'hsd-bm-2022')?.verificationTier).toBe('spot-checked');
    expect(hsd.filter((pkg) => pkg.verificationTier === 'auto-extracted')).toHaveLength(3);
  });
});
