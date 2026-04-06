@echo off
REM Quick depth generation - drag and drop images onto this file!

if "%~1"=="" (
    echo Drag and drop an image file onto this batch file to generate its depth map!
    echo.
    echo Or use from command line:
    echo   generate_depth.bat image.jpg
    echo   generate_depth.bat -b ./folder
    echo.
    pause
    exit /b
)

python depth_pro_generate.py %*

echo.
pause
