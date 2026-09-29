@echo off
rem ============================================================
rem  Saytni qurish (faqat tasdiqlangan kontent bilan)
rem  Ikki marta bosib ishga tushirish mumkin.
rem  npm ishlatilmaydi — shu sababli PowerShell cheklovlari to'sqinlik qilmaydi.
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   XATOLIK: Node.js topilmadi.
  echo   https://nodejs.org saytidan Node.js 20.11 yoki undan yuqori versiyasini o'rnating,
  echo   so'ngra bu faylni qaytadan ishga tushiring.
  echo.
  pause
  exit /b 1
)

echo.
echo   Sayt qurilmoqda...
echo.
node src\build.mjs
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% NEQ 0 (
  echo   Qurish xatolik bilan yakunlandi. Yuqoridagi xabarni o'qing.
) else (
  echo   Tayyor. Natija: dist\ katalogida.
)
echo.
pause
exit /b %EXITCODE%
