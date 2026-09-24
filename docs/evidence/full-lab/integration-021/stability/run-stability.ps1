param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Revision,
  [string]$CliPath = 'C:/Users/lzh/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js',
  [string]$BuildRoot = '',
  [int]$DurationSeconds = 1200,
  [switch]$SmokeOnly
)
$ErrorActionPreference = 'Stop'
$qaDir = Split-Path -Parent $PSCommandPath
$qaRoot = (Resolve-Path -LiteralPath (Join-Path $qaDir '../../..')).Path
Set-Location -LiteralPath $qaRoot
if (-not (Test-Path -LiteralPath $CliPath)) { throw 'Pass -CliPath pointing to the installed Playwright CLI JavaScript entry.' }
if ($DurationSeconds -lt 1200 -and -not $SmokeOnly) { throw 'A final stability run must last at least 1200 seconds.' }
if ($BuildRoot -eq '') { $BuildRoot = Join-Path $qaRoot 'dist' }
$qaBuildRoot = (Resolve-Path -LiteralPath $BuildRoot).Path
$qaSession = 'rnc-live-stability'
$qaPrefix = if ($SmokeOnly) { 'smoke-' } else { '' }
$qaSamplesPath = Join-Path $qaDir ($qaPrefix + 'stability-samples.jsonl')
$qaProgressPath = Join-Path $qaDir ($qaPrefix + 'stability-progress.json')
if (Test-Path -LiteralPath $qaSamplesPath) { throw "Evidence already exists: $qaSamplesPath. Archive the previous run before starting another." }
function Write-Json($Value, [string]$Path) { $Value | ConvertTo-Json -Depth 35 | Set-Content -LiteralPath $Path -Encoding utf8 }
function Get-BuildManifest {
  @(Get-ChildItem -LiteralPath $qaBuildRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
    @{ path=$_.FullName.Substring($qaBuildRoot.Length).TrimStart('\','/').Replace('\','/'); bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
  })
}
function Get-ManifestHash($Manifest) {
  $text = $Manifest | ConvertTo-Json -Depth 8 -Compress
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try { ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace('-','').ToLowerInvariant() }
  finally { $algorithm.Dispose() }
}
function Invoke-QaScript([string]$Path) {
  $output = & node $CliPath "-s=$qaSession" '--raw' run-code --filename $Path 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Playwright failed: $output" }
  try { ($output -join "`n") | ConvertFrom-Json }
  catch { throw "Playwright did not return JSON: $output" }
}
$qaManifest = Get-BuildManifest
$qaManifestHash = Get-ManifestHash $qaManifest
$qaSourceManifest = @(Get-ChildItem -LiteralPath (Join-Path $qaRoot 'src') -Recurse -File | Sort-Object FullName | ForEach-Object {
  @{path=$_.FullName.Substring($qaRoot.Length).TrimStart('\','/').Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
})
Write-Json $qaManifest (Join-Path $qaDir ($qaPrefix+'build-manifest.json'))
Write-Json $qaSourceManifest (Join-Path $qaDir ($qaPrefix+'source-manifest.json'))
$qaConfig = @{url=$Url;revision=$Revision;buildManifestSha256=$qaManifestHash;sourceManifestSha256=(Get-ManifestHash $qaSourceManifest);durationMinimumSeconds=$DurationSeconds;smokeOnly=[bool]$SmokeOnly;session=$qaSession}
Write-Json $qaConfig (Join-Path $qaDir ($qaPrefix+'run-config.json'))
$qaTemplate = Get-Content -LiteralPath (Join-Path $qaDir 'stability-setup.js') -Raw
$qaConfiguredSetup = Join-Path $qaDir ($qaPrefix+'configured-setup.js')
$qaTemplate.Replace('__QA_CONFIG_JSON__', ($qaConfig | ConvertTo-Json -Compress)) | Set-Content -LiteralPath $qaConfiguredSetup -Encoding utf8
$qaStep = Join-Path $qaDir 'stability-step.js'
$qaStarted = [DateTimeOffset]::UtcNow
$qaClock = [System.Diagnostics.Stopwatch]::StartNew()
try {
  & node $CliPath "-s=$qaSession" open $Url
  if ($LASTEXITCODE -ne 0) { throw 'Failed to open independent QA browser.' }
  & node $CliPath "-s=$qaSession" snapshot | Set-Content -LiteralPath (Join-Path $qaDir ($qaPrefix+'initial-snapshot.txt')) -Encoding utf8
  $qaSetupResult = Invoke-QaScript $qaConfiguredSetup
  Write-Json $qaSetupResult (Join-Path $qaDir ($qaPrefix+'stability-setup-result.json'))
  $qaClock.Restart(); $qaStarted = [DateTimeOffset]::UtcNow
  Write-Json @{status='running';startedAt=$qaStarted.ToString('o');durationMinimumSeconds=$DurationSeconds;config=$qaConfig} $qaProgressPath
  do {
    $qaSample = Invoke-QaScript $qaStep
    $qaSample | ConvertTo-Json -Depth 35 -Compress | Add-Content -LiteralPath $qaSamplesPath -Encoding utf8
    $qaElapsed = $qaClock.Elapsed.TotalSeconds
    Write-Json @{status='running';startedAt=$qaStarted.ToString('o');actualElapsedSeconds=$qaElapsed;browserElapsedSeconds=$qaSample.state.elapsedSeconds;restarts=$qaSample.state.restarts;switches=$qaSample.state.switches;mode=$qaSample.state.mode;time=$qaSample.state.time;currentRun=$qaSample.state.currentRun;config=$qaConfig} $qaProgressPath
    Write-Output ("[{0:N1}s] {1}, {2}, restarts={3}, switches={4}, activeAudio={5}, queued={6}, heapMiB={7:N1}" -f $qaElapsed,$qaSample.state.mode,$qaSample.state.time,$qaSample.state.restarts,$qaSample.state.switches,$qaSample.state.audio.activeSources,$qaSample.state.queuedSeconds,($qaSample.heap.usedSize/1MB))
    if ($qaSample.failure) { throw 'A browser invariant failed; the failing sample was preserved.' }
    if ($qaElapsed -lt $DurationSeconds) { Start-Sleep -Seconds 10 }
  } while ($qaElapsed -lt $DurationSeconds)
  $qaFinalManifest = Get-BuildManifest
  $qaFinalHash = Get-ManifestHash $qaFinalManifest
  Write-Json $qaFinalManifest (Join-Path $qaDir ($qaPrefix+'build-manifest-after.json'))
  if ($qaFinalHash -ne $qaManifestHash) { throw 'Production assets changed during the run; evidence cannot prove one frozen build.' }
  & node $CliPath "-s=$qaSession" run-code 'async page => { await page.evaluate(() => scrollTo(0,0)); return {at:new Date().toISOString()}; }'
  & node $CliPath "-s=$qaSession" screenshot --filename (Join-Path $qaDir ($qaPrefix+'stability-finished.png'))
  Write-Json @{status='completed';startedAt=$qaStarted.ToString('o');endedAt=[DateTimeOffset]::UtcNow.ToString('o');actualElapsedSeconds=$qaElapsed;browserElapsedSeconds=$qaSample.state.elapsedSeconds;restarts=$qaSample.state.restarts;switches=$qaSample.state.switches;buildUnchanged=$true;config=$qaConfig} $qaProgressPath
  & node (Join-Path $qaDir 'summarize-stability.mjs') $qaPrefix
  if ($LASTEXITCODE -ne 0) { throw 'Evidence summary did not meet its declared gates.' }
} catch {
  Write-Json @{status='failed';startedAt=$qaStarted.ToString('o');endedAt=[DateTimeOffset]::UtcNow.ToString('o');actualElapsedSeconds=$qaClock.Elapsed.TotalSeconds;error=$_.Exception.Message;config=$qaConfig} $qaProgressPath
  Write-Error $_
} finally {
  $qaClock.Stop()
  & node $CliPath "-s=$qaSession" console error | Set-Content -LiteralPath (Join-Path $qaDir ($qaPrefix+'browser-console.txt')) -Encoding utf8
  & node $CliPath "-s=$qaSession" close
}
