import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { HSPResult } from '@ahs-id/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  calculateHspInBrowser,
  defaultsFromItemMeta,
  listCalculatorBundles,
  listCalculatorHsd,
  loadCalculatorItemMeta,
  parseCalculatorVariables,
  type CalculatorBundleOption,
  type CalculatorItemMeta,
} from '@/lib/calculator';

function formatIdr(value: number): string {
  return value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 });
}

function readUrlState(): {
  bundle: string;
  item: string;
  hsd: string;
  focus: string;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    bundle: params.get('bundle') ?? 'cipta-karya-2024',
    item: params.get('item') ?? '1.2.1.1.1',
    hsd: params.get('hsd') ?? '',
    focus: params.get('focus') ?? '',
  };
}

function writeUrlState(next: { bundle: string; item: string; hsd: string }): void {
  const params = new URLSearchParams();
  params.set('bundle', next.bundle);
  if (next.item) params.set('item', next.item);
  if (next.hsd) params.set('hsd', next.hsd);
  const qs = params.toString();
  window.history.replaceState({}, '', qs ? `/kalkulator/?${qs}` : '/kalkulator/');
}

/** Interactive HSP calculator island backed by `@ahs-id/engine-registry`. */
export function CalculatorApp(): React.JSX.Element {
  const bundles = useMemo(() => listCalculatorBundles(), []);
  const hsdOptions = useMemo(() => listCalculatorHsd(), []);
  const [bundle, setBundle] = useState('cipta-karya-2024');
  const [item, setItem] = useState('1.2.1.1.1');
  const [hsd, setHsd] = useState('');
  const [focus, setFocus] = useState('');
  const [overhead, setOverhead] = useState('10');
  const [profit, setProfit] = useState('5');
  const [itemVars, setItemVars] = useState<Record<string, string>>({});
  const [itemMeta, setItemMeta] = useState<CalculatorItemMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaStatus, setMetaStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HSPResult | null>(null);

  const selected: CalculatorBundleOption | undefined = bundles.find((row) => row.name === bundle);
  const needsHsd = selected?.strategy === 'dynamic-bundle';
  const variableEntries = useMemo(
    () => Object.entries(itemMeta?.variables ?? {}),
    [itemMeta],
  );

  useEffect(() => {
    const state = readUrlState();
    setBundle(state.bundle);
    setItem(state.item);
    setHsd(state.hsd);
    setFocus(state.focus);
    const match = bundles.find((row) => row.name === state.bundle);
    if (match?.strategy === 'dynamic-bundle' && !state.hsd) {
      setHsd(match.defaultHsd ?? '');
    }
  }, [bundles]);

  useEffect(() => {
    if (!selected) return;
    if (selected.strategy === 'dynamic-bundle') {
      const nextHsd = hsd && selected.compatibleHsd?.includes(hsd) ? hsd : (selected.defaultHsd ?? '');
      if (nextHsd !== hsd) setHsd(nextHsd);
    } else if (hsd) {
      setHsd('');
    }
  }, [bundle, hsd, selected]);

  useEffect(() => {
    let cancelled = false;
    const code = item.trim();
    // Invalidate immediately so submit cannot use variables from a previous item.
    setItemMeta(null);
    setItemVars({});
    setMetaError(null);
    if (!code) {
      setMetaStatus('idle');
      return;
    }
    setMetaStatus('loading');

    const timer = window.setTimeout(() => {
      void loadCalculatorItemMeta({ bundle, item: code })
        .then((meta) => {
          if (cancelled) return;
          setItemMeta(meta);
          setItemVars(defaultsFromItemMeta(meta));
          setOverhead(String(meta.marginDefaults.overhead_pct));
          setProfit(String(meta.marginDefaults.profit_pct));
          setMetaStatus('ready');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setItemMeta(null);
          setItemVars({});
          setMetaStatus('error');
          setMetaError(err instanceof Error ? err.message : 'Gagal memuat definisi item');
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bundle, item]);

  const metaReady =
    metaStatus === 'ready'
    && itemMeta !== null
    && itemMeta.kode_ahsp === item.trim();

  /** Run calculation and sync URL state. */
  async function onSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('running');
    setError(null);
    const code = item.trim();
    writeUrlState({ bundle, item: code, hsd: needsHsd ? hsd : '' });
    try {
      if (!itemMeta || itemMeta.kode_ahsp !== code) {
        throw new Error(metaError ?? 'Definisi item belum siap');
      }
      const variables = parseCalculatorVariables(itemMeta, itemVars, {
        overhead,
        profit,
      });
      const next = await calculateHspInBrowser({
        bundle,
        item: code,
        hsd: needsHsd ? hsd : undefined,
        variables: Object.keys(variables).length > 0 ? variables : undefined,
      });
      setResult(next);
      setStatus('done');
    } catch (err) {
      setResult(null);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Perhitungan gagal');
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <form className="h-fit rounded-3xl border border-border/80 bg-card/60 p-6" onSubmit={(event) => void onSubmit(event)}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Input</p>
        <h2 className="mt-2 font-serif text-2xl">Hitung HSP</h2>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Bundel</span>
            <NativeSelect onChange={(event) => setBundle(event.target.value)} value={bundle}>
              {bundles.map((option) => (
                <option key={option.name} value={option.name}>{option.displayName}</option>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Kode AHSP</span>
            <Input onChange={(event) => setItem(event.target.value)} value={item} />
          </label>
          {itemMeta && (
            <p className="text-xs leading-5 text-muted-foreground">{itemMeta.nama}</p>
          )}
          {metaStatus === 'error' && metaError && (
            <p className="text-xs leading-5 text-destructive">{metaError}</p>
          )}
          {needsHsd && (
            <label className="grid gap-2 text-sm">
              <span className="font-medium">HSD regional</span>
              <NativeSelect onChange={(event) => setHsd(event.target.value)} value={hsd}>
                {(selected?.compatibleHsd ?? []).map((name) => {
                  const label = hsdOptions.find((row) => row.name === name)?.displayName ?? name;
                  return <option key={name} value={name}>{label}</option>;
                })}
              </NativeSelect>
            </label>
          )}
          {needsHsd && variableEntries.length > 0 && (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Variabel item
              </p>
              {variableEntries.map(([key, def]) => (
                <label className="grid gap-2 text-sm" key={key}>
                  <span className="font-medium">
                    {def.label}
                    {def.satuan ? ` (${def.satuan})` : ''}
                    {def.required ? ' *' : ''}
                  </span>
                  {def.tipe === 'enum' ? (
                    <NativeSelect
                      onChange={(event) => setItemVars((prev) => ({ ...prev, [key]: event.target.value }))}
                      value={itemVars[key] ?? ''}
                    >
                      <option value="">Pilih…</option>
                      {(def.options ?? []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input
                      inputMode="decimal"
                      onChange={(event) => setItemVars((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder={def.default === null ? 'Wajib diisi' : undefined}
                      value={itemVars[key] ?? ''}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          {needsHsd && metaStatus === 'ready' && variableEntries.length === 0 && (
            <p className="text-xs leading-5 text-muted-foreground">
              Tidak ada variabel yang memengaruhi HSP untuk item ini (biasanya koefisien tabel).
            </p>
          )}
          {!needsHsd && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Overhead %</span>
                <Input inputMode="decimal" onChange={(event) => setOverhead(event.target.value)} value={overhead} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Profit %</span>
                <Input inputMode="decimal" onChange={(event) => setProfit(event.target.value)} value={profit} />
              </label>
            </div>
          )}
          {focus && (
            <p className="text-xs text-muted-foreground">Fokus peralatan dari search: <span className="font-mono">{focus}</span></p>
          )}
          <Button disabled={status === 'running' || !metaReady} type="submit">
            {status === 'running' ? 'Menghitung…' : !metaReady ? 'Memuat item…' : 'Hitung'}
          </Button>
        </div>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          HSP portal DCKTRP tidak dihitung di sini — buka halaman detail HSP untuk harga portal.
        </p>
      </form>

      <section aria-labelledby="calc-result-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hasil</p>
            <h2 className="mt-1 font-serif text-3xl" id="calc-result-heading">Rincian HSP</h2>
          </div>
          {selected && <Badge variant="muted">{selected.strategy === 'dynamic-bundle' ? 'HSD dinamis' : 'Koefisien tetap'}</Badge>}
        </div>

        {status === 'error' && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {result ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border/80 bg-card/50">
            <div className="grid gap-4 border-b border-border/80 px-5 py-5 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Kode</p>
                <p className="mt-1 font-mono font-semibold text-primary">{result.kode_ahsp}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nama</p>
                <p className="mt-1 font-medium">{result.nama}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">HSP</p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatIdr(result.grandTotal)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border/80 bg-muted/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Komponen</th>
                    <th className="px-5 py-3 font-medium">Satuan</th>
                    <th className="px-5 py-3 text-right font-medium">Koefisien</th>
                    <th className="px-5 py-3 text-right font-medium">Harga satuan</th>
                    <th className="px-5 py-3 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {result.groups.flatMap((group) =>
                    group.components.map((component) => (
                      <tr key={`${group.type}-${component.ref}-${component.nama}`}>
                        <td className="px-5 py-3">
                          <div className="font-medium">{component.nama || component.ref}</div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">{component.ref} · {group.title}</div>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{component.satuan}</td>
                        <td className="px-5 py-3 text-right font-mono">{component.coefficient.toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3 text-right font-mono">{formatIdr(component.unit_price)}</td>
                        <td className="px-5 py-3 text-right font-mono">{formatIdr(component.total_price)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
            <dl className="grid gap-3 border-t border-border/80 px-5 py-5 text-sm sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Biaya langsung</dt><dd className="mt-1 font-mono">{formatIdr(result.baseTotal)}</dd></div>
              <div><dt className="text-muted-foreground">Overhead + profit</dt><dd className="mt-1 font-mono">{formatIdr(result.overheadProfitValue)}</dd></div>
              <div><dt className="text-muted-foreground">HSP akhir</dt><dd className="mt-1 font-mono font-semibold">{formatIdr(result.grandTotal)}</dd></div>
            </dl>
          </div>
        ) : status === 'idle' || status === 'running' ? (
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Pilih bundel dan kode AHSP, lalu hitung. Hasil memakai registry yang sama dengan CLI `ahs-id calc-hsp`.
          </p>
        ) : null}
      </section>
    </div>
  );
}
