# Windows + Cursor development notes

## OOM yang bukan bug aplikasi

1. **Cursor PowerShell wrapper** — kadang melempar `System.OutOfMemoryException` setelah command selesai. Itu noise harness, bukan kegagalan `pnpm`/`vitest`. Cek exit code log di atas error tersebut.

2. **Turbo paralel** — banyak paket `eslint` bersamaan bisa membuat mesin lokal kehabisan RAM. Di Windows, `pnpm lint` / `typecheck` / `test` memakai `scripts/run-turbo.mjs` dengan `--concurrency=1` dan heap Node 6 GB.

3. **`astro check`** — di Windows script memakai **`tsc --noEmit`** saja (Vite/Astro check penuh OOM di mesin dev). CI Ubuntu tetap menjalankan `astro check` penuh. Paksa astro di Windows: `AHS_ID_FORCE_ASTRO_CHECK=1`.

## Perintah aman

```powershell
nvm use   # atau fnm — lihat .nvmrc (22.12.0)
pnpm install
pnpm lint
pnpm typecheck
```

Gate resmi: **GitHub Actions** (`ubuntu-latest`), bukan runner self-hosted Windows.
