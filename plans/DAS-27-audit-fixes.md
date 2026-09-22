# DAS-27 — Audit fixes

Issue: [#27](https://github.com/rachmad-jenss/ahs-id/issues/27)

## 1. Bina Marga 2022 equipment prices

`createCalculator` was costing every BM-2022 alat from the normalize stub (`harga_pokok_rp` 500.000.000, `daya_hp` 100, `bahan_bakar_ch` 12). Fuel alone is about 8.160.000 Rp/jam. The Permen hourly rate is already in `@ahs-id/hsd-bm-2022`.

- Flip `mode_biaya` from `ownership` to `sewa` where a Permen `peralatan_sewa` row exists.
- Leave the 11 refs with no Permen rate on `ownership` (`E.17b`, `E.56`, `E.62`, `E.61`, `E.32b`, `E.07b`, `E.68`, `E.69`, `E.98d`, `E.63`, `E.12e`).
- Throw if ownership params still match the stub, so those items fail closed instead of emitting the stub price.

## 2. Fork CI off the self-hosted runner

Same-repo non-draft PRs stay on the Windows self-hosted runner. Fork non-draft PRs run the same steps on `ubuntu-latest` with bash. Draft PRs still skip CI.

## 3. CLI `--hsd`

`--hsd` selects the price bundle. Omitted flag keeps the bundle default: `pupr-2023` → `hsd-kaltim-2025`, `bina-marga-2022` → `hsd-bm-2022`. Unknown names throw with the available list. `validate --bundle` is an allowlist.

## 4. Productivity map keys

A selected key that is not in the map returns the formula fallback. An omitted key still uses the first row, which the golden fixtures depend on. `agregat_kelas_a` and `tanah_biasa` are explicit aliases of the row those fixtures already locked, so PUPR totals stay within 0.01 Rp.

## 5. Sub-AHSP cycles

The recursive `hitungHSP` call receives the parent kode on the resolve stack, so A → B → A throws instead of overflowing.

## 6. Bahan volume conversion

A bahan whose volume states differ throws when `faktor_konversi` has no row for that material. Peralatan already did this.

## 7. `hsd-bm-2022` package contract

Schema validation includes the package. `files` ships `data` and `dist`. `lint` and `typecheck` exist. The unused `ref: "0.0"` row is removed so `^E\.` passes. `calcHspFromBundle` throws when `koef_referensi` or the alat price is missing.
