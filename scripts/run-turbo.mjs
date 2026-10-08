#!/usr/bin/env node
/**
 * Turbo wrapper: on Windows, run one package at a time and raise Node heap
 * to avoid Cursor/PowerShell + parallel eslint OOM flakes on dev machines.
 */

import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const task = process.argv[2];
if (!task) {
  console.error('usage: node scripts/run-turbo.mjs <lint|typecheck|test|build|...>');
  process.exit(1);
}

const isWin = platform() === 'win32';
const args = ['exec', 'turbo', 'run', task];
if (isWin) {
  args.push('--concurrency=1');
}

const env = { ...process.env };
if (isWin && !String(env.NODE_OPTIONS ?? '').includes('max-old-space-size')) {
  const extra = '--max-old-space-size=6144';
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${extra}` : extra;
}

const result = spawnSync('pnpm', args, {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 1);
