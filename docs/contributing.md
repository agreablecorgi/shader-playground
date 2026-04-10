# Developer Guide

This project is intentionally small: a static WebGL frontend plus optional local
Python scripts for heavyweight model inference.

## Main Files

```text
index.html      UI structure and effect buttons
styles.css      App styling
app.js          App state, controls, asset loading, render pipeline
shaders.js      Fragment shader registry
scripts/        Python helper scripts and companion service
docs/           Documentation
```

Keep root scripts as thin launchers. Implementation Python should live under
`scripts/`.

## Add A Shader

1. Add default parameters in `getDefaultShaderParams()` in `app.js`.
2. Add controls in `showShaderControls(shaderName)` in `app.js`.
3. Add a button in the correct picker panel in `index.html`.
4. Add the GLSL fragment shader in `shaders.js`.
5. Run `node --check app.js` and `node --check shaders.js`.
6. Update docs if the shader introduces a new workflow or asset requirement.

## Shader Contract

Fragment shaders usually receive:

```glsl
uniform sampler2D u_image;
uniform float u_intensity;
uniform vec2 u_resolution;
varying vec2 v_texCoord;
```

Depth-aware shaders may also receive:

```glsl
uniform sampler2D u_depthTexture;
uniform float u_useDepthTexture;
uniform float u_invertDepth;
```

Normal-aware shaders may receive:

```glsl
uniform sampler2D u_normalTexture;
uniform float u_useNormalTexture;
```

Use the shared naming convention where control names in `app.js` map to GLSL
uniforms with a `u_` prefix.

## Control Patterns

Use `intensity` as the per-shader blend control when possible:

```javascript
{ name: 'intensity', label: 'Blend', min: 0, max: 1, step: 0.01, default: 1.0, isPerShader: true }
```

Supported control styles include:

- Sliders with `min`, `max`, `step`, and `default`.
- Toggles with `type: 'toggle'`.
- Tabs with `type: 'tabs'`.
- Dropdowns with `type: 'dropdown'`.
- Color arrays with three normalized RGB values.

## Depth And SHARP Assets

Manual depth/normal upload should keep working even when the companion is not
running.

Companion-generated assets are stored under `generated-assets/` and keyed by the
source image SHA-256. Keep cache metadata in `manifest.json` so generated assets
can be reused safely when the source image and model state match.

SHARP uses official `.ply` files now. Do not reintroduce custom Gaussian JSON as
the primary format. If a future renderer needs derived data, create it from the
official PLY package.

## Paper Texture Shader Notes

The Paper Texture shader is fully procedural. It exposes paper presets and
medium presets through numeric dropdown indices. Keep future paper/medium
extensions procedural unless the project intentionally adds texture assets.

## Verification Checklist

Before committing:

```bat
node --check app.js
node --check shaders.js
python -m py_compile scripts\shader_companion.py scripts\depth_pro_generate.py scripts\check_sharp_cli.py
```

If you change setup or generation scripts, also smoke-test `start_companion.bat`
or the relevant endpoint when practical.
