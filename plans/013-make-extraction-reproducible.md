# Plan 013: Make tracked data extractors reproducible from explicit inputs

> **Executor instructions**: Preserve generated data unless a source-backed
> regeneration is intentionally reviewed. Never include local upload paths.
>
> **Drift check**:
> `git diff --stat 96b2e85..HEAD -- scripts/extract-bina-marga-2022.py scripts/extract-cipta-karya.py scripts/extract-cipta-karya-hsd.py scripts/extract-lansekap.py tools/extractors docs/pipeline.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `96b2e85`, 2026-09-22

## Why this matters

Tracked extraction scripts import undeclared Python packages and embed
machine-specific source paths. A clean contributor cannot reproduce the bundle
generation, and future unbounded dependency changes can alter regulated data.

## Current state

- `scripts/extract-bina-marga-2022.py:21-27` requires `xlrd` and assigns a local
  absolute workbook path.
- `scripts/extract-cipta-karya.py:21-27` requires `openpyxl` and assigns another
  local absolute path.
- No tracked root Python manifest declares those dependencies at commit
  `96b2e85`.
- The current untracked `tools/docling/pyproject.toml` is work in progress and
  must not be silently repurposed or overwritten.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Python tests | `uv run --project tools/extractors pytest tools/extractors/tests` | all extractor tests pass |
| Lock check | `uv lock --project tools/extractors --check` | exit 0; lock is current |
| Repository | Run separately: `pnpm validate-data`, `pnpm validate-bundles`, `pnpm test` | stop on first failure; all exit 0 |

## Scope

**In scope**
- All four tracked Python extractors: `extract-bina-marga-2022.py`,
  `extract-cipta-karya.py`, `extract-cipta-karya-hsd.py`, and
  `extract-lansekap.py`
- A dedicated tracked Python dependency manifest/lock for extraction
- Small synthetic workbook fixtures and extractor tests
- Extraction setup documentation

**Out of scope**
- Editing the user's untracked Docling implementation without explicit consent
- Committing regulation workbooks when licensing forbids it
- Regenerating all production data as a side effect

## Git workflow

Require a DAS issue. Branch `chore/DAS-N-reproducible-extraction`; commit
`DAS-N: make data extraction reproducible`.

## Steps

### Step 1: Select one isolated Python environment

Create `tools/extractors/pyproject.toml` for Python 3.10+ with `xlrd`,
`openpyxl`, and pytest, then generate `tools/extractors/uv.lock`. Document uv as
the extractor runner. Do not merge this with untracked Docling work unless the
owner explicitly chooses that architecture.

**Verify**: clean environment installs from the lock without manual packages.

### Step 2: Replace embedded paths with required CLI arguments

Use `argparse` for `--input` and `--output`, validate extensions and existence,
and default output only to the repository's documented package directory. Error
messages should name missing arguments, never old local paths.

**Verify**: `--help` works; omitted/missing input exits nonzero.

### Step 3: Add deterministic fixture tests

Build minimal `.xls` and `.xlsx` fixtures covering all four scripts'
representative layouts.
Assert exact normalized records, provenance, and stable output ordering. Run
twice and compare bytes.

**Verify**: fixture tests pass on Windows and Linux.

### Step 4: Document production-source handling

Document where maintainers obtain source files, licensing constraints, checksum
recording, command examples, and review requirements without committing secrets
or machine-local paths.

## Test plan

- CLI help and invalid path.
- One fixture per extractor/layout.
- Deterministic repeated output.
- Generated sample validates against repository schemas.

## Done criteria

- [ ] Clean environment runs both extractors.
- [ ] No tracked script contains a machine-specific upload path.
- [ ] Dependency versions are locked.
- [ ] Production data are unchanged unless explicitly reviewed.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

- Fixture formats require copyrighted source content.
- The untracked Docling work overlaps and ownership is unclear.
- Locking dependencies breaks supported Windows/Linux versions.

## Maintenance notes

Update the lock and rerun deterministic fixtures before accepting extractor
dependency upgrades. Generated-data diffs require source provenance review.
