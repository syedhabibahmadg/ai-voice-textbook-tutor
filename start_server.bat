@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server.ps1"
echo.
echo This launcher has finished. Read the status above before closing this window.
pause
