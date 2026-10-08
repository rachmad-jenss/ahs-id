/**
 * Overlay component harga_satuan_ref onto @ahs-id/ahsp-se-binkon-47-2026 items
 * from packages/ahsp-dcktrp-by-source (Jakarta portal).
 *
 * Item join: kode_ahsp only.
 * Component price join: component `ref` first, then normalized `nama` (national
 * rows often have ref:null). Never invents prices. Unmatched stay at 0.
 *
 * Writes a bidang file only when at least one item matched (avoids SDA/BM churn).
 *
 *   node scripts/enrich-se47-prices-from-dcktrp.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portalPath = join(
  root,
  'packages/ahsp-dcktrp-by-source/data/se-binkon-47-2026/items.json',
);
const bidangFiles = [
  ['sda', join(root, 'packages/ahsp-se-binkon-47-2026/data/sda/items.json')],
  ['bina-marga', join(root, 'packages/ahsp-se-binkon-47-2026/data/bina-marga/items.json')],
  ['cipta-karya', join(root, 'packages/ahsp-se-binkon-47-2026/data/cipta-karya/items.json')],
];

function normName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function priceMapFromPortalItem(portalItem) {
  /** @type {Map<string, number>} */
  const byRef = new Map();
  /** @type {Map<string, number>} */
  const byName = new Map();
  for (const section of ['tenaga_kerja', 'bahan', 'peralatan']) {
    for (const row of portalItem[section] ?? []) {
      const price = row.harga_satuan_ref;
      if (typeof price !== 'number' || !(price > 0)) continue;
      if (typeof row.ref === 'string' && row.ref) byRef.set(row.ref, price);
      byName.set(normName(row.nama), price);
    }
  }
  return { byRef, byName };
}

function applyPrices(nationalItem, portalItem) {
  const { byRef, byName } = priceMapFromPortalItem(portalItem);
  let filled = 0;
  let skipped = 0;

  const mapSection = (rows) =>
    (rows ?? []).map((row) => {
      const fromRef = typeof row.ref === 'string' && row.ref ? byRef.get(row.ref) : undefined;
      const fromName = byName.get(normName(row.nama));
      const next = fromRef ?? fromName;
      if (typeof next === 'number' && next > 0) {
        filled += 1;
        return { ...row, harga_satuan_ref: next };
      }
      skipped += 1;
      return row;
    });

  const nextItem = {
    ...nationalItem,
    tenaga_kerja: mapSection(nationalItem.tenaga_kerja),
    bahan: mapSection(nationalItem.bahan),
    peralatan: mapSection(nationalItem.peralatan),
    catatan_umum: [
      ...(nationalItem.catatan_umum ?? []),
      'harga_satuan_ref komponen diisi dari HSP portal DCKTRP Jakarta (exemplar DKI), bukan kolom harga PDF lampiran nasional.',
    ].filter((v, i, arr) => arr.indexOf(v) === i),
  };

  if (
    typeof portalItem.harga_satuan_pekerjaan_ref === 'number'
    && portalItem.harga_satuan_pekerjaan_ref > 0
  ) {
    nextItem.harga_satuan_pekerjaan_ref = portalItem.harga_satuan_pekerjaan_ref;
  }

  return { item: nextItem, filled, skipped };
}

const portal = JSON.parse(await readFile(portalPath, 'utf8'));
const portalByCode = new Map(portal.map((row) => [row.kode_ahsp, row]));

const report = {
  generatedAt: new Date().toISOString(),
  portalItems: portal.length,
  bidang: {},
};

for (const [bidang, filePath] of bidangFiles) {
  const items = JSON.parse(await readFile(filePath, 'utf8'));
  let matched = 0;
  let componentsFilled = 0;
  let componentsSkipped = 0;
  const samples = [];

  const nextItems = items.map((item) => {
    const portalItem = portalByCode.get(item.kode_ahsp);
    if (!portalItem) return item;
    matched += 1;
    const { item: enriched, filled, skipped } = applyPrices(item, portalItem);
    componentsFilled += filled;
    componentsSkipped += skipped;
    if (samples.length < 5 && filled > 0) samples.push(item.kode_ahsp);
    return enriched;
  });

  if (matched > 0) {
    await writeFile(filePath, `${JSON.stringify(nextItems, null, 2)}\n`, 'utf8');
  }
  report.bidang[bidang] = {
    items: items.length,
    matched,
    componentsFilled,
    componentsSkipped,
    samples,
  };
  console.log(
    `${bidang}: matched ${matched}/${items.length}, filled ${componentsFilled} component prices` +
      (matched > 0 ? '' : ' (skip write)'),
  );
}

const reportPath = join(root, 'packages/ahsp-se-binkon-47-2026/data/dcktrp-price-enrich-report.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Wrote ${reportPath}`);
