/**
 * Index national legal products from DJBK (binakonstruksi.pu.go.id) — NOT Jakarta portal.
 * Fetches produk-hukum listing pages via public HTML (no Jakarta API).
 *
 * Output: packages/core/data/djbk-produk-hukum-index.json
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'packages', 'core', 'data', 'djbk-produk-hukum-index.json');

const SEED_PAGES = [
  {
    id: 'produk-hukum-djbk',
    url: 'https://binakonstruksi.pu.go.id/produk-hukum-djbk/',
    label: 'Indeks Produk Hukum DJBK',
  },
  {
    id: 'se-47-2026',
    url: 'https://binakonstruksi.pu.go.id/produk/produk-hukum/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-47-se-dk-2026/',
    label: 'SE 47/SE/Dk/2026',
  },
  {
    id: 'se-182-2025',
    url: 'https://binakonstruksi.pu.go.id/produk/produk-hukum/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-182-se-dk-2025/',
    fallback_url:
      'https://binakonstruksi.pu.go.id/pengumuman/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-182-se-dk-2025/',
    label: 'SE 182/SE/Dk/2025',
  },
  {
    id: 'se-30-2025',
    url: 'https://binakonstruksi.pu.go.id/pengumuman/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-30-se-dk-2025/',
    label: 'SE 30/SE/Dk/2025',
  },
  {
    id: 'se-73-2023',
    url: 'https://binakonstruksi.pu.go.id/pengumuman/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-73-se-dk-2023/',
    label: 'SE 73/SE/Dk/2023',
  },
  {
    id: 'se-68-2024',
    url: 'https://binakonstruksi.pu.go.id/produk/produk-hukum/surat-edaran-direktur-jenderal-bina-konstruksi-nomor-68-se-dk-2024/',
    label: 'SE 68/SE/Dk/2024',
  },
  {
    id: 'se-182-2025-lampiran-iii',
    url:
      'https://binakonstruksi.pu.go.id/sdm_downloads/lampiran-iii-surat-edaran-direktur-jenderal-bina-konstruksi-nomor-182-se-dk-2025/',
    label: 'Lampiran III SE 182/SE/Dk/2025 (SMKK)',
    catalog_source_id: 'se-binkon-182-2025',
  },
  {
    id: 'se-182-2025-lampiran-i',
    url:
      'https://binakonstruksi.pu.go.id/sdm_downloads/lampiran-i-surat-edaran-direktur-jenderal-bina-konstruksi-nomor-182-se-dk-2025/',
    label: 'Lampiran I SE 182/SE/Dk/2025 (HSP pokok)',
    catalog_source_id: 'se-binkon-182-2025',
  },
];

function decodeHref(raw) {
  return String(raw)
    .replace(/&#0*38;/g, '&')
    .replace(/&amp;/g, '&')
    .trim();
}

function extractLinks(html, baseUrl) {
  const links = [];
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = decodeHref(m[1]);
    if (href.startsWith('/')) href = new URL(href, baseUrl).href;
    if (!href.startsWith('http')) continue;
    if (!/binakonstruksi\.pu\.go\.id|sijkt\.pu\.go\.id|peraturan\.bpk\.go\.id|jdih\.pu\.go\.id/i.test(href)) {
      continue;
    }
    const isPdf =
      /\.pdf(\?|$)/i.test(href) ||
      /\/storage\/[^"']+\.pdf/i.test(href) ||
      /peraturan\.bpk\.go\.id\/Download\//i.test(href);
    const isSdm = /sdm_process_download/i.test(href);
    const isSijkt = /sijkt\.pu\.go\.id\/o\//i.test(href);
    const isLegacyWp = /wp-content\/uploads/i.test(href) && /\.pdf/i.test(href);
    if (isPdf || isSdm || isSijkt || isLegacyWp) {
      links.push({ href, text: '' });
    }
  }
  const seen = new Set();
  return links.filter((l) => {
    const k = l.href;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ahs-id-scraper/1.2 (+legal-index)' },
  });
  const html = await res.text();
  return { status: res.status, html };
}

async function main() {
  const scraped_at = new Date().toISOString();
  const pages = [];

  for (const seed of SEED_PAGES) {
    let pageUrl = seed.url;
    let { status, html } = await fetchPage(pageUrl);
    let links = extractLinks(html, pageUrl);
    if (seed.fallback_url && (status >= 500 || links.length === 0)) {
      const fallback = await fetchPage(seed.fallback_url);
      if (fallback.status < 500 && extractLinks(fallback.html, seed.fallback_url).length >= links.length) {
        status = fallback.status;
        html = fallback.html;
        pageUrl = seed.fallback_url;
        links = extractLinks(html, pageUrl);
      }
    }
    pages.push({
      id: seed.id,
      url: pageUrl,
      label: seed.label,
      catalog_source_id: seed.catalog_source_id ?? null,
      status,
      fetched_at: scraped_at,
      download_links: links,
    });
    console.log(`${seed.id}: ${status}, ${pages.at(-1).download_links.length} links`);
  }

  const payload = {
    version: '1.0.0',
    scraped_at,
    sumber: 'Direktorat Jenderal Bina Konstruksi — binakonstruksi.pu.go.id',
    pages,
  };

  await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
