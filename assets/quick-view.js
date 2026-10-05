/*
  assets/quick-view.js
  Quick view / quick buy dialog (snippets/quick-view-modal.liquid).

  Any [data-n90-qv-open="<product url>"] opens the dialog and fetches
  sections/n90-quick-view.liquid for that product via the Section Rendering API
  (?section_id=n90-quick-view). Inside: thumbnail switching, live variant picker
  (price, badges, stock, image), quantity and AJAX add to cart — which closes the
  dialog and opens Dawn's cart drawer (or notification) with the updated cart.
  Esc, the close button and a backdrop click close it; focus is trapped while open
  and returns to the card button afterwards. Fetch failure → falls back to the product page.
*/
(function () {
  if (window.n90QuickView) return;
  window.n90QuickView = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cache = {};
  var lastTrigger = null;
  var request = 0;

  function dialogEl() { return document.getElementById('n90-quick-view'); }

  function strings(dialog) {
    try { return JSON.parse(dialog.dataset.strings); } catch (e) { return {}; }
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function sectionUrl(url) {
    var u = new URL(url, window.location.origin);
    u.searchParams.set('section_id', 'n90-quick-view');
    return u.toString();
  }

  function load(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(sectionUrl(url))
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.text();
      })
      .then(function (html) {
        var node = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-n90-qv-product]');
        if (!node) throw new Error('empty');
        cache[url] = node.outerHTML;
        return cache[url];
      });
  }

  /* ── Open / close ── */
  function open(url, trigger) {
    var dialog = dialogEl();
    if (!dialog || typeof dialog.showModal !== 'function') {
      window.location.href = url;
      return;
    }
    var body = dialog.querySelector('[data-n90-qv-body]');
    var skeleton = document.getElementById('n90-qv-skeleton');
    var id = ++request;

    lastTrigger = trigger || null;
    body.innerHTML = skeleton ? skeleton.innerHTML : '';
    dialog.setAttribute('aria-busy', 'true');
    dialog.classList.remove('is-closing');
    if (!dialog.open) dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    dialog.querySelector('[data-n90-qv-close]').focus();

    load(url)
      .then(function (html) {
        if (id !== request || !dialog.open) return;
        body.innerHTML = html;
        dialog.removeAttribute('aria-busy');
        var root = body.querySelector('[data-n90-qv-product]');
        init(root, dialog);
        var title = root.querySelector('#n90-qv-title');
        dialog.setAttribute('aria-labelledby', 'n90-qv-title');
        if (title) title.focus({ preventScroll: true });
      })
      .catch(function () {
        window.location.href = url;
      });
  }

  function close(dialog, instant) {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    function done() {
      dialog.classList.remove('is-closing');
      dialog.close();
    }
    if (instant || reduceMotion.matches) return done();
    dialog.classList.add('is-closing');
    setTimeout(done, 220);
  }

  /* ── Product logic inside the dialog ── */
  function init(root, dialog) {
    var t = strings(dialog);
    var dataEl = root.querySelector('[data-n90-qv-variants]');
    var variants = [];
    try { variants = JSON.parse(dataEl.textContent); } catch (e) { /* no variant data */ }
    var options = Array.prototype.slice.call(root.querySelectorAll('[data-n90-qv-option]'));
    var idInput = root.querySelector('[data-n90-qv-id]');
    var atc = root.querySelector('[data-n90-qv-atc]');
    var atcLabel = root.querySelector('[data-n90-qv-atc-label]');
    var priceEl = root.querySelector('[data-n90-qv-price]');
    var stockEl = root.querySelector('[data-n90-qv-stock]');
    var moreLink = root.querySelector('[data-n90-qv-more]');
    var mainImg = root.querySelector('.n90-qv__img');
    var thumbs = Array.prototype.slice.call(root.querySelectorAll('[data-n90-qv-thumb]'));
    var badges = root.querySelector('[data-n90-badges]');
    var form = root.querySelector('[data-n90-qv-form]');
    var errorEl = root.querySelector('[data-n90-qv-error]');

    function showMedia(thumb) {
      if (!thumb || !mainImg) return;
      mainImg.setAttribute('srcset', thumb.dataset.srcset);
      mainImg.setAttribute('src', thumb.dataset.src);
      mainImg.setAttribute('alt', thumb.dataset.alt || '');
      thumbs.forEach(function (b) { b.setAttribute('aria-current', b === thumb ? 'true' : 'false'); });
    }
    thumbs.forEach(function (b) {
      b.addEventListener('click', function () { showMedia(b); });
    });

    function selected() {
      return options.map(function (fs) {
        var c = fs.querySelector('input:checked');
        return c ? c.value : null;
      });
    }
    function find(sel) {
      return variants.filter(function (v) {
        return v.options.every(function (o, i) { return o === sel[i]; });
      })[0];
    }
    function markAvailability(sel) {
      options.forEach(function (fs, i) {
        fs.querySelectorAll('.n90-qv__value').forEach(function (wrap) {
          var test = sel.slice();
          test[i] = wrap.querySelector('input').value;
          var m = find(test);
          wrap.classList.toggle('is-unavailable', !m || !m.available);
        });
      });
    }
    function setStock(v) {
      if (!stockEl) return;
      var state = v ? v.stock : 'out';
      stockEl.dataset.state = state;
      if (!v) stockEl.textContent = t.unavailable || '';
      else if (state === 'low') stockEl.textContent = (t.lowStock || '').replace('[qty]', v.qty);
      else if (state === 'out') stockEl.textContent = t.outStock || '';
      else stockEl.textContent = t.inStock || '';
    }
    function setBadges(v) {
      if (!badges || !v) return;
      var sold = badges.querySelector('[data-n90-badge="soldout"]');
      var sale = badges.querySelector('[data-n90-badge="sale"]');
      var onSale = v.available && v.compare_cents > v.price_cents;
      if (sold) sold.hidden = v.available;
      if (sale) {
        sale.hidden = !onSale;
        if (onSale) {
          sale.textContent = badges.dataset.saleFormat === 'percent'
            ? Math.round(((v.compare_cents - v.price_cents) * 100) / v.compare_cents) + '% off'
            : badges.dataset.saleLabel;
        }
      }
    }
    function update() {
      var sel = selected();
      options.forEach(function (fs, i) {
        var label = fs.querySelector('[data-n90-qv-selected]');
        if (label) label.textContent = sel[i] || '';
      });
      markAvailability(sel);
      var v = find(sel);
      if (v) {
        idInput.value = v.id;
        var html = '<span class="n90-qv__now">' + escapeHtml(v.price) + '</span>';
        if (v.compare) html += '<s class="n90-qv__was"><span class="ref-sr">' + escapeHtml(t.regular) + '</span>' + escapeHtml(v.compare) + '</s>';
        priceEl.innerHTML = html;
        if (moreLink) moreLink.href = v.url;
        if (v.media) {
          var thumb = thumbs.filter(function (b) { return b.dataset.mediaId === String(v.media); })[0];
          if (thumb) showMedia(thumb);
        }
      }
      var ok = !!(v && v.available);
      atc.disabled = !ok;
      atcLabel.textContent = !v ? t.unavailable : (v.available ? t.add : t.soldOut);
      setStock(v);
      setBadges(v);
      if (errorEl) errorEl.textContent = '';
    }
    options.forEach(function (fs) { fs.addEventListener('change', update); });
    if (options.length) markAvailability(selected());
    setStock(find(selected()) || (variants.length === 1 ? variants[0] : null));

    var qty = root.querySelector('[data-n90-qv-qty-input]');
    root.querySelectorAll('[data-n90-qv-qty]').forEach(function (b) {
      b.addEventListener('click', function () {
        qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) + parseInt(b.dataset.n90QvQty, 10));
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (atc.disabled || atc.classList.contains('is-loading')) return;
      addToCart(dialog, {
        id: Number(idInput.value),
        quantity: Math.max(1, parseInt(qty.value, 10) || 1)
      }, atc, errorEl, t);
    });
  }

  function addToCart(dialog, body, btn, errorEl, t) {
    var cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    if (cart && typeof cart.getSectionsToRender === 'function') {
      body.sections = cart.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
    }
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    if (errorEl) errorEl.textContent = '';

    fetch(window.routes.cart_add_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok || result.data.status) {
          if (errorEl) errorEl.textContent = result.data.description || result.data.message || t.error;
          return;
        }
        if (!cart) {
          window.location = window.routes.cart_url;
          return;
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'n90-quick-view', productVariantId: body.id, cartData: result.data });
        }
        if (lastTrigger && typeof cart.setActiveElement === 'function') cart.setActiveElement(lastTrigger);
        lastTrigger = null; /* the cart takes focus; it returns to the card when the cart closes */
        close(dialog, true);
        cart.classList.remove('is-empty');
        cart.renderContents(result.data);
      })
      .catch(function () {
        if (errorEl) errorEl.textContent = t.error;
      })
      .finally(function () {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
      });
  }

  /* ── Events ── */
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-n90-qv-open]');
    if (opener) {
      e.preventDefault();
      open(opener.dataset.n90QvOpen, opener);
      return;
    }
    var dialog = e.target.closest('[data-n90-qv]');
    if (!dialog) return;
    if (e.target === dialog || e.target.closest('[data-n90-qv-close]')) close(dialog);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var dialog = dialogEl();
    if (!dialog || !dialog.open) return;
    var items = Array.prototype.filter.call(
      dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener('cancel', function (e) {
    if (e.target.matches && e.target.matches('[data-n90-qv]')) {
      e.preventDefault();
      close(e.target);
    }
  }, true);

  document.addEventListener('close', function (e) {
    if (!(e.target.matches && e.target.matches('[data-n90-qv]'))) return;
    var dialog = e.target;
    request++;
    document.documentElement.style.overflow = '';
    dialog.removeAttribute('aria-labelledby');
    dialog.querySelector('[data-n90-qv-body]').innerHTML = '';
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
  }, true);
})();
