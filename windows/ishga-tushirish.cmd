@echo off
rem ============================================================
rem  Serverni ishga tushirish: statik sayt + boshqaruv paneli
rem
rem    Sayt:             http://localhost:8080/
rem    Boshqaruv paneli: http://localhost:8080/admin/
rem
rem  To'xtatish uchun: Ctrl+C
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

if not exist "dist\index.html" (
  echo.
  echo   dist\ katalogi topilmadi — sayt avval qurilishi kerak.
  echo   Qurilmoqda...
  echo.
  node src\build.mjs
  if errorlevel 1 (
    echo.
    echo   Qurish amalga oshmadi. Server ishga tushirilmaydi.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo   Server ishga tushirilmoqda... (to'xtatish uchun Ctrl+C)
echo.
rem --dev: mahalliy kompyuterda HTTPS bo'lmaganda ham kirish ishlashi uchun.
rem Haqiqiy serverda bu bayroq ISHLATILMAYDI.
node server\server.mjs --dev

echo.
echo   Server to'xtatildi.
echo.
pause
