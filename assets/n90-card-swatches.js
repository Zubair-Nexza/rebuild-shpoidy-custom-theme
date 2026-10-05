/*
  assets/n90-card-swatches.js
  Product card colour swatches (snippets/card-color-swatches.liquid).

  Markup (inside [data-n90-pc]):
    [data-n90-swatches]
      button[data-n90-swatch][data-src][data-srcset][data-url]

  Hover (mouse) previews that colour's image; leaving the swatches restores the chosen
  colour (or the original image). Click / tap chooses a colour: aria-pressed, image and
  the card links (title + "+") now point at that variant.
*/
(function () {
  if (window.n90CardSwatches) return;
  window.n90CardSwatches = true;

  function mainImage(card) {
    return card.querySelector('.n90-pc__img:not(.n90-pc__alt)');
  }

  function remember(card, img) {
    if (img.dataset.n90Src) return;
    img.dataset.n90Src = img.getAttribute('src') || '';
    img.dataset.n90Srcset = img.getAttribute('srcset') || '';
    card.querySelectorAll('a[href]').forEach(function (a) {
      if (!a.dataset.n90Href) a.dataset.n90Href = a.getAttribute('href');
    });
  }

  function show(card, btn) {
    var img = mainImage(card);
    if (!img || !btn.dataset.src) return;
    remember(card, img);
    if (btn.dataset.srcset) img.setAttribute('srcset', btn.dataset.srcset);
    img.setAttribute('src', btn.dataset.src);
    card.classList.add('is-swatched');
  }

  function restore(card) {
    var chosen = card.querySelector('[data-n90-swatch][aria-pressed="true"]');
    if (chosen && chosen.dataset.src) return show(card, chosen);
    var img = mainImage(card);
    if (!img || !img.dataset.n90Src) return;
    img.setAttribute('srcset', img.dataset.n90Srcset);
    img.setAttribute('src', img.dataset.n90Src);
    card.classList.remove('is-swatched');
  }

  function choose(card, btn) {
    card.querySelectorAll('[data-n90-swatch]').forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    var img = mainImage(card);
    if (img) remember(card, img);
    show(card, btn);
    if (!btn.dataset.url) return;
    card.querySelectorAll('a[href]').forEach(function (a) {
      if (a.classList.contains('n90-sw__more') || a.closest('[data-n90-swatches]')) return;
      a.setAttribute('href', btn.dataset.url);
    });
    card.querySelectorAll('[data-n90-qv-open]').forEach(function (b) {
      b.dataset.n90QvOpen = btn.dataset.url;
    });
  }

  var canHover = window.matchMedia('(hover: hover)');

  document.addEventListener('mouseover', function (e) {
    if (!canHover.matches) return;
    var btn = e.target.closest && e.target.closest('[data-n90-swatch]');
    if (!btn) return;
    var card = btn.closest('[data-n90-pc]');
    if (card) show(card, btn);
  });

  document.addEventListener('mouseout', function (e) {
    var group = e.target.closest && e.target.closest('[data-n90-swatches]');
    if (!group || (e.relatedTarget && group.contains(e.relatedTarget))) return;
    var card = group.closest('[data-n90-pc]');
    if (card) restore(card);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-n90-swatch]');
    if (!btn) return;
    var card = btn.closest('[data-n90-pc]');
    if (card) choose(card, btn);
  });
})();
