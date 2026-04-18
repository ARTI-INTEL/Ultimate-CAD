/**
 * erlc.routes.js  Ultimate CAD – ERLC API Proxy
 *
 * Proxies requests to https://api.policeroleplay.community/v1/
 * using the per-server ERLC key stored in the DB.
 *
 * All routes require:
 *   - verifyUser  (x-user-id header)
 *   - verifyMember (must be a member of the CAD server)
 *
 * ENV:  (none needed – key lives in servers.erlc_server_key)
 *
 * ERLC API docs: https://apidocs.policeroleplay.community/
 */
 
import { Router } from 'express';
import pool from '../db.js';
import { verifyUser, verifyMember } from '../middleware/auth.middleware.js';
 
const router = Router();
const ERLC_BASE = 'https://api.policeroleplay.community/v1';
 
/* ── Helpers ──────────────────────────────────────────────── */
 
async function getServerKey(serverId) {
  const [rows] = await pool.query(
    'SELECT erlc_server_key FROM servers WHERE idserver = ?',
    [serverId]
  );
  return rows[0]?.erlc_server_key || null;
}
 
async function erlcFetch(key, path, opts = {}) {
  const res = await fetch(`${ERLC_BASE}${path}`, {
    ...opts,
    headers: {
      'Server-Key': key,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
 
  if (res.status === 204) return null;          // no content
  const body = await res.json().catch(() => ({}));
 
  if (!res.ok) {
    const msg = body?.message || body?.error || `ERLC API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}
 
function erlcHandler(path, method = 'GET', bodyFn = null) {
  return async (req, res) => {
    try {
      const key = await getServerKey(req.params.serverId);
      if (!key)
        return res.status(400).json({ error: 'No ERLC server key configured. Add it in Server Settings.' });
 
      const opts = { method };
      if (bodyFn) opts.body = JSON.stringify(bodyFn(req));
 
      const data = await erlcFetch(key, path, opts);
      res.json(data ?? { success: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}
 
/* ── Read-only endpoints ──────────────────────────────────── */
 
// GET /erlc/:serverId/server  – server metadata (name, owner, join key, team balance)
router.get('/:serverId/server', verifyUser, verifyMember, erlcHandler('/server'));
 
// GET /erlc/:serverId/players  – online players [{Player, Permission, Team, ...}]
router.get('/:serverId/players', verifyUser, verifyMember, erlcHandler('/server/players'));
 
// GET /erlc/:serverId/joinlogs  – recent join / leave events
router.get('/:serverId/joinlogs', verifyUser, verifyMember, erlcHandler('/server/joinlogs'));
 
// GET /erlc/:serverId/killlogs  – recent kill events
router.get('/:serverId/killlogs', verifyUser, verifyMember, erlcHandler('/server/killlogs'));
 
// GET /erlc/:serverId/commandlogs  – recent admin commands
router.get('/:serverId/commandlogs', verifyUser, verifyMember, erlcHandler('/server/commandlogs'));
 
// GET /erlc/:serverId/bans  – current ban list
router.get('/:serverId/bans', verifyUser, verifyMember, erlcHandler('/server/bans'));
 
// GET /erlc/:serverId/vehicles  – spawned vehicles in-game
router.get('/:serverId/vehicles', verifyUser, verifyMember, erlcHandler('/server/vehicles'));
 
// GET /erlc/:serverId/queue  – players in server queue
router.get('/:serverId/queue', verifyUser, verifyMember, erlcHandler('/server/queue'));
 
// GET /erlc/:serverId/staff  – moderation staff list
router.get('/:serverId/staff', verifyUser, verifyMember, erlcHandler('/server/staff'));
 
/* ── Moderation endpoints (owner / admin only in ERLC) ───── */
 
// POST /erlc/:serverId/bans  – ban a player
// Body: { UserIds: [number], Reason: string, Duration?: number }
router.post('/:serverId/bans', verifyUser, verifyMember, async (req, res) => {
  try {
    const key = await getServerKey(req.params.serverId);
    if (!key) return res.status(400).json({ error: 'No ERLC server key configured.' });
 
    const { UserIds, Reason, Duration } = req.body;
    if (!UserIds || !Reason)
      return res.status(400).json({ error: 'UserIds and Reason are required.' });
 
    const data = await erlcFetch(key, '/server/bans', {
      method: 'POST',
      body: JSON.stringify({ UserIds, Reason, Duration: Duration ?? null }),
    });
    res.json(data ?? { success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
 
// DELETE /erlc/:serverId/bans  – unban a player
// Body: { UserIds: [number] }
router.delete('/:serverId/bans', verifyUser, verifyMember, async (req, res) => {
  try {
    const key = await getServerKey(req.params.serverId);
    if (!key) return res.status(400).json({ error: 'No ERLC server key configured.' });
 
    const { UserIds } = req.body;
    if (!UserIds) return res.status(400).json({ error: 'UserIds is required.' });
 
    const data = await erlcFetch(key, '/server/bans', {
      method: 'DELETE',
      body: JSON.stringify({ UserIds }),
    });
    res.json(data ?? { success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
 
// POST /erlc/:serverId/command  – execute a server command
// Body: { command: string }
router.post('/:serverId/command', verifyUser, verifyMember, async (req, res) => {
  try {
    const key = await getServerKey(req.params.serverId);
    if (!key) return res.status(400).json({ error: 'No ERLC server key configured.' });
 
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command is required.' });
 
    const data = await erlcFetch(key, '/server/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    res.json(data ?? { success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
 
/* ── Key validation helper ────────────────────────────────── */
 
// POST /erlc/:serverId/validate-key  – test that a key works
// Body: { key: string }
router.post('/:serverId/validate-key', verifyUser, verifyMember, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required.' });
 
  try {
    await erlcFetch(key, '/server');
    res.json({ valid: true });
  } catch (err) {
    res.json({ valid: false, reason: err.message });
  }
});
 
export default router;
 