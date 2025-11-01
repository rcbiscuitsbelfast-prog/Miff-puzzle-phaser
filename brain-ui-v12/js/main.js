/**
 * Main application entry point
 * Initializes the 3D viewer
 */

import { BrainViewer } from './viewer.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing 3D Brain Viewer...');
    
    const loadingScreen = document.getElementById('loading-screen');
    const errorMsg = loadingScreen.querySelector('p');
    
    // Set a timeout to show error if loading takes too long
    const loadingTimeout = setTimeout(() => {
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            errorMsg.textContent = 'Loading is taking longer than expected. Please check your connection and refresh.';
            errorMsg.style.color = '#ff4444';
        }
        }
    }, 30000); // 30 second timeout
    
    try {
        // Initialize viewer
        const viewer = new BrainViewer('container');
        
        // Load brain model with timeout
        const loadPromise = viewer.loadBrainModel();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Model loading timeout after 20 seconds')), 20000)
        );
        
        await Promise.race([loadPromise, timeoutPromise]);
        clearTimeout(loadingTimeout);
        
        // Start animation loop
        viewer.start();
        
        // Hide loading screen
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500);
        
        // Store globally for debugging
        window.brainApp = {
            viewer
        };
        
    } catch (error) {
        clearTimeout(loadingTimeout);
        const errorText = error.message || 'Failed to load brain model. Please refresh the page.';
        errorMsg.textContent = `Error: ${errorText}`;
        errorMsg.style.color = '#ff4444';
        errorMsg.style.fontWeight = 'bold';
        
        // Also log to console if available
        if (window.console && console.error) {
            console.error('Failed to initialize application:', error);
        }
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
