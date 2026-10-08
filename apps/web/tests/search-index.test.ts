import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitSearchShards } from '../src/lib/emit-search-shards.js';
import type { SearchIndexEntry, SearchManifest } from '../src/lib/search-index.js';
import { parseCatalogSearchParams } from '../src/lib/catalog-url.js';

describe('unified search index', () => {
  it('emits shards with stable keys and minimum counts per kind', async () => {
    const outDir = join(process.cwd(), 'public/search');
    const manifest = await emitSearchShards({ searchOutDir: outDir });

    expect(manifest.version).toBe(1);
    expect(manifest.counts['ahsp-coef']).toBeGreaterThanOrEqual(5_874);
    expect(manifest.counts['hsp-portal']).toBeGreaterThanOrEqual(2_000);
    expect(manifest.counts.resource).toBeGreaterThan(0);
    expect(manifest.counts.productivity).toBeGreaterThan(0);

    const ahsp = JSON.parse(await readFile(join(outDir, 'ahsp.json'), 'utf8')) as SearchIndexEntry[];
    const keys = ahsp.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ahsp.some((entry) => entry.badge === 'AHSP nasional')).toBe(true);
    expect(ahsp.some((entry) => entry.badge === 'AHSP portal DCKTRP')).toBe(true);
    expect(ahsp.every((entry) => entry.href.startsWith('/'))).toBe(true);
  }, 120_000);

  it('parses ?kind= from catalog URLs', () => {
    const params = parseCatalogSearchParams(new URLSearchParams('kind=hsp-portal&q=keramik'));
    expect(params.kind).toBe('hsp-portal');
    expect(params.q).toBe('keramik');
  });

  it('writes a readable manifest for the landing page', async () => {
    const raw = await readFile(join(process.cwd(), 'public/search/manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as SearchManifest;
    expect(manifest.shards).toHaveLength(4);
    expect(manifest.total).toBe(
      manifest.counts['ahsp-coef'] +
        manifest.counts['hsp-portal'] +
        manifest.counts.resource +
        manifest.counts.productivity,
    );
  });
});
