param([switch]$Setup)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
$venvPython = Join-Path $repo '.venv\Scripts\python.exe'
$logDir = Join-Path $repo 'data\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
try {
    if ($Setup) {
        $python = $null
        foreach ($version in @('3.11','3.12','3.10')) {
            try {
                $candidate = & py "-$version" -c 'import sys; print(sys.executable)' 2>$null
                if ($LASTEXITCODE -eq 0 -and $candidate) { $python = $candidate.Trim(); break }
            } catch { }
        }
        if (-not $python) { throw 'Python 3.11 recommended (3.10-3.12 supported). Install from python.org and re-run setup_server.bat.' }
        Write-Host "Using Python: $python"
        if (-not (Test-Path -LiteralPath $venvPython)) { & $python -m venv (Join-Path $repo '.venv'); if ($LASTEXITCODE) { throw 'Virtual environment creation failed' } }
        & $venvPython -m pip install -r (Join-Path $repo 'backend\requirements.txt')
        if ($LASTEXITCODE) { throw 'Dependency installation failed. Check connectivity and retry setup_server.bat.' }
        if (-not (Test-Path -LiteralPath 'backend\.env')) { Copy-Item -LiteralPath 'backend\.env.example' -Destination 'backend\.env' }
        Write-Host 'Setup complete. Configure backend\.env locally if using Groq. No model weights were downloaded. Run start_server.bat.'
        exit 0
    }
    if (-not (Test-Path -LiteralPath $venvPython)) { throw 'Run setup_server.bat once before starting the server.' }
    & $venvPython -c 'import fastapi,uvicorn,fitz,groq,dotenv,multipart'
    if ($LASTEXITCODE) { throw 'Dependencies are missing. Run setup_server.bat.' }
    $listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 3
            if ($health.status -eq 'ok') { Write-Host 'Tutor server is already running. You can use the app now.'; Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { Write-Host ('Phone server URL: http://' + $_.IPv4Address.IPAddress + ':8000') }; Write-Host 'Check laptop health: http://127.0.0.1:8000/health'; exit 0 }
        } catch { }
        throw 'Port 8000 is occupied. Close the existing service or use the existing tutor server.'
    }
    $addresses = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress }
    if (-not $addresses) { $addresses = @('127.0.0.1'); Write-Warning 'No active LAN gateway found. Connect the laptop to Wi-Fi.' }
    foreach ($ip in $addresses) { Write-Host "Phone server URL: http://${ip}:8000    Health: http://${ip}:8000/health" }
    Write-Host 'Keep this window open. Press Ctrl+C to stop. Allow private-network access only.'
    $env:PYTHONPATH = "$repo;$repo\backend"
    $ErrorActionPreference = 'Continue'
    & $venvPython -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --log-config backend/logging.json 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'server.log') -Append
    $serverExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($serverExit) { throw "Server exited with code $serverExit" }
} catch {
    $message = "$(Get-Date -Format o) Startup error: $($_.Exception.Message)"
    Add-Content -LiteralPath (Join-Path $logDir 'startup-errors.log') -Value $message
    Write-Host $message -ForegroundColor Red
    exit 1
}
