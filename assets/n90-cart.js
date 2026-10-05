/*
  assets/n90-cart.js
  Shared quick add for n90 sections.

  Markup:
    <button data-n90-qadd="VARIANT_ID">  → adds 1 to the cart
    [data-n90-qadd-scope]                → nearest container holding the error line
    [data-n90-qadd-error]                → receives error text (role="alert")

  Uses Dawn's <cart-notification> or <cart-drawer> when present so the cart slides
  down and the header count refreshes; otherwise falls back to the cart page.
  Button states: .is-loading while the request runs, .is-added for 1.6s after.
*/
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-n90-qadd]');
    if (!btn || btn.classList.contains('is-loading')) return;
    e.preventDefault();

    var scope = btn.closest('[data-n90-qadd-scope]');
    var errorEl = scope && scope.querySelector('[data-n90-qadd-error]');
    var cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    var body = { id: Number(btn.dataset.n90Qadd), quantity: 1 };

    if (cart) {
      body.sections = cart.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
      cart.setActiveElement(btn);
    }

    if (errorEl) errorEl.textContent = '';
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');

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
          if (errorEl) errorEl.textContent = result.data.description || result.data.message || window.cartStrings.error;
          return;
        }
        if (!cart) {
          window.location = window.routes.cart_url;
          return;
        }
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'n90-quick-add',
            productVariantId: body.id,
            cartData: result.data
          });
        }
        cart.classList.remove('is-empty');
        cart.renderContents(result.data);
        btn.classList.add('is-added');
        setTimeout(function () { btn.classList.remove('is-added'); }, 1600);
      })
      .catch(function () {
        if (errorEl) errorEl.textContent = window.cartStrings.error;
      })
      .finally(function () {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
      });
  });
})();
