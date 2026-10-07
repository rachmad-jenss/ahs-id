/**
 * SE 47/2026 lampiran: analyze + link-kode where applicable (national PDFs in tools/docling).
 *
 * Usage: node scripts/run-se47-coverage.mjs [--skip-extract] [--only id1,id2]
 */
import { spawn } from 'node:child_process';
import { readFile, readdir, stat, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'tools', 'docling');
const EXE = join(ROOT, '.venv', 'Scripts', 'ahs-docling.exe');
const MAP = join(ROOT, 'sources', 'national', 'SE-47-2026-download-map.json');
const LOG = join(ROOT, 'output', 'se47-coverage.log');

/** @type {Record<string, { outDir: string, link?: 'sda' | 'formular' | 'ck-inline' }>} */
const PROFILE = {
  '10894': { outDir: 'output/se-47-2026-id-10894' },
  '10897': { outDir: 'output/se-47-2026-id-10897' },
  '10899': { outDir: 'output/se-47-2026-id-10899' },
  '10901': { outDir: 'output/sda-se-47-2026', link: 'sda' },
  // SDM download_id ≠ urutan lampiran: 10903 = BM (3125p), 10904 = CK (1563p) — verifikasi teks halaman 1 PDF.
  '10903': { outDir: 'output/cipta-karya-se-47-2026', link: 'formular' },
  '10904': { outDir: 'output/bina-marga-lampiran-v-national', link: 'ck-inline' },
  '10906': { outDir: 'output/se-47-2026-id-10906', link: 'ck-inline' },
};

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await appendFile(LOG, line, 'utf8');
  console.log(line.trim());
}

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function readProgress(outDir) {
  try {
    return JSON.parse(await readFile(join(ROOT, outDir, 'progress.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Prefer national SDM assemble (`id-NNNNN`) over stale lampiran-named JSON in same folder. */
async function findTablesJson(outDir, downloadId) {
  const dir = join(ROOT, outDir);
  const names = (await readdir(dir)).filter((n) => n.endsWith('-tables.json'));
  if (!names.length) return null;
  if (downloadId) {
    const prefer = names.find((n) => n.includes(`id-${downloadId}`));
    if (prefer) return join(dir, prefer);
  }
  const sized = await Promise.all(
    names.map(async (n) => ({ n, size: (await stat(join(dir, n))).size })),
  );
  sized.sort((a, b) => b.size - a.size);
  return join(dir, sized[0].n);
}

function extractIncomplete(p) {
  if (!p) return true;
  return p.status !== 'done' || p.completed_pages < p.total_pages;
}

async function phaseExtract(pdfRel, outRel, skipExtract) {
  const pdf = join(ROOT, pdfRel);
  const outDir = join(ROOT, outRel);
  const p = await readProgress(outRel);
  if (skipExtract) {
    if (extractIncomplete(p)) await log(`SKIP extract (incomplete): ${outRel}`);
    return !extractIncomplete(p);
  }
  if (extractIncomplete(p)) {
    await log(`extract (resume) ${outRel}`);
    await run(EXE, ['extract', pdf, '-o', outDir, '--chunk-size', '10']);
  }
  return !extractIncomplete(await readProgress(outRel));
}

async function phaseAnalyze(outRel, downloadId) {
  const tablesPath = await findTablesJson(outRel, downloadId);
  if (!tablesPath) {
    await log(`WARN no tables.json: ${outRel}`);
    return null;
  }
  const cleaned = join(ROOT, outRel, 'cleaned');
  await log(`analyze ${outRel}`);
  await run(EXE, ['analyze', tablesPath, '-o', cleaned]);
  const manifest = JSON.parse(await readFile(join(cleaned, 'manifest.json'), 'utf8'));
  return manifest;
}

async function phaseLink(pdfRel, outRel, mode) {
  if (!mode) return;
  const cleaned = join(ROOT, outRel, 'cleaned');
  const hsp = join(cleaned, 'hsp-parsed.jsonl');
  const linked = join(cleaned, 'hsp-linked.jsonl');
  const manifest = JSON.parse(await readFile(join(cleaned, 'manifest.json'), 'utf8'));
  const hspCount = manifest?.hsp_breakdown?.total ?? 0;
  if (hspCount === 0) {
    await log(`link skipped (0 HSP tables): ${outRel}`);
    return;
  }
  const linkArgs = [
    'link-kode',
    '--pdf',
    join(ROOT, pdfRel),
    '--hsp-parsed',
    hsp,
    '--checkpoints',
    join(ROOT, outRel, 'checkpoints'),
    '-o',
    linked,
  ];
  if (mode === 'sda') {
    linkArgs.push('--item-index', join(cleaned, 'item-index.csv'));
  }
  if (mode === 'formular') linkArgs.push('--formular');
  if (mode === 'ck-inline') linkArgs.push('--ck-inline');
  await log(`link-kode (${mode}) ${outRel}`);
  await run(EXE, linkArgs);
}

const args = process.argv.slice(2);
const skipExtract = args.includes('--skip-extract');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',')) : null;

const map = JSON.parse(await readFile(MAP, 'utf8'));
const summary = [];

for (const row of map.downloads) {
  const id = row.download_id;
  if (only && !only.has(id)) continue;
  const profile = PROFILE[id];
  if (!profile) {
    await log(`skip unmapped download_id ${id} (${row.label})`);
    continue;
  }
  const pdfRel = `sources/national/se-47-2026--sdm_download--id-${id}.pdf`;
  await log(`=== ${id} ${row.label} ===`);
  const ready = await phaseExtract(pdfRel, profile.outDir, skipExtract);
  if (!ready) {
    summary.push({ id, label: row.label, status: 'extract_incomplete' });
    continue;
  }
  const manifest = await phaseAnalyze(profile.outDir, id);
  if (manifest) await phaseLink(pdfRel, profile.outDir, profile.link);
  const cleaned = join(ROOT, profile.outDir, 'cleaned');
  let linkSummary = null;
  try {
    linkSummary = JSON.parse(await readFile(join(cleaned, 'kode-link-summary.json'), 'utf8'));
  } catch {
    /* no link */
  }
  summary.push({
    id,
    label: row.label,
    status: 'ok',
    tables: manifest?.source_tables,
    hsp_breakdown: manifest?.hsp_breakdown?.total,
    linked: linkSummary?.linked,
    link_rate_pct: linkSummary?.link_rate_pct,
  });
}

const outPath = join(ROOT, 'output', 'se47-coverage-summary.json');
await writeFile(outPath, JSON.stringify({ generated_at: new Date().toISOString(), rows: summary }, null, 2));
await log(`Wrote ${outPath}`);
