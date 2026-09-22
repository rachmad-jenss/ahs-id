import { createHash } from 'node:crypto';
import { createCalculator } from '../packages/core/dist/index.js';
import { bundle } from '../packages/bina-marga-2022/dist/index.js';
import { hsd } from '../packages/hsd-bm-2022/dist/index.js';

const iterations = readFlag('--iterations', 50);
const rounds = readFlag('--rounds', 5);
const asJson = process.argv.includes('--json');

const calculator = createCalculator(bundle, hsd);
const codes = [];
for (const item of bundle.ahsp_items) {
  try {
    calculator.hitungHSP(item.kode_ahsp, {});
    codes.push(item.kode_ahsp);
  } catch {
    // Unmodelled or variable-gated items stay out of the timed batch.
  }
}
codes.sort();

if (codes.length === 0) {
  console.error('benchmark batch is empty');
  process.exit(1);
}

runBatch();

const roundMs = [];
for (let round = 0; round < rounds; round += 1) {
  const started = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    runBatch();
  }
  roundMs.push(performance.now() - started);
}

const checksum = checksumTotals();
const medianMs = median(roundMs);
const report = {
  iterations,
  rounds,
  itemCount: codes.length,
  roundMs,
  medianMs,
  checksum,
};

if (asJson) {
  console.log(JSON.stringify(report));
} else {
  console.log(`items ${report.itemCount}`);
  console.log(`median ${report.medianMs.toFixed(3)} ms`);
  console.log(`checksum ${report.checksum}`);
}

function runBatch() {
  for (const kode of codes) {
    calculator.hitungHSP(kode, {});
  }
}

function checksumTotals() {
  const hash = createHash('sha256');
  for (const kode of codes) {
    const result = calculator.hitungHSP(kode, {});
    hash.update(`${kode}\t${result.grandTotal}\n`);
  }
  return hash.digest('hex');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function readFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    console.error(`${name} must be a positive integer`);
    process.exit(2);
  }
  return value;
}
