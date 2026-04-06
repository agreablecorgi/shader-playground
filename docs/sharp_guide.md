# Apple SHARP Integration Guide

## What is SHARP?

**Apple SHARP is now publicly available!**
https://github.com/apple/ml-sharp

SHARP is Apple's 3D Gaussian Splatting model that reconstructs full 3D geometry from a single image. It creates:

- **3D Point Cloud**: Thousands of colored Gaussian "splats" positioned in 3D space
- **Geometric Depth**: True distance from camera (more accurate than estimated depth)
- **Surface Normals**: Direction each surface faces (essential for realistic lighting)
- **Occlusion Information**: Which parts are in front/behind (better than depth-based guessing)

## Why Use SHARP Over Depth Pro?

**Depth Pro (Monocular Depth Estimation):**
- ✅ Fast (~0.3s)
- ✅ Good for single-view depth effects
- ❌ No true 3D geometry
- ❌ No normal information
- ❌ Can't render from different angles

**SHARP (3D Gaussian Splatting):**
- ✅ True 3D reconstruction
- ✅ Surface normals for realistic lighting
- ✅ Better occlusion and edge detection
- ✅ Can render from novel viewpoints
- ❌ Slower inference (~2-5s)
- ❌ Larger model (~2GB)

**Best Practice**: Use Depth Pro for quick depth effects, use SHARP when you need true 3D geometry or advanced lighting.

## Setup (One-Time)

### Windows
```batch
setup_sharp.bat
```

This will:
1. Install PyTorch with CUDA support
2. Install SHARP from GitHub
3. Download model checkpoint (~2GB)

### Linux/Mac
```bash
pip install torch torchvision
pip install git+https://github.com/apple/ml-sharp.git
python sharp_generate.py  # auto-downloads model
```

## Usage

### Single Image
```bash
python sharp_generate.py photo.jpg
```

**Outputs:**
- `photo_gaussians.json` - 3D Gaussian parameters for visualization
- `photo_sharp_depth.png` - Geometric depth map (use with depth effects)
- `photo_normals.png` - Surface normal map (RGB = XYZ directions)

### Batch Processing
```bash
python sharp_generate.py ./my_folder
```

Processes all JPG/PNG files in the folder.

### Drag-and-Drop (Windows)
1. Drag image file onto `generate_sharp.bat`
2. Wait for processing (~2-5 seconds)
3. Three files generated in the same folder

## Using in Shader Playground

### 1. Upload All Files
- Upload original image
- Click **"Upload Depth Map"** → select `_sharp_depth.png`
- Click **"Upload Normal Map"** → select `_normals.png`

### 2. Try 3D Gaussian Effects

**3D View** - Interactive 3D rotation
- Rotation X/Y: Rotate the scene
- Zoom: Scale the depth
- Point Size: Gaussian splat size

**Normal Map Lighting** - Dynamic light control
- Light Angle: Horizontal light direction
- Light Elevation: Vertical light angle
- Light Intensity: Brightness multiplier

**Geometric Enhance** - Combined depth + normals
- Occlusion Strength: How much darker occluded areas get
- Edge Enhance: Sharpen depth edges
- Depth Darken: Atmospheric perspective

### 3. Use with Depth Effects
Enable "Use MiD depth" toggle on any depth effect to use SHARP's geometric depth instead of pseudo-depth:
- More accurate bokeh blur (Depth of Field)
- Better fog distribution (Atmospheric Fog)
- Sharper depth peeling (Depth Peeling)
- More realistic shadows (Depth Shadow)

## Technical Details

### Gaussian Parameters
Each Gaussian in the point cloud has:
- **Position** (x, y, z): Location in 3D space
- **Color** (r, g, b): RGB color values
- **Scale** (3D): Size along each axis (ellipsoid shape)
- **Rotation** (quaternion): 3D orientation
- **Opacity** (α): Transparency value

### Depth Map Format
- 8-bit grayscale PNG
- **Lighter = Closer** (255 = nearest, 0 = farthest)
- Inverted compared to typical depth (for shader compatibility)
- Normalized to full 0-255 range

### Normal Map Format
- 24-bit RGB PNG
- **Red channel** = X normal (-1 to +1 → 0 to 255)
- **Green channel** = Y normal (-1 to +1 → 0 to 255)
- **Blue channel** = Z normal (-1 to +1 → 0 to 255)
- Typically bluish (Z+ is "facing camera")

## Example Workflows

### Portrait with Realistic Lighting
1. Generate SHARP files: `python sharp_generate.py portrait.jpg`
2. Upload all three files to playground
3. Add **Normal Map Lighting** effect
4. Adjust light angle to create dramatic shadows
5. Stack with **Film Grain** for cinematic look

### 3D Scene Exploration
1. Generate SHARP files from landscape photo
2. Upload all files
3. Add **3D View** effect
4. Use Rotation X/Y sliders to explore scene from different angles
5. Increase Zoom to emphasize depth

### Enhanced Depth of Field
1. Generate both Depth Pro AND SHARP depth maps
2. Upload image + SHARP depth
3. Add **Depth of Field** effect
4. Enable "Use MiDAS Depth" toggle
5. Compare with pseudo-depth (toggle off) to see accuracy improvement

### Geometric Ambient Occlusion
1. Generate SHARP files
2. Upload image + depth + normals
3. Add **Geometric Enhance** effect
4. Enable both depth and normal toggles
5. Increase Occlusion Strength for dramatic shadows

## Troubleshooting

### "SHARP module not found"
- SHARP may not be publicly released yet
- Check https://github.com/apple/ml-sharp for availability
- Alternative: Use Depth Pro for basic depth effects

### Slow inference
- Normal for SHARP (~2-5s per image)
- Ensure you have CUDA-capable GPU
- CPU mode works but much slower (~30s+)

### Normal map looks wrong (uniform blue)
- Means normal extraction failed (requires scipy)
- Install: `pip install scipy`
- Restart script

### Depth map appears black/white blocks
- Means no valid Gaussians projected to that region
- Try different camera parameters in code
- Some images don't reconstruct well (flat textures, reflections)

### Model checkpoint not downloading
- Run `download_model.bat` manually
- Or download from: https://ml-site.cdn-apple.com/models/sharp/sharp_model.pth
- Place in `checkpoints/sharp_model.pth`

## Limitations

- **Scene Requirements**: Works best on:
  - Photos of real objects/people
  - Good lighting and focus
  - Clear depth cues
  
- **Doesn't Work Well On**:
  - Abstract art or flat graphics
  - Reflective surfaces (mirrors, glass)
  - Very blurry or low-res images
  - Text-only images

- **Performance**: 
  - Requires GPU for reasonable speed
  - ~2-5s per 2MP image on RTX 3060
  - ~30s+ on CPU

## Advanced: Using Gaussian Data Directly

The `_gaussians.json` file contains the full 3D reconstruction. You can:

1. **Custom Rendering**: Write your own WebGL splatting renderer
2. **Novel View Synthesis**: Render from arbitrary camera positions
3. **3D Export**: Convert Gaussians to mesh (PLY format)
4. **Animation**: Interpolate camera movement through the scene

Example JSON structure:
```json
{
  "original_size": [1920, 1080],
  "num_gaussians": 87432,
  "positions": [[x, y, z], ...],
  "colors": [[r, g, b], ...],
  "scales": [[sx, sy, sz], ...],
  "rotations": [[w, x, y, z], ...],
  "opacities": [α, ...]
}
```

## Next Steps

1. Try combining SHARP depth with multiple effects in shader stack
2. Experiment with different light angles on portrait photos
3. Compare Depth Pro vs SHARP depth quality on your images
4. Use normal maps for custom relief effects

**Tip**: SHARP depth + normals make **Geometric Enhance** dramatically better than pseudo-depth alone!
