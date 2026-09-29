@echo off
rem ============================================================
rem  Saytni DEMO rejimida qurish — namunaviy ma'lumotlar qo'shiladi.
rem  DIQQAT: ishlab turgan (haqiqiy) saytda bu rejimni ishlatmang.
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
echo   DIQQAT: sayt namunaviy (DEMO) ma'lumotlar bilan quriladi.
echo   Bu yozuvlar saytda "DEMO" nishoni bilan ko'rsatiladi.
echo.
choice /c YN /n /m "   Davom etilsinmi? [Y/N] "
if errorlevel 2 (
  echo   Bekor qilindi.
  echo.
  pause
  exit /b 0
)

echo.
node src\build.mjs --demo
set EXITCODE=%ERRORLEVEL%
echo.
pause
exit /b %EXITCODE%
