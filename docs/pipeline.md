# Pipeline Ingestion — AHS-ID Data Pipeline

> Inspired by [Pasal.id](https://pasal.id/metodologi) methodology:
> Official Source → Extraction → Structure → Validate → Publish

## Overview

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────┐
│  Source      │    │  Extraction   │    │  Structured  │    │ Validation │    │ Publish  │
│  (PDF/Excel) │───▶│  (Scripts)   │───▶│  Data (JSON) │───▶│  (CI/Gates)│───▶│  (npm)   │
│  JDIH / BK  │    │  Python/TS   │    │  Bundles     │    │  Shemas    │    │  @ahs-id │
└─────────────┘    └──────────────┘    └──────────────┘    └────────────┘    └──────────┘
```

## Pipeline Stages

### Stage 1: Source (Official Documents)

| Source | Format | Regulation | Status |
|--------|--------|------------|--------|
| JDIH (jdih.pu.go.id) | PDF | Permen PUPR 8/2023 | ✅ Imported |
| JDIH (jdih.pu.go.id) | PDF | Permen PUPR 1/2022 | ✅ Imported |
| JDIH (jdih.pu.go.id) | PDF | Permen PUPR 28/2016 | ⬜ Needs extraction |
| SE Bina Konstruksi | PDF | SE 68/2024 | ✅ Imported |
| SK Gubernur | PDF/Excel | HSD Regional | ✅ Kaltim, Jabar, Papua |

### Stage 2: Extraction Scripts

Located in `scripts/`:

| Script | Purpose |
|--------|---------|
| `scripts/normalize-bina-marga.mjs` | Normalize bina-marga data (ref codes, provenance, master data) |
| `scripts/generate-hsd-bm.mjs` | Generate HSD bundle from master data prices |
| `scripts/fix-bm-data.mjs` | Fix data quality issues (missing refs, invalid values) |
| `scripts/analyze-bm-refs.mjs` | Analyze ref gaps between AHSP items and HSD data |
| `scripts/add-verification-tier.mjs` | Add verification_tier to all items |
| `scripts/validate-data.mjs` | JSON Schema validation for all data bundles |
| `scripts/validate-bundles.mjs` | Cross-bundle validation (ref integrity) |

### Stage 3: Structured Data (JSON Bundles)

Each regulation is a separate npm package under `packages/`:

```
packages/
├── core/                    # Calculation engine + validators + types
├── pupr-2023/               # Permen PUPR 8/2023 (12 items, Divisi 3)
├── bina-marga-2016/         # Permen PUPR 28/2016 (partial, Divisi 3)
├── bina-marga-2022/         # Permen PUPR 1/2022 (422 items, Divisi 2-10)
├── cipta-karya-2024/        # SE 68/2024 (fixed-coefficient)
├── hsd-kaltim-2025/         # HSD Kalimantan Timur Q1 2025
├── hsd-jabar-2025/          # HSD Jawa Barat Q1 2025
├── hsd-papua-2025/          # HSD Papua Q1 2025
├── hsd-bm-2022/             # HSD nasional untuk Bina Marga 2022
```

### Stage 4: Validation Gates

All data must pass these checks before publishing:

1. **JSON Schema** — `pnpm validate-data` matches each JSON file against its schema
2. **Cross-bundle** — `pnpm validate-bundles` checks ref integrity between items and HSD
3. **Unit tests** — `pnpm test` runs 146+ tests (65 core + 24 bm-2022 + 57 golden)
4. **Golden tests** — Calculation outputs match known results (ε ≤ 0.01 Rp)
5. **CI** — GitHub Actions runs all gates on every PR to main

### Stage 5: Publishing

```bash
# Version bump + CHANGELOG
pnpm changeset
pnpm version-packages
pnpm release
```

## Adding a New Regulation Bundle

### Minimal checklist:

1. Create `packages/<reg>/` with structure:
   ```
   data/
   ├── tenaga-kerja.json      # Master labor data
   ├── bahan-master.json       # Master material data  
   ├── peralatan-master.json   # Master equipment data (with hsd_params)
   ├── faktor-konversi.json    # Volume conversion factors
   └── ahsp/<bidang>/<div>/    # AHSP items (one .json per item or items.json array)
   src/
   └── index.ts               # Export meta + bundle as DataBundle
   ```

2. Each AHSP item MUST have:
   - `provenance.sumber_regulasi` — source regulation name
   - `provenance.verification_tier` — one of: auto-extracted, spot-checked, verified, executed

3. Create HSD bundle (if needed) with matching refs:
   - `hsd.tenaga_kerja` must have all TK refs used by items
   - `hsd.bahan` must have all bahan refs used by items

4. Register in `scripts/validate-bundles.mjs`

5. Verify: `pnpm validate-data && pnpm validate-bundles && pnpm test`

## Template: New Bundle Package

```bash
# Generate from template:
node scripts/scaffold-bundle.mjs <name> <regulation> <year>
```

## Data Quality Tips

- **Ref codes**: Use dotted format (L.01 not L01, M.01a not M01a)
- **Provenance**: Always include! Required by validateBundle
- **HSD coverage**: Every TK/bahan/peralatan ref in items needs matching HSD entry
- **Volume states**: Bank → loose → compacted. Set volume_state_bayar on items
- **Koef range**: Must be > 0. Zero koef means the item is missing data
