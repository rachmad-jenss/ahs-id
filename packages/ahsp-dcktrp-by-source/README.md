# @ahs-id/ahsp-dcktrp-by-source

AHSP bertipe **fixed_coefficient**, dikelompokkan **per dasar hukum** (`dasar_hukum` dari portal Bangun Jakarta).

## Struktur

| Path | Isi |
|------|-----|
| `data/legal-sources-catalog.json` | Katalog SE/Permen + alias + tautan dokumen |
| `data/bundle-index.json` | Daftar sub-bundel |
| `data/{source_id}/bundle-meta.json` | Metadata + link sumber |
| `data/{source_id}/items.json` | Array `ahsp-item` (validasi skema core) |

Setiap item memuat `provenance` dengan `dokumen_url`, `dokumen_pencarian_url`, `portal_url`, `portal_item_url`.

## Regenerasi

```bash
pnpm scrape:jakarta-hsp
pnpm enrich:jakarta-hsp-manifest
pnpm build:ahsp-by-legal-source
```
