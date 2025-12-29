# Fix Ethernet at Startup - Robust solution v3
# GeoBrain - December 2025
# Problem: Realtek Gaming 2.5GbE disconnects on Windows boot
# Solution: Force restart adapter at boot if not Up

$ErrorActionPreference = "Continue"
$LogFile = "$env:USERPROFILE\GeoBrain\logs\ethernet_fix.log"
$AdapterName = "Ethernet"
$MaxRetries = 3

# Create logs directory if not exists
$LogDir = Split-Path $LogFile -Parent
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logEntry
    Write-Host $logEntry
}

function Get-AdapterStatus {
    $a = Get-NetAdapter -Name $AdapterName -ErrorAction SilentlyContinue
    if ($a) { return $a.Status } else { return "NotFound" }
}

Write-Log "========== ETHERNET FIX v3 STARTED =========="

# Step 1: Check current status
$status = Get-AdapterStatus
Write-Log "Initial status: $status"

# Step 2: If not Up, force enable
if ($status -ne "Up") {
    Write-Log "Adapter not Up - initiating recovery..."

    for ($i = 1; $i -le $MaxRetries; $i++) {
        Write-Log "Attempt $i of $MaxRetries..."

        # Full cycle: Disable then Enable
        try {
            Disable-NetAdapter -Name $AdapterName -Confirm:$false -ErrorAction SilentlyContinue
            Write-Log "  Disabled adapter"
            Start-Sleep -Seconds 2
        } catch {
            Write-Log "  Warning: Disable failed (may already be disabled)"
        }

        try {
            Enable-NetAdapter -Name $AdapterName -Confirm:$false -ErrorAction Stop
            Write-Log "  Enabled adapter"
            Start-Sleep -Seconds 5
        } catch {
            Write-Log "  ERROR: Enable failed - $($_.Exception.Message)"
            continue
        }

        $status = Get-AdapterStatus
        Write-Log "  Status after enable: $status"

        if ($status -eq "Up") {
            Write-Log "SUCCESS: Adapter is Up!"
            break
        }
    }
} else {
    Write-Log "Adapter already Up - no action needed"
}

# Step 3: Final verification
$finalStatus = Get-AdapterStatus
$adapter = Get-NetAdapter -Name $AdapterName -ErrorAction SilentlyContinue

Write-Log "========== FINAL STATUS =========="
Write-Log "Status: $finalStatus"
if ($adapter) {
    Write-Log "Link Speed: $($adapter.LinkSpeed)"
    Write-Log "MAC: $($adapter.MacAddress)"
}

if ($finalStatus -ne "Up") {
    Write-Log "CRITICAL: Adapter still not Up after $MaxRetries attempts!"
    exit 1
}

Write-Log "========== ETHERNET FIX COMPLETED =========="
exit 0
