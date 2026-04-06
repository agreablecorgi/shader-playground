# 🎨 Shader Playground: UI Tour

Welcome to the visual guide for the Shader Playground interface. This document walks you through the various panels and tools available for creating stunning image effects.

![Main Interface](docs/assets/main_interface.png)

## 1. Top Navigation Bar
The titlebar houses global project settings and export options:
- **Resolution**: Choose between "Fit to image" or standard presets (1080p, 4K, etc.) for the final output.
- **Global Gamma**: Adjust the brightness curve for the entire output.
- **Theme Toggle**: Switch between **Dark Mode**, **Light Mode**, or **Auto** based on your system preferences.
- **Stack Management**: 
    - **Save Stack**: Export your current layer configuration as a `.json` file.
    - **Load Stack**: Import a previously saved configuration to resume work.
- **Export PNG**: Download your final result as a high-quality PNG.

---

## 2. Asset & Layer Management (Left Panel)
This panel is your command center for bringing in assets and managing the rendering order.

### Asset Uploads
- **Upload Image**: Load your primary photo to begin processing.
- **Depth**: Upload a MiDAS or Depth Pro map for advanced distance-based effects.
- **Normal**: Upload a surface normal map (e.g., from SHARP) for realistic 3D lighting.
- **Splat**: Import a Gaussian Splat JSON to enable the **3D Gaussian Viewer**.

### Shader Stack
Every effect you add appears here as a "Layer Card". 
- **Reordering**: Drag and drop cards to change the rendering order. Shaders are applied from top to bottom.
- **Toggles**: Enable or disable layers instantly.
- **Blending**: Change the blend mode (Multiply, Screen, Overlay, etc.) and opacity for refined compositing.

---

## 3. The Interactive Canvas (Center)
The canvas area provides real-time feedback at 60fps.
- **Zoom**: Use your mouse wheel to zoom in for precise adjustments.
- **Pan**: Click and drag to move the image around the workspace.
- **Fit to Screen**: Use the 🔍 icon in the toolbar to instantly reset the view.

---

## 4. Contextual Controls (Right Panel)
The controls panel changes based on which layer you've selected in the stack.

![Grayscale Settings](docs/assets/grayscale_settings.png)

- **Shader Settings**: Adjust parameters specific to the selected effect (e.g., Blur Radius, Glitch Intensity).
- **Global Blend**: Fine-tune the localized intensity of the shader.

### 🌈 Advanced: Gradient Editor
When using the **Gradient Map** or **Tritone** shaders, a specialized editor appears.

![Gradient Editor](docs/assets/gradient_map_settings.png)

- **Presets**: Choose from curated color schemes like "Sunset", "Cyberpunk", or "Autumn".
- **Custom Stops**: Click the gradient bar to add new color stops, drag to reposition, or use the color picker for total control.

---

## 5. Effect Picker (Bottom)
Explore over 50 shaders categorized for easy discovery:
- **Filters**: Halftone, Dithering, Pixelate.
- **Color**: Grade, Sepia, Technicolor, OKLCH.
- **Signal**: CRT, VHS, Signal Emulation.
- **Depth**: Depth of Field, Tilt-Shift, Fog, Shadows.
- **3D**: Gaussian Viewer, Normal Map Lighting.

> [!TIP]
> Try stacking **Chromatic Aberration** on top of **CRT** for a perfect retro aesthetic!
