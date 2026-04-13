#!/bin/bash
# Start Expo for mobile testing. Works on Mac, Windows (Git Bash), and WSL.
# Usage: ./dev-mobile.sh

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR/village"

# Detect WSL
if grep -qi microsoft /proc/version 2>/dev/null; then
  echo "Detected WSL — setting up port forwarding..."

  # Get the Windows machine's WiFi/LAN IP (the IP your phone can reach)
  WINDOWS_IP=$(powershell.exe -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback' -and \$_.IPAddress -notlike '169.*' -and \$_.IPAddress -notlike '127.*' -and \$_.IPAddress -notlike '172.*' } | Select-Object -First 1 -ExpandProperty IPAddress" | tr -d '\r\n')
  echo "Windows host IP: $WINDOWS_IP"

  # Refresh port forwarding (requires setup-port-forward.ps1 to have been run once)
  echo "Refreshing WSL port forwarding..."
  powershell.exe -Command "Start-ScheduledTask -TaskName 'WSL2 Village Port Forward'" 2>/dev/null
  sleep 1

  # Tell Expo to advertise the Windows IP so the phone QR code works
  echo "Starting Expo (LAN mode via port forwarding)..."
  REACT_NATIVE_PACKAGER_HOSTNAME=$WINDOWS_IP npx expo start
else
  # Mac or native Windows (Git Bash) — LAN mode just works
  echo "Starting Expo..."
  npx expo start
fi
