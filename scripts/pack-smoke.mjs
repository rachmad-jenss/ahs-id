#!/usr/bin/env node
/**
 * Pack all public packages, enforce tarball size limits, and install smoke-test
 * them from a clean temporary project (no workspace links).
 */

import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const skipPrepare = process.argv.includes('--skip-prepare');

const manifest = JSON.parse(readFileSync(join(root, 'scripts/release-packages.json'), 'utf8'));
const maxBytes = manifest.maxTarballBytes ?? 10 * 1024 * 1024;

function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: options.cwd ?? root,
    stdio: options.stdio ?? 'inherit',
    shell: true,
    encoding: options.encoding,
    env: process.env,
  });
  if (result.status !== 0) {
    if (options.encoding) {
      console.error(result.stderr ?? result.stdout);
    }
    process.exit(result.status ?? 1);
  }
  return result;
}

function fail(message) {
  console.error(`pack-smoke: ${message}`);
  process.exit(1);
}

if (!skipPrepare) {
  console.log('==> pack-smoke: release prepare');
  run('node scripts/release-prepare.mjs');
}

const packDir = mkdtempSync(join(tmpdir(), 'ahs-id-pack-'));
const tarballs = new Map();

console.log(`\n==> pack-smoke: packing into ${packDir}`);

for (const pkg of manifest.packages) {
  const cwd = join(root, pkg.dir);
  const packed = run(`pnpm pack --json --pack-destination "${packDir}"`, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  let payload;
  try {
    payload = JSON.parse(packed.stdout ?? '[]');
  } catch {
    fail(`could not parse pnpm pack output for ${pkg.name}`);
  }

  const entry = Array.isArray(payload) ? payload[0] : payload;
  if (!entry?.filename) {
    fail(`pnpm pack did not return a tarball for ${pkg.name}`);
  }

  const tarballPath = isAbsolute(entry.filename) ? entry.filename : join(packDir, entry.filename);
  const size = statSync(tarballPath).size;
  if (size > maxBytes) {
    fail(`${pkg.name} tarball is ${size} bytes (limit ${maxBytes})`);
  }

  tarballs.set(pkg.name, tarballPath);
  console.log(`packed ${pkg.name} -> ${entry.filename} (${size} bytes)`);
}

const installDir = mkdtempSync(join(tmpdir(), 'ahs-id-install-'));
const dependencies = {};
for (const [name, tarballPath] of tarballs) {
  const fileRef = tarballPath.replace(/\\/g, '/');
  dependencies[name] = `file:${fileRef}`;
}

writeFileSync(
  join(installDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'ahs-id-pack-smoke',
      private: true,
      type: 'module',
      dependencies,
    },
    null,
    2,
  )}\n`,
);

console.log(`\n==> pack-smoke: installing tarballs in ${installDir}`);
run('npm install --no-package-lock --ignore-scripts', { cwd: installDir });

for (const pkg of manifest.packages) {
  const installedPkgPath = join(installDir, 'node_modules', ...pkg.name.split('/'), 'package.json');
  const installedPkg = readFileSync(installedPkgPath, 'utf8');
  if (installedPkg.includes('workspace:')) {
    fail(`${pkg.name} resolved via workspace link instead of tarball`);
  }
}

const smokeScript = `
import { createCalculator, exportHspToExcelBuffer } from '@ahs-id/core';
import { bundle as puprBundle } from '@ahs-id/pupr-2023';
import { hsd as kaltimHsd } from '@ahs-id/hsd-kaltim-2025';
import { bundle as bm2016Bundle } from '@ahs-id/bina-marga-2016';
import { ahspItems as ciptaItems } from '@ahs-id/cipta-karya-2024';

if (!puprBundle.ahsp_items?.length) {
  throw new Error('PUPR bundle did not load');
}

const bmCalc = createCalculator(bm2016Bundle, kaltimHsd);
const bmResult = bmCalc.hitungHSP('3.1.1', {});
if (!(bmResult.grandTotal > 0)) {
  throw new Error('Bina Marga 2016 calc returned non-positive grandTotal');
}

const excelBuffer = await exportHspToExcelBuffer(bmResult);
if (!(excelBuffer.byteLength > 100)) {
  throw new Error('Excel export buffer was unexpectedly small');
}

const { calcHspFixedCoefficient } = await import('@ahs-id/core');
const ciptaItem = ciptaItems.find((item) => item.kode_ahsp === '1.2.1.1.1');
if (!ciptaItem) {
  throw new Error('missing Cipta Karya item 1.2.1.1.1');
}
const ciptaResult = calcHspFixedCoefficient(ciptaItem, {});
if (!(ciptaResult.grandTotal > 0)) {
  throw new Error('Cipta Karya calc returned non-positive grandTotal');
}

console.log('import smoke passed');
`;

writeFileSync(join(installDir, 'smoke.mjs'), smokeScript);
run(`node smoke.mjs`, { cwd: installDir });

const cliEntry = join(installDir, 'node_modules', '@ahs-id', 'cli', 'dist', 'index.js');
const cliSource = readFileSync(cliEntry, 'utf8');
const firstLine = cliSource.split(/\r?\n/, 1)[0];
if (firstLine !== '#!/usr/bin/env node') {
  fail('compiled CLI entry is missing the Node shebang');
}

const versionRun = run(`node "${cliEntry}" --version`, {
  cwd: installDir,
  encoding: 'utf8',
  stdio: 'pipe',
});
const version = (versionRun.stdout ?? '').trim();
if (!/^\d+\.\d+\.\d+/.test(version)) {
  fail(`unexpected CLI --version output: ${version}`);
}

const calcRun = run(
  `node "${cliEntry}" calc-hsp 3.1.1 --bundle bina-marga-2016 --json`,
  {
    cwd: installDir,
    encoding: 'utf8',
    stdio: 'pipe',
  },
);
const calcPayload = JSON.parse(calcRun.stdout ?? '{}');
if (!(calcPayload.grandTotal > 0)) {
  fail('CLI calc-hsp returned non-positive grandTotal');
}

console.log(`\npack-smoke passed (CLI version ${version})`);
