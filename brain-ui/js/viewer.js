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
        this.clock = new THREE.Clock();
        
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
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 8;
        this.controls.enablePan = true;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 1.0;
        
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
            
            // Apply standard materials (no custom shaders)
            this.brainModel.traverse((child) => {
                if (child.isMesh) {
                    // Ensure materials are properly set up
                    if (child.material) {
                        child.material.side = THREE.FrontSide;
                        child.material.needsUpdate = true;
                        // Disable frustum culling to prevent disappearing
                        child.frustumCulled = false;
                    }
                }
            });
            
            this.scene.add(this.brainModel);
            
            console.log('Brain model loaded successfully');
            return this.brainModel;
        } catch (error) {
            console.error('Error loading brain model:', error);
            throw error;
        }
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
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }

    start() {
        this.animate();
    }
}
