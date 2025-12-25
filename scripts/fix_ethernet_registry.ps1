# Script de correction Ethernet via Registry Keywords
# GeoBrain - Decembre 2025

Write-Host "=== CORRECTION ETHERNET (Registry) ===" -ForegroundColor Cyan

# 1. Power Saving Mode (1 = Active, 0 = Desactive)
Write-Host "`n[1] PowerSavingMode -> 0..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -RegistryKeyword "PowerSavingMode" -RegistryValue 0 -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# 2. Green Ethernet (EnableGreenEthernet)
Write-Host "`n[2] EnableGreenEthernet -> 0..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -RegistryKeyword "EnableGreenEthernet" -RegistryValue 0 -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# 3. Gigabit Lite (GigaLite)
Write-Host "`n[3] GigaLite -> 0..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -RegistryKeyword "GigaLite" -RegistryValue 0 -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# Verification
Write-Host "`n=== VERIFICATION ===" -ForegroundColor Cyan
Get-NetAdapterAdvancedProperty -Name "Ethernet" | Where-Object {
    $_.RegistryKeyword -in @("PowerSavingMode", "EnableGreenEthernet", "GigaLite")
} | Format-Table DisplayName, RegistryKeyword, RegistryValue -AutoSize

Write-Host "`nSi RegistryValue = 0 pour tous -> OK" -ForegroundColor Yellow
Write-Host "REDEMARREZ l'ordinateur pour appliquer les changements." -ForegroundColor Cyan
