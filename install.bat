@echo off
setlocal EnableExtensions EnableDelayedExpansion

title SimracingOne - Installateur Overlay SR1 v4
color 0B

REM =====================================================
REM 1. DEFINIR LE DOSSIER PROJET
REM =====================================================

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

echo =====================================================
echo    INSTALLATION OVERLAY SR1 v4
echo =====================================================
echo.

REM =====================================================
REM 2. DROITS ADMIN
REM =====================================================

net session >nul 2>&1

if %errorlevel% neq 0 (
    echo [ERREUR] Lancer ce fichier en tant qu'administrateur.
    pause
    exit /b 1
)

REM =====================================================
REM 3. NODE.JS
REM =====================================================

echo [+] Verification de Node.js...

REM Creation du dossier npm s'il n'existe pas
if not exist "%APPDATA%\npm" (
    echo    Creation du dossier npm...
    mkdir "%APPDATA%\npm"
)

call npm -v >nul 2>&1

if %errorlevel% neq 0 (
    echo    Node.js absent, installation...

    set "NODE_MSI=node-v20.11.0-x64.msi"
    set "NODE_URL=https://nodejs.org/dist/v20.11.0/%NODE_MSI%"
    set "NODE_INSTALLER=%TEMP%\%NODE_MSI%"

    echo    Telechargement de Node.js...

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%'"

    if not exist "%NODE_INSTALLER%" (
        echo [ERREUR] Impossible de telecharger Node.js.
        pause
        exit /b 1
    )

    echo    Installation de Node.js...

    msiexec /i "%NODE_INSTALLER%" /qn /norestart

    REM Actualisation du PATH
    set "PATH=%PATH%;C:\Program Files\nodejs"

    echo    Verification de npm...

    call npm -v >nul 2>&1

    if %errorlevel% neq 0 (
        echo [ERREUR] npm reste introuvable apres installation de Node.js.
        echo.
        echo Fermez puis relancez l'installateur.
        pause
        exit /b 1
    )
)

echo    [OK] Node.js operationnel.

REM =====================================================
REM 4. INSTALLATION NODE_MODULES
REM =====================================================

echo [+] Installation des dependances Electron...

if not exist "package.json" (
    echo [ERREUR] package.json introuvable.
    echo Verifiez que cet installateur est place dans le dossier du projet.
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

REM =====================================================
REM 5. ENVIRONNEMENT PYTHON
REM =====================================================

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
echo Installez Python puis relancez l'installateur.
pause
exit /b 1

:CREATE_VENV

if not exist ".venv" (
    echo    Creation du dossier .venv...
    "%SYS_PYTHON%" -m venv .venv
)

if not exist ".venv\Scripts\python.exe" (
    echo [ERREUR] Impossible de creer l'environnement Python.
    pause
    exit /b 1
)

set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"

REM =====================================================
REM 6. DEPENDANCES PYTHON
REM =====================================================

echo [+] Installation des dependances Python dans le venv...

"%PYTHON_EXE%" -m pip install --upgrade pip

if %errorlevel% neq 0 (
    echo [ERREUR] Mise a jour de pip impossible.
    pause
    exit /b 1
)

echo    Installation de FastAPI, Uvicorn, WebSockets, Flask, etc.

"%PYTHON_EXE%" -m pip install ^
    fastapi ^
    "uvicorn[standard]" ^
    websockets ^
    wsproto ^
    edge-tts ^
    pygame ^
    flask ^
    flask-cors ^
    pyirsdk

if %errorlevel% neq 0 (
    echo [ERREUR] Installation des modules Python echouee.
    pause
    exit /b 1
)

REM =====================================================
REM 7. VERIFICATION PYTHON
REM =====================================================

echo [+] Verification des modules Python...

"%PYTHON_EXE%" -c "import irsdk, fastapi, uvicorn, websockets, flask"

if %errorlevel% neq 0 (
    echo [ERREUR] La verification des modules Python a echoue.
    pause
    exit /b 1
)

echo    [OK] Python, iRacing SDK et WebSockets valides.
echo.

REM =====================================================
REM 8. PARE-FEU
REM =====================================================

echo [+] Configuration du pare-feu...

netsh advfirewall firewall add rule ^
    name="SimracingOne" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=5000,8000,3000 ^
    profile=any >nul 2>&1

echo    [OK] Ports ouverts.

REM =====================================================
REM 9. GENERATION DU FICHIER DE LANCEMENT (start.bat)
REM =====================================================

echo [+] Generation du fichier lanceur start.bat...

(
echo @echo off
echo :: Desactive le mode Edition Rapide pour eviter le gel du terminal au clic
echo reg add "HKCU\Console" /v QuickEdit /t REG_DWORD /d 0 /f ^>nul 2^>^&1
echo.
echo title Overlay SR1 v4 - Electron
echo cd /d "%%~dp0"
echo.
echo :: Configuration de la couleur ^(Fond noir, texte cyan^)
echo color 0B
echo.
echo cls
echo ======================================================================
echo    OVERLAY SR1 v4 - LANCEMENT DE L'OVERLAY ELECTRON
echo ======================================================================
echo  Concepteur : Philippe Mourier [SR1]
echo  Twitch     : twitch.tv/simracing_one
echo  YouTube    : youtube.com/@simracing_one
echo ----------------------------------------------------------------------
echo.
echo :: Definition du chemin vers le Python local
echo set "PYTHON_EXE=%%~dp0.venv\Scripts\python.exe"
echo.
echo :: Verification si le venv existe
echo if not exist "%%PYTHON_EXE%%" ^(
echo     echo [ERREUR] Environnement virtuel introuvable. 
echo     echo Veuillez lancer install.bat d'abord.
echo     echo.
echo     pause
echo     exit /b 1
echo ^)
echo.
echo :: Nettoyage des anciens processus Python et Electron
echo echo [+] Nettoyage des anciens processus...
echo taskkill /F /IM python.exe ^>nul 2^>^&1
echo taskkill /F /IM pythonw.exe ^>nul 2^>^&1
echo taskkill /F /IM electron.exe ^>nul 2^>^&1
echo.
echo :: Vidage du cache Electron dans AppData
echo echo [+] Nettoyage du cache Electron...
echo set "ELECTRON_CACHE_DIR=%%APPDATA%%\Overlays-SimracingOne"
echo.
echo if exist "%%ELECTRON_CACHE_DIR%%" ^(
echo     rmdir /s /q "%%ELECTRON_CACHE_DIR%%\Cache" ^>nul 2^>^&1
echo     rmdir /s /q "%%ELECTRON_CACHE_DIR%%\Code Cache" ^>nul 2^>^&1
echo     rmdir /s /q "%%ELECTRON_CACHE_DIR%%\GPUCache" ^>nul 2^>^&1
echo ^)
echo.
echo :: Lancement serveur vocal Flask ^(via le venv^)
echo echo [+] Lancement du serveur vocal ^(Flask + pygame^)...
echo start "Serveur Vocal" /B "%%PYTHON_EXE%%" voice.py
echo.
echo :: Lancement API FastAPI ^(via le venv^)
echo echo [+] Lancement de l'API FastAPI ^(port 8000^)...
echo start "API FastAPI" /B "%%PYTHON_EXE%%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload --log-level error
echo.
echo :: Attente 5 secondes pour initialisation
echo echo [+] Initialisation en cours ^(5s^)...
echo timeout /t 5 /nobreak ^>nul
echo.
echo :: Lancement Electron
echo echo [+] Lancement de l'interface Electron...
echo call npx electron .
echo.
echo ======================================================================
echo    OVERLAY SR1 v4 DEMARRE - NE FERMEZ PAS CETTE FENETRE
echo ======================================================================
echo.
echo pause
) > "%PROJECT_DIR%\start.bat"

echo    [OK] Fichier start.bat genere avec succes.

REM =====================================================
REM FIN
REM =====================================================

echo.
echo =====================================================
echo    INSTALLATION OVERLAY SR1 v4 TERMINEE AVEC SUCCES
echo =====================================================
echo.
echo Vous pouvez maintenant executer "start.bat" en mode standard (non-administrateur).
echo.

pause
