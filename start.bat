@echo off
setlocal
cd /d "%~dp0"
title Overlay SR1 - lancement
set "NODE_RUNTIME=%LOCALAPPDATA%\SimracingOne\Runtime\node-v24.22.2-win-x64"
if exist "%NODE_RUNTIME%\npm.cmd" set "PATH=%NODE_RUNTIME%;%PATH%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
    echo.
    echo Le lancement a echoue. Consultez le message ci-dessus.
    pause
)
