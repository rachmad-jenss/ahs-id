/**
 * Docling page_no on BM gap checkpoint batches only, then reassemble *-tables.json.
 *
 *   node scripts/run-se47-enrich-gap-batches.mjs
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const DOCLING = join(REPO, 'tools', 'docling');
const PY = join(DOCLING, '.venv', 'Scripts', 'python.exe');
const CHUNK = 10;

const code = `
import json
import re
from pathlib import Path
from ahs_id.docling_convert import (
    _CKPT_RE,
    _load_checkpoint,
    _write_checkpoint_atomic,
    build_converter,
    _extract_tables_from_doc,
    prepare_long_extract_env,
    _safe_stderr,
    convert_document,
    write_conversion_artifacts,
)

pdf = Path('sources/national/se-47-2026--sdm_download--id-10903.pdf')
out = Path('output/cipta-karya-se-47-2026')
ckpt = out / 'checkpoints'
gaps = json.loads(Path('output/se47-bm-hsp-gaps.json').read_text(encoding='utf-8'))['gaps']
pages = sorted({p for g in gaps for p in (g['title_page'], g['hsp_page'])})

def batch_start(p):
    return (p - 1) // ${CHUNK} * ${CHUNK} + 1

wanted = set()
for p in pages:
    s = batch_start(p)
    wanted.add(f"batch-{s:06d}-{s + ${CHUNK} - 1:06d}.json")

prepare_long_extract_env()
converter = None
updated = 0
for name in sorted(wanted):
    path = ckpt / name
    if not path.is_file():
        print('skip missing', name)
        continue
    m = _CKPT_RE.match(name)
    p_start, p_end = int(m.group(1)), int(m.group(2))
    data = _load_checkpoint(path)
    if data is None:
        continue
    tables = data.get('tables', [])
    if converter is None:
        converter = build_converter(enable_ocr=False)
    with _safe_stderr():
        conv = converter.convert(str(pdf), page_range=(p_start, p_end))
    fresh = _extract_tables_from_doc(conv.document)
    if len(fresh) != len(tables):
        print('mismatch', name, len(tables), len(fresh))
    span = p_end - p_start + 1
    for i, tbl in enumerate(tables):
        if i < len(fresh) and isinstance(fresh[i].get('page_no'), int):
            tbl['page_no'] = fresh[i]['page_no']
            tbl.pop('page_estimate', None)
        else:
            est = p_start + (i * span) // max(len(tables), 1)
            tbl['page_no'] = min(p_end, max(p_start, est))
            tbl['page_estimate'] = True
    _write_checkpoint_atomic(path, data)
    updated += 1
    print('enriched', name, 'tables', len(tables))

print('updated_batches', updated)
result = convert_document(
    pdf,
    chunk_size=${CHUNK},
    show_progress=True,
    status_path=out / 'progress.json',
    checkpoint_dir=ckpt,
    resume=True,
)
paths = write_conversion_artifacts(result, out)
print('reassembled', paths['tables_json'])
`;

await new Promise((resolve, reject) => {
  const child = spawn(PY, ['-c', code], { cwd: DOCLING, stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  child.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`enrich exit ${c}`))));
});

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(REPO, 'scripts/run-se47-coverage.mjs'), '--skip-extract', '--only=10903'], {
    cwd: REPO,
    stdio: 'inherit',
  });
  child.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`coverage exit ${c}`))));
});

await import('node:child_process').then(({ spawn }) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(REPO, 'scripts/run-se47-patch-hsp-gaps.mjs')], { cwd: REPO, stdio: 'inherit' });
    child.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`gaps exit ${c}`))));
  }),
);
