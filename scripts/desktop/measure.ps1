param([ValidateSet('Tray','Window')][string]$Mode='Tray',[ValidateRange(10,300)][int]$Seconds=60,[string]$Executable='target/release/rift-build-lab.exe',[string]$Output='output/desktop-performance')
$ErrorActionPreference='Stop'
. "$PSScriptRoot/metrics.ps1"
# Startup registration is shared OS state, even when app-data directories are isolated.
# Refuse to launch a seeded startup-off profile if it could change an existing registration.
$startupKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if(Test-Path -LiteralPath $startupKey) {
 $startupNames=(Get-Item -LiteralPath $startupKey).GetValueNames()
 $productName=(Get-Content -LiteralPath 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).productName
 if($productName -in $startupNames -or 'rift-build-lab' -in $startupNames){throw 'Disable Rift Build Lab Windows startup in its own settings before isolated measurement; an existing registration must not be altered by this test.'}
}
$exe=(Resolve-Path -LiteralPath $Executable).Path
if(Get-Process -Name 'rift-build-lab' -ErrorAction SilentlyContinue){throw 'Close existing Rift Build Lab windows before isolated measurement.'}
$root=(Resolve-Path '.').Path
$runRoot=[IO.Path]::GetFullPath((Join-Path $root "$Output/$Mode"))
if(-not $runRoot.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Measurement output must stay inside the workspace.'}
$roaming=Join-Path $runRoot 'roaming';$local=Join-Path $runRoot 'local'
$profileReused=Test-Path -LiteralPath $runRoot
New-Item -ItemType Directory -Force -Path (Join-Path $roaming 'RiftBuildLab'),$local | Out-Null
$preferences=@{schema=1;autoImport=@{enabled=$false;items=$true;runes=$true;metaFallback=$false};background=@{trayOnClose=($Mode -eq 'Tray');startWithWindows=$false};defaults=@{};lastApplied=$null;lastFailure=$null}
$preferences | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $roaming 'RiftBuildLab/preferences.json')
$launchArgs=if($Mode -eq 'Tray'){@('--background')}else{@()}
function Get-AppFiles {
 $result=@{}
 foreach($base in @($roaming,$local)) {
  Get-ChildItem -LiteralPath $base -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object { $result[$_.FullName]="$($_.Length)/$($_.LastWriteTimeUtc.Ticks)" }
 }
 return $result
}
$webviewProfile=Join-Path $local 'webview2'
$filesBefore=Get-AppFiles
$launchTimer=[Diagnostics.Stopwatch]::StartNew()
$startOptions=@{FilePath=$exe;WindowStyle='Hidden';PassThru=$true;Environment=@{APPDATA=$roaming;LOCALAPPDATA=$local;WEBVIEW2_USER_DATA_FOLDER=$webviewProfile;RBL_MEMORY_DIAGNOSTICS='1'}}
$startOptions.RedirectStandardError=Join-Path $runRoot 'native-memory.log'
if($launchArgs.Count){$startOptions.ArgumentList=$launchArgs}
$app=Start-Process @startOptions
$webviewVersion=$null;$cpuBefore=@{};$rows=@();$logical=[Environment]::ProcessorCount;$startupWebviewSeconds=$null
try {
 for($n=0;$n -lt $Seconds;$n++) {
  Start-Sleep -Seconds 1
  if($app.HasExited){throw "Desktop exited unexpectedly ($($app.ExitCode))."}
  $inventory=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name,CommandLine)
  $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add($app.Id)
  do {$added=$false;foreach($process in $inventory){if($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)){[void]$ids.Add([int]$process.ProcessId);$added=$true}}}while($added)
  $nativeBytes=0L;$webviewBytes=0L;$privateBytes=0L;$cpuDelta=0.0;$webviews=0;$processRows=@()
  foreach($id in $ids){
   $process=Get-Process -Id $id -ErrorAction SilentlyContinue;if(-not $process){continue}
   $kind='native'
   if($id -ne $app.Id) {
    $kind='browser'
    $command=($inventory | Where-Object ProcessId -eq $id | Select-Object -First 1).CommandLine
    if($command -match '--type=([^ ]+)'){$kind=$Matches[1]}
   }
   $processRows += [pscustomobject]@{kind=$kind;processId=$id;startTicks=$process.StartTime.Ticks;workingSetMiB=$process.WorkingSet64/1MB;privateMiB=$process.PrivateMemorySize64/1MB;cpuTotalSeconds=$process.TotalProcessorTime.TotalSeconds}
   $privateBytes += $process.PrivateMemorySize64
   $key="$id/$($process.StartTime.Ticks)";$cpu=$process.TotalProcessorTime.TotalSeconds
   if($cpuBefore.ContainsKey($key)){$cpuDelta += (Get-DesktopCpuDelta -Before $cpuBefore[$key] -After $cpu)};$cpuBefore[$key]=$cpu
   if($id -eq $app.Id){$nativeBytes += $process.WorkingSet64}else{if($process.ProcessName -eq 'msedgewebview2'){if(-not $webviewVersion){$webviewVersion=$process.MainModule.FileVersionInfo.ProductVersion};$webviewBytes += $process.WorkingSet64;$webviews++}}
  }
  if($webviews -gt 0 -and $null -eq $startupWebviewSeconds){$startupWebviewSeconds=$launchTimer.Elapsed.TotalSeconds}
  $rows += [pscustomobject]@{sample=$n;timeMsUtc=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();elapsedSeconds=$launchTimer.Elapsed.TotalSeconds;cpuSecondsDelta=$cpuDelta;nativeMiB=$nativeBytes/1MB;webviewMiB=$webviewBytes/1MB;webviewProcesses=$webviews;privateMiB=$privateBytes/1MB;processes=$processRows}
 }
 $filesAfter=Get-AppFiles
 $changedFiles=@($filesAfter.Keys | Where-Object { -not $filesBefore.ContainsKey($_) -or $filesBefore[$_] -ne $filesAfter[$_] } | ForEach-Object { $_.Substring($runRoot.Length+1) })
 $interval=$rows[-1].elapsedSeconds-$rows[0].elapsedSeconds
 $cpuPercent=Get-DesktopCpuPercent -CpuSeconds (($rows | Select-Object -Skip 1 | Measure-Object cpuSecondsDelta -Sum).Sum) -ElapsedSeconds $interval -LogicalProcessors $logical
 $memoryTargets=@(Get-Content -LiteralPath (Join-Path $runRoot 'native-memory.log') -ErrorAction SilentlyContinue | ForEach-Object {
  if($_ -match '^RBL_MEMORY time=(\d+) target=(normal|low) applied=(true|false)$'){[pscustomobject]@{timeMsUtc=[long]$Matches[1];target=$Matches[2];applied=($Matches[3] -eq 'true')}}
 })
 $result=[ordered]@{mode=$Mode;samples=$Seconds;durationSeconds=$interval;exe=$exe;appVersion=(Get-Item $exe).VersionInfo.ProductVersion;windows=[Environment]::OSVersion.VersionString;webviewVersion=$webviewVersion;launchProfile=$(if($profileReused){"reused isolated data directory"}else{"new isolated data directory"});changedAppDataFileCount=$changedFiles.Count;changedAppDataFiles=$changedFiles;logicalProcessors=$logical;cpuName=(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name);averageCpuPercent=$cpuPercent;averagePrivateMiB=($rows | Measure-Object privateMiB -Average).Average;averageNativeMiB=($rows | Measure-Object nativeMiB -Average).Average;averageWebviewMiB=($rows | Measure-Object webviewMiB -Average).Average;maxWebviewProcesses=($rows | Measure-Object webviewProcesses -Maximum).Maximum;secondsUntilWebviewProcess=$startupWebviewSeconds;memoryTargets=$memoryTargets;uiReadyTimeMeasured=$false;leagueLobbyMeasured=$false;notes='Isolated user data; auto-import off. Working sets can double-count shared runtime pages. Process discovery is not UI-ready timing.';rows=$rows}
 $result | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $runRoot 'measurement.json')
 $result.Remove('rows');$result.Remove('changedAppDataFiles');$result | ConvertTo-Json -Depth 3
} finally {
 if(-not $app.HasExited){Stop-Process -Id $app.Id -ErrorAction SilentlyContinue}
}
