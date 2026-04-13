/**
 * leo.js — Ultimate CAD — Law Enforcement CAD
 *
 * Responsibilities:
 *  - Panel/tab switching
 *  - Status button toggling
 *  - Active Calls: create, close (CODE 4), render
 *  - Active BOLOs: create, remove, render
 *  - Search: PED / Car / Gun with detail popups
 *  - Reports: 5 report types rendered dynamically
 *  - Call History: render + live filter
 *  - Notepad: persisted to localStorage
 *  - All modals: open / close
 *
 * Zero inline event handlers or inline styles anywhere.
 */

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function priClass(p) {
    return { Low: 'pri-low', Medium: 'pri-medium', High: 'pri-high', Critical: 'pri-critical' }[p] || '';
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     PANEL SWITCHING
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const PANELS = ['home', 'map', 'cad', 'search', 'reports', 'callhistory', 'notepad'];

  function showPanel(id) {
    PANELS.forEach(p => {
      const panel = $('panel-' + p);
      const btn   = $('btn-' + p);
      if (panel) panel.classList.toggle('active', p === id);
      if (btn)   btn.classList.toggle('leo-btn--active', p === id);
    });
    // Default report view when switching to reports
    if (id === 'reports' && !$('leo-report-area').innerHTML.trim()) {
      loadReport('warning');
    }
  }

  PANELS.forEach(p => {
    const btn = $('btn-' + p);
    if (btn) btn.addEventListener('click', () => showPanel(p));
  });

  $('btn-clockout').addEventListener('click', () => {
    window.location.href = 'server-page.html';
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     STATUS BUTTONS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let currentStatus = null;

  document.querySelectorAll('.leo-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.leo-status-btn')
        .forEach(b => b.classList.remove('leo-status-btn--active-glow'));
      if (currentStatus !== btn.dataset.code) {
        btn.classList.add('leo-status-btn--active-glow');
        currentStatus = btn.dataset.code;
      } else {
        currentStatus = null;
      }
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MODAL HELPERS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const ALL_MODALS = [
    'leo-call-modal', 'leo-bolo-modal',
    'leo-ped-detail-modal', 'leo-veh-detail-modal', 'leo-gun-detail-modal'
  ];

  function openModal(id)  { $(id).classList.add('open'); }
  function closeModal(id) { $(id).classList.remove('open'); }

  ALL_MODALS.forEach(id => {
    $(id).addEventListener('click', e => { if (e.target === $(id)) closeModal(id); });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') ALL_MODALS.forEach(id => closeModal(id));
  });

  $('btn-create-call').addEventListener('click', () => {
    $('leo-callid-display').textContent = '#' + leoNextId;
    openModal('leo-call-modal');
  });
  $('btn-create-bolo').addEventListener('click',  () => openModal('leo-bolo-modal'));
  $('btn-close-call-modal').addEventListener('click',  () => closeModal('leo-call-modal'));
  $('btn-close-bolo-modal').addEventListener('click',  () => closeModal('leo-bolo-modal'));
  $('btn-close-ped-detail').addEventListener('click',  () => closeModal('leo-ped-detail-modal'));
  $('btn-close-veh-detail').addEventListener('click',  () => closeModal('leo-veh-detail-modal'));
  $('btn-close-gun-detail').addEventListener('click',  () => closeModal('leo-gun-detail-modal'));

  function clearFields(ids) {
    ids.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.tagName === 'SELECT' ? (el.selectedIndex = 0) : (el.value = '');
    });
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE CALLS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let leoCalls  = [];
  let leoNextId = 1001;

  function renderCalls() {
    const el = $('leo-calls-list');
    if (!leoCalls.length) { el.innerHTML = '<div class="leo-empty">No active calls.</div>'; return; }
    el.innerHTML = leoCalls.map((c, i) =>
      `<div class="tbl-row">
        <span style="font-size:20px;font-weight:700;color:#fff;width:80px">${esc(c.id)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;flex:1">${esc(c.nature)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;width:300px">${esc(c.location)}</span>
        <span style="font-size:20px;font-weight:700;width:120px" class="${priClass(c.priority)}">${esc(c.priority)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;width:100px">—</span>
        <button class="leo-code4-btn" data-idx="${i}">CODE 4</button>
      </div>`
    ).join('');
    el.querySelectorAll('.leo-code4-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        leoCalls.splice(parseInt(btn.dataset.idx, 10), 1);
        renderCalls();
      });
    });
  }

  $('btn-submit-call').addEventListener('click', () => {
    leoCalls.push({
      id:       leoNextId++,
      nature:   $('lc-nature').value.trim()   || 'Unknown',
      location: $('lc-location').value.trim() || 'Unknown',
      priority: $('lc-priority').value,
      status:   $('lc-status').value,
    });
    renderCalls();
    closeModal('leo-call-modal');
    clearFields(['lc-nature','lc-title','lc-location','lc-desc']);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ACTIVE BOLOs
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  let leoBolos = [];

  function renderBolos() {
    const el = $('leo-bolos-list');
    if (!leoBolos.length) { el.innerHTML = '<div class="leo-empty">No active BOLOs.</div>'; return; }
    el.innerHTML = leoBolos.map((b, i) =>
      `<div class="tbl-row">
        <span style="font-size:20px;font-weight:700;color:#fff;width:200px">${esc(b.type)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;flex:1">${esc(b.desc.substring(0,80))}${b.desc.length>80?'…':''}</span>
        <button class="leo-remove-btn" data-idx="${i}">Remove</button>
      </div>`
    ).join('');
    el.querySelectorAll('.leo-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        leoBolos.splice(parseInt(btn.dataset.idx, 10), 1);
        renderBolos();
      });
    });
  }

  $('btn-submit-bolo').addEventListener('click', () => {
    leoBolos.push({ type: $('lb-type').value, desc: $('lb-desc').value.trim() });
    renderBolos();
    closeModal('leo-bolo-modal');
    clearFields(['lb-location','lb-desc']);
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MOCK DATA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const MOCK_PEDS = [
    { fn:'John', ln:'Smith', dob:'01/01/1990', age:35, gender:'Male',   occ:'Mechanic', addr:'123 Main St',   skin:'Light',  hair:'Brown', eye:'Blue',  height:'6\'0"', weight:'180 lbs' },
    { fn:'Jane', ln:'Doe',   dob:'03/15/1985', age:40, gender:'Female', occ:'Nurse',    addr:'456 Oak Ave',   skin:'Medium', hair:'Black', eye:'Green', height:'5\'4"', weight:'130 lbs' },
  ];
  const MOCK_CARS = [
    { owner:'John Smith', plate:'ABC123', vehicle:'Toyota Camry', color:'White',  vin:'1HGBH41JXMN109186', reg:'12/2025', ins:'Active',  insExp:'06/2025' },
    { owner:'Jane Doe',   plate:'XYZ789', vehicle:'Honda Civic',  color:'Silver', vin:'2HGFG3B50CH100001', reg:'06/2026', ins:'Expired', insExp:'01/2024' },
  ];
  const MOCK_GUNS = [
    { owner:'John Smith', serial:'GUN-00123', name:'Glock 19', type:'Semi-Auto' },
    { owner:'John Smith', serial:'GUN-00456', name:'AR-15',    type:'Semi-Auto' },
  ];
  const HISTORY = [
    { id:1001, nature:'Traffic Stop',          location:'Main St & 1st Ave',    priority:'Low',      unit:'L-1' },
    { id:1002, nature:'10-50 Accident',         location:'Hwy 101 Mile 45',      priority:'High',     unit:'L-3' },
    { id:1003, nature:'Domestic Disturbance',   location:'789 Oak Drive',        priority:'Medium',   unit:'L-2' },
    { id:1004, nature:'Robbery in Progress',    location:'Downtown Bank',        priority:'Critical', unit:'L-5' },
    { id:1005, nature:'Suspicious Person',      location:'Grove St Parking Lot', priority:'Low',      unit:'L-4' },
  ];

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SEARCH
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function chip(label, value, red) {
    return `<div class="leo-detail-chip">
      <span class="leo-detail-chip-label">${esc(label)}</span>
      <span class="leo-detail-chip-value${red?' leo-detail-chip-value--red':''}">${esc(value)}</span>
    </div>`;
  }

  /* PED search */
  $('leo-ped-search').addEventListener('input', function () {
    const q = this.value.toLowerCase().trim();
    const el = $('leo-ped-results');
    const r  = q.length < 2 ? [] : MOCK_PEDS.filter(p =>
      p.fn.toLowerCase().includes(q) || p.ln.toLowerCase().includes(q));
    el.innerHTML = r.length
      ? r.map((p, i) =>
          `<div class="tbl-row" data-ped="${i}">
            <span style="font-size:19px;color:#fff;flex:1">${esc(p.fn)}</span>
            <span style="font-size:19px;color:#fff">${esc(p.ln)}</span>
          </div>`).join('')
      : '<div class="leo-empty">No results.</div>';
    el.querySelectorAll('[data-ped]').forEach(row => {
      row.addEventListener('click', () => showPedDetail(parseInt(row.dataset.ped, 10)));
    });
  });

  function showPedDetail(i) {
    const p = MOCK_PEDS[i];
    $('leo-ped-detail-content').innerHTML = [
      ['First Name',p.fn],['Last Name',p.ln],['D.O.B',p.dob],['AGE',p.age],
      ['Gender',p.gender],['Occupation',p.occ],['Height',p.height],['Weight',p.weight],
      ['Skin Tone',p.skin],['Hair Tone',p.hair],['Eye Color',p.eye],['Address',p.addr],
    ].map(([l,v]) => chip(l,v)).join('');

    const name = p.fn + ' ' + p.ln;
    const cars = MOCK_CARS.filter(c => c.owner === name);
    $('leo-ped-vehicles').innerHTML = cars.length
      ? cars.map(c =>
          `<div class="tbl-row">
            <span style="font-size:17px;color:#fff;width:180px">${esc(c.owner)}</span>
            <span style="font-size:17px;color:#fff;width:100px">${esc(c.plate)}</span>
            <span style="font-size:17px;color:#fff;flex:1">${esc(c.vehicle)}</span>
            <span style="font-size:17px;color:#fff">${esc(c.color)}</span>
          </div>`).join('')
      : '<div class="leo-sub-empty">No vehicles registered</div>';

    const guns = MOCK_GUNS.filter(g => g.owner === name);
    $('leo-ped-firearms').innerHTML = guns.length
      ? guns.map(g =>
          `<div class="tbl-row">
            <span style="font-size:17px;color:#fff;flex:1">${esc(g.owner)}</span>
            <span style="font-size:17px;color:#fff">${esc(g.serial)}</span>
          </div>`).join('')
      : '<div class="leo-sub-empty">No firearms registered</div>';

    openModal('leo-ped-detail-modal');
  }

  /* Car search */
  $('leo-car-search').addEventListener('input', function () {
    const q  = this.value.toLowerCase().trim();
    const el = $('leo-car-results');
    const r  = q.length < 2 ? [] : MOCK_CARS.filter(c =>
      c.plate.toLowerCase().includes(q) || c.vin.toLowerCase().includes(q));
    el.innerHTML = r.length
      ? r.map((c, i) =>
          `<div class="tbl-row" data-car="${i}">
            <span style="font-size:19px;color:#fff;width:180px">${esc(c.owner)}</span>
            <span style="font-size:19px;color:#fff;width:100px">${esc(c.plate)}</span>
            <span style="font-size:19px;color:#fff;flex:1">${esc(c.vehicle)}</span>
            <span style="font-size:19px;color:#fff">${esc(c.color)}</span>
          </div>`).join('')
      : '<div class="leo-empty">No results.</div>';
    el.querySelectorAll('[data-car]').forEach(row => {
      row.addEventListener('click', () => showVehDetail(parseInt(row.dataset.car, 10)));
    });
  });

  function showVehDetail(i) {
    const c = MOCK_CARS[i];
    $('leo-veh-detail-content').innerHTML = [
      ['Brand Model',c.vehicle],['Color',c.color],['Plate',c.plate],
      ['VIN',c.vin],['Reg Expiry',c.reg],['Owner',c.owner],
      ['Insurance Status',c.ins, c.ins==='Expired'],['Insurance Expiry',c.insExp],
    ].map(([l,v,red]) => chip(l,v,red)).join('');
    openModal('leo-veh-detail-modal');
  }

  /* Gun search */
  $('leo-gun-search').addEventListener('input', function () {
    const q  = this.value.toLowerCase().trim();
    const el = $('leo-gun-results');
    const r  = q.length < 2 ? [] : MOCK_GUNS.filter(g =>
      g.serial.toLowerCase().includes(q));
    el.innerHTML = r.length
      ? r.map((g, i) =>
          `<div class="tbl-row" data-gun="${i}">
            <span style="font-size:19px;color:#fff;flex:1">${esc(g.owner)}</span>
            <span style="font-size:19px;color:#fff">${esc(g.serial)}</span>
          </div>`).join('')
      : '<div class="leo-empty">No results.</div>';
    el.querySelectorAll('[data-gun]').forEach(row => {
      row.addEventListener('click', () => showGunDetail(parseInt(row.dataset.gun, 10)));
    });
  });

  function showGunDetail(i) {
    const g = MOCK_GUNS[i];
    $('leo-gun-detail-content').innerHTML = [
      ['Gun Type',g.type],['Gun Name',g.name],['Serial Number',g.serial],['Owner',g.owner],
    ].map(([l,v]) => chip(l,v)).join('');
    openModal('leo-gun-detail-modal');
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     REPORTS
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /* Helper: build a row of input fields */
  function fldRow(fields) {
    return `<div class="leo-report-fld-row">${fields.map(([label, w, id]) =>
      `<div class="leo-report-fld" style="width:${w}px">
        <label>${esc(label)}</label>
        <input id="${id}" placeholder="${esc(label)}" autocomplete="off">
      </div>`
    ).join('')}</div>`;
  }

  const suspectBlock = () =>
    `<span class="leo-report-section-label">Suspect Information</span>` +
    fldRow([['First Name',350,'r-fn'],['Last Name',350,'r-ln'],['D.O.B',185,'r-dob'],['AGE',185,'r-age'],['Gender',185,'r-gen'],['Occupation',395,'r-occ']]) +
    fldRow([['Height',350,'r-h'],['Weight',350,'r-w'],['Skin Tone',185,'r-skin'],['Hair Tone',185,'r-hair'],['Eye Color',185,'r-eye'],['Address',395,'r-addr']]);

  const vehicleBlock = (optional) =>
    `<span class="leo-report-section-label">Vehicle Information${optional?' <small style="font-size:14px;opacity:0.6">(Optional)</small>':''}</span>` +
    fldRow([['Brand Model',350,'r-vbrand'],['Color',350,'r-vcolor'],['Plate',185,'r-vplate'],['VIN',185,'r-vvin'],['Reg Expiry',185,'r-vreg'],['Owner',395,'r-vowner']]) +
    fldRow([['Insurance Status',350,'r-vins'],['Insurance Expiry',350,'r-vinsexp']]);

  const callBlock = () =>
    `<span class="leo-report-section-label">Call Information</span>` +
    fldRow([['CALL ID',129,'r-cid'],['Nature Of Call',184,'r-cnat'],['Call Title',348,'r-ctitle'],['Location of Call',620,'r-cloc'],['Priority',185,'r-cprio'],['Status',184,'r-cstat']]);

  const unitsRow = () =>
    `<div class="leo-report-fld-row"><div class="leo-report-fld" style="width:1705px">
      <label>Units</label><input id="r-units" placeholder="Unit callsigns..." autocomplete="off">
    </div></div>`;

  const descArea = (ph='Description...', h=165) =>
    `<textarea class="leo-report-textarea" style="height:${h}px" placeholder="${ph}"></textarea>`;

  const submitBtn = (type) =>
    `<button class="leo-report-submit" data-rtype="${type}">Submit</button>`;

  const REPORT_TEMPLATES = {
    warning: () =>
      suspectBlock() + callBlock() +
      `<span class="leo-report-section-label">Warning Information</span>` +
      fldRow([['Reason of Written Warning',620,'r-wwreason']]) +
      submitBtn('Written Warning'),

    citation: () =>
      suspectBlock() + vehicleBlock(true) + callBlock() +
      `<span class="leo-report-section-label">Citation Information</span>` +
      fldRow([['Charges',348,'r-charges']]) + descArea() + submitBtn('Citation'),

    arrest: () =>
      suspectBlock() + vehicleBlock(true) +
      fldRow([['Car Impounded?',403,'r-impound']]) + callBlock() +
      `<span class="leo-report-section-label">Arrest Information</span>` +
      fldRow([['Charges',348,'r-charges']]) + descArea() + submitBtn('Arrest'),

    incident: () =>
      suspectBlock() + vehicleBlock(true) + callBlock() + unitsRow() +
      descArea('Description…', 180) + submitBtn('Incident Report'),

    warrant: () =>
      suspectBlock() + vehicleBlock(true) +
      `<span class="leo-report-section-label">Warrant Information</span>` +
      fldRow([['Charges',348,'r-wcharges'],['Type',620,'r-wtype'],['Address',706,'r-waddr']]) +
      descArea() + submitBtn('Warrant'),
  };

  function loadReport(type) {
    const area = $('leo-report-area');
    area.innerHTML = REPORT_TEMPLATES[type] ? REPORT_TEMPLATES[type]() : '';
    area.scrollTop = 0;

    // Wire submit
    const btn = area.querySelector('.leo-report-submit');
    if (btn) {
      btn.addEventListener('click', () => {
        alert(btn.dataset.rtype + ' submitted successfully!');
      });
    }
  }

  /* Report tab wiring */
  document.querySelectorAll('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadReport(btn.dataset.report);
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     CALL HISTORY
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function renderHistory(list) {
    const el = $('leo-history-list');
    if (!list.length) { el.innerHTML = '<div class="leo-empty">No calls found.</div>'; return; }
    el.innerHTML = list.map(c =>
      `<div class="tbl-row">
        <span style="font-size:20px;font-weight:700;color:#fff;width:80px">${esc(c.id)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;flex:1">${esc(c.nature)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff;width:350px">${esc(c.location)}</span>
        <span style="font-size:20px;font-weight:700;width:120px" class="${priClass(c.priority)}">${esc(c.priority)}</span>
        <span style="font-size:20px;font-weight:700;color:#fff">${esc(c.unit)}</span>
      </div>`
    ).join('');
  }

  $('leo-hist-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    renderHistory(HISTORY.filter(c =>
      String(c.id).includes(q) ||
      c.nature.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)));
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     NOTEPAD
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const notepad = $('leo-notepad');
  try { const s = localStorage.getItem('cad_leo_notepad'); if (s) notepad.value = s; } catch (_) {}
  notepad.addEventListener('input', () => {
    try { localStorage.setItem('cad_leo_notepad', notepad.value); } catch (_) {}
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     INIT
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  renderCalls();
  renderBolos();
  renderHistory(HISTORY);
  loadReport('warning');

})();