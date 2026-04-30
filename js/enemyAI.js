/**
 * EnemyAI — Temporary AI Opponent System
 *
 * Manages enemy resources, sigil crafting, creature summoning,
 * and basic tactical movement toward player territory.
 * Uses the same real-time timers as the player.
 */

import { SIGIL_MANA_COST, SIGIL_BUILD_TIME_MS, SUMMON_BASE_TIME_MS, formatTimeRemaining } from './sigils.js';

// ============================================
// Constants
// ============================================

const AI_ACTION_REGEN_MS = 5000;   // 1 action per 5s (slower than player)
const AI_MANA_REGEN_MS = 8000;     // 1 mana per 8s (slower than player)
const AI_MAX_REGEN_DELTA = 60000;
const AI_DECISION_INTERVAL = 3000; // decide every 3s
const AI_MOVE_INTERVAL = 15000;    // move creatures every 15s
const AI_MAX_ACTIONS = 8;
const AI_MAX_MANA = 99;
const AI_STARTING_MANA = 40;

// ============================================
// Per-planet enemy creature templates
// ============================================

const ENEMY_CREATURE_POOL = {
    voxya: [
        { id: 'enemy-voxya-shade', name: 'Umbral Stalker', level: 1, atk: 1100, def: 700, movement: 1, type: 'Shadow', essenceCost: 3, sprite: 'assets/units/voxya-voidmire-stalker.png', flavor: 'A servant of the Obsidian Maw.' },
        { id: 'enemy-voxya-wraith', name: 'Maw Wraith', level: 1, atk: 1300, def: 900, movement: 2, type: 'Undead', essenceCost: 4, sprite: 'assets/units/voxya-throne-wraith.png', flavor: 'Bound to the enemy throne.' },
        { id: 'enemy-voxya-abyss', name: 'Abyssal Knight', level: 2, atk: 1800, def: 1400, movement: 1, type: 'Shadow Knight', essenceCost: 7, sprite: 'assets/units/voxya-gloomforge-thrall.png', flavor: 'Elite guard of the Obsidian Maw.' },
    ],
    orilyth: [
        { id: 'enemy-orilyth-spark', name: 'Spark Drone', level: 1, atk: 1000, def: 800, movement: 2, type: 'Construct', essenceCost: 3, sprite: 'assets/units/voxya-stormspire-shade.png', flavor: 'A buzzing fragment of stolen lightning.' },
        { id: 'enemy-orilyth-cipher', name: 'Cipher Warden', level: 1, atk: 1400, def: 1000, movement: 1, type: 'Sentinel', essenceCost: 4, sprite: 'assets/units/voxya-dusk-gate-lurker.png', flavor: 'Encrypts the battlefield in silence.' },
        { id: 'enemy-orilyth-null', name: 'Null Reaver', level: 2, atk: 2000, def: 1200, movement: 2, type: 'Void Construct', essenceCost: 8, sprite: 'assets/units/voxya-weeping-stone-revenant.png', flavor: 'Cuts data-streams like a blade.' },
    ],
    korvess: [
        { id: 'enemy-korvess-thorn', name: 'Thornbeast', level: 1, atk: 1200, def: 600, movement: 2, type: 'Mutant', essenceCost: 3, sprite: 'assets/units/voxya-skyrift-harvester.png', flavor: 'A writhing mass of thorns and hunger.' },
        { id: 'enemy-korvess-rot', name: 'Rotbark Sentinel', level: 1, atk: 1000, def: 1300, movement: 1, type: 'Flora', essenceCost: 4, sprite: 'assets/units/voxya-dusk-gate-lurker.png', flavor: 'Ancient wood animated by the hive-mind.' },
        { id: 'enemy-korvess-vine', name: 'Vine Horror', level: 2, atk: 1900, def: 1500, movement: 1, type: 'Flora Beast', essenceCost: 7, sprite: 'assets/units/voxya-merchants-grave-specter.png', flavor: 'Tentacles that crush steel.' },
    ],
    sanguis: [
        { id: 'enemy-sanguis-cinder', name: 'Cinder Hound', level: 1, atk: 1300, def: 700, movement: 2, type: 'Beast', essenceCost: 3, sprite: 'assets/units/voxya-voidmire-stalker.png', flavor: 'Born from the embers of the Ashen Citadel.' },
        { id: 'enemy-sanguis-magma', name: 'Magma Guard', level: 1, atk: 1100, def: 1200, movement: 1, type: 'Elemental', essenceCost: 4, sprite: 'assets/units/voxya-gloomforge-thrall.png', flavor: 'Cooled magma shaped into a soldier.' },
        { id: 'enemy-sanguis-flame', name: 'Flame Revenant', level: 2, atk: 2100, def: 1300, movement: 2, type: 'Fire Spirit', essenceCost: 8, sprite: 'assets/units/voxya-stormspire-shade.png', flavor: 'The soul of a fallen warlord, still burning.' },
    ],
    silith9: [
        { id: 'enemy-silith9-drone', name: 'Chrome Drone', level: 1, atk: 1200, def: 900, movement: 2, type: 'Machine', essenceCost: 3, sprite: 'assets/units/voxya-gloomforge-thrall.png', flavor: 'Cold precision in a chrome shell.' },
        { id: 'enemy-silith9-sentry', name: 'Grid Sentry', level: 1, atk: 1500, def: 800, movement: 1, type: 'Turret', essenceCost: 4, sprite: 'assets/units/voxya-throne-wraith.png', flavor: 'A floating gun platform scanning for threats.' },
        { id: 'enemy-silith9-reaper', name: 'Nexus Reaper', level: 2, atk: 2200, def: 1400, movement: 1, type: 'Cybernetic', essenceCost: 9, sprite: 'assets/units/voxya-weeping-stone-revenant.png', flavor: 'The Prime Nexus speaks through this vessel.' },
    ]
};

// ============================================
// EnemyAI Class
// ============================================

export class EnemyAI {
    /**
     * @param {string} planet - current planet
     * @param {Object} baseSystem - shared BaseSystem instance
     * @param {Object} renderer - shared Renderer instance
     * @param {Function} onEvent - callback for toasts/notifications (eventType, data)
     */
    constructor(planet, baseSystem, renderer, onEvent) {
        this.planet = planet;
        this.baseSystem = baseSystem;
        this.renderer = renderer;
        this.onEvent = onEvent;

        // Resources
        this.mana = AI_STARTING_MANA;
        this.maxMana = AI_MAX_MANA;
        this.actions = AI_MAX_ACTIONS;
        this.maxActions = AI_MAX_ACTIONS;

        // Regen state
        this.lastRegenTime = Date.now();
        this.actionAccumulator = 0;
        this.manaAccumulator = 0;

        // Sigils: Map<baseId, sigil>
        this.sigils = new Map();

        // Summoned creatures: Array<SummonedCreature> (in-progress summons)
        this.summonedCreatures = [];

        // Active creatures on the map: Array<creature>
        this.creatures = [];

        // Decision timers
        this.lastDecisionTime = 0;
        this.lastMoveTime = 0;

        // Creature pool for this planet
        this.creaturePool = ENEMY_CREATURE_POOL[planet] || ENEMY_CREATURE_POOL.voxya;

        // Track which bases the AI owns
        this.ownedBaseIds = new Set();
        this._scanBases();
    }

    /**
     * Scan base system for enemy-owned bases.
     */
    _scanBases() {
        this.ownedBaseIds.clear();
        const all = this.baseSystem.getAll();
        for (const base of all) {
            if (base.type === 'enemy-base' || base.type === 'enemy-king-base') {
                this.ownedBaseIds.add(base.id);
            }
        }
    }

    /**
     * Get all enemy-owned base objects.
     */
    _getOwnedBases() {
        const result = [];
        for (const id of this.ownedBaseIds) {
            const base = this.baseSystem.getById(id);
            if (base) result.push(base);
        }
        return result;
    }

    /**
     * Get the enemy king base.
     */
    _getKingBase() {
        const all = this.baseSystem.getAll();
        return all.find(b => b.type === 'enemy-king-base' && b.continent === this.planet) || null;
    }

    // ============================================
    // Regen
    // ============================================

    _updateRegen() {
        const now = Date.now();
        let delta = now - this.lastRegenTime;
        if (delta <= 0) return;
        this.lastRegenTime = now;
        delta = Math.min(delta, AI_MAX_REGEN_DELTA);

        // Actions
        if (this.actions < this.maxActions) {
            this.actionAccumulator += delta;
            const full = Math.floor(this.actionAccumulator / AI_ACTION_REGEN_MS);
            if (full > 0) {
                this.actions = Math.min(this.maxActions, this.actions + full);
                this.actionAccumulator -= full * AI_ACTION_REGEN_MS;
            }
        } else {
            this.actionAccumulator = 0;
        }

        // Mana
        if (this.mana < this.maxMana) {
            this.manaAccumulator += delta;
            const full = Math.floor(this.manaAccumulator / AI_MANA_REGEN_MS);
            if (full > 0) {
                this.mana = Math.min(this.maxMana, this.mana + full);
                this.manaAccumulator -= full * AI_MANA_REGEN_MS;
            }
        } else {
            this.manaAccumulator = 0;
        }
    }

    // ============================================
    // Sigil Crafting
    // ============================================

    /**
     * Start crafting a sigil on an enemy base.
     */
    _craftSigil(baseId) {
        if (this.sigils.has(baseId)) return false;
        if (this.mana < SIGIL_MANA_COST) return false;

        const sigil = {
            id: `enemy-sigil-${baseId}`,
            baseId,
            owner: 'enemy',
            buildStartTime: Date.now(),
            buildDuration: SIGIL_BUILD_TIME_MS,
            isComplete: false
        };

        this.sigils.set(baseId, sigil);
        this.mana = Math.max(0, this.mana - SIGIL_MANA_COST);
        this.actions--;

        if (this.onEvent) {
            const base = this.baseSystem.getById(baseId);
            this.onEvent('enemy-sigil-started', { baseName: base?.name || baseId });
        }
        return true;
    }

    // ============================================
    // Creature Summoning
    // ============================================

    /**
     * Summon a creature from a completed sigil.
     */
    _summonCreature(baseId) {
        const sigil = this.sigils.get(baseId);
        if (!sigil || !sigil.isComplete) return false;

        // Pick a creature from the pool that we can afford
        const affordable = this.creaturePool.filter(c => c.essenceCost <= this.mana);
        if (affordable.length === 0) return false;

        // Prefer higher-level creatures, weighted random
        const weights = affordable.map(c => c.essenceCost);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;
        let chosen = affordable[0];
        for (let i = 0; i < affordable.length; i++) {
            roll -= weights[i];
            if (roll <= 0) { chosen = affordable[i]; break; }
        }

        if (this.mana < chosen.essenceCost) return false;

        const existingAtBase = this.creatures.filter(c => c.baseId === baseId).length;
        const summoned = {
            id: `enemy-summoning-${chosen.id}-${Date.now()}`,
            sigilId: sigil.id,
            baseId,
            dbEntryId: chosen.id,
            name: chosen.name,
            continent: this.planet,
            type: chosen.type,
            level: chosen.level,
            atk: chosen.atk,
            def: chosen.def,
            movement: chosen.movement || 1,
            essenceCost: chosen.essenceCost,
            effect: null,
            flavor: chosen.flavor || '',
            sprite: chosen.sprite || null,
            summonStartTime: Date.now(),
            summonDuration: SUMMON_BASE_TIME_MS,
            isComplete: false,
            positionIndex: existingAtBase
        };

        this.summonedCreatures.push(summoned);
        this.mana = Math.max(0, this.mana - chosen.essenceCost);
        this.actions--;

        if (this.onEvent) {
            this.onEvent('enemy-summon-started', { creatureName: chosen.name, level: chosen.level });
        }
        return true;
    }

    // ============================================
    // Completion Checks
    // ============================================

    /**
     * Check for completed sigils and summons (real-time).
     */
    _checkCompletions() {
        const now = Date.now();

        // Sigils
        for (const [baseId, sigil] of this.sigils) {
            if (!sigil.isComplete && (now - sigil.buildStartTime) >= sigil.buildDuration) {
                sigil.isComplete = true;
                if (this.onEvent) {
                    const base = this.baseSystem.getById(baseId);
                    this.onEvent('enemy-sigil-complete', { baseName: base?.name || baseId });
                }
            }
        }

        // Summons → promote to creatures
        for (let i = this.summonedCreatures.length - 1; i >= 0; i--) {
            const sc = this.summonedCreatures[i];
            if (!sc.isComplete && (now - sc.summonStartTime) >= sc.summonDuration) {
                sc.isComplete = true;
                this._promoteCreature(sc);
                this.summonedCreatures.splice(i, 1);
            }
        }
    }

    /**
     * Promote a completed summoned creature to an active map creature.
     */
    _promoteCreature(summoned) {
        const existingAtBase = this.creatures.filter(c => c.baseId === summoned.baseId).length;

        const creature = {
            id: `enemy-creature-${summoned.dbEntryId}-${Date.now()}`,
            baseId: summoned.baseId,
            owner: 'enemy',
            name: summoned.name,
            atk: summoned.atk,
            def: summoned.def,
            level: summoned.level,
            type: summoned.type,
            movement: summoned.movement || 1,
            sprite: summoned.sprite || null,
            continent: summoned.continent,
            effect: summoned.effect,
            flavor: summoned.flavor || '',
            positionIndex: existingAtBase,
            _isEnemy: true
        };

        this.creatures.push(creature);
        this.renderer.addCreature(creature);

        if (this.onEvent) {
            this.onEvent('enemy-creature-ready', { creatureName: creature.name, level: creature.level, baseId: creature.baseId });
        }
    }

    // ============================================
    // AI Decision Making
    // ============================================

    /**
     * Main AI decision loop — called periodically.
     */
    _makeDecision() {
        // 1. Build sigils on empty enemy bases
        const owned = this._getOwnedBases();
        for (const base of owned) {
            if (!this.sigils.has(base.id) && this.mana >= SIGIL_MANA_COST && this.actions > 0) {
                if (Math.random() < 0.6) { // 60% chance to build
                    this._craftSigil(base.id);
                }
            }
        }

        // 2. Summon creatures from completed sigils
        for (const [baseId, sigil] of this.sigils) {
            if (sigil.isComplete && this.actions > 0 && this.mana >= 3) {
                if (Math.random() < 0.5) { // 50% chance per decision tick
                    this._summonCreature(baseId);
                }
            }
        }
    }

    /**
     * Move creatures toward player territory.
     */
    _moveCreatures() {
        const playerKing = this.baseSystem.getById(`${this.planet}-throne`);
        if (!playerKing) return;

        for (const creature of this.creatures) {
            // Skip if already moving
            if (creature._isMoving) continue;

            const currentBase = this.baseSystem.getById(creature.baseId);
            if (!currentBase) continue;

            // Find neighbors closer to the player king
            const neighbors = this.baseSystem.getNeighbors(creature.baseId);
            if (neighbors.length === 0) continue;

            // Calculate distances to player king for each neighbor
            const currentDist = Math.hypot(currentBase.x - playerKing.x, currentBase.y - playerKing.y);
            const scored = neighbors.map(n => {
                const dist = Math.hypot(n.x - playerKing.x, n.y - playerKing.y);
                return { base: n, dist, improvement: currentDist - dist };
            });

            // Sort by how much closer they get us (descending)
            scored.sort((a, b) => b.improvement - a.improvement);

            // Only move if it gets us meaningfully closer
            const best = scored[0];
            if (best && best.improvement > 1) {
                // Check if target is a player base (engage!)
                const isPlayerBase = best.base.type === 'base' || best.base.type === 'king-base' || best.base.type === 'player-base';
                if (isPlayerBase) {
                    // Initiate movement to the player base
                    this._initiateMove(creature, best.base);
                    break; // Only move one creature per tick for pacing
                } else if (Math.random() < 0.4) {
                    // Move to a neutral waypoint closer to player
                    this._initiateMove(creature, best.base);
                    break;
                }
            }
        }
    }

    /**
     * Start a creature moving along a path to a target base.
     */
    _initiateMove(creature, targetBase) {
        // Avoid attacking the player's own starting throne too early
        if (targetBase.id === `${this.planet}-throne` && this.creatures.length < 3) {
            return; // Need at least 3 creatures before assaulting player king
        }

        const path = this.baseSystem.findPath(creature.baseId, targetBase.id);
        if (!path || path.length < 2) return;

        const hops = path.length - 1;
        if (hops > creature.movement) return; // Too far for one move

        // Use the renderer's movement system
        this.renderer._initiateCreatureMove(creature.id, targetBase.id);

        if (this.onEvent) {
            this.onEvent('enemy-creature-moving', {
                creatureName: creature.name,
                from: this.baseSystem.getById(creature.baseId)?.name,
                to: targetBase.name
            });
        }
    }

    // ============================================
    // Main Update Loop
    // ============================================

    /**
     * Called every game tick. Handles regen, completions, and AI decisions.
     * @param {number} timestamp - current time from requestAnimationFrame
     */
    update(timestamp) {
        this._updateRegen();
        this._checkCompletions();

        // AI decisions on interval
        if (timestamp - this.lastDecisionTime > AI_DECISION_INTERVAL) {
            this._makeDecision();
            this.lastDecisionTime = timestamp;
        }

        // Movement decisions on slower interval
        if (timestamp - this.lastMoveTime > AI_MOVE_INTERVAL) {
            this._moveCreatures();
            this.lastMoveTime = timestamp;
        }
    }

    // ============================================
    // Public API for main.js
    // ============================================

    /**
     * Get all enemy sigils for rendering.
     */
    getSigilsMap() {
        return this.sigils;
    }

    /**
     * Get all enemy summoned creatures (in-progress).
     */
    getSummonedCreatures() {
        return this.summonedCreatures;
    }

    /**
     * Get all active enemy creatures on the map.
     */
    getCreatures() {
        return this.creatures;
    }

    /**
     * Get enemy resource state for UI display.
     */
    getResourceState() {
        return {
            mana: this.mana,
            maxMana: this.maxMana,
            actions: this.actions,
            maxActions: this.maxActions,
            creatureCount: this.creatures.length,
            sigilCount: this.sigils.size
        };
    }

    /**
     * Check if a base belongs to the enemy.
     */
    ownsBase(baseId) {
        return this.ownedBaseIds.has(baseId);
    }
}

export { ENEMY_CREATURE_POOL };
