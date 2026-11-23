/* Portrait / narrow layout for the dev launcher (v1, b=8). Adds a square-ish tile grid with folders on top of launcher.js.
   launcher.js (landscape deck, keyboard, phone remote, iframe stage) is untouched; we only call window.DEV.launch(). */
(function () {
  var MQ = window.matchMedia('(orientation: portrait) and (max-width: 900px), (max-width: 560px)');
  var GAMES = window.DEV_GAMES || [], OLD = window.DEV_OLD || [], EXTRA = window.DEV_EXTRA || [], FOLDERS = window.DEV_FOLDERS || [];
  var byId = {}; GAMES.concat(OLD, EXTRA).forEach(function (g) { byId[g.id] = g; });
  function lastId() { try { return localStorage.getItem('dev7q3x-last'); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v) { v = +v || 1; return Math.max(0.75, Math.min(1.25, v)); }
  function members(f) { return (f.items === '_old' ? OLD : f.items.map(function (id) { return byId[id]; })).filter(Boolean); }

  // Grid order: catalogue order; a folder takes its first member's slot ('first' folders lead, 'end' folders trail).
  function slots() {
    var inFolder = {}, lead = [], mid = [], tail = [];
    FOLDERS.forEach(function (f) { members(f).forEach(function (g) { inFolder[g.id] = f; }); });
    FOLDERS.forEach(function (f) { if (f.first) lead.push({ folder: f }); else if (f.end) tail.push({ folder: f }); });
    var placed = {};
    GAMES.forEach(function (g) {
      var f = inFolder[g.id];
      if (!f) { mid.push({ game: g }); return; }
      if (f.first || f.end || placed[f.id]) return;
      placed[f.id] = 1; mid.push({ folder: f });
    });
    return lead.concat(mid, tail);
  }
  function thumb(o) {
    return o.img ? '<img src="' + esc(o.img) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.textContent=\'\uD83C\uDFAE\'">' : esc(o.icon || '\uD83C\uDFAE');
  }
  function tile(s, last) {
    var g = s.game, f = s.folder, o = g || f, M = f ? members(f) : null;
    var t = document.createElement('div'), shape = o.shape || {}, w = clamp(shape.w), h = clamp(shape.h);
    var hasLast = g ? g.id === last : M.some(function (m) { return m.id === last; });
    t.className = 'pt-t' + (f ? ' fold' : '') + (o.img ? '' : ' ic') + (hasLast ? ' last-t' : '');
    t.style.width = (Math.min(1, w) * 100).toFixed(1) + '%';
    t.innerHTML = '<div class="im" style="aspect-ratio:' + (w / h).toFixed(3) + '">' + thumb(o) + '</div>' +
      '<div class="cp"><span class="nm">' + esc(o.name) + '</span><span class="vr">' + esc(g ? g.ver : M.length + (M.length === 1 ? ' build' : ' builds')) + '</span></div>' +
      (f ? '<div class="fc">\uD83D\uDCC1 ' + M.length + '</div>' : '') + (hasLast ? '<div class="last">last played</div>' : '');
    t.onclick = function () { if (f) { if (M.length === 1) go(M[0]); else openFolder(f); } else go(g); };
    return t;
  }
  function go(g) {
    if (!g) return;
    if (GAMES.indexOf(g) >= 0 || OLD.indexOf(g) >= 0) { window.DEV.launch(g.id); setTimeout(drawGrid, 50); }
    else location.href = g.url;
  }

  var grid, fold, strip, built = false;
  function drawGrid() {
    if (!grid) return; var last = lastId(), box = document.createElement('div'); box.className = 'pg-in';
    slots().forEach(function (s) { box.appendChild(tile(s, last)); });
    grid.innerHTML = ''; grid.appendChild(box);
  }
  function openFolder(f, noHist) {
    var M = members(f), last = lastId();
    fold.querySelector('h2').textContent = f.name; fold.querySelector('.fh span').textContent = M.length + ' entries';
    var L = fold.querySelector('.fl'); L.innerHTML = '';
    M.forEach(function (g) {
      var r = document.createElement('div'); r.className = 'pt-r';
      r.innerHTML = '<div class="im">' + thumb(g) + '</div><div class="tx"><div class="nm">' + esc(g.name) + ' <span class="vr">' + esc(g.ver) + '</span>' +
        (g.id === last ? '<span class="lp">last played</span>' : '') + '</div><div class="tg">' + esc(g.tag || '') + '</div></div><div class="go">\u25B6</div>';
      r.onclick = function () { closeFolder(); go(g); };
      L.appendChild(r);
    });
    L.scrollTop = 0; document.body.classList.add('pfo');
    if (!noHist) try { history.pushState({ ptf: f.id }, '', '#' + f.id); } catch (e) {}
  }
  function closeFolder(fromPop) {
    if (!document.body.classList.contains('pfo')) return;
    document.body.classList.remove('pfo');
    if (!fromPop && history.state && history.state.ptf) try { history.back(); } catch (e) {}
  }
  window.addEventListener('popstate', function () { var id = history.state && history.state.ptf; if (id) { var f = FOLDERS.filter(function (x) { return x.id === id; })[0]; if (f) openFolder(f, true); } else closeFolder(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('pt')) { if (document.body.classList.contains('pqr')) document.body.classList.remove('pqr'); else closeFolder(); } });

  function build() {
    if (built) return; built = true;
    var L = document.getElementById('launcher'), deck = document.getElementById('deck');
    grid = document.createElement('div'); grid.id = 'pgrid'; L.insertBefore(grid, deck.nextSibling);
    fold = document.createElement('div'); fold.id = 'pfold';
    fold.innerHTML = '<div class="fh"><button type="button">\u2190 Back</button><h2></h2><span></span></div><div class="fl"></div>';
    fold.querySelector('button').onclick = function () { closeFolder(); };
    document.body.appendChild(fold);
    strip = document.createElement('button'); strip.id = 'pstrip'; strip.type = 'button';
    strip.onclick = function () { document.body.classList.toggle('pqr'); paintStrip(); };
    L.appendChild(strip);
    document.getElementById('qrbox').addEventListener('click', function () { document.body.classList.remove('pqr'); paintStrip(); });
    var play = document.querySelector('header .st a[href="../go/"]'); if (play) play.classList.add('pplay');
    drawGrid(); paintStrip();
    var lt = grid.querySelector('.last-t'); if (lt && lt.offsetTop - grid.offsetTop > grid.clientHeight * 0.6) grid.scrollTop = lt.offsetTop - grid.offsetTop - 60;
  }
  function paintStrip() {
    if (!strip) return; var c = (document.getElementById('code') || {}).textContent || '';
    strip.innerHTML = document.body.classList.contains('pqr') ? '\u2715 Close remote' : '\uD83D\uDCF1 Phone remote <b>' + esc(c) + '</b>';
  }
  function apply() {
    var on = MQ.matches; document.body.classList.toggle('pt', on);
    if (on) { build(); drawGrid(); paintStrip(); } else document.body.classList.remove('pfo', 'pqr');
  }
  if (MQ.addEventListener) MQ.addEventListener('change', apply); else if (MQ.addListener) MQ.addListener(apply);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && document.body.classList.contains('pt')) drawGrid(); });
  apply();
  window.DEV_PORTRAIT = { openFolder: function (id) { var f = FOLDERS.filter(function (x) { return x.id === id; })[0]; if (f) openFolder(f); }, close: closeFolder, slots: slots };
})();
