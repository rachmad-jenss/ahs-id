import { Search } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchExample {
  readonly label: string;
  readonly query: string;
}

interface SearchLauncherProps {
  readonly examples: readonly SearchExample[];
}

/** Render the homepage search control and its example query shortcuts. */
export function SearchLauncher({ examples }: SearchLauncherProps): React.JSX.Element {
  const [query, setQuery] = useState('');

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

  return (
    <div className="w-full max-w-3xl">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="hero-search">Cari item pekerjaan</label>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoComplete="off"
            className="h-14 rounded-2xl border-primary/40 pl-12 pr-4 text-base shadow-sm focus-visible:border-primary"
            id="hero-search"
            inputMode="search"
            name="q"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kode, nama pekerjaan, atau bundel…"
            enterKeyHint="search"
            type="search"
            value={query}
          />
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
