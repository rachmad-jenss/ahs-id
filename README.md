# @ahs-id — Analisa Harga Satuan for Indonesia

> Open source calculation engine & structured data bundles for Indonesian
> construction cost estimation (AHSP) based on Permen PUPR.

## What is this?

AHS-ID turns Indonesia's construction cost coefficients (currently locked
in PDF/Excel) into machine-readable JSON data + a calculation engine.

**For engineers:** Calculate HSP from koefisien AHSP x HSD, with full
productivity analysis for mechanized work.

**For developers:** npm install, import, calculate. Typed API, validated
bundles, offline-first.

## Quick Start

```
npm install @ahs-id/core @ahs-id/pupr-2023 @ahs-id/hsd-kaltim-2025
```

```typescript
import { createCalculator } from '@ahs-id/core';
import pupr2023 from '@ahs-id/pupr-2023';
import hsdKaltim from '@ahs-id/hsd-kaltim-2025';

const calc = createCalculator({
  bundle: pupr2023,
  hsd: hsdKaltim,
  config: { ppn_pct: 11 }
});

const hsp = calc.hitungHSP('3.2.1', {
  jarak_quarry_km: 25,
  jarak_sumber_air_km: 8,
  kondisi_jalan: 'sedang',
  faktor_efisiensi: 0.83,
});
```

## Available Bundles

| Package | Description | Status |
|---------|-------------|--------|
| @ahs-id/core | Calculation engine | In development |
| @ahs-id/pupr-2023 | Permen PUPR 8/2023 coefficients | In development |
| @ahs-id/hsd-kaltim-2025 | HSD Kalimantan Timur Q1 2025 | In development |

## Key Concepts

- **Static coefficients** — fixed values from regulation tables (manual work)
- **Dynamic coefficients** — calculated from equipment productivity (mechanized work)
- **Bundles** — installable packages of coefficient data, versioned per regulation
- **HSD** — regional base prices for labor, materials, equipment

## Documentation

- [Architecture Specification](docs/architecture.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Data contributions (new AHSP items,
HSD regions) are especially welcome.

## Relationship to EstiMara

AHS-ID is the open source engine. [EstiMara](https://estimara.id) is the
commercial platform that adds WBS management, approval workflows, audit
trails, and team collaboration on top.

## License

MIT — see [LICENSE](LICENSE) and [LEGAL.md](LEGAL.md) for government data usage.
