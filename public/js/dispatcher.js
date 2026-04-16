/**
 * dispatcher.js  Ultimate CAD Dispatcher
 * Full API integration: calls, BOLOs, active units, search, history.
 * Polls live data every 10 seconds.
 */

(function () {
  'use strict';

  const API_BASE = '';

  function get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }

  const userId    = get('cad_user_id');
  const serverId  = get('cad_active_server');
  const officerId = get('cad_officer_id');

  if (!userId || !serverId) { window.location.href = 'server-page.html'; return; }

  const authHeaders = { 'Content-Type': 'application/json', 'x-user-id': userId };

  function apiFetch(url, opts) {
    return fetch(API_BASE + url, Object.assign({ headers: authHeaders }, opts || {}))
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'API error'); });
        return r.json();
      });
  }

  const $ = id => document.getElementById(id);
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function priClass(p) { return {Low:'pri-low',Medium:'pri-medium',High:'pri-high',Critical:'pri-critical'}[p]||''; }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PANEL SWITCHING
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const PANELS = ['home','map','cad','search','reports','callhistory','notepad'];

  function showPanel(id) {
    PANELS.forEach(function (p) {
      const panel = $('panel-' + p);
      const btn   = $('btn-' + p);
      if (panel) panel.classList.toggle('active', p === id);
      if (btn)   btn.classList.toggle('d-btn--active', p === id);
    });
    if (id === 'cad') { fetchCalls(); fetchBolos(); fetchUnits(); }
    if (id === 'callhistory') fetchHistory();
  }

  PANELS.forEach(function (p) {
    const btn = $('btn-' + p);
    if (btn) btn.addEventListener('click', function () { showPanel(p); });
  });

  $('btn-clockout').addEventListener('click', function () {
    if (officerId) apiFetch('/officers/clock-out/' + officerId, { method: 'DELETE' }).catch(function () {});
    window.location.href = 'server-page.html';
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STATUS BUTTONS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let currentStatus = null;
  document.querySelectorAll('.d-status-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.d-status-btn').forEach(function (b) { b.classList.remove('d-status-btn--active-glow'); });
      if (currentStatus !== btn.dataset.code) {
        btn.classList.add('d-status-btn--active-glow');
        currentStatus = btn.dataset.code;
      } else {
        currentStatus = null;
      }
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MODAL HELPERS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const MODALS = ['d-call-modal','d-bolo-modal'];
  function openModal(id)  { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }

  MODALS.forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target === this) closeModal(id); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') MODALS.forEach(closeModal); });

  $('btn-create-call').addEventListener('click', function () { openModal('d-call-modal'); });
  $('btn-create-bolo').addEventListener('click', function () { openModal('d-bolo-modal'); });
  $('btn-close-call-modal').addEventListener('click', function () { closeModal('d-call-modal'); });
  $('btn-close-bolo-modal').addEventListener('click', function () { closeModal('d-bolo-modal'); });

  function clearFields(ids) {
    ids.forEach(function (id) {
      const el = $(id); if (!el) return;
      el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE CALLS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function fetchCalls() {
    apiFetch('/calls/' + serverId)
      .then(function (rows) { renderCalls(rows); })
      .catch(function () {});
  }

  function renderCalls(calls) {
    const el = $('d-calls-list');
    if (!calls.length) { el.innerHTML = '<div class="d-empty">No active calls.</div>'; return; }
    el.innerHTML = calls.map(function (c) {
      return '<div class="tbl-row">' +
        '<span class="d-row-cell" style="width:6.25rem">' + esc(c.id)       + '</span>' +
        '<span class="d-row-cell" style="flex:1">'      + esc(c.nature)   + '</span>' +
        '<span class="d-row-cell" style="width:18.75rem">' + esc(c.location) + '</span>' +
        '<span class="d-row-cell ' + priClass(c.priority) + '" style="width:7.5rem">' + esc(c.priority) + '</span>' +
        '<span class="d-row-cell" style="width:7.5rem">' + esc(c.units || '') + '</span>' +
        '<button class="d-code4-btn" data-id="' + c.id + '">CODE 4</button>' +
        '</div>';
    }).join('');

    el.querySelectorAll('.d-code4-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiFetch('/calls/' + btn.dataset.id + '/close', {
          method: 'PATCH',
          body: JSON.stringify({ serverId: Number(serverId) }),
        })
          .then(function () { fetchCalls(); })
          .catch(function (err) { alert(err.message); });
      });
    });
  }

  $('btn-submit-call').addEventListener('click', function () {
    const nature   = $('d-call-nature').value.trim()   || 'Unknown';
    const location = $('d-call-location').value.trim() || 'Unknown';
    const priority = $('d-call-priority').value;

    apiFetch('/calls', {
      method: 'POST',
      body: JSON.stringify({ serverId: Number(serverId), nature, location, priority }),
    })
      .then(function () {
        fetchCalls();
        closeModal('d-call-modal');
        clearFields(['d-call-nature','d-call-title','d-call-location','d-call-desc']);
      })
      .catch(function (err) { alert(err.message); });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE BOLOs
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function fetchBolos() {
    apiFetch('/bolos/' + serverId)
      .then(function (rows) { renderBolos(rows); })
      .catch(function () {});
  }

  function renderBolos(bolos) {
    const el = $('d-bolos-list');
    if (!bolos.length) { el.innerHTML = '<div class="d-empty">No active BOLOs.</div>'; return; }
    el.innerHTML = bolos.map(function (b) {
      const desc = b.description || '';
      return '<div class="tbl-row">' +
        '<span class="d-row-cell" style="width:13.75rem">' + esc(b.type) + '</span>' +
        '<span class="d-row-cell" style="width:21.875rem">' + esc(b.reason) + '</span>' +
        '<span class="d-row-cell" style="flex:1">'      + esc(desc.substring(0,80)) + (desc.length>80?'…':'') + '</span>' +
        '<button class="d-remove-btn" data-id="' + b.id + '">Remove</button>' +
        '</div>';
    }).join('');

    el.querySelectorAll('.d-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiFetch('/bolos/' + btn.dataset.id, {
          method: 'DELETE',
          body: JSON.stringify({ serverId: Number(serverId) }),
        })
          .then(function () { fetchBolos(); })
          .catch(function (err) { alert(err.message); });
      });
    });
  }

  $('btn-submit-bolo').addEventListener('click', function () {
    const type = $('d-bolo-type').value;
    const loc  = $('d-bolo-loc').value.trim()  || '';
    const desc = $('d-bolo-desc').value.trim();
    if (!desc) { alert('Description is required.'); return; }

    apiFetch('/bolos', {
      method: 'POST',
      body: JSON.stringify({ serverId: Number(serverId), type, reason: loc, description: desc }),
    })
      .then(function () {
        fetchBolos();
        closeModal('d-bolo-modal');
        clearFields(['d-bolo-loc','d-bolo-desc']);
      })
      .catch(function (err) { alert(err.message); });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE UNITS (real officers on duty)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function fetchUnits() {
    apiFetch('/officers/' + serverId)
      .then(function (rows) { renderUnits(rows); })
      .catch(function () {});
  }

  function renderUnits(units) {
    const el = $('d-units-list');
    if (!units.length) { el.innerHTML = '<div class="d-empty">No units on duty.</div>'; return; }
    el.innerHTML = units.map(function (u) {
      const dept = (u.department || '').toLowerCase();
      const typeLabel = dept.includes('fire') || dept.includes('rescue') ? 'FD' :
                        dept.includes('transport') || dept.includes('dot') ? 'DOT' : 'LEO';
      const typeClass = typeLabel === 'LEO' ? 'd-row-cell--leo' : typeLabel === 'FD' ? 'd-row-cell--fd' : '';
      const statusColor = u.status === 'AVAILABLE' ? 'd-row-cell--green' : '';

      return '<div class="tbl-row">' +
        '<span class="d-row-cell" style="width:7.5rem">'  + esc(u.callsign)    + '</span>' +
        '<span class="d-row-cell ' + typeClass + '" style="width:10rem">' + esc(typeLabel) + '</span>' +
        '<span class="d-row-cell" style="flex:1">'       + esc(u.department)  + '</span>' +
        '<span class="d-row-cell" style="width:18.75rem">'  + esc(u.location || '') + '</span>' +
        '<span class="d-row-cell ' + statusColor + '">'  + esc(u.status)      + '</span>' +
        '</div>';
    }).join('');
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SEARCH
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function doSearch(q, cb) {
    if (q.length < 2) { cb({ characters:[], vehicles:[], firearms:[] }); return; }
    apiFetch('/search/' + serverId + '?q=' + encodeURIComponent(q)).then(cb).catch(function () { cb({ characters:[], vehicles:[], firearms:[] }); });
  }

  function makeEmpty(msg) { return '<div class="d-empty">' + msg + '</div>'; }

  $('d-ped-search').addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    doSearch(q, function (data) {
      const el = $('d-ped-results');
      const chars = data.characters || [];
      el.innerHTML = chars.length
        ? chars.map(function (c) {
            return '<div class="tbl-row"><span class="d-row-cell" style="flex:1">' + esc(c.first_name) + '</span><span class="d-row-cell">' + esc(c.last_name) + '</span></div>';
          }).join('')
        : makeEmpty('No results.');
    });
  });

  $('d-car-search').addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    doSearch(q, function (data) {
      const el = $('d-car-results');
      const vehs = data.vehicles || [];
      el.innerHTML = vehs.length
        ? vehs.map(function (v) {
            return '<div class="tbl-row">' +
              '<span class="d-row-cell" style="width:11.875rem">' + esc(v.owner_name || '') + '</span>' +
              '<span class="d-row-cell" style="width:8.125rem">' + esc(v.plate) + '</span>' +
              '<span class="d-row-cell" style="flex:1">'      + esc(v.model) + '</span>' +
              '<span class="d-row-cell">'                     + esc(v.color || '') + '</span></div>';
          }).join('')
        : makeEmpty('No results.');
    });
  });

  $('d-gun-search').addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    doSearch(q, function (data) {
      const el = $('d-gun-results');
      const fas = data.firearms || [];
      el.innerHTML = fas.length
        ? fas.map(function (f) {
            return '<div class="tbl-row"><span class="d-row-cell" style="flex:1">' + esc(f.owner_name || '') + '</span><span class="d-row-cell">' + esc(f.serial) + '</span></div>';
          }).join('')
        : makeEmpty('No results.');
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     CALL HISTORY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let historyData = [];

  function fetchHistory() {
    apiFetch('/calls/' + serverId + '/history')
      .then(function (rows) { historyData = rows; renderHistory(rows); })
      .catch(function () {});
  }

  function renderHistory(list) {
    const el = $('d-history-list');
    if (!list.length) { el.innerHTML = '<div class="d-empty">No calls found.</div>'; return; }
    el.innerHTML = list.map(function (c) {
      return '<div class="tbl-row">' +
        '<span class="d-row-cell" style="width:6.25rem">' + esc(c.id)       + '</span>' +
        '<span class="d-row-cell" style="flex:1">'      + esc(c.nature)   + '</span>' +
        '<span class="d-row-cell" style="width:18.75rem">' + esc(c.location) + '</span>' +
        '<span class="d-row-cell ' + priClass(c.priority) + '" style="width:7.5rem">' + esc(c.priority) + '</span>' +
        '<span class="d-row-cell">' + esc(c.units || '') + '</span>' +
        '</div>';
    }).join('');
  }

  $('d-hist-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    renderHistory(historyData.filter(function (c) {
      return String(c.id).includes(q) || c.nature.toLowerCase().includes(q) || c.location.toLowerCase().includes(q);
    }));
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     NOTEPAD
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const notepad = $('d-notepad-text');
  try { const s = localStorage.getItem('cad_dispatcher_notepad'); if (s) notepad.value = s; } catch (_) {}
  notepad.addEventListener('input', function () {
    try { localStorage.setItem('cad_dispatcher_notepad', notepad.value); } catch (_) {}
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     INIT + POLLING
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  fetchCalls();
  fetchBolos();
  fetchUnits();
  fetchHistory();

  // Poll live CAD data every 10 seconds
  setInterval(function () {
    fetchCalls();
    fetchBolos();
    fetchUnits();
  }, 10000);

})();