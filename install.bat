@echo off
setlocal EnableExtensions EnableDelayedExpansion

title SimracingOne - Installateur Overlay SR1 v6.0.1
color 0B

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

echo =====================================================
echo    INSTALLATION OVERLAY SR1 v6.0.1
echo =====================================================
echo.

REM 1. Verification de Node.js
echo [+] Verification de Node.js...
if not exist "%APPDATA%\npm" mkdir "%APPDATA%\npm"

call npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [+] Installation portable de Node.js pour votre compte Windows...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-node.ps1"
    if errorlevel 1 (
        echo [ERREUR] Impossible d'installer Node.js pour cet utilisateur.
        pause
        exit /b 1
    )
)
set "NODE_RUNTIME=%LOCALAPPDATA%\SimracingOne\Runtime\node-v24.22.2-win-x64"
if exist "%NODE_RUNTIME%\npm.cmd" set "PATH=%NODE_RUNTIME%;%PATH%"
call npm -v >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js avec npm n'a pas pu etre lance.
    pause
    exit /b 1
)
echo    [OK] Node.js operationnel.

REM 2. Installation des dependances Node
echo [+] Installation des dependances Electron...
if not exist "package.json" (
    echo [ERREUR] package.json introuvable dans le dossier courant.
    pause
    exit /b 1
)
call npm ci --no-audit --no-fund
if %errorlevel% neq 0 (
    echo [ERREUR] npm ci a echoue.
    pause
    exit /b 1
)
echo    [OK] Dependances Electron installees.

REM 3. Environnement virtuel Python
echo [+] Configuration de l'environnement Python local...
set "SYS_PYTHON="
where py.exe >nul 2>&1
if !errorlevel! equ 0 (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
    if !errorlevel! equ 0 set "SYS_PYTHON=py -3"
)

if not defined SYS_PYTHON (
    where python.exe >nul 2>&1
    if !errorlevel! equ 0 (
        python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
        if !errorlevel! equ 0 set "SYS_PYTHON=python"
    )
)

if not defined SYS_PYTHON (
    where winget.exe >nul 2>&1
    if errorlevel 1 (
        echo [ERREUR] Python est absent et WinGet n'est pas disponible pour l'installer automatiquement.
        echo Installez Python 3.12 pour votre compte Windows, puis relancez install.bat.
        pause
        exit /b 1
    )

    echo [+] Installation de Python 3.12 pour votre compte Windows via WinGet...
    winget install --exact --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [ERREUR] WinGet n'a pas pu installer Python. Relancez install.bat ou installez Python 3.12 manuellement.
        pause
        exit /b 1
    )

    set "USER_PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    if exist "!USER_PYTHON!" set "SYS_PYTHON="!USER_PYTHON!""
    if not defined SYS_PYTHON (
        echo [ERREUR] Python a ete installe, mais son executable n'a pas ete trouve dans son dossier utilisateur.
        echo Fermez cette fenetre, ouvrez-en une nouvelle, puis relancez install.bat.
        pause
        exit /b 1
    )
)

:CREATE_VENV
set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    %SYS_PYTHON% -m venv "%PROJECT_DIR%\.venv"
    if errorlevel 1 (
        echo [ERREUR] Impossible de creer l'environnement Python .venv.
        pause
        exit /b 1
    )
)

if not exist "%PYTHON_EXE%" (
    echo [ERREUR] Python n'a pas cree le fichier attendu : "%PYTHON_EXE%"
    pause
    exit /b 1
)

REM 4. Installation des dependances Python
echo [+] Installation des dependances Python dans le venv...
"%PYTHON_EXE%" -m pip install --prefer-binary -r requirements.txt

if %errorlevel% neq 0 (
    echo [ERREUR] Installation des modules Python echouee.
    pause
    exit /b 1
)

echo [+] Verification des modules Python...
"%PYTHON_EXE%" -c "import irsdk, fastapi, uvicorn, websockets"
if %errorlevel% neq 0 (
    echo [ERREUR] La verification des modules Python a echoue.
    pause
    exit /b 1
)
echo    [OK] Python et dependances valides.

REM 5. Installation du compagnon Team-Voix avec le meme interpreteur Python
if not exist "%PROJECT_DIR%\Team-Voix\install.bat" (
    echo [ERREUR] Installateur Team-Voix introuvable dans le dossier Team-Voix.
    pause
    exit /b 1
)
echo [+] Installation du projet compagnon Team-Voix...
call "%PROJECT_DIR%\Team-Voix\install.bat" --quiet "%PYTHON_EXE%"
if errorlevel 1 (
    echo [ERREUR] Installation du projet Team-Voix echouee.
    pause
    exit /b 1
)
echo    [OK] Projet Team-Voix installe.

echo.
echo =====================================================
echo    INSTALLATION OVERLAY SR1 v6.0.1 TERMINEE AVEC SUCCES
echo =====================================================
echo.
echo Les deux projets sont installes. Lancez "start.bat" pour les HUD ou "Team-Voix\start.bat" pour les voix.
echo.
pause
