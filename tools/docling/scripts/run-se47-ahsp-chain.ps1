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

function Test-ExtractIncomplete($progressPath) {
    if (-not (Test-Path $progressPath)) { return $true }
    $p = Get-Content $progressPath -Raw | ConvertFrom-Json
    return ($p.status -ne "done") -or ($p.completed_pages -lt $p.total_pages)
}

function Wait-ExtractDone($outDir) {
    $progress = Join-Path $outDir "progress.json"
    while ($true) {
        $tables = Get-ChildItem -Path $outDir -Filter "*-tables.json" -ErrorAction SilentlyContinue | Select-Object -First 1
        if (Test-Path $progress) {
            $p = Get-Content $progress -Raw | ConvertFrom-Json
            if ($p.status -eq "done" -and $p.completed_pages -ge $p.total_pages -and $tables) {
                return $tables.FullName
            }
            Log ("extract {0}% batch {1} tables={2}" -f $p.percent, $p.chunk, $p.tables_found)
        } elseif ($tables) {
            return $tables.FullName
        }
        Start-Sleep -Seconds 90
    }
}

Log "SE 47 AHSP chain started"
$sdaPdf = "sources\national\se-47-2026--sdm_download--id-10901.pdf"
$bmPdf = "sources\national\se-47-2026--sdm_download--id-10904.pdf"

function Run-PhaseLink($name, $pdf, $outDir, [string]$linkMode) {
    Log "=== Phase: $name ==="
    if (-not (Test-Path $pdf)) { throw "Missing PDF: $pdf" }

    $progress = Join-Path $outDir "progress.json"
    if (Test-ExtractIncomplete $progress) {
        Log "extract (resume) -> $outDir"
        & $exe extract $pdf -o $outDir --chunk-size 10
    } else {
        Log "extract already done, skipping"
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
    $itemIndex = Join-Path $cleaned "item-index.csv"
    Log "link-kode ($linkMode) -> $linked"
    $linkArgs = @(
        "link-kode",
        "--pdf", (Resolve-Path $pdf).Path,
        "--hsp-parsed", (Resolve-Path $hsp).Path,
        "--checkpoints", (Join-Path $outDir "checkpoints"),
        "-o", $linked
    )
    switch ($linkMode) {
        "sda" { $linkArgs += @("--item-index", (Resolve-Path $itemIndex).Path) }
        "formular" { $linkArgs += "--formular" }
        "ck-inline" { $linkArgs += "--ck-inline" }
        default { }
    }
    & $exe @linkArgs
    Log "=== Phase $name done ==="
}

$ckPdf = "sources\national\se-47-2026--sdm_download--id-10903.pdf"

Run-PhaseLink "SDA Lampiran IV" $sdaPdf "output\sda-se-47-2026" "sda"
Run-PhaseLink "Bina Marga Lampiran V" $bmPdf "output\bina-marga-lampiran-v" "formular"
Run-PhaseLink "Cipta Karya Lampiran VI" $ckPdf "output\cipta-karya-se-47-2026" "ck-inline"

Log "All phases complete."
