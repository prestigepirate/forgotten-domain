/**
 * Shared bottom nav panel — hover-triggered NASA-style panels
 */
(function () {
    document.addEventListener('DOMContentLoaded', async () => {
        const panel = document.getElementById('nav-panel');
        const panelContent = document.getElementById('nav-panel-content');
        const navItems = document.querySelectorAll('.nav-item[data-panel]');
        if (!panel || !panelContent || navItems.length === 0) return;

        let hideTimeout;

        // ============================================
        // Database cache for MagickBook panel
        // ============================================
        let cachedSpells = null;
        let cachedCreatures = null;

        async function loadDatabase() {
            if (cachedSpells && cachedCreatures) return { spells: cachedSpells, creatures: cachedCreatures };
            try {
                const res = await fetch('creatures-database.json');
                if (!res.ok) throw new Error('Not found');
                const db = await res.json();
                cachedSpells = (db.spells || []).sort((a, b) => a.cost - b.cost);
                cachedCreatures = (db.creatures || []);
            } catch (e) {
                cachedSpells = [];
                cachedCreatures = [];
            }
            return { spells: cachedSpells, creatures: cachedCreatures };
        }

        // ============================================
        // Leaderboard cache
        // ============================================
        let cachedLeaderboard = null;
        let lbCacheTime = 0;
        const LB_CACHE_MS = 30000; // 30-second cache

        async function loadLeaderboard() {
            const now = Date.now();
            if (cachedLeaderboard && (now - lbCacheTime) < LB_CACHE_MS) return cachedLeaderboard;
            try {
                const res = await fetch('/api/leaderboard?limit=8');
                if (!res.ok) throw new Error('Uplink failed');
                const data = await res.json();
                cachedLeaderboard = data.leaderboard || [];
                lbCacheTime = now;
            } catch (e) {
                if (!cachedLeaderboard) cachedLeaderboard = [];
            }
            return cachedLeaderboard;
        }

        function buildLeaderboardPanel(board) {
            const header = `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">Dominion Leaderboard</span>
                    <span class="nav-panel-header-id">FD-CMD</span>
                </div>`;

            if (board.length === 0) {
                return header + `
                    <div class="mb-empty-state">
                        <div>No commanders on the board yet</div>
                    </div>`;
            }

            const rows = board.map((entry, i) => {
                const rank = i + 1;
                const rankClass = rank === 1 ? 'lb-rank-1' : rank === 2 ? 'lb-rank-2' : rank === 3 ? 'lb-rank-3' : '';
                const medal = rank === 1 ? '●' : rank === 2 ? '●' : rank === 3 ? '●' : rank;
                return `
                <div class="lb-mini-row">
                    <span class="lb-mini-rank ${rankClass}">${medal}</span>
                    <span class="lb-mini-name">${esc(entry.display_name || entry.username || 'Unknown')}</span>
                    <span class="lb-mini-score">${Number(entry.score || 0).toLocaleString()}</span>
                </div>`;
            }).join('');

            return header + `
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Commanders</span>
                    <span class="nav-panel-value highlight">${board.length}</span>
                </div>
                <div class="lb-mini-list">${rows}</div>`;
        }

        // ============================================
        // MagickBook panel builder
        // ============================================

        function buildMagickbookPanel(spells, creatures) {
            const condemnedList = spells.filter(s => s.type === 'Condemned');
            const regularSpells = spells.filter(s => s.type !== 'Condemned');

            const header = `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">MagickBook</span>
                    <span class="nav-panel-header-id">GRIM-0451</span>
                </div>`;

            const tabs = `
                <div class="mb-minitabs">
                    <button class="mb-minitab active" data-mb-tab="spells">Spells (${regularSpells.length})</button>
                    <button class="mb-minitab" data-mb-tab="creatures">Creatures (${creatures.length})</button>
                    <button class="mb-minitab" data-mb-tab="condemned">Condemned (${condemnedList.length})</button>
                </div>`;

            const spellsPane = buildSpellsPane(regularSpells);
            const creaturesPane = buildCreaturesPane(creatures);
            const condemnedPane = buildCondemnedPane(condemnedList);

            return header + tabs + `
                <div class="mb-panes">
                    <div class="mb-pane active" data-mb-pane="spells">${spellsPane}</div>
                    <div class="mb-pane" data-mb-pane="creatures">${creaturesPane}</div>
                    <div class="mb-pane" data-mb-pane="condemned">${condemnedPane}</div>
                </div>`;
        }

        function buildSpellsPane(spells) {
            if (spells.length === 0) {
                return '<div class="mb-empty-state">No spells inscribed</div>';
            }

            const CONTINENT_ORDER = ['voxya', 'orilyth', 'korvess', 'sanguis', 'silith9'];
            const CONTINENT_NAMES = {
                voxya: 'Voxya', orilyth: 'Orilyth', korvess: 'Korvess',
                sanguis: 'Sanguis', silith9: 'Silith-9'
            };
            const CONTINENT_COLORS = {
                voxya: '#800080', orilyth: '#3b82f6', korvess: '#10b981',
                sanguis: '#ef4444', silith9: '#c0c0c0'
            };

            const groups = {};
            for (const s of spells) {
                const key = s.continent || 'voxya';
                if (!groups[key]) groups[key] = [];
                groups[key].push(s);
            }
            for (const key of Object.keys(groups)) {
                groups[key].sort((a, b) => a.cost - b.cost);
            }

            let html = '';
            for (const cont of CONTINENT_ORDER) {
                const list = groups[cont];
                if (!list || list.length === 0) continue;
                html += `<div class="mb-cret-section">
                    <div class="mb-cret-continent">
                        <span class="mb-cret-dot" style="background:${CONTINENT_COLORS[cont]}"></span>
                        ${CONTINENT_NAMES[cont]} <span class="mb-cret-count">(${list.length})</span>
                    </div>`;
                for (const s of list) {
                    html += `<div class="mb-spell-row" data-spell-id="${escAttr(s.id)}">
                        <span class="mb-spell-cost">${s.cost}</span>
                        <span class="mb-spell-name">${esc(s.name)}</span>
                        <span class="mb-spell-type ${s.type.toLowerCase()}">${s.type}</span>
                    </div>`;
                }
                html += '</div>';
            }
            return `<div class="mb-spell-list">${html}</div>`;
        }

        function buildCreaturesPane(creatures) {
            if (creatures.length === 0) {
                return '<div class="mb-empty-state">No creatures catalogued</div>';
            }

            const CONTINENT_ORDER = ['voxya', 'orilyth', 'korvess', 'sanguis', 'silith9'];
            const CONTINENT_NAMES = {
                voxya: 'Voxya', orilyth: 'Orilyth', korvess: 'Korvess',
                sanguis: 'Sanguis', silith9: 'Silith-9'
            };
            const CONTINENT_COLORS = {
                voxya: '#800080', orilyth: '#3b82f6', korvess: '#10b981',
                sanguis: '#ef4444', silith9: '#c0c0c0'
            };

            // Group by continent, sorted by level then name
            const groups = {};
            for (const c of creatures) {
                const key = c.continent || 'unknown';
                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
            }
            for (const key of Object.keys(groups)) {
                groups[key].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
            }

            let html = '';
            for (const cont of CONTINENT_ORDER) {
                const list = groups[cont];
                if (!list || list.length === 0) continue;
                html += `<div class="mb-cret-section">
                    <div class="mb-cret-continent">
                        <span class="mb-cret-dot" style="background:${CONTINENT_COLORS[cont]}"></span>
                        ${CONTINENT_NAMES[cont]} <span class="mb-cret-count">(${list.length})</span>
                    </div>`;
                for (const c of list) {
                    html += `<div class="mb-cret-row" data-creature-id="${escAttr(c.id)}">
                        <span class="mb-cret-lv">Lv${c.level}</span>
                        <span class="mb-cret-name">${esc(c.name)}</span>
                        <span class="mb-cret-type">${esc(c.type || '')}</span>
                        <span class="mb-cret-stats">${c.atk}/${c.def}</span>
                        <span class="mb-cret-cost">⊕${c.essenceCost}</span>
                    </div>`;
                }
                html += '</div>';
            }
            return `<div class="mb-spell-list">${html}</div>`;
        }

        function buildCondemnedPane(condemned) {
            if (condemned.length === 0) {
                return `
                <div class="mb-spell-list">
                    <div class="mb-empty-state">
                        <div class="mb-empty-icon">⛓</div>
                        <div>Condemned — forbidden magicks sealed away</div>
                        <div class="mb-empty-sub">None yet discovered</div>
                    </div>
                </div>`;
            }

            const CONTINENT_ORDER = ['voxya', 'orilyth', 'korvess', 'sanguis', 'silith9'];
            const CONTINENT_NAMES = {
                voxya: 'Voxya', orilyth: 'Orilyth', korvess: 'Korvess',
                sanguis: 'Sanguis', silith9: 'Silith-9'
            };
            const CONTINENT_COLORS = {
                voxya: '#800080', orilyth: '#3b82f6', korvess: '#10b981',
                sanguis: '#ef4444', silith9: '#c0c0c0'
            };

            const groups = {};
            for (const c of condemned) {
                const key = c.continent || 'voxya';
                if (!groups[key]) groups[key] = [];
                groups[key].push(c);
            }
            for (const key of Object.keys(groups)) {
                groups[key].sort((a, b) => a.cost - b.cost);
            }

            let html = '';
            for (const cont of CONTINENT_ORDER) {
                const list = groups[cont];
                if (!list || list.length === 0) continue;
                html += `<div class="mb-cret-section">
                    <div class="mb-cret-continent">
                        <span class="mb-cret-dot" style="background:${CONTINENT_COLORS[cont]}"></span>
                        ${CONTINENT_NAMES[cont]} <span class="mb-cret-count">(${list.length})</span>
                    </div>`;
                for (const c of list) {
                    html += `<div class="mb-spell-row" data-spell-id="${escAttr(c.id)}">
                        <span class="mb-spell-cost">${c.cost}</span>
                        <span class="mb-spell-name">${esc(c.name)}</span>
                        <span class="mb-spell-type condemned">${c.type}</span>
                    </div>`;
                }
                html += '</div>';
            }
            return `<div class="mb-spell-list">${html}</div>`;
        }

        function esc(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function escAttr(str) {
            if (!str) return '';
            return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // ============================================
        // Spell tooltip system
        // ============================================
        let spellLookup = new Map();
        let tooltipEl = null;

        function ensureTooltip() {
            if (tooltipEl) return;
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'mb-spell-tooltip';
            document.body.appendChild(tooltipEl);
        }

        function generateTips(spell) {
            const tips = [];
            const e = (spell.effect || '').toLowerCase();
            const t = spell.type || '';

            if (t === 'Condemned') {
                tips.push('Set this on waypoints/bases enemies are likely to pass through.');
                if (e.includes('damage')) tips.push('Pair with slowing effects to keep enemies in the trap zone.');
                if (e.includes('teleport')) tips.push('Use near your King base to bounce invaders away.');
            }
            if (e.includes('ley-line')) {
                tips.push('Position creatures on ley-lines before casting for maximum impact.');
            }
            if (e.includes('sacrifice') || e.includes('destroy')) {
                tips.push('Sacrifice low-health or low-cost creatures for the best trade.');
            }
            if (e.includes('radius') || e.includes('tile')) {
                tips.push('Aim for clusters of enemies to maximize value.');
            }
            if (e.includes('root') || e.includes('slow')) {
                tips.push('Follow up with high-damage spells while the enemy is immobilized.');
            }
            if (e.includes('heal') || e.includes('regenerate')) {
                tips.push('Cast on creatures holding a defensive line for sustained value.');
            }
            if (e.includes('swap')) {
                tips.push('Use to reposition low-mobility creatures or pull a key unit out of danger.');
            }
            if (e.includes('control') || e.includes('disabled')) {
                tips.push('Turn the strongest enemy creature against its own allies.');
            }
            if (e.includes('reveal')) {
                tips.push('Cast before committing to an attack to avoid ambushes.');
            }
            if (spell.cost >= 8) {
                tips.push('High-cost ultimate — save mana and time it for a decisive push.');
            }
            if (tips.length === 0) {
                tips.push('Experiment with timing and positioning to find the best use case.');
            }
            return tips.slice(0, 2);
        }

        function generateCreatureTips(creature) {
            const tips = [];
            const e = (creature.effect || '').toLowerCase();
            const atk = creature.atk || 0;
            const def = creature.def || 0;
            const cost = creature.essenceCost || 0;

            if (atk > def + 500) tips.push('Glass cannon — protect with defensive spells or high-DEF allies.');
            else if (def > atk + 500) tips.push('Tank — place on the front line to absorb enemy attacks.');
            else tips.push('Balanced stats — versatile for both offense and defense.');

            if (cost <= 3) tips.push('Low cost — summon early to establish board presence.');
            if (cost >= 10) tips.push('Expensive — save essence and deploy when you can protect it.');
            if (e.includes('damage') || e.includes('destroy')) tips.push('Its ability deals damage — prioritize high-value targets.');
            if (e.includes('heal') || e.includes('regenerate')) tips.push('Keep near damaged allies to maximize healing value.');
            if (e.includes('buff') || e.includes('gain')) tips.push('Pair with link or synergy spells to amplify its buff effect.');
            if (e.includes('debuff') || e.includes('lose') || e.includes('reduce')) tips.push('Deploy near enemy clusters to spread the debuff.');
            if (tips.length === 1) tips.push('Experiment with positioning to maximize its impact.');
            return tips.slice(0, 2);
        }

        function wireSpellTooltips(spells, creatures) {
            // Build lookups
            spellLookup.clear();
            for (const s of spells) spellLookup.set(s.id, s);
            const creatureLookup = new Map();
            for (const c of creatures) creatureLookup.set(c.id, c);
            ensureTooltip();

            panelContent.addEventListener('mouseover', (e) => {
                const spellRow = e.target.closest('.mb-spell-row');
                const cretRow = e.target.closest('.mb-cret-row');
                
                // Hide if not over any row
                if (!spellRow && !cretRow) {
                    tooltipEl.classList.remove('visible');
                    return;
                }

                // Spell row
                if (spellRow) {
                    const id = spellRow.dataset.spellId;
                    const spell = spellLookup.get(id);
                    if (!spell) return;
                    buildSpellTooltip(spell);
                }

                // Creature row
                if (cretRow) {
                    const id = cretRow.dataset.creatureId;
                    const creature = creatureLookup.get(id);
                    if (!creature) return;
                    buildCreatureTooltip(creature);
                }
            });

            panelContent.addEventListener('mouseout', (e) => {
                const row = e.target.closest('.mb-spell-row, .mb-cret-row');
                if (!row || !e.relatedTarget || !e.relatedTarget.closest('.mb-spell-row, .mb-cret-row')) {
                    tooltipEl.classList.remove('visible');
                }
            });
        }

        function buildSpellTooltip(spell) {
            const tips = generateTips(spell);
            tooltipEl.innerHTML = `
                <div class="mb-tt-name">${esc(spell.name)}</div>
                <div class="mb-tt-meta">
                    <span class="mb-tt-cost">Cost ${spell.cost}</span>
                    <span class="mb-tt-type ${spell.type.toLowerCase()}">${spell.type}</span>
                </div>
                <div class="mb-tt-divider"></div>
                <div class="mb-tt-section-label">Effect</div>
                <div class="mb-tt-effect">${esc(spell.effect)}</div>
                ${spell.flavor ? '<div class="mb-tt-section-label">Flavor</div><div class="mb-tt-flavor">' + esc(spell.flavor) + '</div>' : ''}
                <div class="mb-tt-divider"></div>
                <div class="mb-tt-section-label">Tips</div>
                ${tips.map(t => '<div class="mb-tt-tip">' + esc(t) + '</div>').join('')}`;
            positionTooltip();
        }

        function buildCreatureTooltip(creature) {
            const tips = generateCreatureTips(creature);
            const effect = creature.effect || '';
            tooltipEl.innerHTML = `
                <div class="mb-tt-name">${esc(creature.name)}</div>
                <div class="mb-tt-meta">
                    <span class="mb-tt-cost">Lv${creature.level}</span>
                    <span class="mb-cret-stats" style="color:#cbd5e1;font-size:0.62rem">ATK ${creature.atk} / DEF ${creature.def}</span>
                </div>
                <div class="mb-tt-meta" style="margin-top:-4px">
                    <span class="mb-cret-lv" style="color:rgba(160,180,200,0.5);font-size:0.55rem">${esc(creature.type || 'Unknown')}</span>
                    <span class="mb-cret-cost" style="font-size:0.58rem">⊕${creature.essenceCost}</span>
                    <span class="mb-cret-lv" style="color:rgba(160,180,200,0.5);font-size:0.55rem">Mov ${creature.movement || 1}</span>
                </div>
                <div class="mb-tt-divider"></div>
                ${effect ? '<div class="mb-tt-section-label">Ability</div><div class="mb-tt-effect">' + esc(effect) + '</div>' : ''}
                ${creature.flavor ? '<div class="mb-tt-section-label">Flavor</div><div class="mb-tt-flavor">' + esc(creature.flavor) + '</div>' : ''}
                ${tips.length ? '<div class="mb-tt-divider"></div><div class="mb-tt-section-label">Tips</div>' + tips.map(t => '<div class="mb-tt-tip">' + esc(t) + '</div>').join('') : ''}`;
            positionTooltip();
        }

        function positionTooltip() {
            const panelRect = panel.getBoundingClientRect();
            tooltipEl.style.top = panelRect.top + 'px';
            tooltipEl.style.bottom = 'auto';
            tooltipEl.style.transform = 'none';
            tooltipEl.style.maxHeight = panelRect.height + 'px';
            tooltipEl.classList.add('visible');
        }

        // ============================================
        // Panel content map (non-MagickBook panels)
        // ============================================
        const panelContentMap = {
            player: `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">Player Record</span>
                    <span class="nav-panel-header-id">ID: PLYR-0001</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Designation</span>
                    <span class="nav-panel-value highlight">@prestigepirate</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Affiliation</span>
                    <span class="nav-panel-value">Unbound</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Continent</span>
                    <span class="nav-panel-value">Voxya — The Hollow Echo</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Status</span>
                    <span class="nav-panel-status">Active</span>
                </div>
            `,
            academicks: `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">Academicks</span>
                    <span class="nav-panel-header-id">ARCH-1207</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Bestiary Entries</span>
                    <span class="nav-panel-value highlight">47 / 218</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Lore Fragments</span>
                    <span class="nav-panel-value">12 collected</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Cartography</span>
                    <span class="nav-panel-value">Voxya · Orilyth · Korvess</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Archive Status</span>
                    <span class="nav-panel-status">Synced</span>
                </div>
            `,
        };

        // Preload database
        loadDatabase();

        // ============================================
        // Event listeners
        // ============================================
        navItems.forEach(item => {
            const panelKey = item.dataset.panel;
            if (panelKey === 'home') return;

            item.addEventListener('mouseenter', async () => {
                clearTimeout(hideTimeout);
                if (panelKey === 'magickbook') {
                    const db = await loadDatabase();
                    panelContent.innerHTML = buildMagickbookPanel(db.spells, db.creatures);
                    wireMiniTabs();
                    wireSpellTooltips(db.spells, db.creatures);
                    panel.style.left = '50%';
                    panel.style.right = 'auto';
                    panel.style.transform = 'translateX(-50%) translateY(0)';
                    panel.style.width = '';
                } else if (panelKey === 'leaderboard') {
                    const board = await loadLeaderboard();
                    panelContent.innerHTML = buildLeaderboardPanel(board);
                    panel.style.left = 'auto';
                    panel.style.right = '16px';
                    panel.style.transform = 'translateY(0)';
                    panel.style.width = '260px';
                } else {
                    panelContent.innerHTML = panelContentMap[panelKey] || '';
                    panel.style.left = '50%';
                    panel.style.right = 'auto';
                    panel.style.transform = 'translateX(-50%) translateY(0)';
                    panel.style.width = '';
                }
                panel.classList.add('visible');
                panel.classList.remove('hidden');
            });

            item.addEventListener('mouseleave', () => {
                hideTimeout = setTimeout(() => {
                    panel.classList.remove('visible');
                    setTimeout(() => panel.classList.add('hidden'), 200);
                }, 150);
            });
        });

        panel.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });

        panel.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                panel.classList.remove('visible');
                setTimeout(() => panel.classList.add('hidden'), 200);
            }, 150);
        });

        // ============================================
        // Mini-tab switching (inside MagickBook panel)
        // ============================================
        function wireMiniTabs() {
            const tabs = panelContent.querySelectorAll('.mb-minitab');
            const panes = panelContent.querySelectorAll('.mb-pane');

            tabs.forEach(tab => {
                tab.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const target = tab.dataset.mbTab;

                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    panes.forEach(p => p.classList.remove('active'));
                    const pane = panelContent.querySelector(`[data-mb-pane="${target}"]`);
                    if (pane) pane.classList.add('active');
                });
            });
        }
    });
})();
