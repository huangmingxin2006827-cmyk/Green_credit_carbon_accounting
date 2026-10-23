@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GreenCredit-Stop

echo ========================================
echo   Stop project
echo ========================================
echo.

echo Killing processes on ports 3000, 5180, 5181, 5182...

for %%P in (3000 5180 5181 5182) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P" ^| findstr "LISTENING"') do (
    echo   Kill PID %%a on port %%P
    taskkill /F /PID %%a >nul 2>&1
  )
)

echo Closing carbon-backend / carbon-frontend windows...
taskkill /FI "WINDOWTITLE eq carbon-backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq carbon-frontend*" /T /F >nul 2>&1

echo.
echo Checking ports...
for %%P in (3000 5180 5181 5182) do (
  netstat -ano | findstr ":%%P" | findstr "LISTENING" >nul 2>&1
  if errorlevel 1 (
    echo   Port %%P: free
  ) else (
    echo   Port %%P: still in use
  )
)

echo.
echo [OK] Done. Next start should use http://localhost:5180/
echo.
pause
endlocal
exit /b 0
