import { Router } from 'express';
import pool from '../db.js';
import { verifyUser, verifyMember } from '../middleware/auth.middleware.js';

const router = Router();

// GET /officers/:serverId — all on-duty officers (any member can view)
router.get('/:serverId', verifyUser, verifyMember, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM officers WHERE server_id = ?',
      [req.params.serverId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /officers/clock-in (must be a server member)
router.post('/clock-in', verifyUser, async (req, res) => {
  const { serverId, name, callsign, department } = req.body;
  if (!serverId || !name || !callsign || !department)
    return res.status(400).json({ error: 'All fields are required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO officers (user_id, server_id, name, callsign, department)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.iduser, serverId, name, callsign, department]
    );
    const [rows] = await pool.query('SELECT * FROM officers WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /officers/clock-out/:officerId (must be the same user)
router.delete('/clock-out/:officerId', verifyUser, async (req, res) => {
  try {
    // Ensure the officer session belongs to the requesting user
    const [rows] = await pool.query(
      'SELECT * FROM officers WHERE id = ? AND user_id = ?',
      [req.params.officerId, req.user.iduser]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Forbidden: not your officer session' });

    await pool.query('DELETE FROM officers WHERE id = ?', [req.params.officerId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /officers/:officerId/status (must be the same user)
router.patch('/:officerId/status', verifyUser, async (req, res) => {
  const { status, location, currentCall } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM officers WHERE id = ? AND user_id = ?',
      [req.params.officerId, req.user.iduser]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Forbidden: not your officer session' });

    await pool.query(
      'UPDATE officers SET status = ?, location = ?, current_call = ? WHERE id = ?',
      [status, location ?? '', currentCall ?? null, req.params.officerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;