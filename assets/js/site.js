/* Shared site behaviour: applies the site name, renders the games grid,
   runs the screenshot lightbox. No build step, no dependencies. */
(function () {
  'use strict';
  var SITE = window.SITE || { name: 'Games' };
  var root = document.body.getAttribute('data-root') || '';   // '' on root pages, '../' in /games/

  // 1) Site name everywhere it's marked with data-site-name
  document.querySelectorAll('[data-site-name]').forEach(function (el) { el.textContent = SITE.name; });
  var pageTitle = document.documentElement.getAttribute('data-page-title');
  document.title = pageTitle ? pageTitle + ' | ' + SITE.name : SITE.name;
  var ogSite = document.querySelector('meta[property="og:site_name"]');
  if (ogSite) ogSite.setAttribute('content', SITE.name);
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // 2) Games grid (any element with data-games-grid)
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function card(g, i) {
    var tags = (g.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var style = g.accent ? ' style="--accent:' + esc(g.accent) + '"' : '';
    return '' +
      '<article class="game-card" id="game-' + esc(g.id) + '"' + style + '>' +
        '<a class="game-card__cover" href="' + esc(root + g.details) + '" tabindex="-1" aria-hidden="true">' +
          '<img src="' + esc(root + g.cover) + '" alt="" width="640" height="360" loading="' + (i < 3 ? 'eager' : 'lazy') + '">' +
        '</a>' +
        '<div class="game-card__body">' +
          (g.status ? '<span class="badge">' + esc(g.status) + '</span>' : '') +
          '<h3 class="game-card__title"><a href="' + esc(root + g.details) + '">' + esc(g.title) + '</a></h3>' +
          '<p class="game-card__pitch">' + esc(g.pitch) + '</p>' +
          (tags ? '<ul class="tags" aria-label="Tags">' + tags + '</ul>' : '') +
          '<div class="game-card__actions">' +
            '<a class="btn btn--play" href="' + esc(root + g.play) + '">&#9654; Play</a>' +
            '<a class="btn btn--ghost" href="' + esc(root + g.details) + '">Details</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  var comingSoon = '' +
    '<article class="game-card game-card--soon" aria-label="More games coming soon">' +
      '<div class="soon-inner"><span class="soon-blink">LOADING</span><span class="soon-sub">More games<br>coming soon</span></div>' +
    '</article>';

  document.querySelectorAll('[data-games-grid]').forEach(function (grid) {
    var list = window.GAMES || [];
    var skip = grid.getAttribute('data-exclude');
    list = list.filter(function (g) { return g.id !== skip; });
    grid.innerHTML = list.map(card).join('') + (grid.hasAttribute('data-no-soon') ? '' : comingSoon);
    var count = document.querySelector('[data-games-count]');
    if (count) count.textContent = (window.GAMES || []).length;
  });

  // 3) Lightbox for [data-lightbox] links (falls back to opening the image)
  var dlg = document.getElementById('lightbox');
  if (dlg && typeof dlg.showModal === 'function') {
    var img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    var cur = 0;
    function show(i) {
      cur = (i + links.length) % links.length;
      var a = links[cur];
      img.src = a.getAttribute('href');
      img.alt = a.querySelector('img') ? a.querySelector('img').alt : '';
      cap.textContent = a.getAttribute('data-caption') || '';
    }
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(i); dlg.showModal(); });
    });
    dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close(); });
    dlg.querySelector('[data-prev]').addEventListener('click', function () { show(cur - 1); });
    dlg.querySelector('[data-next]').addEventListener('click', function () { show(cur + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

})();
