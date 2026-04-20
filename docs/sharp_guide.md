# Apple SHARP Guide

SHARP support now follows Apple's official `sharp predict` CLI flow. The old
custom JSON generator was removed because it guessed internal Python APIs and did
not match the official 3DGS `.ply` output.

## What SHARP Produces

SHARP reconstructs a 3D Gaussian Splatting representation from a single image.
The official CLI writes `.ply` files that can be consumed by Gaussian splat
renderers and by the playground's current lightweight PLY preview.

Use Depth Pro for fast depth maps. Use SHARP when you want official 3DGS assets
or when future splat/depth/normal extraction is needed.

## Setup

Windows setup:

```bat
setup_sharp.bat
```

The setup script installs CUDA PyTorch, installs Apple's SHARP package from
GitHub, fixes the numpy/opencv versions used by the local workflow, and verifies
whether the companion can discover `sharp.exe`.

SHARP can auto-download its checkpoint on first use. If you download a checkpoint
manually, place it at one of these paths:

```text
checkpoints/sharp_2572gikvuh.pt
checkpoints/sharp_model.pth
```

The companion also checks the default Torch checkpoint cache.

## Generate From The UI

1. Run `start_companion.bat`.
2. Open `index.html`.
3. Upload an image.
4. Click `Generate SHARP`.

The companion stages the source image, runs:

```bat
sharp predict -i <input-folder> -o <output-folder>
```

If a recognized local checkpoint exists, the companion adds:

```bat
-c <checkpoint>
```

## Cache Behavior

Generated SHARP assets live in the same source-image package as Depth Pro:

```text
generated-assets/
  <asset-id>/
    manifest.json
    source.<ext>
    sharp/
      gaussians/
        source.ply
```

SHARP is reused when the source image, model id/version, checkpoint hash, and
generation settings match. If any of those change, the companion regenerates the
asset.

## PLY Upload And Preview

You can also upload an existing `.ply` with the `PLY` button.

The current preview and map workflow:

- Parses ASCII and binary little-endian PLY files.
- Supports standard RGB fields and official 3DGS fields like `f_dc_0`,
  `opacity`, and `scale_0`.
- Opens in a front-aligned image overlay by default.
- Provides `Front`, `Orbit`, `Reset`, `Viewer Quality`, size, opacity, density,
  and depth controls.
- Uses a lightweight WebGL point-splat renderer for usability.
- Derives separate 3DGS depth and normal textures for the 2D shader stack.
- Uses `Map Quality` to control the offscreen extraction density and denoising
  pass count independently from the visible viewer density.
- Uses `Depth Guide` to let a loaded Depth Pro or manual depth map preserve
  silhouettes during 3DGS map filtering. `Depth Pro Edges` is conservative;
  `Edges + Fill` and `Strong Fusion` let the depth guide fill sparse areas more
  aggressively.
- Auto-enables the derived maps after generation or upload; use `Use 3DGS Maps`
  to turn them off or back on.

This preview is not a physically correct full 3DGS renderer yet. It is a bridge
that makes official PLY assets visible, inspectable, and useful for depth-aware
image effects inside the app.

## Troubleshooting

- If `Generate SHARP` says the CLI is missing, run `setup_sharp.bat` and restart
  `start_companion.bat`.
- If Windows still cannot find the CLI, set `SHADER_PLAYGROUND_SHARP_CLI` to the
  full `sharp.exe` path.
- If inference says CPU only, install a CUDA-enabled PyTorch build in the Python
  environment that owns `sharp.exe`.
- If generation is slow, check the `stdout_tail` in `manifest.json`; it reports
  the device SHARP used.

## Next Refinement Pass

The app still needs:

- Full 3DGS rendering instead of point-splat preview.
- Optional higher-precision browser targets for even smoother derived depth maps
  where WebGL support allows it.
