@echo off
rem ============================================================
rem  Hosting tashxisi: nega server ishga tushmayapti?
rem  Node versiyasi, port, sayt fayllari, yozish huquqlari,
rem  foydalanuvchilar, Telegram va murojaat shakli tekshiriladi.
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   XATOLIK: Node.js topilmadi. https://nodejs.org dan o'rnating.
  echo.
  pause
  exit /b 1
)

echo.
node server\tools\diagnose.mjs
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
