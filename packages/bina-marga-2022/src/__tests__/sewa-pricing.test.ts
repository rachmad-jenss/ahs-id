import { describe, it, expect } from 'vitest';
import { brandHsdRegional, createCalculator, mergeHsdBaseWithRegionalOverlay } from '@ahs-id/core';
import { bundle } from '../index.js';
import hsdData from '../../../hsd-bm-2022/data/hsd.json' with { type: 'json' };
import kaltimData from '../../../hsd-kaltim-2025/data/hsd.json' with { type: 'json' };

const hsd = brandHsdRegional(hsdData);

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

  it('prices a daywork hour from the Permen labor HSD', () => {
    const result = calc.hitungHSP('9.1.(1)', {});
    expect(result.baseTotal).toBeCloseTo(210464 / 7, 4);
    expect(result.grandTotal).toBeGreaterThan(result.baseTotal);
  });

  it('prices a daywork equipment hour at the Permen sewa rate', () => {
    const result = calc.hitungHSP('9.1.(7)', {});
    const alat = result.groups.find((group) => group.type === 'E');
    expect(alat?.components[0]?.unit_price).toBe(788006);
    expect(alat?.components[0]?.coefficient).toBe(1);
  });

  it('fails closed when a priced item has no components', () => {
    expect(() => calc.hitungHSP('6.3.(8)', {})).toThrow('no components');
  });

  it('calculates with regional HSD via Permen-base overlay (matching refs only)', () => {
    const kaltim = brandHsdRegional(kaltimData);
    const merged = mergeHsdBaseWithRegionalOverlay(hsd, kaltim);
    const regionalCalc = createCalculator(bundle, merged);
    const result = regionalCalc.hitungHSP('3.1.(1)', {});
    const alat = result.groups.find((group) => group.type === 'E');
    const dumpTruck = alat?.components.find((component) => component.ref === 'E.09');
    // E.09 is Permen-only — must keep Permen sewa rate after overlay.
    expect(dumpTruck?.unit_price).toBe(692885);
    expect(result.grandTotal).toBeGreaterThan(0);
    expect(merged.region.provinsi).toBe(kaltim.region.provinsi);
  });

  it('fails closed when an alat ref has no Permen rate', () => {
    const item = bundle.ahsp_items.find((entry) => entry.peralatan.some((alat) => alat.ref === 'E.17b'));
    expect(item).toBeDefined();
    expect(() => calc.hitungHSP(item!.kode_ahsp, {})).toThrow(
      'Peralatan "E.17b" has placeholder ownership parameters and no Permen sewa rate',
    );
  });
});
