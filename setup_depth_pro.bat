@echo off
echo ========================================
echo  Depth Pro Setup for Shader Playground
echo ========================================
echo.

echo [1/4] Installing Depth Pro...
python -m pip install git+https://github.com/apple/ml-depth-pro.git

echo.
echo [2/4] Installing dependencies...
python -m pip install torch torchvision pillow numpy

echo.
echo [3/4] Creating checkpoints directory...
if not exist "checkpoints" mkdir checkpoints

echo.
echo [4/4] Downloading pretrained models...
echo This may take a few minutes (~5GB download)...
echo.

python -c "import urllib.request; import os; import zipfile; print('Downloading Depth Pro v1.0 checkpoint...'); url='https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt'; os.makedirs('checkpoints', exist_ok=True); urllib.request.urlretrieve(url, 'checkpoints/depth_pro.pt'); print('✓ Model downloaded successfully!')"

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Model location: %cd%\checkpoints\depth_pro.pt
echo.
echo Usage:
echo   Single image:  python scripts\depth_pro_generate.py image.jpg
echo   Batch folder:  python scripts\depth_pro_generate.py -b ./images
echo   Drag and drop: Drag image onto generate_depth.bat
echo.
echo Depth maps will be saved next to original images with _depth.png suffix
echo Upload them using the "Upload Depth Map" button in the shader playground!
echo.
pause
