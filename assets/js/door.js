/* Zero to Phi front door (TV side).
   Every screen opens a PeerJS room; its QR is <site>/go/?pair=<room>. A phone that scans becomes this screen's remote:
   the QR sinks into the black, and the TV shows the options menu, driven from the phone (or locally by mouse/keyboard).
   Picking a big-screen game fades the TV into it (in-page frame, no new tab); the game shows its own join QR,
   and the front-door QR comes back for the next arrival. ?local=1 uses a same-browser BroadcastChannel (tests). */
(function (root) {
  'use strict';
  var SITE = 'https://amazingjustinlewis-web.github.io/';
  root.LR_CONFIG = root.LR_CONFIG || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  var CSS = '#door{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);opacity:0;pointer-events:none;transition:opacity .6s;font-family:Georgia,serif;cursor:default}' +
    '#door.on{opacity:1;pointer-events:auto}#door .p{min-width:min(560px,80vw);padding:4vh 4vw;border:1px solid rgba(226,184,74,.35);border-radius:3vh;background:rgba(6,5,3,.92)}' +
    '#door h2{margin:0 0 2.4vh;font-weight:400;letter-spacing:.3em;color:#e2b84a;font-size:clamp(14px,2.4vh,28px)}#door ul{list-style:none;margin:0;padding:0}' +
    '#door li{padding:1.5vh 2vw;margin:.6vh 0;border-radius:1.6vh;color:#e9dcc0;font-size:clamp(16px,3.2vh,40px);letter-spacing:.06em;cursor:pointer;border:1px solid transparent}' +
    '#door li.sel{border-color:#e2b84a;background:#2a200c;color:#fff3cc}#door .hint{margin-top:2vh;color:#7d6c48;font-size:clamp(11px,1.7vh,20px);letter-spacing:.12em}' +
    '#door .big{display:flex;flex-direction:column;align-items:center;gap:2vh}#door canvas{background:#cea03e;border-radius:1vh}' +
    '#doorframe{position:fixed;inset:0;z-index:30;width:100%;height:100%;border:0;background:#000;opacity:0;transition:opacity .9s;pointer-events:none}#doorframe.on{opacity:1;pointer-events:auto}' +
    '#doorfade{position:fixed;inset:0;z-index:29;background:#000;opacity:0;transition:opacity .6s;pointer-events:none}#doorfade.on{opacity:1}' +
    '#doorbadge{position:fixed;left:1.4vw;bottom:1.4vh;z-index:31;font:clamp(10px,1.5vh,16px) Georgia,serif;letter-spacing:.2em;color:rgba(226,184,74,.35);pointer-events:none}';
  root.Door = function (o) {
    var q = new URLSearchParams(location.search), local = q.get('local') === '1';
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'door'; document.body.appendChild(ov);
    var fade = document.createElement('div'); fade.id = 'doorfade'; document.body.appendChild(fade);
    var fr = document.createElement('iframe'); fr.id = 'doorframe'; fr.allow = 'autoplay; fullscreen; gamepad; accelerometer; gyroscope'; document.body.appendChild(fr);
    var badge = document.createElement('div'); badge.id = 'doorbadge'; document.body.appendChild(badge);
    var stack = [], sel = 0, open = false, playing = null, net = null, remotes = {}, code = null;
    function pairURL(c) { var u = SITE + 'go/?pair=' + c + (local ? '&local=1' : ''); return o.extra ? u + '&' + o.extra : u; }
    function cur() { return stack[stack.length - 1]; }
    function items() { var m = cur(); return m ? m.items : []; }
    function broadcast(m) { for (var k in remotes) try { net.send(remotes[k], m); } catch (e) {} }
    function sync() { broadcast(playing ? { t: 'playing', name: playing.name, since: playing.since, mins: playing.mins || 20, late: !!playing.late, ctrl: playing.ctrl || '', owner: playing.owner || '' } : open ? { t: 'menu', title: cur().title, items: items().map(function (i) { return i.label; }), sel: sel, depth: stack.length } : { t: 'idle' }); }
    function render() {
      var m = cur(); if (!m) return;
      if (m.big) { ov.innerHTML = '<div class="p big"><h2>' + m.title + '</h2><canvas id="doorqr"></canvas><div class="hint">' + m.big.replace(SITE, '') + '</div><ul><li class="sel">Back</li></ul></div>'; drawBig(m.big); }
      else ov.innerHTML = '<div class="p"><h2>' + m.title + '</h2><ul>' + m.items.map(function (it, i) { return '<li data-i="' + i + '"' + (i === sel ? ' class="sel"' : '') + '>' + it.label + '</li>'; }).join('') + '</ul><div class="hint">' + (Object.keys(remotes).length ? 'PHONE REMOTE CONNECTED' : 'ARROWS + ENTER · ESC TO CLOSE') + '</div></div>';
      sync();
    }
    function drawBig(url) { var c = document.getElementById('doorqr'), Q = qrcode(0, 'M'); Q.addData(url); Q.make(); var n = Q.getModuleCount() + 8, m = Math.max(3, Math.floor(innerHeight * 0.42 / n)), x = c.getContext('2d');
      c.width = c.height = n * m; x.fillStyle = '#cea03e'; x.fillRect(0, 0, n * m, n * m); x.fillStyle = '#000'; for (var r = 0; r < n - 8; r++) for (var k = 0; k < n - 8; k++) if (Q.isDark(r, k)) x.fillRect((k + 4) * m, (r + 4) * m, m, m); }
    function menu() { stack = [{ title: o.title || 'ZERO TO PHI', items: o.items() }]; sel = 0; open = true; ov.classList.add('on'); render(); }
    function close() { open = false; stack = []; ov.classList.remove('on'); sync(); }
    function back() { if (playing) return stop(); if (stack.length > 1) { stack.pop(); sel = 0; render(); } else close(); }
    function act(it) {
      if (!it) return;
      if (it.sub) { stack.push({ title: it.label.toUpperCase(), items: it.sub() }); sel = 0; render(); }
      else if (it.qr) { stack.push({ title: 'SCAN TO PAIR A PHONE', items: [{ label: 'Back', back: 1 }], big: pairURL(code) }); sel = 0; render(); }
      else if (it.play) play(it);
      else if (it.phone && !paired()) location.href = it.phone;
      else if (it.phone) { broadcast({ t: 'open', url: it.phone }); if (it.note) { stack.push({ title: it.note, items: [{ label: 'Back', back: 1 }] }); sel = 0; render(); } }
      else if (it.href) location.href = it.href;
      else if (it.back) back();
      else if (it.close) close();
    }
    function nav(d, from) {
      if (playing) { if (d === 'back' && (!from || !playing.owner || from === playing.owner)) stop(); return; }
      if (!open) { menu(); return; }
      var n = cur().big ? 1 : items().length;
      if (d === 'up') sel = (sel + n - 1) % n; else if (d === 'down') sel = (sel + 1) % n;
      else if (d === 'select') return cur().big ? back() : act(items()[sel]); else if (d === 'back') return back();
      render();
    }
    // fade the TV into a game in-page; the game shows its own join QR for everyone else
    function play(it) {
      it.since = Date.now(); it.owner = it.owner || ''; playing = it; fade.classList.add('on'); close(); playing = it;
      setTimeout(function () { if (playing !== it) return; fr.onload = function () { if (playing !== it) return; fr.classList.add('on'); fade.classList.remove('on'); }; fr.src = it.play; }, 600);
      if (o.onPlay) o.onPlay(true); update(); sync();
    }
    function stop() { fr.onload = null; fade.classList.remove('on'); fr.classList.remove('on'); setTimeout(function () { fr.removeAttribute('src'); }, 900); playing = null; if (o.onPlay) o.onPlay(false); update(); menu(); }
    ov.addEventListener('click', function (e) { var li = e.target.closest('li'); if (!li) return; if (cur().big) return back(); sel = +li.dataset.i; act(items()[sel]); e.stopPropagation(); });
    addEventListener('keydown', function (e) {
      var k = e.key; if (k === 'Escape' || k === 'Backspace') { if (open || playing) { back(); e.preventDefault(); } return; }
      if (!open) { if (k === 'Enter' || k === ' ') menu(); return; }
      if (k === 'ArrowUp') nav('up'); else if (k === 'ArrowDown') nav('down'); else if (k === 'Enter' || k === ' ') nav('select'); else return; e.preventDefault();
    });
    function paired() { return Object.keys(remotes).length > 0; }
    function update() { if (o.onPaired) o.onPaired(paired() && !playing); badge.textContent = paired() ? 'PAIRED' : ''; }
    var opts = { prefix: 'ztp-door-v1-', onStatus: function (s, c) { if (c && c !== code) { code = c; if (o.onCode) o.onCode(pairURL(c), c); } },
      onJoin: function (conn) { remotes[conn.connectionId] = conn; net.send(conn, { t: 'hello', screen: o.name || 'Zero to Phi', you: conn.connectionId }); update(); if (!open && !playing) menu(); else sync(); },
      onMessage: function (conn, d) { if (!remotes[conn.connectionId]) opts.onJoin(conn); if (!d || d.t === 'ping') return net.send(conn, { t: 'pong' });
        if (d.t === 'nav') nav(d.d, conn.connectionId); else if (d.t === 'pick') { if (playing) return; if (!open) menu(); sel = d.i; var it = items()[d.i]; if (it && it.play) it.owner = conn.connectionId; act(it); } else if (d.t === 'hi') sync(); },
      onClose: function (conn) { delete remotes[conn.connectionId]; update(); if (!paired() && open) close(); } };
    if (!o.noPair) { net = local ? new LRNet.LocalHost(opts) : new LRNet.Host(opts); code = net.code; if (o.onCode) o.onCode(pairURL(code), code); }
    var api = { menu: menu, close: close, isOpen: function () { return open; }, code: function () { return code; }, pairURL: function () { return pairURL(code); } };
    root.__door = api; return api;
  };
})(window);
