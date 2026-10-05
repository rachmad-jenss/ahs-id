/**
 * Download national regulation PDFs (DJBK SDM, BPK, storage) into tools/docling/sources/national/.
 * Does not call Jakarta portal APIs.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CATALOG_PATH = join(ROOT, 'packages', 'core', 'data', 'legal-sources-catalog.json');
const DJBK_INDEX_PATH = join(ROOT, 'packages', 'core', 'data', 'djbk-produk-hukum-index.json');
const OUT_DIR = join(ROOT, 'tools', 'docling', 'sources', 'national');
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json');

const MAX_BYTES = Number(process.env.AHSP_DOWNLOAD_MAX_MB ?? '30') * 1024 * 1024;
const ONLY_IDS = process.env.AHSP_DOWNLOAD_ONLY
  ? new Set(process.env.AHSP_DOWNLOAD_ONLY.split(',').map((s) => s.trim()).filter(Boolean))
  : null;
const SKIP_SOURCE_IDS = new Set(
  (process.env.AHSP_DOWNLOAD_SKIP_SOURCES ?? 'se-binkon-73-2023,permen-pupr-8-2023,permen-pupr-1-2022')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const ONLY_SDM_IDS = process.env.AHSP_DOWNLOAD_SDM_IDS
  ? new Set(process.env.AHSP_DOWNLOAD_SDM_IDS.split(',').map((s) => s.trim()).filter(Boolean))
  : null;

/** @type {{ source_id: string, label: string, role: string, url: string }[]} */
function collectDownloadTargets(catalog, djbkIndex) {
  const targets = [];
  const seen = new Set();

  function add(source_id, label, role, url) {
    if (!url || !/^https?:/i.test(url)) return;
    const key = `${source_id}:${role}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ source_id, label, role, url });
  }

  for (const source of catalog.sources ?? []) {
    if (source.id === 'portal-bangun-jakarta' || source.id === 'tidak-tercantum') continue;
    add(source.id, source.label, 'dokumen_pdf', source.dokumen_pdf_url);
    if (source.dokumen_pdf_url !== source.dokumen_url) {
      add(source.id, source.label, 'dokumen_halaman', source.dokumen_url);
    }
  }

  for (const page of djbkIndex?.pages ?? []) {
    const sid = page.catalog_source_id ?? page.id;
    for (const link of page.download_links ?? []) {
      const href = link.href;
      if (!/\.pdf(\?|$)/i.test(href) && !/sdm_process_download/i.test(href)) continue;
      const role = /sdm_process_download/i.test(href) ? 'sdm_download' : 'page_pdf';
      add(page.id, page.label, role, href);
    }
  }

  return targets;
}

function urlSuffix(url) {
  const m = url.match(/download_id=(\d+)/i);
  if (m) return `id-${m[1]}`;
  const leaf = url.split('/').pop()?.split('?')[0] ?? 'file';
  const stem = leaf.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  return stem || 'file';
}

function safeFilename(source_id, role, url) {
  const base = `${source_id}--${role}--${urlSuffix(url)}`;
  if (/\.pdf(\?|$)/i.test(url) || /sdm_process_download/i.test(url)) return `${base}.pdf`;
  return `${base}.bin`;
}

function shouldDownload(target) {
  if (SKIP_SOURCE_IDS.has(target.source_id)) return false;
  if (target.role === 'dokumen_halaman') return false;
  if (ONLY_IDS && !ONLY_IDS.has(target.source_id)) return false;
  if (ONLY_SDM_IDS) {
    const m = target.url.match(/download_id=(\d+)/i);
    if (!m || !ONLY_SDM_IDS.has(m[1])) return false;
  }
  return true;
}

async function downloadOne(target) {
  const dest = join(OUT_DIR, safeFilename(target.source_id, target.role, target.url));
  const res = await fetch(target.url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ahs-id-legal-download/1.0 (+docling)' },
  });
  if (!res.ok) {
    return { ...target, dest, ok: false, status: res.status, bytes: 0 };
  }
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > MAX_BYTES) {
    return { ...target, dest, ok: false, status: res.status, bytes: 0, skipped: 'too_large', content_length: len };
  }
  const body = res.body;
  if (!body) {
    return { ...target, dest, ok: false, status: res.status, bytes: 0 };
  }
  await pipeline(body, createWriteStream(dest));
  const { size } = await stat(dest);
  if (size > MAX_BYTES) {
    await unlink(dest);
    return { ...target, dest, ok: false, skipped: 'too_large', bytes: size };
  }
  return { ...target, dest, ok: true, status: res.status, bytes: size };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  let djbkIndex = { pages: [] };
  try {
    djbkIndex = JSON.parse(await readFile(DJBK_INDEX_PATH, 'utf8'));
  } catch {
    console.log('Tip: run pnpm scrape:djbk-produk-hukum for extra SDM links.');
  }

  await mkdir(OUT_DIR, { recursive: true });
  let targets = collectDownloadTargets(catalog, djbkIndex).filter(shouldDownload);
  if (ONLY_IDS) {
    targets = targets.filter((t) => ONLY_IDS.has(t.source_id));
  }
  console.log(`Downloading ${targets.length} national file(s) → ${OUT_DIR} (max ${MAX_BYTES / (1024 * 1024)} MB each)`);

  const results = [];
  for (const target of targets) {
    process.stdout.write(`${target.source_id} (${target.role}) … `);
    try {
      const r = await downloadOne(target);
      results.push(r);
      console.log(
        r.ok ? `${r.bytes} bytes` : r.skipped ? `SKIP ${r.skipped}` : `FAILED ${r.status ?? r.error}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ...target, ok: false, error: message });
      console.log(`ERROR ${message}`);
    }
  }

  const manifest = {
    downloaded_at: new Date().toISOString(),
    out_dir: 'tools/docling/sources/national',
    results,
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
