@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title SimracingOne - Installation Team Voice
set "QUIET_MODE=0"
if /i "%~1"=="--quiet" set "QUIET_MODE=1"

echo =====================================================
echo    INSTALLATION TEAM VOICE
echo =====================================================
echo.

call npm -v >nul 2>&1
if errorlevel 1 (
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

echo [+] Installation des dependances Electron...
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo [ERREUR] npm ci a echoue.
    pause
    exit /b 1
)

echo [+] Detection de Python...
set "SYS_PYTHON="
if not "%~2"=="" if exist "%~2" set "SYS_PYTHON="%~2""
if not defined SYS_PYTHON (
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
)
if not defined SYS_PYTHON (
    where winget.exe >nul 2>&1
    if errorlevel 1 (
        echo [ERREUR] Python est absent et WinGet n'est pas disponible.
        echo Installez Python 3.12 pour votre compte Windows, puis relancez ce fichier.
        pause
        exit /b 1
    )
    echo [+] Installation de Python 3.12 pour votre compte Windows via WinGet...
    winget install --exact --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [ERREUR] WinGet n'a pas pu installer Python 3.12.
        pause
        exit /b 1
    )
    set "USER_PYTHON=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    if exist "!USER_PYTHON!" set "SYS_PYTHON="!USER_PYTHON!""
    if not defined SYS_PYTHON (
        echo [ERREUR] Python a ete installe, mais son executable n'a pas ete trouve.
        echo Ouvrez une nouvelle fenetre de commande et relancez l'installation Team Voice.
        pause
        exit /b 1
    )
)

set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    %SYS_PYTHON% -m venv "%~dp0.venv"
    if errorlevel 1 (
        echo [ERREUR] Impossible de creer l'environnement Python.
        pause
        exit /b 1
    )
)
if not exist "%PYTHON_EXE%" (
    echo [ERREUR] Executable Python .venv introuvable.
    pause
    exit /b 1
)

echo [+] Installation des dependances vocales...
"%PYTHON_EXE%" -m pip install --prefer-binary -r requirements.txt
if errorlevel 1 (
    echo [ERREUR] Installation des dependances vocales echouee.
    pause
    exit /b 1
)
"%PYTHON_EXE%" -c "import edge_tts, pygame, flask"
if errorlevel 1 (
    echo [ERREUR] Verification des modules vocaux echouee.
    pause
    exit /b 1
)

echo.
echo [OK] Projet Team Voice pret.
echo Lancez d'abord le projet principal, puis Team-Voix\start.bat.
if "%QUIET_MODE%"=="0" pause
