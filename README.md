# @ahs-id — Analisa Harga Satuan for Indonesia

> Open source calculation engine & structured data bundles for Indonesian
> construction cost estimation (AHSP) based on Permen PUPR.

## What is this?

AHS-ID turns Indonesia's construction cost coefficients (currently locked
in PDF/Excel) into machine-readable JSON data + a calculation engine.

**For engineers:** Calculate HSP from koefisien AHSP × HSD, with full
productivity analysis for mechanized work.

**For developers:** npm install, import, calculate. Typed API, validated
bundles, offline-first.

## Quick Start

```bash
npm install @ahs-id/core @ahs-id/pupr-2023 @ahs-id/hsd-kaltim-2025
```

```typescript
import { createCalculator } from '@ahs-id/core';
import { bundle } from '@ahs-id/pupr-2023';
import { hsd } from '@ahs-id/hsd-kaltim-2025';

const calc = createCalculator(bundle, hsd);

const hsp = calc.hitungHSP('3.2.1', {
  jarak_quarry_km: 25,
  jarak_sumber_air_km: 8,
  kondisi_jalan: 'sedang',
  faktor_efisiensi: 0.83,
});

console.log(hsp.grandTotal); // HSP termasuk overhead & profit (15%)
```

Export the breakdown to Excel (RAB columns: Uraian, Satuan, Koefisien, Harga Satuan, Jumlah):

```typescript
import { createCalculator, exportHspToExcelBuffer } from '@ahs-id/core';
import { writeFileSync } from 'node:fs';

const buffer = await exportHspToExcelBuffer(hsp);
writeFileSync('hsp-3.2.1.xlsx', buffer);
```

## Available Packages

### Calculation Engine

| Package | Description |
|---------|-------------|
| `@ahs-id/core` | Calculator engine, validator, TypeScript types |

### AHSP Bundles

| Package | Regulation | Scope | Items |
|---------|------------|-------|-------|
| `@ahs-id/pupr-2023` | Permen PUPR 8/2023 | Umum | 12 |
| `@ahs-id/bina-marga-2016` | Permen PUPR 28/2016 + Spesif. Umum 2010 Rev.3 | Bina Marga Divisi 3 | 23 |
| `@ahs-id/bina-marga-2022` | Permen PUPR 1/2022 | Bina Marga Divisi 2–10 | 422 |
| `@ahs-id/cipta-karya-2024` | SE Bina Konstruksi 68/2024 | Cipta Karya Divisi 1–10 | 1,943 |

### HSD Regional Prices

| Package | Region | Price level |
|---------|--------|-------------|
| `@ahs-id/hsd-jabar-2025` | Jawa Barat Q1 2025 | Terendah |
| `@ahs-id/hsd-kaltim-2025` | Kalimantan Timur Q1 2025 | Menengah |
| `@ahs-id/hsd-papua-2025` | Papua Q1 2025 | Tertinggi |

## Key Concepts

- **Static coefficients** — fixed values from regulation tables (manual/semi-mekanis work)
- **Dynamic coefficients** — calculated from equipment productivity (mekanis work: Excavator, Dump Truck, Motor Grader, etc.)
- **Bundles** — installable packages of AHSP coefficient data, versioned per regulation
- **HSD** — regional base prices for labor, materials, and equipment

## Engine Features

- HSP calculation: `Σ(koefisien × HSD)` with overhead + profit margin (default 15%)
- Equipment ownership cost model: depreciation, interest, insurance, O&M
- Productivity models: siklus (DT, Excavator, WL, WT), lintasan (VR, MG), throughput (AMP)
- Volume state conversion: bank → loose → compacted
- Sub-AHSP nesting with circular dependency detection
- Mode sewa (rental) support alongside ownership mode
- Estimasi-kasar fallback with warnings when input is incomplete
- Cross-bundle validation: ref integrity, range checks, provenance
- JSON Schema validation at build time

## Repository Structure

```
packages/
├── core/                  ← Engine: calculator, validator, types
├── pupr-2023/             ← Permen PUPR 8/2023
├── bina-marga-2016/       ← Permen PUPR 28/2016 (Bina Marga Divisi 3)
├── bina-marga-2022/       ← Permen PUPR 1/2022 (Bina Marga Divisi 2–10)
├── cipta-karya-2024/      ← SE Bina Konstruksi 68/2024 (Cipta Karya)
├── hsd-jabar-2025/        ← HSD Jawa Barat Q1 2025
├── hsd-kaltim-2025/       ← HSD Kalimantan Timur Q1 2025
└── hsd-papua-2025/        ← HSD Papua Q1 2025

tests/golden/              ← Cross-bundle regression fixtures
docs/                      ← Architecture spec, legal notes
```

## Documentation

- [Architecture Specification](docs/architecture.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Legal & Data Attribution](LEGAL.md)

## Relationship to Estimara

AHS-ID is the open source engine. [Estimara](https://estimara.id) is the
commercial platform that adds WBS management, approval workflows, audit
trails, and team collaboration on top.

## License

MIT — see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md) for government data usage.
