# Legal and Data Provenance

AHS-ID combines original software with coefficients and reference prices derived
from Indonesian government instruments and regional publications. This document
summarizes provenance and the project's reuse policy; it is not a legal opinion.
Check the notices shipped with each data package before redistributing it.

## Source inventory

| Data package or source group | Source described by the project |
|---|---|
| `@ahs-id/pupr-2023` | Permen PUPR No. 8 Tahun 2023, Lampiran I–IV |
| `@ahs-id/bina-marga-2016` | Permen PUPR No. 28 Tahun 2016 and Spesifikasi Umum Bina Marga 2010 Rev. 3 |
| `@ahs-id/bina-marga-2022`, `@ahs-id/hsd-bm-2022` | Permen PUPR No. 1 Tahun 2022 |
| `@ahs-id/cipta-karya-2024` | SE Dirjen Bina Konstruksi No. 68/2024 |
| `@ahs-id/ahsp-se-binkon-47-2026` | SE Dirjen Bina Konstruksi No. 47/2026 |
| `@ahs-id/hsd-jabar-2025`, `@ahs-id/hsd-kaltim-2025`, `@ahs-id/hsd-papua-2025` | Regional HSD price schedules for Jawa Barat, Kalimantan Timur, and Papua |
| `@ahs-id/hsd-jakarta-2026`, Jakarta portal catalog data | DCKTRP's Bangun Jakarta portal; the package describes Jakarta Q1 2026 HSD and portal AHSP/HSP data |

Each published bundle should carry the exact source title, issuing body,
publication/version date, URL or document identifier, relevant page or sheet,
access date, extraction method, attribution, and any known reuse terms. If a
detail is absent from a bundle, do not infer it from this overview.

## Copyright and reuse

UU No. 28 Tahun 2014 tentang Hak Cipta, Pasal 42(b), states that copyright does
not apply to peraturan perundang-undangan. AHS-ID relies on this provision only
for the legal instruments themselves. It does not make a blanket rights
determination for separate price schedules, circulars, portal content, source
spreadsheets, compilations, or other material merely because a government body
published or hosts it.

Public availability is not treated here as a blanket license to republish every
source file or transformed dataset. In particular, this project makes no general
claim that all regional HSD data is public domain. Verify the applicable source
terms or permission for each dataset and retain its attribution and provenance.

Official references:

- [UU No. 28 Tahun 2014 tentang Hak Cipta (Database Peraturan BPK)](https://peraturan.bpk.go.id/Home/Download/28018/UU%20Nomor%2028%20Tahun%202014.pdf)
- [UU No. 14 Tahun 2008 tentang Keterbukaan Informasi Publik (Database Peraturan BPK)](https://peraturan.bpk.go.id/Details/39047/uu-no-14-2008)

## Attribution and verification

AHSP entries include `provenance.sumber_regulasi` and bundle metadata identifies
the stated data source. Keep attribution connected to every package and
published dataset. Record verification with the existing
`provenance.verification_tier` field:

| Tier | Meaning |
|---|---|
| `auto-extracted` | Parsed from the source PDF or spreadsheet without manual verification |
| `spot-checked` | A sample was checked against the source document |
| `verified` | Every entry was manually compared with the source |
| `executed` | Verified and calculation output was checked against known results |

Users must check coefficients against the latest applicable regulation and
confirm prices against the relevant source before using results in official
HPS/RAB documents. AHS-ID outputs are computational references, not official
government documents.

## Regional HSD data

Regional HSD sources can differ by issuing authority, publication type, period,
and reuse terms. A source being hosted on an official portal does not establish
that the extracted table may be redistributed under the software's license.
The package must identify its specific source and applicable notice or
permission. When reuse terms cannot be established, resolve them with the
publisher or rights holder before publishing or republishing the affected data.

## Software license

The MIT License in `LICENSE` applies to AHS-ID software authored in this
repository, including the calculation engine, validators, schemas, CLI, and
other original code. It does not by itself grant rights in third-party source
documents or data. Read each data package's source attribution and reuse notice
alongside the MIT license; do not interpret the root license as a blanket
public-domain or MIT license for every underlying dataset.
