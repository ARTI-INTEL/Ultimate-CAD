import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /servers/check/:discordGuildId — check if a Discord guild is a registered server
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

// GET /servers/members/:serverId/:userId — check if user is a member
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

// POST /servers/members — add a user to a server
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

export default router;