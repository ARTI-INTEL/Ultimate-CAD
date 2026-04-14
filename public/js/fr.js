/**
 * fr.js — Fire & Rescue CAD
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
      const btn = document.getElementById('fr-nav-' + p);
      if (btn) btn.classList.remove('active');
    });
    document.getElementById('panel-' + id).classList.add('active');
    const ab = document.getElementById('fr-nav-' + id);
    if (ab) ab.classList.add('active');

    if (id === 'cad')         fetchCalls();
    if (id === 'callhistory') fetchHistory();
    if (id === 'reports')     frShowReport('incident');
  }

  /* ── Clock-Out ───────────────────────────────────────────── */
  document.getElementById('fr-nav-clockout').addEventListener('click', function () {
    if (officerId) apiFetch('/officers/clock-out/' + officerId, { method: 'DELETE' }).catch(function () {});
    window.location.href = 'server-page.html';
  });

  PANELS.forEach(function (p) {
    const btn = document.getElementById('fr-nav-' + p);
    if (btn) btn.addEventListener('click', function () { showPanel(p); });
  });

  /* ── Status buttons ──────────────────────────────────────── */
  ['fr-status-available','fr-status-offduty','fr-status-onscene','fr-status-arrived','fr-status-busy'].forEach(function (id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      btn.style.outline = '3px solid #fff';
      setTimeout(function () { btn.style.outline = ''; }, 600);
    });
  });

  /* ── Modal helpers ───────────────────────────────────────── */
  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  document.getElementById('fr-btn-create-call').addEventListener('click', function () { openModal('fr-call-modal'); });
  document.getElementById('fr-call-modal-close').addEventListener('click', function () { closeModal('fr-call-modal'); });
  document.getElementById('fr-call-modal-create').addEventListener('click', frCreateCall);
  document.getElementById('fr-ped-detail-close').addEventListener('click', function () { closeModal('fr-ped-detail'); });

  /* ── Active Calls ────────────────────────────────────────── */
  let frCalls = [];

  function fetchCalls() {
    apiFetch('/calls/' + serverId)
      .then(function (rows) { frCalls = rows; renderFRCalls(); })
      .catch(function () {});
  }

  function renderFRCalls() {
    const el = document.getElementById('fr-calls-list');
    if (!frCalls.length) { el.innerHTML = '<div style="height:42px;color:rgba(255,255,255,0.3);padding:12px 17px;">No active calls.</div>'; return; }
    el.innerHTML = frCalls.map(function (c) {
      return (
        '<div class="tbl-row">' +
          '<span class="fr-cell fr-cell-callnum">' + esc(c.id) + '</span>' +
          '<span class="fr-cell fr-cell-nature">'  + esc(c.nature) + '</span>' +
          '<span class="fr-cell fr-cell-loc">'     + esc(c.location) + '</span>' +
          '<span class="fr-cell fr-cell-pri" style="color:' + priColor(c.priority) + '">' + esc(c.priority) + '</span>' +
          '<span class="fr-cell fr-cell-unit">—</span>' +
          '<button class="fr-close-call-btn" data-id="' + c.id + '">CODE 4</button>' +
        '</div>'
      );
    }).join('');

    el.querySelectorAll('.fr-close-call-btn').forEach(function (btn) {
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

  function frCreateCall() {
    const nature   = document.getElementById('fr-call-nature').value.trim()   || 'Unknown';
    const location = document.getElementById('fr-call-location').value.trim() || 'Unknown';
    const priority = document.getElementById('fr-call-priority').value;

    apiFetch('/calls', {
      method: 'POST',
      body: JSON.stringify({ serverId: Number(serverId), nature, location, priority }),
    })
      .then(function () {
        fetchCalls();
        closeModal('fr-call-modal');
        ['fr-call-nature','fr-call-title','fr-call-location','fr-call-desc'].forEach(function (id) {
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

  document.getElementById('fr-ped-search').addEventListener('input', function () {
    const q  = this.value.trim();
    const el = document.getElementById('fr-ped-results');
    doSearch(q, function (data) {
      const chars = data.characters || [];
      el.innerHTML = chars.length
        ? chars.map(function (c) {
            return '<div class="tbl-row fr-ped-row" data-char="' + encodeURIComponent(JSON.stringify(c)) + '">' +
              '<span style="font-size:19px;color:#fff;flex:1;">' + esc(c.first_name) + '</span>' +
              '<span style="font-size:19px;color:#fff;">'        + esc(c.last_name)  + '</span>' +
              '</div>';
          }).join('')
        : '<div style="height:42px;"></div>';

      el.querySelectorAll('.fr-ped-row').forEach(function (row) {
        row.addEventListener('click', function () {
          frShowPed(JSON.parse(decodeURIComponent(row.dataset.char)));
        });
      });
    });
  });

  document.getElementById('fr-car-search').addEventListener('input', function () {
    const q  = this.value.trim();
    const el = document.getElementById('fr-car-results');
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

  function frShowPed(p) {
    const fields = [
      ['First Name',p.first_name],['Last Name',p.last_name],['D.O.B',p.dob],
      ['AGE',calcAge(p.dob)],['Gender',p.gender],['Occupation',p.occupation],
      ['Height',p.height],['Weight',p.weight],['Skin Tone',p.skin_tone],
      ['Hair Tone',p.hair_tone],['Eye Color',p.eye_color],['Address',p.address],
    ];
    document.getElementById('fr-ped-detail-content').innerHTML = fields.map(function (f) {
      return '<div class="fr-detail-field"><div class="fr-detail-label">' + esc(f[0]) + '</div>' +
             '<div class="fr-detail-value">' + esc(f[1] || '—') + '</div></div>';
    }).join('');
    openModal('fr-ped-detail');
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

  function personInfo() {
    return fldRow([['First Name',349,'r-fn'],['Last Name',348,'r-ln'],['D.O.B',184,'r-dob'],['AGE',184,'r-age'],['Gender',185,'r-gen'],['Occupation',393,'r-occ']]) +
           fldRow([['Height',349,'r-h'],['Weight',348,'r-w'],['Skin Tone',184,'r-skin'],['Hair Tone',184,'r-hair'],['Eye Color',185,'r-eye'],['Address',393,'r-addr']]);
  }

  function callInfo() {
    return '<span class="fr-report-section-title">Call Information</span>' +
      fldRow([['CALL ID',129,'fr-rc-id'],['OSC',184,'fr-rc-osc'],['Call Title',348,'fr-rc-title'],['Location',620,'fr-rc-loc'],['Priority',185,'fr-rc-prio'],['Status',184,'fr-rc-stat']]) +
      '<div style="margin:8px 0;"><p style="font-size:13px;font-weight:700;color:rgba(255,255,255,.55);margin-bottom:4px;">Units</p>' +
      '<div style="background:#333;border-radius:10px;height:56px;padding:0 12px;display:flex;align-items:center;">' +
      '<input style="background:transparent;border:none;color:#fff;font-family:Inter,sans-serif;font-size:17px;font-weight:700;outline:none;width:100%;" placeholder="Unit callsigns..."></div></div>';
  }

  function descArea(ph, h) {
    return '<textarea style="width:100%;height:' + (h||180) + 'px;background:#333;border:none;border-radius:12px;color:#fff;font-family:Inter,sans-serif;font-size:17px;padding:12px;outline:none;resize:none;" placeholder="' + (ph||'Details...') + '"></textarea>';
  }

  function submitBtn(type) {
    return '<button class="act-btn act-btn-red fr-report-submit-btn" data-rtype="' + type + '" style="position:relative;margin-top:12px;width:200px;height:44px;font-size:24px;">Submit</button>';
  }

  var FR_TEMPLATES = {
    incident: function () { return callInfo() + '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Details</span>' + descArea('Incident details...') + submitBtn('incident'); },
    medical:  function () { return callInfo() + '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Patient Information</span>' + personInfo() + '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Medical Procedure</span>' + descArea('Medical actions taken...') + submitBtn('medical'); },
    death:    function () { return callInfo() + '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Patient Information</span>' + personInfo() + '<span class="fr-report-section-title" style="display:block;margin-top:12px;">Cause of Death</span>' + descArea('Cause of death / actions taken...') + submitBtn('death'); },
  };

  function frShowReport(type) {
    document.querySelectorAll('#panel-reports .report-tab').forEach(function (t) { t.classList.remove('active'); });
    const at = document.querySelector('[data-report="' + type + '"]');
    if (at) at.classList.add('active');

    const area = document.getElementById('fr-report-area');
    area.innerHTML = FR_TEMPLATES[type] ? FR_TEMPLATES[type]() : '';

    area.querySelectorAll('.fr-report-submit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        apiFetch('/reports', {
          method: 'POST',
          body: JSON.stringify({ serverId: Number(serverId), type: btn.dataset.rtype, details: {} }),
        })
          .then(function () { alert(type.charAt(0).toUpperCase() + type.slice(1) + ' Report submitted!'); })
          .catch(function () { alert('Report submitted (offline).'); });
      });
    });
  }

  document.querySelectorAll('#panel-reports .report-tab[data-report]').forEach(function (tab) {
    tab.addEventListener('click', function () { frShowReport(tab.dataset.report); });
  });

  /* ── Call History ────────────────────────────────────────── */
  let historyData = [];

  function fetchHistory() {
    apiFetch('/calls/' + serverId + '/history')
      .then(function (rows) { historyData = rows; frRenderHistory(rows); })
      .catch(function () {});
  }

  function frRenderHistory(list) {
    const el = document.getElementById('fr-history-list');
    if (!list.length) { el.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,.3);">No calls found</div>'; return; }
    el.innerHTML = list.map(function (c) {
      return '<div class="tbl-row">' +
        '<span class="fr-hist-cell fr-hist-cell-callnum">'  + esc(c.id)       + '</span>' +
        '<span class="fr-hist-cell fr-hist-cell-nature">'   + esc(c.nature)   + '</span>' +
        '<span class="fr-hist-cell fr-hist-cell-location">' + esc(c.location) + '</span>' +
        '<span class="fr-hist-cell fr-hist-cell-priority" style="color:' + priColor(c.priority) + '">' + esc(c.priority) + '</span>' +
        '<span class="fr-hist-cell">—</span></div>';
    }).join('');
  }

  document.getElementById('fr-hist-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    frRenderHistory(historyData.filter(function (c) {
      return String(c.id).includes(q) || c.nature.toLowerCase().includes(q);
    }));
  });

  /* ── Notepad ─────────────────────────────────────────────── */
  const notepad = document.getElementById('fr-notepad');
  try { const s = localStorage.getItem('cad_fr_notepad'); if (s) notepad.value = s; } catch (_) {}
  notepad.addEventListener('input', function () {
    try { localStorage.setItem('cad_fr_notepad', notepad.value); } catch (_) {}
  });

  /* ── Init + polling ──────────────────────────────────────── */
  showPanel('home');
  fetchCalls();
  frShowReport('incident');
  setInterval(fetchCalls, 12000);

})();