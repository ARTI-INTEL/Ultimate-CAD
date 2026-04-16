import { Router } from 'express';
import pool from '../db.js';
import { configDotenv } from 'dotenv';

configDotenv();

const router = Router();

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function buildRedirectUri(req) {
  if (process.env.DISCORD_REDIRECT_URI) return process.env.DISCORD_REDIRECT_URI;
  return `${req.protocol}://${req.get('host')}/auth/discord/callback`;
}

function ensureDiscordConfig(res, req) {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    res.status(500).json({
      error: 'Discord OAuth is not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.',
    });
    return false;
  }

  if (!process.env.DISCORD_REDIRECT_URI && !req) {
    res.status(500).json({
      error: 'Discord redirect URI is not configured.',
    });
    return false;
  }

  return true;
}

router.get('/discord/login', (req, res) => {
  if (!ensureDiscordConfig(res, req)) return;

  const redirectUri = buildRedirectUri(req);
  const scope = encodeURIComponent('identify');
  const clientId = encodeURIComponent(process.env.DISCORD_CLIENT_ID);
  const encodedRedirectUri = encodeURIComponent(redirectUri);

  const authorizeUrl =
    `https://discord.com/oauth2/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${encodedRedirectUri}&scope=${scope}`;

  res.redirect(authorizeUrl);
});

router.get('/discord/callback', async (req, res) => {
  if (!ensureDiscordConfig(res, req)) return;

  const { code, error } = req.query;

  if (error) {
    return res.redirect('/index.html?auth_error=discord_authorization_denied');
  }

  if (!code) {
    return res.redirect('/index.html?auth_error=missing_authorization_code');
  }

  const redirectUri = buildRedirectUri(req);

  try {
    const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect('/index.html?auth_error=discord_token_exchange_failed');
    }

    const tokenPayload = await tokenResponse.json();

    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.redirect('/index.html?auth_error=discord_profile_fetch_failed');
    }

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;

    const [existingRows] = await pool.query('SELECT * FROM users WHERE discord_id = ?', [discordId]);

    let userRecord = existingRows[0];

    if (!userRecord) {
      const [result] = await pool.query(
        'INSERT INTO users (discord_id, username) VALUES (?, ?)',
        [discordId, username]
      );
      const [newRows] = await pool.query('SELECT * FROM users WHERE iduser = ?', [result.insertId]);
      userRecord = newRows[0];
    } else if (userRecord.username !== username) {
      await pool.query('UPDATE users SET username = ? WHERE iduser = ?', [username, userRecord.iduser]);
      userRecord.username = username;
    }

    const params = new URLSearchParams({
      auth_success: '1',
      iduser: String(userRecord.iduser),
      username: userRecord.username,
      discord_id: userRecord.discord_id,
      created_at: userRecord.created_at ? String(userRecord.created_at) : '',
    });

    return res.redirect(`/index.html?${params.toString()}`);
  } catch (err) {
    console.error(err);
    return res.redirect('/index.html?auth_error=discord_oauth_failed');
  }
});

export default router;
