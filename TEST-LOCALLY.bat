@echo off
REM Serves this folder over http://localhost:8000 so the app can reach Google
REM Sheets. Opening index.html by double-clicking does NOT work: browsers block
REM a file:// page from calling any website.
REM
REM Other devices on the same WiFi can also open it, using this PC's IP address
REM (e.g. http://192.168.0.249:8000) - handy for testing a tablet before you
REM publish the app online.

cd /d "%~dp0"
echo.
echo   Kolors app running at:  http://localhost:8000
echo.
echo   Leave this window open while testing. Press Ctrl+C to stop.
echo.
start "" http://localhost:8000
python -m http.server 8000
pause
