@echo off
rem ============================================================
rem  Boshqaruv paneli foydalanuvchisini yaratish yoki parolini yangilash
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0.."
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   XATOLIK: Node.js topilmadi. https://nodejs.org dan o'rnating.
  echo.
  pause
  exit /b 1
)

echo.
echo   Boshqaruv paneli foydalanuvchisi
echo   --------------------------------
echo.
set /p ADMINUSER="   Foydalanuvchi nomi: "
if "%ADMINUSER%"=="" (
  echo   Foydalanuvchi nomi bo'sh bo'lmasligi kerak.
  pause
  exit /b 1
)

echo.
echo   Parol kamida 12 belgidan iborat bo'lsin.
set /p ADMINPASS="   Parol: "
if "%ADMINPASS%"=="" (
  echo   Parol bo'sh bo'lmasligi kerak.
  pause
  exit /b 1
)

echo.
echo   Rol: 1 = admin (hammasi), 2 = editor (kontent), 3 = viewer (faqat ko'rish)
choice /c 123 /n /m "   Tanlang [1/2/3]: "
if errorlevel 3 set ADMINROLE=viewer
if errorlevel 3 goto run
if errorlevel 2 set ADMINROLE=editor
if errorlevel 2 goto run
set ADMINROLE=admin

:run
echo.
node server\tools\hash-password.mjs "%ADMINUSER%" "%ADMINPASS%" %ADMINROLE%
set EXITCODE=%ERRORLEVEL%

rem Parolni xotiradan tozalash
set ADMINPASS=

echo.
pause
endlocal
exit /b %EXITCODE%
