# Shader Playground - AI Coding Instructions

## Project Overview
Zero-dependency WebGL shader playground for real-time image effects. Pure vanilla JavaScript with GPU-accelerated rendering. No build tools, frameworks, or bundlers—just open `index.html` in a browser.

## Architecture

### Core Components
- **ShaderPlayground class** ([app.js](app.js)): Main application controller managing WebGL context, shader compilation, and render pipeline
- **Fragment shaders** ([shaders.js](shaders.js)): 30+ GLSL shader definitions stored as template strings in `fragmentShaders` object
- **Multi-pass rendering**: Uses framebuffer ping-pong technique with 2 framebuffers (`this.framebuffers[0/1]`) to chain effects

### Rendering Pipeline
1. User uploads image → creates WebGL texture (`setupTexture()`)
2. Shaders added to stack (`shaderStack[]`) with unique IDs and per-shader intensity
3. Each frame: iterate stack, render each shader using previous output as input
4. Final pass renders to canvas; intermediate passes render to framebuffers

**Critical pattern**: Texture coordinates flip based on source—framebuffer textures need Y-flip, image textures don't ([app.js](app.js#L843-L852))

## Adding New Shaders

### 1. Define Fragment Shader in shaders.js
```javascript
fragmentShaders.myEffect = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_time;        // Animation time (seconds)
    uniform float u_intensity;   // Global or per-shader (0.0-1.0)
    uniform vec2 u_resolution;   // Canvas dimensions (pixels)
    varying vec2 v_texCoord;     // Texture coordinate (0.0-1.0)
    
    void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        // Your effect here
        gl_FragColor = color;
    }
`;
```

### 2. Add Button to index.html
```html
<button class="effect-btn" data-shader="myEffect">My Effect</button>
```

### 3. Add Custom Parameters (Optional)
In `getDefaultShaderParams()` in [app.js](app.js#L50):
```javascript
myEffect: {
    strength: 0.5,
    radius: 10.0
}
```

In shader controls `shaderControls` object (search for "halftone_cmyk" in app.js for examples):
```javascript
myEffect: [
    { name: 'strength', label: 'Strength', min: 0, max: 1, step: 0.01, default: 0.5 },
    { name: 'radius', label: 'Radius', min: 1, max: 20, step: 0.1, default: 10.0 }
]
```

Parameters automatically become `u_paramName` uniforms in shader (e.g., `u_strength`, `u_radius`)

## Key Conventions

### Standard Uniforms (Available to All Shaders)
- `u_image`: Input texture (sampler2D)
- `u_time`: Elapsed time for animation, scaled by speed slider
- `u_intensity`: Shader's individual intensity (0.0-1.0) from stack
- `u_resolution`: Canvas width/height in pixels

### Shader Stack Behavior
- "Original" shader clears the stack
- Drag-and-drop reordering changes effect application order
- Each shader has independent intensity stored in stack item
- Selected shader shows custom controls in right sidebar

### WebGL Context Setup
- `preserveDrawingBuffer: true` required for `canvas.toBlob()` download
- Textures use `CLAMP_TO_EDGE` and `LINEAR` filtering
- No depth buffer—2D effects only

## Development Workflow

### Running
Open `index.html` in any modern browser with WebGL support. No server required.

### Debugging Shaders
1. Shader compilation errors log to console with `gl.getShaderInfoLog()`
2. Use simple color output to test: `gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);`
3. Visualize coordinates: `gl_FragColor = vec4(v_texCoord, 0.0, 1.0);`

### Performance Considerations
- Framebuffer allocation happens on image load and canvas resize
- Animation runs at 60fps using `requestAnimationFrame`
- Complex shaders with many texture samples can drop frames

## Common Patterns

### CMYK Halftone Pattern (See halftone_cmyk in shaders.js)
- Rotates screen grid by different angles per channel (15°, 75°, 0°, 45°)
- Uses 3×3 neighborhood sampling for overlapping dots
- Demonstrates per-cell random jitter and subtractive color mixing

### Time-based Animation
```glsl
float wave = sin(u_time * 2.0 + v_texCoord.x * 10.0);
```

### Multi-sample Filters
Emboss, blur, edge detection use kernel convolution—sample 3×3 or 5×5 neighborhood around `v_texCoord`

## File Structure
```
/
├── index.html       # UI layout and shader category buttons
├── app.js           # ShaderPlayground class and WebGL logic
├── shaders.js       # All GLSL fragment shader definitions
└── styles.css       # Dark theme with gradient buttons and drag-drop styling
```

## Integration Points
None—fully self-contained browser app. WebGL is only external dependency (built into browsers).
