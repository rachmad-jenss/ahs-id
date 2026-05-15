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
};

function detectSchema(filePath) {
  const name = basename(filePath, '.json');
  if (name === 'tenaga-kerja') return 'tenaga-kerja';
  if (name === 'bahan-master') return 'bahan-master';
  if (name === 'peralatan-master') return 'peralatan-master';
  if (name === 'faktor-konversi') return 'faktor-konversi';
  if (name === 'hsd') return 'hsd-regional';
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

function validatePackage(pkgDir) {
  const dataDir = resolve(pkgDir, 'data');
  const files = collectJsonFiles(dataDir);
  let errors = 0;

  for (const file of files) {
    const schemaKey = detectSchema(file);
    const validate = schemas[schemaKey];
    if (!validate) {
      console.error(`  [SKIP] ${relative(root, file)} — no schema for "${schemaKey}"`);
      continue;
    }

    const data = JSON.parse(readFileSync(file, 'utf-8'));
    const valid = validate(data);
    const rel = relative(root, file);

    if (valid) {
      console.log(`  [OK]   ${rel} (${schemaKey})`);
    } else {
      errors++;
      console.error(`  [FAIL] ${rel} (${schemaKey})`);
      for (const err of validate.errors) {
        console.error(`         ${err.instancePath || '/'} ${err.message}`);
      }
    }
  }

  return errors;
}

console.log('Validating data files against JSON schemas...\n');

let totalErrors = 0;

const pupr2023 = resolve(root, 'packages', 'pupr-2023');
console.log('@ahs-id/pupr-2023:');
totalErrors += validatePackage(pupr2023);

const hsdKaltim = resolve(root, 'packages', 'hsd-kaltim-2025');
console.log('\n@ahs-id/hsd-kaltim-2025:');
totalErrors += validatePackage(hsdKaltim);

const hsdJabar = resolve(root, 'packages', 'hsd-jabar-2025');
console.log('\n@ahs-id/hsd-jabar-2025:');
totalErrors += validatePackage(hsdJabar);

const hsdPapua = resolve(root, 'packages', 'hsd-papua-2025');
console.log('\n@ahs-id/hsd-papua-2025:');
totalErrors += validatePackage(hsdPapua);

console.log('');
if (totalErrors > 0) {
  console.error(`Schema validation failed: ${totalErrors} file(s) with errors`);
  process.exit(1);
} else {
  console.log('All data files passed schema validation.');
}
