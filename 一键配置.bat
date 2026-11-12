@echo off
cd /d "%~dp0"
if not "%~1"=="__RUN__" (
  cmd /k "%~f0" __RUN__
  exit /b
)

setlocal EnableExtensions EnableDelayedExpansion
title GreenCredit-Setup

echo ========================================
echo   One-click setup [first deploy]
echo   Dir: %cd%
echo ========================================
echo.
echo Need: Node.js 18+, MySQL 8+ running.
echo Bailian API Key / App Ids can be filled later; skip = upload/calc only.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] node not found. Install Node.js 18+ first.
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
  echo [ERROR] Run this script from the project root.
  echo.
  pause
  exit /b 1
)

echo [1/4] Installing deps [npm run install:all]...
call npm run install:all
if errorlevel 1 (
  echo [ERROR] Dependency install failed.
  echo.
  pause
  exit /b 1
)
echo.

set "ENV_FILE=%~dp0packages\backend\.env"
set "ENV_EXAMPLE=%~dp0packages\backend\.env.example"
set "DO_FILL=1"

if not exist "%ENV_EXAMPLE%" (
  echo [ERROR] Missing packages\backend\.env.example
  echo.
  pause
  exit /b 1
)

if not exist "%ENV_FILE%" (
  echo [2/4] Copy .env.example -^> .env
  copy /Y "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
) else (
  echo [2/4] Found packages\backend\.env
  set /p REFILL=Re-fill key settings? Y/N, default N: 
  if /I not "!REFILL!"=="Y" set "DO_FILL=0"
)

if "!DO_FILL!"=="1" (
  echo.
  echo --- Env vars [Enter = skip that item] ---
  set /p MYSQL_PASSWORD=MYSQL_PASSWORD: 
  set /p DASHSCOPE_API_KEY=DASHSCOPE_API_KEY: 
  set /p DASHSCOPE_APP_ID_CHAT=DASHSCOPE_APP_ID_CHAT: 
  set /p DASHSCOPE_APP_ID_REPORT=DASHSCOPE_APP_ID_REPORT: 
  set /p DASHSCOPE_APP_ID_SUGGESTION=DASHSCOPE_APP_ID_SUGGESTION: 
  set /p JWT_SECRET=JWT_SECRET [Enter = auto-generate]: 

  pushd "%~dp0packages\backend"
  if not "!MYSQL_PASSWORD!"=="" node scripts\patch-env.js "MYSQL_PASSWORD=!MYSQL_PASSWORD!"
  if not "!DASHSCOPE_API_KEY!"=="" node scripts\patch-env.js "DASHSCOPE_API_KEY=!DASHSCOPE_API_KEY!"
  if not "!DASHSCOPE_APP_ID_CHAT!"=="" node scripts\patch-env.js "DASHSCOPE_APP_ID_CHAT=!DASHSCOPE_APP_ID_CHAT!"
  if not "!DASHSCOPE_APP_ID_REPORT!"=="" node scripts\patch-env.js "DASHSCOPE_APP_ID_REPORT=!DASHSCOPE_APP_ID_REPORT!"
  if not "!DASHSCOPE_APP_ID_SUGGESTION!"=="" node scripts\patch-env.js "DASHSCOPE_APP_ID_SUGGESTION=!DASHSCOPE_APP_ID_SUGGESTION!"
  if not "!JWT_SECRET!"=="" (
    node scripts\patch-env.js "JWT_SECRET=!JWT_SECRET!"
  ) else (
    node scripts\patch-env.js "JWT_SECRET=__RANDOM__"
  )
  if errorlevel 1 (
    echo [ERROR] Failed to write .env
    popd
    echo.
    pause
    exit /b 1
  )
  popd
) else (
  echo Skip env fill; keep existing .env.
)
echo.

echo [3/4] Init database [npm run db:init]...
pushd "%~dp0packages\backend"
call npm run db:init
if errorlevel 1 (
  popd
  echo.
  echo [ERROR] db:init failed. Check MySQL is up and MYSQL_USER / MYSQL_PASSWORD in .env.
  echo.
  pause
  exit /b 1
)
popd
echo.

echo [4/4] Setup done.
echo.
echo Demo users [password 123456]: zhang / li / wang
echo Sample Excel: demo-data\01-*.xlsx
echo Daily start: double-click the Start Project bat
echo Stop: double-click the Stop Project bat
echo.
set /p START_NOW=Start project now? Y/N, default Y: 
if /I "!START_NOW!"=="N" (
  echo.
  echo Skipped start. Run the Start Project bat later.
  echo.
  pause
  endlocal
  exit /b 0
)

echo.
set "START_BAT="
for %%F in ("%~dp0*.bat") do (
  findstr /C:"title GreenCredit-Start" "%%~F" >nul 2>&1
  if not errorlevel 1 set "START_BAT=%%~F"
)
if not defined START_BAT (
  echo [ERROR] Start Project bat not found in project root.
  echo.
  pause
  endlocal
  exit /b 1
)
call "%START_BAT%"
endlocal
exit /b 0
