/* Shared site behaviour: applies the site name and renders every game list
   from games.js. No build step, no dependencies. */
(function () {
  'use strict';
  var SITE = window.SITE || { name: 'Games' };
  var GAMES = window.GAMES || [], SERIES = window.SERIES || [], INTENSITY = window.INTENSITY || [];
  var root = document.body.getAttribute('data-root') || '';   // '' on root pages, '../' in /games/

  // ---- site name ----
  document.querySelectorAll('[data-site-name]').forEach(function (el) { el.textContent = SITE.name; });
  var pageTitle = document.documentElement.getAttribute('data-page-title');
  document.title = pageTitle ? pageTitle + ' | ' + SITE.name : SITE.name;
  var ogSite = document.querySelector('meta[property="og:site_name"]');
  if (ogSite) ogSite.setAttribute('content', SITE.name);
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---- helpers ----
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function current(g) {
    var v = (g.versions || []).filter(function (x) { return x.current; })[0] || (g.versions || [])[0];
    return v || { play: g.play };
  }
  function vlabel(v) { return esc(v.id) + (v.name ? ' \u00b7 ' + esc(v.name) : ''); }
  function inSection(g, s) { return (g.sections || []).indexOf(s) !== -1; }
  function byId(id) { return GAMES.filter(function (g) { return g.id === id; })[0]; }
  window.ZTP = { current: current, inSection: inSection };

  function meter(g) {
    if (!g.intensity) return '';
    var dots = '';
    for (var i = 1; i <= 5; i++) dots += '<span class="pip' + (i <= g.intensity ? ' on' : '') + '"></span>';
    return '<div class="meter" role="img" aria-label="Intensity ' + g.intensity + ' of 5: ' + esc(INTENSITY[g.intensity]) + '">' +
      '<span class="meter__label">' + esc(INTENSITY[g.intensity]) + '</span><span class="meter__pips">' + dots + '</span></div>';
  }
  function versionsList(g, cls) {
    var vs = g.versions || [];
    if (!vs.length) return '';
    return '<ul class="versions ' + (cls || '') + '" aria-label="' + esc(g.title) + ' versions">' + vs.map(function (v) {
      return '<li class="' + (v.current ? 'is-current' : '') + '">' +
        '<a href="' + esc(root + v.play) + '"><span class="v-id">' + vlabel(v) + '</span>' +
        (v.current ? '<span class="v-badge">Current</span>' : '<span class="v-badge v-badge--old">Older build</span>') + '</a>' +
        (v.notes ? '<p class="v-notes">' + esc(v.notes) + '</p>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  // ---- arcade-style cards (family page etc.) ----
  function card(g, i) {
    var tags = (g.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var style = g.accent ? ' style="--accent:' + esc(g.accent) + '"' : '';
    var v = current(g);
    return '' +
      '<article class="game-card" id="game-' + esc(g.id) + '"' + style + '>' +
        '<a class="game-card__cover" href="' + esc(root + g.details) + '" tabindex="-1" aria-hidden="true">' +
          '<img src="' + esc(root + g.cover) + '" alt="" width="640" height="360" loading="' + (i < 3 ? 'eager' : 'lazy') + '">' +
        '</a>' +
        '<div class="game-card__body">' +
          (g.status ? '<span class="badge">' + esc(g.status) + '</span>' : '') +
          '<h3 class="game-card__title"><a href="' + esc(root + g.details) + '">' + esc(g.title) + '</a></h3>' +
          '<p class="game-card__pitch">' + esc(g.pitch) + '</p>' +
          meter(g) +
          (tags ? '<ul class="tags" aria-label="Tags">' + tags + '</ul>' : '') +
          '<div class="game-card__actions">' +
            '<a class="btn btn--play" href="' + esc(root + v.play) + '">&#9654; Play' + (v.id ? ' <span class="btn-sub">' + esc(v.id) + '</span>' : '') + '</a>' +
            '<a class="btn btn--ghost" href="' + esc(root + g.details) + '">Details</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }
  var comingSoon = '<article class="game-card game-card--soon" aria-label="More games coming soon">' +
    '<div class="soon-inner"><span class="soon-blink">LOADING</span><span class="soon-sub">More games<br>coming soon</span></div></article>';

  document.querySelectorAll('[data-games-grid]').forEach(function (grid) {
    var sec = grid.getAttribute('data-section');
    var list = GAMES.filter(function (g) { return !sec || inSection(g, sec); });
    list.sort(function (a, b) { return (a.intensity || 0) - (b.intensity || 0); });   // soft first, intense last
    grid.innerHTML = list.map(card).join('') + (grid.hasAttribute('data-no-soon') ? '' : comingSoon);
  });

  // ---- soft-play series rows ----
  function softGame(g) {
    var v = current(g);
    var notes = (g.goodToKnow || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('');
    return '' +
      '<article class="soft-game" id="game-' + esc(g.id) + '">' +
        '<a class="soft-game__cover" href="' + esc(root + g.details) + '" tabindex="-1" aria-hidden="true"><img src="' + esc(root + g.cover) + '" alt="" width="640" height="360"></a>' +
        '<div class="soft-game__body">' +
          '<h3 class="soft-game__title"><a href="' + esc(root + g.details) + '">' + esc(g.title) + '</a></h3>' +
          '<p>' + esc(g.pitch) + '</p>' +
          '<div class="soft-game__actions">' +
            '<a class="pill pill--go" href="' + esc(root + v.play) + '">Play ' + vlabel(v) + '</a>' +
            '<a class="pill pill--soft" href="' + esc(root + g.details) + '">About this game</a>' +
          '</div>' +
          '<h4>Versions</h4>' + versionsList(g, 'versions--soft') +
          (notes ? '<details class="good-to-know"><summary>Good to know before you play</summary><ul>' + notes + '</ul></details>' : '') +
        '</div>' +
      '</article>';
  }
  document.querySelectorAll('[data-series]').forEach(function (el) {
    var id = el.getAttribute('data-series');
    var list = GAMES.filter(function (g) { return g.series === id; });
    el.innerHTML = list.map(softGame).join('') +
      '<div class="soft-soon" aria-label="More one-button games coming">More one-button games are on the way.</div>';
  });

  // ---- tiny lists inside the home-page cards ----
  document.querySelectorAll('[data-mini-series]').forEach(function (el) {
    var list = GAMES.filter(function (g) { return g.series === el.getAttribute('data-mini-series'); });
    el.innerHTML = list.map(function (g) {
      return '<li><span class="mini-title">' + esc(g.title) + '</span> <span class="mini-v">' + vlabel(current(g)) + '</span></li>';
    }).join('');
  });
  document.querySelectorAll('[data-mini-section]').forEach(function (el) {
    var list = GAMES.filter(function (g) { return inSection(g, el.getAttribute('data-mini-section')); });
    el.innerHTML = list.map(function (g) {
      return '<li><span class="mini-title">' + esc(g.title) + '</span> <span class="mini-v">' + esc(INTENSITY[g.intensity] || '') + '</span></li>';
    }).join('');
  });
  document.querySelectorAll('[data-count-section]').forEach(function (el) {
    var n = GAMES.filter(function (g) { return inSection(g, el.getAttribute('data-count-section')); }).length;
    el.textContent = n + (n === 1 ? ' game' : ' games');
  });
  document.querySelectorAll('[data-series-title]').forEach(function (el) {
    var s = SERIES.filter(function (x) { return x.id === el.getAttribute('data-series-title'); })[0];
    if (s) el.textContent = s.title;
  });

  // ---- versions on a details page ----
  document.querySelectorAll('[data-versions]').forEach(function (el) {
    var g = byId(el.getAttribute('data-versions'));
    if (g) el.innerHTML = versionsList(g);
  });
  document.querySelectorAll('[data-good-to-know]').forEach(function (el) {
    var g = byId(el.getAttribute('data-good-to-know'));
    if (g) el.innerHTML = (g.goodToKnow || []).map(function (n, i) {
      return '<li><span class="icon">' + (i + 1) + '</span><div><span class="d" style="color:var(--ink)">' + esc(n) + '</span></div></li>';
    }).join('');
  });
  document.querySelectorAll('[data-play-current]').forEach(function (a) {
    var g = byId(a.getAttribute('data-play-current'));
    if (g) a.setAttribute('href', root + current(g).play);
  });

  // ---- screenshot lightbox ----
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
