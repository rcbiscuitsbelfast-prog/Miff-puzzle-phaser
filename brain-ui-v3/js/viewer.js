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
        
        // Puzzle configuration: 5x5 grid = 25 pieces
        this.puzzleRows = 5;
        this.puzzleCols = 5;
        this.puzzleGenerator = null;
        
        this.init();
        this.setupEventListeners();
        this.initMatrixCanvas();
        this.initPuzzleGenerator();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera - adjusted for better viewing
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
        this.camera.position.set(0, 0, 3);

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
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 8;
        this.controls.enablePan = true;
        this.controls.autoRotate = false;     // Disabled - can conflict with interaction
        
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
            const gltf = await new Promise((resolve, reject) => {
                loader.load(
                    'public/brain.glb',
                    resolve,
                    (progress) => {
                        const percent = (progress.loaded / progress.total) * 100;
                        console.log(`Loading: ${percent.toFixed(0)}%`);
                    },
                    reject
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
            
            // Fix material properties to prevent flashing/jittering
            this.brainModel.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        // Force opaque rendering (transparency causes z-fighting)
                        child.material.transparent = false;
                        child.material.opacity = 1.0;
                        
                        // Force front-side rendering only
                        child.material.side = THREE.FrontSide;
                        
                        // Ensure proper depth rendering
                        child.material.depthWrite = true;
                        child.material.depthTest = true;
                        
                        // Update material
                        child.material.needsUpdate = true;
                    }
                    
                    // Disable frustum culling to prevent disappearing
                    child.frustumCulled = false;
                    
                    // Ensure mesh updates properly
                    child.matrixAutoUpdate = true;
                }
            });
            
            this.scene.add(this.brainModel);
            
            // Add all overlay layers
            this.addOverlays(this.brainModel);
            
            console.log('Brain model loaded successfully');
            return this.brainModel;
        } catch (error) {
            console.error('Error loading brain model:', error);
            throw error;
        }
    }


    initPuzzleGenerator() {
        // Initialize the puzzle shape generator
        this.puzzleGenerator = new PuzzleShapeGenerator(this.puzzleRows, this.puzzleCols);
        console.log(`Puzzle generator initialized: ${this.puzzleRows}x${this.puzzleCols} = ${this.puzzleRows * this.puzzleCols} pieces`);
    }

    generatePuzzleColors(count) {
        // Generate an array of vibrant, varied colors for puzzle pieces
        const colors = [];
        const hueStep = 360 / count;
        
        for (let i = 0; i < count; i++) {
            const hue = (i * hueStep + Math.random() * 20) % 360;
            const saturation = 60 + Math.random() * 30; // 60-90%
            const lightness = 50 + Math.random() * 20;  // 50-70%
            
            // Convert HSL to RGB
            const color = this.hslToRgb(hue / 360, saturation / 100, lightness / 100);
            colors.push((color.r << 16) | (color.g << 8) | color.b);
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
        
        // Matrix letters
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
        this.matrixLetters = letters.split('');
        
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
            // Random letter
            const text = this.matrixLetters[Math.floor(Math.random() * this.matrixLetters.length)];
            
            // Bright green for leading characters
            const y = this.matrixDrops[i] * this.matrixFontSize;
            ctx.fillStyle = '#0F0';
            ctx.fillText(text, i * this.matrixFontSize, y);
            
            // Add trail with fading green
            for (let j = 1; j < 5; j++) {
                const trailY = y - j * this.matrixFontSize;
                if (trailY > 0) {
                    const trailText = this.matrixLetters[Math.floor(Math.random() * this.matrixLetters.length)];
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
        // We'll divide the brain into 9 puzzle regions (3x3 grid)
        let meshIndex = 0;
        
        brainModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const overlayGeometry = child.geometry.clone();
                
                // LAYER 1: Green glowy shader base (1.22x)
                const glowMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        baseColor: { value: new THREE.Color(0x00ff44) },
                        glowColor: { value: new THREE.Color(0x00ffaa) }
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
                        varying vec3 vNormal;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                            float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
                            float flow = sin(vWorldPosition.y * 3.0 + vWorldPosition.x * 2.0 + time * 2.0) * 0.3 + 0.7;
                            
                            vec3 finalColor = baseColor * flow;
                            finalColor += glowColor * fresnel * 1.5;
                            finalColor = max(finalColor, baseColor * 0.6);
                            
                            gl_FragColor = vec4(finalColor, 0.85);
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
                glowMesh.scale.copy(child.scale).multiplyScalar(1.22);
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
                matrixMesh.scale.copy(child.scale).multiplyScalar(1.25);
                this.matrixOverlay.push(matrixMesh);
                
                if (child.parent) child.parent.add(matrixMesh);
                else this.scene.add(matrixMesh);
                
                // LAYER 3: Create jigsaw puzzle pieces with proper puzzle shapes
                // 5x5 grid = 25 pieces with realistic tabs and blanks
                const totalPieces = this.puzzleRows * this.puzzleCols;
                
                // Generate vibrant colors for puzzle pieces
                const colors = this.generatePuzzleColors(totalPieces);
                
                for (let i = 0; i < totalPieces; i++) {
                    const row = Math.floor(i / this.puzzleCols);
                    const col = i % this.puzzleCols;
                    
                    // Create canvas texture for this puzzle piece with proper jigsaw shape
                    const pieceCanvas = this.createPuzzlePieceTexture(i, colors[i]);
                    const pieceTexture = new THREE.CanvasTexture(pieceCanvas);
                    pieceTexture.needsUpdate = true;
                    
                    // Create shader material that clips to only this piece's region
                    const pieceMaterial = new THREE.ShaderMaterial({
                        uniforms: {
                            puzzleTexture: { value: pieceTexture },
                            pieceRow: { value: row },
                            pieceCol: { value: col },
                            totalRows: { value: this.puzzleRows },
                            totalCols: { value: this.puzzleCols }
                        },
                        vertexShader: `
                            varying vec2 vUv;
                            varying vec3 vWorldPosition;
                            
                            void main() {
                                vUv = uv;
                                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                                vWorldPosition = worldPos.xyz;
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform sampler2D puzzleTexture;
                            uniform float pieceRow;
                            uniform float pieceCol;
                            uniform float totalRows;
                            uniform float totalCols;
                            varying vec3 vWorldPosition;
                            
                            void main() {
                                // Map world position to grid coordinates
                                // Normalize world position to 0-1 range (roughly)
                                vec2 gridPos = (vWorldPosition.xy + 2.0) / 4.0; // Adjust based on brain size
                                
                                // Scale to grid size
                                vec2 gridCoord = gridPos * vec2(totalCols, totalRows);
                                vec2 gridCell = floor(gridCoord);
                                
                                // Check if this fragment belongs to this piece
                                float currentCol = mod(gridCell.x, totalCols);
                                float currentRow = mod(gridCell.y, totalRows);
                                
                                // Discard if not in this piece's cell
                                if (abs(currentCol - pieceCol) > 0.1 || abs(currentRow - pieceRow) > 0.1) {
                                    discard;
                                }
                                
                                // Get UV within this cell for texture lookup
                                vec2 cellUV = fract(gridCoord);
                                vec4 texColor = texture2D(puzzleTexture, cellUV);
                                
                                // Use texture alpha for transparency (puzzle shape)
                                if (texColor.a < 0.1) discard;
                                
                                gl_FragColor = vec4(texColor.rgb, 0.95);
                            }
                        `,
                        transparent: true,
                        side: THREE.DoubleSide,
                        depthWrite: false,
                        depthTest: true
                    });
                    
                    const pieceMesh = new THREE.Mesh(overlayGeometry.clone(), pieceMaterial);
                    pieceMesh.position.copy(child.position);
                    pieceMesh.rotation.copy(child.rotation);
                    pieceMesh.scale.copy(child.scale).multiplyScalar(1.28);
                    
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
        
        console.log(`✅ 3 overlay layers created:
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
        console.log('🎉 Puzzle Complete!');
        
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
        message.innerHTML = '🧠 Brain Puzzle Complete! 🧠';
        
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
    
    explodeAllPieces() {
        if (this.puzzleExploded) return;
        this.puzzleExploded = true;
        
        console.log(`💥 Exploding ${this.jigsawPieces.length} puzzle pieces!`);
        
        // Animate each piece flying off screen in random directions
        this.jigsawPieces.forEach((piece, index) => {
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
            
            // Store animation data with shorter stagger for 25 pieces
            piece.userData.animation = {
                startTime: Date.now() + index * 30, // 30ms stagger (faster than before)
                duration: 1400, // Slightly shorter duration
                startPos: piece.position.clone(),
                startRot: piece.rotation.clone(),
                targetPos: new THREE.Vector3(targetX, targetY, targetZ),
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
        
        // Update puzzle piece animations
        if (this.puzzleExploded) {
            const now = Date.now();
            this.jigsawPieces.forEach((piece) => {
                if (piece.userData.animation) {
                    const anim = piece.userData.animation;
                    const elapsed = now - anim.startTime;
                    
                    if (elapsed < 0) return; // Not started yet
                    
                    const progress = Math.min(elapsed / anim.duration, 1);
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
