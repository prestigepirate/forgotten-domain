/**
 * Database Setup - SQLite with sql.js (pure JavaScript, no native modules)
 */
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/users.db');

let db = null;

/**
 * Initialize the database
 */
async function initDatabase() {
    const SQL = await initSqlJs();

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir, { recursive: true });
    }

    // Try to load existing database
    try {
        const fileBuffer = await fs.readFile(dbPath);
        db = new SQL.Database(fileBuffer);
    } catch {
        // No existing database, create new one
        db = new SQL.Database();
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            avatar_url TEXT,
            origin_name TEXT DEFAULT 'Unclaimed',
            origin_icon TEXT DEFAULT '?',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS game_saves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            save_name TEXT DEFAULT 'autosave',
            save_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS user_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            games_played INTEGER DEFAULT 0,
            games_won INTEGER DEFAULT 0,
            total_ticks INTEGER DEFAULT 0,
            territories_claimed INTEGER DEFAULT 0,
            creatures_summoned INTEGER DEFAULT 0,
            spells_cast INTEGER DEFAULT 0,
            last_played DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Default user (opt-in via DEFAULT_USER env var: "username:password")
    const defaultUser = process.env.DEFAULT_USER;
    if (defaultUser && defaultUser.includes(':')) {
        const [defaultUsername, defaultPassword] = defaultUser.split(':');
        const defaultEmail = `${defaultUsername}@example.com`;

        const stmt = db.prepare('SELECT id FROM users WHERE username = ?');
        stmt.bind([defaultUsername]);
        const hasUser = stmt.step();
        stmt.free();

        if (!hasUser && defaultUsername && defaultPassword) {
            const passwordHash = bcrypt.hashSync(defaultPassword, 10);
            const insertStmt = db.prepare(`
                INSERT INTO users (username, email, password_hash, display_name)
                VALUES (?, ?, ?, ?)
            `);
            insertStmt.run([defaultUsername, defaultEmail, passwordHash, defaultUsername]);
            insertStmt.free();

            const userStmt = db.prepare('SELECT id FROM users WHERE username = ?');
            userStmt.bind([defaultUsername]);
            userStmt.step();
            const userId = userStmt.get()[0];
            userStmt.free();

            const statsStmt = db.prepare('INSERT INTO user_stats (user_id) VALUES (?)');
            statsStmt.run([userId]);
            statsStmt.free();

            console.log(`Default user created: ${defaultUsername}`);
        }
    }

    // Save database to file
    saveDatabase();

    return db;
}

/**
 * Save database to file
 */
function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFile(dbPath, buffer).catch(err => console.error('Failed to save database:', err));
}

/**
 * Helper to run a query and get single row
 */
function getOne(sql, params = []) {
    if (!db) return null;
    const stmt = db.prepare(sql);
    stmt.bind(params.map(p => p ?? null));
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
}

/**
 * Helper to run a query and get all rows
 */
function getAll(sql, params = []) {
    if (!db) return [];
    const stmt = db.prepare(sql);
    stmt.bind(params.map(p => p ?? null));
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/**
 * Helper to run a write query
 */
function run(sql, params = []) {
    if (!db) return { lastInsertRowid: null, changes: 0 };
    const stmt = db.prepare(sql);
    stmt.run(params.map(p => p ?? null));
    stmt.free();
    const result = db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : null;
    saveDatabase();
    return { lastInsertRowid, changes: 1 };
}

// User queries
const queries = {
    createUser: (username, email, passwordHash, displayName) => run(
        'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, displayName]
    ),

    getUserByUsername: (username) => getOne('SELECT * FROM users WHERE username = ?', [username]),
    getUserByEmail: (email) => getOne('SELECT * FROM users WHERE email = ?', [email]),
    getUserById: (id) => getOne('SELECT id, username, email, display_name, avatar_url, origin_name, origin_icon, created_at FROM users WHERE id = ?', [id]),

    updateProfile: (displayName, avatarUrl, originName, originIcon, id) => run(
        'UPDATE users SET display_name = ?, avatar_url = ?, origin_name = ?, origin_icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [displayName, avatarUrl, originName, originIcon, id]
    ),

    createGameSave: (userId, saveName, saveData) => run(
        'INSERT INTO game_saves (user_id, save_name, save_data) VALUES (?, ?, ?)',
        [userId, saveName, saveData]
    ),

    getGameSave: (userId, saveName) => getOne('SELECT * FROM game_saves WHERE user_id = ? AND save_name = ?', [userId, saveName]),

    updateGameSave: (saveData, userId, saveName) => run(
        'UPDATE game_saves SET save_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND save_name = ?',
        [saveData, userId, saveName]
    ),

    createStats: (userId) => run('INSERT INTO user_stats (user_id) VALUES (?)', [userId]),

    getStats: (userId) => getOne('SELECT * FROM user_stats WHERE user_id = ?', [userId]),

    updateStats: (gamesPlayed, gamesWon, totalTicks, territoriesClaimed, creaturesSummoned, spellsCast, userId) => run(`
        UPDATE user_stats
        SET games_played = COALESCE(games_played, 0) + ?,
            games_won = COALESCE(games_won, 0) + ?,
            total_ticks = COALESCE(total_ticks, 0) + ?,
            territories_claimed = COALESCE(territories_claimed, 0) + ?,
            creatures_summoned = COALESCE(creatures_summoned, 0) + ?,
            spells_cast = COALESCE(spells_cast, 0) + ?,
            last_played = CURRENT_TIMESTAMP
        WHERE user_id = ?
    `, [gamesPlayed, gamesWon, totalTicks, territoriesClaimed, creaturesSummoned, spellsCast, userId]),

    // Leaderboard: top players by composite score
    getLeaderboard: (limit = 20) => getAll(`
        SELECT
            u.username,
            u.display_name,
            u.origin_name,
            u.origin_icon,
            COALESCE(s.games_played, 0) as games_played,
            COALESCE(s.games_won, 0) as games_won,
            COALESCE(s.territories_claimed, 0) as territories_claimed,
            COALESCE(s.creatures_summoned, 0) as creatures_summoned,
            COALESCE(s.spells_cast, 0) as spells_cast,
            (COALESCE(s.territories_claimed, 0) * 100 +
             COALESCE(s.creatures_summoned, 0) * 50 +
             COALESCE(s.spells_cast, 0) * 25 +
             COALESCE(s.games_won, 0) * 500) as score
        FROM users u
        LEFT JOIN user_stats s ON u.id = s.user_id
        WHERE s.user_id IS NOT NULL
        ORDER BY score DESC
        LIMIT ?
    `, [limit])
};

export { initDatabase, queries, saveDatabase };
