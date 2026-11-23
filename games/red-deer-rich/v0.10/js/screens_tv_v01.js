/* TV v0.7.6: extra screens. A computer or TV that opens the game and enters the room code joins as a
   SCREEN (not a player), mirroring state over the existing viewer / room channel. Each screen can toggle
   "Same room as main TV" vs "Different place". Different-place shows the full main view; same-room
   screens take complementary cinematic cameras. The host lobby lists connected screens. */
(function (w) {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var isFollower = Q.has('screen') || (Q.has('viewer') && Q.get('screen') !== '0');
  /* ?viewer=CODE is the existing mirror hook; ?screen=CODE (or &screen=1 with viewer) marks a TV screen. */
  var wantCode = (Q.get('screen') || Q.get('viewer') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (Q.has('viewer') && !Q.has('screen')) isFollower = true; /* plain viewer treated as a screen in v076 */
  var sid = (function () {
    try {
      var k = 'rdr076-screen-sid', s = sessionStorage.getItem(k);
      if (!s) { s = 'S' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem(k, s); }
      return s;
    } catch (e) { return 'S' + Math.random().toString(36).slice(2, 10); }
  })();
  function loadMode() {
    try { return localStorage.getItem('rdr076-screen-mode') === 'away' ? 'away' : 'same'; } catch (e) { return 'same'; }
  }
  function saveMode(m) { try { localStorage.setItem('rdr076-screen-mode', m); } catch (e) {} }

  var mode = isFollower ? loadMode() : 'same';
  var myN = 0; /* 0 = unassigned / this tab is the host (Screen 1) */
  var screens = {}; /* sid -> { n, mode, name, conn, at } */
  var nextN = 2;
  var listEl, badgeEl, joinEl;
  var camHooked = false, layoutHooked = false, clientHooked = false;

  function game() { return w.RDR && RDR.game; }
  function render() { return w.RDR && RDR.render; }
  function vcl() { return w.RDR && RDR.viewerClient; }
  function isHost() { return !isFollower && !!(w.RDR && RDR.net && RDR.net()); }

  function roleOf(n) {
    /* Screen 1 is the main TV (full view). 2 follows the mover, 3 orbits / highlights, then they cycle. */
    if (n <= 1) return 'main';
    var k = (n - 2) % 3;
    return k === 0 ? 'follow' : k === 1 ? 'orbit' : 'highlight';
  }
  function roleLabel(n, m) {
    if (m === 'away') return 'Different place · full view';
    var r = roleOf(n);
    return r === 'follow' ? 'Same room · close-up on the mover'
      : r === 'orbit' ? 'Same room · slow orbit'
      : r === 'highlight' ? 'Same room · highlight cam'
      : 'Main TV';
  }

  /* ---------- host: track extra screens, assign numbers, list in the lobby ---------- */
  function assignN() {
    var used = {};
    Object.keys(screens).forEach(function (k) { used[screens[k].n] = 1; });
    var n = 2; while (used[n]) n++;
    return n;
  }

  function onMessage(conn, m) {
    if (!m) return false;
    if (m.t === 'hello' && (m.screen || m.role === 'screen')) {
      remember(conn, m);
      /* fall through so the host still treats them as a viewer and pushes state */
      if (m.role === 'screen') m.role = 'viewer';
      return false;
    }
    if (m.t === 'screenHello' || m.t === 'screenMode') {
      remember(conn, m);
      return true;
    }
    return false;
  }

  function remember(conn, m) {
    var id = m.sid || (conn && (conn.connectionId || conn.peer)) || ('anon' + Math.random().toString(36).slice(2, 6));
    var rec = screens[id];
    if (!rec) rec = screens[id] = { sid: id, n: assignN(), mode: 'same', name: 'Screen', conn: conn, at: Date.now() };
    rec.conn = conn || rec.conn;
    rec.at = Date.now();
    if (m.mode === 'away' || m.mode === 'same') rec.mode = m.mode;
    if (m.name) rec.name = String(m.name).slice(0, 24);
    paintHostList();
    sendAssign(rec);
  }

  function sendAssign(rec) {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !rec.conn || typeof net.send !== 'function') return;
    net.send(rec.conn, { t: 'screenYou', n: rec.n, mode: rec.mode, role: roleOf(rec.n), label: roleLabel(rec.n, rec.mode) });
  }

  function dropClosed() {
    Object.keys(screens).forEach(function (k) {
      var c = screens[k].conn;
      if (c && c.open === false) delete screens[k];
    });
  }

  function listSnapshot() {
    dropClosed();
    var rows = [{ n: 1, name: 'Main TV', mode: 'same', role: 'main' }];
    Object.keys(screens).forEach(function (k) { rows.push(screens[k]); });
    rows.sort(function (a, b) { return a.n - b.n; });
    return rows;
  }

  function paintHostList() {
    if (isFollower) return;
    var lobby = document.getElementById('lobby');
    if (!lobby) return;
    if (!listEl) {
      listEl = document.createElement('div');
      listEl.id = 'screenList';
      var box = lobby.querySelector('.join-box') || lobby.querySelector('.lobby-left') || lobby;
      box.parentNode ? box.parentNode.insertBefore(listEl, box.nextSibling) : lobby.appendChild(listEl);
    }
    var rows = listSnapshot();
    var extra = rows.length - 1;
    listEl.innerHTML = '<div class="sl-title">Screens' + (extra ? ' · ' + (extra + 1) + ' connected' : '') + '</div>' +
      rows.map(function (s) {
        var name = s.n === 1 ? '' : escapeH(s.name || '');
        return '<div class="sl-row"><b>Screen ' + s.n + '</b> ' + (name ? '<span>' + name + '</span> ' : '') + '<em>' + escapeH(roleLabel(s.n, s.mode)) + '</em></div>';
      }).join('') +
      (extra ? '' : '<div class="sl-hint">Open this game on another computer or TV and enter this room code to add a screen.</div>');
  }

  function escapeH(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  }

  /* ---------- host lobby: “join as a screen” field (for a new TV that opened its own lobby) ---------- */
  function mountJoinField() {
    if (isFollower) return;
    var lobby = document.getElementById('lobby');
    if (!lobby || joinEl) return;
    joinEl = document.createElement('form');
    joinEl.id = 'screenJoin';
    joinEl.innerHTML = '<label for="screenCode">Already a game going? Join as an extra <b>screen</b> (not a player)</label>' +
      '<div class="sj-row"><input id="screenCode" name="code" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ROOM" aria-label="Room code">' +
      '<button type="submit">Join as screen</button></div>';
    var box = lobby.querySelector('.join-box') || lobby.querySelector('.lobby-left') || lobby;
    if (box.parentNode) box.parentNode.insertBefore(joinEl, box.nextSibling);
    else lobby.appendChild(joinEl);
    joinEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = (document.getElementById('screenCode').value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (code.length < 3) return;
      var u = new URL(location.href);
      u.searchParams.delete('room');
      u.searchParams.delete('test');
      u.searchParams.delete('autostart');
      u.searchParams.set('viewer', code);
      u.searchParams.set('screen', '1');
      location.href = u.toString();
    });
  }

  /* ---------- follower: full TV chrome (viewer mode is otherwise a phone-sized board) ---------- */
  function hookLayout() {
    var rnd = render();
    if (!isFollower || !rnd || layoutHooked) return !!rnd;
    layoutHooked = true;
    document.documentElement.classList.remove('ph', 'vw');
    document.documentElement.classList.add('rdr-screen');
    rnd.phoneCam = false;
    var orig = rnd.layout.bind(rnd);
    rnd.layout = function (W, H, box, dpr) {
      W = W || window.innerWidth; H = H || window.innerHeight;
      var top = H * 0.064, side = W * 0.24, pad = H * 0.015;
      var size = Math.floor(Math.min(H - top - pad * 2, W - side - pad * 2));
      box = { x: Math.floor((W - side - size) / 2), y: Math.floor(top + pad + (H - top - pad * 2 - size) / 2), size: size };
      var st = document.documentElement.style;
      st.setProperty('--bx', box.x + 'px'); st.setProperty('--by', box.y + 'px'); st.setProperty('--bs', box.size + 'px');
      return orig(W, H, box, dpr == null || dpr > 2 ? 1.5 : dpr);
    };
    try { rnd.layout(window.innerWidth, window.innerHeight, null, 1.5); } catch (e) {}
    return true;
  }

  function hookClient() {
    var cl = vcl();
    if (!isFollower || !cl || clientHooked) return !!cl;
    clientHooked = true;
    var os = cl.send.bind(cl);
    cl.send = function (d) {
      if (d && d.t === 'hello' && (d.role === 'viewer' || d.role === 'screen')) {
        d.role = 'viewer'; d.screen = true; d.sid = sid; d.mode = mode; d.name = 'Screen';
      }
      return os(d);
    };
    var om = cl.o && cl.o.onMessage;
    if (cl.o) {
      cl.o.onMessage = function (m) {
        if (m && m.t === 'screenYou') applyAssign(m);
        if (typeof om === 'function') om.apply(this, arguments);
        afterView(m);
      };
    }
    announce();
    return true;
  }

  var announced = '';
  function announce(force) {
    var cl = vcl();
    if (!cl || cl.status !== 'online') return;
    var key = sid + ':' + mode;
    if (!force && announced === key) return;
    cl.send({ t: 'screenHello', sid: sid, mode: mode, name: 'Screen' });
    announced = key;
  }

  function applyAssign(m) {
    if (m.n) myN = m.n;
    paintBadge();
  }

  function showChrome() {
    /* follower is not the host lobby: drop lobby-hide so the score sidebar and top bar stay in the full main view */
    document.body.classList.remove('tv075-lobby', 'tv076-lobby');
    var side = document.getElementById('side'); if (side) side.hidden = false;
    var top = document.getElementById('top'); if (top) top.hidden = false;
    var lobby = document.getElementById('lobby'); if (lobby) lobby.hidden = true;
  }

  function afterView(m) {
    if (!m || m.t !== 'view') return;
    showChrome();
    hookLayout();
  }

  /* ---------- badge + mode toggle ---------- */
  function paintBadge() {
    if (!isFollower) return;
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'screenBadge';
      document.body.appendChild(badgeEl);
    }
    var n = myN || 2;
    var title = 'Screen ' + n;
    badgeEl.innerHTML = '<div class="sb-n">' + title + '</div>' +
      '<div class="sb-role">' + escapeH(roleLabel(n, mode)) + '</div>' +
      '<div class="sb-tog">' +
      '<button type="button" data-m="same"' + (mode === 'same' ? ' class="on"' : '') + '>Same room as main TV</button>' +
      '<button type="button" data-m="away"' + (mode === 'away' ? ' class="on"' : '') + '>Different place</button>' +
      '</div>';
    badgeEl.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-m') === 'away' ? 'away' : 'same';
        saveMode(mode);
        announce(true);
        paintBadge();
      });
    });
  }

  /* ---------- cinematic cameras for same-room screens ---------- */
  function posOf(g, rnd, pid) {
    if (w.RDRWalkers) {
      var p = g.byId && g.byId(pid);
      if (p) { var v = RDRWalkers.visOf(p); if (v && v.shown) return { x: v.x, y: v.y - (v.lift || 0) }; }
    }
    var tv = rnd.vis && rnd.vis[pid];
    if (tv) return { x: tv.x, y: tv.y };
    return null;
  }
  function tilePos(rnd, i) {
    if (!rnd || typeof rnd.rect !== 'function') return null;
    var rc = rnd.rect(i);
    return { x: rnd.bx + rc.x + rc.w / 2, y: rnd.by + rc.y + rc.h / 2 };
  }
  function easeCam(rnd, now, dt, wantZ, fx, fy, tau) {
    var cam = rnd.cam, S0 = rnd.S, cx0 = rnd.bx + S0 / 2, cy0 = rnd.by + S0 / 2;
    if (!cam.init) { cam.x = cx0; cam.y = cy0; cam.z = 1; cam.init = true; }
    var a = 1 - Math.exp(-(dt || 16) / (tau || 700));
    cam.z += (wantZ - cam.z) * a;
    if (Math.abs(cam.z - wantZ) < 0.002) cam.z = wantZ;
    var zk = Math.max(0, Math.min(1, (cam.z - 1) / Math.max(0.001, wantZ - 1)));
    var tx = cx0 + (fx - cx0) * zk, ty = cy0 + (fy - cy0) * zk;
    cam.x += (tx - cam.x) * a; cam.y += (ty - cam.y) * a;
    var half = S0 / (2 * Math.max(1.001, cam.z));
    cam.x = Math.max(rnd.bx + half, Math.min(rnd.bx + S0 - half, cam.x));
    cam.y = Math.max(rnd.by + half, Math.min(rnd.by + S0 - half, cam.y));
    return cam;
  }
  function cinematic(rnd, now, dt) {
    var g = game(); if (!g) return rnd.cam;
    var S0 = rnd.S, cx0 = rnd.bx + S0 / 2, cy0 = rnd.by + S0 / 2;
    if (mode === 'away' || g.phase !== 'play') return easeCam(rnd, now, dt, 1, cx0, cy0, 900);
    var role = roleOf(myN || 2);
    var t = g.turn, pid = t && t.pid;
    if (role === 'follow') {
      var p = posOf(g, rnd, pid);
      if (p) return easeCam(rnd, now, dt, 2.15, p.x, p.y, 480);
      return easeCam(rnd, now, dt, 1.4, cx0, cy0, 700);
    }
    if (role === 'orbit') {
      var ang = now / 14000 * Math.PI * 2;
      var rad = S0 * 0.18;
      return easeCam(rnd, now, dt, 1.42, cx0 + Math.cos(ang) * rad, cy0 + Math.sin(ang) * rad, 900);
    }
    /* highlight: the tile in play (buy / pay-up / auction / landing), else a slow drift to the mover */
    var sp = t && (t.buy != null ? t.buy : (t.payup && t.payup.sp) || (t.auction && t.auction.sp) || (t.sp != null ? t.sp : null));
    if (sp == null && t && g.byId) { var cur = g.byId(t.pid); if (cur) sp = cur.pos; }
    var tp = sp != null ? tilePos(rnd, sp) : posOf(g, rnd, pid);
    if (tp) return easeCam(rnd, now, dt, 1.85, tp.x, tp.y, 700);
    return easeCam(rnd, now, dt, 1.25, cx0, cy0, 800);
  }

  function hookCam() {
    var rnd = render();
    if (!isFollower || !rnd || camHooked || typeof rnd.camStep !== 'function') return !!rnd;
    camHooked = true;
    var prev = rnd.camStep.bind(rnd);
    rnd.camStep = function (now, dt) {
      if (isFollower) return cinematic(this, now, dt);
      return prev(now, dt);
    };
    return true;
  }

  function boot() {
    mountJoinField();
    if (isHost()) paintHostList();
    if (isFollower) {
      hookLayout();
      hookClient();
      hookCam();
      showChrome();
      paintBadge();
    }
  }

  function tick() {
    if (isHost()) { dropClosed(); paintHostList(); }
    if (isFollower) { hookLayout(); hookClient(); hookCam(); showChrome(); announce(); }
  }

  w.RDRScreens = {
    boot: boot, tick: tick, onMessage: onMessage,
    isFollower: function () { return isFollower; },
    mode: function () { return mode; },
    n: function () { return myN; },
    list: listSnapshot,
    roleOf: roleOf
  };
})(window);
