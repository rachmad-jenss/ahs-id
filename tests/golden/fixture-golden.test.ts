import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCalculator, type HsdRegional } from '@ahs-id/core';
import { bundle as puprBundle } from '@ahs-id/pupr-2023';
import { hsd as hsdKaltim } from '@ahs-id/hsd-kaltim-2025';
import { hsd as hsdJabar } from '@ahs-id/hsd-jabar-2025';
import { hsd as hsdPapua } from '@ahs-id/hsd-papua-2025';

const EPSILON_RP = 0.01;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');
const EXPECTED_DIR = join(__dirname, 'expected');

interface FixtureFile {
  kode_ahsp: string;
  bundle: string;
  hsd_region: string;
  variabel: Record<string, unknown>;
}

interface ExpectedFile {
  kode_ahsp: string;
  baseTotal: number;
  grandTotal: number;
  overheadPct: number;
  profitPct: number;
  groups: Array<{ type: 'L' | 'M' | 'E'; total: number }>;
}

const HSD_BY_REGION: Record<string, HsdRegional> = {
  'hsd-kaltim-2025': hsdKaltim,
  'hsd-jabar-2025': hsdJabar,
  'hsd-papua-2025': hsdPapua,
};

function assertWithinEpsilon(actual: number, expected: number, label: string): void {
  const delta = Math.abs(actual - expected);
  expect(delta, `${label}: |${actual} - ${expected}| = ${delta} > ${EPSILON_RP}`).toBeLessThanOrEqual(
    EPSILON_RP,
  );
}

function loadFixturePair(basename: string): { fixture: FixtureFile; expected: ExpectedFile } {
  const fixturePath = join(FIXTURES_DIR, basename);
  const expectedPath = join(EXPECTED_DIR, basename);
  if (!existsSync(expectedPath)) {
    throw new Error(`Missing expected file for fixture ${basename}`);
  }
  return {
    fixture: JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureFile,
    expected: JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedFile,
  };
}

describe('fixture golden tests (file-based numeric lock)', () => {
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  it('has at least three PUPR fixtures', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of fixtureFiles) {
    it(file, () => {
      const { fixture, expected } = loadFixturePair(file);

      expect(fixture.bundle).toBe('pupr-2023');
      const hsd = HSD_BY_REGION[fixture.hsd_region];
      expect(hsd, `unknown hsd_region: ${fixture.hsd_region}`).toBeDefined();

      const calc = createCalculator(puprBundle, hsd!);
      const result = calc.hitungHSP(fixture.kode_ahsp, fixture.variabel);

      expect(result.kode_ahsp).toBe(expected.kode_ahsp);
      assertWithinEpsilon(result.baseTotal, expected.baseTotal, 'baseTotal');
      assertWithinEpsilon(result.grandTotal, expected.grandTotal, 'grandTotal');
      expect(result.overheadPct).toBe(expected.overheadPct);
      expect(result.profitPct).toBe(expected.profitPct);

      expect(result.groups).toHaveLength(expected.groups.length);
      for (let i = 0; i < expected.groups.length; i++) {
        const eg = expected.groups[i]!;
        const rg = result.groups[i]!;
        expect(rg.type).toBe(eg.type);
        assertWithinEpsilon(rg.total, eg.total, `groups[${i}].total (${eg.type})`);
      }
    });
  }
});
