/**
 * Node orchestrator: wait for SDA extract, analyze, link-kode, then BM same.
 * Run: node scripts/run-se47-ahsp-chain.mjs
 */
import { spawn } from 'node:child_process';
import { readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'tools', 'docling');
const EXE = join(ROOT, '.venv', 'Scripts', 'ahs-docling.exe');
const LOG = join(ROOT, 'output', 'se47-ahsp-chain.log');

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
    return JSON.parse(await readFile(join(outDir, 'progress.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function findTablesJson(outDir, downloadId) {
  const { readdir, stat } = await import('node:fs/promises');
  const names = (await readdir(outDir)).filter((n) => n.endsWith('-tables.json'));
  if (!names.length) return null;
  if (downloadId) {
    const prefer = names.find((n) => n.includes(`id-${downloadId}`));
    if (prefer) return join(outDir, prefer);
  }
  const sized = await Promise.all(
    names.map(async (n) => ({ n, size: (await stat(join(outDir, n))).size })),
  );
  sized.sort((a, b) => b.size - a.size);
  return join(outDir, sized[0].n);
}

function downloadIdFromPdf(pdfRel) {
  const m = String(pdfRel).match(/id-(\d+)\.pdf$/);
  return m ? m[1] : undefined;
}

async function waitExtractDone(outDir, pdfRel) {
  const downloadId = downloadIdFromPdf(pdfRel);
  for (;;) {
    const tables = await findTablesJson(outDir, downloadId);
    const p = await readProgress(outDir);
    if (p?.status === 'done' && p.completed_pages >= p.total_pages && tables) {
      return tables;
    }
    if (p) {
      await log(`extract ${outDir} ${p.percent}% batch ${p.chunk} tables=${p.tables_found}`);
    } else if (tables) {
      return tables;
    }
    await new Promise((r) => setTimeout(r, 90_000));
  }
}

function extractIncomplete(p) {
  if (!p) return true;
  return p.status !== 'done' || p.completed_pages < p.total_pages;
}

/**
 * @param {{ formular?: boolean; ckInline?: boolean; sdaIndex?: boolean }} link
 */
async function phase(name, pdfRel, outRel, link = {}) {
  await log(`=== Phase: ${name} ===`);
  const pdf = join(ROOT, pdfRel);
  const outDir = join(ROOT, outRel);
  let p = await readProgress(outDir);
  if (extractIncomplete(p)) {
    await log(`extract (resume) ${outRel}`);
    // SDA/BM/CK full runs used 10 pages/batch — required for checkpoint resume.
    await run(EXE, ['extract', pdf, '-o', outDir, '--chunk-size', '10']);
  } else {
    await log(`extract already done, skipping`);
  }
  const tablesPath = await waitExtractDone(outDir, pdfRel);
  const cleaned = join(outDir, 'cleaned');
  await log(`analyze ${tablesPath}`);
  await run(EXE, ['analyze', tablesPath, '-o', cleaned]);
  const hsp = join(cleaned, 'hsp-parsed.jsonl');
  try {
    await readFile(hsp, 'utf8');
  } catch {
    await log('WARN: no hsp-parsed.jsonl - skip link-kode');
    return;
  }
  const linked = join(cleaned, 'hsp-linked.jsonl');
  const linkArgs = [
    'link-kode',
    '--pdf',
    pdf,
    '--hsp-parsed',
    hsp,
    '--checkpoints',
    join(outDir, 'checkpoints'),
    '-o',
    linked,
  ];
  if (link.sdaIndex) linkArgs.push('--item-index', join(cleaned, 'item-index.csv'));
  if (link.formular) linkArgs.push('--formular');
  if (link.ckInline) linkArgs.push('--ck-inline');
  await log(`link-kode -> ${linked}`);
  await run(EXE, linkArgs);
  await log(`=== Phase ${name} done ===`);
}

await log('SE 47 AHSP chain started (node)');
await phase(
  'SDA Lampiran IV',
  'sources/national/se-47-2026--sdm_download--id-10901.pdf',
  'output/sda-se-47-2026',
  { sdaIndex: true },
);
await phase(
  'Bina Marga (SDM 10903)',
  'sources/national/se-47-2026--sdm_download--id-10903.pdf',
  'output/cipta-karya-se-47-2026',
  { formular: true },
);
await phase(
  'Cipta Karya (SDM 10904)',
  'sources/national/se-47-2026--sdm_download--id-10904.pdf',
  'output/bina-marga-lampiran-v-national',
  { ckInline: true },
);
await log('All phases complete.');
