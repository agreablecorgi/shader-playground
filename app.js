class ShaderPlayground {
    constructor() {
        this.canvas = document.getElementById('glCanvas');
        this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true }) || 
                  this.canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
        
        if (!this.gl) {
            alert('WebGL not supported in your browser');
            return;
        }

        this.shaderStack = [];
        this.speed = 1.0;          // kept for time uniform scaling
        this.globalGamma = 2.2;
        this.outputResolution = 'fit';
        this.previewFidelity = 'performance'; // 'performance' | 'balanced' | 'high'
        this.currentTheme = 'auto';
        this.image = null;
        this.texture = null;
        this.depthTexture = null;  // MiDAS depth map
        this.normalTexture = null; // Normal map from SHARP
        this.gaussianData = null;  // Gaussian splatting data
        this.gaussianMode = false; // Whether to render Gaussians
        this.programs = {};
        this.framebuffers = [];
        this.fbTextures = [];
        this.startTime = Date.now();
        this.animationFrame = null;
        this.draggedLayer = null;
        
        // Zoom and pan properties
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        
        // 3D camera properties for Gaussian viewer
        this.cameraRotationX = 0;
        this.cameraRotationY = 0;
        this.cameraDistance = 3.0;
        this.isRotating = false;
        this.lastRotateX = 0;
        this.lastRotateY = 0;
        
        // Shader-specific parameters
        this.shaderParams = this.getDefaultShaderParams();
        this.selectedShader = null;

        // Gradient system
        this.gradients = this.getGradientPresets();
        this.currentGradient = this.gradients.sunset;
        this.selectedStop = null;

        this.initShaders();
        this.setupEventListeners();
        this.updateStackUI();
    }

    initShaders() {
        // Compile all shaders
        Object.keys(fragmentShaders).forEach(name => {
            this.programs[name] = this.createProgram(
                vertexShaderSource,
                fragmentShaders[name]
            );
        });
    }

    getDefaultShaderParams() {
        return {
            duotone: {
                color1: [0.2, 0.1, 0.4],
                color2: [1.0, 0.7, 0.3],
                contrast: 0.0
            },
            glitch: {
                blockScale: 0.5,
                colorInversion: 0.2,
                evolution: 0.0,
                timeMode: 0.0
            },
            halftone_cmyk: {
                cellSize: 6.0,
                gridNoise: 0.2,
                softness: 0.2,
                gainC: -0.6,
                gainM: 0.25,
                gainY: -0.3,
                gainK: 0.1,
                floodC: 0.15,
                floodM: 0.0,
                floodY: 0.0,
                floodK: 0.0
            },
            signal_emulation: {
                signalMode:             3.0,
                gammaIn:                2.2,
                lumaBandwidth:          0.55,
                chromaBandwidthU:       0.28,
                chromaBandwidthV:       0.18,
                chromaBandwidthC:       0.22,
                noiseStrength:          0.04,
                lumaNoiseStrength:      0.03,
                chromaNoiseStrength:    0.05,
                ringingStrength:        0.18,
                ringingDistance:        2.0,
                chromaDelayPixels:      0.5,
                lumaDelayPixels:        0.0,
                crosstalkStrength:      0.1,
                crossColorStrength:     0.12,
                crossLumaStrength:      0.04,
                phaseErrorStrength:     0.0,
                phaseNoiseStrength:     0.08,
                subcarrierFrequency:    0.35,
                subcarrierPhaseOffset:  0.0,
                rfNoiseStrength:        0.1,
                rfInterferenceStrength: 0.08,
                rfTuningError:          0.0,
                rfGhostingStrength:     0.04,
                rfBandwidth:            0.5,
                horizontalJitterStrength: 0.0
            },
            crt_advanced: {
                curvature: 0.25,
                vignetteStrength: 0.55,
                minBeamWidth: 0.4,
                maxBeamWidth: 1.1,
                beamSharpness: 2.2,
                neighborRadius: 1.0,
                scanlineStrength: 0.65,
                phosphorLayout: 0.0,
                phosphorScale: 1.0,
                maskStrength: 0.85,
                bloomStrength: 0.25,
                glassBlur: 0.0,
                gammaIn: 2.2,
                gammaOut: 2.2
            },
            halftone: {
                mode: 0.0,
                cellSize: 8.0,
                rotation: 0.0,
                softness: 0.1,
                contrast: 0.0
            },
            film_grain: {
                grainSize: 1.5,
                grainAmount: 0.3,
                clumping: 0.5,
                scratches: 0.2,
                dust: 0.2
            },
            pixelate: {
                pixelShape: 0.0,
                sharpness: 0.5
            },
            lens_distortion: {
                distortion: -0.3,
                dispersion: 2.0
            },
            vhs: {
                tracking: 1.0,
                vJitter: 0.5,
                chromaBleed: 1.0,
                crosstalk: 0.5,
                noise: 0.3,
                dropout: 0.5
            },
            voronoi_stippling: {
                cellSize: 8.0,
                dotSize: 0.6,
                randomness: 0.3
            },
            kuwahara: {
                radius: 4.0
            },
            crosshatch: {
                lineSpacing: 5.0,
                lineWidth: 0.5,
                angleSeparation: 45.0
            },
            tritone: {
                shadowColor: [0.1, 0.15, 0.3],
                midtoneColor: [0.9, 0.7, 0.4],
                highlightColor: [1.0, 0.95, 0.85],
                shadowRange: 0.4,
                highlightRange: 0.4,
                midtoneBalance: 0.0
            },
            technicolor: {
                fringing: 1.0,
                redOffset: -1.0,
                greenOffset: 0.0,
                blueOffset: 1.0,
                dyeDensity: 1.0,
                contrast: 0.5,
                saturation: 0.8
            },
            color_vector_flow: {
                flowDistance: 2.0,
                iterations: 5.0,
                flowAngle: 0.0
            },
            color_vector_curl: {
                scale: 1.0
            },
            color_vector_divergence: {
                scale: 1.0
            },
            color_vector_splatting: {
                splatDistance: 3.0,
                splatSize: 8.0
            },
            dithering: {
                algorithm: 1.0,
                matrixSize: 4.0,
                colorLevels: 2.0,
                spread: 1.0
            },
            kaleidoscope: {
                segments: 6.0,
                rotation: 0.0,
                zoom: 1.0,
                offsetX: 0.0,
                offsetY: 0.0
            },
            filter_warming81a: {
                strength: 0.5
            },
            filter_cooling82a: {
                strength: 0.5
            },
            filter_polarizer: {
                angle: 0
            },
            filter_nd: {
                stops: 3
            },
            ssao: {
                radius: 10.0,
                bias: 0.02,
                previewMode: 0.0,
                useDepthTexture: 0.0
            },
            depth_of_field: {
                focalDepth: 0.5,
                focalRange: 0.2,
                bokehStrength: 8.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            tilt_shift: {
                focusPosition: 0.5,
                focusWidth: 0.1,
                blurStrength: 10.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            atmospheric_fog: {
                fogStart: 0.3,
                fogDensity: 0.8,
                fogColor: [0.7, 0.8, 0.9],
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_anaglyph: {
                separation: 5.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_peeling: {
                minDepth: 0.0,
                maxDepth: 0.5,
                feather: 0.1,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_color_grade: {
                nearColor: [1.0, 1.0, 1.0],
                farColor: [0.5, 0.6, 0.8],
                colorMix: 0.5,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_edge_glow: {
                threshold: 0.1,
                glowColor: [0.5, 0.8, 1.0],
                glowWidth: 2.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_selective_sharpen: {
                focusDepth: 0.5,
                focusRange: 0.3,
                sharpness: 1.5,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_displacement: {
                strength: 5.0,
                angle: 0.785,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_relief: {
                lightAngle: 0.785,
                lightHeight: 2.0,
                bumpStrength: 5.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_halftone: {
                minDotSize: 3.0,
                maxDotSize: 15.0,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            depth_shadow: {
                shadowAngle: 2.356,
                shadowDistance: 10.0,
                shadowColor: [0.0, 0.0, 0.0],
                shadowSoftness: 0.2,
                useDepthTexture: 0.0,
                invertDepth: 0.0
            },
            sharp_3d_view: {
                rotationX: 0.0,
                rotationY: 0.0,
                zoom: 1.0,
                pointSize: 2.0,
                useDepthTexture: 0.0
            },
            normal_map_view: {
                lightAngle: 0.785,
                lightElevation: 0.785,
                lightIntensity: 1.0,
                useNormalTexture: 0.0
            },
            geometric_depth_enhance: {
                occlusionStrength: 0.8,
                edgeEnhance: 0.5,
                depthDarken: 0.3,
                useDepthTexture: 0.0,
                useNormalTexture: 0.0
            },
            split_toning: {
                shadowHue:      200.0,
                shadowSat:      0.6,
                highlightHue:   35.0,
                highlightSat:   0.5,
                balance:        0.0
            },
            bloom: {
                threshold:  0.6,
                radius:     6.0,
                strength:   1.2,
                tintR:      1.0,
                tintG:      0.95,
                tintB:      0.85
            },
            anamorphic_flare: {
                threshold:      0.7,
                streakLength:   12.0,
                chromaSpread:   0.5,
                blueTint:       0.6,
                streakFalloff:  2.0
            },
            pixel_sort: {
                threshold:   0.3,
                sortMode:    0.0,
                descending:  1.0
            },
            risograph: {
                dotSize:     8.0,
                angle1:      45.0,
                angle2:      75.0,
                ink1R: 0.1,  ink1G: 0.1,  ink1B: 0.6,
                ink2R: 0.8,  ink2G: 0.15, ink2B: 0.1,
                paperR: 0.97, paperG: 0.95, paperB: 0.88,
                regOffsetX:  2.0,
                regOffsetY:  1.0,
                grain:       0.4
            },
            mezzotint: {
                dotSize:     4.0,
                inkAmount:   0.7,
                contrast:    0.4,
                colorAmount: 0.3
            },
            bleach_bypass: {
                bypass:   0.8,
                contrast: 0.3
            },
            kuwahara_anisotropic: {
                radius:    4.0,
                sharpness: 4.0
            },
            hue_mask: {
                targetHue:  120.0,
                bandwidth:  40.0,
                feather:    15.0,
                desat:      1.0,
                darken:     0.3
            },
            thin_film: {
                thickness:   3.0,
                ior:         1.45,
                lumaWeight:  0.7,
                strength:    0.8
            }
        };
    }

    getGradientPresets() {
        return {
            sunset: [
                { position: 0.0, color: '#1a1a2e' },
                { position: 0.3, color: '#ff6b6b' },
                { position: 0.6, color: '#ffd93d' },
                { position: 1.0, color: '#fcf6cd' }
            ],
            ocean: [
                { position: 0.0, color: '#000428' },
                { position: 0.5, color: '#004e92' },
                { position: 1.0, color: '#6dd5ed' }
            ],
            forest: [
                { position: 0.0, color: '#134e4a' },
                { position: 0.5, color: '#10b981' },
                { position: 1.0, color: '#d1fae5' }
            ],
            fire: [
                { position: 0.0, color: '#1a1a1a' },
                { position: 0.3, color: '#b91c1c' },
                { position: 0.7, color: '#f97316' },
                { position: 1.0, color: '#fef08a' }
            ],
            purple_haze: [
                { position: 0.0, color: '#0f0c29' },
                { position: 0.5, color: '#302b63' },
                { position: 0.8, color: '#24243e' },
                { position: 1.0, color: '#6366f1' }
            ],
            golden_hour: [
                { position: 0.0, color: '#2c1810' },
                { position: 0.5, color: '#c2410c' },
                { position: 0.8, color: '#f59e0b' },
                { position: 1.0, color: '#fef3c7' }
            ],
            cool_blues: [
                { position: 0.0, color: '#1e3a8a' },
                { position: 0.5, color: '#3b82f6' },
                { position: 1.0, color: '#dbeafe' }
            ],
            warm_vintage: [
                { position: 0.0, color: '#431407' },
                { position: 0.4, color: '#92400e' },
                { position: 0.7, color: '#d97706' },
                { position: 1.0, color: '#fef3c7' }
            ],
            cyberpunk: [
                { position: 0.0, color: '#000000' },
                { position: 0.3, color: '#7c3aed' },
                { position: 0.6, color: '#ec4899' },
                { position: 1.0, color: '#06b6d4' }
            ],
            autumn: [
                { position: 0.0, color: '#451a03' },
                { position: 0.3, color: '#9a3412' },
                { position: 0.6, color: '#f97316' },
                { position: 0.85, color: '#fbbf24' },
                { position: 1.0, color: '#fef3c7' }
            ]
        };
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl, this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            console.error('Shader compilation failed, skipping program creation.');
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return {r, g, b};
    }

    setupEventListeners() {
        // Image upload
        document.getElementById('imageUpload').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0]);
        });

        // Depth texture upload
        const depthUploadEl = document.getElementById('depthUpload');
        if (depthUploadEl) {
            depthUploadEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            this.setupDepthTexture(img);
                            // Auto-enable use depth texture if SSAO is active
                            if (this.shaderParams.ssao) {
                                this.shaderParams.ssao.useDepthTexture = 1.0;
                                // Update toggle if visible
                                const toggle = document.querySelector('[data-param="useDepthTexture"]');
                                if (toggle) toggle.checked = true;
                            }
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Normal map upload
        const normalUploadEl = document.getElementById('normalUpload');
        if (normalUploadEl) {
            normalUploadEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            this.setupNormalTexture(img);
                            // Auto-enable use normal texture if applicable shader is active
                            if (this.shaderParams.normal_map_view) {
                                this.shaderParams.normal_map_view.useNormalTexture = 1.0;
                                // Update toggle if visible
                                const toggle = document.querySelector('[data-param="useNormalTexture"]');
                                if (toggle) toggle.checked = true;
                            }
                            if (this.shaderParams.geometric_depth_enhance) {
                                this.shaderParams.geometric_depth_enhance.useNormalTexture = 1.0;
                            }
                        };
                        img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Gaussian JSON upload
        const gaussianUploadEl = document.getElementById('gaussianUpload');
        if (gaussianUploadEl) {
            gaussianUploadEl.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            this.gaussianData = JSON.parse(e.target.result);
                            console.log(`Loaded ${this.gaussianData.num_gaussians} Gaussians`);
                            
                            // Show notification
                            const notification = document.createElement('div');
                            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #10b981, #3b82f6); color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; font-weight: 600;';
                            notification.textContent = `✓ Loaded ${this.gaussianData.num_gaussians.toLocaleString()} Gaussians`;
                            document.body.appendChild(notification);
                            setTimeout(() => notification.remove(), 3000);
                        } catch (error) {
                            console.error('Error parsing Gaussian JSON:', error);
                            alert('Error loading Gaussian data: ' + error.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });
        }
        
        // Gaussian viewer button
        const gaussianViewerBtn = document.querySelector('.gaussian-viewer-btn');
        if (gaussianViewerBtn) {
            gaussianViewerBtn.addEventListener('click', () => {
                if (!this.gaussianData) {
                    alert('Please upload a Gaussians JSON file first!');
                    return;
                }
                this.gaussianMode = !this.gaussianMode;
                
                if (this.gaussianMode) {
                    gaussianViewerBtn.style.background = 'linear-gradient(135deg, #059669, #0284c7)';
                    gaussianViewerBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.6)';
                    this.canvas.style.cursor = 'grab';
                } else {
                    gaussianViewerBtn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';
                    gaussianViewerBtn.style.boxShadow = 'none';
                    this.canvas.style.cursor = 'default';
                }
            });
        }

        // Effect buttons - add to stack
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shader = e.target.dataset.shader;
                // Skip if no shader defined (e.g., Gaussian viewer button)
                if (shader) {
                    this.addShaderToStack(shader);
                }
            });
        });

        // Clear stack button
        document.getElementById('clearStackBtn').addEventListener('click', () => {
            this.clearStack();
        });

        // ── Output resolution ──────────────────────────────────────────────────
        const outputRes = document.getElementById('outputResolution');
        if (outputRes) {
            outputRes.addEventListener('change', (e) => {
                this.outputResolution = e.target.value;
            });
        }

        // ── Preview fidelity ───────────────────────────────────────────────────
        const fidelityEl = document.getElementById('previewFidelity');
        if (fidelityEl) {
            fidelityEl.addEventListener('change', (e) => {
                this.previewFidelity = e.target.value;
                if (this.image) {
                    this.resize();
                    this.renderOnce();
                }
            });
        }

        // ── Global gamma ───────────────────────────────────────────────────────
        const globalGammaEl = document.getElementById('globalGamma');
        if (globalGammaEl) {
            globalGammaEl.addEventListener('input', (e) => {
                this.globalGamma = parseFloat(e.target.value) || 2.2;
            });
        }

        // ── Theme toggle ───────────────────────────────────────────────────────
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const root = document.documentElement;
                const current = root.dataset.theme || 'auto';
                const next = current === 'auto' ? 'dark'
                           : current === 'dark' ? 'light'
                           : 'auto';
                root.dataset.theme = next;
                this.currentTheme = next;
            });
        }

        // ── Save / Load stack ──────────────────────────────────────────────────
        const saveBtn = document.getElementById('saveStackBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.exportStack());
        }

        const loadFile = document.getElementById('loadStackFile');
        if (loadFile) {
            loadFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            this.importStack(JSON.parse(ev.target.result));
                        } catch (err) {
                            alert('Could not parse stack file: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                    // Reset so the same file can be loaded again
                    e.target.value = '';
                }
            });
        }

        // ── Picker tab switching ───────────────────────────────────────────────
        document.querySelectorAll('.ptab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = 'ptab-' + tab.dataset.tab;

                document.querySelectorAll('.ptab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                document.querySelectorAll('.ppanel').forEach(p => {
                    p.classList.remove('active');
                });

                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const panel = document.getElementById(targetId);
                if (panel) panel.classList.add('active');
            });
        });

        // Download buttons
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadImage('image/png');
        });

        const downloadJpgBtn = document.getElementById('downloadJpgBtn');
        if (downloadJpgBtn) {
            downloadJpgBtn.addEventListener('click', () => {
                this.downloadImage('image/jpeg', 0.92);
            });
        }

        // Reset button (Now resets all layers' parameters)
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetAllLayersParams();
        });
        
        // Fit button
        document.getElementById('fitBtn').addEventListener('click', () => {
            this.resetZoomPan();
        });
        
        // Zoom and pan controls
        const canvasWrapper = document.getElementById('canvasWrapper');
        
        // Mouse wheel zoom (or camera distance in Gaussian mode)
        canvasWrapper.addEventListener('wheel', (e) => {
            if (!this.canvas.classList.contains('visible')) return;
            e.preventDefault();
            
            if (this.gaussianMode) {
                // Adjust camera distance
                const delta = e.deltaY > 0 ? 1.1 : 0.9;
                this.cameraDistance = Math.max(0.5, Math.min(10, this.cameraDistance * delta));
            } else {
                // Normal zoom
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.max(0.1, Math.min(10, this.zoom * delta));
                
                // Zoom towards mouse position
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const scaleFactor = newZoom / this.zoom;
                this.panX = mouseX - (mouseX - this.panX) * scaleFactor;
                this.panY = mouseY - (mouseY - this.panY) * scaleFactor;
                
                this.zoom = newZoom;
                this.updateCanvasTransform();
            }
        });
        
        // Pan with mouse drag (or rotate in Gaussian mode)
        canvasWrapper.addEventListener('mousedown', (e) => {
            if (!this.canvas.classList.contains('visible')) return;
            
            if (this.gaussianMode) {
                this.isRotating = true;
                this.canvas.style.cursor = 'grabbing';
                this.lastRotateX = e.clientX;
                this.lastRotateY = e.clientY;
            } else {
                this.isPanning = true;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
            }
        });
        
        canvasWrapper.addEventListener('mousemove', (e) => {
            if (this.gaussianMode && this.isRotating) {
                const dx = e.clientX - this.lastRotateX;
                const dy = e.clientY - this.lastRotateY;
                
                this.cameraRotationY += dx * 0.01;
                this.cameraRotationX += dy * 0.01;
                
                // Clamp X rotation to prevent flipping
                this.cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotationX));
                
                this.lastRotateX = e.clientX;
                this.lastRotateY = e.clientY;
            } else if (this.isPanning) {
                const dx = e.clientX - this.lastPanX;
                const dy = e.clientY - this.lastPanY;
                
                this.panX += dx;
                this.panY += dy;
                
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                
                this.updateCanvasTransform();
            }
        });
        
        canvasWrapper.addEventListener('mouseup', () => {
            this.isPanning = false;
            this.isRotating = false;
            if (this.gaussianMode) {
                this.canvas.style.cursor = 'grab';
            }
        });
        
        canvasWrapper.addEventListener('mouseleave', () => {
            this.isPanning = false;
            this.isRotating = false;
            if (this.gaussianMode) {
                this.canvas.style.cursor = 'grab';
            }
        });
        
        // Drag and drop image upload
        canvasWrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvasWrapper.classList.add('drag-over');
        });
        
        canvasWrapper.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvasWrapper.classList.remove('drag-over');
        });
        
        canvasWrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            canvasWrapper.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.loadImage(files[0]);
            }
        });
    }

    loadImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.setupTexture();
                this.resize();
                document.getElementById('placeholder').classList.add('hidden');
                this.canvas.classList.add('visible');
                this.render();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    setupTexture() {
        const gl = this.gl;

        // Delete old texture if exists
        if (this.texture) {
            gl.deleteTexture(this.texture);
        }

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload the image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        
        // Setup framebuffers for multi-pass rendering
        this.setupFramebuffers();
    }

    setupDepthTexture(depthImage) {
        const gl = this.gl;

        // Delete old depth texture if exists
        if (this.depthTexture) {
            gl.deleteTexture(this.depthTexture);
        }

        this.depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload the depth image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, depthImage);
        
        console.log('Depth texture loaded successfully');
    }

    setupNormalTexture(normalImage) {
        const gl = this.gl;

        // Delete old normal texture if exists
        if (this.normalTexture) {
            gl.deleteTexture(this.normalTexture);
        }

        this.normalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload the normal image
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normalImage);
        
        console.log('Normal texture loaded successfully');
    }

    setupFramebuffers() {
        const gl = this.gl;
        
        // Clean up old framebuffers
        this.framebuffers.forEach(fb => gl.deleteFramebuffer(fb));
        this.fbTextures.forEach(tex => gl.deleteTexture(tex));
        this.framebuffers = [];
        this.fbTextures = [];

        // Create 3 framebuffers: FB[0]/FB[1] ping-pong, FB[2] temp for compose
        for (let i = 0; i < 3; i++) {
            const framebuffer = gl.createFramebuffer();
            const texture = gl.createTexture();
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            
            this.framebuffers.push(framebuffer);
            this.fbTextures.push(texture);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ─── Blend-mode compositing ───────────────────────────────────────────────
    // layerTexture always comes from FB[2] (framebuffer coords)
    // baseTexture is either original image or a previous FB
    renderCompose(baseTexture, layerTexture, outputFB, blendMode, opacity, isBaseOriginal) {
        const gl = this.gl;
        const program = this.programs['_compose'];
        if (!program) return;

        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFB);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(program);

        // Full-screen quad (framebuffer UV convention — no Y flip here)
        const positions = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
        const texCoords = new Float32Array([ 0, 0, 1, 0,  0, 1,  0, 1, 1, 0, 1,1]);

        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const tcBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tcBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const tcLoc = gl.getAttribLocation(program, 'a_texCoord');
        gl.enableVertexAttribArray(tcLoc);
        gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 0, 0);

        // u_image = layer (from FB[2])
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, layerTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

        // u_base = accumulated base
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, baseTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'u_base'), 1);

        const blendModeMap = { normal:0, multiply:1, screen:2, overlay:3,
                               softLight:4, hardLight:5, colorDodge:6, colorBurn:7 };
        gl.uniform1f(gl.getUniformLocation(program, 'u_blendMode'), blendModeMap[blendMode] ?? 0);
        gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opacity);
        gl.uniform1f(gl.getUniformLocation(program, 'u_flipBase'), isBaseOriginal ? 1.0 : 0.0);

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.deleteBuffer(posBuffer);
        gl.deleteBuffer(tcBuffer);
    }

    // ─── Unified render pipeline ──────────────────────────────────────────────
    _renderStack() {
        const enabled = this.shaderStack.filter(s => s.enabled !== false);

        if (enabled.length === 0) {
            this.renderShader('original', this.texture, null, 1.0);
            return;
        }

        // pingIdx: which of FB[0]/FB[1] holds the current accumulated result
        let pingIdx = 0;
        let firstLayer = true;

        enabled.forEach((shader, i) => {
            const isLast        = i === enabled.length - 1;
            const isNormal      = !shader.blendMode || shader.blendMode === 'normal';
            const isFullOpacity = (shader.opacity ?? 1.0) >= 0.9999;
            const needsCompose  = !isNormal || !isFullOpacity;

            const inputTex = firstLayer ? this.texture : this.fbTextures[pingIdx];

            if (needsCompose) {
                // Render shader into temp FB[2]
                this.renderShader(shader.name, inputTex, this.framebuffers[2], shader.intensity ?? 1.0);

                // Compose base + FB[2] → output
                const outputFB = isLast ? null : this.framebuffers[1 - pingIdx];
                this.renderCompose(
                    inputTex,
                    this.fbTextures[2],
                    outputFB,
                    shader.blendMode ?? 'normal',
                    shader.opacity ?? 1.0,
                    firstLayer   // isBaseOriginal
                );
                if (!isLast) pingIdx = 1 - pingIdx;
            } else {
                // Normal blend, full opacity — render directly
                const outputFB = isLast ? null : this.framebuffers[1 - pingIdx];
                this.renderShader(shader.name, inputTex, outputFB, shader.intensity ?? 1.0);
                if (!isLast) pingIdx = 1 - pingIdx;
            }

            firstLayer = false;
        });
    }

    updateCanvasTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }

    resetZoomPan() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.updateCanvasTransform();
    }

    addShaderToStack(shaderName) {
        if (shaderName === 'original') {
            this.clearStack();
            return;
        }
        
        const shaderId = Date.now() + Math.random();
        this.shaderStack.push({
            name: shaderName,
            id: shaderId,
            intensity: 1.0,    // per-shader blend amount passed as u_intensity
            enabled: true,
            blendMode: 'normal',
            opacity: 1.0
        });
        
        this.updateStackUI();
        this.selectShader(shaderId);
    }

    selectShader(id) {
        this.selectedShader = id;
        const shader = this.shaderStack.find(s => s.id === id);

        if (shader) {
            if (shader.name === 'gradient_map') {
                this.showGradientEditor();
                this.showShaderControls(shader.name);
            } else {
                this.hideGradientEditor();
                this.showShaderControls(shader.name);
            }
        }

        // Update selected state on layer cards
        document.querySelectorAll('.layer-card').forEach(card => {
            const isSelected = parseFloat(card.dataset.layerId) === id;
            card.classList.toggle('selected', isSelected);
        });
    }

    showShaderControls(shaderName) {
        const controlsSection = document.getElementById('shaderControls');
        const controlsTitle = document.getElementById('shaderControlsTitle');
        const controlsContainer = document.getElementById('shaderControlsContainer');
        
        controlsTitle.textContent = `${this.formatShaderName(shaderName)} Settings`;
        
        // Define controls for each shader
        const controls = {
            halftone_cmyk: [
                { name: 'intensity',  label: 'Blend',        min: 0,  max: 1,  step: 0.01, default: 1.0, isPerShader: true },
                { name: 'cellSize',   label: 'Cell Size',    min: 0.5,max: 20, step: 0.25, default: 4.0 },
                { name: 'gridNoise',  label: 'Grid Noise',   min: 0,  max: 1,  step: 0.01, default: 0.0 },
                { name: 'softness',   label: 'Softness',     min: 0,  max: 0.5,step: 0.01, default: 0.1 },
                { name: 'gainC',      label: 'Cyan Gain',    min: -1, max: 1,  step: 0.05, default: 0.0 },
                { name: 'gainM',      label: 'Magenta Gain', min: -1, max: 1,  step: 0.05, default: 0.0 },
                { name: 'gainY',      label: 'Yellow Gain',  min: -1, max: 1,  step: 0.05, default: 0.0 },
                { name: 'gainK',      label: 'Black Gain',   min: -1, max: 1,  step: 0.05, default: 0.0 },
                { name: 'floodC',     label: 'Cyan Flood',   min: 0,  max: 0.5,step: 0.01, default: 0.0 },
                { name: 'floodM',     label: 'Magenta Flood',min: 0,  max: 0.5,step: 0.01, default: 0.0 },
                { name: 'floodY',     label: 'Yellow Flood', min: 0,  max: 0.5,step: 0.01, default: 0.0 },
                { name: 'floodK',     label: 'Black Flood',  min: 0,  max: 0.5,step: 0.01, default: 0.0 }
            ],
            signal_emulation: [
                // ── Core
                { name: 'intensity',              label: 'Blend',              min: 0,       max: 1,      step: 0.01, default: 1.0,  isPerShader: true },
                { name: 'signalMode',             label: 'Signal Mode',        type: 'dropdown',    default: 3.0,
                  options: ['RGB', 'Component', 'S-Video', 'Composite', 'RF'] },
                { name: 'gammaIn',                label: 'Gamma',              min: 1.0,     max: 3.0,    step: 0.05, default: 2.2  },
                // ── Bandwidth
                { name: 'lumaBandwidth',          label: 'Luma Bandwidth',     min: 0,       max: 1,      step: 0.01, default: 0.55 },
                { name: 'chromaBandwidthU',       label: 'Chroma BW (I/Pb)',   min: 0,       max: 1,      step: 0.01, default: 0.28 },
                { name: 'chromaBandwidthV',       label: 'Chroma BW (Q/Pr)',   min: 0,       max: 1,      step: 0.01, default: 0.18 },
                { name: 'chromaBandwidthC',       label: 'Chroma BW (C/SV)',   min: 0,       max: 1,      step: 0.01, default: 0.22 },
                // ── Noise
                { name: 'noiseStrength',          label: 'Noise',              min: 0,       max: 1,      step: 0.01, default: 0.04 },
                { name: 'lumaNoiseStrength',      label: 'Luma Noise',         min: 0,       max: 1,      step: 0.01, default: 0.03 },
                { name: 'chromaNoiseStrength',    label: 'Chroma Noise',       min: 0,       max: 1,      step: 0.01, default: 0.05 },
                // ── Distortion
                { name: 'ringingStrength',        label: 'Ringing',            min: 0,       max: 1,      step: 0.01, default: 0.18 },
                { name: 'ringingDistance',        label: 'Ringing Distance',   min: 1,       max: 8,      step: 0.5,  default: 2.0  },
                { name: 'chromaDelayPixels',      label: 'Chroma Delay (px)',  min: -4,      max: 4,      step: 0.25, default: 0.5  },
                { name: 'lumaDelayPixels',        label: 'Luma Delay (px)',    min: -4,      max: 4,      step: 0.25, default: 0.0  },
                { name: 'crosstalkStrength',      label: 'RGB Crosstalk',      min: 0,       max: 1,      step: 0.01, default: 0.1  },
                { name: 'crossColorStrength',     label: 'Cross Color',        min: 0,       max: 1,      step: 0.01, default: 0.12 },
                { name: 'crossLumaStrength',      label: 'Cross Luma',         min: 0,       max: 1,      step: 0.01, default: 0.04 },
                // ── Subcarrier / phase
                { name: 'phaseErrorStrength',     label: 'Phase Error',        min: -3.14,   max: 3.14,   step: 0.01, default: 0.0  },
                { name: 'phaseNoiseStrength',     label: 'Phase Noise',        min: 0,       max: 1,      step: 0.01, default: 0.08 },
                { name: 'subcarrierFrequency',    label: 'Subcarrier Freq',    min: 0.05,    max: 1.0,    step: 0.01, default: 0.35 },
                { name: 'subcarrierPhaseOffset',  label: 'Phase Offset',       min: 0,       max: 6.28,   step: 0.01, default: 0.0  },
                // ── RF specific
                { name: 'rfNoiseStrength',        label: 'RF Noise',           min: 0,       max: 1,      step: 0.01, default: 0.1  },
                { name: 'rfInterferenceStrength', label: 'RF Interference',    min: 0,       max: 1,      step: 0.01, default: 0.08 },
                { name: 'rfTuningError',          label: 'RF Tuning Error',    min: -0.5,    max: 0.5,    step: 0.01, default: 0.0  },
                { name: 'rfGhostingStrength',     label: 'RF Ghosting',        min: 0,       max: 0.5,    step: 0.01, default: 0.04 },
                { name: 'rfBandwidth',            label: 'RF Bandwidth',       min: 0,       max: 1,      step: 0.01, default: 0.5  },
                // ── Geometry
                { name: 'horizontalJitterStrength', label: 'H-Jitter',         min: 0,       max: 5,      step: 0.1,  default: 0.0  }
            ],
            crt_advanced: [
                { name: 'intensity',        label: 'Blend',             min: 0,   max: 1,   step: 0.01, default: 1.0,  isPerShader: true },
                // Geometry
                { name: 'curvature',        label: 'Curvature',         min: 0,   max: 0.5, step: 0.01, default: 0.25 },
                { name: 'vignetteStrength', label: 'Vignette',          min: 0,   max: 2,   step: 0.05, default: 0.55 },
                // Beam
                { name: 'minBeamWidth',     label: 'Beam Width (dark)', min: 0.1, max: 2,   step: 0.05, default: 0.4  },
                { name: 'maxBeamWidth',     label: 'Beam Width (bright)',min: 0.1, max: 3,   step: 0.05, default: 1.1  },
                { name: 'beamSharpness',    label: 'Beam Sharpness',    min: 0.5, max: 8,   step: 0.1,  default: 2.2  },
                { name: 'neighborRadius',   label: 'Beam Radius',       min: 1,   max: 2,   step: 1,    default: 1.0  },
                // Scanline
                { name: 'scanlineStrength', label: 'Scanline Strength', min: 0,   max: 1,   step: 0.01, default: 0.65 },
                // Phosphor
                { name: 'phosphorLayout',   label: 'Phosphor Mode',     type: 'dropdown',    default: 0.0,
                  options: ['Aperture Grille', 'Slot Mask', 'Shadow Mask'] },
                { name: 'phosphorScale',    label: 'Phosphor Scale',    min: 0.25,max: 3,   step: 0.25, default: 1.0  },
                { name: 'maskStrength',     label: 'Mask Strength',     min: 0,   max: 1,   step: 0.01, default: 0.85 },
                // Bloom / halation
                { name: 'bloomStrength',    label: 'Halation Bloom',    min: 0,   max: 1,   step: 0.01, default: 0.25 },
                // Glass
                { name: 'glassBlur',        label: 'Glass Diffusion',   min: 0,   max: 1,   step: 0.01, default: 0.0  },
                // Gamma
                { name: 'gammaIn',          label: 'Gamma In',          min: 1,   max: 3,   step: 0.05, default: 2.2  },
                { name: 'gammaOut',         label: 'Gamma Out',         min: 1,   max: 3,   step: 0.05, default: 2.2  }
            ],
            glitch: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'blockScale', label: 'Block Scale', min: 0, max: 2, step: 0.05, default: 0.5 },
                { name: 'colorInversion', label: 'Color Inversion', min: 0, max: 1, step: 0.01, default: 0.2 },
                { name: 'evolution', label: 'Evolution (Static)', min: 0, max: 100, step: 1, default: 0.0 },
                { name: 'timeMode', label: 'Movement', type: 'dropdown', default: 0.0, options: ['Animated (Auto)', 'Static (Manual)'] }
            ],
            water: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            pixelate: [
                { name: 'intensity', label: 'Pixel Size', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'pixelShape', label: 'Pixel Shape', type: 'tabs', default: 0.0, options: ['Square', 'Hex'] },
                { name: 'sharpness', label: 'Sharpness', min: 0, max: 1, step: 0.05, default: 0.5 }
            ],
            grayscale: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            sepia: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            invert: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            vintage: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            chromatic: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            duotone: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'color1', label: 'Shadow Color', type: 'color', default: [0.2, 0.1, 0.4] },
                { name: 'color2', label: 'Highlight Color', type: 'color', default: [1.0, 0.7, 0.3] },
                { name: 'contrast', label: 'Contrast', min: -0.5, max: 1, step: 0.05, default: 0.0 }
            ],
            swirl: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            fisheye: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            wave: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            kaleidoscope: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'segments', label: 'Mirror Segments', min: 2, max: 24, step: 1, default: 6.0 },
                { name: 'rotation', label: 'Rotation', min: 0, max: 360, step: 5, default: 0.0 },
                { name: 'zoom', label: 'Zoom', min: 0.1, max: 3, step: 0.1, default: 1.0 },
                { name: 'offsetX', label: 'Center X Offset', min: -1, max: 1, step: 0.05, default: 0.0 },
                { name: 'offsetY', label: 'Center Y Offset', min: -1, max: 1, step: 0.05, default: 0.0 }
            ],
            oil: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            emboss: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            edge: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            blur: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            halftone: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'mode', label: 'Pattern Mode', type: 'dropdown', default: 0.0, options: ['Circles', 'Lines', 'Squares', 'Cross'] },
                { name: 'cellSize', label: 'Cell Size', min: 2, max: 32, step: 1, default: 8.0 },
                { name: 'rotation', label: 'Rotation', min: 0, max: 360, step: 1, default: 0.0 },
                { name: 'softness', label: 'Softness', min: 0, max: 0.5, step: 0.01, default: 0.1 },
                { name: 'contrast', label: 'Local Contrast', min: -0.5, max: 1, step: 0.05, default: 0.0 }
            ],
            halftone_cmyk_inverted: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            dithering: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'algorithm', label: 'Algorithm', type: 'dropdown', default: 1.0, options: ['Bayer 2×2', 'Bayer 4×4', 'Bayer 8×8', 'Random', 'Blue Noise', 'Floyd-Steinberg', 'Atkinson', 'Sierra Lite'] },
                { name: 'colorLevels', label: 'Color Levels', min: 2, max: 16, step: 1, default: 2.0 },
                { name: 'spread', label: 'Threshold Spread', min: 0.5, max: 2, step: 0.05, default: 1.0 }
            ],
            film_grain: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'grainSize', label: 'Grain Size', min: 0.5, max: 10, step: 0.1, default: 1.5 },
                { name: 'grainAmount', label: 'Grain Amount', min: 0, max: 1, step: 0.01, default: 0.3 },
                { name: 'clumping', label: 'Grain Clumping', min: 0, max: 1, step: 0.05, default: 0.5 },
                { name: 'scratches', label: 'Film Scratches', min: 0, max: 1, step: 0.01, default: 0.2 },
                { name: 'dust', label: 'Dust & Specs', min: 0, max: 1, step: 0.01, default: 0.2 }
            ],
            lens_distortion: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'distortion', label: 'Distortion', min: -1, max: 1, step: 0.05, default: -0.3 },
                { name: 'dispersion', label: 'Chromatic Dispersion', min: 0, max: 5, step: 0.1, default: 2.0 }
            ],
            vhs: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'tracking', label: 'Tracking Delay', min: 0, max: 10, step: 0.1, default: 1.0 },
                { name: 'vJitter', label: 'Vertical Jitter', min: 0, max: 2, step: 0.1, default: 0.5 },
                { name: 'chromaBleed', label: 'Chroma Blur', min: 0, max: 10, step: 0.1, default: 1.0 },
                { name: 'crosstalk', label: 'NTSC Crosstalk', min: 0, max: 1, step: 0.05, default: 0.5 },
                { name: 'noise', label: 'Tape Static', min: 0, max: 1, step: 0.01, default: 0.3 },
                { name: 'dropout', label: 'Dropouts (White)', min: 0, max: 5, step: 0.1, default: 0.5 }
            ],
            voronoi_stippling: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'cellSize', label: 'Cell Size', min: 2, max: 20, step: 0.5, default: 8.0 },
                { name: 'dotSize', label: 'Dot Size', min: 0.1, max: 1.5, step: 0.05, default: 0.6 },
                { name: 'randomness', label: 'Randomness', min: 0, max: 1, step: 0.05, default: 0.3 }
            ],
            kuwahara: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'radius', label: 'Radius', min: 1, max: 10, step: 1, default: 4.0 }
            ],
            crosshatch: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'lineSpacing', label: 'Line Spacing', min: 2, max: 15, step: 0.5, default: 5.0 },
                { name: 'lineWidth', label: 'Line Width', min: 0.1, max: 2, step: 0.1, default: 0.5 },
                { name: 'angleSeparation', label: 'Angle Separation', min: 15, max: 90, step: 5, default: 45.0 }
            ],
            tritone: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'shadowColor', label: 'Shadows', type: 'color', default: [0.1, 0.15, 0.3] },
                { name: 'midtoneColor', label: 'Midtones', type: 'color', default: [0.9, 0.7, 0.4] },
                { name: 'highlightColor', label: 'Highlights', type: 'color', default: [1.0, 0.95, 0.85] },
                { name: 'shadowRange', label: 'Shadow Spread', min: 0.05, max: 1, step: 0.01, default: 0.4 },
                { name: 'highlightRange', label: 'Highlight Spread', min: 0.05, max: 1, step: 0.01, default: 0.4 },
                { name: 'midtoneBalance', label: 'Midtone Balance', min: -2, max: 2, step: 0.1, default: 0.0 }
            ],
            technicolor: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'fringing', label: 'Fringing Strength', min: 0, max: 5, step: 0.1, default: 1.0 },
                { name: 'redOffset', label: 'Red Alignment', min: -5, max: 5, step: 0.1, default: -1.0 },
                { name: 'greenOffset', label: 'Green Alignment', min: -5, max: 5, step: 0.1, default: 0.0 },
                { name: 'blueOffset', label: 'Blue Alignment', min: -5, max: 5, step: 0.1, default: 1.0 },
                { name: 'dyeDensity', label: 'Dye Density', min: 0.5, max: 3, step: 0.1, default: 1.0 },
                { name: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.05, default: 0.5 },
                { name: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.1, default: 0.8 }
            ],
            oklch_grade: [
                { name: 'intensity',       label: 'Blend',              min: 0,    max: 1,   step: 0.01, default: 1.0,  isPerShader: true },
                { name: 'chromaBoost',     label: 'Chroma (Vibrance)',  min: 0.5,  max: 3.0, step: 0.05, default: 1.3 },
                { name: 'chromaMidpoint',  label: 'Chroma Rolloff',     min: 0.05, max: 0.35,step: 0.01, default: 0.18 },
                { name: 'lightnessGamma',  label: 'Lightness Curve',    min: 0.3,  max: 3.0, step: 0.05, default: 1.0 },
                { name: 'hueShift',        label: 'Hue Shift (deg)',    min: -180, max: 180, step: 1,    default: 0.0 },
                { name: 'warmth',          label: 'Warmth',             min: -1,   max: 1,   step: 0.05, default: 0.0 }
            ],
            color_vector_normalize: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            color_vector_flow: [
                { name: 'intensity',    label: 'Intensity',      min: 0,    max: 1,   step: 0.01, default: 0.5, isPerShader: true },
                { name: 'flowDistance', label: 'Flow Distance',  min: 0.25, max: 10,  step: 0.25, default: 2.0 },
                { name: 'iterations',   label: 'Iterations',     min: 1,    max: 8,   step: 1,    default: 5.0 },
                { name: 'flowAngle',    label: 'Flow Angle (°)', min: -180, max: 180, step: 1,    default: 0.0 }
            ],
            color_vector_curl: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'scale', label: 'Scale', min: 0.1, max: 5, step: 0.1, default: 1.0 }
            ],
            color_vector_divergence: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'scale', label: 'Scale', min: 0.1, max: 5, step: 0.1, default: 1.0 }
            ],
            color_vector_splatting: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'splatDistance', label: 'Splat Distance', min: 0.5, max: 10, step: 0.5, default: 3.0 },
                { name: 'splatSize', label: 'Splat Size', min: 2, max: 20, step: 1, default: 8.0 }
            ],
            filter_red25: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_orange21: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_yellow8: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_green11: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_blue47: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_warming81a: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'strength', label: 'Strength', min: 0, max: 1, step: 0.05, default: 0.5 }
            ],
            filter_cooling82a: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'strength', label: 'Strength', min: 0, max: 1, step: 0.05, default: 0.5 }
            ],
            filter_polarizer: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'angle', label: 'Polarizer Angle', min: 0, max: 6.28, step: 0.1, default: 0 }
            ],
            filter_nd: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'stops', label: 'ND Stops', min: 0, max: 10, step: 0.5, default: 3 }
            ],
            filter_uv_haze: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_infrared: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            filter_didymium: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            gradient_map: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true }
            ],
            ssao: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'radius', label: 'Sample Radius', min: 1, max: 30, step: 1, default: 10.0 },
                { name: 'bias', label: 'Bias', min: 0, max: 0.1, step: 0.005, default: 0.02 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'previewMode', label: 'Preview Mode', type: 'tabs', default: 0,
                  options: ['Apply Effect', 'Show AO Map', 'Show Depth Map'] }
            ],
            depth_of_field: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'focalDepth', label: 'Focal Depth', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'focalRange', label: 'Focal Range', min: 0.01, max: 0.5, step: 0.01, default: 0.2 },
                { name: 'bokehStrength', label: 'Bokeh Strength', min: 1, max: 20, step: 0.5, default: 8.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            tilt_shift: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'focusPosition', label: 'Focus Position', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'focusWidth', label: 'Focus Width', min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
                { name: 'blurStrength', label: 'Blur Strength', min: 1, max: 30, step: 1, default: 10.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            atmospheric_fog: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'fogStart', label: 'Fog Start', min: 0, max: 1, step: 0.01, default: 0.3 },
                { name: 'fogDensity', label: 'Fog Density', min: 0, max: 1, step: 0.01, default: 0.8 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_anaglyph: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'separation', label: 'Eye Separation', min: 0, max: 20, step: 0.5, default: 5.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_peeling: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'minDepth', label: 'Min Depth', min: 0, max: 1, step: 0.01, default: 0.0 },
                { name: 'maxDepth', label: 'Max Depth', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'feather', label: 'Feather', min: 0, max: 0.3, step: 0.01, default: 0.1 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_color_grade: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'colorMix', label: 'Color Mix', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_edge_glow: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'threshold', label: 'Edge Threshold', min: 0, max: 0.5, step: 0.01, default: 0.1 },
                { name: 'glowWidth', label: 'Glow Width', min: 0, max: 5, step: 0.1, default: 2.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_selective_sharpen: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'focusDepth', label: 'Focus Depth', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'focusRange', label: 'Focus Range', min: 0.05, max: 0.5, step: 0.01, default: 0.3 },
                { name: 'sharpness', label: 'Sharpness', min: 0.5, max: 3, step: 0.1, default: 1.5 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_displacement: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'strength', label: 'Displacement Strength', min: 0, max: 20, step: 0.5, default: 5.0 },
                { name: 'angle', label: 'Angle (rad)', min: 0, max: 6.28, step: 0.1, default: 0.785 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_relief: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'lightAngle', label: 'Light Angle (rad)', min: 0, max: 6.28, step: 0.1, default: 0.785 },
                { name: 'lightHeight', label: 'Light Height', min: 0.5, max: 5, step: 0.1, default: 2.0 },
                { name: 'bumpStrength', label: 'Bump Strength', min: 1, max: 20, step: 0.5, default: 5.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_halftone: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'minDotSize', label: 'Min Dot Size', min: 1, max: 10, step: 0.5, default: 3.0 },
                { name: 'maxDotSize', label: 'Max Dot Size', min: 5, max: 30, step: 1, default: 15.0 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            depth_shadow: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'shadowAngle', label: 'Shadow Angle (rad)', min: 0, max: 6.28, step: 0.1, default: 2.356 },
                { name: 'shadowDistance', label: 'Shadow Distance', min: 0, max: 30, step: 1, default: 10.0 },
                { name: 'shadowSoftness', label: 'Shadow Softness', min: 0, max: 1, step: 0.05, default: 0.2 },
                { name: 'useDepthTexture', label: 'Use MiDAS Depth', type: 'toggle', default: 0 },
                { name: 'invertDepth', label: 'Invert Depth', type: 'toggle', default: 0 }
            ],
            sharp_3d_view: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'rotationX', label: 'Rotation X', min: -1.57, max: 1.57, step: 0.01, default: 0.0 },
                { name: 'rotationY', label: 'Rotation Y', min: -1.57, max: 1.57, step: 0.01, default: 0.0 },
                { name: 'zoom', label: 'Zoom', min: 0.5, max: 3.0, step: 0.1, default: 1.0 },
                { name: 'pointSize', label: 'Point Size', min: 0.5, max: 10.0, step: 0.5, default: 2.0 },
                { name: 'useDepthTexture', label: 'Use Depth Map', type: 'toggle', default: 0 }
            ],
            normal_map_view: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'lightAngle', label: 'Light Angle', min: 0, max: 6.28, step: 0.1, default: 0.785 },
                { name: 'lightElevation', label: 'Light Elevation', min: -1.57, max: 1.57, step: 0.1, default: 0.785 },
                { name: 'lightIntensity', label: 'Light Intensity', min: 0, max: 3, step: 0.1, default: 1.0 },
                { name: 'useNormalTexture', label: 'Use Normal Map', type: 'toggle', default: 0 }
            ],
            geometric_depth_enhance: [
                { name: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.5, isPerShader: true },
                { name: 'occlusionStrength', label: 'Occlusion Strength', min: 0, max: 2, step: 0.1, default: 0.8 },
                { name: 'edgeEnhance', label: 'Edge Enhance', min: 0, max: 1, step: 0.1, default: 0.5 },
                { name: 'depthDarken', label: 'Depth Darken', min: 0, max: 1, step: 0.1, default: 0.3 },
                { name: 'useDepthTexture', label: 'Use Depth Map', type: 'toggle', default: 0 },
                { name: 'useNormalTexture', label: 'Use Normal Map', type: 'toggle', default: 0 }
            ],

            // ── NEW 10 SHADERS ──────────────────────────────────────────────
            split_toning: [
                { name: 'intensity',     label: 'Blend',           min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'shadowHue',     label: 'Shadow Hue',      min: 0,   max: 360, step: 1,    default: 200  },
                { name: 'shadowSat',     label: 'Shadow Saturation',min: 0,  max: 1,   step: 0.01, default: 0.6  },
                { name: 'highlightHue',  label: 'Highlight Hue',   min: 0,   max: 360, step: 1,    default: 35   },
                { name: 'highlightSat',  label: 'Highlight Saturation', min: 0, max: 1, step: 0.01, default: 0.5 },
                { name: 'balance',       label: 'Balance',         min: -1,  max: 1,   step: 0.01, default: 0.0  }
            ],
            bloom: [
                { name: 'intensity',  label: 'Blend',          min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'threshold', label: 'Threshold',       min: 0,   max: 1,   step: 0.01, default: 0.6  },
                { name: 'radius',    label: 'Radius (px)',     min: 1,   max: 20,  step: 0.5,  default: 6.0  },
                { name: 'strength',  label: 'Strength',        min: 0,   max: 3,   step: 0.05, default: 1.2  },
                { name: 'tintR',     label: 'Tint R',          min: 0,   max: 1,   step: 0.01, default: 1.0  },
                { name: 'tintG',     label: 'Tint G',          min: 0,   max: 1,   step: 0.01, default: 0.95 },
                { name: 'tintB',     label: 'Tint B',          min: 0,   max: 1,   step: 0.01, default: 0.85 }
            ],
            anamorphic_flare: [
                { name: 'intensity',     label: 'Blend',           min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'threshold',     label: 'Threshold',       min: 0,   max: 1,   step: 0.01, default: 0.7  },
                { name: 'streakLength',  label: 'Streak Length',   min: 1,   max: 40,  step: 0.5,  default: 12.0 },
                { name: 'chromaSpread', label: 'Chroma Spread',   min: 0,   max: 1,   step: 0.01, default: 0.5  },
                { name: 'blueTint',     label: 'Blue Tint',       min: 0,   max: 1,   step: 0.01, default: 0.6  },
                { name: 'streakFalloff', label: 'Falloff',         min: 0.5, max: 5,   step: 0.1,  default: 2.0  }
            ],
            pixel_sort: [
                { name: 'intensity',   label: 'Blend',       min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'threshold',  label: 'Threshold',   min: 0,   max: 1,   step: 0.01, default: 0.3  },
                { name: 'sortMode',   label: 'Sort By',     type: 'dropdown', default: 0.0,
                  options: ['Luminance', 'Hue', 'Saturation'] },
                { name: 'descending', label: 'Direction',   type: 'dropdown', default: 1.0,
                  options: ['Ascending', 'Descending'], values: [0.0, 1.0] }
            ],
            risograph: [
                { name: 'intensity',   label: 'Blend',          min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'dotSize',    label: 'Dot Size (px)',   min: 2,   max: 20,  step: 0.5,  default: 8.0  },
                { name: 'angle1',     label: 'Ink 1 Angle °',  min: 0,   max: 90,  step: 1,    default: 45   },
                { name: 'angle2',     label: 'Ink 2 Angle °',  min: 0,   max: 90,  step: 1,    default: 75   },
                { name: 'ink1R',      label: 'Ink 1 R',        min: 0,   max: 1,   step: 0.01, default: 0.1  },
                { name: 'ink1G',      label: 'Ink 1 G',        min: 0,   max: 1,   step: 0.01, default: 0.1  },
                { name: 'ink1B',      label: 'Ink 1 B',        min: 0,   max: 1,   step: 0.01, default: 0.6  },
                { name: 'ink2R',      label: 'Ink 2 R',        min: 0,   max: 1,   step: 0.01, default: 0.8  },
                { name: 'ink2G',      label: 'Ink 2 G',        min: 0,   max: 1,   step: 0.01, default: 0.15 },
                { name: 'ink2B',      label: 'Ink 2 B',        min: 0,   max: 1,   step: 0.01, default: 0.1  },
                { name: 'paperR',     label: 'Paper R',        min: 0,   max: 1,   step: 0.01, default: 0.97 },
                { name: 'paperG',     label: 'Paper G',        min: 0,   max: 1,   step: 0.01, default: 0.95 },
                { name: 'paperB',     label: 'Paper B',        min: 0,   max: 1,   step: 0.01, default: 0.88 },
                { name: 'regOffsetX', label: 'Mis-reg X (px)', min: -10, max: 10,  step: 0.25, default: 2.0  },
                { name: 'regOffsetY', label: 'Mis-reg Y (px)', min: -10, max: 10,  step: 0.25, default: 1.0  },
                { name: 'grain',      label: 'Paper Grain',    min: 0,   max: 1,   step: 0.01, default: 0.4  }
            ],
            mezzotint: [
                { name: 'intensity',    label: 'Blend',         min: 0,  max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'dotSize',     label: 'Dot Spacing',   min: 1,  max: 16,  step: 0.5,  default: 4.0  },
                { name: 'inkAmount',   label: 'Ink Density',   min: 0,  max: 1,   step: 0.01, default: 0.7  },
                { name: 'contrast',    label: 'Contrast',      min: 0,  max: 1,   step: 0.01, default: 0.4  },
                { name: 'colorAmount', label: 'Color Retention', min: 0, max: 1,  step: 0.01, default: 0.3  }
            ],
            bleach_bypass: [
                { name: 'intensity', label: 'Blend',    min: 0, max: 1, step: 0.01, default: 1.0, isPerShader: true },
                { name: 'bypass',   label: 'Bypass',   min: 0, max: 1, step: 0.01, default: 0.8  },
                { name: 'contrast', label: 'Contrast', min: 0, max: 1, step: 0.01, default: 0.3  }
            ],
            kuwahara_anisotropic: [
                { name: 'intensity',  label: 'Blend',     min: 0, max: 1, step: 0.01, default: 1.0, isPerShader: true },
                { name: 'radius',    label: 'Radius',    min: 1, max: 7, step: 0.5,  default: 4.0  },
                { name: 'sharpness', label: 'Sharpness', min: 1, max: 8, step: 0.5,  default: 4.0  }
            ],
            hue_mask: [
                { name: 'intensity',   label: 'Blend',          min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'targetHue',  label: 'Target Hue °',   min: 0,   max: 360, step: 1,    default: 120  },
                { name: 'bandwidth',  label: 'Bandwidth °',    min: 1,   max: 180, step: 1,    default: 40   },
                { name: 'feather',    label: 'Feather °',      min: 0,   max: 60,  step: 1,    default: 15   },
                { name: 'desat',      label: 'Desaturate Out', min: 0,   max: 1,   step: 0.01, default: 1.0  },
                { name: 'darken',     label: 'Darken Out',     min: 0,   max: 1,   step: 0.01, default: 0.3  }
            ],
            thin_film: [
                { name: 'intensity',   label: 'Blend',          min: 0,   max: 1,   step: 0.01, default: 1.0, isPerShader: true },
                { name: 'thickness',  label: 'Thickness',      min: 0.1, max: 10,  step: 0.1,  default: 3.0  },
                { name: 'ior',        label: 'Refractive Index', min: 1.0, max: 2.5, step: 0.05, default: 1.45 },
                { name: 'lumaWeight', label: 'Luma Modulation', min: 0,   max: 1,   step: 0.01, default: 0.7  },
                { name: 'strength',   label: 'Iridescence',    min: 0,   max: 1,   step: 0.01, default: 0.8  }
            ],

            original: []
        };
        
        const shaderControls = controls[shaderName];

        // Hide the empty state
        const emptyEl = document.getElementById('controlsEmpty');
        if (emptyEl) emptyEl.style.display = 'none';

        if (shaderControls !== undefined) {
            controlsSection.style.display = 'block';
            
            if (shaderControls.length >= 0) {
                // Injected layer-wide controls
                const baseControls = [
                    { name: 'blendMode', label: 'Blend Mode', type: 'dropdown', isPerLayer: true, 
                      options: ['Normal', 'Multiply', 'Screen', 'Overlay', 'Soft Light', 'Hard Light', 'Color Dodge', 'Color Burn'],
                      values:  ['normal', 'multiply', 'screen', 'overlay', 'softLight', 'hardLight', 'colorDodge', 'colorBurn'] 
                    },
                    { name: 'opacity', label: 'Layer Opacity', min: 0, max: 1, step: 0.01, isPerLayer: true, default: 1.0 }
                ];

                const allControls = [...baseControls, ...shaderControls];

                controlsContainer.innerHTML = allControls.map(ctrl => {
                // For per-shader intensity, or per-layer settings, get from shader stack
                let value;
                if (ctrl.isPerLayer) {
                    const shader = this.shaderStack.find(s => s.id === this.selectedShader);
                    if (!shader) value = ctrl.default;
                    else if (ctrl.name === 'blendMode') {
                        // Map string values back to index for dropdown
                        const idx = ctrl.values.indexOf(shader.blendMode ?? 'normal');
                        value = idx === -1 ? 0 : idx;
                    } else {
                        value = shader[ctrl.name] ?? ctrl.default;
                    }
                } else if (ctrl.isPerShader && ctrl.name === 'intensity') {
                    const shader = this.shaderStack.find(s => s.id === this.selectedShader);
                    value = shader ? shader.intensity : ctrl.default;
                } else {
                    const params = this.shaderParams[shaderName];
                    value = params && params[ctrl.name] !== undefined ? params[ctrl.name] : ctrl.default;
                }
                
                // Handle toggle controls
                if (ctrl.type === 'toggle') {
                    const checked = value > 0.5 ? 'checked' : '';
                    return `
                        <div class="control">
                            <label>${ctrl.label}</label>
                            <label class="toggle-switch">
                                <input type="checkbox" 
                                       id="shader_${ctrl.name}" 
                                       data-shader="${shaderName}"
                                       data-param="${ctrl.name}"
                                       ${checked}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    `;
                }
                
                // Handle tab controls
                if (ctrl.type === 'tabs') {
                    const tabButtons = ctrl.options.map((option, idx) => 
                        `<button class="tab-btn ${idx === value ? 'active' : ''}" 
                                data-shader="${shaderName}"
                                data-param="${ctrl.name}"
                                data-value="${idx}">${option}</button>`
                    ).join('');
                    return `
                        <div class="control">
                            <label>${ctrl.label}</label>
                            <div class="tab-selector" id="shader_${ctrl.name}">
                                ${tabButtons}
                            </div>
                        </div>
                    `;
                }

                // Handle color controls
                if (ctrl.type === 'color') {
                    const hex = this.rgbToHex({ r: value[0], g: value[1], b: value[2] });
                    return `
                        <div class="control">
                            <label for="shader_${ctrl.name}">${ctrl.label}</label>
                            <input type="color" 
                                   id="shader_${ctrl.name}" 
                                   class="f-color" 
                                   data-shader="${shaderName}" 
                                   data-param="${ctrl.name}"
                                   value="${hex}">
                        </div>
                    `;
                }
                
                // Handle dropdown controls (select)
                if (ctrl.type === 'dropdown') {
                    const options = ctrl.options.map((option, idx) => 
                        `<option value="${idx}" ${idx === value ? 'selected' : ''}>${option}</option>`
                    ).join('');
                    return `
                        <div class="control">
                            <label for="shader_${ctrl.name}">${ctrl.label}</label>
                            <select id="shader_${ctrl.name}" 
                                    class="f-select" 
                                    data-shader="${shaderName}" 
                                    data-param="${ctrl.name}">
                                ${options}
                            </select>
                        </div>
                    `;
                }
                
                // Derive display precision from step (e.g. 0.25 → 2 decimals, 0.5 → 1, 1 → 0)
                const stepStr   = ctrl.step.toString();
                const dotIdx    = stepStr.indexOf('.');
                const decimals  = dotIdx === -1 ? 0 : stepStr.length - dotIdx - 1;
                const displayValue = value.toFixed(decimals);

                return `
                    <div class="control">
                        <label for="shader_${ctrl.name}">${ctrl.label}</label>
                        <input type="range"
                               id="shader_${ctrl.name}"
                               min="${ctrl.min}"
                               max="${ctrl.max}"
                               step="${ctrl.step}"
                               value="${value}"
                               data-shader="${shaderName}"
                               data-param="${ctrl.name}"
                               data-decimals="${decimals}">
                        <span id="shader_${ctrl.name}_value">${displayValue}</span>
                    </div>
                `;
            }).join('');
            
            // Add event listeners to slider controls
            controlsContainer.querySelectorAll('input[type="range"]').forEach(input => {
                input.addEventListener('input', (e) => {
                    const shader = e.target.dataset.shader;
                    const param = e.target.dataset.param;
                    const value = parseFloat(e.target.value);
                    
                    // Per-layer properties write directly to the stack object
                    if (param === 'opacity' || param === 'intensity') {
                        const stackObj = this.shaderStack.find(s => s.id === this.selectedShader);
                        if (stackObj) stackObj[param] = value;
                    } else {
                        if (!this.shaderParams[shader]) {
                            this.shaderParams[shader] = {};
                        }
                        this.shaderParams[shader][param] = value;
                    }
                    
                    // Update display value
                    const decimals = parseInt(e.target.dataset.decimals ?? '2', 10);
                    const displayValue = value.toFixed(decimals);
                    document.getElementById(`shader_${param}_value`).textContent = displayValue;
                    if (this.image) this.renderOnce();
                });
            });
            
            // Add event listeners to toggle controls
            controlsContainer.querySelectorAll('input[type="checkbox"]').forEach(input => {
                input.addEventListener('change', (e) => {
                    const shader = e.target.dataset.shader;
                    const param = e.target.dataset.param;
                    const value = e.target.checked ? 1.0 : 0.0;
                    
                    if (!this.shaderParams[shader]) {
                        this.shaderParams[shader] = {};
                    }
                    this.shaderParams[shader][param] = value;
                    if (this.image) this.renderOnce();
                });
            });
 
            // Add event listeners to color controls
            controlsContainer.querySelectorAll('input[type="color"]').forEach(input => {
                input.addEventListener('input', (e) => {
                    const shader = e.target.dataset.shader;
                    const param = e.target.dataset.param;
                    const hex = e.target.value;
                    const rgb = this.hexToRgb(hex);
                    
                    if (!this.shaderParams[shader]) {
                        this.shaderParams[shader] = {};
                    }
                    this.shaderParams[shader][param] = [rgb.r, rgb.g, rgb.b];
                    if (this.image) this.renderOnce();
                });
            });
            
            // Add event listeners to tab controls
            controlsContainer.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const shader = e.target.dataset.shader;
                    const param = e.target.dataset.param;
                    const value = parseFloat(e.target.dataset.value);
                    
                    // Update active state
                    const container = e.target.parentElement;
                    container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    if (!this.shaderParams[shader]) {
                        this.shaderParams[shader] = {};
                    }
                    this.shaderParams[shader][param] = value;
                    if (this.image) this.renderOnce();
                });
            });

            // Add event listeners to dropdown controls
            controlsContainer.querySelectorAll('select.f-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const shaderName = e.target.dataset.shader;
                    const param  = e.target.dataset.param;
                    const idx    = parseInt(e.target.value);
                    
                    if (this.selectedShader) {
                        const s = this.shaderStack.find(s => s.id === this.selectedShader);
                        if (!s) return;

                        // Hardcode the blendMode mapping for the injected control
                        if (param === 'blendMode') {
                            const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'softLight', 'hardLight', 'colorDodge', 'colorBurn'];
                            s.blendMode = blendModes[idx];
                            if (this.image) this.renderOnce();
                            return;
                        }

                        if (!this.shaderParams[shaderName]) {
                            this.shaderParams[shaderName] = {};
                        }
                        this.shaderParams[shaderName][param] = idx;
                        if (this.image) this.renderOnce();
                    }
                });
            });
            } else {
                // Shader exists but has no custom controls
                controlsContainer.innerHTML = '<div class="control"><p style=\"color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem;\">This shader uses global intensity control only.</p></div>';
            }

            // Add "Reset to Defaults" button at the bottom of the right panel
            const footer = document.createElement('div');
            footer.className = 'controls-footer';
            footer.innerHTML = `
                <button class="f-btn ghost sm reset-layer-btn" style="width:100%; margin-top: 12px; border-top: 1px solid var(--stroke-1); padding-top: 12px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M1 4v6h6M23 20v-6h-6"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                    </svg>
                    Reset to Defaults
                </button>
            `;
            footer.querySelector('.reset-layer-btn').addEventListener('click', () => {
                if (this.selectedShader) {
                    this.resetLayerParams(this.selectedShader);
                }
            });
            controlsContainer.appendChild(footer);

        } else {
            controlsSection.style.display = 'none';
        }
    }

    resetLayerParams(id) {
        const shader = this.shaderStack.find(s => s.id === id);
        if (!shader) return;

        // Reset basic properties
        shader.intensity = 1.0;
        shader.opacity = 1.0;
        shader.blendMode = 'normal';

        // Reset shader-specific params
        const defaults = this.getDefaultShaderParams();
        if (defaults[shader.name]) {
            this.shaderParams[shader.name] = JSON.parse(JSON.stringify(defaults[shader.name]));
        }

        // Special case for gradient_map
        if (shader.name === 'gradient_map') {
            this.currentGradient = JSON.parse(JSON.stringify(this.getGradientPresets().sunset));
            this.updateGradientUI();
        }

        this.showShaderControls(shader.name);
        this.updateStackUI();
        if (this.image) this.renderOnce();
    }

    resetAllLayersParams() {
        const defaults = this.getDefaultShaderParams();
        
        this.shaderStack.forEach(shader => {
            shader.intensity = 1.0;
            shader.opacity = 1.0;
            shader.blendMode = 'normal';
            
            if (defaults[shader.name]) {
                this.shaderParams[shader.name] = JSON.parse(JSON.stringify(defaults[shader.name]));
            }
        });

        // Reset gradient if any layer is a gradient map
        if (this.shaderStack.some(s => s.name === 'gradient_map')) {
            this.currentGradient = JSON.parse(JSON.stringify(this.getGradientPresets().sunset));
            this.updateGradientUI();
        }

        if (this.selectedShader) {
            const current = this.shaderStack.find(s => s.id === this.selectedShader);
            if (current) this.showShaderControls(current.name);
        }

        this.updateStackUI();
        if (this.image) this.renderOnce();
    }

    removeShaderFromStack(id) {
        this.shaderStack = this.shaderStack.filter(s => s.id !== id);
        this.updateStackUI();
    }

    clearStack() {
        this.shaderStack = [];
        this.selectedShader = null;
        document.getElementById('shaderControls').style.display = 'none';
        document.getElementById('gradientEditor').style.display = 'none';
        const empty = document.getElementById('controlsEmpty');
        if (empty) empty.style.display = '';
        this.updateStackUI();
    }

    moveLayer(fromIndex, toIndex) {
        const item = this.shaderStack.splice(fromIndex, 1)[0];
        this.shaderStack.splice(toIndex, 0, item);
        this.updateStackUI();
    }

    updateStackUI() {
        const stackContainer = document.getElementById('shaderStack');

        if (this.shaderStack.length === 0) {
            stackContainer.innerHTML = `
                <div class="stack-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <p>Pick effects below<br>to build a layer stack</p>
                </div>`;
            return;
        }

        const blendModes = [
            ['normal',    'Normal'],
            ['multiply',  'Multiply'],
            ['screen',    'Screen'],
            ['overlay',   'Overlay'],
            ['softLight', 'Soft Light'],
            ['hardLight', 'Hard Light'],
            ['colorDodge','Color Dodge'],
            ['colorBurn', 'Color Burn']
        ];

        stackContainer.innerHTML = this.shaderStack.map((shader, index) => {
            const enabled    = shader.enabled !== false;
            const isSelected = this.selectedShader === shader.id;

            return `
            <div class="layer-card${isSelected ? ' selected' : ''}${!enabled ? ' disabled' : ''}"
                 draggable="true"
                 data-layer-id="${shader.id}"
                 data-index="${index}">

                <!-- Photoshop Layout: Toggle | Drag | Num | Name | Delete -->
                <label class="layer-toggle" title="${enabled ? 'Disable' : 'Enable'} layer">
                    <input type="checkbox" class="layer-enable-chk" data-layer-id="${shader.id}"${enabled ? ' checked' : ''}>
                    <span class="toggle-track"></span>
                </label>

                <span class="drag-handle" title="Drag to reorder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
                    </svg>
                </span>

                <span class="layer-num">${index + 1}</span>
                <span class="layer-name">${this.formatShaderName(shader.name)}</span>

                <button class="layer-del" data-layer-id="${shader.id}" title="Remove layer">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>`;
        }).join('');

        // ── Drag and drop ──────────────────────────────────────────────────────
        stackContainer.querySelectorAll('.layer-card').forEach(card => {
            card.addEventListener('dragstart', this.handleDragStart.bind(this));
            card.addEventListener('dragend',   this.handleDragEnd.bind(this));
            card.addEventListener('dragover',  this.handleDragOver.bind(this));
            card.addEventListener('drop',      this.handleDrop.bind(this));

            // Click name area → select
            card.querySelector('.layer-name').addEventListener('click', () => {
                this.selectShader(parseFloat(card.dataset.layerId));
            });
        });

        // ── Enable toggles ─────────────────────────────────────────────────────
        stackContainer.querySelectorAll('.layer-enable-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = parseFloat(chk.dataset.layerId);
                const s = this.shaderStack.find(s => s.id === id);
                if (s) {
                    s.enabled = chk.checked;
                    chk.closest('.layer-card').classList.toggle('disabled', !chk.checked);
                }
            });
        });

        // ── Delete buttons ─────────────────────────────────────────────────────
        stackContainer.querySelectorAll('.layer-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeShaderFromStack(parseFloat(btn.dataset.layerId));
            });
        });
    }

    formatShaderName(name) {
        if (!name) return 'Unknown';
        // Handle underscore_case and camelCase
        return name
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    handleDragStart(e) {
        this.draggedLayer = parseInt(e.currentTarget.dataset.index);
        e.currentTarget.classList.add('dragging');
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        this.draggedLayer = null;
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();
        const dropIndex = parseInt(e.currentTarget.dataset.index);
        if (this.draggedLayer !== null && this.draggedLayer !== dropIndex) {
            this.moveLayer(this.draggedLayer, dropIndex);
        }
    }

    resize() {
        if (!this.image) return;

        const imgW = this.image.width;
        const imgH = this.image.height;

        // Determine internal rendering scale based on fidelity setting
        let scale;
        switch (this.previewFidelity) {
            case 'high':
                // Full source resolution — preview exactly matches the export
                scale = 1.0;
                break;
            case 'balanced':
                // Cap at 1920px wide; never upscale
                scale = Math.min(1920 / imgW, 1.0);
                break;
            case 'performance':
            default: {
                // Fit within the visible viewport; never upscale
                const maxWidth  = this.canvas.parentElement.clientWidth - 64;
                const maxHeight = window.innerHeight * 0.8;
                scale = Math.min(maxWidth / imgW, maxHeight / imgH, 1.0);
                break;
            }
        }

        this.canvas.width  = Math.round(imgW * scale);
        this.canvas.height = Math.round(imgH * scale);

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Show source dims; also show internal render size when it differs
        const dimsEl = document.getElementById('canvasDims');
        if (dimsEl) {
            const renderW = this.canvas.width;
            const renderH = this.canvas.height;
            const suffix  = (renderW === imgW && renderH === imgH) ? '' : ' (Preview ' + renderW + 'x' + renderH + ')';
            dimsEl.textContent = imgW + ' × ' + imgH + suffix;
        }

        // Recreate framebuffers at new internal resolution
        this.setupFramebuffers();
    }

    render() {
        if (!this.image || !this.texture) return;

        if (this.gaussianMode && this.gaussianData) {
            this.renderGaussians();
        } else {
            this._renderStack();
        }

        this.animationFrame = requestAnimationFrame(() => this.render());
    }

    renderGaussians() {
        const gl = this.gl;
        const canvas = this.canvas;
        const data = this.gaussianData;
        
        // Clear canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.05, 0.05, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (!data.positions || data.positions.length === 0) {
            return;
        }
        
        // Create camera matrices
        const aspect = canvas.width / canvas.height;
        const fov = 60 * Math.PI / 180;
        
        // Camera view matrix (rotate and translate)
        const cosX = Math.cos(this.cameraRotationX);
        const sinX = Math.sin(this.cameraRotationX);
        const cosY = Math.cos(this.cameraRotationY);
        const sinY = Math.sin(this.cameraRotationY);
        
        // Transform each Gaussian and render as a point
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        
        // Prepare Gaussians with camera transform
        const transformedGaussians = [];
        
        for (let i = 0; i < Math.min(data.positions.length, 50000); i++) {
            const pos = data.positions[i];
            if (!pos || pos.length < 3) continue;
            
            let [x, y, z] = pos;
            
            // Normalize positions (Gaussians are usually in [-1, 1] range)
            // Rotate around Y axis
            let rx = x * cosY - z * sinY;
            let rz = x * sinY + z * cosY;
            
            // Rotate around X axis
            let ry = y * cosX - rz * sinX;
            rz = y * sinX + rz * cosX;
            
            // Apply camera distance
            rz += this.cameraDistance;
            
            // Skip if behind camera
            if (rz <= 0) continue;
            
            // Perspective projection
            const scale = (1 / (rz * 0.5)) * Math.min(canvas.width, canvas.height) * 0.3;
            const screenX = (rx * scale + canvas.width / 2);
            const screenY = (ry * scale + canvas.height / 2);
            
            // Get color
            const color = data.colors && data.colors[i] ? data.colors[i] : [1, 1, 1];
            const opacity = data.opacities && data.opacities[i] ? data.opacities[i] : 1.0;
            
            // Get scale (size)
            const sizes = data.scales && data.scales[i] ? data.scales[i] : [0.01, 0.01, 0.01];
            const avgSize = (sizes[0] + sizes[1] + sizes[2]) / 3;
            const pointSize = Math.max(1, avgSize * scale * 10);
            
            transformedGaussians.push({
                x: screenX,
                y: screenY,
                z: rz,
                r: Math.floor(color[0] * 255),
                g: Math.floor(color[1] * 255),
                b: Math.floor(color[2] * 255),
                opacity: Math.min(1.0, opacity),
                size: pointSize
            });
        }
        
        // Sort by depth (far to near for proper alpha blending)
        transformedGaussians.sort((a, b) => b.z - a.z);
        
        // Render using 2D canvas for simplicity (faster than WebGL point sprites for large counts)
        ctx.fillStyle = 'rgb(13, 13, 26)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Render each Gaussian as a splat
        for (const g of transformedGaussians) {
            if (g.x < -g.size || g.x > canvas.width + g.size || 
                g.y < -g.size || g.y > canvas.height + g.size) {
                continue;
            }
            
            // Create radial gradient for Gaussian falloff
            const gradient = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.size);
            gradient.addColorStop(0, `rgba(${g.r}, ${g.g}, ${g.b}, ${g.opacity})`);
            gradient.addColorStop(0.5, `rgba(${g.r}, ${g.g}, ${g.b}, ${g.opacity * 0.5})`);
            gradient.addColorStop(1, `rgba(${g.r}, ${g.g}, ${g.b}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(g.x - g.size, g.y - g.size, g.size * 2, g.size * 2);
        }
        
        // Draw info overlay
        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`Gaussians: ${transformedGaussians.length.toLocaleString()} / ${data.num_gaussians.toLocaleString()}`, 20, 30);
        ctx.fillText(`Drag: Rotate | Scroll: Zoom`, 20, 50);
        
        // Draw rotation indicator
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width - 50, 50, 30, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
        ctx.beginPath();
        ctx.arc(
            canvas.width - 50 + Math.sin(this.cameraRotationY) * 20,
            50 + Math.sin(this.cameraRotationX) * 20,
            5, 0, Math.PI * 2
        );
        ctx.fill();
    }

    renderShader(shaderName, inputTexture, outputFramebuffer, shaderIntensity = 0.5) {
        const gl = this.gl;
        const program = this.programs[shaderName];

        if (!program) return;

        // Bind output (framebuffer or canvas)
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.useProgram(program);

        // Setup geometry
        const positions = new Float32Array([
            -1, -1,  1, -1,  -1, 1,
            -1, 1,   1, -1,   1, 1
        ]);

        // Check if input is from framebuffer (need to flip Y)
        const isFromFramebuffer = this.fbTextures.includes(inputTexture);
        
        // Use different texture coordinates based on source
        const texCoords = isFromFramebuffer 
            ? new Float32Array([  // Framebuffer texture (flip Y)
                0, 0,  1, 0,  0, 1,
                0, 1,  1, 0,  1, 1
            ])
            : new Float32Array([  // Original image texture
                0, 1,  1, 1,  0, 0,
                0, 0,  1, 1,  1, 0
            ]);

        // Position attribute
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Texture coordinate attribute
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Set uniforms
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        
        const imageLocation = gl.getUniformLocation(program, 'u_image');
        gl.uniform1i(imageLocation, 0);

        // Bind depth texture for depth-based shaders
        const depthShaders = ['ssao', 'depth_of_field', 'tilt_shift', 'atmospheric_fog', 
                             'depth_anaglyph', 'depth_peeling', 'depth_color_grade', 
                             'depth_edge_glow', 'depth_selective_sharpen', 'depth_displacement',
                             'depth_relief', 'depth_halftone', 'depth_shadow', 'sharp_3d_view',
                             'geometric_depth_enhance'];
        if (depthShaders.includes(shaderName) && this.depthTexture) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
            const depthLocation = gl.getUniformLocation(program, 'u_depthTexture');
            gl.uniform1i(depthLocation, 1);
        }

        // Bind normal texture for normal-map shaders
        const normalShaders = ['normal_map_view', 'geometric_depth_enhance'];
        if (normalShaders.includes(shaderName) && this.normalTexture) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, this.normalTexture);
            const normalLocation = gl.getUniformLocation(program, 'u_normalTexture');
            gl.uniform1i(normalLocation, 2);
        }

        const timeLocation = gl.getUniformLocation(program, 'u_time');
        const time = (Date.now() - this.startTime) / 1000 * this.speed;
        gl.uniform1f(timeLocation, time);

        const intensityLocation = gl.getUniformLocation(program, 'u_intensity');
        gl.uniform1f(intensityLocation, shaderIntensity);

        const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

        // Set gradient uniforms for gradient_map shader
        if (shaderName === 'gradient_map' && this.currentGradient) {
            const numStopsLoc = gl.getUniformLocation(program, 'u_numStops');
            gl.uniform1i(numStopsLoc, this.currentGradient.length);
            
            // Set stops and colors
            const stopsLoc = gl.getUniformLocation(program, 'u_stops');
            const colorsLoc = gl.getUniformLocation(program, 'u_colors');
            
            const stops = new Float32Array(8);
            const colors = new Float32Array(24); // 8 stops * 3 components
            
            this.currentGradient.forEach((stop, i) => {
                stops[i] = stop.position;
                const rgb = this.hexToRgb(stop.color);
                colors[i * 3] = rgb.r;
                colors[i * 3 + 1] = rgb.g;
                colors[i * 3 + 2] = rgb.b;
            });
            
            gl.uniform1fv(stopsLoc, stops);
            gl.uniform3fv(colorsLoc, colors);
        }

        // Set shader-specific parameters
        if (this.shaderParams[shaderName]) {
            const params = this.shaderParams[shaderName];
            Object.keys(params).forEach(paramName => {
                const location = gl.getUniformLocation(program, `u_${paramName}`);
                if (location) {
                    const value = params[paramName];
                    // Handle vec3 (arrays) for colors
                    if (Array.isArray(value)) {
                        if (value.length === 3) {
                            gl.uniform3f(location, value[0], value[1], value[2]);
                        }
                    } else {
                        gl.uniform1f(location, value);
                    }
                }
            });
        }

        // Draw
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Cleanup
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);
    }

    downloadImage(format = 'image/png', quality = 1.0) {
        if (!this.canvas.classList.contains('visible')) {
            alert('Please upload an image first');
            return;
        }

        const effectNames = this.shaderStack.length > 0 
            ? this.shaderStack.map(s => s.name).join('-')
            : 'original';

        // Stop animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Store current display size
        const displayWidth = this.canvas.width;
        const displayHeight = this.canvas.height;
        
        // Temporarily resize to original resolution
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Recreate framebuffers at full resolution
        this.setupFramebuffers();
        
        // Render at full resolution
        this.renderOnce();
        
        // Download the image
        const extension = format === 'image/jpeg' ? 'jpg' : 'png';
        this.canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shader-${effectNames}-${Date.now()}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Restore display size
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            
            // Recreate framebuffers at display size
            this.setupFramebuffers();
            
            // Resume animation
            this.render();
        }, format, quality);
    }

    renderOnce() {
        if (!this.image || !this.texture) return;
        this._renderStack();
    }

    reset() {
        // Reset zoom and pan
        this.resetZoomPan();

        // Reset shader parameters to defaults
        this.shaderParams = this.getDefaultShaderParams();

        // Clear shader stack
        this.clearStack();
    }

    // Gradient Editor Methods
    showGradientEditor() {
        document.getElementById('gradientEditor').style.display = 'block';
        const emptyEl = document.getElementById('controlsEmpty');
        if (emptyEl) emptyEl.style.display = 'none';
        this.updateGradientUI();
        this.setupGradientListeners();
    }

    hideGradientEditor() {
        document.getElementById('gradientEditor').style.display = 'none';
    }

    setupGradientListeners() {
        const preset = document.getElementById('gradientPreset');
        const addStop = document.getElementById('addGradientStop');
        const removeStop = document.getElementById('removeGradientStop');
        const flipGradient = document.getElementById('flipGradient');
        const stopPosition = document.getElementById('stopPosition');
        const stopColor = document.getElementById('stopColor');
        const gradientPreview = document.getElementById('gradientPreview');

        // Remove old listeners by cloning
        const newPreset = preset.cloneNode(true);
        preset.replaceWith(newPreset);
        const newAddStop = addStop.cloneNode(true);
        addStop.replaceWith(newAddStop);
        const newRemoveStop = removeStop.cloneNode(true);
        removeStop.replaceWith(newRemoveStop);
        const newFlipGradient = flipGradient.cloneNode(true);
        flipGradient.replaceWith(newFlipGradient);

        // Preset selection
        document.getElementById('gradientPreset').addEventListener('change', (e) => {
            const presetName = e.target.value;
            if (presetName !== 'custom' && this.gradients[presetName]) {
                this.currentGradient = JSON.parse(JSON.stringify(this.gradients[presetName]));
                this.selectedStop = null;
                this.updateGradientUI();
            }
        });

        // Add stop
        document.getElementById('addGradientStop').addEventListener('click', () => {
            if (this.currentGradient.length < 8) {
                const newPos = 0.5;
                // Find color at this position
                const color = this.evaluateGradientAtPosition(newPos);
                this.currentGradient.push({ 
                    position: newPos, 
                    color: this.rgbToHex(color)
                });
                this.currentGradient.sort((a, b) => a.position - b.position);
                document.getElementById('gradientPreset').value = 'custom';
                this.updateGradientUI();
            }
        });

        // Remove stop
        document.getElementById('removeGradientStop').addEventListener('click', () => {
            if (this.selectedStop !== null && this.currentGradient.length > 2) {
                this.currentGradient.splice(this.selectedStop, 1);
                this.selectedStop = null;
                document.getElementById('stopEditor').style.display = 'none';
                document.getElementById('gradientPreset').value = 'custom';
                this.updateGradientUI();
            }
        });

        // Flip gradient
        document.getElementById('flipGradient').addEventListener('click', () => {
            this.currentGradient.forEach(stop => {
                stop.position = 1.0 - stop.position;
            });
            this.currentGradient.sort((a, b) => a.position - b.position);
            this.selectedStop = null;
            document.getElementById('stopEditor').style.display = 'none';
            document.getElementById('gradientPreset').value = 'custom';
            this.updateGradientUI();
        });

        // Stop position change
        stopPosition.addEventListener('input', (e) => {
            if (this.selectedStop !== null) {
                this.currentGradient[this.selectedStop].position = e.target.value / 100;
                this.currentGradient.sort((a, b) => a.position - b.position);
                // Find new index after sort
                this.selectedStop = this.currentGradient.findIndex(s => s.position === e.target.value / 100);
                document.getElementById('stopPositionValue').textContent = e.target.value + '%';
                document.getElementById('gradientPreset').value = 'custom';
                this.updateGradientUI();
            }
        });

        // Stop color change
        stopColor.addEventListener('input', (e) => {
            if (this.selectedStop !== null) {
                this.currentGradient[this.selectedStop].color = e.target.value;
                document.getElementById('gradientPreset').value = 'custom';
                this.updateGradientUI();
            }
        });

        // Click on preview to add stop
        gradientPreview.addEventListener('click', (e) => {
            if (this.currentGradient.length < 8) {
                const rect = e.target.getBoundingClientRect();
                const position = (e.clientX - rect.left) / rect.width;
                const color = this.evaluateGradientAtPosition(position);
                this.currentGradient.push({
                    position: Math.max(0, Math.min(1, position)),
                    color: this.rgbToHex(color)
                });
                this.currentGradient.sort((a, b) => a.position - b.position);
                document.getElementById('gradientPreset').value = 'custom';
                this.updateGradientUI();
            }
        });
    }

    updateGradientUI() {
        const preview = document.getElementById('gradientPreview');
        const stopsContainer = document.getElementById('gradientStops');
        
        // Update preview
        const gradientCSS = this.currentGradient
            .map(stop => `${stop.color} ${stop.position * 100}%`)
            .join(', ');
        preview.style.background = `linear-gradient(to right, ${gradientCSS})`;
        
        // Update stops
        stopsContainer.innerHTML = '';
        this.currentGradient.forEach((stop, index) => {
            const stopEl = document.createElement('div');
            stopEl.className = 'gradient-stop';
            if (this.selectedStop === index) {
                stopEl.classList.add('selected');
            }
            stopEl.style.left = (stop.position * 100) + '%';
            stopEl.style.backgroundColor = stop.color;
            
            stopEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedStop = index;
                this.updateGradientUI();
                // Update stop editor
                const stopEditor = document.getElementById('stopEditor');
                if (stopEditor) {
                    stopEditor.style.display = 'block';
                    document.getElementById('stopPosition').value = Math.round(stop.position * 100);
                    document.getElementById('stopPositionValue').textContent = Math.round(stop.position * 100) + '%';
                    document.getElementById('stopColor').value = stop.color;
                }
            });
            stopsContainer.appendChild(stopEl);
        });

        // Update stop editor with current selection
        const stopEditor = document.getElementById('stopEditor');
        if (stopEditor) {
            if (this.selectedStop !== null && this.currentGradient[this.selectedStop]) {
                stopEditor.style.display = 'block';
                const sel = this.currentGradient[this.selectedStop];
                document.getElementById('stopPosition').value = Math.round(sel.position * 100);
                document.getElementById('stopPositionValue').textContent = Math.round(sel.position * 100) + '%';
                document.getElementById('stopColor').value = sel.color;
            }
        }

        // Trigger re-render if image loaded
        if (this.image) this.renderOnce();
    }

    rgbToHex(rgb) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
    }

    // ── Stack export / import ────────────────────────────────────────────────
    exportStack() {
        const payload = {
            version: 1,
            shaderParams: this.shaderParams,
            gradient: this.currentGradient,
            stack: this.shaderStack.map(s => ({
                name:      s.name,
                intensity: s.intensity,
                enabled:   s.enabled,
                blendMode: s.blendMode,
                opacity:   s.opacity
            }))
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `shader-stack-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importStack(payload) {
        if (!payload || payload.version !== 1) {
            alert('Unrecognised stack file format.');
            return;
        }

        if (payload.shaderParams) {
            this.shaderParams = { ...this.getDefaultShaderParams(), ...payload.shaderParams };
        }

        if (payload.gradient) {
            this.currentGradient = payload.gradient;
        }

        this.shaderStack = (payload.stack || []).map(s => ({
            name:      s.name,
            id:        Date.now() + Math.random(),
            intensity: s.intensity ?? 1.0,
            enabled:   s.enabled   ?? true,
            blendMode: s.blendMode ?? 'normal',
            opacity:   s.opacity   ?? 1.0
        }));

        this.selectedShader = null;
        document.getElementById('shaderControls').style.display = 'none';
        document.getElementById('gradientEditor').style.display = 'none';
        const emptyEl = document.getElementById('controlsEmpty');
        if (emptyEl) emptyEl.style.display = '';
        this.updateStackUI();

        if (this.image) this.renderOnce();
    }
}

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    window.shaderApp = new ShaderPlayground();
});
