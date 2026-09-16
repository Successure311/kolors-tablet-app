@echo off
REM Pushes your changes to GitHub, which auto-deploys to kolors.pages.dev.
REM Run this any time you change the app — no zip, no dashboard upload.

cd /d "%~dp0"

git add -A

set "MSG="
set /p MSG="Describe what you changed (or press Enter to skip): "
if "%MSG%"=="" set "MSG=Update tablet-app"

git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Nothing to commit — no changes since the last deploy.
    pause
    exit /b 0
)

git push

if errorlevel 1 (
    echo.
    echo Push failed — check the error above ^(e.g. no internet, or GitHub sign-in needed^).
) else (
    echo.
    echo Pushed. Cloudflare will rebuild kolors.pages.dev automatically in a few seconds.
)

pause
