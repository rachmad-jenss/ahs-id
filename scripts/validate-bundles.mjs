/**
 * Cross-bundle validation script.
 *
 * Loads each regulation bundle + matching HSD and runs validateBundle.
 * Some bundles are skipped (bina-marga-2016 needs data normalisation,
 * cipta-karya-2024 uses fixed-coefficient engine).
 *
 * Usage: node scripts/validate-bundles.mjs [--json]
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const coreDist = resolve(root, 'packages', 'core', 'dist');

let validateBundle;
try {
  ({ validateBundle } = await import(resolve(coreDist, 'index.js')));
} catch {
  console.error('FATAL: @ahs-id/core not built. Run `pnpm build` first.');
  process.exit(1);
}

// Bundle → HSD pairing
const PAIRS = [
  {
    bundleLabel: 'pupr-2023',
    bundleLoad: () => import(resolve(root, 'packages', 'pupr-2023', 'dist', 'index.js')),
    getBundle: (m) => m.bundle,
    hsdLabels: ['hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025'],
    hsdLoad: (label) => import(resolve(root, 'packages', label, 'dist', 'index.js')),
    getHsd: (m) => m.hsd,
  },
  {
    bundleLabel: 'bina-marga-2022',
    bundleLoad: () => import(resolve(root, 'packages', 'bina-marga-2022', 'dist', 'index.js')),
    getBundle: (m) => m.bundle,
    hsdLabels: ['hsd-bm-2022'],
    hsdLoad: () => import(resolve(root, 'packages', 'hsd-bm-2022', 'dist', 'index.js')),
    getHsd: (m) => m.hsd,
  },
];

// Skipped bundles (documented)
const SKIPPED = [
  { label: 'bina-marga-2016', note: 'syntax-only — needs data normalisation for full schema/validation' },
  { label: 'cipta-karya-2024', note: 'fixed-coefficient engine — no DataBundle assembly yet' },
];

function fmt(d) {
  if (d.valid) return '\x1b[32m✓ VALID\x1b[0m';
  return `\x1b[31m✗ INVALID (${d.errors.length} errors, ${d.warnings.length} warnings)\x1b[0m`;
}

const useJson = process.argv.includes('--json');
const results = [];

console.log('\n── Cross-bundle validation ──\n');

for (const pair of PAIRS) {
  let bMod;
  try {
    bMod = await pair.bundleLoad();
  } catch (e) {
    console.log(`  [FAIL] ${pair.bundleLabel} — load error: ${e.message}\n`);
    results.push({ bundle: pair.bundleLabel, status: 'fail', error: e.message });
    continue;
  }

  const bundle = pair.getBundle(bMod);
  if (!bundle) {
    console.log(`  [FAIL] ${pair.bundleLabel} — bundle export not found\n`);
    continue;
  }

  for (const hsdLabel of pair.hsdLabels) {
    let hMod;
    try {
      hMod = await pair.hsdLoad(hsdLabel);
    } catch (e) {
      console.log(`  [FAIL] ${pair.bundleLabel} × ${hsdLabel} — HSD load error: ${e.message}\n`);
      results.push({ bundle: pair.bundleLabel, hsd: hsdLabel, status: 'fail', error: e.message });
      continue;
    }

    const hsd = pair.getHsd(hMod);
    const report = validateBundle(bundle, hsd);
    console.log(`  ${fmt(report)}  ${pair.bundleLabel} × ${hsdLabel}`);
    if (report.warnings.length > 0) {
      for (const w of report.warnings) {
        console.log(`         ⚠ [${w.code}] ${w.path}: ${w.message}`);
      }
    }
    if (!report.valid) {
      for (const e of report.errors) {
        console.log(`         ✗ [${e.code}] ${e.path}: ${e.message}`);
      }
    }
    results.push({ bundle: pair.bundleLabel, hsd: hsdLabel, valid: report.valid, errors: report.errors.length, warnings: report.warnings.length });
  }
  console.log('');
}

for (const s of SKIPPED) {
  console.log(`  [SKIP] ${s.label} — ${s.note}\n`);
  results.push({ bundle: s.label, status: 'skip', note: s.note });
}

const failed = results.filter(r => r.status === 'fail');
const invalid = results.filter(r => r.valid === false);
const skipped = results.filter(r => r.status === 'skip');

if (useJson) {
  console.log(JSON.stringify({ results, summary: { total: results.length, failed: failed.length, invalid: invalid.length, skipped: skipped.length } }, null, 2));
} else {
  const total = results.length;
  console.log(`── Summary ──`);
  console.log(`  Total:   ${total}`);
  if (skipped.length) console.log(`  Skipped: ${skipped.length}`);
  if (failed.length) console.log(`  Failed:  ${failed.length}`);
  if (invalid.length) console.log(`  \x1b[31mInvalid: ${invalid.length}\x1b[0m`);
  else if (!failed.length) console.log(`  \x1b[32mAll valid! ✓\x1b[0m`);
  console.log('');
}

if (invalid.length > 0 || failed.length > 0) process.exit(1);
