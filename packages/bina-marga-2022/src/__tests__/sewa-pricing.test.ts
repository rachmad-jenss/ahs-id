import { describe, it, expect } from 'vitest';
import { createCalculator, type HsdRegional } from '@ahs-id/core';
import { bundle } from '../index.js';
import hsdData from '../../../hsd-bm-2022/data/hsd.json' with { type: 'json' };

const hsd = hsdData as unknown as HsdRegional;

describe('bina-marga-2022 createCalculator uses Permen sewa rates', () => {
  const calc = createCalculator(bundle, hsd);

  it('prices E.09 on 3.1.(1) at the Permen hourly rate', () => {
    const result = calc.hitungHSP('3.1.(1)', {});
    const alat = result.groups.find((group) => group.type === 'E');
    const dumpTruck = alat?.components.find((component) => component.ref === 'E.09');
    expect(dumpTruck?.unit_price).toBe(692885);
    expect(result.baseTotal).toBeGreaterThan(20_000);
    expect(result.baseTotal).toBeLessThan(80_000);
  });

  it('fails closed when an alat ref has no Permen rate', () => {
    const item = bundle.ahsp_items.find((entry) => entry.peralatan.some((alat) => alat.ref === 'E.17b'));
    expect(item).toBeDefined();
    expect(() => calc.hitungHSP(item!.kode_ahsp, {})).toThrow(
      'Peralatan "E.17b" has placeholder ownership parameters and no Permen sewa rate',
    );
  });
});
