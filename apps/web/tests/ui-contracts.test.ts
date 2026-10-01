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
    expect(home).not.toContain('pupr2023');
    expect(docs).toContain("{ bundle } from '@ahs-id/pupr-2023'");
    expect(docs).toContain("{ hsd } from '@ahs-id/hsd-kaltim-2025'");
  });

  it('keeps shared controls touch-sized', () => {
    const button = readSource('src/components/ui/button.tsx');

    expect(button).toContain("default: 'min-h-11'");
    expect(button).toContain("sm: 'min-h-11");
    expect(button).toContain("icon: 'h-11 w-11");
  });
});
