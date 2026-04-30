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
        // Spell cache for MagickBook panel
        // ============================================
        let cachedSpells = null;

        async function loadSpells() {
            if (cachedSpells) return cachedSpells;
            try {
                const res = await fetch('creatures-database.json');
                if (!res.ok) throw new Error('Not found');
                const db = await res.json();
                cachedSpells = (db.spells || []).sort((a, b) => a.cost - b.cost);
            } catch (e) {
                cachedSpells = [];
            }
            return cachedSpells;
        }

        function buildMagickbookPanel(spells) {
            const header = `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">MagickBook</span>
                    <span class="nav-panel-header-id">GRIM-0451</span>
                </div>`;

            if (spells.length === 0) {
                return header + `
                    <div class="nav-panel-row">
                        <span class="nav-panel-label">Grimoire State</span>
                        <span class="nav-panel-status">Sealed</span>
                    </div>`;
            }

            const rows = spells.map(s => `
                <div class="mb-spell-row">
                    <span class="mb-spell-cost">${s.cost}</span>
                    <span class="mb-spell-name">${esc(s.name)}</span>
                    <span class="mb-spell-type ${s.type.toLowerCase()}">${s.type}</span>
                </div>
            `).join('');

            return header + `
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Inscribed Spells</span>
                    <span class="nav-panel-value highlight">${spells.length}</span>
                </div>
                <div class="mb-spell-list">${rows}</div>`;
        }

        function esc(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        // ============================================
        // Panel content map
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

        // Preload spells for MagickBook panel
        loadSpells();

        // ============================================
        // Event listeners
        // ============================================
        navItems.forEach(item => {
            const panelKey = item.dataset.panel;
            if (panelKey === 'home') return;

            item.addEventListener('mouseenter', async () => {
                clearTimeout(hideTimeout);
                if (panelKey === 'magickbook') {
                    const spells = await loadSpells();
                    panelContent.innerHTML = buildMagickbookPanel(spells);
                } else {
                    panelContent.innerHTML = panelContentMap[panelKey] || '';
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
    });
})();
