// WebGL Shader Programs

const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

const fragmentShaders = {
    original: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            gl_FragColor = texture2D(u_image, v_texCoord);
        }
    `,

    halftone: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_mode;      // 0: Dot, 1: Line, 2: Square, 3: Cross
        uniform float u_cellSize;
        uniform float u_rotation;
        uniform float u_softness;
        uniform float u_contrast;
        
        varying vec2 v_texCoord;

        mat2 rotate2d(float angle) {
            return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        }

        void main() {
            vec2 pixelCoord = v_texCoord * u_resolution;
            
            // Rotate the grid
            float rad = u_rotation * 0.0174533; // deg to rad
            vec2 rotatedCoord = rotate2d(rad) * pixelCoord;
            
            // Cell calculation
            vec2 cellIdx = floor(rotatedCoord / u_cellSize);
            vec2 cellPos = fract(rotatedCoord / u_cellSize) - 0.5;
            
            // Sample image at cell center (un-rotate)
            vec2 samplePos = (rotate2d(-rad) * (cellIdx + 0.5) * u_cellSize) / u_resolution;
            samplePos = clamp(samplePos, 0.0, 1.0);
            
            vec4 color = texture2D(u_image, samplePos);
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Tonal mapping
            luma = clamp((luma - 0.5) * (1.0 + u_contrast) + 0.5, 0.0, 1.0);
            
            float pattern = 0.0;
            float radius = (1.0 - luma) * 0.75;
            
            if (u_mode < 0.5) { // Dot (Circle)
                float dist = length(cellPos);
                pattern = smoothstep(radius + u_softness, radius - u_softness, dist);
            } else if (u_mode < 1.5) { // Line
                float dist = abs(cellPos.y);
                pattern = smoothstep(radius + u_softness, radius - u_softness, dist);
            } else if (u_mode < 2.5) { // Square
                float dist = max(abs(cellPos.x), abs(cellPos.y));
                pattern = smoothstep(radius + u_softness, radius - u_softness, dist);
            } else { // Cross
                float dist = min(abs(cellPos.x), abs(cellPos.y));
                pattern = smoothstep(radius + u_softness, radius - u_softness, dist);
            }
            
            vec3 result = mix(vec3(1.0), vec3(0.0), pattern);
            vec4 original = texture2D(u_image, v_texCoord);
            gl_FragColor = vec4(mix(original.rgb, result, u_intensity), original.a);
        }
    `,

    halftone_cmyk_inverted: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        // CMYK Halftone - proper implementation with overlapping dots
        
        const vec3 CYAN = vec3(0.0, 0.7, 1.0);
        const vec3 MAGENTA = vec3(0.99, 0.31, 0.62);
        const vec3 YELLOW = vec3(1.0, 0.85, 0.0);
        const vec3 BLACK = vec3(0.14, 0.12, 0.13);
        const vec3 PAPER = vec3(0.98, 0.98, 0.96);

        const float ANGLE_C = 0.2618;
        const float ANGLE_M = 1.3090;
        const float ANGLE_Y = 0.0;
        const float ANGLE_K = 0.7854;

        float random(vec2 st) {
            return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        mat2 rotation(float angle) {
            float s = sin(angle);
            float c = cos(angle);
            return mat2(c, -s, s, c);
        }

        vec4 rgbToCmyk(vec3 rgb) {
            // Enhanced CMYK conversion with UCR (Under Color Removal)
            float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
            
            if (k >= 0.999) return vec4(0.0, 0.0, 0.0, 1.0);
            
            float invK = 1.0 / (1.0 - k);
            vec3 cmy = vec3(
                (1.0 - rgb.r - k) * invK,
                (1.0 - rgb.g - k) * invK,
                (1.0 - rgb.b - k) * invK
            );
            
            // UCR - replace common CMY with K for deeper blacks
            float ucr = min(min(cmy.r, cmy.g), cmy.b) * 0.5;
            cmy -= ucr;
            k += ucr;
            
            return vec4(cmy, k);
        }

        // Get halftone dot value for a channel with proper overlapping
        float getHalftoneDot(vec2 pixelCoord, float angle, int channel, float cellSize) {
            // Rotate coordinates
            mat2 rot = rotation(angle);
            vec2 rotated = rot * pixelCoord;
            
            // Find current cell
            vec2 cellPos = floor(rotated / cellSize);
            
            float maxDot = 0.0;
            
            // Check 3x3 neighborhood for overlapping dots (9 cells)
            for (float dy = -1.0; dy <= 1.0; dy++) {
                for (float dx = -1.0; dx <= 1.0; dx++) {
                    vec2 neighborCell = cellPos + vec2(dx, dy);
                    
                    // Grid noise - random offset for this cell
                    float noiseAmount = u_intensity * 0.2;
                    vec2 cellJitter = vec2(
                        random(neighborCell) - 0.5,
                        random(neighborCell + vec2(123.45, 67.89)) - 0.5
                    ) * noiseAmount * cellSize;
                    
                    // Dot center in rotated space
                    vec2 dotCenter = (neighborCell + 0.5) * cellSize + cellJitter;
                    
                    // Sample image at dot center (rotate back to original space)
                    vec2 samplePos = (rotation(-angle) * dotCenter) / u_resolution;
                    samplePos = clamp(samplePos, 0.0, 1.0);
                    vec3 rgb = texture2D(u_image, samplePos).rgb;
                    vec4 cmyk = rgbToCmyk(rgb);
                    
                    // Get value for this channel
                    float channelValue;
                    if (channel == 0) channelValue = cmyk.r;      // Cyan
                    else if (channel == 1) channelValue = cmyk.g; // Magenta
                    else if (channel == 2) channelValue = cmyk.b; // Yellow
                    else channelValue = cmyk.a;                   // Black
                    
                    // Distance from pixel to dot center
                    float dist = length(rotated - dotCenter);
                    
                    // Dot radius (allow dots to grow up to 1.5x cell size for overlap)
                    float maxRadius = cellSize * 0.8;
                    float radius = maxRadius * sqrt(channelValue); // sqrt for better dot growth
                    
                    // Soft edge
                    float softness = cellSize * 0.12;
                    float dot = 1.0 - smoothstep(radius - softness, radius + softness, dist);
                    
                    maxDot = max(maxDot, dot);
                }
            }
            
            return maxDot;
        }

        void main() {
            // Cell size controlled by intensity
            float cellSize = 5.0 + u_intensity * 10.0;
            
            vec2 pixelCoord = v_texCoord * u_resolution;
            
            // Calculate dot presence for each channel
            float cDot = getHalftoneDot(pixelCoord, ANGLE_C, 0, cellSize);
            float mDot = getHalftoneDot(pixelCoord, ANGLE_M, 1, cellSize);
            float yDot = getHalftoneDot(pixelCoord, ANGLE_Y, 2, cellSize);
            float kDot = getHalftoneDot(pixelCoord, ANGLE_K, 3, cellSize);
            
            // Start with paper white
            vec3 result = PAPER;
            
            // Apply inks with proper subtractive color mixing
            // Each ink layer absorbs certain wavelengths
            vec3 cLayer = vec3(1.0 - CYAN.r, 1.0 - CYAN.g, 1.0 - CYAN.b);
            vec3 mLayer = vec3(1.0 - MAGENTA.r, 1.0 - MAGENTA.g, 1.0 - MAGENTA.b);
            vec3 yLayer = vec3(1.0 - YELLOW.r, 1.0 - YELLOW.g, 1.0 - YELLOW.b);
            vec3 kLayer = vec3(1.0 - BLACK.r, 1.0 - BLACK.g, 1.0 - BLACK.b);
            
            // Multiply by absorption (1.0 = no absorption, 0.0 = full absorption)
            result *= mix(vec3(1.0), cLayer, cDot * 0.9);
            result *= mix(vec3(1.0), mLayer, mDot * 0.9);
            result *= mix(vec3(1.0), yLayer, yDot * 0.9);
            result *= mix(vec3(1.0), kLayer, kDot * 0.95);
            
            // Slight contrast boost for punchier blacks
            result = pow(result, vec3(0.95));
            
            gl_FragColor = vec4(result, 1.0);
        }
    `,

    halftone_cmyk: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform vec2 u_resolution;

        uniform float u_cellSize;
        uniform float u_gridNoise;
        uniform float u_softness;
        uniform float u_gainC;
        uniform float u_gainM;
        uniform float u_gainY;
        uniform float u_gainK;
        uniform float u_floodC;
        uniform float u_floodM;
        uniform float u_floodY;
        uniform float u_floodK;

        varying vec2 v_texCoord;

        const vec3 PAPER = vec3(0.98, 0.98, 0.96);

        const float ANGLE_C = 0.2618;  // 15 deg
        const float ANGLE_M = 1.3090;  // 75 deg
        const float ANGLE_Y = 0.0;     //  0 deg
        const float ANGLE_K = 0.7854;  // 45 deg

        float random(vec2 st) {
            return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        mat2 rotation(float angle) {
            float s = sin(angle);
            float c = cos(angle);
            return mat2(c, -s, s, c);
        }

        vec4 rgbToCmyk(vec3 rgb) {
            float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
            if (k >= 0.999) return vec4(0.0, 0.0, 0.0, 1.0);

            float invK = 1.0 / (1.0 - k);
            vec3 cmy = vec3(
                (1.0 - rgb.r - k) * invK,
                (1.0 - rgb.g - k) * invK,
                (1.0 - rgb.b - k) * invK
            );

            return vec4(cmy, k);
        }

        float getHalftoneDot(vec2 pixelCoord, float angle, int channel, float cellSize) {
            // Resolve gain/flood once per channel outside the loop
            float gain  = (channel == 0) ? u_gainC  : (channel == 1) ? u_gainM  : (channel == 2) ? u_gainY  : u_gainK;
            float flood = (channel == 0) ? u_floodC : (channel == 1) ? u_floodM : (channel == 2) ? u_floodY : u_floodK;

            mat2 rot = rotation(angle);
            vec2 rotated = rot * pixelCoord;
            vec2 cellPos = floor(rotated / cellSize);

            float maxDot = 0.0;
            float maxRadius    = cellSize * 0.5;          // dots touch but never overlap at full coverage
            float softnessAmt  = cellSize * u_softness;

            for (float dy = -1.0; dy <= 1.0; dy++) {
                for (float dx = -1.0; dx <= 1.0; dx++) {
                    vec2 neighborCell  = cellPos + vec2(dx, dy);

                    vec2 cellJitter = vec2(
                        random(neighborCell) - 0.5,
                        random(neighborCell + vec2(123.45, 67.89)) - 0.5
                    ) * u_gridNoise * cellSize * 0.5;

                    vec2 regularCenter = (neighborCell + 0.5) * cellSize;
                    vec2 dotCenter     = regularCenter + cellJitter;

                    // Sample colour at the regular (un-jittered) grid centre
                    vec2 samplePos = (rotation(-angle) * regularCenter) / u_resolution;
                    samplePos = clamp(samplePos, 0.0, 1.0);
                    vec4 cmyk = rgbToCmyk(texture2D(u_image, samplePos).rgb);

                    float channelValue = (channel == 0) ? cmyk.r :
                                         (channel == 1) ? cmyk.g :
                                         (channel == 2) ? cmyk.b : cmyk.a;

                    float adjustedValue = clamp(channelValue * (1.0 + gain) + flood, 0.0, 1.0);
                    float radius        = maxRadius * sqrt(adjustedValue);

                    // Guard: inner edge of smoothstep must be >= 0 to avoid GLSL UB
                    float edgeLo = max(radius - softnessAmt, 0.0);
                    float edgeHi = radius + softnessAmt;
                    float dist   = length(rotated - dotCenter);

                    // Avoid smoothstep(a, a, x) when both edges collapse to 0
                    float dotVal = (edgeHi > 0.0)
                        ? (1.0 - smoothstep(edgeLo, edgeHi, dist))
                        : 0.0;

                    maxDot = max(maxDot, dotVal);
                }
            }

            return maxDot;
        }

        void main() {
            vec2 pixelCoord = v_texCoord * u_resolution;

            float cDot = getHalftoneDot(pixelCoord, ANGLE_C, 0, u_cellSize);
            float mDot = getHalftoneDot(pixelCoord, ANGLE_M, 1, u_cellSize);
            float yDot = getHalftoneDot(pixelCoord, ANGLE_Y, 2, u_cellSize);
            float kDot = getHalftoneDot(pixelCoord, ANGLE_K, 3, u_cellSize);

            // Subtractive CMYK: each ink absorbs its complementary wavelength
            //   Cyan    absorbs red   | Magenta absorbs green
            //   Yellow  absorbs blue  | Black   absorbs all
            vec3 halftone = PAPER;
            halftone *= vec3(1.0 - cDot, 1.0,         1.0        );
            halftone *= vec3(1.0,        1.0 - mDot,  1.0        );
            halftone *= vec3(1.0,        1.0,          1.0 - yDot);
            halftone *= (1.0 - kDot * 0.92);

            // Intensity blends halftone against the original image
            vec3 original = texture2D(u_image, v_texCoord).rgb;
            gl_FragColor = vec4(mix(original, halftone, u_intensity), 1.0);
        }
    `,

    dithering: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_algorithm;
        uniform float u_matrixSize;
        uniform float u_colorLevels;
        uniform float u_spread;
        varying vec2 v_texCoord;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        float bayer2x2(vec2 position) {
            int x = int(mod(position.x, 2.0));
            int y = int(mod(position.y, 2.0));
            int index = x + y * 2;
            if (index == 0) return 0.0;
            if (index == 1) return 0.5;
            if (index == 2) return 0.75;
            return 0.25;
        }

        float bayer4x4(vec2 position) {
            int x = int(mod(position.x, 4.0));
            int y = int(mod(position.y, 4.0));
            int index = x + y * 4;
            
            if (index == 0) return 0.0625;
            if (index == 1) return 0.5625;
            if (index == 2) return 0.1875;
            if (index == 3) return 0.6875;
            if (index == 4) return 0.8125;
            if (index == 5) return 0.3125;
            if (index == 6) return 0.9375;
            if (index == 7) return 0.4375;
            if (index == 8) return 0.25;
            if (index == 9) return 0.75;
            if (index == 10) return 0.125;
            if (index == 11) return 0.625;
            if (index == 12) return 1.0;
            if (index == 13) return 0.5;
            if (index == 14) return 0.875;
            return 0.375;
        }

        float bayer8x8(vec2 position) {
            int x = int(mod(position.x, 8.0));
            int y = int(mod(position.y, 8.0));
            int index = x + y * 8;
            
            // Row 0
            if (index == 0) return 0.015625;
            if (index == 1) return 0.515625;
            if (index == 2) return 0.140625;
            if (index == 3) return 0.640625;
            if (index == 4) return 0.765625;
            if (index == 5) return 0.265625;
            if (index == 6) return 0.890625;
            if (index == 7) return 0.390625;
            
            // Row 1
            if (index == 8) return 0.203125;
            if (index == 9) return 0.703125;
            if (index == 10) return 0.078125;
            if (index == 11) return 0.578125;
            if (index == 12) return 0.953125;
            if (index == 13) return 0.453125;
            if (index == 14) return 0.828125;
            if (index == 15) return 0.328125;
            
            // Row 2
            if (index == 16) return 0.046875;
            if (index == 17) return 0.546875;
            if (index == 18) return 0.171875;
            if (index == 19) return 0.671875;
            if (index == 20) return 0.796875;
            if (index == 21) return 0.296875;
            if (index == 22) return 0.921875;
            if (index == 23) return 0.421875;
            
            // Row 3
            if (index == 24) return 0.234375;
            if (index == 25) return 0.734375;
            if (index == 26) return 0.109375;
            if (index == 27) return 0.609375;
            if (index == 28) return 0.984375;
            if (index == 29) return 0.484375;
            if (index == 30) return 0.859375;
            if (index == 31) return 0.359375;
            
            // Row 4
            if (index == 32) return 0.750000;
            if (index == 33) return 0.250000;
            if (index == 34) return 0.875000;
            if (index == 35) return 0.375000;
            if (index == 36) return 0.000000;
            if (index == 37) return 0.500000;
            if (index == 38) return 0.125000;
            if (index == 39) return 0.625000;
            
            // Row 5
            if (index == 40) return 0.937500;
            if (index == 41) return 0.437500;
            if (index == 42) return 0.812500;
            if (index == 43) return 0.312500;
            if (index == 44) return 0.187500;
            if (index == 45) return 0.687500;
            if (index == 46) return 0.062500;
            if (index == 47) return 0.562500;
            
            // Row 6
            if (index == 48) return 0.781250;
            if (index == 49) return 0.281250;
            if (index == 50) return 0.906250;
            if (index == 51) return 0.406250;
            if (index == 52) return 0.031250;
            if (index == 53) return 0.531250;
            if (index == 54) return 0.156250;
            if (index == 55) return 0.656250;
            
            // Row 7
            if (index == 56) return 0.968750;
            if (index == 57) return 0.468750;
            if (index == 58) return 0.843750;
            if (index == 59) return 0.343750;
            if (index == 60) return 0.218750;
            if (index == 61) return 0.718750;
            if (index == 62) return 0.093750;
            return 0.593750; // index == 63
        }

        vec3 quantizeColor(vec3 color, float levels) {
            return floor(color * levels + 0.5) / levels;
        }

        vec3 errorDiffusion(vec3 color, vec2 uv, float levels, int method) {
            vec2 pixelSize = 1.0 / u_resolution;
            
            // Quantize current pixel
            vec3 quantized = quantizeColor(color, levels);
            vec3 error = color - quantized;
            
            // Sample neighbors and estimate their contribution
            // This approximates error diffusion by looking at what neighbors would contribute
            vec3 rightColor = texture2D(u_image, uv + vec2(pixelSize.x, 0.0)).rgb;
            vec3 downLeftColor = texture2D(u_image, uv + vec2(-pixelSize.x, pixelSize.y)).rgb;
            vec3 downColor = texture2D(u_image, uv + vec2(0.0, pixelSize.y)).rgb;
            vec3 downRightColor = texture2D(u_image, uv + vec2(pixelSize.x, pixelSize.y)).rgb;
            
            vec3 accumulated = quantized;
            
            if (method == 5) {
                // Floyd-Steinberg: distributes error to 4 neighbors
                // Current pixel gets errors from top-left neighbors
                vec3 leftColor = texture2D(u_image, uv + vec2(-pixelSize.x, 0.0)).rgb;
                vec3 upRightColor = texture2D(u_image, uv + vec2(pixelSize.x, -pixelSize.y)).rgb;
                vec3 upColor = texture2D(u_image, uv + vec2(0.0, -pixelSize.y)).rgb;
                vec3 upLeftColor = texture2D(u_image, uv + vec2(-pixelSize.x, -pixelSize.y)).rgb;
                
                vec3 leftError = (leftColor - quantizeColor(leftColor, levels)) * 7.0/16.0;
                vec3 upLeftError = (upLeftColor - quantizeColor(upLeftColor, levels)) * 3.0/16.0;
                vec3 upError = (upColor - quantizeColor(upColor, levels)) * 5.0/16.0;
                vec3 upRightError = (upRightColor - quantizeColor(upRightColor, levels)) * 1.0/16.0;
                
                accumulated = quantizeColor(color + leftError + upLeftError + upError + upRightError, levels);
            } else if (method == 6) {
                // Atkinson: lighter dithering, used by Apple
                vec3 leftColor = texture2D(u_image, uv + vec2(-pixelSize.x, 0.0)).rgb;
                vec3 upColor = texture2D(u_image, uv + vec2(0.0, -pixelSize.y)).rgb;
                
                vec3 leftError = (leftColor - quantizeColor(leftColor, levels)) * 0.125;
                vec3 upError = (upColor - quantizeColor(upColor, levels)) * 0.125;
                
                accumulated = quantizeColor(color + leftError + upError, levels);
            } else if (method == 7) {
                // Sierra Lite: simplified Sierra, good quality
                vec3 leftColor = texture2D(u_image, uv + vec2(-pixelSize.x, 0.0)).rgb;
                vec3 upColor = texture2D(u_image, uv + vec2(0.0, -pixelSize.y)).rgb;
                
                vec3 leftError = (leftColor - quantizeColor(leftColor, levels)) * 0.5;
                vec3 upError = (upColor - quantizeColor(upColor, levels)) * 0.25;
                
                accumulated = quantizeColor(color + leftError + upError, levels);
            }
            
            return accumulated;
        }

        void main() {
            vec3 color = texture2D(u_image, v_texCoord).rgb;
            vec2 pos = v_texCoord * u_resolution;
            
            float threshold = 0.5;
            int algo = int(u_algorithm);
            
            vec3 result;
            
            // Error diffusion algorithms (5-7)
            if (algo >= 5) {
                if (u_colorLevels > 2.5) {
                    result = errorDiffusion(color, v_texCoord, u_colorLevels, algo);
                } else {
                    // B&W error diffusion
                    float gray = dot(color, vec3(0.299, 0.587, 0.114));
                    vec3 grayColor = vec3(gray);
                    result = errorDiffusion(grayColor, v_texCoord, 2.0, algo);
                }
            } else {
                // Ordered/random dithering (0-4)
                if (algo == 0) {
                    threshold = bayer2x2(pos);
                } else if (algo == 1) {
                    threshold = bayer4x4(pos);
                } else if (algo == 2) {
                    threshold = bayer8x8(pos);
                } else if (algo == 3) {
                    threshold = hash(pos + u_time * 0.1);
                } else if (algo == 4) {
                    float r1 = hash(pos);
                    float r2 = hash(pos + vec2(1.5, 2.3));
                    threshold = fract(r1 + r2 * 0.618034);
                }
                
                if (u_colorLevels > 2.5) {
                    vec3 quantized = quantizeColor(color, u_colorLevels);
                    vec3 error = color - quantized;
                    result = quantized + step(threshold * u_spread, length(error)) * error * 0.5;
                } else {
                    float gray = dot(color, vec3(0.299, 0.587, 0.114));
                    float dithered = step(threshold * u_spread, gray);
                    result = vec3(dithered);
                }
            }
            
            gl_FragColor = vec4(mix(color, result, u_intensity), 1.0);
        }
    `,

    crt_advanced: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform vec2 u_resolution;

        // ── Geometry ───────────────────────────────────────────────────
        uniform float u_curvature;
        uniform float u_vignetteStrength;

        // ── Beam ───────────────────────────────────────────────────────
        uniform float u_minBeamWidth;
        uniform float u_maxBeamWidth;
        uniform float u_beamSharpness;
        uniform float u_neighborRadius;   // 1 = 3x3, 2 = 5x5

        // ── Scanline ───────────────────────────────────────────────────
        uniform float u_scanlineStrength;

        // ── Phosphor ───────────────────────────────────────────────────
        uniform float u_phosphorLayout;   // 0=aperture grille  1=slot mask  2=shadow mask
        uniform float u_phosphorScale;    // phosphor triads per output pixel
        uniform float u_maskStrength;     // 0=mask off  1=full mask

        // ── Halation / bloom ───────────────────────────────────────────
        uniform float u_bloomStrength;

        // ── Glass ──────────────────────────────────────────────────────
        uniform float u_glassBlur;

        // ── Gamma ──────────────────────────────────────────────────────
        uniform float u_gammaIn;
        uniform float u_gammaOut;

        varying vec2 v_texCoord;

        // ── sRGB ↔ linear ──────────────────────────────────────────────
        vec3 toLinear(vec3 c) {
            return pow(max(c, vec3(0.0)), vec3(u_gammaIn));
        }
        vec3 toSrgb(vec3 c) {
            return pow(max(c, vec3(0.0)), vec3(1.0 / u_gammaOut));
        }
        float luma(vec3 c) {
            return dot(c, vec3(0.2126, 0.7152, 0.0722));
        }

        // ── CRT barrel warp ────────────────────────────────────────────
        vec2 warpCRT(vec2 uv) {
            vec2 p = uv * 2.0 - 1.0;
            p *= 1.0 + u_curvature * dot(p, p);
            return p * 0.5 + 0.5;
        }

        // ── Anisotropic beam profile ───────────────────────────────────
        float beamProfile(vec2 delta, float bwX, float bwY) {
            float dx = delta.x / max(bwX, 0.001);
            float dy = delta.y / max(bwY, 0.001);
            return exp(-u_beamSharpness * (dx * dx + dy * dy));
        }

        // ── Phosphor mask ──────────────────────────────────────────────
        vec3 phosphorMask(vec2 coord) {
            float px = floor(coord.x);
            float py = floor(coord.y);
            float phaseX = mod(px, 3.0);
            float phaseY = mod(py, 2.0);

            // 0 = aperture grille: vertical RGB stripes, no vertical structure
            if (u_phosphorLayout < 0.5) {
                if (phaseX < 0.5) return vec3(1.0, 0.15, 0.15);
                if (phaseX < 1.5) return vec3(0.15, 1.0, 0.15);
                return              vec3(0.15, 0.15, 1.0);
            }
            // 1 = slot mask: staggered dots, slight row dimming
            if (u_phosphorLayout < 1.5) {
                vec3 base;
                if (phaseX < 0.5) base = vec3(1.0, 0.15, 0.15);
                else if (phaseX < 1.5) base = vec3(0.15, 1.0, 0.15);
                else                   base = vec3(0.15, 0.15, 1.0);
                return base * (phaseY < 0.5 ? 1.0 : 0.82);
            }
            // 2 = shadow mask: diagonal dot triad
            float phase = mod(px + py, 3.0);
            if (phase < 0.5) return vec3(1.0, 0.2, 0.2);
            if (phase < 1.5) return vec3(0.2, 1.0, 0.2);
            return              vec3(0.2, 0.2, 1.0);
        }

        // ── Vignette ───────────────────────────────────────────────────
        float vignette(vec2 uv) {
            vec2 p = uv * 2.0 - 1.0;
            return clamp(1.0 - dot(p, p) * u_vignetteStrength, 0.0, 1.0);
        }

        void main() {
            vec2 uv         = v_texCoord;
            vec3 srcOriginal = texture2D(u_image, uv).rgb;

            // ── Warp ───────────────────────────────────────────────────
            vec2 wUV = warpCRT(uv);
            if (wUV.x < 0.0 || wUV.x > 1.0 || wUV.y < 0.0 || wUV.y > 1.0) {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }

            // ── PASS 1+2: beam reconstruction + scanline ───────────────
            // Accumulate energy from source neighbourhood (not normalised —
            // this is physical excitation energy, not averaged colour).
            vec2 srcPos  = wUV * u_resolution;
            vec2 srcBase = floor(srcPos);

            vec3  energy      = vec3(0.0);
            float scanlineY   = fract(srcPos.y) - 0.5;   // [-0.5, 0.5] within line

            for (float j = -2.0; j <= 2.0; j++) {
                if (abs(j) > u_neighborRadius) continue;
                for (float i = -2.0; i <= 2.0; i++) {
                    if (abs(i) > u_neighborRadius) continue;

                    vec2 nc  = srcBase + vec2(i, j) + 0.5;
                    vec2 nuv = clamp(nc / u_resolution, 0.0, 1.0);
                    vec3 src = toLinear(texture2D(u_image, nuv).rgb);

                    float bw  = mix(u_minBeamWidth, u_maxBeamWidth, luma(src));
                    float bwX = bw * 1.2;
                    float bwY = bw * 0.85;
                    float w   = beamProfile(srcPos - nc, bwX, bwY);
                    energy   += src * w;
                }
            }

            // Scanline: modulate by gaussian centred on beam axis
            float scanLum   = luma(energy);
            float scanWidth = mix(0.15, 0.45, clamp(scanLum, 0.0, 1.0));
            float scanFactor = mix(
                1.0 - u_scanlineStrength,
                1.0,
                exp(-(scanlineY * scanlineY) / max(scanWidth * scanWidth, 0.0001))
            );
            energy *= scanFactor;

            // ── PASS 3: phosphor mask ──────────────────────────────────
            vec2 phosphorCoord = wUV * u_resolution * u_phosphorScale;
            vec3 mask          = phosphorMask(phosphorCoord);
            vec3 phosphorLight = energy * mix(vec3(1.0), mask, u_maskStrength);

            // ── PASS 4: separate base and excess ───────────────────────
            vec3 baseLight   = min(phosphorLight, vec3(1.0));
            vec3 excessLight = max(phosphorLight - vec3(1.0), vec3(0.0));

            // ── PASS 5: anisotropic halation bloom ─────────────────────
            // Wider horizontally than vertically (real phosphor glow)
            // Driven by excess energy; zero cost when image isn't overexposed.
            float excessLum = luma(excessLight);
            vec3  bloom     = vec3(0.0);

            if (excessLum > 0.001 || u_bloomStrength > 0.0) {
                vec2 px   = 1.0 / u_resolution;
                float tot = 0.0;
                // 7H × 3V anisotropic kernel
                for (float bj = -1.0; bj <= 1.0; bj++) {
                    for (float bi = -3.0; bi <= 3.0; bi++) {
                        vec2 off  = vec2(bi * 1.6, bj) * px;
                        float d2  = bi * bi * 0.25 + bj * bj;
                        float bw  = exp(-d2 * 0.5);
                        bloom    += toLinear(texture2D(u_image, wUV + off).rgb) * bw;
                        tot      += bw;
                    }
                }
                bloom = (bloom / tot) * u_bloomStrength * (excessLum + u_bloomStrength * 0.15);
            }

            // ── PASS 6: composite ──────────────────────────────────────
            vec3 crtLight = baseLight + bloom;

            // ── PASS 7: glass diffusion + vignette ─────────────────────
            if (u_glassBlur > 0.001) {
                vec2 px  = 1.0 / u_resolution;
                vec3 glassAccum = vec3(0.0);
                float gt = 0.0;
                for (float gj = -1.0; gj <= 1.0; gj++) {
                    for (float gi = -1.0; gi <= 1.0; gi++) {
                        float gw    = exp(-(gi*gi + gj*gj) * 0.5);
                        glassAccum += toLinear(texture2D(u_image, wUV + vec2(gi, gj) * px).rgb) * gw;
                        gt         += gw;
                    }
                }
                crtLight = mix(crtLight, glassAccum / gt, u_glassBlur);
            }

            crtLight *= vignette(uv);

            // ── PASS 8: Reinhard tonemap + gamma out ───────────────────
            crtLight = crtLight / (1.0 + crtLight);
            vec3 finalColor = toSrgb(crtLight);

            gl_FragColor = vec4(mix(srcOriginal, finalColor, u_intensity), 1.0);
        }
    `,



    pixelate: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_pixelSize;
        uniform float u_pixelShape; // 0: Square, 1: Hex
        uniform float u_sharpness;
        
        varying vec2 v_texCoord;

        // Hexagonal grid calculation
        vec2 hexCoord(vec2 p) {
            vec2 r = vec2(1.0, 1.7320508);
            vec2 h = r * 0.5;
            vec2 a = mod(p, r) - h;
            vec2 b = mod(p - h, r) - h;
            return dot(a, a) < dot(b, b) ? a : b;
        }

        void main() {
            float size = 1.0 + u_intensity * 63.0; // Map intensity to pixel size
            vec2 pixelSize = vec2(size);
            vec2 uv = v_texCoord;
            vec3 color;

            if (u_pixelShape < 0.5) { // Square
                vec2 coord = floor(uv * u_resolution / size) * size / u_resolution;
                color = texture2D(u_image, coord).rgb;
                
                // Add sharpness/bevel effect
                vec2 g = fract(uv * u_resolution / size);
                float border = min(min(g.x, 1.0-g.x), min(g.y, 1.0-g.y));
                float edge = smoothstep(0.0, 0.1 * (1.0 - u_sharpness), border);
                color *= mix(0.8, 1.0, edge);
            } else { // Hex
                vec2 p = uv * u_resolution / (size * 0.8);
                vec2 r = vec2(1.0, 1.7320508) * (size * 0.8);
                vec2 h = r * 0.5;
                vec2 a = mod(uv * u_resolution, r) - h;
                vec2 b = mod(uv * u_resolution - h, r) - h;
                vec2 hexCenter = dot(a, a) < dot(b, b) ? (uv * u_resolution - a) : (uv * u_resolution - b);
                
                color = texture2D(u_image, hexCenter / u_resolution).rgb;
                
                float dist = dot(a, a) < dot(b, b) ? length(a) : length(b);
                float radius = size * 0.4;
                float edge = smoothstep(radius, radius * (1.0 - 0.2 * (1.0 - u_sharpness)), dist);
                color *= mix(0.7, 1.0, 1.0 - edge);
            }

            gl_FragColor = vec4(color, 1.0);
        }
    `,

    water: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec2 uv = v_texCoord;
            float wave1 = sin(uv.x * 20.0 + u_time * 2.0) * 0.01;
            float wave2 = sin(uv.y * 15.0 + u_time * 1.5) * 0.01;
            uv.y += wave1 * u_intensity;
            uv.x += wave2 * u_intensity;
            
            gl_FragColor = texture2D(u_image, uv);
        }
    `,

    glitch: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_blockScale;
        uniform float u_colorInversion;
        uniform float u_evolution;
        uniform float u_timeMode; // 0: Auto (Time), 1: Manual (Evolution)
        
        varying vec2 v_texCoord;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        float blockNoise(vec2 uv, float seed) {
            return random(floor(uv) + seed);
        }

        void main() {
            float t = (u_timeMode < 0.5) ? u_time : u_evolution;
            vec2 uv = v_texCoord;
            
            // Blocky displacement
            float blockResolution = 32.0 / (1.0 + u_blockScale);
            vec2 blockUV = floor(uv * blockResolution);
            float noise = random(blockUV + floor(t * 12.0));
            
            vec2 offset = vec2(0.0);
            if (noise > 0.9 - u_intensity * 0.4) {
                offset.x = (random(vec2(blockUV.y, t)) - 0.5) * u_intensity * 0.2;
            }
            
            // Scanline jitter
            float jitter = random(vec2(t, uv.y * 100.0)) * 2.0 - 1.0;
            float jitterThreshold = 1.0 - u_intensity * 0.1;
            if (random(vec2(t, 66.0)) > jitterThreshold) {
                offset.x += jitter * 0.05 * u_intensity;
            }

            // Sample with RGB split
            float r = texture2D(u_image, uv + offset + vec2(0.01 * u_intensity, 0.0)).r;
            float g = texture2D(u_image, uv + offset).g;
            float b = texture2D(u_image, uv + offset - vec2(0.01 * u_intensity, 0.0)).b;
            vec3 color = vec3(r, g, b);
            
            // Random color inversion
            float invNoise = random(vec2(floor(t * 4.0), blockUV.y));
            if (invNoise > 1.0 - u_colorInversion * u_intensity * 0.5) {
                color = 1.0 - color;
            }
            
            // Pixel noise (static)
            float staticNoise = random(uv + t) * 0.1 * u_intensity;
            color += staticNoise;

            gl_FragColor = vec4(color, 1.0);
        }
    `,

    grayscale: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            vec3 result = mix(color.rgb, vec3(gray), u_intensity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    sepia: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 sepia = vec3(
                dot(color.rgb, vec3(0.393, 0.769, 0.189)),
                dot(color.rgb, vec3(0.349, 0.686, 0.168)),
                dot(color.rgb, vec3(0.272, 0.534, 0.131))
            );
            vec3 result = mix(color.rgb, sepia, u_intensity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    invert: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 inverted = vec3(1.0) - color.rgb;
            vec3 result = mix(color.rgb, inverted, u_intensity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    vintage: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 vintage = color.rgb * vec3(1.2, 1.05, 0.9);
            vintage = pow(vintage, vec3(1.2));
            vec3 result = mix(color.rgb, vintage, u_intensity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    chromatic: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec2 offset = vec2(0.01, 0.0) * u_intensity;
            float r = texture2D(u_image, v_texCoord + offset).r;
            float g = texture2D(u_image, v_texCoord).g;
            float b = texture2D(u_image, v_texCoord - offset).b;
            
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,

    duotone: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;
        
        uniform vec3 u_color1;
        uniform vec3 u_color2;
        uniform float u_contrast;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Apply contrast to the grayscale mapping
            gray = clamp((gray - 0.5) * (1.0 + u_contrast) + 0.5, 0.0, 1.0);
            
            vec3 duotone = mix(u_color1, u_color2, gray);
            
            vec3 result = mix(color.rgb, duotone, u_intensity);
            gl_FragColor = vec4(result, color.a);
        }
    `,

    swirl: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec2 center = vec2(0.5, 0.5);
            vec2 uv = v_texCoord - center;
            float dist = length(uv);
            float angle = atan(uv.y, uv.x) + dist * u_intensity * 5.0;
            
            vec2 newUv = vec2(cos(angle), sin(angle)) * dist + center;
            gl_FragColor = texture2D(u_image, newUv);
        }
    `,

    fisheye: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec2 center = vec2(0.5, 0.5);
            vec2 uv = v_texCoord - center;
            float dist = length(uv);
            float power = 1.0 + u_intensity * 1.5;
            float newDist = pow(dist, power);
            
            vec2 newUv = normalize(uv) * newDist + center;
            gl_FragColor = texture2D(u_image, newUv);
        }
    `,

    wave: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec2 uv = v_texCoord;
            uv.x += sin(uv.y * 10.0 + u_time) * 0.05 * u_intensity;
            uv.y += cos(uv.x * 10.0 + u_time) * 0.05 * u_intensity;
            
            gl_FragColor = texture2D(u_image, uv);
        }
    `,

    kaleidoscope: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_segments;
        uniform float u_rotation;
        uniform float u_zoom;
        uniform float u_offsetX;
        uniform float u_offsetY;
        varying vec2 v_texCoord;

        void main() {
            vec2 center = vec2(0.5 + u_offsetX * 0.5, 0.5 + u_offsetY * 0.5);
            vec2 uv = v_texCoord - center;
            
            // Apply zoom
            uv /= u_zoom;
            
            // Calculate angle from center
            float angle = atan(uv.y, uv.x);
            
            // Add rotation
            angle += u_rotation * 3.14159 / 180.0;
            
            // Create kaleidoscope effect
            float segmentAngle = 2.0 * 3.14159 / u_segments;
            angle = mod(angle, segmentAngle);
            
            // Mirror alternate segments for true kaleidoscope effect
            float halfSegment = segmentAngle * 0.5;
            angle = abs(angle - halfSegment);
            
            // Reconstruct UV coordinates
            float dist = length(uv);
            vec2 newUv = vec2(cos(angle), sin(angle)) * dist + center;
            
            vec4 original = texture2D(u_image, v_texCoord);
            vec4 effect = texture2D(u_image, newUv);
            gl_FragColor = mix(original, effect, u_intensity);
        }
    `,

    oil: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        void main() {
            float radius = 2.0 + u_intensity * 4.0;
            vec3 color = vec3(0.0);
            float total = 0.0;
            
            for(float x = -4.0; x <= 4.0; x++) {
                for(float y = -4.0; y <= 4.0; y++) {
                    vec2 offset = vec2(x, y) / u_resolution * radius;
                    color += texture2D(u_image, v_texCoord + offset).rgb;
                    total += 1.0;
                }
            }
            
            gl_FragColor = vec4(color / total, 1.0);
        }
    `,

    emboss: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        void main() {
            vec2 step = 1.0 / u_resolution * u_intensity * 2.0;
            
            vec4 tl = texture2D(u_image, v_texCoord + vec2(-step.x, -step.y));
            vec4 br = texture2D(u_image, v_texCoord + vec2(step.x, step.y));
            
            vec3 result = vec3(0.5) + (tl.rgb - br.rgb);
            gl_FragColor = vec4(result, 1.0);
        }
    `,

    edge: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        void main() {
            vec2 step = 1.0 / u_resolution;
            
            vec4 n  = texture2D(u_image, v_texCoord + vec2(0.0, step.y));
            vec4 s  = texture2D(u_image, v_texCoord + vec2(0.0, -step.y));
            vec4 e  = texture2D(u_image, v_texCoord + vec2(step.x, 0.0));
            vec4 w  = texture2D(u_image, v_texCoord + vec2(-step.x, 0.0));
            vec4 c  = texture2D(u_image, v_texCoord);
            
            vec4 edge = abs(c * 4.0 - n - s - e - w);
            vec4 result = mix(c, edge, u_intensity);
            gl_FragColor = result;
        }
    `,

    blur: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        void main() {
            vec2 step = 1.0 / u_resolution * u_intensity * 3.0;
            vec4 color = vec4(0.0);
            
            for(float x = -2.0; x <= 2.0; x++) {
                for(float y = -2.0; y <= 2.0; y++) {
                    color += texture2D(u_image, v_texCoord + vec2(x, y) * step);
                }
            }
            
            gl_FragColor = color / 25.0;
        }
    `,

    film_grain: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_grainSize;
        uniform float u_grainAmount;
        uniform float u_clumping;
        uniform float u_scratches;
        uniform float u_dust;
        
        varying vec2 v_texCoord;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        void main() {
            vec2 uv = v_texCoord;
            vec4 color = texture2D(u_image, uv);
            float t = u_time;
            
            // 1. Multi-octave Grain (Clumping)
            vec2 grainCoord = uv * u_resolution / (u_grainSize + 0.1);
            float grain1 = noise(grainCoord + t * 0.1);
            float grain2 = noise(grainCoord * 0.5 + t * 0.15);
            float grain = mix(grain1, grain1 * grain2, u_clumping);
            
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float grainStrength = u_grainAmount * u_intensity * (1.0 - abs(lum - 0.5) * 1.5);
            color.rgb += (grain - 0.5) * grainStrength;
            
            // 2. Scratches (vertical thin lines)
            float scratchProb = 1.0 - u_scratches * u_intensity * 0.05;
            if (hash(vec2(t * 0.2, 0.0)) > scratchProb) {
                float x = hash(vec2(floor(t * 10.0), 1.0));
                float scratch = 1.0 - smoothstep(0.0, 0.002, abs(uv.x - x));
                color.rgb = mix(color.rgb, vec3(0.1), scratch * 0.5);
            }
            
            // 3. Dust (random black/white spots)
            float dustProb = 1.0 - u_dust * u_intensity * 0.1;
            if (hash(uv + floor(t * 24.0)) > dustProb) {
                float dustColor = hash(uv + t) > 0.5 ? 0.0 : 1.0;
                color.rgb = mix(color.rgb, vec3(dustColor), 0.5);
            }

            gl_FragColor = vec4(color.rgb, color.a);
        }
    `,

    lens_distortion: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_distortion;
        uniform float u_dispersion;
        varying vec2 v_texCoord;

        vec2 distort(vec2 uv, float strength) {
            vec2 center = vec2(0.5, 0.5);
            vec2 offset = uv - center;
            float r = length(offset);
            float r2 = r * r;
            float r4 = r2 * r2;
            
            // Barrel/pincushion distortion formula
            float distortionFactor = 1.0 + strength * r2 + strength * 0.5 * r4;
            return center + offset * distortionFactor;
        }

        void main() {
            vec2 uv = v_texCoord;
            float dist = u_distortion * u_intensity;
            
            // Chromatic dispersion (different distortion per channel)
            vec2 uvR = distort(uv, dist * (1.0 + u_dispersion * 0.01));
            vec2 uvG = distort(uv, dist);
            vec2 uvB = distort(uv, dist * (1.0 - u_dispersion * 0.01));
            
            vec3 color = vec3(
                texture2D(u_image, uvR).r,
                texture2D(u_image, uvG).g,
                texture2D(u_image, uvB).b
            );
            
            gl_FragColor = vec4(color, 1.0);
        }
    `,

    vhs: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_tracking;
        uniform float u_vJitter;
        uniform float u_chromaBleed;
        uniform float u_crosstalk;
        uniform float u_noise;
        uniform float u_dropout;
        
        varying vec2 v_texCoord;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec2 uv = v_texCoord;
            float t = u_time;
            
            // 1. Vertical Jitter (v-sync instability)
            float vj = hash(vec2(t, 0.0)) * u_vJitter * u_intensity * 0.01;
            if (hash(vec2(t, 1.0)) > 0.98) uv.y += vj;

            // 2. Horizontal Tracking Errors
            float tracking = sin(uv.y * 10.0 + t) * u_tracking * u_intensity * 0.002;
            tracking += (hash(vec2(t, uv.y)) - 0.5) * u_tracking * u_intensity * 0.001;
            uv.x += tracking;
            
            // 3. Sample color with horizontal blur
            vec3 color = texture2D(u_image, uv).rgb;
            
            // 4. Chroma Bleed (horizontal smearing of color)
            float bleed = u_chromaBleed * u_intensity * 0.01;
            vec3 colorL = texture2D(u_image, uv - vec2(bleed, 0.0)).rgb;
            vec3 colorR = texture2D(u_image, uv + vec2(bleed, 0.0)).rgb;
            color.r = mix(color.r, colorL.r, 0.6);
            color.b = mix(color.b, colorR.b, 0.6);

            // 5. Luma/Chroma Crosstalk (Herringbone pattern)
            float crosstalk = sin(uv.x * u_resolution.x * 1.5 + uv.y * u_resolution.y * 0.5 + t * 10.0);
            color += crosstalk * u_crosstalk * u_intensity * 0.05;
            
            // 6. Tape Noise
            float noise = (hash(uv + t) - 0.5) * u_noise * u_intensity * 0.2;
            color += noise;
            
            // 7. Realistic Dropouts (white "comet" streaks)
            float dNoise = hash(vec2(t * 0.5, floor(uv.y * u_resolution.y)));
            if (dNoise > 1.0 - u_dropout * u_intensity * 0.01) {
                float streak = hash(vec2(uv.x * 10.0, t));
                if (streak > 0.5) color = mix(color, vec3(1.0), streak);
            }
            
            // 8. Slight NTSC tint & pedestal
            color = color * 0.9 + 0.05; // Pedestal
            color.rgb *= vec3(0.95, 1.05, 0.95); // Greenish aging

            gl_FragColor = vec4(mix(texture2D(u_image, v_texCoord).rgb, color, u_intensity), 1.0);
        }
    `,

    voronoi_stippling: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_cellSize;
        uniform float u_dotSize;
        uniform float u_randomness;
        varying vec2 v_texCoord;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        vec2 hash2(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.xx + p3.yz) * p3.zy);
        }

        void main() {
            vec2 pixelCoord = v_texCoord * u_resolution;
            vec3 sourceColor = texture2D(u_image, v_texCoord).rgb;
            float luminance = dot(sourceColor, vec3(0.299, 0.587, 0.114));
            
            // Voronoi cell calculation
            vec2 cellCoord = pixelCoord / u_cellSize;
            vec2 cellId = floor(cellCoord);
            vec2 cellPos = fract(cellCoord);
            
            float minDist = 10.0;
            vec2 closestPoint = vec2(0.0);
            
            // Check 3x3 neighboring cells
            for(float y = -1.0; y <= 1.0; y++) {
                for(float x = -1.0; x <= 1.0; x++) {
                    vec2 neighborId = cellId + vec2(x, y);
                    vec2 randomOffset = hash2(neighborId);
                    vec2 pointPos = vec2(x, y) + randomOffset;
                    
                    // Sample luminance at cell center for weighted distribution
                    vec2 sampleUV = (neighborId + randomOffset) * u_cellSize / u_resolution;
                    float cellLuminance = dot(texture2D(u_image, sampleUV).rgb, vec3(0.299, 0.587, 0.114));
                    
                    // Adjust point position based on luminance (darker = more points)
                    pointPos += (hash2(neighborId + 0.5) - 0.5) * u_randomness;
                    
                    float dist = length(cellPos - pointPos);
                    
                    if(dist < minDist) {
                        minDist = dist;
                        closestPoint = pointPos;
                    }
                }
            }
            
            // Calculate dot based on luminance (darker areas = bigger dots)
            float dotRadius = (1.0 - luminance) * u_dotSize * 0.5;
            float dot = smoothstep(dotRadius + 0.1, dotRadius, minDist);
            
            vec3 result = mix(vec3(1.0), vec3(0.0), dot);
            gl_FragColor = vec4(mix(sourceColor, result, u_intensity), 1.0);
        }
    `,

    kuwahara: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_radius;
        varying vec2 v_texCoord;

        void main() {
            vec2 src_size = u_resolution;
            vec2 uv = v_texCoord;
            int radius = int(u_radius);
            
            vec3 m[4];
            vec3 s[4];
            float n[4];
            
            for (int k = 0; k < 4; ++k) {
                m[k] = vec3(0.0);
                s[k] = vec3(0.0);
                n[k] = 0.0;
            }
            
            // Sample in fixed maximum radius, skip if outside actual radius
            for (int j = -10; j <= 10; ++j) {
                for (int i = -10; i <= 10; ++i) {
                    float fi = float(i);
                    float fj = float(j);
                    
                    // Quadrant 0: top-left
                    if (fi <= 0.0 && fj <= 0.0 && abs(fi) <= u_radius && abs(fj) <= u_radius) {
                        vec3 c = texture2D(u_image, uv + vec2(fi, fj) / src_size).rgb;
                        m[0] += c;
                        s[0] += c * c;
                        n[0] += 1.0;
                    }
                    
                    // Quadrant 1: top-right
                    if (fi >= 0.0 && fj <= 0.0 && abs(fi) <= u_radius && abs(fj) <= u_radius) {
                        vec3 c = texture2D(u_image, uv + vec2(fi, fj) / src_size).rgb;
                        m[1] += c;
                        s[1] += c * c;
                        n[1] += 1.0;
                    }
                    
                    // Quadrant 2: bottom-right
                    if (fi >= 0.0 && fj >= 0.0 && abs(fi) <= u_radius && abs(fj) <= u_radius) {
                        vec3 c = texture2D(u_image, uv + vec2(fi, fj) / src_size).rgb;
                        m[2] += c;
                        s[2] += c * c;
                        n[2] += 1.0;
                    }
                    
                    // Quadrant 3: bottom-left
                    if (fi <= 0.0 && fj >= 0.0 && abs(fi) <= u_radius && abs(fj) <= u_radius) {
                        vec3 c = texture2D(u_image, uv + vec2(fi, fj) / src_size).rgb;
                        m[3] += c;
                        s[3] += c * c;
                        n[3] += 1.0;
                    }
                }
            }
            
            float min_sigma2 = 1e+2;
            vec3 result = texture2D(u_image, uv).rgb;
            
            for (int k = 0; k < 4; ++k) {
                if (n[k] > 0.0) {
                    m[k] /= n[k];
                    s[k] = abs(s[k] / n[k] - m[k] * m[k]);
                    
                    float sigma2 = s[k].r + s[k].g + s[k].b;
                    if (sigma2 < min_sigma2) {
                        min_sigma2 = sigma2;
                        result = m[k];
                    }
                }
            }
            
            vec3 original = texture2D(u_image, uv).rgb;
            gl_FragColor = vec4(mix(original, result, u_intensity), 1.0);
        }
    `,

    crosshatch: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_lineSpacing;
        uniform float u_lineWidth;
        uniform float u_angleSeparation;
        varying vec2 v_texCoord;

        float line(vec2 uv, float angle, float spacing, float width) {
            float s = sin(angle);
            float c = cos(angle);
            vec2 rotated = vec2(
                uv.x * c - uv.y * s,
                uv.x * s + uv.y * c
            );
            float pattern = fract(rotated.x / spacing);
            return smoothstep(0.5 - width, 0.5, pattern) * smoothstep(0.5 + width, 0.5, pattern);
        }

        void main() {
            vec2 uv = v_texCoord * u_resolution;
            vec3 color = texture2D(u_image, v_texCoord).rgb;
            float luminance = dot(color, vec3(0.299, 0.587, 0.114));
            
            // Multiple line angles based on luminance
            float angle1 = radians(45.0);
            float angle2 = radians(45.0 + u_angleSeparation);
            float angle3 = radians(45.0 + u_angleSeparation * 2.0);
            float angle4 = radians(45.0 + u_angleSeparation * 3.0);
            
            float spacing = u_lineSpacing;
            float width = u_lineWidth * 0.1;
            
            float hatch = 0.0;
            
            // Add hatching layers based on darkness
            if(luminance < 0.9) hatch += line(uv, angle1, spacing, width);
            if(luminance < 0.7) hatch += line(uv, angle2, spacing, width);
            if(luminance < 0.5) hatch += line(uv, angle3, spacing, width);
            if(luminance < 0.3) hatch += line(uv, angle4, spacing, width);
            
            hatch = clamp(hatch, 0.0, 1.0);
            
            vec3 result = vec3(1.0 - hatch);
            gl_FragColor = vec4(mix(color, result, u_intensity), 1.0);
        }
    `,

    tritone: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform vec3 u_shadowColor;
        uniform vec3 u_midtoneColor;
        uniform vec3 u_highlightColor;
        uniform float u_shadowRange;
        uniform float u_highlightRange;
        uniform float u_midtoneBalance;
        varying vec2 v_texCoord;

        void main() {
            vec3 color = texture2D(u_image, v_texCoord).rgb;
            float luminance = dot(color, vec3(0.299, 0.587, 0.114));
            
            // Shift luminance based on balance
            luminance = pow(luminance, exp(-u_midtoneBalance));
            
            // Calculate weights with smoother transitions (Gaussian-like)
            float shadow = smoothstep(u_shadowRange, 0.0, luminance);
            float highlight = smoothstep(1.0 - u_highlightRange, 1.0, luminance);
            
            // Midtone is what's left, but we use a smooth bell curve for better results
            float midtone = 1.0 - shadow - highlight;
            midtone = clamp(midtone, 0.0, 1.0);
            
            // Blend colors
            vec3 result = u_shadowColor * shadow + 
                         u_midtoneColor * midtone + 
                         u_highlightColor * highlight;
            
            // Preserve some of the original local contrast
            result *= (1.0 + (luminance - 0.5) * 0.1);
            
            gl_FragColor = vec4(mix(color, result, u_intensity), 1.0);
        }
    `,

    technicolor: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        
        uniform float u_fringing;
        uniform float u_redOffset;
        uniform float u_greenOffset;
        uniform float u_blueOffset;
        uniform float u_dyeDensity;
        uniform float u_contrast;
        uniform float u_saturation;
        
        varying vec2 v_texCoord;

        void main() {
            vec2 uv = v_texCoord;
            
            // Misaligned plates (fringing)
            float fringe = u_fringing * 0.002;
            vec2 rOff = vec2(fringe * u_redOffset, 0.0);
            vec2 gOff = vec2(fringe * u_greenOffset, 0.0);
            vec2 bOff = vec2(fringe * u_blueOffset, 0.0);
            
            float r = texture2D(u_image, uv + rOff).r;
            float g = texture2D(u_image, uv + gOff).g;
            float b = texture2D(u_image, uv + bOff).b;
            
            // 3-strip separation logic
            // Each strip records a component of the light
            vec3 separated = vec3(r, g, b);
            
            // Apply dye density (analogous to exposure/density of the film strips)
            separated = pow(separated, vec3(u_dyeDensity));
            
            // Re-combine using an optimized Technicolor-style color matrix
            // This emphasizes the cyan/magenta/yellow dye-transfer look
            mat3 technicolorMatrix = mat3(
                1.12, -0.05, -0.07,
                -0.10,  1.18, -0.08,
                -0.08, -0.12,  1.20
            );
            
            vec3 result = technicolorMatrix * separated;
            
            // Saturation adjustment
            float luma = dot(result, vec3(0.299, 0.587, 0.114));
            result = mix(vec3(luma), result, u_saturation * 1.5);
            
            // Contrast boost (power curve)
            result = smoothstep(0.0, 1.0, result);
            result = pow(result, vec3(1.0 / (1.0 + u_contrast * 0.2)));
            
            vec3 original = texture2D(u_image, uv).rgb;
            gl_FragColor = vec4(mix(original, result, u_intensity), 1.0);
        }
    `,

    color_vector_normalize: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec3 color = texture2D(u_image, v_texCoord).rgb;
            
            // Normalize RGB vector to unit sphere
            // Preserves hue direction, equalizes saturation/brightness
            float magnitude = length(color);
            vec3 normalized = magnitude > 0.0 ? color / magnitude : vec3(0.0);
            
            // Remap to visible range
            vec3 result = normalized * 0.7 + 0.3;
            
            gl_FragColor = vec4(mix(color, result, u_intensity), 1.0);
        }
    `,

    color_vector_flow: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_flowDistance;
        uniform float u_iterations;
        uniform float u_flowAngle;
        varying vec2 v_texCoord;

        void main() {
            vec2 uv = v_texCoord;
            vec3 color = texture2D(u_image, uv).rgb;

            vec2 pixelSize = 1.0 / u_resolution;
            vec3 colorRight = texture2D(u_image, uv + vec2(pixelSize.x, 0.0)).rgb;
            vec3 colorUp    = texture2D(u_image, uv + vec2(0.0, pixelSize.y)).rgb;

            vec2 gradient = vec2(
                length(colorRight - color),
                length(colorUp    - color)
            );

            // Rotate flow direction by u_flowAngle degrees
            float rad = u_flowAngle * 0.017453;
            float cosA = cos(rad);
            float sinA = sin(rad);
            vec2 baseDir = normalize(gradient + 0.001);
            vec2 flowDir = vec2(
                baseDir.x * cosA - baseDir.y * sinA,
                baseDir.x * sinA + baseDir.y * cosA
            );

            vec3 accumulated = color;
            vec2 flowUV      = uv;
            float totalWeight = 1.0;

            for (float i = 1.0; i <= 8.0; i++) {
                if (i > u_iterations) break;
                flowUV += flowDir * pixelSize * u_flowDistance;
                float weight = 1.0 / i;
                accumulated += texture2D(u_image, flowUV).rgb * weight;
                totalWeight += weight;
            }

            vec3 result = accumulated / totalWeight;
            gl_FragColor = vec4(mix(color, result, u_intensity), 1.0);
        }
    `,

    color_vector_curl: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_scale;
        varying vec2 v_texCoord;

        void main() {
            vec2 pixelSize = 1.0 / u_resolution * u_scale;
            
            // Sample surrounding pixels
            vec3 cL = texture2D(u_image, v_texCoord + vec2(-pixelSize.x, 0.0)).rgb;
            vec3 cR = texture2D(u_image, v_texCoord + vec2(pixelSize.x, 0.0)).rgb;
            vec3 cU = texture2D(u_image, v_texCoord + vec2(0.0, pixelSize.y)).rgb;
            vec3 cD = texture2D(u_image, v_texCoord + vec2(0.0, -pixelSize.y)).rgb;
            
            // Calculate curl (rotation) of color field
            // curl = ∂v/∂x - ∂u/∂y
            vec3 dx = (cR - cL) * 0.5;
            vec3 dy = (cU - cD) * 0.5;
            
            // Curl magnitude (scalar in 2D)
            float curlR = dy.r - dx.r;
            float curlG = dy.g - dx.g;
            float curlB = dy.b - dx.b;
            
            // Visualize curl with false color
            vec3 curl = vec3(curlR, curlG, curlB);
            vec3 result = curl * 5.0 + 0.5;
            
            vec3 original = texture2D(u_image, v_texCoord).rgb;
            gl_FragColor = vec4(mix(original, result, u_intensity), 1.0);
        }
    `,

    color_vector_divergence: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_scale;
        varying vec2 v_texCoord;

        void main() {
            vec2 pixelSize = 1.0 / u_resolution * u_scale;
            
            // Sample surrounding pixels
            vec3 cL = texture2D(u_image, v_texCoord + vec2(-pixelSize.x, 0.0)).rgb;
            vec3 cR = texture2D(u_image, v_texCoord + vec2(pixelSize.x, 0.0)).rgb;
            vec3 cU = texture2D(u_image, v_texCoord + vec2(0.0, pixelSize.y)).rgb;
            vec3 cD = texture2D(u_image, v_texCoord + vec2(0.0, -pixelSize.y)).rgb;
            vec3 cC = texture2D(u_image, v_texCoord).rgb;
            
            // Calculate divergence (expansion/contraction) of color field
            // div = ∂u/∂x + ∂v/∂y
            vec3 dx = (cR - cL) * 0.5;
            vec3 dy = (cU - cD) * 0.5;
            
            vec3 divergence = dx + dy;
            
            // Map divergence to visible range
            vec3 result = divergence * 3.0 + 0.5;
            
            vec3 original = texture2D(u_image, v_texCoord).rgb;
            gl_FragColor = vec4(mix(original, result, u_intensity), 1.0);
        }
    `,

    color_vector_splatting: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_time;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_splatDistance;
        uniform float u_splatSize;
        uniform float u_directionStrength;
        uniform float u_scatter;
        uniform float u_edgePreserve;
        uniform float u_colorBleed;
        varying vec2 v_texCoord;

        float luminance(vec3 color) {
            return dot(color, vec3(0.299, 0.587, 0.114));
        }

        float hash12(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        vec2 flowDirection(vec2 uv, vec3 color) {
            vec2 texel = 1.0 / u_resolution;
            float lL = luminance(texture2D(u_image, uv - vec2(texel.x, 0.0)).rgb);
            float lR = luminance(texture2D(u_image, uv + vec2(texel.x, 0.0)).rgb);
            float lD = luminance(texture2D(u_image, uv - vec2(0.0, texel.y)).rgb);
            float lU = luminance(texture2D(u_image, uv + vec2(0.0, texel.y)).rgb);
            vec2 gradient = vec2(lR - lL, lU - lD);
            vec2 tangent = vec2(-gradient.y, gradient.x);

            vec2 chromaVector = color.rg - vec2(color.b, luminance(color));
            vec2 direction = mix(chromaVector, tangent, 0.72);
            float lenDir = length(direction);
            if (lenDir < 0.0001) {
                direction = vec2(1.0, 0.0);
            } else {
                direction /= lenDir;
            }
            return direction;
        }

        void main() {
            vec3 color = texture2D(u_image, v_texCoord).rgb;

            vec3 accumulated = vec3(0.0);
            float totalWeight = 0.0;

            float radius = max(u_splatSize, 1.0);
            float sigma = max(radius * 0.48, 0.75);
            float centerLuma = luminance(color);

            for(float y = -3.0; y <= 3.0; y += 1.0) {
                for(float x = -3.0; x <= 3.0; x += 1.0) {
                    vec2 sampleStep = vec2(x, y);
                    vec2 offset = sampleStep * radius / u_resolution;
                    vec2 sourceUV = v_texCoord - offset;
                    if (sourceUV.x < 0.0 || sourceUV.x > 1.0 || sourceUV.y < 0.0 || sourceUV.y > 1.0) {
                        continue;
                    }

                    vec3 sourceColor = texture2D(u_image, sourceUV).rgb;
                    vec2 direction = flowDirection(sourceUV, sourceColor);

                    float randomAngle = hash12(sourceUV * u_resolution) * 6.2831853;
                    vec2 jitter = vec2(cos(randomAngle), sin(randomAngle)) * u_scatter * radius * 0.65 / u_resolution;
                    vec2 travel = direction * u_splatDistance * u_directionStrength / u_resolution + jitter;
                    vec2 landingUV = sourceUV + travel;
                    vec2 deltaPixels = (landingUV - v_texCoord) * u_resolution;

                    float kernel = exp(-dot(deltaPixels, deltaPixels) / (2.0 * sigma * sigma));
                    float edgeGate = 1.0 - smoothstep(0.08, 0.42, abs(luminance(sourceColor) - centerLuma));
                    float weight = kernel * mix(1.0, edgeGate, u_edgePreserve);

                    accumulated += sourceColor * weight;
                    totalWeight += weight;
                }
            }

            vec3 result = totalWeight > 0.0 ? accumulated / totalWeight : color;
            result = mix(result, max(result, color), u_colorBleed * 0.35);
            result = mix(color, result, u_intensity);
            gl_FragColor = vec4(result, 1.0);
        }
    `,

    // Physical Film Filters - simulate real optical filters
    filter_red25: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Red #25 filter - transmits red, blocks blue/green
            // Transmission curve: R=92%, G=15%, B=3%
            vec3 transmission = vec3(0.92, 0.15, 0.03);
            
            // Apply filter absorption
            vec3 filtered = color.rgb * transmission;
            
            // Normalize brightness to compensate for light loss
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_orange21: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Orange #21 filter - moderate contrast
            // Transmission: R=90%, G=45%, B=10%
            vec3 transmission = vec3(0.90, 0.45, 0.10);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_yellow8: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Yellow #8 filter - slight contrast
            // Transmission: R=95%, G=85%, B=15%
            vec3 transmission = vec3(0.95, 0.85, 0.15);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_green11: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Green #11 filter - yellowish green for landscapes
            // Transmission: R=15%, G=90%, B=20%
            vec3 transmission = vec3(0.15, 0.90, 0.20);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_blue47: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Blue #47 filter - deep blue for dramatic skies
            // Transmission: R=5%, G=20%, B=88%
            vec3 transmission = vec3(0.05, 0.20, 0.88);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_warming81a: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform float u_strength;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // 81A Warming filter - shifts color balance toward amber
            // Reduces blue, enhances red/yellow
            vec3 transmission = vec3(1.0, 0.95, 0.80 + (1.0 - u_strength) * 0.15);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_cooling82a: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform float u_strength;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // 82A Cooling filter - shifts color balance toward blue
            // Reduces red/yellow, enhances blue
            vec3 transmission = vec3(0.85 + (1.0 - u_strength) * 0.15, 0.95, 1.0);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_polarizer: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform float u_angle;
        uniform vec2 u_resolution;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Simulate polarizer - reduces specular reflections
            // Enhances sky contrast based on angle
            
            // Calculate angle from center
            vec2 center = vec2(0.5, 0.5);
            vec2 toPixel = v_texCoord - center;
            float pixelAngle = atan(toPixel.y, toPixel.x) + u_angle;
            
            // Polarization effect - strongest at 90° from sun angle
            float polarization = 0.5 + 0.5 * cos(pixelAngle * 2.0);
            
            // Darkens blues (sky) more than other colors
            float skyness = color.b - max(color.r, color.g);
            float darkening = mix(0.85, 0.55, skyness * polarization);
            
            // Reduce specular highlights
            float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float highlight = smoothstep(0.7, 1.0, brightness);
            darkening = mix(darkening, darkening * 0.7, highlight);
            
            vec3 filtered = color.rgb * darkening;
            
            // Boost saturation slightly
            float luma = dot(filtered, vec3(0.299, 0.587, 0.114));
            filtered = mix(vec3(luma), filtered, 1.15);
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_nd: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform float u_stops;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Neutral Density filter - reduces light uniformly
            // Each stop reduces light by 50%
            float reduction = pow(0.5, u_stops);
            vec3 filtered = color.rgb * reduction;
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_uv_haze: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // UV/Haze filter - cuts UV and reduces blue haze
            // Minimal effect on other colors
            vec3 transmission = vec3(1.0, 0.98, 0.85);
            vec3 filtered = color.rgb * transmission;
            
            float avgTransmission = (transmission.r + transmission.g + transmission.b) / 3.0;
            filtered = filtered / avgTransmission;
            
            // Also reduces atmospheric haze (desaturates distant blues)
            float blueness = color.b - max(color.r, color.g);
            if (blueness > 0.0) {
                float luma = dot(filtered, vec3(0.299, 0.587, 0.114));
                filtered = mix(filtered, vec3(luma), blueness * 0.3);
            }
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_infrared: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Infrared film simulation
            // Foliage (high chlorophyll) becomes very bright
            // Blue sky becomes nearly black
            // Skin tones become pale and ethereal
            
            // Create IR response - foliage reflects IR strongly
            float ir = color.g * 1.5 - color.b * 0.8;
            ir = clamp(ir, 0.0, 1.0);
            
            // Mix channels to simulate B&W IR film
            float irBW = ir * 0.7 + color.r * 0.3;
            
            // Add characteristic IR glow
            irBW = pow(irBW, 0.85);
            
            vec3 filtered = vec3(irBW);
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    filter_didymium: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Didymium filter - enhances fall foliage colors
            // Absorbs yellow-green (580-590nm), boosts red and orange
            
            // Enhance red-orange
            float warmth = (color.r + color.g * 0.3) - color.b * 0.5;
            warmth = clamp(warmth, 0.0, 1.0);
            
            vec3 filtered = color.rgb;
            filtered.r = min(1.0, color.r * (1.0 + warmth * 0.4));
            filtered.g = color.g * (1.0 - warmth * 0.2);
            filtered.b = color.b * 0.85;
            
            // Boost saturation of warm colors
            float luma = dot(filtered, vec3(0.299, 0.587, 0.114));
            filtered = mix(vec3(luma), filtered, 1.3);
            
            gl_FragColor = vec4(mix(color.rgb, filtered, u_intensity), color.a);
        }
    `,

    oklch_grade: `
        precision highp float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        uniform float u_chromaBoost;
        uniform float u_lightnessGamma;
        uniform float u_hueShift;
        uniform float u_warmth;
        uniform float u_chromaMidpoint;
        varying vec2 v_texCoord;

        // ── sRGB ↔ Linear ──────────────────────────────────────────────
        vec3 srgbToLinear(vec3 c) {
            vec3 lo = c / 12.92;
            vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
            return mix(lo, hi, step(vec3(0.04045), c));
        }

        vec3 linearToSrgb(vec3 c) {
            c = clamp(c, 0.0, 1.0);
            vec3 lo = c * 12.92;
            vec3 hi = pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055;
            return mix(lo, hi, step(vec3(0.0031308), c));
        }

        // ── Linear RGB → OKLAB ─────────────────────────────────────────
        // Matrices: Bjorn Ottosson (https://bottosson.github.io/posts/oklab/)
        vec3 linearToOklab(vec3 rgb) {
            float l = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
            float m = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
            float s = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;

            float l_ = pow(max(l, 0.0), 0.333333);
            float m_ = pow(max(m, 0.0), 0.333333);
            float s_ = pow(max(s, 0.0), 0.333333);

            return vec3(
                0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
                1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
                0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
            );
        }

        // ── OKLAB → Linear RGB ─────────────────────────────────────────
        vec3 oklabToLinear(vec3 lab) {
            float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
            float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
            float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;

            float l = l_ * l_ * l_;
            float m = m_ * m_ * m_;
            float s = s_ * s_ * s_;

            return vec3(
                 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
            );
        }

        // ── OKLAB ↔ OKLCH ──────────────────────────────────────────────
        vec3 oklabToOklch(vec3 lab) {
            float C = length(lab.yz);
            float H = atan(lab.z, lab.y);
            return vec3(lab.x, C, H);
        }

        vec3 oklchToOklab(vec3 lch) {
            return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
        }

        void main() {
            vec4 src = texture2D(u_image, v_texCoord);
            vec3 linear = srgbToLinear(src.rgb);
            vec3 lab    = linearToOklab(linear);
            vec3 lch    = oklabToOklch(lab);

            // ── Lightness curve (perceptual gamma) ─────────────────────
            // gamma < 1 brightens, gamma > 1 darkens, always in L space
            lch.x = pow(clamp(lch.x, 0.0, 1.0), u_lightnessGamma);

            // ── Chroma boost with midpoint rolloff ─────────────────────
            // Protects near-neutral and near-saturated pixels from blowing out
            float chromaTarget = lch.y * u_chromaBoost;
            float rolloff = smoothstep(u_chromaMidpoint, 0.4, lch.y);
            lch.y = mix(chromaTarget, lch.y, rolloff);
            lch.y = clamp(lch.y, 0.0, 0.4);

            // ── Hue shift (degrees → radians) ──────────────────────────
            lch.z += u_hueShift * 0.017453;

            // ── Warmth: nudge hue toward orange (~1.09 rad) or cyan ────
            float warmthTarget = lch.z + u_warmth * 0.3 * cos(lch.z - 1.09);
            lch.z = mix(lch.z, warmthTarget, abs(u_warmth));

            // ── Back to sRGB ────────────────────────────────────────────
            vec3 result = linearToSrgb(oklabToLinear(oklchToOklab(lch)));
            result = clamp(result, 0.0, 1.0);

            gl_FragColor = vec4(mix(src.rgb, result, u_intensity), src.a);
        }
    `,

    gradient_map: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform float u_intensity;
        varying vec2 v_texCoord;
        
        // Gradient stops (up to 8 stops)
        uniform int u_numStops;
        uniform float u_stops[8];      // positions 0.0-1.0
        uniform vec3 u_colors[8];      // RGB colors
        
        vec3 evaluateGradient(float t) {
            // Clamp to valid range
            t = clamp(t, 0.0, 1.0);
            
            // Find surrounding stops
            if (t <= u_stops[0]) return u_colors[0];
            
            // Check each possible stop pair (using constant loop)
            for (int i = 0; i < 7; i++) {
                float t0 = u_stops[i];
                float t1 = u_stops[i + 1];
                
                // Only process if this stop index is valid
                bool validStop = float(i) < float(u_numStops) - 1.0;
                
                if (validStop && t >= t0 && t <= t1) {
                    // Interpolate between stops
                    float factor = (t - t0) / (t1 - t0);
                    return mix(u_colors[i], u_colors[i + 1], factor);
                }
            }
            
            // Return last color (find it by checking all positions)
            vec3 lastColor = u_colors[0];
            for (int i = 0; i < 8; i++) {
                if (float(i) < float(u_numStops)) {
                    lastColor = u_colors[i];
                }
            }
            return lastColor;
        }

        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Calculate luminance
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Map to gradient
            vec3 mapped = evaluateGradient(luma);
            
            gl_FragColor = vec4(mix(color.rgb, mapped, u_intensity), color.a);
        }
    `,

    ssao: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;  // Optional MiDAS depth map
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_time;
        
        // SSAO parameters
        uniform float u_radius;
        uniform float u_bias;
        uniform float u_previewMode;
        uniform float u_useDepthTexture;  // 0 = pseudo-depth, 1 = MiDAS depth
        
        varying vec2 v_texCoord;
        
        // Generate pseudo-random value
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        
        // Generate pseudo-depth from luminance and edges
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            float luma = dot(color, vec3(0.299, 0.587, 0.114));
            
            // Darker = further away (inverted for more natural look)
            float depth = 1.0 - luma;
            
            // Edge detection contributes to depth (edges = geometry changes)
            vec2 texelSize = 1.0 / u_resolution;
            float edgeX = abs(
                dot(texture2D(u_image, uv + vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) -
                dot(texture2D(u_image, uv - vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114))
            );
            float edgeY = abs(
                dot(texture2D(u_image, uv + vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114)) -
                dot(texture2D(u_image, uv - vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114))
            );
            float edge = sqrt(edgeX * edgeX + edgeY * edgeY);
            
            return depth + edge * 0.3;
        }
        
        // Get depth from appropriate source
        float getDepth(vec2 uv) {
            if (u_useDepthTexture > 0.5) {
                // Use MiDAS depth texture (grayscale)
                return texture2D(u_depthTexture, uv).r;
            } else {
                // Use pseudo-depth
                return getPseudoDepth(uv);
            }
        }
        
        // Estimate normal from depth gradients
        vec3 getNormal(vec2 uv) {
            vec2 texelSize = 1.0 / u_resolution;
            
            float depthCenter = getDepth(uv);
            float depthRight = getDepth(uv + vec2(texelSize.x, 0.0));
            float depthTop = getDepth(uv + vec2(0.0, texelSize.y));
            
            vec3 dx = vec3(texelSize.x, 0.0, depthRight - depthCenter);
            vec3 dy = vec3(0.0, texelSize.y, depthTop - depthCenter);
            
            return normalize(cross(dx, dy));
        }
        
        // SSAO calculation
        float calculateAO(vec2 uv) {
            float depth = getDepth(uv);
            vec3 normal = getNormal(uv);
            
            // Sample points in a hemisphere
            float ao = 0.0;
            float samples = 16.0;
            float radius = u_radius * 0.01; // Scale to reasonable size
            
            for (float i = 0.0; i < 16.0; i++) {
                // Generate random offset
                float angle = (i + hash(uv + u_time * 0.001)) * 0.39269908; // 2*PI/16
                float distance = (i + 0.5) / samples;
                
                vec2 offset = vec2(cos(angle), sin(angle)) * radius * distance;
                vec2 sampleUV = uv + offset;
                
                // Get depth at sample point
                float sampleDepth = getDepth(sampleUV);
                
                // Compare depths
                float rangeCheck = smoothstep(0.0, 1.0, radius / abs(depth - sampleDepth));
                
                // If sample is closer to camera, it occludes current pixel
                float occluded = step(sampleDepth + u_bias, depth);
                ao += occluded * rangeCheck;
            }
            
            ao = 1.0 - (ao / samples);
            
            // Enhance contrast
            ao = pow(ao, 1.5);
            
            return ao;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Calculate ambient occlusion
            float ao = calculateAO(v_texCoord);
            
            // Preview mode: show AO map or depth map
            if (u_previewMode > 1.5) {
                // Preview depth map
                float depth = getDepth(v_texCoord);
                gl_FragColor = vec4(vec3(depth), 1.0);
            } else if (u_previewMode > 0.5) {
                // Preview AO map
                gl_FragColor = vec4(vec3(ao), 1.0);
            } else {
                // Apply mode: darken image based on AO
                vec3 darkened = color.rgb * mix(1.0, ao, u_intensity * 0.8);
                gl_FragColor = vec4(darkened, color.a);
            }
        }
    `,

    depth_of_field: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_focalDepth;
        uniform float u_focalRange;
        uniform float u_bokehStrength;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        // Hexagonal bokeh blur
        vec4 bokehBlur(vec2 uv, float blur) {
            vec4 color = vec4(0.0);
            float total = 0.0;
            vec2 texelSize = 1.0 / u_resolution;
            
            float radius = blur * u_bokehStrength;
            float sampleCount = clamp(radius * 2.0, 1.0, 20.0);
            
            for (int i = 0; i < 20; i++) {
                if (float(i) >= sampleCount) break;
                float angle = float(i) * 0.314159; // PI/10 for hexagonal pattern
                for (int j = 1; j <= 3; j++) {
                    vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * float(j) * radius;
                    color += texture2D(u_image, uv + offset);
                    total += 1.0;
                }
            }
            
            return color / total;
        }
        
        void main() {
            float depth = getDepth(v_texCoord);
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Calculate blur amount based on distance from focal plane
            float depthDiff = abs(depth - u_focalDepth);
            float blurAmount = smoothstep(0.0, u_focalRange, depthDiff);
            
            vec4 blurred = bokehBlur(v_texCoord, blurAmount * 10.0);
            
            gl_FragColor = mix(color, blurred, u_intensity * blurAmount);
        }
    `,

    tilt_shift: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_focusPosition;
        uniform float u_focusWidth;
        uniform float u_blurStrength;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        vec4 blur(vec2 uv, float amount) {
            vec4 color = vec4(0.0);
            vec2 texelSize = 1.0 / u_resolution;
            
            float sampleCount = clamp(amount * 3.0, 1.0, 15.0);
            float totalWeight = 0.0;
            
            for (int i = -15; i <= 15; i++) {
                if (abs(float(i)) > sampleCount) continue;
                float weight = 1.0 - abs(float(i)) / sampleCount;
                color += texture2D(u_image, uv + vec2(0.0, float(i)) * texelSize * amount) * weight;
                totalWeight += weight;
            }
            
            return color / totalWeight;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            // Distance from focus line
            float dist = abs(v_texCoord.y - u_focusPosition);
            float blurAmount = smoothstep(u_focusWidth * 0.5, u_focusWidth, dist);
            
            vec4 blurred = blur(v_texCoord, blurAmount * u_blurStrength);
            
            gl_FragColor = mix(color, blurred, u_intensity * blurAmount);
        }
    `,

    atmospheric_fog: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform float u_fogStart;
        uniform float u_fogDensity;
        uniform vec3 u_fogColor;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            
            // Calculate fog amount
            float fogAmount = smoothstep(u_fogStart, 1.0, depth) * u_fogDensity;
            
            vec3 fogged = mix(color.rgb, u_fogColor, fogAmount * u_intensity);
            gl_FragColor = vec4(fogged, color.a);
        }
    `,

    depth_anaglyph: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_separation;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            float depth = getDepth(v_texCoord);
            vec2 texelSize = 1.0 / u_resolution;
            
            // Shift based on depth
            float shift = (depth - 0.5) * u_separation * u_intensity;
            
            vec2 leftUV = v_texCoord - vec2(shift * texelSize.x, 0.0);
            vec2 rightUV = v_texCoord + vec2(shift * texelSize.x, 0.0);
            
            vec3 leftColor = texture2D(u_image, leftUV).rgb;
            vec3 rightColor = texture2D(u_image, rightUV).rgb;
            
            // Red from left, cyan from right
            vec3 anaglyph = vec3(leftColor.r, rightColor.gb);
            
            vec4 original = texture2D(u_image, v_texCoord);
            gl_FragColor = vec4(mix(original.rgb, anaglyph, u_intensity), original.a);
        }
    `,

    depth_peeling: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform float u_minDepth;
        uniform float u_maxDepth;
        uniform float u_feather;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            
            // Calculate visibility in depth range
            float inRange = smoothstep(u_minDepth - u_feather, u_minDepth, depth) *
                           (1.0 - smoothstep(u_maxDepth, u_maxDepth + u_feather, depth));
            
            float alpha = mix(1.0, inRange, u_intensity);
            gl_FragColor = vec4(color.rgb, color.a * alpha);
        }
    `,

    depth_color_grade: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec3 u_nearColor;
        uniform vec3 u_farColor;
        uniform float u_colorMix;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            
            // Blend between near and far colors
            vec3 tintColor = mix(u_nearColor, u_farColor, depth);
            vec3 graded = mix(color.rgb, color.rgb * tintColor, u_colorMix * u_intensity);
            
            gl_FragColor = vec4(graded, color.a);
        }
    `,

    depth_edge_glow: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_threshold;
        uniform vec3 u_glowColor;
        uniform float u_glowWidth;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        float detectEdge(vec2 uv) {
            vec2 texelSize = 1.0 / u_resolution;
            
            float center = getDepth(uv);
            float left = getDepth(uv - vec2(texelSize.x, 0.0));
            float right = getDepth(uv + vec2(texelSize.x, 0.0));
            float top = getDepth(uv + vec2(0.0, texelSize.y));
            float bottom = getDepth(uv - vec2(0.0, texelSize.y));
            
            float edge = abs(center - left) + abs(center - right) +
                        abs(center - top) + abs(center - bottom);
            
            return edge;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float edge = detectEdge(v_texCoord);
            
            float glow = smoothstep(u_threshold, u_threshold + 0.1, edge) * u_glowWidth;
            vec3 glowed = color.rgb + u_glowColor * glow * u_intensity;
            
            gl_FragColor = vec4(glowed, color.a);
        }
    `,

    depth_selective_sharpen: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_focusDepth;
        uniform float u_focusRange;
        uniform float u_sharpness;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        vec3 sharpen(vec2 uv) {
            vec2 texelSize = 1.0 / u_resolution;
            
            vec3 color = texture2D(u_image, uv).rgb * 5.0;
            color -= texture2D(u_image, uv + vec2(texelSize.x, 0.0)).rgb;
            color -= texture2D(u_image, uv - vec2(texelSize.x, 0.0)).rgb;
            color -= texture2D(u_image, uv + vec2(0.0, texelSize.y)).rgb;
            color -= texture2D(u_image, uv - vec2(0.0, texelSize.y)).rgb;
            
            return color * u_sharpness;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            
            float depthDiff = abs(depth - u_focusDepth);
            float inFocus = 1.0 - smoothstep(0.0, u_focusRange, depthDiff);
            
            vec3 sharpened = sharpen(v_texCoord);
            vec3 result = mix(color.rgb, sharpened, inFocus * u_intensity);
            
            gl_FragColor = vec4(result, color.a);
        }
    `,

    depth_displacement: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_strength;
        uniform float u_angle;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            float depth = getDepth(v_texCoord);
            
            // Displace based on depth
            float displacement = (depth - 0.5) * u_strength * u_intensity * 0.1;
            vec2 offset = vec2(cos(u_angle), sin(u_angle)) * displacement;
            
            vec2 displaced = v_texCoord + offset;
            vec4 color = texture2D(u_image, displaced);
            
            gl_FragColor = color;
        }
    `,

    depth_relief: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_lightAngle;
        uniform float u_lightHeight;
        uniform float u_bumpStrength;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        vec3 calculateNormal(vec2 uv) {
            vec2 texelSize = 1.0 / u_resolution;
            
            float center = getDepth(uv);
            float right = getDepth(uv + vec2(texelSize.x, 0.0));
            float top = getDepth(uv + vec2(0.0, texelSize.y));
            
            vec3 dx = vec3(texelSize.x, 0.0, (right - center) * u_bumpStrength);
            vec3 dy = vec3(0.0, texelSize.y, (top - center) * u_bumpStrength);
            
            return normalize(cross(dx, dy));
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            vec3 normal = calculateNormal(v_texCoord);
            
            // Light direction
            vec3 lightDir = normalize(vec3(
                cos(u_lightAngle),
                sin(u_lightAngle),
                u_lightHeight
            ));
            
            float lighting = max(dot(normal, lightDir), 0.0);
            lighting = mix(0.5, lighting, u_intensity);
            
            vec3 lit = color.rgb * lighting;
            gl_FragColor = vec4(lit, color.a);
        }
    `,

    depth_halftone: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_minDotSize;
        uniform float u_maxDotSize;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Dot size based on depth
            float dotSize = mix(u_minDotSize, u_maxDotSize, depth);
            
            vec2 cellSize = vec2(dotSize);
            vec2 cell = floor(v_texCoord * u_resolution / cellSize);
            vec2 cellPos = fract(v_texCoord * u_resolution / cellSize);
            
            // Distance from cell center
            vec2 center = vec2(0.5);
            float dist = length(cellPos - center);
            
            // Dot radius based on luminance
            float radius = luma * 0.5;
            float dot = smoothstep(radius, radius - 0.1, dist);
            
            vec3 halftone = mix(vec3(1.0), color.rgb, dot);
            gl_FragColor = vec4(mix(color.rgb, halftone, u_intensity), color.a);
        }
    `,

    depth_shadow: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_shadowAngle;
        uniform float u_shadowDistance;
        uniform vec3 u_shadowColor;
        uniform float u_shadowSoftness;
        uniform float u_useDepthTexture;
        uniform float u_invertDepth;
        
        varying vec2 v_texCoord;
        
        float getPseudoDepth(vec2 uv) {
            vec3 color = texture2D(u_image, uv).rgb;
            return 1.0 - dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        float getDepth(vec2 uv) {
            float depth;
            if (u_useDepthTexture > 0.5) {
                depth = texture2D(u_depthTexture, uv).r;
            } else {
                depth = getPseudoDepth(uv);
            }
            return u_invertDepth > 0.5 ? 1.0 - depth : depth;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            float depth = getDepth(v_texCoord);
            
            // Shadow offset based on depth
            vec2 shadowDir = vec2(cos(u_shadowAngle), sin(u_shadowAngle));
            vec2 shadowOffset = shadowDir * depth * u_shadowDistance * 0.01;
            
            float shadowDepth = getDepth(v_texCoord - shadowOffset);
            float shadow = smoothstep(0.0, u_shadowSoftness, depth - shadowDepth);
            
            vec3 shadowed = mix(color.rgb, u_shadowColor, shadow * u_intensity);
            gl_FragColor = vec4(shadowed, color.a);
        }
    `,

    sharp_3d_view: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_rotationX;
        uniform float u_rotationY;
        uniform float u_zoom;
        uniform float u_pointSize;
        uniform float u_useDepthTexture;
        
        varying vec2 v_texCoord;
        
        // Reconstruct 3D position from depth
        vec3 getWorldPosition(vec2 uv, float depth) {
            vec3 pos;
            pos.xy = (uv * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
            pos.z = -depth * 2.0; // Map depth to negative Z (camera looks down -Z axis)
            return pos;
        }
        
        // Simple rotation matrices
        mat3 rotateX(float angle) {
            float c = cos(angle);
            float s = sin(angle);
            return mat3(1, 0, 0, 0, c, -s, 0, s, c);
        }
        
        mat3 rotateY(float angle) {
            float c = cos(angle);
            float s = sin(angle);
            return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            if (u_useDepthTexture < 0.5) {
                // No depth texture - just show original image
                gl_FragColor = color;
                return;
            }
            
            float depth = texture2D(u_depthTexture, v_texCoord).r;
            
            // Get 3D position
            vec3 worldPos = getWorldPosition(v_texCoord, depth);
            
            // Apply rotations
            worldPos = rotateY(u_rotationY) * (rotateX(u_rotationX) * worldPos);
            
            // Move camera back and apply zoom
            worldPos.z -= 3.0 / u_zoom;
            
            // Proper perspective projection
            float perspectiveFactor = -2.5 / worldPos.z; // Focal length / distance
            vec2 projectedUV = worldPos.xy * perspectiveFactor;
            projectedUV = projectedUV * 0.5 + 0.5;
            
            // Sample from original image at rotated position
            if (projectedUV.x >= 0.0 && projectedUV.x <= 1.0 && 
                projectedUV.y >= 0.0 && projectedUV.y <= 1.0) {
                vec4 rotatedColor = texture2D(u_image, projectedUV);
                
                // Add depth-based shading for 3D effect
                float shade = 1.0 - depth * 0.3;
                rotatedColor.rgb *= shade;
                
                gl_FragColor = mix(color, rotatedColor, u_intensity);
            } else {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            }
        }
    `,

    normal_map_view: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_normalTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_lightAngle;
        uniform float u_lightElevation;
        uniform float u_lightIntensity;
        uniform float u_useNormalTexture;
        
        varying vec2 v_texCoord;
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            if (u_useNormalTexture < 0.5) {
                gl_FragColor = color;
                return;
            }
            
            // Read normal map (RGB stored as [0,255], convert to [-1,1])
            vec3 normal = texture2D(u_normalTexture, v_texCoord).rgb;
            normal = normal * 2.0 - 1.0;
            normal = normalize(normal);
            
            // Light direction from angles
            vec3 lightDir = vec3(
                cos(u_lightElevation) * cos(u_lightAngle),
                cos(u_lightElevation) * sin(u_lightAngle),
                sin(u_lightElevation)
            );
            lightDir = normalize(lightDir);
            
            // Diffuse lighting
            float diffuse = max(dot(normal, lightDir), 0.0);
            
            // Apply lighting
            vec3 lit = color.rgb * (0.3 + diffuse * u_lightIntensity);
            
            gl_FragColor = vec4(mix(color.rgb, lit, u_intensity), color.a);
        }
    `,

    geometric_depth_enhance: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform sampler2D u_depthTexture;
        uniform sampler2D u_normalTexture;
        uniform float u_intensity;
        uniform vec2 u_resolution;
        uniform float u_occlusionStrength;
        uniform float u_edgeEnhance;
        uniform float u_depthDarken;
        uniform float u_useDepthTexture;
        uniform float u_useNormalTexture;
        
        varying vec2 v_texCoord;
        
        float getDepth(vec2 uv) {
            return texture2D(u_depthTexture, uv).r;
        }
        
        vec3 getNormal(vec2 uv) {
            vec3 n = texture2D(u_normalTexture, uv).rgb;
            return normalize(n * 2.0 - 1.0);
        }
        
        float computeAO(vec2 uv, float depth, vec3 normal) {
            float ao = 0.0;
            float pixelSize = 1.0 / max(u_resolution.x, u_resolution.y);
            
            // Sample nearby depths
            float radius = 5.0 * pixelSize;
            float samples = 8.0;
            
            for (float i = 0.0; i < 8.0; i += 1.0) {
                float angle = i * 3.14159265 * 2.0 / samples;
                vec2 offset = vec2(cos(angle), sin(angle)) * radius;
                
                float sampleDepth = getDepth(uv + offset);
                float depthDiff = depth - sampleDepth;
                
                if (depthDiff > 0.0) {
                    ao += depthDiff;
                }
            }
            
            return clamp(1.0 - ao * u_occlusionStrength, 0.0, 1.0);
        }
        
        float detectEdge(vec2 uv) {
            float pixelSize = 1.0 / max(u_resolution.x, u_resolution.y);
            float center = getDepth(uv);
            
            float edge = 0.0;
            edge += abs(center - getDepth(uv + vec2(pixelSize, 0.0)));
            edge += abs(center - getDepth(uv + vec2(-pixelSize, 0.0)));
            edge += abs(center - getDepth(uv + vec2(0.0, pixelSize)));
            edge += abs(center - getDepth(uv + vec2(0.0, -pixelSize)));
            
            return edge * 2.0;
        }
        
        void main() {
            vec4 color = texture2D(u_image, v_texCoord);
            
            if (u_useDepthTexture < 0.5) {
                gl_FragColor = color;
                return;
            }
            
            float depth = getDepth(v_texCoord);
            vec3 normal = u_useNormalTexture > 0.5 ? getNormal(v_texCoord) : vec3(0, 0, 1);
            
            // Compute geometric ambient occlusion
            float ao = computeAO(v_texCoord, depth, normal);
            
            // Detect depth edges
            float edge = detectEdge(v_texCoord);
            
            // Apply effects
            vec3 result = color.rgb;
            
            // Ambient occlusion darkening
            result *= mix(1.0, ao, u_occlusionStrength);
            
            // Edge enhancement
            result = mix(result, result * (1.0 + edge), u_edgeEnhance);
            
            // Depth-based darkening (atmospheric perspective)
            result *= mix(1.0, 1.0 - depth * 0.5, u_depthDarken);
            
            gl_FragColor = vec4(mix(color.rgb, result, u_intensity), color.a);
        }
    `,

    // ─────────────────────────────────────────────────────────────────
    // SIGNAL EMULATION — Analog signal chain (pre-CRT degradation)
    // Modes: 0=RGB  1=Component(YPbPr)  2=S-Video  3=Composite  4=RF
    // ─────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────
    // COMPOSE — Layer blend mode compositing (used internally by pipeline)
    // u_image = current layer output  |  u_base = accumulated layer below
    // u_blendMode: 0=Normal 1=Multiply 2=Screen 3=Overlay 4=SoftLight
    //              5=HardLight 6=ColorDodge 7=ColorBurn
    // u_flipBase: 1.0 if base is original image texture (needs Y-flip)
    // ─────────────────────────────────────────────────────────────────
    _compose: `
        precision highp float;
        uniform sampler2D u_image;
        uniform sampler2D u_base;
        uniform float     u_blendMode;
        uniform float     u_opacity;
        uniform float     u_flipBase;
        varying vec2 v_texCoord;

        // Accurate soft-light per channel (Pegtop formula)
        float softLightCh(float b, float l) {
            float d = b <= 0.25
                ? ((16.0*b - 12.0)*b + 4.0)*b
                : sqrt(b);
            return b + (2.0*l - 1.0) * (d - b);
        }

        void main() {
            // Base may need Y-flip (original image vs framebuffer)
            vec2 bUV   = u_flipBase > 0.5
                       ? vec2(v_texCoord.x, 1.0 - v_texCoord.y)
                       : v_texCoord;
            vec3 base  = texture2D(u_base,  bUV).rgb;
            vec3 layer = texture2D(u_image, v_texCoord).rgb;

            vec3 bl;
            float m = u_blendMode;
            if      (m < 0.5) bl = layer;
            else if (m < 1.5) bl = base * layer;
            else if (m < 2.5) bl = 1.0 - (1.0-base)*(1.0-layer);
            else if (m < 3.5) bl = mix(2.0*base*layer,
                                       1.0 - 2.0*(1.0-base)*(1.0-layer),
                                       step(0.5, base));
            else if (m < 4.5) bl = vec3(softLightCh(base.r, layer.r),
                                        softLightCh(base.g, layer.g),
                                        softLightCh(base.b, layer.b));
            else if (m < 5.5) bl = mix(2.0*layer*base,               // hard light
                                       1.0 - 2.0*(1.0-layer)*(1.0-base),
                                       step(0.5, layer));
            else if (m < 6.5) bl = clamp(base / max(1.0-layer, vec3(0.001)), 0.0, 1.0);
            else               bl = 1.0 - clamp((1.0-base)/max(layer,vec3(0.001)),0.0,1.0);

            gl_FragColor = vec4(mix(base, bl, u_opacity), 1.0);
        }
    `,

    signal_emulation: `
        precision highp float;

        uniform sampler2D u_image;
        uniform vec2      u_resolution;
        uniform float     u_time;

        // ---- mode & blend ----
        uniform float u_signalMode;
        uniform float u_intensity;
        uniform float u_gammaIn;

        // ---- bandwidth ----
        uniform float u_lumaBandwidth;
        uniform float u_chromaBandwidthU;
        uniform float u_chromaBandwidthV;
        uniform float u_chromaBandwidthC;

        // ---- noise ----
        uniform float u_noiseStrength;
        uniform float u_lumaNoiseStrength;
        uniform float u_chromaNoiseStrength;

        // ---- distortion ----
        uniform float u_ringingStrength;
        uniform float u_ringingDistance;
        uniform float u_chromaDelayPixels;
        uniform float u_lumaDelayPixels;
        uniform float u_crosstalkStrength;
        uniform float u_crossColorStrength;
        uniform float u_crossLumaStrength;

        // ---- phase / subcarrier ----
        uniform float u_phaseErrorStrength;
        uniform float u_phaseNoiseStrength;
        uniform float u_subcarrierFrequency;
        uniform float u_subcarrierPhaseOffset;

        // ---- RF ----
        uniform float u_rfNoiseStrength;
        uniform float u_rfInterferenceStrength;
        uniform float u_rfTuningError;
        uniform float u_rfGhostingStrength;
        uniform float u_rfBandwidth;

        // ---- geometry ----
        uniform float u_horizontalJitterStrength;

        varying vec2 v_texCoord;

        // ══════════════════════════════════════════════════════════════
        // COLOR SPACE CONVERSIONS
        // ══════════════════════════════════════════════════════════════
        vec3 toLinear(vec3 c) {
            return pow(max(c, vec3(0.0)), vec3(u_gammaIn));
        }
        vec3 toSrgb(vec3 c) {
            return pow(max(c, vec3(0.0)), vec3(1.0 / u_gammaIn));
        }

        // BT.601 YIQ (NTSC composite)
        vec3 RGB_to_YIQ(vec3 c) {
            return vec3(
                 0.299*c.r + 0.587*c.g + 0.114*c.b,
                 0.596*c.r - 0.274*c.g - 0.322*c.b,
                 0.211*c.r - 0.523*c.g + 0.312*c.b
            );
        }
        vec3 YIQ_to_RGB(vec3 y) {
            return vec3(
                y.x + 0.956*y.y + 0.621*y.z,
                y.x - 0.272*y.y - 0.647*y.z,
                y.x - 1.106*y.y + 1.703*y.z
            );
        }

        // BT.709 YPbPr (component / HD)
        vec3 RGB_to_YPbPr(vec3 c) {
            float Y  =  0.2126*c.r + 0.7152*c.g + 0.0722*c.b;
            float Pb = (c.b - Y) * 0.5 / (1.0 - 0.0722);
            float Pr = (c.r - Y) * 0.5 / (1.0 - 0.2126);
            return vec3(Y, Pb, Pr);
        }
        vec3 YPbPr_to_RGB(vec3 ycc) {
            float R = ycc.x + 1.5748 * ycc.z;
            float B = ycc.x + 1.8556 * ycc.y;
            float G = (ycc.x - 0.2126*R - 0.0722*B) / 0.7152;
            return vec3(R, G, B);
        }

        // ══════════════════════════════════════════════════════════════
        // NOISE
        // ══════════════════════════════════════════════════════════════
        float hash21(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }
        // Centered noise  [-1, 1]
        float cnoise(vec2 p, float seed) {
            return hash21(p + seed) * 2.0 - 1.0;
        }

        // ══════════════════════════════════════════════════════════════
        // HORIZONTAL GAUSSIAN KERNEL
        // ══════════════════════════════════════════════════════════════
        float gauss(float x, float sigma) {
            return exp(-x*x / (2.0*sigma*sigma));
        }
        // bw [0..1] → sigma in pixels: 0 = very blurry (10 px), 1 = sharp (0.4 px)
        float bwSigma(float bw) {
            return mix(10.0, 0.4, clamp(bw, 0.0, 1.0));
        }

        // ══════════════════════════════════════════════════════════════
        // SOURCE SAMPLING (linear)
        // ══════════════════════════════════════════════════════════════
        vec3 srcLin(vec2 uv) {
            return toLinear(texture2D(u_image, clamp(uv, 0.001, 0.999)).rgb);
        }

        // ══════════════════════════════════════════════════════════════
        // MODE 0 — RGB
        // Simple bandwidth limit + ringing + noise + inter-channel crosstalk
        // ══════════════════════════════════════════════════════════════
        vec3 modeRGB(vec2 uv) {
            float sigma = bwSigma(u_lumaBandwidth);
            vec3 acc = vec3(0.0);
            float sumW = 0.0;
            for (float k = -12.0; k <= 12.0; k += 1.0) {
                float w = gauss(k, sigma);
                acc  += srcLin(uv + vec2(k / u_resolution.x, 0.0)) * w;
                sumW += w;
            }
            vec3 rgb = acc / sumW;

            // Gibbs ringing at edges
            float rd   = u_ringingDistance / u_resolution.x;
            vec3  edgL = srcLin(uv - vec2(rd, 0.0));
            vec3  edgR = srcLin(uv + vec2(rd, 0.0));
            rgb += (edgL + edgR - 2.0 * srcLin(uv)) * u_ringingStrength;

            // Noise
            vec2 nUV = uv * u_resolution;
            rgb += vec3(cnoise(nUV, 1.0)) * u_noiseStrength * 0.15;

            // Inter-channel crosstalk (mild, G bleed into R and B)
            float ct = u_crosstalkStrength * 0.08;
            rgb.r += rgb.g * ct;
            rgb.b += rgb.g * ct * 0.6;

            return rgb;
        }

        // ══════════════════════════════════════════════════════════════
        // MODE 1 — COMPONENT YPbPr
        // Separate bandwidth limits per channel + delay + noise
        // ══════════════════════════════════════════════════════════════
        vec3 modeComponent(vec2 uv) {
            float sigY  = bwSigma(u_lumaBandwidth);
            float sigPb = bwSigma(u_chromaBandwidthU);
            float sigPr = bwSigma(u_chromaBandwidthV);

            float Y=0.0, Pb=0.0, Pr=0.0, wY=0.0, wPb=0.0, wPr=0.0;
            for (float k = -12.0; k <= 12.0; k += 1.0) {
                vec3 ycc = RGB_to_YPbPr(srcLin(uv + vec2(k / u_resolution.x, 0.0)));
                float wy = gauss(k, sigY);  Y  += ycc.x * wy; wY  += wy;
                float wb = gauss(k, sigPb); Pb += ycc.y * wb; wPb += wb;
                float wr = gauss(k, sigPr); Pr += ycc.z * wr; wPr += wr;
            }
            Pb /= wPb;
            Pr /= wPr;

            // Luma re-sampled at delay offset
            float duL = u_lumaDelayPixels / u_resolution.x;
            float Yd = 0.0, wYd = 0.0;
            for (float k = -5.0; k <= 5.0; k += 1.0) {
                float w = gauss(k, sigY);
                Yd  += RGB_to_YPbPr(srcLin(uv + vec2(duL + k / u_resolution.x, 0.0))).x * w;
                wYd += w;
            }
            Y = Yd / max(wYd, 0.001);

            vec2 nUV = uv * u_resolution;
            Y  += cnoise(nUV, 1.0) * u_lumaNoiseStrength   * 0.08;
            Pb += cnoise(nUV, 2.0) * u_chromaNoiseStrength * 0.08;
            Pr += cnoise(nUV, 3.0) * u_chromaNoiseStrength * 0.08;

            return YPbPr_to_RGB(vec3(Y, Pb, Pr));
        }

        // ══════════════════════════════════════════════════════════════
        // MODE 2 — S-VIDEO (Y/C)
        // Y and chroma filtered separately; phase error on chroma
        // ══════════════════════════════════════════════════════════════
        vec3 modeSVideo(vec2 uv) {
            float sigY = bwSigma(u_lumaBandwidth);
            float sigC = bwSigma(u_chromaBandwidthC);

            // Per-line phase error (stable per scanline)
            float line  = floor(uv.y * u_resolution.y);
            float lnPh  = cnoise(vec2(0.0, line), 3.0) * u_phaseNoiseStrength;
            float pe    = u_phaseErrorStrength + lnPh;
            float cosP  = cos(pe), sinP = sin(pe);

            float Y=0.0, I=0.0, Q=0.0, wY=0.0, wC=0.0;
            for (float k = -12.0; k <= 12.0; k += 1.0) {
                vec3 yiq = RGB_to_YIQ(srcLin(uv + vec2(k / u_resolution.x, 0.0)));
                float wy = gauss(k, sigY); Y += yiq.x * wy; wY += wy;
                float wc = gauss(k, sigC);
                // Rotate IQ by phase error
                I += (yiq.y * cosP - yiq.z * sinP) * wc;
                Q += (yiq.y * sinP + yiq.z * cosP) * wc;
                wC += wc;
            }
            Y /= max(wY, 0.001);
            I /= max(wC, 0.001);
            Q /= max(wC, 0.001);

            vec2 nUV = uv * u_resolution;
            Y += cnoise(nUV, 1.0) * u_lumaNoiseStrength   * 0.08;
            I += cnoise(nUV, 2.0) * u_chromaNoiseStrength * 0.06;
            Q += cnoise(nUV, 3.0) * u_chromaNoiseStrength * 0.06;

            return YIQ_to_RGB(vec3(Y, I, Q));
        }

        // ══════════════════════════════════════════════════════════════
        // COMPOSITE CORE — shared by modes 3 (Composite) and 4 (RF)
        //
        // Single-pass encode → filter → decode:
        //   For each output pixel x, sample source at x+k, compute
        //   the composite signal at that position, then simultaneously
        //   accumulate Y (lowpass) and demodulate I/Q.
        //
        // This collapses CV passes 1-6 into one horizontal loop.
        // Demodulation gain is corrected by ÷0.5 (from cos²→½ identity).
        // ══════════════════════════════════════════════════════════════
        vec3 compositeCore(vec2 uv, float rfNoise) {
            float x    = uv.x * u_resolution.x;
            float line = floor(uv.y * u_resolution.y);
            float lnPh = cnoise(vec2(0.0, line), 4.0) * u_phaseNoiseStrength;
            float bsPh = u_subcarrierPhaseOffset + lnPh;

            float sigY = bwSigma(u_lumaBandwidth);
            float sigI = bwSigma(u_chromaBandwidthU);
            float sigQ = bwSigma(u_chromaBandwidthV);

            float Y=0.0, I=0.0, Q=0.0, wY=0.0, wC=0.0;

            for (float k = -12.0; k <= 12.0; k += 1.0) {
                vec2 suv = uv + vec2(k / u_resolution.x, 0.0);
                vec3 yiq = RGB_to_YIQ(srcLin(suv));

                // ── Encode: composite = Y + I·cos(ωx) + Q·sin(ωx)
                float encPh = (x + k) * u_subcarrierFrequency + bsPh;
                float comp  = yiq.x
                            + yiq.y * cos(encPh)
                            + yiq.z * sin(encPh);

                // ── RF noise / ghosting on composite signal
                if (rfNoise > 0.001) {
                    vec2 nUV = suv * u_resolution;
                    comp += cnoise(nUV, 9.0) * rfNoise * 0.18;
                    // Delayed ghost
                    vec2 gUV  = suv + vec2(2.0 / u_resolution.x, 0.0);
                    vec3 gYIQ = RGB_to_YIQ(srcLin(gUV));
                    float gPh = (x + k + 2.0) * u_subcarrierFrequency + bsPh;
                    comp += (gYIQ.x + gYIQ.y*cos(gPh) + gYIQ.z*sin(gPh))
                          * u_rfGhostingStrength * rfNoise;
                }

                // ── Y: lowpass of composite (no demodulation needed)
                float wy = gauss(k, sigY);
                Y  += comp * wy;
                wY += wy;

                // ── I/Q: demodulate with carrier at decode position
                //    Chroma delay shifts the effective decode phase
                float decX  = x + k - u_chromaDelayPixels;
                float decPh = decX * u_subcarrierFrequency + bsPh + u_phaseErrorStrength;
                float wi = gauss(k, sigI);
                float wq = gauss(k, sigQ);
                I  += comp * cos(decPh) * wi;
                Q  += comp * sin(decPh) * wq;
                wC += wi;
            }

            Y /= max(wY, 0.001);
            // ×2 corrects for the 0.5 gain from the cos²→½ demodulation identity
            I /= max(wC * 0.5, 0.001);
            Q /= max(wC * 0.5, 0.001);

            return vec3(Y, I, Q);
        }

        // ══════════════════════════════════════════════════════════════
        // MODE 3 — COMPOSITE
        // ══════════════════════════════════════════════════════════════
        vec3 modeComposite(vec2 uv) {
            vec2 nUV = uv * u_resolution;
            vec3 yiq = compositeCore(uv, 0.0);

            // Ringing on luma (Gibbs at sharp edges)
            float rd = u_ringingDistance / u_resolution.x;
            float lL = RGB_to_YIQ(srcLin(uv - vec2(rd, 0.0))).x;
            float lR = RGB_to_YIQ(srcLin(uv + vec2(rd, 0.0))).x;
            yiq.x += (lL + lR - 2.0 * yiq.x) * u_ringingStrength;

            // Cross-color: chroma leaks into luma and vice-versa
            yiq.x  += dot(yiq.yz, vec2(0.5)) * u_crossColorStrength * 0.08;
            yiq.yz += vec2(yiq.x)            * u_crossLumaStrength  * 0.04;

            // Noise
            yiq.x  += cnoise(nUV, 1.0) * u_noiseStrength       * 0.12;
            yiq.y  += cnoise(nUV, 2.0) * u_chromaNoiseStrength * 0.08;
            yiq.z  += cnoise(nUV, 3.0) * u_chromaNoiseStrength * 0.08;

            return YIQ_to_RGB(yiq);
        }

        // ══════════════════════════════════════════════════════════════
        // MODE 4 — RF
        // Adds RF carrier modulation, snow, interference, tuning error,
        // and a second bandwidth smear on top of composite degradation.
        // ══════════════════════════════════════════════════════════════
        vec3 modeRF(vec2 uv) {
            vec2  nUV = uv * u_resolution;
            float x   = uv.x * u_resolution.x;
            float y   = uv.y * u_resolution.y;

            // Composite decode with RF noise baked in
            vec3 yiq = compositeCore(uv, u_rfNoiseStrength);

            // Snow (wideband white noise across all channels)
            yiq += vec3(cnoise(nUV, 8.0)) * u_rfNoiseStrength * 0.22;

            // Horizontal interference (slow beating stripes)
            float intf = sin(y * 0.18 + x * 0.025 + u_rfTuningError * 12.0)
                       * u_rfInterferenceStrength * 0.05;
            yiq.x += intf;

            // Tuning error → hue shift (phase drift on chroma)
            yiq.y += u_rfTuningError * 0.28;

            // Ringing (stronger on RF due to narrow tuner bandwidth)
            float rd = u_ringingDistance / u_resolution.x;
            float lL = RGB_to_YIQ(srcLin(uv - vec2(rd, 0.0))).x;
            float lR = RGB_to_YIQ(srcLin(uv + vec2(rd, 0.0))).x;
            yiq.x += (lL + lR - 2.0 * yiq.x) * u_ringingStrength * 1.4;

            // Cross contamination (more aggressive on RF)
            yiq.x  += dot(yiq.yz, vec2(0.5)) * u_crossColorStrength * 0.14;
            yiq.yz += vec2(yiq.x)            * u_crossLumaStrength  * 0.07;

            // RF bandwidth: additional horizontal smear based on tuner selectivity
            float rfSig = bwSigma(u_rfBandwidth);
            vec3  rfAcc = vec3(0.0);
            float rfW   = 0.0;
            for (float k = -6.0; k <= 6.0; k += 1.0) {
                float w  = gauss(k, rfSig);
                vec3  s  = RGB_to_YIQ(srcLin(uv + vec2(k / u_resolution.x, 0.0)));
                rfAcc += s * w;
                rfW   += w;
            }
            // Blend toward smeared source proportional to bandwidth narrowness
            yiq = mix(yiq, rfAcc / max(rfW, 0.001),
                      clamp(1.0 - u_rfBandwidth, 0.0, 0.75));

            return YIQ_to_RGB(yiq);
        }

        // ══════════════════════════════════════════════════════════════
        // MAIN
        // ══════════════════════════════════════════════════════════════
        void main() {
            vec2 uv   = v_texCoord;
            vec3 orig = texture2D(u_image, uv).rgb;

            // Per-line horizontal jitter (stable within a scanline)
            float line = floor(uv.y * u_resolution.y);
            float jit  = cnoise(vec2(0.0, line), 7.0)
                       * u_horizontalJitterStrength / u_resolution.x;
            uv.x = clamp(uv.x + jit, 0.0, 1.0);

            vec3 sig;
            float m = u_signalMode;
            if      (m < 0.5) sig = modeRGB(uv);
            else if (m < 1.5) sig = modeComponent(uv);
            else if (m < 2.5) sig = modeSVideo(uv);
            else if (m < 3.5) sig = modeComposite(uv);
            else              sig = modeRF(uv);

            // Allow analog overshoot, then bring back to display gamma
            sig = clamp(sig, -0.25, 1.25);
            vec3 display = toSrgb(clamp(sig, 0.0, 1.0));

            gl_FragColor = vec4(mix(orig, display, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // SPLIT TONING
    // Luma-zone colour tinting: separate hue/sat for shadows and highlights.
    // Pivot can be shifted with u_balance. Physically: tints are added as
    // offsets from neutral grey in a manner consistent with colour-grading.
    // ════════════════════════════════════════════════════════════════════
    split_toning: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_shadowHue;
        uniform float u_shadowSat;
        uniform float u_highlightHue;
        uniform float u_highlightSat;
        uniform float u_balance;

        varying vec2 v_texCoord;

        vec3 hue2rgb(float h) {
            h = mod(h, 360.0) / 60.0;
            float r = abs(h - 3.0) - 1.0;
            float g = 2.0 - abs(h - 2.0);
            float b = 2.0 - abs(h - 4.0);
            return clamp(vec3(r, g, b), 0.0, 1.0);
        }

        void main() {
            vec3 col  = texture2D(u_image, v_texCoord).rgb;
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

            float pivot = 0.5 + u_balance * 0.35;
            float sw = smoothstep(pivot, max(pivot - 0.3, 0.0), lum);
            float hw = smoothstep(pivot, min(pivot + 0.3, 1.0), lum);

            vec3 sTint = hue2rgb(u_shadowHue)    - 0.5;
            vec3 hTint = hue2rgb(u_highlightHue) - 0.5;

            vec3 toned = col
                + sTint * sw * u_shadowSat    * 0.6
                + hTint * hw * u_highlightSat * 0.6;

            gl_FragColor = vec4(mix(col, clamp(toned, 0.0, 1.0), u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // BLOOM / LUMINANCE GLOW
    // Threshold-based additive glow. Soft-knee threshold avoids hard
    // clipping. 3-ring x 8-angle Gaussian scatter. Optional tint.
    // ════════════════════════════════════════════════════════════════════
    bloom: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_threshold;
        uniform float u_radius;
        uniform float u_strength;
        uniform float u_tintR;
        uniform float u_tintG;
        uniform float u_tintB;

        varying vec2 v_texCoord;

        void main() {
            vec2  uv   = v_texCoord;
            vec3  orig = texture2D(u_image, uv).rgb;
            vec2  px   = 1.0 / u_resolution;

            vec3 bloom = vec3(0.0);
            float wSum = 0.0;
            for (float ring = 1.0; ring <= 3.0; ring += 1.0) {
                float r = ring * u_radius;
                float w = exp(-ring * ring * 0.5);
                for (float a = 0.0; a < 6.2832; a += 0.7854) {
                    vec2 off = vec2(cos(a), sin(a)) * r * px;
                    vec3 s   = texture2D(u_image, uv + off).rgb;
                    float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
                    float knee = 0.1;
                    float ex = lum - u_threshold;
                    float contrib = (ex > knee)
                        ? ex
                        : (ex > 0.0 ? (ex * ex) / (2.0 * knee) : 0.0);
                    bloom += s * contrib * w;
                    wSum  += w;
                }
            }
            bloom /= max(wSum, 0.001);

            vec3 tint = vec3(u_tintR, u_tintG, u_tintB);
            vec3 glow = bloom * tint * u_strength;

            gl_FragColor = vec4(mix(orig, clamp(orig + glow, 0.0, 1.0), u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // ANAMORPHIC LENS FLARE STREAKS
    // Horizontal chromatic streak simulating anamorphic lens reflection.
    // R channel lags, B channel leads (chromatic aberration on streak).
    // Characteristic blue tint on flare highlight.
    // ════════════════════════════════════════════════════════════════════
    anamorphic_flare: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_threshold;
        uniform float u_streakLength;
        uniform float u_chromaSpread;
        uniform float u_blueTint;
        uniform float u_streakFalloff;

        varying vec2 v_texCoord;

        void main() {
            vec2 uv  = v_texCoord;
            vec3 orig = texture2D(u_image, uv).rgb;
            vec2 px   = vec2(1.0 / u_resolution.x, 0.0);

            vec3 streak = vec3(0.0);
            float wSum  = 0.0;

            for (float i = -32.0; i <= 32.0; i += 1.0) {
                if (i == 0.0) continue;
                float dist = abs(i) / 32.0;
                float w = pow(1.0 - dist, u_streakFalloff);

                float cr = 1.0 - u_chromaSpread * 0.25;
                float cb = 1.0 + u_chromaSpread * 0.25;

                vec2 offR = px * i * u_streakLength * cr;
                vec2 offG = px * i * u_streakLength;
                vec2 offB = px * i * u_streakLength * cb;

                float sR = texture2D(u_image, uv + offR).r;
                float sG = texture2D(u_image, uv + offG).g;
                float sB = texture2D(u_image, uv + offB).b;

                float above = max(max(sR, sG) - u_threshold, 0.0);
                streak += vec3(sR, sG, sB) * above * w;
                wSum   += w;
            }
            streak /= max(wSum * 0.15, 0.001);

            vec3 tintCol = mix(vec3(1.0), vec3(0.55, 0.75, 1.0), u_blueTint);
            streak *= tintCol;

            gl_FragColor = vec4(mix(orig, clamp(orig + streak, 0.0, 1.0), u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // PIXEL SORT
    // Glitch art: pixels within each column are sorted by brightness/hue/sat
    // within runs determined by a threshold mask.
    // 20-sample backward scan with O(n^2) rank sort.
    // ════════════════════════════════════════════════════════════════════
    pixel_sort: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_threshold;
        uniform float u_sortMode;
        uniform float u_descending;

        varying vec2 v_texCoord;

        #define SN 20

        vec3 rgb2hsv(vec3 c) {
            float mx = max(c.r, max(c.g, c.b));
            float mn = min(c.r, min(c.g, c.b));
            float d  = mx - mn;
            float h  = 0.0;
            if (d > 0.0001) {
                if      (mx == c.r) h = mod((c.g - c.b) / d, 6.0);
                else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
                else                h = (c.r - c.g) / d + 4.0;
                h /= 6.0;
            }
            float s = (mx > 0.0001) ? d / mx : 0.0;
            return vec3(h, s, mx);
        }

        float sortKey(vec3 col) {
            vec3 hsv = rgb2hsv(col);
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            if (u_sortMode < 0.5)       return lum;
            else if (u_sortMode < 1.5)  return hsv.x;
            else                        return hsv.y;
        }

        void main() {
            vec2 uv = v_texCoord;
            vec3 orig = texture2D(u_image, uv).rgb;
            float y = uv.y;
            float px = 1.0 / u_resolution.y;

            vec3  buf[SN];
            int   count = 0;
            for (int k = 0; k < SN; k++) {
                float sy = y - float(k) * px;
                if (sy < 0.0) break;
                vec3 s = texture2D(u_image, vec2(uv.x, sy)).rgb;
                float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
                if (k > 0 && lum < u_threshold) break;
                buf[k] = s;
                count = k + 1;
            }

            if (count < 2) {
                gl_FragColor = vec4(orig, 1.0);
                return;
            }

            float myKey = sortKey(buf[0]);
            int rank = 0;
            for (int j = 1; j < SN; j++) {
                if (j >= count) break;
                float k = sortKey(buf[j]);
                if (u_descending < 0.5 ? k < myKey : k > myKey) rank++;
            }

            vec3 sorted = buf[0];
            for (int k = 0; k < SN; k++) {
                if (k == rank) sorted = buf[k];
            }
            gl_FragColor = vec4(mix(orig, sorted, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // RISOGRAPH
    // Area-proportional halftone with two ink layers + paper base.
    // Dot radius = sqrt(coverage)*0.5 (preserves ink area proportional to
    // coverage). Second ink has registration offset for authentic mis-reg.
    // ════════════════════════════════════════════════════════════════════
    risograph: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_dotSize;
        uniform float u_angle1;
        uniform float u_angle2;
        uniform float u_ink1R; uniform float u_ink1G; uniform float u_ink1B;
        uniform float u_ink2R; uniform float u_ink2G; uniform float u_ink2B;
        uniform float u_paperR; uniform float u_paperG; uniform float u_paperB;
        uniform float u_regOffsetX;
        uniform float u_regOffsetY;
        uniform float u_grain;

        varying vec2 v_texCoord;

        float rand(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float halftoneDot(vec2 uv, float angleDeg, float cellPx) {
            float a  = angleDeg * 0.017453293;
            float ca = cos(a), sa = sin(a);
            vec2 puv = uv * u_resolution;
            vec2 rot = vec2(ca * puv.x - sa * puv.y,
                            sa * puv.x + ca * puv.y);
            vec2 cell = rot / cellPx;
            vec2 frc  = fract(cell) - 0.5;
            return length(frc);
        }

        void main() {
            vec2 uv    = v_texCoord;
            vec3 col   = texture2D(u_image, uv).rgb;
            float lum1 = dot(col, vec3(0.2126, 0.7152, 0.0722));

            vec2 uv2   = uv + vec2(u_regOffsetX, u_regOffsetY) / u_resolution;
            vec3 col2  = texture2D(u_image, clamp(uv2, 0.0, 1.0)).rgb;
            float lum2 = 1.0 - dot(col2, vec3(0.2126, 0.7152, 0.0722));

            float r1 = sqrt(clamp(1.0 - lum1, 0.0, 1.0)) * 0.5;
            float r2 = sqrt(clamp(lum2,        0.0, 1.0)) * 0.5;

            float d1 = halftoneDot(uv,  u_angle1, u_dotSize);
            float d2 = halftoneDot(uv2, u_angle2, u_dotSize);

            float ink1 = step(d1, r1);
            float ink2 = step(d2, r2);

            vec3 paper = vec3(u_paperR, u_paperG, u_paperB);
            vec3 ink1c = vec3(u_ink1R,  u_ink1G,  u_ink1B);
            vec3 ink2c = vec3(u_ink2R,  u_ink2G,  u_ink2B);

            vec3 result = paper;
            result = mix(result, result * ink1c, ink1);
            result = mix(result, result * ink2c, ink2);

            float grain = (rand(uv * u_resolution) - 0.5) * u_grain * 0.08;
            result = clamp(result + grain, 0.0, 1.0);

            gl_FragColor = vec4(mix(col, result, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // MEZZOTINT
    // Voronoi random-dot field mimicking intaglio mezzotint plate texture.
    // Dot radius proportional to local luminance. Contrast S-curve.
    // Colour retention for highlight areas.
    // ════════════════════════════════════════════════════════════════════
    mezzotint: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_dotSize;
        uniform float u_inkAmount;
        uniform float u_contrast;
        uniform float u_colorAmount;

        varying vec2 v_texCoord;

        float rand(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float voronoiDist(vec2 uv) {
            vec2 cell = uv / u_dotSize;
            vec2 iCell = floor(cell);
            vec2 fCell = fract(cell);
            float minDist = 999.0;
            for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
                for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
                    vec2 nb = iCell + vec2(dx, dy);
                    vec2 rnd = vec2(rand(nb), rand(nb + 17.3));
                    vec2 pt = nb + rnd;
                    float d = length(cell - pt);
                    minDist = min(minDist, d);
                }
            }
            return minDist;
        }

        void main() {
            vec2 uv  = v_texCoord;
            vec2 puv = uv * u_resolution;
            vec3 col = texture2D(u_image, uv).rgb;
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

            float cl = lum - 0.5;
            float s  = u_contrast;
            lum = 0.5 + cl * (1.0 + s * 2.0 * cl * cl);
            lum = clamp(lum, 0.0, 1.0);

            float dist = voronoiDist(puv);

            float maxR = u_dotSize * 0.48 * (0.3 + u_inkAmount * 0.7);
            float dotR = maxR * (1.0 - lum);
            float inDot = step(dist, dotR / u_dotSize);

            vec3 ink   = vec3(0.05);
            vec3 paper = vec3(0.97);
            vec3 mono  = mix(paper, ink, inDot);

            float colorRetain = smoothstep(0.5, 0.85, lum) * u_colorAmount;
            vec3 result = mix(mono, col, colorRetain);

            gl_FragColor = vec4(mix(col, result, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // BLEACH BYPASS
    // Film processing: silver layer (luma) Hard Light blended onto colour
    // image, then partial desaturation. Physically mimics skipping the
    // bleach step in E-6/C-41 processing (silver retained).
    // ════════════════════════════════════════════════════════════════════
    bleach_bypass: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_bypass;
        uniform float u_contrast;

        varying vec2 v_texCoord;

        vec3 hardLight(vec3 base, vec3 blend) {
            return vec3(
                blend.r < 0.5 ? 2.0 * base.r * blend.r
                              : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r),
                blend.g < 0.5 ? 2.0 * base.g * blend.g
                              : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g),
                blend.b < 0.5 ? 2.0 * base.b * blend.b
                              : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b)
            );
        }

        float sCurve(float x, float s) {
            if (x < 0.5) return 0.5 * pow(2.0 * x, 1.0 + s * 3.0);
            else         return 1.0 - 0.5 * pow(2.0 * (1.0 - x), 1.0 + s * 3.0);
        }

        void main() {
            vec3 col    = texture2D(u_image, v_texCoord).rgb;
            float lum   = dot(col, vec3(0.2126, 0.7152, 0.0722));
            vec3  silver = vec3(lum);

            vec3 hl = hardLight(col, silver);
            vec3 bypassed = mix(col, hl, u_bypass);

            float desat = u_bypass * 0.4;
            float bpLum = dot(bypassed, vec3(0.2126, 0.7152, 0.0722));
            bypassed = mix(bypassed, vec3(bpLum), desat);

            bypassed = vec3(
                sCurve(bypassed.r, u_contrast),
                sCurve(bypassed.g, u_contrast),
                sCurve(bypassed.b, u_contrast)
            );

            gl_FragColor = vec4(mix(col, clamp(bypassed, 0.0, 1.0), u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // KUWAHARA ANISOTROPIC (Generalised)
    // 4-sector filter weighted by 1/variance^q. Smooth cosine sector
    // membership replaces hard quadrant clipping of classic Kuwahara.
    // Preserves edges while painting non-edge regions.
    // ════════════════════════════════════════════════════════════════════
    kuwahara_anisotropic: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_radius;
        uniform float u_sharpness;

        varying vec2 v_texCoord;

        void main() {
            vec2 uv = v_texCoord;
            vec2 px = 1.0 / u_resolution;
            vec3 orig = texture2D(u_image, uv).rgb;

            vec3  mean0 = vec3(0.0), mean1 = vec3(0.0);
            vec3  mean2 = vec3(0.0), mean3 = vec3(0.0);
            vec3  m2_0  = vec3(0.0), m2_1  = vec3(0.0);
            vec3  m2_2  = vec3(0.0), m2_3  = vec3(0.0);
            float w0 = 0.0, w1 = 0.0, w2 = 0.0, w3 = 0.0;

            float r = u_radius;
            for (float y = -7.0; y <= 7.0; y += 1.0) {
                if (abs(y) > r) continue;
                for (float x = -7.0; x <= 7.0; x += 1.0) {
                    if (abs(x) > r) continue;
                    vec3 s = texture2D(u_image, uv + vec2(x, y) * px).rgb;
                    float fx = x / r;
                    float fy = y / r;

                    float wR = smoothstep(-1.0, 1.0,  fx);
                    float wU = smoothstep(-1.0, 1.0,  fy);
                    float wL = smoothstep(-1.0, 1.0, -fx);
                    float wD = smoothstep(-1.0, 1.0, -fy);

                    float q0 = wR * wU;
                    float q1 = wL * wU;
                    float q2 = wL * wD;
                    float q3 = wR * wD;

                    mean0 += s * q0; m2_0 += s * s * q0; w0 += q0;
                    mean1 += s * q1; m2_1 += s * s * q1; w1 += q1;
                    mean2 += s * q2; m2_2 += s * s * q2; w2 += q2;
                    mean3 += s * q3; m2_3 += s * s * q3; w3 += q3;
                }
            }

            mean0 /= max(w0, 0.001); m2_0 /= max(w0, 0.001);
            mean1 /= max(w1, 0.001); m2_1 /= max(w1, 0.001);
            mean2 /= max(w2, 0.001); m2_2 /= max(w2, 0.001);
            mean3 /= max(w3, 0.001); m2_3 /= max(w3, 0.001);

            float var0 = dot(max(m2_0 - mean0 * mean0, vec3(0.0)), vec3(1.0));
            float var1 = dot(max(m2_1 - mean1 * mean1, vec3(0.0)), vec3(1.0));
            float var2 = dot(max(m2_2 - mean2 * mean2, vec3(0.0)), vec3(1.0));
            float var3 = dot(max(m2_3 - mean3 * mean3, vec3(0.0)), vec3(1.0));

            float q = u_sharpness;
            float iw0 = pow(var0 + 1e-6, -q);
            float iw1 = pow(var1 + 1e-6, -q);
            float iw2 = pow(var2 + 1e-6, -q);
            float iw3 = pow(var3 + 1e-6, -q);

            vec3 result = (mean0 * iw0 + mean1 * iw1 + mean2 * iw2 + mean3 * iw3)
                        / (iw0 + iw1 + iw2 + iw3);

            gl_FragColor = vec4(mix(orig, result, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // HUE MASK / COLOR ISOLATION
    // Isolates a target hue range (circular distance with feather) and
    // desaturates/darkens everything outside it.
    // ════════════════════════════════════════════════════════════════════
    hue_mask: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_targetHue;
        uniform float u_bandwidth;
        uniform float u_feather;
        uniform float u_desat;
        uniform float u_darken;

        varying vec2 v_texCoord;

        vec3 rgb2hsv(vec3 c) {
            float mx = max(c.r, max(c.g, c.b));
            float mn = min(c.r, min(c.g, c.b));
            float d  = mx - mn;
            float h  = 0.0;
            if (d > 0.0001) {
                if      (mx == c.r) h = mod((c.g - c.b) / d * 60.0, 360.0);
                else if (mx == c.g) h = (c.b - c.r) / d * 60.0 + 120.0;
                else                h = (c.r - c.g) / d * 60.0 + 240.0;
            }
            float s = (mx > 0.0001) ? d / mx : 0.0;
            return vec3(h, s, mx);
        }

        void main() {
            vec3 col = texture2D(u_image, v_texCoord).rgb;
            vec3 hsv = rgb2hsv(col);
            float hue = hsv.x;

            float diff = abs(mod(hue - u_targetHue + 540.0, 360.0) - 180.0);

            float halfBand = u_bandwidth;
            float feather  = max(u_feather, 0.001);
            float inMask   = 1.0 - smoothstep(halfBand - feather,
                                               halfBand + feather, diff);

            float outside = 1.0 - inMask;
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
            vec3 grey = vec3(lum);

            vec3 result = mix(col, grey, outside * u_desat);
            result = mix(result, result * (1.0 - u_darken * 0.5), outside);

            gl_FragColor = vec4(mix(col, result, u_intensity), 1.0);
        }
    `,

    // ════════════════════════════════════════════════════════════════════
    // PAPER BASE / MEDIA MODEL
    // Layered cellulose relief with procedural fibers, tooth, flecks,
    // absorbency, bleed, and medium-specific deposition behavior.
    // Presets cover multiple paper stocks and drawing media without
    // requiring scanned texture maps.
    // ════════════════════════════════════════════════════════════════════
    // PAPER TEXTURE
    // Procedural paper stock and medium interaction model.
    paper_texture: `
        precision highp float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_paperPreset;
        uniform float u_mediumPreset;
        uniform float u_grainSize;
        uniform float u_textureWeight;
        uniform float u_absorbency;
        uniform float u_bleed;
        uniform float u_tooth;
        uniform float u_edgeDarkening;
        uniform float u_pigmentGranulation;
        uniform float u_realisticColor;

        varying vec2 v_texCoord;

        float hash21(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise2(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);

            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));

            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }

        float fbm(vec2 p) {
            float value = 0.0;
            float amplitude = 0.5;
            for (int i = 0; i < 4; i++) {
                value += amplitude * noise2(p);
                p = p * 2.02 + vec2(19.1, 7.3);
                amplitude *= 0.5;
            }
            return value;
        }

        float saturation(vec3 c) {
            return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
        }

        vec3 adjustSaturation(vec3 c, float amount) {
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            return mix(vec3(l), c, amount);
        }

        vec3 sampleSoft(vec2 uv, vec2 px, float radius) {
            vec2 off = px * radius;

            vec3 sum = texture2D(u_image, uv).rgb * 0.28;
            sum += texture2D(u_image, clamp(uv + vec2( off.x, 0.0), 0.0, 1.0)).rgb * 0.14;
            sum += texture2D(u_image, clamp(uv + vec2(-off.x, 0.0), 0.0, 1.0)).rgb * 0.14;
            sum += texture2D(u_image, clamp(uv + vec2(0.0,  off.y), 0.0, 1.0)).rgb * 0.14;
            sum += texture2D(u_image, clamp(uv + vec2(0.0, -off.y), 0.0, 1.0)).rgb * 0.14;
            sum += texture2D(u_image, clamp(uv + vec2( off.x,  off.y), 0.0, 1.0)).rgb * 0.04;
            sum += texture2D(u_image, clamp(uv + vec2(-off.x,  off.y), 0.0, 1.0)).rgb * 0.04;
            sum += texture2D(u_image, clamp(uv + vec2( off.x, -off.y), 0.0, 1.0)).rgb * 0.04;
            sum += texture2D(u_image, clamp(uv + vec2(-off.x, -off.y), 0.0, 1.0)).rgb * 0.04;

            return sum;
        }

        void main() {
            vec2 uv = v_texCoord;
            vec2 px = 1.0 / u_resolution;
            vec3 source = texture2D(u_image, uv).rgb;
            float lum = dot(source, vec3(0.2126, 0.7152, 0.0722));
            float sat = saturation(source);

            vec3 paperTint = vec3(0.985, 0.983, 0.978);
            float presetRoughness = 0.12;
            float presetFiber = 0.08;
            float presetDirectionality = 0.10;
            float presetScale = 1.25;
            float presetSpeckle = 0.02;
            float extraCrossFiber = 0.0;
            vec2 fiberDir = normalize(vec2(0.92, 0.38));

            if (u_paperPreset < 0.5) {
                paperTint = vec3(0.985, 0.983, 0.978);
                presetRoughness = 0.12;
                presetFiber = 0.08;
                presetDirectionality = 0.10;
                presetScale = 1.25;
                presetSpeckle = 0.02;
                extraCrossFiber = 0.04;
                fiberDir = normalize(vec2(0.92, 0.38));
            } else if (u_paperPreset < 1.5) {
                paperTint = vec3(0.982, 0.976, 0.962);
                presetRoughness = 0.26;
                presetFiber = 0.22;
                presetDirectionality = 0.22;
                presetScale = 1.0;
                presetSpeckle = 0.05;
                extraCrossFiber = 0.10;
                fiberDir = normalize(vec2(0.84, 0.54));
            } else if (u_paperPreset < 2.5) {
                paperTint = vec3(0.978, 0.971, 0.952);
                presetRoughness = 0.46;
                presetFiber = 0.20;
                presetDirectionality = 0.28;
                presetScale = 0.82;
                presetSpeckle = 0.07;
                extraCrossFiber = 0.12;
                fiberDir = normalize(vec2(0.74, 0.67));
            } else if (u_paperPreset < 3.5) {
                paperTint = vec3(0.915, 0.848, 0.698);
                presetRoughness = 0.62;
                presetFiber = 0.46;
                presetDirectionality = 0.92;
                presetScale = 0.74;
                presetSpeckle = 0.08;
                extraCrossFiber = 0.36;
                fiberDir = normalize(vec2(0.98, 0.19));
            } else {
                paperTint = vec3(0.914, 0.902, 0.858);
                presetRoughness = 0.34;
                presetFiber = 0.18;
                presetDirectionality = 0.58;
                presetScale = 1.15;
                presetSpeckle = 0.14;
                extraCrossFiber = 0.08;
                fiberDir = normalize(vec2(0.95, 0.31));
            }

            float grainScale = max(u_grainSize * 6.0 * presetScale, 1.0);
            vec2 paperCoord = uv * u_resolution / grainScale;

            float macro = fbm(paperCoord * (0.75 + presetRoughness));
            float micro = fbm(paperCoord * (2.3 + presetRoughness * 1.7) + 17.4);
            float along = dot(paperCoord, fiberDir);
            float across = dot(paperCoord, vec2(-fiberDir.y, fiberDir.x));
            float fiberNoise = fbm(vec2(along * 1.5, across * 0.45) + 23.0);
            float strand = abs(sin(along * (2.2 + presetDirectionality * 7.0) + fiberNoise * 3.14159));
            float fibers = smoothstep(0.56, 0.96, strand) *
                           (0.45 + 0.55 * noise2(vec2(across * 1.2, along * 0.2)));
            float crossFiber = smoothstep(0.62, 0.98,
                               abs(sin(across * (1.1 + extraCrossFiber * 5.5) + macro * 4.0)));
            float flecks = smoothstep(0.78, 0.98, noise2(paperCoord * 4.0 + 9.4));

            float paperHeight = macro * (0.55 + presetRoughness * 0.25)
                              + micro * (0.25 + presetRoughness * 0.15)
                              + fibers * presetFiber * 0.45
                              + crossFiber * extraCrossFiber * 0.18;
            paperHeight = clamp(paperHeight, 0.0, 1.0);
            paperHeight = mix(paperHeight, smoothstep(0.18, 0.92, paperHeight), 0.35 + u_tooth * 0.25);

            float ridges = smoothstep(0.48, 0.95, paperHeight);
            float valleys = 1.0 - paperHeight;
            float paperShade = (paperHeight - 0.5) * (0.14 + presetRoughness * 0.12) * u_textureWeight;
            vec3 paperBase = clamp(paperTint + vec3(paperShade) - flecks * presetSpeckle * 0.06, 0.0, 1.0);

            float mediumBleed = 0.18;
            float mediumTooth = 0.18;
            float mediumGranulation = 0.08;
            float mediumEdge = 0.65;
            float chalkiness = 0.0;
            float density = 0.92;
            float satKeep = 1.0;
            float tintBlend = 0.04;
            float strokeAmount = 0.0;
            float strokeFrequency = 0.0;

            if (u_mediumPreset < 0.5) {
                mediumBleed = 0.12;
                mediumTooth = 0.16;
                mediumGranulation = 0.05;
                mediumEdge = 0.70;
                chalkiness = 0.0;
                density = 0.95;
                satKeep = 1.0;
                tintBlend = 0.03;
            } else if (u_mediumPreset < 1.5) {
                mediumBleed = 0.72;
                mediumTooth = 0.34;
                mediumGranulation = 0.86;
                mediumEdge = 0.82;
                chalkiness = 0.05;
                density = 0.72;
                satKeep = 0.92;
                tintBlend = 0.10;
            } else if (u_mediumPreset < 2.5) {
                mediumBleed = 0.42;
                mediumTooth = 0.08;
                mediumGranulation = 0.10;
                mediumEdge = 0.16;
                chalkiness = 0.0;
                density = 0.84;
                satKeep = 1.08;
                tintBlend = 0.05;
            } else if (u_mediumPreset < 3.5) {
                mediumBleed = 0.12;
                mediumTooth = 0.82;
                mediumGranulation = 0.42;
                mediumEdge = 0.26;
                chalkiness = 0.12;
                density = 0.58;
                satKeep = 0.82;
                tintBlend = 0.12;
                strokeAmount = 0.52;
                strokeFrequency = 8.5;
            } else {
                mediumBleed = 0.28;
                mediumTooth = 0.74;
                mediumGranulation = 0.58;
                mediumEdge = 0.22;
                chalkiness = 0.32;
                density = 0.50;
                satKeep = 0.68;
                tintBlend = 0.18;
                strokeAmount = 0.22;
                strokeFrequency = 4.6;
            }

            float blurAmount = clamp(u_bleed * 0.72 + u_absorbency * 0.4, 0.0, 1.0) *
                               (0.35 + mediumBleed * 0.9);
            float blurRadius = 0.35 + (u_bleed * 3.5 + u_absorbency * 2.0) * (0.45 + mediumBleed);
            vec3 softened = sampleSoft(uv, px, blurRadius);

            vec3 pigmentColor = mix(source, softened, blurAmount);
            if (u_realisticColor > 0.5) {
                pigmentColor = adjustSaturation(pigmentColor, satKeep);
                pigmentColor = mix(pigmentColor, pigmentColor * paperTint, tintBlend);
                pigmentColor = mix(pigmentColor,
                                   vec3(dot(pigmentColor, vec3(0.2126, 0.7152, 0.0722))),
                                   chalkiness * 0.22);
                pigmentColor = clamp(pigmentColor, 0.0, 1.0);
            }

            float pigment = clamp((1.0 - lum) * 0.72 + sat * 0.92, 0.0, 1.0);
            float pickupField = mix(ridges, valleys, clamp(mediumBleed, 0.0, 1.0));
            float toothResponse = mix(1.0, 0.72 + pickupField * 0.58, u_tooth * mediumTooth);
            float settling = mix(1.0, 0.82 + valleys * 0.55 + macro * 0.12, u_absorbency * mediumBleed);
            float granulation = mix(1.0, 0.78 + valleys * 0.42 + micro * 0.15,
                                    u_pigmentGranulation * mediumGranulation);

            float strokeMask = 1.0;
            if (strokeAmount > 0.001) {
                float stroke = abs(sin(dot(paperCoord, fiberDir) * strokeFrequency + micro * 5.0));
                strokeMask = mix(1.0, 0.76 + 0.24 * stroke, strokeAmount);
            }

            float coverage = clamp(pigment * (0.35 + density * 0.65) *
                                   toothResponse * settling * granulation * strokeMask,
                                   0.0, 1.0);
            float edgeMask = clamp(length(source - softened) * (2.2 + mediumEdge), 0.0, 1.0);
            float edgeDeposit = edgeMask * u_edgeDarkening * mediumEdge * coverage *
                                (0.55 + 0.45 * valleys);

            vec3 deposited = mix(paperBase, paperBase * max(pigmentColor, vec3(0.03)), coverage);
            deposited *= 1.0 - edgeDeposit * 0.55;
            deposited = mix(deposited, paperBase, chalkiness * 0.12 * (1.0 - coverage * 0.5));
            deposited = clamp(deposited, 0.0, 1.0);

            gl_FragColor = vec4(mix(source, deposited, u_intensity), 1.0);
        }
    `,

    // THIN FILM INTERFERENCE
    // Fabry-Perot iridescence: R = (1 - cos(delta)) / 2
    // where delta = 4*PI*n*d / lambda. Applied per channel at physical
    // wavelengths R=620nm, G=550nm, B=460nm.
    // Film thickness driven by local luma or flat for soap-bubble look.
    thin_film: `
        precision mediump float;
        uniform sampler2D u_image;
        uniform vec2  u_resolution;
        uniform float u_intensity;
        uniform float u_thickness;
        uniform float u_ior;
        uniform float u_lumaWeight;
        uniform float u_strength;

        varying vec2 v_texCoord;

        const float PI = 3.14159265;

        float filmR(float d_nm, float n, float lambda_nm) {
            float delta = 4.0 * PI * n * d_nm / lambda_nm;
            return (1.0 - cos(delta)) * 0.5;
        }

        void main() {
            vec3 col = texture2D(u_image, v_texCoord).rgb;
            float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

            float d = u_thickness * 100.0;
            d = mix(d, d * (0.5 + lum), u_lumaWeight);

            float n = u_ior;
            float rR = filmR(d, n, 620.0);
            float rG = filmR(d, n, 550.0);
            float rB = filmR(d, n, 460.0);

            vec3 iridescence = vec3(rR, rG, rB);

            float iridMean = (rR + rG + rB) / 3.0;
            iridescence = iridescence / max(iridMean, 0.001) * lum;

            vec3 result = mix(col, iridescence, u_strength);

            gl_FragColor = vec4(mix(col, clamp(result, 0.0, 1.0), u_intensity), 1.0);
        }
    `
};
