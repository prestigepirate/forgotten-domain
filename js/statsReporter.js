/**
 * Stats Reporter — sends gameplay stats to the server for leaderboard tracking.
 * Fires silently in the background; never blocks gameplay on failure.
 */

const API_URL = '/api';
const FLUSH_INTERVAL = 30000; // 30 seconds

let _buffer = {
    gamesPlayed: 0,
    gamesWon: 0,
    territoriesClaimed: 0,
    creaturesSummoned: 0,
    spellsCast: 0
};
let _flushTimer = null;
let _flushing = false;

function _getToken() {
    try {
        return localStorage.getItem('auth_token');
    } catch {
        return null;
    }
}

async function flush() {
    if (_flushing) return;
    const token = _getToken();
    if (!token) return;

    // Check if there's anything to send
    const total = Object.values(_buffer).reduce((a, b) => a + b, 0);
    if (total === 0) return;

    _flushing = true;

    // Snapshot and reset the buffer
    const payload = { ..._buffer };
    _buffer = { gamesPlayed: 0, gamesWon: 0, territoriesClaimed: 0, creaturesSummoned: 0, spellsCast: 0 };

    try {
        await fetch(`${API_URL}/auth/stats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        // Merge back on failure — we'll retry next flush
        _buffer.gamesPlayed += payload.gamesPlayed;
        _buffer.gamesWon += payload.gamesWon;
        _buffer.territoriesClaimed += payload.territoriesClaimed;
        _buffer.creaturesSummoned += payload.creaturesSummoned;
        _buffer.spellsCast += payload.spellsCast;
    } finally {
        _flushing = false;
    }
}

function _ensureTimer() {
    if (_flushTimer) return;
    _flushTimer = setInterval(flush, FLUSH_INTERVAL);
}

/**
 * Increment a stat. Batches automatically; flushes every 30s.
 */
export function trackStat(stat) {
    const token = _getToken();
    if (!token) return; // Not logged in — silently skip

    if (_buffer.hasOwnProperty(stat)) {
        _buffer[stat]++;
        _ensureTimer();
    }
}

/**
 * Track that a game session has started.
 */
export function trackGameStarted() {
    trackStat('gamesPlayed');
}

/**
 * Track that the player won a game/battle.
 */
export function trackGameWon() {
    trackStat('gamesWon');
}

/**
 * Track that a creature was summoned.
 */
export function trackCreatureSummoned() {
    trackStat('creaturesSummoned');
}

/**
 * Track that a sigil was activated / spell was cast.
 */
export function trackSpellCast() {
    trackStat('spellsCast');
}

/**
 * Track that a territory/base was claimed.
 */
export function trackTerritoryClaimed() {
    trackStat('territoriesClaimed');
}

/**
 * Flush immediately (e.g. on page unload).
 */
export function flushNow() {
    return flush();
}

// Auto-flush on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => flush());
}
