/**
 * Convert Docling hsp-linked.jsonl rows → ahsp-item (fixed_coefficient) for SE 47 national PDFs.
 */
import { readFile } from 'node:fs/promises';

const DEFAULT_MARGIN = {
  overhead_pct: { label: 'Biaya Umum (Overhead)', min: 0, max: 15, default: 10 },
  profit_pct: { label: 'Keuntungan (Profit)', min: 0, max: 15, default: 5 },
  constraint: { rule: '10 <= overhead_pct + profit_pct <= 15' },
};

const SE47_REGULATION =
  'SE Dirjen Bina Konstruksi No. 47/SE/Dk/2026 (lampiran nasional — ekstraksi Docling)';

/** @param {string} satuan */
function normalizeSatuan(satuan) {
  if (!satuan) return 'unit';
  const s = String(satuan).trim().toLowerCase();
  const map = {
    m2: 'm2',
    m3: 'm3',
    'm³': 'm3',
    m1: 'm',
    m: 'm',
    oh: 'OH',
    kg: 'kg',
    liter: 'liter',
    buah: 'buah',
    ma3: 'm3',
  };
  return map[s] ?? s.replace(/\s+/g, '');
}

/** @param {string} kode @param {'sda'|'bina-marga'|'cipta-karya'} bidang */
export function divisiFromKode(kode, bidang) {
  const s = String(kode ?? '').trim();
  if (s.startsWith('A.')) {
    const m = /^A\.(\d+)/.exec(s);
    const n = m ? Number.parseInt(m[1], 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  const first = Number.parseInt(s.split('.')[0], 10);
  if (Number.isFinite(first) && first > 0) return first;
  return bidang === 'sda' ? 1 : bidang === 'bina-marga' ? 2 : 1;
}

/** @param {string} kode */
export function subDivisiFromKode(kode) {
  const s = String(kode ?? '').trim();
  if (s.startsWith('A.')) {
    const parts = s.split('.');
    if (parts.length >= 3) return `${parts[0]}.${parts[1]}.${parts[2]}`;
    if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
    return s;
  }
  const parts = s.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : String(parts[0] ?? '1');
}

/**
 * @param {string} csvText
 * @returns {Map<string, { nama: string, satuan: string }>}
 */
export function parseItemIndexCsv(csvText) {
  const map = new Map();
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return map;
  const header = lines[0].split(',');
  const kodeIdx = header.indexOf('kode');
  const satuanIdx = header.indexOf('satuan');
  const nameIdx = header.indexOf('item_pekerjaan');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const kode = cols[kodeIdx]?.trim();
    if (!kode) continue;
    map.set(kode, {
      nama: cols[nameIdx]?.trim() ?? '',
      satuan: normalizeSatuan(cols[satuanIdx]?.trim()),
    });
  }
  return map;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** @param {Record<string, unknown>} row @param {'A'|'B'|'C'} section */
function coeffsForSection(row, section) {
  const list = row.coefficients ?? [];
  return list.filter((c) => c.section === section && typeof c.koefisien === 'number' && c.koefisien > 0);
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ bidang: string, sourceId: string, dokumenUrl: string | null, itemIndex?: Map<string, { nama: string, satuan: string }> }} ctx
 */
export function linkedRowToAhspItem(row, ctx) {
  const kode = row.kode_ahsp;
  if (!kode || typeof kode !== 'string') return null;

  const indexRow = ctx.itemIndex?.get(kode);
  const nama =
    (typeof row.uraian_item === 'string' && row.uraian_item.trim()) ||
    indexRow?.nama ||
    kode;

  /** SE 47 lampiran nasional: kolom harga di PDF sering kosong (template HSD). */
  const unitPriceRef = (c) =>
    typeof c.harga_satuan === 'number' && Number.isFinite(c.harga_satuan) && c.harga_satuan >= 0
      ? c.harga_satuan
      : 0;

  const tenaga_kerja = coeffsForSection(row, 'A').map((c) => ({
    ref: typeof c.kode === 'string' && /^L\./.test(c.kode) ? c.kode : null,
    nama: c.uraian || c.kode || 'Tenaga kerja',
    satuan: normalizeSatuan(c.satuan) || 'OH',
    koefisien: c.koefisien,
    harga_satuan_ref: unitPriceRef(c),
    koef_sumber: 'tabel',
  }));

  const bahan = coeffsForSection(row, 'B').map((c) => ({
    ref: typeof c.kode === 'string' && /^M\./.test(c.kode) ? c.kode : null,
    nama: c.uraian || c.kode || 'Bahan',
    satuan: normalizeSatuan(c.satuan) || 'unit',
    koefisien: c.koefisien,
    harga_satuan_ref: unitPriceRef(c),
    koef_sumber: 'tabel',
  }));

  const peralatan = coeffsForSection(row, 'C').map((c) => ({
    ref: typeof c.kode === 'string' && /^E\./.test(c.kode) ? c.kode : null,
    nama: c.uraian || c.kode || 'Peralatan',
    satuan: 'jam',
    koefisien: c.koefisien,
    harga_satuan_ref: unitPriceRef(c),
    koef_sumber: 'tabel',
  }));

  if (tenaga_kerja.length === 0 && bahan.length === 0 && peralatan.length === 0) {
    return null;
  }

  const halaman =
    row.kode_link_page != null
      ? String(row.kode_link_page)
      : row.page_range
        ? String(row.page_range)
        : null;

  return {
    kode_ahsp: kode,
    nama,
    bidang: ctx.bidang,
    divisi: divisiFromKode(kode, ctx.bidang),
    sub_divisi: subDivisiFromKode(kode),
    satuan_bayar: indexRow?.satuan ?? 'unit',
    jenis_kalkulasi: 'fixed_coefficient',
    jenis_pekerjaan: peralatan.length > 0 ? 'semi-mekanis' : 'manual',
    is_lump_sum: false,
    tenaga_kerja,
    bahan,
    peralatan,
    harga_satuan_pekerjaan_ref:
      typeof row.harga_satuan_pekerjaan === 'number' ? row.harga_satuan_pekerjaan : undefined,
    margin: DEFAULT_MARGIN,
    provenance: {
      sumber_regulasi: SE47_REGULATION,
      halaman,
      verification_tier: 'auto-extracted',
      diverifikasi_oleh: null,
      tanggal_verifikasi: null,
      source_id: ctx.sourceId,
      dokumen_url: ctx.dokumenUrl,
      dokumen_pencarian_url: 'https://jdih.pu.go.id/',
      portal_url: null,
      portal_item_url: null,
    },
    catatan_umum: row.kode_link_method
      ? [`kode_link_method=${String(row.kode_link_method)}`, `table_index=${String(row.table_index)}`]
      : [],
  };
}

/** Merge duplicate kode: keep richest coefficient set. */
function mergeItems(items) {
  const byKode = new Map();
  for (const item of items) {
    const prev = byKode.get(item.kode_ahsp);
    if (!prev) {
      byKode.set(item.kode_ahsp, item);
      continue;
    }
    const score = (it) => it.tenaga_kerja.length + it.bahan.length + it.peralatan.length;
    if (score(item) > score(prev)) byKode.set(item.kode_ahsp, item);
  }
  return [...byKode.values()].sort((a, b) => a.kode_ahsp.localeCompare(b.kode_ahsp));
}

/**
 * @param {string} linkedPath
 * @param {string | null} itemIndexCsvPath
 * @param {{ bidang: string, sourceId: string, dokumenUrl: string | null }} ctx
 */
export async function promoteLinkedJsonl(linkedPath, itemIndexCsvPath, ctx) {
  const text = await readFile(linkedPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let itemIndex;
  if (itemIndexCsvPath) {
    try {
      itemIndex = parseItemIndexCsv(await readFile(itemIndexCsvPath, 'utf8'));
    } catch {
      itemIndex = undefined;
    }
  }
  const items = [];
  for (const line of lines) {
    const row = JSON.parse(line);
    const item = linkedRowToAhspItem(row, { ...ctx, itemIndex });
    if (item) items.push(item);
  }
  return mergeItems(items);
}
