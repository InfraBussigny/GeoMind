@echo off
REM ============================================================
REM Installation des dependances pour BDCO Sketcher Georef
REM A executer en tant qu'administrateur
REM ============================================================

echo.
echo ============================================================
echo   BDCO Sketcher - Installation des dependances
echo ============================================================
echo.

REM Detecter QGIS - Chemin specifique Bussigny
set "OSGEO4W_ROOT=C:\Program Files\QGIS 3.40.4"

REM Si pas trouve, essayer autres versions
if not exist "%OSGEO4W_ROOT%" (
    set "OSGEO4W_ROOT=C:\Program Files\QGIS 3.34.12"
)
if not exist "%OSGEO4W_ROOT%" (
    set "OSGEO4W_ROOT=C:\Program Files\QGIS 3.34.6"
)
if not exist "%OSGEO4W_ROOT%" (
    set "OSGEO4W_ROOT=C:\Program Files\QGIS 3.34.4"
)
if not exist "%OSGEO4W_ROOT%" (
    set "OSGEO4W_ROOT=C:\OSGeo4W"
)
if not exist "%OSGEO4W_ROOT%" (
    set "OSGEO4W_ROOT=C:\OSGeo4W64"
)

if not exist "%OSGEO4W_ROOT%" (
    echo [ERREUR] Installation QGIS non trouvee!
    echo.
    echo Chemins testes:
    echo   - C:\Program Files\QGIS 3.40.4
    echo   - C:\Program Files\QGIS 3.34.12
    echo   - C:\OSGeo4W
    echo.
    echo Verifiez que QGIS est installe et reessayez.
    pause
    exit /b 1
)

echo [OK] QGIS trouve: %OSGEO4W_ROOT%
echo.

REM Configurer l'environnement QGIS
set "PATH=%OSGEO4W_ROOT%\bin;%PATH%"

REM Essayer Python312 (QGIS 3.40) puis Python311, Python39
if exist "%OSGEO4W_ROOT%\apps\Python312" (
    set "PYTHONHOME=%OSGEO4W_ROOT%\apps\Python312"
    set "PYTHON_EXE=%OSGEO4W_ROOT%\apps\Python312\python.exe"
) else if exist "%OSGEO4W_ROOT%\apps\Python311" (
    set "PYTHONHOME=%OSGEO4W_ROOT%\apps\Python311"
    set "PYTHON_EXE=%OSGEO4W_ROOT%\apps\Python311\python.exe"
) else if exist "%OSGEO4W_ROOT%\apps\Python39" (
    set "PYTHONHOME=%OSGEO4W_ROOT%\apps\Python39"
    set "PYTHON_EXE=%OSGEO4W_ROOT%\apps\Python39\python.exe"
) else (
    echo [ERREUR] Python QGIS non trouve!
    pause
    exit /b 1
)

echo [OK] Python: %PYTHON_EXE%

echo.
echo [1/4] Installation PyMuPDF (conversion PDF)...
echo ------------------------------------------------
"%PYTHON_EXE%" -m pip install --upgrade pymupdf --user
if errorlevel 1 (
    echo [!] Tentative sans --user...
    "%PYTHON_EXE%" -m pip install --upgrade pymupdf
)

echo.
echo [2/4] Installation OpenCV (traitement image)...
echo ------------------------------------------------
"%PYTHON_EXE%" -m pip install --upgrade opencv-python-headless --user
if errorlevel 1 (
    "%PYTHON_EXE%" -m pip install --upgrade opencv-python-headless
)

echo.
echo [3/4] Installation pytesseract (OCR)...
echo ------------------------------------------------
"%PYTHON_EXE%" -m pip install --upgrade pytesseract pillow --user
if errorlevel 1 (
    "%PYTHON_EXE%" -m pip install --upgrade pytesseract pillow
)

echo.
echo [4/4] Installation numpy (calculs)...
echo ------------------------------------------------
"%PYTHON_EXE%" -m pip install --upgrade numpy --user
if errorlevel 1 (
    "%PYTHON_EXE%" -m pip install --upgrade numpy
)

echo.
echo ============================================================
echo   Installation Python terminee!
echo ============================================================
echo.
echo [IMPORTANT] Tesseract-OCR doit etre installe separement:
echo.
echo   1. Telecharger depuis:
echo      https://github.com/UB-Mannheim/tesseract/wiki
echo.
echo   2. Installer avec les options par defaut
echo      (noter le chemin, ex: C:\Program Files\Tesseract-OCR)
echo.
echo   3. Ajouter au PATH systeme ou configurer pytesseract:
echo      pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
echo.
echo ============================================================
echo.
echo Voulez-vous telecharger Tesseract maintenant? (O/N)
set /p choice="> "
if /i "%choice%"=="O" (
    start https://github.com/UB-Mannheim/tesseract/wiki
)

echo.
echo Redemarrez QGIS pour appliquer les changements.
echo.
pause
