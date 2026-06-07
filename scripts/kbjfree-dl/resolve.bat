@echo off
REM kbjfree-dl resolver — double-click to crawl /videos + /watch and push
REM jobs to R2 for the Coolify downloader to pick up.
REM
REM Reads cookies from .state\cookies.json (you can paste a Chrome
REM cookie-editor export into that file).

cd /d "%~dp0"
echo.
echo === kbjfree-dl resolver ===
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
