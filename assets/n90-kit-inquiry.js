/*
  assets/n90-kit-inquiry.js
  Custom kit inquiry dialog (snippets/n90-kit-inquiry.liquid).
  [data-ki-open="<dialog id>"] opens it; [data-ki-close], Esc and a backdrop click close it.
  After the contact form posts, the page reloads — the dialog re-opens on the success / error.
*/
(function () {
  if (window.n90KitInquiry) return;
  window.n90KitInquiry = true;
  var lastTrigger = null;

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-ki-open]');
    if (opener) {
      var dialog = document.getElementById(opener.dataset.kiOpen);
      if (dialog && typeof dialog.showModal === 'function') {
        lastTrigger = opener;
        dialog.showModal();
        document.documentElement.style.overflow = 'hidden';
        var first = dialog.querySelector('input:not([type="hidden"]), select, textarea');
        if (first) first.focus();
      }
      return;
    }
    var d = e.target.closest('[data-ki]');
    if (d && (e.target === d || e.target.closest('[data-ki-close]'))) d.close();
  });

  document.addEventListener('close', function (e) {
    if (!(e.target.matches && e.target.matches('[data-ki]'))) return;
    document.documentElement.style.overflow = '';
    if (lastTrigger) lastTrigger.focus();
    lastTrigger = null;
  }, true);

  function reopen() {
    document.querySelectorAll('[data-ki]').forEach(function (d) {
      if (d.querySelector('[data-ki-success], [data-ki-error]') && typeof d.showModal === 'function') {
        d.showModal();
        document.documentElement.style.overflow = 'hidden';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reopen);
  else reopen();
})();
