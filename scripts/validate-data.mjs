import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const schemasDir = resolve(root, 'packages', 'core', 'schemas');

const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });

function loadSchema(name) {
  const path = resolve(schemasDir, name);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const schemas = {
  'tenaga-kerja': ajv.compile(loadSchema('tenaga-kerja.schema.json')),
  'bahan-master': ajv.compile(loadSchema('bahan-master.schema.json')),
  'peralatan-master': ajv.compile(loadSchema('peralatan-master.schema.json')),
  'faktor-konversi': ajv.compile(loadSchema('faktor-konversi.schema.json')),
  'ahsp-item': ajv.compile(loadSchema('ahsp-item.schema.json')),
  'hsd-regional': ajv.compile(loadSchema('hsd-regional.schema.json')),
  'hsd-acuan': ajv.compile(loadSchema('hsd-acuan.schema.json')),
};

/** JSON Schema validation (Permen / cipta-karya / HSD layout). */
const SCHEMA_PACKAGES = [
  'pupr-2023',
  'cipta-karya-2024',
  'hsd-kaltim-2025',
  'hsd-jabar-2025',
  'hsd-papua-2025',
];

/**
 * Legacy bundle layouts (bina-marga 2016/2022) — syntax + presence only until
 * data is aligned with core JSON schemas (see DAS-12 validateBundle in CI).
 */
const SYNTAX_ONLY_PACKAGES = ['bina-marga-2016', 'bina-marga-2022'];

/**
 * @returns {string | null} schema key, or null to skip (no schema yet)
 */
function detectSchema(filePath) {
  const name = basename(filePath, '.json');
  if (name === 'tenaga-kerja') return 'tenaga-kerja';
  if (name === 'bahan-master') return 'bahan-master';
  if (name === 'peralatan-master') return 'peralatan-master';
  if (name === 'faktor-konversi') return 'faktor-konversi';
  if (name === 'hsd') return 'hsd-regional';
  if (name === 'hsd-acuan') return 'hsd-acuan';
  if (name === 'items') return 'ahsp-item';
  if (name === 'peralatan-hsd') return null;
  return 'ahsp-item';
}

function collectJsonFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

function validatePackage(pkgDir, pkgName) {
  const dataDir = resolve(pkgDir, 'data');
  if (!statSync(dataDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`  [FAIL] ${pkgName}: missing data/ directory`);
    return 1;
  }

  const files = collectJsonFiles(dataDir);
  let errors = 0;
  let skipped = 0;

  for (const file of files) {
    const schemaKey = detectSchema(file);
    const rel = relative(root, file);

    if (schemaKey === null) {
      console.log(`  [SKIP] ${rel} — no JSON schema (bundle-specific)`);
      skipped++;
      continue;
    }

    const validate = schemas[schemaKey];
    if (!validate) {
      console.error(`  [SKIP] ${rel} — unknown schema key "${schemaKey}"`);
      continue;
    }

    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const itemsToValidate = Array.isArray(data) && schemaKey === 'ahsp-item' ? data : [data];
    let fileErrors = 0;
    for (let idx = 0; idx < itemsToValidate.length; idx++) {
      const valid = validate(itemsToValidate[idx]);
      if (!valid) {
        fileErrors++;
        if (fileErrors === 1) {
          console.error(`  [FAIL] ${rel} (${schemaKey})`);
        }
        const prefix = Array.isArray(data) ? `[${idx}] ` : '';
        for (const err of validate.errors ?? []) {
          console.error(`         ${prefix}${err.instancePath || '/'} ${err.message}`);
        }
        if (fileErrors >= 3) {
          console.error(`         ... (more errors omitted)`);
          break;
        }
      }
    }
    if (fileErrors === 0) {
      const count = Array.isArray(data) ? ` (${data.length} items)` : '';
      console.log(`  [OK]   ${rel} (${schemaKey})${count}`);
    } else {
      errors++;
    }
  }

  if (skipped > 0) {
    console.log(`  (${skipped} file(s) skipped — no schema)`);
  }

  return errors;
}

function validatePackageSyntaxOnly(pkgDir, pkgName) {
  const dataDir = resolve(pkgDir, 'data');
  if (!statSync(dataDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`  [FAIL] ${pkgName}: missing data/ directory`);
    return 1;
  }

  const files = collectJsonFiles(dataDir);
  let errors = 0;

  for (const file of files) {
    const rel = relative(root, file);
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      const count = Array.isArray(data) ? ` (${data.length} items)` : '';
      console.log(`  [OK]   ${rel} (json syntax)${count}`);
    } catch (e) {
      errors++;
      console.error(`  [FAIL] ${rel} — invalid JSON: ${e.message}`);
    }
  }

  console.log('  (syntax-only — full schema validation pending data normalization)');
  return errors;
}

console.log('Validating data files against JSON schemas...\n');

let totalErrors = 0;

for (const pkgName of SCHEMA_PACKAGES) {
  const pkgDir = resolve(root, 'packages', pkgName);
  console.log(`@ahs-id/${pkgName}:`);
  totalErrors += validatePackage(pkgDir, pkgName);
  console.log('');
}

for (const pkgName of SYNTAX_ONLY_PACKAGES) {
  const pkgDir = resolve(root, 'packages', pkgName);
  console.log(`@ahs-id/${pkgName}:`);
  totalErrors += validatePackageSyntaxOnly(pkgDir, pkgName);
  console.log('');
}

if (totalErrors > 0) {
  console.error(`Schema validation failed: ${totalErrors} file(s) with errors`);
  process.exit(1);
} else {
  console.log('All data files passed schema validation.');
}
