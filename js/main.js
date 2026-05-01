/**
 * Voxya - The Shattered Archipelago
 * Main Entry Point
 *
 * Initializes game systems: bases, rendering, sigils, summoning
 */

import { createPlanetSystem } from './provinces.js';
import { Renderer } from './renderer.js';
import { getElement, setEnabled, log } from './utils.js';
import { trackGameStarted, trackCreatureSummoned, trackSpellCast, trackTerritoryClaimed } from './statsReporter.js';
import { SigilManager, SIGIL_MANA_COST, formatTimeRemaining } from './sigils.js';
import { loadCreatureDatabase, buildCreatureIndex, getCreaturesByContinent, getSummonCost } from './creatureDatabase.js';
import { createToastContainer, showToast } from './toasts.js';
import { EnemyAI } from './enemyAI.js';
import { executeEffects, getEffectiveStats, parseEffects } from './effects.js';
import { DecorationManager, ASSET_DEFINITIONS } from './decorations.js';
import { FogOfWar } from './fogOfWar.js';
import { ZoneOfControl } from './zones.js';
import { RegionEditor } from './regionEditor.js';
import { MaskBrush } from './maskBrush.js';
import { SmokeBrush } from './smokeBrush.js';

// ============================================
// Game Constants
// ============================================

const PLAYER_ID = 'player-1';
const PLAYER_NAME = 'Shadow Lord';
const MIN_SUMMON_COST = 3;
const ACTION_REGEN_RATE_MS = 3000;     // 1 action per 3 seconds
const MANA_REGEN_RATE_MS = 5000;       // 1 mana per 5 seconds
const RESOURCE_REGEN_RATE_MS = 15000;  // 1 of each resource per 15 seconds
const MAX_REGEN_DELTA_MS = 60000;      // clamp regen to 60s max per frame

// Planet detection — must be defined before state uses it
const planet = new URLSearchParams(window.location.search).get('planet') || 'voxya';
const PLANET_DISPLAY = {
    voxya:   { title: 'VOXYA',   subtitle: 'The Shattered Archipelago' },
    orilyth: { title: 'ORILYTH', subtitle: 'The Veil of Whispers' },
    korvess: { title: 'KORVESS', subtitle: 'The Verdant Abyss' },
    sanguis: { title: 'SANGUIS', subtitle: 'The Crimson Veil' },
    silith9: { title: 'SILITH-9', subtitle: 'The False Moon' }
};

// Custom polygon regions per planet — populated from editor exports
// Format: [{id, name, vertices: [[x%, y%], ...]}]
const PLANET_REGIONS = {
    voxya: [],
    orilyth: [],
    korvess: [],
    sanguis: [],
    silith9: []
};

// Mask brush strokes per planet — populated from editor exports
// Format: [{x, y, r}, ...] — canvas-pixel coordinates
const PLANET_MASKS = {
    voxya: [],
    orilyth: [],
    korvess: [],
    sanguis: [],
    silith9: []
};

// Smoke brush strokes per planet — populated from editor exports
// Format: [{x, y, r}, ...]
const PLANET_SMOKE = {
    voxya: [],
    orilyth: [],
    korvess: [],
    sanguis: [],
    silith9: []
};

// ============================================
// Game State
// ============================================

const state = {
    startTime: Date.now(),
    lastRegenTime: Date.now(),
    manaRegenAccumulator: 0,
    homePlanet: planet,
    shards: {
        voxya: 99,
        orilyth: 0,
        korvess: 0,
        sanguis: 0,
        silith9: 0
    },
    maxShards: 99,
    resources: {
        nexium: 10,
        vortite: 10,
        chronite: 10,
        helixium: 10,
        voidsteel: 10
    },
    maxResources: 999,
    resourceRegenAccumulator: 0,
    kingBaseHP: {},           // Map<baseId, { current, max }> — 8000 HP per GDD
    actionSlots: { max: 3, used: 0 },  // 3 action slots per GDD
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
    sigilManager: null,                  // SigilManager instance
    enemyAI: null,                       // EnemyAI instance
    zones: null,                         // ZoneOfControl instance
    regionEditor: null,                  // RegionEditor instance
    maskBrush: null,                     // MaskBrush instance
    smokeBrush: null,                    // SmokeBrush instance
    lastPeriodicEffects: Date.now(),     // Last time periodic effects were checked
    // Decoration system
    decorationManager: null,             // DecorationManager instance
    _assetMap: null,                     // Map<assetId, AssetDefinition> for quick lookup
    decorationPlaceMode: false,          // true when placing decorations in editor
    selectedDecoId: null,                // currently selected decoration id
    // Move mode state
    moveMode: null                       // { creatureId } or null
};

function getTotalMana() {
    return state.shards.voxya + state.shards.orilyth + state.shards.korvess
         + state.shards.sanguis + state.shards.silith9;
}

function spendMana(amount) {
    // Deduct from home planet shards first, then others
    const order = [state.homePlanet, ...Object.keys(state.shards).filter(k => k !== state.homePlanet)];
    let remaining = amount;
    for (const key of order) {
        const take = Math.min(state.shards[key], remaining);
        state.shards[key] -= take;
        remaining -= take;
        if (remaining <= 0) break;
    }
}

// Proxy object for sigils.js compatibility — sigils.js does this.mana.mana -= cost
const manaProxy = {
    get mana() { return getTotalMana(); },
    set mana(v) {
        const diff = getTotalMana() - v;
        if (diff > 0) spendMana(diff);
    }
};

// ============================================
// UI Cache
// ============================================

const ui = {
    tickCount: null,
    shardValues: {},
    resourceValues: {},
    slotEls: [],           // 3 slot indicator elements
    originName: null,
    btnSigil: null,
    btnSummon: null,
    statusMessage: null
};

// SVG Overlay reference
let svgOverlay;

// ============================================
// Initialization
// ============================================

async function init() {
    log(`Initializing ${planet}...`);

    // Set planet header
    const info = PLANET_DISPLAY[planet] || PLANET_DISPLAY.voxya;
    document.querySelector('.header-title').textContent = info.title;
    document.querySelector('.header-subtitle').textContent = info.subtitle;
    document.title = `${info.title} - ${info.subtitle}`;

    // Set planet map image
    const mapImg = document.querySelector('.map-bg');
    if (mapImg) mapImg.src = `assets/maps/${planet}-map-full.jpg`;

    // Cache UI elements
    ui.tickCount = getElement('tick-count');
    ui.shardValues.voxya = getElement('shard-voxya');
    ui.shardValues.orilyth = getElement('shard-orilyth');
    ui.shardValues.korvess = getElement('shard-korvess');
    ui.shardValues.sanguis = getElement('shard-sanguis');
    ui.shardValues.silith9 = getElement('shard-silith9');
    ui.resourceValues.nexium = getElement('res-nexium');
    ui.resourceValues.vortite = getElement('res-vortite');
    ui.resourceValues.chronite = getElement('res-chronite');
    ui.resourceValues.helixium = getElement('res-helixium');
    ui.resourceValues.voidsteel = getElement('res-voidsteel');
    ui.slotEls = [
        getElement('slot-1'),
        getElement('slot-2'),
        getElement('slot-3')
    ];
    ui.btnSigil = getElement('btn-sigil');
    ui.statusMessage = getElement('status-message');
    ui.btnSummon = getElement('btn-summon');
    ui.originName = getElement('origin-name');

    // Initialize systems
    state.baseSystem = createPlanetSystem(planet);
    state.playerOrigin = `${planet}-throne`;

    // Initialize king base HP (8000 per GDD)
    const allBases = state.baseSystem.getAll();
    for (const base of allBases) {
        if (base.type === 'king-base' || base.type === 'enemy-king-base') {
            state.kingBaseHP[base.id] = { current: 8000, max: 8000 };
        }
    }

    svgOverlay = getElement('map-overlay');
    state.renderer = new Renderer(svgOverlay, { theme: planet });
    state.renderer.init(state.baseSystem);

    // Initialize fog of war — DISABLED (too dark, covers zones)
    // Re-enable when fog opacity is tuned
    // const fog = new FogOfWar(svgOverlay, state.renderer.svgWidth, state.renderer.svgHeight, {
    //     creatureVision: 60,
    //     baseVision: 100
    // });
    // fog.init();
    // state.fog = fog;
    state.fog = null;

    // Initialize zones of control
    const trapMap = new Map(); // populated when condemned spells are wired in
    state.zones = new ZoneOfControl(svgOverlay, 'zones-layer', state.baseSystem, {
        onZoneClick: (baseId) => {
            state.renderer.selectBase(baseId);
        },
        onZoneHover: (baseId, e) => {
            showZoneTooltip(baseId, e);
        },
        onZoneLeave: () => {
            hideZoneTooltip();
        }
    });
    state.zones.render();

    // Load custom polygon regions (populated from editor exports)
    state.zones.loadRegions(PLANET_REGIONS[planet] || []);

    // Initialize region editor (for drawing new regions in edit mode)
    state.regionEditor = new RegionEditor(svgOverlay, 'region-editor-layer', {
        onRegionsChanged: () => {
            // When regions change, also update the gameplay zones
            const exported = state.regionEditor.getRegions();
            state.zones.loadRegions(exported);
        }
    });
    // Load saved regions into the editor
    state.regionEditor.loadRegions(PLANET_REGIONS[planet] || []);

    // Initialize mask brush (paint-to-hide map areas)
    state.maskBrush = new MaskBrush(svgOverlay, '#map-world .map-bg');

    // Initialize smoke brush (animated smoke particles)
    state.smokeBrush = new SmokeBrush(svgOverlay, 'smoke-layer');
    // Load saved smoke strokes if any
    if (PLANET_SMOKE[planet] && PLANET_SMOKE[planet].length > 0) {
        state.smokeBrush.loadStrokes(PLANET_SMOKE[planet]);
    }
    // Load saved mask strokes if any
    if (PLANET_MASKS[planet] && PLANET_MASKS[planet].length > 0) {
        // Delay until image loads — wrapped in a check
        const tryLoad = () => {
            const img = document.querySelector('#map-world .map-bg');
            if (img && img.complete && img.naturalWidth) {
                state.maskBrush._createCanvas(img);
                state.maskBrush.loadStrokes(PLANET_MASKS[planet]);
                state.maskBrush.deactivate(); // keep canvas visible, disable painting
            } else {
                setTimeout(tryLoad, 200);
            }
        };
        setTimeout(tryLoad, 500);
    }

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
        manaProxy  // mana proxy for getter/setter compatibility
    );

    // Create toast container
    createToastContainer();

    // Initialize enemy AI
    state.enemyAI = new EnemyAI(planet, state.baseSystem, state.renderer, handleEnemyEvent);

    // Initialize decoration system
    state.decorationManager = new DecorationManager();
    state._assetMap = new Map(ASSET_DEFINITIONS.map(a => [a.id, a]));

    // Initial UI update
    updateUI();

    // Start animation loops
    requestAnimationFrame(sigilRenderLoop);

    // Initialize starfield background
    initStarfield();

    log('Game ready!');
    setStatus('Select a base to begin');

    // Track game start for leaderboard
    trackGameStarted();
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
        // Decoration placement mode — place on background click
        if (state.decorationPlaceMode && _activeDecorationAssetId && !e.target.closest('.base-marker') && !e.target.closest('.placed-decoration')) {
            e.stopPropagation();
            const rect = svgOverlay.getBoundingClientRect();
            const percentX = ((e.clientX - rect.left) / rect.width) * 100;
            const percentY = ((e.clientY - rect.top) / rect.height) * 100;
            const deco = state.decorationManager.placeDecoration(_activeDecorationAssetId, percentX, percentY);
            if (deco) {
                state.renderer.renderDecorations();
                updateDecoCount(document.getElementById('decoration-asset-panel'));
                const asset = state._assetMap.get(_activeDecorationAssetId);
                setStatus(`Placed ${asset ? asset.name : 'decoration'} at (${Math.round(percentX)}, ${Math.round(percentY)})`);
            }
            return;
        }

        // Decoration remove mode — click on placed decoration to remove it
        if (state.decorationPlaceMode && _decorationRemoveMode && e.target.closest('.placed-decoration')) {
            e.stopPropagation();
            const decoEl = e.target.closest('.placed-decoration');
            const decoId = decoEl.dataset.decoId;
            if (decoId) {
                state.decorationManager.removeDecoration(decoId);
                state.renderer.renderDecorations();
                updateDecoCount(document.getElementById('decoration-asset-panel'));
                setStatus('Decoration removed');
            }
            return;
        }

        // Look up the DOM tree for a base marker
        const marker = e.target.closest('.base-marker');
        if (marker && marker.dataset && marker.dataset.base) {
            const baseId = marker.dataset.base;
            const base = state.baseSystem.getById(baseId);
            if (base) {
                e.stopPropagation();
                // If in move mode, handle movement instead of base popup
                if (state.moveMode) {
                    handleMoveModeClick(baseId, base);
                    return;
                }
                state.renderer.clearMovementRange();
                state.renderer.selectedBaseId = baseId;
                state.renderer.renderSelection();
                onBaseSelected(baseId, e.clientX, e.clientY);
                return;
            }
        }
        // Background click: cancel move mode or close popups
        // Use composedPath to check if click landed on an interactive element
        const clickedElement = e.target;
        const isInteractive = clickedElement.closest('circle, rect, image, text, .base-pulse, .creature-card, .sigil-group');
        if (!isInteractive) {
            if (state.moveMode) {
                cancelMoveMode();
                return;
            }
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

    // Listen for creature movement arrivals
    svgOverlay.addEventListener('creatureMoveArrived', (e) => {
        const { creatureId, targetBaseId } = e.detail;
        const creature = state.renderer.getCreature(creatureId);
        const destBase = state.baseSystem.getById(targetBaseId);
        const destName = destBase ? destBase.name : targetBaseId;
        const isEnemy = creature && (creature._isEnemy || creature.owner === 'enemy');
        if (creature && isEnemy) {
            showToast(`Enemy ${creature.name} has reached ${destName}!`, 'error', 4000);
            setStatus(`WARNING: Enemy ${creature.name} arrived at ${destName}`);
        } else if (creature) {
            showToast(`${creature.name} has arrived at ${destName}`, 'success', 3000);
            setStatus(`${creature.name} finished moving to ${destName}`);
        }
        // Resolve combat at the destination
        resolveCombatAtBase(targetBaseId);
        state.renderer.renderCreatures();
        state.renderer.renderSelection();
    });

    // Listen for creature selection → show context menu
    svgOverlay.addEventListener('creatureSelected', (e) => {
        const { creatureId } = e.detail;
        const creature = state.renderer.getCreature(creatureId);
        if (!creature || creature._isMoving) return;

        // Use the SVG coordinates of the creature for positioning
        const group = state.renderer.layers.creatures?.querySelector(`.creature-group[data-creature-id="${creatureId}"]`);
        if (!group) return;

        const rect = group.getBoundingClientRect();
        showCreaturePopup(creature, rect.left + rect.width / 2, rect.top);
    });
}

function handleKeyDown(e) {
    // Shift+E: Toggle edit mode
    if (e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        toggleEditMode();
    }
    // Escape: Cancel move mode, carrying, close popup, or clear selection
    if (e.key === 'Escape') {
        if (state.moveMode) {
            cancelMoveMode();
            return;
        }
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
        // Clean up decoration mode
        state.decorationPlaceMode = false;
        _activeDecorationAssetId = null;
        _decorationRemoveMode = false;
        state.selectedDecoId = null;
        hideDecorationAssetPanel();
        // Clean up region drawing
        if (state.regionEditor) state.regionEditor.deactivate();
        // Clean up mask brush
        if (state.maskBrush) state.maskBrush.deactivate();
        // Clean up smoke brush
        if (state.smokeBrush) state.smokeBrush.deactivate();
        hideBrushSizeSlider();
        state.renderer.renderDecorations();
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
        <button class="editor-palette-eye" id="editor-eye-btn" title="Hide labels">👁</button>
        <div class="editor-palette-actions">
            <button class="editor-palette-btn" data-action="move">&#9872;<span class="btn-label"> Move</span></button>
            <button class="editor-palette-btn" data-action="connect">&#9727;<span class="btn-label"> Connect</span></button>
            <button class="editor-palette-btn" data-action="add-base">&#9670;<span class="btn-label"> +Base</span></button>
            <button class="editor-palette-btn" data-action="add-waypoint">&#9678;<span class="btn-label"> +Waypoint</span></button>
            <button class="editor-palette-btn" data-action="add-king">&#9813;<span class="btn-label"> +King</span></button>
            <button class="editor-palette-btn" data-action="add-player">&#9878;<span class="btn-label"> +Player Base</span></button>
            <button class="editor-palette-btn" data-action="add-enemy">&#9760;<span class="btn-label"> +Enemy Base</span></button>
            <button class="editor-palette-btn editor-palette-accent" data-action="decorations">&#127794;<span class="btn-label"> Decorations</span></button>
            <button class="editor-palette-btn editor-palette-accent" data-action="draw-region">&#11044;<span class="btn-label"> Draw Region</span></button>
            <button class="editor-palette-btn editor-palette-accent" data-action="mask-brush">&#127912;<span class="btn-label"> Mask Brush</span></button>
            <button class="editor-palette-btn editor-palette-accent" data-action="smoke-brush">&#128168;<span class="btn-label"> Smoke Brush</span></button>
            <button class="editor-palette-btn editor-palette-danger" data-action="remove">&#10007;<span class="btn-label"> Remove</span></button>
            <button class="editor-palette-btn" data-action="export">&#128229;<span class="btn-label"> Export</span></button>
            <button class="editor-palette-btn editor-palette-exit" data-action="exit">&#10005;<span class="btn-label"> Exit</span></button>
        </div>
        <div class="editor-brush-size" id="editor-brush-size" style="display:none;margin-top:10px;padding:8px;background:rgba(124,58,237,0.1);border-radius:8px;">
            <label style="color:#a78bfa;font-size:0.7rem;display:block;margin-bottom:4px;">Brush Size: <span id="brush-size-value">40</span>px</label>
            <input type="range" id="brush-size-slider" min="5" max="150" value="40" style="width:100%;accent-color:#7c3aed;">
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

        // Clean up decoration mode when switching to other tools
        if (action !== 'decorations') {
            state.decorationPlaceMode = false;
            _activeDecorationAssetId = null;
            _decorationRemoveMode = false;
            state.selectedDecoId = null;
            hideDecorationAssetPanel();
        }
        // Clean up region drawing when switching to other tools
        if (action !== 'draw-region' && state.regionEditor) {
            state.regionEditor.deactivate();
        }
        // Clean up mask brush when switching to other tools
        if (action !== 'mask-brush' && state.maskBrush) {
            state.maskBrush.deactivate();
        }
        // Clean up smoke brush when switching to other tools
        if (action !== 'smoke-brush' && state.smokeBrush) {
            state.smokeBrush.deactivate();
        }
        // Hide brush size slider unless on a brush tool
        if (action !== 'mask-brush' && action !== 'smoke-brush') {
            hideBrushSizeSlider();
        }

        switch (action) {
            case 'move':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                setStatus('Move Mode: Drag any base to reposition it');
                break;
            case 'connect':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.pathCreationMode = true;
                setStatus('Connect Mode: Click first base, then second base to create a path');
                break;
            case 'add-base':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.setAddBaseType('base');
                setStatus('Add Base: Click anywhere on the map');
                break;
            case 'add-waypoint':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.setAddBaseType('waypoint');
                setStatus('Add Waypoint: Click anywhere on the map');
                break;
            case 'add-king':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.setAddBaseType('king-base');
                setStatus('Add King Base: Click anywhere on the map');
                break;
            case 'add-player':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.setAddBaseType('player-base');
                setStatus('Add Player Base: Click anywhere on the map');
                break;
            case 'add-enemy':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.setAddBaseType('enemy-base');
                setStatus('Add Enemy Base: Click anywhere on the map');
                break;
            case 'remove':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.renderer.deleteMode = true;
                setStatus('Remove Mode: Click any base to delete it (decorations too)');
                break;
            case 'decorations':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                state.decorationPlaceMode = true;
                showDecorationAssetPanel();
                setStatus('Decorations: Choose an asset, then click the map to place');
                break;
            case 'draw-region':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                if (state.regionEditor) {
                    state.regionEditor.activate();
                    setStatus('Draw Region: Click vertices, click near green dot to close, Esc to cancel');
                }
                break;
            case 'mask-brush':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                if (state.maskBrush) {
                    state.maskBrush.activate();
                    setStatus('Mask Brush: Click and drag to paint hidden areas. Brush size: ' + state.maskBrush.getSize() + 'px');
                }
                showBrushSizeSlider('mask');
                break;
            case 'smoke-brush':
                btn.classList.add('active');
                state.renderer._handleModeSwitch();
                if (state.smokeBrush) {
                    state.smokeBrush.activate();
                    setStatus('Smoke Brush: Click and drag to paint animated smoke');
                }
                showBrushSizeSlider('smoke');
                break;
            case 'export':
                exportFullLayout();
                setStatus('Layout exported to JSON (bases, regions, mask)');
                break;
            case 'exit':
                toggleEditMode();
                break;
        }
    });

    // Eye toggle: hide/show button labels AND map labels
    let editorLabelsHidden = false;
    document.getElementById('editor-eye-btn')?.addEventListener('click', () => {
        editorLabelsHidden = !editorLabelsHidden;
        palette.classList.toggle('hide-labels', editorLabelsHidden);
        const eyeBtn = document.getElementById('editor-eye-btn');
        if (eyeBtn) {
            eyeBtn.textContent = editorLabelsHidden ? '👁‍🗨' : '👁';
            eyeBtn.title = editorLabelsHidden ? 'Show labels' : 'Hide labels';
        }
        // Also toggle map labels (base names, coordinates, "Click to move")
        if (state.renderer) {
            state.renderer.mapLabelsVisible = !editorLabelsHidden;
            state.renderer.renderBaseMarkers();
        }
    });
}

function showEditorPalette() {
    try {
        createEditorPalette();
        const palette = document.getElementById('editor-palette');
        if (palette) {
            palette.classList.add('visible');
            // Reset editor state
            if (state.renderer) state.renderer._handleModeSwitch();
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

let _brushSizeSliderWired = false;

function showBrushSizeSlider(mode) {
    const slider = document.getElementById('editor-brush-size');
    if (!slider) return;
    slider.style.display = 'block';

    const sizeInput = document.getElementById('brush-size-slider');
    const sizeLabel = document.getElementById('brush-size-value');
    if (!sizeInput) return;

    // Set initial value from the active brush
    if (mode === 'mask' && state.maskBrush) {
        sizeInput.value = state.maskBrush.getSize();
        if (sizeLabel) sizeLabel.textContent = sizeInput.value;
    } else if (mode === 'smoke' && state.smokeBrush) {
        sizeInput.value = state.smokeBrush.getSize();
        if (sizeLabel) sizeLabel.textContent = sizeInput.value;
    }

    // Wire slider once
    if (!_brushSizeSliderWired) {
        _brushSizeSliderWired = true;
        sizeInput.addEventListener('input', () => {
            const val = parseInt(sizeInput.value);
            if (sizeLabel) sizeLabel.textContent = val;
            // Update whichever brush is active
            if (state.maskBrush && document.querySelector('[data-action="mask-brush"].active')) {
                state.maskBrush.setSize(val);
            }
            if (state.smokeBrush && document.querySelector('[data-action="smoke-brush"].active')) {
                state.smokeBrush.setSize(val);
            }
        });
    }
}

function hideBrushSizeSlider() {
    const slider = document.getElementById('editor-brush-size');
    if (slider) slider.style.display = 'none';
}

/**
 * Export full map layout including bases, regions, and mask strokes.
 */
function exportFullLayout() {
    const baseData = state.baseSystem ? state.baseSystem.exportToJSON() : {};
    const regions = state.regionEditor ? state.regionEditor.getRegions() : [];
    const maskStrokes = state.maskBrush ? state.maskBrush.getStrokes() : [];
    const smokeStrokes = state.smokeBrush ? state.smokeBrush.getStrokes() : [];

    const full = {
        ...baseData,
        regions: regions,
        maskStrokes: maskStrokes,
        smokeStrokes: smokeStrokes
    };

    const json = JSON.stringify(full, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voxya-full-layout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// Decoration Asset Panel (Editor)
// ============================================

let _activeDecorationAssetId = null;
let _decorationRemoveMode = false;

function showDecorationAssetPanel() {
    // Remove existing panel
    hideDecorationAssetPanel();

    const panel = document.createElement('div');
    panel.id = 'decoration-asset-panel';
    panel.className = 'decoration-asset-panel';

    const currentPlanet = state.homePlanet || 'voxya';
    const categories = DecorationManager.getCategories(currentPlanet);

    // Build category tabs
    const categoryTabs = ['all', ...categories].map(cat =>
        `<button class="deco-cat-tab" data-cat="${cat}">${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}</button>`
    ).join('');

    // Build asset cards
    const allAssets = DecorationManager.getAssets(currentPlanet);
    const assetCards = allAssets.map(a => {
        const w = a.defaultWidth * 14;
        const h = a.defaultHeight * 14;
        // Use PNG thumbnail if available, otherwise render inline SVG
        const thumbHTML = a.png
            ? `<img src="${a.png}" alt="${a.name}" style="width:${w}px;height:${h}px;object-fit:contain;">`
            : `<svg viewBox="0 0 100 100" width="${w}" height="${h}">${a.svg}</svg>`;
        return `
        <div class="deco-asset-card" data-asset-id="${a.id}" title="${a.name} (${a.category})">
            <div class="deco-asset-thumb" style="width:${w}px;height:${h}px">
                ${thumbHTML}
            </div>
            <span class="deco-asset-name">${a.name}</span>
        </div>`;
    }).join('');

    panel.innerHTML = `
        <div class="deco-panel-header">
            <span class="deco-panel-title">&#127794; Decorations</span>
            <div class="deco-panel-actions">
                <button class="deco-action-btn" id="deco-remove-toggle" title="Remove Mode">&#10007;</button>
                <button class="deco-action-btn" id="deco-clear-all" title="Clear All">Clear</button>
                <button class="deco-action-btn" id="deco-close" title="Close">&times;</button>
            </div>
        </div>
        <div class="deco-category-tabs">${categoryTabs}</div>
        <div class="deco-asset-grid">${assetCards}</div>
        <div class="deco-panel-footer">
            <span class="deco-count">${state.decorationManager.getAll().length} placed</span>
            <button class="deco-action-btn" id="deco-export">Export</button>
            <button class="deco-action-btn" id="deco-import">Import</button>
        </div>
    `;

    document.body.appendChild(panel);

    // Activate first category tab
    const firstTab = panel.querySelector('.deco-cat-tab');
    if (firstTab) firstTab.classList.add('active');

    // Wire category tabs
    panel.querySelectorAll('.deco-cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            panel.querySelectorAll('.deco-cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.dataset.cat;
            filterAssetCards(cat, panel);
        });
    });

    // Wire asset card clicks
    panel.querySelectorAll('.deco-asset-card').forEach(card => {
        card.addEventListener('click', () => {
            const assetId = card.dataset.assetId;
            if (_decorationRemoveMode) {
                _decorationRemoveMode = false;
                const rmBtn = panel.querySelector('#deco-remove-toggle');
                if (rmBtn) rmBtn.classList.remove('active');
            }
            panel.querySelectorAll('.deco-asset-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            _activeDecorationAssetId = assetId;
            setStatus(`Selected: ${card.querySelector('.deco-asset-name').textContent} — click map to place`);
        });
    });

    // Remove mode toggle
    panel.querySelector('#deco-remove-toggle').addEventListener('click', (e) => {
        _decorationRemoveMode = !_decorationRemoveMode;
        e.currentTarget.classList.toggle('active', _decorationRemoveMode);
        _activeDecorationAssetId = null;
        panel.querySelectorAll('.deco-asset-card').forEach(c => c.classList.remove('selected'));
        if (_decorationRemoveMode) {
            setStatus('Decoration Remove Mode: Click a placed decoration to remove it');
        } else {
            setStatus('Decorations: Choose an asset, then click the map to place');
        }
    });

    // Clear all
    panel.querySelector('#deco-clear-all').addEventListener('click', () => {
        if (confirm('Remove ALL placed decorations?')) {
            state.decorationManager.clear();
            state.renderer.renderDecorations();
            updateDecoCount(panel);
            setStatus('All decorations cleared');
        }
    });

    // Export
    panel.querySelector('#deco-export').addEventListener('click', () => {
        const json = state.decorationManager.exportToJSON();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${planet}-decorations.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('Decorations exported to JSON');
    });

    // Import
    panel.querySelector('#deco-import').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    state.decorationManager.importFromJSON(data);
                    state.renderer.renderDecorations();
                    updateDecoCount(panel);
                    setStatus(`Imported ${data.length} decorations`);
                } catch (err) {
                    setStatus('Failed to import decorations: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    // Close
    panel.querySelector('#deco-close').addEventListener('click', () => {
        hideDecorationAssetPanel();
        state.decorationPlaceMode = false;
        _activeDecorationAssetId = null;
        _decorationRemoveMode = false;
        setStatus('Decoration mode exited');
    });
}

function hideDecorationAssetPanel() {
    const panel = document.getElementById('decoration-asset-panel');
    if (panel) panel.remove();
}

function filterAssetCards(category, panel) {
    const cards = panel.querySelectorAll('.deco-asset-card');
    const currentPlanet = state.homePlanet || 'voxya';
    const assets = DecorationManager.getAssets(currentPlanet);
    cards.forEach(card => {
        const assetId = card.dataset.assetId;
        const asset = assets.find(a => a.id === assetId);
        if (!asset || (category !== 'all' && asset.category !== category)) {
            card.style.display = 'none';
        } else {
            card.style.display = '';
        }
    });
}

function updateDecoCount(panel) {
    const countEl = panel?.querySelector('.deco-count');
    if (countEl) {
        countEl.textContent = `${state.decorationManager.getAll().length} placed`;
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
        // Don't pan if clicking on a base marker or creature
        if (e.target.closest('.base-marker')) return;
        if (e.target.closest('.creature-group')) return;

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

    // Toggle waypoint name labels
    getElement('toggle-waypoint-names')?.addEventListener('click', () => {
        state.renderer.toggleWaypointNames();
        document.getElementById('toggle-waypoint-names')?.classList.toggle('active');
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

// Global handler for decoration selection in edit mode
window.handleDecorationSelected = (decoId, clientX, clientY) => {
    if (state.decorationPlaceMode && _decorationRemoveMode) {
        state.decorationManager.removeDecoration(decoId);
        state.renderer.renderDecorations();
        updateDecoCount(document.getElementById('decoration-asset-panel'));
        setStatus('Decoration removed');
        return;
    }
    // In decoration placement mode without remove, show selection
    state.selectedDecoId = decoId;
    const deco = state.decorationManager.getAll().find(d => d.id === decoId);
    if (deco) {
        const asset = state._assetMap.get(deco.assetId);
        setStatus(`Selected: ${asset ? asset.name : 'decoration'} at (${Math.round(deco.x)}, ${Math.round(deco.y)})`);
    }
};

function clearSelection() {
    state.selectedBaseId = null;
    state.renderer.clearSelection();
    state.renderer.clearMovementRange();
    hideBasePopup();
    hideCreaturePopup();
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

    const isEnemy = base.type === 'enemy-base' || base.type === 'enemy-king-base';

    const popup = document.createElement('div');
    popup.id = 'base-action-popup';
    popup.className = 'base-action-popup';
    popup.style.display = 'block';
    popup.style.visibility = 'visible';
    popup.style.opacity = '1';

    // Header — base name + type
    const header = document.createElement('div');
    header.className = 'popup-header';
    const typeLabel = isEnemy ? 'Enemy Base' : (base.type || 'Base');

    // HP display for king bases
    const isKing = base.type === 'king-base' || base.type === 'enemy-king-base';
    const hpData = isKing ? state.kingBaseHP[base.id] : null;
    const hpHTML = hpData
        ? `<span class="popup-base-type" style="color:${isEnemy ? '#ef4444' : '#f4d03f'};margin-left:8px;">HP ${hpData.current}/${hpData.max}</span>`
        : '';

    header.innerHTML = `
        <span class="popup-base-name">${base.name}</span>
        <span class="popup-base-type" style="${isEnemy ? 'color:#ef4444' : ''}">${typeLabel}</span>
        ${hpHTML}
    `;
    popup.appendChild(header);

    if (isEnemy) {
        // Enemy base popup — show intel instead of actions
        const actions = document.createElement('div');
        actions.className = 'popup-actions';

        // Show enemy sigil status
        const enemySigil = state.enemyAI ? state.enemyAI.sigils.get(base.id) : null;
        if (enemySigil) {
            const remainingMs = Math.max(0, enemySigil.buildDuration - (Date.now() - enemySigil.buildStartTime));
            if (enemySigil.isComplete) {
                const enemySummoned = state.enemyAI
                    ? state.enemyAI.getSummonedCreatures().filter(sc => sc.baseId === base.id).length
                    : 0;
                const enemyCreatures = state.enemyAI
                    ? state.enemyAI.getCreatures().filter(c => c.baseId === base.id).length
                    : 0;
                const statusDiv = document.createElement('div');
                statusDiv.className = 'popup-status';
                statusDiv.innerHTML = `
                    <span class="popup-sigil-ready" style="color:#ef4444;">&#10015; Enemy Sigil Active</span>
                    <span class="popup-summon-count" style="color:#fca5a5;">${enemyCreatures} creature${enemyCreatures !== 1 ? 's' : ''} present</span>
                `;
                actions.appendChild(statusDiv);
            } else {
                const statusDiv = document.createElement('div');
                statusDiv.className = 'popup-status';
                statusDiv.innerHTML = `
                    <span style="color:#ef4444;">&#10015; Enemy sigil building... ${formatTimeRemaining(remainingMs)}</span>
                `;
                actions.appendChild(statusDiv);
            }
        } else {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'popup-status';
            statusDiv.innerHTML = `<span style="color:#fca5a5;">No enemy sigil detected</span>`;
            actions.appendChild(statusDiv);
        }

        // Intel divider
        const intelDiv = document.createElement('div');
        intelDiv.className = 'popup-status';
        intelDiv.style.marginTop = '8px';
        intelDiv.innerHTML = `
            <span style="color:rgba(255,255,255,0.4); font-size:0.65rem;">&#9888; Enemy territory — approach with caution</span>
        `;
        actions.appendChild(intelDiv);

        popup.appendChild(actions);
    } else {
        // Player base popup — existing logic
        const sigil = state.sigils.get(base.id);
        const sigilComplete = sigil && sigil.isComplete;
        const summonedCount = sigil
            ? state.summonedCreatures.filter(sc => sc.baseId === base.id && sc.isComplete).length
            : 0;

        const actions = document.createElement('div');
        actions.className = 'popup-actions';

        if (!sigil) {
            const hasSlot = state.actionSlots.used < state.actionSlots.max;
            const canCraft = getTotalMana() >= SIGIL_MANA_COST && hasSlot;
            const craftBtn = createPopupButton(`&#10015; Build Sigil (${SIGIL_MANA_COST} essence)`, canCraft, () => {
                craftSigil();
                hideBasePopup();
            });
            actions.appendChild(craftBtn);
        } else if (!sigilComplete) {
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
            const hasSlot = state.actionSlots.used < state.actionSlots.max;
            const canSummon = getTotalMana() >= MIN_SUMMON_COST && hasSlot;
            const summonBtn = createPopupButton('&#9733; Summon Creature', canSummon, () => {
                openSummonCreatureMenu();
                hideBasePopup();
            });
            actions.appendChild(summonBtn);

            const statusDiv = document.createElement('div');
            statusDiv.className = 'popup-status';
            statusDiv.innerHTML = `
                <span class="popup-sigil-ready">&#10015; Sigil active</span>
                <span class="popup-summon-count">${summonedCount} creature${summonedCount !== 1 ? 's' : ''} present</span>
            `;
            actions.appendChild(statusDiv);
        }

        popup.appendChild(actions);
    }

    // Append to body and position
    document.body.appendChild(popup);

    const popupRect = popup.getBoundingClientRect();
    let left = clientX - 100;
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

    // Dismiss on outside click
    function makeDismissHandler(e) {
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

// ============================================
// Creature Context Popup
// ============================================

let _activeCreaturePopupId = null;

/**
 * Show a context popup near a clicked creature with action options.
 */
function showCreaturePopup(creature, clientX, clientY) {
    hideCreaturePopup();

    const isEnemyCreature = creature._isEnemy || creature.owner === 'enemy';

    const popup = document.createElement('div');
    popup.id = 'creature-action-popup';
    popup.className = 'creature-action-popup';
    popup.style.display = 'block';
    popup.style.visibility = 'visible';
    popup.style.opacity = '1';

    // Header — creature name + level + type
    const header = document.createElement('div');
    header.className = 'popup-header';
    const enemyLabel = isEnemyCreature ? ' <span style="color:#ef4444;font-size:0.6rem;">[ENEMY]</span>' : '';
    header.innerHTML = `
        <span class="popup-base-name">${creature.name}${enemyLabel}</span>
        <span class="popup-base-type">Lv.${creature.level || 1} ${creature.type || 'Creature'}</span>
    `;
    popup.appendChild(header);

    // Stats line
    const stats = document.createElement('div');
    stats.className = 'popup-creature-stats';
    stats.innerHTML = `
        <span style="color:#3b82f6;">ATK ${creature.atk || '---'}</span>
        <span style="color:#eab308;margin-left:12px;">DEF ${creature.def || '---'}</span>
        <span style="color:#a78bfa;margin-left:12px;">MV ${creature.movement || 1}</span>
    `;
    popup.appendChild(stats);

    if (isEnemyCreature) {
        // Enemy creature — show limited intel
        const actions = document.createElement('div');
        actions.className = 'popup-actions';
        const intelDiv = document.createElement('div');
        intelDiv.className = 'popup-status';
        intelDiv.innerHTML = '<span style="color:rgba(255,255,255,0.4);font-size:0.65rem;">&#9888; Enemy unit — cannot command</span>';
        actions.appendChild(intelDiv);
        popup.appendChild(actions);
    } else {
        // Player creature — existing actions
        const actions = document.createElement('div');
        actions.className = 'popup-actions';

        // Move button
        const moveBtn = createPopupButton('&#10132; Move', !creature._isMoving, () => {
            hideCreaturePopup();
            state.renderer.clearMovementRange();
            if (!creature._isMoving) {
                state.moveMode = { creatureId: creature.id };
                setStatus('Select destination for ' + creature.name);
                state.renderer.clearMovementRange();
            }
        });
        actions.appendChild(moveBtn);

        // Attack button (future)
        const atkBtn = createPopupButton('&#9876; Attack', false, () => {});
        atkBtn.title = 'Coming soon';
        actions.appendChild(atkBtn);

        // Cast Effect button (future)
        const castBtn = createPopupButton('&#9889; Cast Effect', false, () => {});
        castBtn.title = 'Coming soon';
        actions.appendChild(castBtn);

        popup.appendChild(actions);
    }

    // Append to body and position (shared)
    document.body.appendChild(popup);

    const popupRect = popup.getBoundingClientRect();
    let left = clientX - popupRect.width / 2;
    let top = clientY + 20;

    if (left + popupRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popupRect.width - 10;
    }
    if (left < 10) left = 10;
    if (top + popupRect.height > window.innerHeight - 80) {
        top = clientY - popupRect.height - 10;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    _activeCreaturePopupId = creature.id;

    // Dismiss on outside click
    function makeDismissHandler(e) {
        if (popup.contains(e.target)) return;
        hideCreaturePopup();
        document.removeEventListener('pointerdown', makeDismissHandler);
    }
    document.addEventListener('pointerdown', makeDismissHandler);
}

function hideCreaturePopup() {
    const existing = document.getElementById('creature-action-popup');
    if (existing) existing.remove();
    _activeCreaturePopupId = null;
}

// ============================================
// Move Mode
// ============================================

/**
 * Handle clicking a base/waypoint while in move mode.
 * Finds a path from the creature to the target and starts movement.
 */
function handleMoveModeClick(targetBaseId, targetBase) {
    if (!state.moveMode) return;

    const creatureId = state.moveMode.creatureId;
    const creature = state.renderer.getCreature(creatureId);
    if (!creature) {
        cancelMoveMode();
        return;
    }

    // Don't move to the creature's current base
    if (creature.baseId === targetBaseId) {
        setStatus('Creature is already at ' + targetBase.name);
        return;
    }

    // Find path and start movement
    const path = state.baseSystem.findPath(creature.baseId, targetBaseId);
    if (!path || path.length < 2) {
        setStatus('No path to ' + targetBase.name);
        return;
    }

    state.renderer._initiateCreatureMove(creatureId, targetBaseId);
    setStatus(`${creature.name} moving to ${targetBase.name}...`);
    cancelMoveMode();
}

/**
 * Cancel move mode — clears state and resets status.
 */
function cancelMoveMode() {
    state.moveMode = null;
    state.renderer.clearMovementRange();
    setStatus('Movement cancelled');
}

// ============================================
// Combat System
// ============================================

/**
 * Resolve combat at a base when creatures arrive.
 * Called after any creature movement completes.
 */
function resolveCombatAtBase(baseId) {
    const base = state.baseSystem.getById(baseId);
    if (!base) return;

    const allCreatures = state.renderer ? Array.from(state.renderer.creatures.values()) : [];

    // Also include enemy AI creatures
    const enemyCreatures = state.enemyAI ? state.enemyAI.getCreatures() : [];
    const allUnits = [...allCreatures, ...enemyCreatures.filter(ec => !allCreatures.find(ac => ac.id === ec.id))];

    const playerUnits = allUnits.filter(c => c.baseId === baseId && c.owner !== 'enemy' && !c._isEnemy);
    const enemyUnits = allUnits.filter(c => c.baseId === baseId && (c.owner === 'enemy' || c._isEnemy));

    // No fight if only one side present
    if (playerUnits.length === 0 && enemyUnits.length === 0) return;
    if (playerUnits.length === 0 || enemyUnits.length === 0) {
        // One side present at an enemy king base — deal ATK damage
        _resolveSiegeDamage(baseId, base, playerUnits, enemyUnits);
        return;
    }

    // Both sides present — combat!
    // Sort by ATK descending
    playerUnits.sort((a, b) => b.atk - a.atk);
    enemyUnits.sort((a, b) => b.atk - a.atk);

    const rounds = Math.min(playerUnits.length, enemyUnits.length);

    for (let i = 0; i < rounds; i++) {
        const attacker = enemyUnits[i];   // enemy attacks first (arriving side)
        const defender = playerUnits[i];

        if (attacker.atk > defender.def) {
            // Attacker wins — destroy defender
            _destroyCreature(defender, attacker);
        } else if (defender.atk > attacker.def) {
            // Defender wins — destroy attacker
            _destroyCreature(attacker, defender);
        } else {
            // Stalemate — both take 50% ATK as damage, check if either dies
            if (attacker.atk >= defender.atk) {
                _destroyCreature(defender, attacker);
            }
            if (defender.atk >= attacker.atk && _creatureExists(attacker)) {
                _destroyCreature(attacker, defender);
            }
        }
    }

    // Apply pending splash/area damage from effects triggered during combat
    _resolvePendingDamage(baseId, playerUnits, enemyUnits);

    // Re-render after combat
    state.renderer.renderCreatures();
    state.renderer.renderMarkers();
    state.renderer.renderSelection();
}

/**
 * Damage king bases when opposing creatures are unopposed.
 */
function _resolveSiegeDamage(baseId, base, playerUnits, enemyUnits) {
    const isPlayerKing = base.type === 'king-base';
    const isEnemyKing = base.type === 'enemy-king-base';
    if (!isPlayerKing && !isEnemyKing) return;

    const hpData = state.kingBaseHP[baseId];
    if (!hpData || hpData.current <= 0) return;

    if (isEnemyKing && playerUnits.length > 0) {
        // Player creatures attacking enemy king base
        // Check for doubleATKvsThrone auras from allies at this base
        const allCreatures = state.renderer ? Array.from(state.renderer.creatures.values()) : [];
        const hasThroneAura = allCreatures.some(c => {
            const effects = parseEffects(c);
            return effects.some(e => e.type === 'aura' && e.action === 'doubleATKvsThrone');
        });

        let totalDmg = 0;
        for (const unit of playerUnits) {
            const dmg = hasThroneAura ? unit.atk * 2 : unit.atk;
            totalDmg += dmg;
        }
        hpData.current = Math.max(0, hpData.current - totalDmg);
        showToast(`Your army deals ${totalDmg} damage to ${base.name}!`, 'success', 4000);
        setStatus(`Siege: ${base.name} takes ${totalDmg} damage! HP remaining: ${hpData.current}`);

        if (hpData.current <= 0) {
            _onKingBaseDestroyed(base, 'enemy');
        }
    }

    if (isPlayerKing && enemyUnits.length > 0) {
        // Enemy creatures attacking player king base
        let totalDmg = 0;
        for (const unit of enemyUnits) {
            totalDmg += unit.atk;
        }
        hpData.current = Math.max(0, hpData.current - totalDmg);
        showToast(`Enemy deals ${totalDmg} damage to ${base.name}!`, 'error', 4000);
        setStatus(`WARNING: ${base.name} under siege! HP remaining: ${hpData.current}`);

        if (hpData.current <= 0) {
            _onKingBaseDestroyed(base, 'player');
        }
    }

    state.renderer.renderMarkers();
}

/**
 * Destroy a creature and announce it.
 */
function _destroyCreature(victim, killer) {
    // Run onDeath effect for victim
    executeEffects('onDeath', victim, { gameState: state, killer });

    // Apply pending onDeath damage to killer
    if (killer && killer._effectDamage && killer._effectDamage > killer.def) {
        const dmg = killer._effectDamage;
        delete killer._effectDamage;
        showToast(`${victim.name}'s death throes deal ${dmg} damage to ${killer.name}!`, 'warning', 3000);
        _destroyCreatureDirect(killer);
        // Still proceed with victim destruction below
    }
    if (killer) delete killer._effectDamage;

    // Check if saved from death (return to hand, revive, etc.)
    if (victim._savedFromDeath) {
        delete victim._savedFromDeath;
        showToast(`${victim.name} escapes destruction!`, 'info', 3000);
        state.renderer.renderCreatures();
        return;
    }

    // Remove from renderer
    if (state.renderer) {
        state.renderer.removeCreature(victim.id);
    }
    // Remove from enemy AI if applicable
    if (state.enemyAI && (victim.owner === 'enemy' || victim._isEnemy)) {
        const idx = state.enemyAI.creatures.findIndex(c => c.id === victim.id);
        if (idx !== -1) state.enemyAI.creatures.splice(idx, 1);
    }
    showToast(`${killer.name} destroys ${victim.name}!`, killer.owner === 'enemy' ? 'error' : 'success', 4000);

    // Run onKill effect for killer
    executeEffects('onKill', killer, { gameState: state, victim });
}

function _destroyCreatureDirect(victim) {
    // Destroy without a killer (for effect damage)
    if (state.renderer) {
        state.renderer.removeCreature(victim.id);
    }
    if (state.enemyAI && (victim.owner === 'enemy' || victim._isEnemy)) {
        const idx = state.enemyAI.creatures.findIndex(c => c.id === victim.id);
        if (idx !== -1) state.enemyAI.creatures.splice(idx, 1);
    }
}

function _resolvePendingDamage(baseId, playerUnits, enemyUnits) {
    // Resolve splash/area damage on all creatures at this base
    const allAtBase = [...playerUnits, ...enemyUnits].filter(c => c._pendingDamage);
    for (const creature of allAtBase) {
        const dmg = creature._pendingDamage;
        delete creature._pendingDamage;
        if (dmg > creature.def) {
            showToast(`${creature.name} takes ${dmg} splash damage and is destroyed!`, 'warning', 3000);
            _destroyCreatureDirect(creature);
        }
    }
}

function _creatureExists(creature) {
    if (!creature) return false;
    if (state.renderer && state.renderer.creatures.has(creature.id)) return true;
    if (state.enemyAI && state.enemyAI.creatures.find(c => c.id === creature.id)) return true;
    return false;
}

/**
 * Called when a king base reaches 0 HP.
 */
function _onKingBaseDestroyed(base, whose) {
    if (whose === 'enemy') {
        showToast(`VICTORY! ${base.name} has fallen!`, 'success', 8000);
        setStatus(`VICTORY: Enemy king base ${base.name} destroyed!`);
        trackTerritoryClaimed();
    } else {
        showToast(`DEFEAT! Your ${base.name} has been destroyed!`, 'error', 8000);
        setStatus(`DEFEAT: Your king base has fallen...`);
    }
    state.renderer.renderMarkers();
    state.renderer.renderSelection();
}

/**
 * Run periodic effects for all creatures on the field (every 60s).
 */
function runPeriodicEffects() {
    const allCreatures = state.renderer ? Array.from(state.renderer.creatures.values()) : [];
    const enemyCreatures = state.enemyAI ? state.enemyAI.getCreatures() : [];
    const all = [...allCreatures, ...enemyCreatures.filter(ec => !allCreatures.find(ac => ac.id === ec.id))];

    for (const creature of all) {
        executeEffects('periodic', creature, { gameState: state });
    }
    state.renderer.renderMarkers();
}

// Button States
// ============================================

function updateButtonStates(base) {
    const hasFreeSlot = state.actionSlots.used < state.actionSlots.max;

    // Sigil button: enabled when free slot available, no existing sigil, and can afford
    const hasSigil = base ? state.sigils.has(base.id) : false;
    const totalMana = getTotalMana();
    const canAffordSigil = totalMana >= SIGIL_MANA_COST;
    setEnabled(ui.btnSigil, base && !hasSigil && hasFreeSlot && canAffordSigil);

    // Summon button: enabled when sigil complete, free slot, and can afford
    const sigil = base ? state.sigils.get(base.id) : null;
    const sigilReady = sigil && sigil.isComplete;
    const canAffordSummon = totalMana >= MIN_SUMMON_COST;
    setEnabled(ui.btnSummon, base && sigilReady && hasFreeSlot && canAffordSummon);
}

function updateUI() {
    if (ui.tickCount) {
        const elapsedSec = Math.floor((Date.now() - state.startTime) / 1000);
        const min = Math.floor(elapsedSec / 60);
        const sec = elapsedSec % 60;
        ui.tickCount.textContent = `${min}:${String(sec).padStart(2, '0')}`;
    }
    for (const [key, el] of Object.entries(ui.shardValues)) {
        if (el) el.textContent = state.shards[key];
    }
    for (const [key, el] of Object.entries(ui.resourceValues)) {
        if (el) el.textContent = state.resources[key];
    }
    // Update action slot indicators
    const freeSlots = state.actionSlots.max - state.actionSlots.used;
    ui.slotEls.forEach((el, i) => {
        if (el) {
            if (i < freeSlots) {
                el.classList.add('slot-free');
                el.classList.remove('slot-used');
            } else {
                el.classList.add('slot-used');
                el.classList.remove('slot-free');
            }
        }
    });
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
            showToast('Crafting Sigil... (20 sec)', 'info', 4000);
            break;
        case 'sigil-complete':
            showToast('Sigil complete!', 'success', 3000);
            state.actionSlots.used = Math.max(0, state.actionSlots.used - 1);
            trackSpellCast();
            break;
        case 'sigil-destroyed':
            showToast('Sigil destroyed', 'warning', 3000);
            state.actionSlots.used = Math.max(0, state.actionSlots.used - 1);
            break;
        case 'summon-started':
            showToast(`Summoning ${entity.name} Lv.${entity.level}... (10 sec)`, 'info', 4000);
            break;
        case 'summon-complete':
            promoteSummonedCreature(entity);
            state.actionSlots.used = Math.max(0, state.actionSlots.used - 1);
            break;
    }
    state.renderer.renderSigilsAndSummoned();
    updateUI();
}

// ============================================
// Zone Tooltip
// ============================================

/**
 * Show enhanced zone tooltip with strategic info.
 * Reuses the existing #base-tooltip element from game.html.
 */
function showZoneTooltip(zoneId, event) {
    // Try base first, then region
    let base = state.baseSystem.getById(zoneId);
    let region = null;

    if (!base) {
        // Check if it's a region ID
        const regions = state.zones ? state.zones._regions : [];
        region = regions.find(r => r.id === zoneId);
        // Find closest base to the region for game info
        if (region && region.vertices && region.vertices.length > 0) {
            // Use region centroid to find nearby base
            let cx = 0, cy = 0;
            region.vertices.forEach(v => { cx += v[0]; cy += v[1]; });
            cx /= region.vertices.length;
            cy /= region.vertices.length;
            const allBases = state.baseSystem.getAll();
            let closest = null, closestDist = Infinity;
            for (const b of allBases) {
                const d = Math.sqrt((b.x - cx) ** 2 + (b.y - cy) ** 2);
                if (d < closestDist) { closestDist = d; closest = b; }
            }
            base = closest;
        }
    }

    if (!base && !region) return;

    const tooltip = document.getElementById('base-tooltip');
    const nameEl = document.getElementById('tooltip-name');
    const typeEl = document.getElementById('tooltip-type');
    const descEl = document.getElementById('tooltip-desc');
    if (!tooltip) return;

    // Determine zone state from the region or base
    const actualBase = base;
    const isOwned = actualBase ? state.ownedBaseIds.has(actualBase.id) : false;
    const isEnemy = actualBase ? (actualBase.type === 'enemy-base' || actualBase.type === 'enemy-king-base') : false;
    const isKing = actualBase ? (actualBase.type === 'king-base' || actualBase.type === 'enemy-king-base') : false;

    // Creature counts
    const friendlyCreatures = actualBase && state.summonedCreatures
        ? state.summonedCreatures.filter(sc => sc.baseId === actualBase.id && sc.isComplete).length
        : 0;
    const enemyCreatures = actualBase && state.enemyAI
        ? state.enemyAI.getCreatures().filter(c => c.baseId === actualBase.id).length
        : 0;

    // Sigil status
    const sigil = actualBase && state.sigils ? state.sigils.get(actualBase.id) : null;
    const hasSigil = sigil && !sigil.isComplete;
    const enemySigil = actualBase && state.enemyAI ? state.enemyAI.sigils.get(actualBase.id) : null;
    const hasEnemySigil = enemySigil && !enemySigil.isComplete;

    // Fog status
    let fogStatus = 'Visible';
    if (state.fog && actualBase) {
        const pos = state.renderer.percentToPixels(actualBase.x, actualBase.y);
        if (!state.fog.isExplored(pos.x, pos.y)) fogStatus = 'Unexplored';
        else if (!state.fog.isVisible(pos.x, pos.y)) fogStatus = 'Dimmed';
    }

    // Ownership badge
    let ownerBadge = '<span style="color:#888">Neutral</span>';
    if (isOwned) ownerBadge = '<span style="color:#a78bfa">✦ Yours</span>';
    if (isEnemy) ownerBadge = '<span style="color:#f87171">⚔ Enemy</span>';

    // Build tooltip content
    nameEl.innerHTML = region ? region.name : (actualBase ? actualBase.name : zoneId);
    typeEl.innerHTML = `${region ? 'Region' : (actualBase ? actualBase.type : 'Zone')} · ${ownerBadge}`;

    let desc = '';
    if (region) {
        desc += `Custom territory region<br>`;
    }
    if (actualBase && actualBase.description) desc += actualBase.description + '<br><br>';
    desc += `<b>Creatures:</b> ${friendlyCreatures} friendly`;
    if (enemyCreatures > 0) desc += `, ${enemyCreatures} enemy`;
    if (friendlyCreatures === 0 && enemyCreatures === 0) desc += ' · empty';
    desc += '<br>';
    if (isKing) desc += '<b>King Base</b> · high value target<br>';
    if (hasSigil) desc += '<span style="color:#22c55e">⏳ Sigil charging</span><br>';
    if (hasEnemySigil) desc += '<span style="color:#f87171">⏳ Enemy sigil active</span><br>';
    desc += `<span style="color:#888;font-size:0.7rem">Fog: ${fogStatus}</span>`;

    descEl.innerHTML = desc;

    // Position
    let x = event.clientX + 16;
    let y = event.clientY + 16;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) x = event.clientX - rect.width - 16;
    if (y + rect.height > window.innerHeight - 10) y = event.clientY - rect.height - 16;
    if (x < 10) x = 10;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
}

function hideZoneTooltip() {
    const tooltip = document.getElementById('base-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateY(8px)';
    }
}

/**
 * Handle enemy AI events — show toasts for enemy activity.
 */
function handleEnemyEvent(eventType, data) {
    switch (eventType) {
        case 'enemy-sigil-started':
            showToast(`Enemy: Crafting sigil at ${data.baseName}...`, 'warning', 3000);
            break;
        case 'enemy-sigil-complete':
            showToast(`Enemy: Sigil ready at ${data.baseName}!`, 'warning', 3000);
            break;
        case 'enemy-summon-started':
            showToast(`Enemy summoning ${data.creatureName} Lv.${data.level}...`, 'warning', 4000);
            break;
        case 'enemy-creature-ready':
            showToast(`Enemy: ${data.creatureName} Lv.${data.level} joins the enemy army!`, 'error', 4000);
            // Trigger combat at the base where this creature was summoned
            if (data.baseId) resolveCombatAtBase(data.baseId);
            break;
        case 'enemy-creature-moving':
            showToast(`Enemy: ${data.creatureName} advancing from ${data.from}!`, 'warning', 3000);
            break;
    }
    state.renderer.renderSigilsAndSummoned();
}

/**
 * Craft a sigil on the selected base.
 */
function craftSigil() {
    if (!state.selectedBaseId) {
        setStatus('Select a base to craft a sigil');
        return;
    }

    if (state.actionSlots.used >= state.actionSlots.max) {
        setStatus('No free action slots — wait for ongoing operations to complete');
        return;
    }

    if (!state.sigilManager.canCraftSigil(state.selectedBaseId)) {
        if (state.sigils.has(state.selectedBaseId)) {
            setStatus('This base already has a sigil');
        } else if (getTotalMana() < SIGIL_MANA_COST) {
            setStatus(`Need ${SIGIL_MANA_COST} essence to craft a sigil`);
        }
        return;
    }

    const sigil = state.sigilManager.craftSigil(state.selectedBaseId);
    if (sigil) {
        state.actionSlots.used++;
        state.renderer.renderSigilsAndSummoned();
        updateUI();
        updateButtonStates(state.baseSystem.getById(state.selectedBaseId));
        setStatus('Sigil crafting started... (20 sec)');
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
        const canAfford = getTotalMana() >= cost;

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
                    <span class="creature-item-type">${entry.type || 'Shadow'}</span>
                </div>
                <div class="creature-item-stats">
                    <span class="stat atk">ATK ${entry.atk}</span>
                    <span class="stat def">DEF ${entry.def}</span>
                    <span class="stat movement">⚡${entry.movement || 1}</span>
                </div>
                <div class="creature-item-effect">${entry.effect || ''}</div>
                ${entry.flavor ? `<div class="creature-item-flavor">"${entry.flavor}"</div>` : ''}
            </div>
            <div class="creature-item-cost">
                <span class="cost-value${canAfford ? '' : ' too-expensive'}">${cost}</span>
                <span class="cost-label">essence</span>
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
        setStatus(`Need ${summonCost} essence to summon ${dbEntry.name}`);
        return;
    }

    const summoned = state.sigilManager.startSummonCreature(
        sigil.id,
        state.selectedBaseId,
        dbEntry,
        summonCost
    );

    if (summoned) {
        state.actionSlots.used++;
        state.renderer.renderSigilsAndSummoned();
        updateUI();
        updateButtonStates(state.baseSystem.getById(state.selectedBaseId));
        setStatus(`Summoning ${dbEntry.name} Lv.${dbEntry.level}... (10 sec)`);
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
        type: summoned.type || 'Shadow',
        movement: summoned.movement || 1,
        sprite: summoned.sprite || null,
        continent: summoned.continent,
        effect: summoned.effect,
        flavor: summoned.flavor || '',
        positionIndex: countAtBase
    };
    state.renderer.addCreature(creature);
    // Mutate in-place to keep SigilManager's reference valid
    const idx = state.summonedCreatures.findIndex(sc => sc.id === summoned.id);
    if (idx !== -1) state.summonedCreatures.splice(idx, 1);
    showToast(`${summoned.name} Lv.${summoned.level} joins your army!`, 'success', 4000);
    // Track for leaderboard
    trackCreatureSummoned();
    // Run onSummon effects
    executeEffects('onSummon', creature, { gameState: state, baseId: creature.baseId });
    // Trigger combat if enemies are at this base
    resolveCombatAtBase(summoned.baseId);
}

// Time-based resource regeneration
function updateRegen() {
    const now = Date.now();
    let delta = now - state.lastRegenTime;
    if (delta <= 0) return;
    state.lastRegenTime = now;

    // Clamp to prevent massive regen from tab switching
    delta = Math.min(delta, MAX_REGEN_DELTA_MS);

    // Mana: regen home planet shards
    const homeKey = state.homePlanet;
    if (state.shards[homeKey] < state.maxShards) {
        state.manaRegenAccumulator += delta;
        const fullMana = Math.floor(state.manaRegenAccumulator / MANA_REGEN_RATE_MS);
        if (fullMana > 0) {
            state.shards[homeKey] = Math.min(state.maxShards, state.shards[homeKey] + fullMana);
            state.manaRegenAccumulator -= fullMana * MANA_REGEN_RATE_MS;
        }
    } else {
        state.manaRegenAccumulator = 0;
    }

    // Resources: regen all 5 types
    state.resourceRegenAccumulator += delta;
    const fullRes = Math.floor(state.resourceRegenAccumulator / RESOURCE_REGEN_RATE_MS);
    if (fullRes > 0) {
        for (const key of Object.keys(state.resources)) {
            state.resources[key] = Math.min(state.maxResources, state.resources[key] + fullRes);
        }
        state.resourceRegenAccumulator -= fullRes * RESOURCE_REGEN_RATE_MS;
    }
}

/**
 * Collect vision sources (friendly bases + creatures) and update fog of war.
 */
function updateFog() {
    const sources = [];
    const r = state.renderer;
    if (!r) return;

    // Friendly bases: king base + player bases
    const allBases = state.baseSystem.getAll();
    for (const base of allBases) {
        if (base.type === 'king-base' || base.type === 'player-base') {
            const pos = r.percentToPixels(base.x, base.y);
            sources.push({ x: pos.x, y: pos.y, radius: state.fog.baseVision });
        }
    }

    // Friendly creatures (completed summons)
    if (state.sigilManager) {
        const summoned = state.sigilManager.summoned || [];
        for (const sc of summoned) {
            if (!sc.isComplete) continue;
            const base = state.baseSystem.getById(sc.baseId);
            if (!base) continue;
            const pos = r.percentToPixels(base.x, base.y);
            sources.push({ x: pos.x, y: pos.y, radius: state.fog.creatureVision });
        }
    }

    state.fog.update(sources);
}

// Main game loop — processes real-time systems every animation frame
function sigilRenderLoop(timestamp) {
    if (state.renderer && state.sigilManager) {
        updateRegen();
        state.sigilManager.checkCompletions();
        state.renderer.renderSigilsAndSummoned();
        state.renderer.updateCreatureMovements();
    }
    if (state.enemyAI) {
        state.enemyAI.update(timestamp);
    }
    // Periodic creature effects (every 60s)
    const now = Date.now();
    if (now - state.lastPeriodicEffects > 60000) {
        runPeriodicEffects();
        state.lastPeriodicEffects = now;
    }
    // Fog of war update — DISABLED
    // if (state.fog) {
    //     updateFog();
    // }
    // Zone of control update
    if (state.zones && state.baseSystem) {
        state.zones.reposition();
        const enemyIds = new Set();
        for (const base of state.baseSystem.getAll()) {
            if (base.type === 'enemy-base' || base.type === 'enemy-king-base') {
                enemyIds.add(base.id);
            }
        }
        const trapMap = new Map(); // populated when condemned spells wired in
        state.zones.update(state.ownedBaseIds, enemyIds, trapMap, state.fog);
    }
    updateUI();
    requestAnimationFrame(sigilRenderLoop);
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
