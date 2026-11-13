import { useState } from 'react';
import type { HSPResult } from '@ahs-id/core';
import { BookmarkPlus, Copy, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyTextToClipboard } from '@/lib/clipboard';
import { hspResultToTsv, portalResultToTsv } from '@/lib/hsp-rab-tsv';
import type { PortalHspResult } from '@/lib/portal-hsp';
import { saveEngineHsp, savePortalHsp } from '@/lib/saved-hsp-storage';
import { cn } from '@/lib/utils';

interface HspResultActionsProps {
  readonly kind: 'engine' | 'portal';
  readonly bundle: string;
  readonly hsd?: string;
  readonly engineResult?: HSPResult;
  readonly portalResult?: PortalHspResult;
  readonly onSaved?: () => void;
}

/** Simpan, salin tabel, atau unduh Excel untuk satu hasil HSP. */
export function HspResultActions({
  kind,
  bundle,
  hsd,
  engineResult,
  portalResult,
  onSaved,
}: HspResultActionsProps): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = busy !== null;

  async function withStatus(label: string, task: () => Promise<void>): Promise<void> {
    setBusy(label);
    setMessage(null);
    try {
      await task();
      setMessage(label);
      window.setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setBusy(null);
    }
  }

  function onSave(): void {
    if (kind === 'engine' && engineResult) {
      saveEngineHsp({ bundle, hsd, result: engineResult });
      setMessage('Disimpan ke draf RAB');
      onSaved?.();
      window.setTimeout(() => setMessage(null), 2500);
      return;
    }
    if (kind === 'portal' && portalResult) {
      savePortalHsp({ bundle, result: portalResult });
      setMessage('Disimpan ke draf RAB');
      onSaved?.();
      window.setTimeout(() => setMessage(null), 2500);
    }
  }

  return (
    <section
      aria-labelledby="hsp-export-heading"
      className="min-w-0 max-w-full overflow-x-clip rounded-2xl border border-border/80 bg-gradient-to-b from-card/70 to-card/40"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className="text-sm font-semibold tracking-tight text-foreground"
              id="hsp-export-heading"
            >
              Ekspor &amp; draf RAB
            </h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
              Simpan baris ini ke draf lokal, salin tabel ke clipboard, atau unduh berkas Excel.
            </p>
          </div>
          {message ? (
            <p
              className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-stretch">
          <Button
            className="w-full lg:w-auto lg:shrink-0"
            disabled={disabled}
            onClick={onSave}
            size="sm"
            type="button"
          >
            <BookmarkPlus aria-hidden className="h-4 w-4" />
            Simpan ke draf RAB
          </Button>

          <div
            className={cn(
              'grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-3',
              'rounded-xl border border-border/70 bg-background/60 p-1.5',
            )}
          >
            <Button
              className="h-auto min-h-11 w-full justify-center whitespace-normal py-2.5 text-center leading-snug"
              disabled={disabled}
              onClick={() =>
                void withStatus('Nilai disalin', async () => {
                  const text =
                    kind === 'engine' && engineResult
                      ? hspResultToTsv(engineResult, 'values')
                      : portalResult
                        ? portalResultToTsv(portalResult, 'values')
                        : '';
                  if (!text) throw new Error('Tidak ada data');
                  await copyTextToClipboard(text);
                })
              }
              size="sm"
              title="Salin tabel dengan angka jadi"
              type="button"
              variant="ghost"
            >
              <Copy aria-hidden className="h-4 w-4 shrink-0" />
              {busy === 'Nilai disalin' ? 'Menyalin…' : 'Salin nilai'}
            </Button>
            <Button
              className="h-auto min-h-11 w-full justify-center whitespace-normal py-2.5 text-center leading-snug"
              disabled={disabled}
              onClick={() =>
                void withStatus('Formula disalin', async () => {
                  const text =
                    kind === 'engine' && engineResult
                      ? hspResultToTsv(engineResult, 'formulas')
                      : portalResult
                        ? portalResultToTsv(portalResult, 'formulas')
                        : '';
                  if (!text) throw new Error('Tidak ada data');
                  await copyTextToClipboard(text);
                })
              }
              size="sm"
              title="Salin untuk paste ke Excel dengan formula kolom jumlah"
              type="button"
              variant="ghost"
            >
              <FileSpreadsheet aria-hidden className="h-4 w-4 shrink-0" />
              {busy === 'Formula disalin' ? 'Menyalin…' : 'Salin formula'}
            </Button>
            <Button
              className="h-auto min-h-11 w-full justify-center whitespace-normal py-2.5 text-center leading-snug"
              disabled={disabled}
              onClick={() =>
                void withStatus('Excel diunduh', async () => {
                  const { downloadEngineHspExcel, downloadPortalHspExcel } = await import('@/lib/hsp-download');
                  if (kind === 'engine' && engineResult) {
                    await downloadEngineHspExcel(engineResult);
                    return;
                  }
                  if (portalResult) {
                    await downloadPortalHspExcel(portalResult);
                    return;
                  }
                  throw new Error('Tidak ada data');
                })
              }
              size="sm"
              type="button"
              variant="secondary"
            >
              <Download aria-hidden className="h-4 w-4 shrink-0" />
              {busy === 'Excel diunduh' ? 'Menyiapkan…' : 'Unduh Excel'}
            </Button>
          </div>
        </div>

        <p className="border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
          Draf disimpan di memori browser (<span className="font-mono text-[0.7rem]">localStorage</span>).
          Atur volume per baris di panel draf RAB di bawah halaman.
        </p>
      </div>
    </section>
  );
}
