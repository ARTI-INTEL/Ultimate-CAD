import { Router } from 'express';
import pool from '../db.js';
import { verifyUser, verifyMember, verifyOfficer } from '../middleware/auth.middleware.js';

const router = Router();

// GET /reports/:serverId  all reports (any member can view)
router.get('/:serverId', verifyUser, verifyMember, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM reports WHERE server_id = ? ORDER BY created_at DESC',
      [req.params.serverId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /reports  submit a report (must be clocked in)
router.post('/', verifyUser, verifyOfficer, async (req, res) => {
  const { serverId, callId, type, subjectName, subjectPlate, details } = req.body;
  if (!serverId || !type || !details)
    return res.status(400).json({ error: 'serverId, type, and details are required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO reports (server_id, officer_id, call_id, type, subject_name, subject_plate, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [serverId, req.officer.id, callId || null, type, subjectName || null, subjectPlate || null, JSON.stringify(details)]
    );
    res.json({ success: true, reportId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;