# Full-check SDA / BM / CK SE 47/2026 (resumable). PDFs from sources/national/.
param(
    [switch]$NoResume,
    [ValidateSet("SDA", "BM", "CK", "All")]
    [string]$Only = "All"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$exe = ".\.venv\Scripts\ahs-docling.exe"
$src = "sources\national"

$jobs = @(
    @{
        Name = "SDA"
        Pdf  = "$src\se-47-2026--sdm_download--id-10901.pdf"
        Hsp  = "output\sda-se-47-2026\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\sda-se-47-2026\checkpoints"
        Out  = "output\sda-se-47-2026\cleaned\full-check-report.json"
        Log  = "output\sda-se-47-2026\full-check.log"
    },
    @{
        Name = "BM"
        Pdf  = "$src\se-47-2026--sdm_download--id-10903.pdf"
        Hsp  = "output\cipta-karya-se-47-2026\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\cipta-karya-se-47-2026\checkpoints"
        Out  = "output\cipta-karya-se-47-2026\cleaned\full-check-report.json"
        Log  = "output\cipta-karya-se-47-2026\full-check.log"
    },
    @{
        Name = "CK"
        Pdf  = "$src\se-47-2026--sdm_download--id-10904.pdf"
        Hsp  = "output\bina-marga-lampiran-v-national\cleaned\hsp-parsed.jsonl"
        Ckpt = "output\bina-marga-lampiran-v-national\checkpoints"
        Out  = "output\bina-marga-lampiran-v-national\cleaned\full-check-report.json"
        Log  = "output\bina-marga-lampiran-v-national\full-check.log"
    }
)

$resumeFlag = @()
if ($NoResume) { $resumeFlag = @("--no-resume") }

foreach ($j in $jobs) {
    if ($Only -ne "All" -and $j.Name -ne $Only) { continue }
    $hspPath = $j.Hsp
    if ($j.Name -eq "BM") {
        $canonical = "output\cipta-karya-se-47-2026\cleaned\hsp-parsed-formular-canonical.jsonl"
        if (Test-Path $canonical) {
            $hspPath = $canonical
            Write-Host "BM full-check: using canonical formular HSP ($canonical)" -ForegroundColor DarkGray
        }
    }
    Write-Host "=== Full check $($j.Name) ===" -ForegroundColor Cyan
    if (-not (Test-Path $j.Pdf)) {
        Write-Host "SKIP: PDF not found: $($j.Pdf)" -ForegroundColor Red
        continue
    }
    $started = Get-Date
    & $exe spot-check --full `
        --pdf $j.Pdf `
        --hsp-parsed $hspPath `
        --checkpoints $j.Ckpt `
        -o $j.Out `
        --progress-every 100 `
        --checkpoint-every 25 `
        @resumeFlag 2>&1 | Tee-Object -FilePath $j.Log -Append
    $mins = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
    Write-Host "=== $($j.Name) finished in ${mins} min ===" -ForegroundColor Green
}

Write-Host "=== All full checks finished ===" -ForegroundColor Green
