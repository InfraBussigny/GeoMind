# Recherche de mises a jour de drivers via Windows Update
Write-Host "=== RECHERCHE MISES A JOUR DRIVERS ===" -ForegroundColor Cyan

# Methode 1 : Via WMI - drivers installes vs disponibles
Write-Host "`n[1] Driver Ethernet actuel:" -ForegroundColor Yellow
$adapter = Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*Realtek*2.5*" }
if ($adapter) {
    Write-Host "    Nom: $($adapter.DeviceName)"
    Write-Host "    Version: $($adapter.DriverVersion)"
    Write-Host "    Date: $($adapter.DriverDate)"
    Write-Host "    Infname: $($adapter.InfName)"
}

# Methode 2 : Verifier si une MAJ est en attente
Write-Host "`n[2] Verification Windows Update..." -ForegroundColor Yellow
$UpdateSession = New-Object -ComObject Microsoft.Update.Session
$UpdateSearcher = $UpdateSession.CreateUpdateSearcher()

try {
    # Recherche des mises a jour de drivers
    $SearchResult = $UpdateSearcher.Search("IsInstalled=0 and Type='Driver'")

    if ($SearchResult.Updates.Count -gt 0) {
        Write-Host "    Mises a jour de drivers disponibles:" -ForegroundColor Green
        foreach ($Update in $SearchResult.Updates) {
            $title = $Update.Title
            if ($title -like "*Realtek*" -or $title -like "*Network*" -or $title -like "*Ethernet*") {
                Write-Host "    -> $title" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "    Aucune mise a jour de driver en attente via Windows Update" -ForegroundColor Gray
    }
} catch {
    Write-Host "    Erreur lors de la recherche: $_" -ForegroundColor Red
}

# Info sur le dernier driver Realtek
Write-Host "`n[3] Info Realtek:" -ForegroundColor Yellow
Write-Host "    Site officiel: https://www.realtek.com/Download/Index" -ForegroundColor Gray
Write-Host "    Produit: RTL8125 / 2.5GbE Gaming Ethernet" -ForegroundColor Gray
