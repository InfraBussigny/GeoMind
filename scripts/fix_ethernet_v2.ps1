# Script de correction Ethernet v2 - Noms francais
# GeoBrain - Decembre 2025

Write-Host "=== CORRECTION ETHERNET v2 ===" -ForegroundColor Cyan

# 1. Power Saving Mode
Write-Host "`n[1] Power Saving Mode..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Power Saving Mode" -DisplayValue "Désactivé" -ErrorAction Stop
    Write-Host "    OK - Desactive" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# 2. Ethernet vert
Write-Host "`n[2] Ethernet vert..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Ethernet vert" -DisplayValue "Désactivé" -ErrorAction Stop
    Write-Host "    OK - Desactive" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# 3. Gigabit Lite
Write-Host "`n[3] Gigabit Lite..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Gigabit Lite" -DisplayValue "Désactivé" -ErrorAction Stop
    Write-Host "    OK - Desactive" -ForegroundColor Green
} catch {
    Write-Host "    Erreur: $_" -ForegroundColor Red
}

# Verification
Write-Host "`n=== VERIFICATION ===" -ForegroundColor Cyan
Get-NetAdapterAdvancedProperty -Name "Ethernet" | Where-Object {
    $_.DisplayName -in @("Power Saving Mode", "Ethernet vert", "Gigabit Lite")
} | Format-Table DisplayName, DisplayValue -AutoSize

Write-Host "`nRedemarrez pour appliquer tous les changements." -ForegroundColor Yellow
