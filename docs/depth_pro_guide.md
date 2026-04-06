# Quick Start: Depth Pro + Shader Playground

## 🚀 5-Minute Setup

### Step 1: Install Depth Pro & Download Model
Double-click `setup_depth_pro.bat` and wait for:
- Python packages to install (~1 minute)
- Model checkpoint to download (~5GB, 2-5 minutes)

**Note:** First-time setup downloads the pretrained model once. Subsequent runs are instant!

### Step 2: Generate Your First Depth Map
1. Find a photo you want to enhance
2. Drag it onto `generate_depth.bat`
3. Wait ~0.3 seconds (GPU) or ~3 seconds (CPU)
4. You'll see `yourphoto_depth.png` created next to the original

### Step 3: Try It in the Playground
1. Open `index.html` in your browser
2. Click "Upload Image" → select your photo
3. Click "Upload Depth Map" → select the `_depth.png` file
4. Add a depth effect (try "Depth of Field" first!)
5. Toggle "Use MiDAS Depth" ON
6. Play with the sliders!

## 🎨 Recommended Effects to Try

### Cinematic Portrait
1. **Depth of Field**
   - Focal Depth: 0.3
   - Bokeh Strength: 15
   - Creates professional camera blur

### Atmospheric Landscape
1. **Atmospheric Fog**
   - Fog Start: 0.4
   - Fog Density: 0.7
   - Adds distance haze

### 3D Pop-Out
1. **3D Anaglyph**
   - Eye Separation: 8
   - View with red/cyan glasses!

### Dramatic Lighting
1. **Relief Lighting**
   - Light Angle: 1.5
   - Bump Strength: 8
   - Creates 3D-like shadows

### Edge Enhancement
1. **Edge Glow**
   - Edge Threshold: 0.15
   - Glow Width: 3
   - Makes subjects pop

## 🔧 Troubleshooting

**"Model not found" error?**
→ Run `download_model.bat` to manually download the checkpoint

**Download failed?**
→ Download manually from: https://ml-site.cdn-apple.com/models/depth-pro/depth_pro.pt
→ Save to: `checkpoints/depth_pro.pt`

**Effect is backwards?**
→ Toggle "Invert Depth" ON

**Depth map looks wrong?**
→ Depth Pro works best with:
  - Natural photos with clear depth (not flat graphics)
  - Good lighting
  - Clear subject/background separation

**Too slow?**
→ Make sure you have:
  - CUDA-compatible GPU
  - Latest GPU drivers
  - PyTorch with CUDA support

## 💡 Pro Tips

1. **Batch Process** - Generate depth for all your photos at once:
   ```
   python depth_pro_generate.py -b ./MyPhotos
   ```

2. **Stack Effects** - Combine multiple depth effects:
   - Atmospheric Fog + Depth of Field = cinematic mood
   - Edge Glow + Selective Sharpen = enhanced details
   - Depth Color Grade + Relief Lighting = stylized 3D

3. **Fine-tune** - Each effect has multiple parameters:
   - Start with defaults
   - Adjust one slider at a time
   - Use "Invert Depth" if needed

4. **Export Quality** - Downloads are at original resolution, not canvas size!

## 📊 Depth Pro vs Alternatives

| Method | Quality | Speed | Setup |
|--------|---------|-------|-------|
| Pseudo-depth | ⭐ | Instant | None |
| MiDAS | ⭐⭐⭐ | ~1s | Model download |
| **Depth Pro** | ⭐⭐⭐⭐⭐ | ~0.3s | `pip install` |

Depth Pro wins on:
- Sharper edges (better glow/shadows)
- Metric depth (real distances)
- High resolution (1536px+)
- Faster inference

## 🎯 Next Steps

1. Try all the depth effects
2. Experiment with stacking (Fog + DoF + Glow)
3. Process your photo library
4. Share your creations!

**Need Help?** Check the main README.md for detailed docs.
