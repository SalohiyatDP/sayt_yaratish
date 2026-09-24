@echo off
rem ============================================================
rem  Qurilgan saytni tekshirish: havolalar, tillar, sarlavhalar, qulaylik
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
node src\check.mjs
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE% NEQ 0 echo   Tekshirishda xatoliklar topildi.
echo.
pause
exit /b %EXITCODE%
