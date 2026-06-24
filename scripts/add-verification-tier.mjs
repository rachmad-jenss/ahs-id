#!/usr/bin/env node
/**
 * Add verification_tier to all provenance objects in bundle JSON files.
 *
 * Usage:
 *   node scripts/add-verification-tier.mjs
 *
 * All existing bundles are marked 'auto-extracted' since they come from
 * PDF/Excel sources without manual verification.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const packagesDir = resolve(__dirname, 'packages');

/** Collect all .json files recursively */
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

let updated = 0;
let skipped = 0;

for (const file of collectJsonFiles(packagesDir)) {
  const content = readFileSync(file, 'utf-8');
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    continue;
  }

  // Handle both single items and arrays of items
  const items = Array.isArray(data) ? data : [data];
  let changed = false;

  for (const item of items) {
    if (item.provenance && !item.provenance.verification_tier) {
      item.provenance.verification_tier = 'auto-extracted';
      changed = true;
    }
    // Also check for items arrays inside ahsp_item bundles
    if (item.ahsp_items) {
      for (const ahsp of item.ahsp_items) {
        if (ahsp.provenance && !ahsp.provenance.verification_tier) {
          ahsp.provenance.verification_tier = 'auto-extracted';
          changed = true;
        }
      }
    }
  }

  if (changed) {
    if (Array.isArray(data)) {
      writeFileSync(file, JSON.stringify(items, null, 2) + '\n');
    } else {
      writeFileSync(file, JSON.stringify(items[0], null, 2) + '\n');
    }
    const rel = relative(__dirname, file);
    console.log(`  ✓ ${rel}`);
    updated++;
  } else {
    skipped++;
  }
}

console.log(`\nDone. Updated: ${updated}, Skipped (already set): ${skipped}`);
