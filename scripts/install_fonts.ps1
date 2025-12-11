# Installation polices supplementaires pour GIMP

$fonts = @(
    @{name='Poppins-Light'; url='https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Light.ttf'},
    @{name='Poppins-Medium'; url='https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Medium.ttf'},
    @{name='Montserrat-Light'; url='https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Light.ttf'},
    @{name='Outfit-Light'; url='https://github.com/google/fonts/raw/main/ofl/outfit/Outfit-Light.ttf'}
)

$destDir = 'C:\Users\zema\AppData\Roaming\GIMP\2.10\fonts'

Write-Host "=== Installation polices GIMP ===" -ForegroundColor Cyan

foreach ($font in $fonts) {
    $dest = Join-Path $destDir "$($font.name).ttf"
    Write-Host "Telechargement $($font.name)..." -NoNewline
    try {
        Invoke-WebRequest -Uri $font.url -OutFile $dest -UseBasicParsing
        $size = [math]::Round((Get-Item $dest).Length / 1KB, 1)
        Write-Host " OK ($size KB)" -ForegroundColor Green
    } catch {
        Write-Host " ERREUR: $_" -ForegroundColor Red
    }
}

Write-Host "`n=== Polices Light/Medium installees ===" -ForegroundColor Cyan
Get-ChildItem $destDir -Filter "*Light*" | ForEach-Object { Write-Host "  - $($_.Name)" }
Get-ChildItem $destDir -Filter "*Medium*" | ForEach-Object { Write-Host "  - $($_.Name)" }
