# Depth Pro Guide

Depth Pro support gives the depth-aware shaders a real depth map instead of the
browser-only pseudo-depth fallback. You can use it manually with generated PNGs
or through the optional local companion.

## Setup

Run the setup script once:

```bat
setup_depth_pro.bat
```

This installs the Python dependencies, creates `checkpoints/`, and downloads the
Depth Pro checkpoint to:

```text
checkpoints/depth_pro.pt
```

If the download fails, run:

```bat
download_model.bat
```

Depth Pro uses CUDA automatically when the installed PyTorch build can see a GPU.
Otherwise it falls back to CPU.

## UI Generation

For the in-UI workflow:

1. Run `start_companion.bat`.
2. Open `index.html`.
3. Upload a source image.
4. Click `Generate Depth Pro`.

The generated `depth_pro.png` is loaded automatically as the current depth map,
and depth-aware shaders are switched to `Use Depth Map`.

## Manual Generation

Single image:

```bat
generate_depth.bat path\to\image.png
```

Batch folder:

```bat
python scripts\depth_pro_generate.py -b path\to\images
```

Manual outputs use the legacy sibling-file style, for example:

```text
photo.png
photo_depth.png
```

Upload the generated depth image through the `Depth` button in the app.

## Generated Asset Cache

When generated through the companion, assets are stored under:

```text
generated-assets/
  <asset-id>/
    manifest.json
    source.<ext>
    depth_pro.png
    depth_pro_raw.npy
```

The cache key includes:

- Source image SHA-256.
- Depth Pro model id/version.
- Depth Pro checkpoint SHA-256.
- Generation settings.

If the same image and model state are used again, the app reuses the existing
package instead of regenerating.

## Recommended Depth Effects

- `Depth of Field`: subject/background separation and bokeh.
- `Atmospheric Fog`: distance haze and cinematic mood.
- `3D Anaglyph`: red/cyan stereo offset from depth.
- `Depth Edge Glow`: outline and rim effects around depth discontinuities.
- `Selective Sharpen`: focus-aware sharpening.
- `Depth Shadow`: offset shadows driven by depth.

## Troubleshooting

- If generation says the checkpoint is missing, run `setup_depth_pro.bat` or
  `download_model.bat`.
- If generation is slow, confirm CUDA PyTorch is installed and visible to Python.
- If an effect appears backwards, toggle `Invert Depth`.
- If a generated map does not seem to affect a shader, make sure the shader's
  `Use Depth Map` toggle is enabled.

## Known Limits

The current depth shaders work with generated maps, but their parameter ranges
still need a dedicated refinement pass. Expect future improvements around depth
gamma, near/far remapping, focal controls, and more consistent effect response.
