@echo off
setlocal EnableExtensions EnableDelayedExpansion

title SimracingOne - Installateur Overlay SR1 v4
color 0B

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

echo =====================================================
echo    INSTALLATION OVERLAY SR1 v4
echo =====================================================
echo.

REM 1. Verification des droits Administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Ce fichier doit etre lance en tant qu'administrateur.
    pause
    exit /b 1
)

REM 2. Verification / Installation Node.js
echo [+] Verification de Node.js...
if not exist "%APPDATA%\npm" mkdir "%APPDATA%\npm"

call npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo    Node.js absent, installation en cours...
    set "NODE_MSI=node-v20.11.0-x64.msi"
    set "NODE_URL=https://nodejs.org/dist/v20.11.0/%NODE_MSI%"
    set "NODE_INSTALLER=%TEMP%\%NODE_MSI%"

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%'"
    
    if not exist "%NODE_INSTALLER%" (
        echo [ERREUR] Impossible de telecharger Node.js.
        pause
        exit /b 1
    )

    msiexec /i "%NODE_INSTALLER%" /qn /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs"

    call npm -v >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERREUR] npm reste introuvable apres installation.
        pause
        exit /b 1
    )
)
echo    [OK] Node.js operationnel.

REM 3. Installation des dependances Node
echo [+] Installation des dependances Electron...
if not exist "package.json" (
    echo [ERREUR] package.json introuvable dans le dossier courant.
    pause
    exit /b 1
)
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo [ERREUR] npm install a echoue.
    pause
    exit /b 1
)
echo    [OK] Dependances Electron installees.

REM 4. Environnement virtuel Python
echo [+] Configuration de l'environnement Python local...
set "SYS_PYTHON="
for %%P in (python.exe py.exe) do (
    where %%P >nul 2>&1
    if !errorlevel! equ 0 (
        set "SYS_PYTHON=%%P"
        goto CREATE_VENV
    )
)

echo [ERREUR] Python est introuvable sur votre systeme.
pause
exit /b 1

:CREATE_VENV
if not exist ".venv" "%SYS_PYTHON%" -m venv .venv
set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"

REM 5. Installation des dependances Python
echo [+] Installation des dependances Python dans le venv...
"%PYTHON_EXE%" -m pip install --upgrade pip
"%PYTHON_EXE%" -m pip install fastapi "uvicorn[standard]" websockets wsproto edge-tts pygame flask flask-cors pyirsdk

if %errorlevel% neq 0 (
    echo [ERREUR] Installation des modules Python echouee.
    pause
    exit /b 1
)

echo [+] Verification des modules Python...
"%PYTHON_EXE%" -c "import irsdk, fastapi, uvicorn, websockets, flask"
if %errorlevel% neq 0 (
    echo [ERREUR] La verification des modules Python a echoue.
    pause
    exit /b 1
)
echo    [OK] Python et dependances valides.

REM 6. Configuration des ports du pare-feu
echo [+] Configuration du pare-feu...
netsh advfirewall firewall add rule name="SimracingOne" dir=in action=allow protocol=TCP localport=5000,8000,3000 profile=any >nul 2>&1
echo    [OK] Ports ouverts.

echo.
echo =====================================================
echo    INSTALLATION OVERLAY SR1 v4 TERMINEE AVEC SUCCES
echo =====================================================
echo.
echo L'environnement est pret. Vous pouvez executer start.bat en mode standard.
echo.
pause
