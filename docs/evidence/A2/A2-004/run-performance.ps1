param(
    [string]$Url = 'http://127.0.0.1:4173/',
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{7,40}$')][string]$CodeCommit,
    [string]$CliPath,
    [string]$OutputDirectory,
    [switch]$Headless
)
$ErrorActionPreference = 'Stop'
$node = (Get-Command node -ErrorAction Stop).Source
$npx = if (!$CliPath) { (Get-Command npx.cmd -ErrorAction Stop).Source }
if ($CliPath) { $CliPath = (Resolve-Path -LiteralPath $CliPath).Path }
$session = 'a2-perf-' + [Guid]::NewGuid().ToString('N').Substring(0, 10)
if (!$OutputDirectory) {
    $OutputDirectory = Join-Path (Get-Location) ('output/playwright/' + $session)
}
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Use a new output directory to preserve previous evidence.' }
$outputPath = (New-Item -ItemType Directory -Path $OutputDirectory).FullName
$utf8 = [System.Text.UTF8Encoding]::new($false)
function Save-Text([string]$Name, [string]$Value) {
    [IO.File]::WriteAllText((Join-Path $outputPath $Name), $Value, $utf8)
}
function Invoke-Browser([string[]]$Arguments) {
    if ($CliPath) { $lines = & $node $CliPath "-s=$session" @Arguments }
    else { $lines = & $npx --yes --package '@playwright/cli@0.1.21' playwright-cli "-s=$session" @Arguments }
    if ($LASTEXITCODE -ne 0) { throw "Playwright failed: $($Arguments -join ' ')" }
    return ($lines -join "`n")
}
$opened = $false
try {
    $openArgs = @('open', $Url, '--browser=chrome')
    if (!$Headless) { $openArgs += '--headed' }
    $opened = $true
    Save-Text 'open.txt' (Invoke-Browser $openArgs)
    Save-Text 'snapshot.txt' (Invoke-Browser @('snapshot'))
    $raw = Invoke-Browser @('--raw', 'run-code', '--filename', (Join-Path $PSScriptRoot 'browser-performance.js'))
    Save-Text 'browser-result.json' $raw
    $result = $raw | ConvertFrom-Json
    if (!$result.environment -or !$result.defaultView -or !$result.expandedView) { throw 'Missing browser performance result.' }
    $sizeOk = ($result.environment.buffer -join 'x') -eq '1280x720' -and ($result.environment.viewport -join 'x') -eq '1920x1080'
    $durationOk = $result.defaultView.elapsedMs -ge 15000 -and $result.expandedView.elapsedMs -ge 15000
    $fpsOk = $result.defaultView.averageFps -ge 30 -and $result.expandedView.averageFps -ge 30
    $geometryOk = $result.defaultView.maxRenderedTriangles -gt 0 -and $result.defaultView.maxRenderedTriangles -lt 50000 -and $result.expandedView.maxRenderedTriangles -gt 0 -and $result.expandedView.maxRenderedTriangles -lt 50000
    $summary = [ordered]@{
        measuredAtUtc = [DateTime]::UtcNow.ToString('o')
        testedCodeCommit = $CodeCommit
        url = $Url
        headed = !$Headless
        cliVersion = '0.1.21 (when using npx; explicit CliPath version recorded below)'
        cliReportedVersion = (Invoke-Browser @('--version'))
        nodeVersion = (& $node --version)
        gpu = $result.environment.gpu
        dimensionsMatch = $sizeOk
        durationMatch = $durationOk
        bothScenesAtLeast30Fps = $fpsOk
        geometryWithinBudget = $geometryOk
        localPerformancePassed = $sizeOk -and $durationOk -and $fpsOk -and $geometryOk
        targetIntegratedGpuAcceptance = 'pending explicit target-device and renderer verification; local pass alone is insufficient'
    }
    Save-Text 'summary.json' ($summary | ConvertTo-Json -Depth 6)
    Save-Text 'screenshot.txt' (Invoke-Browser @('screenshot', '--filename', (Join-Path $outputPath 'expanded.png')))
    if (!$summary.localPerformancePassed) { throw 'Performance criteria not met; inspect the saved result and actual GPU before changing viewer code.' }
    Write-Output "Local performance passed. Evidence: $outputPath"
} finally {
    if ($opened) { Invoke-Browser @('close') | Out-Null }
}
