/**
 * Puzzle Piece Overlay Manager
 * Handles visual overlays and interactions with puzzle pieces
 */

import { getRouteInfo } from './routes.js';

export class PuzzleOverlay {
    constructor(viewer) {
        this.viewer = viewer;
        this.tooltipElement = null;
        this.createTooltip();
    }

    createTooltip() {
        // Create tooltip element for showing piece information
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 14px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 100;
            max-width: 250px;
            backdrop-filter: blur(10px);
        `;
        document.body.appendChild(this.tooltipElement);
    }

    showTooltip(pieceId, x, y) {
        const route = getRouteInfo(pieceId);
        if (!route) return;

        this.tooltipElement.innerHTML = `
            <strong style="display: block; margin-bottom: 5px; font-size: 16px;">
                ${route.title}
            </strong>
            <span style="font-size: 12px; color: #ccc;">
                ${route.description}
            </span>
        `;

        // Position tooltip near cursor/touch
        const offsetX = 15;
        const offsetY = 15;
        let tooltipX = x + offsetX;
        let tooltipY = y + offsetY;

        // Keep tooltip within viewport
        const rect = this.tooltipElement.getBoundingClientRect();
        if (tooltipX + rect.width > window.innerWidth) {
            tooltipX = x - rect.width - offsetX;
        }
        if (tooltipY + rect.height > window.innerHeight) {
            tooltipY = y - rect.height - offsetY;
        }

        this.tooltipElement.style.left = `${tooltipX}px`;
        this.tooltipElement.style.top = `${tooltipY}px`;
        this.tooltipElement.style.opacity = '1';
    }

    hideTooltip() {
        this.tooltipElement.style.opacity = '0';
    }

    /**
     * Add visual indicators for puzzle pieces
     * Creates small markers/labels around the brain
     */
    addVisualIndicators() {
        const indicators = [];
        
        this.viewer.puzzlePieces.forEach((piece, index) => {
            const indicator = this.createIndicator(piece);
            indicators.push(indicator);
        });

        return indicators;
    }

    createIndicator(piece) {
        const route = piece.userData.route;
        
        // Create CSS2D label (if using CSS2DRenderer)
        // For simplicity, we'll use HTML overlay positioned manually
        const label = document.createElement('div');
        label.className = 'puzzle-indicator';
        label.style.cssText = `
            position: absolute;
            background: ${this.colorToCSS(route.color)};
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 600;
            pointer-events: none;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        `;
        label.textContent = route.title;
        
        // Position based on 3D coordinates (requires projection)
        this.updateIndicatorPosition(label, piece);
        
        document.body.appendChild(label);
        
        return label;
    }

    updateIndicatorPosition(label, piece) {
        // Project 3D position to screen coordinates
        const vector = new THREE.Vector3();
        piece.getWorldPosition(vector);
        vector.project(this.viewer.camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.transform = 'translate(-50%, -50%)';
    }

    colorToCSS(hexColor) {
        return `#${hexColor.toString(16).padStart(6, '0')}`;
    }

    /**
     * Enhanced hover effects with shader manipulation
     */
    enhanceHoverEffect(piece) {
        // Additional visual feedback beyond the basic glow
        if (piece.userData.shaderMaterial) {
            piece.userData.shaderMaterial.uniforms.emissive.value = 
                new THREE.Color(piece.userData.originalColor);
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this.tooltipElement) {
            this.tooltipElement.remove();
        }
        
        // Remove all indicators
        document.querySelectorAll('.puzzle-indicator').forEach(el => el.remove());
    }
}
