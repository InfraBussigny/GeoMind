@echo off
REM Export PDF - Plan de situation servitudes BF 791
REM Chemin du Cedre 35, Bussigny

echo ======================================================
echo Export PDF - Plan de situation BF 791
echo ======================================================

set QGIS_PATH=C:\Program Files\QGIS 3.40.4
set PROJECT=C:\Users\zema\GeoBrain\projets\servitudes_791\servitudes_791.qgs
set LAYOUT=Plan de situation A4 paysage
set OUTPUT=C:\Users\zema\GeoBrain\projets\servitudes_791\Plan_servitudes_BF791_Bussigny.pdf

echo.
echo Projet: %PROJECT%
echo Layout: %LAYOUT%
echo Sortie: %OUTPUT%
echo.

"%QGIS_PATH%\bin\qgis_process-qgis-ltr.bat" run native:printlayouttopdf ^
  --PROJECT_PATH="%PROJECT%" ^
  --LAYOUT="%LAYOUT%" ^
  --DPI=300 ^
  --FORCE_VECTOR=true ^
  --GEOREFERENCE=true ^
  --INCLUDE_METADATA=true ^
  --OUTPUT="%OUTPUT%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo EXPORT REUSSI!
    echo ======================================================
    echo Fichier: %OUTPUT%
    echo.
    echo Ouverture du PDF...
    start "" "%OUTPUT%"
) else (
    echo.
    echo ERREUR lors de l'export (code %ERRORLEVEL%)
)

pause
