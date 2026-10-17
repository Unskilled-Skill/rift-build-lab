function Get-DesktopCpuDelta([double]$Before,[double]$After) {
 return [math]::Max(0.0,$After-$Before)
}
function Get-DesktopCpuPercent([double]$CpuSeconds,[double]$ElapsedSeconds,[int]$LogicalProcessors) {
 if($ElapsedSeconds -le 0 -or $LogicalProcessors -le 0){throw 'CPU measurement needs a positive interval and processor count.'}
 return $CpuSeconds/$ElapsedSeconds/$LogicalProcessors*100
}
