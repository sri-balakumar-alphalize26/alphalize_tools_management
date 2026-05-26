# Tunnel mode for testing from a phone on a different network than the
# dev machine. One-time setup required on this machine:
#   1) npm install -g ngrok
#   2) Sign up free at https://dashboard.ngrok.com/signup
#   3) ngrok config add-authtoken YOUR_TOKEN
#
# Why we need the system ngrok: Expo SDK 50 ships ngrok v3 binary but
# @expo/cli still writes ngrok v2 config (top-level authtoken / port),
# which v3 rejects with an HTTPv2Tunnel unmarshal error. Pointing Expo
# at the system ngrok via EXPO_NGROK_PATH bypasses its broken config
# writer and uses the v3 binary you've pre-authenticated.

npx kill-port 8081 2>$null
Remove-Item Env:\REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue

$ngrok = (Get-Command ngrok -ErrorAction SilentlyContinue).Source
if ($ngrok) {
    Write-Host "Using system ngrok at: $ngrok"
    $env:EXPO_NGROK_PATH = $ngrok
} else {
    Write-Host "WARNING: no system ngrok found."
    Write-Host "  Install:  npm install -g ngrok"
    Write-Host "  Auth:     ngrok config add-authtoken YOUR_TOKEN"
    Write-Host "  (get token at https://dashboard.ngrok.com/get-started/your-authtoken)"
    Write-Host "Falling back to bundled ngrok (will likely hit the v3 schema bug)."
}

npx expo start --tunnel --clear
