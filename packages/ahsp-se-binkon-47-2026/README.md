# `@ahs-id/ahsp-se-binkon-47-2026`

Fixed-coefficient AHSP templates from **SE Dirjen Binkon No. 47/SE/Dk/2026** (SDA / Bina Marga / Cipta Karya).

## Sumber harga komponen (`harga_satuan_ref`)

Urutan kebijakan (tidak mengarang angka):

1. **PDF lampiran nasional (Docling `hsp-linked`)** — jika kolom harga satuan komponen terisi di ekstraksi.
2. **HSP portal DCKTRP Jakarta** — overlay untuk `kode_ahsp` yang cocok (`pnpm national:se47-enrich-dcktrp-prices`). Komponen: cocokkan `ref` dulu, lalu `nama` (banyak baris nasional `ref: null`). Exemplar DKI, bukan transkripsi PDF nasional; dicatat di `catatan_umum`. Saat ini overlap hanya Cipta Karya (~63 kode); SDA/Bina Marga tetap 0.
3. **Tetap `0`** — template koefisien saja; hitung HSP penuh butuh HSD/portal lain, atau gunakan paket `ahsp-dcktrp-by-source` untuk item portal yang sudah berharga.

Harga unit portal bisa terlihat tidak wajar vs HSD regional (disalin apa adanya dari DCKTRP).

`calcHspFixedCoefficient` hanya memakai `harga_satuan_ref` per komponen (bukan `harga_satuan_pekerjaan_ref`).
