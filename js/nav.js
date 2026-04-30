/**
 * Shared bottom nav panel — hover-triggered NASA-style panels
 */
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const panel = document.getElementById('nav-panel');
        const panelContent = document.getElementById('nav-panel-content');
        const navItems = document.querySelectorAll('.nav-item[data-panel]');
        if (!panel || !panelContent || navItems.length === 0) return;

        let hideTimeout;

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
            magickbook: `
                <div class="nav-panel-header">
                    <div class="nav-panel-header-dot"></div>
                    <span class="nav-panel-header-title">MagickBook</span>
                    <span class="nav-panel-header-id">GRIM-0451</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Active Sigils</span>
                    <span class="nav-panel-value highlight">3</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Resonance</span>
                    <span class="nav-panel-value">Warp / Veil / Pyre</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Last Invocation</span>
                    <span class="nav-panel-value">Echo Severance — Voxya</span>
                </div>
                <div class="nav-panel-row">
                    <span class="nav-panel-label">Grimoire State</span>
                    <span class="nav-panel-status">Bound</span>
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

        navItems.forEach(item => {
            const panelKey = item.dataset.panel;
            if (panelKey === 'home') return;

            item.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                panelContent.innerHTML = panelContentMap[panelKey] || '';
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
