import { lazy, Suspense, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { HSPResult } from '@ahs-id/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AhspCodeCombobox } from '@/components/AhspCodeCombobox';
import { HspRabBreakdown } from '@/components/HspRabBreakdown';
import { PortalHspBreakdown } from '@/components/PortalHspBreakdown';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import {
  buildHspCalculationSources,
  calculateHspInBrowser,
  defaultsFromItemMeta,
  listCalculatorBundles,
  listCalculatorHsd,
  loadCalculatorHsdMeta,
  loadCalculatorItemMeta,
  parseCalculatorVariables,
  prefetchCalculatorBundle,
  type CalculatorBundleOption,
  type CalculatorItemMeta,
  type HspCalculationSources,
} from '@/lib/calculator';
import { lookupPortalHspInBrowser, PORTAL_BUNDLE_ID, type PortalHspResult } from '@/lib/portal-hsp';
import { RabDraftPanel } from '@/components/RabDraftPanel';

const HspResultActions = lazy(async () => {
  const mod = await import('@/components/HspResultActions');
  return { default: mod.HspResultActions };
});

function readUrlState(): {
  bundle: string;
  item: string;
  hsd: string;
  focus: string;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    bundle: params.get('bundle') ?? 'pupr-2023',
    item: params.get('item') ?? '',
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
  const [bundle, setBundle] = useState('pupr-2023');
  const [item, setItem] = useState('');
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
  const [resultSources, setResultSources] = useState<HspCalculationSources | null>(null);
  const [portalResult, setPortalResult] = useState<PortalHspResult | null>(null);
  const [rabDraftTick, setRabDraftTick] = useState(0);

  const selected: CalculatorBundleOption | undefined = bundles.find((row) => row.name === bundle);
  const isPortal = selected?.strategy === 'portal-lookup';
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
    void prefetchCalculatorBundle(bundle);
  }, [bundle]);

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
  }, [bundle, item, selected?.strategy]);

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
      if (isPortal) {
        const portal = await lookupPortalHspInBrowser(code);
        setPortalResult(portal);
        setResult(null);
        setResultSources(
          buildHspCalculationSources({
            bundleName: PORTAL_BUNDLE_ID,
            itemMeta,
          }),
        );
        setStatus('done');
        return;
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
      const hsdMeta = needsHsd && hsd ? await loadCalculatorHsdMeta(hsd) : null;
      setPortalResult(null);
      setResult(next);
      setResultSources(
        buildHspCalculationSources({
          bundleName: bundle,
          hsdName: needsHsd ? hsd : undefined,
          itemMeta,
          hsdMeta,
        }),
      );
      setStatus('done');
    } catch (err) {
      setResult(null);
      setPortalResult(null);
      setResultSources(null);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Perhitungan gagal');
    }
  }

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-8 overflow-x-hidden 2xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] 2xl:items-start">
      <form
        className="h-fit min-w-0 w-full rounded-3xl border border-border/80 bg-card/60 p-5 sm:p-6 2xl:sticky 2xl:top-6"
        onSubmit={(event) => void onSubmit(event)}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Input</p>
        <h2 className="mt-2 font-serif text-xl sm:text-2xl">Hitung HSP</h2>
        <div className="mt-6 grid min-w-0 gap-4">
          <div className="grid gap-2 text-sm">
            <span className="font-medium" id="calc-bundle-label">Bundel</span>
            <NativeSelect
              aria-labelledby="calc-bundle-label"
              onChange={(event) => setBundle(event.target.value)}
              value={bundle}
            >
              {bundles.map((option) => (
                <option key={option.name} value={option.name}>{option.displayName}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2 text-sm">
            <span className="font-medium" id="calc-item-label">{isPortal ? 'Kode / pekerjaan' : 'Kode AHSP'}</span>
            <AhspCodeCombobox
              aria-labelledby="calc-item-label"
              bundle={bundle}
              onChange={setItem}
              resolvedName={
                itemMeta && itemMeta.kode_ahsp === item.trim() ? itemMeta.nama : undefined
              }
              value={item}
            />
          </div>
          {metaStatus === 'error' && metaError && (
            <p className="text-xs leading-5 text-destructive">{metaError}</p>
          )}
          {needsHsd && (
            <div className="grid gap-2 text-sm">
              <div className="grid gap-2">
                <span className="font-medium" id="calc-hsd-label">HSD regional</span>
                <NativeSelect
                  aria-labelledby="calc-hsd-label"
                  onChange={(event) => setHsd(event.target.value)}
                  value={hsd}
                >
                  {(selected?.compatibleHsd ?? []).map((name) => {
                    const label = hsdOptions.find((row) => row.name === name)?.displayName ?? name;
                    return <option key={name} value={name}>{label}</option>;
                  })}
                </NativeSelect>
              </div>
              {bundle === 'bina-marga-2022' && hsd !== 'hsd-bm-2022' && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Bina Marga 2022: harga L/M/E tetap dari Permen kecuali ref+nama+satuan
                  cocok dengan HSD regional; pilihan regional terutama mengubah label wilayah
                  dan harga bahan bakar.
                </p>
              )}
            </div>
          )}
          {needsHsd && variableEntries.length > 0 && (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Variabel item
              </p>
              {variableEntries.map(([key, def]) => (
                <div className="grid gap-2 text-sm" key={key}>
                  <span className="font-medium" id={`calc-var-label-${key}`}>
                    {def.label}
                    {def.satuan ? ` (${def.satuan})` : ''}
                    {def.required ? ' *' : ''}
                  </span>
                  {def.tipe === 'enum' ? (
                    <NativeSelect
                      aria-labelledby={`calc-var-label-${key}`}
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
                      aria-labelledby={`calc-var-label-${key}`}
                      inputMode="decimal"
                      onChange={(event) => setItemVars((prev) => ({ ...prev, [key]: event.target.value }))}
                      placeholder={def.default === null ? 'Wajib diisi' : undefined}
                      value={itemVars[key] ?? ''}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {needsHsd && metaStatus === 'ready' && variableEntries.length === 0 && (
            <p className="text-xs leading-5 text-muted-foreground">
              Tidak ada variabel yang memengaruhi HSP untuk item ini (biasanya koefisien tabel).
            </p>
          )}
          {!isPortal ? (
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Overhead &amp; profit
            </p>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium">Overhead %</span>
                <Input
                  disabled={!metaReady}
                  inputMode="decimal"
                  onChange={(event) => setOverhead(event.target.value)}
                  value={overhead}
                />
              </label>
              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium">Profit %</span>
                <Input
                  disabled={!metaReady}
                  inputMode="decimal"
                  onChange={(event) => setProfit(event.target.value)}
                  value={profit}
                />
              </label>
            </div>
            <p className="text-pretty text-xs leading-5 text-muted-foreground">
              Nilai awal mengikuti item AHSP yang dipilih. Total overhead dan profit harus antara 10% dan 15%
              dari biaya langsung (A+B+C).
            </p>
          </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              Pilih pekerjaan dari katalog portal Jakarta — harga satuan ditampilkan apa adanya dari DCKTRP.
            </p>
          )}
          {focus && (
            <p className="text-xs text-muted-foreground">Fokus peralatan dari search: <span className="font-mono">{focus}</span></p>
          )}
          <Button className="w-full" disabled={status === 'running' || !metaReady} type="submit">
            {status === 'running'
              ? isPortal ? 'Memuat…' : 'Menghitung…'
              : !metaReady
                ? selected?.strategy === 'fixed-coefficient'
                  ? 'Memuat bundel…'
                  : 'Memuat item…'
                : isPortal
                  ? 'Tampilkan harga'
                  : 'Hitung'}
          </Button>
        </div>
        {!isPortal ? (
          <p className="mt-5 text-pretty text-xs leading-5 text-muted-foreground">
            Mode ini menghitung HSP dari koefisien AHSP nasional dan HSD regional. Untuk harga portal DKI, pilih
            bundel <span className="font-medium text-foreground">HSP portal DCKTRP</span> di atas.
          </p>
        ) : null}
      </form>

      <section aria-labelledby="calc-result-heading" className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hasil</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl" id="calc-result-heading">Rincian HSP</h2>
          </div>
          {selected && (
            <Badge variant="muted">
              {selected.strategy === 'portal-lookup'
                ? 'Harga portal'
                : selected.strategy === 'dynamic-bundle'
                  ? 'HSD dinamis'
                  : 'Koefisien tetap'}
            </Badge>
          )}
        </div>

        {status === 'error' && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {portalResult ? (
          <div className="mt-6 min-w-0 space-y-5">
            <PortalHspBreakdown result={portalResult} />
            <Suspense fallback={null}>
              <HspResultActions
                bundle={PORTAL_BUNDLE_ID}
                kind="portal"
                onSaved={() => setRabDraftTick((n) => n + 1)}
                portalResult={portalResult}
              />
            </Suspense>
          </div>
        ) : result ? (
          <div className="mt-6 min-w-0 space-y-5">
            <HspRabBreakdown result={result} sources={resultSources} />
            <Suspense fallback={null}>
              <HspResultActions
                bundle={bundle}
                engineResult={result}
                hsd={needsHsd ? hsd : undefined}
                kind="engine"
                onSaved={() => setRabDraftTick((n) => n + 1)}
              />
            </Suspense>
          </div>
        ) : status === 'idle' || status === 'running' ? (
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            {isPortal
              ? 'Cari pekerjaan di katalog DCKTRP, lalu klik Tampilkan harga.'
              : 'Pilih bundel dan kode AHSP, lalu hitung. Hasil rincian mengikuti format analisa harga satuan (A+B+C, overhead, profit).'}
          </p>
        ) : null}
      </section>
      <div className="min-w-0 2xl:col-span-2">
        <RabDraftPanel refreshKey={rabDraftTick} />
      </div>
    </div>
  );
}
