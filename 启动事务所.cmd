@echo off
cd /d "%~dp0"
node scripts/start.mjs
if errorlevel 1 pause
