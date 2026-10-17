. "$PSScriptRoot/metrics.ps1"
$ErrorActionPreference='Stop'
$delta=Get-DesktopCpuDelta -Before 0.5 -After 0.625
if([math]::Abs($delta-0.125) -gt 0.000001){throw "Fractional CPU time was lost: $delta"}
if((Get-DesktopCpuDelta -Before 2 -After 1) -ne 0){throw 'Reset counters must not yield negative CPU.'}
if((Get-DesktopCpuPercent -CpuSeconds 1.5 -ElapsedSeconds 3 -LogicalProcessors 2) -ne 25){throw 'CPU normalization is incorrect.'}
$rejected=$false
try{Get-DesktopCpuPercent -CpuSeconds 1 -ElapsedSeconds 0 -LogicalProcessors 2}catch{$rejected=$true}
if(-not $rejected){throw 'A zero interval must be rejected.'}
'CPU measurement regressions passed.'
