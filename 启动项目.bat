@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GreenCredit-Start

echo ========================================
echo   Start project
echo   Dir: %cd%
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node not found. Install Node.js first.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Reinstall Node.js.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0packages\backend\package.json" (
  echo [ERROR] packages\backend not found. Put this bat in project root.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0packages\frontend\package.json" (
  echo [ERROR] packages\frontend not found. Put this bat in project root.
  echo.
  pause
  exit /b 1
)

echo [1/3] Starting backend on port 3000...
start "carbon-backend" /D "%~dp0packages\backend" cmd /k "title carbon-backend && npm run dev"

echo [2/3] Starting frontend on port 5180...
start "carbon-frontend" /D "%~dp0packages\frontend" cmd /k "title carbon-frontend && npm run dev"

echo [3/3] Waiting for port 5180...
set /a _n=0
:wait_loop
set /a _n+=1
if %_n% gtr 45 (
  echo [WARN] Timeout. Opening browser anyway.
  goto open_browser
)

netstat -ano | findstr ":5180" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto open_browser

timeout /t 1 /nobreak >nul
goto wait_loop

:open_browser
echo Opening http://localhost:5180/
start "" "http://localhost:5180/"
echo.
echo [OK] Backend and frontend started in other windows.
echo To stop, run 关闭项目.bat
echo.
pause
endlocal
exit /b 0