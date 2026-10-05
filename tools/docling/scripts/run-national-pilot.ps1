# Pilot: extract first pages from downloaded national PDFs (resumable full run later).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$exe = ".\.venv\Scripts\ahs-docling.exe"
if (-not (Test-Path $exe)) {
    Write-Host "Create venv first: cd tools/docling; python -m venv .venv; .\.venv\Scripts\pip install -e '.[dev]'" -ForegroundColor Yellow
    exit 1
}

$src = "sources\national"
$jobs = @(
    @{
        Name = "SE-30-2025 (batang tubuh)"
        Pdf  = Join-Path $src "se-binkon-30-2025--dokumen_pdf.pdf"
        Out  = "output\se-binkon-30-2025-pilot"
        Range = "1-40"
    },
    @{
        Name = "SE-182-2025 Lampiran III (AHSP)"
        Pdf  = Join-Path $src "se-binkon-182-2025--dokumen_pdf.pdf"
        Out  = "output\se-binkon-182-2025-lampiran-iii-pilot"
        Range = "1-25"
    }
)

foreach ($j in $jobs) {
    Write-Host "=== $($j.Name) ===" -ForegroundColor Cyan
    if (-not (Test-Path $j.Pdf)) {
        Write-Host "SKIP: missing $($j.Pdf) — run: pnpm download:national-legal-pdfs" -ForegroundColor Red
        continue
    }
    & $exe extract $j.Pdf -o $j.Out --page-range $j.Range
    $tables = Get-ChildItem -Path $j.Out -Filter "*-tables.json" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($tables) {
        & $exe analyze $tables.FullName -o (Join-Path $j.Out "cleaned")
    }
}

Write-Host "Pilot done. Full extract: drop --page-range and re-run ahs-docling extract." -ForegroundColor Green
