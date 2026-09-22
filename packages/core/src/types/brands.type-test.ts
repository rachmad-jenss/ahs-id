import {
  idr,
  percentage,
  percentagePoints,
  volume,
  type HSPResult,
  type HsdTenagaKerjaEntry,
  type IDR,
  type Percentage,
  type PercentagePoints,
  type Volume,
} from '../index.js';

/** Public totals are Rupiah, not raw numbers. */
export function rupiahTotal(result: HSPResult): IDR {
  return result.grandTotal;
}

/** Overhead on a calculation result is percentage points (`10` = 10%). */
export function overheadPoints(result: HSPResult): PercentagePoints {
  return result.overheadPct;
}

const unitPrice = idr(135_000);
const overheadFraction = percentage(0.1);
const overheadPointsValue = percentagePoints(10);
const compacted = volume(1.25);

void unitPrice;
void overheadFraction;
void overheadPointsValue;
void compacted;

// @ts-expect-error raw numbers are not IDR
const rawMoney: IDR = 135_000;

// @ts-expect-error IDR cannot be used as volume
const moneyAsVolume: Volume = unitPrice;

// @ts-expect-error percentage points are not a 0–1 fraction
const pointsAsFraction: Percentage = overheadPointsValue;

// @ts-expect-error a fraction is not percentage points
const fractionAsPoints: PercentagePoints = overheadFraction;

// @ts-expect-error volume is not money
const volumeAsMoney: IDR = compacted;

// @ts-expect-error HSD unit prices must be constructed as IDR
const rawHsdPrice: HsdTenagaKerjaEntry['harga_rp'] = 135_000;

void rawMoney;
void moneyAsVolume;
void pointsAsFraction;
void fractionAsPoints;
void volumeAsMoney;
void rawHsdPrice;
