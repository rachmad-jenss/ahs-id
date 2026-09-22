#!/usr/bin/env node
/**
 * Operator-gated release entrypoint.
 *
 * Default: clean + verify + build only.
 * Publish requires explicit approval via --publish or AHS_ID_NPM_PUBLISH_APPROVED=1.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publishRequested =
  process.argv.includes('--publish') || process.env.AHS_ID_NPM_PUBLISH_APPROVED === '1';

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

run('node scripts/release-prepare.mjs');

if (!publishRequested) {
  console.log(
    '\nrelease: preparation complete. No publish performed.\n' +
      'To publish after maintainer approval, set AHS_ID_NPM_PUBLISH_APPROVED=1 or pass --publish.',
  );
  process.exit(0);
}

console.log('\n==> release:publish');
run('pnpm changeset publish');
