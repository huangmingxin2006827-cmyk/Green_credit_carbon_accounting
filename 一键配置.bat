@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title GreenCredit-Setup

echo ========================================
echo   一键配置（首次部署）
echo   Dir: %cd%
echo ========================================
echo.
echo 前置：已安装 Node.js 18+、MySQL 8+，且 MySQL 服务已启动。
echo 百炼 API Key / App Id 可稍后填写；跳过时仍可测上传与核算。
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未找到 node。请先安装 Node.js 18+。
  echo.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未找到 npm。请重新安装 Node.js。
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0packages\backend\package.json" (
  echo [ERROR] 请将本脚本放在项目根目录。
  echo.
  pause
  exit /b 1
)

echo [1/4] 安装前后端依赖（npm run install:all）...
call npm run install:all
if errorlevel 1 (
  echo [ERROR] 依赖安装失败。
  echo.
  pause
  exit /b 1
)
echo.

set "ENV_FILE=%~dp0packages\backend\.env"
set "ENV_EXAMPLE=%~dp0packages\backend\.env.example"
set "DO_FILL=1"

if not exist "%ENV_EXAMPLE%" (
  echo [ERROR] 缺少 packages\backend\.env.example
  echo.
  pause
  exit /b 1
)

if not exist "%ENV_FILE%" (
  echo [2/4] 复制 .env.example -^> .env
  copy /Y "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
) else (
  echo [2/4] 已存在 packages\backend\.env
  set /p REFILL=是否重新填写关键项？(Y/N，默认 N): 
  if /I not "!REFILL!"=="Y" set "DO_FILL=0"
)

if "!DO_FILL!"=="1" (
  echo.
  echo --- 填写环境变量（直接回车=跳过该项）---
  set /p MYSQL_PASSWORD=MYSQL_PASSWORD: 
  set /p DASHSCOPE_API_KEY=DASHSCOPE_API_KEY: 
  set /p DASHSCOPE_APP_ID_CHAT=DASHSCOPE_APP_ID_CHAT: 
  set /p DASHSCOPE_APP_ID_REPORT=DASHSCOPE_APP_ID_REPORT: 
  set /p DASHSCOPE_APP_ID_SUGGESTION=DASHSCOPE_APP_ID_SUGGESTION: 
  set /p JWT_SECRET=JWT_SECRET ^(回车则自动生成^): 

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
    echo [ERROR] 写入 .env 失败。
    popd
    echo.
    pause
    exit /b 1
  )
  popd
) else (
  echo 跳过环境变量填写，沿用现有 .env。
)
echo.

echo [3/4] 初始化数据库（npm run db:init）...
pushd "%~dp0packages\backend"
call npm run db:init
if errorlevel 1 (
  popd
  echo.
  echo [ERROR] 数据库初始化失败。请确认 MySQL 已启动，且 .env 中 MYSQL_USER / MYSQL_PASSWORD 正确。
  echo.
  pause
  exit /b 1
)
popd
echo.

echo [4/4] 配置完成。
echo.
echo 演示账号（密码均为 123456）：zhang / li / wang
echo 推荐样例：demo-data\01-纺织业-河南.xlsx
echo 日常启动：双击 启动项目.bat
echo 停止服务：双击 关闭项目.bat
echo.
set /p START_NOW=是否立即启动项目？(Y/N，默认 Y): 
if /I "!START_NOW!"=="N" (
  echo.
  echo 已跳过启动。需要时请运行 启动项目.bat
  echo.
  pause
  endlocal
  exit /b 0
)

echo.
call "%~dp0启动项目.bat"
endlocal
exit /b 0
