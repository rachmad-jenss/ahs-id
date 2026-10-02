import Fuse from 'fuse.js';
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
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

/** Render the searchable, filterable catalog and synchronize applied state with its URL. */
export function CatalogBrowser({ entries, bundles, initialParams }: CatalogBrowserProps): React.JSX.Element {
  const [query, setQuery] = useState(initialParams.q ?? '');
  const [draftQuery, setDraftQuery] = useState(initialParams.q ?? '');
  const [bundle, setBundle] = useState(initialParams.bundle ?? '');
  const [bidang, setBidang] = useState(initialParams.bidang ?? '');
  const [unit, setUnit] = useState(initialParams.unit ?? '');
  const [page, setPage] = useState(initialParams.page ?? 1);
  const [filterOpen, setFilterOpen] = useState(Boolean(initialParams.q || initialParams.bundle || initialParams.bidang || initialParams.unit));
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  /** Move focus to the result summary after a navigation state change. */
  const focusResults = useCallback((): void => {
    window.requestAnimationFrame(() => resultsHeadingRef.current?.focus());
  }, []);

  useEffect(() => {
    /** Restore applied and draft catalog state after browser navigation or island hydration. */
    function syncFromLocation(shouldFocus = true): void {
      const params = parseCatalogSearchParams(new URLSearchParams(window.location.search));
      setQuery(params.q ?? '');
      setDraftQuery(params.q ?? '');
      setBundle(params.bundle ?? '');
      setBidang(params.bidang ?? '');
      setUnit(params.unit ?? '');
      setPage(params.page ?? 1);
      if (shouldFocus) focusResults();
    }

    const currentParams = parseCatalogSearchParams(new URLSearchParams(window.location.search));
    if (catalogUrl(currentParams) !== catalogUrl(initialParams)) syncFromLocation(false);
    const handlePopState = (): void => syncFromLocation();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [focusResults, initialParams]);

  useEffect(() => {
    const currentParams = parseCatalogSearchParams(new URLSearchParams(window.location.search));
    const appliedParams = {
      q: query.trim() || undefined,
      bundle: bundle || undefined,
      bidang: bidang || undefined,
      unit: unit || undefined,
      page,
    };
    if (catalogUrl(currentParams) !== catalogUrl(appliedParams)) return;
    document.querySelector<HTMLElement>('[data-catalog-shell]')?.removeAttribute('data-catalog-url-pending');
  }, [bidang, bundle, page, query, unit]);

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

  /** Commit a catalog state change to browser history and announce the result context. */
  function pushUrl(next: CatalogSearchParams): void {
    window.history.pushState({}, '', catalogUrl(next));
    focusResults();
  }

  /** Apply the draft query and reset pagination when the search form is submitted. */
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    setQuery(nextQuery);
    setPage(1);
    pushUrl({
      q: nextQuery || undefined,
      bundle: bundle || undefined,
      bidang: bidang || undefined,
      unit: unit || undefined,
      page: 1,
    });
  }

  /** Apply one catalog filter while preserving the other committed criteria. */
  function changeFilter(field: 'bundle' | 'bidang' | 'unit', value: string): void {
    const setters = { bundle: setBundle, bidang: setBidang, unit: setUnit };
    setters[field](value);
    setPage(1);
    pushUrl({
      q: query.trim() || undefined,
      bundle: field === 'bundle' ? value || undefined : bundle || undefined,
      bidang: field === 'bidang' ? value || undefined : bidang || undefined,
      unit: field === 'unit' ? value || undefined : unit || undefined,
      page: 1,
    });
  }

  /** Clear all search and filter criteria and return to the first result page. */
  function clearFilters(): void {
    setQuery('');
    setDraftQuery('');
    setBundle('');
    setBidang('');
    setUnit('');
    setPage(1);
    pushUrl({ page: 1 });
  }

  /** Navigate to a catalog page while preserving the committed criteria. */
  function goToPage(nextPage: number): void {
    setPage(nextPage);
    pushUrl({
      q: query.trim() || undefined,
      bundle: bundle || undefined,
      bidang: bidang || undefined,
      unit: unit || undefined,
      page: nextPage,
    });
  }

  const hasSearch = query.trim().length > 0;
  const hasFilters = [bundle, bidang, unit].some(Boolean);
  const hasActiveCriteria = hasSearch || hasFilters;
  const activeFilterCount = [hasSearch, hasFilters].filter(Boolean).length;
  const clearLabel = hasSearch && hasFilters
    ? 'Reset pencarian dan filter'
    : hasSearch
      ? 'Hapus pencarian'
      : 'Reset filter';
  const activeSummary = hasSearch && !hasFilters
    ? 'Pencarian aktif'
    : activeFilterCount > 0
      ? `${activeFilterCount} aktif`
      : 'Opsional';

  useEffect(() => {
    setFilterOpen(hasActiveCriteria);
  }, [hasActiveCriteria]);

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
      {hasActiveCriteria && (
        <Button onClick={clearFilters} size="sm" variant="ghost">
          <X aria-hidden="true" className="h-4 w-4" />
          {clearLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_1fr]" data-catalog-browser>
      <aside aria-labelledby="catalog-filters-heading" className="hidden h-fit rounded-2xl border border-border/80 bg-card/60 p-4 lg:block lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" id="catalog-filters-heading">Filter katalog</h2>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </div>
        {filterControls}
      </aside>

      <details className="group rounded-2xl border border-border/80 bg-card/60 lg:hidden" onToggle={(event) => setFilterOpen(event.currentTarget.open)} open={filterOpen}>
        <summary aria-label={filterOpen ? 'Tutup filter katalog' : 'Buka filter katalog'} className="pressable flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 text-sm font-semibold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2"><SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-muted-foreground" /> Filter katalog</span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{activeSummary}<ChevronDown aria-hidden="true" className="disclosure-chevron h-4 w-4 transition-transform duration-150 group-open:rotate-180" /></span>
        </summary>
        <div className="border-t border-border/80 p-4">{filterControls}</div>
      </details>

      <section aria-labelledby="catalog-results-heading">
        <form className="flex gap-2" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="catalog-search">Cari katalog</label>
          <div className="relative flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoComplete="off" className="pl-10" enterKeyHint="search" id="catalog-search" inputMode="search" name="q" onChange={(event) => setDraftQuery(event.target.value)} placeholder="Cari kode atau nama pekerjaan…" type="search" value={draftQuery} />
          </div>
          <Button type="submit">Cari</Button>
        </form>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Hasil katalog</p>
            <h2 className="mt-1 font-serif text-2xl" id="catalog-results-heading" ref={resultsHeadingRef} tabIndex={-1}>{paged.total.toLocaleString('id-ID')} item</h2>
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
                  <a className="pressable grid gap-2 px-5 py-4 transition-colors hover-fine-bg-muted-50 sm:grid-cols-[7rem_1fr_12rem_4rem] sm:items-center sm:gap-4" href={entry.href}>
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
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{hasSearch ? `Tidak ada item yang cocok dengan “${query.trim()}”. Coba kata kunci lain atau reset filter.` : 'Tidak ada item yang cocok dengan filter saat ini. Coba ubah pilihan atau reset filter.'}</p>
            <Button className="mt-5" onClick={clearFilters} variant="outline">{clearLabel}</Button>
          </div>
        )}

        {paged.totalPages > 1 && (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:items-center sm:justify-between">
            <Button className="min-w-0 justify-self-start px-3 text-xs sm:px-4 sm:text-sm" disabled={paged.page <= 1} onClick={() => goToPage(paged.page - 1)} variant="outline">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Sebelumnya
            </Button>
            <span className="font-mono text-xs text-muted-foreground">{paged.page}/{paged.totalPages}</span>
            <Button className="min-w-0 justify-self-end px-3 text-xs sm:px-4 sm:text-sm" disabled={paged.page >= paged.totalPages} onClick={() => goToPage(paged.page + 1)} variant="outline">
              Berikutnya <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
