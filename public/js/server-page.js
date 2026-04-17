/**
 * server-page.js  Ultimate CAD Server Page
 *
 * Responsibilities:
 *  - Populate the welcome greeting (server name + username)
 *  - Detect if the current user is the server owner and show
 *    the "Server Settings" button accordingly
 *  - Validate and submit clock-in for each department (LEO / F&R / DOT)
 *    via POST /units/clock-in
 *  - Navigate to the appropriate CAD page on success
 *  - Wire Civilian/Character and Dispatcher bottom buttons
 *
 * No inline event handlers or inline styles anywhere in the HTML.
 * All DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────── */
  const API_BASE = '';   // same origin; change to 'http://localhost:5000' if needed

  /* ── Storage helpers ─────────────────────────────────────── */
  function get(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }

  /* ── Cached values ───────────────────────────────────────── */
  const serverId   = get('cad_active_server');
  const serverName = get('cad_active_server_name') || 'Unknown Server';
  const username   = get('cad_username')           || 'Unit';
  const userId     = get('cad_user_id');            // internal DB id (iduser)

  /* ── Element refs ────────────────────────────────────────── */
  const root          = document.getElementById('server-root');
  const welcomeText   = document.getElementById('sp-welcome-text');
  const btnDashboard  = document.getElementById('btn-dashboard');
  const btnSettings   = document.getElementById('btn-server-settings');
  const btnCivilian   = document.getElementById('btn-civilian');
  const btnDispatcher = document.getElementById('btn-dispatcher');

  /* Dept: name, callsign, rank, department input ids; error id; button id; CAD url */
  const DEPTS = [
    {
      prefix:     'leo',
      department: 'Law Enforcement',
      cadUrl:     'leo-cad.html',
    },
    {
      prefix:     'fr',
      department: 'Fire and Rescue',
      cadUrl:     'fr-cad.html',
    },
    {
      prefix:     'dot',
      department: 'Department of Transport',
      cadUrl:     'dot-cad.html',
    },
  ];

  /* ── Greeting ────────────────────────────────────────────── */
  welcomeText.textContent = 'Welcome to ' + serverName + ', ' + username;

  /* ── Owner detection ─────────────────────────────────────── */
  (function checkOwner() {
    if (!serverId) return;

    fetch(API_BASE + '/servers/name/' + serverId)
      .then(function (r) { return r.json(); })
      .then(function (server) {
        // server.owner_id is the iduser of the owner (from DB_Structure.sql)
        if (userId && String(server.owner_id) === String(userId)) {
          root.classList.add('sp-owner');
        }
      })
      .catch(function () {
        // Network unavailable or dev mode  silently skip owner check
      });
  })();

  /* ── Server Settings navigation ─────────────────────────── */
  btnSettings.addEventListener('click', function () {
    window.location.href = 'server-settings.html';
  });

  /* ── Dashboard navigation ────────────────────────────────── */
  btnDashboard.addEventListener('click', function () {
    window.location.href = 'dashboard.html';
  });

  /* ── Civilian / Dispatcher buttons ──────────────────────── */
  btnCivilian.addEventListener('click', function () {
    window.location.href = 'civilian.html';
  });

  btnDispatcher.addEventListener('click', function () {
    window.location.href = 'dispatcher-cad.html';
  });

  /* ── Dept clock-in ───────────────────────────────────────── */

  /**
   * Show an error message inside the panel.
   */
  function showError(prefix, msg) {
    var el = document.getElementById(prefix + '-error');
    if (el) el.textContent = msg;
  }

  /**
   * Clear error message.
   */
  function clearError(prefix) {
    var el = document.getElementById(prefix + '-error');
    if (el) el.textContent = '';
  }

  /**
   * Read a field value by its id, trimmed.
   */
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  /**
   * Attempt to clock in, then navigate to the CAD page.
   * Matches POST /units/clock-in  (units.routes.js)
   * Body: { serverId, name, callsign, department }
   * Header: x-user-id
   */
  function clockIn(dept) {
    clearError(dept.prefix);

    var name       = val(dept.prefix + '-name');
    var callsign   = val(dept.prefix + '-callsign');
    var rank       = val(dept.prefix + '-rank');
    var department = val(dept.prefix + '-department') || dept.department;

    /* Basic client-side validation */
    if (!name || !callsign) {
      showError(dept.prefix, 'Name and Callsign are required.');
      return;
    }

    if (!serverId) {
      showError(dept.prefix, 'No active server  please return to the dashboard.');
      return;
    }

    /* Disable the button while the request is in flight */
    var btn = document.getElementById('btn-join-' + dept.prefix);
    btn.classList.add('sp-loading');
    btn.textContent = 'Joining…';

    fetch(API_BASE + '/units/clock-in', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id':    userId || '',
      },
      body: JSON.stringify({
        serverId:   Number(serverId),
        name:       name + (rank ? ' (' + rank + ')' : ''),
        callsign:   callsign,
        department: department,
      }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Server error'); });
        return r.json();
      })
      .then(function (unit) {
        /* Persist the unit session id for the CAD page */
        set('cad_unit_id', unit.id);
        set('cad_unit_dept', dept.prefix);
        window.location.href = dept.cadUrl;
      })
      .catch(function (err) {
        showError(dept.prefix, err.message || 'Clock-in failed. Please try again.');
        btn.classList.remove('sp-loading');
        btn.textContent = 'Join ' + (dept.prefix === 'leo' ? 'LEO' : dept.prefix === 'fr' ? 'F&R' : 'DOT') + ' CAD';
      });
  }

  /* Wire each department join button */
  DEPTS.forEach(function (dept) {
    var btn = document.getElementById('btn-join-' + dept.prefix);
    if (!btn) return;
    btn.addEventListener('click', function () { clockIn(dept); });
  });

})();