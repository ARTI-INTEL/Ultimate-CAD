/**
 * landing.js — Ultimate CAD landing page interactions
 * Implements a Discord-ID login modal that registers/logs in the user
 * via POST /users/register, persists session, then navigates to dashboard.
 */

(function () {
  'use strict';

  const API_BASE = '';

  /* ── Storage helpers ─────────────────────────────────────── */
  function set(key, val) { try { localStorage.setItem(key, val); } catch (_) {} }
  function get(key)       { try { return localStorage.getItem(key); } catch (_) { return null; } }

  /* ── Element references ─────────────────────────────────── */
  const nav           = document.getElementById('landing-nav');
  const btnLogin      = document.getElementById('btn-discord-login');
  const btnGetStarted = document.getElementById('btn-get-started');
  const btnLearnMore  = document.getElementById('btn-learn-more');
  const featureCards  = document.querySelectorAll('.feature-card');
  const statNumbers   = document.querySelectorAll('.stat-item__number');

  /* ── If already logged in, nav button says "Dashboard" ───── */
  if (get('cad_user_id')) {
    btnLogin.textContent = 'Dashboard';
  }

  /* ── Navbar scroll shadow ───────────────────────────────── */
  window.addEventListener('scroll', function () {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  /* ── Create login modal dynamically ─────────────────────── */
  const loginModal = document.createElement('div');
  loginModal.id = 'login-modal';
  loginModal.style.cssText = `
    display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75);
    z-index:9999; align-items:center; justify-content:center;
  `;
  loginModal.innerHTML = `
    <div style="background:#1a1a1a;border-radius:18px;padding:40px 48px;width:480px;
                max-width:90vw;border:1px solid rgba(255,255,255,0.1);position:relative;">
      <button id="login-modal-close" style="position:absolute;right:16px;top:16px;
        background:#333;border:none;color:#fff;border-radius:8px;width:32px;height:32px;
        cursor:pointer;font-size:16px;">✕</button>

      <p style="font-family:'Rajdhani',sans-serif;font-size:28px;font-weight:700;
                color:#fff;margin-bottom:6px;">Login to Ultimate CAD</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:28px;line-height:1.5;">
        Enter your Discord User ID and display name.<br>
        Your account will be created automatically if it doesn't exist.
      </p>

      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);
                        letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px;">
            Discord User ID
          </label>
          <input id="login-discord-id" placeholder="e.g. 123456789012345678"
            style="width:100%;background:#333;border:none;border-radius:10px;color:#fff;
                   font-family:monospace;font-size:16px;font-weight:700;padding:12px 16px;
                   outline:none;box-sizing:border-box;" autocomplete="off">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);
                        letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px;">
            Display Name
          </label>
          <input id="login-username" placeholder="YourUsername"
            style="width:100%;background:#333;border:none;border-radius:10px;color:#fff;
                   font-family:'Inter',sans-serif;font-size:16px;font-weight:700;padding:12px 16px;
                   outline:none;box-sizing:border-box;" autocomplete="off">
        </div>
      </div>

      <p id="login-error" style="min-height:20px;font-size:13px;color:#ff6b6b;
                                   margin-top:10px;margin-bottom:0;"></p>

      <button id="login-submit"
        style="margin-top:20px;width:100%;background:#5865f2;border:none;border-radius:12px;
               color:#fff;font-family:'Inter',sans-serif;font-size:16px;font-weight:700;
               padding:14px;cursor:pointer;transition:background .2s;">
        Continue to Dashboard
      </button>
    </div>
  `;
  document.body.appendChild(loginModal);

  /* ── Modal helpers ───────────────────────────────────────── */
  function openLoginModal()  { loginModal.style.display = 'flex'; }
  function closeLoginModal() { loginModal.style.display = 'none'; }

  document.getElementById('login-modal-close').addEventListener('click', closeLoginModal);
  loginModal.addEventListener('click', function (e) {
    if (e.target === loginModal) closeLoginModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLoginModal();
  });

  /* ── Submit login ────────────────────────────────────────── */
  document.getElementById('login-submit').addEventListener('click', doLogin);
  document.getElementById('login-discord-id').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });

  function doLogin() {
    const discordId = document.getElementById('login-discord-id').value.trim();
    const username  = document.getElementById('login-username').value.trim();
    const errEl     = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    errEl.textContent = '';

    if (!discordId) { errEl.textContent = 'Discord User ID is required.'; return; }
    if (!username)  { errEl.textContent = 'Display name is required.'; return; }

    submitBtn.textContent = 'Loading…';
    submitBtn.style.opacity = '0.7';

    fetch(API_BASE + '/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, username }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Server error'); });
        return r.json();
      })
      .then(function (user) {
        set('cad_user_id',    String(user.iduser));
        set('cad_username',   user.username);
        set('cad_discord_id', user.discord_id);
        set('cad_join_date',  user.created_at || '');
        closeLoginModal();
        window.location.href = 'dashboard.html';
      })
      .catch(function (err) {
        errEl.textContent = err.message || 'Login failed. Please try again.';
        submitBtn.textContent = 'Continue to Dashboard';
        submitBtn.style.opacity = '1';
      });
  }

  /* ── Button navigation ──────────────────────────────────── */
  btnLogin.addEventListener('click', function () {
    if (get('cad_user_id')) {
      window.location.href = 'dashboard.html';
    } else {
      openLoginModal();
    }
  });

  btnGetStarted.addEventListener('click', function () {
    if (get('cad_user_id')) {
      window.location.href = 'dashboard.html';
    } else {
      openLoginModal();
    }
  });

  btnLearnMore.addEventListener('click', function () {
    const features = document.getElementById('features');
    if (features) features.scrollIntoView({ behavior: 'smooth' });
  });

  /* ── Intersection Observer: feature cards ───────────────── */
  const cardObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const card  = entry.target;
      const delay = Array.from(featureCards).indexOf(card) * 100;
      setTimeout(function () { card.classList.add('visible'); }, delay);
      cardObserver.unobserve(card);
    });
  }, { threshold: 0.12 });

  featureCards.forEach(function (card) { cardObserver.observe(card); });

  /* ── Stat counter animation ─────────────────────────────── */
  function animateCounter(el) {
    const target   = parseInt(el.getAttribute('data-target'), 10);
    const duration = 1200;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }

  const statsObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      statsObserver.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(function (el) { statsObserver.observe(el); });

})();