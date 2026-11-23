@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 22 ou superior.
  pause
  exit /b 1
)
call npm run verify
if errorlevel 1 (
  echo Os testes falharam. Nao iniciando servidor.
  pause
  exit /b 1
)
call npm run dev
pause
