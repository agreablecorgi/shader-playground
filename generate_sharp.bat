@echo off
echo ========================================
echo SHARP 3D Gaussian Generator
echo ========================================
echo.

if "%~1"=="" (
    echo Usage: Drag and drop an image or folder onto this file
    echo.
    echo Or run: generate_sharp.bat your_image.jpg
    echo.
    pause
    exit /b 1
)

python sharp_generate.py "%~1"

if errorlevel 1 (
    echo.
    echo Error: Generation failed
    echo Make sure you have run setup_sharp.bat first
) else (
    echo.
    echo ========================================
    echo Success!
    echo ========================================
    echo Generated files:
    echo   - *_gaussians.json (3D reconstruction data)
    echo   - *_sharp_depth.png (geometric depth map)
    echo   - *_normals.png (surface normals)
    echo.
    echo Next: Upload these files to the shader playground
)

echo.
pause
