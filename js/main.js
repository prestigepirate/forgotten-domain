/**
 * Voxya - The Shattered Archipelago
 * Main Entry Point
 *
 * Initializes game systems: bases, rendering, sigils, summoning
 */

import { createVoxyaSystem } from './provinces.js';
import { Renderer } from './renderer.js';
import { getElement, setEnabled, log } from './utils.js';
import { SigilManager, SIGIL_MANA_COST, formatTimeRemaining } from './sigils.js';
import { loadCreatureDatabase, buildCreatureIndex, getCreaturesByContinent, getSummonCost } from './creatureDatabase.js';
import { createToastContainer, showToast } from './toasts.js';

// ============================================
// Game Constants
// ============================================

const PLAYER_ID = 'player-1';
const PLAYER_NAME = 'Shadow Lord';
const MIN_SUMMON_COST = 3;

// ============================================
// Game State
// ============================================

const state = {
    tick: 0,
    mana: 5,
    maxMana: 10,
    actions: 3,
    maxActions: 3,
    selectedBaseId: null,
    baseSystem: null,
    renderer: null,
    ownedBaseIds: new Set(),
    playerOrigin: null,
    // Sigil & summoning system
    sigils: new Map(),                   // Map<baseId, Sigil>
    summonedCreatures: [],               // Array<SummonedCreature>
    creatureDatabase: null,              // Full loaded database
    creatureDBIndex: null,               // Map<id, creatureEntry>
    sigilManager: null                   // SigilManager instance
};

// ============================================
// UI Cache
// ============================================

const ui = {
    tickCount: null,
    manaCount: null,
    actionsCount: null,
    originName: null,
    btnSigil: null,
    btnSummon: null,
    btnEndTurn: null,
    statusMessage: null
};

// SVG Overlay reference
let svgOverlay;

// ============================================
// Initialization
// ============================================

async function init() {
    log('Initializing Voxya...');

    // Cache UI elements
    ui.tickCount = getElement('tick-count');
    ui.manaCount = getElement('mana-count');
    ui.actionsCount = getElement('actions-count');
    ui.btnSigil = getElement('btn-sigil');
    ui.btnEndTurn = getElement('btn-end-turn');
    ui.statusMessage = getElement('status-message');
    ui.btnSummon = getElement('btn-summon');
    ui.originName = getElement('origin-name');

    // Initialize systems
    state.baseSystem = createVoxyaSystem();
    state.playerOrigin = 'voxya-throne';

    svgOverlay = getElement('map-overlay');
    state.renderer = new Renderer(svgOverlay, { theme: 'voxya' });
    state.renderer.init(state.baseSystem);

    // Setup event listeners BEFORE any async work — so base clicks
    // are handled even while the creature database is loading
    setupEventListeners();
    setupMapInteraction();

    // Diagnostic: window-level click listener
    // window.addEventListener('click', (e) => {
    //     console.log('[Window] Click at', e.clientX, e.clientY,
    //         'target:', e.target.tagName,
    //         'target.id:', e.target.id,
    //         'target.class:', e.target.className?.baseVal || e.target.className,
    //         'path:', e.composedPath().slice(0, 5).map(el => el.tagName || el.nodeName).join(' > '));
    // }, true);

    // Load creature database for summoning
    try {
        state.creatureDatabase = await loadCreatureDatabase();
        state.creatureDBIndex = buildCreatureIndex(state.creatureDatabase);
        log(`Creature database loaded: ${state.creatureDBIndex.size} creatures`);
    } catch (err) {
        log('Could not load creature database:', err.message);
    }

    // Initialize sigil manager
    state.sigilManager = new SigilManager(
        state.sigils,
        state.summonedCreatures,
        handleSigilEvent,
        state  // mana state reference
    );

    // Create toast container
    createToastContainer();

    // Initial UI update
    updateUI();

    // Start animation loops
    requestAnimationFrame(sigilRenderLoop);

    // Initialize starfield background
    initStarfield();

    log('Game ready!');
    setStatus('Select a base to begin');
}

// ============================================
// Starfield Background
// ============================================

function initStarfield() {
    const starfield = document.getElementById('starfield');
    if (!starfield) return;

    const starCount = 150;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.animationDelay = Math.random() * 3 + 's';
        starfield.appendChild(star);
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Action buttons
    ui.btnSigil?.addEventListener('click', craftSigil);
    ui.btnSummon?.addEventListener('click', openSummonCreatureMenu);
    ui.btnEndTurn?.addEventListener('click', endTurn);

    // Editor buttons
    getElement('btn-edit-map')?.addEventListener('click', toggleEditMode);
    getElement('btn-add-base')?.addEventListener('click', toggleAddBaseMode);
    getElement('btn-export-layout')?.addEventListener('click', () => {
        state.renderer.exportLayout();
        setStatus('Base layout exported to JSON');
    });

    // Capture-phase handler: catches ALL clicks on base markers,
    // even if stopPropagation was called in the bubble phase by
    // the base marker or panning handlers.
    svgOverlay.addEventListener('click', (e) => {
        // Look up the DOM tree for a base marker
        const marker = e.target.closest('.base-marker');
        if (marker && marker.dataset && marker.dataset.base) {
            const baseId = marker.dataset.base;
            const base = state.baseSystem.getById(baseId);
            if (base) {
                e.stopPropagation();
                state.renderer.selectedBaseId = baseId;
                state.renderer.renderSelection();
                onBaseSelected(baseId, e.clientX, e.clientY);
                return;
            }
        }
        // Original: background click closes popups
        if (e.target === e.currentTarget) {
            hideBasePopup();
            clearSelection();
        }
    }, true); // <-- capture phase!

    // Prevent map drag when clicking on SVG in edit mode
    svgOverlay.addEventListener('mousedown', (e) => {
        if (state.renderer && state.renderer.isEditMode) {
            e.stopPropagation();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(e) {
    // Shift+E: Toggle edit mode
    if (e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        toggleEditMode();
    }
    // Escape: Cancel carrying, close popup, or clear selection
    if (e.key === 'Escape') {
        hideBasePopup();
        if (state.renderer && state.renderer.carryingBaseId) {
            state.renderer._dropBase();
            setStatus('Base placed');
            return;
        }
        clearSelection();
    }
}

function toggleEditMode() {
    const newMode = !state.renderer.isEditMode;
    state.renderer.setEditMode(newMode);

    // Update button states
    const editBtn = getElement('btn-edit-map');
    const addBaseBtn = getElement('btn-add-base');

    if (editBtn) {
        editBtn.classList.toggle('active', newMode);
    }

    // Hide/show add base button
    if (addBaseBtn) {
        addBaseBtn.style.display = newMode ? 'flex' : 'none';
        addBaseBtn.classList.remove('active');
    }

    // Show/hide editor palette
    if (newMode) {
        showEditorPalette();
    } else {
        hideEditorPalette();
    }

    if (newMode) {
        setStatus('Editor: Move = drag bases | Connect = shift+click two bases | Right-click base = delete | Click path = delete');
    } else {
        setStatus('Gameplay Mode restored');
    }
}

function toggleAddBaseMode() {
    if (!state.renderer || !state.renderer.isEditMode) return;

    const newMode = !state.renderer.addBaseMode;
    state.renderer.setAddBaseMode(newMode);

    const addBaseBtn = getElement('btn-add-base');
    if (addBaseBtn) {
        addBaseBtn.classList.toggle('active', newMode);
    }

    if (newMode) {
        setStatus('Add Base Mode: Click anywhere on the map to create a new base. Click "Add Base" again to exit.');
    } else {
        setStatus('Edit Mode: Drag bases, create paths, or export.');
    }
}

// ============================================
// Editor Palette
// ============================================

function createEditorPalette() {
    if (document.getElementById('editor-palette')) return;

    const palette = document.createElement('div');
    palette.id = 'editor-palette';
    palette.className = 'editor-palette';

    palette.innerHTML = `
        <div class="editor-palette-title">Map Editor</div>
        <div class="editor-palette-actions">
            <button class="editor-palette-btn" data-action="move">&#9872; Move</button>
            <button class="editor-palette-btn" data-action="connect">&#9727; Connect</button>
            <button class="editor-palette-btn" data-action="add-base">&#9670; +Base</button>
            <button class="editor-palette-btn" data-action="add-waypoint">&#9678; +Waypoint</button>
            <button class="editor-palette-btn" data-action="add-king">&#9813; +King</button>
            <button class="editor-palette-btn editor-palette-danger" data-action="remove">&#10007; Remove</button>
            <button class="editor-palette-btn" data-action="export">&#128229; Export</button>
            <button class="editor-palette-btn editor-palette-exit" data-action="exit">&#10005; Exit</button>
        </div>
    `;

    document.body.appendChild(palette);

    // Wire button events
    palette.addEventListener('click', (e) => {
        const btn = e.target.closest('.editor-palette-btn');
        if (!btn) return;
        const action = btn.dataset.action;

        // Remove active state from all buttons
        palette.querySelectorAll('.editor-palette-btn').forEach(b => b.classList.remove('active'));

        switch (action) {
            case 'move':
                btn.classList.add('active');
                state.renderer.addBaseMode = false;
                state.renderer.pathCreationMode = false;
                state.renderer.pathStartBase = null;
                state.renderer.deleteMode = false;
                setStatus('Move Mode: Drag any base to reposition it');
                break;
            case 'connect':
                btn.classList.add('active');
                state.renderer.addBaseMode = false;
                state.renderer.deleteMode = false;
                state.renderer.pathCreationMode = true;
                state.renderer.pathStartBase = null;
                setStatus('Connect Mode: Click first base, then second base to create a path');
                break;
            case 'add-base':
                btn.classList.add('active');
                state.renderer.setAddBaseType('base');
                setStatus('Add Base: Click anywhere on the map');
                break;
            case 'add-waypoint':
                btn.classList.add('active');
                state.renderer.setAddBaseType('waypoint');
                setStatus('Add Waypoint: Click anywhere on the map');
                break;
            case 'add-king':
                btn.classList.add('active');
                state.renderer.setAddBaseType('king-base');
                setStatus('Add King Base: Click anywhere on the map');
                break;
            case 'remove':
                btn.classList.add('active');
                state.renderer.addBaseMode = false;
                state.renderer.pathCreationMode = false;
                state.renderer.deleteMode = true;
                setStatus('Remove Mode: Click any base to delete it');
                break;
            case 'export':
                state.renderer.exportLayout();
                setStatus('Layout exported to JSON');
                break;
            case 'exit':
                toggleEditMode();
                break;
        }
    });
}

function showEditorPalette() {
    try {
        createEditorPalette();
        const palette = document.getElementById('editor-palette');
        if (palette) {
            palette.classList.add('visible');
            // Default: activate move mode
            const moveBtn = palette.querySelector('[data-action="move"]');
            if (moveBtn) moveBtn.classList.add('active');
            setStatus('Move Mode: Drag any base to reposition it');
            console.log('[Editor] Palette shown');
        } else {
            console.error('[Editor] Failed to find palette element after creation');
        }
    } catch (err) {
        console.error('[Editor] showEditorPalette error:', err.message);
    }
}

function hideEditorPalette() {
    try {
        const palette = document.getElementById('editor-palette');
        if (palette) {
            palette.classList.remove('visible');
        }
    } catch (err) {
        console.error('[Editor] hideEditorPalette error:', err.message);
    }
}

// ============================================
// Map Interaction (Pan/Zoom)
// ============================================

const mapState = {
    scale: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0
};

function setupMapInteraction() {
    const wrapper = getElement('map-wrapper');
    if (!wrapper) return;

    const svgOverlay = getElement('map-overlay');

    // Default cursor: base markers use pointer (set by renderer),
    // empty map areas use the default arrow
    wrapper.style.cursor = '';

    // Prevent browser from hijacking pointer events for scroll/zoom
    svgOverlay.style.touchAction = 'none';

    // Pointer down - start panning
    svgOverlay.addEventListener('pointerdown', (e) => {
        // Don't pan if in edit mode (editing takes priority)
        if (state.renderer && state.renderer.isEditMode) return;
        // Don't pan if clicking on a base marker
        if (e.target.closest('.base-marker')) return;

        mapState.isPanning = true;
        mapState.panStartX = e.clientX - mapState.panX;
        mapState.panStartY = e.clientY - mapState.panY;
        wrapper.style.cursor = 'grabbing';
        svgOverlay.setPointerCapture(e.pointerId);
    });

    // Pointer move - pan the map
    svgOverlay.addEventListener('pointermove', (e) => {
        if (!mapState.isPanning) return;
        mapState.panX = e.clientX - mapState.panStartX;
        mapState.panY = e.clientY - mapState.panStartY;
        applyMapTransform();
    });

    // Pointer up - stop panning, reset cursor
    svgOverlay.addEventListener('pointerup', (e) => {
        if (mapState.isPanning) {
            mapState.isPanning = false;
            wrapper.style.cursor = '';
            svgOverlay.releasePointerCapture(e.pointerId);
        }
    });

    // Zoom controls
    getElement('zoom-in')?.addEventListener('click', () => {
        mapState.scale = Math.min(3, mapState.scale + 0.2);
        applyMapTransform();
    });

    getElement('zoom-out')?.addEventListener('click', () => {
        mapState.scale = Math.max(0.5, mapState.scale - 0.2);
        applyMapTransform();
    });

    getElement('reset-view')?.addEventListener('click', () => {
        mapState.scale = 1;
        mapState.panX = 0;
        mapState.panY = 0;
        applyMapTransform();
    });

    // Toggle custom base names
    getElement('toggle-sub-names')?.addEventListener('click', () => {
        state.renderer.toggleCustomBaseNames();
    });

    // Toggle visual effects (selection ring, trails, and connection paths)
    getElement('toggle-paths')?.addEventListener('click', () => {
        state.renderer.toggleVisualEffects();
    });
}

function applyMapTransform() {
    // Transform the wrapper (moves background + SVG together)
    const wrapper = getElement('map-wrapper');
    if (wrapper) {
        wrapper.style.transform = `translate(${mapState.panX}px, ${mapState.panY}px) scale(${mapState.scale})`;
    }
}

// ============================================
// Base Selection
// ============================================

function onBaseSelected(baseId, clientX, clientY) {
    console.log('[Main] onBaseSelected:', baseId, 'clientX:', clientX, 'clientY:', clientY);
    state.selectedBaseId = baseId;
    const base = state.baseSystem.getById(baseId);

    if (!base) {
        console.warn('[Main] onBaseSelected: base not found for id', baseId);
        return;
    }

    console.log('[Main] onBaseSelected: base found —', base.name, base.type);

    // Update button states for bottom bar
    updateButtonStates(base);

    // Show context popup near the clicked base
    showBasePopup(base, clientX, clientY);

    setStatus(`Selected: ${base.name}`);
}

// Register global handler so renderer can call it directly (bypasses CustomEvent issues)
window.handleBaseSelected = onBaseSelected;

function clearSelection() {
    state.selectedBaseId = null;
    state.renderer.clearSelection();
    hideBasePopup();
    setStatus('Select a base to begin');
}

// ============================================
// Base Context Popup
// ============================================

/**
 * Show a context popup near a clicked base with relevant actions.
 * Content varies based on base ownership and sigil state.
 */
function showBasePopup(base, clientX, clientY) {
    console.log('[Main] showBasePopup called:', base.name, 'type:', base.type, 'clientX:', clientX, 'clientY:', clientY);
    hideBasePopup();

    const sigil = state.sigils.get(base.id);
    const sigilComplete = sigil && sigil.isComplete;
    const summonedCount = sigil
        ? state.summonedCreatures.filter(sc => sc.baseId === base.id && sc.isComplete).length
        : 0;

    const popup = document.createElement('div');
    popup.id = 'base-action-popup';
    popup.className = 'base-action-popup';
    // Ensure visibility (belt-and-suspenders)
    popup.style.display = 'block';
    popup.style.visibility = 'visible';
    popup.style.opacity = '1';

    // Header — base name + type
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.innerHTML = `
        <span class="popup-base-name">${base.name}</span>
        <span class="popup-base-type">${base.type || 'Base'}</span>
    `;
    popup.appendChild(header);

    // Actions divider
    const actions = document.createElement('div');
    actions.className = 'popup-actions';

    if (!sigil) {
        // No sigil yet — craft one
        const canCraft = state.mana >= SIGIL_MANA_COST && state.actions > 0;
        const craftBtn = createPopupButton(`&#10015; Build Sigil (${SIGIL_MANA_COST} mana)`, canCraft, () => {
            craftSigil();
            hideBasePopup();
        });
        actions.appendChild(craftBtn);
        console.log('[Main] Popup: added Build Sigil button, enabled:', canCraft, 'mana:', state.mana, 'actions:', state.actions);
    } else if (!sigilComplete) {
        // Sigil building — show real-time progress
        const remainingMs = state.sigilManager.getRemaining(sigil.buildStartTime, sigil.buildDuration);
        const remainingStr = formatTimeRemaining(remainingMs);
        const progressDiv = document.createElement('div');
        progressDiv.className = 'popup-status';
        progressDiv.innerHTML = `
            <span class="popup-status-icon">&#10015;</span>
            <span>Sigil building... ${remainingStr} remaining</span>
        `;
        actions.appendChild(progressDiv);
    } else {
        // Sigil complete — can summon
        const canSummon = state.mana >= MIN_SUMMON_COST && state.actions > 0;
        const summonBtn = createPopupButton('&#9733; Summon Creature', canSummon, () => {
            openSummonCreatureMenu();
            hideBasePopup();
        });
        actions.appendChild(summonBtn);

        // Show sigil status + summoned count
        const statusDiv = document.createElement('div');
        statusDiv.className = 'popup-status';
        statusDiv.innerHTML = `
            <span class="popup-sigil-ready">&#10015; Sigil active</span>
            <span class="popup-summon-count">${summonedCount} creature${summonedCount !== 1 ? 's' : ''} present</span>
        `;
        actions.appendChild(statusDiv);
    }

    popup.appendChild(actions);

    // Append to body and position
    document.body.appendChild(popup);
    console.log('[Main] Popup appended to body, child count:', popup.children.length);

    // Position near click, keeping popup within viewport
    const popupRect = popup.getBoundingClientRect();
    console.log('[Main] Popup rect:', popupRect.width, 'x', popupRect.height, 'at', popupRect.left, ',', popupRect.top);

    let left = clientX - 100; // center below cursor
    let top = clientY + 16;

    if (left + popupRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popupRect.width - 10;
    }
    if (left < 10) left = 10;
    if (top + popupRect.height > window.innerHeight - 80) {
        top = clientY - popupRect.height - 10;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    console.log('[Main] Popup positioned at:', left, ',', top);

    // Dismiss on outside click — use pointerdown for responsiveness.
    // Installed immediately (no setTimeout). The pointerdown that triggered
    // this popup called stopPropagation on the base marker, so it won't
    // reach the document — no risk of self-cancellation.
    function makeDismissHandler(e) {
        // Only dismiss if clicking OUTSIDE the popup
        if (popup.contains(e.target)) return;
        hideBasePopup();
        document.removeEventListener('pointerdown', makeDismissHandler);
    }
    document.addEventListener('pointerdown', makeDismissHandler);
}

function createPopupButton(label, enabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'popup-action-btn';
    btn.innerHTML = label;
    if (!enabled) btn.disabled = true;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });
    return btn;
}

function hideBasePopup() {
    const existing = document.getElementById('base-action-popup');
    if (existing) existing.remove();
}

// Button States
// ============================================

function updateButtonStates(base) {
    const canAct = state.actions > 0;

    // Sigil button: enabled when no existing sigil and can afford
    const hasSigil = base ? state.sigils.has(base.id) : false;
    const canAffordSigil = state.mana >= SIGIL_MANA_COST;
    setEnabled(ui.btnSigil, base && !hasSigil && canAct && canAffordSigil);

    // Summon button: enabled when sigil complete and can afford
    const sigil = base ? state.sigils.get(base.id) : null;
    const sigilReady = sigil && sigil.isComplete;
    const canAffordSummon = state.mana >= MIN_SUMMON_COST; // minimum summon cost
    setEnabled(ui.btnSummon, base && sigilReady && canAct && canAffordSummon);
}

function updateUI() {
    if (ui.tickCount) ui.tickCount.textContent = state.tick;
    if (ui.manaCount) ui.manaCount.textContent = `${state.mana}/${state.maxMana}`;
    if (ui.actionsCount) ui.actionsCount.textContent = state.actions;
    if (ui.originName) {
        const origin = state.baseSystem.getById(state.playerOrigin);
        ui.originName.textContent = origin?.name || '-';
    }
}

function setStatus(message) {
    if (ui.statusMessage) {
        ui.statusMessage.textContent = message;
    }
}

// ============================================
// Sigil Crafting & Summoning
// ============================================

/**
 * Handle sigil state change events from SigilManager.
 * Shows toasts and triggers re-renders.
 */
function handleSigilEvent(entity, eventType) {
    switch (eventType) {
        case 'sigil-started':
            showToast('Crafting Sigil... (2 min)', 'info', 4000);
            break;
        case 'sigil-complete':
            showToast('Sigil complete!', 'success', 3000);
            break;
        case 'sigil-destroyed':
            showToast('Sigil destroyed', 'warning', 3000);
            break;
        case 'summon-started':
            showToast(`Summoning ${entity.name} Lv.${entity.level}... (1 min)`, 'info', 4000);
            break;
        case 'summon-complete':
            promoteSummonedCreature(entity);
            break;
    }
    state.renderer.renderSigilsAndSummoned();
    updateUI();
}

/**
 * Craft a sigil on the selected base.
 */
function craftSigil() {
    if (!state.selectedBaseId) {
        setStatus('Select a base to craft a sigil');
        return;
    }

    if (!state.sigilManager.canCraftSigil(state.selectedBaseId)) {
        if (state.sigils.has(state.selectedBaseId)) {
            setStatus('This base already has a sigil');
        } else if (state.mana < SIGIL_MANA_COST) {
            setStatus(`Need ${SIGIL_MANA_COST} mana to craft a sigil`);
        }
        return;
    }

    const sigil = state.sigilManager.craftSigil(state.selectedBaseId);
    if (sigil) {
        state.actions--;
        state.renderer.renderSigilsAndSummoned();
        updateUI();
        updateButtonStates(state.baseSystem.getById(state.selectedBaseId));
        setStatus('Sigil crafting started... (2 min)');
    }
}

/**
 * Open the creature summon selection panel.
 * Shows creatures from the loaded database, filtered by continent.
 */
function openSummonCreatureMenu() {
    if (!state.selectedBaseId) {
        setStatus('Select a base with a sigil to summon creatures');
        return;
    }

    const sigil = state.sigils.get(state.selectedBaseId);
    if (!sigil || !sigil.isComplete) {
        setStatus('This base needs a completed sigil first');
        return;
    }

    if (!state.creatureDatabase || !state.creatureDBIndex) {
        setStatus('Creature database not loaded');
        return;
    }

    // Remove existing menu if any
    const existing = document.getElementById('creature-selector-overlay');
    if (existing) existing.remove();

    const base = state.baseSystem.getById(state.selectedBaseId);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'creature-selector-overlay';
    overlay.className = 'creature-selector-overlay';

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'creature-selector-panel';
    panel.innerHTML = `
        <div class="creature-selector-header">
            <h3>Summon Creature</h3>
            <span class="creature-selector-base">${base?.name || 'Unknown'}</span>
            <button class="creature-selector-close">&times;</button>
        </div>
        <div class="creature-selector-filters"></div>
        <div class="creature-selector-list"></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Close button
    panel.querySelector('.creature-selector-close').addEventListener('click', () => {
        overlay.remove();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    // Build continent filter tabs
    const filterContainer = panel.querySelector('.creature-selector-filters');
    const continents = ['all', ...Object.keys(state.creatureDatabase.continents)];
    continents.forEach(cont => {
        const tab = document.createElement('button');
        tab.className = 'creature-filter-tab';
        tab.textContent = cont === 'all' ? 'All' : state.creatureDatabase.continents[cont]?.displayName || cont;
        tab.dataset.continent = cont;
        tab.addEventListener('click', () => {
            filterContainer.querySelectorAll('.creature-filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderCreatureList(cont, panel.querySelector('.creature-selector-list'));
        });
        filterContainer.appendChild(tab);
    });

    // Activate first tab
    filterContainer.querySelector('.creature-filter-tab').classList.add('active');
    renderCreatureList('all', panel.querySelector('.creature-selector-list'));
}

function renderCreatureList(continent, listContainer) {
    listContainer.innerHTML = '';

    const creatures = getCreaturesByContinent(state.creatureDatabase, continent);
    if (creatures.length === 0) {
        listContainer.innerHTML = '<div class="creature-selector-empty">No creatures found</div>';
        return;
    }

    creatures.forEach(entry => {
        const cost = getSummonCost(entry);
        const canAfford = state.mana >= cost;

        const item = document.createElement('div');
        item.className = `creature-selector-item${canAfford ? '' : ' unaffordable'}`;

        const continentInfo = state.creatureDatabase.continents[entry.continent];
        const continentColor = continentInfo?.color || '#a78bfa';

        item.innerHTML = `
            <div class="creature-item-accent" style="background:${continentColor}"></div>
            <div class="creature-item-info">
                <div class="creature-item-name">
                    ${entry.name}
                    <span class="creature-item-level">Lv.${entry.level}</span>
                </div>
                <div class="creature-item-stats">
                    <span class="stat atk">ATK ${entry.atk}</span>
                    <span class="stat def">DEF ${entry.def}</span>
                    <span class="stat attr">${entry.attribute}</span>
                </div>
                <div class="creature-item-effect">${entry.effect}</div>
            </div>
            <div class="creature-item-cost">
                <span class="cost-value${canAfford ? '' : ' too-expensive'}">${cost}</span>
                <span class="cost-label">mana</span>
            </div>
        `;

        if (canAfford) {
            item.addEventListener('click', () => {
                confirmSummonCreature(entry, cost);
                document.getElementById('creature-selector-overlay')?.remove();
            });
        }

        listContainer.appendChild(item);
    });
}

/**
 * Confirm and start summoning a specific creature from the database.
 */
function confirmSummonCreature(dbEntry, summonCost) {
    if (!state.selectedBaseId) return;

    const sigil = state.sigils.get(state.selectedBaseId);
    if (!sigil) {
        setStatus('Sigil no longer exists on this base');
        return;
    }

    if (!state.sigilManager.canSummonCreature(state.selectedBaseId, summonCost)) {
        setStatus(`Need ${summonCost} mana to summon ${dbEntry.name}`);
        return;
    }

    const summoned = state.sigilManager.startSummonCreature(
        sigil.id,
        state.selectedBaseId,
        dbEntry,
        summonCost
    );

    if (summoned) {
        state.actions--;
        state.renderer.renderSigilsAndSummoned();
        updateUI();
        updateButtonStates(state.baseSystem.getById(state.selectedBaseId));
        setStatus(`Summoning ${dbEntry.name} Lv.${dbEntry.level}... (1 min)`);
    }
}

/**
 * Promote a completed SummonedCreature to a playable unit on the map.
 * Creates a full creature object and registers it with the renderer.
 */
function promoteSummonedCreature(summoned) {
    // Count existing creatures at this base for positioning
    const existingAtBase = state.renderer
        ? Array.from(state.renderer.creatures.values()).filter(c => c.baseId === summoned.baseId).length
        : 0;
    const countAtBase = existingAtBase + state.summonedCreatures.filter(sc => sc.baseId === summoned.baseId).length;

    const creature = {
        id: `creature-${summoned.dbEntryId}-${Date.now()}`,
        baseId: summoned.baseId,
        owner: PLAYER_ID,
        name: summoned.name,
        atk: summoned.atk,
        def: summoned.def,
        level: summoned.level,
        hp: summoned.hp,
        attribute: summoned.attribute,
        continent: summoned.continent,
        synergy: summoned.synergy,
        effect: summoned.effect,
        energy: summoned.energy,
        positionIndex: countAtBase
    };
    state.renderer.addCreature(creature);
    // Mutate in-place to keep SigilManager's reference valid
    const idx = state.summonedCreatures.findIndex(sc => sc.id === summoned.id);
    if (idx !== -1) state.summonedCreatures.splice(idx, 1);
    showToast(`${summoned.name} Lv.${summoned.level} joins your army!`, 'success', 4000);
}

// Sigil render loop — updates progress rings smoothly AND checks completions
function sigilRenderLoop(timestamp) {
    if (state.renderer && state.sigilManager) {
        // Check for real-time completions every frame
        state.sigilManager.checkCompletions();
        state.renderer.renderSigilsAndSummoned();
    }
    requestAnimationFrame(sigilRenderLoop);
}

function endTurn() {
    state.tick++;
    state.actions = state.maxActions;
    state.mana = Math.min(state.mana + 2, state.maxMana);

    updateUI();
    state.renderer.renderSigilsAndSummoned();
    setStatus(`Turn ${state.tick} - ${state.actions} actions available, ${state.mana} mana`);
    log('Turn ended, tick:', state.tick);
}

// ============================================
// Start Game
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.gameState = state;

// Diagnostic: run in console to check what bases are loaded
window.diagnose = () => {
    console.log('=== Game Diagnostic ===');
    console.log('Bases loaded:', state.baseSystem.getAll().length);
    state.baseSystem.getAll().forEach(b => {
        console.log(`  ${b.name} (${b.type}) at ${b.x},${b.y} — id: ${b.id}`);
    });
    console.log('Selected base:', state.selectedBaseId);
    console.log('Sigils:', state.sigils.size);
    console.log('Renderer layers:');
    for (const [key, el] of Object.entries(state.renderer.layers)) {
        console.log(`  ${key}: ${el ? 'EXISTS' : 'NULL'}, children: ${el?.children.length || 0}`);
    }
    console.log('SVG viewBox:', state.renderer.svg.getAttribute('viewBox'));
    console.log('SVG dimensions:', state.renderer.svgWidth, 'x', state.renderer.svgHeight);
    console.log('======================');
};
