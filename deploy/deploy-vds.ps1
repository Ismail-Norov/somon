# Publishes the last commit to the VDS: uploads the code, rebuilds and restarts the services.
# The database and uploaded files on the server are kept.
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy\deploy-vds.ps1
param(
  [string]$Server = 'root@87.228.40.247',
  [string]$Key = (Join-Path $env:USERPROFILE '.ssh\somon_vds')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$archive = Join-Path $env:TEMP 'somon-deploy.tar.gz'
$ssh = @('-i', $Key, '-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=30')

if (git -C $root status --porcelain) {
  Write-Warning 'There are uncommitted changes; only the last commit is deployed.'
}

git -C $root archive --format=tar.gz -o $archive HEAD
scp @ssh $archive "${Server}:/tmp/somon.tar.gz"
ssh @ssh $Server 'mkdir -p /opt/somon/app && tar -xzf /tmp/somon.tar.gz -C /opt/somon/app && cp /opt/somon/app/deploy/build.sh /opt/somon/build.sh && sed -i "s/\r$//" /opt/somon/build.sh && (nohup bash /opt/somon/build.sh > /opt/somon/build.log 2>&1 &) && echo started'

Write-Host 'Building on the server (5-15 minutes)...'
do {
  Start-Sleep 20
  $tail = ssh @ssh $Server 'tail -3 /opt/somon/build.log'
} until (($tail -join "`n") -match 'BUILD_OK|ERR!|error|Error')
$tail
