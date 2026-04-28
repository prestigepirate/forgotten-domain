// creatureVisuals.js - Creature rendering on the map field

/**
 * Create an SVG element for a creature placed on the map.
 * Shows the creature's sprite with ATK/DEF badges and level badge.
 * No card background — just the art floating on the field.
 */
export function createCreatureElement(creature) {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.classList.add('creature');
  g.dataset.creatureId = creature.id;
  g.style.pointerEvents = 'all';
  g.style.cursor = 'pointer';

  // Size by level: higher level = bigger sprite
  const level = creature.level || 1;
  const sizes = {
    1: { w: 48, h: 56, yOff: -28, glow: 'drop-shadow(0 0 6px #800080) drop-shadow(0 0 12px #4a0050)' },
    2: { w: 64, h: 72, yOff: -36, glow: 'drop-shadow(0 0 8px #800080) drop-shadow(0 0 16px #4a0050)' },
    3: { w: 80, h: 90, yOff: -45, glow: 'drop-shadow(0 0 10px #800080) drop-shadow(0 0 20px #4a0050)' }
  };
  const s = sizes[level] || sizes[1];

  // Use the creature's sprite from the database
  const spritePath = creature.sprite || 'assets/units/shadow-harvester.png';

  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
  image.setAttribute('href', spritePath);
  image.setAttribute('width', String(s.w));
  image.setAttribute('height', String(s.h));
  image.setAttribute('x', String(-s.w / 2));
  image.setAttribute('y', String(s.yOff));
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  image.style.transformOrigin = 'center';
  image.style.animation = 'creatureBreathe 3s ease-in-out infinite';
  image.style.pointerEvents = 'none';

  // Voxya faction purple glow (stronger for higher levels)
  g.style.filter = s.glow;

  g.appendChild(image);

  // === ATK / DEF BADGE ABOVE ===
  const statsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  statsGroup.setAttribute('transform', `translate(0, ${s.yOff - 10})`);

  // Dark rounded rectangle behind stats
  const statsBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  statsBg.setAttribute('x', String(-s.w / 2));
  statsBg.setAttribute('y', '-10');
  statsBg.setAttribute('width', String(s.w));
  statsBg.setAttribute('height', '18');
  statsBg.setAttribute('rx', '4');
  statsBg.setAttribute('fill', 'rgba(10, 10, 15, 0.85)');
  statsBg.setAttribute('stroke', '#800080');
  statsBg.setAttribute('stroke-width', '1');
  statsGroup.appendChild(statsBg);

  // ATK
  const atkText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  atkText.setAttribute('x', String(-s.w / 4));
  atkText.setAttribute('y', '2');
  atkText.setAttribute('text-anchor', 'middle');
  atkText.setAttribute('fill', '#3b82f6');
  atkText.setAttribute('font-size', level >= 3 ? '11' : '9');
  atkText.setAttribute('font-weight', 'bold');
  atkText.textContent = creature.atk ?? '1200';
  statsGroup.appendChild(atkText);

  // DEF
  const defText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  defText.setAttribute('x', String(s.w / 4));
  defText.setAttribute('y', '2');
  defText.setAttribute('text-anchor', 'middle');
  defText.setAttribute('fill', '#eab308');
  defText.setAttribute('font-size', level >= 3 ? '11' : '9');
  defText.setAttribute('font-weight', 'bold');
  defText.textContent = creature.def ?? '900';
  statsGroup.appendChild(defText);

  g.appendChild(statsGroup);

  // Level badge - centered above ATK/DEF
  const badgeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  badgeG.setAttribute('transform', `translate(0, ${s.yOff - 30})`);

  const badgeSize = level >= 3 ? 11 : 9;
  const badgeR = level >= 3 ? 10 : 9;
  const badgeY = level >= 3 ? 4 : 3.5;
  const badgeFont = level >= 3 ? 11 : 9.5;

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute('r', String(badgeR));
  bg.setAttribute('fill', '#111');
  bg.setAttribute('stroke', '#eab308');
  bg.setAttribute('stroke-width', '1.5');
  badgeG.appendChild(bg);

  const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
  txt.setAttribute('x', '0');
  txt.setAttribute('y', String(badgeY));
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', '#fef08c');
  txt.setAttribute('font-size', String(badgeFont));
  txt.setAttribute('font-weight', 'bold');
  txt.textContent = creature.level ?? 1;
  badgeG.appendChild(txt);
  g.appendChild(badgeG);

  return g;
}

/**
 * Show creature hover card
 */
export function showCreatureHoverCard(creature, x, y) {
  let hoverCard = document.getElementById('creature-hover-card');

  if (!hoverCard) {
    hoverCard = document.createElement('div');
    hoverCard.id = 'creature-hover-card';
    hoverCard.className = 'creature-hover-card';
    document.body.appendChild(hoverCard);
  }

  const typeLabel = creature.type || 'Unknown';
  const levelNum = creature.level ?? 1;
  const spritePath = creature.sprite || 'assets/units/shadow-harvester.png';

  hoverCard.innerHTML = `
    <div class="hover-card-image">
      <img src="${spritePath}" alt="${creature.name}" />
    </div>
    <div class="hover-card-content">
      <div class="hover-card-header">
        <span class="hover-creature-name">${creature.name}</span>
        <span class="hover-creature-level">Lv.${levelNum}</span>
      </div>
      <div class="hover-card-type">${typeLabel}</div>
      <div class="hover-card-stats">
        <div class="hover-stat">
          <span class="stat-label atk">ATK</span>
          <span class="stat-value">${creature.atk || '---'}</span>
        </div>
        <div class="hover-stat">
          <span class="stat-label def">DEF</span>
          <span class="stat-value">${creature.def || '---'}</span>
        </div>
      </div>
    </div>
  `;

  hoverCard.style.left = `${x + 15}px`;
  hoverCard.style.top = `${y - 10}px`;
  hoverCard.style.opacity = '1';
  hoverCard.style.pointerEvents = 'none';
}

/**
 * Hide creature hover card
 */
export function hideCreatureHoverCard() {
  const hoverCard = document.getElementById('creature-hover-card');
  if (hoverCard) {
    hoverCard.style.opacity = '0';
  }
}
