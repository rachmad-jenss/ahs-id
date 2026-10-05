/**
 * Build packages/hsd-jakarta-2026/data/hsd.json from scraped HSP line items.
 *
 * Aggregates unique tenaga_kerja (L.*) and peralatan (E.*) harga_satuan from items.jsonl.
 * Bahan tanpa kode PUPR dipetakan ke ref M.JK.{material_id}.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLegalSourcesCatalog } from './lib/legal-sources.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ITEMS_PATH = join(ROOT, 'packages', 'hsp-jakarta-dcktrp', 'data', 'items.jsonl');
const MANIFEST_PATH = join(ROOT, 'packages', 'hsp-jakarta-dcktrp', 'data', 'manifest.json');
const OUT_PATH = join(ROOT, 'packages', 'hsd-jakarta-2026', 'data', 'hsd.json');

function normalizeSatuan(raw) {
  if (!raw) return 'unit';
  const s = String(raw).trim().toLowerCase();
  const map = {
    oh: 'OH',
    m3: 'm3',
    m2: 'm2',
    m1: 'm',
    kg: 'kg',
    liter: 'liter',
    ltr: 'liter',
    buah: 'buah',
    zak: 'zak',
    jam: 'jam',
  };
  return map[s] ?? s;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function normalizeLaborRef(ref) {
  if (!ref) return null;
  const compact = String(ref).replace(/\s+/g, '');
  const m = compact.match(/^L\.(\d+[a-z]?)/i);
  return m ? `L.${m[1]}` : null;
}

function pickPrice(map, key, price, meta) {
  if (price == null || price <= 0) return;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...meta, prices: [price] });
    return;
  }
  prev.prices.push(price);
}

async function main() {
  const lines = (await readFile(ITEMS_PATH, 'utf8')).split('\n').filter(Boolean);
  let manifestScrapedAt = new Date().toISOString().slice(0, 10);
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    manifestScrapedAt = String(manifest.source?.scraped_at ?? manifestScrapedAt).slice(0, 10);
  } catch {
    /* optional */
  }

  const tk = new Map();
  const bahan = new Map();
  const alat = new Map();

  for (const line of lines) {
    const item = JSON.parse(line);
    for (const row of item.tenaga_kerja ?? []) {
      const ref = normalizeLaborRef(row.kode);
      if (!ref || row.harga_satuan_rp == null) continue;
      pickPrice(tk, ref, row.harga_satuan_rp, {
        ref,
        satuan: 'OH',
        sumber_data: 'Portal Bangun Jakarta (agregasi HSP)',
      });
    }
    for (const row of item.peralatan ?? []) {
      if (!row.kode?.startsWith('E.') || row.harga_satuan_rp == null) continue;
      pickPrice(alat, row.kode, row.harga_satuan_rp, {
        ref: row.kode,
        nama: row.nama ?? row.kode,
        satuan: 'jam',
        sumber_data: 'Portal Bangun Jakarta (agregasi HSP)',
      });
    }
    for (const row of item.bahan ?? []) {
      if (row.harga_satuan_rp == null) continue;
      const ref = row.kode?.startsWith('M.') ? row.kode : `M.JK${row.material_id ?? row.nama}`;
      pickPrice(bahan, ref, row.harga_satuan_rp, {
        ref,
        nama: row.nama ?? ref,
        satuan: normalizeSatuan(row.satuan),
        sumber_data: 'Portal Bangun Jakarta (agregasi HSP)',
      });
    }
  }

  const tenaga_kerja = [...tk.values()]
    .sort((a, b) => a.ref.localeCompare(b.ref, 'en'))
    .map(({ ref, prices, satuan, sumber_data }) => ({
      ref,
      harga_rp: Math.round(median(prices) * 100) / 100,
      satuan,
      sumber_data,
    }));

  const bahanArr = [...bahan.values()]
    .sort((a, b) => a.ref.localeCompare(b.ref, 'en'))
    .map(({ ref, nama, prices, satuan, sumber_data }) => ({
      ref,
      nama,
      harga_rp: Math.round(median(prices) * 100) / 100,
      satuan,
      sumber_data,
    }));

  const peralatan_sewa = [...alat.values()]
    .sort((a, b) => a.ref.localeCompare(b.ref, 'en'))
    .map(({ ref, nama, prices, satuan, sumber_data }) => ({
      ref,
      nama,
      harga_rp: Math.round(median(prices) * 100) / 100,
      satuan,
      sumber_data,
    }));

  const catalog = await loadLegalSourcesCatalog();
  const sumber_rujukan = [
    {
      source_id: catalog.portal_bangun_jakarta.id,
      label: catalog.portal_bangun_jakarta.label,
      jenis: 'portal',
      dokumen_url: null,
      portal_url: catalog.portal_bangun_jakarta.portal_url,
      catatan: catalog.portal_bangun_jakarta.catatan,
    },
    {
      source_id: 'djbk-produk-hukum',
      label: 'Indeks Produk Hukum DJBK (Kementerian PUPR)',
      jenis: 'lainnya',
      dokumen_url: catalog.sumber_nasional_index ?? 'https://binakonstruksi.pu.go.id/produk-hukum-djbk/',
      dokumen_pencarian_url: 'https://jdih.pu.go.id/',
      portal_url: null,
      catatan: 'Regulasi nasional AHSP/HSP; bukan portal DKI.',
    },
    ...catalog.sources
      .filter((s) => s.id !== 'tidak-tercantum' && s.id !== 'portal-bangun-jakarta')
      .map((s) => ({
        source_id: s.id,
        label: s.label,
        jenis: s.jenis,
        dokumen_url: s.dokumen_url ?? s.dokumen_pdf_url ?? null,
        dokumen_pencarian_url: s.dokumen_pencarian_url ?? null,
        portal_url: s.portal_url ?? null,
        catatan: null,
      })),
  ];

  const hsd = {
    version: '2026.1.0',
    region: {
      provinsi: 'DKI Jakarta',
      kode_provinsi: '31',
      kabupaten: null,
      tahun_berlaku: 2026,
      kuartal: 1,
      dasar_hukum: 'Agregasi portal Bangun Jakarta DCKTRP (beragam SE Binkon & Permen PUPR per item HSP sumber)',
      tanggal_terbit: manifestScrapedAt,
      verification_tier: 'auto-extracted',
      verification_note:
        'HSD dirakit dari harga satuan komponen pada ribuan item HSP portal Bangun Jakarta. Bahan tanpa kode PUPR memakai prefix M.JK. Bandingkan dengan analisa HSD DKI resmi sebelum tender.',
      sumber_rujukan,
    },
    tenaga_kerja,
    bahan: bahanArr,
    peralatan_sewa,
    bahan_bakar: {
      solar_industri_rp_per_liter: 14800,
      oli_mesin_rp_per_liter: 62000,
      oli_hidrolik_rp_per_liter: 70000,
      grease_rp_per_kg: 42000,
    },
  };

  await mkdir(join(ROOT, 'packages', 'hsd-jakarta-2026', 'data'), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(hsd, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote ${OUT_PATH}: TK=${tenaga_kerja.length}, bahan=${bahanArr.length}, alat=${peralatan_sewa.length} (from ${lines.length} HSP items)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
