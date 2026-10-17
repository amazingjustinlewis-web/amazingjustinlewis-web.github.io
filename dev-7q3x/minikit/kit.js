/* 0-Phi mini games kit (dev). One tiny layer over Lost Sock's net.js (PeerJS, ?local=1 = BroadcastChannel for tests).
   Page sets window.MINI = 'gameid' before loading. Then:
   Kit.host({ max, onJoin(p), onLeave(p), onMsg(p, m) }) -> h: h.players[], h.send(p, m), h.all(m), h.qr(el), h.code
   Kit.pad({ onMsg(m), onStatus(s) }) -> c: c.send(m), c.room, c.name
   Kit.started(), Kit.over(fn, ms) (front door), Kit.flick(el, cb, opts), Kit.isPhone */
(function (root) {
  'use strict';
  var Q = new URLSearchParams(location.search), LOCAL = Q.get('local') === '1', GAME = root.MINI || 'mini';
  root.LS_CONFIG = { peerPrefix: 'ztp-mini-' + GAME + '-v1-', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  var EMBED = false; try { EMBED = root.parent && root.parent !== root; } catch (e) { EMBED = true; }
  var COLORS = ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f', '#c77dff', '#ff9f43'];
  function Kit_Q_phone(q) { return q.get('phone') === '1'; }
  function base() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }
  function qrSvg(t) { var q = root.qrcode(0, 'M'); q.addData(t); q.make(); return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true }); }
  var started = false;
  var Kit = {
    Q: Q, LOCAL: LOCAL, COLORS: COLORS, base: base, qrSvg: qrSvg,
    isPhone: Kit_Q_phone(Q) || Math.min(screen.width, screen.height) < 600 || (matchMedia('(pointer:coarse)').matches && innerWidth < 900),
    phase: function (p) { root.ZTP_PHASE = p; if (p !== 'lobby') Kit.started(); },
    started: function () { if (started || !EMBED) return; started = true; try { root.parent.postMessage({ ztp: 'started' }, '*'); } catch (e) {} },
    over: function (fn, ms) { if (root.ZTPEnd) root.ZTPEnd.watch(fn, ms || 45000); }
  };
  root.ZTP_PHASE = 'lobby';
  Kit.host = function (o) {
    var h = { players: [], code: '', status: 'connecting', qrEls: [] };
    var mk = LOCAL ? root.LSNet.LocalHost : root.LSNet.Host;
    function padUrl() { return root.ZTP_QR || (base() + 'pad.html?room=' + h.code + (LOCAL ? '&local=1' : '') + (o.padQuery || '')); }
    function paint() { h.qrEls.forEach(function (el) { if (h.status !== 'online') { el.innerHTML = '<div class="kq">connecting\u2026</div>'; return; } el.innerHTML = '<div class="kqr">' + qrSvg(padUrl()) + '</div><div class="kcode">' + h.code + '</div>'; }); if (o.onStatus) o.onStatus(h.status, h.code); }
    h.qr = function (el) { h.qrEls.push(el); paint(); };
    h.padUrl = padUrl;
    function byConn(c) { return h.players.filter(function (p) { return p.conn === c || p.fast === c; })[0]; }
    h.sendFast = function (p, m) { if (p && p.fast && p.fast.open && p.on) { try { p.fast.send(m); } catch (e) {} } else h.send(p, m); };   // latest-wins traffic (unordered channel when the pad opened one)
    h.allFast = function (m) { h.players.forEach(function (p) { h.sendFast(p, m); }); };
    h.send = function (p, m) { if (p && p.conn && p.on) try { p.conn.send(m); } catch (e) {} };
    h.all = function (m) { h.players.forEach(function (p) { h.send(p, m); }); };
    h.addLocal = function (name, recv) {   // a player on this very screen (phone-only play)
      var p = { id: 'me', name: name || 'You', seat: h.players.length, color: COLORS[h.players.length % 6], on: true, local: true, conn: { open: true, send: function (m) { recv && recv(m); } } };
      h.players.push(p); if (o.onJoin) o.onJoin(p); return p;
    };
    h.net = new mk({
      onStatus: function (s, code) { h.status = s; if (code) h.code = code; paint(); },
      onMessage: function (conn, d) {
        if (!d || d.t === 'ping') return;
        if (d.t === 'hi2') { var pf = h.players.filter(function (x) { return x.tok === d.tok; })[0]; if (pf) pf.fast = conn; return; }
        if (d.t === 'hi') {
          var p = h.players.filter(function (x) { return x.tok === d.tok; })[0];
          if (!p) {
            if (h.players.length >= (o.max || 4) || (o.canJoin && !o.canJoin())) { try { conn.send({ t: 'full' }); } catch (e) {} return; }
            p = { id: d.tok, tok: d.tok, seat: h.players.length, color: COLORS[h.players.length % 6] }; h.players.push(p);
          }
          p.conn = conn; p.on = true; p.name = (d.name || 'Player').slice(0, 12);
          h.send(p, { t: 'you', seat: p.seat, color: p.color, name: p.name });
          if (o.onJoin) o.onJoin(p); return;
        }
        var q = byConn(conn); if (q && o.onMsg) o.onMsg(q, d);
      },
      onClose: function (conn) { var p = byConn(conn); if (p && p.fast === conn && p.conn !== conn) { p.fast = null; return; } if (p) { p.on = false; if (o.onLeave) o.onLeave(p); } }
    });
    h.code = h.net.code;
    root.addEventListener('message', function (e) { var d = e.data; if (e.source !== root.parent || !d || d.ztp !== 'qr' || !d.url) return; root.ZTP_QR = d.url; paint(); try { root.parent.postMessage({ ztp: 'qrok' }, '*'); } catch (x) {} });
    return h;
  };
  Kit.pad = function (o) {
    var tok = Q.get('tok') || localStorage.getItem('ztp-mini-tok') || Math.random().toString(36).slice(2); if (!Q.get('tok')) localStorage.setItem('ztp-mini-tok', tok);
    var c = { room: (Q.get('room') || '').toUpperCase(), name: Q.get('name') || localStorage.getItem('ztp-mini-name') || '' };
    c.setName = function (n) { c.name = (n || '').slice(0, 12); localStorage.setItem('ztp-mini-name', c.name); if (c.cl) c.cl.send({ t: 'hi', tok: tok, name: c.name }); };
    c.send = function (m) { return c.cl ? c.cl.send(m) : false; };
    c.sendFast = function (m) { return c.cl ? (c.cl.sendFast ? c.cl.sendFast(m) : c.cl.send(m)) : false; };
    c.connect = function (room) {
      c.room = room.toUpperCase(); var mk = LOCAL ? root.LSNet.LocalClient : root.LSNet.Client;
      c.cl = new mk({ code: c.room, onOpen: function () { c.cl.send({ t: 'hi', tok: tok, name: c.name || 'Player' }); if (o.fast && c.cl.openFast) c.cl.openFast({ t: 'hi2', tok: tok }); }, onMessage: function (m) { if (o.onMsg) o.onMsg(m); }, onStatus: function (s, d) { if (o.onStatus) o.onStatus(s, d); } });
    };
    if (c.room) c.connect(c.room);
    return c;
  };
  // flick: tracks the last ~90 ms of a drag. cb({ dx, dy (px/s, up is negative), curve (sideways bend), x0, y0 })
  Kit.flick = function (el, cb, opts) {
    var pts = [], down = false;
    el.addEventListener('pointerdown', function (e) { down = true; pts = [[e.clientX, e.clientY, performance.now()]]; try { el.setPointerCapture(e.pointerId); } catch (x) {} if (opts && opts.onDown) opts.onDown(e); });
    el.addEventListener('pointermove', function (e) { if (!down) return; pts.push([e.clientX, e.clientY, performance.now()]); if (pts.length > 40) pts.shift(); if (opts && opts.onMove) opts.onMove(e); });
    function up(e) {
      if (!down) return; down = false; var now = performance.now(), rec = pts.filter(function (p) { return now - p[2] < 110; });
      if (rec.length < 2) rec = pts.slice(-3); if (rec.length < 2) return;
      var a = rec[0], b = rec[rec.length - 1], dt = Math.max(16, b[2] - a[2]) / 1000, mid = rec[(rec.length / 2) | 0];
      var curve = ((mid[0] - a[0]) - (b[0] - a[0]) / 2) / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
      cb({ dx: (b[0] - a[0]) / dt, dy: (b[1] - a[1]) / dt, curve: curve, len: (pts[0][1] - b[1]) / Math.max(1, el.clientHeight), x0: pts[0][0], y0: pts[0][1], w: el.clientWidth, h: el.clientHeight });
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  root.Kit = Kit;
})(window);
/* Kit.joinCard(title, c, extraHtml): name (+ room if missing) card for pads. Connects on JOIN. Returns the card element. */
(function (root) {
  root.Kit.joinCard = function (title, c, extra) {
    var d = document.createElement('div'); d.className = 'card'; d.id = 'kjoin';
    d.innerHTML = '<div><h1>' + title + '</h1>' + (c.room ? '' : '<input class="tx" id="kroom" maxlength="4" placeholder="Room code" autocapitalize="characters">') +
      '<input class="tx" id="kname" maxlength="12" placeholder="Your name" value="' + (c.name || '').replace(/"/g, '') + '"><button class="btn go" id="kgo" style="width:100%;margin-top:8px">JOIN</button>' + (extra || '') + '</div>';
    document.body.appendChild(d);
    d.querySelector('#kgo').onclick = function () {
      var r = c.room || (d.querySelector('#kroom').value || '').trim(); if (r.length !== 4) return;
      c.name = (d.querySelector('#kname').value || 'Player').trim(); localStorage.setItem('ztp-mini-name', c.name);
      d.remove(); if (c.cl) c.setName(c.name); else c.connect(r);
    };
    return d;
  };
})(window);
