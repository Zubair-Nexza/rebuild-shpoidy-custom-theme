/*
  assets/n90-bundle-builder.js
  Bundle builder (sections/composite-bundle-builder.liquid + snippets/n90-bundle-panel.liquid).

  - Live total = the panel's core products (data-core-total, cents) + ticked add-ons
    ([data-cb-addon] data-price), formatted with the store's money format (data-money-format).
  - "Shop the bundle":
      data-cb-mode="cart" → adds the core variants (data-core-ids; tagged _bundle / _bundle_id so
      they stay grouped in the order) + ticked add-ons in ONE /cart/add.js request, refreshes Dawn's
      cart drawer / notification and fires `cart:updated`. If the cart can't be refreshed in place,
      it goes to the cart page; if the add fails, the error shows and nothing else happens.
      data-cb-mode="link" → a normal link (sizes are chosen on the linked page); not intercepted.
  - Pills switch between bundles (arrow keys, Home/End; theme-editor block select).
*/
(function () {
  if (window.n90BundleBuilder) return;
  window.n90BundleBuilder = true;

  function formatMoney(cents, format) {
    var fmt = format || '{{amount}}';
    var match = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    function n(value, decimals, thousands, decimal) {
      thousands = thousands === undefined ? ',' : thousands;
      decimal = decimal === undefined ? '.' : decimal;
      var parts = (value / 100).toFixed(decimals).split('.');
      return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (parts[1] ? decimal + parts[1] : '');
    }
    var amount;
    switch (match ? match[1] : 'amount') {
      case 'amount_no_decimals': amount = n(cents, 0); break;
      case 'amount_with_comma_separator': amount = n(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': amount = n(cents, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': amount = n(cents, 2, "'", '.'); break;
      case 'amount_no_decimals_with_space_separator': amount = n(cents, 0, ' ', ''); break;
      case 'amount_with_space_separator': amount = n(cents, 2, ' ', ','); break;
      case 'amount_with_period_and_space_separator': amount = n(cents, 2, ' ', '.'); break;
      default: amount = n(cents, 2);
    }
    return fmt.replace(/\{\{\s*\w+\s*\}\}/, amount);
  }

  function init(root) {
    if (root.dataset.cbReady) return;
    root.dataset.cbReady = 'true';
    var moneyFormat = root.dataset.moneyFormat;
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-cb-panel]'));
    var addons = Array.prototype.slice.call(root.querySelectorAll('[data-cb-addon]'));

    /* ── Totals ── */
    function addonTotal() {
      return addons.reduce(function (sum, box) {
        return box.checked && !box.disabled ? sum + (parseInt(box.dataset.price, 10) || 0) : sum;
      }, 0);
    }
    function refreshTotals() {
      var extra = addonTotal();
      panels.forEach(function (panel) {
        var base = panel.dataset.coreTotal;
        var totalEl = panel.querySelector('[data-cb-total]');
        var note = panel.querySelector('[data-cb-addon-note]');
        if (!totalEl || base === '' || base === undefined) return;
        totalEl.textContent = formatMoney((parseInt(base, 10) || 0) + extra, moneyFormat);
        if (note) note.hidden = extra === 0;
      });
    }

    /* ── Add-ons ── */
    addons.forEach(function (box) { box.addEventListener('change', refreshTotals); });
    root.querySelectorAll('[data-cb-addon-variant]').forEach(function (select) {
      select.addEventListener('change', function () {
        var box = document.getElementById(select.dataset.for);
        var opt = select.options[select.selectedIndex];
        if (!box || !opt) return;
        box.value = opt.value;
        box.dataset.variantId = opt.value;
        box.dataset.price = opt.dataset.price;
        var price = box.closest('.n90-cb__addon').querySelector('[data-cb-addon-price]');
        if (price) price.textContent = formatMoney(parseInt(opt.dataset.price, 10) || 0, moneyFormat);
        refreshTotals();
      });
    });
    refreshTotals();

    /* ── Pills ── */
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-cb-tab]'));
    function selectTab(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        var id = t.dataset.cbTab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = root.querySelector('#n90-cb-panel-' + id);
        var media = root.querySelector('#n90-cb-media-' + id);
        if (panel) panel.hidden = !on;
        if (media) media.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTab(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); selectTab(next, true); }
      });
    });
    document.addEventListener('shopify:block:select', function (e) {
      var tab = tabs.filter(function (t) { return t === e.target; })[0];
      if (tab) selectTab(tab, false);
    });

    /* ── Add the kit (cart mode only; link mode is a plain <a>) ── */
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-cb-submit][data-cb-mode="cart"]');
      if (!btn || btn.classList.contains('is-loading')) return;
      e.preventDefault();
      var panel = btn.closest('[data-cb-panel]');
      var errorEl = panel.querySelector('[data-cb-error]');
      var ids = (panel.dataset.coreIds || '').split(',').filter(Boolean);
      if (errorEl) errorEl.textContent = '';

      if (ids.length < 3) {
        window.location = btn.dataset.fallbackUrl || '/collections/all';
        return;
      }

      var title = panel.dataset.bundleTitle || '';
      var bundleId = 'bundle-' + Date.now();
      var items = ids.map(function (id) {
        return { id: Number(id), quantity: 1, properties: { _bundle: title, _bundle_id: bundleId } };
      });
      addons.forEach(function (box) {
        if (box.checked && !box.disabled && box.dataset.variantId) {
          items.push({ id: Number(box.dataset.variantId), quantity: 1 });
        }
      });

      var body = { items: items };
      var cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
      if (cart && typeof cart.getSectionsToRender === 'function') {
        body.sections = cart.getSectionsToRender().map(function (s) { return s.id; });
        body.sections_url = window.location.pathname;
        if (typeof cart.setActiveElement === 'function') cart.setActiveElement(btn);
      }
      var cartUrl = (window.routes && window.routes.cart_url) || '/cart';

      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');

      fetch(((window.routes && window.routes.cart_add_url) || '/cart/add') + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          if (!result.ok || result.data.status) {
            if (errorEl) errorEl.textContent = result.data.description || result.data.message || root.dataset.msgError;
            return;
          }
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: items, bundleId: bundleId } }));
          if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'n90-bundle-builder', cartData: result.data });
          }
          if (!cart) {
            window.location = cartUrl;
            return;
          }
          try {
            cart.classList.remove('is-empty');
            cart.renderContents(result.data);
          } catch (err) {
            window.location = cartUrl;
          }
        })
        .catch(function () {
          if (errorEl) errorEl.textContent = root.dataset.msgError;
        })
        .finally(function () {
          btn.classList.remove('is-loading');
          btn.removeAttribute('aria-busy');
        });
    });
  }

  function boot() {
    document.querySelectorAll('[data-n90-cb]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
