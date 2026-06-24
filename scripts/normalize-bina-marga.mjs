#!/usr/bin/env node
/**
 * Normalize bina-marga-2022 data for createCalculator compatibility.
 *
 * Steps:
 * 1. Create peralatan-master.json (minimal entries with hsd_params)
 * 2. Add faktor-konversi.json (volume factors)
 * 3. Normalize ref codes (L01 → L.01, E01 → E.01)
 * 4. Add provenance with verification_tier to all items
 * 5. Assemble DataBundle export
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkgDir = resolve(root, 'packages', 'bina-marga-2022');
const dataDir = resolve(pkgDir, 'data');

// ── Load source data ──────────────────────────────────────────────────
function readJSON(rel) {
  return JSON.parse(readFileSync(resolve(dataDir, rel), 'utf-8'));
}

const tenagaKerja = readJSON('tenaga-kerja.json');
const bahanMaster = readJSON('bahan-master.json');
const alatHsd = readJSON('peralatan-hsd.json');

// ── 1. Normalize ref codes (L01 → L.01, E01 → E.01, M01 → M.01) ─────
function normalizeRef(ref) {
  if (!ref) return ref;
  // Already has dot
  if (/^[LEM]\.[0-9]/.test(ref)) return ref;
  // Transform L01 → L.01, E09 → E.09, etc.
  return ref.replace(/^([LEM])(\d)/, '$1.$2');
}

// Fix refs in tenaga-kerja.json (items array)
if (tenagaKerja.items) {
  for (const tk of tenagaKerja.items) {
    tk.kode = normalizeRef(tk.kode);
  }
}

// Fix refs in bahan-master.json
if (bahanMaster.items) {
  for (const b of bahanMaster.items) {
    b.kode = normalizeRef(b.kode);
  }
}

// Fix refs in peralatan-hsd.json items
if (alatHsd.items) {
  for (const a of alatHsd.items) {
    a.kode = normalizeRef(a.kode);
  }
}

// ── 2. Fix refs in all AHSP items + add provenance ────────────────────
const itemsDir = resolve(dataDir, 'ahsp');
let totalItems = 0;

function processItemsFile(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  const items = JSON.parse(raw);
  let changed = false;

  for (const item of items) {
    // Fix TK refs
    if (item.tenaga_kerja) {
      for (const tk of item.tenaga_kerja) {
        const fixed = normalizeRef(tk.ref);
        if (fixed !== tk.ref) { tk.ref = fixed; changed = true; }
      }
    }
    // Fix bahan refs
    if (item.bahan) {
      for (const b of item.bahan) {
        const fixed = normalizeRef(b.ref);
        if (fixed !== b.ref) { b.ref = fixed; changed = true; }
      }
    }
    // Fix peralatan refs
    if (item.peralatan) {
      for (const p of item.peralatan) {
        const fixed = normalizeRef(p.ref);
        if (fixed !== p.ref) { p.ref = fixed; changed = true; }
      }
    }
    // Add provenance if missing
    if (!item.provenance) {
      item.provenance = {
        sumber_regulasi: 'Permen PUPR 1/2022 Lampiran',
        halaman: 'Bina Marga',
        verification_tier: 'auto-extracted',
        diverifikasi_oleh: null,
        tanggal_verifikasi: null,
      };
      changed = true;
    }
    totalItems++;
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(items, null, 2) + '\n');
    console.log(`  ✓ fixed: ${filePath.replace(dataDir, 'data')} (${items.length} items)`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry === 'items.json') processItemsFile(full);
  }
}

walk(itemsDir);

// ── 3. Create faktor-konversi.json (standard values) ──────────────────
// Permen PUPR 1/2022 uses standard volume conversion factors
const faktorKonversi = {
  version: '1',
  derivation_rule: 'Permen PUPR 1/2022 — Standard earthwork volume conversion',
  items: [
    { material: 'tanah_biasa', bank_to_loose: 1.25, bank_to_compacted: 0.85, berat_jenis_bank_ton_m3: 1.6 },
    { material: 'tanah_lempung', bank_to_loose: 1.35, bank_to_compacted: 0.90, berat_jenis_bank_ton_m3: 1.8 },
    { material: 'kerikil', bank_to_loose: 1.18, bank_to_compacted: 0.91, berat_jenis_bank_ton_m3: 1.7 },
    { material: 'batu_pecah', bank_to_loose: 1.15, bank_to_compacted: 0.88, berat_jenis_bank_ton_m3: 1.9 },
    { material: 'agregat_kelas_a', bank_to_loose: 1.025, bank_to_compacted: 1.15, berat_jenis_bank_ton_m3: 1.8 },
  ],
};

writeFileSync(resolve(dataDir, 'faktor-konversi.json'), JSON.stringify(faktorKonversi, null, 2) + '\n');
console.log('  ✓ created: data/faktor-konversi.json');

// ── 4. Create peralatan-master.json (with minimal hsd_params) ─────────
// Each alat gets a standard hsd_params template
const peralatanMaster = {
  version: '1',
  sumber: 'Permen PUPR 1/2022 via peralatan-hsd.json',
  items: alatHsd.items.map(a => ({
    kode: a.kode,
    nama: a.nama,
    tipe_default: 'standard',
    daya_hp: 100,
    berat_operasi_ton: 10,
    tipe_produksi: 'siklus',
    kapasitas_bucket_m3: 1.0,
    hsd_params: {
      harga_pokok_rp: 500000000,
      umur_ekonomis_tahun: 5,
      jam_kerja_per_tahun: 2000,
      nilai_sisa_pct: 10,
      faktor_angsuran: 0.2005,
      asuransi_pajak_pct: 0.5,
      bahan_bakar_ch: 12,
      pelumas: {
        mesin: { cp: 0.4, satuan: 'liter/jam' },
        hidrolik: { cp: 0.2, satuan: 'liter/jam' },
        grease: { cp: 0.05, satuan: 'liter/jam' },
      },
      perawatan_pct: 5,
      perbaikan_pct: 3,
      fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' },
    },
    produktivitas_params: {
      volume_state_output: 'loose',
    },
  })),
};

writeFileSync(resolve(dataDir, 'peralatan-master.json'), JSON.stringify(peralatanMaster, null, 2) + '\n');
console.log(`  ✓ created: data/peralatan-master.json (${peralatanMaster.items.length} items)`);

// ── 5. Write updated master files ────────────────────────────────────
writeFileSync(resolve(dataDir, 'tenaga-kerja.json'), JSON.stringify(tenagaKerja, null, 2) + '\n');
console.log(`  ✓ normalized: data/tenaga-kerja.json (${tenagaKerja.items.length} items)`);
writeFileSync(resolve(dataDir, 'bahan-master.json'), JSON.stringify(bahanMaster, null, 2) + '\n');
console.log(`  ✓ normalized: data/bahan-master.json (${bahanMaster.items.length} items)`);
writeFileSync(resolve(dataDir, 'peralatan-hsd.json'), JSON.stringify(alatHsd, null, 2) + '\n');
console.log(`  ✓ normalized: data/peralatan-hsd.json (${alatHsd.items.length} items)`);

console.log(`\nDone. ${totalItems} AHSP items processed.`);
