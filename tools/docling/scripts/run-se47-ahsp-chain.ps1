# Wait for / run SE 47 AHSP pipeline: SDA (10901) then Bina Marga (10904).
# Safe to run while extract is already in progress (waits on progress.json + ahs-docling process).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$exe = ".\.venv\Scripts\ahs-docling.exe"
$log = "output\se47-ahsp-chain.log"
function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $log -Value $line
    Write-Host $line
}

function Wait-ExtractDone($outDir) {
    $progress = Join-Path $outDir "progress.json"
    $tables = Get-ChildItem -Path $outDir -Filter "*-tables.json" -ErrorAction SilentlyContinue | Select-Object -First 1
    while ($true) {
        $running = Get-Process -Name "ahs-docling","python" -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -like "*docling*" }
        if (Test-Path $progress) {
            $p = Get-Content $progress -Raw | ConvertFrom-Json
            if ($p.status -eq "done" -and $p.completed_pages -ge $p.total_pages -and $tables) {
                return $tables.FullName
            }
            Log ("SDA extract {0}% batch {1} tables={2}" -f $p.percent, $p.chunk, $p.tables_found)
        } elseif ($tables) {
            return $tables.FullName
        }
        if (-not $running) {
            Start-Sleep -Seconds 15
            $tables = Get-ChildItem -Path $outDir -Filter "*-tables.json" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($tables) { return $tables.FullName }
            throw "Extract stopped but no tables JSON in $outDir"
        }
        Start-Sleep -Seconds 90
    }
}

function Run-Phase($name, $pdf, $outDir, $linkFormular) {
    Log "=== Phase: $name ==="
    if (-not (Test-Path $pdf)) { throw "Missing PDF: $pdf" }

    $progress = Join-Path $outDir "progress.json"
    $tables = Get-ChildItem -Path $outDir -Filter "*-tables.json" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $tables) {
        Log "extract -> $outDir"
        & $exe extract $pdf -o $outDir --chunk-size 15
    } else {
        Log "extract skipped (tables exist); waiting if still running..."
    }
    $tablesPath = Wait-ExtractDone $outDir
    Log "analyze $tablesPath"
    $cleaned = Join-Path $outDir "cleaned"
    & $exe analyze $tablesPath -o $cleaned

    $hsp = Join-Path $cleaned "hsp-parsed.jsonl"
    if (-not (Test-Path $hsp)) {
        Log "WARN: no hsp-parsed.jsonl - skip link-kode"
        return
    }
    $linked = Join-Path $cleaned "hsp-linked.jsonl"
    Log "link-kode -> $linked"
    $linkArgs = @(
        "link-kode",
        "--pdf", (Resolve-Path $pdf).Path,
        "--hsp-parsed", (Resolve-Path $hsp).Path,
        "--checkpoints", (Join-Path $outDir "checkpoints"),
        "-o", $linked
    )
    if ($linkFormular) { $linkArgs += "--formular" }
    & $exe @linkArgs
    Log "=== Phase $name done ==="
}

Log "SE 47 AHSP chain started"
$sdaPdf = "sources\national\se-47-2026--sdm_download--id-10901.pdf"
$bmPdf = "sources\national\se-47-2026--sdm_download--id-10904.pdf"

Run-Phase "SDA Lampiran IV" $sdaPdf "output\sda-se-47-2026" $false
Run-Phase "Bina Marga Lampiran V" $bmPdf "output\bina-marga-lampiran-v" $true

Log "All phases complete."
