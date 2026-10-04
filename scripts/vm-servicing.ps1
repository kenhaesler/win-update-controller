[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Helper,
    [ValidateSet('Capture', 'Download', 'Install', 'EnableManual', 'RestorePolicy')][string]$Phase = 'Capture',
    [string]$UpdatesFile,
    [string]$DisposableVmMarker,
    [switch]$ConfirmDisposableVm,
    [switch]$AcceptLicenses
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$helperPath = (Resolve-Path -LiteralPath $Helper).Path
if ([IO.Path]::GetFileName($helperPath) -ne 'UpdateController.Helper.exe') { throw 'Provide the built or installed helper executable.' }
$repoRoot = Split-Path $PSScriptRoot -Parent
$evidenceDir = Join-Path $repoRoot ".artifacts/vm-$([guid]::NewGuid())"
$machine = Get-CimInstance Win32_ComputerSystem
$machineGuid = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
if ($Phase -ne 'Capture') {
    if (!$ConfirmDisposableVm -or !$DisposableVmMarker) { throw 'Mutation requires a disposable VM marker and -ConfirmDisposableVm.' }
    $marker = Get-Content -LiteralPath $DisposableVmMarker -Raw | ConvertFrom-Json
    if ($marker.machineGuid -ne $machineGuid -or $marker.purpose -ne 'update-controller-disposable-servicing' -or !$marker.snapshot) { throw 'Marker must identify this disposable VM and its clean snapshot.' }
    if (($machine.Manufacturer + ' ' + $machine.Model) -notmatch 'Virtual|VMware|QEMU|KVM|Parallels|VirtualBox|Xen') { throw 'Mutation rejected: this machine does not identify itself as virtual.' }
}
New-Item -ItemType Directory -Path $evidenceDir | Out-Null
$writer = [IO.StreamWriter]::new((Join-Path $evidenceDir 'requests.jsonl'), $false, [Text.UTF8Encoding]::new($false))
$writer.AutoFlush = $true
function Record([object]$Data) { $writer.WriteLine(($Data | ConvertTo-Json -Depth 40 -Compress)) }
function Request([hashtable]$Data) {
    Record @{ at = (Get-Date).ToUniversalTime().ToString('o'); request = $Data }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $helperPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $process = [Diagnostics.Process]::Start($start)
    try {
        $process.StandardInput.WriteLine(($Data | ConvertTo-Json -Depth 20 -Compress))
        $process.StandardInput.Close()
        $final = $null
        while (!$process.StandardOutput.EndOfStream) {
            $frame = $process.StandardOutput.ReadLine() | ConvertFrom-Json
            Record @{ at = (Get-Date).ToUniversalTime().ToString('o'); response = $frame }
            if ($frame.PSObject.Properties.Name -contains 'ok') { $final = $frame }
        }
        $process.WaitForExit()
        if (!$final) { throw 'No final helper result. Inspect VM history before retrying; a worker may still be servicing.' }
        if (!$final.ok) { throw "Helper rejected request: $($final.error) ($($final.code))" }
        return $final.data
    } finally { $process.Dispose() }
}
try {
    Record @{ phase = $Phase; machine = $machine.Name; manufacturer = $machine.Manufacturer; model = $machine.Model; machineGuid = $machineGuid; helperSha256 = (Get-FileHash $helperPath -Algorithm SHA256).Hash }
    $before = Request @{ command = 'status' }
    $before | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $evidenceDir 'status-before.json')
    Request @{ command = 'history' } | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $evidenceDir 'history-before.json')
    $scan = Request @{ command = 'scan' }
    $scan | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $evidenceDir 'scan.json')
    if ($Phase -in @('Download', 'Install')) {
        if (!$UpdatesFile) { throw 'Supply reviewed exact identity/revision pairs in -UpdatesFile.' }
        $updates = @(Get-Content -LiteralPath $UpdatesFile -Raw | ConvertFrom-Json)
        $action = $Phase.ToLowerInvariant()
        $review = Request @{ command = 'review'; action = $action; updates = $updates }
        $review | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $evidenceDir 'review.json')
        Write-Host ($review | ConvertTo-Json -Depth 40)
        if ($review.licenses.Count -gt 0 -and !$AcceptLicenses) { throw 'Review the saved license text and rerun with -AcceptLicenses only if accepted.' }
        # Review validation in the helper resolves exact revisions again before mutation.
        Request @{ command = $action; updates = $updates; reviewToken = $review.reviewToken; acceptLicenses = [bool]$AcceptLicenses } | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $evidenceDir 'operation.json')
    } elseif ($Phase -eq 'EnableManual') {
        Request @{ command = 'enableManual' } | ConvertTo-Json -Depth 30 | Set-Content (Join-Path $evidenceDir 'operation.json')
    } elseif ($Phase -eq 'RestorePolicy') {
        Request @{ command = 'restorePolicy' } | ConvertTo-Json -Depth 30 | Set-Content (Join-Path $evidenceDir 'operation.json')
    }
    Request @{ command = 'status' } | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $evidenceDir 'status-after.json')
    Request @{ command = 'history' } | ConvertTo-Json -Depth 40 | Set-Content (Join-Path $evidenceDir 'history-after.json')
    Record @{ completed = $true; at = (Get-Date).ToUniversalTime().ToString('o') }
} catch {
    Record @{ completed = $false; error = $_.Exception.Message; at = (Get-Date).ToUniversalTime().ToString('o') }
    throw
} finally { $writer.Dispose(); Write-Host "Evidence: $evidenceDir" }
