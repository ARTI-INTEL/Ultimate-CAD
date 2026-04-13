/**
 * dispatcher.js — Ultimate CAD Dispatcher
 *
 * Responsibilities:
 *  - Tab/panel switching
 *  - Status button toggling
 *  - Active Calls: create, close (CODE 4), render
 *  - Active BOLOs: create, remove, render
 *  - Active Units: render mock data
 *  - Search: PED / Car / Gun with mock data
 *  - Call History: render + filter
 *  - Notepad: persist via localStorage
 *  - Modal open / close
 *
 * Zero inline event handlers or inline styles anywhere.
 */

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  /* ── Priority colour class ─────────────────────────────── */
  function priClass(p) {
    const map = { Low: 'pri-low', Medium: 'pri-medium', High: 'pri-high', Critical: 'pri-critical' };
    return map[p] || '';
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PANEL SWITCHING
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const PANELS = ['home', 'map', 'cad', 'search', 'reports', 'callhistory', 'notepad'];

  function showPanel(id) {
    PANELS.forEach(function (p) {
      const panel = $('panel-' + p);
      const btn   = $('btn-' + p);
      if (panel) panel.classList.toggle('active', p === id);
      if (btn)   btn.classList.toggle('d-btn--active', p === id);
    });
  }

  PANELS.forEach(function (p) {
    const btn = $('btn-' + p);
    if (btn) btn.addEventListener('click', function () { showPanel(p); });
  });

  /* ── Clock-Out ───────────────────────────────────────────── */
  $('btn-clockout').addEventListener('click', function () {
    window.location.href = 'server-page.html';
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STATUS BUTTONS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var currentStatus = null;

  document.querySelectorAll('.d-status-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Deactivate all, activate clicked
      document.querySelectorAll('.d-status-btn').forEach(function (b) {
        b.classList.remove('d-status-btn--active-glow');
      });
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
  const MODALS = ['d-call-modal', 'd-bolo-modal'];

  function openModal(id) { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }

  MODALS.forEach(function (id) {
    $(id).addEventListener('click', function (e) {
      if (e.target === this) closeModal(id);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      MODALS.forEach(function (id) { closeModal(id); });
    }
  });

  $('btn-create-call').addEventListener('click', function () { openModal('d-call-modal'); });
  $('btn-create-bolo').addEventListener('click', function () { openModal('d-bolo-modal'); });
  $('btn-close-call-modal').addEventListener('click', function () { closeModal('d-call-modal'); });
  $('btn-close-bolo-modal').addEventListener('click', function () { closeModal('d-bolo-modal'); });

  /* ── Clear fields helper ─────────────────────────────────── */
  function clearFields(ids) {
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE CALLS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var dCalls   = [];
  var dCallId  = 2001;

  function renderCalls() {
    var el = $('d-calls-list');
    if (!dCalls.length) {
      el.innerHTML = '<div class="d-empty">No active calls.</div>';
      return;
    }
    el.innerHTML = dCalls.map(function (c, i) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="width:100px">' + esc(c.id) + '</span>' +
          '<span class="d-row-cell" style="flex:1">' + esc(c.nature) + '</span>' +
          '<span class="d-row-cell" style="width:300px">' + esc(c.location) + '</span>' +
          '<span class="d-row-cell ' + priClass(c.priority) + '" style="width:120px">' + esc(c.priority) + '</span>' +
          '<span class="d-row-cell" style="width:120px">—</span>' +
          '<button class="d-code4-btn" data-idx="' + i + '">CODE 4</button>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.d-code4-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx, 10);
        dCalls.splice(idx, 1);
        renderCalls();
      });
    });
  }

  // Update the Call ID display each time the modal opens
  $('btn-create-call').addEventListener('click', function () {
    $('d-callid-display').textContent = '#' + dCallId;
  });

  $('btn-submit-call').addEventListener('click', function () {
    var nature = $('d-call-nature').value.trim() || 'Unknown';
    var loc    = $('d-call-location').value.trim() || 'Unknown';
    dCalls.push({
      id:       dCallId++,
      nature:   nature,
      location: loc,
      priority: $('d-call-priority').value,
      status:   $('d-call-status').value,
      desc:     $('d-call-desc').value.trim(),
    });
    renderCalls();
    closeModal('d-call-modal');
    clearFields(['d-call-nature', 'd-call-title', 'd-call-location', 'd-call-desc']);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE BOLOs
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var dBolos = [];

  function renderBolos() {
    var el = $('d-bolos-list');
    if (!dBolos.length) {
      el.innerHTML = '<div class="d-empty">No active BOLOs.</div>';
      return;
    }
    el.innerHTML = dBolos.map(function (b, i) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="width:220px">' + esc(b.type) + '</span>' +
          '<span class="d-row-cell" style="width:580px">' + esc(b.loc) + '</span>' +
          '<span class="d-row-cell" style="flex:1">' + esc(b.desc.substring(0, 80)) + (b.desc.length > 80 ? '…' : '') + '</span>' +
          '<button class="d-remove-btn" data-idx="' + i + '">Remove</button>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.d-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx, 10);
        dBolos.splice(idx, 1);
        renderBolos();
      });
    });
  }

  $('btn-submit-bolo').addEventListener('click', function () {
    dBolos.push({
      type: $('d-bolo-type').value,
      loc:  $('d-bolo-loc').value.trim(),
      desc: $('d-bolo-desc').value.trim(),
    });
    renderBolos();
    closeModal('d-bolo-modal');
    clearFields(['d-bolo-loc', 'd-bolo-desc']);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE UNITS (mock)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var mockUnits = [
    { callsign: 'L-1', type: 'LEO', dept: 'Blaine County Sheriff',    location: 'Main St',   status: '10-8' },
    { callsign: 'L-3', type: 'LEO', dept: 'LSPD Patrol Division',     location: 'Grove St',  status: '10-97' },
    { callsign: 'F-2', type: 'FD',  dept: 'Sandy Shores Fire Dept',   location: 'Fire Base', status: '10-8' },
    { callsign: 'D-1', type: 'DOT', dept: 'Dept of Transport',        location: 'Hwy 101',   status: '10-6' },
  ];

  function renderUnits() {
    var el = $('d-units-list');
    if (!mockUnits.length) {
      el.innerHTML = '<div class="d-empty">No units on duty.</div>';
      return;
    }
    el.innerHTML = mockUnits.map(function (u) {
      var typeClass = u.type === 'LEO' ? 'd-row-cell--leo' : u.type === 'FD' ? 'd-row-cell--fd' : '';
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="width:120px">' + esc(u.callsign) + '</span>' +
          '<span class="d-row-cell ' + typeClass + '" style="width:160px">' + esc(u.type) + '</span>' +
          '<span class="d-row-cell" style="flex:1">' + esc(u.dept) + '</span>' +
          '<span class="d-row-cell" style="width:300px">' + esc(u.location) + '</span>' +
          '<span class="d-row-cell d-row-cell--green">' + esc(u.status) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SEARCH
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var mockPeds = [
    { fn: 'John', ln: 'Smith' },
    { fn: 'Jane', ln: 'Doe'   },
  ];
  var mockCars = [
    { owner: 'John Smith', plate: 'ABC123', model: 'Toyota Camry', color: 'White' },
    { owner: 'Jane Doe',   plate: 'XYZ789', model: 'Honda Civic',  color: 'Silver' },
  ];
  var mockGuns = [
    { owner: 'John Smith', serial: 'GUN-001' },
    { owner: 'John Smith', serial: 'GUN-002' },
  ];

  function makeEmpty(msg) {
    return '<div class="d-empty">' + msg + '</div>';
  }

  function bindSearch(inputId, getData, renderFn) {
    $(inputId).addEventListener('input', function () {
      var q = this.value.toLowerCase().trim();
      renderFn(q.length < 2 ? [] : getData().filter(function (row) {
        return JSON.stringify(Object.values(row)).toLowerCase().includes(q);
      }));
    });
  }

  function renderPeds(results) {
    var el = $('d-ped-results');
    if (!results.length) { el.innerHTML = makeEmpty('No results.'); return; }
    el.innerHTML = results.map(function (p) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="flex:1">' + esc(p.fn) + '</span>' +
          '<span class="d-row-cell">' + esc(p.ln) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderCars(results) {
    var el = $('d-car-results');
    if (!results.length) { el.innerHTML = makeEmpty('No results.'); return; }
    el.innerHTML = results.map(function (c) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="width:190px">' + esc(c.owner) + '</span>' +
          '<span class="d-row-cell" style="width:130px">' + esc(c.plate) + '</span>' +
          '<span class="d-row-cell" style="flex:1">'     + esc(c.model) + '</span>' +
          '<span class="d-row-cell">'                    + esc(c.color) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderGuns(results) {
    var el = $('d-gun-results');
    if (!results.length) { el.innerHTML = makeEmpty('No results.'); return; }
    el.innerHTML = results.map(function (g) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="flex:1">' + esc(g.owner)  + '</span>' +
          '<span class="d-row-cell">'                + esc(g.serial) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  bindSearch('d-ped-search', function () { return mockPeds; }, renderPeds);
  bindSearch('d-car-search', function () { return mockCars; }, renderCars);
  bindSearch('d-gun-search', function () { return mockGuns; }, renderGuns);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     CALL HISTORY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var mockHistory = [
    { id: 2001, nature: 'Traffic Stop',       location: 'Main St',          priority: 'Low',      unit: 'L-1' },
    { id: 2002, nature: 'Structure Fire',      location: '45 Oak Ave',       priority: 'Critical', unit: 'F-2' },
    { id: 2003, nature: '10-50 Accident',      location: 'Hwy 101',          priority: 'High',     unit: 'L-3' },
    { id: 2004, nature: 'Domestic Disturbance',location: '789 Oak Drive',    priority: 'Medium',   unit: 'L-2' },
    { id: 2005, nature: 'Road Hazard',         location: 'Interstate 5',     priority: 'Medium',   unit: 'D-1' },
  ];

  function renderHistory(list) {
    var el = $('d-history-list');
    if (!list.length) {
      el.innerHTML = '<div class="d-empty">No calls found.</div>';
      return;
    }
    el.innerHTML = list.map(function (c) {
      return (
        '<div class="tbl-row">' +
          '<span class="d-row-cell" style="width:100px">' + esc(c.id) + '</span>' +
          '<span class="d-row-cell" style="flex:1">'      + esc(c.nature) + '</span>' +
          '<span class="d-row-cell" style="width:300px">' + esc(c.location) + '</span>' +
          '<span class="d-row-cell ' + priClass(c.priority) + '" style="width:120px">' + esc(c.priority) + '</span>' +
          '<span class="d-row-cell">'                     + esc(c.unit) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  $('d-hist-search').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    renderHistory(mockHistory.filter(function (c) {
      return String(c.id).includes(q) ||
             c.nature.toLowerCase().includes(q) ||
             c.location.toLowerCase().includes(q);
    }));
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     NOTEPAD — persist across sessions
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  var notepad = $('d-notepad-text');
  try {
    var saved = localStorage.getItem('cad_dispatcher_notepad');
    if (saved) notepad.value = saved;
  } catch (_) {}

  notepad.addEventListener('input', function () {
    try { localStorage.setItem('cad_dispatcher_notepad', notepad.value); } catch (_) {}
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     INIT
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  renderCalls();
  renderBolos();
  renderUnits();
  renderHistory(mockHistory);

})();