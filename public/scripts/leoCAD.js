// ─────────────────────────────────────────────
//  CONSTANTS & STATE
// ─────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

const serverId = new URLSearchParams(window.location.search).get('serverId');
const userId   = localStorage.getItem('userId');
const officer  = JSON.parse(localStorage.getItem('loggedOfficer'));

// Redirect if not logged in
if (!officer || !serverId || !userId) {
  window.location.href = `server.html?serverId=${serverId}`;
}

// Auth header used on every request
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'x-user-id': userId,
};

// ─────────────────────────────────────────────
//  TOAST NOTIFICATIONS (replaces all alert()s)
// ─────────────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px;
    background: ${type === 'success' ? '#1e3a8a' : '#7f1d1d'};
    color: white; padding: 12px 20px; border-radius: 6px;
    font-family: Consolas, monospace; font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    z-index: 9999; opacity: 0; transition: opacity 0.2s;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ─────────────────────────────────────────────
//  API HELPERS
// ─────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...AUTH_HEADERS, ...(options.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    return res.json();
  } catch (err) {
    console.error(`API error [${path}]:`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────

window.onload = async () => {
  localStorage.setItem('serverId', serverId);
  await Promise.all([
    loadOfficers(),
    loadCalls(),
    loadBolos(),
  ]);
};

// ─────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────

const PAGES = ['home-page', 'map-page', 'cad-page', 'search-page', 'reports-page', 'history-page'];

function showPage(pageId) {
  closeAllPopups();
  PAGES.forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
}

function homeOpen()    { showPage('home-page'); }
function mapOpen()     { showPage('map-page'); }
function cadOpen()     { showPage('cad-page'); loadCalls(); loadBolos(); loadOfficers(); }
function searchOpen()  { showPage('search-page'); }
function reportsOpen() { showPage('reports-page'); }

async function historyOpen() {
  showPage('history-page');
  try {
    const calls = await apiFetch(`/calls/${serverId}/history`);
    renderHistoryTable(calls);
  } catch (_) {}
}

// ─────────────────────────────────────────────
//  CLOCK OUT
// ─────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await apiFetch(`/officers/clock-out/${officer.id}`, { method: 'DELETE' });
  } catch (_) {
    // Clock out best-effort — redirect regardless
  }
  localStorage.removeItem('loggedOfficer');
  window.location.href = `server.html?serverId=${serverId}&userId=${userId}`;
});

// ─────────────────────────────────────────────
//  STATUS BUTTONS
// ─────────────────────────────────────────────

document.querySelectorAll('.status-buttons button').forEach(button => {
  button.addEventListener('click', async () => {
    const newStatus = button.dataset.status;
    try {
      await apiFetch(`/officers/${officer.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          serverId,
          status: newStatus,
          location: officer.location || '',
          currentCall: officer.current_call || null,
        }),
      });
      officer.status = newStatus;
      localStorage.setItem('loggedOfficer', JSON.stringify(officer));
      await loadOfficers();
      showToast(`Status updated to ${newStatus}`);
    } catch (_) {}
  });
});

// ─────────────────────────────────────────────
//  OFFICERS TABLE
// ─────────────────────────────────────────────

function statusClass(status) {
  const map = {
    ENROUTE: 'enroute',
    AVAILABLE: 'available',
    BUSY: 'busy',
    UNAVAILABLE: 'unavailable',
    'ON SCENE': 'on-scene',
  };
  return map[status?.toUpperCase()] || '';
}

async function loadOfficers() {
  try {
    const officers = await apiFetch(`/officers/${serverId}`);
    renderOfficerTable(officers);
  } catch (_) {}
}

function renderOfficerTable(officers) {
  const tbody = document.getElementById('officers-body');
  tbody.innerHTML = '';
  officers.forEach(o => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${o.name}</td>
      <td>${o.callsign}</td>
      <td class="${statusClass(o.status)}">${o.status}</td>
      <td>${o.current_call ?? '—'}</td>
      <td>${o.department}</td>
      <td>${o.location || '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

// ─────────────────────────────────────────────
//  CALLS
// ─────────────────────────────────────────────

async function loadCalls() {
  try {
    const calls = await apiFetch(`/calls/${serverId}`);
    renderCallsTable(calls);
  } catch (_) {}
}

function renderCallsTable(calls) {
  const tbody = document.getElementById('calls-body');
  tbody.innerHTML = '';
  calls.forEach(call => {
    const row = document.createElement('tr');
    row.dataset.callId = call.id;
    row.innerHTML = `
      <td>${call.id}</td>
      <td>${call.nature}</td>
      <td>${call.location}</td>
      <td>${call.priority}</td>
      <td class="units">${call.units || '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderHistoryTable(calls) {
  const tbody = document.getElementById('history-body');
  tbody.innerHTML = '';
  calls.forEach(call => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${call.id}</td>
      <td>${call.nature}</td>
      <td>${call.location}</td>
      <td>${call.priority}</td>
      <td class="units">${call.units || '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

// Open create call popup
function createCallPopup() {
  document.getElementById('add-call-popup').classList.remove('hidden');
}

function closeCreateCallPopup() {
  document.getElementById('add-call-popup').classList.add('hidden');
  document.getElementById('create-call-form').reset();
}

// Submit new call
document.getElementById('create-call-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nature   = document.getElementById('call-nature').value.trim();
  const location = document.getElementById('call-location').value.trim();
  const priority = document.getElementById('call-priority').value;

  try {
    await apiFetch('/calls', {
      method: 'POST',
      body: JSON.stringify({ serverId, nature, location, priority }),
    });
    await loadCalls();
    closeCreateCallPopup();
    showToast('Call created successfully');
  } catch (_) {}
});

// Click a call row to edit it
document.getElementById('calls-table').addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (row && row.dataset.callId) openEditCallPopup(row);
});

function openEditCallPopup(row) {
  const popup = document.getElementById('edit-call-popup');
  popup.classList.remove('hidden');

  document.getElementById('call-ID').textContent   = `Call ID: ${row.dataset.callId}`;
  document.getElementById('edit-call-nature').value   = row.cells[1].textContent;
  document.getElementById('edit-call-location').value = row.cells[2].textContent;
  document.getElementById('edit-call-priority').value = row.cells[3].textContent;

  document.getElementById('call-attach').onclick = () => attachToCall(row);
  document.getElementById('code-4').onclick      = () => code4(row);
  document.getElementById('update-call').onclick = () => updateCall(row);
}

function closeEditCallPopup() {
  document.getElementById('edit-call-popup').classList.add('hidden');
  document.getElementById('edit-call-form').reset();
}

async function attachToCall(row) {
  const callId = row.dataset.callId;
  try {
    await apiFetch(`/officers/${officer.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        serverId,
        status: officer.status,
        location: officer.location || '',
        currentCall: callId,
      }),
    });
    officer.current_call = callId;
    localStorage.setItem('loggedOfficer', JSON.stringify(officer));
    await loadCalls();
    closeEditCallPopup();
    showToast('Attached to call');
  } catch (_) {}
}

async function code4(row) {
  const callId = row.dataset.callId;
  try {
    await apiFetch(`/calls/${callId}/close`, { method: 'PATCH', body: JSON.stringify({ serverId }) });
    await loadCalls();
    closeEditCallPopup();
    showToast('Call closed — CODE 4');
  } catch (_) {}
}

async function updateCall(row) {
  const callId   = row.dataset.callId;
  const nature   = document.getElementById('edit-call-nature').value.trim();
  const location = document.getElementById('edit-call-location').value.trim();
  const priority = document.getElementById('edit-call-priority').value;

  try {
    await apiFetch(`/calls/${callId}`, {
      method: 'PATCH',
      body: JSON.stringify({ serverId, nature, location, priority }),
    });
    await loadCalls();
    closeEditCallPopup();
    showToast('Call updated');
  } catch (_) {}
}

// ─────────────────────────────────────────────
//  BOLOs
// ─────────────────────────────────────────────

async function loadBolos() {
  try {
    const bolos = await apiFetch(`/bolos/${serverId}`);
    renderBolosTable(bolos);
  } catch (_) {}
}

function renderBolosTable(bolos) {
  const tbody = document.getElementById('bolo-body');
  tbody.innerHTML = '';
  bolos.forEach(bolo => {
    const row = document.createElement('tr');
    row.dataset.boloId = bolo.id;
    row.innerHTML = `
      <td>${bolo.type}</td>
      <td>${bolo.reason}</td>
      <td>${bolo.description}</td>
    `;
    tbody.appendChild(row);
  });
}

function createBoloPopup() {
  document.getElementById('add-bolo-popup').classList.remove('hidden');
}

function closeCreateBoloPopup() {
  document.getElementById('add-bolo-popup').classList.add('hidden');
  document.getElementById('create-bolo-form').reset();
}

document.getElementById('create-bolo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type        = document.getElementById('bolo-type').value;
  const reason      = document.getElementById('bolo-reason').value.trim();
  const description = document.getElementById('bolo-description').value.trim();

  try {
    await apiFetch('/bolos', {
      method: 'POST',
      body: JSON.stringify({ serverId, type, reason, description }),
    });
    await loadBolos();
    closeCreateBoloPopup();
    showToast('BOLO created');
  } catch (_) {}
});

document.getElementById('bolo-table').addEventListener('click', (e) => {
  const row = e.target.closest('tr');
  if (row && row.dataset.boloId) openEditBoloPopup(row);
});

function openEditBoloPopup(row) {
  const popup = document.getElementById('edit-bolo-popup');
  popup.classList.remove('hidden');

  document.getElementById('edit-bolo-type').value        = row.cells[0].textContent;
  document.getElementById('edit-bolo-reason').value      = row.cells[1].textContent;
  document.getElementById('edit-bolo-description').value = row.cells[2].textContent;

  document.getElementById('update-bolo').onclick = () => updateBolo(row);
  document.getElementById('delete-bolo').onclick = () => deleteBolo(row);
}

function closeEditBoloPopup() {
  document.getElementById('edit-bolo-popup').classList.add('hidden');
  document.getElementById('edit-bolo-form').reset();
}

async function updateBolo(row) {
  const boloId      = row.dataset.boloId;
  const type        = document.getElementById('edit-bolo-type').value;
  const reason      = document.getElementById('edit-bolo-reason').value.trim();
  const description = document.getElementById('edit-bolo-description').value.trim();

  try {
    await apiFetch(`/bolos/${boloId}`, {
      method: 'PATCH',
      body: JSON.stringify({ serverId, type, reason, description }),
    });
    await loadBolos();
    closeEditBoloPopup();
    showToast('BOLO updated');
  } catch (_) {}
}

async function deleteBolo(row) {
  const boloId = row.dataset.boloId;
  try {
    await apiFetch(`/bolos/${boloId}`, { method: 'DELETE', body: JSON.stringify({ serverId }) });
    await loadBolos();
    closeEditBoloPopup();
    showToast('BOLO ended');
  } catch (_) {}
}

// ─────────────────────────────────────────────
//  SEARCH
// ─────────────────────────────────────────────

async function handleSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return showToast('Please enter a search term', 'error');

  try {
    const { characters, vehicles, firearms } = await apiFetch(`/search/${serverId}?q=${encodeURIComponent(query)}`);

    const pedBody = document.getElementById('ped-table-body');
    pedBody.innerHTML = '';
    characters.forEach(c => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${c.first_name} ${c.last_name}</td>
        <td>${c.dob ?? '—'}</td>
        <td>${c.licenses ? JSON.stringify(c.licenses) : '—'}</td>
        <td>${c.flags ? JSON.stringify(c.flags) : '—'}</td>
      `;
      pedBody.appendChild(row);
    });

    const vicBody = document.getElementById('vic-table-body');
    vicBody.innerHTML = '';
    vehicles.forEach(v => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${v.plate}</td>
        <td>${v.vin ?? '—'}</td>
        <td>${v.owner_name ?? '—'}</td>
        <td>${v.model}</td>
      `;
      vicBody.appendChild(row);
    });

    const gunBody = document.getElementById('gun-table-body');
    gunBody.innerHTML = '';
    firearms.forEach(f => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${f.serial}</td>
        <td>${f.type}</td>
        <td>${f.owner_name ?? '—'}</td>
      `;
      gunBody.appendChild(row);
    });

    if (!characters.length && !vehicles.length && !firearms.length) {
      showToast('No results found', 'error');
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────
//  NOTEPAD
// ─────────────────────────────────────────────

function notesPopup() {
  document.getElementById('notepad-popup').classList.remove('hidden');
  document.getElementById('notepad-textarea').value = localStorage.getItem('notes') || '';
}

function closeNotepadPopup() {
  document.getElementById('notepad-popup').classList.add('hidden');
}

function saveNotes() {
  localStorage.setItem('notes', document.getElementById('notepad-textarea').value);
  showToast('Notes saved');
  closeNotepadPopup();
}

// ─────────────────────────────────────────────
//  REPORTS — popup open/close helpers
// ─────────────────────────────────────────────

const REPORT_POPUPS = {
  ww:          { popup: 'written-warning-popup',       form: 'written-warning-form' },
  cite:        { popup: 'citation-report-popup',       form: 'citation-report-form' },
  arrest:      { popup: 'arrest-report-popup',         form: 'arrest-report-form' },
  ir:          { popup: 'incident-report-popup',       form: 'incident-report-form' },
  uof:         { popup: 'uof-report-popup',            form: 'uof-report-form' },
  warrant:     { popup: 'warrant-report-popup',        form: 'warrant-report-form' },
  cr:          { popup: 'crash-report-popup',          form: 'crash-report-form' },
  ivr:         { popup: 'investigation-report-popup',  form: 'investigation-report-form' },
  aar:         { popup: 'after-action-report-popup',   form: 'after-action-report-form' },
};

function openReportPopup(key) {
  closeAllPopups();
  document.getElementById(REPORT_POPUPS[key].popup).classList.remove('hidden');
}

function closeReportPopup(key) {
  document.getElementById(REPORT_POPUPS[key].popup).classList.add('hidden');
  document.getElementById(REPORT_POPUPS[key].form).reset();
}

// Expose named open/close functions expected by HTML onclick attributes
function openWWPopup()      { openReportPopup('ww'); }
function closeWWPopup()     { closeReportPopup('ww'); }
function openCitePopup()    { openReportPopup('cite'); }
function closeCitePopup()   { closeReportPopup('cite'); }
function openArrestPopup()  { openReportPopup('arrest'); }
function closeArrestPopup() { closeReportPopup('arrest'); }
function openIRPopup()      { openReportPopup('ir'); }
function closeIRPopup()     { closeReportPopup('ir'); }
function openUOFRPopup()    { openReportPopup('uof'); }
function closeUOFRPopup()   { closeReportPopup('uof'); }
function openWarrantPopup() { openReportPopup('warrant'); }
function closeWarrantPopup(){ closeReportPopup('warrant'); }
function openCRPopup()      { openReportPopup('cr'); }
function closeCRPopup()     { closeReportPopup('cr'); }
function openIvRPopup()     { openReportPopup('ivr'); }
function closeIvRPopup()    { closeReportPopup('ivr'); }
function openAARPopup()     { openReportPopup('aar'); }
function closeAARPopup()    { closeReportPopup('aar'); }

// ─────────────────────────────────────────────
//  REPORTS — submit helpers
// ─────────────────────────────────────────────

async function submitReport(type, details, subjectName = null, subjectPlate = null, callId = null) {
  await apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify({
      serverId,
      type,
      details,
      subjectName,
      subjectPlate,
      callId,
    }),
  });
}

// Written Warning
document.getElementById('written-warning-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name   = document.getElementById('ww-name').value.trim();
  const plate  = document.getElementById('ww-plate').value.trim();
  const charge = document.getElementById('ww-charge').value.trim();
  try {
    await submitReport('WRITTEN_WARNING', { charge }, name, plate);
    closeWWPopup();
    showToast('Written Warning issued');
  } catch (_) {}
});

// Citation
document.getElementById('citation-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name   = document.getElementById('cite-name').value.trim();
  const plate  = document.getElementById('cite-plate').value.trim();
  const charge = document.getElementById('cite-charge').value.trim();
  const fine   = document.getElementById('cite-fine').value;
  try {
    await submitReport('CITATION', { charge, fine }, name, plate);
    closeCitePopup();
    showToast('Citation issued');
  } catch (_) {}
});

// Arrest Report
document.getElementById('arrest-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name      = document.getElementById('arrest-name').value.trim();
  const charge    = document.getElementById('arrest-charge').value.trim();
  const searched  = document.getElementById('arrest-searched').checked;
  const evidence  = document.getElementById('arrest-evidence').value.trim();
  const mirandized = document.getElementById('arrest-rights').checked;
  try {
    await submitReport('ARREST', { charge, searched, evidence, mirandized }, name);
    closeArrestPopup();
    showToast('Arrest Report submitted');
  } catch (_) {}
});

// Incident Report
document.getElementById('incident-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const callId      = document.getElementById('ir-call-id').value.trim();
  const typeTag     = document.getElementById('ir-type').value.trim();
  const description = document.getElementById('ir-description').value.trim();
  try {
    await submitReport('INCIDENT', { typeTag, description }, null, null, callId || null);
    closeIRPopup();
    showToast('Incident Report submitted');
  } catch (_) {}
});

// Use of Force
document.getElementById('uof-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const callId = document.getElementById('uof-call-id').value.trim();
  const type   = document.getElementById('uof-type').value;
  const reason = document.getElementById('uof-reason').value.trim();
  try {
    await submitReport('USE_OF_FORCE', { type, reason }, null, null, callId || null);
    closeUOFRPopup();
    showToast('Use of Force Report submitted');
  } catch (_) {}
});

// Warrant
document.getElementById('warrant-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('warrant-name').value.trim();
  const type = document.getElementById('warrant-type').value;
  try {
    await submitReport('WARRANT', { type }, name);
    closeWarrantPopup();
    showToast('Warrant issued');
  } catch (_) {}
});

// Crash Report
document.getElementById('crash-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const callId      = document.getElementById('cr-call-id').value.trim();
  const plate       = document.getElementById('cr-plate').value.trim();
  const description = document.getElementById('cr-description').value.trim();
  try {
    await submitReport('CRASH', { description }, null, plate, callId || null);
    closeCRPopup();
    showToast('Crash Report submitted');
  } catch (_) {}
});

// Investigation Report
document.getElementById('investigation-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name        = document.getElementById('investigation-name').value.trim();
  const plate       = document.getElementById('investigation-plate').value.trim();
  const description = document.getElementById('investigation-description').value.trim();
  try {
    await submitReport('INVESTIGATION', { description }, name, plate);
    closeIvRPopup();
    showToast('Investigation Report submitted');
  } catch (_) {}
});

// After Action Report
document.getElementById('after-action-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const callId      = document.getElementById('aar-call-id').value.trim();
  const description = document.getElementById('aar-description').value.trim();
  try {
    await submitReport('AFTER_ACTION', { description }, null, null, callId || null);
    closeAARPopup();
    showToast('After Action Report submitted');
  } catch (_) {}
});

// ─────────────────────────────────────────────
//  CLOSE ALL POPUPS
// ─────────────────────────────────────────────

function closeAllPopups() {
  closeNotepadPopup();
  closeCreateCallPopup();
  closeCreateBoloPopup();
  closeEditCallPopup();
  closeEditBoloPopup();
  Object.keys(REPORT_POPUPS).forEach(key => closeReportPopup(key));
}