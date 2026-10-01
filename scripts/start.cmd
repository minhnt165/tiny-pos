@echo off
rem Chạy server Tiny POS (cổng 3000), log ghi đè vào data\server.log. Đang chạy rồi thì thoát.
cd /d "%~dp0.."
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo Tiny POS dang chay roi.
  exit /b 0
)
if not exist data mkdir data
node server\dist\index.js > data\server.log 2>&1
