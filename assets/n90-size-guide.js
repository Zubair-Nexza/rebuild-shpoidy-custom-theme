/*
  assets/n90-size-guide.js
  Size guide dialog (snippets/size-guide-modal.liquid).

  Markup:
    <button data-n90-sg-open="DIALOG_ID">      → opens the dialog, focus returns here on close
    <dialog data-n90-sg data-default-unit="cm">
      [data-n90-sg-close]                       → closes (also Esc and backdrop click)
      [data-n90-sg-tab] role="tab"              → switches category panels (arrow keys, Home/End)
      [data-n90-sg-unit="cm|in"]                → converts every [data-cm] cell; choice remembered
*/
(function () {
  if (window.n90SizeGuide) return;
  window.n90SizeGuide = true;

  var STORE_KEY = 'n90-size-unit';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var lastTrigger = null;

  function readUnit(fallback) {
    try { return window.localStorage.getItem(STORE_KEY) || fallback; } catch (e) { return fallback; }
  }
  function saveUnit(unit) {
    try { window.localStorage.setItem(STORE_KEY, unit); } catch (e) { /* storage blocked */ }
  }

  function toInches(text) {
    return text.replace(/\d+(?:\.\d+)?/g, function (n) {
      return String(Math.round((parseFloat(n) / 2.54) * 10) / 10);
    });
  }

  function setUnit(dialog, unit) {
    dialog.querySelectorAll('[data-cm]').forEach(function (cell) {
      var raw = cell.getAttribute('data-cm');
      if (!raw) return;
      cell.textContent = unit === 'in' ? toInches(raw) : raw;
    });
    dialog.querySelectorAll('[data-n90-sg-u]').forEach(function (el) {
      el.textContent = unit === 'in' ? (dialog.dataset.unitIn || '(in)') : (dialog.dataset.unitCm || '(cm)');
    });
    dialog.querySelectorAll('[data-n90-sg-unit]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.n90SgUnit === unit ? 'true' : 'false');
    });
    dialog.dataset.unit = unit;
  }

  function selectTab(tab, focus) {
    var list = tab.closest('[role="tablist"]');
    var dialog = tab.closest('[data-n90-sg]');
    list.querySelectorAll('[role="tab"]').forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = dialog.querySelector('#' + CSS.escape(t.getAttribute('aria-controls')));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }

  function focusables(dialog) {
    return Array.prototype.filter.call(
      dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
  }

  function open(dialog, trigger) {
    if (dialog.open || typeof dialog.showModal !== 'function') return;
    lastTrigger = trigger || null;
    setUnit(dialog, readUnit(dialog.dataset.defaultUnit || 'cm'));
    dialog.classList.remove('is-closing');
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    var close = dialog.querySelector('[data-n90-sg-close]');
    if (close) close.focus();
    if (lastTrigger) lastTrigger.setAttribute('aria-expanded', 'true');
  }

  function close(dialog) {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    function done() {
      dialog.classList.remove('is-closing');
      dialog.close();
    }
    if (reduceMotion.matches) return done();
    dialog.classList.add('is-closing');
    setTimeout(done, 220);
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-n90-sg-open]');
    if (opener) {
      var target = document.getElementById(opener.dataset.n90SgOpen);
      if (target) {
        e.preventDefault();
        open(target, opener);
      }
      return;
    }

    var dialog = e.target.closest('[data-n90-sg]');
    if (!dialog) return;

    if (e.target === dialog || e.target.closest('[data-n90-sg-close]')) {
      close(dialog);
      return;
    }
    var tab = e.target.closest('[data-n90-sg-tab]');
    if (tab) {
      selectTab(tab, false);
      return;
    }
    var unitBtn = e.target.closest('[data-n90-sg-unit]');
    if (unitBtn) {
      setUnit(dialog, unitBtn.dataset.n90SgUnit);
      saveUnit(unitBtn.dataset.n90SgUnit);
    }
  });

  document.addEventListener('keydown', function (e) {
    var dialog = e.target.closest && e.target.closest('[data-n90-sg]');
    if (!dialog || !dialog.open) return;

    if (e.key === 'Tab') {
      var items = focusables(dialog);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return;
    }

    var tab = e.target.closest('[data-n90-sg-tab]');
    if (!tab) return;
    var tabs = Array.prototype.slice.call(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab);
    var next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      selectTab(next, true);
    }
  });

  /* Esc: animate out instead of the instant native close */
  document.addEventListener('cancel', function (e) {
    if (e.target.matches && e.target.matches('[data-n90-sg]')) {
      e.preventDefault();
      close(e.target);
    }
  }, true);

  document.addEventListener('close', function (e) {
    if (!(e.target.matches && e.target.matches('[data-n90-sg]'))) return;
    document.documentElement.style.overflow = '';
    if (lastTrigger) {
      lastTrigger.setAttribute('aria-expanded', 'false');
      lastTrigger.focus();
      lastTrigger = null;
    }
  }, true);
})();
