@echo off
setlocal
cd /d "%~dp0"
set "PS=%~dp0scripts\publish.ps1"
if not exist "%PS%" (
  echo [ERROR] publish.ps1 not found: %PS%
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%" %*
echo.
echo Release script finished. Press any key to close.
pause >nul
endlocal
