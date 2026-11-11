$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$baseProject = Split-Path -Parent $projectDir
$pythonExe = Join-Path $projectDir '.venv\Scripts\python.exe'
$services = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$previousVoicePort = $env:SIMRACINGONE_VOICE_PORT

function Wait-ForEndpoint($url, $process, $label) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) { throw "$label s'est arrêté au démarrage (code $($process.ExitCode))." }
        try { Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing | Out-Null; return }
        catch { Start-Sleep -Milliseconds 300 }
    }
    throw "$label ne répond pas après 30 secondes."
}

function Test-PortFree($port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $port)
        return $false
    } catch [System.Net.Sockets.SocketException] {
        return $true
    } finally {
        $client.Dispose()
    }
}

function Get-FreeLocalPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return [int]$listener.LocalEndpoint.Port
    } finally {
        $listener.Stop()
    }
}

function Stop-LegacyVoiceServer {
    $legacyPython = Join-Path $baseProject '.venv\Scripts\python.exe'
    $processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        [string]::Equals($_.ExecutablePath, $legacyPython, [System.StringComparison]::OrdinalIgnoreCase) -and
        $_.CommandLine -match '(?i)voice\.py'
    })
    foreach ($process in $processes) {
        if ($process) {
            Write-Host 'Ancien serveur vocal du projet principal détecté : arrêt ciblé avant le démarrage de Team-Voix.'
            Stop-Process -Id $process.ProcessId -Force
        }
    }
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $baseProject 'start.bat'))) {
        throw 'Projet principal introuvable. Placez Team-Voix dans le dossier du projet principal.'
    }
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw "Environnement Python du projet Team Voice absent. Lancez d’abord Team-Voix\install.bat."
    }
    $telemetryAvailable = $false
    try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:8000/data' -TimeoutSec 2 -UseBasicParsing | Out-Null
        $telemetryAvailable = $true
    } catch { }
    if (-not $telemetryAvailable) {
        Write-Host "API du projet principal indisponible : la fenêtre et le test vocal démarrent, les alertes iRacing se reconnecteront quand l’API sera lancée."
    }

    Stop-LegacyVoiceServer
    $voicePort = 5000
    if (-not (Test-PortFree $voicePort)) {
        $voicePort = Get-FreeLocalPort
        Write-Host "Le port 5000 est occupé ; Team-Voix utilisera le port libre $voicePort."
    }
    $env:SIMRACINGONE_VOICE_PORT = "$voicePort"
    $voice = Start-Process -FilePath $pythonExe -ArgumentList '-u voice.py' -WorkingDirectory $projectDir -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectDir 'voice-server.log') -RedirectStandardError (Join-Path $projectDir 'voice-server-error.log')
    $services.Add($voice)
    Wait-ForEndpoint "http://127.0.0.1:$voicePort/status" $voice 'Serveur vocal'

    $electron = Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $projectDir -PassThru -Wait -NoNewWindow
    if ($electron.ExitCode -ne 0) { throw "La fenêtre Team Voice s'est fermée avec le code $($electron.ExitCode)." }
} catch {
    Write-Host "[ERREUR] $_" -ForegroundColor Red
    exit 1
} finally {
    foreach ($service in $services) {
        try { if (-not $service.HasExited) { Stop-Process -Id $service.Id -Force } } catch { }
    }
    if ($null -eq $previousVoicePort) {
        Remove-Item Env:SIMRACINGONE_VOICE_PORT -ErrorAction SilentlyContinue
    } else {
        $env:SIMRACINGONE_VOICE_PORT = $previousVoicePort
    }
}
