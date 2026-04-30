// creatureVisuals.js - Creature rendering on the map field

/**
 * Create an SVG element for a creature placed on the map.
 * Has a visible anchor dot at the base position (sits on the movement trail).
 * Sprite is centered directly above the dot. ATK/DEF and level badges above.
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
    1: { w: 48, h: 56 },
    2: { w: 64, h: 72 },
    3: { w: 80, h: 90 }
  };
  const s = sizes[level] || sizes[1];

  // === Anchor dot — visible marker at the base position ===
  // This dot sits on the movement trail line, sprite anchors above it
  const isEnemy = creature._isEnemy || creature.owner === 'enemy';
  const dotColor = isEnemy ? '#ef4444' : '#a855f7';
  const dotStroke = isEnemy ? '#dc2626' : '#7c3aed';
  const badgeStrokeColor = isEnemy ? '#ef4444' : '#800080';
  const levelStrokeColor = isEnemy ? '#ef4444' : '#eab308';
  const levelFillColor = isEnemy ? '#fecaca' : '#fef08c';

  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute('cx', '0');
  dot.setAttribute('cy', '0');
  dot.setAttribute('r', '5');
  dot.setAttribute('fill', dotColor);
  dot.setAttribute('stroke', dotStroke);
  dot.setAttribute('stroke-width', '2');
  dot.style.pointerEvents = 'none';
  g.appendChild(dot);

  // === Invisible click padding — makes creatures easier to tap ===
  const clickPad = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  clickPad.setAttribute('x', '-30');
  clickPad.setAttribute('y', String(-s.h - 40));
  clickPad.setAttribute('width', '60');
  clickPad.setAttribute('height', String(s.h + 50));
  clickPad.setAttribute('fill', 'transparent');
  clickPad.style.pointerEvents = 'all';
  clickPad.style.cursor = 'pointer';
  g.appendChild(clickPad);

  // === Creature sprite — centered directly above the dot ===
  // Bottom edge of sprite touches the dot at y=0
  const spritePath = creature.sprite || 'assets/units/shadow-harvester.png';

  const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
  image.setAttribute('href', spritePath);
  image.setAttribute('width', String(s.w));
  image.setAttribute('height', String(s.h));
  image.setAttribute('x', '0');
  image.setAttribute('y', String(-s.h));  // bottom of sprite at dot (y=0)
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  image.style.pointerEvents = 'none';
  image.style.transformOrigin = 'center';
  // Clear any stale transform, then center horizontally
  image.removeAttribute('transform');
  image.setAttribute('transform', `translate(${-s.w / 2}, 0)`);
  g.appendChild(image);

  // === ATK / DEF BADGE ABOVE SPRITE ===
  const gap = 4;  // px gap between elements
  // statsGroup transform positions the badge rect so its bottom is `gap`px above sprite top (-s.h)
  // Badge rect: local y=-10, height=18, so local bottom = +8
  // Want bottom at -s.h - gap → transform Y = -s.h - gap - 8
  const statsY = -s.h - gap - 8;
  const statsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  statsGroup.setAttribute('transform', `translate(0, ${statsY})`);

  // Dark rounded rectangle behind stats
  const statsBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  statsBg.setAttribute('x', String(-s.w / 2));
  statsBg.setAttribute('y', '-10');
  statsBg.setAttribute('width', String(s.w));
  statsBg.setAttribute('height', '18');
  statsBg.setAttribute('rx', '4');
  statsBg.setAttribute('fill', 'rgba(10, 10, 15, 0.85)');
  statsBg.setAttribute('stroke', badgeStrokeColor);
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

  // === Level badge — centered above ATK/DEF badge ===
  // Circle: r≈9 (or 10 for lv3), center at 0,0 in group space → local bottom = +r
  // Want bottom gap px above rect top (statsY - 10) → bottom at statsY - 10 - gap
  // Transform Y + r = statsY - 10 - gap → transform Y = statsY - 10 - gap - r
  const badgeR = level >= 3 ? 10 : 9;
  const badgeY = statsY - 10 - gap - badgeR;
  const badgeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  badgeG.setAttribute('transform', `translate(0, ${badgeY})`);

  const badgeFont = level >= 3 ? 11 : 9.5;
  const txtY = level >= 3 ? 4 : 3.5;

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute('r', String(badgeR));
  bg.setAttribute('fill', '#111');
  bg.setAttribute('stroke', levelStrokeColor);
  bg.setAttribute('stroke-width', '1.5');
  badgeG.appendChild(bg);

  const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
  txt.setAttribute('x', '0');
  txt.setAttribute('y', String(txtY));
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', levelFillColor);
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
