# Run this ONCE in PowerShell as Administrator to register a scheduled task
# that automatically sets up WSL port forwarding on every login.

$TaskName = "WSL2 Village Port Forward"

# The action: detect WSL IP and set up port forwarding
$ScriptBlock = @'
$WSL_IP = (wsl hostname -I).Trim().Split(" ")[0]
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=0.0.0.0 2>$null
netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0 2>$null
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=$WSL_IP
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$WSL_IP
netsh advfirewall firewall delete rule name="WSL2 Village" 2>$null
netsh advfirewall firewall add rule name="WSL2 Village" dir=in action=allow protocol=TCP localport=3000,8081
'@

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -Command `"$ScriptBlock`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force

# Run it immediately so it takes effect right now too
Start-ScheduledTask -TaskName $TaskName

Write-Host "Done. Port forwarding will now run automatically on every login."
