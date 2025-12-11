# Redemarrage du backend GeoBrain

# Trouver le PID sur le port 3001
$netstat = netstat -ano | findstr ":3001.*LISTENING"
if ($netstat) {
    $processPid = ($netstat -split '\s+')[-1]
    Write-Host "Arret du processus PID $processPid..." -NoNewline
    Stop-Process -Id $processPid -Force -ErrorAction SilentlyContinue
    Write-Host " OK" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Demarrer le nouveau serveur
Write-Host "Demarrage du backend..."
Set-Location "C:\Users\zema\GeoBrain\geobrain-app\server"
Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden

Start-Sleep -Seconds 5

# Verification
$check = netstat -ano | findstr ":3001.*LISTENING"
if ($check) {
    Write-Host "Backend demarre avec succes!" -ForegroundColor Green
} else {
    Write-Host "Echec du demarrage" -ForegroundColor Red
}
