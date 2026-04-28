/**
 * SigilManager — Real-Time Sigil Crafting & Creature Summoning System
 *
 * Manages sigil lifecycle (build timer, completion) and creature
 * summoning from sigils (summon timer, completion). Fires callbacks
 * on state changes so main.js can trigger re-renders and toasts.
 *
 * All timers run in real wall-clock time (milliseconds), not turns.
 * Conflicts of Nations style — actions complete while you wait.
 */

// ============================================
// Constants (Real-Time)
// ============================================

/** Total mana cost to craft a sigil */
export const SIGIL_MANA_COST = 4;

/** Milliseconds to build a sigil */
export const SIGIL_BUILD_TIME_MS = 2 * 60 * 1000; // 2 minutes

/** Base milliseconds to summon a creature */
export const SUMMON_BASE_TIME_MS = 1 * 60 * 1000; // 1 minute

/** How often to check for completions (ms) */
export const TICK_INTERVAL_MS = 1000; // every 1 second

// ============================================
// Helpers
// ============================================

/**
 * Format ms as "M:SS" remaining.
 * @param {number} ms
 * @returns {string}
 */
export function formatTimeRemaining(ms) {
    if (ms <= 0) return 'Complete!';
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
}

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
     * @returns {Object|null} The created Sigil, or null if requirements not met
     */
    craftSigil(baseId) {
        if (this.sigils.has(baseId)) return null;

        const sigil = {
            id: `sigil-${baseId}`,
            baseId,
            owner: 'player-1',
            buildStartTime: Date.now(),
            buildDuration: SIGIL_BUILD_TIME_MS,
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
     * @param {number} summonCost - Mana cost (computed by caller)
     * @returns {Object|null} The created SummonedCreature, or null
     */
    startSummonCreature(sigilId, baseId, dbEntry, summonCost) {
        const sigil = this.sigils.get(baseId);
        if (!sigil || sigil.id !== sigilId) return null;

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
            type: dbEntry.type || 'Shadow',
            level: dbEntry.level,
            atk: dbEntry.atk,
            def: dbEntry.def,
            movement: dbEntry.movement || 1,
            essenceCost: dbEntry.essenceCost || summonCost,
            effect: dbEntry.effect,
            flavor: dbEntry.flavor || '',
            sprite: dbEntry.sprite || null,
            summonStartTime: Date.now(),
            summonDuration: SUMMON_BASE_TIME_MS,
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
    // Real-Time Processing (replaces tick-based)
    // ============================================

    /**
     * Check all in-progress sigils and summons using wall-clock time.
     * Call this periodically (e.g. every 1s from requestAnimationFrame).
     * @returns {{ completedSigils: Array, completedSummons: Array }}
     */
    checkCompletions() {
        const now = Date.now();
        const completedSigils = [];
        const completedSummons = [];

        // Check in-progress sigils
        for (const [baseId, sigil] of this.sigils) {
            if (!sigil.isComplete) {
                const elapsed = now - sigil.buildStartTime;
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
                const elapsed = now - sc.summonStartTime;
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
     * Uses wall-clock time if startTime is provided, otherwise tick-based fallback.
     */
    getProgress(startTime, duration) {
        if (duration <= 0) return 1;
        return Math.min(1, Math.max(0, (Date.now() - startTime) / duration));
    }

    /**
     * Get remaining time for an in-progress item.
     * @param {number} startTime
     * @param {number} duration - in ms
     * @returns {number} remaining ms (0 if complete)
     */
    getRemaining(startTime, duration) {
        const elapsed = Date.now() - startTime;
        return Math.max(0, duration - elapsed);
    }

    // ============================================
    // Lookups
    // ============================================

    /** Get the sigil on a base (or null). */
    getSigilAt(baseId) {
        return this.sigils.get(baseId) || null;
    }

    /** Get all summoned creatures at a base. */
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
     * @param {string} baseId
     * @returns {{ sigil: Object|null, creatures: Array }}
     */
    destroySigil(baseId) {
        const sigil = this.sigils.get(baseId) || null;
        const creatures = this.summoned.filter(sc => sc.baseId === baseId);

        this.sigils.delete(baseId);
        this.summoned = this.summoned.filter(sc => sc.baseId !== baseId);

        if (sigil && this.onStateChanged) {
            this.onStateChanged(sigil, 'sigil-destroyed');
        }

        return { sigil, creatures };
    }
}
