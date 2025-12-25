# Accept Android SDK licenses
$sdkmanager = "C:\Users\Marc\AppData\Local\Android\sdk\cmdline-tools\latest\bin\sdkmanager.bat"
$process = Start-Process -FilePath $sdkmanager -ArgumentList "--licenses" -RedirectStandardInput "C:\Users\Marc\GeoBrain\scripts\yes_input.txt" -NoNewWindow -Wait -PassThru
Write-Host "Exit code: $($process.ExitCode)"
