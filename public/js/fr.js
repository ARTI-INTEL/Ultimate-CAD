/**
 * fr-cad.js — F&R CAD page behaviour
 *
 * Responsibilities:
 *  - Panel navigation
 *  - Modal open / close
 *  - Active call management (create / CODE 4)
 *  - PED + Vehicle search and detail popup
 *  - Report tab switching and dynamic form generation
 *  - Call history filtering and rendering
 *  - Status button feedback
 *
 * No inline event handlers or inline styles exist in fr-cad.html.
 * All DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     PANEL SWITCHING
  ═══════════════════════════════════════════════════════════ */
  var PANELS = ['home', 'map', 'cad', 'search', 'reports', 'callhistory', 'notepad'];

  function showPanel(id) {
    PANELS.forEach(function (p) {
      document.getElementById('panel-' + p).classList.remove('active');
      var btn = document.getElementById('fr-nav-' + p);
      if (btn) btn.classList.remove('active');
    });
    document.getElementById('panel-' + id).classList.add('active');
    var activeBtn = document.getElementById('fr-nav-' + id);
    if (activeBtn) activeBtn.classList.add('active');
  }

  /* ═══════════════════════════════════════════════════════════
     MODAL HELPERS
  ═══════════════════════════════════════════════════════════ */
  function openModal(id)  { document.getElementById(id).classList.add('open');    }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  /* ═══════════════════════════════════════════════════════════
     PRIORITY COLOUR
  ═══════════════════════════════════════════════════════════ */
  function priorityColour(p) {
    var map = { Low: '#00ff2f', Medium: '#ffbb00', High: '#ff8800', Critical: '#ff0004' };
    return map[p] || '#ffffff';
  }

  /* ═══════════════════════════════════════════════════════════
     DEMO DATA
  ═══════════════════════════════════════════════════════════ */
  var frCalls  = [];
  var frCallId = 3001;

  var FR_HISTORY = [
    { id: 3001, nature: 'Structure Fire',    location: '45 Oak Ave',   priority: 'Critical', unit: 'F-2' },
    { id: 3002, nature: 'Medical Emergency', location: '789 Maple St', priority: 'High',     unit: 'E-1' },
    { id: 3003, nature: 'Vehicle Accident',  location: 'Hwy 101',      priority: 'Medium',   unit: 'R-4' },
  ];

  var MOCK_PEDS = [
    {
      fn: 'John', ln: 'Smith', dob: '01/01/1990', age: 35,
      gender: 'Male',   occ: 'Mechanic', addr: '123 Main St',
      skin: 'Light',  hair: 'Brown', eye: 'Blue',  height: '6\'0"', weight: '180 lbs',
    },
    {
      fn: 'Jane', ln: 'Doe',   dob: '03/15/1985', age: 40,
      gender: 'Female', occ: 'Nurse',    addr: '456 Oak Ave',
      skin: 'Medium', hair: 'Black', eye: 'Green', height: '5\'4"', weight: '130 lbs',
    },
  ];

  var MOCK_CARS = [
    { owner: 'John Smith', plate: 'ABC123', vehicle: 'Toyota Camry', color: 'White',  vin: '1HGBH41' },
    { owner: 'Jane Doe',   plate: 'XYZ789', vehicle: 'Honda Civic',  color: 'Silver', vin: '2HGFG3B' },
  ];

  /* ═══════════════════════════════════════════════════════════
     CAD: ACTIVE CALLS
  ═══════════════════════════════════════════════════════════ */
  function renderFRCalls() {
    var el = document.getElementById('fr-calls-list');
    if (!frCalls.length) {
      el.innerHTML = '<div style="height:42px;"></div>';
      return;
    }

    el.innerHTML = frCalls.map(function (c, i) {
      return (
        '<div class="tbl-row">' +
          '<span class="fr-cell fr-cell-callnum">' + c.id + '</span>' +
          '<span class="fr-cell fr-cell-nature">'  + c.nature + '</span>' +
          '<span class="fr-cell fr-cell-loc">'     + c.location + '</span>' +
          '<span class="fr-cell fr-cell-pri" style="color:' + priorityColour(c.priority) + '">' + c.priority + '</span>' +
          '<span class="fr-cell fr-cell-unit">—</span>' +
          '<button class="fr-close-call-btn" data-index="' + i + '">CODE 4</button>' +
        '</div>'
      );
    }).join('');

    // Wire CODE 4 buttons dynamically
    el.querySelectorAll('.fr-close-call-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        frCloseCall(parseInt(btn.dataset.index, 10));
      });
    });
  }

  function frCreateCall() {
    var nature   = document.getElementById('fr-call-nature').value.trim()   || 'Unknown';
    var location = document.getElementById('fr-call-location').value.trim() || 'Unknown';
    var priority = document.getElementById('fr-call-priority').value;
    var status   = document.getElementById('fr-call-status').value;

    frCalls.push({ id: frCallId++, nature: nature, location: location, priority: priority, status: status });
    renderFRCalls();
    closeModal('fr-call-modal');

    ['fr-call-nature', 'fr-call-title', 'fr-call-location', 'fr-call-desc'].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = '';
    });
  }

  function frCloseCall(index) {
    frCalls.splice(index, 1);
    renderFRCalls();
  }

  /* ═══════════════════════════════════════════════════════════
     SEARCH
  ═══════════════════════════════════════════════════════════ */
  function frSearchPed() {
    var q = document.getElementById('fr-ped-search').value.toLowerCase().trim();
    var results = q.length < 2
      ? []
      : MOCK_PEDS.filter(function (p) {
          return p.fn.toLowerCase().includes(q) || p.ln.toLowerCase().includes(q);
        });

    var el = document.getElementById('fr-ped-results');
    if (!results.length) {
      el.innerHTML = '<div style="height:42px;"></div>';
      return;
    }

    el.innerHTML = results.map(function (p) {
      var i = MOCK_PEDS.indexOf(p);
      return (
        '<div class="tbl-row fr-ped-row" data-ped-index="' + i + '">' +
          '<span style="font-size:19px;color:#fff;flex:1;">'  + p.fn + '</span>' +
          '<span style="font-size:19px;color:#fff;">'         + p.ln + '</span>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.fr-ped-row').forEach(function (row) {
      row.addEventListener('click', function () {
        frShowPed(parseInt(row.dataset.pedIndex, 10));
      });
    });
  }

  function frSearchCar() {
    var q = document.getElementById('fr-car-search').value.toLowerCase().trim();
    var results = q.length < 2
      ? []
      : MOCK_CARS.filter(function (c) {
          return c.plate.toLowerCase().includes(q) || c.vin.toLowerCase().includes(q);
        });

    document.getElementById('fr-car-results').innerHTML = results.length
      ? results.map(function (c) {
          return (
            '<div class="tbl-row">' +
              '<span style="font-size:19px;color:#fff;width:180px;">' + c.owner   + '</span>' +
              '<span style="font-size:19px;color:#fff;width:100px;">' + c.plate   + '</span>' +
              '<span style="font-size:19px;color:#fff;flex:1;">'      + c.vehicle + '</span>' +
              '<span style="font-size:19px;color:#fff;">'             + c.color   + '</span>' +
            '</div>'
          );
        }).join('')
      : '<div style="height:42px;"></div>';
  }

  function frShowPed(index) {
    var p = MOCK_PEDS[index];
    var fields = [
      ['First Name', p.fn], ['Last Name', p.ln], ['D.O.B',      p.dob],
      ['AGE',        p.age], ['Gender',   p.gender], ['Occupation', p.occ],
      ['Height',     p.height], ['Weight', p.weight], ['Skin Tone',  p.skin],
      ['Hair Tone',  p.hair],   ['Eye Color', p.eye], ['Address',    p.addr],
    ];

    document.getElementById('fr-ped-detail-content').innerHTML = fields.map(function (f) {
      return (
        '<div class="fr-detail-field">' +
          '<div class="fr-detail-label">' + f[0] + '</div>' +
          '<div class="fr-detail-value">' + f[1] + '</div>' +
        '</div>'
      );
    }).join('');

    openModal('fr-ped-detail');
  }

  /* ═══════════════════════════════════════════════════════════
     REPORTS
  ═══════════════════════════════════════════════════════════ */

  /** Build a row of labelled input field boxes, matching the existing project pattern. */
  function fldRow(fields) {
    return (
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
        fields.map(function (f) {
          var label = f[0], width = f[1], id = f[2];
          return (
            '<div style="background:#333;border-radius:10px;padding:6px 12px;width:' + width + 'px;flex-shrink:0;">' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.55);font-weight:700;">' + label + '</div>' +
              '<input id="' + id + '" style="background:transparent;border:none;color:#fff;' +
                'font-family:Inter,sans-serif;font-size:16px;font-weight:700;outline:none;width:100%;margin-top:2px;" ' +
                'placeholder="' + label + '">' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function frShowReport(type) {
    // Update tab active state
    document.querySelectorAll('#panel-reports .report-tab').forEach(function (tab) {
      tab.classList.remove('active');
    });
    var activeTab = document.querySelector('[data-report="' + type + '"]');
    if (activeTab) activeTab.classList.add('active');

    var area = document.getElementById('fr-report-area');

    var callInfo = (
      '<span class="fr-report-section-title">Call Information</span>' +
      fldRow([
        ['CALL ID', 129, 'fr-rc-id'],   ['OSC',             184, 'fr-rc-osc'],
        ['Call Title', 348, 'fr-rc-title'], ['Location of Call', 620, 'fr-rc-loc'],
        ['Priority', 185, 'fr-rc-prio'], ['Status',           184, 'fr-rc-stat'],
      ]) +
      '<div style="margin:8px 0;">' +
        '<p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.55);margin-bottom:4px;">Units</p>' +
        '<div style="background:#333;border-radius:10px;height:56px;padding:0 12px;display:flex;align-items:center;">' +
          '<input style="background:transparent;border:none;color:#fff;font-family:Inter,sans-serif;' +
            'font-size:17px;font-weight:700;outline:none;width:100%;" placeholder="Unit callsigns...">' +
        '</div>' +
      '</div>'
    );

    var personInfo = (
      fldRow([
        ['First Name', 349, 'r-fn'],  ['Last Name', 348, 'r-ln'],
        ['D.O.B',      184, 'r-dob'], ['AGE',       184, 'r-age'],
        ['Gender',     185, 'r-gen'], ['Occupation', 393, 'r-occ'],
      ]) +
      fldRow([
        ['Height',    349, 'r-h'],    ['Weight',   348, 'r-w'],
        ['Skin Tone', 184, 'r-skin'], ['Hair Tone', 184, 'r-hair'],
        ['Eye Color', 185, 'r-eye'],  ['Address',   393, 'r-addr'],
      ])
    );

    var descArea = function (placeholder, height) {
      return (
        '<textarea style="width:100%;height:' + height + 'px;background:#333;border:none;border-radius:12px;' +
          'color:#fff;font-family:Inter,sans-serif;font-size:17px;padding:12px;outline:none;resize:none;" ' +
          'placeholder="' + placeholder + '"></textarea>'
      );
    };

    var submitBtn = (
      '<button class="act-btn act-btn-red fr-report-submit-btn" ' +
        'style="position:relative;margin-top:12px;width:200px;height:44px;font-size:24px;">' +
        'Submit' +
      '</button>'
    );

    var templates = {
      incident: (
        callInfo +
        '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Details</span>' +
        descArea('Incident details...', 180) +
        submitBtn
      ),
      medical: (
        callInfo +
        '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Patient Information</span>' +
        personInfo +
        '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Medical Procedure</span>' +
        descArea('Medical actions taken...', 150) +
        submitBtn
      ),
      death: (
        callInfo +
        '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Patient Information</span>' +
        personInfo +
        '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Medical Procedure / Cause</span>' +
        descArea('Cause of death / actions taken...', 150) +
        submitBtn
      ),
    };

    area.innerHTML = templates[type] || '';

    // Wire submit buttons after render
    area.querySelectorAll('.fr-report-submit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        alert(type.charAt(0).toUpperCase() + type.slice(1) + ' Report submitted successfully!');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     CALL HISTORY
  ═══════════════════════════════════════════════════════════ */
  function frRenderHistory(list) {
    var el = document.getElementById('fr-history-list');
    if (!list.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);">No calls found</div>';
      return;
    }
    el.innerHTML = list.map(function (c) {
      return (
        '<div class="tbl-row">' +
          '<span class="fr-hist-cell fr-hist-cell-callnum">'  + c.id       + '</span>' +
          '<span class="fr-hist-cell fr-hist-cell-nature">'   + c.nature   + '</span>' +
          '<span class="fr-hist-cell fr-hist-cell-location">' + c.location + '</span>' +
          '<span class="fr-hist-cell fr-hist-cell-priority" style="color:' + priorityColour(c.priority) + '">' + c.priority + '</span>' +
          '<span class="fr-hist-cell">' + c.unit + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function frFilterHistory() {
    var q = document.getElementById('fr-hist-search').value.toLowerCase();
    var filtered = FR_HISTORY.filter(function (c) {
      return String(c.id).includes(q) || c.nature.toLowerCase().includes(q);
    });
    frRenderHistory(filtered);
  }

  /* ═══════════════════════════════════════════════════════════
     INITIALISE — wire all event listeners after DOM is ready
  ═══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── Panel navigation ──────────────────────────────────── */
    document.getElementById('fr-nav-clockout').addEventListener('click', function () {
      window.location.href = 'server-page.html';
    });

    var navPanels = ['home', 'map', 'cad', 'search', 'reports', 'callhistory', 'notepad'];
    navPanels.forEach(function (p) {
      var btn = document.getElementById('fr-nav-' + p);
      if (btn) {
        btn.addEventListener('click', function () { showPanel(p); });
      }
    });

    /* ── Status buttons ────────────────────────────────────── */
    ['fr-status-available', 'fr-status-offduty', 'fr-status-onscene',
     'fr-status-arrived',   'fr-status-busy'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        btn.style.outline = '3px solid #fff';
        setTimeout(function () { btn.style.outline = ''; }, 600);
      });
    });

    /* ── CAD: Create Call modal ────────────────────────────── */
    document.getElementById('fr-btn-create-call').addEventListener('click', function () {
      openModal('fr-call-modal');
    });
    document.getElementById('fr-call-modal-close').addEventListener('click', function () {
      closeModal('fr-call-modal');
    });
    document.getElementById('fr-call-modal-create').addEventListener('click', frCreateCall);

    /* ── Search inputs ─────────────────────────────────────── */
    document.getElementById('fr-ped-search').addEventListener('input', frSearchPed);
    document.getElementById('fr-car-search').addEventListener('input', frSearchCar);

    /* ── PED detail close ──────────────────────────────────── */
    document.getElementById('fr-ped-detail-close').addEventListener('click', function () {
      closeModal('fr-ped-detail');
    });

    /* ── Report tabs ───────────────────────────────────────── */
    document.querySelectorAll('#panel-reports .report-tab[data-report]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        frShowReport(tab.dataset.report);
      });
    });

    /* ── History search ────────────────────────────────────── */
    document.getElementById('fr-hist-search').addEventListener('input', frFilterHistory);

    /* ── Initial state ─────────────────────────────────────── */
    showPanel('home');
    renderFRCalls();
    frRenderHistory(FR_HISTORY);
    frShowReport('incident');
  });

})();