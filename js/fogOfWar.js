/**
 * FogOfWar — SVG mask-based fog of war system
 *
 * Covers the map in darkness. Friendly creatures and bases project
 * vision circles that cut through the fog. Explored areas remain
 * dimly visible after units move on.
 */
export class FogOfWar {
    /**
     * @param {SVGSVGElement} svg - The map SVG element
     * @param {number} mapWidth - Map width in SVG units
     * @param {number} mapHeight - Map height in SVG units
     * @param {Object} [opts]
     * @param {number} [opts.creatureVision=8] - Vision radius in SVG units
     * @param {number} [opts.baseVision=15] - Base vision radius in SVG units
     * @param {number} [opts.gridRes=2] - Explored grid cell size in SVG units
     */
    constructor(svg, mapWidth, mapHeight, opts = {}) {
        this.svg = svg;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.creatureVision = opts.creatureVision || 8;
        this.baseVision = opts.baseVision || 15;
        this.gridRes = opts.gridRes || 2;

        // Explored grid: 2D boolean array
        this.gridCols = Math.ceil(mapWidth / this.gridRes);
        this.gridRows = Math.ceil(mapHeight / this.gridRes);
        this._explored = new Uint8Array(this.gridCols * this.gridRows);

        // Current vision sources: [{x, y, radius}, ...]
        this._visionSources = [];

        // SVG elements (created in init())
        this._unexploredOverlay = null;
        this._exploredMask = null;
        this._exploredMaskBg = null;
        this._visionMask = null;
        this._visionMaskBg = null;
        this._currentFog = null;
        this._visionGroup = null;
        this._exploredGroup = null;

        this._initialized = false;
    }

    /**
     * Create all SVG elements. Call once after construction.
     */
    init() {
        if (this._initialized) return;

        const ns = 'http://www.w3.org/2000/svg';
        const defs = this.svg.querySelector('defs') || (() => {
            const d = document.createElementNS(ns, 'defs');
            this.svg.insertBefore(d, this.svg.firstChild);
            return d;
        })();

        // --- Unexplored mask ---
        this._exploredMask = document.createElementNS(ns, 'mask');
        this._exploredMask.setAttribute('id', 'fog-explored-mask');
        // Black = hidden (unexplored), white = visible (explored)
        this._exploredMaskBg = document.createElementNS(ns, 'rect');
        this._exploredMaskBg.setAttribute('width', '100%');
        this._exploredMaskBg.setAttribute('height', '100%');
        this._exploredMaskBg.setAttribute('fill', 'black');
        this._exploredMask.appendChild(this._exploredMaskBg);
        this._exploredGroup = document.createElementNS(ns, 'g');
        this._exploredMask.appendChild(this._exploredGroup);
        defs.appendChild(this._exploredMask);

        // --- Vision mask (current visibility) ---
        this._visionMask = document.createElementNS(ns, 'mask');
        this._visionMask.setAttribute('id', 'fog-vision-mask');
        this._visionMaskBg = document.createElementNS(ns, 'rect');
        this._visionMaskBg.setAttribute('width', '100%');
        this._visionMaskBg.setAttribute('height', '100%');
        this._visionMaskBg.setAttribute('fill', 'black');
        this._visionMask.appendChild(this._visionMaskBg);
        this._visionGroup = document.createElementNS(ns, 'g');
        this._visionMask.appendChild(this._visionGroup);
        defs.appendChild(this._visionMask);

        // --- Unexplored overlay (solid dark, hides never-seen areas) ---
        this._unexploredOverlay = document.createElementNS(ns, 'rect');
        this._unexploredOverlay.setAttribute('id', 'fog-unexplored');
        this._unexploredOverlay.setAttribute('width', '100%');
        this._unexploredOverlay.setAttribute('height', '100%');
        this._unexploredOverlay.setAttribute('fill', 'rgba(3,5,10,0.95)');
        this._unexploredOverlay.setAttribute('mask', 'url(#fog-explored-mask)');
        this._unexploredOverlay.setAttribute('pointer-events', 'none');
        // Insert as last child so it renders on top
        this.svg.appendChild(this._unexploredOverlay);

        // --- Current fog overlay (semi-transparent, dims explored-but-not-visible) ---
        this._currentFog = document.createElementNS(ns, 'rect');
        this._currentFog.setAttribute('id', 'fog-current');
        this._currentFog.setAttribute('width', '100%');
        this._currentFog.setAttribute('height', '100%');
        this._currentFog.setAttribute('fill', 'rgba(2,4,10,0.55)');
        this._currentFog.setAttribute('mask', 'url(#fog-vision-mask)');
        this._currentFog.setAttribute('pointer-events', 'none');
        this.svg.appendChild(this._currentFog);

        this._initialized = true;
    }

    /**
     * Call each frame with current vision sources.
     * @param {Array<{x: number, y: number, radius: number}>} sources
     */
    update(sources) {
        if (!this._initialized) return;
        this._visionSources = sources;

        // --- Update vision mask circles ---
        while (this._visionGroup.firstChild) {
            this._visionGroup.removeChild(this._visionGroup.firstChild);
        }
        const ns = 'http://www.w3.org/2000/svg';
        for (const s of sources) {
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('cx', s.x);
            circle.setAttribute('cy', s.y);
            circle.setAttribute('r', s.radius);
            circle.setAttribute('fill', 'white');
            this._visionGroup.appendChild(circle);
        }

        // --- Update explored grid ---
        for (const s of sources) {
            this._markExplored(s.x, s.y, s.radius);
        }

        // --- Update explored mask circles (only when new areas explored) ---
        // We debounce this — only rebuild explored circles periodically
        if (!this._lastExploredRebuild || Date.now() - this._lastExploredRebuild > 2000) {
            this._rebuildExploredMask();
            this._lastExploredRebuild = Date.now();
        }
    }

    /**
     * Mark cells within radius as explored.
     */
    _markExplored(cx, cy, radius) {
        const minCol = Math.max(0, Math.floor((cx - radius) / this.gridRes));
        const maxCol = Math.min(this.gridCols - 1, Math.ceil((cx + radius) / this.gridRes));
        const minRow = Math.max(0, Math.floor((cy - radius) / this.gridRes));
        const maxRow = Math.min(this.gridRows - 1, Math.ceil((cy + radius) / this.gridRes));
        const r2 = radius * radius;

        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const idx = row * this.gridCols + col;
                if (this._explored[idx]) continue;
                // Check if cell center is within radius
                const cellCx = (col + 0.5) * this.gridRes;
                const cellCy = (row + 0.5) * this.gridRes;
                const dx = cellCx - cx;
                const dy = cellCy - cy;
                if (dx * dx + dy * dy <= r2) {
                    this._explored[idx] = 1;
                }
            }
        }
    }

    /**
     * Rebuild the explored mask with circles for explored regions.
     * Uses a grid-to-rect approximation for performance.
     */
    _rebuildExploredMask() {
        while (this._exploredGroup.firstChild) {
            this._exploredGroup.removeChild(this._exploredGroup.firstChild);
        }
        const ns = 'http://www.w3.org/2000/svg';

        // Build rects from explored grid (coalesce horizontal runs)
        for (let row = 0; row < this.gridRows; row++) {
            let startCol = -1;
            for (let col = 0; col <= this.gridCols; col++) {
                const idx = row * this.gridCols + col;
                const explored = col < this.gridCols && this._explored[idx];
                if (explored && startCol === -1) {
                    startCol = col;
                } else if (!explored && startCol !== -1) {
                    const rect = document.createElementNS(ns, 'rect');
                    rect.setAttribute('x', startCol * this.gridRes);
                    rect.setAttribute('y', row * this.gridRes);
                    rect.setAttribute('width', (col - startCol) * this.gridRes);
                    rect.setAttribute('height', this.gridRes);
                    rect.setAttribute('fill', 'white');
                    this._exploredGroup.appendChild(rect);
                    startCol = -1;
                }
            }
        }
    }

    /**
     * Check if a pixel position is currently visible.
     */
    isVisible(px, py) {
        for (const s of this._visionSources) {
            const dx = px - s.x;
            const dy = py - s.y;
            if (dx * dx + dy * dy <= s.radius * s.radius) return true;
        }
        return false;
    }

    /**
     * Check if a pixel position has ever been explored.
     */
    isExplored(px, py) {
        const col = Math.floor(px / this.gridRes);
        const row = Math.floor(py / this.gridRes);
        if (col < 0 || col >= this.gridCols || row < 0 || row >= this.gridRows) return false;
        return this._explored[row * this.gridCols + col] === 1;
    }

    /**
     * Reset all fog (full unexplored).
     */
    reset() {
        this._explored.fill(0);
        while (this._visionGroup.firstChild) this._visionGroup.removeChild(this._visionGroup.firstChild);
        this._rebuildExploredMask();
    }
}
