@echo off
setlocal
chcp 65001 >nul
if not exist "%~dp0codigo\scripts\ambiente-windows.ps1" (
  echo Extraia o ZIP inteiro antes de executar este arquivo.
  pause
  exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0codigo\scripts\ambiente-windows.ps1" -Acao Iniciar
set "HYDRO_SETUP_RESULT=%errorlevel%"
if not "%HYDRO_SETUP_RESULT%"=="0" echo Confira o erro acima e as instrucoes em 00-COMECE-AQUI.html.
pause
exit /b %HYDRO_SETUP_RESULT%
