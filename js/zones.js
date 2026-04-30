/**
 * ZoneOfControl — SVG-based zone-of-influence for bases/waypoints + custom polygon regions
 *
 * Two rendering modes:
 * 1. Circular zones — auto-generated for every base/waypoint
 * 2. Polygon regions — user-drawn in editor, exported, loaded at game start
 *
 * Both support hover/click/tooltip with visual states:
 *   - Owned (purple), Enemy (red+pulse), Neutral (dim), Hovered (white highlight)
 */

const NS = 'http://www.w3.org/2000/svg';

// ── Zone radius by base type (percentage of map size) ──
const DEFAULT_RADII = {
    'king-base': 12,
    'base': 8,
    'waypoint': 5
};

// ── Zone state colors ──
const COLORS = {
    owned:    { fill: 'rgba(124, 58, 237, 0.14)',  stroke: 'rgba(124, 58, 237, 0.55)',  pulse: '#7c3aed' },
    enemy:    { fill: 'rgba(239, 68, 68, 0.12)',   stroke: 'rgba(239, 68, 68, 0.50)',    pulse: '#ef4444' },
    neutral:  { fill: 'rgba(100, 100, 120, 0.06)',  stroke: 'rgba(100, 100, 120, 0.25)',  pulse: null },
    hovered:  { fill: 'rgba(255, 255, 255, 0.10)',  stroke: 'rgba(255, 255, 255, 0.60)',  pulse: null },
    region:   { fill: 'rgba(124, 58, 237, 0.08)',   stroke: 'rgba(124, 58, 237, 0.35)',  pulse: null }
};

export class ZoneOfControl {
    /**
     * @param {SVGSVGElement} svg
     * @param {string} layerId
     * @param {Object} baseSystem — with getAll()
     * @param {Object} [opts]
     * @param {Object<string,number>} [opts.radii]
     * @param {Function} [opts.onZoneClick] — (zoneId, event)
     * @param {Function} [opts.onZoneHover] — (zoneId, event)
     * @param {Function} [opts.onZoneLeave] — (zoneId)
     */
    constructor(svg, layerId, baseSystem, opts = {}) {
        this.svg = svg;
        this.layerId = layerId;
        this.baseSystem = baseSystem;
        this.radii = opts.radii || DEFAULT_RADII;
        this.onZoneClick = opts.onZoneClick || null;
        this.onZoneHover = opts.onZoneHover || null;
        this.onZoneLeave = opts.onZoneLeave || null;

        /** @type {Map<string, SVGCircleElement>} */
        this._circles = new Map();
        /** @type {Map<string, SVGCircleElement>} */
        this._pulseRings = new Map();
        /** @type {Map<string, Object>} */
        this._states = new Map();
        /** @type {string|null} */
        this._hoveredId = null;

        // Region polygons
        /** @type {Array<{id: string, name: string, vertices: number[][], element: SVGPolygonElement|null}>} */
        this._regions = [];

        this._layer = null;
        this._initialized = false;
    }

    /**
     * Load custom polygon regions from editor-exported JSON.
     * Call before render() or anytime to add/update regions.
     * @param {Array<{id: string, name: string, vertices: number[][]}>} regions
     */
    loadRegions(regions) {
        this._regions = regions.map(r => ({
            ...r,
            element: null  // will be created in render()
        }));
        if (this._initialized) {
            this._renderRegions();
        }
    }

    _getLayer() {
        if (this._layer) return this._layer;
        let g = this.svg.querySelector(`#${this.layerId}`);
        if (!g) {
            g = document.createElementNS(NS, 'g');
            g.setAttribute('id', this.layerId);
            const paths = this.svg.querySelector('#connection-paths');
            if (paths && paths.nextSibling) {
                this.svg.insertBefore(g, paths.nextSibling);
            } else {
                this.svg.appendChild(g);
            }
        }
        this._layer = g;
        return g;
    }

    /**
     * Render all zones (circles + regions). Call once after construction.
     */
    render() {
        const layer = this._getLayer();
        const bases = this.baseSystem.getAll();
        const dims = this._getMapDims();

        for (const base of bases) {
            const radius = this.radii[base.type] || this.radii['base'];
            const x = (base.x / 100) * dims.w;
            const y = (base.y / 100) * dims.h;

            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', radius);
            circle.setAttribute('class', 'zone-circle');
            circle.setAttribute('data-base-id', base.id);
            circle.setAttribute('fill', COLORS.neutral.fill);
            circle.setAttribute('stroke', COLORS.neutral.stroke);
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('pointer-events', 'all');
            circle.style.cursor = 'pointer';
            circle.style.transition = 'fill 0.3s ease, stroke 0.3s ease, opacity 0.5s ease';

            const pulse = document.createElementNS(NS, 'circle');
            pulse.setAttribute('cx', x);
            pulse.setAttribute('cy', y);
            pulse.setAttribute('r', radius + 1);
            pulse.setAttribute('class', 'zone-pulse');
            pulse.setAttribute('fill', 'none');
            pulse.setAttribute('stroke-width', '1.5');
            pulse.setAttribute('stroke-dasharray', '4 4');
            pulse.setAttribute('opacity', '0');
            pulse.setAttribute('pointer-events', 'none');
            pulse.style.transition = 'opacity 0.5s ease';

            circle.addEventListener('mouseenter', (e) => this._onEnter(base.id, e));
            circle.addEventListener('mouseleave', () => this._onLeave(base.id));
            circle.addEventListener('click', (e) => this._onClick(base.id, e));

            layer.appendChild(circle);
            layer.appendChild(pulse);

            this._circles.set(base.id, circle);
            this._pulseRings.set(base.id, pulse);
            this._states.set(base.id, {
                owned: false, enemy: false, hasTrap: false,
                visible: true, explored: true, creatureCount: 0
            });
        }

        // Render polygon regions
        this._renderRegions();

        this._initialized = true;
    }

    /**
     * Render saved polygon regions as SVG <polygon> elements.
     */
    _renderRegions() {
        const layer = this._getLayer();
        const dims = this._getMapDims();

        // Remove old region elements
        layer.querySelectorAll('.zone-region-polygon').forEach(el => el.remove());

        for (const region of this._regions) {
            if (!region.vertices || region.vertices.length < 3) continue;

            const pointsStr = region.vertices
                .map(v => `${(v[0] / 100) * dims.w},${(v[1] / 100) * dims.h}`)
                .join(' ');

            const poly = document.createElementNS(NS, 'polygon');
            poly.setAttribute('points', pointsStr);
            poly.setAttribute('class', 'zone-region-polygon');
            poly.setAttribute('data-region-id', region.id);
            poly.setAttribute('fill', COLORS.region.fill);
            poly.setAttribute('stroke', COLORS.region.stroke);
            poly.setAttribute('stroke-width', '1.5');
            poly.setAttribute('pointer-events', 'all');
            poly.style.cursor = 'pointer';
            poly.style.transition = 'fill 0.3s ease, stroke 0.3s ease';

            poly.addEventListener('mouseenter', (e) => this._onEnter(region.id, e));
            poly.addEventListener('mouseleave', () => this._onLeave(region.id));
            poly.addEventListener('click', (e) => this._onClick(region.id, e));

            layer.appendChild(poly);
            region.element = poly;
        }
    }

    /**
     * Update zone visual states. Call every frame.
     */
    update(ownedBaseIds, enemyBaseIds, trapMap, fog) {
        if (!this._initialized) return;

        const dims = this._getMapDims();
        const bases = this.baseSystem.getAll();
        const baseMap = new Map(bases.map(b => [b.id, b]));

        // Update circle zones
        for (const [baseId, state] of this._states) {
            const base = baseMap.get(baseId);
            if (!base) continue;

            state.owned = ownedBaseIds.has(baseId);
            state.enemy = enemyBaseIds.has(baseId);
            state.hasTrap = trapMap ? !!trapMap.get(baseId) : false;

            if (fog) {
                const x = (base.x / 100) * dims.w;
                const y = (base.y / 100) * dims.h;
                state.visible = fog.isVisible(x, y);
                state.explored = state.visible || fog.isExplored(x, y);
            } else {
                state.visible = true;
                state.explored = true;
            }

            const circle = this._circles.get(baseId);
            const pulse = this._pulseRings.get(baseId);
            if (!circle) continue;

            const isHovered = baseId === this._hoveredId;

            if (!state.explored) {
                circle.setAttribute('opacity', '0');
                if (pulse) pulse.setAttribute('opacity', '0');
            } else if (!state.visible) {
                circle.setAttribute('fill', COLORS.neutral.fill);
                circle.setAttribute('stroke', 'rgba(100,100,120,0.08)');
                circle.setAttribute('opacity', '0.4');
                if (pulse) pulse.setAttribute('opacity', '0');
            } else if (isHovered) {
                circle.setAttribute('fill', COLORS.hovered.fill);
                circle.setAttribute('stroke', COLORS.hovered.stroke);
                circle.setAttribute('stroke-width', '2');
                circle.setAttribute('opacity', '1');
                if (pulse) pulse.setAttribute('opacity', '0');
            } else if (state.owned) {
                circle.setAttribute('fill', COLORS.owned.fill);
                circle.setAttribute('stroke', COLORS.owned.stroke);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('opacity', '1');
                if (pulse) pulse.setAttribute('opacity', '0');
            } else if (state.enemy) {
                circle.setAttribute('fill', COLORS.enemy.fill);
                circle.setAttribute('stroke', COLORS.enemy.stroke);
                circle.setAttribute('stroke-width', '1.5');
                circle.setAttribute('opacity', '1');
                if (pulse) {
                    pulse.setAttribute('stroke', COLORS.enemy.pulse);
                    pulse.setAttribute('opacity', '0.5');
                }
            } else {
                circle.setAttribute('fill', COLORS.neutral.fill);
                circle.setAttribute('stroke', COLORS.neutral.stroke);
                circle.setAttribute('stroke-width', '1');
                circle.setAttribute('opacity', '1');
                if (pulse) pulse.setAttribute('opacity', '0');
            }

            if (state.hasTrap && state.visible && pulse) {
                pulse.setAttribute('stroke', '#fbbf24');
                pulse.setAttribute('stroke-width', '2');
                pulse.setAttribute('stroke-dasharray', '3 6');
                pulse.setAttribute('opacity', state.enemy ? '0.7' : '0.35');
            }
        }

        // Update region polygons
        for (const region of this._regions) {
            if (!region.element) continue;
            const isHovered = region.id === this._hoveredId;

            if (isHovered) {
                region.element.setAttribute('fill', COLORS.hovered.fill);
                region.element.setAttribute('stroke', COLORS.hovered.stroke);
                region.element.setAttribute('stroke-width', '2');
            } else {
                region.element.setAttribute('fill', COLORS.region.fill);
                region.element.setAttribute('stroke', COLORS.region.stroke);
                region.element.setAttribute('stroke-width', '1.5');
            }
        }
    }

    reposition() {
        // Update region polygons only (circles don't move in gameplay)
        this._renderRegions();
    }

    /**
     * Point-in-polygon test for a region.
     */
    _pointInPolygon(px, py, vertices, dims) {
        const n = vertices.length;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = (vertices[i][0] / 100) * dims.w;
            const yi = (vertices[i][1] / 100) * dims.h;
            const xj = (vertices[j][0] / 100) * dims.w;
            const yj = (vertices[j][1] / 100) * dims.h;
            if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    hitTest(svgX, svgY) {
        const dims = this._getMapDims();

        // Check regions first (more specific shapes)
        for (const region of this._regions) {
            if (region.vertices && region.vertices.length >= 3) {
                if (this._pointInPolygon(svgX, svgY, region.vertices, dims)) {
                    return region.id;
                }
            }
        }

        // Fall back to circular zones
        const bases = this.baseSystem.getAll();
        for (const base of bases) {
            const radius = this.radii[base.type] || this.radii['base'];
            const cx = (base.x / 100) * dims.w;
            const cy = (base.y / 100) * dims.h;
            const dx = svgX - cx;
            const dy = svgY - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                return base.id;
            }
        }
        return null;
    }

    _getMapDims() {
        if (this.svg.clientWidth && this.svg.clientHeight) {
            return { w: this.svg.clientWidth, h: this.svg.clientHeight };
        }
        const bbox = this.svg.getBoundingClientRect();
        return { w: bbox.width || 1000, h: bbox.height || 800 };
    }

    _onEnter(zoneId, event) {
        this._hoveredId = zoneId;
        if (this.onZoneHover) this.onZoneHover(zoneId, event);
    }

    _onLeave(zoneId) {
        if (this._hoveredId === zoneId) this._hoveredId = null;
        if (this.onZoneLeave) this.onZoneLeave(zoneId);
    }

    _onClick(zoneId, event) {
        if (this.onZoneClick) this.onZoneClick(zoneId, event);
    }
}
