import type { AhspItem, VariabelDefinition, VariabelInput } from '../types/index.js';

const MARGIN_KEYS = ['overhead_pct', 'profit_pct'] as const;

/**
 * Reject unknown keys and invalid declared values on the root AHSP call.
 * Omitted keys stay omitted so estimasi-kasar can still fall back.
 */
export function validateRootVariabel(item: AhspItem, input: VariabelInput): void {
  const allowed = new Set<string>([...Object.keys(item.variabel), ...MARGIN_KEYS]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new Error(`AHSP "${item.kode_ahsp}": unknown variabel "${key}"`);
    }
  }
  validateDeclaredVariabel(item, input);
  validateMargin(item, 'overhead_pct', item.margin.overhead_pct, input['overhead_pct']);
  validateMargin(item, 'profit_pct', item.margin.profit_pct, input['profit_pct']);
}

/**
 * Check only variables this item declares. Parent-only keys are ignored
 * so a nested AHSP does not fail on inputs that belong to its parent.
 */
export function validateDeclaredVariabel(item: AhspItem, input: VariabelInput): void {
  for (const [key, def] of Object.entries(item.variabel)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    assertVariabelValue(item.kode_ahsp, key, def, input[key]);
  }
}

export function assertFiniteMoney(kodeAhsp: string, label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`AHSP "${kodeAhsp}": ${label} is not a finite number`);
  }
}

function validateMargin(
  item: AhspItem,
  key: string,
  bounds: { readonly min: number; readonly max: number },
  value: number | string | undefined,
): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`AHSP "${item.kode_ahsp}": ${key} must be a finite number`);
  }
  if (value < bounds.min || value > bounds.max) {
    throw new Error(
      `AHSP "${item.kode_ahsp}": ${key} ${value} is outside ${bounds.min}..${bounds.max}`,
    );
  }
}

function assertVariabelValue(
  kodeAhsp: string,
  key: string,
  def: VariabelDefinition,
  value: number | string | undefined,
): void {
  if (value === undefined || value === '') {
    throw new Error(`AHSP "${kodeAhsp}": variabel "${key}" is empty`);
  }

  if (def.tipe === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`AHSP "${kodeAhsp}": variabel "${key}" must be a finite number`);
    }
    if (def.min !== undefined && value < def.min) {
      throw new Error(`AHSP "${kodeAhsp}": variabel "${key}" ${value} is below min ${def.min}`);
    }
    if (def.max !== undefined && value > def.max) {
      throw new Error(`AHSP "${kodeAhsp}": variabel "${key}" ${value} is above max ${def.max}`);
    }
    return;
  }

  if (def.tipe === 'enum') {
    const options = def.options ?? [];
    if (typeof value !== 'string' || !options.includes(value)) {
      throw new Error(
        `AHSP "${kodeAhsp}": variabel "${key}" must be one of ${options.join(', ')}`,
      );
    }
    return;
  }

  const unreachable: never = def.tipe;
  throw new Error(`AHSP "${kodeAhsp}": unsupported variabel type ${String(unreachable)}`);
}
