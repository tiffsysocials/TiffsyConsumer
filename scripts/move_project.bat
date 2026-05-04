@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Tiffsy Project Migration Script
echo   From: D:\Tiffsy
echo   To:   E:\AIB
echo ============================================
echo.

:: Check if E: drive exists
if not exist E:\ (
    echo ERROR: E: drive not found!
    pause
    exit /b 1
)

:: Create destination directory
echo Creating destination directory E:\AIB...
if not exist "E:\AIB" mkdir "E:\AIB"

:: Optional: Clean build folders before moving to save time and space
echo.
echo Cleaning build folders to speed up transfer...
if exist "D:\Tiffsy\node_modules" (
    echo Removing node_modules (will reinstall at destination)...
    rmdir /s /q "D:\Tiffsy\node_modules" 2>nul
)
if exist "D:\Tiffsy\android\.gradle" (
    echo Removing android\.gradle...
    rmdir /s /q "D:\Tiffsy\android\.gradle" 2>nul
)
if exist "D:\Tiffsy\android\app\build" (
    echo Removing android\app\build...
    rmdir /s /q "D:\Tiffsy\android\app\build" 2>nul
)
if exist "D:\Tiffsy\android\build" (
    echo Removing android\build...
    rmdir /s /q "D:\Tiffsy\android\build" 2>nul
)
if exist "D:\Tiffsy\.gradle" (
    echo Removing .gradle...
    rmdir /s /q "D:\Tiffsy\.gradle" 2>nul
)

echo.
echo ============================================
echo   Starting file transfer...
echo ============================================
echo.

:: Use robocopy for reliable transfer with progress
:: /E = Copy subdirectories including empty ones
:: /MOVE = Move files (delete from source after copying)
:: /R:3 = Retry 3 times on failed copies
:: /W:5 = Wait 5 seconds between retries
:: /MT:8 = Multi-threaded copying with 8 threads
:: /NP = No progress percentage (cleaner output)
:: /ETA = Show estimated time of arrival

robocopy "D:\Tiffsy" "E:\AIB" /E /MOVE /R:3 /W:5 /MT:8 /ETA

:: Check robocopy exit code (0-7 are success codes)
if %ERRORLEVEL% LEQ 7 (
    echo.
    echo ============================================
    echo   SUCCESS! Project moved to E:\AIB
    echo ============================================
    echo.
    echo Next steps:
    echo   1. cd E:\AIB
    echo   2. npm install
    echo   3. npm run android
    echo.
) else (
    echo.
    echo ============================================
    echo   ERROR: Some files may not have been moved
    echo   Error code: %ERRORLEVEL%
    echo ============================================
    echo.
)

pause
