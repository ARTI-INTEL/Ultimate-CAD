/**
 * settings.js  Ultimate CAD Account Settings Page
 * Loads server memberships from the API rather than localStorage.
 * Leave server calls DELETE /servers/:id/leave (with email verification).
 */

(function () {
  'use strict';

  const API_BASE = '';

  function get(key)      { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function set(key, val) { try { localStorage.setItem(key, val);   } catch (_) {} }
  function remove(key)   { try { localStorage.removeItem(key);     } catch (_) {} }

  const userId    = get('cad_user_id');
  const username  = get('cad_username') || 'Unknown User';
  const discordId = get('cad_discord_id') || '';

  if (!userId) { window.location.href = 'index.html'; return; }

  /* ── API helper ──────────────────────────────────────────── */
  function apiFetch(url, opts) {
    return fetch(API_BASE + url, Object.assign({
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
    }, opts || {}))
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'API error'); });
        return r.json();
      });
  }

  /* ── Element refs ────────────────────────────────────────── */
  const navTitle        = document.getElementById('st-nav-title');
  const btnDashboard    = document.getElementById('btn-dashboard');

  const cellUsername    = document.getElementById('cell-username');
  const cellRole        = document.getElementById('cell-role');
  const cellServerCount = document.getElementById('cell-server-count');
  const cellJoinDate    = document.getElementById('cell-join-date');
  const cellDiscordId   = document.getElementById('cell-discord-id');

  const inputUsername   = document.getElementById('input-username');
  const inputEmail      = document.getElementById('input-email');
  const inputDiscordId  = document.getElementById('input-discord-id');
  const inputJoinDate   = document.getElementById('input-join-date');
  const btnSave         = document.getElementById('btn-save-account');
  const errorMsg        = document.getElementById('account-error');
  const successMsg      = document.getElementById('account-success');

  const serversList     = document.getElementById('servers-list');
  const btnLeaveAll     = document.getElementById('btn-leave-all');
  const btnDeleteAcct   = document.getElementById('btn-delete-account');

  /* ── Confirm modal ───────────────────────────────────────── */
  const modalConfirm    = document.getElementById('modal-confirm');
  const confirmTitle    = document.getElementById('confirm-title');
  const confirmDesc     = document.getElementById('confirm-desc');
  const btnConfirmYes   = document.getElementById('btn-confirm-yes');
  const btnConfirmNo    = document.getElementById('btn-confirm-no');
  const btnConfirmClose = document.getElementById('btn-confirm-close');
  let pendingConfirmAction = null;

  /* ── Verification modal ──────────────────────────────────── */
  const modalVerify       = document.getElementById('modal-verify');
  const verifyModalTitle  = document.getElementById('verify-modal-title');
  const verifyStep1       = document.getElementById('verify-step-1');
  const verifyStep1Error  = document.getElementById('verify-step-1-error');
  const verifyStep2       = document.getElementById('verify-step-2');
  const verifyStep2Desc   = document.getElementById('verify-step-2-desc');
  const verifyStep2Error  = document.getElementById('verify-step-2-error');
  const inputVerifyCode   = document.getElementById('input-verify-code');
  const btnSendCode       = document.getElementById('btn-send-code');
  const btnSubmitCode     = document.getElementById('btn-submit-verify-code');
  const btnVerifyClose    = document.getElementById('btn-verify-close');
  const btnVerifyCancel1  = document.getElementById('btn-verify-cancel-1');
  const btnVerifyCancel2  = document.getElementById('btn-verify-cancel-2');

  let pendingVerifyAction   = null;
  let pendingVerifyCallback = null;

  // Track server data for leave-all
  let serverData = [];

  /* ── Utility ─────────────────────────────────────────────── */
  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Navbar ──────────────────────────────────────────────── */
  navTitle.textContent = 'Welcome to Ultimate CAD, ' + username;

  /* ── Populate info row ───────────────────────────────────── */
  function populateInfoRow(user) {
    cellUsername.textContent  = user.username || username;
    cellRole.textContent      = 'Member';
    cellDiscordId.textContent = user.discord_id || discordId;
    cellJoinDate.textContent  = formatDate(user.created_at);
  }

  /* ── Load user from API ──────────────────────────────────── */
  (function loadUser() {
    const localUser = { username, discord_id: discordId, created_at: get('cad_join_date') };
    populateInfoRow(localUser);
    inputUsername.value  = localUser.username;
    inputDiscordId.value = localUser.discord_id;
    inputJoinDate.value  = formatDate(localUser.created_at);

    apiFetch('/users/me')
      .then(function (user) {
        if (!user) return;
        populateInfoRow(Object.assign({}, localUser, user));
        inputDiscordId.value = user.discord_id || discordId;
        inputJoinDate.value  = formatDate(user.created_at);
        if (user.email) inputEmail.value = user.email;
        if (user.created_at) set('cad_join_date', user.created_at);
      })
      .catch(function () {});
  })();

  /* ── Load server memberships from API ────────────────────── */
  function loadServers() {
    serversList.innerHTML = '<div class="st-empty-servers" style="color:rgba(255,255,255,0.3);">Loading…</div>';

    apiFetch('/servers/my-servers/' + encodeURIComponent(userId))
      .then(function (rows) {
        serverData = rows || [];
        renderServers(serverData);
        cellServerCount.textContent = serverData.length;
      })
      .catch(function () {
        // Fallback to localStorage if API is unavailable
        try { serverData = JSON.parse(localStorage.getItem('cad_servers') || '[]'); } catch (_) { serverData = []; }
        renderServers(serverData);
        cellServerCount.textContent = serverData.length;
      });
  }

  loadServers();

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
      const row       = document.createElement('div');
      row.className   = 'st-srv-row';
      row.style.animationDelay = (idx * 40) + 'ms';

      // Normalize field names from API response
      const srvId     = srv.id || srv.idserver;
      const srvName   = srv.name || '';
      const srvRole   = srv.role || 'Member';
      const joinedAt  = srv.joined_at || srv.joinedAt || null;
      const roleLower = srvRole.toLowerCase();

      const badgeClass = roleLower === 'owner' ? 'st-role-badge--owner'
                       : roleLower === 'admin'  ? 'st-role-badge--admin'
                       : 'st-role-badge--member';

      // Owners can't leave their own server
      const leaveBtn = roleLower === 'owner'
        ? '<span style="font-size:0.875rem;color:rgba(255,255,255,0.3);font-weight:600;">Owner</span>'
        : '<button class="st-leave-btn" data-server-id="' + esc(String(srvId)) + '" data-server-name="' + esc(srvName) + '">Leave</button>';

      row.innerHTML = [
        '<span class="st-srv-cell" style="--col-w:30rem">'                         + esc(srvName)              + '</span>',
        '<span class="st-srv-cell st-srv-cell--members" style="--col-w:12.5rem">'  + ''                        + '</span>',
        '<span class="st-srv-cell st-srv-cell--role" style="--col-w:12.5rem">',
          '<span class="st-role-badge ' + badgeClass + '">' + esc(srvRole) + '</span>',
        '</span>',
        '<span class="st-srv-cell st-srv-cell--date" style="--col-w:15rem">' + formatDate(joinedAt) + '</span>',
        '<span class="st-srv-cell" style="--col-w:10rem">' + leaveBtn + '</span>',
      ].join('');

      serversList.appendChild(row);
    });
  }

  /* ── Event delegation: leave server buttons ──────────────── */
  serversList.addEventListener('click', function (e) {
    const btn = e.target.closest('.st-leave-btn');
    if (!btn) return;
    const serverName = btn.getAttribute('data-server-name');
    const srvId      = btn.getAttribute('data-server-id');

    startVerification(
      'Leave "' + serverName + '"?',
      'leave_server_' + srvId,
      function () { doLeaveServer(srvId, serverName); }
    );
  });

  function doLeaveServer(srvId, serverName) {
    apiFetch('/servers/' + srvId + '/leave', { method: 'DELETE' })
      .then(function () {
        serverData = serverData.filter(function (s) {
          return String(s.id || s.idserver) !== String(srvId);
        });
        renderServers(serverData);
        cellServerCount.textContent = serverData.length;
      })
      .catch(function (err) {
        alert('Could not leave server: ' + err.message);
        // Still refresh the list from the server
        loadServers();
      });
  }

  /* ── Save username + email ───────────────────────────────── */
  btnSave.addEventListener('click', function () {
    errorMsg.textContent   = '';
    successMsg.textContent = '';

    const newName  = inputUsername.value.trim();
    const newEmail = inputEmail ? inputEmail.value.trim() : '';

    if (!newName) { errorMsg.textContent = 'Username cannot be empty.'; return; }
    if (newName.length < 2 || newName.length > 32) { errorMsg.textContent = 'Username must be 2–32 characters.'; return; }
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { errorMsg.textContent = 'Invalid email format.'; return; }

    btnSave.classList.add('st-loading');
    btnSave.textContent = 'Saving…';

    set('cad_username', newName);
    navTitle.textContent     = 'Welcome to Ultimate CAD, ' + newName;
    cellUsername.textContent = newName;

    const saves = [
      apiFetch('/users/update', {
        method: 'PATCH',
        body: JSON.stringify({ username: newName }),
      }).catch(function () {}),
    ];

    if (newEmail) {
      saves.push(
        apiFetch('/users/email', {
          method: 'PATCH',
          body: JSON.stringify({ email: newEmail }),
        }).catch(function () {})
      );
    }

    Promise.all(saves).then(function () {
      btnSave.classList.remove('st-loading');
      btnSave.textContent    = 'Save Changes';
      successMsg.textContent = 'Settings saved.';
      setTimeout(function () { successMsg.textContent = ''; }, 3000);
    });
  });

  /* ── Dashboard navigation ────────────────────────────────── */
  btnDashboard.addEventListener('click', function () { window.location.href = 'dashboard.html'; });

  /* ── Danger zone ─────────────────────────────────────────── */
  btnLeaveAll.addEventListener('click', function () {
    const leavable = serverData.filter(function (s) {
      return (s.role || '').toLowerCase() !== 'owner';
    });
    if (!leavable.length) {
      alert('You have no servers to leave (you are the owner of all your servers).');
      return;
    }
    startVerification(
      'Leave All Servers?',
      'leave_all_servers',
      function () {
        Promise.all(leavable.map(function (s) {
          return apiFetch('/servers/' + (s.id || s.idserver) + '/leave', { method: 'DELETE' }).catch(function () {});
        })).then(function () { loadServers(); });
      }
    );
  });

  btnDeleteAcct.addEventListener('click', function () {
    startVerification(
      'Delete Your Account?',
      'delete_account',
      function () {
        ['cad_username','cad_user_id','cad_discord_id','cad_servers',
         'cad_active_server','cad_active_server_name','cad_officer_id',
         'cad_officer_dept','cad_join_date'].forEach(remove);
        window.location.href = 'index.html';
      }
    );
  });

  /* ── Verification modal logic ────────────────────────────── */
  function startVerification(title, action, callback) {
    pendingVerifyAction   = action;
    pendingVerifyCallback = callback;
    verifyModalTitle.textContent = title;
    verifyStep1.style.display    = '';
    verifyStep2.style.display    = 'none';
    verifyStep1Error.textContent = '';
    verifyStep2Error.textContent = '';
    inputVerifyCode.value        = '';
    modalVerify.classList.add('open');
  }

  function closeVerifyModal() {
    modalVerify.classList.remove('open');
    pendingVerifyAction   = null;
    pendingVerifyCallback = null;
  }

  btnSendCode.addEventListener('click', function () {
    verifyStep1Error.textContent = '';
    btnSendCode.textContent = 'Sending…';
    btnSendCode.disabled    = true;

    apiFetch('/verification/send', {
      method: 'POST',
      body: JSON.stringify({ action: pendingVerifyAction }),
    })
      .then(function (data) {
        verifyStep2Desc.textContent = 'Enter the 6-digit code sent to ' + data.maskedEmail + ':';
        verifyStep1.style.display   = 'none';
        verifyStep2.style.display   = '';
        inputVerifyCode.focus();
      })
      .catch(function (err) {
        verifyStep1Error.textContent = err.message;
      })
      .finally(function () {
        btnSendCode.textContent = 'Send Code';
        btnSendCode.disabled    = false;
      });
  });

  btnSubmitCode.addEventListener('click', function () {
    const code = inputVerifyCode.value.trim();
    verifyStep2Error.textContent = '';
    if (!code || code.length !== 6) { verifyStep2Error.textContent = 'Enter the 6-digit code.'; return; }

    btnSubmitCode.textContent = 'Verifying…';
    btnSubmitCode.disabled    = true;

    apiFetch('/verification/verify', {
      method: 'POST',
      body: JSON.stringify({ code, action: pendingVerifyAction }),
    })
      .then(function () {
        const cb = pendingVerifyCallback;
        closeVerifyModal();
        if (typeof cb === 'function') cb();
      })
      .catch(function (err) {
        verifyStep2Error.textContent = err.message;
      })
      .finally(function () {
        btnSubmitCode.textContent = 'Confirm';
        btnSubmitCode.disabled    = false;
      });
  });

  [btnVerifyClose, btnVerifyCancel1, btnVerifyCancel2].forEach(function (btn) {
    if (btn) btn.addEventListener('click', closeVerifyModal);
  });

  modalVerify.addEventListener('click', function (e) {
    if (e.target === modalVerify) closeVerifyModal();
  });

  /* ── Confirm modal ───────────────────────────────────────── */
  function openConfirm(title, desc, onConfirm) {
    confirmTitle.textContent = title;
    confirmDesc.textContent  = desc;
    pendingConfirmAction     = onConfirm;
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
  modalConfirm.addEventListener('click', function (e) { if (e.target === modalConfirm) closeConfirm(); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeVerifyModal();
    closeConfirm();
  });

})();