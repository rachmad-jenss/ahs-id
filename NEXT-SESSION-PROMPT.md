# Next Session Prompt — Phase 2 Priority 4: Export & CLI

Copy-paste this as the opening prompt for the next Claude Code session:

---

## Context

Lanjut Phase 2 @ahs-id. Repo: `C:\Users\Legion\.gemini\antigravity\scratch\ahs-id`. Monorepo TypeScript (pnpm + Turbo).

Phase 2 progress so far:
- 51 tests passing (39 unit + 12 golden)
- Engine extensions complete: throughput, mode sewa, sub-ahsp resolver, estimasi-kasar, cross-bundle validation
- Divisi 3 complete: 12 AHSP items (3.1.1-3.1.6, 3.2.1-3.2.3, 3.3.1-3.3.3)
- 3 HSD regions: Kaltim, Jawa Barat, Papua
- JSON Schema validation at build time (6 schemas, ajv)
- Bug fixed: DT (E.08) now handles jarak_angkut_km for timbunan items

Refer to:
- `docs/architecture.md` — full spec
- `PROGRESS.md` — task tracker (Milestones 8-10 done, 11-12 remaining)
- `CLAUDE.md` — project rules and constraints

## Remaining Tasks

### Priority 4: Export & CLI (Task 11-12)

11. **exporter/excel.ts** — Export HSP calculation result to RAB (Rencana Anggaran Biaya) Excel format.
   - Use ExcelJS or similar library
   - Output format: standard RAB table with columns: No, Uraian, Satuan, Koefisien, Harga Satuan, Jumlah Harga
   - Groups: Tenaga Kerja, Bahan, Peralatan, subtotals, overhead+profit, grand total
   - Include metadata header (AHSP code, region, date)
   - Add to `@ahs-id/core` exports

12. **apps/cli/** — Basic CLI app with commands:
   - `calc-hsp <kode-ahsp>` — interactive or JSON variabel input, prints HSP breakdown
   - `export-rab <kode-ahsp> -o output.xlsx` — exports to Excel
   - `validate [--bundle pupr-2023] [--hsd kaltim-2025]` — runs bundle validation
   - Use a lightweight CLI framework (e.g., citty, commander)
   - New workspace package: `apps/cli/`

### Priority 5: Publish (Task 13-14)

13. **npm publish setup** — package.json configs (repository, keywords, engines), .npmignore, prepublishOnly scripts, changesets or manual versioning
14. **First public release** — publish @ahs-id/core, @ahs-id/pupr-2023, HSD packages to npm

## Instructions

- Baca `CLAUDE.md` untuk rules (no AI attribution, conventional commits, etc.)
- Baca `docs/architecture.md` section yang relevan sebelum implement
- Update `PROGRESS.md` setiap task selesai
- Atomic commits, push setelah setiap milestone
- Run `pnpm build && pnpm test` setelah setiap perubahan
- Start dengan Task 11: Excel exporter
