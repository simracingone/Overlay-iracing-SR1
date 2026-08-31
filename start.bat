@echo off
reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f >nul 2>&1

title Overlay SR1 v4 - Electron
cd /d "%~dp0"

color 0B

cls
echo ======================================================================
echo    OVERLAY SR1 v4 - LANCEMENT DE L'OVERLAY ELECTRON
echo ======================================================================
echo  Concepteur : Philippe Mourier [SR1]
echo  Twitch     : twitch.tv/simracing_one
echo  YouTube    : youtube.com/@simracing_one
echo ----------------------------------------------------------------------
echo.

set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    echo [ERREUR] Environnement virtuel introuvable.
    echo Veuillez lancer install.bat en tant qu'administrateur d'abord.
    echo.
    pause
    exit /b 1
)

echo [+] Nettoyage des anciens processus...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

echo [+] Nettoyage du cache Electron...
set "ELECTRON_CACHE_DIR=%APPDATA%\Overlays-SimracingOne"

if exist "%ELECTRON_CACHE_DIR%" (
    rmdir /s /q "%ELECTRON_CACHE_DIR%\Cache" >nul 2>&1
    rmdir /s /q "%ELECTRON_CACHE_DIR%\Code Cache" >nul 2>&1
    rmdir /s /q "%ELECTRON_CACHE_DIR%\GPUCache" >nul 2>&1
)

echo [+] Lancement du serveur vocal (Flask + pygame)...
start "Serveur Vocal" /B "%PYTHON_EXE%" voice.py

echo [+] Lancement de l'API FastAPI (port 8000)...
start "API FastAPI" /B "%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level error

echo [+] Initialisation en cours (5s)...
timeout /t 5 /nobreak >nul

echo [+] Lancement de l'interface Electron...
call npx electron .

echo ======================================================================
echo    OVERLAY SR1 v4 DEMARRE - NE FERMEZ PAS CETTE FENETRE
echo ======================================================================
echo.
pause
