/**
 * Sigil & Summoned Creature SVG Rendering
 *
 * Factory functions that create SVG elements for sigils
 * and summoned creatures. Used by renderer.js.
 *
 * All coordinates are in SVG pixel space.
 */

// ============================================
// Sigil Rune SVG
// ============================================

/**
 * Create a sigil rune — a glowing geometric circle with radial lines.
 * Appears as a mystical rune circle on the base.
 *
 * @param {number} cx - Center x (pixels)
 * @param {number} cy - Center y (pixels)
 * @param {number} radius - Outer radius
 * @param {boolean} isComplete - Whether build is finished (affects glow)
 * @returns {SVGGElement}
 */
export function createSigilRuneSVG(cx, cy, radius = 16, isComplete = false) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'sigil-rune');

    const color = '#c084fc';  // soft purple for all sigils
    const glowColor = isComplete ? '#c084fc' : '#7c3aed';

    // Outer glow ring
    const glowRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glowRing.setAttribute('cx', cx);
    glowRing.setAttribute('cy', cy);
    glowRing.setAttribute('r', radius + 6);
    glowRing.setAttribute('fill', 'none');
    glowRing.setAttribute('stroke', glowColor);
    glowRing.setAttribute('stroke-width', isComplete ? '2' : '1.5');
    glowRing.setAttribute('opacity', isComplete ? '0.7' : '0.4');
    glowRing.style.filter = 'url(#soft-glow)';
    if (!isComplete) {
        glowRing.style.animation = 'sigilBuildPulse 1.5s ease-in-out infinite';
    }
    g.appendChild(glowRing);

    // Main circle
    const mainCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    mainCircle.setAttribute('cx', cx);
    mainCircle.setAttribute('cy', cy);
    mainCircle.setAttribute('r', radius);
    mainCircle.setAttribute('fill', 'rgba(10, 5, 20, 0.85)');
    mainCircle.setAttribute('stroke', color);
    mainCircle.setAttribute('stroke-width', '1.5');
    if (isComplete) {
        mainCircle.style.filter = 'url(#soft-glow)';
    }
    g.appendChild(mainCircle);

    // Radial lines (6, like a geometric rune)
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const innerR = radius * 0.4;
        const outerR = radius * 0.9;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', cx + Math.cos(angle) * innerR);
        line.setAttribute('y1', cy + Math.sin(angle) * innerR);
        line.setAttribute('x2', cx + Math.cos(angle) * outerR);
        line.setAttribute('y2', cy + Math.sin(angle) * outerR);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', isComplete ? '0.8' : '0.5');
        g.appendChild(line);
    }

    // Inner circle
    const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    innerCircle.setAttribute('cx', cx);
    innerCircle.setAttribute('cy', cy);
    innerCircle.setAttribute('r', radius * 0.35);
    innerCircle.setAttribute('fill', 'none');
    innerCircle.setAttribute('stroke', color);
    innerCircle.setAttribute('stroke-width', '1');
    innerCircle.setAttribute('opacity', '0.6');
    g.appendChild(innerCircle);

    // Center dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('r', 2);
    dot.setAttribute('fill', color);
    if (isComplete) {
        dot.style.filter = 'url(#soft-glow)';
    }
    g.appendChild(dot);

    return g;
}

// ============================================
// Build Progress Ring
// ============================================

/**
 * Create an SVG progress ring (arc) showing build/summon progress.
 *
 * @param {number} cx - Center x
 * @param {number} cy - Center y
 * @param {number} radius - Ring radius
 * @param {number} fraction - Progress 0.0 to 1.0
 * @param {string} color - Stroke color
 * @returns {SVGGElement}
 */
export function createProgressRing(cx, cy, radius, fraction, color = '#a78bfa') {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'progress-ring');

    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - fraction);

    // Background track
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', cx);
    track.setAttribute('cy', cy);
    track.setAttribute('r', radius);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.1)');
    track.setAttribute('stroke-width', '3');
    g.appendChild(track);

    // Progress arc
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arc.setAttribute('cx', cx);
    arc.setAttribute('cy', cy);
    arc.setAttribute('r', radius);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', color);
    arc.setAttribute('stroke-width', '3');
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('stroke-dasharray', circumference);
    arc.setAttribute('stroke-dashoffset', dashOffset);
    arc.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    arc.style.filter = 'url(#soft-glow)';
    arc.style.transition = 'stroke-dashoffset 0.3s ease';
    g.appendChild(arc);

    return g;
}

// ============================================
// Summoned Creature SVG
// ============================================

/**
 * Create a compact summoned creature visual.
 * Shows name, level, ATK/DEF in a small card stacked on the sigil.
 *
 * @param {Object} creature - SummonedCreature object
 * @param {number} cx - Center x position
 * @param {number} cy - Center y position
 * @param {boolean} isComplete - Whether summon is finished
 * @returns {SVGGElement}
 */
export function createSummonedCreatureSVG(creature, cx, cy, isComplete) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'summoned-creature');
    g.setAttribute('data-summoned-id', creature.id);
    g.style.cursor = 'pointer';

    const opacity = isComplete ? '1' : '0.55';
    const continentColors = {
        voxya: '#800080'
    };
    const continentColor = continentColors[creature.continent] || '#800080';

    // Size by level: higher level = bigger card
    const level = creature.level || 1;
    const cardW = 56 + (level - 1) * 12;   // 56 → 68 → 80
    const cardH = 40 + (level - 1) * 8;    // 40 → 48 → 56
    const imgW = 32 + (level - 1) * 8;     // 32 → 40 → 48
    const imgH = 24 + (level - 1) * 6;     // 24 → 30 → 36

    // Background card
    const card = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    card.setAttribute('x', cx - cardW / 2);
    card.setAttribute('y', cy - cardH / 2);
    card.setAttribute('width', cardW);
    card.setAttribute('height', cardH);
    card.setAttribute('rx', '4');
    card.setAttribute('fill', 'rgba(8, 8, 12, 0.9)');
    card.setAttribute('stroke', continentColor);
    card.setAttribute('stroke-width', '1');
    card.setAttribute('opacity', opacity);
    g.appendChild(card);

    // Creature sprite image
    if (creature.sprite) {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', creature.sprite);
        img.setAttribute('x', cx - imgW / 2);
        img.setAttribute('y', cy - imgH / 2 + 2);
        img.setAttribute('width', imgW);
        img.setAttribute('height', imgH);
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        img.setAttribute('opacity', opacity);
        img.setAttribute('clip-path', `inset(0 round 2px)`);
        g.appendChild(img);
    }

    // Continent color accent line at top
    const accent = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    accent.setAttribute('x1', cx - cardW / 2 + 4);
    accent.setAttribute('y1', cy - cardH / 2 + 4);
    accent.setAttribute('x2', cx + cardW / 2 - 4);
    accent.setAttribute('y2', cy - cardH / 2 + 4);
    accent.setAttribute('stroke', continentColor);
    accent.setAttribute('stroke-width', '2');
    accent.setAttribute('opacity', '0.8');
    g.appendChild(accent);

    // Creature name (truncated)
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('x', cx);
    nameText.setAttribute('y', cy - 14);
    nameText.setAttribute('text-anchor', 'middle');
    nameText.setAttribute('fill', '#e0e0e0');
    nameText.setAttribute('font-size', '8');
    nameText.setAttribute('font-weight', '600');
    nameText.setAttribute('opacity', opacity);
    const shortName = creature.name.length > 12
        ? creature.name.substring(0, 11) + '…'
        : creature.name;
    nameText.textContent = shortName;
    g.appendChild(nameText);

    // Level badge
    const levelBadge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    levelBadge.setAttribute('x', cx + cardW / 2 - 20);
    levelBadge.setAttribute('y', cy - cardH / 2 + 1);
    levelBadge.setAttribute('width', '19');
    levelBadge.setAttribute('height', '12');
    levelBadge.setAttribute('rx', '3');
    levelBadge.setAttribute('fill', 'rgba(0,0,0,0.5)');
    levelBadge.setAttribute('stroke', continentColor);
    levelBadge.setAttribute('stroke-width', '0.5');
    levelBadge.setAttribute('opacity', opacity);
    g.appendChild(levelBadge);

    const levelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    levelText.setAttribute('x', cx + cardW / 2 - 10);
    levelText.setAttribute('y', cy - cardH / 2 + 10);
    levelText.setAttribute('text-anchor', 'middle');
    levelText.setAttribute('fill', continentColor);
    levelText.setAttribute('font-size', '7');
    levelText.setAttribute('font-weight', 'bold');
    levelText.setAttribute('opacity', opacity);
    levelText.textContent = `Lv${creature.level}`;
    g.appendChild(levelText);

    // ATK / DEF row
    const atkText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    atkText.setAttribute('x', cx - 10);
    atkText.setAttribute('y', cy + cardH / 2 - 5);
    atkText.setAttribute('text-anchor', 'middle');
    atkText.setAttribute('fill', '#3b82f6');
    atkText.setAttribute('font-size', '8');
    atkText.setAttribute('font-weight', 'bold');
    atkText.setAttribute('opacity', opacity);
    atkText.textContent = `A${creature.atk}`;
    g.appendChild(atkText);

    const defText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    defText.setAttribute('x', cx + 12);
    defText.setAttribute('y', cy + cardH / 2 - 5);
    defText.setAttribute('text-anchor', 'middle');
    defText.setAttribute('fill', '#eab308');
    defText.setAttribute('font-size', '8');
    defText.setAttribute('font-weight', 'bold');
    defText.setAttribute('opacity', opacity);
    defText.textContent = `D${creature.def}`;
    g.appendChild(defText);

    // Summoning progress ring for incomplete creatures
    if (!isComplete) {

        // Small "Summoning..." text
        const statusText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        statusText.setAttribute('x', cx);
        statusText.setAttribute('y', cy + cardH / 2 - 5);
        statusText.setAttribute('text-anchor', 'middle');
        statusText.setAttribute('fill', '#a78bfa');
        statusText.setAttribute('font-size', '6');
        statusText.textContent = 'summoning...';
        g.appendChild(statusText);
    } else {
        // Subtle glow for completed summoned creatures
        g.style.filter = `drop-shadow(0 0 6px ${continentColor})`;
    }

    return g;
}

// ============================================
// Sigil Label
// ============================================

/**
 * Create a small label below the sigil showing status text.
 */
export function createSigilLabel(cx, cy, text, color = '#a78bfa') {
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', cy);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', color);
    label.setAttribute('font-size', '8');
    label.setAttribute('font-weight', '500');
    label.textContent = text;
    return label;
}
