# Manual-tunnel mode. Bypasses Expo SDK 50's broken built-in --tunnel.
#
# One-time setup:
#   1) ngrok config add-authtoken YOUR_TOKEN
#      (get token at https://dashboard.ngrok.com/get-started/your-authtoken)
#      Note: the bundled ngrok.exe in node_modules reads the same config
#      file as the system one, so this only has to be done once.

# Prefer the bundled ngrok.exe (a real Win32 binary) over the global npm
# wrapper (which is a .js shim that Start-Process cannot launch).
$bundled = Join-Path $PSScriptRoot "node_modules\@expo\ngrok-bin-win32-x64\ngrok.exe"
if (Test-Path $bundled) {
    $ngrok = $bundled
} else {
    $cmd = Get-Command ngrok.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $ngrok = $cmd.Source
    } else {
        Write-Host "ERROR: cannot find ngrok.exe." -ForegroundColor Red
        Write-Host "  Tried: $bundled"
        Write-Host "  And:   no ngrok.exe on PATH"
        Write-Host ""
        Write-Host "Fix: install ngrok the native way (NOT via npm):"
        Write-Host "  winget install ngrok.ngrok"
        Write-Host "  - or download from https://ngrok.com/download"
        exit 1
    }
}

Write-Host "Using ngrok binary: $ngrok" -ForegroundColor Cyan

npx kill-port 8081 2>$null

Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$logOut = Join-Path $PSScriptRoot ".ngrok-out.log"
$logErr = Join-Path $PSScriptRoot ".ngrok-err.log"
Remove-Item $logOut, $logErr -ErrorAction SilentlyContinue

Write-Host "Starting ngrok (port 8081)..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $ngrok `
    -ArgumentList "http", "8081", "--log=stdout" `
    -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr `
    -WindowStyle Hidden `
    -PassThru

$publicUrl = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { break }
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2 -ErrorAction Stop
        $httpsTunnel = $resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if ($httpsTunnel -and $httpsTunnel.public_url) {
            $publicUrl = $httpsTunnel.public_url
            break
        }
    } catch {}
}

if (-not $publicUrl) {
    Write-Host ""
    Write-Host "ERROR: ngrok did not expose a tunnel within ~20s." -ForegroundColor Red
    Write-Host ""

    if ($proc.HasExited) {
        Write-Host "ngrok process exited (code $($proc.ExitCode))." -ForegroundColor Yellow
    } else {
        Write-Host "ngrok still running but no tunnel registered. Killing it." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "--- ngrok stdout ($logOut) ---" -ForegroundColor Cyan
    if (Test-Path $logOut) { Get-Content $logOut | Select-Object -First 40 } else { Write-Host "(empty)" }
    Write-Host ""
    Write-Host "--- ngrok stderr ($logErr) ---" -ForegroundColor Cyan
    if (Test-Path $logErr) { Get-Content $logErr | Select-Object -First 40 } else { Write-Host "(empty)" }
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Cyan
    Write-Host "  1) Run: & '$ngrok' config check     (is authtoken saved?)"
    Write-Host "  2) Run: & '$ngrok' config add-authtoken YOUR_TOKEN"
    Write-Host "  3) Free plan = one tunnel at a time. Close any other ngrok session."
    exit 1
}

$ngrokHost = $publicUrl -replace "^https://", ""
$expUrl = "exp://$ngrokHost"

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "  Public tunnel URL:" -ForegroundColor Green
Write-Host "     $publicUrl" -ForegroundColor Yellow
Write-Host "  Expo Go URL (Enter URL manually in Expo Go):" -ForegroundColor Green
Write-Host "     $expUrl" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Generating QR code for Expo Go..." -ForegroundColor Cyan
Write-Host ""

npx --yes qrcode-terminal $expUrl --small

Write-Host ""
Write-Host "Scan the QR above with Expo Go (or paste the URL manually)." -ForegroundColor Green
Write-Host "Starting Metro now..." -ForegroundColor Cyan
Write-Host ""

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ngrokHost
npx expo start --clear
