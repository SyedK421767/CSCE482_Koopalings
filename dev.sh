#!/bin/bash
# Run this script to start the full dev environment.
# Usage: ./dev.sh
#
# One-time setup required on each machine:
#   Open PowerShell as Administrator and run: .\setup-port-forward.ps1
#   This registers a scheduled task that handles WSL port forwarding automatically on login.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Get the Windows machine's actual WiFi/LAN IP (the IP your phone can reach)
WINDOWS_IP=$(powershell.exe -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback' -and \$_.IPAddress -notlike '169.*' -and \$_.IPAddress -notlike '127.*' -and \$_.IPAddress -notlike '172.*' } | Select-Object -First 1 -ExpandProperty IPAddress" | tr -d '\r\n')
echo "Windows host IP: $WINDOWS_IP"

echo "Refreshing WSL port forwarding..."
powershell.exe -Command "Start-ScheduledTask -TaskName 'WSL2 Village Port Forward'" 2>/dev/null
sleep 1

# Kill anything already on port 3000
fuser -k 3000/tcp 2>/dev/null

echo "Starting backend..."
cd "$REPO_DIR/village-backend"
npm run dev &
BACKEND_PID=$!

echo "Starting Expo..."
cd "$REPO_DIR/village"
# Tell Expo to advertise the Windows IP so the phone QR code works through port forwarding
REACT_NATIVE_PACKAGER_HOSTNAME=$WINDOWS_IP npx expo start

# When you ctrl+c expo, also stop the backend
kill $BACKEND_PID 2>/dev/null
