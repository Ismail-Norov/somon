# Starts Somon in production mode and publishes it via a temporary Cloudflare link.
# Usage: powershell -ExecutionPolicy Bypass -File .\start-online.ps1 [-Build]
param([switch]$Build)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$cloudflared = Join-Path $env:USERPROFILE 'tools\cloudflared.exe'

if (-not (Test-Path $cloudflared)) {
  New-Item -ItemType Directory -Force (Split-Path $cloudflared) | Out-Null
  Write-Host 'Downloading cloudflared...'
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $cloudflared
}

if ($Build -or -not (Test-Path (Join-Path $root 'frontend\.next\BUILD_ID')) -or -not (Test-Path (Join-Path $root 'backend\dist\index.js'))) {
  Write-Host 'Building backend and frontend...'
  Push-Location (Join-Path $root 'backend'); npm run build; Pop-Location
  Push-Location (Join-Path $root 'frontend'); npm run build; Pop-Location
}

Get-NetTCPConnection -LocalPort 3000, 4000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:PORT='4000'; Set-Location '$root\backend'; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$env:PORT='3000'; Set-Location '$root\frontend'; npm start"
Start-Sleep 5

# QUIC with explicit edge addresses: some networks block SRV lookups and TLS to the Cloudflare edge.
Write-Host 'Starting tunnel. The public link (https://....trycloudflare.com) appears below.'
& $cloudflared tunnel --no-autoupdate --protocol quic --edge 198.41.192.7:7844 --edge 198.41.192.77:7844 --url http://localhost:3000
