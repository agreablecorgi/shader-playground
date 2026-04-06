@echo off
echo ========================================
echo Apple SHARP 3D Gaussian Splatting Setup
echo ========================================
echo.

echo [1/4] Installing PyTorch with CUDA support...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
if errorlevel 1 (
    echo Error: Failed to install PyTorch
    pause
    exit /b 1
)

echo.
echo [2/4] Installing Apple SHARP...
echo Removing any conflicting 'sharp' packages...
pip uninstall -y sharp
echo Installing ml-sharp from GitHub...
pip install git+https://github.com/apple/ml-sharp.git
if errorlevel 1 (
    echo Error: Failed to install SHARP
    echo Please check: https://github.com/apple/ml-sharp
    pause
    exit /b 1
)

echo.
echo [3/4] Fixing numpy/opencv compatibility...
pip uninstall -y numpy opencv-python opencv-python-headless
pip install numpy==1.26.4
pip install opencv-python-headless==4.8.1.78
if errorlevel 1 (
    echo Error: Failed to install opencv
    pause
    exit /b 1
)

echo.
echo [4/4] Installing additional dependencies...
pip install pillow scipy
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [5/5] Creating checkpoints directory...
if not exist "checkpoints" mkdir checkpoints

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Note: SHARP model checkpoint may need manual download
echo Check https://github.com/apple/ml-sharp for releases
echo.
echo Next steps:
echo 1. Verify model checkpoint in checkpoints/sharp_model.pth
echo 2. Run: python sharp_generate.py your_image.jpg
echo 3. Upload generated files to shader playground
echo.
pause
