import { Router } from 'express';
import pool from '../db.js';
import { verifyUser, verifyMember, verifyOfficer } from '../middleware/auth.middleware.js';

const router = Router();

// GET /calls/:serverId — all active calls (any member can view)
router.get('/:serverId', verifyUser, verifyMember, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, GROUP_CONCAT(o.callsign SEPARATOR ', ') AS units
       FROM calls c
       LEFT JOIN officers o ON o.current_call = c.id
       WHERE c.server_id = ? AND c.status = 'ACTIVE'
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.params.serverId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /calls/:serverId/history — closed calls (any member can view)
router.get('/:serverId/history', verifyUser, verifyMember, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM calls WHERE server_id = ? AND status = 'CLOSED' ORDER BY closed_at DESC`,
      [req.params.serverId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /calls — create a call (must be clocked in)
router.post('/', verifyUser, verifyOfficer, async (req, res) => {
  const { serverId, nature, location, priority } = req.body;
  if (!serverId || !nature || !location)
    return res.status(400).json({ error: 'serverId, nature, and location are required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO calls (server_id, nature, location, priority) VALUES (?, ?, ?, ?)',
      [serverId, nature, location, priority || 'Low']
    );
    const [rows] = await pool.query('SELECT * FROM calls WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /calls/:callId — update a call (must be clocked in)
router.patch('/:callId', verifyUser, verifyOfficer, async (req, res) => {
  const { nature, location, priority, serverId } = req.body;
  try {
    await pool.query(
      'UPDATE calls SET nature = ?, location = ?, priority = ? WHERE id = ?',
      [nature, location, priority, req.params.callId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /calls/:callId/close — CODE 4 (must be clocked in)
router.patch('/:callId/close', verifyUser, verifyOfficer, async (req, res) => {
  try {
    await pool.query(
      `UPDATE calls SET status = 'CLOSED', closed_at = NOW() WHERE id = ?`,
      [req.params.callId]
    );
    await pool.query(
      'UPDATE officers SET current_call = NULL WHERE current_call = ?',
      [req.params.callId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;