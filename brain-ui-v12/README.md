# 3D Brain Puzzle - Interactive Web Experience

A mobile-friendly, interactive 3D brain visualization with clickable puzzle pieces built using Three.js. Features orbit controls, shader-based visual effects, and responsive design optimized for GitHub Pages hosting.

## 🌟 Features

- **3D Brain Model**: Loads and displays a detailed brain model from GLB format
- **Orbit Controls**: Click/touch and drag to rotate, pinch to zoom
- **Interactive Puzzle Pieces**: 9 clickable regions mapped to different brain areas
- **Shader Effects**:
  - Animated gradient across brain surface
  - Glow effect on hover
  - Ripple/pulse effect on click
  - Fresnel rim lighting
- **Mobile Optimized**: Touch-friendly controls, responsive layout, optimized performance
- **Modular Architecture**: Separated concerns with clean ES6 modules

## 📁 Project Structure

```
brain-ui/
├── index.html          # Main entry point
├── public/
│   └── brain.glb       # 3D brain model
├── css/
│   └── style.css       # Responsive styles
└── js/
    ├── main.js         # Application initialization
    ├── viewer.js       # 3D scene, camera, rendering
    ├── overlay.js      # Puzzle piece overlays and tooltips
    └── routes.js       # Route configuration and navigation
```

## 🚀 Getting Started

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd brain-ui
   ```

2. **Serve locally** (required due to CORS restrictions on GLB loading)
   
   Using Python:
   ```bash
   python -m http.server 8000
   ```
   
   Using Node.js:
   ```bash
   npx http-server -p 8000
   ```
   
   Using PHP:
   ```bash
   php -S localhost:8000
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### GitHub Pages Deployment

1. Push the `brain-ui` folder to your repository
2. Go to repository Settings → Pages
3. Select source branch and `/brain-ui` as the root folder
4. Your site will be available at: `https://<username>.github.io/<repo>/brain-ui/`

## 🎮 Usage

- **Rotate**: Click/touch and drag anywhere on the screen
- **Zoom**: Scroll wheel or pinch gesture
- **Interact**: Hover over colored spheres to see brain region info
- **Navigate**: Click/tap puzzle pieces to navigate to detailed pages

## 🧩 Puzzle Pieces Configuration

Edit `js/routes.js` to customize puzzle pieces:

```javascript
export const routes = {
    piece1: {
        id: 'frontal-lobe',
        url: '#/frontal-lobe',      // Navigation target
        title: 'Frontal Lobe',       // Display name
        description: 'Executive functions...',
        color: 0xff6b6b              // Hex color
    },
    // ... more pieces
};
```

## 🎨 Customization

### Shader Effects

Modify shader code in `viewer.js`:
- **Vertex Shader**: Control geometry animations (line 104-116)
- **Fragment Shader**: Adjust colors, gradients, effects (line 117-138)

### Visual Appearance

Adjust in `viewer.js`:
- Background: `this.scene.background = new THREE.Color(0x0a0a1a)`
- Camera position: `this.camera.position.set(0, 0, 5)`
- Auto-rotate speed: `this.controls.autoRotateSpeed = 0.5`
- Lighting: Modify in `setupLights()` method

### Styling

Edit `css/style.css`:
- Info panel appearance
- Loading screen design
- Mobile breakpoints

## 📱 Mobile Optimization

- Touch-friendly controls with OrbitControls
- Responsive layout using CSS media queries
- Performance optimization with `powerPreference: 'high-performance'`
- Pixel ratio capped at 2x for better performance
- Viewport meta tags prevent unwanted zooming
- Safe area insets for iOS notches

## 🔧 Technical Details

### Dependencies (CDN)
- Three.js r128
- OrbitControls
- GLTFLoader
- Post-processing effects (optional)

### Browser Support
- Modern browsers with WebGL support
- Chrome, Firefox, Safari, Edge (latest versions)
- iOS Safari 12+
- Android Chrome 80+

### Performance Considerations
- Model is automatically centered and scaled
- Pixel ratio capped at 2x
- Damping enabled for smooth interactions
- Minimal draw calls with efficient raycasting

## 🎯 Brain Model Source

Model: Human Brain (Sketchfab ID: e073c2590bc24daaa7323f4daa5b7784)
- Format: GLB (GLTF Binary)
- Located: `public/brain.glb`

To replace with a different model:
1. Download GLB file
2. Replace `public/brain.glb`
3. Adjust scaling in `loadBrainModel()` if needed

## 🐛 Troubleshooting

**Model not loading?**
- Ensure you're serving via HTTP/HTTPS (not file://)
- Check browser console for CORS errors
- Verify `public/brain.glb` exists and is accessible

**Controls not working on mobile?**
- Check that touch events aren't blocked
- Ensure viewport meta tags are present
- Test with `{ passive: true }` event listeners

**Performance issues?**
- Reduce `window.devicePixelRatio` multiplier
- Disable auto-rotate: `this.controls.autoRotate = false`
- Simplify shader code
- Use lower-poly brain model

## 📄 License

This project is open source. Brain model attribution may be required - check Sketchfab license.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

---

Built with ❤️ using Three.js
