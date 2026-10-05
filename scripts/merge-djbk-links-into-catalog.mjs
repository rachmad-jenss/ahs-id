/**
 * Merge scraped DJBK / BPK download URLs into packages/core/data/legal-sources-catalog.json.
 * National sources only — does not touch Jakarta portal metadata.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CATALOG_PATH = join(ROOT, 'packages', 'core', 'data', 'legal-sources-catalog.json');
const DJBK_INDEX_PATH = join(ROOT, 'packages', 'core', 'data', 'djbk-produk-hukum-index.json');

function normalizePageUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let path = u.pathname.replace(/\/+$/, '');
    if (path.endsWith('/feed')) path = path.slice(0, -5);
    return `${u.origin}${path}/`.toLowerCase();
  } catch {
    return String(url ?? '').toLowerCase();
  }
}

/** @param {{ href: string, text?: string }[]} links */
function pickPdfLinks(links) {
  const pdfs = links.filter((l) => /\.pdf(\?|$)/i.test(l.href) || /\/storage\/[^/]+\.pdf/i.test(l.href));
  const sdm = links.filter((l) => /sdm_process_download/i.test(l.href));
  const sijkt = links.filter((l) => /sijkt\.pu\.go\.id\/o\//i.test(l.href));
  const lampiran = pdfs.filter((l) => /lampiran/i.test(l.href) || /lampiran/i.test(l.text ?? ''));
  const seBody = pdfs.filter((l) => /se-dirjen|se-dk|surat-edaran/i.test(l.href) && !/lampiran/i.test(l.href));
  const primary =
    seBody[0] ??
    pdfs.find((l) => !/pdf-150x150|pdf\.png/i.test(l.href) && !/lampiran/i.test(l.href)) ??
    sdm[0] ??
    pdfs[0];
  const lampiranPick =
    lampiran.find((l) => l.href !== primary?.href) ?? sijkt.find((l) => l.href !== primary?.href) ?? null;
  return { primary, lampiran: lampiranPick };
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  let index;
  try {
    index = JSON.parse(await readFile(DJBK_INDEX_PATH, 'utf8'));
  } catch {
    console.log('No DJBK index; run pnpm scrape:djbk-produk-hukum first.');
    return;
  }

  const byPageUrl = new Map();
  for (const page of index.pages ?? []) {
    byPageUrl.set(normalizePageUrl(page.url), page);
  }

  let updated = 0;
  for (const source of catalog.sources) {
    if (!source.dokumen_url) continue;
    const page = byPageUrl.get(normalizePageUrl(source.dokumen_url));
    if (!page?.download_links?.length) continue;

    const { primary, lampiran } = pickPdfLinks(page.download_links);
    if (primary && !source.dokumen_pdf_url) {
      source.dokumen_pdf_url = primary.href;
      updated += 1;
    }
    if (lampiran && !source.dokumen_lampiran_url) {
      source.dokumen_lampiran_url = lampiran.href;
      updated += 1;
    }
  }

  for (const page of index.pages ?? []) {
    if (!page.catalog_source_id || !page.download_links?.length) continue;
    const source = catalog.sources.find((s) => s.id === page.catalog_source_id);
    if (!source) continue;
    const { primary } = pickPdfLinks(page.download_links);
    if (primary && !source.dokumen_pdf_url) {
      source.dokumen_pdf_url = primary.href;
      updated += 1;
    }
    if (!source.dokumen_lampiran_url) {
      source.dokumen_lampiran_url = page.url;
      updated += 1;
    }
  }

  catalog.updated_at = new Date().toISOString().slice(0, 10);
  await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`Merged DJBK links into catalog (${updated} field updates).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
