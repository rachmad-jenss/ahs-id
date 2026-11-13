import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  loadAhspSearchEntries,
  loadHspPortalSearchEntries,
  type SearchIndexEntry,
} from '@/lib/search-client';
import { cn } from '@/lib/utils';

const SUGGESTION_LIMIT = 10;

interface AhspCodeComboboxProps {
  readonly 'aria-labelledby'?: string;
  readonly bundle: string;
  readonly id?: string;
  /** Nama item dari engine saat meta sudah dimuat (lebih akurat daripada indeks). */
  readonly resolvedName?: string;
  readonly onChange: (code: string) => void;
  readonly value: string;
}

/** Searchable AHSP code field scoped to one calculator bundle. */
export function AhspCodeCombobox({
  'aria-labelledby': ariaLabelledby,
  bundle,
  id,
  resolvedName,
  onChange,
  value,
}: AhspCodeComboboxProps) {
  const listboxId = useId();
  const previewId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<readonly SearchIndexEntry[]>([]);
  const [indexState, setIndexState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const bundleEntries = useMemo(() => {
    if (bundle === 'hsp-jakarta-dcktrp') {
      return entries.filter((row) => row.kind === 'hsp-portal' && row.bundleId === bundle);
    }
    return entries.filter((row) => row.kind === 'ahsp-coef' && row.bundleId === bundle);
  }, [bundle, entries]);

  const fuse = useMemo(() => {
    if (bundleEntries.length === 0) return null;
    return new Fuse(bundleEntries, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.38,
      keys: [
        { name: 'code', weight: 1.5 },
        { name: 'name', weight: 1.1 },
        { name: 'subtitle', weight: 0.4 },
      ],
    });
  }, [bundleEntries]);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q || !fuse) return [];
    return fuse.search(q, { limit: SUGGESTION_LIMIT }).map((row) => row.item);
  }, [fuse, value]);

  const exactMatch = useMemo(() => {
    const code = value.trim();
    if (!code) return undefined;
    return bundleEntries.find((row) => row.code === code);
  }, [bundleEntries, value]);

  const previewName = resolvedName?.trim() || exactMatch?.name;

  const listOpen = open && value.trim().length > 0;
  const showResolvedName = Boolean(previewName) && !listOpen;

  function ensureIndex(): void {
    if (indexState !== 'idle') return;
    setIndexState('loading');
    const loader =
      bundle === 'hsp-jakarta-dcktrp' ? loadHspPortalSearchEntries() : loadAhspSearchEntries();
    void loader
      .then((loaded) => {
        setEntries(loaded);
        setIndexState('ready');
      })
      .catch(() => {
        setIndexState('error');
      });
  }

  useEffect(() => {
    setEntries([]);
    setIndexState('idle');
    setOpen(false);
    setActiveIndex(-1);
  }, [bundle]);

  useEffect(() => {
    if (value.trim()) {
      ensureIndex();
    }
  }, [bundle, value]);

  useEffect(() => {
    if (!listOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onPointerDown, true);
    };
  }, [listOpen]);

  function chooseCode(code: string): void {
    onChange(code);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative min-w-0 w-full" ref={rootRef}>
      <div className="relative flex h-11 min-w-0 items-center rounded-xl border border-input bg-background py-2 pl-10 pr-3 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
            aria-activedescendant={
              activeIndex >= 0 && suggestions[activeIndex]
                ? `${listboxId}-opt-${activeIndex}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-describedby={showResolvedName ? previewId : undefined}
            aria-expanded={listOpen}
            aria-haspopup="listbox"
            aria-labelledby={ariaLabelledby}
            autoComplete="off"
            className="h-8 min-w-0 w-full border-0 bg-transparent px-0 font-mono text-base shadow-none focus-visible:ring-0"
            id={id}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              ensureIndex();
              if (!previewName) {
                setOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (event.key === 'ArrowDown' && previewName && !listOpen) {
                setOpen(true);
              }
              if (!listOpen || suggestions.length === 0) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((prev) => {
                  const next = (prev + 1) % suggestions.length;
                  document.getElementById(`${listboxId}-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
                  return next;
                });
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((prev) => {
                  const next = prev <= 0 ? suggestions.length - 1 : prev - 1;
                  document.getElementById(`${listboxId}-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
                  return next;
                });
                return;
              }
              if (event.key === 'Enter' && activeIndex >= 0) {
                const selected = suggestions[activeIndex];
                if (selected) {
                  event.preventDefault();
                  chooseCode(selected.code);
                }
              }
            }}
            placeholder="Cari kode atau nama item…"
            role="combobox"
            spellCheck={false}
            value={value}
          />
      </div>
      {showResolvedName ? (
        <p
          className="mt-2 line-clamp-3 text-pretty text-xs leading-5 text-muted-foreground"
          id={previewId}
        >
          {previewName}
        </p>
      ) : null}
      {listOpen ? (
        <ul
          className="scrollbar-surface absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-input bg-card py-1 text-foreground shadow-lg"
          id={listboxId}
          role="listbox"
        >
          {indexState === 'loading' && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">Memuat daftar item…</li>
          )}
          {indexState === 'error' && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              Saran tidak tersedia — ketik kode lengkap secara manual.
            </li>
          )}
          {indexState === 'ready' && suggestions.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">Tidak ada item cocok di bundel ini.</li>
          )}
          {suggestions.map((entry, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                aria-selected={isActive}
                id={`${listboxId}-opt-${index}`}
                key={entry.key}
                role="option"
              >
                <button
                  className={cn(
                    'w-full px-3 py-2.5 text-left text-sm transition-colors',
                    isActive && 'bg-primary text-primary-foreground',
                    !isActive && 'hover:bg-primary hover:text-primary-foreground',
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseCode(entry.code)}
                  tabIndex={-1}
                  type="button"
                >
                  <span className="font-mono font-semibold">{entry.code}</span>
                  <span className="mt-0.5 block text-xs leading-5 opacity-90">{entry.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
