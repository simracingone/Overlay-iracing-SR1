$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $projectDir '.venv\Scripts\python.exe'
$services = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

function Wait-ForEndpoint($url, $process, $label) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) { throw "$label s'est arrêté au démarrage (code $($process.ExitCode))." }
        try {
            Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing | Out-Null
            return
        } catch { Start-Sleep -Milliseconds 300 }
    }
    throw "$label ne répond pas après 30 secondes."
}

function Assert-PortFree($port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $port)
        throw "Le port local $port est déjà utilisé. Fermez le programme qui l'occupe, puis relancez l'overlay."
    } catch [System.Net.Sockets.SocketException] {
        # Aucune application n'écoute sur ce port.
    } finally {
        $client.Dispose()
    }
}

function Test-ExistingTelemetryApi {
    try {
        $data = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/data' -TimeoutSec 2
        return ($null -ne $data -and
            $data.PSObject.Properties['server'] -and
            $data.PSObject.Properties['IsConnected'])
    } catch {
        return $false
    }
}

try {
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        throw 'Environnement Python absent. Lancez install.bat avant le premier démarrage.'
    }
    if (Test-ExistingTelemetryApi) {
        Write-Host 'API SimracingOne déjà active sur le port 8000 : réutilisation de cette instance.'
    } else {
        Assert-PortFree 8000
        $api = Start-Process -FilePath $pythonExe -ArgumentList '-m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level error' -WorkingDirectory $projectDir -PassThru -WindowStyle Hidden
        $services.Add($api)
        Wait-ForEndpoint 'http://127.0.0.1:8000/data' $api 'API télémétrie'
    }
    $electron = Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $projectDir -PassThru -Wait -NoNewWindow
    if ($electron.ExitCode -ne 0) { throw "Electron s'est fermé avec le code $($electron.ExitCode)." }
} catch {
    Write-Host "[ERREUR] $_" -ForegroundColor Red
    exit 1
} finally {
    foreach ($service in $services) {
        try { if (-not $service.HasExited) { Stop-Process -Id $service.Id -Force } } catch { }
    }
}
