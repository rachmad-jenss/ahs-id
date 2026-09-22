#!/usr/bin/env node
/**
 * Run all release verification gates sequentially and stop on first failure.
 */

import { spawnSync } from 'node:child_process';

const steps = [
  ['lint', 'pnpm lint'],
  ['typecheck', 'pnpm typecheck'],
  ['validate-data', 'pnpm validate-data'],
  ['validate-bundles', 'pnpm validate-bundles'],
  ['test', 'pnpm exec turbo run test --concurrency=1'],
  ['build', 'pnpm build'],
];

for (const [name, command] of steps) {
  console.log(`\n==> verify:${name}`);
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\nverify failed at step "${name}"`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nverify: all gates passed');
