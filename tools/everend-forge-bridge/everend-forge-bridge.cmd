@echo off
set "BRIDGE_ROOT=%~dp0"
if exist "%BRIDGE_ROOT%bridge.cjs" (
  set "BRIDGE_ENTRY=%BRIDGE_ROOT%bridge.cjs"
) else (
  set "BRIDGE_ENTRY=%BRIDGE_ROOT%dist\src\cli.js"
)
if exist "%BRIDGE_ROOT%node.exe" (
  "%BRIDGE_ROOT%node.exe" "%BRIDGE_ENTRY%" %*
) else (
  node "%BRIDGE_ENTRY%" %*
)
