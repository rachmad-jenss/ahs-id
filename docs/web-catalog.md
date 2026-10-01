# AHS-ID public web catalog

The public site lives in `apps/web` and is deployed to `https://ahs-id.jenss.me` as a Cloudflare Worker with Static Assets.

## Scope

- Astro static output with React islands for the landing search and catalog filters.
- shadcn-style primitives in `apps/web/src/components/ui`.
- Catalog pages are generated from the four published bundle packages at build time.
- Public routes: `/`, `/katalog/`, `/item/[bundle]/[code]/`, `/bundles/`, `/docs/`, `/metodologi/`, `/tentang/`, `robots.txt`, and sitemap.
- Search state is URL-driven. Fuzzy search and filters run in the browser over a compact index.
- The web catalog currently excludes seven ambiguous Cipta Karya rows. This is a web projection rule; source packages remain unchanged.

## Local development

```sh
pnpm install
pnpm --filter @ahs-id/web dev
pnpm --filter @ahs-id/web test
pnpm --filter @ahs-id/web typecheck
pnpm --filter @ahs-id/web build
```

The production site is configured in `apps/web/wrangler.jsonc`. Cloudflare Workers Git integration is bound to `rachmad-jenss/ahs-id` on the `main` production branch and owns the production build and deploy. Its configured commands are `pnpm --filter @ahs-id/web... build` and `pnpm --filter @ahs-id/web exec wrangler deploy --env production`. The GitHub workflow verifies the same commit with build, tests, typecheck, and a Wrangler dry-run; it does not require Cloudflare secrets or perform the live deploy.

## Data boundary

`apps/web/src/lib/catalog.ts` normalizes dynamic HSD and fixed-coefficient item shapes into one display model. It does not calculate prices and does not mutate bundle data. Production calculations should use the engine packages and the HSD bundle appropriate to the project.
