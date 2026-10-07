/**
 * List BM formular blocks with filled HSP in PDF but no linked table (gap report).
 * Re-extract for those pages: run manually with ahs-docling extract --page-range.
 *
 *   node scripts/run-se47-patch-hsp-gaps.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), 'tools', 'docling');
const EXE = join(ROOT, '.venv', 'Scripts', 'ahs-docling.exe');

function runPy(code) {
  return new Promise((resolve, reject) => {
    const child = spawn(join(ROOT, '.venv', 'Scripts', 'python.exe'), ['-c', code], {
      cwd: ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

const report = await runPy(`
import json
from pathlib import Path
from ahs_id.formular_link import extract_formular_blocks, build_page_index, formular_block_expects_hsp_table, _read_pdf_page_text
import pypdfium2 as pdfium

pdf = Path('sources/national/se-47-2026--sdm_download--id-10903.pdf')
cache = Path('output/cipta-karya-se-47-2026/cleaned/pdf-page-index.json')
blocks = extract_formular_blocks(build_page_index(pdf, cache_path=cache))
linked = set()
for line in Path('output/cipta-karya-se-47-2026/cleaned/hsp-linked.jsonl').read_text(encoding='utf-8').splitlines():
    r = json.loads(line)
    if r.get('kode_ahsp'):
        linked.add((int(r['kode_link_page']), r['kode_ahsp']))
doc = pdfium.PdfDocument(str(pdf))
gaps = []
for b in blocks:
    if (b.hsp_page, b.kode_ahsp) in linked:
        continue
    text = _read_pdf_page_text(doc, b.hsp_page)
    if not formular_block_expects_hsp_table(text):
        continue
    gaps.append({'kode_ahsp': b.kode_ahsp, 'hsp_page': b.hsp_page, 'title_page': b.title_page})
print(json.dumps(gaps, ensure_ascii=False))
`);

const gaps = JSON.parse(report.trim());
const outPath = join(ROOT, 'output', 'se47-bm-hsp-gaps.json');
await writeFile(outPath, JSON.stringify({ generated_at: new Date().toISOString(), gaps }, null, 2));
console.log(`Wrote ${gaps.length} gap(s) to ${outPath}`);
if (gaps.length) {
  const pages = [...new Set(gaps.map((g) => g.hsp_page))].sort((a, b) => a - b);
  console.log('Sample pages to re-extract:', pages.slice(0, 20).join(', '));
  console.log('Example: ahs-docling extract <pdf> -o output/... --page-range 37-40 --chunk-size 10');
}
