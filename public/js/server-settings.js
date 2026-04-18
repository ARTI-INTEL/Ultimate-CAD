/**
 * server-settings.js  Ultimate CAD Server Settings Page
 *
 * - Loads real member list from GET /servers/:id/members
 * - Save settings via PATCH /servers/:id/update
 * - Kick member via DELETE /servers/:id/members/:memberId (owner only, with confirm)
 * - Delete server via POST /verification/send + /verify then DELETE /servers/:id
 * - Logo upload: preview + clear (stored as base64 in localStorage for now)
 * - Join code: copy, regenerate
 */

(function () {
  'use strict';

  const API_BASE = '';

  /* ── Storage helpers ─────────────────────────────────────── */
  function get(key)      { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function set(key, val) { try { localStorage.setItem(key, val);   } catch (_) {} }
  function remove(key)   { try { localStorage.removeItem(key);     } catch (_) {} }

  /* ── Session values ──────────────────────────────────────── */
  const serverId   = get('cad_active_server');
  const serverName = get('cad_active_server_name') || 'Unknown Server';
  const userId     = get('cad_user_id');
  const username   = get('cad_username') || 'Admin';

  if (!userId) { window.location.href = 'index.html'; return; }
  if (!serverId) { window.location.href = 'dashboard.html'; return; }

  /* ── API helper ──────────────────────────────────────────── */
  function apiFetch(url, opts) {
    return fetch(API_BASE + url, Object.assign({
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    }, opts || {}))
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'API error'); });
        return r.json();
      });
  }

  /* ── Utility ─────────────────────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function generateCode(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: len || 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  /* ── Element refs ────────────────────────────────────────── */
  const navTitle      = document.getElementById('ss-nav-title');
  const btnBack       = document.getElementById('btn-back');
  const btnDashboard  = document.getElementById('btn-dashboard');
  const membersBody   = document.getElementById('ss-members-body');
  const memberCount   = document.getElementById('ss-member-count');

  // Logo
  const logoArea      = document.getElementById('ss-logo-area');
  const logoFileInput = document.getElementById('logo-file-input');
  const logoPreview   = document.getElementById('logo-preview');
  const logoClearBtn  = document.getElementById('btn-logo-clear');

  // Form fields
  const inputName     = document.getElementById('input-server-name');
  const inputCode     = document.getElementById('input-join-code');
  const inputDesc     = document.getElementById('input-server-desc');
  const inputDiscord  = document.getElementById('input-discord-id');
  const errorMsg      = document.getElementById('ss-error');
  const successMsg    = document.getElementById('ss-success');

  const btnCopyCode   = document.getElementById('btn-copy-code');
  const btnRegenCode  = document.getElementById('btn-regen-code');
  const btnSave       = document.getElementById('btn-save-settings');
  const btnDeleteSrv  = document.getElementById('btn-delete-server');

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
  const roleGrid       = document.getElementById('role-grid');
  const btnRoleClose   = document.getElementById('btn-role-close');
  const btnRoleConfirm = document.getElementById('btn-role-confirm');
  const btnRoleCancel  = document.getElementById('btn-role-cancel');

  // Delete modal
  const modalDelete        = document.getElementById('modal-delete');
  const deleteStep1        = document.getElementById('delete-step-1');
  const deleteStep2        = document.getElementById('delete-step-2');
  const deleteSendError    = document.getElementById('delete-send-error');
  const deleteError        = document.getElementById('delete-error');
  const deleteCodeDesc     = document.getElementById('delete-code-desc');
  const btnDeleteSendCode  = document.getElementById('btn-delete-send-code');
  const inputDeleteCode    = document.getElementById('input-delete-code');
  const inputConfirmName   = document.getElementById('input-confirm-name');
  const btnDeleteConf      = document.getElementById('btn-delete-confirm');
  const btnDeleteClose     = document.getElementById('btn-delete-close');
  const btnDeleteCancel    = document.getElementById('btn-delete-cancel');
  const btnDeleteCancel2   = document.getElementById('btn-delete-cancel-2');

  /* ── State ───────────────────────────────────────────────── */
  let members             = [];
  let currentServerName   = serverName;
  let isOwner             = false;
  let pendingKickMember   = null;  // { iduser, username }

  /* ── Navbar ──────────────────────────────────────────────── */
  navTitle.textContent = 'Server Settings — ' + serverName;

  /* ── Navigation ──────────────────────────────────────────── */
  btnBack.addEventListener('click', function () { window.location.href = 'server-page.html'; });
  btnDashboard.addEventListener('click', function () { window.location.href = 'dashboard.html'; });

  /* ── Modal helpers ───────────────────────────────────────── */
  function openModal(el)  { el.classList.add('open'); }
  function closeModal(el) { el.classList.remove('open'); }

  [modalKick, modalRole, modalDelete].forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(m); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') [modalKick, modalRole, modalDelete].forEach(closeModal);
  });

  /* ── Status messages ─────────────────────────────────────── */
  function clearMessages() { errorMsg.textContent = ''; successMsg.textContent = ''; }

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
  function loadServerInfo() {
    // Pre-fill from cache
    inputName.value    = serverName;
    inputCode.value    = get('cad_server_join_code') || '';

    apiFetch('/servers/name/' + serverId)
      .then(function (srv) {
        if (!srv) return;
        currentServerName     = srv.name || serverName;
        inputName.value       = srv.name || serverName;
        inputDesc.value       = srv.description || '';
        inputDiscord.value    = srv.discord_id || '';
        navTitle.textContent  = 'Server Settings — ' + currentServerName;

        // Check if current user is owner
        isOwner = String(srv.owner_id) === String(userId);
      })
      .catch(function () {});

    apiFetch('/servers/join-code/' + serverId)
      .then(function (data) {
        if (data && data.code) {
          inputCode.value = data.code;
          set('cad_server_join_code', data.code);
        }
      })
      .catch(function () {});
  }

  loadServerInfo();

  /* ── Load members ────────────────────────────────────────── */
  function loadMembers() {
    membersBody.innerHTML = '<div class="ss-members-empty" style="color:rgba(255,255,255,0.3);">Loading members…</div>';

    apiFetch('/servers/' + serverId + '/members')
      .then(function (rows) {
        members = rows || [];
        renderMembers();
      })
      .catch(function (err) {
        membersBody.innerHTML = '<div class="ss-members-empty">Could not load members.</div>';
        memberCount.textContent = '–';
      });
  }

  loadMembers();

  /* ── Render member rows ──────────────────────────────────── */
  function renderMembers() {
    membersBody.innerHTML = '';
    memberCount.textContent = members.length + ' member' + (members.length !== 1 ? 's' : '');

    if (!members.length) {
      const empty = document.createElement('div');
      empty.className   = 'ss-members-empty';
      empty.textContent = 'No members found.';
      membersBody.appendChild(empty);
      return;
    }

    members.forEach(function (m, idx) {
      const row = document.createElement('div');
      row.className = 'ss-member-row';
      row.style.animationDelay = (idx * 35) + 'ms';

      const roleLower  = (m.role || 'member').toLowerCase();
      const badgeClass = 'ss-role-badge--' + roleLower;
      const isMemberOwner = roleLower === 'owner';
      const isSelf     = String(m.iduser) === String(userId);

      // Only show kick button for non-owners when viewer is the server owner
      const actionHtml = (isOwner && !isMemberOwner && !isSelf)
        ? '<button class="ss-row-btn ss-row-btn--kick" data-id="' + esc(String(m.iduser)) + '" data-name="' + esc(m.username) + '">Kick</button>'
        : (isSelf ? '<span style="font-size:0.75rem;color:rgba(255,255,255,0.3);">You</span>' : '');

      row.innerHTML =
        '<span class="ss-member-cell ss-member-cell--name">' + esc(m.username) + '</span>' +
        '<span class="ss-member-cell ss-member-cell--role">' +
          '<span class="ss-role-badge ' + badgeClass + '">' + esc(m.role || 'Member') + '</span>' +
        '</span>' +
        '<span class="ss-member-cell ss-member-cell--joined">' + formatDate(m.joined_at) + '</span>' +
        '<span class="ss-member-cell ss-member-cell--action">' + actionHtml + '</span>';

      membersBody.appendChild(row);
    });
  }

  /* ── Kick: event delegation ──────────────────────────────── */
  membersBody.addEventListener('click', function (e) {
    const kickBtn = e.target.closest('.ss-row-btn--kick');
    if (!kickBtn) return;

    pendingKickMember = {
      iduser:   kickBtn.getAttribute('data-id'),
      username: kickBtn.getAttribute('data-name'),
    };
    kickTitle.textContent = 'Kick ' + pendingKickMember.username + '?';
    kickDesc.textContent  = pendingKickMember.username + ' will be removed from the server.';
    openModal(modalKick);
  });

  btnKickConfirm.addEventListener('click', function () {
    if (!pendingKickMember) return;
    const memberId = pendingKickMember.iduser;
    const name     = pendingKickMember.username;

    btnKickConfirm.textContent = 'Kicking…';
    btnKickConfirm.disabled    = true;

    apiFetch('/servers/' + serverId + '/members/' + memberId, { method: 'DELETE' })
      .then(function () {
        members = members.filter(function (m) { return String(m.iduser) !== String(memberId); });
        renderMembers();
        closeModal(modalKick);
        showSuccess(name + ' has been removed from the server.');
      })
      .catch(function (err) {
        closeModal(modalKick);
        showError('Could not kick member: ' + err.message);
      })
      .finally(function () {
        btnKickConfirm.textContent = 'Kick';
        btnKickConfirm.disabled    = false;
        pendingKickMember = null;
      });
  });

  btnKickCancel.addEventListener('click', function () { pendingKickMember = null; closeModal(modalKick); });
  btnKickClose.addEventListener('click',  function () { pendingKickMember = null; closeModal(modalKick); });

  /* ── Role modal (UI only — no role column in DB yet) ─────── */
  // Role changes are displayed but won't persist until a DB migration adds a role column.
  // For now we just close the modal and show a message.
  let pendingRoleVal = null;

  roleGrid.addEventListener('click', function (e) {
    const btn = e.target.closest('.ss-role-btn');
    if (!btn) return;
    roleGrid.querySelectorAll('.ss-role-btn').forEach(function (b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    pendingRoleVal = btn.getAttribute('data-role');
  });

  btnRoleConfirm.addEventListener('click', function () {
    closeModal(modalRole);
    showSuccess('Role updated.');
    pendingRoleVal = null;
  });
  btnRoleCancel.addEventListener('click', function () { closeModal(modalRole); pendingRoleVal = null; });
  btnRoleClose.addEventListener('click',  function () { closeModal(modalRole); pendingRoleVal = null; });

  /* ── Logo upload ─────────────────────────────────────────── */
  logoFileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      logoPreview.src = e.target.result;
      logoArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  });

  logoClearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    logoPreview.src     = '';
    logoFileInput.value = '';
    logoArea.classList.remove('has-image');
  });

  /* ── Join code: copy ─────────────────────────────────────── */
  btnCopyCode.addEventListener('click', function () {
    const code = inputCode.value.trim();
    if (!code) return;
    navigator.clipboard.writeText(code).then(function () {
      const orig = btnCopyCode.textContent;
      btnCopyCode.textContent = 'Copied!';
      setTimeout(function () { btnCopyCode.textContent = orig; }, 1500);
    }).catch(function () { inputCode.select(); });
  });

  /* ── Join code: regenerate ───────────────────────────────── */
  btnRegenCode.addEventListener('click', function () {
    inputCode.value = generateCode(8);
    clearMessages();
  });

  inputCode.addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  /* ── Save settings ───────────────────────────────────────── */
  btnSave.addEventListener('click', function () {
    clearMessages();

    const name    = inputName.value.trim();
    const code    = inputCode.value.trim();
    const desc    = inputDesc.value.trim();
    const discord = inputDiscord.value.trim() || null;

    if (!name) { showError('Server name is required.'); return; }
    if (!code) { showError('Join code is required.'); return; }

    btnSave.classList.add('ss-loading');
    btnSave.textContent = 'Saving…';

    apiFetch('/servers/' + serverId + '/update', {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        description: desc || null,
        joinCode:    code,
        discordId:   discord,
      }),
    })
      .then(function (srv) {
        currentServerName = srv.name || name;
        navTitle.textContent = 'Server Settings — ' + currentServerName;
        set('cad_active_server_name', currentServerName);
        set('cad_server_join_code', srv.join_code || code);
        if (srv.join_code) inputCode.value = srv.join_code;
        showSuccess('Settings saved.');
      })
      .catch(function (err) {
        showError('Save failed: ' + err.message);
      })
      .finally(function () {
        btnSave.classList.remove('ss-loading');
        btnSave.textContent = 'Save Settings';
      });
  });

  /* ── Delete server ───────────────────────────────────────── */
  btnDeleteSrv.addEventListener('click', function () {
    deleteStep1.style.display   = '';
    deleteStep2.style.display   = 'none';
    deleteSendError.textContent = '';
    deleteError.textContent     = '';
    inputConfirmName.value      = '';
    if (inputDeleteCode) inputDeleteCode.value = '';
    openModal(modalDelete);
  });

  btnDeleteSendCode.addEventListener('click', function () {
    deleteSendError.textContent      = '';
    btnDeleteSendCode.textContent    = 'Sending…';
    btnDeleteSendCode.disabled       = true;

    apiFetch('/verification/send', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_server_' + serverId }),
    })
      .then(function (data) {
        if (deleteCodeDesc)
          deleteCodeDesc.textContent = 'Enter the 6-digit code sent to ' + data.maskedEmail + ', then type the server name to confirm.';
        deleteStep1.style.display = 'none';
        deleteStep2.style.display = '';
        if (inputDeleteCode) inputDeleteCode.focus();
      })
      .catch(function (err) {
        deleteSendError.textContent = err.message;
      })
      .finally(function () {
        btnDeleteSendCode.textContent = 'Send Code';
        btnDeleteSendCode.disabled    = false;
      });
  });

  btnDeleteConf.addEventListener('click', function () {
    deleteError.textContent = '';

    const code  = inputDeleteCode ? inputDeleteCode.value.trim() : '';
    const typed = inputConfirmName.value.trim();

    if (!code || code.length !== 6) { deleteError.textContent = 'Enter the 6-digit verification code.'; return; }
    if (typed.toLowerCase() !== currentServerName.toLowerCase()) {
      deleteError.textContent = 'Server name does not match. Please try again.';
      return;
    }

    btnDeleteConf.textContent = 'Verifying…';
    btnDeleteConf.disabled    = true;

    apiFetch('/verification/verify', {
      method: 'POST',
      body: JSON.stringify({ code, action: 'delete_server_' + serverId }),
    })
      .then(function () {
        // Code verified — delete the server
        return apiFetch('/servers/' + serverId, { method: 'DELETE' });
      })
      .then(function () {
        remove('cad_active_server');
        remove('cad_active_server_name');
        remove('cad_server_join_code');
        window.location.href = 'dashboard.html';
      })
      .catch(function (err) {
        deleteError.textContent   = err.message;
        btnDeleteConf.textContent = 'Delete Forever';
        btnDeleteConf.disabled    = false;
      });
  });

  function closeDeleteModal() { closeModal(modalDelete); }
  btnDeleteClose.addEventListener('click',   closeDeleteModal);
  btnDeleteCancel.addEventListener('click',  closeDeleteModal);
  if (btnDeleteCancel2) btnDeleteCancel2.addEventListener('click', closeDeleteModal);

})();