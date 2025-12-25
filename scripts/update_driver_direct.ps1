# Mise a jour directe du driver Realtek
$logFile = "C:\Users\Marc\GeoBrain\driver_update_log.txt"

"=== MISE A JOUR DRIVER REALTEK ===" | Out-File $logFile
"Date: $(Get-Date)" | Out-File $logFile -Append

# Trouver le device
$device = Get-PnpDevice | Where-Object { $_.FriendlyName -like "*Realtek*2.5*" -and $_.Class -eq "Net" }

if ($device) {
    "Device trouve: $($device.FriendlyName)" | Out-File $logFile -Append
    "InstanceId: $($device.InstanceId)" | Out-File $logFile -Append

    # Utiliser DevCon ou PnPUtil pour update
    "Tentative pnputil scan-devices..." | Out-File $logFile -Append
    $scan = pnputil /scan-devices 2>&1
    $scan | Out-File $logFile -Append

    # Forcer Windows Update a chercher des drivers
    "Recherche Windows Update pour drivers..." | Out-File $logFile -Append
    try {
        # Utiliser l'API COM Windows Update
        $UpdateSession = New-Object -ComObject Microsoft.Update.Session
        $UpdateSearcher = $UpdateSession.CreateUpdateSearcher()
        $UpdateSearcher.Online = $true

        # Rechercher uniquement les drivers
        $SearchResult = $UpdateSearcher.Search("IsInstalled=0 and Type='Driver'")

        "Drivers disponibles: $($SearchResult.Updates.Count)" | Out-File $logFile -Append

        foreach ($Update in $SearchResult.Updates) {
            if ($Update.Title -like "*Realtek*" -or $Update.Title -like "*Network*") {
                "TROUVE: $($Update.Title)" | Out-File $logFile -Append

                # Installer le driver
                $Downloader = $UpdateSession.CreateUpdateDownloader()
                $Downloader.Updates = $SearchResult.Updates
                $DownloadResult = $Downloader.Download()

                $Installer = $UpdateSession.CreateUpdateInstaller()
                $Installer.Updates = $SearchResult.Updates
                $InstallResult = $Installer.Install()

                "Installation: $($InstallResult.ResultCode)" | Out-File $logFile -Append
            }
        }
    } catch {
        "Erreur Windows Update: $_" | Out-File $logFile -Append
    }
} else {
    "Device non trouve!" | Out-File $logFile -Append
}

# Verifier la version actuelle
$currentDriver = Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*Realtek*2.5*" }
"Version actuelle: $($currentDriver.DriverVersion)" | Out-File $logFile -Append

"=== FIN ===" | Out-File $logFile -Append
