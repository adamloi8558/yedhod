@echo off
REM fhchannel-dl resolver — double-click to crawl /videos and push jobs
REM to R2 for the Coolify downloader to pick up.

cd /d "%~dp0"
echo.
echo === fhchannel-dl resolver ===
echo  cwd: %CD%
echo.

call pnpm exec tsx scripts/resolve.ts
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% NEQ 0 (
    echo [done] resolver exited with code %EXITCODE%
) else (
    echo [done] resolver finished successfully
)
echo.
pause
exit /b %EXITCODE%
