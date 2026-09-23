$ErrorActionPreference = 'Stop'
$qaDir = Split-Path -Parent $PSCommandPath
$qaRoot = (Resolve-Path (Join-Path $qaDir '../../..')).Path
Set-Location -LiteralPath $qaRoot
$cli = 'C:/Users/lzh/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js'
$results = Join-Path $qaDir 'stability-samples.jsonl'
$setupFile = Join-Path $qaDir 'stability-setup.js'
$stepFile = Join-Path $qaDir 'stability-step.js'
& node $cli '-s=rnc-final-qa' '--raw' run-code --filename $setupFile | Set-Content (Join-Path $qaDir 'stability-setup-result.json') -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'QA setup failed' }
$started = [DateTimeOffset]::UtcNow
@{ startedAt=$started.ToString('o'); durationMinimumSeconds=1200; status='running' } | ConvertTo-Json | Set-Content (Join-Path $qaDir 'stability-progress.json') -Encoding utf8
do {
  $sample = & node $cli '-s=rnc-final-qa' '--raw' run-code --filename $stepFile
  if ($LASTEXITCODE -ne 0) { throw "QA step failed: $sample" }
  $parsed = $sample | ConvertFrom-Json
  $parsed | ConvertTo-Json -Depth 20 -Compress | Add-Content $results -Encoding utf8
  $elapsed = ([DateTimeOffset]::UtcNow - $started).TotalSeconds
  @{ elapsedSeconds=$elapsed; status='running'; computations=$parsed.state.computations; switches=$parsed.state.switches; replays=$parsed.state.replays } | ConvertTo-Json | Set-Content (Join-Path $qaDir 'stability-progress.json') -Encoding utf8
  if ($elapsed -lt 1200) { Start-Sleep -Seconds 10 }
} while ($elapsed -lt 1200)
@{ startedAt=$started.ToString('o'); endedAt=[DateTimeOffset]::UtcNow.ToString('o'); actualElapsedSeconds=$elapsed; status='completed'; computations=$parsed.state.computations; switches=$parsed.state.switches; replays=$parsed.state.replays } | ConvertTo-Json | Set-Content (Join-Path $qaDir 'stability-progress.json') -Encoding utf8
