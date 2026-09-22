import { validatePackageData } from '../packages/core/dist/validator/validate-package-data.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Permen / Cipta Karya / HSD layouts. */
const SCHEMA_PACKAGES = [
  'pupr-2023',
  'cipta-karya-2024',
  'hsd-kaltim-2025',
  'hsd-jabar-2025',
  'hsd-papua-2025',
  'hsd-bm-2022',
];

/** Legacy layouts stay syntax-only until their data matches the core schemas. */
const SYNTAX_ONLY_PACKAGES = ['bina-marga-2016', 'bina-marga-2022'];

function reportPackage(pkgName, mode) {
  const dataDir = resolve(root, 'packages', pkgName, 'data');
  console.log(`@ahs-id/${pkgName}:`);
  const report = validatePackageData(dataDir, mode);
  for (const file of report.files) {
    const tag = file.status === 'ok' ? '[OK]  ' : file.status === 'skip' ? '[SKIP]' : '[FAIL]';
    const line = `  ${tag} ${file.file} — ${file.message}`;
    if (file.status === 'fail') console.error(line);
    else console.log(line);
  }
  if (mode === 'syntax') {
    console.log('  (syntax-only — full schema validation pending data normalization)');
  }
  console.log('');
  return report.valid;
}

console.log('Validating data files against JSON schemas...\n');

let ok = true;
for (const pkgName of SCHEMA_PACKAGES) {
  ok = reportPackage(pkgName, 'schema') && ok;
}
for (const pkgName of SYNTAX_ONLY_PACKAGES) {
  ok = reportPackage(pkgName, 'syntax') && ok;
}

if (!ok) {
  console.error('Schema validation failed');
  process.exit(1);
}

console.log('All data files passed schema validation.');
