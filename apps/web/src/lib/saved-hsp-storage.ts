import type { HSPResult } from '@ahs-id/core';
import type { PortalHspResult } from '@/lib/portal-hsp';

const STORAGE_KEY = 'ahs-id.saved-hsp.v1';

export interface SavedHspEntryBase {
  readonly id: string;
  readonly savedAt: string;
  readonly bundle: string;
  readonly hsd?: string;
  readonly kode: string;
  readonly nama: string;
  readonly satuan: string;
  readonly hargaSatuan: number;
  readonly volume: number;
}

export interface SavedHspEngineEntry extends SavedHspEntryBase {
  readonly kind: 'engine';
  readonly engineResult: HSPResult;
}

export interface SavedHspPortalEntry extends SavedHspEntryBase {
  readonly kind: 'portal';
  readonly portalResult: PortalHspResult;
}

export type SavedHspEntry = SavedHspEngineEntry | SavedHspPortalEntry;

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `saved-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): SavedHspEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedHspEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries: readonly SavedHspEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function listSavedHsp(): readonly SavedHspEntry[] {
  return readAll();
}

export function saveEngineHsp(input: {
  readonly bundle: string;
  readonly hsd?: string;
  readonly result: HSPResult;
}): SavedHspEngineEntry {
  const entry: SavedHspEngineEntry = {
    id: newId(),
    savedAt: new Date().toISOString(),
    kind: 'engine',
    bundle: input.bundle,
    hsd: input.hsd,
    kode: input.result.kode_ahsp,
    nama: input.result.nama,
    satuan: input.result.satuan_bayar,
    hargaSatuan: input.result.grandTotal,
    volume: 1,
    engineResult: input.result,
  };
  const next = [entry, ...readAll()];
  writeAll(next);
  return entry;
}

export function savePortalHsp(input: {
  readonly bundle: string;
  readonly result: PortalHspResult;
}): SavedHspPortalEntry {
  const harga = input.result.harga_satuan_rp ?? 0;
  const entry: SavedHspPortalEntry = {
    id: newId(),
    savedAt: new Date().toISOString(),
    kind: 'portal',
    bundle: input.bundle,
    kode: input.result.kode,
    nama: input.result.nama,
    satuan: input.result.satuan_bayar ?? '—',
    hargaSatuan: harga,
    volume: 1,
    portalResult: input.result,
  };
  const next = [entry, ...readAll()];
  writeAll(next);
  return entry;
}

export function removeSavedHsp(id: string): void {
  writeAll(readAll().filter((row) => row.id !== id));
}

export function updateSavedHspVolume(id: string, volume: number): void {
  const safe = Number.isFinite(volume) && volume >= 0 ? volume : 0;
  writeAll(
    readAll().map((row) => (row.id === id ? { ...row, volume: safe } : row)),
  );
}

export function rabDraftTotal(entries: readonly SavedHspEntry[]): number {
  return entries.reduce((sum, row) => sum + row.hargaSatuan * row.volume, 0);
}
