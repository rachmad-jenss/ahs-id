import type {
  AhspItem,
  SubAhspEntry,
  AuditEntry,
  VolumeState,
  FaktorKonversiEntry,
} from '../types/index.js';
import { convertVolume } from './konversi-volume.js';

export interface SubAhspResolvedComponent {
  readonly ref_ahsp: string;
  readonly nama: string;
  readonly koefisien: number;
  readonly unit_price: number;
  readonly total_price: number;
}

export interface SubAhspResult {
  readonly components: readonly SubAhspResolvedComponent[];
  readonly total: number;
  readonly audit: readonly AuditEntry[];
}

export type HspResolverFn = (kodeAhsp: string) => { grandTotal: number };

/**
 * Resolve sub-AHSP entries by recursively computing child HSP costs.
 * Detects circular dependencies via a resolve stack.
 */
export function resolveSubAhsp(
  item: AhspItem,
  resolveHsp: HspResolverFn,
  fkMap: Map<string, FaktorKonversiEntry>,
  materialKey: string,
  resolveStack: readonly string[],
): SubAhspResult {
  if (item.sub_ahsp.length === 0) {
    return { components: [], total: 0, audit: [] };
  }

  const currentStack = [...resolveStack, item.kode_ahsp];
  const audit: AuditEntry[] = [];
  const components: SubAhspResolvedComponent[] = [];

  for (const sub of item.sub_ahsp) {
    if (currentStack.includes(sub.ref_ahsp)) {
      const chain = [...currentStack, sub.ref_ahsp].join(' → ');
      throw new Error(`Circular sub-AHSP dependency detected: ${chain}`);
    }

    const childResult = resolveHsp(sub.ref_ahsp);
    let childCost = childResult.grandTotal;

    childCost = applySubVolumeConversion(
      childCost,
      sub,
      item,
      fkMap,
      materialKey,
      audit,
    );

    const total = sub.koefisien * childCost;
    audit.push({
      step: 'sub_ahsp_resolve',
      detail: `${sub.ref_ahsp} (${sub.nama}): ${sub.koefisien} × ${childCost.toFixed(2)} = ${total.toFixed(2)}`,
      value: total,
      unit: 'Rp',
    });

    components.push({
      ref_ahsp: sub.ref_ahsp,
      nama: sub.nama,
      koefisien: sub.koefisien,
      unit_price: childCost,
      total_price: total,
    });
  }

  const totalSubAhsp = components.reduce((s, c) => s + c.total_price, 0);
  return { components, total: totalSubAhsp, audit };
}

function applySubVolumeConversion(
  cost: number,
  sub: SubAhspEntry,
  parentItem: AhspItem,
  fkMap: Map<string, FaktorKonversiEntry>,
  materialKey: string,
  audit: AuditEntry[],
): number {
  if (sub.volume_state === null) return cost;
  if (sub.volume_state === parentItem.volume_state_bayar) return cost;

  const fk = fkMap.get(materialKey);
  if (!fk) {
    throw new Error(
      `Faktor konversi for material "${materialKey}" not found (sub-AHSP volume conversion)`,
    );
  }

  const result = convertVolume(
    1.0,
    fk,
    sub.volume_state as VolumeState,
    parentItem.volume_state_bayar,
  );
  const converted = cost * result.factor;
  audit.push({
    step: 'sub_ahsp_volume_conversion',
    detail: `${sub.ref_ahsp}: cost ${cost.toFixed(2)} × ${result.factor.toFixed(6)} (${sub.volume_state}→${parentItem.volume_state_bayar}) = ${converted.toFixed(2)}`,
    value: converted,
  });
  return converted;
}
