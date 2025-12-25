# Verification rapide des parametres Ethernet
Get-NetAdapterAdvancedProperty -Name "Ethernet" | Where-Object {
    $_.RegistryKeyword -in @("PowerSavingMode", "EnableGreenEthernet", "GigaLite")
} | Format-Table DisplayName, RegistryKeyword, RegistryValue -AutoSize

# Fast Startup
$fs = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power").HiberbootEnabled
Write-Host "`nFast Startup: $(if($fs -eq 0){'DESACTIVE (OK)'}else{'ACTIVE'})" -ForegroundColor $(if($fs -eq 0){'Green'}else{'Red'})
