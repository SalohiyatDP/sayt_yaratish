@echo off
rem ============================================================
rem  Telegram botni sozlash: tokenni tekshirish, chat_id ni aniqlash,
rem  sinov xabarini yuborish va sozlamalarni saqlash.
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
node server\tools\telegram-setup.mjs %*
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
