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
    expect(styles).toContain('.pressable:not([class*="transition-"]):not(.pressable-chip)');
    expect(styles).toContain('--selection-background');
    expect(styles).toContain('--code-surface');
    expect(styles).toContain('.home-hero-backdrop');
    expect(home).toContain('home-hero-backdrop');
    expect(home).toContain('Temukan data AHSP dengan jejak sumber yang jelas.');
    expect(home).toContain('Data yang siap ditelusuri.');
    expect(home).toContain('featured-card-title');
    expect(launcher).toContain('pressable-chip');
    expect(launcher).toContain('justify-center');
    expect(home).not.toContain('Open source · Indonesia');
    expect(home).not.toContain('>Provenance</');
    expect(layout).not.toContain('Source di GitHub');
    expect(layout).toContain('Sumber dan Metodologi');
    expect(layout).toContain('Kode Sumber di GitHub');
    expect(layout).toContain('Paket di NPM');
    expect(layout).toContain('Dibuat untuk Developer');
    expect(layout).toContain('/ahs-id-logo.png');
    expect(about).not.toContain('foundation layer');
    expect(about).not.toContain('open source');
    expect(notFound).not.toContain('NOT FOUND');
    expect(styles).not.toContain('transition: all');
  });

  it('emits theme and responsive code cues in the built page shell', () => {
    const builtHome = readFileSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)), 'utf8');

    expect(builtHome).toContain('ahs-id-theme');
    expect(builtHome).toContain('theme-toggle');
    expect(builtHome).toContain('requestAnimationFrame');
    expect(builtHome).toContain('Geser kode ke samping untuk melihat baris lengkap.');
    expect(builtHome).toContain('code-surface');
  });
});
