@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -File "%~dp0iniciar-laboratorio.ps1"
if errorlevel 1 pause
