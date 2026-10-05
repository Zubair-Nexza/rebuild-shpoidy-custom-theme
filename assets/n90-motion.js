/*
  assets/n90-motion.js
  Scroll reveal for n90 sections — port of the reference motion layer (.m-rv / .m-in).

  Markup:
    data-n90-reveal   → the element fades up on entry
    data-n90-stagger  → each direct child fades up, staggered 0.08s (capped at 5 steps)
    data-n90-inview   → gets .n90-in on entry without being hidden (for line draws etc.)
    .n90-pc__media    → product card media tilts toward the pointer (ref engine:
                        rotateX -y*8deg, rotateY x*10deg), fine pointers only

  Only elements that start below the fold are hidden, so content in view on load
  never flashes. Styles live in assets/n90-tokens.css. Re-runs on theme-editor section loads.
*/
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('n90-in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  function prepare(el, delay) {
    if (el.classList.contains('n90-rv')) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.style.setProperty('--n90-rd', delay + 's');
    el.classList.add('n90-rv');
    observer.observe(el);
  }

  function init(scope) {
    scope.querySelectorAll('[data-n90-reveal]').forEach(function (el) {
      prepare(el, 0);
    });
    scope.querySelectorAll('[data-n90-inview]').forEach(function (el) {
      observer.observe(el);
    });
    scope.querySelectorAll('[data-n90-stagger]').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        prepare(child, Math.min(i, 5) * 0.08);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', function (e) {
    init(e.target);
  });

  /* Product card tilt */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var lastMedia = null;
  function resetTilt() {
    if (!lastMedia) return;
    lastMedia.style.setProperty('--rx', '0deg');
    lastMedia.style.setProperty('--ry', '0deg');
    lastMedia = null;
  }
  document.addEventListener('mousemove', function (e) {
    var media = e.target.closest && e.target.closest('.n90-pc__media');
    if (media !== lastMedia) resetTilt();
    if (!media) return;
    var r = media.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    media.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    media.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
    lastMedia = media;
  }, { passive: true });
  document.addEventListener('mouseleave', resetTilt);
})();
