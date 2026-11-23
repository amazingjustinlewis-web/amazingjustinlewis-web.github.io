/* ZTP pre-game lobby v01. Name screen -> lobby (everyone's names + live ping) -> host presses Start.
   Game-agnostic: it only needs a Kit.host (h.players, h.send) on the host and a Kit.pad client (c.send) on phones.
   Host:  var L = Lobby.host({ host: h, title, me: 'Name' | null (TV), remoteStart: bool, invite: fn, onStart: fn });
          in Kit.host onMsg:  if (L.msg(p, m)) return;      L.started, L.start(), L.show()
   Pad:   Lobby.nameCard({ title, name, onJoin: fn(name) })  -> name screen with random-name button
          var P = Lobby.pad({ c: client, title, onStart: fn }); in Kit.pad onMsg:  if (P.msg(m)) return;
   Messages: lpq/lpa (ping), lob (list + started), lstart (remote start request). */
(function (root) {
  'use strict';
  var A = ['Turbo', 'Cosmic', 'Sneaky', 'Mighty', 'Fuzzy', 'Rocket', 'Lucky', 'Zippy', 'Brave', 'Wobbly', 'Sonic', 'Pixel'],
      B = ['Moose', 'Otter', 'Comet', 'Badger', 'Falcon', 'Walrus', 'Panda', 'Gecko', 'Yeti', 'Beaver', 'Lynx', 'Puffin'];
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function randomName() { return (rnd(A) + rnd(B)).slice(0, 12); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  var css = false;
  function style() { if (css) return; css = true; var s = document.createElement('style');
    s.textContent = '.zlob{position:fixed;inset:0;z-index:990;background:#0b0a1cf2;display:flex;align-items:center;justify-content:center;touch-action:manipulation;font-family:system-ui;color:#fff}' +
      '.zlob .c{width:min(92vw,420px);text-align:center}.zlob h1{margin:0 0 6px;font-size:28px;color:#ffe7a0}.zlob input{width:100%;box-sizing:border-box;font-size:20px;padding:12px;border-radius:12px;border:2px solid #fff4;background:#fff;color:#111}' +
      '.zlob button{touch-action:manipulation;width:100%;margin-top:10px;padding:14px;border-radius:14px;border:0;font:700 18px system-ui;background:#5b6cff;color:#fff}.zlob button.s{background:#2e2c48;font-size:15px;padding:10px}.zlob button.go{background:#22c55e}' +
      '.zlob ul{list-style:none;padding:0;margin:10px 0;text-align:left}.zlob li{display:flex;justify-content:space-between;padding:10px 12px;margin:6px 0;background:#ffffff14;border-radius:10px;font-size:18px}.zlob .p{font:600 15px ui-monospace,monospace}' +
      '.zlob .g{color:#4ade80}.zlob .y{color:#facc15}.zlob .r{color:#f87171}.zlob .m{opacity:.75;font-size:14px}';
    document.head.appendChild(s); }
  function ov() { style(); var d = document.createElement('div'); d.className = 'zlob'; document.body.appendChild(d); return d; }
  function pcls(ms) { return ms == null ? 'm' : ms < 80 ? 'g' : ms < 180 ? 'y' : 'r'; }
  function list(rows) { return '<ul>' + rows.map(function (r) { return '<li><span>' + (r.host ? '\u2B50 ' : '') + esc(r.name) + (r.you ? ' (you)' : '') + '</span><span class="p ' + pcls(r.ms) + '">' + (r.ms == null ? (r.host ? 'host' : '\u2026') : r.ms + ' ms') + '</span></li>'; }).join('') + '</ul>'; }

  var Lobby = { randomName: randomName };
  Lobby.nameCard = function (o) {
    var d = ov(); d.innerHTML = '<div class="c"><h1>' + esc(o.title) + '</h1><p class="m">Pick a name for this match</p><input id="zlN" maxlength="12" placeholder="Your name" value="' + esc(o.name || '').replace(/"/g, '') + '">' +
      '<button class="s" id="zlR">\uD83C\uDFB2 Random name</button><button class="go" id="zlJ">Join</button></div>';
    var n = d.querySelector('#zlN');
    d.querySelector('#zlR').onclick = function () { n.value = randomName(); };
    d.querySelector('#zlJ').onclick = function () { var v = (n.value || '').trim() || randomName(); try { localStorage.setItem('ztp-mini-name', v); } catch (e) {} d.remove(); o.onJoin(v); };
    return d;
  };

  Lobby.host = function (o) {
    var h = o.host, L = { started: false }, d = null, pingT = null;
    function rows() { var r = []; if (o.me) r.push({ name: o.me, host: true, ms: null });
      h.players.forEach(function (p) { if (p.on === false || p.local) return; r.push({ id: p.id, name: p.name, ms: p.lms == null ? null : p.lms }); }); return r; }
    function bcast() { var r = rows(), first = r.filter(function (x) { return !x.host; })[0];
      h.players.forEach(function (p) { if (p.local || p.on === false) return; h.send(p, { t: 'lob', title: o.title, started: L.started, list: r.map(function (x) { return { name: x.name, ms: x.ms, host: !!x.host, you: x.id === p.id }; }), canStart: !!(o.remoteStart && first && first.id === p.id) }); }); }
    function paint() { if (!d) return; var r = rows(), n = r.filter(function (x) { return !x.host; }).length;
      if (!d.firstChild) { d.innerHTML = '<div class="c"><h1>' + esc(o.title) + ' lobby</h1><p class="m" id="zlC"></p><div id="zlL"></div><p class="m" id="zlW">Waiting for friends to join\u2026</p>' +
          (o.invite ? '<button class="s" id="zlI">\uD83D\uDD17 Invite a friend</button>' : '') + '<button class="go" id="zlS">Start Game</button></div>';
        if (o.invite) d.querySelector('#zlI').onclick = o.invite; d.querySelector('#zlS').onclick = L.start; }
      d.querySelector('#zlC').innerHTML = h.code ? 'Room code <b style="font-size:20px;letter-spacing:.12em;color:#ffe7a0">' + esc(h.code) + '</b>' : '';
      d.querySelector('#zlL').innerHTML = list(r); d.querySelector('#zlW').style.display = n ? 'none' : ''; d.querySelector('#zlS').textContent = 'Start Game' + (n ? '' : ' (vs computer)'); }
    function tick() { var now = performance.now(); h.players.forEach(function (p) { if (!p.local && p.on !== false) h.send(p, { t: 'lpq', ts: now }); }); paint(); bcast(); }
    L.show = function () { if (L.started || d) return; d = ov(); paint(); };
    L.start = function () { if (L.started) return; L.started = true; if (d) { d.remove(); d = null; } bcast(); if (o.onStart) o.onStart(); };
    L.msg = function (p, m) {
      if (!m) return false;
      if (m.t === 'lpa') { var ms = Math.round(performance.now() - m.ts); p.lms = p.lms == null ? ms : Math.round(p.lms * .6 + ms * .4); return true; }
      if (m.t === 'lstart') { if (o.remoteStart) L.start(); return true; }
      return false;
    };
    L.joined = function () { setTimeout(tick, 50); if (o.showOnJoin) L.show(); };
    pingT = setInterval(tick, 1000);
    if (!o.hidden) L.show();
    return L;
  };

  Lobby.pad = function (o) {
    var P = { started: false, seen: false }, d = null;
    function paint(m) { if (!d) d = ov();
      if (!d.querySelector('#zlL')) { d.innerHTML = '<div class="c"><h1>' + esc(m.title || o.title) + ' lobby</h1><div id="zlL"></div><button class="go" id="zlS" style="display:none">Start Game</button><p class="m" id="zlW">Waiting for the host to press Start\u2026</p></div>';
        d.querySelector('#zlS').onclick = function () { o.c.send({ t: 'lstart' }); }; }
      d.querySelector('#zlL').innerHTML = list(m.list || []); d.querySelector('#zlS').style.display = m.canStart ? '' : 'none'; d.querySelector('#zlW').style.display = m.canStart ? 'none' : ''; }
    P.waiting = function () { if (d || P.started) return; d = ov(); d.innerHTML = '<div class="c"><h1>' + esc(o.title) + '</h1><p class="m">Connecting to the host\u2026</p></div>'; };
    P.msg = function (m) {
      if (!m) return false;
      if (m.t === 'lpq') { o.c.send({ t: 'lpa', ts: m.ts }); return true; }
      if (m.t === 'lob') { P.seen = true; if (o.ignore && o.ignore()) return true; if (m.started) { if (!P.started) { P.started = true; if (d) { d.remove(); d = null; } if (o.onStart) o.onStart(); } } else if (!P.started) paint(m); return true; }
      return false;
    };
    return P;
  };
  root.Lobby = Lobby;
})(window);
