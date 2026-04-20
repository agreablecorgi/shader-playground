# Shader Playground

A vanilla WebGL image-effects playground for building stackable shader looks in
the browser. The core app stays static and lightweight, while optional local
Python helpers can generate Depth Pro maps and SHARP 3DGS assets on Windows.

## What Is Included

- Layer stack with reorderable effects, blend modes, opacity, and per-shader controls.
- 50+ realtime WebGL shaders, including film, color, depth, signal, artistic, and paper effects.
- Procedural Paper Texture shader with paper and medium presets.
- Manual depth/normal uploads for advanced depth-aware effects.
- Optional local companion for in-UI Apple Depth Pro and SHARP generation.
- SHARP `.ply` upload/generation support with a front-aligned PLY preview.
- Static frontend: open `index.html` directly in a modern browser.

## Quick Start

1. Open `index.html`.
2. Upload a source image.
3. Pick effects from the bottom tabs.
4. Select layers in the stack to adjust controls.
5. Export the result as PNG or JPG.

## Optional Local Companion

The local companion is only needed when you want the UI to generate Depth Pro or
SHARP assets automatically. Manual upload workflows still work without it.

```bat
setup_depth_pro.bat
setup_sharp.bat
start_companion.bat
```

After the companion is running:

1. Open `index.html`.
2. Upload an image.
3. Click `Generate Depth Pro` to create and auto-load a depth map.
4. Click `Generate SHARP` to create/cache official SHARP `.ply` assets.

Generated assets are written to `generated-assets/`, which is ignored by Git.
Each asset package is keyed by the source image hash and includes a manifest so
Depth Pro and SHARP outputs can be reused unless the model/checkpoint/settings
change.

## Documentation

| Guide | Purpose |
| --- | --- |
| [UI Tour](docs/ui_tour.md) | Interface walkthrough and where major tools live. |
| [Developer Guide](docs/contributing.md) | How to add shaders, controls, docs, and helper scripts. |
| [Depth Pro Guide](docs/depth_pro_guide.md) | Depth Pro setup, manual generation, UI generation, and cache behavior. |
| [Local Companion](docs/local_companion.md) | Companion endpoints, generated package layout, and troubleshooting. |
| [SHARP Guide](docs/sharp_guide.md) | SHARP setup, official CLI flow, cache behavior, and PLY preview limits. |

## Project Layout

```text
.
  index.html              Static app shell
  app.js                  UI, WebGL pipeline, asset loading, controls
  shaders.js              Fragment shader registry
  styles.css              Application styling
  scripts/                Python helper scripts and local companion
  docs/                   User and developer documentation
  generated-assets/       Ignored local Depth Pro / SHARP output packages
  checkpoints/            Ignored local model checkpoints
```

## Current 3D/Depth Status

Depth Pro is usable today for the depth shader stack. Generated depth maps are
auto-loaded into shaders that expose `Use Depth Map`.

SHARP generation now uses Apple's official `sharp predict` CLI and outputs
official 3DGS `.ply` files. The app can upload or generate those PLY files and
display a lightweight point-splat preview with selectable viewer quality.
Loaded PLY assets also derive source-aligned 3DGS depth and normal maps for the
2D shader stack, with separate map quality presets for denoised extraction. A
loaded Depth Pro or manual depth map can guide 3DGS filtering so silhouettes stay
cleaner around subjects. Full physically correct 3DGS rendering remains a later
refinement pass.

## License

MIT. See [LICENSE](LICENSE).
