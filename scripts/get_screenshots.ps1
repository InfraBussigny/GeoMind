# Get recent screenshots and copy to temp folder
param(
    [int]$Count = 1,
    [switch]$Copy
)

$folder = "C:\Users\zema\OneDrive - bussigny.ch\Images"
$tempFolder = "C:\Users\zema\GeoBrain\temp"
$subfolder = Get-ChildItem $folder -Directory | Where-Object { $_.Name -like "Captures*" } | Select-Object -First 1

if (-not (Test-Path $tempFolder)) {
    New-Item -ItemType Directory -Path $tempFolder -Force | Out-Null
} elseif ($Copy) {
    # Nettoyer les anciens screenshots avant copie
    Get-ChildItem $tempFolder -Filter "screenshot_*.png" | Remove-Item -Force
}

if ($subfolder) {
    $files = Get-ChildItem $subfolder.FullName -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First $Count

    $i = 1
    foreach ($file in $files) {
        if ($Copy) {
            $destPath = Join-Path $tempFolder "screenshot_$i.png"
            Copy-Item $file.FullName -Destination $destPath -Force
            Write-Output $destPath
        } else {
            Write-Output $file.FullName
        }
        $i++
    }
}
