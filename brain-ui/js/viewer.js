/**
 * 3D Viewer with Three.js
 * Handles scene setup, camera, lights, and orbit controls
 */

import { routes } from './routes.js';

export class BrainViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.brainModel = null;
        this.puzzlePieces = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredPiece = null;
        this.clock = new THREE.Clock();
        
        // Shader uniforms for animation
        this.shaderTime = 0;
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        // Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;
        this.controls.enablePan = false;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;
        
        // Mobile-friendly touch controls
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };

        // Lights
        this.setupLights();
        
        // Post-processing (optional bloom effect)
        // this.setupPostProcessing();
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        this.scene.add(mainLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x667eea, 0.4);
        fillLight.position.set(-5, 0, -5);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0x764ba2, 0.6);
        rimLight.position.set(0, -5, 0);
        this.scene.add(rimLight);

        // Point light for highlights
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(0, 2, 2);
        this.scene.add(pointLight);
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
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(this.brainModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim;
            
            this.brainModel.scale.setScalar(scale);
            this.brainModel.position.sub(center.multiplyScalar(scale));
            
            // Apply custom materials with shaders to meshes
            this.applyCustomMaterials(this.brainModel);
            
            // Create puzzle pieces overlay
            this.createPuzzlePieces(this.brainModel);
            
            this.scene.add(this.brainModel);
            
            return this.brainModel;
        } catch (error) {
            console.error('Error loading brain model:', error);
            throw error;
        }
    }

    applyCustomMaterials(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                // Store original material
                child.userData.originalMaterial = child.material.clone();
                
                // Create custom shader material
                const customMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        baseColor: { value: new THREE.Color(0xffa07a) },
                        emissive: { value: new THREE.Color(0x000000) },
                        opacity: { value: 1.0 }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        uniform float time;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vPosition = position;
                            
                            // Subtle wave animation
                            vec3 newPosition = position;
                            newPosition.z += sin(position.x * 2.0 + time) * 0.01;
                            
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 baseColor;
                        uniform vec3 emissive;
                        uniform float time;
                        uniform float opacity;
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        
                        void main() {
                            // Animated gradient
                            float gradient = sin(vPosition.y * 2.0 + time * 0.5) * 0.5 + 0.5;
                            vec3 color1 = baseColor;
                            vec3 color2 = baseColor * 1.3;
                            vec3 gradientColor = mix(color1, color2, gradient);
                            
                            // Fresnel effect for rim lighting
                            vec3 viewDirection = normalize(cameraPosition - vPosition);
                            float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
                            
                            vec3 finalColor = gradientColor + emissive + fresnel * 0.3;
                            
                            gl_FragColor = vec4(finalColor, opacity);
                        }
                    `,
                    transparent: true,
                    side: THREE.DoubleSide
                });
                
                child.material = customMaterial;
                child.userData.shaderMaterial = customMaterial;
            }
        });
    }

    createPuzzlePieces(model) {
        // Get bounding box and divide into regions
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Create 9 puzzle piece regions (3x3 grid)
        const pieceIds = Object.keys(routes);
        const gridSize = 3;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const index = i * gridSize + j;
                if (index >= pieceIds.length) break;
                
                const pieceId = pieceIds[index];
                const route = routes[pieceId];
                
                // Create invisible sphere as clickable region
                const geometry = new THREE.SphereGeometry(0.3, 16, 16);
                const material = new THREE.MeshBasicMaterial({
                    color: route.color,
                    transparent: true,
                    opacity: 0,
                    wireframe: false
                });
                
                const piece = new THREE.Mesh(geometry, material);
                
                // Position pieces around the brain
                const angle = (index / pieceIds.length) * Math.PI * 2;
                const radius = size.length() * 0.6;
                piece.position.set(
                    Math.cos(angle) * radius + center.x,
                    (i - 1) * size.y * 0.4 + center.y,
                    Math.sin(angle) * radius + center.z
                );
                
                piece.userData = {
                    pieceId: pieceId,
                    route: route,
                    isPuzzlePiece: true,
                    originalOpacity: 0,
                    hoverOpacity: 0.6,
                    originalColor: route.color
                };
                
                this.puzzlePieces.push(piece);
                this.scene.add(piece);
            }
        }
    }

    setupEventListeners() {
        // Mouse/touch move for raycasting
        const onPointerMove = (event) => {
            const rect = this.renderer.domElement.getBoundingClientRect();
            const x = event.clientX || (event.touches && event.touches[0].clientX);
            const y = event.clientY || (event.touches && event.touches[0].clientY);
            
            this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
            
            this.updateRaycast();
        };

        // Click/tap for navigation
        const onPointerDown = (event) => {
            if (this.hoveredPiece) {
                this.onPieceClick(this.hoveredPiece);
            }
        };

        this.renderer.domElement.addEventListener('mousemove', onPointerMove);
        this.renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true });
        this.renderer.domElement.addEventListener('click', onPointerDown);
        this.renderer.domElement.addEventListener('touchend', onPointerDown);

        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    updateRaycast() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.puzzlePieces);

        // Reset previous hover
        if (this.hoveredPiece && !intersects.find(i => i.object === this.hoveredPiece)) {
            this.onPieceHoverExit(this.hoveredPiece);
            this.hoveredPiece = null;
        }

        // Set new hover
        if (intersects.length > 0) {
            const piece = intersects[0].object;
            if (piece.userData.isPuzzlePiece && piece !== this.hoveredPiece) {
                this.hoveredPiece = piece;
                this.onPieceHoverEnter(piece);
            }
        }
    }

    onPieceHoverEnter(piece) {
        // Glow effect on hover
        piece.material.opacity = piece.userData.hoverOpacity;
        piece.material.emissive = new THREE.Color(piece.userData.originalColor);
        piece.material.emissiveIntensity = 0.5;
        
        // Update cursor
        this.renderer.domElement.style.cursor = 'pointer';
        
        // Disable auto-rotate on hover
        this.controls.autoRotate = false;
        
        console.log(`Hovering: ${piece.userData.route.title}`);
    }

    onPieceHoverExit(piece) {
        // Remove glow
        piece.material.opacity = piece.userData.originalOpacity;
        piece.material.emissive = new THREE.Color(0x000000);
        piece.material.emissiveIntensity = 0;
        
        // Reset cursor
        this.renderer.domElement.style.cursor = 'default';
        
        // Re-enable auto-rotate
        this.controls.autoRotate = true;
    }

    onPieceClick(piece) {
        console.log(`Clicked: ${piece.userData.route.title}`);
        
        // Pulse/ripple effect on click
        this.createRippleEffect(piece);
        
        // Navigate after animation
        setTimeout(() => {
            const { navigateToRoute } = require('./routes.js');
            navigateToRoute(piece.userData.pieceId);
        }, 500);
    }

    createRippleEffect(piece) {
        // Create expanding ring for ripple effect
        const geometry = new THREE.RingGeometry(0.1, 0.15, 32);
        const material = new THREE.MeshBasicMaterial({
            color: piece.userData.originalColor,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        
        const ripple = new THREE.Mesh(geometry, material);
        ripple.position.copy(piece.position);
        ripple.lookAt(this.camera.position);
        
        this.scene.add(ripple);
        
        // Animate ripple
        const startTime = Date.now();
        const duration = 800;
        
        const animateRipple = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress < 1) {
                const scale = 1 + progress * 3;
                ripple.scale.set(scale, scale, 1);
                ripple.material.opacity = 1 - progress;
                requestAnimationFrame(animateRipple);
            } else {
                this.scene.remove(ripple);
            }
        };
        
        animateRipple();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.shaderTime = this.clock.getElapsedTime();
        
        // Update shader uniforms
        this.scene.traverse((child) => {
            if (child.isMesh && child.userData.shaderMaterial) {
                child.userData.shaderMaterial.uniforms.time.value = this.shaderTime;
            }
        });
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }
}
