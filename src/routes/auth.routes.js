import { Router } from 'express';
import pool from '../db.js';
import { configDotenv } from 'dotenv';
import { verifyUser } from '../middleware/auth.middleware.js';

configDotenv();

const router = Router();

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const discordTokenStore = new Map();

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
  const scope = encodeURIComponent('identify guilds');
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

    discordTokenStore.set(discordId, {
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token || null,
      expiresAt: Date.now() + ((Number(tokenPayload.expires_in) || 0) * 1000),
    });

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

router.get('/discord/owner-guilds', verifyUser, async (req, res) => {
  const discordId = req.user.discord_id;
  const tokenRecord = discordTokenStore.get(discordId);

  if (!discordId || !tokenRecord?.accessToken) {
    return res.status(401).json({
      error: 'Discord guild access is unavailable. Please sign in with Discord again.',
    });
  }

  try {
    const guildsResponse = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${tokenRecord.accessToken}`,
      },
    });

    if (!guildsResponse.ok) {
      if (guildsResponse.status === 401 || guildsResponse.status === 403) {
        discordTokenStore.delete(discordId);
        return res.status(401).json({
          error: 'Discord guild access expired. Please sign in with Discord again.',
        });
      }

      throw new Error(`Discord guild fetch failed with status ${guildsResponse.status}`);
    }

    const guilds = await guildsResponse.json();
    const ownerGuilds = guilds
      .filter((guild) => guild.owner)
      .map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
      }));

    res.json(ownerGuilds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Discord servers' });
  }
});

export default router;
