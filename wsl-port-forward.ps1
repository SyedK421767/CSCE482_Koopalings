# Run this in PowerShell as Administrator after each WSL restart.
# Automatically detects your current WSL IP.

$WSL_IP = (wsl hostname -I).Trim().Split(" ")[0]
Write-Host "Detected WSL IP: $WSL_IP"

netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$WSL_IP
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$WSL_IP
netsh advfirewall firewall add rule name="WSL2 Backend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="WSL2 Expo" dir=in action=allow protocol=TCP localport=8081

Write-Host "Done. Port forwarding set up for WSL IP: $WSL_IP"
