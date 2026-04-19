/**
 * erlcPoller.js  Ultimate CAD – ERLC API Proxy
 *
 * Proxies requests to https://api.policeroleplay.community/v1/
 * using the per-server ERLC key stored in the DB.
 *
 * Endpoints added in this revision:
 *   GET  /erlc/:serverId/live-units       – ERLC players merged with CAD units
 *   GET  /erlc/:serverId/emergency-calls  – In-game 911 / emergency calls
 *   POST /erlc/:serverId/import-call      – Import an ERLC call into the CAD
 */

import { Router } from 'express';
import pool from '../db.js';
import { verifyUser, verifyMember, verifyUnit } from '../middleware/auth.middleware.js';

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

  if (res.status === 204) return null;
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

/* ── Standard read-only endpoints ─────────────────────────── */

router.get('/:serverId/server',      verifyUser, verifyMember, erlcHandler('/server'));
router.get('/:serverId/players',     verifyUser, verifyMember, erlcHandler('/server/players'));
router.get('/:serverId/joinlogs',    verifyUser, verifyMember, erlcHandler('/server/joinlogs'));
router.get('/:serverId/killlogs',    verifyUser, verifyMember, erlcHandler('/server/killlogs'));
router.get('/:serverId/commandlogs', verifyUser, verifyMember, erlcHandler('/server/commandlogs'));
router.get('/:serverId/bans',        verifyUser, verifyMember, erlcHandler('/server/bans'));
router.get('/:serverId/vehicles',    verifyUser, verifyMember, erlcHandler('/server/vehicles'));
router.get('/:serverId/queue',       verifyUser, verifyMember, erlcHandler('/server/queue'));
router.get('/:serverId/staff',       verifyUser, verifyMember, erlcHandler('/server/staff'));

/* ─────────────────────────────────────────────────────────── */
/*  NEW: GET /erlc/:serverId/live-units                        */
/*                                                             */
/*  Returns ERLC player list fused with clocked-in CAD units. */
/*  Matching is done by roblox_username == ERLC Player name.  */
/*  Response shape:                                            */
/*    { players: [...], units: [...], linked: [...] }          */
/*  where linked[i] = unit row + { erlcPlayer, position }     */
/* ─────────────────────────────────────────────────────────── */
router.get('/:serverId/live-units', verifyUser, verifyMember, async (req, res) => {
  const { serverId } = req.params;
  try {
    /* 1. Load CAD units for this server */
    const [units] = await pool.query(
      `SELECT u.id, u.user_id, u.name, u.callsign, u.department,
              u.status, u.location, u.current_call, u.clocked_in,
              us.roblox_username
       FROM units u
       LEFT JOIN users us ON us.iduser = u.user_id
       WHERE u.server_id = ?
       ORDER BY u.department, u.callsign`,
      [serverId]
    );

    /* 2. Try to fetch ERLC player list (graceful fail if no key) */
    const key = await getServerKey(serverId);
    let players = [];
    if (key) {
      players = await erlcFetch(key, '/server/players').catch(() => []) || [];
    }

    /* 3. Match each CAD unit to an ERLC player by Roblox username */
    const linked = units.map((unit) => {
      const erlcPlayer = players.find(
        (p) =>
          p.Player &&
          unit.roblox_username &&
          p.Player.toLowerCase() === unit.roblox_username.toLowerCase()
      ) || null;

      return {
        ...unit,
        erlcPlayer,
        position: erlcPlayer?.Position || null,
      };
    });

    res.json({ players, units, linked });
  } catch (err) {
    console.error('[live-units]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────── */
/*  NEW: GET /erlc/:serverId/emergency-calls                   */
/*                                                             */
/*  Returns active in-game 911 / emergency calls from ERLC.   */
/*  Falls back gracefully if the endpoint is unavailable or    */
/*  the server key is not configured.                          */
/*                                                             */
/*  Response: array of ERLC call objects, normalised to:       */
/*    { erlcCallId, caller, nature, location, status, rawPosition } */
/* ─────────────────────────────────────────────────────────── */
router.get('/:serverId/emergency-calls', verifyUser, verifyMember, async (req, res) => {
  const { serverId } = req.params;
  try {
    const key = await getServerKey(serverId);
    if (!key) return res.json([]);

    /* Try the ERLC /server/calls endpoint (available on some versions) */
    const rawCalls = await erlcFetch(key, '/server/calls').catch(() => null);

    if (rawCalls && Array.isArray(rawCalls) && rawCalls.length) {
      const normalised = rawCalls.map((c, i) => ({
        erlcCallId:  c.CallId   || c.Id    || String(i + 1),
        caller:      c.Caller   || c.Player || 'Unknown',
        nature:      c.Nature   || c.CallType || 'Emergency',
        location:    c.Location ? (c.Location.Name || JSON.stringify(c.Location)) : 'Unknown',
        status:      c.Status   || 'Pending',
        rawPosition: c.Location?.Position || c.Position || null,
      }));
      return res.json(normalised);
    }

    /* Fallback: parse command logs for 911 dispatch patterns */
    const logs = await erlcFetch(key, '/server/commandlogs').catch(() => []) || [];
    const callPattern = /(?:911|emergency|dispatch|call)\s*[:\-–]?\s*(.+)/i;
    const parsed = [];
    logs.slice(0, 50).forEach((log, i) => {
      const match = (log.Command || log.Text || '').match(callPattern);
      if (match) {
        parsed.push({
          erlcCallId:  'LOG-' + i,
          caller:      log.Player || 'Unknown',
          nature:      'Emergency (log)',
          location:    match[1].trim().substring(0, 60),
          status:      'Pending',
          rawPosition: null,
        });
      }
    });

    res.json(parsed);
  } catch (err) {
    console.error('[emergency-calls]', err);
    res.json([]); // always return an empty array rather than erroring
  }
});

/* ─────────────────────────────────────────────────────────── */
/*  NEW: POST /erlc/:serverId/import-call                      */
/*                                                             */
/*  Converts an ERLC emergency call into a CAD call.           */
/*  Body: { erlcCallId, caller, nature, location, priority }   */
/*  Requires the user to be clocked in as a unit.             */
/* ─────────────────────────────────────────────────────────── */
router.post('/:serverId/import-call', verifyUser, verifyUnit, async (req, res) => {
  const { serverId } = req.params;
  const { nature, location, priority } = req.body;

  if (!nature || !location)
    return res.status(400).json({ error: 'nature and location are required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO calls (server_id, nature, location, priority)
       VALUES (?, ?, ?, ?)`,
      [serverId, nature, location, priority || 'Low']
    );
    const [rows] = await pool.query('SELECT * FROM calls WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[import-call]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* ── Moderation endpoints ──────────────────────────────────── */

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

/* ── Key validation ───────────────────────────────────────── */

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


// ═══════════════════════════════════════════════════════════════
// ADDITIONS FOR  src/jobs/erlcPoller.js
//
// Paste these route definitions BEFORE the final  export default router;
// line.  pool is already imported in that file.
// ═══════════════════════════════════════════════════════════════
 
// ── GET /erlc/:serverId/calls ────────────────────────────────
// Returns the current list of active 911 / dispatch calls from ERLC.
router.get('/:serverId/calls', verifyUser, verifyMember, async (req, res) => {
  try {
    const key = await getServerKey(req.params.serverId);
    if (!key)
      return res.status(400).json({ error: 'No ERLC server key configured. Add it in Server Settings.' });
 
    let data;
    try {
      data = await erlcFetch(key, '/server/calls');
    } catch {
      // Some ERLC servers / key tiers don't expose this endpoint
      return res.json([]);
    }
 
    // ERLC may return an array or { Calls: [...] }
    const calls = Array.isArray(data) ? data
                : (data?.Calls || data?.calls || []);
    res.json(calls);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});
 
// ── POST /erlc/:serverId/sync-calls ─────────────────────────
// Imports active ERLC 911 calls into the CAD database as ACTIVE calls.
// Deduplication: calls tagged [ERLC-<id>] in the `nature` column are
// not re-inserted on subsequent syncs.
router.post('/:serverId/sync-calls', verifyUser, verifyMember, async (req, res) => {
  const { serverId } = req.params;
 
  try {
    const key = await getServerKey(serverId);
    if (!key)
      return res.status(400).json({ error: 'No ERLC server key configured.' });
 
    // ── Fetch ERLC calls ──────────────────────────────────
    let erlcData;
    try {
      erlcData = await erlcFetch(key, '/server/calls');
    } catch {
      return res.json({ synced: 0, total: 0, message: 'ERLC calls endpoint unavailable for this server key.' });
    }
 
    const erlcCalls = Array.isArray(erlcData) ? erlcData
                    : (erlcData?.Calls || erlcData?.calls || []);
 
    if (!erlcCalls.length) {
      return res.json({ synced: 0, total: 0 });
    }
 
    // ── Sync each call ────────────────────────────────────
    let synced = 0;
    for (const call of erlcCalls) {
      const erlcId   = String(call.Id   ?? call.id   ?? call.CallId ?? '');
      const nature   = String(call.Description ?? call.Nature   ?? call.description ?? 'ERLC Call');
      const location = String(call.Location    ?? call.location ?? 'Unknown');
      const priority = call.Priority ?? call.priority ?? 'Medium';
 
      if (!erlcId) continue;
 
      const tag = `[ERLC-${erlcId}]`;
 
      // Check whether we already have an active CAD call for this ERLC call
      const [existing] = await pool.query(
        "SELECT id FROM calls WHERE server_id = ? AND nature LIKE ? AND status = 'ACTIVE'",
        [serverId, `${tag}%`]
      );
 
      if (!existing.length) {
        await pool.query(
          "INSERT INTO calls (server_id, nature, location, priority, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
          [serverId, `${tag} ${nature}`, location, priority]
        );
        synced++;
      }
    }
 
    res.json({ synced, total: erlcCalls.length });
  } catch (err) {
    console.error('[ERLC sync-calls]', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});
 
// ── GET /erlc/:serverId/players/positions ────────────────────
// Convenience endpoint: returns only players that have Position data,
// formatted for the CADMap module.
router.get('/:serverId/players/positions', verifyUser, verifyMember, async (req, res) => {
  try {
    const key = await getServerKey(req.params.serverId);
    if (!key)
      return res.json([]);
 
    const data = await erlcFetch(key, '/server/players');
    const all  = Array.isArray(data) ? data : (data?.Players || data?.players || []);
 
    const withPos = all.filter(p => p.Position || p.position);
    res.json(withPos);
  } catch (err) {
    res.json([]);
  }
});
 
export default router;