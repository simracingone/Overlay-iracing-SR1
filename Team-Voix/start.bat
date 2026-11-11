@echo off
setlocal
cd /d "%~dp0"
title SimracingOne - Team Voice
set "NODE_RUNTIME=%LOCALAPPDATA%\SimracingOne\Runtime\node-v24.22.2-win-x64"
if exist "%NODE_RUNTIME%\npm.cmd" set "PATH=%NODE_RUNTIME%;%PATH%"

set "NEEDS_INSTALL=0"
if not exist "%~dp0.venv\Scripts\python.exe" set "NEEDS_INSTALL=1"
if not exist "%~dp0node_modules\electron\dist\electron.exe" set "NEEDS_INSTALL=1"
if exist "%~dp0.venv\Scripts\python.exe" (
    "%~dp0.venv\Scripts\python.exe" -c "from importlib.metadata import version; raise SystemExit(0 if version('edge-tts') == '7.3.1' else 1)" >nul 2>&1
    if errorlevel 1 set "NEEDS_INSTALL=1"
)
if "%NEEDS_INSTALL%"=="1" (
    echo [+] Installation ou mise a jour automatique des dependances Team Voice...
    call "%~dp0install.bat"
    if errorlevel 1 exit /b 1
)

REM L'installateur peut avoir ajoute Node portable : actualiser le PATH.
if exist "%NODE_RUNTIME%\npm.cmd" set "PATH=%NODE_RUNTIME%;%PATH%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
    echo.
    echo Le projet Team Voice n'a pas pu demarrer. Consultez le message ci-dessus.
    pause
)
