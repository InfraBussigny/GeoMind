# Installation Montserrat-Light et Outfit-Light

$destDir = 'C:\Users\zema\AppData\Roaming\GIMP\2.10\fonts'

# Montserrat Light (300 = Light)
Write-Host "Telechargement Montserrat-Light..." -NoNewline
try {
    Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-300-normal.ttf' -OutFile "$destDir\Montserrat-Light.ttf" -UseBasicParsing
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " ERREUR: $_" -ForegroundColor Red
}

# Outfit Light (300 = Light)
Write-Host "Telechargement Outfit-Light..." -NoNewline
try {
    Invoke-WebRequest -Uri 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-300-normal.ttf' -OutFile "$destDir\Outfit-Light.ttf" -UseBasicParsing
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " ERREUR: $_" -ForegroundColor Red
}

# Verification
Write-Host "`n=== Polices Light/Medium installees ===" -ForegroundColor Cyan
Get-ChildItem $destDir | Where-Object { $_.Name -match 'Light|Medium' } | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 1)
    Write-Host "  - $($_.Name) ($size KB)"
}
