/**
 * FORGOTTEN DOMAIN: WYVVRSTVRM - MAIN MENU
 * Interactive main menu with planet selection
 */

import { generateStars } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    generateStars();
    setupPlanetLinks();
});

// Wait for all images to load before drawing lines
window.addEventListener('load', () => {
    drawPlanetConnections();
});

// Redraw lines on resize (debounced)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(drawPlanetConnections, 150);
});

/**
 * Check authentication state and update header UI
 */
function checkAuthState() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userMenuName = document.getElementById('user-menu-name');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.querySelector('.user-username');

    if (token && user.username) {
        // User is logged in
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userMenuName) userMenuName.textContent = `@${user.username}`;
        if (userDisplay) userDisplay.textContent = `@${user.username}`;

        // Setup logout handler
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.reload();
            });
        }
    } else {
        // User is not logged in
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');

        // Setup login button click
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                window.location.href = 'login.html';
            });
        }
    }
}

/**
 * Draw dotted connection lines from planets to username
 */
function drawPlanetConnections() {
    const svg = document.getElementById('planet-connections');
    const userDisplay = document.querySelector('.user-display');
    const planetLinks = document.querySelectorAll('.planet-link');

    if (!svg || !userDisplay || planetLinks.length === 0) return;

    // Remove old lines (keep defs)
    const defs = svg.querySelector('defs');
    while (svg.lastChild && svg.lastChild !== defs) {
        svg.removeChild(svg.lastChild);
    }

    const userRect = userDisplay.getBoundingClientRect();
    const userX = userRect.left + userRect.width / 2;
    const userY = userRect.top + userRect.height / 2;

    planetLinks.forEach((link, index) => {
        const linkRect = link.getBoundingClientRect();
        const x1 = linkRect.left + linkRect.width / 2;
        const y1 = linkRect.bottom + 5;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(userX));
        line.setAttribute('y2', String(userY));
        line.setAttribute('class', 'connection-line');
        line.style.animationDelay = `${index * 0.25}s`;

        svg.appendChild(line);
    });
}


/**
 * Spawn floating ember/ash particles over the loading screen
 */
function spawnEmbers(container, count = 50) {
    container.innerHTML = '';
    const types = ['fire', 'cinder', 'ash'];
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const ember = document.createElement('div');
        ember.classList.add('ember');
        ember.classList.add(types[Math.floor(Math.random() * types.length)]);

        // Size: 2-6px
        const size = 2 + Math.random() * 4;
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';

        // Start from bottom 30% of screen
        ember.style.left = (10 + Math.random() * 80) + '%';
        ember.style.top = (65 + Math.random() * 35) + '%';

        // Float upward with horizontal drift
        const dx = (Math.random() - 0.5) * 60;
        const dy = -(40 + Math.random() * 60);
        ember.style.setProperty('--dx', dx + 'vw');
        ember.style.setProperty('--dy', dy + 'vh');

        // Staggered timing
        ember.style.animationDelay = Math.random() * 2.5 + 's';
        ember.style.animationDuration = (2 + Math.random() * 2.5) + 's';

        frag.appendChild(ember);
    }
    container.appendChild(frag);
}

/**
 * Setup planet link click handlers with loading transition
 */
function setupPlanetLinks() {
    const planetLinks = document.querySelectorAll('.planet-link');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingProgress = document.getElementById('loading-progress');
    const emberContainer = document.getElementById('loading-embers');

    planetLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const continentName = link.dataset.continent;
            const href = link.href;
            const continentDisplay = link.querySelector('.planet-name')?.textContent || continentName;
            const loadingContinent = document.getElementById('loading-continent');

            // Update loading screen text
            if (loadingContinent) {
                loadingContinent.textContent = continentDisplay.toUpperCase();
            }

            // Spawn ember particles
            if (emberContainer) {
                spawnEmbers(emberContainer, 50);
            }

            // Show loading overlay
            loadingOverlay.classList.remove('hidden');

            // Reset and restart progress animation
            loadingProgress.style.animation = 'none';
            loadingProgress.offsetHeight;
            loadingProgress.style.animation = 'loadingProgress 2.5s ease-in-out';

            // Navigate after loading animation
            setTimeout(() => {
                window.location.href = href;
            }, 2600);
        });
    });
}

