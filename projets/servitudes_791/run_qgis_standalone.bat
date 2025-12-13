@echo off
REM ============================================================
REM Script pour executer PyQGIS en mode standalone
REM Marc Zermatten - Service SIT Bussigny
REM ============================================================

echo.
echo ================================================
echo Generation du plan de situation - Servitudes 791
echo ================================================
echo.

REM Configuration QGIS
set OSGEO4W_ROOT=C:\Program Files\QGIS 3.34.12
set QGIS_PREFIX_PATH=%OSGEO4W_ROOT%\apps\qgis-ltr

REM Configurer les variables d'environnement
set PATH=%OSGEO4W_ROOT%\apps\qgis-ltr\bin;%OSGEO4W_ROOT%\apps\Qt5\bin;%OSGEO4W_ROOT%\apps\Python312;%OSGEO4W_ROOT%\apps\Python312\Scripts;%OSGEO4W_ROOT%\bin;%PATH%
set PYTHONPATH=%OSGEO4W_ROOT%\apps\qgis-ltr\python;%OSGEO4W_ROOT%\apps\qgis-ltr\python\plugins;%OSGEO4W_ROOT%\apps\Python312\Lib\site-packages
set PYTHONHOME=%OSGEO4W_ROOT%\apps\Python312
set QT_PLUGIN_PATH=%OSGEO4W_ROOT%\apps\qgis-ltr\qtplugins;%OSGEO4W_ROOT%\apps\Qt5\plugins
set QT_QPA_PLATFORM_PLUGIN_PATH=%OSGEO4W_ROOT%\apps\Qt5\plugins\platforms

REM Lancer le script Python
echo Demarrage de QGIS Python...
echo.
"%OSGEO4W_ROOT%\apps\Python312\python.exe" "%~dp0generer_plan_servitudes.py"

echo.
echo ================================================
if errorlevel 1 (
    echo ERREUR lors de l'execution!
) else (
    echo Execution terminee avec succes!
)
echo ================================================
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
