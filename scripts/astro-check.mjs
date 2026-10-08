#!/usr/bin/env node
/**
 * Web typecheck: full `astro check` on Linux/CI; on Windows use `tsc` only (astro/Vite OOM).
 * Requires Node 22+ (.nvmrc). Set AHS_ID_FORCE_ASTRO_CHECK=1 to run astro check on Windows anyway.
 */

import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webDir = join(root, 'apps', 'web');
const isWin = platform() === 'win32';
const forceAstro = process.env.AHS_ID_FORCE_ASTRO_CHECK === '1';

const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
if (major < 22) {
  console.error(
    `Web typecheck requires Node.js 22+. Current: ${process.version}. Use .nvmrc (22.12.0).`,
  );
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  const env = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    ...extraEnv,
  };
  if (isWin && !String(env.NODE_OPTIONS ?? '').includes('max-old-space-size')) {
    const extra = '--max-old-space-size=6144';
    env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${extra}` : extra;
  }
  return spawnSync(command, args, {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
    env,
  });
}

if (isWin && !forceAstro) {
  console.log(
    'astro-check: Windows — menggunakan tsc --noEmit (astro check penuh hanya di CI/Linux).',
  );
  const result = run('pnpm', ['exec', 'tsc', '--noEmit', '-p', 'tsconfig.json']);
  process.exit(result.status ?? 1);
}

const env = {};
if (isWin) {
  env.AHS_ID_LIGHT_VITE = '1';
}
const result = run('pnpm', ['exec', 'astro', 'check'], env);
process.exit(result.status ?? 1);
