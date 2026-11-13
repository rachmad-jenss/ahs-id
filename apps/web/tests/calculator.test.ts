import { describe, expect, it } from 'vitest';
import {
  buildHspCalculationSources,
  calculateHspInBrowser,
  defaultsFromItemMeta,
  effectiveVariablesFromAhsp,
  listCalculatorBundles,
  loadCalculatorHsdMeta,
  loadCalculatorItemMeta,
  parseCalculatorVariables,
} from '../src/lib/calculator.js';

describe('web calculator registry', () => {
  it('lists dynamic and fixed-coefficient bundles from engine-registry', () => {
    const bundles = listCalculatorBundles();
    expect(bundles.some((row) => row.name === 'pupr-2023' && row.strategy === 'dynamic-bundle')).toBe(true);
    expect(bundles.some((row) => row.name === 'cipta-karya-2024' && row.strategy === 'fixed-coefficient')).toBe(true);
    expect(bundles.some((row) => row.name === 'hsp-jakarta-dcktrp' && row.strategy === 'portal-lookup')).toBe(true);
    expect(bundles.some((row) => row.name === 'sda-se-binkon-47-2026')).toBe(true);
  });

  it('loads only variables that can affect HSP and parses declared keys', async () => {
    // 3.1.1 declares L_km but peralatan are koef tabel — do not expose L_km.
    const meta = await loadCalculatorItemMeta({
      bundle: 'bina-marga-2016',
      item: '3.1.1',
    });
    expect(meta.strategy).toBe('dynamic-bundle');
    expect(meta.bundleDisplayName).toBeTruthy();
    expect(meta.sumberRegulasi).toMatch(/PUPR/);
    expect(meta.variables).toEqual({});
    expect(defaultsFromItemMeta(meta)).toEqual({});

    const bm324 = await loadCalculatorItemMeta({ bundle: 'bina-marga-2016', item: '3.2.4' });
    const hsdMeta = await loadCalculatorHsdMeta('hsd-kaltim-2025');
    expect(hsdMeta.displayName).toMatch(/Kalimantan Timur/);
    const sources = buildHspCalculationSources({
      bundleName: 'bina-marga-2016',
      hsdName: 'hsd-kaltim-2025',
      itemMeta: bm324,
      hsdMeta,
    });
    expect(sources.ahspBundle).toBe(bm324.bundleDisplayName);
    expect(sources.hsdCatalog).toBe(hsdMeta.displayName);
    expect(sources.hsdDetail).toContain('Kalimantan Timur');

    const filtered = effectiveVariablesFromAhsp({
      variabel: {
        L_km: { label: 'Jarak', tipe: 'number', default: 2 },
        jarak_quarry_km: { label: 'Quarry', tipe: 'number', default: null, required: true },
        jenis_material: {
          label: 'Material',
          tipe: 'enum',
          options: ['a'],
          default: 'a',
        },
      },
      peralatan: [
        { koef_sumber: 'tabel', variabel_input: [] as const },
        { koef_sumber: 'kalkulasi', variabel_input: ['jarak_quarry_km'] as const },
      ],
    });
    expect(Object.keys(filtered).sort()).toEqual(['jarak_quarry_km', 'jenis_material']);
    expect(
      parseCalculatorVariables(meta, {}, { overhead: '9', profit: '6' }),
    ).toEqual({ overhead_pct: 9, profit_pct: 6 });

    const fixedMeta = await loadCalculatorItemMeta({
      bundle: 'cipta-karya-2024',
      item: '1.2.1.1.1',
    });
    expect(fixedMeta.strategy).toBe('fixed-coefficient');
    expect(
      parseCalculatorVariables(fixedMeta, {}, { overhead: '11', profit: '4' }),
    ).toEqual({ overhead_pct: 11, profit_pct: 4 });
    expect(
      parseCalculatorVariables(fixedMeta, {}, { overhead: '  ', profit: '' }),
    ).toEqual({});

    const requiredMeta = {
      ...fixedMeta,
      strategy: 'dynamic-bundle' as const,
      variables: {
        jarak_quarry_km: {
          label: 'Quarry',
          tipe: 'number' as const,
          default: null,
          required: true,
        },
      },
    };
    expect(() => parseCalculatorVariables(requiredMeta, {})).toThrow(/wajib diisi/);
  }, 30_000);

  it('spot-checks HSP totals for sample codes across strategies', async () => {
    const priced = await calculateHspInBrowser({
      bundle: 'bina-marga-2016',
      item: '3.1.1',
      hsd: 'hsd-kaltim-2025',
      variables: { L_km: 2 },
    });
    expect(priced.kode_ahsp).toBe('3.1.1');
    expect(priced.grandTotal).toBeGreaterThan(0);

    const fixed = await calculateHspInBrowser({
      bundle: 'cipta-karya-2024',
      item: '1.2.1.1.1',
    });
    expect(fixed.kode_ahsp).toBe('1.2.1.1.1');
    expect(fixed.grandTotal).toBeGreaterThan(0);

    // SE47 national templates may ship harga_satuan_ref=0 (PDF without prices).
    const se47 = await calculateHspInBrowser({
      bundle: 'sda-se-binkon-47-2026',
      item: 'A.1.01.a',
    });
    expect(se47.kode_ahsp).toBe('A.1.01.a');
    expect(Number.isFinite(se47.grandTotal)).toBe(true);
  }, 60_000);
});
