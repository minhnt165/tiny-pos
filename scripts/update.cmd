@echo off
rem Cập nhật Tiny POS trên máy quầy: dừng server, lấy code mới, build, chạy lại. Dành cho người cập nhật máy tiệm.
cd /d "%~dp0.."
call "%~dp0stop.cmd"
if exist ".certs\corp-root.pem" set NODE_EXTRA_CA_CERTS=%CD%\.certs\corp-root.pem
git pull || goto :err
call npm install --no-audit --no-fund || goto :err
call npm run build || goto :err
start "" wscript.exe "%~dp0open.vbs"
echo Da cap nhat xong.
pause
exit /b 0
:err
echo Cap nhat loi, xem thong bao o tren.
pause
exit /b 1
