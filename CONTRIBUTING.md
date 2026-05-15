# Contributing to AHS-ID

Thank you for your interest in contributing to AHS-ID.

## Types of Contributions

- **Code:** engine modules, validators, exporters
- **Data:** AHSP coefficients, HSD regional prices, equipment specs
- **Docs:** calculation reference, translation, tutorials

## Data Contribution Requirements

- PR MUST include provenance (PDF source page/table/row)
- PR MUST include screenshot of regulation source
- Koefisien changes > 20% from previous version require 2 reviewers
- All data PRs auto-run `validateBundle()` in CI

## Code Contribution Requirements

- All golden tests must pass
- New calculation modules require benchmark test case
- TypeScript strict mode, no `any`
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`

## Scope

AHS-ID = calculation engine + data bundles only. Features like scheduling,
invoicing, BIM integration, or project management are out of scope (those
belong in downstream platforms like EstiMara).

## Development Setup

```bash
git clone https://github.com/rachmad-jenss/ahs-id.git
cd ahs-id
pnpm install
pnpm build
pnpm test
```

## Good First Issues

- `data-entry` label: add AHSP items from PDF lampiran
- `hsd-region` label: add HSD for a new kabupaten/kota
- `docs` label: improve calculation reference documentation
