# AHS-ID UI/UX and Motion Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all 15 findings from the read-only UI/UX, accessibility, mobile-native, writing, CLI, and motion audit for AHS-ID without changing calculation data or deployment behavior.

**Architecture:** Preserve the existing Astro static routes, React islands, Tailwind token system, and CLI command structure. Add a small fine-pointer hover layer in global CSS, use semantic HTML and stable live regions for interaction feedback, and keep motion limited to the mobile navigation disclosure with a reduced-motion fallback.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, TypeScript strict, Vitest, Commander, pnpm workspaces, Turborepo.

**Spec:** GitHub issue [DAS-38](https://github.com/rachmad-jenss/ahs-id/issues/38) and the 2026-10-01 read-only audit recorded in the task conversation.

## Global Constraints

- Preserve the existing Tailwind semantic color and spacing tokens; do not introduce a new UI library or animation dependency.
- Keep the repository TypeScript strict and named-export conventions intact.
- Do not change bundle JSON, calculation formulas, public pricing, deployment configuration, or unrelated dirty files in the original checkout.
- Every production behavior change gets a focused regression assertion before implementation and a full-suite verification afterward.
- Use bounded, serial commands and cap output; do not run parallel browsers, large generated catalogs, or broad dependency rebuilds.
- Hover-only styling must be scoped to `(hover: hover) and (pointer: fine)`; touch feedback remains available through existing active/focus states.
- Motion must remain transform/opacity based, use the existing reduced-motion contract, and never animate routine catalog results or page loads.

## Review Focus

- A quick-start snippet that compiles against the actual `bundle` and `hsd` exports; source contract test in Task 2.
- A touch device opening the mobile menu or filter disclosure; fine-pointer hover and reduced-motion source contracts in Task 2 and Task 3.
- A long result name or a wide component table at a narrow viewport; wrapping and scroll-cue contracts in Task 3 and Task 4.
- A screen-reader user following navigation and result updates; `aria-current`, `role=status`, captions, scopes, and labels in Task 2–4.
- A CLI user invoking list mode without an item code or reading a long-name priced row; integration tests in Task 5.

---

### Task 1: Plan ledger and implementation baseline

**Files:**
- Create: `docs/superpowers/plans/2026-10-01-ahs-ui-ux-remediation.md`
- Create: `.superpowers/sdd/2026-10-01-ahs-ui-ux-remediation/progress.md` (git-ignored execution ledger)

**Interfaces:**
- Consumes: GitHub issue DAS-38 and the audit findings.
- Produces: A checked-in plan that enumerates all findings and a local ledger that records task/test evidence and rulings.

- [ ] **Step 1: Write the plan and list every finding.** Include the exact web and CLI files, test contracts, verification commands, and atomic commit boundaries.
- [ ] **Step 2: Verify the baseline branch and dirty-file boundary.** Run `git status --short --branch`, `git diff -- .gitignore docs/pipeline.md`, and a bounded package inventory; confirm only the original checkout’s unrelated files are outside this plan.
- [ ] **Step 3: Commit the plan only.** Use `git add docs/superpowers/plans/2026-10-01-ahs-ui-ux-remediation.md` and commit `DAS-38: add UI UX remediation plan`.

### Task 2: Navigation, writing, hover policy, and mobile-menu motion

**Files:**
- Create: `apps/web/tests/ui-contracts.test.ts`
- Modify: `apps/web/src/layouts/SiteLayout.astro`
- Modify: `apps/web/src/components/SearchLauncher.tsx`
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/pages/bundles/index.astro`
- Modify: `apps/web/src/pages/docs/index.astro`
- Modify: `apps/web/src/pages/metodologi/index.astro`
- Modify: `apps/web/src/pages/tentang/index.astro`
- Modify: `apps/web/src/pages/404.astro`

**Interfaces:**
- Consumes: Existing `navItems`, semantic tokens, and shared `Button`/`Input` primitives.
- Produces: Active navigation semantics, linked About route, correct quick-start copy, 44px touch-visible controls, fine-pointer-only hover utilities, and an animated mobile menu that remains usable with reduced motion.

- [ ] **Step 1: Write failing source-contract tests.** Assert that the layout includes `/tentang/`, `aria-current`, a named mobile panel, and fine-pointer/reduced-motion CSS; that search inputs use `type="search"`, `inputMode="search"`, and `enterKeyHint="search"`; that quick-start imports use `{ bundle }` and `{ hsd }` rather than nonexistent names; and that shared button sizes meet the touch target.
- [ ] **Step 2: Run the focused web test and verify RED.** Run `pnpm.cmd --filter @ahs-id/web exec vitest run tests/ui-contracts.test.ts`; expected failure is missing audited contracts, not a module-resolution error.
- [ ] **Step 3: Implement navigation and writing fixes.** Add About to primary/mobile/footer navigation, set `aria-current="page"` with a non-color active treatment, add search metadata, and replace the docs/home quick-start snippets with the actual package exports and a complete minimal flow.
- [ ] **Step 4: Implement shared touch and hover policy.** Raise default/small/icon shared button targets to at least 44px where touch-visible, and replace `hover:`/`group-hover:` affordances with named CSS utilities scoped inside `@media (hover: hover) and (pointer: fine)`.
- [ ] **Step 5: Implement restrained mobile menu motion.** Add a `mobile-menu-panel` disclosure style using opacity plus a small translate/scale settle with a 180ms decelerating curve, and disable transform motion under `prefers-reduced-motion` while preserving visibility/focusability.
- [ ] **Step 6: Run the focused web test and verify GREEN.** The same Vitest command must pass with no warnings.
- [ ] **Step 7: Commit the navigation/motion slice.** Use `git add` only for the files in this task and commit `DAS-38: improve web navigation and motion contracts`.

### Task 3: Catalog layout, filters, status, names, and search affordances

**Files:**
- Modify: `apps/web/src/pages/katalog/index.astro`
- Modify: `apps/web/src/components/CatalogBrowser.tsx`
- Modify: `apps/web/tests/ui-contracts.test.ts`

**Interfaces:**
- Consumes: Task 2’s search metadata, shared touch/hover utilities, and existing URL-backed filter state.
- Produces: A contained catalog surface with a mobile-first search order, collapsible mobile filters, a stable result status, and readable long names.

- [ ] **Step 1: Extend the contract tests before implementation.** Assert for a centered/max-width catalog wrapper, a mobile filter disclosure, a search input type, one stable live status containing result count/page, and non-truncating small-screen names.
- [ ] **Step 2: Run the focused web test and verify RED.** Use the same single-file Vitest command; expected failures identify the missing catalog contracts.
- [ ] **Step 3: Add the catalog container and ordering.** Wrap the island in `mx-auto max-w-7xl` responsive padding; keep the desktop sidebar and place the search/results before the collapsed mobile filter disclosure on narrow layouts.
- [ ] **Step 4: Extract shared filter controls into the existing component.** Render the same controlled selects/actions in a desktop aside and a mobile `<details>` disclosure; preserve URL state, reset behavior, and keyboard focus.
- [ ] **Step 5: Improve result feedback and names.** Replace the page-only live text with one stable `role="status" aria-live="polite" aria-atomic="true"` message that includes count and page; change result names to wrap on small screens and add the full name as an accessible title/label.
- [ ] **Step 6: Run the focused web test and the existing catalog/search tests.** Run `pnpm.cmd --filter @ahs-id/web exec vitest run tests/ui-contracts.test.ts tests/catalog.test.ts tests/search.test.ts`; verify GREEN.
- [ ] **Step 7: Commit the catalog slice.** Commit `DAS-38: improve catalog responsive and result UX` with only catalog files/tests.

### Task 4: Item tables, typography, and semantic detail surfaces

**Files:**
- Modify: `apps/web/src/pages/item/[bundle]/[code].astro`
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/tests/ui-contracts.test.ts`

**Interfaces:**
- Consumes: Existing `CatalogItem` component groups and semantic tokens.
- Produces: Scrollable detail tables with a visible narrow-screen cue, captions/header scopes, and an explicit system font stack without a missing Inter asset.

- [ ] **Step 1: Extend the contract tests before implementation.** Assert that both component and sub-AHSP tables contain captions and scoped headers, the detail page contains a mobile scroll instruction, and the font token does not promise an unavailable Inter font.
- [ ] **Step 2: Run the focused web test and verify RED.** Confirm failures are the absent semantics/cue/font contract.
- [ ] **Step 3: Implement table semantics and mobile cue.** Add concise captions, `scope="col"` headers, and an `sm:hidden` instruction adjacent to each horizontal table while preserving the existing minimum readable width.
- [ ] **Step 4: Implement the typography correction.** Use a system sans stack in the Tailwind theme and keep the serif/mono fallbacks intact.
- [ ] **Step 5: Run all web unit/source-contract tests.** Run `pnpm.cmd --filter @ahs-id/web test`; verify GREEN.
- [ ] **Step 6: Commit the detail/typography slice.** Commit `DAS-38: improve accessible item detail tables`.

### Task 5: CLI list discovery and readable IDR output

**Files:**
- Modify: `apps/cli/src/commands/calc-hsp.ts`
- Modify: `apps/cli/src/utils/loader.ts`
- Modify: `apps/cli/src/utils/loader.test.ts`
- Modify: `apps/cli/src/commands/calc.integration.test.ts`

**Interfaces:**
- Consumes: Commander `calc-hsp` command, existing bundle/HSD loader, and compiled CLI integration harness.
- Produces: Optional item code for list mode, explicit `Rp` formatting, and word-wrapped component names that do not shift numeric columns or silently discard the full name.

- [ ] **Step 1: Write failing CLI tests.** Add an integration test that runs `calc-hsp --list-bundles` with no code and expects status 0 plus bundle/HSD headings; update formatter expectations to `Rp 740.113`, `Rp 0`, and `Rp 123.457`; add a formatted-output assertion for explicit `Rp`.
- [ ] **Step 2: Run the targeted CLI tests and verify RED.** Run `pnpm.cmd --filter @ahs-id/cli build; pnpm.cmd --filter @ahs-id/cli exec vitest run src/utils/loader.test.ts src/commands/calc.integration.test.ts`; expected failures are the old required argument and old formatter output.
- [ ] **Step 3: Make the item argument optional only for list mode.** Change Commander to `[kode-ahsp]`, short-circuit list mode before calculation, and emit a clear nonzero error when neither list mode nor an item code is provided.
- [ ] **Step 4: Make default output readable.** Prefix formatted money with `Rp `, add a bounded word-wrapping helper for component descriptions, and print continuation lines with stable indentation while keeping JSON numeric fields unchanged.
- [ ] **Step 5: Run targeted tests and the full CLI suite.** Re-run the command from Step 2 and `pnpm.cmd --filter @ahs-id/cli test`; verify GREEN.
- [ ] **Step 6: Commit the CLI slice.** Commit `DAS-38: improve CLI discovery and money output`.

### Task 6: Full verification, in-app browser QA, and delivery gates

**Files:**
- Modify: `PROGRESS.md` only if the project’s public Phase 2 checklist needs the merged issue/PR state; do not touch unrelated documentation.
- Create: no generated or temporary repository artifacts.

**Interfaces:**
- Consumes: All task commits and issue/PR #38.
- Produces: Fresh evidence for local checks, direct in-app browser smoke tests, resolved review threads, green CI, merged PR, green main, and cleanup of this implementation branch only.

- [ ] **Step 1: Run bounded local checks serially.** Run `pnpm.cmd lint`, `pnpm.cmd typecheck`, `pnpm.cmd validate-data`, `pnpm.cmd test`, and `pnpm.cmd build`, capturing only tails for long output. If dependency installation is required, ask before downloading; do not treat an aborted pnpm install as a pass.
- [ ] **Step 2: Run the web production smoke path.** Start the smallest existing web preview/dev command if needed, open it with the in-app browser (never Playwright), and check home, catalog, search/filter, item table cue, docs copy, active nav/About link, keyboard skip-link, reduced-motion source contract, and 404. Close temporary tabs afterward.
- [ ] **Step 3: Review the diff and create a draft PR.** Verify unrelated dirty files remain untouched, push only `codex/ahs-ui-ux-remediation-implementation`, create a draft PR linked to issue #38, and attach its URL to the current task.
- [ ] **Step 4: Babysit review and CI.** Poll PR checks with bounded intervals, inspect every review thread, reply with evidence, fix any Critical/Important finding using RED→GREEN tests, and resolve every addressed thread. Mark ready only after local checks are fresh.
- [ ] **Step 5: Merge after all gates.** Once all review threads are resolved, required checks are green, and the user’s explicit merge authorization applies, squash-merge the PR and record the merge SHA.
- [ ] **Step 6: Poll main and clean up.** Poll the merge commit/main combined status until green; delete only the remote/local implementation branch after confirming merge. Leave the protected unused managed worktree untouched and report it if the host refuses cleanup.

