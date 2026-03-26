import { Router } from 'express';
import pool from '../db.js';
 
const router = Router();
 
// GET /login/:discordId — check if user exists
router.get('/login/:discordId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE discord_id = ?',
      [req.params.discordId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
 
// POST /register — create a new user
router.post('/register', async (req, res) => {
  const { discordId, username } = req.body;
  if (!discordId || !username)
    return res.status(400).json({ error: 'discordId and username are required' });
 
  try {
    const [result] = await pool.query(
      'INSERT INTO users (discord_id, username) VALUES (?, ?)',
      [discordId, username]
    );
    const [rows] = await pool.query('SELECT * FROM users WHERE iduser = ?', [result.insertId]);
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [rows] = await pool.query('SELECT * FROM users WHERE discord_id = ?', [discordId]);
      return res.json(rows);
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
 
// GET /getUserByDiscordId/:discordId
router.get('/getUserByDiscordId/:discordId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE discord_id = ?',
      [req.params.discordId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
 
export default router;