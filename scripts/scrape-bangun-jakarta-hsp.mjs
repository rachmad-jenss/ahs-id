/**
 * Scrape HSP (harga satuan pekerjaan) from DCKTRP Bangun Jakarta portal API.
 *
 * API (discovered 2026-03): GET /bangunjakarta/portal/api/hsp
 *   - list: ?page=&limit=
 *   - detail: ?id={pekerjaan_id}
 *
 * Usage:
 *   node scripts/scrape-bangun-jakarta-hsp.mjs
 *   node scripts/scrape-bangun-jakarta-hsp.mjs --max-pages 1 --limit 5
 *   node scripts/scrape-bangun-jakarta-hsp.mjs --resume
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'packages', 'hsp-jakarta-dcktrp', 'data');
const CHECKPOINT_PATH = join(OUT_DIR, '.scrape-checkpoint.json');

const API_BASE = 'https://dcktrp.jakarta.go.id/bangunjakarta/portal/api/hsp';
const SOURCE_PAGE = 'https://dcktrp.jakarta.go.id/bangunjakarta/hsp';

function parseArgs(argv) {
  const opts = {
    limit: 50,
    maxPages: null,
    concurrency: 4,
    delayMs: 120,
    resume: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--resume') opts.resume = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--max-pages') opts.maxPages = Number(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--delay-ms') opts.delayMs = Number(argv[++i]);
  }
  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { retries = 5 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ahs-id-scraper/1.0 (+https://github.com/rachmad-jenss/ahs-id)',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = await res.json();
      if (!body.success) {
        throw new Error(body.message ?? 'API success=false');
      }
      return body;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw new Error(`${lastErr instanceof Error ? lastErr.message : lastErr} for ${url}`);
}

/** @param {string} pekerjaan */
function splitKodeNama(pekerjaan) {
  const m = pekerjaan.match(/^([\d.]+)\s+(.+)$/);
  if (!m) return { kode: null, nama: pekerjaan.trim() };
  return { kode: m[1], nama: m[2].trim() };
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** @param {Record<string, unknown>} data */
function normalizeDetail(data) {
  const { kode, nama } = splitKodeNama(String(data.pekerjaan ?? ''));
  const components = { tenaga_kerja: [], bahan: [], peralatan: [] };

  for (const block of data.kategori_material ?? []) {
    const kategori = String(block.kategori_material_nama ?? '').toLowerCase();
    const bucket =
      kategori.includes('tenaga') ? 'tenaga_kerja' : kategori.includes('peralatan') ? 'peralatan' : 'bahan';

    for (const row of block.detail ?? []) {
      const kodeMaterial = row.kode_material ? String(row.kode_material) : null;
      const materialName = row.material?.nama_material ?? row.material?.nama ?? null;
      components[bucket].push({
        kode: kodeMaterial,
        material_id: row.material_id != null ? String(row.material_id) : null,
        nama: materialName != null ? String(materialName) : null,
        satuan: row.satuan?.nama != null ? String(row.satuan.nama) : null,
        koefisien: num(row.koefisien),
        harga_satuan_rp: num(row.harga_satuan),
        jumlah_rp: num(row.total_harga),
      });
    }
  }

  return {
    source_id: data.id,
    kode,
    nama,
    uraian_lengkap: String(data.pekerjaan ?? ''),
    kategori: data.parent_pekerjaan?.nama ?? null,
    satuan_bayar: data.satuan?.nama ?? null,
    dasar_hukum: data.reference ?? null,
    harga_satuan_rp: num(data.total_harga_semua),
    profit_pct: num(data.presentase_profit),
    profit_rp: num(data.profit),
    ...components,
  };
}

/** @param {Record<string, unknown>} row */
function normalizeListRow(row) {
  const { kode, nama } = splitKodeNama(String(row.pekerjaan ?? ''));
  return {
    source_id: row.id,
    kode,
    nama,
    uraian_lengkap: String(row.pekerjaan ?? ''),
    kategori: row.parent_pekerjaan?.nama ?? null,
    satuan_bayar: row.satuan?.nama ?? null,
    dasar_hukum: row.reference ?? null,
    harga_satuan_rp: num(row.total_harga_semua),
    profit_pct: num(row.presentase_profit),
    profit_rp: num(row.profit),
  };
}

async function loadCheckpoint() {
  try {
    const raw = await readFile(CHECKPOINT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { fetchedIds: [], listPagesDone: 0, totalExpected: null };
  }
}

async function saveCheckpoint(state) {
  await writeFile(CHECKPOINT_PATH, JSON.stringify(state, null, 2), 'utf8');
}

async function mapPool(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const opts = parseArgs(process.argv);
  await mkdir(OUT_DIR, { recursive: true });

  const scrapedAt = new Date().toISOString();
  let checkpoint = opts.resume
    ? await loadCheckpoint()
    : { fetchedIds: [], listPagesDone: 0, totalExpected: null };
  const fetchedSet = new Set(checkpoint.fetchedIds);
  if (!opts.resume && !opts.dryRun) {
    await writeFile(join(OUT_DIR, 'items.jsonl'), '', 'utf8');
  }

  let index = [];
  if (opts.resume) {
    try {
      index = JSON.parse(await readFile(join(OUT_DIR, 'index.json'), 'utf8'));
    } catch {
      index = [];
    }
  }
  let page = checkpoint.listPagesDone + 1;
  let total = checkpoint.totalExpected;
  let lastPage = null;

  console.log('Fetching HSP index from Bangun Jakarta…');

  while (true) {
    if (opts.maxPages != null && page > opts.maxPages) break;

    const url = `${API_BASE}?page=${page}&limit=${opts.limit}`;
    const body = await fetchJson(url);
    const payload = body.data;

    if (payload?.id != null) {
      console.error('Unexpected single-item response during list pass');
      break;
    }

    total = payload.total;
    lastPage = payload.lastPage;
    const rows = payload.data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      index.push(normalizeListRow(row));
    }

    checkpoint.listPagesDone = page;
    checkpoint.totalExpected = total;
    if (!opts.dryRun) await saveCheckpoint(checkpoint);

    console.log(`  page ${page}/${lastPage} (+${rows.length}, index ${index.length}/${total})`);

    if (page >= lastPage) break;
    page += 1;
    await sleep(opts.delayMs);
  }

  const manifest = {
    version: '2026.1.0',
    source: {
      portal: 'DCKTRP Bangun Jakarta',
      url: SOURCE_PAGE,
      api_base: API_BASE,
      scraped_at: scrapedAt,
    },
    region: {
      provinsi: 'DKI Jakarta',
      kode_provinsi: '31',
    },
    item_count: index.length,
    total_reported_by_api: total,
    verification_tier: 'auto-extracted',
    verification_note:
      'Data diekstrak dari API portal Bangun Jakarta. Verifikasi dengan dokumen SE/Perda resmi DKI sebelum dipakai tender.',
  };

  if (!opts.dryRun) {
    await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
  }

  const idsToFetch = index.map((r) => r.source_id).filter((id) => !fetchedSet.has(id));
  console.log(`Fetching ${idsToFetch.length} item details (${fetchedSet.size} already in checkpoint)…`);

  const detailsPath = join(OUT_DIR, 'items.jsonl');
  const detailLines = [];

  await mapPool(idsToFetch, opts.concurrency, async (id, i) => {
    if (i > 0 && i % opts.concurrency === 0) await sleep(opts.delayMs);
    const body = await fetchJson(`${API_BASE}?id=${id}`);
    const item = normalizeDetail(body.data);
    item.provenance = {
      source: 'dcktrp-bangun-jakarta',
      source_id: id,
      scraped_at: scrapedAt,
      api_url: `${API_BASE}?id=${id}`,
    };
    detailLines.push(JSON.stringify(item));
    fetchedSet.add(id);
    checkpoint.fetchedIds = [...fetchedSet];
    if (!opts.dryRun && (fetchedSet.size % 25 === 0)) {
      await saveCheckpoint(checkpoint);
    }
    if ((i + 1) % 100 === 0 || i === idsToFetch.length - 1) {
      console.log(`  details ${fetchedSet.size}/${index.length}`);
    }
    return item;
  });

  if (!opts.dryRun && detailLines.length > 0) {
    let existing = '';
    try {
      existing = await readFile(detailsPath, 'utf8');
    } catch {
      /* new file */
    }
    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await writeFile(detailsPath, existing + prefix + detailLines.join('\n') + '\n', 'utf8');
    await saveCheckpoint(checkpoint);
  }

  if (!opts.dryRun) {
    await import('./enrich-jakarta-hsp-manifest.mjs');
  }

  console.log(`Done. Index: ${index.length} items. Details fetched this run: ${detailLines.length}.`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
