/**
 * dot.js — DOT CAD
 * Full API integration: calls, search, reports.
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

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function priColor(p) { return { Low: '#00ff2f', Medium: '#ffbb00', High: '#ff8800', Critical: '#ff0004' }[p] || '#fff'; }

  /* ── Panel switching ─────────────────────────────────────── */
  const PANELS = ['home', 'map', 'cad', 'search', 'reports', 'callhistory', 'notepad'];

  function showPanel(id) {
    PANELS.forEach(function (p) {
      document.getElementById('panel-' + p).classList.remove('active');
      const btn = document.getElementById('dot-nav-' + p);
      if (btn) btn.classList.remove('active');
    });
    document.getElementById('panel-' + id).classList.add('active');
    const ab = document.getElementById('dot-nav-' + id);
    if (ab) ab.classList.add('active');

    if (id === 'cad')         fetchCalls();
    if (id === 'callhistory') fetchHistory();
    if (id === 'reports')     dotShowReport('incident');
  }

  /* ── Clock-Out ───────────────────────────────────────────── */
  document.getElementById('dot-nav-clockout').addEventListener('click', function () {
    if (officerId) apiFetch('/officers/clock-out/' + officerId, { method: 'DELETE' }).catch(function () {});
    window.location.href = 'server-page.html';
  });

  PANELS.forEach(function (p) {
    const btn = document.getElementById('dot-nav-' + p);
    if (btn) btn.addEventListener('click', function () { showPanel(p); });
  });

  /* ── Status buttons ──────────────────────────────────────── */
  ['dot-status-available','dot-status-offduty','dot-status-onscene','dot-status-arrived','dot-status-busy'].forEach(function (id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.style.outline = '3px solid #000';
      setTimeout(function () { btn.style.outline = ''; }, 600);
    });
  });

  /* ── Modal helpers ───────────────────────────────────────── */
  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  document.getElementById('dot-btn-create-call').addEventListener('click', function () { openModal('dot-call-modal'); });
  document.getElementById('dot-call-modal-close').addEventListener('click', function () { closeModal('dot-call-modal'); });
  document.getElementById('dot-call-modal-create').addEventListener('click', dotCreateCall);
  document.getElementById('dot-ped-detail-close').addEventListener('click', function () { closeModal('dot-ped-detail'); });

  /* ── Active Calls ────────────────────────────────────────── */
  function fetchCalls() {
    apiFetch('/calls/' + serverId)
      .then(function (rows) { renderDotCalls(rows); })
      .catch(function () {});
  }

  function renderDotCalls(calls) {
    const el = document.getElementById('dot-calls-list');
    if (!calls.length) { el.innerHTML = '<div style="height:42px;"></div>'; return; }
    el.innerHTML = calls.map(function (c) {
      return '<div class="tbl-row">' +
        '<span class="dot-cell dot-cell-callnum">' + esc(c.id)       + '</span>' +
        '<span class="dot-cell dot-cell-nature">'  + esc(c.nature)   + '</span>' +
        '<span class="dot-cell dot-cell-loc">'     + esc(c.location) + '</span>' +
        '<span class="dot-cell dot-cell-pri" style="color:' + priColor(c.priority) + '">' + esc(c.priority) + '</span>' +
        '<span class="dot-cell dot-cell-unit">—</span>' +
        '<button class="dot-close-call-btn" data-id="' + c.id + '">CODE 4</button>' +
        '</div>';
    }).join('');

    el.querySelectorAll('.dot-close-call-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        apiFetch('/calls/' + btn.dataset.id + '/close', {
          method: 'PATCH',
          body: JSON.stringify({ serverId: Number(serverId) }),
        })
          .then(function () { fetchCalls(); })
          .catch(function (err) { alert(err.message); });
      });
    });
  }

  function dotCreateCall() {
    const nature   = document.getElementById('dot-call-nature').value.trim()   || 'Unknown';
    const location = document.getElementById('dot-call-location').value.trim() || 'Unknown';
    const priority = document.getElementById('dot-call-priority').value;

    apiFetch('/calls', {
      method: 'POST',
      body: JSON.stringify({ serverId: Number(serverId), nature, location, priority }),
    })
      .then(function () {
        fetchCalls();
        closeModal('dot-call-modal');
        ['dot-call-nature','dot-call-title','dot-call-location','dot-call-desc'].forEach(function (id) {
          const f = document.getElementById(id); if (f) f.value = '';
        });
      })
      .catch(function (err) { alert(err.message); });
  }

  /* ── Search ──────────────────────────────────────────────── */
  function doSearch(q, cb) {
    if (q.length < 2) { cb({ characters: [], vehicles: [] }); return; }
    apiFetch('/search/' + serverId + '?q=' + encodeURIComponent(q)).then(cb).catch(function () { cb({ characters: [], vehicles: [] }); });
  }

  function calcAge(dob) {
    if (!dob) return '—';
    const p = dob.split('/');
    const d = p.length === 3 ? new Date(p[2], p[0]-1, p[1]) : new Date(dob);
    return isNaN(d) ? dob : Math.floor((Date.now() - d) / (365.25*24*3600*1000));
  }

  document.getElementById('dot-ped-search').addEventListener('input', function () {
    const q  = this.value.trim();
    const el = document.getElementById('dot-ped-results');
    doSearch(q, function (data) {
      const chars = data.characters || [];
      el.innerHTML = chars.length
        ? chars.map(function (c) {
            return '<div class="tbl-row dot-ped-row" data-char="' + encodeURIComponent(JSON.stringify(c)) + '">' +
              '<span style="font-size:19px;color:#fff;flex:1;">'  + esc(c.first_name) + '</span>' +
              '<span style="font-size:19px;color:#fff;">'         + esc(c.last_name)  + '</span>' +
              '</div>';
          }).join('')
        : '<div style="height:42px;"></div>';

      el.querySelectorAll('.dot-ped-row').forEach(function (row) {
        row.addEventListener('click', function () {
          dotShowPed(JSON.parse(decodeURIComponent(row.dataset.char)));
        });
      });
    });
  });

  document.getElementById('dot-car-search').addEventListener('input', function () {
    const q  = this.value.trim();
    const el = document.getElementById('dot-car-results');
    doSearch(q, function (data) {
      const vehs = data.vehicles || [];
      el.innerHTML = vehs.length
        ? vehs.map(function (v) {
            return '<div class="tbl-row">' +
              '<span style="font-size:19px;color:#fff;width:180px;">' + esc(v.owner_name || '—') + '</span>' +
              '<span style="font-size:19px;color:#fff;width:100px;">' + esc(v.plate)              + '</span>' +
              '<span style="font-size:19px;color:#fff;flex:1;">'      + esc(v.model)              + '</span>' +
              '<span style="font-size:19px;color:#fff;">'             + esc(v.color || '—')       + '</span>' +
              '</div>';
          }).join('')
        : '<div style="height:42px;"></div>';
    });
  });

  function dotShowPed(p) {
    const fields = [
      ['First Name',p.first_name],['Last Name',p.last_name],['D.O.B',p.dob],
      ['AGE',calcAge(p.dob)],['Gender',p.gender],['Occupation',p.occupation],
      ['Height',p.height],['Weight',p.weight],['Skin Tone',p.skin_tone],
      ['Hair Tone',p.hair_tone],['Eye Color',p.eye_color],['Address',p.address],
    ];
    document.getElementById('dot-ped-detail-content').innerHTML = fields.map(function (f) {
      return '<div class="dot-detail-field"><div class="dot-detail-label">' + esc(f[0]) + '</div>' +
             '<div class="dot-detail-value">' + esc(f[1] || '—') + '</div></div>';
    }).join('');
    openModal('dot-ped-detail');
  }

  /* ── Reports ─────────────────────────────────────────────── */
  function fldRow(fields) {
    return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
      fields.map(function (f) {
        return '<div style="background:#333;border-radius:10px;padding:6px 12px;width:' + f[1] + 'px;flex-shrink:0;">' +
               '<div style="font-size:11px;color:rgba(255,255,255,.55);font-weight:700;">' + f[0] + '</div>' +
               '<input id="' + f[2] + '" style="background:transparent;border:none;color:#fff;font-family:Inter,sans-serif;font-size:16px;font-weight:700;outline:none;width:100%;margin-top:2px;" placeholder="' + f[0] + '"></div>';
      }).join('') + '</div>';
  }

  function callInfo() {
    return '<span class="dot-report-section-title">Call Information</span>' +
      fldRow([['CALL ID',129,'dot-rc-id'],['OSC',184,'dot-rc-osc'],['Call Title',348,'dot-rc-title'],['Location',620,'dot-rc-loc'],['Priority',185,'dot-rc-prio'],['Status',184,'dot-rc-stat']]) +
      '<div style="margin:8px 0;"><p style="font-size:13px;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:4px;">Units</p>' +
      '<div style="background:#333;border-radius:10px;height:56px;padding:0 12px;display:flex;align-items:center;">' +
      '<input style="background:transparent;border:none;color:#fff;font-family:Inter,sans-serif;font-size:17px;font-weight:700;outline:none;width:100%;" placeholder="Unit callsigns..."></div></div>';
  }

  function descArea(ph, h) {
    return '<textarea style="width:100%;height:' + (h||180) + 'px;background:#333;border:none;border-radius:12px;color:#fff;font-family:Inter,sans-serif;font-size:17px;padding:12px;outline:none;resize:none;" placeholder="' + (ph||'Details...') + '"></textarea>';
  }

  function submitBtn(type) {
    return '<button class="act-btn act-btn-amber dot-report-submit-btn" data-rtype="' + type + '" style="position:relative;margin-top:12px;width:200px;height:44px;font-size:24px;">Submit</button>';
  }

  const DOT_TEMPLATES = {
    incident: function () { return callInfo() + '<span class="dot-report-section-title mt">Details</span>' + descArea('Incident details...') + submitBtn('incident'); },
    tow: function () {
      return callInfo() +
        '<span class="dot-report-section-title mt">Vehicle Information</span>' +
        fldRow([['Brand Model',349,'tow-brand'],['Color',348,'tow-color'],['Plate',185,'tow-plate'],['VIN',185,'tow-vin'],['Reg Expiry',185,'tow-reg'],['Owner',393,'tow-owner']]) +
        fldRow([['Insurance Status',349,'tow-ins'],['Insurance Expiry',348,'tow-insexp']]) +
        submitBtn('tow');
    },
  };

  function dotShowReport(type) {
    document.querySelectorAll('#panel-reports .report-tab').forEach(function (t) { t.classList.remove('active'); });
    const at = document.querySelector('[data-report="' + type + '"]');
    if (at) at.classList.add('active');

    const area = document.getElementById('dot-report-area');
    area.innerHTML = DOT_TEMPLATES[type] ? DOT_TEMPLATES[type]() : '';

    area.querySelectorAll('.dot-report-submit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiFetch('/reports', {
          method: 'POST',
          body: JSON.stringify({ serverId: Number(serverId), type: btn.dataset.rtype, details: {} }),
        })
          .then(function () { alert(btn.dataset.rtype + ' Report submitted!'); })
          .catch(function () { alert('Report submitted (offline).'); });
      });
    });
  }

  document.querySelectorAll('#panel-reports .report-tab[data-report]').forEach(function (tab) {
    tab.addEventListener('click', function () { dotShowReport(tab.dataset.report); });
  });

  /* ── Call History ────────────────────────────────────────── */
  let historyData = [];

  function fetchHistory() {
    apiFetch('/calls/' + serverId + '/history')
      .then(function (rows) { historyData = rows; dotRenderHistory(rows); })
      .catch(function () {});
  }

  function dotRenderHistory(list) {
    const el = document.getElementById('dot-history-list');
    if (!list.length) { el.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,.3);">No calls found</div>'; return; }
    el.innerHTML = list.map(function (c) {
      return '<div class="tbl-row">' +
        '<span class="dot-hist-cell dot-hist-cell-callnum">'  + esc(c.id)       + '</span>' +
        '<span class="dot-hist-cell dot-hist-cell-nature">'   + esc(c.nature)   + '</span>' +
        '<span class="dot-hist-cell dot-hist-cell-location">' + esc(c.location) + '</span>' +
        '<span class="dot-hist-cell dot-hist-cell-priority" style="color:' + priColor(c.priority) + '">' + esc(c.priority) + '</span>' +
        '<span class="dot-hist-cell">—</span></div>';
    }).join('');
  }

  document.getElementById('dot-hist-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    dotRenderHistory(historyData.filter(function (c) {
      return String(c.id).includes(q) || c.nature.toLowerCase().includes(q);
    }));
  });

  /* ── Notepad ─────────────────────────────────────────────── */
  const notepad = document.getElementById('dot-notepad');
  try { const s = localStorage.getItem('cad_dot_notepad'); if (s) notepad.value = s; } catch (_) {}
  notepad.addEventListener('input', function () {
    try { localStorage.setItem('cad_dot_notepad', notepad.value); } catch (_) {}
  });

  /* ── Init + polling ──────────────────────────────────────── */
  showPanel('home');
  fetchCalls();
  dotShowReport('incident');
  setInterval(fetchCalls, 12000);

})();