# Script de correction Ethernet - Probleme au demarrage
# GeoBrain - Decembre 2025
# Resout le probleme "pas d'internet au boot"

Write-Host "=== CORRECTION ETHERNET ===" -ForegroundColor Cyan
Write-Host "Adaptateur: Realtek Gaming 2.5GbE" -ForegroundColor Gray

$errors = @()

# 1. Desactiver Power Saving Mode
Write-Host "`n[1] Desactivation Power Saving Mode..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Power Saving Mode" -DisplayValue "Desactive" -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    # Essayer avec le nom anglais
    try {
        Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Power Saving Mode" -DisplayValue "Disabled" -ErrorAction Stop
        Write-Host "    OK (English)" -ForegroundColor Green
    } catch {
        Write-Host "    ERREUR: $_" -ForegroundColor Red
        $errors += "Power Saving Mode"
    }
}

# 2. Desactiver Ethernet vert (Green Ethernet)
Write-Host "`n[2] Desactivation Ethernet vert..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Ethernet vert" -DisplayValue "Desactive" -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    try {
        Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Green Ethernet" -DisplayValue "Disabled" -ErrorAction Stop
        Write-Host "    OK (English)" -ForegroundColor Green
    } catch {
        Write-Host "    ERREUR: $_" -ForegroundColor Red
        $errors += "Ethernet vert"
    }
}

# 3. Desactiver Gigabit Lite
Write-Host "`n[3] Desactivation Gigabit Lite..." -ForegroundColor Yellow
try {
    Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Gigabit Lite" -DisplayValue "Desactive" -ErrorAction Stop
    Write-Host "    OK" -ForegroundColor Green
} catch {
    try {
        Set-NetAdapterAdvancedProperty -Name "Ethernet" -DisplayName "Gigabit Lite" -DisplayValue "Disabled" -ErrorAction Stop
        Write-Host "    OK (English)" -ForegroundColor Green
    } catch {
        Write-Host "    ERREUR: $_" -ForegroundColor Red
        $errors += "Gigabit Lite"
    }
}

# 4. Desactiver Fast Startup (necessite admin)
Write-Host "`n[4] Desactivation Fast Startup..." -ForegroundColor Yellow
try {
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name "HiberbootEnabled" -Value 0 -ErrorAction Stop
    Write-Host "    OK - Fast Startup desactive" -ForegroundColor Green
} catch {
    Write-Host "    ERREUR (droits admin requis): $_" -ForegroundColor Red
    $errors += "Fast Startup"
}

# 5. Verification
Write-Host "`n=== VERIFICATION ===" -ForegroundColor Cyan

$props = Get-NetAdapterAdvancedProperty -Name "Ethernet" | Where-Object {
    $_.DisplayName -in @("Power Saving Mode", "Ethernet vert", "Green Ethernet", "Gigabit Lite")
}
$props | Format-Table DisplayName, DisplayValue -AutoSize

$fastStartup = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power").HiberbootEnabled
Write-Host "Fast Startup: $(if($fastStartup -eq 0){'Desactive (OK)'}else{'Encore actif'})" -ForegroundColor $(if($fastStartup -eq 0){'Green'}else{'Red'})

# Resume
Write-Host "`n=== RESUME ===" -ForegroundColor Cyan
if ($errors.Count -eq 0) {
    Write-Host "Toutes les corrections appliquees avec succes!" -ForegroundColor Green
    Write-Host "REDEMARREZ l'ordinateur pour appliquer les changements." -ForegroundColor Yellow
} else {
    Write-Host "Corrections echouees: $($errors -join ', ')" -ForegroundColor Red
    Write-Host "Ces options peuvent necessiter des droits administrateur." -ForegroundColor Yellow
}
