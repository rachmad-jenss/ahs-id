# Full-check all 3 SE DJBK 47/2026 PDFs (resumable — re-run this script after pause)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$exe = ".\.venv\Scripts\ahs-docling.exe"

$jobs = @(
    @{
        Name = "SDA"
        Pdf  = "D:\Downloads\Documents\Lampiran-IV-SE-DJBK-No-47-Tahun-2026-AHSP-Bidang-Sumber-Daya-Air.pdf"
        Hsp  = "output\sda-se-47-2026\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\sda-se-47-2026\checkpoints"
        Out  = "output\sda-se-47-2026\cleaned\full-check-report.json"
        Log  = "output\sda-se-47-2026\full-check.log"
    },
    @{
        Name = "BM"
        Pdf  = "D:\Downloads\Documents\5.-Lampiran-V-Bidang-Bina-Marga-ok_2.pdf"
        Hsp  = "output\bina-marga-lampiran-v\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\bina-marga-lampiran-v\checkpoints"
        Out  = "output\bina-marga-lampiran-v\cleaned\full-check-report.json"
        Log  = "output\bina-marga-lampiran-v\full-check.log"
    },
    @{
        Name = "CK"
        Pdf  = "D:\Downloads\Documents\Lampiran-VI-SE-DJBK-No-47-Tahun-2026-AHSP-Bidang-Cipta-Karya.pdf"
        Hsp  = "output\cipta-karya-se-47-2026\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\cipta-karya-se-47-2026\checkpoints"
        Out  = "output\cipta-karya-se-47-2026\cleaned\full-check-report.json"
        Log  = "output\cipta-karya-se-47-2026\full-check.log"
    }
)

foreach ($j in $jobs) {
    Write-Host "=== Full check $($j.Name) ===" -ForegroundColor Cyan
    if (-not (Test-Path $j.Pdf)) {
        Write-Host "SKIP: PDF not found: $($j.Pdf)" -ForegroundColor Red
        continue
    }
    & $exe spot-check --full `
        --pdf $j.Pdf `
        --hsp-parsed $j.Hsp `
        --checkpoints $j.Ckpt `
        -o $j.Out `
        --progress-every 100 `
        --checkpoint-every 25 2>&1 | Tee-Object -FilePath $j.Log -Append
}

Write-Host "=== All full checks finished ===" -ForegroundColor Green
