# LEGAL.md

## Regulatory Data

AHS-ID contains coefficient data extracted from official Indonesian
government regulations, specifically:

- Permen PUPR No. 8 Tahun 2023 and its appendices (Lampiran I-IV)
- SE Dirjen Bina Konstruksi No. 73/2023

### Legal Basis for Republication

Under Indonesian law:

1. **PP No. 70 Tahun 2019** tentang Perencanaan, Penganggaran,
   Pelaksanaan, Pelaporan, dan Evaluasi atas Penerimaan dan
   Pengeluaran Negara:
   Government regulations are public documents intended for public use.

2. **UU No. 14 Tahun 2008** tentang Keterbukaan Informasi Publik:
   Government regulations and their appendices are classified as
   "Informasi Publik yang Wajib Disediakan dan Diumumkan" (Article 9).

3. **UU No. 28 Tahun 2014** tentang Hak Cipta, Pasal 43 huruf (b):
   "Tidak merupakan pelanggaran Hak Cipta: (b) pengambilan berita aktual,
   baik seluruhnya maupun sebagian, dari kantor berita, Lembaga Penyiaran,
   dan surat kabar atau sumber sejenis lainnya dengan ketentuan sumbernya
   harus disebutkan secara lengkap."

   Additionally, Pasal 42:
   "Tidak ada Hak Cipta atas: (a) hasil rapat terbuka lembaga negara;
   (b) peraturan perundang-undangan; (c) pidato kenegaraan atau pidato
   pejabat pemerintah; (d) putusan pengadilan atau penetapan hakim;
   (e) kitab suci atau simbol keagamaan."

   Point (b) directly exempts government regulations from copyright.

### Attribution

While government regulations are not copyrighted, AHS-ID provides
full attribution as good practice:

- Every coefficient entry includes `provenance.sumber_regulasi`
  tracing to the specific Permen, Lampiran, and page number.
- The data source is clearly stated in bundle metadata (`ahs_meta`).

### Disclaimer

AHS-ID data is provided "as is" for informational and computational
purposes. This data does not constitute official government documents.
For authoritative regulatory text, always refer to the original
publications on JDIH (jdih.pu.go.id) or Peraturan BPK (peraturan.bpk.go.id).

### Separation of Official Data from Processing Layer

AHS-ID clearly separates two layers, inspired by the methodology of
[Pasal.id](https://pasal.id/metodologi):

1. **Official data** — The AHSP coefficients, HSD prices, and equipment
   specifications are extracted from official government regulations
   (Permen PUPR, SK Gubernur). These are in the public domain under
   UU 28/2014 Pasal 42.

2. **Processing layer** — The JSON representation, validation schemas,
   calculation engine, and tooling are MIT-licensed original work.
   This layer provides structure and compute but does not modify the
   underlying coefficients.

Every AHSP item includes a `provenance.verification_tier` field that
documents the current verification level:

| Tier | Meaning |
|------|---------|
| `auto-extracted` | Parsed from PDF/Excel source without manual verification |
| `spot-checked` | Random sample checked against original source document |
| `verified` | Every entry has been manually compared against the source |
| `executed` | Verified + calculation output confirmed against known results |

This tier system lets users assess data confidence at a glance, just as
Pasal.id distinguishes "automatically parsed" from "verified" content.

Users are responsible for verifying coefficients against the latest
applicable regulations before using them in official HPS/RAB documents.

### HSD Regional Data

HSD (Harga Satuan Dasar) prices are published by regional governments
via SK Gubernur/Bupati. These are public procurement reference prices
intended for government project cost estimation. The same legal basis
(UU 14/2008, UU 28/2014 Pasal 42) applies.

### Software License

The AHS-ID calculation engine, schemas, validators, and CLI tools are
licensed under the MIT License. See LICENSE file.

The coefficient data in bundle packages is public domain (government
regulation data). The structured JSON representation is MIT-licensed.
