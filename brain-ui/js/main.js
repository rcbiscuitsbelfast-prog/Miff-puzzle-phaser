/**
 * Main application entry point
 * Initializes the 3D viewer and overlay system
 */

import { BrainViewer } from './viewer.js';
import { PuzzleOverlay } from './overlay.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing 3D Brain Puzzle...');
    
    const loadingScreen = document.getElementById('loading-screen');
    
    try {
        // Initialize viewer
        const viewer = new BrainViewer('container');
        
        // Load brain model
        await viewer.loadBrainModel();
        
        // Initialize overlay system
        const overlay = new PuzzleOverlay(viewer);
        
        // Start animation loop
        viewer.start();
        
        // Hide loading screen
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            console.log('Ready! Click and drag to rotate, tap pieces to explore.');
        }, 500);
        
        // Store globally for debugging
        window.brainApp = {
            viewer,
            overlay
        };
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        loadingScreen.querySelector('p').textContent = 'Error loading brain model. Please refresh.';
    }
});

// Handle hash changes for navigation
window.addEventListener('hashchange', () => {
    console.log('Route changed:', window.location.hash);
    // Handle route changes here if needed
});

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
}, false);

// Prevent double-tap zoom on iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);
