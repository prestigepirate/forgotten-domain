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
                    html += `<div class="mb-spell-row">
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
                    html += `<div class="mb-cret-row">
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
                    html += `<div class="mb-spell-row">
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
