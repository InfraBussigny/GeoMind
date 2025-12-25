# Disable power management for Ethernet adapter
# GeoBrain - December 2025

Write-Host "=== DISABLE ETHERNET POWER MANAGEMENT ===" -ForegroundColor Cyan

# Find the Realtek adapter
$device = Get-PnpDevice -FriendlyName '*Realtek*2.5*'
if (-not $device) {
    Write-Host "Realtek adapter not found!" -ForegroundColor Red
    exit 1
}

$instanceId = $device.InstanceId
Write-Host "Device: $instanceId" -ForegroundColor Green

# The PnPCapabilities value controls power management
# 0 = Power management enabled (default)
# 24 (0x18) = Power management disabled
# 16 (0x10) = Disable "Allow the computer to turn off this device"

$regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters"
Write-Host "Registry path: $regPath"

if (Test-Path $regPath) {
    # Get current value
    $current = Get-ItemProperty -Path $regPath -Name "PnPCapabilities" -ErrorAction SilentlyContinue
    if ($current) {
        Write-Host "Current PnPCapabilities: $($current.PnPCapabilities)" -ForegroundColor Yellow
    } else {
        Write-Host "PnPCapabilities not set (default 0)" -ForegroundColor Yellow
    }

    # Set to 24 to disable power management
    Set-ItemProperty -Path $regPath -Name "PnPCapabilities" -Value 24 -Type DWord
    Write-Host "PnPCapabilities set to 24 (power management disabled)" -ForegroundColor Green
} else {
    Write-Host "Creating registry path..." -ForegroundColor Yellow
    New-Item -Path $regPath -Force | Out-Null
    Set-ItemProperty -Path $regPath -Name "PnPCapabilities" -Value 24 -Type DWord
    Write-Host "PnPCapabilities set to 24" -ForegroundColor Green
}

Write-Host "`nReboot required for changes to take effect." -ForegroundColor Cyan
