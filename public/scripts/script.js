// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────
//  API HELPER
// ─────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const userId = localStorage.getItem('userId');
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
  } catch (err) {
    console.error(`API error [${path}]:`, err);
    throw err;
  }
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────

window.onload = async () => {
  checkLoginStatus();

  if (localStorage.getItem('loggedIn') !== 'true') return;

  const fragment    = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const tokenType   = fragment.get('token_type');

  if (!accessToken) return;

  try {
    // Get Discord user info
    const discordUser = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenType} ${accessToken}` },
    }).then(res => res.json());

    document.getElementById('welcome').innerText =
      `Welcome ${discordUser.username}, to Ultimate CAD!`;

    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('servers-page').classList.remove('hidden');

    // Register or retrieve user from our DB
    await syncUser(discordUser.id, discordUser.username);

    // Load servers the user's Discord guilds match
    const guilds = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { authorization: `${tokenType} ${accessToken}` },
    }).then(res => res.json());

    await loadServerList(guilds);

  } catch (err) {
    console.error('Login flow error:', err);
  }
};

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────

function checkLoginStatus() {
  const isLoggedIn = !!localStorage.getItem('userId');
  localStorage.setItem('loggedIn', isLoggedIn ? 'true' : 'false');
  document.getElementById('login-page').classList.toggle('hidden', isLoggedIn);
  document.getElementById('servers-page').classList.toggle('hidden', !isLoggedIn);
}

function discordLogin() {
  window.location.href = 'https://discord.com/oauth2/authorize?client_id=1403334739724861563&response_type=token&redirect_uri=http%3A%2F%2F127.0.0.1%3A5500%2Fpublic/dashboard.html&scope=identify+guilds';
}

function logOut() {
  localStorage.removeItem('userId');
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('discordID');
  localStorage.removeItem('serverId');
  checkLoginStatus();
}

// ─────────────────────────────────────────────
//  USER SYNC
// ─────────────────────────────────────────────

async function syncUser(discordId, username) {
  try {
    const user = await apiFetch(`/users/getUserByDiscordId/${discordId}`);
    localStorage.setItem('userId', user.iduser);
    localStorage.setItem('discordID', discordId);
  } catch (err) {
    if (err.message.includes('404') || err.message.includes('not found')) {
      try {
        const newUsers = await apiFetch('/users/register', {
          method: 'POST',
          body: JSON.stringify({ discordId, username }),
        });
        localStorage.setItem('userId', newUsers[0].iduser);
        localStorage.setItem('discordID', discordId);
      } catch (regErr) {
        console.error('Registration error:', regErr);
      }
    }
  }
}

// ─────────────────────────────────────────────
//  SERVER LIST
// ─────────────────────────────────────────────

async function loadServerList(guilds) {
  const body = document.getElementById('server-list');
  body.innerHTML = '';

  for (const guild of guilds) {
    try {
      const servers = await apiFetch(`/servers/check/${guild.id}`);
      if (servers && servers.length > 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${servers[0].idserver}</td>
          <td>${servers[0].name}</td>
        `;
        body.appendChild(row);
      }
    } catch (_) {
      // Guild not registered — skip silently
    }
  }
}

document.getElementById('server-list').addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (row && row.cells.length >= 2) joinServer(row);
});

async function joinServer(row) {
  const selectedServerId = row.cells[0].innerText;
  const userId = localStorage.getItem('userId');

  if (!userId) {
    alert('You must be logged in to join a server.');
    return;
  }

  try {
    const membership = await apiFetch(`/servers/members/${selectedServerId}/${userId}`);
    localStorage.setItem('serverId', selectedServerId);
    localStorage.setItem('serverName', row.cells[1].innerText);

    if (membership && membership.length > 0) {
      window.location.href = `html/server.html?serverId=${selectedServerId}&userId=${userId}`;
    } else {
      document.getElementById('join-popup').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error joining server:', err);
  }
}

// ─────────────────────────────────────────────
//  JOIN CODE POPUP
// ─────────────────────────────────────────────

function closeJoinPopup() {
  document.getElementById('join-popup').classList.add('hidden');
  document.getElementById('join-code').value = '';
}

async function serverJoin() {
  const joinCode = document.getElementById('join-code').value.trim();
  if (!joinCode) {
    alert('Please enter a join code.');
    return;
  }

  const selectedServerId = localStorage.getItem('serverId');
  const userId = localStorage.getItem('userId');

  if (!selectedServerId) {
    alert('No server selected.');
    return;
  }

  try {
    const codeData = await apiFetch(`/servers/join-code/${selectedServerId}`);
    if (!codeData || codeData.code !== joinCode) {
      alert('Invalid join code. Please try again.');
      return;
    }
    await apiFetch('/servers/members', {
      method: 'POST',
      body: JSON.stringify({ userId, serverId: selectedServerId }),
    });
    closeJoinPopup();
    window.location.href = `html/server.html?serverId=${selectedServerId}&userId=${userId}`;
  } catch (err) {
    console.error('Error verifying join code:', err);
    alert('Something went wrong. Please try again.');
  }
}