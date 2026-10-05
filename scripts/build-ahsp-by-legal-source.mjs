/**
 * Build AHSP fixed-coefficient bundles per legal source from Jakarta HSP scrape.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLegalSourcesCatalog, provenanceLinks, resolveLegalSource } from './lib/legal-sources.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HSP_DATA = join(ROOT, 'packages', 'hsp-jakarta-dcktrp', 'data');
const OUT_ROOT = join(ROOT, 'packages', 'ahsp-dcktrp-by-source', 'data');

const DEFAULT_MARGIN = {
  overhead_pct: { label: 'Biaya Umum (Overhead)', min: 0, max: 15, default: 10 },
  profit_pct: { label: 'Keuntungan (Profit)', min: 0, max: 15, default: 5 },
  constraint: { rule: '10 <= overhead_pct + profit_pct <= 15' },
};

function mapBidang(kategori) {
  const k = String(kategori ?? '').toLowerCase();
  if (k.includes('bina marga') || k.includes('jalan')) return 'bina-marga';
  if (k.includes('sda') || k.includes('air')) return 'sda';
  return 'cipta-karya';
}

function mapSatuan(raw) {
  if (!raw) return 'unit';
  const s = String(raw).trim().toLowerCase();
  const map = { m2: 'm2', m3: 'm3', m1: 'm', m: 'm', oh: 'OH', buah: 'buah', kg: 'kg' };
  return map[s] ?? s;
}

function divisiFromKode(kode) {
  const first = Number.parseInt(String(kode ?? '').split('.')[0], 10);
  return Number.isFinite(first) && first > 0 ? first : 1;
}

function subDivisiFromKode(kode) {
  const parts = String(kode ?? '').split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : String(parts[0] ?? '1');
}

/** @param {Record<string, unknown>} item */
function toAhspItem(item, catalog, legalSource) {
  const kode = item.kode;
  if (!kode) return null;

  const tenaga_kerja = (item.tenaga_kerja ?? [])
    .filter((r) => r.koefisien > 0 && r.harga_satuan_rp > 0)
    .map((r) => ({
      ref: r.kode?.startsWith('L.') ? r.kode : null,
      nama: r.nama ?? 'Tenaga kerja',
      satuan: 'OH',
      koefisien: r.koefisien,
      harga_satuan_ref: r.harga_satuan_rp,
    }));

  const bahan = (item.bahan ?? [])
    .filter((r) => r.koefisien > 0 && r.harga_satuan_rp > 0)
    .map((r) => ({
      nama: r.nama ?? 'Bahan',
      satuan: mapSatuan(r.satuan),
      koefisien: r.koefisien,
      harga_satuan_ref: r.harga_satuan_rp,
    }));

  const peralatan = (item.peralatan ?? [])
    .filter((r) => r.koefisien > 0 && r.harga_satuan_rp > 0)
    .map((r) => ({
      ref: r.kode?.startsWith('E.') ? r.kode : null,
      nama: r.nama ?? 'Peralatan',
      satuan: 'jam',
      koefisien: r.koefisien,
      harga_satuan_ref: r.harga_satuan_rp,
    }));

  const links = provenanceLinks(catalog, legalSource, item.source_id);

  return {
    kode_ahsp: String(kode),
    nama: item.nama ?? item.uraian_lengkap,
    bidang: mapBidang(item.kategori),
    divisi: divisiFromKode(kode),
    sub_divisi: subDivisiFromKode(kode),
    satuan_bayar: mapSatuan(item.satuan_bayar),
    jenis_kalkulasi: 'fixed_coefficient',
    jenis_pekerjaan: peralatan.length > 0 ? 'semi-mekanis' : 'manual',
    is_lump_sum: false,
    tenaga_kerja,
    bahan,
    peralatan,
    harga_satuan_pekerjaan_ref: item.harga_satuan_rp ?? undefined,
    margin: DEFAULT_MARGIN,
    provenance: {
      sumber_regulasi: legalSource.label,
      halaman: null,
      verification_tier: 'auto-extracted',
      diverifikasi_oleh: null,
      tanggal_verifikasi: null,
      ...links,
    },
  };
}

async function main() {
  const catalog = await loadLegalSourcesCatalog();
  await mkdir(OUT_ROOT, { recursive: true });
  await writeFile(join(OUT_ROOT, 'legal-sources-catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  const lines = (await readFile(join(HSP_DATA, 'items.jsonl'), 'utf8')).split('\n').filter(Boolean);
  const bySource = new Map();

  for (const line of lines) {
    const item = JSON.parse(line);
    const legal = resolveLegalSource(item.dasar_hukum ?? item.provenance?.sumber_regulasi, catalog);
    const list = bySource.get(legal.id) ?? [];
    list.push(item);
    bySource.set(legal.id, list);
  }

  const bundleIndex = [];

  for (const source of catalog.sources) {
    const rawItems = bySource.get(source.id) ?? [];
    if (rawItems.length === 0) continue;

    const items = [];
    for (const raw of rawItems) {
      const converted = toAhspItem(raw, catalog, source);
      if (converted) items.push(converted);
    }
    if (items.length === 0) continue;

    const dir = join(OUT_ROOT, source.id);
    await mkdir(dir, { recursive: true });

    const bundleMeta = {
      source_id: source.id,
      title: source.label,
      jenis: source.jenis,
      penerbit: source.penerbit ?? null,
      item_count: items.length,
      compatible_hsd: ['hsd-jakarta-2026'],
      verification_tier: 'auto-extracted',
      verification_note:
        'Koefisien dan harga_satuan_ref diekstrak dari breakdown HSP portal Bangun Jakarta. Bukan transkripsi PDF lampiran SE.',
      sumber: {
        label: source.label,
        dokumen_url: source.dokumen_url ?? null,
        dokumen_pencarian_url: source.dokumen_pencarian_url ?? null,
        portal_url: source.portal_url ?? catalog.portal_bangun_jakarta.portal_url,
      },
    };

    await writeFile(join(dir, 'bundle-meta.json'), JSON.stringify(bundleMeta, null, 2) + '\n', 'utf8');
    await writeFile(join(dir, 'items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');

    bundleIndex.push({
      source_id: source.id,
      title: source.label,
      item_count: items.length,
      path: `data/${source.id}`,
      ...bundleMeta.sumber,
    });
  }

  await writeFile(join(OUT_ROOT, 'bundle-index.json'), JSON.stringify(bundleIndex, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${bundleIndex.length} AHSP source bundles under packages/ahsp-dcktrp-by-source/data`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
