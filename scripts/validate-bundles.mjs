/**
 * Cross-bundle validation script.
 *
 * Loads each regulation bundle, pairs it with each regional HSD,
 * and runs validateBundle (ref integrity, range checks, provenance).
 *
 * Usage:
 *   node scripts/validate-bundles.mjs
 *   node scripts/validate-bundles.mjs --json
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const coreDist = resolve(root, 'packages', 'core', 'dist');

// ── Load validateBundle from compiled core ────────────────────────────
let validateBundle;
try {
  ({ validateBundle } = await import(resolve(coreDist, 'index.js')));
} catch {
  console.error('FATAL: @ahs-id/core not built. Run `pnpm build` first.');
  process.exit(1);
}

// ── Bundle registry ────────────────────────────────────────────────────
//
// Each entry = { label, load: () => Promise<{ bundle, hsd? }> }
//
// `bundle` is a full DataBundle (master data + ahsp_items).
// `hsd` is optional — bundles that carry their own HSD can provide it;
//      otherwise the cross-product with every regional HSD is tested.
//
const BUNDLES = [
  {
    label: 'pupr-2023',
    load: () => import(resolve(root, 'packages', 'pupr-2023', 'dist', 'index.js')),
    getBundle: (m) => m.bundle,
  },
  {
    label: 'bina-marga-2016',
    skip: true,
    note: 'syntax-only — needs data normalisation for full schema/validation',
  },
  {
    label: 'bina-marga-2022',
    skip: true,
    note: 'separate calc path — DataBundle assembly not yet available',
  },
  {
    label: 'cipta-karya-2024',
    skip: true,
    note: 'fixed-coefficient engine — no DataBundle assembly yet',
  },
];

const HSDS = [
  { label: 'hsd-kaltim-2025', load: () => import(resolve(root, 'packages', 'hsd-kaltim-2025', 'dist', 'index.js')), getHsd: (m) => m.hsd },
  { label: 'hsd-jabar-2025', load: () => import(resolve(root, 'packages', 'hsd-jabar-2025', 'dist', 'index.js')), getHsd: (m) => m.hsd },
  { label: 'hsd-papua-2025', load: () => import(resolve(root, 'packages', 'hsd-papua-2025', 'dist', 'index.js')), getHsd: (m) => m.hsd },
];

// ── Printer ────────────────────────────────────────────────────────────
function fmt(d) {
  if (d.valid) return '\x1b[32m✓ VALID\x1b[0m';
  return `\x1b[31m✗ INVALID (${d.errors.length} errors, ${d.warnings.length} warnings)\x1b[0m`;
}

// ── Main ───────────────────────────────────────────────────────────────
const useJson = process.argv.includes('--json');
const results = [];

console.log('\n── Cross-bundle validation ──\n');

for (const bDef of BUNDLES) {
  if (bDef.skip || !bDef.load) {
    console.log(`  [SKIP] ${bDef.label} — ${bDef.note || 'not configured'}\n`);
    if (useJson) results.push({ bundle: bDef.label, status: 'skip', note: bDef.note });
    continue;
  }

  let bMod;
  try {
    bMod = await bDef.load();
  } catch (e) {
    console.log(`  [FAIL] ${bDef.label} — load error: ${e.message}\n`);
    results.push({ bundle: bDef.label, status: 'fail', error: e.message });
    continue;
  }

  const bundle = bDef.getBundle(bMod);
  if (!bundle) {
    console.log(`  [SKIP] ${bDef.label} — ${bDef.note || 'no DataBundle export'}\n`);
    if (useJson) results.push({ bundle: bDef.label, status: 'skip', note: bDef.note });
    continue;
  }

  for (const hDef of HSDS) {
    let hMod;
    try {
      hMod = await hDef.load();
    } catch (e) {
      console.log(`  [FAIL] ${bDef.label} × ${hDef.label} — HSD load error: ${e.message}\n`);
      continue;
    }

    const hsd = hDef.getHsd(hMod);
    const report = validateBundle(bundle, hsd);
    console.log(`  ${fmt(report)}  ${bDef.label} × ${hDef.label}`);
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
    results.push({ bundle: bDef.label, hsd: hDef.label, valid: report.valid, errors: report.errors.length, warnings: report.warnings.length });
  }
  console.log('');
}

// ── Summary ────────────────────────────────────────────────────────────
const failed = results.filter(r => r.status === 'fail');
const invalid = results.filter(r => r.valid === false);
const skipped = results.filter(r => r.status === 'skip');

if (useJson) {
  console.log(JSON.stringify({ results, summary: { total: results.length, failed: failed.length, invalid: invalid.length, skipped: skipped.length } }, null, 2));
} else {
  console.log(`── Summary ──`);
  console.log(`  Total checks:   ${results.length}`);
  if (skipped.length) console.log(`  Skipped:        ${skipped.length}`);
  if (failed.length) console.log(`  Load failures:  ${failed.length}`);
  if (invalid.length) console.log(`  \x1b[31mInvalid:        ${invalid.length}\x1b[0m`);
  if (invalid.length === 0) console.log(`  \x1b[32mAll valid! ✓\x1b[0m`);
  console.log('');
}

if (invalid.length > 0 || failed.length > 0) process.exit(1);
