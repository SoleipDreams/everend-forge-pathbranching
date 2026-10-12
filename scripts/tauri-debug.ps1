[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$CdpPort = 9222,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$TauriArgs
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This launcher uses Windows WebView2. Use tauri:dev on other platforms.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $repoRoot 'output/playwright'
$profilePath = Join-Path $outputRoot "webview2-$CdpPort"

# Fail before starting Tauri if another application owns the endpoint.
$probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $CdpPort)
try { $probe.Start() } catch { throw "CDP port $CdpPort is unavailable. Stop its owner or pass -CdpPort <port>." } finally { $probe.Stop() }
if ($env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -match '--remote-debugging-port') {
    throw 'An inherited WebView2 debugging port is already set. Clear WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS before using this launcher.'
}

New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
$logPath = Join-Path $outputRoot ("tauri-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$previousArgs = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$previousProfile = $env:WEBVIEW2_USER_DATA_FOLDER
$previousBacktrace = $env:RUST_BACKTRACE
Push-Location -LiteralPath $repoRoot
try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "$previousArgs --remote-debugging-address=127.0.0.1 --remote-debugging-port=$CdpPort".Trim()
    $env:WEBVIEW2_USER_DATA_FOLDER = $profilePath
    $env:RUST_BACKTRACE = '1'
    Write-Output "WebView2 CDP: http://127.0.0.1:$CdpPort"
    Write-Output "Isolated debug profile: $profilePath"
    Write-Output "Tauri terminal log: $logPath"
    Write-Output 'After the window opens, run npm run pw:attach in a second terminal.'
    & npm.cmd run tauri -- dev @TauriArgs 2>&1 | Tee-Object -FilePath $logPath
    $tauriExitCode = $LASTEXITCODE
} finally {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArgs
    $env:WEBVIEW2_USER_DATA_FOLDER = $previousProfile
    $env:RUST_BACKTRACE = $previousBacktrace
    Pop-Location
}
exit $tauriExitCode
