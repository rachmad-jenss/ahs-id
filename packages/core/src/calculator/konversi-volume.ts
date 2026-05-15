import type { FaktorKonversiEntry, VolumeState } from '../types/index.js';

export interface ConvertVolumeResult {
  readonly converted: number;
  readonly factor: number;
  readonly from: VolumeState;
  readonly to: VolumeState;
  readonly material: string;
}

/**
 * Convert volume between bank, loose, and compacted states.
 *
 * Derives loose_to_compacted = bank_to_compacted / bank_to_loose
 * rather than storing it, to avoid rounding inconsistencies.
 */
export function convertVolume(
  volume: number,
  material: FaktorKonversiEntry,
  from: VolumeState,
  to: VolumeState,
): ConvertVolumeResult {
  if (from === to) {
    return { converted: volume, factor: 1.0, from, to, material: material.material };
  }

  const factor = getConversionFactor(material, from, to);
  return {
    converted: volume * factor,
    factor,
    from,
    to,
    material: material.material,
  };
}

function getConversionFactor(
  m: FaktorKonversiEntry,
  from: VolumeState,
  to: VolumeState,
): number {
  if (from === 'bank' && to === 'loose') {
    return m.bank_to_loose;
  }
  if (from === 'bank' && to === 'compacted') {
    if (m.bank_to_compacted === null) {
      throw new Error(
        `Material "${m.material}" has no bank_to_compacted factor (compacted state not applicable)`,
      );
    }
    return m.bank_to_compacted;
  }
  if (from === 'loose' && to === 'bank') {
    return 1.0 / m.bank_to_loose;
  }
  if (from === 'loose' && to === 'compacted') {
    if (m.bank_to_compacted === null) {
      throw new Error(
        `Material "${m.material}" has no bank_to_compacted factor (compacted state not applicable)`,
      );
    }
    return m.bank_to_compacted / m.bank_to_loose;
  }
  if (from === 'compacted' && to === 'bank') {
    if (m.bank_to_compacted === null) {
      throw new Error(
        `Material "${m.material}" has no bank_to_compacted factor (compacted state not applicable)`,
      );
    }
    return 1.0 / m.bank_to_compacted;
  }
  if (from === 'compacted' && to === 'loose') {
    if (m.bank_to_compacted === null) {
      throw new Error(
        `Material "${m.material}" has no bank_to_compacted factor (compacted state not applicable)`,
      );
    }
    return m.bank_to_loose / m.bank_to_compacted;
  }

  throw new Error(`Invalid volume state conversion: ${from} → ${to}`);
}
