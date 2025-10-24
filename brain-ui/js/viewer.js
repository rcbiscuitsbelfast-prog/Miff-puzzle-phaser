/**
 * 3D Viewer with Three.js
 * Handles scene setup, camera, lights, and orbit controls
 */

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
        this.clock = new THREE.Clock();
        this.overlayTime = 0;
        this.matrixCanvas = null;
        this.matrixTexture = null;
        this.matrixCtx = null;
        
        this.init();
        this.setupEventListeners();
        this.initMatrixCanvas();
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
            
            // Add green overlay after adding brain
            this.addGreenOverlay(this.brainModel);
            
            console.log('Brain model loaded successfully');
            return this.brainModel;
        } catch (error) {
            console.error('Error loading brain model:', error);
            throw error;
        }
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

    addGreenOverlay(brainModel) {
        // Clone the brain geometry to create TWO overlays
        brainModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const overlayGeometry = child.geometry.clone();
                
                // LAYER 1: Green glowy shader base
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
                            
                            // Fresnel edge glow
                            float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
                            
                            // Flowing effect
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
                glowMesh.scale.copy(child.scale).multiplyScalar(1.12); // Slightly smaller than matrix layer
                
                this.greenOverlay.push(glowMesh);
                
                if (child.parent) {
                    child.parent.add(glowMesh);
                } else {
                    this.scene.add(glowMesh);
                }
                
                // LAYER 2: Matrix letters on top
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
                matrixMesh.scale.copy(child.scale).multiplyScalar(1.15); // Larger to cover everything
                
                this.matrixOverlay.push(matrixMesh);
                
                if (child.parent) {
                    child.parent.add(matrixMesh);
                } else {
                    this.scene.add(matrixMesh);
                }
            }
        });
        
        console.log('Green glow layer + Matrix letters overlay added');
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
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
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }
}
