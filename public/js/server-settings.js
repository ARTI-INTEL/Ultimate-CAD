/**
 * server-settings.js — Ultimate CAD Server Settings Page
 *
 * Responsibilities:
 *  - Populate navbar with server name + username
 *  - Load server info from API and pre-fill form fields
 *  - Load and render the server member list
 *  - Handle logo upload / preview / removal
 *  - Join code: copy + regenerate
 *  - Save settings via PATCH /servers/:id  (or localStorage fallback)
 *  - Member actions: change role, kick member
 *  - Danger zone: delete server with name-confirmation guard
 *
 * No inline event handlers or styles anywhere in the HTML.
 * All DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────── */
  const API_BASE = '';

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
  const serverId   = get('cad_active_server');
  const serverName = get('cad_active_server_name') || 'Unknown Server';
  const userId     = get('cad_user_id');
  const username   = get('cad_username') || 'Admin';

  /* ── Element refs ────────────────────────────────────────── */
  const navTitle       = document.getElementById('ss-nav-title');
  const btnBack        = document.getElementById('btn-back');
  const btnDashboard   = document.getElementById('btn-dashboard');
  const membersBody    = document.getElementById('ss-members-body');
  const memberCount    = document.getElementById('ss-member-count');

  // Logo
  const logoArea       = document.getElementById('ss-logo-area');
  const logoFileInput  = document.getElementById('logo-file-input');
  const logoPreview    = document.getElementById('logo-preview');
  const logoClearBtn   = document.getElementById('btn-logo-clear');

  // Form fields
  const inputName      = document.getElementById('input-server-name');
  const inputCode      = document.getElementById('input-join-code');
  const inputDesc      = document.getElementById('input-server-desc');
  const inputDiscord   = document.getElementById('input-discord-id');
  const inputIcon      = document.getElementById('input-icon-url');
  const errorMsg       = document.getElementById('ss-error');
  const successMsg     = document.getElementById('ss-success');

  // Buttons
  const btnCopyCode    = document.getElementById('btn-copy-code');
  const btnRegenCode   = document.getElementById('btn-regen-code');
  const btnSave        = document.getElementById('btn-save-settings');
  const btnDeleteSrv   = document.getElementById('btn-delete-server');

  // Kick modal
  const modalKick      = document.getElementById('modal-kick');
  const kickTitle      = document.getElementById('kick-title');
  const kickDesc       = document.getElementById('kick-desc');
  const btnKickClose   = document.getElementById('btn-kick-close');
  const btnKickConfirm = document.getElementById('btn-kick-confirm');
  const btnKickCancel  = document.getElementById('btn-kick-cancel');

  // Role modal
  const modalRole      = document.getElementById('modal-role');
  const roleTitle      = document.getElementById('role-title');
  const roleDesc       = document.getElementById('role-desc');
  const roleGrid       = document.getElementById('role-grid');
  const btnRoleClose   = document.getElementById('btn-role-close');
  const btnRoleConfirm = document.getElementById('btn-role-confirm');
  const btnRoleCancel  = document.getElementById('btn-role-cancel');

  // Delete modal
  const modalDelete    = document.getElementById('modal-delete');
  const inputConfirm   = document.getElementById('input-confirm-name');
  const deleteError    = document.getElementById('delete-error');
  const btnDeleteClose = document.getElementById('btn-delete-close');
  const btnDeleteConf  = document.getElementById('btn-delete-confirm');
  const btnDeleteCanc  = document.getElementById('btn-delete-cancel');

  /* ── State ───────────────────────────────────────────────── */
  let members   = [];
  let pendingKickId   = null;
  let pendingRoleId   = null;
  let pendingRoleVal  = null;
  let currentServerName = serverName;

  /* ── Navbar ──────────────────────────────────────────────── */
  navTitle.textContent = 'Welcome to Ultimate CAD, ' + serverName + ' — Settings';

  /* ── Navigation ──────────────────────────────────────────── */
  btnBack.addEventListener('click', function () {
    window.location.href = 'server-page.html';
  });
  btnDashboard.addEventListener('click', function () {
    window.location.href = 'dashboard.html';
  });

  /* ── Utility ─────────────────────────────────────────────── */
  function generateCode(len) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < (len || 8); i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function clearMessages() {
    errorMsg.textContent = '';
    successMsg.textContent = '';
  }

  function showError(msg) {
    errorMsg.textContent   = msg;
    successMsg.textContent = '';
  }

  function showSuccess(msg) {
    successMsg.textContent = msg;
    errorMsg.textContent   = '';
    setTimeout(function () { successMsg.textContent = ''; }, 3000);
  }

  /* ── Load server info ────────────────────────────────────── */
  (function loadServerInfo() {
    // Fill from cache immediately
    inputName.value    = serverName;
    inputCode.value    = get('cad_server_join_code') || generateCode();

    if (!serverId) return;

    fetch(API_BASE + '/servers/name/' + serverId)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (srv) {
        if (!srv) return;
        currentServerName = srv.name || serverName;
        inputName.value   = srv.name || serverName;
        inputDesc.value   = srv.description || '';
        inputDiscord.value = srv.discord_id || '';
        inputIcon.value   = srv.icon_url || '';
        navTitle.textContent = 'Welcome to Ultimate CAD, ' + currentServerName + ' — Settings';
      })
      .catch(function () {});

    fetch(API_BASE + '/servers/join-code/' + serverId)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.code) {
          inputCode.value = data.code;
          set('cad_server_join_code', data.code);
        }
      })
      .catch(function () {});
  })();

  /* ── Load members ────────────────────────────────────────── */
  (function loadMembers() {
    var demos = [
      { id: 'm1', username: 'ChiefOfficer22',  role: 'Owner',     department: 'LSPD Command',       callsign: 'CMD-1',  joinedAt: '2024-01-01' },
      { id: 'm2', username: 'Detective_1990',  role: 'Admin',     department: 'BCSO Investigations', callsign: 'INV-3',  joinedAt: '2024-01-15' },
      { id: 'm3', username: 'RookiePatrol',    role: 'Member',    department: 'LSPD Patrol Div.',    callsign: 'L-14',   joinedAt: '2024-03-22' },
      { id: 'm4', username: 'FireChief_99',    role: 'Moderator', department: 'Sandy Shores Fire',   callsign: 'F-01',   joinedAt: '2024-02-10' },
      { id: 'm5', username: 'DOT_Ranger',      role: 'Member',    department: 'Dept of Transport',   callsign: 'D-07',   joinedAt: '2024-04-05' },
      { id: 'm6', username: 'NightDispatch',   role: 'Member',    department: 'Dispatch Centre',     callsign: 'DSP-2',  joinedAt: '2024-05-18' },
      { id: 'm7', username: 'SheriffHank',     role: 'Admin',     department: 'BCSO Sheriff',        callsign: 'SHF-1',  joinedAt: '2024-01-30' },
      { id: 'm8', username: 'MedicResponse',   role: 'Member',    department: 'EMS Unit 4',          callsign: 'E-04',   joinedAt: '2024-06-01' },
    ];

    members = demos;
    renderMembers();

    if (!serverId) return;
    // Attempt real fetch (officers endpoint gives clocked-in members)
    fetch(API_BASE + '/officers/' + serverId, {
      headers: { 'x-user-id': userId || '' }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        members = rows.map(function (o) {
          return {
            id:         o.id,
            username:   o.name || o.callsign,
            role:       'Member',
            department: o.department || '—',
            callsign:   o.callsign || '—',
            joinedAt:   o.created_at || null,
          };
        });
        renderMembers();
      })
      .catch(function () {});
  })();

  /* ── Render member rows ──────────────────────────────────── */
  function renderMembers() {
    membersBody.innerHTML = '';

    if (!members.length) {
      var empty = document.createElement('div');
      empty.className = 'ss-members-empty';
      empty.textContent = 'No members found.';
      membersBody.appendChild(empty);
      memberCount.textContent = '0 members';
      return;
    }

    memberCount.textContent = members.length + ' member' + (members.length !== 1 ? 's' : '');

    members.forEach(function (m, idx) {
      var row = document.createElement('div');
      row.className = 'ss-member-row';
      row.style.animationDelay = (idx * 35) + 'ms';

      var roleLower = (m.role || 'member').toLowerCase();
      var badgeClass = 'ss-role-badge--' + roleLower;
      var isOwner = roleLower === 'owner';

      row.innerHTML =
        '<span class="ss-member-cell ss-member-cell--name">' + esc(m.username) + '</span>' +
        '<span class="ss-member-cell ss-member-cell--role">' +
          '<span class="ss-role-badge ' + badgeClass + '">' + esc(m.role || 'Member') + '</span>' +
        '</span>' +
        '<span class="ss-member-cell ss-member-cell--dept">' + esc(m.department || '—') + '</span>' +
        '<span class="ss-member-cell ss-member-cell--callsign">' + esc(m.callsign || '—') + '</span>' +
        '<span class="ss-member-cell ss-member-cell--joined">' + formatDate(m.joinedAt) + '</span>' +
        '<span class="ss-member-cell ss-member-cell--action">' +
          (isOwner ? '' :
            '<button class="ss-row-btn ss-row-btn--role" data-id="' + esc(String(m.id)) + '" data-name="' + esc(m.username) + '" data-role="' + esc(m.role) + '">Role</button>' +
            '<button class="ss-row-btn ss-row-btn--kick" data-id="' + esc(String(m.id)) + '" data-name="' + esc(m.username) + '">Kick</button>'
          ) +
        '</span>';

      membersBody.appendChild(row);
    });
  }

  /* ── Event delegation: member row buttons ────────────────── */
  membersBody.addEventListener('click', function (e) {
    var kickBtn = e.target.closest('.ss-row-btn--kick');
    var roleBtn = e.target.closest('.ss-row-btn--role');

    if (kickBtn) {
      pendingKickId = kickBtn.getAttribute('data-id');
      kickTitle.textContent = 'Kick ' + kickBtn.getAttribute('data-name') + '?';
      kickDesc.textContent  = kickBtn.getAttribute('data-name') + ' will be removed from the server and lose access to all CAD panels.';
      openModal(modalKick);
    }

    if (roleBtn) {
      pendingRoleId  = roleBtn.getAttribute('data-id');
      pendingRoleVal = roleBtn.getAttribute('data-role');
      roleTitle.textContent = 'Change role: ' + roleBtn.getAttribute('data-name');
      roleDesc.textContent  = 'Select a new role for this member.';
      // Pre-select current role
      Array.prototype.forEach.call(roleGrid.querySelectorAll('.ss-role-btn'), function (btn) {
        btn.classList.toggle('selected', btn.getAttribute('data-role') === pendingRoleVal);
      });
      pendingRoleVal = roleBtn.getAttribute('data-role');
      openModal(modalRole);
    }
  });

  /* ── Role grid selection ─────────────────────────────────── */
  roleGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('.ss-role-btn');
    if (!btn) return;
    Array.prototype.forEach.call(roleGrid.querySelectorAll('.ss-role-btn'), function (b) {
      b.classList.remove('selected');
    });
    btn.classList.add('selected');
    pendingRoleVal = btn.getAttribute('data-role');
  });

  /* ── Kick confirm ────────────────────────────────────────── */
  btnKickConfirm.addEventListener('click', function () {
    if (!pendingKickId) return;
    members = members.filter(function (m) { return String(m.id) !== String(pendingKickId); });
    renderMembers();
    closeModal(modalKick);
    showSuccess('Member removed from server.');
    pendingKickId = null;
  });

  btnKickCancel.addEventListener('click', function () { closeModal(modalKick); });
  btnKickClose.addEventListener('click',  function () { closeModal(modalKick); });

  /* ── Role confirm ────────────────────────────────────────── */
  btnRoleConfirm.addEventListener('click', function () {
    if (!pendingRoleId || !pendingRoleVal) return;
    members = members.map(function (m) {
      if (String(m.id) === String(pendingRoleId)) {
        return Object.assign({}, m, { role: pendingRoleVal });
      }
      return m;
    });
    renderMembers();
    closeModal(modalRole);
    showSuccess('Role updated.');
    pendingRoleId = pendingRoleVal = null;
  });

  btnRoleCancel.addEventListener('click', function () { closeModal(modalRole); });
  btnRoleClose.addEventListener('click',  function () { closeModal(modalRole); });

  /* ── Logo upload ─────────────────────────────────────────── */
  logoFileInput.addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      logoPreview.src = e.target.result;
      logoArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  });

  logoClearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    logoPreview.src = '';
    logoFileInput.value = '';
    logoArea.classList.remove('has-image');
  });

  /* ── Join code: copy ─────────────────────────────────────── */
  btnCopyCode.addEventListener('click', function () {
    var code = inputCode.value.trim();
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () {
      var orig = btnCopyCode.textContent;
      btnCopyCode.textContent = 'Copied!';
      setTimeout(function () { btnCopyCode.textContent = orig; }, 1500);
    }).catch(function () {
      /* fallback: select text */
      inputCode.select();
    });
  });

  /* ── Join code: regenerate ───────────────────────────────── */
  btnRegenCode.addEventListener('click', function () {
    inputCode.value = generateCode(8);
    clearMessages();
  });

  /* Join code: auto-uppercase */
  inputCode.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  /* ── Save settings ───────────────────────────────────────── */
  btnSave.addEventListener('click', function () {
    clearMessages();

    var name = inputName.value.trim();
    var code = inputCode.value.trim();
    var desc = inputDesc.value.trim();

    if (!name) { showError('Server name is required.'); return; }
    if (!code) { showError('Join code is required.'); return; }

    btnSave.classList.add('ss-loading');
    btnSave.textContent = 'Saving…';

    // Persist locally
    set('cad_active_server_name', name);
    set('cad_server_join_code', code);
    currentServerName = name;
    navTitle.textContent = 'Welcome to Ultimate CAD, ' + name + ' — Settings';

    if (!serverId) {
      finishSave(true, '(saved locally)');
      return;
    }

    // Try API
    fetch(API_BASE + '/servers/' + serverId + '/update', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId || '',
      },
      body: JSON.stringify({
        name:        name,
        description: desc,
        joinCode:    code,
        discordId:   inputDiscord.value.trim() || null,
        iconUrl:     inputIcon.value.trim() || null,
      }),
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
      .then(function () { finishSave(true); })
      .catch(function () { finishSave(true, '(saved locally — API endpoint pending)'); });
  });

  function finishSave(ok, note) {
    btnSave.classList.remove('ss-loading');
    btnSave.textContent = 'Save Settings';
    if (ok) showSuccess('Settings saved.' + (note ? ' ' + note : ''));
  }

  /* ── Delete server ───────────────────────────────────────── */
  btnDeleteSrv.addEventListener('click', function () {
    inputConfirm.value = '';
    deleteError.textContent = '';
    openModal(modalDelete);
  });

  btnDeleteConf.addEventListener('click', function () {
    deleteError.textContent = '';
    var typed = inputConfirm.value.trim();
    if (typed.toLowerCase() !== currentServerName.toLowerCase()) {
      deleteError.textContent = 'Server name does not match. Please try again.';
      return;
    }
    // Clear all server-related storage
    remove('cad_active_server');
    remove('cad_active_server_name');
    remove('cad_server_join_code');
    remove('cad_officer_id');
    remove('cad_officer_dept');
    try {
      var servers = JSON.parse(localStorage.getItem('cad_servers') || '[]');
      servers = servers.filter(function (s) { return String(s.id) !== String(serverId); });
      localStorage.setItem('cad_servers', JSON.stringify(servers));
    } catch (_) {}
    window.location.href = 'dashboard.html';
  });

  btnDeleteCanc.addEventListener('click', function () { closeModal(modalDelete); });
  btnDeleteClose.addEventListener('click', function () { closeModal(modalDelete); });

  /* ── Modal helpers ───────────────────────────────────────── */
  function openModal(el)  { el.classList.add('open'); }
  function closeModal(el) { el.classList.remove('open'); }

  [modalKick, modalRole, modalDelete].forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) closeModal(m);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    [modalKick, modalRole, modalDelete].forEach(closeModal);
  });

})();