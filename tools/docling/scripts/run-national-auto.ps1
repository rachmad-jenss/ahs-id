# End-to-end national pipeline (no Jakarta API). Respects disk via download env vars.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
Set-Location $Root

Write-Host "1) Scrape DJBK + merge catalog" -ForegroundColor Cyan
node scripts/scrape-djbk-produk-hukum-index.mjs
node scripts/merge-djbk-links-into-catalog.mjs

if (-not $env:AHSP_DOWNLOAD_ONLY) { $env:AHSP_DOWNLOAD_ONLY = "se-182-2025-lampiran-i,se-47-2026" }
if (-not $env:AHSP_DOWNLOAD_MAX_MB) { $env:AHSP_DOWNLOAD_MAX_MB = "28" }

Write-Host "2) Download PDFs (ONLY=$env:AHSP_DOWNLOAD_ONLY, MAX_MB=$env:AHSP_DOWNLOAD_MAX_MB)" -ForegroundColor Cyan
pnpm download:national-legal-pdfs

Set-Location (Join-Path $Root "tools\docling")
$exe = ".\.venv\Scripts\ahs-docling.exe"
if (-not (Test-Path $exe)) {
  python -m venv .venv
  .\.venv\Scripts\pip install -e ".[dev]"
}

# Small SE-47 lampiran already classified — see sources/national/SE-47-2026-download-map.json
Write-Host "3) Docling: SE 47 Lampiran VII (sample HSP breakdown tables)" -ForegroundColor Cyan
$pdf = "sources\national\se-47-2026--sdm_download--id-10906.pdf"
if (Test-Path $pdf) {
  & $exe extract $pdf -o "output\se-47-2026-id-10906" --chunk-size 15
  $tj = Get-ChildItem "output\se-47-2026-id-10906\*-tables.json" | Select-Object -First 1
  if ($tj) { & $exe analyze $tj.FullName -o "output\se-47-2026-id-10906\cleaned" }
}

Write-Host "Done. For full AHSP bidang (IV/V), raise AHSP_DOWNLOAD_MAX_MB and free disk — see SE-47-2026-download-map.json" -ForegroundColor Green
