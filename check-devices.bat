@echo off
echo Checking for Android devices/emulators...
echo.

REM Try to find adb in common Android SDK locations
set "ADB_PATH="

REM Check common Android SDK paths
if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
    set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
)

if exist "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe" (
    set "ADB_PATH=%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe"
)

if exist "C:\Android\Sdk\platform-tools\adb.exe" (
    set "ADB_PATH=C:\Android\Sdk\platform-tools\adb.exe"
)

if defined ADB_PATH (
    echo Found adb at: %ADB_PATH%
    echo.
    echo Connected devices:
    "%ADB_PATH%" devices
    echo.
    echo If you see a device above, you're ready to build!
    echo Otherwise, connect your Android device or start an emulator.
) else (
    echo ADB not found. Do you have Android Studio installed?
    echo.
    echo You have 2 options:
    echo 1. Install Android Studio: https://developer.android.com/studio
    echo 2. Use EAS cloud build: npx eas build --platform android --profile development
)

echo.
pause
