# Install Scheduled Task for Ethernet Fix
# REQUIRES ADMIN RIGHTS - Run as admin_user_zema
# GeoBrain - December 2025

$ErrorActionPreference = "Stop"

$TaskName = "GeoBrain_Ethernet_Fix"
$ScriptPath = "$env:USERPROFILE\GeoBrain\scripts\fix_ethernet_startup.ps1"

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: This script requires Administrator privileges!" -ForegroundColor Red
    Write-Host "Run with: Shift+Right-click > Run as different user > admin_user_zema" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== INSTALLING ETHERNET FIX SCHEDULED TASK ===" -ForegroundColor Cyan

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removing existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create the action - run PowerShell script
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# Create triggers:
# 1. At system startup (60 second delay for drivers to fully load)
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerStartup.Delay = "PT60S"  # 60 second delay (increased from 30)

# 2. At user logon (backup trigger, 10 second delay)
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerLogon.Delay = "PT10S"

# Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Principal - run as SYSTEM with highest privileges for registry access
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register the task
Write-Host "Creating scheduled task: $TaskName" -ForegroundColor Green
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggerStartup, $triggerLogon -Settings $settings -Principal $principal -Description "Fix Realtek Ethernet adapter at startup - GeoBrain"

# Verify
$task = Get-ScheduledTask -TaskName $TaskName
if ($task) {
    Write-Host "`nTask created successfully!" -ForegroundColor Green
    Write-Host "Task Name: $TaskName"
    Write-Host "Status: $($task.State)"
    Write-Host "`nTriggers:"
    Write-Host "  - At system startup (30 sec delay)"
    Write-Host "  - At user logon ($env:USERNAME)"
    Write-Host "`nScript: $ScriptPath"
    Write-Host "`nLogs will be written to: $env:USERPROFILE\GeoBrain\logs\ethernet_fix.log"
} else {
    Write-Host "ERROR: Task creation failed!" -ForegroundColor Red
    exit 1
}

# Run the fix now to test
Write-Host "`n=== RUNNING FIX NOW ===" -ForegroundColor Cyan
& powershell.exe -ExecutionPolicy Bypass -File $ScriptPath

Write-Host "`n=== INSTALLATION COMPLETE ===" -ForegroundColor Green
Write-Host "The fix will run automatically at each startup and logon."
