# Local Companion

The Shader Playground is still a static browser app. Heavy model inference runs
through an optional Windows-local Python companion so the frontend bundle stays
small and the manual upload workflow remains available.

## Start The Service

```bat
start_companion.bat
```

The companion listens only on:

```text
http://127.0.0.1:8765
```

Use `setup_depth_pro.bat` before Depth Pro generation and `setup_sharp.bat`
before SHARP generation.

## UI Workflow

1. Start the companion.
2. Open `index.html`.
3. Upload an image.
4. Click `Generate Depth Pro` to create and load a depth map.
5. Click `Generate SHARP` to create and load a SHARP PLY preview.

The app also checks `/health` and shows whether Depth Pro and SHARP are ready.

## Endpoints

```text
GET  /health
POST /depth-pro?filename=<name>
POST /sharp?filename=<name>
GET  /assets/<asset-id>/<path>
```

Responses include cache status, package paths, and URLs for generated assets.

## Generated Asset Packages

Generated files are stored under `generated-assets/`, which is ignored by Git.
Each source image gets a package folder based on the SHA-256 hash of the image
bytes:

```text
generated-assets/
  <asset-id>/
    manifest.json
    source.<ext>
    depth_pro.png
    depth_pro_raw.npy
    sharp/
      gaussians/
        source.ply
```

The manifest records:

- Original filename and source image hash.
- Depth Pro status, model/checkpoint cache key, output paths, and depth range.
- SHARP status, model/checkpoint cache key, official PLY output path, and CLI logs.

Depth Pro and SHARP entries are regenerated only when their cache keys change or
their required output files are missing.

## SHARP CLI Discovery

The companion looks for SHARP in:

- `SHADER_PLAYGROUND_SHARP_CLI`, if set.
- PATH (`sharp` or `sharp.exe`).
- The active Python `Scripts` folder.
- Local `.venv` / `venv` script folders.
- The user Python Scripts folder on Windows.

This avoids the common Windows issue where pip installs `sharp.exe` but the
terminal PATH does not expose it immediately.

## Scripts Folder

Implementation scripts live in `scripts/`:

```text
scripts/
  shader_companion.py
  depth_pro_generate.py
  check_sharp_cli.py
```

Root `.bat` and `.sh` files are intentionally thin launchers.

## Known Limits

The companion currently supports Windows-local workflows first. Depth Pro maps
are immediately useful in the shader stack. SHARP PLY files can be generated,
cached, uploaded, and previewed, but full 3DGS rendering and SHARP-derived
depth/normal extraction are planned for a later pass.
