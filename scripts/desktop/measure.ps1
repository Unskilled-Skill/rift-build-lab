param([ValidateSet('Tray','Window')][string]$Mode='Tray',[ValidateRange(10,300)][int]$Seconds=60,[string]$Executable='target/release/rift-build-lab.exe',[string]$Output='output/desktop-performance')
$ErrorActionPreference='Stop'
$exe=(Resolve-Path -LiteralPath $Executable).Path
if(Get-Process -Name 'rift-build-lab' -ErrorAction SilentlyContinue){throw 'Close existing Rift Build Lab windows before isolated measurement.'}
$root=(Resolve-Path '.').Path
$runRoot=[IO.Path]::GetFullPath((Join-Path $root "$Output/$Mode"))
if(-not $runRoot.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Measurement output must stay inside the workspace.'}
$roaming=Join-Path $runRoot 'roaming';$local=Join-Path $runRoot 'local'
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
$filesBefore=Get-AppFiles
$launchTimer=[Diagnostics.Stopwatch]::StartNew()
$startOptions=@{FilePath=$exe;WindowStyle='Hidden';PassThru=$true;Environment=@{APPDATA=$roaming;LOCALAPPDATA=$local}}
if($launchArgs.Count){$startOptions.ArgumentList=$launchArgs}
$app=Start-Process @startOptions
$webviewVersion=$null;$cpuBefore=@{};$rows=@();$logical=[Environment]::ProcessorCount;$startupWebviewSeconds=$null
try {
 for($n=0;$n -lt $Seconds;$n++) {
  Start-Sleep -Seconds 1
  if($app.HasExited){throw "Desktop exited unexpectedly ($($app.ExitCode))."}
  $inventory=@(Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,Name)
  $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add($app.Id)
  do {$added=$false;foreach($process in $inventory){if($ids.Contains([int]$process.ParentProcessId) -and -not $ids.Contains([int]$process.ProcessId)){[void]$ids.Add([int]$process.ProcessId);$added=$true}}}while($added)
  $nativeBytes=0L;$webviewBytes=0L;$cpuDelta=0.0;$webviews=0
  foreach($id in $ids){
   $process=Get-Process -Id $id -ErrorAction SilentlyContinue;if(-not $process){continue}
   $key="$id/$($process.StartTime.Ticks)";$cpu=$process.TotalProcessorTime.TotalSeconds
   if($cpuBefore.ContainsKey($key)){$cpuDelta += [math]::Max(0,$cpu-$cpuBefore[$key])};$cpuBefore[$key]=$cpu
   if($id -eq $app.Id){$nativeBytes += $process.WorkingSet64}else{if($process.ProcessName -eq 'msedgewebview2'){if(-not $webviewVersion){$webviewVersion=$process.MainModule.FileVersionInfo.ProductVersion};$webviewBytes += $process.WorkingSet64;$webviews++}}
  }
  if($webviews -gt 0 -and $null -eq $startupWebviewSeconds){$startupWebviewSeconds=$launchTimer.Elapsed.TotalSeconds}
  $rows += [pscustomobject]@{sample=$n;elapsedSeconds=$launchTimer.Elapsed.TotalSeconds;cpuSecondsDelta=$cpuDelta;nativeMiB=$nativeBytes/1MB;webviewMiB=$webviewBytes/1MB;webviewProcesses=$webviews}
 }
 $filesAfter=Get-AppFiles
 $changedFiles=@($filesAfter.Keys | Where-Object { -not $filesBefore.ContainsKey($_) -or $filesBefore[$_] -ne $filesAfter[$_] } | ForEach-Object { $_.Substring($runRoot.Length+1) })
 $interval=$rows[-1].elapsedSeconds-$rows[0].elapsedSeconds
 $cpuPercent=(($rows | Select-Object -Skip 1 | Measure-Object cpuSecondsDelta -Sum).Sum)/$interval/$logical*100
 $result=[ordered]@{mode=$Mode;samples=$Seconds;exe=$exe;appVersion=(Get-Item $exe).VersionInfo.ProductVersion;windows=[Environment]::OSVersion.VersionString;webviewVersion=$webviewVersion;launchProfile="fresh isolated user data";changedAppDataFiles=$changedFiles;logicalProcessors=$logical;cpuName=(Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name);averageCpuPercent=$cpuPercent;averageNativeMiB=($rows | Measure-Object nativeMiB -Average).Average;averageWebviewMiB=($rows | Measure-Object webviewMiB -Average).Average;maxWebviewProcesses=($rows | Measure-Object webviewProcesses -Maximum).Maximum;secondsUntilWebviewProcess=$startupWebviewSeconds;uiReadyTimeMeasured=$false;leagueLobbyMeasured=$false;notes='Isolated user data; auto-import off. Working sets can double-count shared runtime pages. Process discovery is not UI-ready timing.';rows=$rows}
 $result | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $runRoot 'measurement.json')
 $result.Remove('rows');$result | ConvertTo-Json -Depth 3
} finally {
 if(-not $app.HasExited){Stop-Process -Id $app.Id -ErrorAction SilentlyContinue}
}
