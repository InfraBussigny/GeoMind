@echo off
REM ============================================================================
REM Extraction schema SDOL - À exécuter sur srv-fme
REM ============================================================================

set PGPASSWORD=H5$HrjTg^&f
set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
set OUTPUT=C:\Temp\sdol_schema_extract.txt

echo Connexion a SDOL...
echo Extraction en cours...

%PSQL% -h postgres.hkd-geomatique.com -p 5432 -U by_lgr -d sdol -f "%~dp0extract_sdol_schema.sql" > %OUTPUT% 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo EXTRACTION REUSSIE !
    echo Fichier genere : %OUTPUT%
    echo ============================================
    echo.
    echo Copie ce fichier sur ton poste pour l'analyse.
) else (
    echo.
    echo ERREUR lors de l'extraction
    echo Verifier la connexion et les credentials
)

pause
