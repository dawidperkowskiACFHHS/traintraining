$ErrorActionPreference = 'Stop'
$workspacePath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releasePath = Join-Path $workspacePath 'releases/Last-Stop-Windows'
$releaseParent = Split-Path -Parent $releasePath
if ((Test-Path -LiteralPath $releaseParent) -and ((Get-Item -LiteralPath $releaseParent).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'Release parent must not be a link.' }
$resolvedRelease = [System.IO.Path]::GetFullPath($releasePath)
if (-not $resolvedRelease.StartsWith($workspacePath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolvedRelease) -ne 'Last-Stop-Windows') { throw 'Unexpected release output path.' }
if (Test-Path -LiteralPath $resolvedRelease) {
  if ((Get-Item -LiteralPath $resolvedRelease).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Release output must not be a link.' }
  Remove-Item -LiteralPath $resolvedRelease -Recurse -Force
}
New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) { throw 'The Windows .NET Framework compiler is required to package this build.' }
$launcherSource = Join-Path $workspacePath 'release/windows/Launcher.cs'
$launcherOutput = Join-Path $releasePath 'Last Stop.exe'
$launcherIcon = Join-Path $workspacePath 'release/windows/LastStop.ico'
& $compilerPath /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll "/win32icon:$launcherIcon" "/out:$launcherOutput" $launcherSource
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Copy-Item -LiteralPath (Join-Path $workspacePath 'dist') -Destination (Join-Path $releasePath 'game') -Recurse -Force
foreach ($name in @('LICENSE','THIRD_PARTY_NOTICES.md')) { Copy-Item -LiteralPath (Join-Path $workspacePath $name) -Destination $releasePath -Force }
Copy-Item -LiteralPath (Join-Path $workspacePath 'release/START-HERE.txt') -Destination $releasePath -Force
Copy-Item -LiteralPath (Join-Path $workspacePath 'docs/PLAYTEST.md') -Destination $releasePath -Force
Copy-Item -LiteralPath (Join-Path $workspacePath 'docs/BALANCE.md') -Destination $releasePath -Force
Copy-Item -LiteralPath (Join-Path $workspacePath 'docs/QUICK-MATCH.md') -Destination $releasePath -Force
Copy-Item -LiteralPath (Join-Path $workspacePath 'release/feedback.html') -Destination $releasePath -Force
$archivePath = Join-Path $workspacePath 'releases/Last-Stop-Windows.zip'
Compress-Archive -Path (Join-Path $releasePath '*') -DestinationPath $archivePath -Force
$archiveStream = [System.IO.File]::OpenRead($archivePath)
$hashProvider = [System.Security.Cryptography.SHA256]::Create()
try { $checksum = [System.BitConverter]::ToString($hashProvider.ComputeHash($archiveStream)).Replace('-', '').ToLowerInvariant() }
finally { $archiveStream.Dispose(); $hashProvider.Dispose() }
"$checksum  Last-Stop-Windows.zip" | Set-Content -LiteralPath (Join-Path $workspacePath 'releases/SHA256SUMS.txt') -Encoding ASCII
Write-Output "Release: $archivePath"
