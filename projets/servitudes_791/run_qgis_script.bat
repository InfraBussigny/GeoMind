@echo off
REM Script pour executer le generateur de plan dans l'environnement QGIS
REM Marc Zermatten - Service SIT Bussigny

echo ================================================
echo Generation du plan de situation - Servitudes 791
echo ================================================

set OSGEO4W_ROOT=C:\Program Files\QGIS 3.34.12
call "%OSGEO4W_ROOT%\OSGeo4W.bat" python "%~dp0generer_plan_servitudes.py"

echo.
echo Termine! Appuyez sur une touche pour fermer...
pause >nul
