/**
 * 3D Viewer with Three.js
 * Handles scene setup, camera, lights, and orbit controls
 */

import { PuzzleShapeGenerator } from './puzzle-shapes.js';

export class BrainViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.brainModel = null;
        this.greenOverlay = [];
        this.matrixOverlay = [];
        this.jigsawPieces = [];
        this.clock = new THREE.Clock();
        this.overlayTime = 0;
        this.matrixCanvas = null;
        this.matrixTexture = null;
        this.matrixCtx = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.puzzleExploded = false;
        this.matrixExploding = false;
        this.matrixExplodeStart = 0;
        this.explosionSpeedMultiplier = 0.6; // Speed control multiplier (default 0.6)
        this.autoRotateSpeed = 1.0; // Spin speed multiplier
        this.greenMelting = false;
        this.greenMeltStart = 0;
        
        // Puzzle configuration: 5x5 grid = 25 pieces (better visibility)
        this.puzzleRows = 5;
        this.puzzleCols = 5;
        this.puzzleGenerator = null;
        
        this.init();
        this.setupEventListeners();
        this.initMatrixCanvas();
        this.initPuzzleGenerator();
        this.setupSpeedControl();
        
        // Initialize dual color palettes AFTER rows/cols are set
        this.leftBrainColors = this.generateColorPalette('warm'); // Reds, oranges, yellows
        this.rightBrainColors = this.generateColorPalette('cool'); // Blues, purples, greens
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera - adjusted for better viewing
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
        this.camera.position.set(0, 0, 6); // Zoomed out significantly to see full puzzle

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Ensure proper depth buffer
        this.renderer.sortObjects = true;
        
        this.container.appendChild(this.renderer.domElement);

        // Orbit Controls - simplified to prevent jittering
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false;  // Disabled - can cause jitter
        this.controls.minDistance = 2.0;
        this.controls.maxDistance = 10;
        this.controls.enablePan = true;
        this.controls.autoRotate = true;      // Enable auto-rotation
        this.controls.autoRotateSpeed = 1.0 * this.autoRotateSpeed;  // Adjustable spin speed
        
        // Limit vertical rotation - prevent looking from underneath
        this.controls.minPolarAngle = 0;           // Top limit
        this.controls.maxPolarAngle = Math.PI / 2; // Horizontal (90 degrees) - can't go below
        
        // Mobile-friendly touch controls
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };

        // Lights
        this.setupLights();
    }

    setupLights() {
        // Ambient light - main illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        this.scene.add(mainLight);

        // Fill light from the side
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);

        // Back light
        const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
        backLight.position.set(0, -3, -3);
        this.scene.add(backLight);
    }

    async loadBrainModel() {
        const loader = new THREE.GLTFLoader();
        
        try {
            console.log('GLTFLoader created, loading brain.glb...');
            const gltf = await new Promise((resolve, reject) => {
                const modelPath = 'public/brain.glb';
                console.log('Loading model from:', modelPath);
                
                loader.load(
                    modelPath,
                    (gltf) => {
                        console.log('Model loaded successfully:', gltf);
                        resolve(gltf);
                    },
                    (progress) => {
                        if (progress.lengthComputable) {
                            const percent = (progress.loaded / progress.total) * 100;
                            const statusEl = document.getElementById('loading-status');
                            if (statusEl) {
                                statusEl.textContent = `Loading: ${percent.toFixed(0)}%`;
                            }
                            if (window.console && console.log) {
                                console.log(`Loading: ${percent.toFixed(0)}%`);
                            }
                        } else {
                            const statusEl = document.getElementById('loading-status');
                            if (statusEl) {
                                statusEl.textContent = `Loading: ${(progress.loaded / 1024 / 1024).toFixed(1)} MB`;
                            }
                        }
                    },
                    (error) => {
                        console.error('GLTFLoader error:', error);
                        reject(error);
                    }
                );
            });

            this.brainModel = gltf.scene;
            
            // Center and scale the model properly
            const box = new THREE.Box3().setFromObject(this.brainModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.5 / maxDim;
            
            this.brainModel.scale.setScalar(scale);
            this.brainModel.position.sub(center.multiplyScalar(scale));
            
            // Apply electrified brain materials
            this.brainModel.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        // Create electrified shader material
                        const originalColor = child.material.color || new THREE.Color(0x888888);
                        
                        // Check if this is a vein/darker area (usually darker materials)
                        const isVein = originalColor.r < 0.3 && originalColor.g < 0.3 && originalColor.b < 0.3;
                        
                        const electricMaterial = new THREE.ShaderMaterial({
                            uniforms: {
                                time: { value: 0 },
                                baseColor: { value: isVein ? new THREE.Color(0x001a33) : new THREE.Color(0x003322) },
                                glowColor: { value: isVein ? new THREE.Color(0x0066ff) : new THREE.Color(0x00ff44) },
                                pulseSpeed: { value: isVein ? 8.0 : 2.0 }, // Veins pulse faster
                                pulseIntensity: { value: isVein ? 0.7 : 0.4 }
                            },
                            vertexShader: `
                                varying vec3 vNormal;
                                varying vec3 vPosition;
                                
                                void main() {
                                    vNormal = normalize(normalMatrix * normal);
                                    vPosition = position;
                                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                }
                            `,
                            fragmentShader: `
                                uniform float time;
                                uniform vec3 baseColor;
                                uniform vec3 glowColor;
                                uniform float pulseSpeed;
                                uniform float pulseIntensity;
                                varying vec3 vNormal;
                                varying vec3 vPosition;
                                
                                void main() {
                                    // Enhanced electric pulsating effect with multiple frequencies
                                    float pulse1 = sin(time * pulseSpeed + vPosition.y * 2.0) * 0.5 + 0.5;
                                    float pulse2 = sin(time * pulseSpeed * 0.7 + vPosition.x * 3.0) * 0.5 + 0.5;
                                    float pulse3 = sin(time * pulseSpeed * 1.3 + vPosition.z * 2.5) * 0.5 + 0.5;
                                    float combinedPulse = (pulse1 + pulse2 + pulse3) / 3.0;
                                    
                                    // Electric wave effect - traveling waves across the surface
                                    float wave1 = sin(vPosition.x * 5.0 + time * pulseSpeed * 2.0) * 0.5 + 0.5;
                                    float wave2 = sin(vPosition.y * 5.0 + time * pulseSpeed * 1.5) * 0.5 + 0.5;
                                    float electricWaves = (wave1 + wave2) / 2.0;
                                    
                                    // Combine pulsation and waves for more dynamic effect
                                    float electricIntensity = (combinedPulse * 0.7 + electricWaves * 0.3);
                                    
                                    // Fresnel for edge glow - stronger for electric effect
                                    vec3 viewDirection = normalize(cameraPosition - vPosition);
                                    float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
                                    
                                    // Electric glow effect - brighter edges
                                    float electricGlow = electricIntensity * pulseIntensity;
                                    electricGlow += fresnel * 0.5; // Stronger edge glow
                                    
                                    // Mix base color with electric glow
                                    vec3 color = mix(baseColor, glowColor, electricGlow);
                                    color += glowColor * fresnel * 0.6; // Enhanced edge glow
                                    
                                    // Add electric sparkle effect
                                    float sparkle = step(0.95, fract(sin(vPosition.x * 100.0 + vPosition.y * 100.0 + time * pulseSpeed * 5.0) * 43758.5453));
                                    color += sparkle * glowColor * 0.5;
                                    
                                    gl_FragColor = vec4(color, 1.0);
                                }
                            `,
                            side: THREE.FrontSide,
                            depthWrite: true,
                            depthTest: true
                        });
                        
                        child.material = electricMaterial;
                        child.userData.electricMaterial = electricMaterial;
                    }
                    
                    // Disable frustum culling to prevent disappearing
                    child.frustumCulled = false;
                    
                    // Ensure mesh updates properly
                    child.matrixAutoUpdate = true;
                }
            });
            
            this.scene.add(this.brainModel);
            
            // Add all overlay layers - but don't let this block model loading
            try {
                this.addOverlays(this.brainModel);
            } catch (overlayError) {
                // Log error but continue - model should still display
                if (window.console && console.error) {
                    console.error('Error creating overlays:', overlayError);
                }
                // Still return the model even if overlays fail
            }
            
            return this.brainModel;
        } catch (error) {
            console.error('Error loading brain model:', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }


    initPuzzleGenerator() {
        // Initialize the puzzle shape generator
        this.puzzleGenerator = new PuzzleShapeGenerator(this.puzzleRows, this.puzzleCols);
        console.log(`Puzzle generator initialized: ${this.puzzleRows}x${this.puzzleCols} = ${this.puzzleRows * this.puzzleCols} pieces`);
    }

    generateColorPalette(type) {
        // Generate color palette for one brain hemisphere
        const colors = [];
        const pieceCount = (this.puzzleRows * this.puzzleCols) / 2; // Half for each side
        
        if (type === 'warm') {
            // Warm colors: reds, oranges, yellows, pinks
            for (let i = 0; i < pieceCount; i++) {
                const hue = (i * 60 / pieceCount) % 60; // 0-60 degrees (red-yellow)
                const saturation = 70 + Math.random() * 20; // 70-90%
                const lightness = 50 + Math.random() * 15;  // 50-65%
                
                const color = this.hslToRgb(hue / 360, saturation / 100, lightness / 100);
                colors.push((color.r << 16) | (color.g << 8) | color.b);
            }
        } else {
            // Cool colors: blues, purples, greens, teals
            for (let i = 0; i < pieceCount; i++) {
                const hue = 180 + (i * 120 / pieceCount); // 180-300 degrees (cyan-purple)
                const saturation = 70 + Math.random() * 20;
                const lightness = 50 + Math.random() * 15;
                
                const color = this.hslToRgb(hue / 360, saturation / 100, lightness / 100);
                colors.push((color.r << 16) | (color.g << 8) | color.b);
            }
        }
        
        return colors;
    }

    generatePuzzleColors(count) {
        // Ensure color palettes are initialized
        if (!this.frontBrainColors || !this.backBrainColors) {
            this.frontBrainColors = this.generateColorPalette('warm');
            this.backBrainColors = this.generateColorPalette('cool');
        }
        
        // Combine front and back brain colors using checkerboard to avoid mirroring
        const colors = [];
        
        // Checkerboard pattern - prevents mirroring on opposite sides
        for (let i = 0; i < count; i++) {
            const row = Math.floor(i / this.puzzleCols);
            const col = i % this.puzzleCols;
            const isWarm = (row + col) % 2 === 0;
            
            if (isWarm) {
                const idx = i % this.frontBrainColors.length;
                colors.push(this.frontBrainColors[idx]);
            } else {
                const idx = i % this.backBrainColors.length;
                colors.push(this.backBrainColors[idx]);
            }
        }
        
        return colors;
    }

    hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    createPuzzlePieceTexture(pieceIndex, color) {
        // Create a canvas for this puzzle piece
        const size = 512; // Texture resolution
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Get the puzzle piece shape path
        const path = this.puzzleGenerator.generatePiecePath(pieceIndex, size, size);
        const path2d = new Path2D(path);
        
        // Fill with color
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fill(path2d);
        
        // Add subtle gradient for depth
        const pieceData = this.puzzleGenerator.getPieceData(pieceIndex);
        const centerX = size / 2;
        const centerY = size / 2;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size * 0.7);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        
        ctx.save();
        ctx.clip(path2d);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        ctx.restore();
        
        // Add edge shadow for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke(path2d);
        
        // Add inner highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke(path2d);
        
        return canvas;
    }

    initMatrixCanvas() {
        // Create canvas for Matrix rain texture
        this.matrixCanvas = document.createElement('canvas');
        this.matrixCanvas.width = 1024;
        this.matrixCanvas.height = 1024;
        this.matrixCtx = this.matrixCanvas.getContext('2d');
        
        // Matrix letters - include MIFF text that appears randomly
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
        this.matrixLetters = letters.split('');
        
        // MIFF branding letters that appear more frequently
        this.miffLetters = ['M', 'I', 'F', 'F'];
        this.miffFrequency = 0.15; // 15% chance to show MIFF letter instead of random
        
        // Small font size for lots of letters
        const fontSize = 12;
        const columns = this.matrixCanvas.width / fontSize;
        
        // Initialize drops
        this.matrixDrops = [];
        for (let i = 0; i < columns; i++) {
            this.matrixDrops[i] = Math.random() * -100;
        }
        
        this.matrixFontSize = fontSize;
        this.matrixColumns = columns;
        
        // Create texture
        this.matrixTexture = new THREE.CanvasTexture(this.matrixCanvas);
        this.matrixTexture.wrapS = THREE.RepeatWrapping;
        this.matrixTexture.wrapT = THREE.RepeatWrapping;
    }

    updateMatrixCanvas() {
        const ctx = this.matrixCtx;
        
        // Fade effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, this.matrixCanvas.width, this.matrixCanvas.height);
        
        // Draw Matrix letters
        ctx.font = this.matrixFontSize + 'px monospace';
        
        for (let i = 0; i < this.matrixDrops.length; i++) {
            // Random letter - sometimes from MIFF
            let text;
            if (Math.random() < this.miffFrequency) {
                // Use MIFF letter
                text = this.miffLetters[Math.floor(Math.random() * this.miffLetters.length)];
            } else {
                // Use random letter
                text = this.matrixLetters[Math.floor(Math.random() * this.matrixLetters.length)];
            }
            
            // Bright green for leading characters
            const y = this.matrixDrops[i] * this.matrixFontSize;
            ctx.fillStyle = '#0F0';
            ctx.fillText(text, i * this.matrixFontSize, y);
            
            // Add trail with fading green
            for (let j = 1; j < 5; j++) {
                const trailY = y - j * this.matrixFontSize;
                if (trailY > 0) {
                    // Also include MIFF letters in trail
                    let trailText;
                    if (Math.random() < this.miffFrequency) {
                        trailText = this.miffLetters[Math.floor(Math.random() * this.miffLetters.length)];
                    } else {
                        trailText = this.matrixLetters[Math.floor(Math.random() * this.matrixLetters.length)];
                    }
                    const alpha = 1 - (j / 5);
                    ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                    ctx.fillText(trailText, i * this.matrixFontSize, trailY);
                }
            }
            
            // Move drop down
            this.matrixDrops[i]++;
            
            // Reset drop
            if (this.matrixDrops[i] * this.matrixFontSize > this.matrixCanvas.height && Math.random() > 0.975) {
                this.matrixDrops[i] = 0;
            }
        }
        
        // Update texture
        if (this.matrixTexture) {
            this.matrixTexture.needsUpdate = true;
        }
    }

    addOverlays(brainModel) {
        // We'll divide the brain into puzzle pieces
        let meshIndex = 0;
        
        brainModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                try {
                    const overlayGeometry = child.geometry.clone();
                
                // LAYER 1: Green glowy shader base (1.22x)
                const glowMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        baseColor: { value: new THREE.Color(0x00ff44) },
                        glowColor: { value: new THREE.Color(0x00ffaa) },
                        opacity: { value: 0.85 } // For fade control
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vec4 worldPos = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPos.xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        uniform vec3 baseColor;
                        uniform vec3 glowColor;
                        uniform float opacity;
                        varying vec3 vNormal;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                            float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
                            float flow = sin(vWorldPosition.y * 3.0 + vWorldPosition.x * 2.0 + time * 2.0) * 0.3 + 0.7;
                            
                            vec3 finalColor = baseColor * flow;
                            finalColor += glowColor * fresnel * 1.5;
                            finalColor = max(finalColor, baseColor * 0.6);
                            
                            gl_FragColor = vec4(finalColor, opacity);
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                    depthTest: true,
                    blending: THREE.NormalBlending
                });
                
                const glowMesh = new THREE.Mesh(overlayGeometry.clone(), glowMaterial);
                glowMesh.position.copy(child.position);
                glowMesh.rotation.copy(child.rotation);
                glowMesh.scale.copy(child.scale).multiplyScalar(1.42); // Increased from 1.22 to 1.32 (10% larger)
                this.greenOverlay.push(glowMesh);
                
                if (child.parent) child.parent.add(glowMesh);
                else this.scene.add(glowMesh);
                
                // LAYER 2: Matrix letters (1.25x)
                const matrixMaterial = new THREE.MeshBasicMaterial({
                    map: this.matrixTexture,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    depthTest: true
                });
                
                const matrixMesh = new THREE.Mesh(overlayGeometry.clone(), matrixMaterial);
                matrixMesh.position.copy(child.position);
                matrixMesh.rotation.copy(child.rotation);
                matrixMesh.scale.copy(child.scale).multiplyScalar(1.45); // Increased from 1.25 to 1.35 (10% larger)
                this.matrixOverlay.push(matrixMesh);
                
                if (child.parent) child.parent.add(matrixMesh);
                else this.scene.add(matrixMesh);
                
                // LAYER 3: Create jigsaw puzzle pieces - use improved method
                // Wrap in try-catch to prevent errors from stopping model display
                try {
                    if (typeof this.createPuzzlePiecesForMesh === 'function') {
                        this.createPuzzlePiecesForMesh(child);
                    }
                } catch (puzzleError) {
                    // Silently continue - puzzle pieces are optional
                    // Model will display without them if needed
                }
                
                } catch (meshError) {
                    // Continue with next mesh if this one fails
                    if (window.console && console.error) {
                        console.error('Error processing mesh:', meshError);
                    }
                }
            }
        });
                
                // Old code removed - now using createPuzzlePiecesForMesh method
                /*
                const totalPieces = this.puzzleRows * this.puzzleCols;
                
                // Generate dual-colored palette (warm left, cool right)
                const colors = this.generatePuzzleColors(totalPieces);
                
                for (let i = 0; i < totalPieces; i++) {
                    const row = Math.floor(i / this.puzzleCols);
                    const col = i % this.puzzleCols;
                    
                    // Create shader material with FULL COVERAGE - no gaps
                    const pieceMaterial = new THREE.ShaderMaterial({
                        uniforms: {
                            time: { value: 0 },
                            pieceColor: { value: new THREE.Color(colors[i]) },
                            pieceRow: { value: row },
                            pieceCol: { value: col },
                            totalRows: { value: this.puzzleRows },
                            totalCols: { value: this.puzzleCols }
                        },
                        vertexShader: `
                            varying vec2 vUv;
                            varying vec3 vWorldPosition;
                            varying vec3 vNormal;
                            
                            void main() {
                                vUv = uv;
                                vNormal = normalize(normalMatrix * normal);
                                
                                // Extrude outward along normal for depth effect
                                vec3 extrudedPosition = position + normal * 0.08; // 0.08 units of depth
                                
                                vec4 worldPos = modelMatrix * vec4(extrudedPosition, 1.0);
                                vWorldPosition = worldPos.xyz;
                                
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(extrudedPosition, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform vec3 pieceColor;
                            uniform float pieceRow;
                            uniform float pieceCol;
                            uniform float totalRows;
                            uniform float totalCols;
                            varying vec3 vWorldPosition;
                            varying vec3 vNormal;
                            
                            void main() {
                                // Map world position to grid - adjusted for brain size
                                vec2 gridPos = (vWorldPosition.xy + 1.5) / 3.0;
                                vec2 gridCoord = gridPos * vec2(totalCols, totalRows);
                                vec2 gridCell = floor(gridCoord);
                                
                                // Determine current cell
                                float currentCol = mod(gridCell.x + totalCols * 10.0, totalCols);
                                float currentRow = mod(gridCell.y + totalRows * 10.0, totalRows);
                                
                                // Only show this piece's region - STRICT matching
                                if (abs(currentCol - pieceCol) > 0.01 || abs(currentRow - pieceRow) > 0.01) {
                                    discard;
                                }
                                
                                // Calculate piece number for display
                                float pieceNumber = pieceRow * totalCols + pieceCol;
                                
                                // Get UV within cell for puzzle piece shape
                                vec2 cellUV = fract(gridCoord);
                                
                                // Create ACTUAL puzzle piece shape with tabs and blanks
                                float puzzleShape = 1.0;
                                
                                // Horizontal tab/blank (top and bottom)
                                float tabSizeH = 0.25;
                                float tabDepthH = 0.15;
                                float distFromMidX = abs(cellUV.x - 0.5);
                                
                                // Top edge - alternate tab/blank based on col
                                if (cellUV.y < tabDepthH && distFromMidX < tabSizeH) {
                                    float tabShape = length(vec2(distFromMidX / tabSizeH, (cellUV.y - tabDepthH) / tabDepthH));
                                    if (mod(pieceCol, 2.0) < 0.5) {
                                        // Tab out
                                        puzzleShape = min(puzzleShape, step(tabShape, 1.0));
                                    } else {
                                        // Blank in
                                        puzzleShape = max(puzzleShape, step(1.0, tabShape));
                                    }
                                }
                                
                                // Bottom edge
                                if (cellUV.y > 1.0 - tabDepthH && distFromMidX < tabSizeH) {
                                    float tabShape = length(vec2(distFromMidX / tabSizeH, (1.0 - cellUV.y - tabDepthH) / tabDepthH));
                                    if (mod(pieceCol + 1.0, 2.0) < 0.5) {
                                        puzzleShape = min(puzzleShape, step(tabShape, 1.0));
                                    } else {
                                        puzzleShape = max(puzzleShape, step(1.0, tabShape));
                                    }
                                }
                                
                                // Vertical tab/blank (left and right)
                                float distFromMidY = abs(cellUV.y - 0.5);
                                
                                // Left edge
                                if (cellUV.x < tabDepthH && distFromMidY < tabSizeH) {
                                    float tabShape = length(vec2((cellUV.x - tabDepthH) / tabDepthH, distFromMidY / tabSizeH));
                                    if (mod(pieceRow, 2.0) < 0.5) {
                                        puzzleShape = min(puzzleShape, step(tabShape, 1.0));
                                    } else {
                                        puzzleShape = max(puzzleShape, step(1.0, tabShape));
                                    }
                                }
                                
                                // Right edge
                                if (cellUV.x > 1.0 - tabDepthH && distFromMidY < tabSizeH) {
                                    float tabShape = length(vec2((1.0 - cellUV.x - tabDepthH) / tabDepthH, distFromMidY / tabSizeH));
                                    if (mod(pieceRow + 1.0, 2.0) < 0.5) {
                                        puzzleShape = min(puzzleShape, step(tabShape, 1.0));
                                    } else {
                                        puzzleShape = max(puzzleShape, step(1.0, tabShape));
                                    }
                                }
                                
                                // Discard pixels outside puzzle shape
                                if (puzzleShape < 0.5) discard;
                                
                                // Add darker edges around the puzzle piece
                                float edgeThickness = 0.04;
                                float edge = 0.0;
                                if (cellUV.x < edgeThickness || cellUV.x > 1.0 - edgeThickness ||
                                    cellUV.y < edgeThickness || cellUV.y > 1.0 - edgeThickness) {
                                    edge = 0.4;
                                }
                                
                                // Lighting for depth effect - simple directional light
                                vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                                float NdotL = max(dot(vNormal, lightDir), 0.0);
                                float lighting = 0.3 + 0.7 * NdotL; // Ambient + diffuse
                                
                                // Add subtle specular highlight for depth (simplified to avoid viewDir issues)
                                float specular = pow(NdotL, 64.0) * 0.2;
                                
                                // Piece color with lighting and depth variations
                                vec3 color = pieceColor;
                                color *= (0.85 + cellUV.x * 0.1 + cellUV.y * 0.1); // Subtle gradient
                                color *= lighting; // Apply lighting
                                color += vec3(specular); // Add specular highlight
                                color = mix(color, vec3(0.1), edge); // Darken edges
                                
                                gl_FragColor = vec4(color, 1.0);
                            }
                        `,
                        transparent: false, // Not transparent - full coverage!
                        side: THREE.DoubleSide,
                        depthWrite: true,
                        depthTest: true
                    });
                    
                    const pieceMesh = new THREE.Mesh(overlayGeometry.clone(), pieceMaterial);
                    pieceMesh.position.copy(child.position);
                    pieceMesh.rotation.copy(child.rotation);
                    pieceMesh.scale.copy(child.scale).multiplyScalar(1.60); // Increased larger for full coverage
                    
                    // Store original transform for restart
                    pieceMesh.userData.originalPosition = pieceMesh.position.clone();
                    pieceMesh.userData.originalRotation = pieceMesh.rotation.clone();
                    pieceMesh.userData.originalScale = pieceMesh.scale.clone();
                    
                    pieceMesh.userData.isPuzzlePiece = true;
                    pieceMesh.userData.pieceIndex = i;
                    pieceMesh.userData.row = row;
                    pieceMesh.userData.col = col;
                    
                    this.jigsawPieces.push(pieceMesh);
                    
                    if (child.parent) child.parent.add(pieceMesh);
                    else this.scene.add(pieceMesh);
                }
            }
        });
        
        console.log(`? 3 overlay layers created:
  - Green glow shader (1.22x scale)
  - Matrix rain letters (1.25x scale) 
  - ${this.jigsawPieces.length} Jigsaw puzzle pieces with proper shapes (1.28x scale)`);
    }

    REMOVE_createPuzzlePiecesForMesh(originalMesh, geometry, meshIndex) {
        // Define 9 puzzle regions with colors
        const puzzleRegions = [
            { color: 0xff6b6b, name: 'Region 1' },
            { color: 0x4ecdc4, name: 'Region 2' },
            { color: 0x95e1d3, name: 'Region 3' },
            { color: 0xf38181, name: 'Region 4' },
            { color: 0xaa96da, name: 'Region 5' },
            { color: 0xfcbad3, name: 'Region 6' },
            { color: 0xffffd2, name: 'Region 7' },
            { color: 0xa8dadc, name: 'Region 8' },
            { color: 0xe63946, name: 'Region 9' }
        ];
        
        // Create 9 puzzle piece overlays for this mesh section
        puzzleRegions.forEach((region, index) => {
            const puzzleMaterial = new THREE.MeshBasicMaterial({
                color: region.color,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                depthWrite: false,
                depthTest: true,
                blending: THREE.NormalBlending
            });
            
            const puzzleMesh = new THREE.Mesh(geometry.clone(), puzzleMaterial);
            puzzleMesh.position.copy(originalMesh.position);
            puzzleMesh.rotation.copy(originalMesh.rotation);
            puzzleMesh.scale.copy(originalMesh.scale).multiplyScalar(1.28); // Top layer
            
            // Store puzzle piece data
            puzzleMesh.userData = {
                isPuzzlePiece: true,
                pieceIndex: this.puzzleOverlay.length,
                isSolved: false,
                originalColor: region.color,
                pulsePhase: Math.random() * Math.PI * 2,
                regionName: region.name
            };
            
            // Only show first puzzle piece initially (solve one at a time)
            if (this.puzzleOverlay.length > 0) {
                puzzleMesh.visible = false;
            }
            
            this.puzzleOverlay.push(puzzleMesh);
            
            if (originalMesh.parent) originalMesh.parent.add(puzzleMesh);
            else this.scene.add(puzzleMesh);
        });
    }


    REMOVE_onPieceClick(piece) {
        if (piece.userData.isSolved) return;
        
        // Mark as solved
        piece.userData.isSolved = true;
        this.piecesSolved++;
        
        // Visual feedback - pulse and fade out
        const startTime = Date.now();
        const duration = 600;
        const originalScale = piece.scale.clone();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                const pulse = 1 + Math.sin(progress * Math.PI * 2) * 0.2;
                piece.scale.copy(originalScale).multiplyScalar(pulse);
                piece.material.opacity = 0.7 * (1 - progress);
                requestAnimationFrame(animate);
            } else {
                piece.visible = false;
                
                // Show next puzzle piece
                if (this.piecesSolved < this.totalPieces) {
                    const nextPiece = this.puzzleOverlay.find(p => !p.userData.isSolved && !p.visible);
                    if (nextPiece) {
                        nextPiece.visible = true;
                    }
                } else {
                    this.onPuzzleComplete();
                }
            }
        };
        
        animate();
        
        console.log(`Puzzle piece ${this.piecesSolved}/${this.totalPieces} solved!`);
        
        // Update counter
        const counter = document.getElementById('piece-counter');
        if (counter) {
            counter.textContent = `${this.piecesSolved}/${this.totalPieces}`;
        }
    }

    REMOVE_onPuzzleComplete() {
        console.log('?? Puzzle Complete!');
        
        // Show completion message
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 255, 68, 0.95);
            color: white;
            padding: 30px 60px;
            border-radius: 20px;
            font-size: 32px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 0 30px rgba(0, 255, 68, 0.8);
            text-align: center;
            animation: pulse 0.5s ease-in-out infinite alternate;
        `;
        message.innerHTML = '?? Brain Puzzle Complete! ??';
        
        document.body.appendChild(message);
        
        // Remove after 3 seconds
        setTimeout(() => {
            message.remove();
        }, 3000);
    }

    REMOVE_handleClick(event) {
        // Calculate mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast to find clicked puzzle pieces
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.puzzlePieces);
        
        if (intersects.length > 0) {
            const piece = intersects[0].object;
            if (piece.userData.isPuzzlePiece && !piece.userData.isSolved) {
                this.onPieceClick(piece);
            }
        }
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Click handler for puzzle pieces
        this.renderer.domElement.addEventListener('click', (event) => this.handleClick(event), false);
        this.renderer.domElement.addEventListener('touchend', (event) => this.handleClick(event), false);
    }
    
    setupSpeedControl() {
        // Wait for DOM to be ready before accessing elements
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initControls());
        } else {
            this.initControls();
        }
    }
    
    initControls() {
        // Explosion speed control
        const speedSlider = document.getElementById('explosion-speed');
        const speedValue = document.getElementById('speed-value');
        
        if (speedSlider && speedValue) {
            speedSlider.addEventListener('input', (e) => {
                this.explosionSpeedMultiplier = parseFloat(e.target.value);
                speedValue.textContent = this.explosionSpeedMultiplier.toFixed(1) + 'x';
                
                // Update existing animations if explosion has started
                if (this.puzzleExploded) {
                    this.jigsawPieces.forEach((piece) => {
                        if (piece.userData.animation) {
                            const originalDuration = piece.userData.animation.originalDuration || piece.userData.animation.duration;
                            piece.userData.animation.originalDuration = originalDuration;
                            piece.userData.animation.duration = originalDuration / this.explosionSpeedMultiplier;
                        }
                    });
                }
            });
        }
        
        // Spin speed control
        const spinSlider = document.getElementById('spin-speed');
        const spinValue = document.getElementById('spin-value');
        
        if (spinSlider && spinValue) {
            spinSlider.addEventListener('input', (e) => {
                this.autoRotateSpeed = parseFloat(e.target.value);
                spinValue.textContent = this.autoRotateSpeed.toFixed(1) + 'x';
                if (this.controls) {
                    this.controls.autoRotateSpeed = 1.0 * this.autoRotateSpeed;
                    if (this.autoRotateSpeed === 0) {
                        this.controls.autoRotate = false;
                    } else {
                        this.controls.autoRotate = true;
                    }
                }
            });
        }
        
        // Puzzle size control
        const puzzleSizeSelect = document.getElementById('puzzle-size');
        if (puzzleSizeSelect) {
            puzzleSizeSelect.addEventListener('change', (e) => {
                const [rows, cols] = e.target.value.split('x').map(Number);
                if (!this.puzzleExploded) {
                    this.changePuzzleSize(rows, cols);
                } else {
                    alert('Please restart the puzzle first to change size.');
                    // Reset to current size
                    puzzleSizeSelect.value = `${this.puzzleRows}x${this.puzzleCols}`;
                }
            });
        }
        
        // Restart button
        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restart();
            });
        }
    }
    
    createPuzzlePiecesForMesh(child) {
        const overlayGeometry = child.geometry.clone();
        const totalPieces = this.puzzleRows * this.puzzleCols;
        const colors = this.generatePuzzleColors(totalPieces);
        
        for (let i = 0; i < totalPieces; i++) {
            const row = Math.floor(i / this.puzzleCols);
            const col = i % this.puzzleCols;
            
            // Create shader material
            const pieceMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    pieceColor: { value: new THREE.Color(colors[i]) },
                    pieceRow: { value: row },
                    pieceCol: { value: col },
                    totalRows: { value: this.puzzleRows },
                    totalCols: { value: this.puzzleCols }
                },
                vertexShader: `
                    varying vec2 vUv;
                    varying vec3 vWorldPosition;
                    varying vec3 vNormal;
                    
                    void main() {
                        vUv = uv;
                        vNormal = normalize(normalMatrix * normal);
                        
                        // Extrude outward along normal for depth effect
                        vec3 extrudedPosition = position + normal * 0.08;
                        
                        vec4 worldPos = modelMatrix * vec4(extrudedPosition, 1.0);
                        vWorldPosition = worldPos.xyz;
                        
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(extrudedPosition, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 pieceColor;
                    uniform float pieceRow;
                    uniform float pieceCol;
                    uniform float totalRows;
                    uniform float totalCols;
                    varying vec3 vWorldPosition;
                    varying vec3 vNormal;
                    
                    void main() {
                        // Map world position to grid
                        vec2 gridPos = (vWorldPosition.xy + 1.5) / 3.0;
                        vec2 gridCoord = gridPos * vec2(totalCols, totalRows);
                        vec2 gridCell = floor(gridCoord);
                        
                        float currentCol = mod(gridCell.x + totalCols * 10.0, totalCols);
                        float currentRow = mod(gridCell.y + totalRows * 10.0, totalRows);
                        
                        if (abs(currentCol - pieceCol) > 0.01 || abs(currentRow - pieceRow) > 0.01) {
                            discard;
                        }
                        
                        vec2 cellUV = fract(gridCoord);
                        
                        // Improved puzzle piece shape with proper Bezier curves for tabs/blanks
                        float puzzleShape = 1.0;
                        float tabSize = 0.25;
                        float tabDepth = 0.2;
                        
                        // Top edge
                        if (cellUV.y < tabDepth) {
                            float distFromMidX = abs(cellUV.x - 0.5);
                            if (distFromMidX < tabSize) {
                                // Create smoother tab/blank using Bezier-like curve
                                float t = (distFromMidX / tabSize);
                                float bezier = t * t * (3.0 - 2.0 * t); // Smoothstep
                                float tabY = bezier * tabDepth;
                                
                                float hasTab = step(0.5, mod(pieceCol, 2.0)); // 1.0 if tab, 0.0 if blank
                                float tabCondition = step(cellUV.y, tabY) * (1.0 - hasTab) + step(tabY, cellUV.y) * hasTab;
                                if (tabCondition < 0.5) discard;
                            }
                        }
                        
                        // Bottom edge
                        if (cellUV.y > 1.0 - tabDepth) {
                            float distFromMidX = abs(cellUV.x - 0.5);
                            if (distFromMidX < tabSize) {
                                float t = (distFromMidX / tabSize);
                                float bezier = t * t * (3.0 - 2.0 * t);
                                float tabY = 1.0 - bezier * tabDepth;
                                
                                float hasTab = step(0.5, mod(pieceCol + 1.0, 2.0));
                                float tabCondition = step(tabY, cellUV.y) * (1.0 - hasTab) + step(cellUV.y, tabY) * hasTab;
                                if (tabCondition < 0.5) discard;
                            }
                        }
                        
                        // Left edge
                        if (cellUV.x < tabDepth) {
                            float distFromMidY = abs(cellUV.y - 0.5);
                            if (distFromMidY < tabSize) {
                                float t = (distFromMidY / tabSize);
                                float bezier = t * t * (3.0 - 2.0 * t);
                                float tabX = bezier * tabDepth;
                                
                                float hasTab = step(0.5, mod(pieceRow, 2.0));
                                float tabCondition = step(tabX, cellUV.x) * (1.0 - hasTab) + step(cellUV.x, tabX) * hasTab;
                                if (tabCondition < 0.5) discard;
                            }
                        }
                        
                        // Right edge
                        if (cellUV.x > 1.0 - tabDepth) {
                            float distFromMidY = abs(cellUV.y - 0.5);
                            if (distFromMidY < tabSize) {
                                float t = (distFromMidY / tabSize);
                                float bezier = t * t * (3.0 - 2.0 * t);
                                float tabX = 1.0 - bezier * tabDepth;
                                
                                float hasTab = step(0.5, mod(pieceRow + 1.0, 2.0));
                                float tabCondition = step(cellUV.x, tabX) * (1.0 - hasTab) + step(tabX, cellUV.x) * hasTab;
                                if (tabCondition < 0.5) discard;
                            }
                        }
                        
                        // Lighting for depth
                        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                        float NdotL = max(dot(vNormal, lightDir), 0.0);
                        float lighting = 0.3 + 0.7 * NdotL;
                        float specular = pow(NdotL, 64.0) * 0.2;
                        
                        // Edges
                        float edgeThickness = 0.04;
                        float edge = 0.0;
                        if (cellUV.x < edgeThickness || cellUV.x > 1.0 - edgeThickness ||
                            cellUV.y < edgeThickness || cellUV.y > 1.0 - edgeThickness) {
                            edge = 0.4;
                        }
                        
                        vec3 color = pieceColor;
                        color *= (0.85 + cellUV.x * 0.1 + cellUV.y * 0.1);
                        color *= lighting;
                        color += vec3(specular);
                        color = mix(color, vec3(0.1), edge);
                        
                        gl_FragColor = vec4(color, 1.0);
                    }
                `,
                transparent: false,
                side: THREE.DoubleSide,
                depthWrite: true,
                depthTest: true
            });
            
            const pieceMesh = new THREE.Mesh(overlayGeometry.clone(), pieceMaterial);
            pieceMesh.position.copy(child.position);
            pieceMesh.rotation.copy(child.rotation);
            pieceMesh.scale.copy(child.scale).multiplyScalar(1.60);
            
            pieceMesh.userData.originalPosition = pieceMesh.position.clone();
            pieceMesh.userData.originalRotation = pieceMesh.rotation.clone();
            pieceMesh.userData.originalScale = pieceMesh.scale.clone();
            
            pieceMesh.userData.isPuzzlePiece = true;
            pieceMesh.userData.pieceIndex = i;
            pieceMesh.userData.row = row;
            pieceMesh.userData.col = col;
            
            this.jigsawPieces.push(pieceMesh);
            
            if (child.parent) child.parent.add(pieceMesh);
            else this.scene.add(pieceMesh);
        }
    }
    
    changePuzzleSize(rows, cols) {
        this.puzzleRows = rows;
        this.puzzleCols = cols;
        this.puzzleGenerator = new PuzzleShapeGenerator(rows, cols);
        
        // Clear existing pieces
        this.jigsawPieces.forEach(piece => {
            if (piece.parent) piece.parent.remove(piece);
            else this.scene.remove(piece);
        });
        this.jigsawPieces = [];
        
        // Regenerate overlays
        if (this.brainModel) {
            this.brainModel.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    this.createPuzzlePiecesForMesh(child);
                }
            });
        }
    }
    
    restart() {
        // Reset explosion state
        this.puzzleExploded = false;
        this.matrixExploding = false;
        this.greenMelting = false;
        
        // Reset green overlay
        this.greenOverlay.forEach(mesh => {
            mesh.visible = true;
            if (mesh.material.uniforms && mesh.material.uniforms.opacity) {
                mesh.material.uniforms.opacity.value = 0.85;
            }
            if (mesh.userData.greenMelt) {
                mesh.position.copy(mesh.userData.greenMelt.startPos);
            }
        });
        
        // Reset matrix overlay
        this.matrixOverlay.forEach(mesh => {
            mesh.visible = true;
            if (mesh.material.opacity !== undefined) {
                mesh.material.opacity = 0.9;
            }
        });
        
        // Reset puzzle pieces
        this.jigsawPieces.forEach(piece => {
            piece.visible = true;
            if (piece.userData.animation) {
                delete piece.userData.animation;
            }
            // Reset position, rotation, scale
            const originalPos = piece.userData.originalPosition || new THREE.Vector3(0, 0, 0);
            const originalRot = piece.userData.originalRotation || new THREE.Euler(0, 0, 0);
            const originalScale = piece.userData.originalScale || new THREE.Vector3(1, 1, 1);
            
            piece.position.copy(originalPos);
            piece.rotation.copy(originalRot);
            piece.scale.copy(originalScale);
            
            if (piece.material.uniforms && piece.material.opacity !== undefined) {
                piece.material.opacity = 1.0;
            }
        });
        
        // Reset camera
        this.camera.position.set(0, 0, 6);
        this.controls.reset();
        
        // Show info panel
        const infoPanel = document.getElementById('info-panel');
        if (infoPanel) {
            infoPanel.style.opacity = '1';
        }
        
        console.log('?? Puzzle restarted!');
    }
    
    handleClick(event) {
        if (this.puzzleExploded) return;
        
        // Calculate mouse position
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = event.clientX || (event.changedTouches && event.changedTouches[0].clientX);
        const y = event.clientY || (event.changedTouches && event.changedTouches[0].clientY);
        
        this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
        
        // Raycast to find clicked puzzle pieces
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.jigsawPieces, true);
        
        if (intersects.length > 0) {
            console.log('Puzzle piece clicked! Exploding all pieces...');
            this.explodeAllPieces();
        }
    }
    
    explodeAllPieces(clickedPiece = null) {
        if (this.puzzleExploded) return;
        this.puzzleExploded = true;
        
        console.log(`?? Exploding ${this.jigsawPieces.length} puzzle pieces!`);
        
        // Store clicked piece for special animation
        this.clickedPiece = clickedPiece;
        
        // Animate each piece flying off screen in random directions
        this.jigsawPieces.forEach((piece, index) => {
            
            // Special animation for the clicked piece
            if (piece === clickedPiece) {
                // Get camera position
                const cameraZ = this.camera.position.z;
                
                const baseDuration = 4000;
                piece.userData.animation = {
                    startTime: Date.now(), // Start immediately
                    duration: baseDuration / this.explosionSpeedMultiplier, // Adjust by speed
                    originalDuration: baseDuration,
                    isClickedPiece: true,
                    startPos: piece.position.clone(),
                    startRot: piece.rotation.clone(),
                    targetPos: new THREE.Vector3(0, 0, cameraZ - 2), // Much closer to camera
                    targetRot: new THREE.Euler(0, 0, 0),
                    startScale: piece.scale.clone(),
                    targetScale: piece.scale.clone().multiplyScalar(20) // Much larger = half screen
                };
                
                console.log('Clicked piece special animation:', {
                    startPos: piece.position,
                    targetPos: piece.userData.animation.targetPos,
                    targetScale: piece.userData.animation.targetScale
                });
                
                return; // Skip normal explosion for clicked piece
            }
            // Random direction (more varied for more pieces)
            const angle = Math.random() * Math.PI * 2;
            const speed = 12 + Math.random() * 8; // Slightly faster for more chaos
            const targetX = Math.cos(angle) * speed;
            const targetY = Math.sin(angle) * speed;
            const targetZ = (Math.random() - 0.5) * speed * 1.2;
            
            // Random rotation (more spinning for dramatic effect)
            const rotX = (Math.random() - 0.5) * 15;
            const rotY = (Math.random() - 0.5) * 15;
            const rotZ = (Math.random() - 0.5) * 15;
            
            // Store animation data with speed control
            const baseDuration = 2500;
            piece.userData.animation = {
                startTime: Date.now() + (index * 50) / this.explosionSpeedMultiplier, // Stagger with speed
                duration: baseDuration / this.explosionSpeedMultiplier, // Adjust duration by speed
                originalDuration: baseDuration, // Store for speed updates
                startPos: piece.position.clone(),
                startRot: piece.rotation.clone(),
                targetPos: new THREE.Vector3(targetX, targetY, targetZ).multiplyScalar(this.explosionSpeedMultiplier), // Speed affects distance too
                targetRot: new THREE.Euler(rotX, rotY, rotZ),
                startScale: piece.scale.clone()
            };
        });
        
        // Hide info panel after explosion starts
        setTimeout(() => {
            const infoPanel = document.getElementById('info-panel');
            if (infoPanel) {
                infoPanel.style.transition = 'opacity 0.5s ease';
                infoPanel.style.opacity = '0';
            }
        }, 500);
        
        // Start green overlay fade-out
        setTimeout(() => {
            this.startGreenOverlayFade();
        }, 3000 / this.explosionSpeedMultiplier);
        
        // Start Matrix explosion after puzzle pieces are done
        setTimeout(() => {
            this.startMatrixExplosion();
        }, 4500 / this.explosionSpeedMultiplier);
    }
    
    startGreenOverlayFade() {
        console.log('?? Starting green overlay fade-out to reveal brain!');
        this.greenMelting = true;
        this.greenMeltStart = Date.now();
        
        // Prepare green overlay meshes for fade
        this.greenOverlay.forEach((mesh) => {
            if (!mesh.userData.greenMelt) {
                mesh.userData.greenMelt = {
                    startPos: mesh.position.clone(),
                    originalOpacity: mesh.material.uniforms ? 0.85 : (mesh.material.opacity || 0.85)
                };
            }
        });
    }
    
    startMatrixExplosion() {
        console.log('?? Starting Matrix code spiral explosion!');
        this.matrixExploding = true;
        this.matrixExplodeStart = Date.now();
        
        // Prepare matrix overlay pieces for spiral explosion
        this.matrixOverlay.forEach((mesh, index) => {
            // Create spiral pattern - different angles and speeds for threads
            const threadAngle = (index * 137.5) * (Math.PI / 180); // Golden angle for distribution
            const spiralSpeed = 8 + Math.random() * 4;
            const spiralRotation = (Math.random() - 0.5) * 20;
            
            mesh.userData.matrixAnim = {
                startPos: mesh.position.clone(),
                startRot: mesh.rotation.clone(),
                angle: threadAngle,
                speed: spiralSpeed,
                rotSpeed: spiralRotation,
                delay: index * 30 // Small delay per thread for cascade effect
            };
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update time
        this.overlayTime = this.clock.getElapsedTime();
        
        // Update electrified brain materials
        if (this.brainModel) {
            this.brainModel.traverse((child) => {
                if (child.isMesh && child.userData.electricMaterial) {
                    child.userData.electricMaterial.uniforms.time.value = this.overlayTime;
                }
            });
        }
        
        // Update green glow shader uniforms
        if (this.greenOverlay) {
            this.greenOverlay.forEach((mesh) => {
                if (mesh.material && mesh.material.uniforms) {
                    mesh.material.uniforms.time.value = this.overlayTime;
                }
            });
        }
        
        // Update Matrix canvas texture
        this.updateMatrixCanvas();
        
        // Update Matrix slow fade
        if (this.matrixExploding) {
            const now = Date.now();
            const elapsed = now - this.matrixExplodeStart;
            const progress = Math.min(elapsed / 3000, 1); // 3s fade
            
            this.matrixOverlay.forEach((mesh) => {
                if (mesh.material.opacity !== undefined) {
                    mesh.material.opacity = 1 - progress;
                }
                
                if (progress >= 1) {
                    mesh.visible = false;
                }
            });
        }
        
        // Update center drip lines
        if (this.centerDripping) {
            const now = Date.now();
            const elapsed = now - this.centerDripStart;
            
            this.centerDripLines.forEach((dripLine) => {
                if (dripLine.userData.dripAnim) {
                    const anim = dripLine.userData.dripAnim;
                    const animElapsed = elapsed - anim.delay;
                    
                    if (animElapsed > 0) {
                        const progress = Math.min(animElapsed / 2000, 1); // 2s drip
                        const easeIn = progress * progress;
                        
                        // Extend downward
                        const length = easeIn * 3;
                        dripLine.scale.y = length;
                        dripLine.position.y = -length / 2;
                        
                        // Fade out
                        const fadeStart = 0.5;
                        if (progress > fadeStart) {
                            const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
                            dripLine.material.opacity = 0.8 * (1 - fadeProgress);
                        }
                        
                        if (progress >= 1) {
                            dripLine.visible = false;
                        }
                    }
                }
            });
        }
        
        // Update green overlay fade animation - simple fade to reveal brain
        if (this.greenMelting) {
            const now = Date.now();
            const elapsed = now - this.greenMeltStart;
            const fadeDuration = 2000 / this.explosionSpeedMultiplier; // 2s fade, adjusted by speed
            const progress = Math.min(elapsed / fadeDuration, 1);
            
            // Simple fade out - all pieces fade simultaneously
            this.greenOverlay.forEach((mesh) => {
                if (mesh.userData.greenMelt) {
                    const anim = mesh.userData.greenMelt;
                    const opacity = anim.originalOpacity * (1 - progress);
                    
                    // Handle shader materials (green overlay uses shader)
                    if (mesh.material.uniforms) {
                        // Simply update the opacity uniform - shader handles it
                        if (mesh.material.uniforms.opacity) {
                            mesh.material.uniforms.opacity.value = opacity;
                        }
                        mesh.material.transparent = opacity < 1.0;
                    } else if (mesh.material.opacity !== undefined) {
                        // For non-shader materials
                        mesh.material.opacity = opacity;
                        mesh.material.transparent = opacity < 1.0;
                    }
                    
                    // Hide when fully faded
                    if (progress >= 1) {
                        mesh.visible = false;
                        console.log('?? Green overlay completely faded - brain is now visible!');
                    }
                }
            });
        }
        
        // Update puzzle piece animations
        if (this.puzzleExploded) {
            const now = Date.now();
            this.jigsawPieces.forEach((piece) => {
                if (piece.userData.animation) {
                    const anim = piece.userData.animation;
                    const elapsed = now - anim.startTime;
                    
                    // REMOVED: if (elapsed < 0) return; // All pieces start immediately!
                    
                    // Update duration if speed changed during animation
                    if (anim.originalDuration && anim.duration !== anim.originalDuration / this.explosionSpeedMultiplier) {
                        anim.duration = anim.originalDuration / this.explosionSpeedMultiplier;
                    }
                    
                    const progress = Math.min(elapsed / anim.duration, 1);
                    
                    // Special animation for clicked piece
                    if (anim.isClickedPiece) {
                        const easeOut = 1 - Math.pow(1 - progress, 2); // Slower ease for clicked piece
                        
                        // Float toward camera
                        piece.position.lerpVectors(anim.startPos, anim.targetPos, easeOut);
                        
                        // Gentle rotation
                        piece.rotation.x = anim.startRot.x + (Math.sin(elapsed * 0.001) * 0.2);
                        piece.rotation.y = anim.startRot.y + (Math.cos(elapsed * 0.0008) * 0.2);
                        piece.rotation.z = anim.startRot.z + (Math.sin(elapsed * 0.0012) * 0.1);
                        
                        // Enlarge to take up half screen
                        const scaleProgress = Math.min(progress * 1.2, 1);
                        piece.scale.lerpVectors(anim.startScale, anim.targetScale, scaleProgress);
                        
                        // Stay fully visible
                        if (piece.material.uniforms) {
                            piece.material.opacity = 1.0;
                        }
                        
                        // Don't hide when done - let it linger
                        return;
                    }
                    
                    // Normal explosion for other pieces
                    const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
                    
                    // Update position
                    piece.position.lerpVectors(anim.startPos, anim.targetPos, easeOut);
                    
                    // Update rotation
                    piece.rotation.x = anim.startRot.x + anim.targetRot.x * easeOut;
                    piece.rotation.y = anim.startRot.y + anim.targetRot.y * easeOut;
                    piece.rotation.z = anim.startRot.z + anim.targetRot.z * easeOut;
                    
                    // Fade out and shrink
                    const fadeProgress = Math.max(0, (progress - 0.5) * 2);
                    if (piece.material.uniforms) {
                        piece.material.opacity = 1 - fadeProgress;
                    }
                    piece.scale.copy(anim.startScale).multiplyScalar(1 - fadeProgress * 0.5);
                    
                    // Hide completely when done
                    if (progress >= 1) {
                        piece.visible = false;
                    }
                }
            });
        }
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }
}
