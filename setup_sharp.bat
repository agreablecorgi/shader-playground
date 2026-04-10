@echo off
echo ========================================
echo Apple SHARP 3D Gaussian Splatting Setup
echo ========================================
echo.

echo [1/6] Installing PyTorch with CUDA support...
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
if errorlevel 1 (
    echo Error: Failed to install PyTorch
    pause
    exit /b 1
)

echo.
echo [2/6] Installing Apple SHARP...
echo Removing any conflicting 'sharp' packages...
python -m pip uninstall -y sharp
echo Installing ml-sharp from GitHub...
python -m pip install git+https://github.com/apple/ml-sharp.git
if errorlevel 1 (
    echo Error: Failed to install SHARP
    echo Please check: https://github.com/apple/ml-sharp
    pause
    exit /b 1
)

echo.
echo [3/6] Fixing numpy/opencv compatibility...
python -m pip uninstall -y numpy opencv-python opencv-python-headless
python -m pip install numpy==1.26.4
python -m pip install opencv-python-headless==4.8.1.78
if errorlevel 1 (
    echo Error: Failed to install opencv
    pause
    exit /b 1
)

echo.
echo [4/6] Installing additional dependencies...
python -m pip install pillow scipy
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [5/6] Creating checkpoints directory...
if not exist "checkpoints" mkdir checkpoints

echo.
echo [6/6] Verifying SHARP CLI discovery...
set "SHARP_CLI="
for /f "delims=" %%I in ('python scripts\check_sharp_cli.py 2^>nul') do set "SHARP_CLI=%%I"
if defined SHARP_CLI (
    echo Found SHARP CLI:
    echo   %SHARP_CLI%
) else (
    echo Warning: SHARP installed, but no sharp executable was found yet.
    echo Try closing and reopening this terminal, then run start_companion.bat again.
    echo If it still fails, set SHADER_PLAYGROUND_SHARP_CLI to the full sharp.exe path.
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Note: SHARP can auto-download its checkpoint on first use.
echo The companion also checks checkpoints\sharp_2572gikvuh.pt if you download it manually.
echo The companion searches PATH, the active Python Scripts folder, and SHADER_PLAYGROUND_SHARP_CLI.
echo.
echo Next steps:
echo 1. Run: start_companion.bat
echo 2. Open index.html
echo 3. Upload an image and click Generate SHARP
echo.
pause
