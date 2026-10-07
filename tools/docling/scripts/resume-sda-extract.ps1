# Run in a normal PowerShell window (not Cursor agent) until SDA extract completes.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
$exe = ".\.venv\Scripts\ahs-docling.exe"
$pdf = "sources\national\se-47-2026--sdm_download--id-10901.pdf"
$out = "output\sda-se-47-2026"

while ($true) {
    # Must match original run (10 pages/batch) so existing checkpoints resume.
    & $exe extract $pdf -o $out --chunk-size 10
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SDA extract complete." -ForegroundColor Green
        break
    }
    Write-Host "Extract exited $LASTEXITCODE — resuming from checkpoints in 10s..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}
