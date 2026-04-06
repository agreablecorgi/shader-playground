# Depth Pro Examples

This folder contains example images and their generated depth maps.

## Quick Test

1. Run setup (one time only):
   ```
   cd ..
   setup_depth_pro.bat
   ```

2. Generate depth for all examples:
   ```
   python ../depth_pro_generate.py -b .
   ```

3. You'll get depth maps like:
   - `portrait_depth.png`
   - `landscape_depth.png`
   - etc.

## Using in Shader Playground

1. Open `index.html`
2. Upload an image (e.g., `portrait.jpg`)
3. Upload its depth map (`portrait_depth.png`)
4. Apply depth effects!

## Tips

- **GPU recommended** - Much faster depth generation
- **File naming** - Depth maps are auto-named `[filename]_depth.png`
- **Batch processing** - Process entire folders at once
- **Quality** - Depth Pro produces sharp, detailed depth maps superior to MiDAS
