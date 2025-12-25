# Script de diagnostic et correction Ethernet
# GeoBrain - Decembre 2025

Write-Host "=== DIAGNOSTIC ETHERNET ===" -ForegroundColor Cyan

# 1. Infos adaptateur
Write-Host "`n[1] Informations adaptateur:" -ForegroundColor Yellow
Get-NetAdapter -Name "Ethernet" | Format-List Name, InterfaceDescription, Status, LinkSpeed, MacAddress

# 2. Proprietes avancees liees a l'alimentation
Write-Host "`n[2] Proprietes avancees (Power/Wake/Energy):" -ForegroundColor Yellow
$props = Get-NetAdapterAdvancedProperty -Name "Ethernet" | Where-Object {
    $_.DisplayName -like "*Power*" -or
    $_.DisplayName -like "*Wake*" -or
    $_.DisplayName -like "*Energy*" -or
    $_.DisplayName -like "*Green*" -or
    $_.DisplayName -like "*EEE*"
}
if ($props) {
    $props | Format-Table DisplayName, DisplayValue, ValidDisplayValues -AutoSize
} else {
    Write-Host "Aucune propriete Power/Wake trouvee" -ForegroundColor Gray
}

# 3. Fast Startup status
Write-Host "`n[3] Fast Startup (Demarrage rapide):" -ForegroundColor Yellow
$fastStartup = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power").HiberbootEnabled
if ($fastStartup -eq 1) {
    Write-Host "ACTIVE (HiberbootEnabled = 1) - PROBLEME POTENTIEL" -ForegroundColor Red
} else {
    Write-Host "Desactive (OK)" -ForegroundColor Green
}

# 4. Toutes les proprietes avancees
Write-Host "`n[4] Toutes les proprietes avancees Realtek:" -ForegroundColor Yellow
Get-NetAdapterAdvancedProperty -Name "Ethernet" | Format-Table DisplayName, DisplayValue -AutoSize

Write-Host "`n=== FIN DIAGNOSTIC ===" -ForegroundColor Cyan
