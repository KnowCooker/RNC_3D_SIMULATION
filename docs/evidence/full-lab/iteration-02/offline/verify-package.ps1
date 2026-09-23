$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$taskCandidate = Join-Path $taskRoot 'release/lab-v3-c2e43d7994ac'
$taskManifest = Get-Content -LiteralPath (Join-Path $taskCandidate 'candidate-manifest.json') -Raw | ConvertFrom-Json
$taskVersion = Get-Content -LiteralPath (Join-Path $taskCandidate 'frozen-version.json') -Raw | ConvertFrom-Json
$taskExpected = @{}
foreach ($taskProperty in $taskManifest.contents.PSObject.Properties) { $taskExpected[$taskProperty.Name] = $taskProperty.Value }
$taskExpected['candidate-manifest.json'] = (Get-FileHash -LiteralPath (Join-Path $taskCandidate 'candidate-manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()
foreach ($taskPath in $taskExpected.Keys) {
  $taskActual = (Get-FileHash -LiteralPath (Join-Path $taskCandidate $taskPath) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($taskActual -ne $taskExpected[$taskPath]) { throw "Package content mismatch: $taskPath" }
}
foreach ($taskProperty in $taskVersion.dist.PSObject.Properties) {
  $taskHash = (Get-FileHash -LiteralPath (Join-Path $taskCandidate $taskProperty.Name) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($taskHash -ne $taskProperty.Value) { throw "Frozen dist mismatch: $($taskProperty.Name)" }
}
$taskZip = "$taskCandidate.zip"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [System.IO.Compression.ZipFile]::OpenRead($taskZip)
$taskArchiveFiles = 0
try {
  foreach ($taskEntry in $taskArchive.Entries) {
    if ($taskEntry.Name -eq '') { continue }
    $taskPath = $taskEntry.FullName.Replace('\','/').Substring('lab-v3-c2e43d7994ac/'.Length)
    if (-not $taskExpected.ContainsKey($taskPath)) { throw "Unexpected archive entry $taskPath" }
    $taskStream = $taskEntry.Open()
    $taskHasher = [System.Security.Cryptography.SHA256]::Create()
    try { $taskHash = [Convert]::ToHexString($taskHasher.ComputeHash($taskStream)).ToLowerInvariant() }
    finally { $taskStream.Dispose(); $taskHasher.Dispose() }
    if ($taskHash -ne $taskExpected[$taskPath]) { throw "Archive content mismatch: $taskPath" }
    $taskArchiveFiles++
  }
} finally { $taskArchive.Dispose() }
if ($taskArchiveFiles -ne $taskExpected.Count) { throw 'Archive omitted package files' }
[ordered]@{ passed=$true; sourceDigest=$taskManifest.sourceDigest; checkedPackageFiles=$taskExpected.Count; checkedFrozenDistFiles=@($taskVersion.dist.PSObject.Properties).Count; checkedArchiveFiles=$taskArchiveFiles; zipSha256=(Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant(); manifestSha256=$taskExpected['candidate-manifest.json']; bytes=(Get-Item -LiteralPath $taskZip).Length } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'integrity-results.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'integrity-results.json') -Raw
