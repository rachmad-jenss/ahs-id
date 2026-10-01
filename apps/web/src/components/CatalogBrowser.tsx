import Fuse from 'fuse.js';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { catalogUrl, parseCatalogSearchParams, type CatalogSearchParams } from '@/lib/catalog-url';
import { paginateCatalogItems, type SearchIndexEntry } from '@/lib/search-client';

interface CatalogBrowserProps {
  readonly entries: readonly SearchIndexEntry[];
  readonly bundles: readonly { id: string; name: string }[];
  readonly initialParams: CatalogSearchParams;
}

const PAGE_SIZE = 20;

export function CatalogBrowser({ entries, bundles, initialParams }: CatalogBrowserProps): React.JSX.Element {
  const [query, setQuery] = useState(initialParams.q ?? '');
  const [bundle, setBundle] = useState(initialParams.bundle ?? '');
  const [bidang, setBidang] = useState(initialParams.bidang ?? '');
  const [unit, setUnit] = useState(initialParams.unit ?? '');
  const [page, setPage] = useState(initialParams.page ?? 1);

  useEffect(() => {
    function syncFromLocation(): void {
      const params = parseCatalogSearchParams(new URLSearchParams(window.location.search));
      setQuery(params.q ?? '');
      setBundle(params.bundle ?? '');
      setBidang(params.bidang ?? '');
      setUnit(params.unit ?? '');
      setPage(params.page ?? 1);
    }

    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const bidangOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.bidang))].sort(),
    [entries],
  );
  const unitOptions = useMemo(
    () => [...new Set(entries.map((entry) => entry.unit))].sort(),
    [entries],
  );
  const filteredEntries = useMemo(() => {
    const narrowed = entries.filter((entry) => {
      if (bundle && entry.bundleId !== bundle) return false;
      if (bidang && entry.bidang !== bidang) return false;
      if (unit && entry.unit !== unit) return false;
      return true;
    });
    if (!query.trim()) return narrowed;
    return new Fuse(narrowed, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.36,
      keys: [
        { name: 'code', weight: 1.4 },
        { name: 'name', weight: 1.2 },
        { name: 'bundleName', weight: 0.6 },
      ],
    }).search(query.trim()).map((result) => result.item);
  }, [bidang, bundle, entries, query, unit]);
  const paged = paginateCatalogItems(filteredEntries, page, PAGE_SIZE);

  function updateUrl(nextPage = page): void {
    window.history.pushState({}, '', catalogUrl({
      q: query.trim() || undefined,
      bundle: bundle || undefined,
      bidang: bidang || undefined,
      unit: unit || undefined,
      page: nextPage,
    }));
  }

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPage(1);
    updateUrl(1);
  }

  function changeFilter(field: 'bundle' | 'bidang' | 'unit', value: string): void {
    const setters = { bundle: setBundle, bidang: setBidang, unit: setUnit };
    setters[field](value);
    setPage(1);
    const next: CatalogSearchParams = {
      q: query.trim() || undefined,
      bundle: field === 'bundle' ? value || undefined : bundle || undefined,
      bidang: field === 'bidang' ? value || undefined : bidang || undefined,
      unit: field === 'unit' ? value || undefined : unit || undefined,
      page: 1,
    };
    window.history.pushState({}, '', catalogUrl(next));
  }

  function clearFilters(): void {
    setQuery('');
    setBundle('');
    setBidang('');
    setUnit('');
    setPage(1);
    window.history.pushState({}, '', '/katalog/');
  }

  const activeFilterCount = [bundle, bidang, unit].filter(Boolean).length;
  const filterControls = (
    <div className="mt-5 grid gap-5">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Bundle</span>
        <select className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm" onChange={(event) => changeFilter('bundle', event.target.value)} value={bundle}>
          <option value="">Semua bundle</option>
          {bundles.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Bidang</span>
        <select className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm" onChange={(event) => changeFilter('bidang', event.target.value)} value={bidang}>
          <option value="">Semua bidang</option>
          {bidangOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Satuan</span>
        <select className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm" onChange={(event) => changeFilter('unit', event.target.value)} value={unit}>
          <option value="">Semua satuan</option>
          {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      {(query || bundle || bidang || unit) && (
        <Button onClick={clearFilters} size="sm" variant="ghost">
          <X aria-hidden="true" className="h-4 w-4" />
          Hapus filter
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
      <aside className="hidden h-fit rounded-2xl border border-border/80 bg-card/60 p-4 lg:order-1 lg:block lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Saring katalog</p>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </div>
        {filterControls}
      </aside>

      <details className="order-2 rounded-2xl border border-border/80 bg-card/60 lg:hidden" open={activeFilterCount > 0}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-semibold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> Filter katalog</span>
          <span className="text-xs font-normal text-muted-foreground">{activeFilterCount > 0 ? `${activeFilterCount} aktif` : 'Opsional'}</span>
        </summary>
        <div className="border-t border-border/80 p-4">{filterControls}</div>
      </details>

      <section className="order-1 lg:order-2" aria-labelledby="catalog-results-heading">
        <form className="flex gap-2" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="catalog-search">Cari katalog</label>
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" enterKeyHint="search" id="catalog-search" inputMode="search" onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode atau nama pekerjaan…" type="search" value={query} />
            </div>
          <Button type="submit">Cari</Button>
        </form>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hasil katalog</p>
            <h2 className="mt-1 font-serif text-2xl" id="catalog-results-heading">{paged.total.toLocaleString('id-ID')} item</h2>
          </div>
          <p aria-atomic="true" aria-live="polite" className="text-sm text-muted-foreground" role="status">{paged.total.toLocaleString('id-ID')} hasil · Halaman {paged.page} dari {paged.totalPages}</p>
        </div>

        {paged.items.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-card/50">
            <div className="hidden grid-cols-[7rem_1fr_12rem_4rem] gap-4 border-b border-border/80 bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
              <span>Kode</span><span>Pekerjaan</span><span>Bundle</span><span>Satuan</span>
            </div>
            <ul className="divide-y divide-border/70">
              {paged.items.map((entry) => (
                <li key={entry.key}>
                  <a className="grid gap-2 px-5 py-4 transition-colors hover-fine-bg-muted-50 sm:grid-cols-[7rem_1fr_12rem_4rem] sm:items-center sm:gap-4" href={entry.href}>
                    <span className="font-mono text-sm font-semibold text-primary">{entry.code}</span>
                    <span className="min-w-0">
                      <span className="block break-words font-medium sm:truncate" title={entry.name}>{entry.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{entry.bidang} · Divisi {entry.divisi}</span>
                    </span>
                    <Badge className="w-fit" variant="muted">{entry.bundleName}</Badge>
                    <span className="text-sm text-muted-foreground sm:text-right">{entry.unit}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="font-serif text-2xl">Tidak ada hasil</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Tidak ada item yang cocok dengan pencarian atau filter saat ini. Coba kata kunci lain atau hapus filter.</p>
            <Button className="mt-5" onClick={clearFilters} variant="outline">Hapus filter</Button>
          </div>
        )}

        {paged.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button disabled={paged.page <= 1} onClick={() => { const next = paged.page - 1; setPage(next); updateUrl(next); }} variant="outline">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Sebelumnya
            </Button>
            <span className="font-mono text-xs text-muted-foreground">{paged.page}/{paged.totalPages}</span>
            <Button disabled={paged.page >= paged.totalPages} onClick={() => { const next = paged.page + 1; setPage(next); updateUrl(next); }} variant="outline">
              Berikutnya <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
