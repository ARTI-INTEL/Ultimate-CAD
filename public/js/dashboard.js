/**
 * dashboard.js — Ultimate CAD Dashboard
 *
 * Responsibilities:
 *  - Populate the greeting with the stored username
 *  - Render the server list from localStorage (keyed 'cad_servers')
 *  - Live-filter the list via the search input
 *  - Open / close the Create Server modal
 *  - Validate and persist a new server on Create
 *  - Navigate to server-page.html when a row is clicked
 *
 * No inline styles or onclick attributes exist in the HTML.
 * All DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ── Storage helpers ────────────────────────────────────────── */

  const STORAGE_KEY = 'cad_servers';

  function loadServers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEMO_SERVERS;
    } catch (_) {
      return DEMO_SERVERS;
    }
  }

  function saveServers(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) { /* storage unavailable */ }
  }

  /* Demo data so the page never looks empty on first load */
  const DEMO_SERVERS = [
    { id: 's1', name: 'Hardline Roleplay',        members: 6000, owner: 'Detective_1990', role: 'Owner' },
    { id: 's2', name: 'Los Santos Police Dept.',   members: 1240, owner: 'ChiefOfficer22',  role: 'Member' },
    { id: 's3', name: 'Blaine County Sheriff',     members:  870, owner: 'SheriffHank',     role: 'Member' },
  ];

  /* ── Element references ─────────────────────────────────────── */
  const greeting       = document.getElementById('db-nav-greeting');
  const btnSettings    = document.getElementById('btn-settings');
  const searchInput    = document.getElementById('server-search');
  const serversList    = document.getElementById('servers-list');
  const btnCreate      = document.getElementById('btn-create-server');
  const modal          = document.getElementById('modal-create-server');
  const btnModalClose  = document.getElementById('btn-modal-close');
  const btnModalCreate = document.getElementById('btn-modal-create');
  const fieldName      = document.getElementById('field-server-name');
  const fieldCode      = document.getElementById('field-join-code');
  const fieldDesc      = document.getElementById('field-description');
  const fieldDiscord   = document.getElementById('field-discord-server');

  /* ── State ──────────────────────────────────────────────────── */
  let servers       = loadServers();
  let filterQuery   = '';

  /* ── Greeting ───────────────────────────────────────────────── */
  (function initGreeting() {
    const storedName = localStorage.getItem('cad_username');
    if (storedName) {
      greeting.textContent = 'Welcome to Ultimate CAD, ' + storedName;
    }
  })();

  /* ── Render helpers ─────────────────────────────────────────── */

  function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  function renderServers(list) {
    serversList.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'db-empty';
      empty.textContent = 'No servers found. Create one below!';
      serversList.appendChild(empty);
      return;
    }

    list.forEach(function (srv, idx) {
      const row = document.createElement('div');
      row.className = 'db-server-row';
      row.style.animationDelay = (idx * 45) + 'ms';
      row.dataset.serverId = srv.id;

      const nameEl = document.createElement('span');
      nameEl.className = 'db-server-name';
      nameEl.textContent = srv.name;

      const membersEl = document.createElement('span');
      membersEl.className = 'db-server-members';
      membersEl.textContent = formatNumber(srv.members);

      const ownerEl = document.createElement('span');
      ownerEl.className = 'db-server-owner';
      ownerEl.textContent = '(' + (srv.role || 'Member') + ') ' + srv.owner;

      row.appendChild(nameEl);
      row.appendChild(membersEl);
      row.appendChild(ownerEl);

      row.addEventListener('click', function () {
        /* Store active server for server-page to pick up */
        try {
          localStorage.setItem('cad_active_server', srv.id);
          localStorage.setItem('cad_active_server_name', srv.name);
        } catch (_) { /* ignore */ }
        window.location.href = 'server-page.html';
      });

      serversList.appendChild(row);
    });
  }

  function applyFilter() {
    const q = filterQuery.toLowerCase().trim();
    if (!q) {
      renderServers(servers);
      return;
    }
    const filtered = servers.filter(function (s) {
      return s.name.toLowerCase().includes(q) || s.owner.toLowerCase().includes(q);
    });
    renderServers(filtered);
  }

  /* Initial render */
  renderServers(servers);

  /* ── Search ─────────────────────────────────────────────────── */
  searchInput.addEventListener('input', function () {
    filterQuery = searchInput.value;
    applyFilter();
  });

  /* ── Settings nav ───────────────────────────────────────────── */
  btnSettings.addEventListener('click', function () {
    window.location.href = 'settings.html';
  });

  /* ── Modal: open / close ────────────────────────────────────── */
  function openModal() {
    modal.classList.add('active');
    /* Pre-generate a random join code */
    fieldCode.value = generateJoinCode();
    fieldName.focus();
  }

  function closeModal() {
    modal.classList.remove('active');
    clearModalFields();
    clearValidation();
  }

  btnCreate.addEventListener('click', openModal);
  btnModalClose.addEventListener('click', closeModal);

  /* Click outside the modal box to close */
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  /* Escape key */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  /* ── Modal: utilities ───────────────────────────────────────── */
  function generateJoinCode(len) {
    len = len || 8;
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < len; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function clearModalFields() {
    fieldName.value    = '';
    fieldCode.value    = '';
    fieldDesc.value    = '';
    fieldDiscord.value = '';
  }

  function clearValidation() {
    [fieldName, fieldCode, fieldDesc].forEach(function (el) {
      el.closest('.db-field').classList.remove('has-error');
    });
  }

  function setError(inputEl) {
    inputEl.closest('.db-field').classList.add('has-error');
  }

  /* ── Modal: populate Discord servers dropdown ───────────────── */
  (function populateDiscordDropdown() {
    /*
     * In production this would call the Discord OAuth guilds endpoint.
     * For now we use demo data or a stored list.
     */
    const stored = [];
    try {
      const raw = localStorage.getItem('cad_discord_guilds');
      if (raw) stored.push.apply(stored, JSON.parse(raw));
    } catch (_) { /* ignore */ }

    const demos = [
      { id: 'g1', name: 'Hardline Roleplay Discord' },
      { id: 'g2', name: 'LS Roleplay Community' },
    ];

    const list = stored.length ? stored : demos;
    list.forEach(function (g) {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      fieldDiscord.appendChild(opt);
    });
  })();

  /* ── Modal: create server ───────────────────────────────────── */
  btnModalCreate.addEventListener('click', function () {
    clearValidation();

    var name    = fieldName.value.trim();
    var code    = fieldCode.value.trim().toUpperCase() || generateJoinCode();
    var desc    = fieldDesc.value.trim();
    var discord = fieldDiscord.value;

    /* Validation */
    var valid = true;
    if (!name) { setError(fieldName); valid = false; }

    if (!valid) {
      fieldName.focus();
      return;
    }

    /* Build new server object */
    var newServer = {
      id:      's' + Date.now(),
      name:    name,
      code:    code,
      desc:    desc,
      discord: discord,
      members: 1,
      owner:   localStorage.getItem('cad_username') || 'You',
      role:    'Owner',
    };

    servers.unshift(newServer);
    saveServers(servers);

    /* Navigate straight to the new server */
    try {
      localStorage.setItem('cad_active_server', newServer.id);
      localStorage.setItem('cad_active_server_name', newServer.name);
    } catch (_) { /* ignore */ }

    closeModal();
    renderServers(servers);

    /* Brief highlight on the new row */
    var firstRow = serversList.querySelector('.db-server-row');
    if (firstRow) {
      firstRow.style.background = 'rgba(41, 84, 195, 0.25)';
      setTimeout(function () { firstRow.style.background = ''; }, 1200);
    }
  });

  /* ── Join-code auto-format: uppercase, alphanumeric only ─────── */
  fieldCode.addEventListener('input', function () {
    fieldCode.value = fieldCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

})();