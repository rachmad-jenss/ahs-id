#!/usr/bin/env node
/**
 * Cross-platform artifact cleanup for workspace packages.
 *
 * Usage:
 *   node scripts/clean.mjs dist .turbo *.tsbuildinfo   # from a package directory
 *   node scripts/clean.mjs --all-workspaces            # from repo root
 */

import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULT_TARGETS = ['dist', '.turbo', '*.tsbuildinfo'];

function removePath(path) {
  if (!existsSync(path)) {
    return;
  }
  rmSync(path, { recursive: true, force: true });
}

function removeTarget(cwd, target) {
  if (target.includes('*')) {
    const baseDir = target.includes('/') ? join(cwd, dirname(target)) : cwd;
    const pattern = target.includes('/') ? target.split('/').pop() ?? target : target;
    if (!existsSync(baseDir)) {
      return;
    }
    const suffix = pattern.replace(/^\*/, '');
    for (const entry of readdirSync(baseDir)) {
      if (pattern.startsWith('*') && entry.endsWith(suffix)) {
        removePath(join(baseDir, entry));
      }
    }
    return;
  }

  removePath(join(cwd, target));
}

function cleanDirectory(cwd, targets) {
  for (const target of targets) {
    removeTarget(cwd, target);
  }
}

function loadManifest() {
  return JSON.parse(readFileSync(join(root, 'scripts/release-packages.json'), 'utf8'));
}

const args = process.argv.slice(2);

if (args.includes('--all-workspaces')) {
  const manifest = loadManifest();
  cleanDirectory(root, ['.turbo']);
  for (const pkg of manifest.packages) {
    cleanDirectory(join(root, pkg.dir), DEFAULT_TARGETS);
  }
  process.exit(0);
}

const targets = args.length > 0 ? args : DEFAULT_TARGETS;
cleanDirectory(process.cwd(), targets);
