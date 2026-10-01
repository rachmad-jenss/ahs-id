# AHS-ID Public Web Catalog Implementation Plan

> **For agentic workers:** Implement task-by-task with the TDD and verification gates in the execution workflow.

**Goal:** Ship an accessible Astro + React + shadcn landing page and static AHSP catalog at `ahs-id.jenss.me`.

**Architecture:** Build `apps/web` as a static Astro site. Import the existing workspace data at build time, normalize it into a typed catalog model, exclude the seven approved Cipta Karya quarantine entries, and hydrate only search/filter/navigation islands in React. Deploy the generated `dist/` through Cloudflare Workers Static Assets.

**Tech Stack:** Astro, React, TypeScript, Tailwind CSS 4, shadcn/ui `new-york`, Fuse.js, Vitest, Wrangler, pnpm workspaces.

**Spec:** The approved conversation plan and GitHub issue [#35](https://github.com/rachmad-jenss/ahs-id/issues/35).

## Global Constraints

- Keep existing package source data unchanged; quarantine is a web-catalog policy.
- Public catalog has 2,393 items from the four AHSP bundles.
- Every item page shows source regulation, page, and `auto-extracted` verification status.
- No database, auth, backend API, MCP service, or full interactive HSP calculator.
- Use semantic shadcn tokens, named exports in project code, visible labels, keyboard navigation, and reduced-motion support.
- Preserve unrelated dirty changes in the original checkout.

## Review Focus

- Duplicate Cipta Karya codes must be excluded by stable bundle/code identity and quarantine tests.
- Static generation must produce all detail routes without silently dropping parenthesized codes.
- Search/filter URL state must survive reload and back/forward navigation.
- Large bundle data must not ship to the initial landing-page JavaScript payload.
- Deep links and custom 404 behavior must work from Cloudflare static assets.

### Task 1: Web workspace and catalog model

- Add `apps/web` package, Astro/React/Tailwind/shadcn configuration, shared layout, and data imports.
- Add typed catalog adapter and quarantine manifest.
- Add Vitest tests proving 2,400 source items, seven quarantined items, 2,393 public items, stable keys, and provenance preservation.

### Task 2: Landing and static content routes

- Add header/footer/layout, homepage, bundles, methodology, docs, about, robots, sitemap, and 404 routes.
- Add copy and metadata in Indonesian, using source-backed counts and explicit data freshness/verification language.

### Task 3: Catalog, item pages, and search island

- Add `/katalog`, bundle routes, and item routes with `getStaticPaths()`.
- Add accessible React search/filter/pagination island with Fuse.js, URL state, live result status, empty state, and mobile sheet.
- Add tests for exact code search, typo/name search, filters, pagination, and URL parsing.

### Task 4: CI, Cloudflare, and browser verification

- Add web scripts to root/Turbo CI, Node 22 web setup, Wrangler config, preview/deploy workflows, headers, and custom-domain documentation.
- Add deterministic build checks and browser smoke coverage at desktop/mobile sizes.

### Task 5: Review and delivery

- Run package, data, web, accessibility, build, Wrangler dry-run, and browser checks.
- Perform a separate whole-branch review, resolve critical/important findings, create a draft PR, and report production deployment as pending merge/CI gates.
