# Loads the game with ?attack=N, plays into the dodge phase, screenshots twice.
param([int]$n = 0, [int]$waitA = 2500, [int]$waitB = 3500)
$pw = "npx --yes --package @playwright/cli playwright-cli"
Invoke-Expression "$pw open `"http://localhost:5199/?attack=$n`"" | Out-Null
Start-Sleep -m 1200
Invoke-Expression "$pw press z" | Out-Null   # intro -> menu
Start-Sleep -m 500
Invoke-Expression "$pw press z" | Out-Null   # FIGHT
Start-Sleep -m 400
Invoke-Expression "$pw press z" | Out-Null   # bar 1
Start-Sleep -m 400
Invoke-Expression "$pw press z" | Out-Null   # bar 2
Start-Sleep -m 400
Invoke-Expression "$pw press z" | Out-Null   # bar 3
Start-Sleep -m 900
Invoke-Expression "$pw press z" | Out-Null   # enemytext -> dodge
Start-Sleep -m $waitA
Invoke-Expression "$pw screenshot" | Out-Null
Start-Sleep -m $waitB
Invoke-Expression "$pw screenshot" | Out-Null
Get-ChildItem ".playwright-cli" -Filter *.png | Sort-Object LastWriteTime | Select-Object -Last 2 -ExpandProperty FullName
