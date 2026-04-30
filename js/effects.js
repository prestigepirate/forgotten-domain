/**
 * Effects Engine — Parses and applies creature card effects.
 *
 * Effect types:
 *   onKill      — triggers when this creature destroys another
 *   onDeath     — triggers when this creature is destroyed
 *   onSummon    — triggers when this creature enters the field
 *   periodic    — triggers on a timer while this creature is alive
 *   aura        — passive stat modifier for creatures at the same base
 */

// ============================================
// Effect Parser
// ============================================

/**
 * Parse a creature's effect string into structured effect objects.
 * Returns an array of { type, ...params }.
 */
export function parseEffects(creature) {
    if (!creature.effect) return [];
    const text = creature.effect;
    const effects = [];

    // "When this destroys an enemy creature, steal X Essence."
    const onKillSteal = text.match(/destroy\s.*?steal\s+(\d+)\s+Essence/i);
    if (onKillSteal) {
        effects.push({ type: 'onKill', action: 'stealEssence', amount: parseInt(onKillSteal[1]) });
    }

    // "Whenever it destroys a creature, gain X Essence."
    const onKillGain = text.match(/destroys\s+a\s+creature.*?gain\s+(\d+)\s+Essence/i);
    if (onKillGain) {
        effects.push({ type: 'onKill', action: 'gainEssence', amount: parseInt(onKillGain[1]) });
    }

    // "Once per game, when destroyed, return to your hand instead."
    if (/when destroyed.*return to your hand/i.test(text)) {
        effects.push({ type: 'onDeath', action: 'returnToHand' });
    }

    // "When destroyed, deal X damage to the creature that destroyed it."
    const onDeathDmg = text.match(/When destroyed.*deal\s+(\d+)\s+damage/i);
    if (onDeathDmg) {
        effects.push({ type: 'onDeath', action: 'dealDamage', amount: parseInt(onDeathDmg[1]) });
    }

    // "Once per game, when destroyed: revive at your King's Throne"
    if (/when destroyed.*revive.*King/i.test(text)) {
        effects.push({ type: 'onDeath', action: 'revive' });
    }

    // "On summon, discard 1 card to draw 2 new ones."
    if (/On summon.*discard.*draw/i.test(text)) {
        effects.push({ type: 'onSummon', action: 'discardAndDraw', discard: 1, draw: 2 });
    }

    // "On summon: deal X damage to all enemy creatures within 1 hop."
    const onSummonDmg = text.match(/On summon.*deal\s+(\d+)\s+damage/i);
    if (onSummonDmg) {
        effects.push({ type: 'onSummon', action: 'areaDamage', amount: parseInt(onSummonDmg[1]) });
    }

    // "Gains +X ATK while attacking along a purple ley-line." / "Gains +X ATK for each enemy creature..."
    const atkBoost = text.match(/Gains\s+\+(\d+)\s+ATK/i);
    if (atkBoost) {
        effects.push({ type: 'aura', stat: 'atk', amount: parseInt(atkBoost[1]), scope: 'self' });
    }

    // "King's Aura: All your Level 1 creatures gain +X ATK."
    const kingAura = text.match(/King'?s?\s*Aura.*gain\s+\+(\d+)\s+ATK/i);
    if (kingAura) {
        effects.push({ type: 'aura', stat: 'atk', amount: parseInt(kingAura[1]), scope: 'level1Allies' });
    }

    // "All friendly creatures at this base gain +X DEF."
    const defAura = text.match(/All friendly.*gain\s+\+(\d+)\s+DEF/i);
    if (defAura) {
        effects.push({ type: 'aura', stat: 'def', amount: parseInt(defAura[1]), scope: 'baseAllies' });
    }

    // "All enemy creatures lose X ATK while this is on the field."
    const globalDebuff = text.match(/All enemy.*lose\s+(\d+)\s+ATK/i);
    if (globalDebuff) {
        effects.push({ type: 'aura', stat: 'atk', amount: -parseInt(globalDebuff[1]), scope: 'allEnemies' });
    }

    // "Deals X splash damage to all enemy creatures at the same base on arrival."
    const splashDmg = text.match(/splash damage.*?(\d+)/i) || text.match(/Deals\s+(\d+)\s+splash/i);
    if (splashDmg) {
        effects.push({ type: 'onSummon', action: 'splashDamage', amount: parseInt(splashDmg[1]) });
    }

    // "At the start of every minute, deal X damage to the nearest enemy King's Throne."
    const periodicDmg = text.match(/start of every minute.*deal\s+(\d+)\s+damage/i);
    if (periodicDmg) {
        effects.push({ type: 'periodic', action: 'damageNearestThrone', amount: parseInt(periodicDmg[1]), intervalMs: 60000 });
    }

    // "Heals X HP to your King's Throne at the start of each minute."
    const periodicHeal = text.match(/Heals\s+(\d+)\s+HP.*King/i);
    if (periodicHeal) {
        effects.push({ type: 'periodic', action: 'healThrone', amount: parseInt(periodicHeal[1]), intervalMs: 60000 });
    }

    // "When this destroys a creature, summon a Chrome Drone at the same base."
    if (/When this destroys.*summon/i.test(text)) {
        effects.push({ type: 'onKill', action: 'summonOnKill' });
    }

    // "Pierces through: ignores X DEF when attacking."
    const pierce = text.match(/ignores\s+(\d+)\s+DEF/i);
    if (pierce) {
        effects.push({ type: 'aura', stat: 'pierce', amount: parseInt(pierce[1]), scope: 'self' });
    }

    // "Deals double ATK when attacking a King's Throne."
    if (/double ATK.*King/i.test(text)) {
        effects.push({ type: 'aura', action: 'doubleATKvsThrone', scope: 'self' });
    }

    return effects;
}

// ============================================
// Effect Executor
// ============================================

/**
 * Execute effects of a given type for a creature.
 * @param {string} eventType — 'onKill', 'onDeath', 'onSummon', 'periodic'
 * @param {Object} creature — the creature with effects
 * @param {Object} context — { gameState, killer, victim, baseId, etc. }
 */
export function executeEffects(eventType, creature, context = {}) {
    const effects = parseEffects(creature);
    const gs = context.gameState;
    if (!gs) return;

    for (const eff of effects) {
        if (eff.type !== eventType) continue;

        switch (eff.action) {
            case 'stealEssence':
            case 'gainEssence': {
                const homeKey = gs.homePlanet;
                if (gs.shards[homeKey] !== undefined) {
                    gs.shards[homeKey] = Math.min(gs.maxShards, gs.shards[homeKey] + eff.amount);
                }
                break;
            }
            case 'dealDamage': {
                // Deal damage to the killer creature
                if (context.killer) {
                    context.killer._pendingDamage = (context.killer._pendingDamage || 0) + eff.amount;
                }
                break;
            }
            case 'splashDamage':
            case 'areaDamage': {
                // Damage all enemy creatures at the same base
                const baseId = creature.baseId || context.baseId;
                if (baseId && gs.renderer) {
                    const allCreatures = Array.from(gs.renderer.creatures.values());
                    const enemyAtBase = allCreatures.filter(c =>
                        c.baseId === baseId && c.owner !== creature.owner && c.id !== creature.id
                    );
                    enemyAtBase.forEach(c => {
                        c._pendingDamage = (c._pendingDamage || 0) + eff.amount;
                    });
                }
                break;
            }
            case 'returnToHand': {
                creature._returnToHand = true;
                break;
            }
            case 'revive': {
                creature._reviveOnDeath = true;
                break;
            }
            case 'damageNearestThrone': {
                if (gs.enemyAI && creature.owner !== 'enemy' && !creature._isEnemy) {
                    // Player's creature damaging enemy king
                    const enemyKing = gs.baseSystem.getAll().find(b => b.type === 'enemy-king-base');
                    if (enemyKing && gs.kingBaseHP[enemyKing.id]) {
                        gs.kingBaseHP[enemyKing.id].current = Math.max(0, gs.kingBaseHP[enemyKing.id].current - eff.amount);
                    }
                }
                break;
            }
            case 'healThrone': {
                const playerKingId = `${gs.homePlanet}-throne`;
                if (gs.kingBaseHP[playerKingId]) {
                    gs.kingBaseHP[playerKingId].current = Math.min(
                        gs.kingBaseHP[playerKingId].max,
                        gs.kingBaseHP[playerKingId].current + eff.amount
                    );
                }
                break;
            }
        }
    }

    // Apply pending damage from effects
    if (context.killer && context.killer._pendingDamage) {
        // Damage is applied by checking if the creature should die
        context.killer._effectDamage = context.killer._pendingDamage;
        delete context.killer._pendingDamage;
    }

    // Handle returnToHand
    if (creature._returnToHand && eventType === 'onDeath') {
        creature._returnToHand = false;
        // Don't actually destroy — just move back to nearest friendly base
        const friendlyBases = gs.baseSystem.getAll().filter(b =>
            b.type === 'king-base' || b.type === 'base' || b.type === 'player-base'
        );
        if (friendlyBases.length > 0) {
            const oldBase = gs.baseSystem.getById(creature.baseId);
            const nearest = friendlyBases.reduce((a, b) => {
                const distA = oldBase ? Math.hypot(a.x - oldBase.x, a.y - oldBase.y) : 999;
                const distB = oldBase ? Math.hypot(b.x - oldBase.x, b.y - oldBase.y) : 999;
                return distA < distB ? a : b;
            });
            creature.baseId = nearest.id;
            // Mark as "saved" so the destroy function knows to skip actual removal
            creature._savedFromDeath = true;
        }
    }

    if (creature._reviveOnDeath && eventType === 'onDeath') {
        creature._reviveOnDeath = false;
        const throneId = `${gs.homePlanet}-throne`;
        creature.baseId = throneId;
        creature._savedFromDeath = true;
    }
}

/**
 * Apply aura effects to get modified stats for a creature.
 */
export function getEffectiveStats(creature, allCreatures, gameState) {
    if (!creature) return { atk: 0, def: 0 };

    let atk = creature.atk || 0;
    let def = creature.def || 0;
    let pierce = 0;

    // Check auras from all creatures at the same base
    const sameBase = allCreatures.filter(c =>
        c.baseId === creature.baseId && c.id !== creature.id
    );

    for (const other of sameBase) {
        const effects = parseEffects(other);
        for (const eff of effects) {
            if (eff.type !== 'aura') continue;

            if (eff.action === 'doubleATKvsThrone') {
                // Check if target is king base — handled in combat
                atk = atk * 2;
            }

            if (eff.scope === 'baseAllies' && eff.stat === 'def') {
                def += eff.amount;
            }
            if (eff.scope === 'level1Allies' && eff.stat === 'atk' && creature.level === 1) {
                atk += eff.amount;
            }
            if (eff.scope === 'allEnemies' && eff.stat === 'atk' && eff.amount < 0) {
                atk += eff.amount;
            }
            if (eff.scope === 'self' && eff.stat === 'atk') {
                atk += eff.amount;
            }
            if (eff.scope === 'self' && eff.stat === 'pierce') {
                pierce += eff.amount;
            }
        }
    }

    return { atk, def, pierce };
}
