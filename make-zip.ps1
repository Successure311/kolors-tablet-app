# Builds kolors-web.zip — the file you drop on Netlify.
#
# Written by hand rather than with Compress-Archive: that cmdlet stores folder
# paths with backslashes ("icons\icon-192.png"), which the ZIP spec forbids.
# Netlify then serves them as files literally named "icons\icon-192.png", so
# /icons/icon-192.png comes back 404 and the home-screen icon breaks.

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$zipPath = Join-Path $root "kolors-web.zip"

# Only the app itself. The notes in this folder (README.txt,
# ANDROID_APP_STEPS.txt, APPS_SCRIPT.gs, the .bat files) stay out: anything
# published is downloadable by anyone with the link, and they name the admin
# password.
$files = @(
    "index.html",
    "style.css",
    "i18n.js",
    "app.js",
    "sheet.js",
    "sw.js",
    "manifest.json",
    "kolors.png",
    "vendor/xlsx.mini.min.js",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png"
)

$missing = $files | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
    Write-Host "  MISSING: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, "Create")
try {
    foreach ($f in $files) {
        # $f already uses "/" — pass it through as the entry name verbatim.
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, (Join-Path $root $f), $f) | Out-Null
    }
} finally {
    $zip.Dispose()
}

Write-Host ""
Write-Host "  Created: $zipPath" -ForegroundColor Green
Write-Host ("  {0} files, {1:N0} KB" -f $files.Count, ((Get-Item $zipPath).Length / 1KB))
Write-Host ""
Write-Host "  Drag that file onto your Netlify project's Deploys page."
Write-Host ""
