$ErrorActionPreference = 'Stop'

$version = 'v24.22.2'
$archiveName = "node-$version-win-x64.zip"
$sha256 = 'ca1bff5d8ead13c9f2ea404a176db46bd430704d5b5113734049fa365e7799e2'
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'SimracingOne\Runtime'
$runtimePath = Join-Path $runtimeRoot "node-$version-win-x64"
$npmPath = Join-Path $runtimePath 'npm.cmd'
$archivePath = Join-Path $env:TEMP "simracingone-$archiveName"
$downloadUrl = "https://nodejs.org/dist/$version/$archiveName"

try {
    if (-not (Test-Path -LiteralPath $npmPath)) {
        New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
        Write-Host "Téléchargement de Node.js $version depuis nodejs.org..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -UseBasicParsing

        $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $sha256) {
            throw 'Le contrôle SHA-256 de Node.js a échoué; archive refusée.'
        }

        Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot -Force
    }

    if (-not (Test-Path -LiteralPath $npmPath)) {
        throw "npm.cmd est introuvable dans $runtimePath après extraction."
    }
    Write-Output $runtimePath
} finally {
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
}
