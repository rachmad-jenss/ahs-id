# AHS-ID Residual UI/UX and Motion Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every finding from the 2026-10-02 read-only UI/UX and motion audit across the public Astro catalog, item detail surfaces, shared visual system, and CLI without changing calculation data or deployment behavior.

**Architecture:** Keep the existing Astro static routes, React catalog island, Tailwind v4 semantic tokens, and Commander command structure. Make catalog query state explicitly draft-versus-committed so URL state and visible results cannot diverge; keep visual and motion changes in existing CSS/classes; add only small pure helpers where they carry a directly tested contract.

**Tech Stack:** Astro 7, React 19, Tailwind CSS 4, TypeScript strict, Vitest, Commander, pnpm workspaces, Turborepo.

**Spec:** GitHub issue [DAS-42](https://github.com/rachmad-jenss/ahs-id/issues/42) and the read-only audit recorded in the task conversation.

## Global Constraints

- Preserve existing calculation, bundle JSON, pricing, route, and deployment contracts.
- Preserve the unrelated dirty files in the original checkout; all implementation happens in the managed worktree.
- No new dependency, UI library, animation library, or broad refactor.
- TypeScript strict, named exports only, and focused source-contract/integration tests for each behavior change.
- Use serial, bounded commands; do not run parallel browsers, broad generated catalogs, or unnecessary builds.
- Hover-only styling remains inside `(hover: hover) and (pointer: fine)`; touch feedback must work without hover.
- Motion uses transform/opacity/color where possible, has a reduced-motion path, and does not animate routine result updates.
- The in-app browser is the only browser QA surface; Playwright is explicitly out of scope.
- Every finding is either fixed and recorded with a RED-to-GREEN regression check or explicitly ruled out with its cost in the final report.

## Finding Ledger

| ID | Finding | Planned fix and verification owner |
| --- | --- | --- |
| F01 | Catalog input changes results while the committed URL remains stale. | Separate draft query from committed query; test submit, popstate, and clear behavior in `CatalogBrowser` contracts. |
| F02 | Live result status updates on every keystroke and creates announcement noise. | Derive results from committed query only; test stable status updates after commit. |
| F03 | `calc-hsp --list-bundles --json` emits plain text. | Emit a documented JSON object for list mode; CLI integration test parses stdout. |
| F04 | CLI errors are not JSON when `--json` is requested. | Serialize errors to stderr in JSON mode and keep nonzero exit status; integration test parses stderr. |
| F05 | `export-rab` overwrites an existing file silently. | Add explicit `--force`; test refusal and forced replacement with a temporary path. |
| F06 | Small secondary text in the primary CTA is below normal text contrast. | Use the full semantic foreground token; source contract plus computed token review. |
| F07 | Input/select boundary token is too light against the background. | Strengthen the semantic `--input` token while preserving the palette; source contract and browser visual check. |
| F08 | Mobile filters appear after the result list. | Move the narrow disclosure before results while retaining the desktop aside; structural contract and mobile browser check. |
| F09 | Filter summary ignores an active search query. | Include query in active-state copy and reset affordance; source contract/browser check. |
| F10 | Pagination controls can overflow a narrow mobile row. | Use a wrapping/grid layout and responsive button sizing; browser check at the available narrow in-app viewport. |
| F11 | Table scroll cue disappears at widths that can still overflow. | Show the cue below the larger desktop breakpoint; source contract/browser check. |
| F12 | Visible table cue is not related to its scroll region. | Add stable `aria-describedby`/accessible hint IDs for each table region; source contract. |
| F13 | Native disclosure markers are hidden without a replacement affordance. | Add a visible chevron with open-state rotation and accessible name; source contract/browser check. |
| F14 | Touch surfaces lack consistent pressed feedback. | Add scoped active/pressable feedback to navigation, cards, chips, summaries, and links without hover dependence; source contract/browser check. |
| F15 | Mobile text-size adjustment is left to browser defaults. | Add `text-size-adjust: 100%` to the document root; source contract/browser check. |
| F16 | Page/filter changes do not move keyboard/screen-reader context to the results. | Add a focusable result heading and bounded focus handoff after committed navigation; test the handler contract and browser keyboard path. |
| F17 | Reset buttons always say “Hapus filter” even when only search is active. | Compute contextual reset labels and use them in desktop, mobile, and empty states; source contract/browser check. |
| F18 | Empty state does not echo the committed query, reducing recovery clarity. | Include escaped trimmed query when present and use contextual recovery copy; source contract/browser check. |
| F19 | Internal labels (`Dynamic HSD`, `Fixed coefficient`, `auto-extracted`, English methodology labels) leak into user-facing UI. | Add local display mappings in the affected Astro surfaces and translate mixed CLI headings; source contract/browser check. |
| F20 | Important headings and descriptions lack balanced wrapping/line-height guidance. | Apply `text-balance`/`text-pretty` and tightened display line-height to affected headings; source contract/browser check. |
| F21 | CLI table widths are fixed for an 80-column terminal. | Derive bounded description/separator widths from `process.stdout.columns`; unit test narrow and default widths. |
| F22 | Methodology warning surface uses raw amber utilities instead of semantic tokens. | Add warning surface/foreground/icon semantic tokens and migrate the alert; source contract/browser check. |
| F23 | Home cards declare transform-only transition while hover also changes border/shadow. | Include all animated properties in the card transition with one decelerating curve; source contract/browser check. |
| F24 | Arrow hover motion lacks explicit color/transform transition consistency. | Use the shared arrow transition class on affected links; source contract/browser check. |
| F25 | Mobile menu disclosure animates `max-height`, causing unnecessary layout work. | Keep the bounded absolute panel at a fixed max height and animate visibility/opacity/transform only; source contract/browser check. |
| F26 | Reduced-motion CSS globally collapses all transition durations instead of preserving useful non-motion feedback. | Retain animation cancellation but preserve short color/opacity transitions and remove transform movement for reduced-motion users; source contract/browser check. |
| F27 | Search fields do not expose a stable form name/autocomplete policy. | Add `name="q"` and an intentional autocomplete value to catalog/launcher search fields; source contract/browser check. |

## Review Focus

- A user types without submitting, presses browser Back/Forward, clears a query, or lands on a URL with `q`; the visible result list, URL, status announcement, and focus target must agree.
- A machine consumer requests JSON for list, missing-code, and calculation errors; stdout/stderr must remain parseable and exit status must remain nonzero on failure.
- A user exports twice to the same path; the first file must remain intact unless `--force` is explicit.
- A 320–900px touch viewport opens filters/menu and scrolls a wide table; controls must be reachable, visibly pressed, discoverable, and semantically described.
- A reduced-motion user views the menu, card, arrow, and active controls; no transform/layout animation should move content, while important opacity/color feedback remains understandable.

---

### Task 1: Plan, focused regression contracts, and baseline boundary

**Files:**
- Create: `docs/superpowers/plans/2026-10-02-ahs-ui-ux-remediation-wave-2.md`
- Modify: `apps/web/tests/ui-contracts.test.ts`
- Modify: `apps/cli/src/commands/calc-hsp.test.ts`
- Modify: `apps/cli/src/commands/calc.integration.test.ts`
- Modify: `apps/cli/src/utils/loader.test.ts`

**Interfaces:**
- Consumes: the F01–F27 ledger above and existing source-contract/integration test conventions.
- Produces: failing tests that pin URL/query state, JSON output, overwrite protection, responsive/accessibility/motion contracts, and adaptive terminal formatting before implementation.

- [ ] **Step 1: Record the clean worktree baseline.** Verify the managed worktree is on `fix/DAS-42-ui-ux-motion` from `21424ec`, has no tracked changes, and has only the dependency junction as a local test aid.
- [ ] **Step 2: Add web RED contracts.** Extend `ui-contracts.test.ts` with assertions for draft/committed query names, reset labels, mobile filter order, accessible table hint relationships, semantic warning tokens, text-size-adjust, responsive pagination, chevrons, press feedback, display labels, and motion/reduced-motion contracts.
- [ ] **Step 3: Add CLI RED tests.** Add parseable JSON list/error cases, output-file refusal/`--force` cases, and narrow/default terminal width assertions. Tests must run against real command construction and temporary output paths, not mocks of the implementation.
- [ ] **Step 4: Run each focused test file and record the expected RED failures.** Use direct Vitest entrypoints where local dependencies permit; do not run a dependency install as part of the RED check.
- [ ] **Step 5: Commit only the plan and RED contracts.** Commit `DAS-42: add UI UX remediation plan and regression contracts`.

### Task 2: Catalog state, mobile layout, accessibility, and recovery feedback

**Files:**
- Modify: `apps/web/src/components/CatalogBrowser.tsx`
- Modify: `apps/web/src/pages/katalog/index.astro`
- Modify: `apps/web/src/pages/item/[bundle]/[code].astro`
- Modify: `apps/web/src/layouts/SiteLayout.astro`
- Modify: `apps/web/src/components/SearchLauncher.tsx`
- Modify: `apps/web/tests/ui-contracts.test.ts`

**Interfaces:**
- Consumes: `catalogUrl`, `parseCatalogSearchParams`, `paginateCatalogItems`, existing controlled filters, and Task 1 RED contracts.
- Produces: a committed-query catalog state machine, contextual reset/recovery copy, mobile-first filter/pagination/table semantics, and disclosure/keyboard behavior.

- [ ] **Step 1: Implement draft-versus-committed query state.** Keep input edits in `draftQuery`; only submit/URL synchronization changes `query`, resets page, pushes `catalogUrl`, and updates the live result status. `popstate` sets both values. Filters use the committed query.
- [ ] **Step 2: Implement bounded result context.** Add a focusable `catalog-results-heading`, move focus after committed search/filter/page changes with one `requestAnimationFrame`, and keep one atomic polite status containing count and page.
- [ ] **Step 3: Implement contextual clear actions and empty-state recovery.** Compute whether search and/or filters are active; label reset actions accordingly; echo the trimmed committed query safely in the empty state.
- [ ] **Step 4: Reorder mobile filters before the result section.** Keep the desktop aside unchanged semantically, add the mobile disclosure before results, include active search in its summary, and add a visible chevron.
- [ ] **Step 5: Harden narrow pagination and search forms.** Use a responsive wrapping/grid layout, retain 44px touch targets, add `name="q"`/autocomplete policy, and preserve disabled/button semantics.
- [ ] **Step 6: Relate table hints to scroll regions.** Show cues below the desktop breakpoint, give each cue a stable ID, set `aria-describedby`, and keep captions/column scopes.
- [ ] **Step 7: Run web source-contract and search/catalog tests GREEN.** Use the focused files first, then the complete web test suite when dependencies are available.
- [ ] **Step 8: Commit the catalog/accessibility slice.** Commit `DAS-42: fix catalog state and mobile accessibility`.

### Task 3: Visual tokens, writing, typography, touch feedback, and motion

**Files:**
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/pages/index.astro`
- Modify: `apps/web/src/pages/bundles/index.astro`
- Modify: `apps/web/src/pages/docs/index.astro`
- Modify: `apps/web/src/pages/metodologi/index.astro`
- Modify: `apps/web/src/pages/tentang/index.astro`
- Modify: `apps/web/src/pages/404.astro`
- Modify: `apps/web/src/pages/item/[bundle]/[code].astro`
- Modify: `apps/web/src/layouts/SiteLayout.astro`
- Modify: `apps/web/src/components/SearchLauncher.tsx`
- Modify: `apps/web/tests/ui-contracts.test.ts`

**Interfaces:**
- Consumes: existing semantic tokens, fine-pointer hover utilities, reduced-motion media query, and the existing Indonesian product voice.
- Produces: higher-contrast semantic surfaces, native-feeling pressed states, balanced text, localized labels, and bounded motion that remains calm under reduced motion.

- [ ] **Step 1: Strengthen semantic color contracts.** Raise `--input` boundary contrast, replace the primary CTA’s translucent foreground text, and introduce warning surface/foreground/icon tokens used by methodology callouts.
- [ ] **Step 2: Add mobile-native document behavior.** Set `text-size-adjust: 100%`, retain safe viewport behavior, and add touch-visible active feedback to pressable links/cards/chips/disclosures without adding hover on coarse pointers.
- [ ] **Step 3: Normalize typography and copy.** Apply balanced/prettier wrapping and display line-height to affected headings, translate internal calculation/provenance/methodology labels, and preserve code/package names where technical accuracy requires them.
- [ ] **Step 4: Align motion properties.** Update card and arrow transitions to cover the properties they actually change; replace menu `max-height` animation with bounded opacity/visibility/transform; preserve a short opacity/color response under reduced motion while disabling movement.
- [ ] **Step 5: Run web contract tests and a bounded CSS/source scan.** Verify no raw `hover:` escapes the fine-pointer layer, no raw warning palette remains in the methodology alert, and no `max-height` transition remains in the menu.
- [ ] **Step 6: Commit the visual/motion slice.** Commit `DAS-42: refine web tokens copy and motion`.

### Task 4: CLI machine contracts, safe export, and terminal ergonomics

**Files:**
- Modify: `apps/cli/src/commands/calc-hsp.ts`
- Modify: `apps/cli/src/commands/export-rab.ts`
- Modify: `apps/cli/src/utils/loader.ts`
- Modify: `apps/cli/src/commands/calc-hsp.test.ts`
- Modify: `apps/cli/src/commands/calc.integration.test.ts`
- Modify: `apps/cli/src/utils/loader.test.ts`

**Interfaces:**
- Consumes: Commander command options, `PACKAGES`, `calculateHsp`, `formatIdr`, and Task 1 RED tests.
- Produces: stable JSON list/error schemas, explicit overwrite consent, adaptive but bounded terminal table formatting, and localized human-readable headings.

- [ ] **Step 1: Implement JSON list/error output.** In list mode, emit `{ bundles: string[], hsd: string[] }` when `--json`; in JSON error mode emit `{ error: string }` on stderr, keep normal text output otherwise, and retain a nonzero `process.exitCode` without abrupt process termination.
- [ ] **Step 2: Implement safe export.** Add `--force`; use `existsSync` before writing and throw a clear message unless force is true. Keep path validation and existing Excel generation unchanged.
- [ ] **Step 3: Implement adaptive terminal widths.** Add a small exported width helper that clamps description/separator widths from `process.stdout.columns` with a stable fallback; use wrapped descriptions and computed padding without changing JSON values.
- [ ] **Step 4: Localize mixed human-facing CLI strings.** Translate list headings, embedded-HSD wording, and export success output while retaining package names, flags, and technical identifiers.
- [ ] **Step 5: Run CLI RED-to-GREEN tests and TypeScript checks.** Verify list/error JSON parses, overwrite refusal/force works, and narrow formatter tests pass.
- [ ] **Step 6: Commit the CLI slice.** Commit `DAS-42: harden CLI output and export safety`.

### Task 5: Full verification, live in-app-browser QA, PR, merge, and cleanup

**Files:**
- Modify: `docs/web-catalog.md` if its URL-driven search contract needs updating.
- Modify: `PROGRESS.md` only if the public Phase 2 checklist needs a merged issue/PR update.
- Create: no generated repository artifacts.

**Interfaces:**
- Consumes: Task 1–4 commits, GitHub issue #42, and the user’s explicit authorization to merge.
- Produces: fresh local/CI evidence, direct browser evidence, a reviewed and merged PR, green post-merge `main`, and cleanup of only this branch/worktree.

- [ ] **Step 1: Run serial local gates.** Run `pnpm lint`, `pnpm typecheck`, `pnpm validate-data`, `pnpm test`, and the relevant build/check commands with bounded output. Do not call a local result green if the runner is blocked by missing dependencies or sandbox permissions.
- [ ] **Step 2: Run local website smoke through the in-app browser.** Start one bounded Astro dev/preview server, open home/catalog/item/docs/404 with `mcp__cua_repl`, exercise search submit/back-forward/clear, filters, pagination, mobile disclosure, table scroll cue, keyboard focus, and reduced-motion-visible state. Do not use Playwright.
- [ ] **Step 3: Inspect diff and run two independent pre-PR reviews.** Dispatch two separate review subagents with disjoint focus (web UX/accessibility/motion and CLI/contracts/regression), verify their reports against the diff, and fix every Critical/Important finding with a RED-to-GREEN test before PR creation.
- [ ] **Step 4: Push and create a draft PR.** Push only `fix/DAS-42-ui-ux-motion`, create a draft PR titled with `DAS-42`, include `Closes #42`, the full test plan, and the live QA evidence, then attach the PR to this task.
- [ ] **Step 5: Babysit review and CI.** Poll bounded intervals, inspect every review thread/comment, address valid comments, resolve addressed threads, and run the full required local checks again after fixes. Mark the PR ready only when no unresolved comments remain and checks are green.
- [ ] **Step 6: Merge only after the explicit gate is satisfied.** Squash-merge the PR with branch deletion authorized by the user; record the merge SHA and PR state.
- [ ] **Step 7: Poll `main` and public website.** Poll the merge commit and `main` required checks until green, then use the in-app browser against the public site to smoke the changed catalog/item/CLI-linked docs surfaces. Do not claim deployment success from Git state alone.
- [ ] **Step 8: Clean up only obsolete artifacts.** Delete the merged remote/local feature branch and archive the managed worktree after verifying no uncommitted non-ignored files remain; preserve the original checkout’s dirty/untracked files and report the Notion limitation.
