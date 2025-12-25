# Mise a jour du driver Ethernet via Windows Update
Write-Host "=== MISE A JOUR DRIVER REALTEK ===" -ForegroundColor Cyan

# Methode 1 : Forcer Windows a chercher un driver mis a jour
Write-Host "`n[1] Recherche via Windows Update..." -ForegroundColor Yellow

$adapter = Get-PnpDevice | Where-Object { $_.FriendlyName -like "*Realtek*2.5*" }
if ($adapter) {
    Write-Host "    Peripherique trouve: $($adapter.FriendlyName)" -ForegroundColor Gray
    Write-Host "    Instance ID: $($adapter.InstanceId)" -ForegroundColor Gray

    # Tenter la mise a jour via pnputil
    Write-Host "`n[2] Tentative de mise a jour via pnputil..." -ForegroundColor Yellow
    $result = pnputil /update-driver "$($adapter.InstanceId)" /force 2>&1
    Write-Host $result
} else {
    Write-Host "    Peripherique non trouve" -ForegroundColor Red
}

# Methode 2 : Verifier le catalogue de drivers Windows
Write-Host "`n[3] Verification des drivers disponibles..." -ForegroundColor Yellow
$driverClass = Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*Realtek*2.5*" }
if ($driverClass) {
    Write-Host "    Driver actuel: $($driverClass.DriverVersion)" -ForegroundColor Gray
    Write-Host "    Date: $($driverClass.DriverDate.Substring(0,8))" -ForegroundColor Gray
}

Write-Host "`n[4] Alternative - Gestionnaire de peripheriques:" -ForegroundColor Yellow
Write-Host "    1. Win+X -> Gestionnaire de peripheriques" -ForegroundColor Gray
Write-Host "    2. Cartes reseau -> Realtek Gaming 2.5GbE" -ForegroundColor Gray
Write-Host "    3. Clic droit -> Mettre a jour le pilote" -ForegroundColor Gray
Write-Host "    4. Rechercher automatiquement" -ForegroundColor Gray

Write-Host "`n=== FIN ===" -ForegroundColor Cyan
