# One-shot setup. Downloads ngrok v2 binary and replaces the v3 binary
# that Expo SDK 50 bundles, so that `npx expo start --tunnel --clear`
# works. Expo CLI writes v2-style ngrok config, which v3 binaries reject
# with the "HTTPv2Tunnel unmarshal" error.
#
# Safe to re-run: it backs up the current binary first.
#
# Run from project root:
#   .\fix-ngrok.ps1

$bin = Join-Path $PSScriptRoot "node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
if (-not (Test-Path $bin)) {
    Write-Host "ERROR: $bin not found." -ForegroundColor Red
    Write-Host "Run 'yarn install' or 'npm install' first to ensure the bundled binary exists."
    exit 1
}

# Backup existing v3 binary (only on first run).
$backup = "$bin.v3.bak"
if (-not (Test-Path $backup)) {
    Write-Host "Backing up current ngrok.exe to ngrok.exe.v3.bak ..." -ForegroundColor Cyan
    Copy-Item $bin $backup
} else {
    Write-Host "Backup already exists at $backup (skipping)." -ForegroundColor Cyan
}

# ngrok v2 stable archive URL (official, hosted by ngrok's Equinox CDN).
$url = "https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-windows-amd64.zip"
$tmpZip = Join-Path $env:TEMP "ngrok-v2.zip"
$tmpExtract = Join-Path $env:TEMP "ngrok-v2-extract"

Write-Host "Downloading ngrok v2 from $url ..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing
} catch {
    Write-Host "ERROR: download failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Extracting ..." -ForegroundColor Cyan
Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

$srcExe = Join-Path $tmpExtract "ngrok.exe"
if (-not (Test-Path $srcExe)) {
    Write-Host "ERROR: extracted archive doesn't contain ngrok.exe." -ForegroundColor Red
    exit 1
}

# Kill any running ngrok before overwrite so we don't get a file-in-use error.
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Write-Host "Replacing bundled ngrok.exe with v2 ..." -ForegroundColor Cyan
Copy-Item -Force $srcExe $bin

# Verify
$ver = & $bin --version 2>&1
Write-Host ""
Write-Host "Bundled ngrok is now: $ver" -ForegroundColor Green

# Set authtoken on the v2 binary's config (it uses a different config file
# than v3). Prompt user only if not yet set.
$v2Cfg = Join-Path $env:USERPROFILE ".ngrok2\ngrok.yml"
if (-not (Test-Path $v2Cfg)) {
    Write-Host ""
    Write-Host "ngrok v2 needs its authtoken saved to its own config file." -ForegroundColor Yellow
    Write-Host "  Get a token at https://dashboard.ngrok.com/get-started/your-authtoken"
    Write-Host "  Then run:"
    Write-Host "     & '$bin' authtoken YOUR_TOKEN" -ForegroundColor Cyan
} else {
    Write-Host "ngrok v2 config already exists at: $v2Cfg" -ForegroundColor Green
}

Write-Host ""
Write-Host "Cleanup ..." -ForegroundColor Cyan
Remove-Item $tmpZip -Force -ErrorAction SilentlyContinue
Remove-Item $tmpExtract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Now you can run:" -ForegroundColor Green
Write-Host "   npx expo start --tunnel --clear" -ForegroundColor Yellow
Write-Host "It should produce a working tunnel + QR with no HTTPv2Tunnel error."
