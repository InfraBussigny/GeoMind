@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
set PATH=%PATH%;C:\Users\Marc\.cargo\bin
cd /d C:\Users\Marc\GeoMind-Infra\geomind-app
npm run tauri:build
