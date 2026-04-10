# Depth Pro Examples

This folder can hold sample images and generated depth maps for quick manual
testing.

## Setup

From the repository root:

```bat
setup_depth_pro.bat
```

## Generate Depth For This Folder

From `examples/`:

```bat
python ..\scripts\depth_pro_generate.py -b .
```

Typical outputs:

```text
portrait.jpg
portrait_depth.png
landscape.jpg
landscape_depth.png
```

## Use In The Playground

1. Open `index.html`.
2. Upload an example image.
3. Upload its matching `_depth.png`.
4. Add a depth-aware effect.
5. Turn on `Use Depth Map`.

## Notes

- CUDA GPU support is strongly recommended for faster generation.
- Companion-generated assets are stored in `generated-assets/`; this folder is
  for simple manual examples.
- Depth Pro usually works best on natural images with clear foreground and
  background separation.
