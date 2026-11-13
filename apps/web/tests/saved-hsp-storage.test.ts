import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listSavedHsp,
  rabDraftTotal,
  removeSavedHsp,
  saveEngineHsp,
  updateSavedHspVolume,
} from '../src/lib/saved-hsp-storage.js';
import { idr, percentagePoints, type HSPResult } from '@ahs-id/core';

const minimalResult: HSPResult = {
  kode_ahsp: '1.1.1',
  nama: 'Uji',
  satuan_bayar: 'm3',
  subAhsp: [],
  groups: [],
  baseTotal: idr(1000),
  overheadPct: percentagePoints(10),
  profitPct: percentagePoints(5),
  overheadProfitValue: idr(150),
  grandTotal: idr(1150),
  warnings: [],
  audit_trail: [],
};

describe('saved HSP local draft', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => {
        memory.clear();
      },
      key: () => null,
      length: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists engine result and volume', () => {
    const entry = saveEngineHsp({ bundle: 'cipta-karya-2024', result: minimalResult });
    expect(entry.kode).toBe('1.1.1');
    expect(listSavedHsp()).toHaveLength(1);

    updateSavedHspVolume(entry.id, 12.5);
    const rows = listSavedHsp();
    expect(rows[0]?.volume).toBe(12.5);
    expect(rabDraftTotal(rows)).toBeCloseTo(1150 * 12.5, 2);

    removeSavedHsp(entry.id);
    expect(listSavedHsp()).toHaveLength(0);
  });
});
