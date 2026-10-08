/**
 * Promote local Docling SE AHSP outputs → packages/ahsp-se-binkon-{nomor}-{tahun}/data
 *
 * Prerequisite: tools/docling/output/.../cleaned/hsp-linked.jsonl (from national:se47-coverage)
 *
 *   node scripts/promote-docling-to-packages.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promoteLinkedJsonl } from './lib/se47-ahsp-promote.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const DOCLING = join(REPO, 'tools', 'docling');
const OUT = join(REPO, 'packages', 'ahsp-se-binkon-47-2026', 'data');
const MAP_PATH = join(DOCLING, 'sources', 'national', 'SE-47-2026-download-map.json');

/** Slug regulasi: se-binkon-{nomor SE}/{tahun terbit}. Ganti saat SE AHSP tahun baru dirilis. */
const SE_REGULATION_SLUG = 'se-binkon-47-2026';

/** downloadId = ID file unduhan di portal binakonstruksi.pu.go.id (bukan kode AHSP). */
const BIDANG_PROFILES = [
  {
    sourceId: `${SE_REGULATION_SLUG}-sda`,
    bidang: 'sda',
    title: 'SDA — SE Binkon 47/2026',
    outDir: 'sda',
    lampiran: 'IV',
    doclingOut: 'output/sda-se-47-2026',
    downloadId: '10901',
  },
  {
    sourceId: `${SE_REGULATION_SLUG}-bina-marga`,
    bidang: 'bina-marga',
    title: 'Bina Marga — SE Binkon 47/2026',
    outDir: 'bina-marga',
    lampiran: 'V',
    doclingOut: 'output/cipta-karya-se-47-2026',
    downloadId: '10903',
  },
  {
    sourceId: `${SE_REGULATION_SLUG}-cipta-karya`,
    bidang: 'cipta-karya',
    title: 'Cipta Karya — SE Binkon 47/2026',
    outDir: 'cipta-karya',
    lampiran: 'VI',
    doclingOut: 'output/bina-marga-lampiran-v-national',
    downloadId: '10904',
  },
];

const LAMPIRAN_REFERENCE = [
  {
    downloadId: '10894',
    outDir: 'referensi/lampiran-i-ketentuan-umum',
    label: 'Lampiran I — Ketentuan umum',
    sourceId: `${SE_REGULATION_SLUG}-lampiran-i-ketentuan-umum`,
  },
  {
    downloadId: '10897',
    outDir: 'referensi/lampiran-ii-acuan-ahsp',
    label: 'Lampiran II — Acuan AHSP',
    sourceId: `${SE_REGULATION_SLUG}-lampiran-ii-acuan-ahsp`,
  },
  {
    downloadId: '10899',
    outDir: 'referensi/lampiran-iii-smkk',
    label: 'Lampiran III — SMKK',
    sourceId: `${SE_REGULATION_SLUG}-lampiran-iii-smkk`,
  },
  {
    downloadId: '10906',
    outDir: 'referensi/lampiran-vii-pengajuan',
    label: 'Lampiran VII — Pengajuan',
    sourceId: `${SE_REGULATION_SLUG}-lampiran-vii-pengajuan`,
  },
];

async function loadDownloadMap() {
  const map = JSON.parse(await readFile(MAP_PATH, 'utf8'));
  const byId = new Map();
  for (const d of map.downloads ?? []) {
    byId.set(d.download_id, d);
  }
  return {
    sourceUrl: map.source ?? null,
    byId,
  };
}

async function writeLampiranReference(profile, map) {
  const cleaned = join(DOCLING, profile.doclingOut ?? `output/se-47-2026-id-${profile.downloadId}`, 'cleaned');
  const manifestPath = join(cleaned, 'manifest.json');
  const progressPath = join(DOCLING, profile.doclingOut ?? `output/se-47-2026-id-${profile.downloadId}`, 'progress.json');
  const dir = join(OUT, profile.outDir);
  await mkdir(dir, { recursive: true });

  const meta = {
    source_id: profile.sourceId,
    title: profile.label,
    download_id: profile.downloadId,
    kind: 'docling-reference',
    verification_tier: 'auto-extracted',
    verification_note: 'Ringkasan manifest Docling; bukan bundel ahsp-item. Gunakan bidang IV–VI untuk koefisien.',
    sumber: {
      label: 'SE 47/SE/Dk/2026',
      dokumen_url: map.sourceUrl,
      dokumen_pencarian_url: 'https://jdih.pu.go.id/',
    },
  };

  let manifest = null;
  let progress = null;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    /* optional */
  }
  try {
    progress = JSON.parse(await readFile(progressPath, 'utf8'));
  } catch {
    /* optional */
  }

  await writeFile(join(dir, 'bundle-meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  await writeFile(
    join(dir, 'docling-summary.json'),
    JSON.stringify({ manifest, progress, generated_at: new Date().toISOString() }, null, 2) + '\n',
    'utf8',
  );
  return manifest != null;
}

async function main() {
  const map = await loadDownloadMap();
  const bundleIndex = [];

  for (const profile of BIDANG_PROFILES) {
    const base = join(DOCLING, profile.doclingOut, 'cleaned');
    const linked = join(base, 'hsp-linked.jsonl');
    const itemIndex = join(base, 'item-index.csv');
    const dl = map.byId.get(profile.downloadId);
    const items = await promoteLinkedJsonl(linked, itemIndex, {
      bidang: profile.bidang,
      sourceId: profile.sourceId,
      dokumenUrl: map.sourceUrl,
    });

    const dir = join(OUT, profile.outDir);
    await mkdir(dir, { recursive: true });

    const bundleMeta = {
      source_id: profile.sourceId,
      title: profile.title,
      jenis: 'surat_edaran',
      penerbit: 'Direktorat Jenderal Bina Konstruksi — Kementerian PUPR',
      item_count: items.length,
      bidang: profile.bidang,
      lampiran: profile.lampiran,
      regulation_slug: SE_REGULATION_SLUG,
      download_id: profile.downloadId,
      portal_download_note:
        'download_id = ID unduhan lampiran PDF di binakonstruksi.pu.go.id (SDM), bukan kode AHSP.',
      compatible_hsd: ['hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025', 'hsd-jakarta-2026'],
      verification_tier: 'auto-extracted',
      verification_note:
        'Koefisien dari PDF lampiran nasional via Docling (hsp-linked). Tanpa harga_satuan_ref komponen — gunakan HSD regional untuk hitung engine.',
      sumber: {
        label: 'SE Dirjen Binkon No. 47/SE/Dk/2026',
        dokumen_url: map.sourceUrl,
        dokumen_pencarian_url: 'https://jdih.pu.go.id/',
        portal_url: null,
      },
    };

    await writeFile(join(dir, 'bundle-meta.json'), JSON.stringify(bundleMeta, null, 2) + '\n', 'utf8');
    await writeFile(join(dir, 'items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');

    bundleIndex.push({
      source_id: profile.sourceId,
      title: profile.title,
      item_count: items.length,
      path: `data/${profile.outDir}`,
      bidang: profile.bidang,
      lampiran: profile.lampiran,
      regulation_slug: SE_REGULATION_SLUG,
      download_id: profile.downloadId,
      ...bundleMeta.sumber,
    });

    console.log(`${profile.outDir}: ${items.length} ahsp-item`);
  }

  for (const ref of LAMPIRAN_REFERENCE) {
    const doclingOut = `output/se-47-2026-id-${ref.downloadId}`;
    const ok = await writeLampiranReference({ ...ref, doclingOut }, map);
    if (ok) {
      bundleIndex.push({
        source_id: ref.sourceId,
        title: ref.label,
        item_count: 0,
        path: `data/${ref.outDir}`,
        kind: 'docling-reference',
        download_id: ref.downloadId,
        dokumen_url: map.sourceUrl,
      });
      console.log(`${ref.outDir}: reference manifest`);
    } else {
      console.log(`${ref.outDir}: skip (no cleaned manifest)`);
    }
  }

  await writeFile(join(OUT, 'bundle-index.json'), JSON.stringify(bundleIndex, null, 2) + '\n', 'utf8');
  console.log(`Wrote packages/ahsp-se-binkon-47-2026/data (${bundleIndex.length} entries in bundle-index)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
