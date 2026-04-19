/**
 * cad-map-init.js  Map auto-initialiser for all department CADs
 *
 * Loaded AFTER the department JS (leo.js / fr.js / dot.js).
 * Detects the correct map container ID from the current page and
 * wires the live map to the existing panel-switcher buttons.
 *
 * No changes to leo.js / fr.js / dot.js are required.
 */

(function () {
  'use strict';

  /* ── Detect which CAD page we are on ─────────────────────── */
  var containerMap = {
    'leo-map-container': 'btn-map',   // LEO
    'fr-map-container':  'fr-nav-map', // F&R
    'dot-map-container': 'dot-nav-map', // DOT
    'd-map-container':   'btn-map',   // Dispatcher (has its own init in dispatcher.js)
  };

  var containerId = null;
  Object.keys(containerMap).forEach(function (id) {
    if (document.getElementById(id)) containerId = id;
  });

  /* Dispatcher already handles its own map – skip */
  if (!containerId || containerId === 'd-map-container') return;

  var userId   = (function () { try { return localStorage.getItem('cad_user_id'); } catch (_) { return null; } })();
  var serverId = (function () { try { return localStorage.getItem('cad_active_server'); } catch (_) { return null; } })();

  if (!userId || !serverId || typeof CadMap === 'undefined') return;

  var _map = null;

  function initMap() {
    if (_map) return;
    _map = new CadMap({
      containerId:  containerId,
      serverId:     serverId,
      userId:       userId,
      pollInterval: 8000,
    });
  }

  /* ── Hook into the map nav button ───────────────────────── */
  var navBtnId = containerMap[containerId];
  var navBtn   = document.getElementById(navBtnId);
  if (!navBtn) return;

  /* Intercept the click AFTER the existing click handlers run */
  navBtn.addEventListener('click', function () {
    /* Small delay so the panel becomes visible first,
       then the canvas can read clientWidth/Height correctly */
    setTimeout(initMap, 50);
  }, false);

})();