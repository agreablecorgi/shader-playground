# 🛠️ Contributing: Adding New Shaders

Want to add a custom effect to the Shader Playground? This guide explains how to register a new fragment shader and expose its controls to the UI.

## 1. Create the Fragment Shader
Add your shader code to `shaders.js`. 

- Use `u_image` (sampler2D) for the input texture.
- Use `v_texCoord` (vec2) for UV coordinates.
- Use `u_intensity` (float, 0.0–1.0) for the global blend amount.
- **Example**:
```glsl
// shaders.js
fragmentShaders['my_custom_effect'] = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_intensity;
    uniform float u_myParam;

    void main() {
        vec4 color = texture2D(u_image, v_texCoord);
        // Apply effect logic...
        gl_FragColor = mix(color, vec4(color.rgb * u_myParam, 1.0), u_intensity);
    }
`;
```

---

## 2. Register UI Controls
In `app.js`, find the `showShaderControls(shaderName)` method and add your shader's parameters to the `controls` object.

- **Supported Types**: 'range' (slider), 'toggle' (checkbox), 'tabs' (buttons).
- **Example**:
```javascript
// app.js (showShaderControls)
my_custom_effect: [
    { name: 'intensity', label: 'Blend', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
    { name: 'myParam',   label: 'Glow Size', min: 0, max: 10, step: 0.5, default: 2.0 }
],
```

---

## 3. Register the Default Parameters
Add the default values for your shader's parameters in `getDefaultShaderParams()`.

- **Example**:
```javascript
// app.js (getDefaultShaderParams)
my_custom_effect: {
    myParam: 2.0
},
```

---

## 4. Add to the Effect Picker
Finally, add a button for your shader in `index.html` within the appropriate `.ppanel`.

- **Example**:
```html
<!-- index.html -->
<div class="ppanel" id="ptab-filters">
    <button class="effect-btn" data-shader="my_custom_effect">My Effect</button>
</div>
```

## Tips for High Performance
1. **Minimize Texture Lookups**: Prefer math over multiple `texture2D` calls where possible.
2. **Use the Stack**: Instead of one massive "Super Shader", break it into small, independent shaders that can be stacked.
3. **Precision**: Use `mediump` for color math and `highp` for coordinate-sensitive logic.

Happy shading! 🚀
