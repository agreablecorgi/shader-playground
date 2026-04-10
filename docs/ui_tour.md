# Shader Playground UI Tour

This tour explains where the main tools live and how the current image, depth,
paper, and PLY workflows fit together.

## 1. Top Bar

The top bar contains global project actions:

- Output resolution: fit-to-image or preset export sizes.
- Global gamma: overall output brightness curve.
- Theme toggle: light, dark, or auto.
- Save stack: export the current layer configuration as JSON.
- Load stack: import a saved stack.
- Export PNG/JPG: download the current rendered result.

## 2. Left Panel

The left panel manages assets and the layer stack.

## Asset Inputs

- `Upload Image`: loads the source image.
- `Depth`: manually uploads a depth map.
- `Normal`: manually uploads a normal map.
- `PLY`: uploads a SHARP/3DGS `.ply` file for preview.
- `Generate Depth Pro`: asks the local companion to generate and auto-load a
  Depth Pro map for the current image.
- `Generate SHARP`: asks the local companion to generate and auto-load a SHARP
  `.ply` preview for the current image.

## PLY Preview Controls

After a PLY is loaded, the app shows preview controls:

- `Front`: front-aligned overlay on the original image.
- `Orbit`: rotate the splat cloud in 3D.
- `Reset`: restore the default preview camera.
- `Size`: splat point size.
- `Opacity`: overlay opacity.
- `Density`: sampled splat count for preview performance.
- `Depth`: depth exaggeration in orbit mode.

Mouse behavior in PLY preview:

- Wheel zooms.
- Drag pans in `Front` mode.
- Drag rotates in `Orbit` mode.
- Double-click resets the preview.

## Layer Stack

Every effect added from the picker appears as a layer card.

- Reorder layers by dragging.
- Toggle layers on/off.
- Remove layers with the delete button.
- Select a layer to edit its controls.
- Use per-layer blend mode and opacity for compositing.

## 3. Center Canvas

The canvas shows the live WebGL output.

- Normal image mode supports pan and zoom.
- PLY preview mode switches the mouse controls to the PLY camera.
- Export uses the selected output settings rather than only the visible canvas
  size.

## 4. Right Panel

The right panel shows controls for the selected layer.

Common control patterns:

- `Blend` or `Intensity`: how strongly the layer contributes.
- Range sliders: numeric shader parameters.
- Toggles: depth/normal usage, inversion, or mode switches.
- Dropdowns/tabs: presets and discrete modes.

The Paper Texture shader includes paper presets, medium presets, grain size,
texture weight, absorbency, bleed, tooth, edge darkening, pigment settling, and
realistic color toggling.

## 5. Effect Picker

Effects are grouped into tabs such as:

- Filters.
- Color.
- Signal.
- Artistic.
- Depth.
- 3D.

Current 3D-related controls include PLY Preview, `3D View`, `Normal Map
Lighting`, and `Geometric Enhance`. The PLY preview is separate from the shader
stack and is currently a lightweight point-splat inspection tool.
