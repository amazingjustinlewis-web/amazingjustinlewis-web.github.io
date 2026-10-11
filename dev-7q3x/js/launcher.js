/* Dev launcher host (laptop on the projector). Stays loaded the whole time: games run in an iframe on top,
   so the phone remote's PeerJS link never drops. Back = iframe removed (kills audio, peers, timers). */
(function () {
  var q = new URLSearchParams(location.search), store = window.localStorage;
  var MAIN = DEV_GAMES.slice(), OLD = DEV_OLD.slice();
  var OLDCARD = { id: '_old', name: 'Older versions', ver: OLD.length + '', tag: 'archived builds', meta: '\uD83D\uDDC2\uFE0F' };
  var MAINCARD = { id: '_main', name: 'Main games', ver: MAIN.length + '', tag: 'back to the current builds', meta: '\u2B05\uFE0F' };
  var view = 'main', sel = 0, playing = null, frame = null, last = store.getItem('dev7q3x-last');
  function list() { return view === 'main' ? MAIN.concat([OLDCARD]) : [MAINCARD].concat(OLD); }
  function byId(id) { return MAIN.concat(OLD).filter(function (g) { return g.id === id; })[0]; }
  if (last) { var lg = byId(last); if (lg) { if (lg.old) view = 'old'; sel = Math.max(0, list().indexOf(lg)); } }
  var deck = document.getElementById('deck'), stage = document.getElementById('stage');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function draw() {
    var L = list(); deck.innerHTML = '';
    L.forEach(function (g, i) {
      var d = i - sel; if (Math.abs(d) > 3) return;
      var c = document.createElement('div'); c.className = 'card' + (g.meta ? ' meta' : '') + (d === 0 ? ' sel' : '');
      c.innerHTML = (g.meta ? '<div class="img">' + g.meta + '</div>' : '<div class="img" style="background-image:url(\'' + esc(g.img) + '\')"></div>') +
        '<div class="cap"><span class="nm">' + esc(g.name) + '</span><span class="vr">' + esc(g.ver) + '</span><span class="tg">' + esc(g.tag || '') + '</span></div>' + (g.id === last ? '<div class="last">last played</div>' : '');
      c.style.transform = 'translateX(' + d * 34 + 'vw) translateZ(' + (-Math.abs(d) * 260) + 'px) rotateY(' + (-d * 18) + 'deg) scale(' + (d ? 0.8 : 1) + ')';
      c.style.opacity = d ? Math.max(0, 0.55 - (Math.abs(d) - 1) * 0.2) : 1; c.style.filter = d ? 'brightness(.6)' : ''; c.style.zIndex = 10 - Math.abs(d);
      c.onclick = function () { if (d === 0) launch(g.id); else { sel = i; changed(); } };
      deck.appendChild(c);
    });
  }
  function changed() { draw(); push(); }
  function move(n) { var L = list(); sel = (sel + n + L.length) % L.length; changed(); }
  function pick(id) {
    if (id === '_old') { view = 'old'; sel = 0; changed(); return; }
    if (id === '_main') { view = 'main'; sel = MAIN.length; changed(); return; }
  }
  function toast(t) { var e = document.getElementById('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove('on'); }, 2200); }

  // ---------------------------------------------------------------- run a game
  function teardown() {
    if (!frame) return;
    try { var w = frame.contentWindow; if (w) { try { w.speechSynthesis && w.speechSynthesis.cancel(); } catch (e) {} w.location.replace('about:blank'); } } catch (e) {}
    frame.remove(); frame = null;
  }
  function bust(url) { var u = url + (url.indexOf('?') < 0 ? '?' : '&') + 'devts=' + Date.now(); if (q.get('gamelocal') === '1') u += '&local=1&room=T' + (playing ? playing.id.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() : 'EST'); return u; }   // gamelocal=1: test harness only (BroadcastChannel instead of WebRTC)
  function launch(id) {
    if (id === '_old' || id === '_main') { pick(id); return; }
    var g = byId(id); if (!g) return;
    teardown(); playing = g; last = g.id; store.setItem('dev7q3x-last', g.id);
    if (g.mode === 'tab') { window.open(bust(g.url), '_blank'); playing = null; toast(g.name + ' opened in its own tab (it does not run inside the launcher)'); push(); draw(); return; }
    frame = document.createElement('iframe');
    frame.setAttribute('allow', 'autoplay; fullscreen; gyroscope; accelerometer; magnetometer; screen-wake-lock; clipboard-write; web-share');
    frame.setAttribute('allowfullscreen', ''); frame.title = g.name;
    frame.src = bust(g.url); stage.appendChild(frame);
    frame.addEventListener('load', function () { hook(frame); try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} });
    document.body.classList.add('playing'); toast(g.name + ' ' + g.ver);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen && !q.has('nofs')) document.documentElement.requestFullscreen().catch(function () {});
    push();
  }
  function back() { if (!playing && !frame) return; teardown(); playing = null; document.body.classList.remove('playing'); var L = list(); var i = L.indexOf(byId(last)); if (i >= 0) sel = i; changed(); window.focus(); }
  function reload() { if (playing) launch(playing.id); }
  // Esc inside the game (same origin, so we can listen to the iframe's own keyboard)
  var escAt = 0;
  function onKey(e) {
    if (playing) {
      if (e.key === 'Escape') { if (playing.escTwice) { var now = Date.now(); if (now - escAt < 700) { e.preventDefault(); back(); } escAt = now; } else { e.preventDefault(); e.stopPropagation(); back(); } }
      return;
    }
    if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'Enter' || e.key === ' ') launch(list()[sel].id);
  }
  function hook(f) { try { var w = f.contentWindow; w.addEventListener('keydown', onKey, true); w.document.addEventListener('mousemove', poke); } catch (e) {} }
  document.addEventListener('keydown', onKey, true);
  var corner = document.getElementById('corner');
  function poke() { corner.classList.add('show'); clearTimeout(poke.t); poke.t = setTimeout(function () { corner.classList.remove('show'); }, 2500); }
  document.addEventListener('mousemove', poke);
  document.getElementById('cBack').onclick = back; document.getElementById('cReload').onclick = reload;

  // ---------------------------------------------------------------- phone remote
  var phones = {}, nPh = 0;
  function info() { return { t: 'dev', view: view, sel: sel, last: last, playing: playing && playing.id, list: list().map(function (g) { return { id: g.id, name: g.name, ver: g.ver, tag: g.tag, img: g.img ? new URL(g.img, location.href).href : null, meta: g.meta || null, old: !!g.old }; }) }; }
  function push() { var m = info(); for (var k in phones) net.send(phones[k], m); }
  function onMsg(c, m) {
    if (!m || !m.t) return;
    if (!phones[c.connectionId]) { phones[c.connectionId] = c; nPh++; status(); }
    if (m.t === 'hello') { net.send(c, info()); return; }
    if (m.t === 'ping') { net.send(c, { t: 'pong' }); return; }
    if (m.t === 'sel') { sel = Math.max(0, Math.min(list().length - 1, m.i | 0)); changed(); }
    else if (m.t === 'launch') { if (m.id === '_old' || m.id === '_main') pick(m.id); else launch(m.id); }
    else if (m.t === 'back') back();
    else if (m.t === 'reload') reload();
  }
  function status() { document.getElementById('st').textContent = nPh ? 'remote: linked (' + nPh + ')' : 'remote: waiting'; }
  var code = q.get('room') || store.getItem('dev7q3x-room') || LRNet.makeCode(); store.setItem('dev7q3x-room', code);
  var useLocal = q.get('local') === '1';
  var net = new (useLocal ? LRNet.LocalHost : LRNet.Host)({ code: code, onMessage: onMsg,
    onJoin: function (c) { if (!phones[c.connectionId]) { phones[c.connectionId] = c; nPh++; } status(); net.send(c, info()); },
    onClose: function (c) { if (phones[c.connectionId]) { delete phones[c.connectionId]; nPh--; } status(); },
    onStatus: function (s) { if (s !== 'online') document.getElementById('st').textContent = 'remote link: ' + s; else status(); } });
  var rurl = location.href.replace(/[?#].*$/, '').replace(/index\.html$/, '') + 'remote.html?room=' + code + (useLocal ? '&local=1' : '');
  document.getElementById('code').textContent = code;
  try { var qr = qrcode(0, 'M'); qr.addData(rurl); qr.make(); document.getElementById('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
  window.DEV = { launch: launch, back: back, reload: reload, move: move, state: function () { return { view: view, sel: sel, playing: playing && playing.id, frame: !!frame, phones: nPh, last: last }; }, frame: function () { return frame; }, remoteUrl: rurl };
  draw();
})();
