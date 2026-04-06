# 🎨 Shader Playground (v2.0)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WebGL 1.0](https://img.shields.io/badge/WebGL-1.0-blue.svg)](https://www.khronos.org/webgl/)

A beautiful, high-performance WebGL shader playground for applying real-time, stackable effects to images. Build professional visual stacks with 50+ high-fidelity shaders including Halftone, Glitch, VHS, and Film Grain.

![Main Interface](docs/assets/main_interface.png)

## 🌟 Key Features
- **Pro-App UI**: Reorderable layers with per-shader blend modes and opacity.
- **3D Gaussian Splatting**: Direct integration with Apple SHARP for geometric 3D visualization.
- **Professional Depth**: Native support for **Apple Depth Pro** and **MiDAS** maps.
- **Gradient Mapping**: Custom multi-stop gradient editor for cinematic toning.
- **Zero Dependencies**: Pure Vanilla WebGL (60fps on modern GPUs).

---

## 🚀 Getting Started
1. **Open** `index.html` in any modern web browser.
2. **Upload** a main image to the center canvas.
3. **Explore** effects from the categorized tabs at the bottom.
4. **Refine** your creation using the contextual controls in the right panel.
5. **Export** as a high-quality PNG.

---

## 📽️ Documentation & Guides
| Guide | Description |
| :--- | :--- |
| 🎨 [Visual UI Tour](docs/ui_tour.md) | A complete walkthrough of the interface and tools. |
| 🛠️ [Developer Guide](docs/contributing.md) | How to add your own custom GLSL shaders. |
| 🎯 [Depth Pro Setup](docs/depth_pro_guide.md) | Generating and using professional depth maps. |
| 🔮 [SHARP/3D Guide](docs/sharp_guide.md) | Visualizing geometric depth and 3D gaussians. |

---

## 🎯 Advanced Integration (Optional)

### Depth Pro
To use advanced depth effects (Fog, Bokeh, Anaglyph):
1. Run `setup_depth_pro.bat`.
2. Drag your image onto `generate_depth.bat`.
3. Upload `_depth.png` into the **Depth** slot.

### SHARP (3D Gaussians)
For surface normal lighting and 3D reconstruction:
1. Run `setup_sharp.bat`.
2. Drag your image onto `generate_sharp.bat`.
3. Upload the `_gaussians.json` and `_normals.png` files.

---

## 🛠️ Technical Specs
- **Engine**: Pure Vanilla WebGL 1.0.
- **Rendering**: Multi-pass compositing with ping-pong framebuffers.
- **Precision**: 32-bit float support for high-fidelity gradients.
- **Performance**: Hardware-accelerated for 100+ simultaneous layers.

---

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

