/**
 * Route configuration for puzzle pieces
 * Each puzzle piece maps to a specific route/page
 */

export const routes = {
    piece1: {
        id: 'frontal-lobe',
        url: '#/frontal-lobe',
        title: 'Frontal Lobe',
        description: 'Executive functions, decision making, and personality',
        color: 0xff6b6b
    },
    piece2: {
        id: 'parietal-lobe',
        url: '#/parietal-lobe',
        title: 'Parietal Lobe',
        description: 'Sensory processing and spatial awareness',
        color: 0x4ecdc4
    },
    piece3: {
        id: 'temporal-lobe',
        url: '#/temporal-lobe',
        title: 'Temporal Lobe',
        description: 'Memory, hearing, and language comprehension',
        color: 0x95e1d3
    },
    piece4: {
        id: 'occipital-lobe',
        url: '#/occipital-lobe',
        title: 'Occipital Lobe',
        description: 'Visual processing',
        color: 0xf38181
    },
    piece5: {
        id: 'cerebellum',
        url: '#/cerebellum',
        title: 'Cerebellum',
        description: 'Motor control and coordination',
        color: 0xaa96da
    },
    piece6: {
        id: 'brainstem',
        url: '#/brainstem',
        title: 'Brainstem',
        description: 'Vital functions: breathing, heart rate, consciousness',
        color: 0xfcbad3
    },
    piece7: {
        id: 'hippocampus',
        url: '#/hippocampus',
        title: 'Hippocampus',
        description: 'Memory formation and spatial navigation',
        color: 0xffffd2
    },
    piece8: {
        id: 'amygdala',
        url: '#/amygdala',
        title: 'Amygdala',
        description: 'Emotion processing and fear response',
        color: 0xa8dadc
    },
    piece9: {
        id: 'corpus-callosum',
        url: '#/corpus-callosum',
        title: 'Corpus Callosum',
        description: 'Communication between brain hemispheres',
        color: 0xe63946
    }
};

/**
 * Navigate to a specific route
 * @param {string} pieceId - The puzzle piece identifier
 */
export function navigateToRoute(pieceId) {
    const route = routes[pieceId];
    if (route) {
        console.log(`Navigating to: ${route.title}`);
        // For demo purposes, we'll use hash routing
        // In production, you could use window.location.href for full page navigation
        window.location.href = route.url;
        
        // Optional: Show modal or overlay instead of navigation
        // showRouteModal(route);
    } else {
        console.warn(`Route not found for piece: ${pieceId}`);
    }
}

/**
 * Get route information for a piece
 * @param {string} pieceId - The puzzle piece identifier
 * @returns {Object} Route information
 */
export function getRouteInfo(pieceId) {
    return routes[pieceId] || null;
}

/**
 * Optional: Show modal instead of navigating
 * Uncomment and customize if you want in-page modals instead of navigation
 */
function showRouteModal(route) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 15px;">${route.title}</h2>
            <p style="color: #666; margin-bottom: 20px;">${route.description}</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="padding: 10px 30px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}
