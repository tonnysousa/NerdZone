@echo off
chcp 65001 >nul
cd /d "%~dp0"
node publicar.js
echo.
pause
