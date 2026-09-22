#!/usr/bin/env node
/**
 * Clean workspace artifacts, run verify gates, and leave fresh build outputs.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command) {
  const result = spawnSync(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('==> release:prepare clean');
run('node scripts/clean.mjs --all-workspaces');

console.log('\n==> release:prepare verify');
run('node scripts/verify.mjs');

console.log('\nrelease:prepare complete');
