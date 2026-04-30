/**
 * ZoneOfControl — SVG-based zone-of-influence circles for bases/waypoints
 *
 * Each base projects a semi-transparent circular zone on the map.
 * Zones are hoverable, clickable, and visually layered with states:
 *   - Owned by player (purple glass)
 *   - Owned by enemy (red glass + pulse)
 *   - Neutral (dim translucent)
 *   - Condemned trap present (chain badge)
 *   - Fog status (visible/explored/unexplored — handled by FogOfWar masks)
 *
 * Usage:
 *   const zones = new ZoneOfControl(svg, 'zones-layer', baseSystem, {
 *       kingRadius: 12, baseRadius: 8, waypointRadius: 5
 *   });
 *   zones.render();                          // draw all zones
 *   zones.update(ownedBaseIds, traps, fog);  // update state each frame
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
    hovered:  { fill: 'rgba(255, 255, 255, 0.10)',  stroke: 'rgba(255, 255, 255, 0.60)',  pulse: null }
};

export class ZoneOfControl {
    /**
     * @param {SVGSVGElement} svg - The map SVG
     * @param {string} layerId - ID of the <g> element for zones (e.g. 'zones-layer')
     * @param {Object} baseSystem - BaseSystem instance with getAllBases()
     * @param {Object} [opts]
     * @param {Object<string,number>} [opts.radii] - Radius per base type
     * @param {Function} [opts.onZoneClick] - Called with (baseId) on zone click
     * @param {Function} [opts.onZoneHover] - Called with (baseId, event) on hover
     * @param {Function} [opts.onZoneLeave] - Called with (baseId) on hover out
     */
    constructor(svg, layerId, baseSystem, opts = {}) {
        this.svg = svg;
        this.layerId = layerId;
        this.baseSystem = baseSystem;
        this.radii = opts.radii || DEFAULT_RADII;
        this.onZoneClick = opts.onZoneClick || null;
        this.onZoneHover = opts.onZoneHover || null;
        this.onZoneLeave = opts.onZoneLeave || null;

        /** @type {Map<string, SVGCircleElement>} baseId → circle element */
        this._circles = new Map();

        /** @type {Map<string, SVGCircleElement>} baseId → outer pulse ring */
        this._pulseRings = new Map();

        /** @type {Map<string, Object>} baseId → zone state */
        this._states = new Map();

        /** @type {string|null} */
        this._hoveredId = null;

        this._layer = null;
        this._initialized = false;
    }

    /**
     * Get the <g> layer, creating it if it doesn't exist.
     */
    _getLayer() {
        if (this._layer) return this._layer;
        let g = this.svg.querySelector(`#${this.layerId}`);
        if (!g) {
            g = document.createElementNS(NS, 'g');
            g.setAttribute('id', this.layerId);
            // Insert after connection-paths, before base-borders
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
     * Render all zone circles from baseSystem data. Call once after construction.
     */
    render() {
        const layer = this._getLayer();
        const bases = this.baseSystem.getAll();
        const dims = this._getMapDims();

        for (const base of bases) {
            const radius = this.radii[base.type] || this.radii['base'];
            const x = (base.x / 100) * dims.w;
            const y = (base.y / 100) * dims.h;

            // Main zone circle
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

            // Pulse ring (hidden by default, shown for enemy/trap)
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

            // Event listeners
            circle.addEventListener('mouseenter', (e) => this._onEnter(base.id, e));
            circle.addEventListener('mouseleave', () => this._onLeave(base.id));
            circle.addEventListener('click', (e) => this._onClick(base.id, e));

            layer.appendChild(circle);
            layer.appendChild(pulse);

            this._circles.set(base.id, circle);
            this._pulseRings.set(base.id, pulse);
            this._states.set(base.id, {
                owned: false,
                enemy: false,
                hasTrap: false,
                visible: false,
                explored: false,
                creatureCount: 0
            });
        }

        this._initialized = true;
    }

    /**
     * Update zone visual states based on current game state.
     * Call every frame or whenever state changes.
     *
     * @param {Set<string>} ownedBaseIds - Player-owned base IDs
     * @param {Set<string>} enemyBaseIds - Enemy-owned base IDs
     * @param {Map<string,boolean>} trapMap - baseId → has active trap
     * @param {import('./fogOfWar.js').FogOfWar} [fog] - FogOfWar instance
     */
    update(ownedBaseIds, enemyBaseIds, trapMap, fog) {
        if (!this._initialized) return;

        const dims = this._getMapDims();
        const bases = this.baseSystem.getAll();
        const baseMap = new Map(bases.map(b => [b.id, b]));

        for (const [baseId, state] of this._states) {
            const base = baseMap.get(baseId);
            if (!base) continue;

            const x = (base.x / 100) * dims.w;
            const y = (base.y / 100) * dims.h;

            state.owned = ownedBaseIds.has(baseId);
            state.enemy = enemyBaseIds.has(baseId);
            state.hasTrap = trapMap ? !!trapMap.get(baseId) : false;

            // Fog status
            if (fog) {
                state.visible = fog.isVisible(x, y);
                state.explored = state.visible || fog.isExplored(x, y);
            } else {
                state.visible = true;
                state.explored = true;
            }

            const circle = this._circles.get(baseId);
            const pulse = this._pulseRings.get(baseId);
            if (!circle) continue;

            // Determine visual state
            const isHovered = baseId === this._hoveredId;

            if (!state.explored) {
                // Never explored — hide zone entirely (fog handles the rest)
                circle.setAttribute('opacity', '0');
                if (pulse) pulse.setAttribute('opacity', '0');
            } else if (!state.visible) {
                // Explored but not currently visible — very dim
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
                // Pulse animation for enemy zones
                if (pulse) {
                    pulse.setAttribute('stroke', COLORS.enemy.pulse);
                    pulse.setAttribute('opacity', '0.5');
                }
            } else {
                // Neutral
                circle.setAttribute('fill', COLORS.neutral.fill);
                circle.setAttribute('stroke', COLORS.neutral.stroke);
                circle.setAttribute('stroke-width', '1');
                circle.setAttribute('opacity', '1');
                if (pulse) pulse.setAttribute('opacity', '0');
            }

            // Trap indicator — override pulse with gold warning
            if (state.hasTrap && state.visible && pulse) {
                pulse.setAttribute('stroke', '#fbbf24');
                pulse.setAttribute('stroke-width', '2');
                pulse.setAttribute('stroke-dasharray', '3 6');
                pulse.setAttribute('opacity', state.enemy ? '0.7' : '0.35');
            }
        }
    }

    /**
     * Re-render all zone positions (call after editor moves bases).
     */
    reposition() {
        const dims = this._getMapDims();
        const bases = this.baseSystem.getAll();
        const baseMap = new Map(bases.map(b => [b.id, b]));

        for (const [baseId, circle] of this._circles) {
            const base = baseMap.get(baseId);
            if (!base) continue;

            const radius = this.radii[base.type] || this.radii['base'];
            const x = (base.x / 100) * dims.w;
            const y = (base.y / 100) * dims.h;

            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', radius);

            const pulse = this._pulseRings.get(baseId);
            if (pulse) {
                pulse.setAttribute('cx', x);
                pulse.setAttribute('cy', y);
                pulse.setAttribute('r', radius + 1);
            }
        }
    }

    /**
     * Get the base ID under a screen point (for tooltip/click routing).
     * @param {number} svgX - SVG coordinate X
     * @param {number} svgY - SVG coordinate Y
     * @returns {string|null} baseId or null
     */
    hitTest(svgX, svgY) {
        const dims = this._getMapDims();
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

    // ── Private helpers ──

    _getMapDims() {
        if (this.svg.clientWidth && this.svg.clientHeight) {
            return { w: this.svg.clientWidth, h: this.svg.clientHeight };
        }
        const bbox = this.svg.getBoundingClientRect();
        return { w: bbox.width || 1000, h: bbox.height || 800 };
    }

    _onEnter(baseId, event) {
        this._hoveredId = baseId;
        if (this.onZoneHover) {
            this.onZoneHover(baseId, event);
        }
    }

    _onLeave(baseId) {
        if (this._hoveredId === baseId) {
            this._hoveredId = null;
        }
        if (this.onZoneLeave) {
            this.onZoneLeave(baseId);
        }
    }

    _onClick(baseId, event) {
        if (this.onZoneClick) {
            this.onZoneClick(baseId, event);
        }
    }
}
