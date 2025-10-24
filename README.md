# 🧠 MIFF 3D Brain Jigsaw Puzzle

🌐 **Live Demo:** [Version Selector](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/)

An interactive 3D brain puzzle with multiple versions showcasing different approaches to jigsaw puzzle visualization using Three.js and WebGL.

## 🎯 Quick Links

- **[Version Selector](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/)** - Choose from 7 different versions
- **[V9 - Latest](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v9/)** - Matrix spiral threads (⭐ Recommended)
- **[V8 - Instant](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v8/)** - 25 pieces, instant explosion
- **[V7 - Puzzle Shapes](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v7/)** - Special clicked piece
- **[V6 - Full Coverage](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v6/)** - Dual-colored hemispheres
- **[V5 - MIFF Edition](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v5/)** - 64 pieces with MIFF branding
- **[V4 - Enhanced](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v4/)** - 36 pieces auto-rotating
- **[V3 - Fixed](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v3/)** - 25 pieces shader-based
- **[V2 - Demo](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v2/)** - Broken version (for comparison)
- **[V1.1 - First](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v1.1/)** - First puzzle iteration
- **[V1 - Original](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/brain-ui-v1/)** - Original baseline

## 🌟 Version Highlights

### V9 - Matrix Spiral Explosion (Latest) ⭐
**Location:** `/brain-ui-v9/`

Epic two-stage explosion effect:
- 💥 **TRUE instant explosion** - All pieces move from frame 1 (removed delay check)
- 🌀 **Matrix spiral** - Code threads spiral away after pieces
- ✨ **Golden angle** - 137.5° distribution for beautiful patterns
- ⏱️ **Perfect timing** - 4.5s delay, then 2.5s spiral
- 🎭 **Multi-stage** - Puzzle → Matrix → Green glow reveal
- 🔤 **MIFF branding** - Embedded throughout

### V8 - 25 Pieces with Instant Explosion
**Location:** `/brain-ui-v8/`

Balance of size and drama:
- 🧩 **25 pieces (5×5)** - Larger, more visible
- 💥 **Instant explosion** - All pieces fly away simultaneously
- ⭐ **Huge clicked piece** - 25x scale, fills half the screen
- 🎨 **No color mirroring** - Checkerboard pattern
- 📐 **Larger overlays** - Better visibility (+0.1, puzzle +0.2)
- 🔤 **MIFF Matrix branding** - Embedded throughout

### V7 - Puzzle Shapes with Special Click
**Location:** `/brain-ui-v7/`

Jigsaw piece shapes with special animation:
- 🧩 **Real puzzle shapes** - Tabs and blanks, not squares!
- 🎨 **Front/back coloring** - Warm front, cool back (not mirrored)
- ⭐ **Special clicked piece** - Floats toward you, enlarges to half-screen
- ⏱️ **Slower explosion** - 3.5s duration, 80ms stagger
- 🔤 **MIFF Matrix branding** - Embedded in rain effect
- 📐 **64 pieces (8×8 grid)** - Perfect piece size

### V6 - Full Coverage Dual-Color
**Location:** `/brain-ui-v6/`

Complete puzzle coverage with hemisphere coloring:
- 🧩 **64 pieces (8×8 grid)** - No gaps in coverage
- 🎨 **Dual-colored hemispheres** - Warm colors (left), Cool colors (right)
- 🔤 **MIFF branding** - "Make It For Free" letters in Matrix rain
- 📐 **Zoomed out camera** - Full puzzle view
- 💥 **Slower explosion** - 2.5s dramatic animation
- ✨ **Full opacity rendering** - Solid puzzle overlay

**Features:**
- Auto-rotating 3D brain model
- Click any piece to explode all pieces
- Matrix code rain effect underneath
- Green glow shader base layer
- Mobile-optimized touch controls

### V5 - 64-Piece MIFF Edition
**Location:** `/brain-ui-v5/`

- 64 puzzle pieces with MIFF text integration
- Enhanced puzzle shapes with prominent tabs
- Matrix rain with MIFF letters appearing randomly

### V4 - 36-Piece Enhanced
**Location:** `/brain-ui-v4/`

- 36 pieces (6×6 grid)
- Auto-rotation enabled
- 10% larger overlays
- Enhanced tab/blank shapes

### V1.1 - First Puzzle Iteration
**Location:** `/brain-ui-v1.1/`

- Historical first version with working puzzle
- 9 colored pieces
- Click-to-explode animation

## 🚀 Tech Stack

- **Three.js** - 3D rendering engine
- **WebGL** - Hardware-accelerated graphics
- **GLSL Shaders** - Custom visual effects
- **ES6 Modules** - Modern JavaScript
- **GitHub Pages** - Hosting

## 📦 Other Projects

### HTML5 Jigsaw Puzzle (Original)
**Location:** Root directory

Traditional 2D jigsaw puzzle using PhaserJS:
- Three puzzles: colors, cow, airplane
- Drag-and-drop gameplay
- Snap-to-grid mechanics

**Tech:** PhaserJS, jQuery

## 📚 Documentation

- [Brain Puzzle Documentation](brain-ui/README.md)
- [Version Comparison](https://rcbiscuitsbelfast-prog.github.io/Miff-puzzle-phaser/)

---

**MIFF** - Make It For Free 🎨
