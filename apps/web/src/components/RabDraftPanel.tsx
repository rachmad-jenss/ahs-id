import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listSavedHsp,
  rabDraftTotal,
  removeSavedHsp,
  updateSavedHspVolume,
  type SavedHspEntry,
} from '@/lib/saved-hsp-storage';

function formatIdr(value: number): string {
  return value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 });
}

interface RabDraftPanelProps {
  readonly refreshKey: number;
}

function RabDraftMobileCard({
  row,
  onRemove,
  onVolumeChange,
}: {
  readonly row: SavedHspEntry;
  readonly onRemove: () => void;
  readonly onVolumeChange: (volume: number) => void;
}): React.JSX.Element {
  const lineTotal = row.hargaSatuan * row.volume;

  return (
    <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
      <p className="font-mono text-xs font-semibold tracking-tight text-primary">{row.kode}</p>
      <h4 className="mt-2 text-pretty text-sm font-medium leading-6 text-foreground">{row.nama}</h4>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/35 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">HSP/satuan</p>
          <p className="mt-1 font-mono text-sm tabular-nums leading-tight">{formatIdr(row.hargaSatuan)}</p>
          <p className="text-xs text-muted-foreground">/{row.satuan}</p>
        </div>
        <div className="rounded-xl bg-muted/35 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Volume</p>
          <Input
            aria-label={`Volume ${row.kode}`}
            className="mt-1 h-10 w-full min-w-0 text-right font-mono text-sm tabular-nums"
            inputMode="decimal"
            min={0}
            onChange={(event) => {
              const next = Number.parseFloat(event.target.value);
              onVolumeChange(Number.isFinite(next) ? next : 0);
            }}
            step="any"
            type="number"
            value={row.volume}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Jumlah</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-primary">{formatIdr(lineTotal)}</p>
        </div>
        <Button onClick={onRemove} size="sm" type="button" variant="outline">
          Hapus
        </Button>
      </div>
    </article>
  );
}

/** Draf RAB lokal — volume × harga satuan per item tersimpan. */
export function RabDraftPanel({ refreshKey }: RabDraftPanelProps): React.JSX.Element {
  const [entries, setEntries] = useState<readonly SavedHspEntry[]>([]);

  useEffect(() => {
    setEntries(listSavedHsp());
  }, [refreshKey]);

  const total = useMemo(() => rabDraftTotal(entries), [entries]);

  function refreshFromStorage(): void {
    setEntries(listSavedHsp());
  }

  if (entries.length === 0) {
    return (
      <section className="mt-10 rounded-3xl border border-dashed border-border/80 bg-card/30 px-5 py-8">
        <h3 className="font-serif text-2xl">Draf RAB lokal</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Belum ada HSP tersimpan. Setelah hitung atau tampilkan harga, gunakan <span className="font-medium text-foreground">Simpan ke draf RAB</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/80 bg-card/40">
      <div className="flex flex-col gap-2 border-b border-border/80 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Draf RAB</p>
          <h3 className="mt-1 font-serif text-xl sm:text-2xl">Perkiraan biaya pekerjaan</h3>
        </div>
        <p className="font-mono text-lg font-semibold tabular-nums text-primary">{formatIdr(total)}</p>
      </div>

      <div className="space-y-3 p-4 md:hidden">
        {entries.map((row) => (
          <RabDraftMobileCard
            key={row.id}
            onRemove={() => {
              removeSavedHsp(row.id);
              refreshFromStorage();
            }}
            onVolumeChange={(volume) => {
              updateSavedHspVolume(row.id, volume);
              refreshFromStorage();
            }}
            row={row}
          />
        ))}
      </div>

      <div className="hidden md:block">
        <div className="table-scroll-root">
        <p className="px-5 py-3 text-xs text-muted-foreground lg:sr-only">
          Geser tabel ke samping untuk melihat semua kolom.
        </p>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Draf RAB tersimpan di browser</caption>
          <thead className="border-b border-border/70 text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium" scope="col">Kode</th>
              <th className="px-5 py-3 font-medium" scope="col">Nama</th>
              <th className="px-5 py-3 text-right font-medium" scope="col">HSP/satuan</th>
              <th className="px-5 py-3 text-right font-medium" scope="col">Volume</th>
              <th className="px-5 py-3 text-right font-medium" scope="col">Jumlah</th>
              <th className="px-5 py-3 font-medium" scope="col">
                <span className="sr-only">Hapus</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {entries.map((row) => {
              const lineTotal = row.hargaSatuan * row.volume;
              return (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-mono text-xs text-primary">{row.kode}</td>
                  <td className="max-w-[16rem] text-pretty px-5 py-3 font-medium lg:max-w-xs">{row.nama}</td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">
                    {formatIdr(row.hargaSatuan)}
                    <span className="block text-xs font-sans text-muted-foreground">/{row.satuan}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Input
                      aria-label={`Volume ${row.kode}`}
                      className="ml-auto max-w-[6.5rem] text-right font-mono tabular-nums"
                      inputMode="decimal"
                      min={0}
                      onChange={(event) => {
                        const next = Number.parseFloat(event.target.value);
                        updateSavedHspVolume(row.id, Number.isFinite(next) ? next : 0);
                        refreshFromStorage();
                      }}
                      step="any"
                      type="number"
                      value={row.volume}
                    />
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums">{formatIdr(lineTotal)}</td>
                  <td className="px-5 py-3">
                    <Button
                      onClick={() => {
                        removeSavedHsp(row.id);
                        refreshFromStorage();
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p className="border-t border-border/80 px-4 py-3 text-pretty text-xs leading-5 text-muted-foreground sm:px-5">
        Total draf = Σ (volume × harga satuan). Belum termasuk PPN, mob/demob, atau biaya tak terduga.
      </p>
    </section>
  );
}
