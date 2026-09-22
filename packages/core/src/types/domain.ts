declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

/**
 * Indonesian Rupiah.
 *
 * Example: a component unit price of Rp 135_000 is `idr(135_000)`.
 * JSON and audit numbers stay plain numbers; the brand exists only in TypeScript.
 */
export type IDR = Brand<number, 'IDR'>;

/**
 * Share of a whole, from 0 to 1.
 *
 * Example: 10% overhead stored as a fraction is `percentage(0.10)`, not `10`.
 */
export type Percentage = Brand<number, 'Percentage'>;

/**
 * Percentage points, from 0 to 100.
 *
 * Example: AHSP overhead of 10% and profit of 5% are `percentagePoints(10)` and
 * `percentagePoints(5)`. A coefficient such as 0.065 is a plain number, not a percentage.
 */
export type PercentagePoints = Brand<number, 'PercentagePoints'>;

/**
 * Volume in cubic metres.
 *
 * Example: 1.25 m³ of compacted aggregate is `volume(1.25)`.
 */
export type Volume = Brand<number, 'Volume'>;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

/** Brand a finite Rupiah amount. */
export function idr(value: number): IDR {
  assertFinite(value, 'IDR');
  return value as IDR;
}

/** Brand a fraction in the closed range 0..1. `0.10` means 10%. */
export function percentage(value: number): Percentage {
  assertFinite(value, 'Percentage');
  if (value < 0 || value > 1) {
    throw new Error('Percentage must be a fraction from 0 to 1 (0.10 = 10%)');
  }
  return value as Percentage;
}

/** Brand percentage points in the closed range 0..100. `10` means 10%. */
export function percentagePoints(value: number): PercentagePoints {
  assertFinite(value, 'PercentagePoints');
  if (value < 0 || value > 100) {
    throw new Error('PercentagePoints must be from 0 to 100');
  }
  return value as PercentagePoints;
}

/** Brand a cubic-metre volume. Negative volumes are rejected. */
export function volume(value: number): Volume {
  assertFinite(value, 'Volume');
  if (value < 0) {
    throw new Error('Volume must be >= 0');
  }
  return value as Volume;
}
