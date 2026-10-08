#!/usr/bin/env node
/**
 * Emit unified catalog search shards under apps/web/public/search.
 * Uses Vite SSR (resolved via Astro's dependency tree) to load the TypeScript emitter.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = join(root, 'apps/web');
const requireFromWeb = createRequire(join(webRoot, 'package.json'));
const requireFromAstro = createRequire(requireFromWeb.resolve('astro'));
const viteEntry = pathToFileURL(requireFromAstro.resolve('vite')).href;
const { createServer } = await import(viteEntry);

const server = await createServer({
  root: webRoot,
  configFile: false,
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
  resolve: {
    alias: {
      '@': join(webRoot, 'src'),
    },
  },
  ssr: {
    noExternal: true,
  },
});

const mod = await server.ssrLoadModule(
  pathToFileURL(join(webRoot, 'src/lib/emit-search-shards.ts')).href,
);
const manifest = await mod.emitSearchShards();
await server.close();
console.log(
  `[build-web-search-index] wrote ${manifest.total} entries → apps/web/public/search ` +
    `(ahsp=${manifest.counts['ahsp-coef']}, hsp=${manifest.counts['hsp-portal']}, ` +
    `resource=${manifest.counts.resource}, productivity=${manifest.counts.productivity})`,
);
