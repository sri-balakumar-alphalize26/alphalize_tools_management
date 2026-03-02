npx kill-port 8081 2>$null
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.29.78"
npx expo start --clear
