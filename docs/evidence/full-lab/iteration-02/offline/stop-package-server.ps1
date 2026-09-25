$ErrorActionPreference = 'Stop'
$taskServer = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'server-and-archive.json') -Raw | ConvertFrom-Json
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($taskServer.pid)" -ErrorAction SilentlyContinue
if ($null -ne $taskProcess) {
  $taskListener = Get-NetTCPConnection -LocalPort 5182 -State Listen -ErrorAction SilentlyContinue
  if ($taskProcess.Name -ne 'node.exe' -or $taskProcess.CommandLine -notmatch 'scripts/serve\.mjs' -or $taskListener.OwningProcess -ne $taskServer.pid) { throw 'The recorded PID does not match this task static server; refusing to stop it' }
  Stop-Process -Id $taskServer.pid
}
[ordered]@{ stoppedOwnServerPid=$taskServer.pid; port=5182; portListening=[bool](Get-NetTCPConnection -LocalPort 5182 -State Listen -ErrorAction SilentlyContinue); touchedOtherServers=$false } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup-results.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup-results.json') -Raw
