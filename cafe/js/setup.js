/* Owner setup: edit the café config, save to the store, encode into a shareable screen link + table tent QR. */
(function () {
  var $ = function (id) { return document.getElementById(id); }, cfg, ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function room() { var s = ''; for (var i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  Cafe.GAMES.forEach(function (g) {
    $('games').insertAdjacentHTML('beforeend', '<label><input type="checkbox" data-g="' + g.id + '"' + (g.ready ? '' : ' disabled') + '> ' + g.icon + ' ' + g.name + (g.ready ? '' : ' <span class="hint">soon</span>') + '</label>');
  });
  function fill() {
    $('name').value = cfg.name; $('logoUrl').value = /^data:/.test(cfg.logo) ? '' : cfg.logo; if (cfg.logo) $('logoPrev').src = cfg.logo; else $('logoPrev').removeAttribute('src');
    $('accent').value = cfg.accent; $('accent2').value = cfg.accent2; $('bg').value = cfg.bg;
    document.querySelectorAll('[data-g]').forEach(function (b) { b.checked = !!cfg.games[b.dataset.g]; });
    $('menu').value = cfg.menu.map(function (m) { return [m.name, m.price, m.cat].filter(function (x, i) { return x || i === 0; }).join(' | '); }).join('\n');
    $('specials').value = cfg.specials.join('\n'); $('promos').value = cfg.promos.map(function (p) { return p.text; }).join('\n');
    $('promoRewards').checked = cfg.promoRewards; $('leaderboards').checked = cfg.leaderboards;
  }
  function lines(id) { return $(id).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function read() {
    cfg.name = $('name').value.trim() || 'My Caf\u00e9';
    cfg.accent = $('accent').value; cfg.accent2 = $('accent2').value; cfg.bg = $('bg').value;
    cfg.games = {}; document.querySelectorAll('[data-g]').forEach(function (b) { if (b.checked) cfg.games[b.dataset.g] = true; });
    cfg.menu = lines('menu').map(function (l) { var p = l.split('|').map(function (s) { return s.trim(); }); return { name: p[0], price: (p[1] || '').replace(/^\$/, ''), cat: p[2] || '' }; }).slice(0, 40);
    cfg.specials = lines('specials').slice(0, 8); cfg.promos = lines('promos').slice(0, 6).map(function (t) { return { text: t, on: true }; });
    cfg.promoRewards = $('promoRewards').checked; cfg.leaderboards = $('leaderboards').checked;
  }
  var t;
  function out() {
    Cafe.applyTheme(cfg);
    Cafe.store.saveConfig(cfg);
    Cafe.encode(cfg).then(function (h) {
      var screen = Cafe.base() + 'screen.html#c=' + h, play = Cafe.base() + 'play.html?room=' + cfg.room;
      $('open').href = screen; $('open').dataset.url = screen;
      $('tName').textContent = cfg.name; $('tCode').textContent = 'Table code ' + cfg.room; $('tQr').innerHTML = Cafe.qrSvg(play, 6);
      $('msg').textContent = 'Saved \u2713'; clearTimeout(t); t = setTimeout(function () { $('msg').textContent = ''; }, 1500);
    });
  }
  function change() { read(); out(); }
  document.querySelectorAll('input,textarea').forEach(function (el) { if (el.id !== 'logoFile') el.addEventListener('input', change); });
  $('logoUrl').addEventListener('change', function () { cfg.logo = $('logoUrl').value.trim(); $('logoPrev').src = cfg.logo; out(); });
  $('logoFile').addEventListener('change', function () {   // shrink to 160px so the data URL stays small enough for the link
    var f = this.files[0]; if (!f) return; var img = new Image();
    img.onload = function () { var s = Math.min(1, 160 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cfg.logo = c.toDataURL('image/webp', 0.8); if (cfg.logo.length > 40000) cfg.logo = c.toDataURL('image/jpeg', 0.6); $('logoPrev').src = cfg.logo; $('logoUrl').value = ''; out(); };
    img.src = URL.createObjectURL(f);
  });
  $('reset').onclick = function () { if (!confirm('Reset all leaderboard scores?')) return; cfg.scoreEpoch = (cfg.scoreEpoch || 1) + 1; Cafe.store.resetScores(cfg); out(); $('msg').textContent = 'Scores reset \u2713 (re-open the screen link)'; };
  $('demo').onclick = function () { var r = cfg.room; cfg = Cafe.demo(); cfg.room = r; fill(); out(); };
  $('copy').onclick = function () { navigator.clipboard && navigator.clipboard.writeText($('open').dataset.url); $('copy').textContent = 'Copied \u2713'; };
  Cafe.store.loadConfig().then(function (c) {
    cfg = c ? Cafe.merge(c) : (location.hash === '#demo' ? Cafe.demo() : Cafe.defaults());
    if (!cfg.room) cfg.room = room();
    fill(); out();
  });
})();
