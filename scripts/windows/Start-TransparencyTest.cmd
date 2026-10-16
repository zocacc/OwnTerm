@echo off
if not exist "%~dp0ownterm-desktop.exe" (
  echo Extract the entire diagnostic ZIP before running this launcher.
  pause
  exit /b 1
)
start "" "%~dp0ownterm-desktop.exe" --transparency-test
