[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$CertificateThumbprint,
    [Parameter(Mandatory)][uri]$TimestampUrl,
    [string]$SignTool = 'signtool.exe',
    [string]$SevenZip = 'C:\Program Files\7-Zip\7z.exe'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($TimestampUrl.Scheme -notin @('http', 'https') -or $TimestampUrl.UserInfo) { throw 'Invalid RFC3161 timestamp URL.' }
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
$signPath = (Get-Command $SignTool -ErrorAction Stop).Source
if (!(Test-Path -LiteralPath $SevenZip -PathType Leaf)) { throw '7-Zip is required to verify packaged binaries.' }
$certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$CertificateThumbprint" -ErrorAction Stop
if (!$certificate.HasPrivateKey -or $certificate.NotAfter -le (Get-Date) -or $certificate.NotBefore -gt (Get-Date)) { throw 'A current certificate with an accessible private key is required.' }
if (!($certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' })) { throw 'Certificate must permit code signing.' }
function Run([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed: $File (exit $LASTEXITCODE)" }
}
function Verify([string]$File) {
    Run $signPath @('verify', '/pa', '/all', '/tw', $File)
    $signature = Get-AuthenticodeSignature -LiteralPath $File
    if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $CertificateThumbprint -or !$signature.TimeStamperCertificate) {
        throw "Invalid, unexpected, or untimestamped signature: $File"
    }
}
Run 'npm.cmd' @('run', 'helper:build')
$helper = Join-Path $repoRoot 'src-tauri/helper/UpdateController.Helper.exe'
Run $signPath @('sign', '/sha1', $CertificateThumbprint, '/fd', 'SHA256', '/tr', $TimestampUrl.AbsoluteUri, '/td', 'SHA256', $helper)
Verify $helper
# Build only after signing the helper; desktop:build would overwrite it.
$overlay = @{ bundle = @{ windows = @{ certificateThumbprint = $CertificateThumbprint; digestAlgorithm = 'sha256'; timestampUrl = $TimestampUrl.AbsoluteUri; tsp = $true } } } | ConvertTo-Json -Depth 5 -Compress
$verifyDir = Join-Path $repoRoot ".artifacts/signed-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $verifyDir | Out-Null
$overlayPath = Join-Path $verifyDir 'signing-config.json'
$overlay | Set-Content -LiteralPath $overlayPath -Encoding UTF8
Run 'npm.cmd' @('run', 'tauri', '--', 'build', '--config', $overlayPath)
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = Join-Path $repoRoot "src-tauri/target/release/bundle/nsis/Update Controller_${version}_x64-setup.exe"
Verify $installer
Run $SevenZip @('x', $installer, "-o$verifyDir", '-y')
$embeddedHelper = Join-Path $verifyDir 'helper/UpdateController.Helper.exe'
$embeddedApp = Join-Path $verifyDir 'update-controller.exe'
Verify $embeddedHelper
Verify $embeddedApp
if ((Get-FileHash $helper -Algorithm SHA256).Hash -ne (Get-FileHash $embeddedHelper -Algorithm SHA256).Hash) { throw 'Embedded helper differs from the signed build.' }
$manifest = [ordered]@{ version = $version; verifiedAt = (Get-Date).ToUniversalTime().ToString('o'); certificateThumbprint = $CertificateThumbprint; installer = $installer; sha256 = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() }
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $verifyDir 'verification.json') -Encoding UTF8
Write-Host "Verified signed installer: $installer"
Write-Host "Signature evidence: $verifyDir"
