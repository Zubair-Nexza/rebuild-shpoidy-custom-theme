/*
  assets/n90-localization.js
  Country / language dropdowns (snippets/n90-localization.liquid).

  [data-n90-loc]
    button[data-n90-loc-btn]          → toggles the panel (aria-expanded)
    [data-n90-loc-panel]
      input[data-n90-loc-filter]      → filters countries by name / currency
      [data-n90-loc-list] button      → submit buttons (country_code / language_code)

  One panel open at a time. Esc or a click / focus outside closes it; ArrowDown from the
  button moves into the list, ArrowUp / ArrowDown move between options.
*/
(function () {
  if (window.n90Localization) return;
  window.n90Localization = true;

  function options(dd) {
    return Array.prototype.filter.call(dd.querySelectorAll('[data-n90-loc-list] button'), function (b) {
      return !b.closest('li').hidden;
    });
  }

  function close(dd, focusButton) {
    var btn = dd.querySelector('[data-n90-loc-btn]');
    var panel = dd.querySelector('[data-n90-loc-panel]');
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) btn.focus();
  }

  function closeAll(except) {
    document.querySelectorAll('[data-n90-loc]').forEach(function (dd) {
      if (dd !== except) close(dd, false);
    });
  }

  function open(dd) {
    closeAll(dd);
    var btn = dd.querySelector('[data-n90-loc-btn]');
    var panel = dd.querySelector('[data-n90-loc-panel]');
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    var current = panel.querySelector('[aria-current="true"]');
    if (current) current.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-n90-loc-btn]');
    if (btn) {
      var dd = btn.closest('[data-n90-loc]');
      if (btn.getAttribute('aria-expanded') === 'true') close(dd, false);
      else open(dd);
      return;
    }
    if (!e.target.closest('[data-n90-loc]')) closeAll(null);
  });

  document.addEventListener('focusin', function (e) {
    var inside = e.target.closest && e.target.closest('[data-n90-loc]');
    closeAll(inside || null);
  });

  document.addEventListener('keydown', function (e) {
    var dd = e.target.closest && e.target.closest('[data-n90-loc]');
    if (!dd) return;
    var panel = dd.querySelector('[data-n90-loc-panel]');

    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close(dd, true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    var list = options(dd);
    if (!list.length) return;
    e.preventDefault();
    if (panel.hidden) open(dd);
    var i = list.indexOf(document.activeElement);
    var next;
    if (i === -1) next = e.key === 'ArrowDown' ? (panel.querySelector('[aria-current="true"]') || list[0]) : list[list.length - 1];
    else next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    if (next.closest('li').hidden) next = list[0];
    next.focus();
  });

  document.addEventListener('input', function (e) {
    if (!e.target.matches('[data-n90-loc-filter]')) return;
    var q = e.target.value.trim().toLowerCase();
    e.target.closest('[data-n90-loc]').querySelectorAll('[data-n90-loc-list] li').forEach(function (li) {
      li.hidden = q !== '' && (li.dataset.name || '').indexOf(q) === -1;
    });
  });
})();
