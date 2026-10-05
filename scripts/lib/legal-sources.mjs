import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG_PATH = join(fileURLToPath(new URL('..', import.meta.url)), '..', 'packages', 'core', 'data', 'legal-sources-catalog.json');

/** @typedef {{ id: string, label: string, jenis?: string, dokumen_url?: string | null, dokumen_pdf_url?: string | null, dokumen_lampiran_url?: string | null, dokumen_pencarian_url?: string | null, portal_url?: string | null, aliases?: string[] }} LegalSource */

export async function loadLegalSourcesCatalog() {
  return JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
}

function normalizeLabel(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

/** Fallback: map portal free-text to national source id (not Jakarta portal). */
function resolveByPattern(normalized) {
  const u = normalized.toUpperCase();
  if (/47\s*\/\s*SE\s*\/\s*DK\s*\/\s*2026/i.test(normalized)) return 'se-binkon-47-2026';
  if (/182\s*\/\s*SE\s*\/\s*DK\s*\/\s*2025/i.test(normalized)) return 'se-binkon-182-2025';
  if (/30\s*\/\s*SE\s*\/\s*DK\s*\/\s*2025/i.test(normalized)) return 'se-binkon-30-2025';
  if (/73\s*\/\s*SE\s*\/\s*DK\s*\/\s*2023/i.test(normalized)) return 'se-binkon-73-2023';
  if (/68\s*\/\s*SE\s*\/\s*DK\s*\/\s*2024/i.test(normalized)) return 'se-binkon-68-2024';
  if (/PERMEN\s+PUPR\s+NO\.?\s*8\s+TAHUN\s+2023/i.test(u)) return 'permen-pupr-8-2023';
  if (/PERMEN\s+PUPR\s+NO\.?\s*1\s+TAHUN\s+2022/i.test(u)) return 'permen-pupr-1-2022';
  if (/SNI\s+7394/i.test(u)) return 'sni-7394-2008';
  if (/E-?BUDGETING\s+2019/i.test(u)) return 'bina-konstruksi-ebudgeting-2019';
  if (u === 'BINA KONSTRUKSI' || u === 'BINA KONSTRUKSI') return 'bina-konstruksi-generik';
  if (u === 'SE DIRJEN' || u.startsWith('SE DIRJEN')) {
    if (/182/.test(u)) return 'se-binkon-182-2025';
    if (/30/.test(u)) return 'se-binkon-30-2025';
    if (/47/.test(u)) return 'se-binkon-47-2026';
    if (/73/.test(u)) return 'se-binkon-73-2023';
  }
  return null;
}

/**
 * @param {string} rawLabel
 * @param {{ sources: LegalSource[], portal_bangun_jakarta?: LegalSource }} catalog
 */
export function resolveLegalSource(rawLabel, catalog) {
  const normalized = normalizeLabel(rawLabel);
  for (const source of catalog.sources) {
    if (source.label === normalized) return source;
    if (source.aliases?.some((alias) => normalizeLabel(alias) === normalized)) return source;
  }
  const patternId = resolveByPattern(normalized);
  if (patternId) {
    const hit = catalog.sources.find((s) => s.id === patternId);
    if (hit) return hit;
  }
  return catalog.sources.find((s) => s.id === 'tidak-tercantum');
}

export function portalItemUrl(catalog, portalPekerjaanId) {
  const base = catalog.portal_bangun_jakarta?.api_hsp_base ?? 'https://dcktrp.jakarta.go.id/bangunjakarta/portal/api/hsp';
  return `${base}?id=${portalPekerjaanId}`;
}

export function provenanceLinks(catalog, legalSource, portalItemId) {
  const primaryDoc =
    legalSource.dokumen_url ??
    legalSource.dokumen_pdf_url ??
    legalSource.dokumen_lampiran_url ??
    null;
  return {
    source_id: legalSource.id,
    dokumen_url: primaryDoc,
    dokumen_pdf_url: legalSource.dokumen_pdf_url ?? null,
    dokumen_lampiran_url: legalSource.dokumen_lampiran_url ?? null,
    dokumen_pencarian_url: legalSource.dokumen_pencarian_url ?? null,
    portal_url: legalSource.portal_url ?? null,
    portal_item_url: portalItemId != null ? portalItemUrl(catalog, portalItemId) : null,
  };
}
