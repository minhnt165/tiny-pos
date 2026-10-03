@echo off
rem Dừng server Tiny POS đang nghe cổng 7869.
set found=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":7869 " ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
  set found=1
)
if defined found (echo Da dung Tiny POS.) else (echo Tiny POS khong chay.)
