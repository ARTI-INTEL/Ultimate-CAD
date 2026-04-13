/**
 * dot-cad.js — DOT CAD page behaviour
 *
 * Responsibilities:
 *  - Panel navigation
 *  - Modal open / close
 *  - Active call management (create / CODE 4)
 *  - PED + Vehicle search and detail popup
 *  - Report tab switching: Incident Report + Tow Report
 *  - Call history filtering and rendering
 *  - Status button feedback
 *
 * No inline event handlers or inline styles exist in dot-cad.html.
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
      var btn = document.getElementById('dot-nav-' + p);
      if (btn) btn.classList.remove('active');
    });
    document.getElementById('panel-' + id).classList.add('active');
    var activeBtn = document.getElementById('dot-nav-' + id);
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
  var dotCalls  = [];
  var dotCallId = 4001;

  var DOT_HISTORY = [
    { id: 4001, nature: 'Road Hazard',        location: 'Hwy 101 Mile 22',   priority: 'Medium', unit: 'D-1' },
    { id: 4002, nature: 'Pothole Report',      location: 'Main St near 5th', priority: 'Low',    unit: 'D-3' },
    { id: 4003, nature: 'Vehicle Breakdown',   location: 'Interstate 5',     priority: 'Medium', unit: 'D-2' },
    { id: 4004, nature: 'Traffic Signal Down', location: '3rd Ave & Oak St', priority: 'High',   unit: 'D-4' },
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
    {
      owner: 'John Smith', plate: 'ABC123', vehicle: 'Toyota Camry', color: 'White',
      vin: '1HGBH41JXMN109186', reg: '12/2025', ins: 'Active',  insExp: '06/2025',
    },
    {
      owner: 'Jane Doe',   plate: 'XYZ789', vehicle: 'Honda Civic',  color: 'Silver',
      vin: '2HGFG3B50CH100001', reg: '06/2026', ins: 'Expired', insExp: '01/2024',
    },
  ];

  /* ═══════════════════════════════════════════════════════════
     CAD: ACTIVE CALLS
  ═══════════════════════════════════════════════════════════ */
  function renderDotCalls() {
    var el = document.getElementById('dot-calls-list');
    if (!dotCalls.length) {
      el.innerHTML = '<div style="height:42px;"></div>';
      return;
    }

    el.innerHTML = dotCalls.map(function (c, i) {
      return (
        '<div class="tbl-row">' +
          '<span class="dot-cell dot-cell-callnum">' + c.id       + '</span>' +
          '<span class="dot-cell dot-cell-nature">'  + c.nature   + '</span>' +
          '<span class="dot-cell dot-cell-loc">'     + c.location + '</span>' +
          '<span class="dot-cell dot-cell-pri" style="color:' + priorityColour(c.priority) + '">' + c.priority + '</span>' +
          '<span class="dot-cell dot-cell-unit">—</span>' +
          '<button class="dot-close-call-btn" data-index="' + i + '">CODE 4</button>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.dot-close-call-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        dotCloseCall(parseInt(btn.dataset.index, 10));
      });
    });
  }

  function dotCreateCall() {
    var nature   = document.getElementById('dot-call-nature').value.trim()   || 'Unknown';
    var location = document.getElementById('dot-call-location').value.trim() || 'Unknown';
    var priority = document.getElementById('dot-call-priority').value;
    var status   = document.getElementById('dot-call-status').value;

    dotCalls.push({ id: dotCallId++, nature: nature, location: location, priority: priority, status: status });
    renderDotCalls();
    closeModal('dot-call-modal');

    ['dot-call-nature', 'dot-call-title', 'dot-call-location', 'dot-call-desc'].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = '';
    });
  }

  function dotCloseCall(index) {
    dotCalls.splice(index, 1);
    renderDotCalls();
  }

  /* ═══════════════════════════════════════════════════════════
     SEARCH
  ═══════════════════════════════════════════════════════════ */
  function dotSearchPed() {
    var q = document.getElementById('dot-ped-search').value.toLowerCase().trim();
    var results = q.length < 2
      ? []
      : MOCK_PEDS.filter(function (p) {
          return p.fn.toLowerCase().includes(q) || p.ln.toLowerCase().includes(q);
        });

    var el = document.getElementById('dot-ped-results');
    if (!results.length) {
      el.innerHTML = '<div style="height:42px;"></div>';
      return;
    }

    el.innerHTML = results.map(function (p) {
      var i = MOCK_PEDS.indexOf(p);
      return (
        '<div class="tbl-row dot-ped-row" data-ped-index="' + i + '">' +
          '<span style="font-size:19px;color:#fff;flex:1;">' + p.fn + '</span>' +
          '<span style="font-size:19px;color:#fff;">'        + p.ln + '</span>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.dot-ped-row').forEach(function (row) {
      row.addEventListener('click', function () {
        dotShowPed(parseInt(row.dataset.pedIndex, 10));
      });
    });
  }

  function dotSearchCar() {
    var q = document.getElementById('dot-car-search').value.toLowerCase().trim();
    var results = q.length < 2
      ? []
      : MOCK_CARS.filter(function (c) {
          return c.plate.toLowerCase().includes(q) || c.vin.toLowerCase().includes(q);
        });

    document.getElementById('dot-car-results').innerHTML = results.length
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

  function dotShowPed(index) {
    var p = MOCK_PEDS[index];
    var fields = [
      ['First Name', p.fn],   ['Last Name', p.ln],    ['D.O.B',      p.dob],
      ['AGE',        p.age],  ['Gender',   p.gender], ['Occupation', p.occ],
      ['Height',     p.height], ['Weight', p.weight], ['Skin Tone',  p.skin],
      ['Hair Tone',  p.hair],   ['Eye Color', p.eye], ['Address',    p.addr],
    ];

    document.getElementById('dot-ped-detail-content').innerHTML = fields.map(function (f) {
      return (
        '<div class="dot-detail-field">' +
          '<div class="dot-detail-label">' + f[0] + '</div>' +
          '<div class="dot-detail-value">' + f[1] + '</div>' +
        '</div>'
      );
    }).join('');

    openModal('dot-ped-detail');
  }

  /* ═══════════════════════════════════════════════════════════
     REPORTS — shared field builder (matches project pattern)
  ═══════════════════════════════════════════════════════════ */
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

  function unitsField() {
    return (
      '<div style="margin:8px 0;">' +
        '<p style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.55);margin-bottom:4px;">Units</p>' +
        '<div style="background:#333;border-radius:10px;height:56px;padding:0 12px;display:flex;align-items:center;">' +
          '<input style="background:transparent;border:none;color:#fff;font-family:Inter,sans-serif;' +
            'font-size:17px;font-weight:700;outline:none;width:100%;" placeholder="Unit callsigns...">' +
        '</div>' +
      '</div>'
    );
  }

  function descArea(placeholder, height) {
    return (
      '<textarea style="width:100%;height:' + height + 'px;background:#333;border:none;border-radius:12px;' +
        'color:#fff;font-family:Inter,sans-serif;font-size:17px;padding:12px;outline:none;resize:none;" ' +
        'placeholder="' + placeholder + '"></textarea>'
    );
  }

  function submitBtn(reportType) {
    return (
      '<button class="act-btn act-btn-amber dot-report-submit-btn" ' +
        'data-report-type="' + reportType + '" ' +
        'style="position:relative;margin-top:12px;width:200px;height:44px;font-size:24px;">' +
        'Submit' +
      '</button>'
    );
  }

  function dotShowReport(type) {
    // Update tab active state
    document.querySelectorAll('#panel-reports .report-tab').forEach(function (tab) {
      tab.classList.remove('active');
    });
    var activeTab = document.querySelector('[data-report="' + type + '"]');
    if (activeTab) activeTab.classList.add('active');

    var area = document.getElementById('dot-report-area');

    var callInfo = (
      '<span class="dot-report-section-title">Call Information</span>' +
      fldRow([
        ['CALL ID', 129, 'dot-rc-id'], ['OSC',             184, 'dot-rc-osc'],
        ['Call Title', 348, 'dot-rc-title'], ['Location of Call', 620, 'dot-rc-loc'],
        ['Priority', 185, 'dot-rc-prio'], ['Status',           184, 'dot-rc-stat'],
      ]) +
      unitsField()
    );

    var templates = {
      incident: (
        callInfo +
        '<span class="dot-report-section-title mt">Details</span>' +
        descArea('Incident details...', 200) +
        submitBtn('incident')
      ),

      tow: (
        callInfo +
        '<span class="dot-report-section-title mt">Vehicle Information</span>' +
        fldRow([
          ['Brand Model', 349, 'tow-brand'],   ['Color',   348, 'tow-color'],
          ['Plate',       185, 'tow-plate'],   ['VIN',     185, 'tow-vin'],
          ['Reg Expiry',  185, 'tow-reg'],     ['Owner',   393, 'tow-owner'],
        ]) +
        fldRow([
          ['Insurance Status', 349, 'tow-ins'],
          ['Insurance Expiry', 348, 'tow-insexp'],
        ]) +
        submitBtn('tow')
      ),
    };

    area.innerHTML = templates[type] || '';

    // Wire submit buttons after render
    area.querySelectorAll('.dot-report-submit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rType = btn.dataset.reportType;
        var label = rType === 'tow' ? 'Tow Report' : 'Incident Report';
        alert(label + ' submitted successfully!');
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     CALL HISTORY
  ═══════════════════════════════════════════════════════════ */
  function dotRenderHistory(list) {
    var el = document.getElementById('dot-history-list');
    if (!list.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);">No calls found</div>';
      return;
    }
    el.innerHTML = list.map(function (c) {
      return (
        '<div class="tbl-row">' +
          '<span class="dot-hist-cell dot-hist-cell-callnum">'  + c.id       + '</span>' +
          '<span class="dot-hist-cell dot-hist-cell-nature">'   + c.nature   + '</span>' +
          '<span class="dot-hist-cell dot-hist-cell-location">' + c.location + '</span>' +
          '<span class="dot-hist-cell dot-hist-cell-priority" style="color:' + priorityColour(c.priority) + '">' + c.priority + '</span>' +
          '<span class="dot-hist-cell">' + c.unit + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function dotFilterHistory() {
    var q = document.getElementById('dot-hist-search').value.toLowerCase();
    var filtered = DOT_HISTORY.filter(function (c) {
      return String(c.id).includes(q) || c.nature.toLowerCase().includes(q);
    });
    dotRenderHistory(filtered);
  }

  /* ═══════════════════════════════════════════════════════════
     INITIALISE — wire all event listeners after DOM is ready
  ═══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── Panel navigation ──────────────────────────────────── */
    document.getElementById('dot-nav-clockout').addEventListener('click', function () {
      window.location.href = 'server-page.html';
    });

    PANELS.forEach(function (p) {
      var btn = document.getElementById('dot-nav-' + p);
      if (btn) {
        btn.addEventListener('click', function () { showPanel(p); });
      }
    });

    /* ── Status buttons ────────────────────────────────────── */
    ['dot-status-available', 'dot-status-offduty', 'dot-status-onscene',
     'dot-status-arrived',   'dot-status-busy'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        btn.style.outline = '3px solid #000';
        setTimeout(function () { btn.style.outline = ''; }, 600);
      });
    });

    /* ── CAD: Create Call modal ────────────────────────────── */
    document.getElementById('dot-btn-create-call').addEventListener('click', function () {
      openModal('dot-call-modal');
    });
    document.getElementById('dot-call-modal-close').addEventListener('click', function () {
      closeModal('dot-call-modal');
    });
    document.getElementById('dot-call-modal-create').addEventListener('click', dotCreateCall);

    /* ── Search inputs ─────────────────────────────────────── */
    document.getElementById('dot-ped-search').addEventListener('input', dotSearchPed);
    document.getElementById('dot-car-search').addEventListener('input', dotSearchCar);

    /* ── PED detail close ──────────────────────────────────── */
    document.getElementById('dot-ped-detail-close').addEventListener('click', function () {
      closeModal('dot-ped-detail');
    });

    /* ── Report tabs ───────────────────────────────────────── */
    document.querySelectorAll('#panel-reports .report-tab[data-report]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        dotShowReport(tab.dataset.report);
      });
    });

    /* ── History search ────────────────────────────────────── */
    document.getElementById('dot-hist-search').addEventListener('input', dotFilterHistory);

    /* ── Initial state ─────────────────────────────────────── */
    showPanel('home');
    renderDotCalls();
    dotRenderHistory(DOT_HISTORY);
    dotShowReport('incident');
  });

})();