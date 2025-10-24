/**
 * Jigsaw Puzzle Shape Generator
 * Creates realistic puzzle piece shapes with tabs and blanks using Bezier curves
 * Based on the jigsaw puzzle algorithm from the repo
 */

export class PuzzleShapeGenerator {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.shapes = [];
        this.generateShapes();
    }

    generateShapes() {
        // Create a grid of puzzle pieces with shared edges
        // Each piece knows if its edges have tabs (out), blanks (in), or straight
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const piece = {
                    row,
                    col,
                    index: row * this.cols + col,
                    // Edge types: 'straight', 'tab', 'blank'
                    top: row === 0 ? 'straight' : null,
                    right: col === this.cols - 1 ? 'straight' : null,
                    bottom: row === this.rows - 1 ? 'straight' : null,
                    left: col === 0 ? 'straight' : null
                };
                
                // Assign complementary edges (if right piece has tab, left piece has blank)
                if (col > 0) {
                    const leftPiece = this.shapes[row * this.cols + col - 1];
                    piece.left = leftPiece.right === 'tab' ? 'blank' : 'tab';
                }
                
                if (row > 0) {
                    const topPiece = this.shapes[(row - 1) * this.cols + col];
                    piece.top = topPiece.bottom === 'tab' ? 'blank' : 'tab';
                }
                
                // Randomly assign tab/blank to unassigned edges
                if (piece.right === null) {
                    piece.right = Math.random() > 0.5 ? 'tab' : 'blank';
                }
                if (piece.bottom === null) {
                    piece.bottom = Math.random() > 0.5 ? 'tab' : 'blank';
                }
                
                this.shapes.push(piece);
            }
        }
    }

    /**
     * Generate SVG path for a puzzle piece
     * Returns a path string that can be used with canvas or SVG
     */
    generatePiecePath(pieceIndex, width = 100, height = 100) {
        const piece = this.shapes[pieceIndex];
        if (!piece) return '';
        
        const tabSize = 0.2; // 20% of edge length
        const path = [];
        
        // Start at top-left corner
        path.push(`M 0 0`);
        
        // Top edge
        if (piece.top === 'straight') {
            path.push(`L ${width} 0`);
        } else {
            path.push(this.createEdgePath(0, 0, width, 0, piece.top === 'tab', tabSize, 'horizontal'));
        }
        
        // Right edge
        if (piece.right === 'straight') {
            path.push(`L ${width} ${height}`);
        } else {
            path.push(this.createEdgePath(width, 0, width, height, piece.right === 'tab', tabSize, 'vertical'));
        }
        
        // Bottom edge
        if (piece.bottom === 'straight') {
            path.push(`L 0 ${height}`);
        } else {
            path.push(this.createEdgePath(width, height, 0, height, piece.bottom === 'tab', tabSize, 'horizontal'));
        }
        
        // Left edge
        if (piece.left === 'straight') {
            path.push(`L 0 0`);
        } else {
            path.push(this.createEdgePath(0, height, 0, 0, piece.left === 'tab', tabSize, 'vertical'));
        }
        
        path.push('Z'); // Close path
        
        return path.join(' ');
    }

    /**
     * Create a Bezier curve path for an edge with tab or blank
     * Enhanced with more pronounced puzzle piece shapes
     */
    createEdgePath(x1, y1, x2, y2, isTab, tabSize, orientation) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Perpendicular direction (for tab/blank protrusion)
        let perpX, perpY;
        if (orientation === 'horizontal') {
            perpX = 0;
            perpY = isTab ? -1 : 1;
        } else {
            perpX = isTab ? 1 : -1;
            perpY = 0;
        }
        
        // Make tabs more pronounced
        const tabDepth = length * 0.35; // Increased from tabSize to 0.35 for bigger tabs
        const neckWidth = 0.25; // Width of the neck connecting to tab
        
        // Calculate key points along the edge
        const mid = 0.5;
        const midX = x1 + dx * mid;
        const midY = y1 + dy * mid;
        
        // Tab/blank start and end - narrower neck
        const tabStart = mid - neckWidth;
        const tabEnd = mid + neckWidth;
        
        const x_start = x1 + dx * tabStart;
        const y_start = y1 + dy * tabStart;
        const x_end = x1 + dx * tabEnd;
        const y_end = y1 + dy * tabEnd;
        
        // Create classic jigsaw puzzle shape with circular tab
        // Points for the tab circle
        const tabCenterX = midX + perpX * tabDepth * 0.6;
        const tabCenterY = midY + perpY * tabDepth * 0.6;
        
        // Control points for smoother, rounder tab
        const c1x = x_start + perpX * tabDepth * 0.05;
        const c1y = y_start + perpY * tabDepth * 0.05;
        
        const c2x = x_start - dx * 0.05 + perpX * tabDepth * 0.5;
        const c2y = y_start - dy * 0.05 + perpY * tabDepth * 0.5;
        
        // Left side of circle
        const leftX = tabCenterX - (orientation === 'horizontal' ? 0 : tabDepth * 0.4);
        const leftY = tabCenterY - (orientation === 'horizontal' ? tabDepth * 0.4 : 0);
        
        // Top of circle  
        const topX = tabCenterX + perpX * tabDepth * 0.35;
        const topY = tabCenterY + perpY * tabDepth * 0.35;
        
        // Right side of circle
        const rightX = tabCenterX + (orientation === 'horizontal' ? 0 : tabDepth * 0.4);
        const rightY = tabCenterY + (orientation === 'horizontal' ? tabDepth * 0.4 : 0);
        
        const c3x = x_end + dx * 0.05 + perpX * tabDepth * 0.5;
        const c3y = y_end + dy * 0.05 + perpY * tabDepth * 0.5;
        
        const c4x = x_end + perpX * tabDepth * 0.05;
        const c4y = y_end + perpY * tabDepth * 0.05;
        
        // Build path with smooth circular tab
        return `L ${x_start} ${y_start} ` +
               `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${leftX} ${leftY} ` +
               `Q ${tabCenterX} ${tabCenterY}, ${topX} ${topY} ` +
               `Q ${tabCenterX + perpX * tabDepth * 0.2} ${tabCenterY + perpY * tabDepth * 0.2}, ${rightX} ${rightY} ` +
               `C ${c3x} ${c3y}, ${c4x} ${c4y}, ${x_end} ${y_end} ` +
               `L ${x2} ${y2}`;
    }

    /**
     * Draw a puzzle piece to a canvas
     */
    drawPieceToCanvas(canvas, pieceIndex, sourceImage, sourceX, sourceY, pieceWidth, pieceHeight) {
        const ctx = canvas.getContext('2d');
        const path = this.generatePiecePath(pieceIndex, pieceWidth, pieceHeight);
        
        // Create path from SVG string
        const path2d = new Path2D(path);
        
        // Clear canvas
        canvas.width = pieceWidth;
        canvas.height = pieceHeight;
        ctx.clearRect(0, 0, pieceWidth, pieceHeight);
        
        // Clip to puzzle piece shape
        ctx.save();
        ctx.clip(path2d);
        
        // Draw the portion of the source image
        ctx.drawImage(sourceImage, sourceX, sourceY, pieceWidth, pieceHeight, 0, 0, pieceWidth, pieceHeight);
        
        ctx.restore();
        
        // Add subtle edge shadow for depth
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke(path2d);
        
        return canvas;
    }

    getPieceData(pieceIndex) {
        return this.shapes[pieceIndex];
    }
}
