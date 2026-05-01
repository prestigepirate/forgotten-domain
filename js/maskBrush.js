/**
 * MaskBrush — Permanent map mask painting tool.
 *
 * Paints a dark overlay on the map to permanently hide areas.
 * Used in the editor to black out regions players should never see.
 *
 * Stores strokes as a compact array for export/replay.
 *
 * Usage:
 *   const brush = new MaskBrush(svgElement, mapImageSelector);
 *   brush.activate();
 *   brush.deactivate();
 *   brush.setSize(30);          // brush radius in pixels
 *   brush.setFeather(0.5);      // 0=hard edge, 1=fully soft
 *   brush.getStrokes();         // export data
 *   brush.loadStrokes(strokes); // restore from saved data
 *   brush.clear();              // wipe all mask
 */

export class MaskBrush {
    /**
     * @param {SVGSVGElement} svg - The map SVG (used for coordinate reference)
     * @param {string} mapImageSelector - CSS selector for the map <img> element
     */
    constructor(svg, mapImageSelector) {
        this.svg = svg;
        this.mapImageSelector = mapImageSelector;
        this._canvas = null;
        this._ctx = null;
        this._active = false;
        this._painting = false;
        this._brushSize = 40;       // radius in pixels on the canvas
        this._feather = 0.3;        // 0 = hard edge, 1 = fully soft (gradient starts from center)
        this._strokes = [];         // [{x, y, r, f}, ...]
    }

    // ── Public API ──

    activate() {
        if (this._active) return;

        const img = document.querySelector(this.mapImageSelector);
        if (!img) {
            console.error('[MaskBrush] Map image not found:', this.mapImageSelector);
            return;
        }

        if (!img.complete || !img.naturalWidth) {
            img.onload = () => this._createCanvas(img);
            return;
        }
        this._createCanvas(img);
    }

    deactivate() {
        this._active = false;
        this._painting = false;
        if (this._canvas) {
            this._canvas.removeEventListener('mousedown', this._onMouseDown);
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener('mouseup', this._onMouseUp);
            this._canvas.removeEventListener('mouseleave', this._onMouseUp);
        }
        this.svg.style.pointerEvents = 'auto';
    }

    setSize(radius) {
        this._brushSize = Math.max(5, Math.min(200, radius));
    }

    getSize() {
        return this._brushSize;
    }

    /**
     * Set feather amount.
     * @param {number} val - 0 = hard edge, 1 = fully soft (gradient from center)
     */
    setFeather(val) {
        this._feather = Math.max(0, Math.min(1, val));
    }

    getFeather() {
        return this._feather;
    }

    getStrokes() {
        return this._strokes;
    }

    loadStrokes(strokes) {
        this._strokes = strokes || [];
        this._replayStrokes();
    }

    clear() {
        this._strokes = [];
        if (this._ctx && this._canvas) {
            this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        }
    }

    // ── Canvas setup ──

    _createCanvas(img) {
        const mapWrapper = document.getElementById('map-wrapper');
        if (!mapWrapper) return;

        if (this._canvas) {
            this._canvas.remove();
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'mask-canvas';
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 5;
        `;

        const svg = document.getElementById('map-overlay');
        if (svg) {
            mapWrapper.insertBefore(canvas, svg);
        } else {
            mapWrapper.appendChild(canvas);
        }

        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');

        this._replayStrokes();

        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);

        canvas.addEventListener('mousedown', this._onMouseDown);
        canvas.addEventListener('mousemove', this._onMouseMove);
        canvas.addEventListener('mouseup', this._onMouseUp);
        canvas.addEventListener('mouseleave', this._onMouseUp);

        canvas.style.pointerEvents = 'auto';
        canvas.style.cursor = 'crosshair';

        this._active = true;
    }

    // ── Painting ──

    _handleMouseDown(e) {
        if (!this._active) return;
        this._painting = true;
        const pt = this._screenToCanvas(e.clientX, e.clientY);
        if (pt) this._paint(pt.x, pt.y);
    }

    _handleMouseMove(e) {
        if (!this._active || !this._painting) return;
        const pt = this._screenToCanvas(e.clientX, e.clientY);
        if (pt) this._paint(pt.x, pt.y);
    }

    _handleMouseUp() {
        this._painting = false;
    }

    _paint(cx, cy) {
        if (!this._ctx) return;

        const r = this._brushSize;
        const f = this._feather;

        // Draw the feather-adjusted gradient stroke
        this._drawFeatheredCircle(cx, cy, r, f);

        // Store stroke with feather
        this._strokes.push({
            x: Math.round(cx),
            y: Math.round(cy),
            r: r,
            f: f
        });
    }

    /**
     * Draw a single feathered circle on the canvas.
     * @param {number} cx - center x
     * @param {number} cy - center y
     * @param {number} r - radius
     * @param {number} feather - 0=hard edge, 1=gradient from center
     */
    _drawFeatheredCircle(cx, cy, r, feather) {
        const ctx = this._ctx;

        // Solid core — from center to (1-feather)*radius
        const solidRadius = r * (1 - feather);
        if (solidRadius > 0.5) {
            ctx.fillStyle = 'rgba(2, 4, 8, 0.92)';
            ctx.beginPath();
            ctx.arc(cx, cy, solidRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Gradient edge — from solidRadius to r
        const fadeStart = Math.max(0.1, solidRadius);
        if (r - fadeStart > 0.5) {
            const gradient = ctx.createRadialGradient(cx, cy, fadeStart, cx, cy, r);
            gradient.addColorStop(0, 'rgba(2, 4, 8, 0.92)');
            gradient.addColorStop(1, 'rgba(2, 4, 8, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Stroke replay ──

    _replayStrokes() {
        if (!this._ctx || !this._canvas) return;
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        for (const s of this._strokes) {
            const r = s.r || this._brushSize;
            const f = s.f !== undefined ? s.f : this._feather;
            this._drawFeatheredCircle(s.x, s.y, r, f);
        }
    }

    // ── Coordinate conversion ──

    _screenToCanvas(clientX, clientY) {
        if (!this._canvas) return null;
        const rect = this._canvas.getBoundingClientRect();
        const scaleX = this._canvas.width / rect.width;
        const scaleY = this._canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    destroy() {
        this.deactivate();
        if (this._canvas) {
            this._canvas.remove();
            this._canvas = null;
            this._ctx = null;
        }
        this._strokes = [];
    }
}
