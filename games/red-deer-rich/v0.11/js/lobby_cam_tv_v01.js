/* TV v0.7.6: once anyone is waiting, zoom the static board in close to START with a feathered circular vignette.
   Players still materialize / dissolve via RDRLobbyFX. When the game starts, zoom out to the whole board. */
(function (w) {
  'use strict';
  var ZOOM = 2.35, TAU = 900, OUT_TAU = 1200;
  var on = false, leaving = false, leaveAt = 0, hooked = false, watching = 0;

  function game() { return w.RDR && RDR.game; }
  function render() { return w.RDR && RDR.render; }

  function startSpot(rnd) {
    if (w.RDRWalkers && rnd) {
      try {
        var s = RDRWalkers.slotAt({ id: -1, pos: 0, snow: false, bankrupt: false }, 0, rnd);
        if (s && isFinite(s.x) && isFinite(s.y)) return s;
      } catch (e) {}
    }
    if (rnd && typeof rnd.rect === 'function') {
      var r = rnd.rect(0);
      if (r) return { x: rnd.bx + r.x + r.w / 2, y: rnd.by + r.y + r.h * 0.7 };
    }
    if (!rnd) return { x: 0, y: 0 };
    return { x: rnd.bx + rnd.S * 0.88, y: rnd.by + rnd.S * 0.88 };
  }

  function anyoneWaiting() {
    var g = game();
    if (!g || g.phase === 'play' || g.phase === 'over') return false;
    var lobby = document.getElementById('lobby');
    if (lobby && lobby.hidden) return false;
    return !!(g.players && g.players.length);
  }

  function easeCam(rnd, now, dt, wantZ, fx, fy, tau) {
    var cam = rnd.cam, S0 = rnd.S, cx0 = rnd.bx + S0 / 2, cy0 = rnd.by + S0 / 2;
    if (!cam.init) { cam.x = cx0; cam.y = cy0; cam.z = 1; cam.init = true; }
    var a = 1 - Math.exp(-(dt || 16) / tau);
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

  function wrapCam() {
    var rnd = render();
    if (!rnd || rnd._tv076Cam) return !!rnd;
    if (typeof rnd.camStep !== 'function') return false;
    rnd._tv076Cam = rnd.camStep.bind(rnd);
    rnd.camStep = function (now, dt) {
      if (leaving) {
        var t = (now - leaveAt) / OUT_TAU;
        var spot = startSpot(this);
        var z = ZOOM + (1 - ZOOM) * Math.max(0, Math.min(1, t));
        var cam = easeCam(this, now, dt, z, spot.x, spot.y, 220);
        if (t >= 1) leaving = false;
        return cam;
      }
      if (anyoneWaiting()) {
        on = true;
        var s = startSpot(this);
        return easeCam(this, now, dt, ZOOM, s.x, s.y, TAU);
      }
      on = false;
      return rnd._tv076Cam(now, dt);
    };
    return true;
  }

  function drawVignette(c, rnd) {
    if (!anyoneWaiting() && !leaving) return;
    var s = startSpot(rnd), cam = rnd.cam || { z: 1, x: rnd.bx + rnd.S / 2, y: rnd.by + rnd.S / 2 };
    var cx, cy, z = cam.z || 1;
    if (z > 1.002) {
      cx = rnd.bx + rnd.S / 2 + (s.x - cam.x) * z;
      cy = rnd.by + rnd.S / 2 + (s.y - cam.y) * z;
    } else { cx = s.x; cy = s.y; }
    var r0 = rnd.S * (0.18 + 0.04 * Math.min(1, Math.max(0, z - 1)));
    var r1 = rnd.S * 0.72;
    c.save();
    var g = c.createRadialGradient(cx, cy, r0, cx, cy, r1);
    g.addColorStop(0, 'rgba(8,6,14,0)');
    g.addColorStop(0.55, 'rgba(8,6,14,0.18)');
    g.addColorStop(0.82, 'rgba(8,6,14,0.62)');
    g.addColorStop(1, 'rgba(8,6,14,0.88)');
    c.fillStyle = g;
    c.fillRect(rnd.bx, rnd.by, rnd.S, rnd.S);
    c.restore();
  }

  function wrapStart() {
    if (!w.RDR || RDR._tv076CamStart || typeof RDR.startGame !== 'function') return;
    RDR._tv076CamStart = true;
    var orig = RDR.startGame;
    RDR.startGame = function () {
      leaving = true; leaveAt = performance.now(); on = false;
      document.body.classList.remove('tv076-lobby');
      return orig.apply(this, arguments);
    };
    if (typeof RDR.toLobby === 'function' && !RDR._tv076ToLobbyCam) {
      RDR._tv076ToLobbyCam = true;
      var tl = RDR.toLobby;
      RDR.toLobby = function () {
        var r = tl.apply(this, arguments);
        leaving = false;
        document.body.classList.add('tv076-lobby');
        var lobby = document.getElementById('lobby');
        if (lobby) lobby.classList.add('tv076-overlay');
        return r;
      };
    }
  }

  function watchLeaves() {
    var g = game(); if (!g || !w.RDRLobbyFX) return;
    var known = watchLeaves._ids || {};
    var now = {};
    g.players.forEach(function (p) { now[p.id] = 1; });
    Object.keys(known).forEach(function (id) {
      if (!now[id]) {
        var p = { id: +id, charId: known[id].charId, color: known[id].color, pos: 0 };
        try { RDRLobbyFX.dissolve(p, false); } catch (e) {}
      }
    });
    g.players.forEach(function (p) { known[p.id] = { charId: p.charId, color: p.color }; });
    watchLeaves._ids = known;
  }

  function boot() {
    wrapCam();
    wrapStart();
    var lobby = document.getElementById('lobby');
    if (lobby) lobby.classList.add('tv076-overlay');
    document.body.classList.add('tv076-lobby');
    if (!watching) watching = setInterval(function () { wrapCam(); wrapStart(); watchLeaves(); }, 300);
  }

  w.RDRLobbyCam = { boot: boot, wrapCam: wrapCam, drawVignette: drawVignette, startSpot: startSpot, anyoneWaiting: anyoneWaiting };
})(window);
