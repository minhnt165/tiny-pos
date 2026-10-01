@echo off
rem Gỡ Tiny POS khỏi máy quầy (giữ nguyên dữ liệu trong data\). Nhấp đúp file này.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
