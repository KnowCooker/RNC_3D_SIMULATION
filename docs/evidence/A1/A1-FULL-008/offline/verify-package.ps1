param([string]$Candidate = 'rnc-lab-abf1d2eac6e2')

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../../..')).Path
$taskDirectory = Join-Path $taskRoot "release/$Candidate"
$taskArchivePath = "$taskDirectory.zip"
$taskManifestPath = Join-Path $taskDirectory 'candidate-manifest.json'
$taskManifest = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
if ($taskManifest.candidate -ne $Candidate) { throw 'Manifest candidate identity differs' }
$taskExpected = @{}
foreach ($taskProperty in $taskManifest.contents.PSObject.Properties) {
  $taskExpected[$taskProperty.Name] = $taskProperty.Value
}
foreach ($taskRelative in $taskExpected.Keys) {
  $taskActual = (Get-FileHash -LiteralPath (Join-Path $taskDirectory $taskRelative) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($taskActual -ne $taskExpected[$taskRelative]) { throw "Directory content mismatch: $taskRelative" }
}
$taskManifestHash = (Get-FileHash -LiteralPath $taskManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$taskExpected['candidate-manifest.json'] = $taskManifestHash

Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [System.IO.Compression.ZipFile]::OpenRead($taskArchivePath)
$taskSeen = @{}
try {
  foreach ($taskEntry in $taskArchive.Entries) {
    if ($taskEntry.Name -eq '') { continue }
    $taskRelative = $taskEntry.FullName.Replace('\', '/').Substring("$Candidate/".Length)
    if (-not $taskExpected.ContainsKey($taskRelative)) { throw "Unexpected archive entry: $taskRelative" }
    if ($taskSeen.ContainsKey($taskRelative)) { throw "Duplicate archive entry: $taskRelative" }
    $taskStream = $taskEntry.Open()
    $taskHasher = [System.Security.Cryptography.SHA256]::Create()
    try { $taskHash = [Convert]::ToHexString($taskHasher.ComputeHash($taskStream)).ToLowerInvariant() }
    finally { $taskStream.Dispose(); $taskHasher.Dispose() }
    if ($taskHash -ne $taskExpected[$taskRelative]) { throw "Archive content mismatch: $taskRelative" }
    $taskSeen[$taskRelative] = $true
  }
} finally { $taskArchive.Dispose() }
if ($taskSeen.Count -ne $taskExpected.Count) { throw "Archive contains $($taskSeen.Count) of $($taskExpected.Count) expected files" }

$taskDistRoot = Join-Path $taskRoot 'dist'
$taskDistFiles = @(Get-ChildItem -LiteralPath $taskDistRoot -Recurse -File)
foreach ($taskFile in $taskDistFiles) {
  $taskRelative = 'dist/' + [IO.Path]::GetRelativePath($taskDistRoot, $taskFile.FullName).Replace('\', '/')
  if (-not $taskExpected.ContainsKey($taskRelative)) { throw "Build file omitted from package: $taskRelative" }
  $taskHash = (Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($taskHash -ne $taskExpected[$taskRelative]) { throw "Build differs from package: $taskRelative" }
}
if ($taskDistFiles.Count -ne $taskManifest.distFiles) { throw 'Build file count differs from manifest' }

[ordered]@{
  passed = $true
  sourceCommit = $taskManifest.sourceCommit
  distDigest = $taskManifest.distDigest
  checkedBuildFiles = $taskDistFiles.Count
  checkedPackageFiles = $taskExpected.Count
  checkedArchiveFiles = $taskSeen.Count
  manifestSha256 = $taskManifestHash
  zipSha256 = (Get-FileHash -LiteralPath $taskArchivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  zipBytes = (Get-Item -LiteralPath $taskArchivePath).Length
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'integrity-results.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'integrity-results.json') -Raw
