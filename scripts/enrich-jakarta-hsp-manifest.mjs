/**
 * Enrich HSP manifest + index with legal source catalog links.
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLegalSourcesCatalog, provenanceLinks, resolveLegalSource } from './lib/legal-sources.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'packages', 'hsp-jakarta-dcktrp', 'data');
const CATALOG_SRC = join(ROOT, 'packages', 'core', 'data', 'legal-sources-catalog.json');

/** @param {string} raw */
function normalizeLegalRef(raw) {
  if (!raw || !String(raw).trim()) return '(tidak tercantum)';
  return String(raw).replace(/\s+/g, ' ').trim();
}

async function main() {
  const catalog = await loadLegalSourcesCatalog();
  await copyFile(CATALOG_SRC, join(DATA, 'legal-sources-catalog.json'));

  const manifestPath = join(DATA, 'manifest.json');
  const indexPath = join(DATA, 'index.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const index = JSON.parse(await readFile(indexPath, 'utf8'));

  const counts = new Map();
  for (const row of index) {
    const key = normalizeLegalRef(row.dasar_hukum);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const dasar_hukum_summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, item_count]) => {
      const legal = resolveLegalSource(label, catalog);
      const links = provenanceLinks(catalog, legal, null);
      return {
        label,
        item_count,
        source_id: legal.id,
        jenis: legal.jenis ?? null,
        dokumen_url: links.dokumen_url,
        dokumen_pdf_url: links.dokumen_pdf_url,
        dokumen_lampiran_url: links.dokumen_lampiran_url,
        dokumen_pencarian_url: links.dokumen_pencarian_url,
        portal_url: links.portal_url,
      };
    });

  const enrichedIndex = index.map((row) => {
    const legal = resolveLegalSource(row.dasar_hukum, catalog);
    const links = provenanceLinks(catalog, legal, row.source_id);
    return {
      ...row,
      legal_source_id: legal.id,
      sumber: {
        label: legal.label,
        ...links,
      },
    };
  });

  manifest.dasar_hukum_summary = dasar_hukum_summary;
  manifest.legal_sources_catalog = 'legal-sources-catalog.json';
  manifest.portal = catalog.portal_bangun_jakarta;
  manifest.data_layers = {
    ahsp_regulasi:
      'Satu sub-bundel AHSP per dasar hukum: paket @ahs-id/ahsp-dcktrp-by-source (koefisien dari breakdown portal).',
    hsd_daerah: 'Harga komponen DKI: @ahs-id/hsd-jakarta-2026.',
    hsp_portal: 'Harga satuan jadi: @ahs-id/hsp-jakarta-dcktrp (katalog ini).',
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(indexPath, JSON.stringify(enrichedIndex, null, 2) + '\n', 'utf8');
  console.log(`Updated manifest + index: ${dasar_hukum_summary.length} legal sources with links.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
