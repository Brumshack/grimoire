@echo off
:: Kill any existing serve processes on port 8080 to avoid stale servers
echo Stopping any existing servers on port 8080...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Start the server from this directory (always explicit path, never ".")
set "DIR=%~dp0"
echo Starting server from: %DIR%
npx serve "%DIR%" --listen 8080
