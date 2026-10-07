# Docling tooling — PDF extraction & Layer 1 verification

Python tooling (not shipped to npm) for converting regulation PDFs with [Docling](https://docling-project.github.io/docling/) and semi-automated **Layer 1** coefficient checks against JSON bundles.

## Prerequisites

- Python 3.10+
- ~2 GB disk for Docling models on first run

## Setup

From the monorepo root:

```bash
cd tools/docling
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -e ".[dev]"
```

## Commands

### List bundle coefficients (no PDF)

```bash
ahs-docling list-coefficients --package pupr-2023 --kode 3.2.1
```

### Extract PDF → Markdown + tables

Place the regulation PDF locally (not committed — see `sources/.gitkeep`), then:

```bash
ahs-docling extract path/to/permen-pupr-8-2023-lampiran.pdf -o output/
```

For scanned PDFs without a text layer, add `--ocr` (slower, requires OCR models).

**Large PDFs (100+ pages)** are processed in batches. Progress updates:

- **New line per batch** in the terminal (works in Cursor agent terminals — tqdm bars do not refresh there)
- **`progress.json`** updates every **5 seconds** while a batch runs (`elapsed_s` ticks even mid-batch)

```powershell
Get-Content output\sda-se-47-2026\progress.json -Wait
```

Example terminal output:

```text
▶ batch 1/34: pages 1–50 ...
✓ batch 1/34: pages 1–50 | 3.0% | 12 tables | 185s
▶ batch 2/34: pages 51–100 ...
```

### Crash-safe checkpoints & resume

Every batch is flushed to `<output>/checkpoints/batch-NNNNNN-NNNNNN.json` **as soon as it finishes** (atomic write). If the process is stopped or crashes, completed batches are safe on disk.

Re-run the **exact same command** to resume — finished batches are skipped (no model reload):

```text
Resuming: 128 batch(es) already on disk will be skipped
⏭ resumed batch 1/169: pages 1–10 | 0.6% | 7 tables | 0s
```

- Final `.md` / CSV are assembled from checkpoints when the run completes.
- Use `--no-resume` to force a clean reconvert.
- Delete the `checkpoints/` folder to start over.
- **Keep `--chunk-size` identical across resume runs.** Checkpoints are keyed by page range; switching chunk size (e.g. 10 → 15) starts a parallel batch grid and can leave `progress.json` stuck mid-run while older checkpoints remain on disk. SE 47 Lampiran IV (SDA) and V (BM) full runs used `--chunk-size 10`.

Options:

| Flag | Purpose |
|------|---------|
| `--page-range 1-50` | Only convert pages 1–50 |
| `--chunk-size 25` | Pages per batch (default: auto) |
| `--no-progress` | Disable bar + status file |

Outputs:

- `output/<name>.md` — full document markdown
- `output/<name>-tables.json` — structured tables
- `output/<name>-table-N.csv` — per-table CSV

### Analyze, verify, and clean extracted tables

After `extract`, normalize column names, classify tables, run Layer 1 heuristics, and write organized outputs:

```bash
ahs-docling analyze output/sda-se-47-2026/*-tables.json -o output/sda-se-47-2026/cleaned
```

Outputs under `cleaned/`:

| File | Purpose |
|------|---------|
| `manifest.json` | Category counts, verification issue summary |
| `item-index.csv` | Merged catalogue tables (kode + item + satuan) |
| `hsp-parsed.jsonl` | Structured coefficients per HSP breakdown table |
| `tables-cleaned.json` | All tables with canonical column names |
| `by-type/<category>/table-NNNN.csv` | Cleaned CSVs grouped by table type |

### Link kode_ahsp to HSP tables

After `analyze`, assign regulation item codes from PDF headers to each HSP breakdown:

```bash
ahs-docling link-kode \
  --pdf path/to/lampiran.pdf \
  --hsp-parsed output/sda-se-47-2026/cleaned/hsp-parsed.jsonl \
  -o output/sda-se-47-2026/cleaned/hsp-linked.jsonl
```

Outputs:

| File | Purpose |
|------|---------|
| `hsp-linked.jsonl` | HSP rows + `kode_ahsp`, `uraian_item`, `kode_link_page` |
| `kode-table-map.csv` | Quick lookup: table ↔ kode |
| `kode-anchors.json` | Cached PDF header anchors (reused on re-run) |
| `kode-link-summary.json` | Link rate + confidence stats |

Note: PDF detail sections use codes like `A.3.01.1a.1`; the merged `item-index.csv` catalogue uses `A.1.01.*` — different numbering in the same regulation.

**Documented findings (PDF #1):** [output/sda-se-47-2026/FINDINGS.md](../output/sda-se-47-2026/FINDINGS.md)

### Layer 1 verify (bundle vs PDF)

```bash
ahs-docling verify \
  --package pupr-2023 \
  --kode 3.2.1 \
  --pdf path/to/lampiran.pdf \
  --json-report output/verify-3.2.1.json \
  --strict
```

Re-use cached markdown:

```bash
ahs-docling verify --package pupr-2023 --kode 3.2.1 --markdown output/lampiran.md
```

Exit codes with `--strict`:

| Code | Meaning |
|------|---------|
| 0 | All coefficients `found` |
| 2 | At least one `not_found` |
| 3 | At least one `ambiguous` |

## National sources (DJBK / BPK — no Jakarta portal)

From monorepo root:

```bash
pnpm scrape:djbk-produk-hukum
pnpm merge:djbk-legal-catalog
pnpm download:national-legal-pdfs
```

PDFs land in `tools/docling/sources/national/` (gitignored) with `manifest.json`.

Pilot extract (first pages, requires venv below):

```powershell
cd tools/docling
.\scripts\run-national-pilot.ps1
```

## Workflow (recommended)

1. Download PDF from [JDIH PUPR](https://jdih.pu.go.id/) or `pnpm download:national-legal-pdfs` → under `tools/docling/sources/` (gitignored).
2. `ahs-docling extract sources/<file>.pdf`
3. `ahs-docling verify --package pupr-2023 --pdf sources/<file>.pdf --json-report output/report.json`
4. Resolve `not_found` / `ambiguous` manually against PDF.
5. Update `provenance.verification_tier` to `spot-checked` or `verified` in bundle JSON after human sign-off.

## Scope

| In scope | Out of scope |
|----------|----------------|
| PDF → markdown/tables | Auto-publish to npm |
| Heuristic coefficient spot-check | Full AhspItem JSON generation from PDF |
| Layer 1 QA assist | Runtime dependency of `@ahs-id/core` |

Domain-specific table → `AhspItem` mapping remains in `scripts/extract-*.py` (Excel) and future adapters; Docling provides the **document understanding layer**.

## Tests

```bash
cd tools/docling
pytest
```

Unit tests do not require Docling models (bundle + verify logic only).
