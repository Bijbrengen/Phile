param(
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$port = 47115
$url = "http://127.0.0.1:$port/"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python is niet gevonden. Installeer Python om de statische server te starten."
}

$listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $owners = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
  if ($Check) {
    Write-Host "Phile is al actief op $url (pid(s): $($owners -join ', '))"
    return
  }
  throw "Phile-poort $port is al bezet door pid(s): $($owners -join ', ')."
}

if ($Check) {
  Write-Host "Phile is startklaar op $url"
  return
}

Push-Location $repoRoot
try {
  python scripts\generate_runtime_config.py
  if ($LASTEXITCODE -ne 0) { throw "Runtimeconfiguratie genereren is mislukt." }
  Write-Host "Phile: $url"
  python -m http.server $port --bind 127.0.0.1
  if ($LASTEXITCODE -ne 0) { throw "De statische server is gestopt met exitcode $LASTEXITCODE." }
}
finally {
  Pop-Location
}
