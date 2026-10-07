/**
 * Per-table page_no for SE 47 checkpoints (fast interpolate; optional Docling enrich).
 *
 *   node scripts/run-se47-enrich-pages.mjs
 *   node scripts/run-se47-enrich-pages.mjs --docling   # slow: re-scan every batch
 */
import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'tools', 'docling');
const EXE = join(ROOT, '.venv', 'Scripts', 'ahs-docling.exe');
const LOG = join(ROOT, 'output', 'se47-enrich-pages.log');

/** BM benefits most from page hints; SDA/CK keep batch ranges unless Docling enrich. */
const JOBS = [
  { id: '10903', out: 'output/cipta-karya-se-47-2026', interpolate: true },
  { id: '10901', out: 'output/sda-se-47-2026', interpolate: false },
  { id: '10904', out: 'output/bina-marga-lampiran-v-national', interpolate: false },
];

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await appendFile(LOG, line, 'utf8');
  console.log(line.trim());
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

const useDocling = process.argv.includes('--docling');

for (const job of JOBS) {
  const pdf = `sources/national/se-47-2026--sdm_download--id-${job.id}.pdf`;
  const ck = join(job.out, 'checkpoints');
  await log(`=== ${job.id} ${job.out} ===`);
  if (useDocling) {
    await log(`enrich-pages (Docling) ${job.out}`);
    await run(EXE, [
      'enrich-pages',
      pdf,
      '--checkpoints',
      ck,
      '--reassemble',
      '--chunk-size',
      '10',
    ]);
  } else if (job.interpolate) {
    await log(`assign-page-estimates ${job.out}`);
    await run(EXE, ['assign-page-estimates', '--checkpoints', ck]);
  } else {
    await log(`skip interpolate ${job.out} (use link page + PDF refine)`);
  }
}

await log('Done enrich-pages');
