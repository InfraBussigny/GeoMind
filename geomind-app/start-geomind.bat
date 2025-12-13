@echo off
echo ========================================
echo   GeoMind - Demarrage
echo ========================================
echo.

:: Verifier si Node.js est disponible
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERREUR: Node.js n'est pas installe ou pas dans le PATH
    pause
    exit /b 1
)

:: Aller dans le dossier du script
cd /d "%~dp0"

:: Tuer l'ancien processus sur le port 3001 si present
echo Verification du port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Fermeture du processus %%a sur le port 3001...
    taskkill /F /PID %%a >nul 2>nul
)

:: Lancer le backend en arriere-plan
echo Demarrage du backend...
start /B cmd /c "cd /d "%~dp0server" && node index.js"

:: Attendre que le backend demarre
echo Attente du backend...
timeout /t 3 /nobreak > nul

:: Verifier si l'exe compile existe
if exist "src-tauri\target\release\GeoMind.exe" (
    echo Lancement de GeoMind.exe...
    start "" "src-tauri\target\release\GeoMind.exe"
) else (
    echo.
    echo GeoMind.exe non trouve. Lancement en mode dev...
    echo Ouvrez http://localhost:5173 dans votre navigateur
    echo.
    npm run dev
)

echo.
echo ========================================
echo   GeoMind demarre !
echo   Backend: http://localhost:3001
echo   Frontend: http://localhost:5173
echo ========================================
