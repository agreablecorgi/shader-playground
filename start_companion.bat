@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo Shader Playground Local Companion
echo ========================================
echo.
echo This starts a local-only service at http://127.0.0.1:8765
echo used by the browser UI to generate Depth Pro and SHARP assets.
echo.
echo If Depth Pro dependencies are missing, run setup_depth_pro.bat first.
echo If SHARP CLI is missing, run setup_sharp.bat first.
echo.
python scripts\shader_companion.py
echo.
pause
