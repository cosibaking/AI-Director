@echo off
chcp 65001 >nul
echo ========================================
echo   CineGen AI Director - 一键部署与启动
echo ========================================
echo.

if not exist "package.json" (
  echo [错误] 请在项目根目录下运行此脚本。
  exit /b 1
)

echo [1/3] 安装依赖...
call npm install
if errorlevel 1 (
  echo [错误] npm install 失败
  exit /b 1
)

echo.
echo [2/3] 构建前端...
call npm run build
if errorlevel 1 (
  echo [错误] npm run build 失败
  exit /b 1
)

echo.
echo [3/3] 启动服务（生产模式）...
echo 应用将运行在: http://localhost:3001
echo 按 Ctrl+C 停止服务
echo.
call npm run start
