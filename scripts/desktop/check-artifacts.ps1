param([string]$BundleRoot='target/release/bundle/nsis',[string]$Snapshot='dist-desktop-data',[string]$Output='output/desktop-release',[switch]$RequireSignature)
$ErrorActionPreference='Stop'
$workspaceRoot=(Resolve-Path '.').Path
$bundlePath=(Resolve-Path -LiteralPath $BundleRoot).Path
$files=@(Get-ChildItem -LiteralPath $bundlePath -Filter '*-setup.exe' -File)
if($files.Count -ne 1){throw 'Expected exactly one Windows setup executable.'}
$setup=$files[0]
if($setup.Length -gt 30MB){throw "Installer exceeds 30 MiB: $($setup.Length) bytes"}
$expected=(Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
if((Get-Content -LiteralPath package.json -Raw | ConvertFrom-Json).version -ne $expected){throw 'Frontend and desktop versions differ.'}
$manifest=Get-Content -LiteralPath (Join-Path $Snapshot 'desktop/manifest.json') -Raw | ConvertFrom-Json
$listed=@($manifest.files.path)+@('desktop/manifest.json')
$snapshotPath=(Resolve-Path -LiteralPath $Snapshot).Path
foreach($file in Get-ChildItem -LiteralPath $snapshotPath -File -Recurse){
 $relative=$file.FullName.Substring($snapshotPath.Length+1).Replace('\','/')
 if($relative -notin $listed){throw "Unlisted desktop resource: $relative"}
 if($file.Extension -ne '.json'){throw "Unexpected desktop runtime resource: $relative"}
}
foreach($entry in $manifest.files){
 $file=Get-Item -LiteralPath (Join-Path $snapshotPath $entry.path)
 if($file.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw "Resource does not match manifest: $($entry.path)"}
}
$outputPath=[IO.Path]::GetFullPath((Join-Path $workspaceRoot $Output))
if(-not $outputPath.StartsWith($workspaceRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Release output must stay inside this workspace.'}
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
# Release assets get a space-free name so download URLs (and the updater's latest.json) are predictable.
$assetName="rift-build-lab_$($expected)_x64-setup.exe"
Copy-Item -LiteralPath $setup.FullName -Destination (Join-Path $outputPath $assetName)
$signature="$($setup.FullName).sig"
$signed=Test-Path -LiteralPath $signature
if($RequireSignature -and -not $signed){throw 'Updater signature (.sig) is missing; was the signing key provided?'}
if($signed){Copy-Item -LiteralPath $signature -Destination (Join-Path $outputPath "$assetName.sig")}
$hash=(Get-FileHash -LiteralPath $setup.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $assetName" | Set-Content -Encoding ascii -LiteralPath (Join-Path $outputPath "$assetName.sha256")
@{version=$expected;installer=$assetName;patch=$manifest.patch;dataRevision=$manifest.revision;bytes=$setup.Length;sha256=$hash;liveClientVerified=$false;signed=$false;updaterSignature=$signed} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $outputPath 'desktop-manifest.json')
Write-Output "Verified desktop package $expected ($([math]::Round($setup.Length/1MB,2)) MiB)."
