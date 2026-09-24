$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$taskCandidate = Join-Path $taskRoot 'release/lab-v3-c2e43d7994ac'
$taskZip = "$taskCandidate.zip"
if (Test-Path -LiteralPath $taskZip) { throw 'Refusing to overwrite existing candidate archive' }
Compress-Archive -LiteralPath $taskCandidate -DestinationPath $taskZip -CompressionLevel Optimal
$taskHash = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$taskZip.sha256" -Value "$taskHash  lab-v3-c2e43d7994ac.zip" -Encoding ascii
if (Get-NetTCPConnection -LocalPort 5182 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5182 is already occupied' }
$taskOriginalPort = $env:PORT
try {
  $env:PORT = '5182'
  $taskProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $taskCandidate -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server-stdout.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server-stderr.log') -PassThru
} finally { $env:PORT = $taskOriginalPort }
$taskResult = [ordered]@{ pid=$taskProcess.Id; url='http://127.0.0.1:5182/'; candidate=$taskCandidate; zip=$taskZip; zipSha256=$taskHash; zipBytes=(Get-Item -LiteralPath $taskZip).Length }
$taskResult | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'server-and-archive.json') -Encoding utf8
$taskResult | ConvertTo-Json
