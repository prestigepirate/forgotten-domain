/**
 * Visual Effects - Beautiful movement visuals for FDW Voxya
 * Adds glowing trails, arrival bursts, and pulse effects
 */

// ============================================
// Movement Visual Effects
// ============================================

/**
 * Apply movement visuals to a unit
 */
export function applyMovementVisuals(group, isMoving) {
    if (!group) return;

    if (isMoving) {
        // Strong purple/gold glow while moving
        group.style.filter = `
            drop-shadow(0 0 12px #c026d3)
            drop-shadow(0 0 25px #a855f7)
            brightness(1.15)
        `;
        group.style.transform = 'scale(1.08)';

        // Add motion trail element
        createTrailEffect(group);
    } else {
        // Stationary style
        group.style.filter = 'drop-shadow(0 0 8px #6b21a8)';
        group.style.transform = 'scale(1)';
        removeTrailEffect(group);
    }
}

/**
 * Create trailing energy effect behind moving unit
 */
function createTrailEffect(group) {
    if (group.dataset.hasTrail === 'true') return;

    const trail = document.createElementNS("http://www.w3.org/2000/svg", "g");
    trail.classList.add('movement-trail');

    // Purple energy streak (behind unit)
    const streak = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    streak.setAttribute('class', 'trail-streak');
    streak.setAttribute('rx', '8');
    streak.setAttribute('ry', '4');
    streak.setAttribute('fill', 'rgba(192, 38, 211, 0.4)');
    streak.setAttribute('stroke', '#c026d3');
    streak.setAttribute('stroke-width', '2');
    streak.setAttribute('stroke-opacity', '0.6');
    streak.style.filter = 'url(#soft-glow)';

    trail.appendChild(streak);

    // Insert at beginning (behind other elements)
    if (group.firstChild) {
        group.insertBefore(trail, group.firstChild);
    } else {
        group.appendChild(trail);
    }

    group.dataset.hasTrail = 'true';
}

/**
 * Remove trail effect from unit
 */
function removeTrailEffect(group) {
    const trail = group.querySelector('.movement-trail');
    if (trail) trail.remove();
    delete group.dataset.hasTrail;
}

/**
 * Create arrival burst effect at destination
 */
export function createArrivalEffect(svg, x, y) {
    // Big purple energy burst on arrival
    const burst = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    burst.setAttribute('cx', x);
    burst.setAttribute('cy', y);
    burst.setAttribute('r', '12');
    burst.setAttribute('fill', 'none');
    burst.setAttribute('stroke', '#a855f7');
    burst.setAttribute('stroke-width', '8');
    burst.setAttribute('opacity', '0.9');
    burst.setAttribute('stroke-dasharray', '4, 4');
    burst.style.filter = 'url(#strong-glow)';

    svg.appendChild(burst);

    // Animate burst expanding and fading
    let progress = 0;
    const animate = () => {
        progress += 0.02;
        if (progress >= 1) {
            burst.remove();
            return;
        }

        const currentR = 12 + (45 - 12) * progress;
        const currentOpacity = 0.9 * (1 - progress);
        const currentWidth = 8 * (1 - progress * 0.7);

        burst.setAttribute('r', currentR);
        burst.setAttribute('opacity', currentOpacity);
        burst.setAttribute('stroke-width', currentWidth);

        requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
}

/**
 * Apply pulse animation to selected unit
 */
export function applySelectedPulse(group) {
    if (!group) return;

    group.style.animation = 'unitPulse 1.2s infinite alternate';

    // Add keyframe if not present
    if (!document.getElementById('unit-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'unit-pulse-style';
        style.textContent = `
            @keyframes unitPulse {
                from {
                    filter: drop-shadow(0 0 12px #c026d3);
                    transform: scale(1);
                }
                to {
                    filter: drop-shadow(0 0 25px #e879f9) brightness(1.2);
                    transform: scale(1.05);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Remove pulse animation from unit
 */
export function removeSelectedPulse(group) {
    if (!group) return;
    group.style.animation = '';
}

/**
 * Create magical sparkles around unit
 */
export function createSparkles(group, x, y) {
    const sparkleCount = 5;
    const sparkles = [];

    for (let i = 0; i < sparkleCount; i++) {
        const sparkle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const angle = (Math.PI * 2 / sparkleCount) * i;
        const radius = 25;
        const sx = x + Math.cos(angle) * radius;
        const sy = y + Math.sin(angle) * radius;

        sparkle.setAttribute('cx', sx);
        sparkle.setAttribute('cy', sy);
        sparkle.setAttribute('r', '2');
        sparkle.setAttribute('fill', '#f4d03f');
        sparkle.style.filter = 'url(#soft-glow)';
        sparkle.style.opacity = '0.8';

        group.appendChild(sparkle);
        sparkles.push(sparkle);
    }

    // Animate sparkles fading out
    let progress = 0;
    const animate = () => {
        progress += 0.03;
        if (progress >= 1) {
            sparkles.forEach(s => s.remove());
            return;
        }

        sparkles.forEach((sparkle, i) => {
            sparkle.setAttribute('opacity', 0.8 * (1 - progress));
            sparkle.setAttribute('r', 2 * (1 - progress * 0.5));
        });

        requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
}

export default {
    applyMovementVisuals,
    createArrivalEffect,
    applySelectedPulse,
    removeSelectedPulse,
    createSparkles
};
