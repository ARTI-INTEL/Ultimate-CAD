/**
 * civilian.js — Ultimate CAD Civilian Page
 *
 * Responsibilities:
 *  - Tab navigation (Characters / Vehicles / Firearms)
 *  - In-memory state for characters, vehicles, firearms
 *  - Render tables for each category
 *  - Open / close modals for creating records
 *  - Handle form submission and clear fields
 *  - Navigate back to server-page
 *
 * No inline event handlers or inline styles anywhere in HTML.
 */

(function () {
  'use strict';

  /* ── Helpers ────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    characters: [],
    vehicles:   [],
    firearms:   [],
  };

  /* ── Tab switching ──────────────────────────────────────── */
  const TABS = ['characters', 'vehicles', 'firearms'];

  function showTab(tab) {
    TABS.forEach(function (t) {
      const panel = $('panel-' + t);
      const btn   = $('btn-tab-' + t);
      if (panel) panel.classList.toggle('active', t === tab);
      if (btn)   btn.classList.toggle('civ-btn--active', t === tab);
    });
  }

  TABS.forEach(function (t) {
    const btn = $('btn-tab-' + t);
    if (btn) {
      btn.addEventListener('click', function () { showTab(t); });
    }
  });

  /* ── Back navigation ────────────────────────────────────── */
  $('btn-back').addEventListener('click', function () {
    window.location.href = 'server-page.html';
  });

  /* ── Modal helpers ──────────────────────────────────────── */
  function openModal(id) {
    $(id).classList.add('open');
  }

  function closeModal(id) {
    $(id).classList.remove('open');
  }

  const MODALS = ['modal-character', 'modal-vehicle', 'modal-firearm'];

  MODALS.forEach(function (id) {
    // Close when clicking the overlay background
    $(id).addEventListener('click', function (e) {
      if (e.target === this) closeModal(id);
    });
    // Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $(id).classList.contains('open')) closeModal(id);
    });
  });

  $('btn-close-char-modal').addEventListener('click', function () { closeModal('modal-character'); });
  $('btn-close-veh-modal').addEventListener('click',  function () { closeModal('modal-vehicle'); });
  $('btn-close-fa-modal').addEventListener('click',   function () { closeModal('modal-firearm'); });

  /* ── Open modals via action buttons ────────────────────── */
  $('btn-add-character').addEventListener('click',  function () { openModal('modal-character'); });
  $('btn-add-vehicle').addEventListener('click',    function () { openModal('modal-vehicle'); });
  $('btn-add-firearm').addEventListener('click',    function () { openModal('modal-firearm'); });
  $('btn-add-vehicle-tab').addEventListener('click', function () { openModal('modal-vehicle'); });
  $('btn-add-firearm-tab').addEventListener('click', function () { openModal('modal-firearm'); });

  /* ── Render: Characters ─────────────────────────────────── */
  function renderChars() {
    const list = $('chars-list');
    if (!state.characters.length) {
      list.innerHTML = '<div class="civ-empty">No characters created yet.</div>';
      return;
    }
    list.innerHTML = state.characters
      .map(function (c, i) {
        return (
          '<div class="civ-row" data-type="char" data-idx="' + i + '">' +
            '<span style="width:220px">'  + esc(c.fn)     + '</span>' +
            '<span style="width:220px">'  + esc(c.ln)     + '</span>' +
            '<span style="width:180px">'  + esc(c.dob)    + '</span>' +
            '<span style="width:100px">'  + esc(c.age)    + '</span>' +
            '<span style="width:170px">'  + esc(c.gender) + '</span>' +
            '<span style="width:230px">'  + esc(c.occ)    + '</span>' +
            '<span class="civ-col-flex">' + esc(c.addr)   + '</span>' +
          '</div>'
        );
      })
      .join('');

    // Row click → highlight + filter sub-tables
    list.querySelectorAll('.civ-row').forEach(function (row) {
      row.addEventListener('click', function () {
        list.querySelectorAll('.civ-row').forEach(function (r) {
          r.classList.remove('civ-row-selected');
        });
        row.classList.add('civ-row-selected');
        var idx  = parseInt(row.dataset.idx, 10);
        var char = state.characters[idx];
        var name = char.fn + ' ' + char.ln;
        renderVehiclesSubTable(name);
        renderFirearmsSubTable(name);
      });
    });
  }

  /* ── Render: Vehicles sub-table (inside Characters panel) ─ */
  function renderVehiclesSubTable(ownerFilter) {
    var list = $('chars-veh-list');
    var data = ownerFilter
      ? state.vehicles.filter(function (v) { return v.owner === ownerFilter; })
      : state.vehicles;

    if (!data.length) {
      list.innerHTML = '<div class="civ-empty">' +
        (ownerFilter ? 'No vehicles registered to this character.' : 'No vehicles registered yet.') +
        '</div>';
      return;
    }

    list.innerHTML = data
      .map(function (v) {
        var insClass = v.ins === 'Expired' ? 'civ-ins-expired' : 'civ-ins-active';
        return (
          '<div class="civ-row">' +
            '<span style="width:240px">'  + esc(v.owner)  + '</span>' +
            '<span style="width:170px">'  + esc(v.plate)  + '</span>' +
            '<span style="width:270px">'  + esc(v.model)  + '</span>' +
            '<span style="width:150px">'  + esc(v.color)  + '</span>' +
            '<span style="width:230px">'  + esc(v.vin)    + '</span>' +
            '<span style="width:180px">'  + esc(v.reg)    + '</span>' +
            '<span class="' + insClass + ' civ-col-flex">' + esc(v.ins) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ── Render: Firearms sub-table (inside Characters panel) ─ */
  function renderFirearmsSubTable(ownerFilter) {
    var list = $('chars-fa-list');
    var data = ownerFilter
      ? state.firearms.filter(function (f) { return f.owner === ownerFilter; })
      : state.firearms;

    if (!data.length) {
      list.innerHTML = '<div class="civ-empty">' +
        (ownerFilter ? 'No firearms registered to this character.' : 'No firearms registered yet.') +
        '</div>';
      return;
    }

    list.innerHTML = data
      .map(function (f) {
        return (
          '<div class="civ-row">' +
            '<span style="width:260px">'  + esc(f.owner)  + '</span>' +
            '<span style="width:360px">'  + esc(f.serial) + '</span>' +
            '<span style="width:360px">'  + esc(f.name)   + '</span>' +
            '<span class="civ-col-flex">' + esc(f.type)   + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ── Render: Vehicles tab ───────────────────────────────── */
  function renderVehicles() {
    var list = $('vehicles-list');
    if (!state.vehicles.length) {
      list.innerHTML = '<div class="civ-empty">No vehicles registered yet.</div>';
      return;
    }
    list.innerHTML = state.vehicles
      .map(function (v) {
        var insClass = v.ins === 'Expired' ? 'civ-ins-expired' : 'civ-ins-active';
        return (
          '<div class="civ-row">' +
            '<span style="width:240px">'  + esc(v.owner)  + '</span>' +
            '<span style="width:170px">'  + esc(v.plate)  + '</span>' +
            '<span style="width:270px">'  + esc(v.model)  + '</span>' +
            '<span style="width:150px">'  + esc(v.color)  + '</span>' +
            '<span style="width:220px">'  + esc(v.vin)    + '</span>' +
            '<span style="width:170px">'  + esc(v.reg)    + '</span>' +
            '<span class="' + insClass + '" style="width:180px">' + esc(v.ins) + '</span>' +
            '<span class="civ-col-flex">' + esc(v.insExp) + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ── Render: Firearms tab ───────────────────────────────── */
  function renderFirearms() {
    var list = $('firearms-list');
    if (!state.firearms.length) {
      list.innerHTML = '<div class="civ-empty">No firearms registered yet.</div>';
      return;
    }
    list.innerHTML = state.firearms
      .map(function (f) {
        return (
          '<div class="civ-row">' +
            '<span style="width:260px">'  + esc(f.owner)  + '</span>' +
            '<span style="width:360px">'  + esc(f.serial) + '</span>' +
            '<span style="width:360px">'  + esc(f.name)   + '</span>' +
            '<span class="civ-col-flex">' + esc(f.type)   + '</span>' +
          '</div>'
        );
      })
      .join('');
  }

  /* ── Clear form fields ──────────────────────────────────── */
  function clearFields(ids) {
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else el.value = '';
    });
  }

  /* ── Submit: Create Character ───────────────────────────── */
  $('btn-submit-char').addEventListener('click', function () {
    var fn = $('char-fn').value.trim();
    var ln = $('char-ln').value.trim();
    if (!fn || !ln) {
      $('char-fn').focus();
      return;
    }

    state.characters.push({
      fn:     fn,
      ln:     ln,
      dob:    $('char-dob').value.trim(),
      age:    $('char-age').value.trim(),
      gender: $('char-gender').value.trim(),
      occ:    $('char-occ').value.trim(),
      height: $('char-height').value.trim(),
      weight: $('char-weight').value.trim(),
      skin:   $('char-skin').value.trim(),
      hair:   $('char-hair').value.trim(),
      eye:    $('char-eye').value.trim(),
      addr:   $('char-addr').value.trim(),
    });

    renderChars();
    closeModal('modal-character');
    clearFields([
      'char-fn','char-ln','char-dob','char-age','char-gender','char-occ',
      'char-height','char-weight','char-skin','char-hair','char-eye','char-addr',
    ]);
  });

  /* ── Submit: Add Vehicle ────────────────────────────────── */
  $('btn-submit-veh').addEventListener('click', function () {
    var plate = $('veh-plate').value.trim();
    if (!plate) {
      $('veh-plate').focus();
      return;
    }

    var entry = {
      owner:  $('veh-owner').value.trim(),
      plate:  plate,
      model:  $('veh-model').value.trim(),
      color:  $('veh-color').value.trim(),
      vin:    $('veh-vin').value.trim(),
      reg:    $('veh-reg').value.trim(),
      ins:    $('veh-ins').value,
      insExp: $('veh-insexp').value.trim(),
    };

    state.vehicles.push(entry);
    renderVehicles();
    renderVehiclesSubTable(null);
    closeModal('modal-vehicle');
    clearFields(['veh-owner','veh-plate','veh-model','veh-color','veh-vin','veh-reg','veh-insexp']);
  });

  /* ── Submit: Register Firearm ───────────────────────────── */
  $('btn-submit-fa').addEventListener('click', function () {
    var serial = $('fa-serial').value.trim();
    if (!serial) {
      $('fa-serial').focus();
      return;
    }

    var entry = {
      owner:  $('fa-owner').value.trim(),
      serial: serial,
      name:   $('fa-name').value.trim(),
      type:   $('fa-type').value.trim(),
    };

    state.firearms.push(entry);
    renderFirearms();
    renderFirearmsSubTable(null);
    closeModal('modal-firearm');
    clearFields(['fa-owner','fa-serial','fa-name','fa-type']);
  });

  /* ── Init ───────────────────────────────────────────────── */
  renderChars();
  renderVehiclesSubTable(null);
  renderFirearmsSubTable(null);
  renderVehicles();
  renderFirearms();

})();