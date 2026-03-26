import pool from '../db.js';

/**
 * verifyUser
 * Checks that the x-user-id header belongs to a real user in the database.
 * Attach to any route that requires a logged-in user.
 */
export async function verifyUser(req, res, next) {
  const userId = req.headers['x-user-id'];

  if (!userId)
    return res.status(401).json({ error: 'Unauthorised: missing x-user-id header' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE iduser = ?',
      [userId]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Unauthorised: user not found' });

    req.user = rows[0]; // attach user to request for downstream use
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during auth' });
  }
}

/**
 * verifyMember
 * Checks that the user is a member of the server they are trying to access.
 * Requires verifyUser to run first.
 * Expects serverId in req.params or req.body.
 */
export async function verifyMember(req, res, next) {
  const serverId = req.params.serverId || req.body.serverId;

  if (!serverId)
    return res.status(400).json({ error: 'Bad request: serverId is required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM server_members WHERE user_id = ? AND server_id = ?',
      [req.user.iduser, serverId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Forbidden: you are not a member of this server' });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during auth' });
  }
}

/**
 * verifyOfficer
 * Checks that the user has an active clocked-in officer session on this server.
 * Requires verifyUser to run first.
 * Attaches req.officer for downstream use.
 * Expects serverId in req.params or req.body.
 */
export async function verifyOfficer(req, res, next) {
  const serverId = req.params.serverId || req.body.serverId;

  if (!serverId)
    return res.status(400).json({ error: 'Bad request: serverId is required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM officers WHERE user_id = ? AND server_id = ?',
      [req.user.iduser, serverId]
    );
    if (rows.length === 0)
      return res.status(403).json({ error: 'Forbidden: you are not clocked in on this server' });

    req.officer = rows[0]; // attach officer session to request
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error during auth' });
  }
}