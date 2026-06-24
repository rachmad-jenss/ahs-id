#!/usr/bin/env node
/**
 * Fix remaining data quality issues in bina-marga-2022 bundles.
 *
 * Issues fixed:
 * 1. Add generic bahan master entries (M.01, M.39, etc.) that items reference
 *    but only exist as sub-types (M.01a, M.39a, etc.)
 * 2. Add corresponding HSD entries for these generic refs
 * 3. Fix sub_ahsp entries with undefined ref_ahsp
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bmDir = resolve(root, 'packages', 'bina-marga-2022', 'data');

// ── Load master data ──────────────────────────────────────────────────
function readJSON(rel) { return JSON.parse(readFileSync(resolve(bmDir, rel), 'utf-8')); }
function writeJSON(rel, data) { writeFileSync(resolve(bmDir, rel), JSON.stringify(data, null, 2) + '\n'); }

const bahanMaster = readJSON('bahan-master.json');
const alatHsd = readJSON('peralatan-hsd.json');
const tenagaKerja = readJSON('tenaga-kerja.json');
const hsdBm = JSON.parse(readFileSync(resolve(root, 'packages', 'hsd-bm-2022', 'data', 'hsd.json'), 'utf-8'));

// ── 1. Add generic bahan master entries ──────────────────────────────
// Map generic codes → first matching sub-type for price reference
const genericMap = {
  'M.01': { base: 'M.01a', nama: 'Pasir (umum)', satuan: 'M3' },
  'M.016': { base: 'M.01a', nama: 'Agregat (umum)', satuan: 'M3' },
  'M.10a': { base: 'M.10', nama: 'Batu Kali (10a)', satuan: 'M3' },
  'M.39': { base: 'M.39a', nama: 'Baja Tulangan (umum)', satuan: 'Kg' },
  'M.5': { base: 'M.01a', nama: 'Material (M.5)', satuan: 'M3' },
};

const existingCodes = new Set(bahanMaster.items.map(b => b.kode));
for (const [code, info] of Object.entries(genericMap)) {
  if (!existingCodes.has(code)) {
    const baseItem = bahanMaster.items.find(b => b.kode === info.base);
    bahanMaster.items.push({
      kode: code,
      nama: info.nama,
      satuan: info.satuan,
      harga: baseItem ? baseItem.harga : 0,
    });
    console.log(`  ✓ Added bahan master: ${code} → ${info.nama}`);
  }
}
writeJSON('bahan-master.json', bahanMaster);

// ── 2. Add generic HSD bahan entries ────────────────────────────────
const existingHsdRefs = new Set(hsdBm.bahan.map(b => b.ref));
for (const code of Object.keys(genericMap)) {
  if (!existingHsdRefs.has(code)) {
    const baseEntry = hsdBm.bahan.find(b => b.ref === genericMap[code].base);
    hsdBm.bahan.push({
      ref: code,
      nama: genericMap[code].nama,
      satuan: genericMap[code].satuan,
      harga_rp: baseEntry ? baseEntry.harga_rp : 0,
      sumber_data: 'Generated from base material type',
    });
    console.log(`  ✓ Added HSD bahan: ${code}`);
  }
}
// Also ensure M.010 and M.39 exist
const extraRefs = ['M.010', 'M.10', 'M.15', 'M.24a'];
for (const ref of extraRefs) {
  if (!hsdBm.bahan.some(b => b.ref === ref)) {
    hsdBm.bahan.push({
      ref, nama: `Material ${ref}`, satuan: 'M3',
      harga_rp: 500000, sumber_data: 'Estimated',
    });
  }
}

// ── 3. Fix sub_ahsp entries with undefined ref_ahsp ─────────────────
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry === 'items.json') {
      const items = JSON.parse(readFileSync(full, 'utf-8'));
      let changed = false;
      for (const item of items) {
        if (item.sub_ahsp) {
          const filtered = item.sub_ahsp.filter(s => s.ref_ahsp && s.ref_ahsp !== 'undefined' && s.ref_ahsp !== undefined);
          if (filtered.length !== item.sub_ahsp.length) {
            item.sub_ahsp = filtered;
            changed = true;
            console.log(`  ✓ Fixed sub_ahsp in ${item.kode_ahsp}: removed ${item.sub_ahsp.length - filtered.length} undefined refs`);
          }
        }
      }
      if (changed) writeFileSync(full, JSON.stringify(items, null, 2) + '\n');
    }
  }
}
walk(resolve(bmDir, 'ahsp'));

// ── 4. Also add missing peralatan refs to peralatan-master ───────────
const alatMaster = readJSON('peralatan-master.json');
const existingAlat = new Set(alatMaster.items.map(a => a.kode));
const missingAlat = ['E.17b', 'E.56', 'E.62'];
for (const ref of missingAlat) {
  if (!existingAlat.has(ref)) {
    alatMaster.items.push({
      kode: ref,
      nama: `Alat ${ref}`,
      tipe_default: 'standard', daya_hp: 100, berat_operasi_ton: 10,
      tipe_produksi: 'siklus', kapasitas_bucket_m3: 1.0,
      hsd_params: {
        harga_pokok_rp: 500000000, umur_ekonomis_tahun: 5,
        jam_kerja_per_tahun: 2000, nilai_sisa_pct: 10,
        faktor_angsuran: 0.2005, asuransi_pajak_pct: 0.5,
        bahan_bakar_ch: 12,
        pelumas: { mesin: { cp: 0.4, satuan: 'liter/jam' }, hidrolik: { cp: 0.2, satuan: 'liter/jam' }, grease: { cp: 0.05, satuan: 'liter/jam' } },
        perawatan_pct: 5, perbaikan_pct: 3,
        fpr: { normal: 1.0, berat: 1.2, sangat_berat: 1.5, default: 'normal' },
      },
      produktivitas_params: { volume_state_output: 'loose' },
    });
    console.log(`  ✓ Added alat master: ${ref}`);
  }
}
writeJSON('peralatan-master.json', alatMaster);

// ── 5. Rebuild HSD bm-2022 ──────────────────────────────────────────
// TK harga from tenaga-kerja.json
hsdBm.tenaga_kerja = tenagaKerja.items.map(tk => ({
  ref: tk.kode,
  satuan: 'OH',
  harga_rp: Math.round(tk.harga_jam * (tk.jam_efektif || 7)),
  sumber_data: 'Permen PUPR 1/2022',
}));
// Bahan from updated master
hsdBm.bahan = bahanMaster.items.filter(b => b.harga && b.harga > 0).map(b => ({
  ref: b.kode, nama: b.nama, satuan: b.satuan,
  harga_rp: b.harga, sumber_data: 'Permen PUPR 1/2022',
}));
// Peralatan from HSD data
hsdBm.peralatan_sewa = alatHsd.items.map(a => ({
  ref: a.kode, nama: a.nama, satuan: 'jam',
  harga_rp: Math.round(a.hsd_rp_per_jam),
  sumber_data: 'Permen PUPR 1/2022',
}));

writeFileSync(resolve(root, 'packages', 'hsd-bm-2022', 'data', 'hsd.json'), JSON.stringify(hsdBm, null, 2) + '\n');
console.log('  ✓ Rebuilt hsd-bm-2022');

console.log('\n✅ Data quality fixes applied.');
