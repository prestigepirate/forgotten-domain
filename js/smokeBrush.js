/**
 * SmokeBrush — Paint animated smoke/particle effects on the map.
 *
 * Click and drag to place animated smoke particle clusters.
 * Particles float upward, drift sideways, fade, and auto-cleanup.
 * Uses CSS animations (GPU-accelerated, no JS per-frame loop).
 *
 * Usage:
 *   const smoke = new SmokeBrush(svg, layerId);
 *   smoke.activate();
 *   smoke.deactivate();
 *   smoke.setSize(50);     // brush radius
 *   smoke.getStrokes();    // export data
 *   smoke.loadStrokes(strokes);
 */

const NS = 'http://www.w3.org/2000/svg';

// ── Smoke particle configuration ──
const SMOKE_CONFIG = {
    minParticles: 8,    // per stroke at size 1
    maxParticles: 30,   // per stroke at max size
    minRadius: 3,
    maxRadius: 10,
    minOpacity: 0.15,
    maxOpacity: 0.45,
    driftRange: 30,     // px horizontal drift
    riseRange: 60,      // px vertical rise
    durationMin: 4,     // seconds
    durationMax: 8,
    colors: [
        'rgba(180, 170, 200, VAR)',   // light purple-gray
        'rgba(140, 130, 160, VAR)',
        'rgba(160, 150, 180, VAR)',
        'rgba(200, 190, 210, VAR)',
        'rgba(120, 110, 150, VAR)'
    ]
};

export class SmokeBrush {
    /**
     * @param {SVGSVGElement} svg - The map SVG
     * @param {string} layerId - ID for the smoke layer <g> element
     */
    constructor(svg, layerId) {
        this.svg = svg;
        this.layerId = layerId;
        this._active = false;
        this._painting = false;
        this._brushSize = 40; // radius in SVG pixels
        this._strokes = [];   // [{x, y, r, timestamp}, ...]
        this._layer = null;

        // Bound handlers
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
    }

    // ── Public API ──

    activate() {
        if (this._active) return;
        this._active = true;
        this._painting = false;

        const layer = this._getLayer();
        layer.style.pointerEvents = 'auto';
        layer.style.cursor = 'crosshair';

        layer.addEventListener('mousedown', this._onMouseDown);
        layer.addEventListener('mousemove', this._onMouseMove);
        layer.addEventListener('mouseup', this._onMouseUp);
        layer.addEventListener('mouseleave', this._onMouseUp);

        // Inject CSS keyframes
        this._injectStyles();
    }

    deactivate() {
        this._active = false;
        this._painting = false;
        const layer = this._getLayer();
        layer.style.pointerEvents = 'none';
        layer.style.cursor = '';
        layer.removeEventListener('mousedown', this._onMouseDown);
        layer.removeEventListener('mousemove', this._onMouseMove);
        layer.removeEventListener('mouseup', this._onMouseUp);
        layer.removeEventListener('mouseleave', this._onMouseUp);
    }

    setSize(radius) {
        this._brushSize = Math.max(5, Math.min(150, radius));
    }

    getSize() {
        return this._brushSize;
    }

    getStrokes() {
        return this._strokes;
    }

    loadStrokes(strokes) {
        this._strokes = strokes || [];
        // Replay all strokes
        for (const s of this._strokes) {
            this._emitSmoke(s.x, s.y, s.r || this._brushSize);
        }
    }

    clear() {
        const layer = this._getLayer();
        layer.innerHTML = '';
        this._strokes = [];
    }

    // ── Layer ──

    _getLayer() {
        if (this._layer) return this._layer;
        let g = this.svg.querySelector(`#${this.layerId}`);
        if (!g) {
            g = document.createElementNS(NS, 'g');
            g.setAttribute('id', this.layerId);
            g.setAttribute('pointer-events', 'none');
            // Insert above units-layer so smoke renders on top
            const units = this.svg.querySelector('#units-layer');
            if (units && units.nextSibling) {
                this.svg.insertBefore(g, units.nextSibling);
            } else {
                this.svg.appendChild(g);
            }
        }
        this._layer = g;
        return g;
    }

    // ── CSS Keyframes ──

    _injectStyles() {
        if (document.getElementById('smoke-brush-styles')) return;

        const style = document.createElement('style');
        style.id = 'smoke-brush-styles';
        style.textContent = `
            @keyframes smokeFloat {
                0% {
                    transform: translate(0, 0) scale(0.4);
                    opacity: var(--smoke-opacity, 0.4);
                }
                15% {
                    opacity: var(--smoke-opacity, 0.4);
                }
                100% {
                    transform: translate(var(--smoke-drift-x, 10px), var(--smoke-rise-y, -50px)) scale(1.8);
                    opacity: 0;
                }
            }
            .smoke-particle {
                animation: smokeFloat var(--smoke-duration, 5s) ease-out forwards;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Painting handlers ──

    _handleMouseDown(e) {
        if (!this._active) return;
        e.stopPropagation();
        e.preventDefault();
        this._painting = true;
        const pt = this._screenToSVG(e.clientX, e.clientY);
        if (pt) this._paint(pt.x, pt.y);
    }

    _handleMouseMove(e) {
        if (!this._active || !this._painting) return;
        e.stopPropagation();
        e.preventDefault();
        const pt = this._screenToSVG(e.clientX, e.clientY);
        if (pt) this._paint(pt.x, pt.y);
    }

    _handleMouseUp(e) {
        if (this._painting) {
            e.stopPropagation();
            e.preventDefault();
        }
        this._painting = false;
    }

    _paint(svgX, svgY) {
        this._emitSmoke(svgX, svgY, this._brushSize);
        this._strokes.push({
            x: Math.round(svgX),
            y: Math.round(svgY),
            r: this._brushSize
        });
    }

    // ── Smoke particle emission ──

    /**
     * Spawn a cluster of animated smoke particles at a position.
     */
    _emitSmoke(cx, cy, radius) {
        const layer = this._getLayer();
        const cfg = SMOKE_CONFIG;

        // Particle count scales with brush size
        const sizeRatio = radius / 40; // 40 = default size
        const count = Math.floor(
            cfg.minParticles + (cfg.maxParticles - cfg.minParticles) * Math.min(sizeRatio, 1)
        );

        for (let i = 0; i < count; i++) {
            // Random position within the brush radius
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius * 0.8;
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;

            const r = cfg.minRadius + Math.random() * (cfg.maxRadius - cfg.minRadius);
            const opacity = cfg.minOpacity + Math.random() * (cfg.maxOpacity - cfg.minOpacity);
            const driftX = (Math.random() - 0.5) * cfg.driftRange * 2;
            const riseY = -(cfg.riseRange * 0.5 + Math.random() * cfg.riseRange * 0.5);
            const duration = cfg.durationMin + Math.random() * (cfg.durationMax - cfg.durationMin);
            const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];

            const particle = document.createElementNS(NS, 'circle');
            particle.setAttribute('cx', px);
            particle.setAttribute('cy', py);
            particle.setAttribute('r', r);
            particle.setAttribute('fill', color.replace('VAR', opacity.toFixed(2)));
            particle.setAttribute('class', 'smoke-particle');
            particle.style.setProperty('--smoke-opacity', opacity);
            particle.style.setProperty('--smoke-drift-x', driftX + 'px');
            particle.style.setProperty('--smoke-rise-y', riseY + 'px');
            particle.style.setProperty('--smoke-duration', duration + 's');

            layer.appendChild(particle);

            // Auto-remove after animation completes
            const removeDelay = duration * 1000 + 200;
            setTimeout(() => {
                if (particle.parentNode) particle.remove();
            }, removeDelay);
        }
    }

    // ── Coordinate conversion ──

    _screenToSVG(clientX, clientY) {
        const svg = this.svg;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const svgPt = pt.matrixTransform(ctm.inverse());
        return { x: svgPt.x, y: svgPt.y };
    }

    destroy() {
        this.deactivate();
        this.clear();
        this._strokes = [];
        this._layer = null;
        const styles = document.getElementById('smoke-brush-styles');
        if (styles) styles.remove();
    }
}
