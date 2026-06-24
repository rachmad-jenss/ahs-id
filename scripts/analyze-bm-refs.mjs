#!/usr/bin/env node
/**
 * Analyze all refs used by bina-marga-2022 AHSP items.
 * Extracts unique TK, bahan, and peralatan refs for HSD bundle creation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const dataDir = resolve(root, 'packages', 'bina-marga-2022', 'data');

const tkRefs = new Set();
const bahanRefs = new Set();
const alatRefs = new Set();
let totalItems = 0;
let itemCodes = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry === 'items.json') {
      const items = JSON.parse(readFileSync(full, 'utf-8'));
      for (const item of items) {
        totalItems++;
        itemCodes.push(item.kode_ahsp);
        if (item.tenaga_kerja) for (const tk of item.tenaga_kerja) tkRefs.add(tk.ref);
        if (item.bahan) for (const b of item.bahan) bahanRefs.add(b.ref);
        if (item.peralatan) for (const p of item.peralatan) alatRefs.add(p.ref);
      }
    }
  }
}

walk(dataDir);

function printTable(label, refs, existing) {
  console.log(`\n=== ${label} (${refs.size} unique refs) ===`);
  const sorted = [...refs].sort();
  for (const r of sorted) {
    const exists = existing.has(r) ? '✓' : '✗ MISSING';
    console.log(`  ${r.padEnd(12)} ${exists}`);
  }
}

// Check what's in hsd-kaltim-2025
const hsdPath = resolve(root, 'packages', 'hsd-kaltim-2025', 'data');
const hsdData = JSON.parse(readFileSync(resolve(hsdPath, 'hsd.json'), 'utf-8'));
const existingTk = new Set(hsdData.tenaga_kerja.map(t => t.ref || t.kode));
const existingBahan = new Set(hsdData.bahan.map(b => b.ref || b.kode));

console.log(`Total AHSP items analyzed: ${totalItems}`);
console.log(`Item codes: ${itemCodes.slice(0, 5).join(', ')}... (showing first 5)`);

printTable('TENAGA KERJA REFS', tkRefs, existingTk);
printTable('BAHAN REFS', bahanRefs, existingBahan);
printTable('PERALATAN REFS', alatRefs, new Set());

// Summary stats
const missingTk = [...tkRefs].filter(r => !existingTk.has(r));
const missingBahan = [...bahanRefs].filter(r => !existingBahan.has(r));
console.log(`\n=== SUMMARY ===`);
console.log(`Total items: ${totalItems}`);
console.log(`TK refs: ${tkRefs.size} total, ${missingTk.length} missing`);
console.log(`Bahan refs: ${bahanRefs.size} total, ${missingBahan.length} missing`);
console.log(`Peralatan refs: ${alatRefs.size} total`);
