/**
 * Regenerate expected/*.json from fixtures/*.json via the TS engine.
 * Run: $env:GEN_GOLDEN='1'; pnpm test gen-expected
 */
import { describe, it } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCalculator, type HsdRegional } from '@ahs-id/core';
import { bundle as puprBundle } from '@ahs-id/pupr-2023';
import { hsd as hsdKaltim } from '@ahs-id/hsd-kaltim-2025';
import { hsd as hsdJabar } from '@ahs-id/hsd-jabar-2025';
import { hsd as hsdPapua } from '@ahs-id/hsd-papua-2025';

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

function toExpected(result: ReturnType<ReturnType<typeof createCalculator>['hitungHSP']>): ExpectedFile {
  return {
    kode_ahsp: result.kode_ahsp,
    baseTotal: result.baseTotal,
    grandTotal: result.grandTotal,
    overheadPct: result.overheadPct,
    profitPct: result.profitPct,
    groups: result.groups.map((g) => ({ type: g.type, total: g.total })),
  };
}

describe.skipIf(process.env.GEN_GOLDEN !== '1')('generate golden expected', () => {
  it('writes expected/*.json from fixtures', () => {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
    if (files.length === 0) {
      throw new Error(`No fixture JSON files found in: ${FIXTURES_DIR}`);
    }
    for (const file of files) {
      const fixture = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as FixtureFile;
      if (fixture.bundle !== 'pupr-2023') {
        throw new Error(`Unsupported bundle: ${fixture.bundle}`);
      }
      const hsd = HSD_BY_REGION[fixture.hsd_region];
      if (!hsd) {
        throw new Error(`Unknown hsd_region: ${fixture.hsd_region}`);
      }
      const calc = createCalculator(puprBundle, hsd);
      const result = calc.hitungHSP(fixture.kode_ahsp, fixture.variabel);
      writeFileSync(join(EXPECTED_DIR, file), `${JSON.stringify(toExpected(result), null, 2)}\n`, 'utf8');
    }
  });
});
