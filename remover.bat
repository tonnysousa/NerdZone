@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p nome=Digite o nome do artigo que quer tirar (exemplo: meu-primeiro):
node publicar.js --remover "%nome%"
echo.
pause
