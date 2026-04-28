/**
 * SigilManager — Sigil Crafting & Creature Summoning System
 *
 * Manages sigil lifecycle (build timer, completion) and creature
 * summoning from sigils (summon timer, completion). Fires callbacks
 * on state changes so main.js can trigger re-renders and toasts.
 */

// ============================================
// Constants
// ============================================

/** Total mana cost to craft a sigil */
export const SIGIL_MANA_COST = 4;

/** Ticks (turns) required to build a sigil */
export const SIGIL_BUILD_TICKS = 2;

/** Base ticks (turns) required to summon a creature */
export const SUMMON_BASE_TICKS = 1;

// ============================================
// SigilManager Class
// ============================================

export class SigilManager {
    /**
     * @param {Map} sigilsMap - Map<baseId, Sigil> (shared reference to main.js state)
     * @param {Array} summonedCreatures - Array<SummonedCreature> (shared reference)
     * @param {Function} onStateChanged - Callback(sigilOrCreature, eventType) for toasts/re-renders
     * @param {Object} manaState - Reference to main.js mana tracking { mana, maxMana }
     */
    constructor(sigilsMap, summonedCreatures, onStateChanged, manaState) {
        this.sigils = sigilsMap;           // Map<baseId, Sigil>
        this.summoned = summonedCreatures; // Array<SummonedCreature>
        this.onStateChanged = onStateChanged;
        this.mana = manaState;
    }

    // ============================================
    // Sigil Crafting
    // ============================================

    /**
     * Check whether a sigil can be crafted on this base.
     * Requirements: no sigil already exists, enough mana.
     */
    canCraftSigil(baseId) {
        if (!baseId) return false;
        if (this.sigils.has(baseId)) return false;
        if (this.mana && this.mana.mana < SIGIL_MANA_COST) return false;
        return true;
    }

    /**
     * Start crafting a sigil on the given base.
     * Deducts mana and returns the new Sigil object.
     * @param {string} baseId
     * @param {number} currentTick
     * @returns {Object|null} The created Sigil, or null if requirements not met
     */
    craftSigil(baseId, currentTick) {
        if (this.sigils.has(baseId)) return null;

        const sigil = {
            id: `sigil-${baseId}`,
            baseId,
            owner: 'player-1',
            buildStartTick: currentTick,
            buildDuration: SIGIL_BUILD_TICKS,
            isComplete: false
        };

        this.sigils.set(baseId, sigil);

        if (this.mana) {
            this.mana.mana = Math.max(0, this.mana.mana - SIGIL_MANA_COST);
        }

        if (this.onStateChanged) {
            this.onStateChanged(sigil, 'sigil-started');
        }

        return sigil;
    }

    // ============================================
    // Creature Summoning
    // ============================================

    /**
     * Check whether a creature can be summoned from a sigil on this base.
     */
    canSummonCreature(baseId, summonCost) {
        if (!baseId) return false;
        const sigil = this.sigils.get(baseId);
        if (!sigil || !sigil.isComplete) return false;
        if (this.mana && this.mana.mana < summonCost) return false;
        return true;
    }

    /**
     * Start summoning a creature from a sigil.
     * @param {string} sigilId - The sigil's id
     * @param {string} baseId - Base where sigil exists
     * @param {Object} dbEntry - Creature entry from the database
     * @param {number} currentTick
     * @param {number} summonCost - Mana cost (computed by caller from creatureDatabase.js)
     * @returns {Object|null} The created SummonedCreature, or null
     */
    startSummonCreature(sigilId, baseId, dbEntry, currentTick, summonCost) {
        const sigil = this.sigils.get(baseId);
        if (!sigil || sigil.id !== sigilId) return null;

        // Determine stack position for radial placement
        const existingAtBase = this.summoned.filter(
            sc => sc.baseId === baseId
        );
        const positionIndex = existingAtBase.length;

        const summoned = {
            id: `summoned-${dbEntry.id}-${Date.now()}`,
            sigilId,
            baseId,
            dbEntryId: dbEntry.id,
            name: dbEntry.name,
            continent: dbEntry.continent,
            attribute: dbEntry.attribute,
            level: dbEntry.level,
            atk: dbEntry.atk,
            def: dbEntry.def,
            hp: dbEntry.hp || 2,
            effect: dbEntry.effect,
            restriction: dbEntry.restriction,
            energy: dbEntry.energy || '',
            synergy: dbEntry.synergy,
            summonStartTick: currentTick,
            summonDuration: SUMMON_BASE_TICKS,
            isComplete: false,
            positionIndex
        };

        this.summoned.push(summoned);

        if (this.mana) {
            this.mana.mana = Math.max(0, this.mana.mana - summonCost);
        }

        if (this.onStateChanged) {
            this.onStateChanged(summoned, 'summon-started');
        }

        return summoned;
    }

    // ============================================
    // Tick Processing
    // ============================================

    /**
     * Process all in-progress sigils and summons.
     * Marks completed items and fires callbacks.
     * Called from endTurn() in main.js.
     *
     * @param {number} currentTick
     * @returns {{ completedSigils: Array, completedSummons: Array }}
     */
    tick(currentTick) {
        const completedSigils = [];
        const completedSummons = [];

        // Check in-progress sigils
        for (const [baseId, sigil] of this.sigils) {
            if (!sigil.isComplete) {
                const elapsed = currentTick - sigil.buildStartTick;
                if (elapsed >= sigil.buildDuration) {
                    sigil.isComplete = true;
                    completedSigils.push(sigil);
                    if (this.onStateChanged) {
                        this.onStateChanged(sigil, 'sigil-complete');
                    }
                }
            }
        }

        // Check in-progress summoned creatures
        for (const sc of this.summoned) {
            if (!sc.isComplete) {
                const elapsed = currentTick - sc.summonStartTick;
                if (elapsed >= sc.summonDuration) {
                    sc.isComplete = true;
                    completedSummons.push(sc);
                    if (this.onStateChanged) {
                        this.onStateChanged(sc, 'summon-complete');
                    }
                }
            }
        }

        return { completedSigils, completedSummons };
    }

    /**
     * Get build or summon progress as a fraction (0.0 to 1.0).
     * Used by renderer for progress rings.
     */
    getProgress(startTick, duration, currentTick) {
        if (duration <= 0) return 1;
        return Math.min(1, Math.max(0, (currentTick - startTick) / duration));
    }

    // ============================================
    // Lookups
    // ============================================

    /** Get the sigil on a base (or null). */
    getSigilAt(baseId) {
        return this.sigils.get(baseId) || null;
    }

    /** Get all summoned creatures at a base (complete and in-progress). */
    getSummonedAt(baseId) {
        return this.summoned.filter(sc => sc.baseId === baseId);
    }

    /** Get count of completed summoned creatures. */
    getCompletedSummonCount(baseId) {
        return this.summoned.filter(
            sc => sc.baseId === baseId && sc.isComplete
        ).length;
    }

    // ============================================
    // Destruction
    // ============================================

    /**
     * Destroy a sigil and all its summoned creatures.
     * Called when a base is captured or lost.
     * @param {string} baseId
     * @returns {{ sigil: Object|null, creatures: Array }} What was removed
     */
    destroySigil(baseId) {
        const sigil = this.sigils.get(baseId) || null;
        const creatures = this.summoned.filter(sc => sc.baseId === baseId);

        // Remove sigil
        this.sigils.delete(baseId);

        // Remove all summoned creatures at this base
        this.summoned = this.summoned.filter(sc => sc.baseId !== baseId);

        if (sigil && this.onStateChanged) {
            this.onStateChanged(sigil, 'sigil-destroyed');
        }

        return { sigil, creatures };
    }
}
