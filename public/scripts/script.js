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
  const fragment    = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const tokenType   = fragment.get('token_type');

  if (accessToken) {
    await handleDiscordCallback(accessToken, tokenType);
    return;
  }

  // If already logged in and on index/login page, redirect to dashboard
  const userId = localStorage.getItem('userId');
  if (userId && window.location.pathname.endsWith('index.html') || 
      userId && window.location.pathname === '/') {
    window.location.href = 'dashboard.html';
    return;
  }

  checkLoginStatus();
};
// ─────────────────────────────────────────────
//  DISCORD OAUTH CALLBACK
// ─────────────────────────────────────────────

async function handleDiscordCallback(accessToken, tokenType) {
  try {
    const discordUser = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenType} ${accessToken}` },
    }).then(res => res.json());

    await syncUser(discordUser.id, discordUser.username);

    const guilds = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { authorization: `${tokenType} ${accessToken}` },
    }).then(res => res.json());

    // Save everything we need for refresh
    localStorage.setItem('username', discordUser.username);
    localStorage.setItem('guilds', JSON.stringify(guilds));

    cachedGuilds = guilds;
    togglePage(false);

    const welcomeEl = document.getElementById('welcome');
    if (welcomeEl) welcomeEl.innerText = `Welcome ${discordUser.username}, to Ultimate CAD!`;

    await loadServerList(guilds);
    history.replaceState(null, '', window.location.pathname);

  } catch (err) {
    console.error('Discord OAuth callback error:', err);
    togglePage(true);
  }
}

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────

function togglePage(showLogin) {
  const loginPage   = document.getElementById('login-page');
  const serversPage = document.getElementById('servers-page');
  if (loginPage)   loginPage.classList.toggle('hidden', !showLogin);
  if (serversPage) serversPage.classList.toggle('hidden', showLogin);
}

async function checkLoginStatus() {
  const userId   = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const guilds   = JSON.parse(localStorage.getItem('guilds') || '[]');

  if (!userId) {
    togglePage(true);
    return;
  }

  togglePage(false);
  cachedGuilds = guilds;

  const welcomeEl = document.getElementById('welcome');
  if (welcomeEl) welcomeEl.innerText = `Welcome ${username || ''}, to Ultimate CAD!`;

  await loadServerList(guilds);
}

function discordLogin() {
  window.location.href = 'https://discord.com/oauth2/authorize?client_id=1403334739724861563&response_type=token&redirect_uri=http%3A%2F%2F127.0.0.1%3A5500%2Fpublic%2Fdashboard.html&scope=identify+guilds';
}

function logOut() {
  localStorage.removeItem('userId');
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('discordID');
  localStorage.removeItem('serverId');
  localStorage.removeItem('username');
  localStorage.removeItem('guilds');
  checkLoginStatus();
}

// ─────────────────────────────────────────────
//  USER SYNC
// ─────────────────────────────────────────────

async function syncUser(discordId, username) {
  try {
    // Try to find existing user first
    const user = await apiFetch(`/users/getUserByDiscordId/${discordId}`);
    localStorage.setItem('userId', user.iduser);
    localStorage.setItem('discordID', discordId);
    console.log('Existing user loaded:', user.iduser);
  } catch (err) {
    // 404 = new user, register them
    try {
      const newUsers = await apiFetch('/users/register', {
        method: 'POST',
        body: JSON.stringify({ discordId, username }),
      });
      localStorage.setItem('userId', newUsers[0].iduser);
      localStorage.setItem('discordID', discordId);
      console.log('New user registered:', newUsers[0].iduser);
    } catch (regErr) {
      console.error('Registration failed:', regErr);
      throw regErr;
    }
  }
}

// ─────────────────────────────────────────────
//  SERVER LIST
// ─────────────────────────────────────────────

async function loadServerList(guilds) {
  const body = document.getElementById('server-list');
  if (!body) return;

  body.innerHTML = '';

  const userId = localStorage.getItem('userId');

  try {
    const servers = await apiFetch(`/servers/my-servers/${userId}`);
    servers.forEach(server => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${server.idserver}</td>
        <td>${server.name}</td>
      `;
      body.appendChild(row);
    });

    if (servers.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="2" style="text-align:center; color:#888;">No servers yet — create or join one!</td>`;
      body.appendChild(row);
    }
  } catch (err) {
    console.error('Failed to load server list:', err);
  }
}

// Click a server row to join
const serverListEl = document.getElementById('server-list');
if (serverListEl) {
  serverListEl.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (row && row.cells.length >= 2) joinServer(row);
  });
}

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
      window.location.href = `server.html?serverId=${selectedServerId}&userId=${userId}`;
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
    window.location.href = `server.html?serverId=${selectedServerId}&userId=${userId}`;
  } catch (err) {
    console.error('Error verifying join code:', err);
    alert('Something went wrong. Please try again.');
  }
}

// ─────────────────────────────────────────────
//  CREATE SERVER
// ─────────────────────────────────────────────

let cachedGuilds = []; // store guilds from OAuth for the dropdown
let discordLinkMode = 'pick'; // 'pick' or 'manual'

function openCreateServerPopup() {
  document.getElementById('create-server-popup').classList.remove('hidden');
  populateGuildDropdown();
}

function closeCreateServerPopup() {
  document.getElementById('create-server-popup').classList.add('hidden');
  document.getElementById('cs-error').textContent = '';
}

function setDiscordMode(mode) {
  discordLinkMode = mode;
  document.getElementById('discord-pick-section').classList.toggle('hidden', mode !== 'pick');
  document.getElementById('discord-manual-section').classList.toggle('hidden', mode !== 'manual');
}

function populateGuildDropdown() {
  const select = document.getElementById('cs-guild-select');
  select.innerHTML = '<option value="">— Select a Discord server —</option>';
  cachedGuilds.forEach(guild => {
    const opt = document.createElement('option');
    opt.value = guild.id;
    opt.textContent = guild.name;
    select.appendChild(opt);
  });
}

async function submitCreateServer() {
  const name        = document.getElementById('cs-name').value.trim();
  const description = document.getElementById('cs-description').value.trim();
  const iconUrl     = document.getElementById('cs-icon').value.trim();
  const joinCode    = document.getElementById('cs-joincode').value.trim();
  const errorEl     = document.getElementById('cs-error');

  let discordId = null;
  if (discordLinkMode === 'pick') {
    discordId = document.getElementById('cs-guild-select').value || null;
  } else {
    discordId = document.getElementById('cs-discord-id').value.trim() || null;
  }

  if (!name) {
    errorEl.textContent = 'Server name is required.';
    return;
  }

  try {
    const server = await apiFetch('/servers/create', {
      method: 'POST',
      body: JSON.stringify({ name, description, iconUrl, joinCode, discordId }),
    });
    closeCreateServerPopup();
    // Add the new server to the table immediately
    const body = document.getElementById('server-list');
    const row = document.createElement('tr');
    row.innerHTML = `<td>${server.idserver}</td><td>${server.name}</td>`;
    body.appendChild(row);
    alert(`Server "${server.name}" created! Join code: ${server.join_code}`);
  } catch (err) {
    errorEl.textContent = err.message || 'Failed to create server.';
  }
}