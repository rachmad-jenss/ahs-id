#!/usr/bin/env node
/**
 * Generate @ahs-id/hsd-bm-2022 — dedicated HSD bundle for bina-marga-2022.
 *
 * Source data from bina-marga-2022's own tenaga-kerja.json and
 * bahan-master.json which contain regional price estimates.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bmDir = resolve(root, 'packages', 'bina-marga-2022');
const outDir = resolve(root, 'packages', 'hsd-bm-2022');
const srcDir = resolve(outDir, 'src');
const dataDir = resolve(outDir, 'data');

// ── Load source master data ──────────────────────────────────────────
const tkMaster = JSON.parse(readFileSync(resolve(bmDir, 'data', 'tenaga-kerja.json'), 'utf-8'));
const bahanMaster = JSON.parse(readFileSync(resolve(bmDir, 'data', 'bahan-master.json'), 'utf-8'));
const alatHsd = JSON.parse(readFileSync(resolve(bmDir, 'data', 'peralatan-hsd.json'), 'utf-8'));

// ── Build HSD data ───────────────────────────────────────────────────
const hsd = {
  version: '2022.1.0',
  region: {
    provinsi: 'Nasional (Bina Marga 2022)',
    kode_provinsi: '00',
    kabupaten: null,
    tahun_berlaku: 2022,
    kuartal: 1,
    dasar_hukum: 'Permen PUPR 1/2022 Lampiran',
    tanggal_terbit: '2022-01-01',
  },
  tenaga_kerja: tkMaster.items.map(tk => ({
    ref: tk.kode,
    satuan: 'OH',
    harga_rp: Math.round(tk.harga_jam * (tk.jam_efektif || 7)),
    sumber_data: 'Permen PUPR 1/2022 — Analisa Harga Satuan',
  })),
  bahan: bahanMaster.items.map(b => ({
    ref: b.kode,
    nama: b.nama,
    satuan: b.satuan,
    harga_rp: b.harga ?? 0,
    sumber_data: 'Permen PUPR 1/2022 Lampiran HSD',
  })),
  peralatan_sewa: alatHsd.items.map(a => ({
    ref: a.kode,
    nama: a.nama,
    satuan: 'jam',
    harga_rp: Math.round(a.hsd_rp_per_jam),
    sumber_data: 'Permen PUPR 1/2022 — HSD Alat',
  })),
  bahan_bakar: {
    solar_industri_rp_per_liter: 6800,
    oli_mesin_rp_per_liter: 25000,
    oli_hidrolik_rp_per_liter: 30000,
    grease_rp_per_kg: 45000,
  },
};

// ── Create package files ─────────────────────────────────────────────
mkdirSync(dataDir, { recursive: true });
mkdirSync(srcDir, { recursive: true });

// Write hsd.json
writeFileSync(resolve(dataDir, 'hsd.json'), JSON.stringify(hsd, null, 2) + '\n');

// Write package.json
writeFileSync(resolve(outDir, 'package.json'), JSON.stringify({
  name: '@ahs-id/hsd-bm-2022',
  version: '0.0.1',
  description: 'Regional HSD prices for Bina Marga 2022 regulation bundle',
  type: 'module',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  files: ['dist'],
  scripts: { build: 'tsc --project tsconfig.json', clean: 'rm -rf dist' },
  dependencies: { '@ahs-id/core': 'workspace:*' },
  license: 'MIT',
}, null, 2) + '\n');

// Write tsconfig.json
writeFileSync(resolve(outDir, 'tsconfig.json'), JSON.stringify({
  extends: '../../tsconfig.base.json',
  compilerOptions: { outDir: 'dist', rootDir: 'src' },
  include: ['src'],
}, null, 2) + '\n');

// Write src/index.ts
writeFileSync(resolve(srcDir, 'index.ts'), `import type { HsdRegional } from '@ahs-id/core';
import hsdData from '../data/hsd.json' with { type: 'json' };
export const hsd = hsdData as unknown as HsdRegional;
`);

console.log(`✅ @ahs-id/hsd-bm-2022 generated`);
console.log(`   TK: ${hsd.tenaga_kerja.length} entries`);
console.log(`   Bahan: ${hsd.bahan.length} entries`);
console.log(`   Peralatan sewa: ${hsd.peralatan_sewa.length} entries`);
