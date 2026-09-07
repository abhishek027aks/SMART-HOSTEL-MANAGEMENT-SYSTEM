@echo off
setlocal EnableExtensions
title Smart Hostel - GitHub Auto Update

cd /d "%~dp0"

echo.
echo ============================================================
echo        SMART HOSTEL MANAGEMENT - GITHUB UPDATE
echo ============================================================
echo.
echo Project: %CD%
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git was not found in PATH.
    echo Please install Git or open Git Bash/PowerShell where Git works.
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [ERROR] This folder is not a Git repository.
    echo.
    pause
    exit /b 1
)

echo [2/4] Adding all changed files...
git add -A
if errorlevel 1 (
    echo [ERROR] Could not stage files.
    echo.
    pause
    exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo [INFO] No changes found.
    echo GitHub is already up to date.
    echo.
    pause
    exit /b 0
)

echo [3/4] Creating commit...
for /f "tokens=1-3 delims=/" %%a in ("%date%") do set TODAY=%%a-%%b-%%c
set "COMMIT_MSG=auto: update project - %date% %time:~0,8%"
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [ERROR] Commit failed.
    echo.
    pause
    exit /b 1
)

echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed.
    echo Check your internet connection or GitHub authentication.
    echo Your commit is still saved locally.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo              GITHUB UPDATED SUCCESSFULLY!
echo ============================================================
echo.
echo All tracked changes have been pushed to:
echo https://github.com/abhishek027aks/SMART-HOSTEL-MANAGEMENT-SYSTEM
echo.
pause
exit /b 0
