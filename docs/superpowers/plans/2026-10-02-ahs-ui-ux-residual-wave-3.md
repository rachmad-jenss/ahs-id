# AHS-ID Residual UI/UX and Motion Remediation — Wave 3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every confirmed residual finding from the post-DAS-48 full UI/UX, accessibility, mobile-native, writing, typography, color, and motion audit without changing calculation data, public routes, or deployment behavior.

**Issue:** [DAS-50](https://github.com/rachmad-jenss/ahs-id/issues/50)

**Baseline:** `5d31976` (`origin/main`, 2026-10-02), after DAS-42, DAS-44, DAS-46, and DAS-48.

**Architecture:** Keep the static Astro layout, Tailwind v4 semantic CSS variables, React catalog island, and native browser controls. Add the theme as a small layout-owned script and `data-theme` attribute; do not add a theme dependency, client state library, or animation library. Keep routine result updates instant and limit new motion to the existing pressable vocabulary.

**Global constraints:**

- Preserve the unrelated dirty files in the original checkout; all work stays in the managed worktree.
- No change to bundle JSON, calculation formulas, CLI data contracts, routes, or deployment workflows.
- TypeScript strict, named exports, no `any`, no new dependencies.
- Use `apply_patch` for source edits and serial bounded commands to avoid OOM.
- Theme must support `system`, `light`, and `dark`; stored explicit choices override the OS, and the initial paint must not flash the wrong appearance.
- Every motion change must use exact properties, remain interruptible, be fine-pointer gated for hover, and provide a reduced-motion path.
- Browser verification uses only the Codex in-app browser; Playwright is out of scope.

## Residual finding ledger

| ID | Severity | Finding | Planned fix | Verification |
| --- | --- | --- | --- | --- |
| F31 | HIGH | No System/Terang/Gelap theme, `color-scheme`, or dark semantic token map. | Add `data-theme` tokens, no-flash bootstrap, accessible native theme select, persistence, and theme-aware browser chrome. | Web contract tests plus in-app browser selection and reload checks. |
| F32 | HIGH | Skip link targets `main` but `main` is not programmatically focusable. | Add `tabindex="-1"`, focus-safe scroll behavior, and a regression contract. | Keyboard in browser; source contract. |
| F33 | MEDIUM | Multiple `aside` landmarks have no accessible name. | Add stable `aria-labelledby` labels to filters, item summary/provenance, and warning context. | Source contract and browser accessibility-tree inspection where available. |
| F34 | MEDIUM | Developer code samples use bare `code`, collapsing newlines and lacking a scroll-region name. | Render `pre > code` with preserved whitespace, keyboard focus, and explicit region labels/cues. | Source contract and in-app browser at narrow width. |
| F35 | MEDIUM | Bundle cards visually imply a whole-card hover target while only a small inner link navigates. | Make each card one block link with one accessible name; remove nested action-link ambiguity. | Source contract and pointer/keyboard browser smoke. |
| F36 | MEDIUM | Several standalone action links have no consistent mobile hit-area baseline. | Apply the existing `pressable` contract to anchors with a 44px minimum block target without changing content density. | Source scan and browser keyboard/touch-style smoke. |
| F37 | MEDIUM | Mobile viewport omits `initial-scale`/`viewport-fit`; safe areas and horizontal overscroll are not explicitly handled. | Add mobile viewport metadata, safe-area padding on shell chrome, text-size adjustment, and horizontal overscroll containment only. | Source contract and bounded in-app browser viewport smoke; real device remains NOT_RUN. |
| F38 | MEDIUM | Copy still mixes avoidable English/internal labels (`Open source`, `Provenance`, `Source`, `foundation layer`, `NOT FOUND`). | Normalize user-facing copy to natural Indonesian while retaining package/API names and domain terms that users recognize. | Web source-copy contracts and browser review. |
| F39 | LOW | Homepage search example chips have opacity-only press feedback and no tactile scale cue. | Add a scoped `pressable-chip` active scale using existing 100–160ms timing; disable movement under reduced motion. | CSS/source contract and browser pointer smoke. |
| F40 | LOW | Homepage hero background uses fixed light-mode color literals. | Move the backdrop to semantic CSS variables so both appearances remain coherent. | Light/dark browser smoke and source scan. |

## Task 1: Add RED contracts and plan ledger

**Files:**

- Create: `docs/superpowers/plans/2026-10-02-ahs-ui-ux-residual-wave-3.md`
- Modify: `apps/web/tests/ui-contracts.test.ts`
- Create: `.superpowers/sdd/2026-10-02-ahs-ui-ux-residual-wave-3/progress.md`

- [ ] Record the clean managed-worktree baseline and current commit.
- [ ] Add failing source contracts for F31–F40: theme modes/tokens/bootstrap, focusable main, named asides, `pre > code`, one-link bundle cards, anchor target baseline, viewport/safe-area CSS, Indonesian copy, scoped chip feedback, and semantic hero backdrop.
- [ ] Run only the focused web contract test and record the expected RED failures.
- [ ] Commit only the plan, ledger, and RED contracts: `DAS-50: add residual UI UX plan and contracts`.

## Task 2: Implement theme and shell accessibility

**Files:**

- Modify: `apps/web/src/layouts/SiteLayout.astro`
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/tests/ui-contracts.test.ts`

- [ ] Add a no-flash inline bootstrap that reads `ahs-id-theme`, defaults to `system`, and sets `data-theme` before the page paints.
- [ ] Add an accessible native select with `system`, `light`, and `dark` values; persist changes and update the root attribute without a full navigation.
- [ ] Add light/dark semantic tokens, `color-scheme`, theme-aware theme-color metadata, and a theme-switch transition suppression path.
- [ ] Add `tabindex="-1"` to `main`, safe-area shell classes, and horizontal overscroll containment; preserve normal vertical scrolling.
- [ ] Run the focused web contract test GREEN, then commit: `DAS-50: add system light dark theme and shell semantics`.

## Task 3: Implement landmarks, code regions, card affordances, and mobile targets

**Files:**

- Modify: `apps/web/src/components/CatalogBrowser.tsx`
- Modify: `apps/web/src/pages/item/[bundle]/[code].astro`
- Modify: `apps/web/src/pages/bundles/index.astro`
- Modify: `apps/web/src/pages/docs/index.astro`
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/pages/metodologi/index.astro`
- Modify: `apps/web/src/pages/tentang/index.astro`
- Modify: `apps/web/src/pages/404.astro`
- Modify: `apps/web/tests/ui-contracts.test.ts`

- [ ] Name every repeated `aside` landmark and preserve one coherent heading hierarchy.
- [ ] Convert documentation examples to scrollable, keyboard-focusable `pre > code` regions with preserved line breaks and cues.
- [ ] Make bundle cards one navigable block link; keep package/source links elsewhere unchanged.
- [ ] Add the existing `pressable`/44px anchor contract to all standalone action links without changing card layout.
- [ ] Run focused web contracts and source scans GREEN, then commit: `DAS-50: harden web semantics and mobile affordances`.

## Task 4: Normalize copy, typography, color, and purposeful motion

**Files:**

- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/components/SearchLauncher.tsx`
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/pages/docs/index.astro`
- Modify: `apps/web/src/pages/tentang/index.astro`
- Modify: `apps/web/src/pages/404.astro`
- Modify: `apps/web/tests/ui-contracts.test.ts`

- [ ] Replace avoidable internal English in visible copy with natural Indonesian and keep technical package/API names exact.
- [ ] Move the homepage backdrop to semantic variables and preserve balanced headings/prettier body wrapping.
- [ ] Add a scoped chip press transform using the existing motion duration/easing; keep hover fine-pointer gated and cancel movement under reduced motion.
- [ ] Verify no new `transition: all`, keyframe routine-result motion, or unscoped hover appears.
- [ ] Run focused tests plus the web package tests, then commit: `DAS-50: refine copy color and restrained motion`.

## Task 5: Full verification, review, PR, merge, and cleanup

- [ ] Run serial `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm test`, web build, and focused tests with bounded output; classify any dependency/sandbox limitation honestly.
- [ ] Start one bounded local Astro server and use the Codex in-app browser only to smoke home, catalog, item, bundles, docs, methodology, about, and 404 at available desktop/mobile widths. Exercise theme choices/reload, skip-link, mobile menu, search, code/table scroll cues, and no document overflow.
- [ ] Dispatch two independent read-only reviewers before PR: one for web accessibility/layout/writing/theme, one for motion/mobile/regression/tests. Fix every Critical/Important finding with a RED-to-GREEN check.
- [ ] Push only `feature/DAS-50-ui-ux-theme-semantics`, create a draft PR with `Closes #50`, attach it, then mark ready only after local gates and reviews are clean.
- [ ] Poll CI and review threads in bounded intervals; address and resolve all valid comments; re-run the required gates after each fix.
- [ ] Squash-merge only after all checks and comments are green (explicitly authorized by the user), poll post-merge `main` until green, and smoke the public site in the in-app browser.
- [ ] Delete only the merged remote/local feature branch and archive this managed worktree; preserve the original checkout’s dirty/untracked files. Update the issue/Notion state if the Notion block limit is resolved; otherwise report it as NOT_RUN.
