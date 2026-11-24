@echo off
setlocal
cd /d "%~dp0"

set "NODE_DIR=%~dp0..\.tools\node\node-v22.14.0-win-x64"
if exist "%NODE_DIR%\node.exe" goto useportable
set "NODE_EXE=node"
goto checkdist

:useportable
set "NODE_EXE=%NODE_DIR%\node.exe"
set "PATH=%NODE_DIR%;%PATH%"

:checkdist
if not exist "dist\index.html" goto nobuild

echo.
echo   RAVEN's Note - local preview
echo   PC:    http://127.0.0.1:4173
echo   Phone: same Wi-Fi, open the IPv4 address below plus :4173
echo.
ipconfig | findstr /i "IPv4"
echo.
echo   Close this window or press Ctrl+C to stop.
echo.

"%NODE_EXE%" node_modules\vite\bin\vite.js preview --host 0.0.0.0 --port 4173 --strictPort
goto end

:nobuild
echo   dist\index.html not found. Please run: npm run build
pause

:end
endlocal
