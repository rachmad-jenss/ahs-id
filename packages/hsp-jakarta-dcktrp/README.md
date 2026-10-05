# @ahs-id/hsp-jakarta-dcktrp

Harga Satuan Pekerjaan (HSP) dari portal **Bangun Jakarta** (DCKTRP DKI Jakarta).

## Sumber

- Portal: https://dcktrp.jakarta.go.id/bangunjakarta/hsp
- API: `GET /bangunjakarta/portal/api/hsp` (list + `?id=` detail)

## Isi data

| File | Keterangan |
|------|------------|
| `data/manifest.json` | Metadata scrape, jumlah item, tier verifikasi |
| `data/index.json` | Ringkasan 2.231 item HSP (kode, harga, kategori) |
| `data/items.jsonl` | Detail koefisien TK / bahan / alat per item |

## Perbarui data

```bash
pnpm scrape:jakarta-hsp
pnpm build:jakarta-hsd
```

Opsi scraper: `--resume`, `--limit`, `--max-pages`, `--concurrency`.

HSD regional hasil agregasi: paket `@ahs-id/hsd-jakarta-2026` (satu bundle harga daerah; AHSP tetap per regulasi sumber).
