/**
 * SE 47 bidang AHSP: link + full-check + gate (extract assumed done on national PDFs).
 *
 *   node scripts/run-se47-validate-all.mjs
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const DOCLING = join(REPO, 'tools', 'docling');
const LOG = join(DOCLING, 'output', 'se47-validate-all.log');
const GATE = join(DOCLING, 'output', 'se47-validation-gate.json');

/** Legacy folder names — see SE-47-2026-download-map.json (10903=BM, 10904=CK). */
const OUT = {
  sda: 'output/sda-se-47-2026',
  bm: 'output/cipta-karya-se-47-2026',
  ck: 'output/bina-marga-lampiran-v-national',
};

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await appendFile(LOG, line, 'utf8');
  console.log(line.trim());
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(REPO, 'scripts', script), ...args], {
      cwd: REPO,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function readProgress(outRel) {
  try {
    return JSON.parse(await readFile(join(DOCLING, outRel, 'progress.json'), 'utf8'));
  } catch {
    return null;
  }
}

function extractDone(p) {
  return p?.status === 'done' && p.completed_pages >= p.total_pages;
}

async function readSummary(outRel) {
  const path = join(DOCLING, outRel, 'cleaned', 'full-check-report.json');
  const report = JSON.parse(await readFile(path, 'utf8'));
  return report.summary;
}

async function readManifest(outRel) {
  const path = join(DOCLING, outRel, 'cleaned', 'manifest.json');
  return JSON.parse(await readFile(path, 'utf8'));
}

function manifestClean(m) {
  const h = m?.hsp_breakdown;
  if (!h?.total) return true;
  return h.verified_ok === h.total && (h.with_issues ?? 0) === 0;
}

await log('=== SE 47 validate-all (page estimates + link + full-check) ===');

for (const [label, out] of Object.entries(OUT)) {
  const p = await readProgress(out);
  if (!extractDone(p)) {
    throw new Error(`${label} extract incomplete: ${out} — run national extract first`);
  }
}

await log('Per-table page estimates on checkpoints (SDA/BM/CK)');
await runNode('run-se47-enrich-pages.mjs');

await log('Link SDA + BM (formular on 10903) + CK (ck-inline on 10904)');
await runNode('run-se47-coverage.mjs', ['--skip-extract', '--only=10901,10903,10904']);

await log('Full-check SDA, BM, CK');
await runNode('run-se47-full-check.mjs', ['-NoResume']);

const manifests = {
  sda: await readManifest(OUT.sda),
  bm: await readManifest(OUT.bm),
  ck: await readManifest(OUT.ck),
};

const summaries = {
  sda: await readSummary(OUT.sda),
  bm: await readSummary(OUT.bm),
  ck: await readSummary(OUT.ck),
};

let bmLink = null;
let sdaLink = null;
let ckLink = null;
try {
  bmLink = JSON.parse(
    await readFile(join(DOCLING, OUT.bm, 'cleaned', 'kode-link-summary.json'), 'utf8'),
  );
} catch {
  /* optional */
}
try {
  sdaLink = JSON.parse(await readFile(join(DOCLING, OUT.sda, 'cleaned', 'kode-link-summary.json'), 'utf8'));
} catch {
  /* optional */
}
try {
  ckLink = JSON.parse(await readFile(join(DOCLING, OUT.ck, 'cleaned', 'kode-link-summary.json'), 'utf8'));
} catch {
  /* optional */
}

const gate = {
  generated_at: new Date().toISOString(),
  sdm_id_map: { bm: '10903', ck: '10904', sda: '10901' },
  output_folders: OUT,
  manifests: {
    sda: manifests.sda.hsp_breakdown,
    bm: manifests.bm.hsp_breakdown,
    ck: manifests.ck.hsp_breakdown,
  },
  bm_formular_link: bmLink,
  sda_link: sdaLink,
  ck_link: ckLink,
  full_check: summaries,
  ok:
    manifestClean(manifests.sda) &&
    manifestClean(manifests.bm) &&
    manifestClean(manifests.ck) &&
    summaries.sda.sample_size > 0 &&
    summaries.bm.sample_size > 0 &&
    summaries.ck.sample_size > 0 &&
    summaries.sda.fail <= 11 &&
    (sdaLink?.link_rate_pct ?? 0) >= 90 &&
    (ckLink?.link_rate_pct ?? 0) >= 90 &&
    (bmLink?.formular_block_link_rate_with_extract_pct ?? 0) >= 95 &&
    (bmLink?.formular_blocks_linked_with_extract ?? bmLink?.formular_blocks_linked ?? 0) >=
      Math.ceil(0.95 * (bmLink?.formular_blocks_with_extracted_hsp ?? 0)) &&
    (bmLink?.canonical_hsp_tables ?? 0) >= (bmLink?.formular_blocks_linked ?? 0),
};

await writeFile(GATE, JSON.stringify(gate, null, 2));
await log(
  `Gate ok=${gate.ok} BM blocks=${bmLink?.formular_blocks_linked ?? '?'}/${bmLink?.formular_blocks ?? '?'} ` +
    `(${bmLink?.formular_block_link_rate_on_eligible_pct ?? '?'}% raw, ` +
    `${bmLink?.formular_block_link_rate_with_extract_pct ?? '?'}% with-extract, ` +
    `${bmLink?.formular_blocks_without_extracted_hsp ?? '?'} no-extract)`,
);

if (!gate.ok) process.exit(1);
