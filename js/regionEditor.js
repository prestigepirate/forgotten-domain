/**
 * RegionEditor — Lasso-polygon region drawing tool for the map editor.
 *
 * Usage:
 *   const editor = new RegionEditor(svg, layerId);
 *   editor.activate();    // start drawing mode
 *   editor.deactivate();  // exit
 *   editor.getRegions();  // export data
 *   editor.loadRegions(regions); // restore saved regions
 *
 * Events are forwarded to the parent via callbacks:
 *   onRegionsChanged() — called whenever regions are added/removed
 */
const NS = 'http://www.w3.org/2000/svg';

export class RegionEditor {
    constructor(svg, layerId, opts = {}) {
        this.svg = svg;
        this.layerId = layerId;
        this.onRegionsChanged = opts.onRegionsChanged || null;

        /** @type {Array<{id: string, name: string, vertices: number[][]}>} */
        this.regions = [];

        // Drawing state
        this._active = false;
        this._vertices = [];           // [[x%, y%], ...]
        this._previewMouse = null;     // [x%, y%] — current mouse position
        this._layer = null;

        // Bound handlers for cleanup
        this._onClick = this._onClick.bind(this);
        this._onDblClick = this._onDblClick.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    // ── Public API ──

    activate() {
        if (this._active) return;
        this._active = true;
        this._vertices = [];
        this._previewMouse = null;
        this.svg.addEventListener('click', this._onClick, true);
        this.svg.addEventListener('dblclick', this._onDblClick, true);
        this.svg.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('keydown', this._onKeyDown);
        this.svg.style.cursor = 'crosshair';
        this._render();
    }

    deactivate() {
        if (!this._active) return;
        this._active = false;
        this._vertices = [];
        this._previewMouse = null;
        this.svg.removeEventListener('click', this._onClick, true);
        this.svg.removeEventListener('dblclick', this._onDblClick, true);
        this.svg.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('keydown', this._onKeyDown);
        this.svg.style.cursor = '';
        this._render();
    }

    getRegions() {
        return this.regions;
    }

    loadRegions(regions) {
        this.regions = regions || [];
        this._render();
    }

    // ── Drawing handlers ──

    _onClick(e) {
        if (!this._active) return;
        e.stopPropagation();
        e.preventDefault();

        const pt = this._screenToPercent(e.clientX, e.clientY);

        // Check if clicking near first vertex to close (need 3+ vertices)
        if (this._vertices.length >= 3) {
            const first = this._vertices[0];
            const dist = Math.sqrt((pt.x - first[0]) ** 2 + (pt.y - first[1]) ** 2);
            if (dist < 4) {
                this._finishRegion();
                return;
            }
        }

        this._vertices.push([Math.round(pt.x), Math.round(pt.y)]);
        this._render();
    }

    _onDblClick(e) {
        if (!this._active || this._vertices.length < 3) return;
        e.stopPropagation();
        e.preventDefault();
        this._finishRegion();
    }

    _onMouseMove(e) {
        if (!this._active) return;
        const pt = this._screenToPercent(e.clientX, e.clientY);
        this._previewMouse = [Math.round(pt.x), Math.round(pt.y)];
        this._render();
    }

    _onKeyDown(e) {
        if (!this._active) return;
        if (e.key === 'Escape') {
            this._vertices = [];
            this._previewMouse = null;
            this._render();
        }
    }

    _finishRegion() {
        if (this._vertices.length < 3) return;
        const name = prompt('Region name:', 'New Region');
        if (!name) {
            this._vertices = [];
            this._previewMouse = null;
            this._render();
            return;
        }
        this.regions.push({
            id: 'region-' + Date.now(),
            name: name,
            vertices: [...this._vertices] // deep copy
        });
        this._vertices = [];
        this._previewMouse = null;
        this._render();
        if (this.onRegionsChanged) this.onRegionsChanged();
    }

    // ── Rendering ──

    _render() {
        const layer = this._getLayer();
        layer.innerHTML = '';

        const dims = this._getDims();

        // Render saved regions
        for (const region of this.regions) {
            if (!region.vertices || region.vertices.length < 3) continue;

            const pointsStr = region.vertices
                .map(v => `${(v[0] / 100) * dims.w},${(v[1] / 100) * dims.h}`)
                .join(' ');

            const poly = document.createElementNS(NS, 'polygon');
            poly.setAttribute('points', pointsStr);
            poly.setAttribute('fill', 'rgba(124, 58, 237, 0.12)');
            poly.setAttribute('stroke', 'rgba(124, 58, 237, 0.45)');
            poly.setAttribute('stroke-width', '1.5');
            poly.setAttribute('class', 'editor-region');
            poly.setAttribute('data-region-id', region.id);
            poly.style.cursor = 'pointer';
            poly.style.transition = 'fill 0.2s';

            poly.addEventListener('mouseenter', () => {
                poly.setAttribute('fill', 'rgba(124, 58, 237, 0.22)');
                poly.setAttribute('stroke', 'rgba(124, 58, 237, 0.8)');
            });
            poly.addEventListener('mouseleave', () => {
                poly.setAttribute('fill', 'rgba(124, 58, 237, 0.12)');
                poly.setAttribute('stroke', 'rgba(124, 58, 237, 0.45)');
            });
            poly.addEventListener('dblclick', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                if (confirm(`Delete region "${region.name}"?`)) {
                    const idx = this.regions.findIndex(r => r.id === region.id);
                    if (idx >= 0) this.regions.splice(idx, 1);
                    this._render();
                    if (this.onRegionsChanged) this.onRegionsChanged();
                }
            });

            layer.appendChild(poly);

            // Name label at centroid
            let cx = 0, cy = 0;
            region.vertices.forEach(v => { cx += v[0]; cy += v[1]; });
            cx = (cx / region.vertices.length / 100) * dims.w;
            cy = (cy / region.vertices.length / 100) * dims.h;

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', cx);
            label.setAttribute('y', cy);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('fill', '#c4b5fd');
            label.setAttribute('font-size', '10');
            label.setAttribute('font-family', 'Times New Roman, serif');
            label.setAttribute('letter-spacing', '0.08em');
            label.setAttribute('pointer-events', 'none');
            label.textContent = region.name;
            layer.appendChild(label);
        }

        // Render live polygon preview
        if (this._active && this._vertices.length >= 1) {
            // Drawn edges
            for (let i = 0; i < this._vertices.length - 1; i++) {
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', (this._vertices[i][0] / 100) * dims.w);
                line.setAttribute('y1', (this._vertices[i][1] / 100) * dims.h);
                line.setAttribute('x2', (this._vertices[i + 1][0] / 100) * dims.w);
                line.setAttribute('y2', (this._vertices[i + 1][1] / 100) * dims.h);
                line.setAttribute('stroke', '#a78bfa');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('stroke-dasharray', '6 3');
                line.setAttribute('pointer-events', 'none');
                layer.appendChild(line);
            }

            // Rubber-band to mouse
            if (this._previewMouse) {
                const last = this._vertices[this._vertices.length - 1];
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', (last[0] / 100) * dims.w);
                line.setAttribute('y1', (last[1] / 100) * dims.h);
                line.setAttribute('x2', (this._previewMouse[0] / 100) * dims.w);
                line.setAttribute('y2', (this._previewMouse[1] / 100) * dims.h);
                line.setAttribute('stroke', '#fbbf24');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('stroke-dasharray', '4 4');
                line.setAttribute('opacity', '0.6');
                line.setAttribute('pointer-events', 'none');
                layer.appendChild(line);
            }

            // Vertex dots
            this._vertices.forEach(v => {
                const dot = document.createElementNS(NS, 'circle');
                dot.setAttribute('cx', (v[0] / 100) * dims.w);
                dot.setAttribute('cy', (v[1] / 100) * dims.h);
                dot.setAttribute('r', '5');
                dot.setAttribute('fill', '#a78bfa');
                dot.setAttribute('stroke', '#7c3aed');
                dot.setAttribute('stroke-width', '2');
                dot.setAttribute('pointer-events', 'none');
                layer.appendChild(dot);
            });

            // Green close target on first vertex (3+ vertices)
            if (this._vertices.length >= 3) {
                const first = this._vertices[0];
                const closeDot = document.createElementNS(NS, 'circle');
                closeDot.setAttribute('cx', (first[0] / 100) * dims.w);
                closeDot.setAttribute('cy', (first[1] / 100) * dims.h);
                closeDot.setAttribute('r', '8');
                closeDot.setAttribute('fill', 'none');
                closeDot.setAttribute('stroke', '#22c55e');
                closeDot.setAttribute('stroke-width', '2');
                closeDot.setAttribute('stroke-dasharray', '3 3');
                closeDot.setAttribute('pointer-events', 'none');
                closeDot.style.animation = 'pulse 1.5s ease-in-out infinite';
                layer.appendChild(closeDot);
            }
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

    _getDims() {
        if (this.svg.clientWidth && this.svg.clientHeight) {
            return { w: this.svg.clientWidth, h: this.svg.clientHeight };
        }
        const bbox = this.svg.getBoundingClientRect();
        return { w: bbox.width || 1000, h: bbox.height || 800 };
    }

    _screenToPercent(clientX, clientY) {
        const svg = this.svg;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 50, y: 50 };
        const svgPt = pt.matrixTransform(ctm.inverse());
        const dims = this._getDims();
        return {
            x: (svgPt.x / dims.w) * 100,
            y: (svgPt.y / dims.h) * 100
        };
    }

    destroy() {
        this.deactivate();
        this.regions = [];
        if (this._layer) {
            this._layer.innerHTML = '';
        }
    }
}
