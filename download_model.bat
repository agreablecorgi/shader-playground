@echo off
echo ========================================
echo  Downloading Depth Pro Model
echo ========================================
echo.
echo This will download the pretrained model (~5GB)
echo to the checkpoints directory.
echo.
pause

if not exist "checkpoints" mkdir checkpoints

echo.
echo Downloading from Apple's CDN...
echo This may take several minutes depending on your connection.
echo.

python -c "import urllib.request; import sys; url='https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt'; print('Downloading Depth Pro v1.0...'); def progress(count, block, total): percent = int(count*block*100/total); sys.stdout.write(f'\rProgress: {percent}%%'); sys.stdout.flush(); urllib.request.urlretrieve(url, 'checkpoints/depth_pro.pt', progress); print('\n\n✓ Download complete!')"

echo.
echo Model saved to: %cd%\checkpoints\depth_pro.pt
echo.
echo You can now run: python depth_pro_generate.py image.jpg
echo.
pause
