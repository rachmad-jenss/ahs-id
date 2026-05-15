declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type IDR = Brand<number, 'IDR'>;
export type Percentage = Brand<number, 'Percentage'>;
export type Volume = Brand<number, 'Volume'>;

export function idr(value: number): IDR {
  return value as IDR;
}

export function percentage(value: number): Percentage {
  return value as Percentage;
}

export function volume(value: number): Volume {
  return value as Volume;
}
