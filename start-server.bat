@echo off
cd /d "%~dp0"
echo Starting portfolio server...
echo Open http://localhost:3000  ^|  Admin: http://localhost:3000/admin
node server.js
pause
