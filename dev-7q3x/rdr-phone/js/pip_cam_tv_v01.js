/* TV v0.7.7: by default the board camera stays on the full board. A picture-in-picture bubble
   in the centre (inside the ring of spaces) shows a close follow of the moving runner, with a
   thin tapering line in their colour from the bubble to the runner. The bubble fades when
   movement ends. Setting: Picture-in-picture (default) / Zoom follow. Lobby zoom intro is unchanged. */
(function (w) {
  'use strict';
  var MODE_KEY = 'rdr077-camMode';
  var fade = 0, lastMove = 0, ui = null, hooked = false;

  function game() { return w.RDR && RDR.game; }
  function render() { return w.RDR && RDR.render; }

  function loadMode() {
    var g = game();
    if (g && g.rules && (g.rules.camMode === 'pip' || g.rules.camMode === 'zoom')) return g.rules.camMode;
    try { var s = localStorage.getItem(MODE_KEY); if (s === 'zoom' || s === 'pip') return s; } catch (e) {}
    return 'pip';
  }
  function setMode(m) {
    m = m === 'zoom' ? 'zoom' : 'pip';
    try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
    var g = game(); if (g && g.rules) g.rules.camMode = m;
    paintUi();
    return m;
  }
  function mode() { return loadMode(); }

  function moving(g, now) {
    if (!g || g.phase !== 'play' || !g.turn) return false;
    var t = g.turn;
    if (t.stage === 'moving' || t.stage === 'rolling') return true;
    if (w.RDRWalkers && t.pid != null) {
      var p = g.byId(t.pid), v = p && RDRWalkers.visOf(p);
      if (v && (v.walk || v.march || (v.lift && v.lift > 1))) return true;
    }
    return false;
  }
  function runnerPos(g, rnd) {
    var t = g && g.turn, p = t && g.byId(t.pid);
    if (!p) return null;
    if (w.RDRWalkers) {
      var v = RDRWalkers.visOf(p);
      if (v && v.shown) return { x: v.x, y: v.y - (v.lift || 0), p: p };
    }
    var tv = rnd.vis && rnd.vis[p.id];
    if (tv) return { x: tv.x, y: tv.y, p: p };
    return null;
  }

  function hookCam() {
    var rnd = render();
    if (!rnd || hooked || typeof rnd.camStep !== 'function') return !!rnd;
    hooked = true;
    var prev = rnd.camStep.bind(rnd);
    rnd.camStep = function (now, dt) {
      var m = mode();
      var cam = prev(now, dt);
      /* lobby zoom (waiting / leaving) is handled inside the previous wrapper when z is driven there.
         Once we're in play and PiP is on, pin the board to a full view. */
      var g = game();
      var lobbyZoom = w.RDRLobbyCam && typeof RDRLobbyCam.anyoneWaiting === 'function' && RDRLobbyCam.anyoneWaiting();
      /* leaving is closed over in lobby_cam; don't fight a still-zoomed lobby intro ease-out */
      var easingOut = !!(cam && cam.z > 1.08) && !moving(g, now || (typeof performance !== 'undefined' ? performance.now() : Date.now()));
      if (!lobbyZoom && !easingOut && g && g.phase === 'play' && m === 'pip') {
        var S0 = this.S, cx0 = this.bx + S0 / 2, cy0 = this.by + S0 / 2;
        var a = 1 - Math.exp(-(dt || 16) / 700);
        cam.z += (1 - cam.z) * a;
        if (Math.abs(cam.z - 1) < 0.004) cam.z = 1;
        cam.x += (cx0 - cam.x) * a;
        cam.y += (cy0 - cam.y) * a;
        var half = S0 / 2;
        cam.x = Math.max(this.bx + half, Math.min(this.bx + S0 - half, cam.x));
        cam.y = Math.max(this.by + half, Math.min(this.by + S0 - half, cam.y));
      }
      return cam;
    };
    return true;
  }

  function draw(rnd, now) {
    hookCam();
    var g = game(); if (!g || !rnd || g.phase !== 'play') { fade = Math.max(0, fade - 0.08); return; }
    if (mode() !== 'pip') { fade = 0; return; }
    var on = moving(g, now);
    if (on) { fade = Math.min(1, fade + 0.14); lastMove = now; }
    else if (now - lastMove > 280) fade = Math.max(0, fade - 0.06);
    if (fade <= 0.01) { fade = 0; return; }
    var rp = runnerPos(g, rnd); if (!rp) return;
    var c = rnd.ctx, S0 = rnd.S, cx = rnd.bx + S0 / 2, cy = rnd.by + S0 / 2;
    var R = Math.max(54, S0 * 0.155);
    var col = rp.p.color || '#ffd23f';
    var dpr = rnd.dpr || 1;
    /* tapering line from the bubble to the runner */
    var dx = rp.x - cx, dy = rp.y - cy, dist = Math.hypot(dx, dy) || 1;
    var ux = dx / dist, uy = dy / dist;
    var x0 = cx + ux * (R + 2), y0 = cy + uy * (R + 2);
    var x1 = rp.x - ux * 8, y1 = rp.y - uy * 8;
    var px = -uy, py = ux;
    c.save();
    c.globalAlpha = 0.85 * fade;
    c.beginPath();
    c.moveTo(x0 + px * 5, y0 + py * 5);
    c.lineTo(x0 - px * 5, y0 - py * 5);
    c.lineTo(x1 - px * 1.1, y1 - py * 1.1);
    c.lineTo(x1 + px * 1.1, y1 + py * 1.1);
    c.closePath();
    c.fillStyle = col;
    c.fill();
    c.restore();

    /* close-in follow: copy a window around the runner into the centre bubble */
    var srcR = Math.max(70, (rnd.w || 56) * 3.2);
    var sx = (rp.x - srcR) * dpr, sy = (rp.y - srcR) * dpr, sw = srcR * 2 * dpr;
    c.save();
    c.globalAlpha = fade;
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.closePath(); c.clip();
    try {
      c.drawImage(rnd.cv || c.canvas, sx, sy, sw, sw, cx - R, cy - R, R * 2, R * 2);
    } catch (e) {
      c.fillStyle = 'rgba(20,16,28,0.85)'; c.fill();
    }
    c.restore();
    /* ring */
    c.save();
    c.globalAlpha = fade;
    c.beginPath(); c.arc(cx, cy, R, 0, 7);
    c.strokeStyle = col; c.lineWidth = 4; c.stroke();
    c.beginPath(); c.arc(cx, cy, R + 3, 0, 7);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  }

  var lastPaint = '';
  function paintUi() {
    var m = mode();
    var g = game();
    var key = m + '|' + ((g && g.phase) || '');
    if (!ui) {
      ui = document.createElement('div');
      ui.id = 'camMode';
      document.body.appendChild(ui);
    }
    ui.style.display = (g && (g.phase === 'lobby' || g.phase === 'play')) ? 'flex' : 'none';
    if (key === lastPaint) return;
    lastPaint = key;
    ui.innerHTML = '<span>Camera</span>' +
      '<button type="button" data-m="pip"' + (m === 'pip' ? ' class="on"' : '') + '>Picture-in-picture</button>' +
      '<button type="button" data-m="zoom"' + (m === 'zoom' ? ' class="on"' : '') + '>Zoom follow</button>';
    ui.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { setMode(b.getAttribute('data-m')); };
    });
  }

  function boot() {
    var g = game();
    if (g && g.rules && !g.rules.camMode) g.rules.camMode = loadMode();
    hookCam();
    paintUi();
  }

  w.RDRPipCam = { boot: boot, draw: draw, hookCam: hookCam, mode: mode, setMode: setMode, paintUi: paintUi };
})(window);
