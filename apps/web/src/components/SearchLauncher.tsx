import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadSearchIndex, type SearchIndexEntry } from '@/lib/search-client';
import { SEARCH_KIND_LABELS } from '@/lib/search-index';

interface SearchExample {
  readonly label: string;
  readonly query: string;
}

interface SearchLauncherProps {
  readonly examples: readonly SearchExample[];
}

const SUGGESTION_LIMIT = 8;

/** Render the homepage search control and its example query shortcuts. */
export function SearchLauncher({ examples }: SearchLauncherProps): React.JSX.Element {
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<readonly SearchIndexEntry[]>([]);
  const [indexState, setIndexState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const fuse = useMemo(() => {
    if (entries.length === 0) return null;
    return new Fuse(entries, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.36,
      keys: [
        { name: 'code', weight: 1.4 },
        { name: 'name', weight: 1.2 },
        { name: 'badge', weight: 0.5 },
        { name: 'subtitle', weight: 0.6 },
        { name: 'bundleName', weight: 0.5 },
      ],
    });
  }, [entries]);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q || !fuse) return [];
    return fuse.search(q, { limit: SUGGESTION_LIMIT }).map((row) => row.item);
  }, [fuse, query]);

  useEffect(() => {
    /** Close suggestion list when clicking outside the launcher. */
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  /** Lazy-load search shards once the hero field is focused. */
  function ensureIndex(): void {
    if (indexState !== 'idle') return;
    setIndexState('loading');
    void loadSearchIndex()
      .then(({ entries: loaded }) => {
        setEntries(loaded);
        setIndexState('ready');
      })
      .catch(() => {
        setIndexState('error');
      });
  }

  /** Navigate to the catalog with the submitted query. */
  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const suffix = params.toString();
    window.location.href = suffix ? `/katalog/?${suffix}` : '/katalog/';
  }

  /** Apply an example query immediately from the homepage shortcut list. */
  function chooseExample(value: string): void {
    setQuery(value);
    window.location.href = `/katalog/?q=${encodeURIComponent(value)}`;
  }

  /** Open a suggestion hit (detail page or catalog). */
  function chooseSuggestion(entry: SearchIndexEntry): void {
    window.location.href = entry.href;
  }

  return (
    <div className="w-full max-w-3xl" ref={rootRef}>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="hero-search">Cari item pekerjaan</label>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-activedescendant={
              activeIndex >= 0 && suggestions[activeIndex]
                ? `${listboxId}-opt-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open && query.trim().length > 0}
            aria-haspopup="listbox"
            autoComplete="off"
            className="h-14 rounded-2xl border-primary/40 pl-12 pr-4 text-base shadow-sm focus-visible:border-primary"
            id="hero-search"
            inputMode="search"
            name="q"
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              ensureIndex();
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (!open) return;
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (suggestions.length === 0) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((prev) => {
                  const next = (prev + 1) % suggestions.length;
                  window.requestAnimationFrame(() => {
                    document.getElementById(`${listboxId}-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
                  });
                  return next;
                });
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((prev) => {
                  const next = prev <= 0 ? suggestions.length - 1 : prev - 1;
                  window.requestAnimationFrame(() => {
                    document.getElementById(`${listboxId}-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
                  });
                  return next;
                });
                return;
              }
              if (event.key === 'Enter' && activeIndex >= 0) {
                const selected = suggestions[activeIndex];
                if (selected) {
                  event.preventDefault();
                  chooseSuggestion(selected);
                }
              }
            }}
            placeholder="Cari kode, nama pekerjaan, atau bundel…"
            enterKeyHint="search"
            role="combobox"
            type="search"
            value={query}
          />
          {open && query.trim() && (
            <ul
              className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-border/80 bg-card p-2 shadow-lg"
              id={listboxId}
              role="listbox"
            >
              {indexState === 'loading' && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Memuat saran…</li>
              )}
              {indexState === 'error' && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Saran tidak tersedia — tekan Enter untuk cari di katalog.
                </li>
              )}
              {indexState === 'ready' && suggestions.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ada saran. Tekan Enter untuk cari.</li>
              )}
              {suggestions.map((entry, index) => (
                <li
                  aria-selected={index === activeIndex}
                  id={`${listboxId}-opt-${index}`}
                  key={entry.key}
                  role="option"
                >
                  <button
                    className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover-fine-bg-muted ${
                      index === activeIndex ? 'bg-muted' : ''
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(entry)}
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="font-medium text-foreground">
                      <span className="font-mono text-primary">{entry.code}</span>
                      {' · '}
                      {entry.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {SEARCH_KIND_LABELS[entry.kind]} · {entry.subtitle}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button className="h-14 rounded-2xl px-6" size="lg" type="submit">
          Cari AHSP
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="mr-1">Coba cari:</span>
        {examples.map((example) => (
          <button
            className="pressable pressable-chip inline-flex min-h-11 items-center rounded-full border border-border bg-background/70 px-3 py-1.5 hover-fine-border-primary hover-fine-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={example.query}
            onClick={() => chooseExample(example.query)}
            type="button"
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
