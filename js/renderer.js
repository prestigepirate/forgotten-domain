/**
 * Renderer - SVG Map Rendering with Visual Editor Mode
 *
 * Supports both gameplay mode and drag-to-edit mode for bases/paths
 */

import { getBaseStyle } from './provinces.js';
import { createCreatureElement, showCreatureHoverCard, hideCreatureHoverCard } from './creatureVisuals.js';
import { createSigilRuneSVG, createProgressRing, createSummonedCreatureSVG, createSigilLabel } from './sigilVisuals.js';
import { applyMovementVisuals, removeTrailEffect } from './visualEffects.js';

// ============================================
// Configuration
// ============================================

const CONFIG = {
    borderGlow: 15,
    selectionGlow: 25,
    labelFontSize: 12,
    borderOpacity: 0.9,
    labelShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 20px rgba(0,0,0,0.8)',
    // Editor mode
    editorMarkerRadius: 28,
    editorSubBaseRadius: 14,
    editorDragHandleSize: 12,
    editorFontSize: 13,
    editorCoordsFontSize: 11,
    // Path curvature (0 = straight line, higher = more curved)
    pathCurvature: 0.02
};

// ============================================
// Renderer Class
// ============================================

export class Renderer {
    constructor(svgElement, options = {}) {
        this.svg = svgElement;
        this.baseSystem = null;
        this.selectedBaseId = null;
        this.hoveredBaseId = null;
        this.theme = options.theme || 'voxya';

        // Force pointer-events at the element level (overrides any CSS issues)
        this.svg.style.pointerEvents = 'auto';

        // Editor mode state
        this.isEditMode = false;
        this.carryingBaseId = null;
        this._justHandledPickDrop = false;  // suppress click after pick-up/drop
        this.pathCreationMode = false;
        this.pathStartBase = null;
        this.mousePos = { x: 0, y: 0 };
        this.addBaseMode = false;
        this.newBaseType = 'base';  // 'base', 'waypoint', 'king-base'
        this.deleteMode = false;
        this.newBaseCounter = 0;

        // Custom base names toggle
        this.showCustomBaseNames = true;
        this.showWaypointNames = true;
        this.mapLabelsVisible = true;

        // Selection/trails toggle - paths ON by default
        this.showSelectionEffects = true;
        this.showConnectionPaths = true;

        // Transform group for pan/zoom
        this.transformGroup = document.getElementById('map-transform-group');

        // SVG layers
        this.layers = {
            borders: document.getElementById('base-borders'),
            paths: document.getElementById('connection-paths'),
            zones: document.getElementById('zones-layer'),
            markers: document.getElementById('base-markers'),
            decorations: document.getElementById('decorations-layer'),
            creatures: document.getElementById('units-layer'),
            selection: document.getElementById('selection-layer'),
            sigils: document.getElementById('sigils-layer')
        };

        // Creatures state
        this.creatures = new Map();
        this.selectedCreatureId = null;

        // Pan offset
        this.panOffset = { x: 0, y: 0 };

        // Movement system state
        this.movementRange = null;          // { creatureId, reachable: [{id, path, hops}] }
        this.movingCreatures = new Map();   // creatureId -> moveState

        this._initFilters();
        this._initEditorEventListeners();
    }

    /**
     * Initialize SVG filters
     */
    _initFilters() {
        let defs = this.svg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.insertBefore(defs, this.svg.firstChild);
        }

        defs.innerHTML = `
            <filter id="strong-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="medium-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="unit-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <filter id="label-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.9"/>
            </filter>
            <!-- Editor highlight glow -->
            <filter id="editor-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="10" result="blur"/>
                <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
            <!-- Mist gradient for ethereal fog patches -->
            <radialGradient id="mistGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:0.4" />
                <stop offset="50%" style="stop-color:#4c1d95;stop-opacity:0.15" />
                <stop offset="100%" style="stop-color:#1e1b4b;stop-opacity:0" />
            </radialGradient>
            <!-- Forest floor gradient -->
            <linearGradient id="forestFloor" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#1a2a1a;stop-opacity:0.6" />
                <stop offset="50%" style="stop-color:#2d4a2d;stop-opacity:0.4" />
                <stop offset="100%" style="stop-color:#1a2a1a;stop-opacity:0.6" />
            </linearGradient>
        `;
    }

    /**
     * Initialize editor event listeners
     */
    _initEditorEventListeners() {
        // Mouse move for carrying base and path preview
        this.svg.addEventListener('mousemove', (e) => this._onMouseMove(e));

        // Click on SVG background (for dropping carried base, adding bases)
        this.svg.addEventListener('click', (e) => this._onSVGClick(e));

        // Diagnostic: log ALL clicks on SVG
        // this.svg.addEventListener('click', (e) => {
        //     console.log('[Renderer] SVG click captured — target:', e.target.tagName,
        //         'class:', e.target.className?.baseVal || e.target.className,
        //         'closest .base-marker:', !!e.target.closest?.('.base-marker'));
        // }, true); // capture phase
    }

    /**
     * Initialize with base system
     */
    init(baseSystem) {
        this.baseSystem = baseSystem;
        this._syncDimensions();
        this.renderAll();

        // Keep viewBox in sync with CSS dimensions on resize
        this._resizeHandler = () => {
            const oldW = this.svgWidth;
            const oldH = this.svgHeight;
            this._syncDimensions();
            if (this.svgWidth !== oldW || this.svgHeight !== oldH) {
                this.renderAll();
            }
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    _syncDimensions() {
        // Use the SVG's own dimensions (not including parent CSS transforms)
        const w = this.svg.clientWidth || 1200;
        const h = this.svg.clientHeight || 800;
        this.svgWidth = w > 0 ? w : 1200;
        this.svgHeight = h > 0 ? h : 800;
        this.svg.setAttribute('viewBox', `0 0 ${this.svgWidth} ${this.svgHeight}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // SVG diagnostic — dimensions confirmed
        // console.log('[Renderer] SVG dimensions:', ...);
        // See browser devtools for runtime dimensions
    }

    /**
     * Update pan/zoom transform
     */
    setTransform(panX, panY, scale) {
        this.panOffset = { x: panX, y: panY };
        this.scale = scale || this.scale || 1;
        if (this.transformGroup) {
            this.transformGroup.setAttribute(
                'transform',
                `translate(${panX}, ${panY}) scale(${this.scale})`
            );
        }
    }

    /**
     * Render all map elements
     */
    renderAll() {
        if (!this.baseSystem) return;
        console.log('[Renderer] renderAll called, bases:', this.baseSystem.getAll().length);
        this.renderConnectionPaths();
        this.renderBaseBorders();
        this.renderBaseMarkers();
        this.renderDecorations();
        this.renderCreatures();
    }

    /**
     * Toggle edit mode
     */
    setEditMode(enabled) {
        this.isEditMode = enabled;
        this.pathCreationMode = false;
        this.pathStartBase = null;
        this.addBaseMode = false;
        this.deleteMode = false;
        this._clearConnectionHighlight();
        if (this.carryingBaseId) {
            this._dropBase();
        }
        this.renderAll();
    }

    /**
     * Enable add base mode
     */
    setAddBaseMode(enabled) {
        this._handleModeSwitch();
        this.addBaseMode = enabled;
        this.newBaseType = 'base';
    }

    /**
     * Check if in edit mode
     */
    getIsEditMode() {
        return this.isEditMode;
    }

    /**
     * Toggle custom base names visibility
     */
    toggleCustomBaseNames() {
        this.showCustomBaseNames = !this.showCustomBaseNames;
        this.renderBaseMarkers();
    }

    /**
     * Toggle waypoint name labels on/off
     */
    toggleWaypointNames() {
        this.showWaypointNames = !this.showWaypointNames;
        this.renderBaseMarkers();
    }

    /**
     * Toggle all visual effects (selection ring, trails, and connection paths)
     */
    toggleVisualEffects() {
        this.showSelectionEffects = !this.showSelectionEffects;
        this.showConnectionPaths = this.showSelectionEffects;
        this.renderSelection();
        this.renderConnectionPaths();
    }

    /**
     * Deterministic pseudo-random based on a numeric seed (mulberry32)
     */
    _seededRand(seed) {
        let s = seed | 0;
        return () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Hash a string to a 32-bit integer
     */
    _hashStr(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
    }

    /**
     * Render connection paths - organic mystical trails with forest elements
     */
    renderConnectionPaths() {
        if (!this.layers.paths) return;
        this.layers.paths.innerHTML = '';

        if (!this.showConnectionPaths && !this.isEditMode) return;

        const connections = this.baseSystem.getAllConnections();

        connections.forEach((conn, index) => {
            const fromPercent = this.baseSystem.getCenter(conn.from);
            const toPercent = this.baseSystem.getCenter(conn.to);
            if (!fromPercent || !toPercent) return;

            // Convert to pixel coordinates
            const from = this.percentToPixels(fromPercent.x, fromPercent.y);
            const to = this.percentToPixels(toPercent.x, toPercent.y);

            // Create a group for this connection with all its elements
            const connectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            connectionGroup.dataset.from = conn.from;
            connectionGroup.dataset.to = conn.to;

            // Calculate path details
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const offset = dist * 0.03;
            const curveX = midX - (dy / dist) * offset;
            const curveY = midY + (dx / dist) * offset;

            const pathD = `M ${from.x} ${from.y} Q ${curveX} ${curveY} ${to.x} ${to.y}`;

            // 1. Base path - dark earthy trail
            const basePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            basePath.setAttribute('d', pathD);
            basePath.setAttribute('fill', 'none');
            basePath.style.stroke = '#1a0f0a';
            basePath.style.strokeWidth = '12';
            basePath.style.strokeLinecap = 'round';
            basePath.style.opacity = '0.6';
            connectionGroup.appendChild(basePath);

            // 2. Forest floor layer - mossy green/brown
            const mossPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            mossPath.setAttribute('d', pathD);
            mossPath.setAttribute('fill', 'none');
            mossPath.style.stroke = '#2d4a2d';
            mossPath.style.strokeWidth = '8';
            mossPath.style.strokeLinecap = 'round';
            mossPath.style.opacity = '0.5';
            connectionGroup.appendChild(mossPath);

            // Deterministic seed for this connection's decorations
            const connSeed = this._hashStr(conn.from + ':' + conn.to);
            const rand = this._seededRand(connSeed);

            // 3. Stepping stones along the path
            const stoneCount = Math.floor(dist / 40);
            if (stoneCount > 0) {
                for (let i = 0; i <= stoneCount; i++) {
                    const t = i / stoneCount;
                    const stoneX = (1-t)*(1-t)*from.x + 2*(1-t)*t*curveX + t*t*to.x;
                    const stoneY = (1-t)*(1-t)*from.y + 2*(1-t)*t*curveY + t*t*to.y;

                    const stone = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                    stone.setAttribute('cx', stoneX);
                    stone.setAttribute('cy', stoneY);
                    stone.setAttribute('rx', 6 + rand() * 4);
                    stone.setAttribute('ry', 4 + rand() * 3);
                    stone.setAttribute('fill', '#3a3a4a');
                    stone.setAttribute('opacity', '0.7');
                    stone.style.filter = 'url(#soft-glow)';
                    connectionGroup.appendChild(stone);
                }
            }

            // 4. Damaged/dead trees along the path (alternating sides)
            const treeCount = Math.floor(dist / 60);
            for (let i = 0; i < treeCount; i++) {
                const t = (i + 0.5) / treeCount;
                const treeX = (1-t)*(1-t)*from.x + 2*(1-t)*t*curveX + t*t*to.x;
                const treeY = (1-t)*(1-t)*from.y + 2*(1-t)*t*curveY + t*t*to.y;

                // Alternate left/right of path
                const side = i % 2 === 0 ? 1 : -1;
                const perpX = -dy / dist * 25 * side;
                const perpY = dx / dist * 25 * side;

                // Create damaged tree trunk
                const treeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                // Main trunk - broken/damaged
                const trunk = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                trunk.setAttribute('d', `M ${treeX + perpX} ${treeY + perpY} Q ${treeX + perpX - 3} ${treeY + perpY - 20} ${treeX + perpX + 2} ${treeY + perpY - 35}`);
                trunk.setAttribute('stroke', '#2a1a1a');
                trunk.setAttribute('stroke-width', '4');
                trunk.setAttribute('fill', 'none');
                trunk.setAttribute('stroke-linecap', 'round');
                treeGroup.appendChild(trunk);

                // Broken branches
                const branch1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                branch1.setAttribute('x1', treeX + perpX - 2);
                branch1.setAttribute('y1', treeY + perpY - 15);
                branch1.setAttribute('x2', treeX + perpX - 12);
                branch1.setAttribute('y2', treeY + perpY - 8);
                branch1.setAttribute('stroke', '#2a1a1a');
                branch1.setAttribute('stroke-width', '2');
                treeGroup.appendChild(branch1);

                const branch2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                branch2.setAttribute('x1', treeX + perpX + 1);
                branch2.setAttribute('y1', treeY + perpY - 25);
                branch2.setAttribute('x2', treeX + perpX + 10);
                branch2.setAttribute('y2', treeY + perpY - 20);
                branch2.setAttribute('stroke', '#2a1a1a');
                branch2.setAttribute('stroke-width', '2');
                treeGroup.appendChild(branch2);

                treeGroup.setAttribute('opacity', '0.6');
                connectionGroup.appendChild(treeGroup);
            }

            // 5. Mystical purple energy veins (subtle, static)
            const energyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            energyPath.setAttribute('d', pathD);
            energyPath.setAttribute('fill', 'none');
            energyPath.style.stroke = '#7c3aed';
            energyPath.style.strokeWidth = '2';
            energyPath.style.strokeLinecap = 'round';
            energyPath.style.opacity = '0.3';
            energyPath.style.filter = 'url(#soft-glow)';
            connectionGroup.appendChild(energyPath);

            // 6. Floating embers/particles along the path
            const emberCount = Math.floor(dist / 50);
            for (let i = 0; i < emberCount; i++) {
                const t = (i + rand() * 0.5) / emberCount;
                const emberX = (1-t)*(1-t)*from.x + 2*(1-t)*t*curveX + t*t*to.x + (rand() - 0.5) * 20;
                const emberY = (1-t)*(1-t)*from.y + 2*(1-t)*t*curveY + t*t*to.y + (rand() - 0.5) * 20;

                const ember = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                ember.setAttribute('cx', emberX);
                ember.setAttribute('cy', emberY);
                ember.setAttribute('r', 1.5 + rand());
                ember.setAttribute('fill', '#a78bfa');
                ember.setAttribute('opacity', '0.5');
                ember.style.animation = `emberFloat ${3 + rand() * 2}s ease-in-out infinite`;
                ember.style.animationDelay = `${rand() * 2}s`;
                connectionGroup.appendChild(ember);
            }

            // 7. Ethereal mist patches
            const mistCount = Math.floor(dist / 80);
            for (let i = 0; i < mistCount; i++) {
                const t = (i + 0.5) / mistCount;
                const mistX = (1-t)*(1-t)*from.x + 2*(1-t)*t*curveX + t*t*to.x;
                const mistY = (1-t)*(1-t)*from.y + 2*(1-t)*t*curveY + t*t*to.y;

                const mist = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                mist.setAttribute('cx', mistX);
                mist.setAttribute('cy', mistY);
                mist.setAttribute('rx', 20 + rand() * 15);
                mist.setAttribute('ry', 8 + rand() * 6);
                mist.setAttribute('fill', 'url(#mistGradient)');
                mist.setAttribute('opacity', '0.3');
                mist.style.animation = `mistDrift ${5 + rand() * 5}s ease-in-out infinite`;
                mist.style.animationDelay = `${rand() * 2}s`;
                connectionGroup.appendChild(mist);
            }

            // In edit mode, click on a path to delete it
            if (this.isEditMode) {
                connectionGroup.style.cursor = 'pointer';
                connectionGroup.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._deleteConnection(conn.from, conn.to);
                });
            }

            this.layers.paths.appendChild(connectionGroup);
        });

        // In path creation mode, show preview line
        if (this.pathCreationMode && this.pathStartBase) {
            this._renderPathPreview();
        }
    }

    /**
     * Render path preview during creation
     */
    _renderPathPreview() {
        const fromPercent = this.baseSystem.getCenter(this.pathStartBase);
        if (!fromPercent) return;

        // Convert start point to pixels
        const from = this.percentToPixels(fromPercent.x, fromPercent.y);

        // Mouse pos is percentage, convert to pixels accounting for pan/zoom
        const ctm = this.transformGroup?.getScreenCTM();
        let toX, toY;
        if (ctm) {
            const svgPoint = this.svg.createSVGPoint();
            svgPoint.x = this.mousePos.x;
            svgPoint.y = this.mousePos.y;
            const transformed = svgPoint.matrixTransform(ctm.inverse());
            const rect = this.svg.getBoundingClientRect();
            toX = transformed.x * rect.width / this.svg.viewBox.baseVal.width;
            toY = transformed.y * rect.height / this.svg.viewBox.baseVal.height;
        } else {
            const rect = this.svg.getBoundingClientRect();
            toX = this.mousePos.x * rect.width / 100;
            toY = this.mousePos.y * rect.height / 100;
        }

        const preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        preview.setAttribute('class', 'connection-path-preview');

        const dx = toX - from.x;
        const dy = toY - from.y;
        const midX = from.x + dx / 2;
        const midY = from.y + dy / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = dist * CONFIG.pathCurvature;
        const curveX = midX - (dy / dist) * offset;
        const curveY = midY + (dx / dist) * offset;

        preview.setAttribute('d', `M ${from.x} ${from.y} Q ${curveX} ${curveY} ${toX} ${toY}`);
        preview.style.stroke = '#10b981';
        preview.style.strokeWidth = '2';
        preview.style.strokeOpacity = '0.7';
        preview.style.strokeDasharray = '6, 4';
        preview.style.filter = 'url(#medium-glow)';
        preview.style.pointerEvents = 'none';

        this.layers.paths.appendChild(preview);
    }

    /**
     * Render base borders (gameplay mode)
     */
    renderBaseBorders() {
        if (!this.layers.borders || this.isEditMode) {
            this.layers.borders.innerHTML = '';
            return;
        }

        const bases = this.baseSystem.getAll();

        bases.forEach(base => {
            // Waypoints: no border rings, just the diamond icon
            if (base.type === 'waypoint' || base.type === 'Waypoint') return;

            const centerPercent = this.baseSystem.getCenter(base.id);
            if (!centerPercent) return;

            // Convert to pixel coordinates
            const center = this.percentToPixels(centerPercent.x, centerPercent.y);

            const style = getBaseStyle(base.type);
            const isCapital = (base.type === 'capital' || base.type === 'king-base');
            const isOwned = base.owner !== null;

            // Main border - subtle ring
            const border = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            border.setAttribute('class', 'base-border');
            border.setAttribute('data-base', base.id);
            border.setAttribute('cx', center.x);
            border.setAttribute('cy', center.y);
            border.setAttribute('r', style.radius * 2);
            border.style.fill = 'transparent';
            border.style.stroke = isOwned ? style.color : 'rgba(100, 100, 120, 0.4)';
            border.style.strokeWidth = isCapital ? '3' : '2';
            border.style.strokeOpacity = isOwned ? '0.6' : '0.3';
            border.style.filter = isOwned ? 'url(#soft-glow)' : 'none';

            // Capital extra ring (subtle)
            if (isCapital && isOwned) {
                const capitalRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                capitalRing.setAttribute('cx', center.x);
                capitalRing.setAttribute('cy', center.y);
                capitalRing.setAttribute('r', style.radius * 2.5);
                capitalRing.style.fill = 'none';
                capitalRing.style.stroke = '#f4d03f';
                capitalRing.style.strokeWidth = '1.5';
                capitalRing.style.strokeOpacity = '0.4';
                capitalRing.style.filter = 'url(#soft-glow)';
                this.layers.borders.appendChild(capitalRing);
            }

            this.layers.borders.appendChild(border);
        });
    }

    /**
     * Convert percentage coordinates (0-100) to SVG pixel coordinates
     */
    percentToPixels(x, y) {
        // Use stored SVG dimensions (set during init/resize)
        const width = this.svgWidth || 1200;
        const height = this.svgHeight || 800;

        return {
            x: (x / 100) * width,
            y: (y / 100) * height
        };
    }

    /**
     * Render base markers (editor or gameplay mode)
     */
    renderBaseMarkers() {
        if (!this.layers.markers) return;
        this.layers.markers.innerHTML = '';

        const bases = this.baseSystem.getAll();

        bases.forEach(base => {
            const center = this.baseSystem.getCenter(base.id);
            if (!center) return;

            // Convert percentage to pixel coordinates
            const pixelCenter = this.percentToPixels(center.x, center.y);

            const style = getBaseStyle(base.type);
            const isCapital = (base.type === 'capital' || base.type === 'king-base');

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'base-marker');
            group.setAttribute('data-base', base.id);
            group.style.cursor = this.isEditMode ? 'move' : 'pointer';
            group.style.pointerEvents = 'bounding-box';

            if (this.isEditMode) {
                // EDIT MODE: Draggable marker with coordinates
                this._renderEditorMarker(group, base, pixelCenter, style, isCapital);
            } else {
                // GAMEPLAY MODE: Static clickable marker
                this._renderGameplayMarker(group, base, pixelCenter, style, isCapital);
            }

            this.layers.markers.appendChild(group);
        });
    }

    /**
     * Render editor mode marker (draggable)
     */
    _renderEditorMarker(group, base, center, style, isCapital) {
        // Determine if this is a custom base
        const isCustomBase = base.id.startsWith('custom-province-');
        const isWaypoint = base.type === 'waypoint' || base.type === 'Waypoint';
        const markerRadius = isCustomBase ? CONFIG.editorSubBaseRadius : CONFIG.editorMarkerRadius;

        // Waypoints: no rings, just diamond icon + labels
        if (!isWaypoint) {
            // Outer glow
            const glowRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glowRing.setAttribute('cx', center.x);
            glowRing.setAttribute('cy', center.y);
            glowRing.setAttribute('r', markerRadius + 8);
            glowRing.style.fill = 'none';
            glowRing.style.stroke = isCapital ? '#f4d03f' : style.color;
            glowRing.style.strokeWidth = '2';
            glowRing.style.strokeDasharray = '4, 4';
            glowRing.style.opacity = '0.6';
            glowRing.style.filter = 'url(#editor-glow)';
            glowRing.style.pointerEvents = 'none';
            group.appendChild(glowRing);

            // Main marker circle
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', center.x);
            marker.setAttribute('cy', center.y);
            marker.setAttribute('r', markerRadius);
            marker.style.fill = 'rgba(20, 20, 35, 0.9)';
            marker.style.stroke = isCapital ? '#f4d03f' : style.color;
            marker.style.strokeWidth = '3';
            marker.style.filter = 'url(#medium-glow)';
            marker.style.cursor = 'move';
            group.appendChild(marker);
        }

        // Base type icon
        let icon;
        const iconSize = isCustomBase ? style.radius * 0.4 : style.radius * 0.6;
        if (isCapital) {
            icon = this._createCrown(center.x, center.y, style.radius * 0.7, '#f4d03f');
        } else if (isWaypoint) {
            // Waypoint: larger diamond, keep clickable (no pointer-events: none)
            icon = this._createShinyDiamond(center.x, center.y, style.radius * 0.85);
        } else {
            icon = this._createDiamond(center.x, center.y, iconSize, style.color);
        }
        // Pass clicks through icon to parent group (except waypoints which need clickable area)
        if (!isWaypoint) {
            icon.style.pointerEvents = 'none';
        }

        // Base name label (custom base names only shown when toggle is on)
        const showName = !isCustomBase || this.showCustomBaseNames;
        const nameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameLabel.setAttribute('x', center.x);
        nameLabel.setAttribute('y', center.y - markerRadius - 14);
        nameLabel.setAttribute('text-anchor', 'middle');
        nameLabel.textContent = base.name;
        nameLabel.style.fill = '#f0f0f5';
        nameLabel.style.fontSize = isCustomBase ? '11px' : `${CONFIG.editorFontSize}px`;
        nameLabel.style.fontWeight = '700';
        nameLabel.style.textShadow = '0 2px 6px rgba(0,0,0,0.95)';
        nameLabel.style.pointerEvents = 'none';
        nameLabel.style.display = showName && this.mapLabelsVisible ? 'block' : 'none';

        // Coordinates label (real-time position)
        const coordsLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        coordsLabel.setAttribute('x', center.x);
        coordsLabel.setAttribute('y', center.y + markerRadius + 20);
        coordsLabel.setAttribute('text-anchor', 'middle');
        coordsLabel.textContent = `(${Math.round(base.x)}, ${Math.round(base.y)})`;
        coordsLabel.style.fill = '#4ade80';
        coordsLabel.style.fontSize = isCustomBase ? '9px' : `${CONFIG.editorCoordsFontSize}px`;
        coordsLabel.style.fontFamily = 'monospace';
        coordsLabel.style.fontWeight = '600';
        coordsLabel.style.pointerEvents = 'none';
        coordsLabel.style.display = this.mapLabelsVisible ? 'block' : 'none';

        // Drag handle indicator
        const handleLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        handleLabel.setAttribute('x', center.x);
        handleLabel.setAttribute('y', center.y + markerRadius + 36);
        handleLabel.setAttribute('text-anchor', 'middle');
        handleLabel.textContent = isCustomBase ? '✥ Custom' : '✥ Click to move';
        handleLabel.style.fill = isCustomBase ? '#60a5fa' : '#a78bfa';
        handleLabel.style.fontSize = '9px';
        handleLabel.style.fontWeight = '500';
        handleLabel.style.pointerEvents = 'none';
        handleLabel.style.display = this.mapLabelsVisible ? 'block' : 'none';

        group.appendChild(icon);
        group.appendChild(nameLabel);
        group.appendChild(coordsLabel);
        group.appendChild(handleLabel);

        // Click to pick up / click to place; Shift+click or Connect mode for path creation
        group.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Left-click in delete mode: remove the base
            if (this.deleteMode && e.button === 0) {
                this._deleteBase(base.id);
                return;
            }

            // Right-click in delete mode: also remove
            if (this.deleteMode && e.button === 2) {
                this._deleteBase(base.id);
                return;
            }

            // Left-click while in path creation mode (or Shift+click): connect bases
            if (e.button === 0 && (e.shiftKey || this.pathCreationMode)) {
                this._justHandledPickDrop = true;
                this._onBaseClick(base.id);
                return;
            }

            // In delete mode but neither left nor right click: ignore
            if (this.deleteMode) return;

            // Left click (move mode or no mode): pick up / drop toggle
            if (e.button === 0) {
                this._justHandledPickDrop = true;
                if (this.carryingBaseId === base.id) {
                    this._dropBase();
                } else if (this.carryingBaseId && this.carryingBaseId !== base.id) {
                    this._dropBase();
                    this._pickUpBase(base.id);
                } else if (!this.carryingBaseId) {
                    this._pickUpBase(base.id);
                } else {
                    this._justHandledPickDrop = false;
                }
            }
        });

        // Suppress click event after pick/drop handled by mousedown
        group.addEventListener('click', (e) => {
            if (this._justHandledPickDrop) {
                this._justHandledPickDrop = false;
                return;
            }
        });

        // Context menu (disable default, show delete hint)
        group.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Render gameplay mode marker (static)
     */
    _renderGameplayMarker(group, base, center, style, isCapital) {
        const isCustomBase = base.id.startsWith('custom-province-');
        const isEnemyKing = base.type === 'enemy-king-base';
        const showHP = isCapital || isEnemyKing;

        // Icon - Crown for capital, Shiny Diamond for others
        let icon;
        if (showHP) {
            const crownColor = isEnemyKing ? '#ef4444' : '#f4d03f';
            icon = this._createCrown(center.x, center.y, style.radius * 0.7, crownColor);
            const glowGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            glowGroup.style.filter = 'url(#strong-glow)';
            glowGroup.style.pointerEvents = 'none';
            glowGroup.appendChild(icon);
            icon = glowGroup;

            // Ring around crown
            const crownRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            crownRing.setAttribute('cx', center.x);
            crownRing.setAttribute('cy', center.y);
            crownRing.setAttribute('r', style.radius * 1.8);
            crownRing.setAttribute('fill', 'none');
            crownRing.setAttribute('stroke', crownColor);
            crownRing.setAttribute('stroke-width', '2.5');
            crownRing.style.filter = 'url(#strong-glow)';
            crownRing.style.opacity = '0.7';
            crownRing.style.pointerEvents = 'none';
            group.appendChild(crownRing);

            // HP display — dynamic from game state
            const gs = window.gameState;
            const hpData = gs && gs.kingBaseHP ? gs.kingBaseHP[base.id] : null;
            const hpCurrent = hpData ? hpData.current : 8000;
            const hpMax = hpData ? hpData.max : 8000;
            const hpPct = hpMax > 0 ? hpCurrent / hpMax : 0;
            const hpColor = isEnemyKing ? '#ef4444' : '#f4d03f';
            const hpBarBg = isEnemyKing ? 'rgba(80,20,20,0.85)' : 'rgba(0,0,0,0.85)';

            const boxW = 100;
            const boxH = 40;
            const boxY = center.y - style.radius * 4.8;

            const lpBox = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            lpBox.style.pointerEvents = 'none';

            // Background
            const lpBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            lpBg.setAttribute('x', center.x - boxW / 2);
            lpBg.setAttribute('y', boxY);
            lpBg.setAttribute('width', boxW);
            lpBg.setAttribute('height', boxH);
            lpBg.setAttribute('rx', 2);
            lpBg.style.fill = hpBarBg;
            lpBg.style.stroke = hpColor;
            lpBg.style.strokeWidth = '1';
            lpBg.style.filter = 'url(#strong-glow)';
            lpBox.appendChild(lpBg);

            // HP bar background
            const barBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            barBg.setAttribute('x', center.x - boxW / 2 + 6);
            barBg.setAttribute('y', boxY + boxH - 12);
            barBg.setAttribute('width', boxW - 12);
            barBg.setAttribute('height', 6);
            barBg.setAttribute('rx', 2);
            barBg.style.fill = 'rgba(255,255,255,0.1)';
            lpBox.appendChild(barBg);

            // HP bar fill
            const barFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            barFill.setAttribute('x', center.x - boxW / 2 + 6);
            barFill.setAttribute('y', boxY + boxH - 12);
            barFill.setAttribute('width', Math.max(0, (boxW - 12) * hpPct));
            barFill.setAttribute('height', 6);
            barFill.setAttribute('rx', 2);
            barFill.style.fill = hpColor;
            barFill.style.filter = hpPct < 0.3 ? 'url(#strong-glow)' : 'none';
            lpBox.appendChild(barFill);

            // HP text
            const lpText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            lpText.setAttribute('x', center.x);
            lpText.setAttribute('y', boxY + 18);
            lpText.setAttribute('text-anchor', 'middle');
            lpText.textContent = hpCurrent;
            lpText.style.fill = hpColor;
            lpText.style.fontSize = '18px';
            lpText.style.fontWeight = '700';
            lpText.style.fontFamily = 'Segoe UI, sans-serif';
            lpText.style.letterSpacing = '2px';
            lpBox.appendChild(lpText);

            group.appendChild(lpBox);
        } else {
            // Waypoints get a slightly larger diamond than bases
            const iconScale = (base.type === 'waypoint' || base.type === 'Waypoint') ? 0.85 : 0.6;
            icon = this._createShinyDiamond(center.x, center.y, style.radius * iconScale);
        }
        // Pass clicks through icon to parent group
        if (icon) icon.style.pointerEvents = 'none';

        // Label background (only show if not a custom base or toggle is on)
        // Waypoints: only show label for junctions (3+ connections) or isolated (0)
        // unless waypoint names are toggled off entirely
        const isWaypoint = base.type === 'waypoint' || base.type === 'Waypoint';
        const neighborCount = (base.neighbors && base.neighbors.length) || 0;
        const waypointShowLabel = !isWaypoint || (this.showWaypointNames && (neighborCount === 0 || neighborCount >= 3));
        const showLabel = (!isCustomBase || this.showCustomBaseNames) && waypointShowLabel;

        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', center.x - 50);
        labelBg.setAttribute('y', center.y + style.radius + 4);
        labelBg.setAttribute('width', 100);
        labelBg.setAttribute('height', 20);
        labelBg.setAttribute('rx', 4);
        labelBg.style.fill = 'rgba(5, 5, 10, 0.35)';
        labelBg.style.stroke = base.owner ? style.color : '#3a3a4a';
        labelBg.style.strokeWidth = '0.5';
        labelBg.style.filter = 'url(#label-shadow)';
        labelBg.style.display = showLabel ? 'block' : 'none';
        labelBg.style.pointerEvents = 'none';

        // Label text
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', center.x);
        label.setAttribute('y', center.y + style.radius + 19);
        label.setAttribute('text-anchor', 'middle');
        label.textContent = base.name;
        label.style.fill = '#f5f5f8';
        label.style.fontSize = '11px';
        label.style.fontWeight = '400';
        label.style.fontFamily = 'Segoe UI, sans-serif';
        label.style.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
        label.style.letterSpacing = '0.3px';
        label.style.pointerEvents = 'none';
        label.style.display = showLabel ? 'block' : 'none';

        // Owner dot
        if (base.owner) {
            const ownerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ownerDot.setAttribute('cx', center.x);
            ownerDot.setAttribute('cy', center.y + style.radius + 12);
            ownerDot.setAttribute('r', 3);
            ownerDot.style.fill = style.color;
            ownerDot.style.filter = 'url(#strong-glow)';
            ownerDot.style.pointerEvents = 'none';
            group.appendChild(ownerDot);
        }

        group.appendChild(labelBg);
        group.appendChild(icon);
        group.appendChild(label);

        // Tooltip on hover — populate #base-tooltip with real base data
        const showTooltip = (e) => {
            const tooltip = document.getElementById('base-tooltip');
            const nameEl = document.getElementById('tooltip-name');
            const typeEl = document.getElementById('tooltip-type');
            const descEl = document.getElementById('tooltip-desc');

            if (nameEl) nameEl.textContent = base.name;
            if (typeEl) typeEl.textContent = base.type || 'Base';
            if (descEl) descEl.textContent = base.description || '';

            if (tooltip) {
                let x = e.clientX + 16;
                let y = e.clientY + 16;
                const rect = tooltip.getBoundingClientRect();
                if (x + rect.width > window.innerWidth - 10) x = e.clientX - rect.width - 16;
                if (y + rect.height > window.innerHeight - 10) y = e.clientY - rect.height - 16;
                if (x < 10) x = 10;
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateY(0)';
            }
        };

        const hideTooltip = () => {
            const tooltip = document.getElementById('base-tooltip');
            if (tooltip) {
                tooltip.style.opacity = '0';
                tooltip.style.transform = 'translateY(8px)';
            }
        };

        group.addEventListener('mouseenter', showTooltip);
        group.addEventListener('mousemove', showTooltip);
        group.addEventListener('mouseleave', hideTooltip);

        group.addEventListener('pointerdown', (e) => {
            // Block the map's panning from starting — but DON'T select the base yet.
            // Selection happens on click (release), so it feels like a normal click.
            e.stopPropagation();
        });
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTooltip();
            // Select base for gameplay — pass screen coords for context popup
            this.selectBase(base.id, e.clientX, e.clientY);
        });
    }

    /**
     * Handle mouse move (carrying base and path preview)
     */
    _onMouseMove(e) {
        const rect = this.svg.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;

        // Store mouse position in percentage for path preview / carry
        this.mousePos = {
            x: (pixelX / rect.width) * 100,
            y: (pixelY / rect.height) * 100
        };

        if (this.carryingBaseId) {
            const newPercentX = Math.max(2, Math.min(98, this.mousePos.x));
            const newPercentY = Math.max(2, Math.min(98, this.mousePos.y));

            this.baseSystem.updatePosition(this.carryingBaseId, newPercentX, newPercentY);

            // Only update marker position during carry (paths refresh on drop)
            const newPixelPos = this.percentToPixels(newPercentX, newPercentY);
            this._updateCarriedMarkerPosition(this.carryingBaseId, newPixelPos.x, newPixelPos.y);
        }

        if (this.pathCreationMode && this.pathStartBase) {
            this.renderConnectionPaths();
        }
    }

    /**
     * Handle click on SVG (add base or deselect)
     */
    _onSVGClick(e) {
        // Only handle clicks on the background (not on bases or decorations)
        if (e.target.closest('.base-marker')) return;
        if (e.target.closest('.placed-decoration')) return;

        const rect = this.svg.getBoundingClientRect();
        const pixelX = e.clientX - rect.left;
        const pixelY = e.clientY - rect.top;
        const percentX = (pixelX / rect.width) * 100;
        const percentY = (pixelY / rect.height) * 100;

        // Drop carried base on background click
        if (this.carryingBaseId) {
            this._dropBase();
            return;
        }

        // Add base mode
        if (this.isEditMode && this.addBaseMode) {
            this._addBaseAt(percentX, percentY);
            return;
        }

        // Cancel in-progress connection if clicking background (stay in connect mode)
        if (this.pathCreationMode && this.pathStartBase) {
            this.pathStartBase = null;
            this._clearConnectionHighlight();
            this.renderConnectionPaths();
            this._setEditorStatus('Connect Mode: Click first base, then second base to create a path');
        }
    }

    /**
     * Add a new base at the specified location
     */
    _addBaseAt(percentX, percentY) {
        this.newBaseCounter++;
        const type = this.newBaseType || 'base';
        let name;
        if (type === 'king-base') name = `New King Base ${this.newBaseCounter}`;
        else if (type === 'waypoint') name = `New Waypoint ${this.newBaseCounter}`;
        else if (type === 'player-base') name = `Player Base ${this.newBaseCounter}`;
        else if (type === 'enemy-base') name = `Enemy Base ${this.newBaseCounter}`;
        else name = `New Base ${this.newBaseCounter}`;

        const newBase = {
            id: `custom-${type}-${Date.now()}`,
            name,
            type,
            x: Math.round(percentX),
            y: Math.round(percentY),
            neighbors: [],
            owner: null,
            continent: 'voxya',
            description: `Custom ${type} created in editor mode`
        };

        this.baseSystem.addBase(newBase);
        this.renderAll();
    }

    /**
     * Set the type of base to add in editor mode.
     * @param {'base'|'waypoint'|'king-base'} type
     */
    setAddBaseType(type) {
        this.newBaseType = type;
        this.addBaseMode = true;
        this.pathCreationMode = false;
        this.pathStartBase = null;
        this.deleteMode = false;
    }

    /**
     * Pick up a base — it follows the cursor until dropped
     */
    _pickUpBase(baseId) {
        this.carryingBaseId = baseId;
        const group = this.layers.markers?.querySelector(
            `.base-marker[data-base="${baseId}"]`
        );
        if (group) group.classList.add('carried');
    }

    /**
     * Drop the currently carried base at its current position
     */
    _dropBase() {
        const baseId = this.carryingBaseId;
        if (!baseId) return;
        this.carryingBaseId = null;
        const group = this.layers.markers?.querySelector(
            `.base-marker[data-base="${baseId}"]`
        );
        if (group) group.classList.remove('carried');
        this.renderConnectionPaths();
        this.renderBaseMarkers();
    }

    /**
     * Update position of currently carried marker without full re-render
     */
    _updateCarriedMarkerPosition(baseId, x, y) {
        const group = this.layers.markers?.querySelector(`.base-marker[data-base="${baseId}"]`);
        if (!group) return;

        const base = this.baseSystem.getById(baseId);
        if (!base) return;

        const isCapital = (base.type === 'capital' || base.type === 'king-base');
        const style = getBaseStyle(base.type);

        // Update all child elements to new position
        const children = group.children;
        for (const child of children) {
            if (child.tagName === 'circle') {
                child.setAttribute('cx', x);
                child.setAttribute('cy', y);
            } else if (child.tagName === 'polygon') {
                // Update star/diamond icon position
                const iconType = isCapital ? 'star' : 'diamond';
                const size = isCapital ? style.radius * 0.8 : style.radius * 0.6;
                if (iconType === 'star') {
                    const points = this._createStarPoints(x, y, size);
                    child.setAttribute('points', points);
                } else {
                    child.setAttribute('points', `${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`);
                }
            } else if (child.tagName === 'text') {
                const yAttr = child.getAttribute('y');
                if (yAttr && parseFloat(yAttr) < y - CONFIG.editorMarkerRadius) {
                    // Name label above
                    child.setAttribute('y', y - CONFIG.editorMarkerRadius - 12);
                } else if (yAttr && parseFloat(yAttr) > y + CONFIG.editorMarkerRadius) {
                    // Coords or drag label below
                    const isCoords = child.textContent.includes('(');
                    child.setAttribute('y', isCoords ? y + CONFIG.editorMarkerRadius + 18 : y + CONFIG.editorMarkerRadius + 30);
                }
            }
        }
    }

    _createStarPoints(cx, cy, radius) {
        const points = [];
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radius : radius * 0.5;
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        return points.join(' ');
    }

    /**
     * Handle base click (path creation)
     */
    _onBaseClick(baseId) {
        if (!this.pathCreationMode) return;

        // If no start base yet (first click), set it and begin
        if (!this.pathStartBase) {
            this.pathStartBase = baseId;
            this.renderConnectionPaths();
            this._highlightConnectionStart(baseId);
            console.log('[Editor] Path start:', baseId);
            this._setEditorStatus('Connect Mode: Now click a second base to connect');
        } else if (this.pathStartBase === baseId) {
            // Click same base again — cancel this connection attempt
            this.pathStartBase = null;
            this._clearConnectionHighlight();
            this.renderConnectionPaths();
            console.log('[Editor] Path cancelled');
            this._setEditorStatus('Connect Mode: Click first base, then second base to create a path');
        } else {
            // Complete path between two different bases
            const success = this.baseSystem.addConnection(this.pathStartBase, baseId);
            console.log('[Editor] Path created:', this.pathStartBase, '->', baseId, 'success:', success);
            // Clear the start highlight
            this._clearConnectionHighlight();
            this.pathStartBase = null;
            // Just re-render connection paths — DON'T call renderAll() (breaks event loop)
            this.renderConnectionPaths();
            if (success) {
                this._setEditorStatus('Connect Mode: Path created! Click another pair or press Connect to exit');
            } else {
                this._setEditorStatus('Connect Mode: Connection failed (may already exist). Try again');
            }
        }
    }

    /**
     * Highlight a base as the start of a connection
     */
    _highlightConnectionStart(baseId) {
        // Remove any existing highlight
        this._clearConnectionHighlight();
        const group = this.layers.markers?.querySelector(`.base-marker[data-base="${baseId}"]`);
        if (!group) return;
        // Add a prominent class or ring
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('class', 'connection-start-ring');
        const marker = group.querySelector('circle');
        if (!marker) return;
        const r = parseFloat(marker.getAttribute('r') || '12') + 6;
        ring.setAttribute('cx', marker.getAttribute('cx'));
        ring.setAttribute('cy', marker.getAttribute('cy'));
        ring.setAttribute('r', r);
        ring.style.fill = 'none';
        ring.style.stroke = '#f4d03f';
        ring.style.strokeWidth = '2.5';
        ring.style.strokeDasharray = '6, 3';
        ring.style.filter = 'url(#strong-glow)';
        ring.style.pointerEvents = 'none';
        group.appendChild(ring);
    }

    /**
     * Clear connection start highlight
     */
    _clearConnectionHighlight() {
        document.querySelectorAll('.connection-start-ring').forEach(el => el.remove());
    }

    /**
     * Set editor status text — falls back to global status method
     */
    _setEditorStatus(text) {
        const el = document.getElementById('editor-status');
        if (el) { el.textContent = text; return; }
        if (typeof setStatus === 'function') setStatus(text);
    }

    /**
     * Clean up editor state when switching modes — drops carried base,
     * clears connection highlights, and resets path creation state
     */
    _handleModeSwitch() {
        if (this.carryingBaseId) {
            this._dropBase();
        }
        this._clearConnectionHighlight();
        this.pathCreationMode = false;
        this.pathStartBase = null;
        this.addBaseMode = false;
        this.deleteMode = false;
    }

    /**
     * Delete a connection
     */
    _deleteConnection(id1, id2) {
        if (!this.isEditMode) return;

        const success = this.baseSystem.removeConnection(id1, id2);
        if (success) {
            this.renderAll();
        }
    }

    /**
     * Delete a base (only custom ones)
     */
    _deleteBase(baseId) {
        if (!this.isEditMode) return;

        const success = this.baseSystem.removeBase(baseId);
        if (success) {
            if (this.carryingBaseId === baseId) {
                this.carryingBaseId = null;
            }
            this.renderAll();
        }
    }

    /**
     * Export current layout
     */
    exportLayout() {
        const data = this.baseSystem.exportToJSON();
        const json = JSON.stringify(data, null, 2);

        // Create download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'voxya-bases.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return json;
    }

    /**
     * Render selection highlight
     */
    renderSelection() {
        if (!this.layers.selection) return;
        const existingSelection = this.layers.selection.querySelector('.base-selection');
        if (existingSelection) existingSelection.remove();

        // Clear selection layer if toggled off
        if (!this.showSelectionEffects) {
            this.layers.selection.innerHTML = '';
            return;
        }

        if (!this.selectedBaseId) return;

        const centerPercent = this.baseSystem.getCenter(this.selectedBaseId);
        if (!centerPercent) return;

        // Convert to pixel coordinates
        const center = this.percentToPixels(centerPercent.x, centerPercent.y);

        const base = this.baseSystem.getById(this.selectedBaseId);
        const style = getBaseStyle(base.type);
        const isOwned = base.owner !== null;

        const selectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        selectionGroup.setAttribute('class', 'base-selection');

        const selectRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        selectRing.setAttribute('cx', center.x);
        selectRing.setAttribute('cy', center.y);
        selectRing.setAttribute('r', 18);
        selectRing.style.fill = 'none';
        selectRing.style.stroke = isOwned ? style.color : '#10b981';
        selectRing.style.strokeWidth = '2';
        selectRing.style.filter = 'url(#strong-glow)';
        selectRing.style.strokeOpacity = '0.9';

        const innerGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerGlow.setAttribute('cx', center.x);
        innerGlow.setAttribute('cy', center.y);
        innerGlow.setAttribute('r', 10);
        innerGlow.style.fill = isOwned ? style.glow : 'rgba(16, 185, 129, 0.25)';
        innerGlow.style.opacity = '0.4';
        innerGlow.style.filter = 'url(#medium-glow)';

        selectionGroup.appendChild(selectRing);
        selectionGroup.appendChild(innerGlow);
        this.layers.selection.appendChild(selectionGroup);
    }

    /**
     * Render movement trails
     */
    renderTrails(trails) {
        const oldTrails = this.layers.selection?.querySelectorAll('.movement-trail');
        oldTrails?.forEach(t => t.remove());

        // Skip rendering if selection effects are toggled off
        if (!this.showSelectionEffects) return;

        if (!this.layers.selection || !trails || trails.length === 0) return;

        trails.forEach(trail => {
            if (trail.path.length < 2) return;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'movement-trail');
            let d = `M ${trail.path[0].x} ${trail.path[0].y}`;
            for (let i = 1; i < trail.path.length; i++) {
                const from = trail.path[i - 1];
                const to = trail.path[i];
                const midX = (from.x + to.x) / 2;
                const midY = (from.y + to.y) / 2;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const offset = dist * 0.08;
                const curveX = midX - (dy / dist) * offset * 5;
                const curveY = midY + (dx / dist) * offset * 5;
                d += ` Q ${curveX} ${curveY} ${to.x} ${to.y}`;
            }
            path.setAttribute('d', d);
            path.style.fill = 'none';
            path.style.stroke = '#a78bfa';
            path.style.strokeWidth = '4';
            path.style.strokeLinecap = 'round';
            path.style.strokeOpacity = trail.opacity.toString();
            path.style.filter = 'url(#unit-glow)';
            path.style.pointerEvents = 'none';
            this.layers.selection.appendChild(path);
        });
    }

    drawMovementTrail(path, opacity = 0.8) {
        this.renderTrails([{ path, age: 0, maxAge: 1, opacity }]);
    }

    selectBase(baseId, clientX, clientY) {
        console.log('[Renderer] selectBase called:', baseId, 'clientX:', clientX, 'clientY:', clientY);
        this.selectedBaseId = baseId;
        this.renderSelection();

        // Dispatch custom event on the SVG
        const event = new CustomEvent('baseSelected', {
            detail: { baseId, clientX, clientY },
            bubbles: true
        });
        // Use the global handler directly instead of dispatching a custom event.
        // The custom event was causing a double-call (the event handler plus the
        // direct call both fired), which created two popups — the orphaned dismiss
        // handler from the first popup killed the second one immediately.
        if (typeof window.handleBaseSelected === 'function') {
            window.handleBaseSelected(baseId, clientX, clientY);
        } else {
            console.warn('[Renderer] window.handleBaseSelected is NOT defined — main.js may not have registered it yet');
        }
    }

    clearSelection() {
        this.selectedBaseId = null;
        this.renderSelection();
    }

    refresh() {
        this.renderBaseBorders();
        this.renderBaseMarkers();
        this.renderDecorations();
        this.renderCreatures();
        this.renderSigilsAndSummoned();
        this.renderSelection();
    }

    // ============================================
    // Creature Methods
    // ============================================

    /**
     * Update a creature's position during movement
     * Pass null for pixelX/Y to reset to base-based positioning
     */
    updateCreaturePosition(creatureId, pixelX, pixelY) {
        const creatureGroup = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (!creatureGroup) return;

        if (pixelX === null || pixelY === null) {
            // Reset - will be repositioned by renderCreatures()
            creatureGroup.dataset.needsPosition = 'true';
        } else {
            // Set explicit pixel position during movement
            creatureGroup.setAttribute('transform', `translate(${Math.round(pixelX)}, ${Math.round(pixelY)})`);
            creatureGroup.dataset.needsPosition = 'false';
        }
    }

    /**
     * Update creature facing orientation (flip based on movement direction)
     * Creatures face left by default, so flip when moving right
     * @param {string} creatureId - The creature ID
     * @param {boolean} movingRight - True if moving right, false if moving left
     */
    updateCreatureOrientation(creatureId, movingRight) {
        const creatureGroup = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (!creatureGroup) return;

        const visual = creatureGroup.querySelector('.creature');
        if (!visual) return;

        // Flip the creature image horizontally based on direction
        // NOTE: Image has a permanent centering transform translate(-w/2, 0)
        // so orientation must compose with that, not replace it
        const image = visual.querySelector('image');
        if (image) {
            const w = parseFloat(image.getAttribute('width')) || 48;
            const centerX = -(w / 2);
            if (movingRight) {
                // Flip to face right — scale(-1,1) around the center point
                image.setAttribute('transform', `scale(-1, 1) translate(${centerX}, 0)`);
            } else {
                // Keep default left-facing orientation — just the centering
                image.setAttribute('transform', `translate(${centerX}, 0)`);
            }
        }
    }

    addCreature(creature) {
        this.creatures.set(creature.id, creature);
        // Add incrementally to avoid disrupting moving creatures
        this._addSingleCreature(creature);
    }

    removeCreature(creatureId) {
        this.creatures.delete(creatureId);
        // Remove the DOM element if it exists
        const group = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (group) group.remove();
    }

    _addSingleCreature(creature) {
        // Build and append a single creature group without full re-render
        const visual = createCreatureElement(creature);
        const base = this.baseSystem.getById(creature.baseId);
        if (!base) return;

        const pos = this._getCreaturePosition(base, creature);

        const creatureGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        creatureGroup.setAttribute('class', 'creature-group');
        creatureGroup.setAttribute('data-creature-id', creature.id);
        creatureGroup.setAttribute('transform', `translate(${Math.round(pos.x)}, ${Math.round(pos.y)})`);
        creatureGroup.style.cursor = 'pointer';
        creatureGroup.appendChild(visual);

        // Click handler
        creatureGroup.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectCreature(creature.id);
        });

        // Hover handlers
        creatureGroup.addEventListener('mouseenter', (e) => {
            showCreatureHoverCard(creature, e.clientX, e.clientY);
        });
        creatureGroup.addEventListener('mousemove', (e) => {
            const hoverCard = document.getElementById('creature-hover-card');
            if (hoverCard) {
                hoverCard.style.left = `${e.clientX + 15}px`;
                hoverCard.style.top = `${e.clientY - 10}px`;
            }
        });
        creatureGroup.addEventListener('mouseleave', () => {
            hideCreatureHoverCard();
        });

        this.layers.creatures?.appendChild(creatureGroup);
    }

    getCreature(creatureId) {
        return this.creatures.get(creatureId);
    }

    renderCreatures() {
        if (!this.layers.creatures) return;

        // Clear existing creatures
        this.layers.creatures.innerHTML = '';

        // Render each creature with click handler
        this.creatures.forEach((creature) => {
            const visual = createCreatureElement(creature);
            const base = this.baseSystem.getById(creature.baseId);
            if (base) {
                const pos = this._getCreaturePosition(base, creature);

                // Wrap in a group with transform and click handler
                const creatureGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                creatureGroup.setAttribute('class', 'creature-group');
                creatureGroup.setAttribute('data-creature-id', creature.id);
                creatureGroup.setAttribute('transform', `translate(${Math.round(pos.x)}, ${Math.round(pos.y)})`);
                creatureGroup.style.cursor = 'pointer';
                creatureGroup.appendChild(visual);

                // Click handler to select creature
                creatureGroup.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectCreature(creature.id);
                });

                // Hover handlers for creature card
                creatureGroup.addEventListener('mouseenter', (e) => {
                    showCreatureHoverCard(creature, e.clientX, e.clientY);
                });

                creatureGroup.addEventListener('mousemove', (e) => {
                    const hoverCard = document.getElementById('creature-hover-card');
                    if (hoverCard) {
                        hoverCard.style.left = `${e.clientX + 15}px`;
                        hoverCard.style.top = `${e.clientY - 10}px`;
                    }
                });

                creatureGroup.addEventListener('mouseleave', () => {
                    hideCreatureHoverCard();
                });

                this.layers.creatures.appendChild(creatureGroup);
            }
        });
    }

    /**
     * Render placed decorations on the decorations layer.
     * Each decoration references an asset definition and is positioned by x%/y%.
     */
    renderDecorations() {
        if (!this.layers.decorations) return;
        this.layers.decorations.innerHTML = '';

        const state = window.gameState;
        if (!state || !state.decorationManager) return;

        const decos = state.decorationManager.getAll();
        if (!decos || decos.length === 0) return;

        const assetMap = state._assetMap;
        if (!assetMap) return;

        decos.forEach(deco => {
            const asset = assetMap.get(deco.assetId);
            if (!asset) return;

            const pixelPos = this.percentToPixels(deco.x, deco.y);
            const scale = deco.scale || 1;
            const rotation = deco.rotation || 0;

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'placed-decoration');
            group.setAttribute('data-deco-id', deco.id);
            group.setAttribute('transform',
                `translate(${pixelPos.x}, ${pixelPos.y}) scale(${scale}) rotate(${rotation})`);

            const w = (asset.defaultWidth / 100) * this.svgWidth;
            const h = (asset.defaultHeight / 100) * this.svgHeight;

            // Use PNG image if available, otherwise fall back to inline SVG
            if (asset.png) {
                const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                img.setAttribute('x', -w / 2);
                img.setAttribute('y', -h / 2);
                img.setAttribute('width', w);
                img.setAttribute('height', h);
                img.setAttribute('href', asset.png);
                img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                img.style.imageRendering = 'auto';
                group.appendChild(img);
            } else if (asset.svg) {
                const inner = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                inner.setAttribute('transform', `translate(${-w/2}, ${-h/2}) scale(${w/100}, ${h/100})`);
                inner.innerHTML = asset.svg;
                group.appendChild(inner);
            }

            // In edit mode, make decorations clickable for selection/deletion
            if (this.isEditMode) {
                group.style.cursor = 'pointer';
                group.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof window.handleDecorationSelected === 'function') {
                        window.handleDecorationSelected(deco.id, e.clientX, e.clientY);
                    }
                });
            } else {
                group.style.pointerEvents = 'none';
            }

            this.layers.decorations.appendChild(group);
        });
    }

    /**
     * Render sigils and summoned creatures on the sigils layer.
     * Reads from window.gameState.sigils, window.gameState.summonedCreatures,
     * and window.gameState.enemyAI for enemy sigils/summons.
     */
    renderSigilsAndSummoned() {
        if (!this.layers.sigils) return;

        const state = window.gameState;
        if (!state) return;

        const playerSigils = state.sigils;
        const playerSummons = state.summonedCreatures;
        const enemyAI = state.enemyAI;
        const enemySigils = enemyAI ? enemyAI.getSigilsMap() : null;
        const enemySummons = enemyAI ? enemyAI.getSummonedCreatures() : null;

        const hasPlayerSigils = playerSigils && playerSigils.size > 0;
        const hasPlayerSummons = playerSummons && playerSummons.length > 0;
        const hasEnemySigils = enemySigils && enemySigils.size > 0;
        const hasEnemySummons = enemySummons && enemySummons.length > 0;

        if (!hasPlayerSigils && !hasPlayerSummons && !hasEnemySigils && !hasEnemySummons) {
            if (this.layers.sigils.innerHTML !== '') {
                this.layers.sigils.innerHTML = '';
            }
            return;
        }

        this.layers.sigils.innerHTML = '';

        /**
         * Helper: render a single sigil at a base position.
         */
        const renderSigilAt = (sigil, baseId, isEnemy) => {
            const base = this.baseSystem.getById(baseId);
            if (!base) return;

            const center = this.percentToPixels(base.x, base.y);
            const fraction = sigil.isComplete ? 1 :
                Math.min(1, (Date.now() - sigil.buildStartTime) / sigil.buildDuration);

            const completeColor = isEnemy ? '#f87171' : '#c084fc';
            const progressColor = isEnemy ? '#ef4444' : '#c084fc';
            const labelColor = isEnemy ? '#fca5a5' : '#a78bfa';

            // Sigil rune
            const rune = createSigilRuneSVG(center.x, center.y, 14, sigil.isComplete, completeColor);
            if (sigil.isComplete) {
                rune.style.cursor = 'pointer';
                rune.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectBase(base.id, e.clientX, e.clientY);
                });
            }
            this.layers.sigils.appendChild(rune);

            // Progress ring during build
            if (!sigil.isComplete) {
                const ring = createProgressRing(center.x, center.y, 22, fraction, progressColor);
                this.layers.sigils.appendChild(ring);
                const label = createSigilLabel(center.x, center.y + 36, 'Building...', labelColor);
                this.layers.sigils.appendChild(label);
            } else {
                const label = createSigilLabel(center.x, center.y + 30,
                    isEnemy ? 'Enemy Sigil' : 'Sigil', labelColor);
                this.layers.sigils.appendChild(label);
            }
        };

        // Render player sigils
        if (hasPlayerSigils) {
            playerSigils.forEach((sigil, baseId) => {
                renderSigilAt(sigil, baseId, false);

                // Render player summoned creatures at this sigil
                if (hasPlayerSummons) {
                    const base = this.baseSystem.getById(baseId);
                    if (base) {
                        const center = this.percentToPixels(base.x, base.y);
                        const atBase = playerSummons.filter(sc => sc.baseId === baseId);
                        atBase.forEach((sc, index) => {
                            const angle = (index * (Math.PI * 2 / 6)) - Math.PI / 2;
                            const offsetR = 38;
                            const scx = center.x + Math.cos(angle) * offsetR;
                            const scy = center.y + Math.sin(angle) * offsetR;
                            const summonFraction = sc.isComplete ? 1 :
                                Math.min(1, (Date.now() - sc.summonStartTime) / sc.summonDuration);
                            const visual = createSummonedCreatureSVG(sc, scx, scy, sc.isComplete);
                            this.layers.sigils.appendChild(visual);
                            if (!sc.isComplete) {
                                const sRing = createProgressRing(scx, scy, 26, summonFraction, '#60a5fa');
                                this.layers.sigils.appendChild(sRing);
                            }
                        });
                    }
                }
            });
        }

        // Render enemy sigils
        if (hasEnemySigils) {
            enemySigils.forEach((sigil, baseId) => {
                renderSigilAt(sigil, baseId, true);

                // Render enemy summoned creatures at this sigil
                if (hasEnemySummons) {
                    const base = this.baseSystem.getById(baseId);
                    if (base) {
                        const center = this.percentToPixels(base.x, base.y);
                        const atBase = enemySummons.filter(sc => sc.baseId === baseId);
                        atBase.forEach((sc, index) => {
                            const angle = (index * (Math.PI * 2 / 6)) - Math.PI / 2;
                            const offsetR = 38;
                            const scx = center.x + Math.cos(angle) * offsetR;
                            const scy = center.y + Math.sin(angle) * offsetR;
                            const summonFraction = sc.isComplete ? 1 :
                                Math.min(1, (Date.now() - sc.summonStartTime) / sc.summonDuration);
                            const visual = createSummonedCreatureSVG(sc, scx, scy, sc.isComplete);
                            this.layers.sigils.appendChild(visual);
                            if (!sc.isComplete) {
                                const sRing = createProgressRing(scx, scy, 26, summonFraction, '#ef4444');
                                this.layers.sigils.appendChild(sRing);
                            }
                        });
                    }
                }
            });
        }
    }

    /**
     * Show combat flash effect on base
     */
    showCombatFlash(baseId, result) {
        const base = this.baseSystem.getById(baseId);
        if (!base) return;

        const center = this.percentToPixels(base.x, base.y);
        const selectionLayer = this.layers.selection;
        if (!selectionLayer) return;

        // Create combat flash circle
        const flash = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        flash.setAttribute('cx', center.x);
        flash.setAttribute('cy', center.y);
        flash.setAttribute('r', '0');
        flash.setAttribute('fill', result.attackerWins ? 'rgba(16, 185, 129, 0.6)' : 'rgba(220, 38, 38, 0.6)');
        flash.setAttribute('stroke', result.attackerWins ? '#10b981' : '#dc2626');
        flash.setAttribute('stroke-width', '3');
        flash.style.animation = 'combatFlash 0.6s ease-out forwards';

        selectionLayer.appendChild(flash);

        // Remove after animation
        setTimeout(() => {
            flash.remove();
        }, 600);
    }

    _getCreaturePosition(base, creature) {
        // Convert base percentage to pixels
        const center = this.percentToPixels(base.x, base.y);

        // Offset for multiple creatures in same base
        const offset = 25;
        const angle = (creature.positionIndex || 0) * (Math.PI * 2 / 6);

        return {
            x: center.x + Math.cos(angle) * offset,
            y: center.y + Math.sin(angle) * offset
        };
    }

    selectCreature(creatureId) {
        this.selectedCreatureId = creatureId;
        const event = new CustomEvent('creatureSelected', {
            detail: { creatureId },
            bubbles: true
        });
        this.svg.dispatchEvent(event);
    }

    // ============================================
    // Movement System
    // ============================================

    /**
     * Configuration for creature movement timing
     * Base time per hop (in ms), modified by creature's movement stat
     */
    static MOVEMENT_CONFIG = {
        baseHopDuration: 60000,  // 60s base per hop
        // movement stat acts as speed multiplier: actual = baseHopDuration / movement
        maxHops: 5,              // safety cap
        rangeLineColor: '#7c3aed',
        rangeLineOpacity: 0.5,
        highlightColor: 'rgba(124, 58, 237, 0.4)',
        highlightPulse: 'rgba(124, 58, 237, 0.7)',
        destinationColor: '#a78bfa',
        arrivalDelay: 500        // ms to wait at destination before snapping
    };

    /**
     * Enter move mode for a creature.
     * Clears any visual highlights — the actual destination selection
     * is handled by main.js intercepting base clicks.
     */
    showMovementRange(creatureId) {
        const creature = this.creatures.get(creatureId);
        if (!creature || creature._isMoving) return;

        // Clear selection layer completely — no pulsing rings or dashed lines
        this.clearMovementRange();

        // Dispatch event so main.js can set move mode state
        const event = new CustomEvent('creatureMoveMode', {
            detail: { creatureId },
            bubbles: true
        });
        this.svg.dispatchEvent(event);
    }

    /**
     * Clear movement range display
     */
    clearMovementRange() {
        if (this.movementRange) {
            const prevId = this.movementRange.creatureId;
            const prevGroup = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${prevId}"]`);
            if (prevGroup) {
                prevGroup.style.filter = '';
                prevGroup.style.opacity = '';
            }
        }
        const sel = this.layers.selection;
        if (sel) sel.innerHTML = '';
        this.movementRange = null;
    }

    /**
     * Highlight the selected creature visually
     */
    _highlightSelectedCreature(creatureId) {
        const group = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (group) {
            group.style.filter = 'brightness(1.3) drop-shadow(0 0 12px #a78bfa)';
            group.style.opacity = '1';
        }
    }

    /**
     * Initiate creature movement along a path.
     * Called when a valid destination is clicked.
     */
    _initiateCreatureMove(creatureId, targetBaseId) {
        const creature = this.creatures.get(creatureId);
        if (!creature || creature._isMoving) return;

        const path = this.baseSystem.findPath(creature.baseId, targetBaseId);
        if (!path || path.length < 2) return;

        const movement = creature.movement || 1;
        const durationPerHop = Math.max(5000, Renderer.MOVEMENT_CONFIG.baseHopDuration / movement);

        // Get creature's current pixel position
        const currentBase = this.baseSystem.getById(creature.baseId);
        const startPos = this._getCreaturePosition(currentBase, creature);
        const firstHop = this.baseSystem.getById(path[1]);
        const firstHopPx = this.percentToPixels(firstHop.x, firstHop.y);

        const moveState = {
            creatureId,
            path,
            pathBaseIds: path,          // original path of base IDs
            currentHopIndex: 1,          // index into path we're moving toward
            startTime: Date.now(),
            durationPerHop,
            hopProgress: 0,              // 0..1
            hopStartPos: { x: startPos.x, y: startPos.y },
            hopEndPos: { x: firstHopPx.x, y: firstHopPx.y },
            hopStartTime: Date.now(),
            totalHops: path.length - 1,
            completedHops: 0,
            isMoving: true
        };

        this.movingCreatures.set(creatureId, moveState);

        // Mark creature as moving
        creature._isMoving = true;
        creature._moveTarget = targetBaseId;

        // Update the creature group appearance to show moving state
        const group = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (group) {
            // Ensure creature is fully visible during movement
            group.style.opacity = '1';
            group.style.visibility = 'visible';
            group.style.display = 'block';
            group.style.pointerEvents = 'all';

            // Apply movement glow and trail effects
            applyMovementVisuals(group, true);

            // Log diagnostic info
            console.log('[Move] Creature group found, transform:', group.getAttribute('transform'),
                'img:', !!group.querySelector('image'));

            // Re-verify the sprite image renders — force a repaint without reload
            const img = group.querySelector('image');
            if (img) {
                img.style.opacity = '1';
                img.style.visibility = 'visible';
            }

            // TEMP: Remove CSS drop-shadow glow on .creature during movement
            // CSS drop-shadow + animated SVG transform causes Chrome to drop <image> rendering
            const creatureEl = group.querySelector('.creature');
            if (creatureEl) {
                creatureEl._savedFilter = creatureEl.style.filter;
                creatureEl.style.filter = 'none';
            }
            // Add a moving label
            const existingLabel = group.querySelector('.movement-label');
            if (!existingLabel) {
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('class', 'movement-label');
                label.setAttribute('x', '0');
                label.setAttribute('y', '-150');
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('fill', '#a78bfa');
                label.setAttribute('font-size', '9');
                label.setAttribute('font-weight', 'bold');
                label.textContent = 'Moving...';
                label.style.filter = 'url(#label-shadow)';
                group.appendChild(label);
            }
        }

        // Dispatch movement start event
        const event = new CustomEvent('creatureMoveStarted', {
            detail: { creatureId, targetBaseId, path, durationPerHop, totalHops: path.length - 1 },
            bubbles: true
        });
        this.svg.dispatchEvent(event);

        // Clear movement range
        this.clearMovementRange();
    }

    /**
     * Update all moving creatures — interpolate positions along their paths.
     * Called every frame from the render loop.
     */
    updateCreatureMovements() {
        const now = Date.now();
        const toRemove = [];

        this.movingCreatures.forEach((moveState, creatureId) => {
            if (!moveState.isMoving) {
                toRemove.push(creatureId);
                return;
            }

            const creature = this.creatures.get(creatureId);
            if (!creature) {
                toRemove.push(creatureId);
                return;
            }

            // Calculate progress for current hop
            const elapsed = now - moveState.hopStartTime;
            moveState.hopProgress = Math.min(1, elapsed / moveState.durationPerHop);

            // Interpolate creature position
            const x = moveState.hopStartPos.x + (moveState.hopEndPos.x - moveState.hopStartPos.x) * moveState.hopProgress;
            const y = moveState.hopStartPos.y + (moveState.hopEndPos.y - moveState.hopStartPos.y) * moveState.hopProgress;

            // Update creature group position
            const group = this.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
            if (group) {
                // Use standard SVG transform attribute
                group.setAttribute('transform', `translate(${Math.round(x)}, ${Math.round(y)})`);
                group.dataset.needsPosition = 'false';
                // Safety: ensure creature stays visible throughout movement
                group.style.opacity = '1';
                group.style.visibility = 'visible';

                // Update orientation (face direction of travel)
                const movingRight = moveState.hopEndPos.x > moveState.hopStartPos.x;
                this.updateCreatureOrientation(creatureId, movingRight);

                // Update progress label
                const label = group.querySelector('.movement-label');
                if (label) {
                    const overallProgress = moveState.hopProgress > 0.99
                        ? `${moveState.completedHops + 1}/${moveState.totalHops}`
                        : `${moveState.completedHops + moveState.hopProgress}/${moveState.totalHops}`;
                    const remaining = Math.round((moveState.totalHops - moveState.completedHops - moveState.hopProgress) * moveState.durationPerHop / 1000);
                    label.textContent = remaining > 60
                        ? `${Math.ceil(remaining / 60)}m ${remaining % 60}s`
                        : `${remaining}s`;
                }

                // Draw progress ring on selection layer
                this._drawMovementProgress(creatureId, x, y, moveState);
            }

            // Check if hop is complete
            if (moveState.hopProgress >= 1) {
                // Snap to exact end of this hop
                const currentHopBaseId = moveState.pathBaseIds[moveState.currentHopIndex];
                moveState.completedHops++;

                // Are we at the final destination?
                if (moveState.currentHopIndex >= moveState.pathBaseIds.length - 1) {
                    // Movement complete!
                    creature.baseId = currentHopBaseId;
                    creature._isMoving = false;
                    creature._moveTarget = null;

                    // Update creature visual state
                    if (group) {
                        group.style.opacity = '1';
                        // Remove movement visual effects
                        applyMovementVisuals(group, false);
                        removeTrailEffect(group);
                        const label = group.querySelector('.movement-label');
                        if (label) label.remove();
                        // Restore the .creature glow filter if it was removed during movement
                        const creatureEl = group.querySelector('.creature');
                        if (creatureEl && creatureEl._savedFilter !== undefined) {
                            creatureEl.style.filter = creatureEl._savedFilter;
                            delete creatureEl._savedFilter;
                        }
                        // Snap to correct base position
                        group.dataset.needsPosition = 'true';
                    }

                    toRemove.push(creatureId);

                    // Dispatch arrival event
                    const event = new CustomEvent('creatureMoveArrived', {
                        detail: { creatureId, targetBaseId: currentHopBaseId },
                        bubbles: true
                    });
                    this.svg.dispatchEvent(event);
                } else {
                    // Move to next hop
                    moveState.currentHopIndex++;
                    moveState.hopStartTime = now;
                    moveState.hopProgress = 0;

                    const fromBase = this.baseSystem.getById(moveState.pathBaseIds[moveState.currentHopIndex - 1]);
                    const toBase = this.baseSystem.getById(moveState.pathBaseIds[moveState.currentHopIndex]);
                    if (fromBase && toBase) {
                        moveState.hopStartPos = this.percentToPixels(fromBase.x, fromBase.y);
                        moveState.hopEndPos = this.percentToPixels(toBase.x, toBase.y);
                    }
                }
            }
        });

        // Clean up completed movements
        toRemove.forEach(id => {
            this.movingCreatures.delete(id);
            // Clean up progress circles
            const sel = this.layers.selection;
            const progressRing = sel?.querySelector(`.move-progress[data-creature-id="${id}"]`);
            if (progressRing) progressRing.remove();
        });
    }

    /**
     * Draw the movement progress ring under a moving creature
     */
    _drawMovementProgress(creatureId, x, y, moveState) {
        const sel = this.layers.selection;
        if (!sel) return;

        // Remove existing progress ring for this creature
        const existing = sel.querySelector(`.move-progress[data-creature-id="${creatureId}"]`);
        if (existing) existing.remove();

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'move-progress');
        group.dataset.creatureId = creatureId;

        const overallProgress = (moveState.completedHops + moveState.hopProgress) / moveState.totalHops;
        const radius = 20;
        const circumference = 2 * Math.PI * radius;

        // Background circle
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', String(x));
        bg.setAttribute('cy', String(y));
        bg.setAttribute('r', String(radius));
        bg.setAttribute('fill', 'none');
        bg.setAttribute('stroke', 'rgba(255,255,255,0.08)');
        bg.setAttribute('stroke-width', '2');
        group.appendChild(bg);

        // Progress arc
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        arc.setAttribute('cx', String(x));
        arc.setAttribute('cy', String(y));
        arc.setAttribute('r', String(radius));
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', '#a78bfa');
        arc.setAttribute('stroke-width', '2');
        arc.setAttribute('stroke-linecap', 'round');
        arc.setAttribute('stroke-dasharray', `${circumference}`);
        arc.setAttribute('stroke-dashoffset', String(circumference * (1 - overallProgress)));
        arc.setAttribute('transform', `rotate(-90, ${x}, ${y})`);
        group.appendChild(arc);

        sel.appendChild(group);
    }

    // ============================================
    // Shape Helpers
    // ============================================

    _createStar(cx, cy, radius, color) {
        const points = [];
        for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radius : radius * 0.5;
            const angle = (Math.PI / 5) * i - Math.PI / 2;
            points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points.join(' '));
        polygon.style.fill = color;
        return polygon;
    }

    _createCrown(cx, cy, size, color) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Crown base (curved band)
        const base = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const baseY = cy + size * 0.3;
        base.setAttribute('d', `M ${cx - size} ${baseY} Q ${cx} ${baseY + size * 0.3} ${cx + size} ${baseY}`);
        base.setAttribute('stroke', color);
        base.setAttribute('stroke-width', '3');
        base.setAttribute('fill', 'none');
        base.setAttribute('stroke-linecap', 'round');
        group.appendChild(base);

        // Crown points (3 spikes)
        const leftSpike = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        leftSpike.setAttribute('d', `M ${cx - size} ${baseY} L ${cx - size * 0.6} ${cy - size * 0.8} L ${cx - size * 0.3} ${baseY}`);
        leftSpike.setAttribute('fill', color);
        group.appendChild(leftSpike);

        const centerSpike = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        centerSpike.setAttribute('d', `M ${cx - size * 0.25} ${baseY} L ${cx} ${cy - size * 1.1} L ${cx + size * 0.25} ${baseY}`);
        centerSpike.setAttribute('fill', color);
        group.appendChild(centerSpike);

        const rightSpike = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        rightSpike.setAttribute('d', `M ${cx + size * 0.3} ${baseY} L ${cx + size * 0.6} ${cy - size * 0.8} L ${cx + size} ${baseY}`);
        rightSpike.setAttribute('fill', color);
        group.appendChild(rightSpike);

        // Small circles on spike tips for decoration
        const leftGem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leftGem.setAttribute('cx', cx - size * 0.6);
        leftGem.setAttribute('cy', cy - size * 0.8);
        leftGem.setAttribute('r', '2.5');
        leftGem.setAttribute('fill', '#f4d03f');
        group.appendChild(leftGem);

        const centerGem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centerGem.setAttribute('cx', cx);
        centerGem.setAttribute('cy', cy - size * 1.1);
        centerGem.setAttribute('r', '3');
        centerGem.setAttribute('fill', '#f4d03f');
        group.appendChild(centerGem);

        const rightGem = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rightGem.setAttribute('cx', cx + size * 0.6);
        rightGem.setAttribute('cy', cy - size * 0.8);
        rightGem.setAttribute('r', '2.5');
        rightGem.setAttribute('fill', '#f4d03f');
        group.appendChild(rightGem);

        return group;
    }

    _createDiamond(cx, cy, size, color) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`);
        polygon.style.fill = color;
        return polygon;
    }

    /**
     * Create a shiny diamond - clean, no outer ring
     */
    _createShinyDiamond(cx, cy, size) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Main diamond shape
        const outer = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        outer.setAttribute('points', `${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`);
        outer.style.fill = '#7c3aed';
        outer.style.filter = 'url(#soft-glow)';
        group.appendChild(outer);

        // Inner highlight (lighter center)
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        inner.setAttribute('points', `${cx},${cy - size * 0.5} ${cx + size * 0.5},${cy} ${cx},${cy + size * 0.5} ${cx - size * 0.5},${cy}`);
        inner.style.fill = '#a78bfa';
        group.appendChild(inner);

        // Small sparkle highlight
        const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        sparkle.setAttribute('cx', cx - size * 0.2);
        sparkle.setAttribute('cy', cy - size * 0.25);
        sparkle.setAttribute('r', size * 0.15);
        sparkle.style.fill = '#e9d5ff';
        sparkle.style.opacity = '0.6';
        group.appendChild(sparkle);

        return group;
    }
}

export default Renderer;
