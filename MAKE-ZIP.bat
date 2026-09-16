@echo off
REM Builds kolors-web.zip — the file you drop on Netlify.
REM Run this again any time you change the app, then drag the new zip onto
REM your Netlify project's Deploys page.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-zip.ps1"
pause
