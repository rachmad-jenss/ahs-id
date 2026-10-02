import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

describe('residual web copy, color, and motion contracts', () => {
  it('keeps visible copy natural and semantic motion bounded', () => {
    const layout = readSource('src/layouts/SiteLayout.astro');
    const styles = readSource('src/styles/global.css');
    const home = readSource('src/pages/index.astro');
    const about = readSource('src/pages/tentang/index.astro');
    const notFound = readSource('src/pages/404.astro');
    const launcher = readSource('src/components/SearchLauncher.tsx');

    expect(styles).toContain('.pressable-chip:active');
    expect(styles).toContain('.home-hero-backdrop');
    expect(home).toContain('home-hero-backdrop');
    expect(launcher).toContain('pressable-chip');
    expect(home).not.toContain('Open source · Indonesia');
    expect(home).not.toContain('>Provenance</');
    expect(layout).not.toContain('Source di GitHub');
    expect(about).not.toContain('foundation layer');
    expect(notFound).not.toContain('NOT FOUND');
    expect(styles).not.toContain('transition: all');
  });
});
