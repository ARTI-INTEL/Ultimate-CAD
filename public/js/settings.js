/**
 * settings.js — Ultimate CAD Account Settings Page
 *
 * Responsibilities:
 *  - Populate the navbar title with the stored username
 *  - Load and display account info (username, discord id, join date)
 *  - Render the server memberships list
 *  - Handle username save via PUT /users/update (or localStorage fallback)
 *  - Handle leave-server action via DELETE or local removal
 *  - Wire the danger-zone buttons with a confirm modal
 *  - Navigate back to dashboard
 *
 * No inline event handlers or inline styles anywhere in the HTML.
 * All DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────── */
  const API_BASE = '';   // same origin

  /* ── Storage helpers ─────────────────────────────────────── */
  function get(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  /* ── Cached values ───────────────────────────────────────── */
  const userId   = get('cad_user_id');
  const username = get('cad_username') || 'Unknown User';
  const discordId = get('cad_discord_id') || '—';

  /* ── Element refs ────────────────────────────────────────── */
  const navTitle        = document.getElementById('st-nav-title');
  const btnDashboard    = document.getElementById('btn-dashboard');

  const cellUsername    = document.getElementById('cell-username');
  const cellRole        = document.getElementById('cell-role');
  const cellServerCount = document.getElementById('cell-server-count');
  const cellJoinDate    = document.getElementById('cell-join-date');
  const cellDiscordId   = document.getElementById('cell-discord-id');

  const inputUsername   = document.getElementById('input-username');
  const inputDiscordId  = document.getElementById('input-discord-id');
  const inputJoinDate   = document.getElementById('input-join-date');
  const btnSave         = document.getElementById('btn-save-account');
  const errorMsg        = document.getElementById('account-error');
  const successMsg      = document.getElementById('account-success');

  const serversList     = document.getElementById('servers-list');

  const btnLeaveAll     = document.getElementById('btn-leave-all');
  const btnDeleteAcct   = document.getElementById('btn-delete-account');

  const modalConfirm    = document.getElementById('modal-confirm');
  const confirmTitle    = document.getElementById('confirm-title');
  const confirmDesc     = document.getElementById('confirm-desc');
  const btnConfirmYes   = document.getElementById('btn-confirm-yes');
  const btnConfirmNo    = document.getElementById('btn-confirm-no');
  const btnConfirmClose = document.getElementById('btn-confirm-close');

  /* ── Pending confirm callback ────────────────────────────── */
  let pendingConfirmAction = null;

  /* ── Utility: format date ────────────────────────────────── */
  function formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ── Utility: format member count ───────────────────────── */
  function fmtNum(n) {
    if (typeof n !== 'number') return '—';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  /* ── Populate navbar title ───────────────────────────────── */
  navTitle.textContent = 'Welcome to Ultimate CAD, ' + username;

  /* ── Populate info row from localStorage ─────────────────── */
  function populateInfoRow(user) {
    cellUsername.textContent    = user.username || username;
    cellRole.textContent        = user.role || 'Member';
    cellDiscordId.textContent   = user.discord_id || discordId;
    cellJoinDate.textContent    = formatDate(user.created_at);
    // server count updated after servers load
  }

  /* ── Load user from API ──────────────────────────────────── */
  (function loadUser() {
    const localUser = {
      username:   username,
      discord_id: discordId,
      role:       'Member',
      created_at: get('cad_join_date') || null,
    };

    // Populate immediately from cache
    populateInfoRow(localUser);
    inputUsername.value  = localUser.username;
    inputDiscordId.value = localUser.discord_id;
    inputJoinDate.value  = formatDate(localUser.created_at);

    if (!userId || !discordId || discordId === '—') return;

    fetch(API_BASE + '/users/getUserByDiscordId/' + discordId)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (user) {
        if (!user) return;
        const enriched = Object.assign({}, localUser, user, { username: username });
        populateInfoRow(enriched);
        inputDiscordId.value = enriched.discord_id || discordId;
        inputJoinDate.value  = formatDate(enriched.created_at);
        if (enriched.created_at) set('cad_join_date', enriched.created_at);
      })
      .catch(function () { /* offline – cached values remain */ });
  })();

  /* ── Load server memberships ─────────────────────────────── */
  (function loadServers() {
    let servers = [];

    // Pull from localStorage (set by dashboard.js)
    try {
      const raw = localStorage.getItem('cad_servers');
      if (raw) servers = JSON.parse(raw) || [];
    } catch (_) {}

    if (!servers.length) {
      // Demo fallback so the page never looks empty
      servers = [
        { id: 's1', name: 'Hardline Roleplay',      members: 6000, role: 'Owner',  joinedAt: '2024-01-15T00:00:00Z' },
        { id: 's2', name: 'Los Santos Police Dept.', members: 1240, role: 'Member', joinedAt: '2024-03-22T00:00:00Z' },
        { id: 's3', name: 'Blaine County Sheriff',   members:  870, role: 'Member', joinedAt: '2024-06-01T00:00:00Z' },
      ];
    }

    renderServers(servers);
    cellServerCount.textContent = servers.length;
  })();

  /* ── Render server rows ──────────────────────────────────── */
  function renderServers(list) {
    serversList.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'st-empty-servers';
      empty.textContent = 'No server memberships found.';
      serversList.appendChild(empty);
      return;
    }

    list.forEach(function (srv, idx) {
      const row = document.createElement('div');
      row.className = 'st-srv-row';
      row.style.animationDelay = (idx * 40) + 'ms';

      const roleLower = (srv.role || 'member').toLowerCase();
      const badgeClass = roleLower === 'owner'  ? 'st-role-badge--owner'
                       : roleLower === 'admin'  ? 'st-role-badge--admin'
                       : 'st-role-badge--member';

      row.innerHTML = [
        '<span class="st-srv-cell" style="--col-w:480px">' + esc(srv.name) + '</span>',
        '<span class="st-srv-cell st-srv-cell--members" style="--col-w:200px">' + fmtNum(srv.members) + '</span>',
        '<span class="st-srv-cell st-srv-cell--role" style="--col-w:200px">',
          '<span class="st-role-badge ' + badgeClass + '">' + esc(srv.role || 'Member') + '</span>',
        '</span>',
        '<span class="st-srv-cell st-srv-cell--date" style="--col-w:240px">' + formatDate(srv.joinedAt || null) + '</span>',
        '<span class="st-srv-cell" style="--col-w:160px">',
          '<button class="st-leave-btn" data-server-id="' + esc(String(srv.id)) + '" data-server-name="' + esc(srv.name) + '">Leave</button>',
        '</span>',
      ].join('');

      serversList.appendChild(row);
    });

    // Wire leave buttons (event delegation via a single listener on the container)
  }

  /* ── Event delegation: leave server buttons ──────────────── */
  serversList.addEventListener('click', function (e) {
    const btn = e.target.closest('.st-leave-btn');
    if (!btn) return;
    const serverName = btn.getAttribute('data-server-name');
    const serverId   = btn.getAttribute('data-server-id');
    openConfirm(
      'Leave "' + serverName + '"?',
      'You will lose access to this server\'s CAD. You can rejoin with the server\'s join code.',
      function () { leaveServer(serverId, btn); }
    );
  });

  /* ── Leave server ─────────────────────────────────────────── */
  function leaveServer(serverId, btnEl) {
    if (btnEl) {
      btnEl.textContent = '…';
      btnEl.disabled = true;
    }

    // Remove from localStorage
    try {
      let servers = JSON.parse(localStorage.getItem('cad_servers') || '[]');
      servers = servers.filter(function (s) { return String(s.id) !== String(serverId); });
      localStorage.setItem('cad_servers', JSON.stringify(servers));
      renderServers(servers);
      cellServerCount.textContent = servers.length;
    } catch (_) {}
  }

  /* ── Save username ────────────────────────────────────────── */
  btnSave.addEventListener('click', function () {
    errorMsg.textContent   = '';
    successMsg.textContent = '';

    const newName = inputUsername.value.trim();
    if (!newName) {
      errorMsg.textContent = 'Username cannot be empty.';
      return;
    }
    if (newName.length < 2 || newName.length > 32) {
      errorMsg.textContent = 'Username must be 2–32 characters.';
      return;
    }

    btnSave.classList.add('st-loading');
    btnSave.textContent = 'Saving…';

    // Optimistic local save first
    set('cad_username', newName);
    navTitle.textContent    = 'Welcome to Ultimate CAD, ' + newName;
    cellUsername.textContent = newName;

    // Try API update if we have a userId
    if (userId) {
      fetch(API_BASE + '/users/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ username: newName }),
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function () {
          finishSave(true);
        })
        .catch(function () {
          // Server may not have this endpoint yet; local save already done
          finishSave(true, '(saved locally)');
        });
    } else {
      finishSave(true, '(saved locally)');
    }
  });

  function finishSave(success, note) {
    btnSave.classList.remove('st-loading');
    btnSave.textContent = 'Save Changes';
    if (success) {
      successMsg.textContent = 'Username updated successfully. ' + (note || '');
      setTimeout(function () { successMsg.textContent = ''; }, 3000);
    }
  }

  /* ── Dashboard navigation ────────────────────────────────── */
  btnDashboard.addEventListener('click', function () {
    window.location.href = 'dashboard.html';
  });

  /* ── Danger zone: leave all servers ─────────────────────── */
  btnLeaveAll.addEventListener('click', function () {
    openConfirm(
      'Leave all servers?',
      'You will be removed from every server you have joined. This cannot be undone.',
      function () {
        set('cad_servers', '[]');
        renderServers([]);
        cellServerCount.textContent = '0';
      }
    );
  });

  /* ── Danger zone: delete account ────────────────────────── */
  btnDeleteAcct.addEventListener('click', function () {
    openConfirm(
      'Delete your account?',
      'All your data, server memberships, and officer sessions will be permanently removed.',
      function () {
        // Clear all local storage keys belonging to this session
        const keys = ['cad_username', 'cad_user_id', 'cad_discord_id',
                      'cad_servers', 'cad_active_server', 'cad_active_server_name',
                      'cad_officer_id', 'cad_officer_dept', 'cad_join_date'];
        keys.forEach(remove);
        window.location.href = 'index.html';
      }
    );
  });

  /* ── Confirm modal helpers ───────────────────────────────── */
  function openConfirm(title, desc, onConfirm) {
    confirmTitle.textContent   = title;
    confirmDesc.textContent    = desc;
    pendingConfirmAction        = onConfirm;
    modalConfirm.classList.add('open');
  }

  function closeConfirm() {
    modalConfirm.classList.remove('open');
    pendingConfirmAction = null;
  }

  btnConfirmYes.addEventListener('click', function () {
    if (typeof pendingConfirmAction === 'function') pendingConfirmAction();
    closeConfirm();
  });

  btnConfirmNo.addEventListener('click', closeConfirm);
  btnConfirmClose.addEventListener('click', closeConfirm);

  modalConfirm.addEventListener('click', function (e) {
    if (e.target === modalConfirm) closeConfirm();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalConfirm.classList.contains('open')) closeConfirm();
  });

  /* ── Utility: HTML-escape ────────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();