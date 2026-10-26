@echo off
chcp 65001 >nul
setlocal
set "NODE_HOME=D:\node-v22.12.0-win-x64"
set "PATH=%NODE_HOME%;%PATH%"
cd /d "%~dp0"

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖（使用国内镜像）...
  "%NODE_HOME%\npm.cmd" install --registry=https://registry.npmmirror.com --cache="D:\npm-cache"
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   智慧物流前端已启动
echo   浏览器访问: http://localhost:5173
echo   关闭本窗口即停止服务
echo ============================================
echo.
"%NODE_HOME%\node.exe" "node_modules\vite\bin\vite.js" --host 0.0.0.0 --port 5173
pause
