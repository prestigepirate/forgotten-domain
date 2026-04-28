/**
 * Creature Database Loader
 *
 * Loads creatures-database.json and provides query functions
 * for the summon creature menu and cost calculations.
 */

const DB_PATH = '/creatures-database.json';

/**
 * Fetch the creature database JSON.
 * @returns {Promise<Object>} Database object with metadata, continents, creatures, spells, traps
 */
export async function loadCreatureDatabase() {
    const response = await fetch(DB_PATH);
    if (!response.ok) {
        throw new Error(`Failed to load creature database: ${response.status}`);
    }
    return response.json();
}

/**
 * Build a Map<id, creature> for O(1) lookup by database entry ID.
 * @param {Object} database - Full database object from loadCreatureDatabase()
 * @returns {Map<string, Object>}
 */
export function buildCreatureIndex(database) {
    const index = new Map();
    if (!database || !database.creatures) return index;

    for (const entry of database.creatures) {
        index.set(entry.id, entry);
    }
    return index;
}

/**
 * Get all creatures belonging to a continent.
 * @param {Object} database - Full database object
 * @param {string} continent - Continent key (e.g. 'arcanica', 'silvaryn')
 * @returns {Array} Filtered creature entries
 */
export function getCreaturesByContinent(database, continent) {
    if (!database || !database.creatures) return [];
    if (!continent || continent === 'all') return database.creatures;
    return database.creatures.filter(c => c.continent === continent);
}

/**
 * Look up a single creature by its database ID.
 * @param {Map<string, Object>} index - Index from buildCreatureIndex()
 * @param {string} id - Database entry ID
 * @returns {Object|undefined}
 */
export function getCreatureById(index, id) {
    return index.get(id);
}

/**
 * Calculate mana cost to summon a creature.
 * Base 2 mana + 1 per level.
 * @param {Object} creatureEntry - Single creature from the database
 * @returns {number}
 */
export function getSummonCost(creatureEntry) {
    if (!creatureEntry) return 0;
    return 2 + (creatureEntry.level ?? 1);
}

/**
 * Get continent display info (color, displayName) from database metadata.
 * @param {Object} database - Full database object
 * @param {string} continentKey - Continent key
 * @returns {{ color: string, displayName: string }|null}
 */
export function getContinentInfo(database, continentKey) {
    if (!database?.continents) return null;
    const info = database.continents[continentKey];
    return info || null;
}

/**
 * Build a grouped structure for the summon menu: continent -> creatures.
 * @param {Object} database - Full database object
 * @returns {Map<string, Array>} Continent key -> array of creatures
 */
export function groupCreaturesByContinent(database) {
    const groups = new Map();
    if (!database?.creatures) return groups;

    for (const entry of database.creatures) {
        if (!groups.has(entry.continent)) {
            groups.set(entry.continent, []);
        }
        groups.get(entry.continent).push(entry);
    }
    return groups;
}
