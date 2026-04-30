/**
 * Auth Server - Express API for authentication
 */
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, queries } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Serve static files from project root (game.html, js/, css/, assets/, creatures-database.json)
app.use(express.static(projectRoot));

app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080', 'http://127.0.0.1:3000']
}));
app.use(express.json());

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    // Check if user exists
    const existingUser = queries.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    const existingEmail = queries.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = queries.createUser(username, email, passwordHash, displayName || username);

    // Create stats record
    queries.createStats(result.lastInsertRowid);

    // Generate token
    const token = jwt.sign(
      { userId: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: result.lastInsertRowid,
        username,
        email,
        displayName: displayName || username
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Find user
    const user = queries.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        originName: user.origin_name,
        originIcon: user.origin_icon
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login.' });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = queries.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
});

// Update profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, avatarUrl, originName, originIcon } = req.body;

    queries.updateProfile(
      displayName || req.user.username,
      avatarUrl || null,
      originName || 'Unclaimed',
      originIcon || '?',
      req.user.userId
    );

    res.json({
      message: 'Profile updated',
      user: {
        id: req.user.userId,
        username: req.user.username,
        displayName: displayName || req.user.username,
        avatarUrl,
        originName: originName || 'Unclaimed',
        originIcon: originIcon || '?'
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Save game
app.post('/api/game/save', authenticateToken, (req, res) => {
  try {
    const { saveName, saveData } = req.body;

    // Check if save exists
    const existingSave = queries.getGameSave(req.user.userId, saveName || 'autosave');

    if (existingSave) {
      queries.updateGameSave(typeof saveData === 'string' ? saveData : JSON.stringify(saveData), req.user.userId, saveName || 'autosave');
    } else {
      queries.createGameSave(req.user.userId, saveName || 'autosave', typeof saveData === 'string' ? saveData : JSON.stringify(saveData));
    }

    res.json({ message: 'Game saved successfully' });
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to save game.' });
  }
});

// Load game
app.get('/api/game/save', authenticateToken, (req, res) => {
  try {
    const saveName = req.query.saveName || 'autosave';
    const save = queries.getGameSave(req.user.userId, saveName);

    if (!save) {
      return res.status(404).json({ error: 'No save found.' });
    }

    res.json({ saveData: JSON.parse(save.save_data) });
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: 'Failed to load game.' });
  }
});

// Get user stats
app.get('/api/auth/stats', authenticateToken, (req, res) => {
  try {
    const stats = queries.getStats(req.user.userId);
    res.json({ stats: stats || {} });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats.' });
  }
});

// Update stats
app.post('/api/auth/stats', authenticateToken, (req, res) => {
  try {
    const { gamesPlayed, gamesWon, totalTicks, territoriesClaimed, creaturesSummoned, spellsCast } = req.body;

    queries.updateStats(
      gamesPlayed || 0,
      gamesWon || 0,
      totalTicks || 0,
      territoriesClaimed || 0,
      creaturesSummoned || 0,
      spellsCast || 0,
      req.user.userId
    );

    res.json({ message: 'Stats updated' });
  } catch (err) {
    console.error('Stats update error:', err);
    res.status(500).json({ error: 'Failed to update stats.' });
  }
});

// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Auth server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
