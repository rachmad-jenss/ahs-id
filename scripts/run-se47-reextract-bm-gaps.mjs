/**
 * Re-extract BM (10903) checkpoint batches covering formular link gaps, then reassemble tables.
 *
 *   node scripts/run-se47-reextract-bm-gaps.mjs
 *   node scripts/run-se47-reextract-bm-gaps.mjs --dry-run
 *   node scripts/run-se47-reextract-bm-gaps.mjs --skip-extract   # delete + analyze/link only
 */
import { readFile, unlink, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const DOCLING = join(REPO, 'tools', 'docling');
const EXE = join(DOCLING, '.venv', 'Scripts', 'ahs-docling.exe');
const PDF = join(DOCLING, 'sources/national/se-47-2026--sdm_download--id-10903.pdf');
const OUT = join(DOCLING, 'output/cipta-karya-se-47-2026');
const CKPT = join(OUT, 'checkpoints');
const GAPS = join(DOCLING, 'output/se47-bm-hsp-gaps.json');
const LOG = join(DOCLING, 'output/se47-reextract-bm-gaps.log');
const CHUNK = 10;

const dryRun = process.argv.includes('--dry-run');
const skipExtract = process.argv.includes('--skip-extract');

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await appendFile(LOG, line, 'utf8');
  console.log(line.trim());
}

function batchBounds(page) {
  const start = Math.floor((page - 1) / CHUNK) * CHUNK + 1;
  return { start, end: start + CHUNK - 1 };
}

function batchOverlapsRange(batch, range) {
  return batch.start <= range.end && range.start <= batch.end;
}

/** Pad gap pages into a few contiguous re-extract windows. */
function gapPageRanges(gaps) {
  const pages = [];
  for (const g of gaps) {
    pages.push(g.title_page, g.hsp_page);
  }
  pages.sort((a, b) => a - b);
  const pad = 3;
  const windows = [];
  let lo = pages[0];
  let hi = pages[0];
  for (let i = 1; i < pages.length; i++) {
    const p = pages[i];
    if (p - hi <= 40) {
      hi = p;
    } else {
      windows.push({ start: Math.max(1, lo - pad), end: hi + pad });
      lo = hi = p;
    }
  }
  windows.push({ start: Math.max(1, lo - pad), end: hi + pad });
  return windows;
}

function batchesForRanges(ranges) {
  const seen = new Map();
  for (const range of ranges) {
    let p = batchBounds(range.start).start;
    while (p <= range.end) {
      const b = batchBounds(p);
      const key = `${String(b.start).padStart(6, '0')}-${String(b.end).padStart(6, '0')}`;
      seen.set(key, b);
      p = b.end + 1;
    }
  }
  return [...seen.entries()].sort((a, b) => a[1].start - b[1].start);
}

function run(cmd, args, cwd = DOCLING) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exit ${code}`))));
  });
}

const gapsDoc = JSON.parse(await readFile(GAPS, 'utf8'));
const ranges = gapPageRanges(gapsDoc.gaps);
const batches = batchesForRanges(ranges);

await log(`Gap windows: ${ranges.map((r) => `${r.start}-${r.end}`).join(', ')}`);
await log(`Checkpoint batches to refresh: ${batches.length}`);

for (const [name] of batches) {
  const path = join(CKPT, `batch-${name}.json`);
  if (dryRun) {
    await log(`[dry-run] would delete ${path}`);
    continue;
  }
  try {
    await unlink(path);
    await log(`deleted batch-${name}.json`);
  } catch (err) {
    if (err.code === 'ENOENT') await log(`missing batch-${name}.json (ok)`);
    else throw err;
  }
}

if (!skipExtract && !dryRun) {
  await log('Re-running Docling extract (resume skips untouched batches)…');
  await run(EXE, ['extract', PDF, '-o', OUT, '--chunk-size', String(CHUNK)]);
  await log('Docling page_no on gap checkpoints only (see run-se47-enrich-gap-batches.mjs)');
  await run(process.execPath, [join(REPO, 'scripts/run-se47-enrich-gap-batches.mjs')]);
  return;
}

if (dryRun) {
  await log('Dry run complete.');
  process.exit(0);
}

if (skipExtract) {
  await log('--skip-extract: run analyze + link via coverage script');
} else {
  await log('Extract + interpolate done.');
}

await run(process.execPath, [join(REPO, 'scripts/run-se47-coverage.mjs'), '--skip-extract', '--only=10903']);

await run(process.execPath, [join(REPO, 'scripts/run-se47-patch-hsp-gaps.mjs')]);

await log('Done re-extract BM gaps pass.');
