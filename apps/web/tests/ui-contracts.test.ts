import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

function readSourceTree(relativePath: string): string {
  const directory = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const files: string[] = [];

  function visit(path: string): void {
    for (const entry of readdirSync(path)) {
      const entryPath = `${path}/${entry}`;
      if (statSync(entryPath).isDirectory()) {
        visit(entryPath);
      } else if (/\.(astro|css|tsx?|ts)$/.test(entryPath)) {
        files.push(readFileSync(entryPath, 'utf8'));
      }
    }
  }

  visit(directory);
  return files.join('\n');
}

describe('web UI contracts', () => {
  it('exposes complete navigation and mobile motion semantics', () => {
    const layout = readSource('src/layouts/SiteLayout.astro');
    const styles = readSource('src/styles/global.css');

    expect(layout).toContain("{ href: '/tentang/', label: 'Tentang' }");
    expect(layout).toContain('aria-current={currentPath.startsWith(item.href) ? \'page\' : undefined}');
    expect(layout).toContain('mobile-menu-panel');
    expect(styles).toContain('@media (hover: hover) and (pointer: fine)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('text-size-adjust: 100%;');
    expect(styles).toContain('.pressable:active');
    expect(styles).toContain('--motion-duration-fast');
    expect(styles).toContain('.disclosure-chevron');
    expect(styles).toContain('transition: none !important;');
    expect(styles).not.toContain('max-height: 0;');
  });

  it('keeps every hover affordance scoped to fine pointers', () => {
    const source = readSourceTree('src');

    expect(source).not.toMatch(/(?:class|className)=["'][^"']*\b(?:group-)?hover:/);
  });

  it('marks search controls for mobile and assistive technology', () => {
    const launcher = readSource('src/components/SearchLauncher.tsx');
    const catalog = readSource('src/components/CatalogBrowser.tsx');

    expect(launcher).toContain('type="search"');
    expect(launcher).toContain('inputMode="search"');
    expect(launcher).toContain('enterKeyHint="search"');
    expect(launcher).toContain('name="q"');
    expect(catalog).toContain('name="q"');
  });

  it('uses real package exports in both quick-start surfaces', () => {
    const home = readSource('src/pages/index.astro');
    const docs = readSource('src/pages/docs/index.astro');

    expect(home).toContain("{'{ bundle }'}");
    expect(home).toContain("{'{ hsd }'}");
    expect(home).toContain('calculator.hitungHSP(');
    expect(home).toContain("'3.1.1'");
    expect(home).toContain('jarak_buang_km');
    expect(home).not.toContain('pupr2023');
    expect(docs).toContain("{ bundle } from '@ahs-id/pupr-2023'");
    expect(docs).toContain("{ hsd } from '@ahs-id/hsd-kaltim-2025'");
    expect(docs).toContain("calculator.hitungHSP('3.1.1'");
    expect(docs).toContain('jarak_buang_km');
    expect(docs).not.toContain('hitungHSP(input)');
  });

  it('keeps shared controls touch-sized', () => {
    const button = readSource('src/components/ui/button.tsx');

    expect(button).toContain("default: 'min-h-11'");
    expect(button).toContain("sm: 'min-h-11");
    expect(button).toContain("icon: 'h-11 w-11");
  });

  it('keeps catalog results contained, filterable, and screen-reader friendly', () => {
    const page = readSource('src/pages/katalog/index.astro');
    const catalog = readSource('src/components/CatalogBrowser.tsx');

    expect(page).toContain('mx-auto max-w-7xl');
    expect(catalog).toContain('<details');
    expect(catalog).toContain('lg:hidden');
    expect(catalog.indexOf('<details')).toBeLessThan(catalog.indexOf('<section aria-labelledby="catalog-results-heading"'));
    expect(catalog).toContain('type="search"');
    expect(catalog).toContain('inputMode="search"');
    expect(catalog).toContain('enterKeyHint="search"');
    expect(catalog).toContain('draftQuery');
    expect(catalog).toContain('catalogUrl(currentParams) !== catalogUrl(initialParams)');
    expect(catalog).toContain('syncFromLocation(false)');
    expect(catalog).toContain('const appliedParams =');
    expect(catalog).toContain('catalogUrl(appliedParams)');
    expect(catalog).toContain('data-catalog-url-pending');
    expect(page).toContain('data-catalog-shell');
    expect(page).toContain("['q', 'bundle', 'bidang', 'unit', 'page']");
    expect(page).toContain('window.setTimeout');
    expect(catalog).toContain('resultsHeadingRef');
    expect(catalog).toContain('role="status"');
    expect(catalog).toContain('aria-atomic="true"');
    expect(catalog).toContain('Pencarian aktif');
    expect(catalog).toContain('aria-label={filterOpen ? \'Tutup filter katalog\' : \'Buka filter katalog\'}');
    expect(catalog).toContain('onToggle={(event) => setFilterOpen(event.currentTarget.open)}');
    expect(catalog).toContain('break-words font-medium');
    expect(catalog).not.toContain('block truncate font-medium');
    expect(catalog).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
  });

  it('keeps wide item tables understandable on narrow screens', () => {
    const item = readSource('src/pages/item/[bundle]/[code].astro');
    const styles = readSource('src/styles/global.css');

    expect(item).toContain('Geser tabel ke samping');
    expect(item).toContain('tabindex="0"');
    expect(item).toContain('role="region"');
    expect(item).toContain('aria-describedby');
    expect(item).toContain('xl:sr-only');
    expect(item).not.toContain('lg:sr-only');
    expect(item).toContain('table-scroll');
    expect(item).toContain('<caption class="sr-only">');
    expect(item).toContain('scope="col"');
    expect(item).toContain('HSD dinamis');
    expect(item).toContain('Ekstraksi otomatis');
    expect(item).not.toContain('Dynamic HSD');
    expect(item).not.toContain('Fixed coefficient');
    expect(styles).toContain('--font-sans: ui-sans-serif');
    expect(styles).not.toContain("--font-sans: 'Inter'");
  });

  it('contains the homepage code sample within the mobile layout', () => {
    const home = readSource('src/pages/index.astro');

    expect(home).toContain('grid min-w-0 gap-12');
    expect(home).toContain('<div class="min-w-0">');
    expect(home).toContain('min-w-0 rounded-[2rem]');
    expect(home).toContain('max-w-full overflow-x-auto');
    expect(home).toContain('tabindex="0" role="region" aria-label="Contoh kode npm quick start"');
    expect(home).toContain('Geser kode ke samping untuk melihat baris lengkap.');
  });

  it('keeps visual tokens, copy, and motion properties semantic', () => {
    const home = readSource('src/pages/index.astro');
    const bundles = readSource('src/pages/bundles/index.astro');
    const docs = readSource('src/pages/docs/index.astro');
    const methodology = readSource('src/pages/metodologi/index.astro');
    const styles = readSource('src/styles/global.css');
    const source = readSourceTree('src');

    expect(home).not.toContain('text-primary-foreground/65');
    expect(home).toContain('transition-[transform,border-color,box-shadow]');
    expect(home).toContain('class="pressable inline-flex items-center gap-2 font-semibold');
    expect(styles).toContain('.pressable:not([class*="transition-"]):not(.pressable-chip)');
    expect(bundles).toContain('Sumber data');
    expect(docs).toContain('Dokumentasi untuk developer');
    expect(methodology).toContain('bg-warning-surface');
    expect(methodology).not.toContain('bg-amber-');
    expect(methodology).toContain('Sumber');
    expect(methodology).toContain('Normalisasi');
    expect(methodology).toContain('Verifikasi');
    expect(styles).toContain('--color-warning-surface');
    expect(styles).toContain('text-wrap: balance;');
    expect(styles).toContain('text-wrap: pretty;');
    expect(styles).toContain('[data-catalog-shell][data-catalog-url-pending]');
    expect(styles).toContain('transition: opacity 150ms ease-out');
    expect(styles).not.toContain('transition-property: opacity, color, background-color, border-color, box-shadow !important;');
    expect(source).toContain('transition-[transform,color]');
  });

  it('covers residual theme, shell, semantics, mobile, and copy contracts', () => {
    const layout = readSource('src/layouts/SiteLayout.astro');
    const styles = readSource('src/styles/global.css');
    const catalog = readSource('src/components/CatalogBrowser.tsx');
    const bundles = readSource('src/pages/bundles/index.astro');
    const docs = readSource('src/pages/docs/index.astro');
    const item = readSource('src/pages/item/[bundle]/[code].astro');
    const methodology = readSource('src/pages/metodologi/index.astro');

    expect(layout).toContain('width=device-width, initial-scale=1, viewport-fit=cover');
    expect(layout).toContain('<main class="safe-area-main" id="main-content" tabindex="-1">');
    expect(layout).toContain('ahs-id-theme');
    expect(layout).toContain('theme-select');
    expect(layout).toContain('value="system"');
    expect(layout).toContain('value="light"');
    expect(layout).toContain('value="dark"');
    expect(layout).toContain('aria-labelledby="theme-label"');
    expect(styles).toContain(":root[data-theme='dark']");
    expect(styles).toContain("@media (prefers-color-scheme: dark)");
    expect(styles).toContain('color-scheme:');
    expect(styles).toContain('safe-area-inset-top');
    expect(styles).toContain('safe-area-inset-bottom');
    expect(styles).toContain('safe-area-inset-left');
    expect(styles).toContain('safe-area-inset-right');
    expect(styles).toContain('overscroll-behavior-x: none;');
    expect(styles).toContain('[data-theme-switching]');
    expect(styles).toContain('.pressable-chip:active');
    expect(styles).toContain('--selection-background');
    expect(styles).toContain('--code-surface');
    expect(styles).toContain('.code-keyword');
    expect(styles).toContain('.home-hero-backdrop');
    expect(styles).toContain('a.pressable');

    expect(catalog).toContain('aria-labelledby="catalog-filters-heading"');
    expect(item).toContain('aria-labelledby="summary-heading"');
    expect(item).toContain('aria-labelledby="provenance-heading"');
    expect(methodology).toContain('aria-labelledby="quarantine-heading"');
    expect(docs).toContain('<pre');
    expect(docs).toContain('tabindex="0" role="region"');
    expect(docs).toContain('whitespace-pre');
    expect(docs).toContain('Geser kode ke samping untuk melihat baris lengkap.');
    expect(bundles).toContain('bundle-card-link');
    expect(bundles).not.toContain('aria-label={`Jelajahi bundle');
    expect(bundles).not.toContain('Jelajahi bundle</a>');
  });

});
