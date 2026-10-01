@echo off
rem Cài Tiny POS trên máy quầy. Nhấp đúp file này; Windows sẽ hỏi quyền quản trị một lần để mở cổng cho điện thoại.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
