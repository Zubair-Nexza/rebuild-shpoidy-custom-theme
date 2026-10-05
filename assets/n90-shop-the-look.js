/*
  assets/n90-shop-the-look.js
  Shop the Look (sections/shop-the-look.liquid + snippets/n90-look-card.liquid).

  - Pins [data-lk-pin]: click → highlight the matching card ([data-lk-item] by product id, else
    [data-lk-pos] by position), page / scroll it into view and flash it. Cards light their pin.
  - Pages: [data-lk-track] scrolls horizontally inside the column; prev / next arrows move one
    page; [data-lk-bar] shows progress. Hidden when everything fits.
  - Quick view: [data-lk-qv] slides aside#RosterQuickDrawer in from the right and fills it from
    /products/<handle>.js — Minimal Ash media, badge, title, price, stock badge, option pills,
    quantity stepper, Volt Add to cart ("Adding..." → "Added ✓" → cart drawer opens, `cart:updated`
    fires), description, and the pinned "View Full Product Details →" bar.
    Closes on overlay, Esc and the ✕ button; focus is trapped and restored; body scroll locks.
  - Theme editor: selecting a hotspot block rings its pin; sections re-init on reload.
*/
(function () {
  if (window.n90ShopTheLook) return;
  window.n90ShopTheLook = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

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
      case 'amount_with_space_separator': amount = n(cents, 2, ' ', ','); break;
      default: amount = n(cents, 2);
    }
    return fmt.replace(/\{\{\s*\w+\s*\}\}/, amount);
  }

  function imageUrl(src, width) {
    if (!src) return '';
    if (typeof src === 'object') src = src.src || '';
    if (src.indexOf('//') === 0) src = 'https:' + src;
    try {
      var u = new URL(src);
      u.searchParams.set('width', width);
      return u.toString();
    } catch (e) {
      return src;
    }
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function init(root) {
    if (root.dataset.lkReady) return;
    root.dataset.lkReady = 'true';

    var pins = Array.prototype.slice.call(root.querySelectorAll('[data-lk-pin]'));
    var cards = Array.prototype.slice.call(root.querySelectorAll('.n90-lk__card'));
    var products = root.querySelector('[data-lk-products]');
    var track = root.querySelector('[data-lk-track]');
    var bar = root.querySelector('[data-lk-bar]');
    var prev = root.querySelector('[data-lk-prev]');
    var next = root.querySelector('[data-lk-next]');

    /* ── Pages / progress ── */
    function updateTrack() {
      if (!track || !products) return;
      var max = track.scrollWidth - track.clientWidth;
      var scrollable = max > 4;
      products.classList.toggle('is-scrollable', scrollable);
      if (bar) {
        var ratio = scrollable ? (track.scrollLeft + track.clientWidth) / track.scrollWidth : 1;
        bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0.05, ratio)) + ')';
      }
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
    }
    if (track) {
      track.addEventListener('scroll', function () { window.requestAnimationFrame(updateTrack); }, { passive: true });
      window.addEventListener('resize', updateTrack);
      if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' }); });
      if (next) next.addEventListener('click', function () { track.scrollBy({ left: track.clientWidth, behavior: reduce.matches ? 'auto' : 'smooth' }); });
      updateTrack();
    }

    /* ── Pins ↔ cards ── */
    function cardFor(key) {
      return root.querySelector('.n90-lk__card[data-lk-item="' + key + '"]') || root.querySelector('.n90-lk__card[data-lk-pos="' + key + '"]');
    }
    function setOn(key) {
      var card = cardFor(key);
      pins.forEach(function (p) { p.classList.toggle('is-on', p.dataset.lkPin === key); });
      cards.forEach(function (c) { c.classList.toggle('is-on', c === card); });
      return card;
    }
    function reveal(card) {
      if (track) {
        var page = card.closest('.n90-lk__page-wrap');
        var target = window.getComputedStyle(page).display === 'contents' ? card : page;
        var left = target.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
        track.scrollTo({ left: left, behavior: reduce.matches ? 'auto' : 'smooth' });
      }
      var r = card.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        card.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
      }
      card.classList.remove('is-flash');
      void card.offsetWidth;
      card.classList.add('is-flash');
    }
    pins.forEach(function (pin) {
      pin.addEventListener('click', function () {
        var card = setOn(pin.dataset.lkPin);
        if (card) reveal(card);
      });
    });
    cards.forEach(function (card) {
      function light() {
        var key = card.dataset.lkItem;
        if (!key || !pins.some(function (p) { return p.dataset.lkPin === key; })) key = card.dataset.lkPos;
        if (key) setOn(key);
      }
      card.addEventListener('mouseenter', light);
      card.addEventListener('focusin', light);
    });

    /* ── Quick view drawer (aside#RosterQuickDrawer, slides in from the right) ── */
    var drawer = root.querySelector('[data-lk-drawer]');
    if (!drawer) return;
    var overlay = root.querySelector('[data-lk-overlay]');
    var body = drawer.querySelector('[data-lk-body]');
    var pdp = drawer.querySelector('[data-lk-pdp]');
    var fmt = drawer.dataset.moneyFormat;
    var t = drawer.dataset;
    var lastTrigger = null;
    var request = 0;
    var closeTimer = null;

    function lockScroll(on) {
      document.documentElement.style.overflow = on ? 'hidden' : '';
    }

    function setOpen(on) {
      drawer.classList.toggle('is-open', on);
      if (overlay) overlay.classList.toggle('is-open', on);
      drawer.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) drawer.removeAttribute('inert');
      else drawer.setAttribute('inert', '');
      lockScroll(on);
    }

    function openDrawer(trigger) {
      clearTimeout(closeTimer);
      lastTrigger = trigger;
      var handle = trigger.dataset.lkQv;
      var url = trigger.dataset.lkUrl;
      var id = ++request;
      body.textContent = '';
      var loading = el('div', 'quick-view-loading');
      loading.appendChild(el('span'));
      body.appendChild(loading);
      if (pdp) {
        pdp.href = url;
        pdp.hidden = false;
      }
      setOpen(true);
      drawer.focus({ preventScroll: true });

      fetch((t.root || '/').replace(/\/?$/, '/') + 'products/' + encodeURIComponent(handle) + '.js', { headers: { Accept: 'application/json' } })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (product) { if (id === request) render(product, trigger); })
        .catch(function () { window.location.href = url; });
    }

    function closeDrawer(keepFocus) {
      if (!drawer.classList.contains('is-open')) return;
      request++;
      setOpen(false);
      closeTimer = setTimeout(function () { body.textContent = ''; }, 420);
      if (!keepFocus && lastTrigger) lastTrigger.focus();
      lastTrigger = keepFocus ? lastTrigger : null;
    }

    function textExcerpt(html, max) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html || '';
      var text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
      return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
    }

    function render(product, trigger) {
      body.textContent = '';
      var card = trigger.closest('.n90-lk__card');
      var badgeEl = card && card.querySelector('.n90-lk__badge');
      var badgeText = badgeEl ? badgeEl.textContent : product.vendor;

      var media = el('div', 'qv-media');
      var img = document.createElement('img');
      img.alt = product.title;
      img.width = 800;
      img.height = 800;
      img.src = imageUrl(product.featured_image || (product.images && product.images[0]), 800);
      media.appendChild(img);
      body.appendChild(media);
      if (badgeText) body.appendChild(el('p', 'qv-badge', badgeText));
      body.appendChild(el('h2', 'qv-title', product.title));
      var priceEl = el('p', 'qv-price');
      body.appendChild(priceEl);
      var stock = el('div', 'stock-badge');
      var stockDot = el('span', 'dot');
      var stockText = el('span');
      stock.appendChild(stockDot);
      stock.appendChild(stockText);
      body.appendChild(stock);

      var variants = product.variants || [];
      var optionNames = (product.options || []).map(function (o) { return typeof o === 'string' ? o : o.name; });
      var hasOptions = !(variants.length === 1 && /^default title$/i.test(variants[0].title || ''));
      var current = variants.filter(function (v) { return v.available; })[0] || variants[0];
      var fieldsets = [];

      var form = el('form', 'qv-form');
      form.noValidate = true;
      body.appendChild(form);

      if (hasOptions) {
        optionNames.forEach(function (name, i) {
          var values = [];
          variants.forEach(function (v) {
            var val = v.options ? v.options[i] : v['option' + (i + 1)];
            if (val !== undefined && val !== null && values.indexOf(val) === -1) values.push(val);
          });
          var fs = el('fieldset', 'qv-opt');
          var legend = el('legend');
          legend.appendChild(document.createTextNode(name + ': '));
          var strong = el('strong');
          legend.appendChild(strong);
          fs.appendChild(legend);
          var wrap = el('div', 'qv-vals');
          var currentVal = current && (current.options ? current.options[i] : current['option' + (i + 1)]);
          values.forEach(function (val, j) {
            var item = el('span', 'qv-val');
            var input = document.createElement('input');
            input.type = 'radio';
            input.name = 'qv-opt-' + request + '-' + i;
            input.id = 'qv-opt-' + request + '-' + i + '-' + j;
            input.value = val;
            input.checked = val === currentVal;
            var label = el('label', null, val);
            label.htmlFor = input.id;
            item.appendChild(input);
            item.appendChild(label);
            wrap.appendChild(item);
          });
          fs.appendChild(wrap);
          fs.addEventListener('change', update);
          form.appendChild(fs);
          fieldsets.push({ fs: fs, strong: strong });
        });
      }

      /* Quantity stepper + Volt button */
      var buy = el('div', 'qv-buy');
      var qty = el('div', 'qv-qty');
      var minus = el('button', null, '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', (t.tDecrease || '').trim());
      var qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = '1';
      qtyInput.name = 'quantity';
      qtyInput.setAttribute('aria-label', t.tQuantity || '');
      var plus = el('button', null, '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', (t.tIncrease || '').trim());
      qty.appendChild(minus);
      qty.appendChild(qtyInput);
      qty.appendChild(plus);
      minus.addEventListener('click', function () { qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1); });
      plus.addEventListener('click', function () { qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1; });
      var btn = el('button', 'btn-volt-add');
      btn.type = 'submit';
      buy.appendChild(qty);
      buy.appendChild(btn);
      form.appendChild(buy);
      var errorEl = el('p', 'qv-error');
      errorEl.setAttribute('role', 'alert');
      form.appendChild(errorEl);

      var desc = textExcerpt(product.description, 280);
      if (desc) body.appendChild(el('p', 'qv-desc', desc));

      function selected() {
        return fieldsets.map(function (f) {
          var c = f.fs.querySelector('input:checked');
          return c ? c.value : null;
        });
      }
      function find(sel) {
        if (!hasOptions) return variants[0];
        return variants.filter(function (v) {
          var opts = v.options || [v.option1, v.option2, v.option3];
          return sel.every(function (s, i) { return opts[i] === s; });
        })[0] || null;
      }
      function update() {
        var sel = selected();
        fieldsets.forEach(function (f, i) {
          f.strong.textContent = sel[i] || '';
          f.fs.querySelectorAll('.qv-val').forEach(function (item) {
            var test = sel.slice();
            test[i] = item.querySelector('input').value;
            var m = find(test);
            item.classList.toggle('is-out', !m || !m.available);
          });
        });
        current = find(sel);
        priceEl.textContent = '';
        if (current) {
          priceEl.appendChild(document.createTextNode(formatMoney(current.price, fmt)));
          if (current.compare_at_price > current.price) priceEl.appendChild(el('s', null, formatMoney(current.compare_at_price, fmt)));
          if (current.featured_image) img.src = imageUrl(current.featured_image, 800);
        }
        var inStock = !!(current && current.available);
        stock.classList.toggle('is-out', !inStock);
        stockText.textContent = !current ? t.tUnavailable : (inStock ? t.tInStock : t.tOutStock);
        btn.disabled = !inStock;
        btn.textContent = !current ? t.tUnavailable : (inStock ? t.tAdd : t.tSold);
        errorEl.textContent = '';
      }
      update();

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!current || !current.available || btn.dataset.busy) return;
        var quantity = Math.max(1, parseInt(qtyInput.value, 10) || 1);
        var payload = { items: [{ id: current.id, quantity: quantity }] };
        var cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
        if (cart && typeof cart.getSectionsToRender === 'function') {
          payload.sections = cart.getSectionsToRender().map(function (s) { return s.id; });
          payload.sections_url = window.location.pathname;
          if (typeof cart.setActiveElement === 'function' && lastTrigger) cart.setActiveElement(lastTrigger);
        }
        var cartUrl = (window.routes && window.routes.cart_url) || '/cart';
        btn.dataset.busy = 'true';
        btn.disabled = true;
        btn.textContent = t.tAdding;

        fetch(((window.routes && window.routes.cart_add_url) || '/cart/add') + '.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok || result.data.status) {
              errorEl.textContent = result.data.description || result.data.message || t.tError;
              delete btn.dataset.busy;
              update();
              return;
            }
            btn.textContent = t.tAdded;
            document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items: payload.items } }));
            if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
              publish(PUB_SUB_EVENTS.cartUpdate, { source: 'n90-shop-the-look', cartData: result.data });
            }
            /* Show "Added ✓", then hand over to the cart drawer (count + contents refresh) */
            setTimeout(function () {
              delete btn.dataset.busy;
              closeDrawer(true);
              if (!cart) { window.location = cartUrl; return; }
              try {
                cart.classList.remove('is-empty');
                cart.renderContents(Object.assign({}, result.data.items ? result.data.items[0] : result.data, { sections: result.data.sections }));
              } catch (err) {
                window.location = cartUrl;
              }
            }, 700);
          })
          .catch(function () {
            errorEl.textContent = t.tError;
            delete btn.dataset.busy;
            update();
          });
      });
    }

    root.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-lk-qv]');
      if (trigger && root.contains(trigger)) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          window.open(trigger.dataset.lkUrl, '_blank');
          return;
        }
        e.preventDefault();
        openDrawer(trigger);
        return;
      }
      if (e.target.closest('[data-lk-close]')) closeDrawer(false);
    });

    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(false); return; }
      if (e.key !== 'Tab') return;
      var items = Array.prototype.filter.call(
        drawer.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        function (n) { return !n.disabled && !n.hidden && n.offsetParent !== null; }
      );
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* ── Theme editor ── */
    document.addEventListener('shopify:block:select', function (e) {
      if (!root.contains(e.target)) return;
      pins.forEach(function (p) { p.classList.toggle('is-editing', p === e.target); });
      if (e.target.dataset && e.target.dataset.lkPin) setOn(e.target.dataset.lkPin);
      var card = e.target.closest && e.target.closest('.n90-lk__card');
      if (card) reveal(card);
    });
    document.addEventListener('shopify:block:deselect', function () {
      pins.forEach(function (p) { p.classList.remove('is-editing'); });
    });
  }

  function boot() {
    document.querySelectorAll('[data-n90-lk]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  document.addEventListener('shopify:section:load', boot);
})();
