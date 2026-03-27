import { Router } from 'express';
import pool from '../db.js';
import { verifyUser } from '../middleware/auth.middleware.js';

const router = Router();

// Generate a random join code
function generateJoinCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET /servers/check/:discordGuildId
router.get('/check/:discordGuildId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM servers WHERE discord_id = ?',
      [req.params.discordGuildId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /servers/name/:serverId
router.get('/name/:serverId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM servers WHERE idserver = ?',
      [req.params.serverId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Server not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /servers/join-code/:serverId
router.get('/join-code/:serverId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT join_code AS code FROM servers WHERE idserver = ?',
      [req.params.serverId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Server not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /servers/members/:serverId/:userId
router.get('/members/:serverId/:userId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM server_members WHERE server_id = ? AND user_id = ?',
      [req.params.serverId, req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /servers/members
router.post('/members', async (req, res) => {
  const { userId, serverId } = req.body;
  if (!userId || !serverId)
    return res.status(400).json({ error: 'userId and serverId are required' });
  try {
    await pool.query(
      'INSERT IGNORE INTO server_members (user_id, server_id) VALUES (?, ?)',
      [userId, serverId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /servers/create — create a new server
router.post('/create', verifyUser, async (req, res) => {
  const { name, description, iconUrl, joinCode, discordId } = req.body;

  if (!name) return res.status(400).json({ error: 'Server name is required' });

  const code = joinCode?.trim() || generateJoinCode();

  try {
    // Check discord_id isn't already linked
    if (discordId) {
      const [existing] = await pool.query(
        'SELECT idserver FROM servers WHERE discord_id = ?',
        [discordId]
      );
      if (existing.length > 0)
        return res.status(409).json({ error: 'This Discord server is already linked to a CAD server' });
    }

    const [result] = await pool.query(
      `INSERT INTO servers (name, description, icon_url, join_code, discord_id, owner_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, iconUrl || null, code, discordId || null, req.user.iduser]
    );

    // Auto-add creator as a member
    await pool.query(
      'INSERT IGNORE INTO server_members (user_id, server_id) VALUES (?, ?)',
      [req.user.iduser, result.insertId]
    );

    const [rows] = await pool.query('SELECT * FROM servers WHERE idserver = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /servers/my-servers/:userId — get all servers a user is a member of
router.get('/my-servers/:userId', verifyUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.* FROM servers s
       INNER JOIN server_members sm ON sm.server_id = s.idserver
       WHERE sm.user_id = ?`,
      [req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;