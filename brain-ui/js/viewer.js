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
        this.greenOverlay = null;
        this.clock = new THREE.Clock();
        this.overlayTime = 0;
        
        this.init();
        this.setupEventListeners();
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


    addGreenOverlay(brainModel) {
        // Clone the brain geometry to create overlay
        brainModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                // Clone geometry
                const overlayGeometry = child.geometry.clone();
                
                // Create green shader material with flowing edge effect
                const overlayMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        baseColor: { value: new THREE.Color(0x00ff44) }, // Vibrant green
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vPosition = position;
                            
                            vec4 worldPos = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPos.xyz;
                            
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        uniform vec3 baseColor;
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            // Calculate view direction for Fresnel effect
                            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                            
                            // Fresnel effect - glow on edges (softer)
                            float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
                            
                            // Flowing effect using position and time
                            float flow = sin(vWorldPosition.y * 3.0 + vWorldPosition.x * 2.0 + time * 2.0) * 0.3 + 0.7;
                            
                            // Keep consistent green - just vary intensity slightly
                            vec3 finalColor = baseColor * flow;
                            
                            // Add bright edge glow (consistent green)
                            finalColor += baseColor * fresnel * 1.5;
                            
                            // Ensure color stays in green spectrum
                            finalColor = max(finalColor, baseColor * 0.6); // Minimum brightness
                            
                            // Full opacity to cover brain completely
                            float alpha = 0.95;
                            
                            gl_FragColor = vec4(finalColor, alpha);
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide, // Render both sides to cover everything
                    depthWrite: false,
                    depthTest: true,
                    blending: THREE.NormalBlending // Normal blending for consistent color
                });
                
                // Create overlay mesh
                const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
                
                // Copy transform from original mesh
                overlayMesh.position.copy(child.position);
                overlayMesh.rotation.copy(child.rotation);
                overlayMesh.scale.copy(child.scale).multiplyScalar(1.05); // Larger to fully cover and stand out
                
                // Store reference for animation
                if (!this.greenOverlay) {
                    this.greenOverlay = [];
                }
                this.greenOverlay.push(overlayMesh);
                
                // Add to parent (or scene if no parent)
                if (child.parent) {
                    child.parent.add(overlayMesh);
                } else {
                    this.scene.add(overlayMesh);
                }
            }
        });
        
        console.log('Green overlay added with flowing edge effects');
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
        
        // Update time for overlay animation
        this.overlayTime = this.clock.getElapsedTime();
        
        // Update green overlay shader uniforms
        if (this.greenOverlay) {
            this.greenOverlay.forEach((overlayMesh) => {
                if (overlayMesh.material && overlayMesh.material.uniforms) {
                    overlayMesh.material.uniforms.time.value = this.overlayTime;
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
