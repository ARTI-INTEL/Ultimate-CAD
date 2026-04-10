/**
 * landing.js — Ultimate CAD landing page interactions
 * No inline event handlers or inline styles in index.html;
 * all DOM wiring lives here.
 */

(function () {
  'use strict';

  /* ── Element references ─────────────────────────────────── */
  const nav           = document.getElementById('landing-nav');
  const btnLogin      = document.getElementById('btn-discord-login');
  const btnGetStarted = document.getElementById('btn-get-started');
  const btnLearnMore  = document.getElementById('btn-learn-more');
  const featureCards  = document.querySelectorAll('.feature-card');
  const statNumbers   = document.querySelectorAll('.stat-item__number');

  /* ── Navbar scroll shadow ───────────────────────────────── */
  function onScroll() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Button navigation ──────────────────────────────────── */
  btnLogin.addEventListener('click', function () {
    window.location.href = 'dashboard.html';
  });

  btnGetStarted.addEventListener('click', function () {
    window.location.href = 'dashboard.html';
  });

  btnLearnMore.addEventListener('click', function () {
    const features = document.getElementById('features');
    if (features) {
      features.scrollIntoView({ behavior: 'smooth' });
    }
  });

  /* ── Intersection Observer: feature cards ───────────────── */
  const cardObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry, idx) {
        if (entry.isIntersecting) {
          /* Stagger each card's reveal */
          const card = entry.target;
          const delay = Array.from(featureCards).indexOf(card) * 100;

          setTimeout(function () {
            card.classList.add('visible');
          }, delay);

          cardObserver.unobserve(card);
        }
      });
    },
    { threshold: 0.12 }
  );

  featureCards.forEach(function (card) {
    cardObserver.observe(card);
  });

  /* ── Intersection Observer: stat counter animation ─────── */
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const duration = 1200; /* ms */
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      /* ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(step);
  }

  const statsObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statNumbers.forEach(function (el) {
    statsObserver.observe(el);
  });

})();