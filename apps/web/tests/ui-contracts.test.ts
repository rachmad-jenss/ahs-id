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
    expect(styles).toContain('display: block;');
    expect(styles).toContain('max-height: 0;');
  });

  it('keeps every hover affordance scoped to fine pointers', () => {
    const source = readSourceTree('src');

    expect(source).not.toMatch(/(?:class|className)=["'][^"']*\b(?:group-)?hover:/);
  });

  it('marks search controls for mobile and assistive technology', () => {
    const launcher = readSource('src/components/SearchLauncher.tsx');

    expect(launcher).toContain('type="search"');
    expect(launcher).toContain('inputMode="search"');
    expect(launcher).toContain('enterKeyHint="search"');
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
    expect(catalog.indexOf('<section')).toBeLessThan(catalog.indexOf('<details'));
    expect(catalog).toContain('type="search"');
    expect(catalog).toContain('inputMode="search"');
    expect(catalog).toContain('enterKeyHint="search"');
    expect(catalog).toContain('role="status"');
    expect(catalog).toContain('aria-atomic="true"');
    expect(catalog).toContain('break-words font-medium');
    expect(catalog).not.toContain('block truncate font-medium');
  });

  it('keeps wide item tables understandable on narrow screens', () => {
    const item = readSource('src/pages/item/[bundle]/[code].astro');
    const styles = readSource('src/styles/global.css');

    expect(item).toContain('Geser tabel ke samping');
    expect(item).toContain('tabindex="0"');
    expect(item).toContain('role="region"');
    expect(item).toContain('table-scroll');
    expect(item).toContain('<caption class="sr-only">');
    expect(item).toContain('scope="col"');
    expect(styles).toContain('--font-sans: ui-sans-serif');
    expect(styles).not.toContain("--font-sans: 'Inter'");
  });
});
