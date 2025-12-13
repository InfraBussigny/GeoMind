@echo off
echo === GeoMind Build Script ===
echo.

echo [1/4] Setting up Visual Studio environment...
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to setup VS environment
    exit /b 1
)

echo [2/4] Adding Cargo to PATH...
set "PATH=%PATH%;C:\Users\Marc\.cargo\bin"
cargo --version
if errorlevel 1 (
    echo ERROR: Cargo not found
    exit /b 1
)

echo [3/4] Changing to project directory...
cd /d C:\Users\Marc\GeoMind-Infra\geomind-app
if errorlevel 1 (
    echo ERROR: Project directory not found
    exit /b 1
)

echo [4/4] Building Tauri application...
npm run tauri:build
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo === Build completed successfully! ===
dir src-tauri\target\release\bundle\nsis\*.exe
