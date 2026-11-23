/* TV v0.7.5: lobby shows a static board with a soft setup overlay; runners materialize on GO with golden-spiral particles. */
(function (w) {
  'use strict';
  var fx = []; /* { pid, kind: 'in'|'out', t0, dur, style, x, y, parts: [] } */
  var lastChar = {}; /* pid -> charId */
  var MAX_PARTS = 200;
  var PHI = (1 + Math.sqrt(5)) / 2;
  var GOLDEN_ANGLE = Math.PI * 2 / (PHI * PHI);

  function game() { return w.RDR && RDR.game; }
  function render() { return w.RDR && RDR.render; }
  function W() { return w.RDRWalkers; }

  function lerpHex(a, b, t) {
    function n(h) { h = String(h||'#888').replace('#',''); if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return parseInt(h,16)||0; }
    var A = n(a), B = n(b);
    var r = Math.round(((A>>16)&255)*(1-t)+((B>>16)&255)*t);
    var g = Math.round(((A>>8)&255)*(1-t)+((B>>8)&255)*t);
    var bl = Math.round((A&255)*(1-t)+(B&255)*t);
    return '#' + ((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
  }
  function styleFor(p) {
    var st = (w.RDRCharStats && RDRCharStats.statsOf(p.charId)) || { cash: 5, tough: 5, buy: 5, reach: 5 };
    var cash = st.cash, tough = st.tough, buy = st.buy, reach = st.reach;
    var base = {
      color: p.color || '#ffe7a0',
      gold: lerpHex('#ffe7a0', '#7ad0ff', Math.max(0, Math.min(1, (5 - cash) / 5))),
      n: Math.max(16, Math.min(48, Math.round(28 + (buy - 5) * 6))),
      speed: 0.7 + (buy - 5) * 0.12,
      tight: 0.10 + (reach - 5) * 0.03 + (tough - 5) * 0.015,
      size: 1.5 + (tough - 5) * 0.25,
      sparkle: Math.max(0.05, 0.22 + (cash - 5) * 0.15),
      shape: buy >= 7 ? 'diamond' : (tough >= 7 ? 'square' : (cash >= 6 ? 'star' : 'dot')),
      spin: 0.8 + (reach - 5) * 0.15
    };
    if (typeof w.RDRParticleStyleFor === 'function') {
      try { var extra = w.RDRParticleStyleFor(p, base); if (extra) return extra; } catch (e) {}
    }
    return base;
  }
  function spawnParts(style, inward) {
    var n = style.n, parts = [];
    for (var i = 0; i < n; i++) {
      var ang = i * GOLDEN_ANGLE, r0 = inward ? (18 + i * 0.9) : 2;
      parts.push({
        ang: ang, r: r0, r0: r0, r1: inward ? 0 : (22 + i * 0.85),
        spin: style.spin * (i % 2 ? 1 : -1),
        size: style.size * (0.7 + (i % 5) * 0.12),
        spark: Math.random() < style.sparkle,
        phase: Math.random()
      });
    }
    return parts;
  }
  function totalParts() {
    var n = 0; for (var i = 0; i < fx.length; i++) n += (fx[i].parts || []).length; return n;
  }
  function materialize(p, atGo) {
    if (!p || !W()) return;
    var rnd = render(), g = game();
    var sp = atGo || g && g.phase === 'lobby' ? 0 : (p.pos || 0);
    var s = W().slotAt(p, sp, rnd);
    var v = W().visOf(p);
    v.x = s.x; v.y = s.y; v.shown = true; v.scale = 0; v.walk = null; v.march = null;
    /* cap particles */
    while (totalParts() > MAX_PARTS - 40 && fx.length) fx.shift();
    var st = styleFor(p);
    fx.push({ pid: p.id, kind: 'in', t0: performance.now(), dur: 1600 / Math.max(0.6, st.speed), style: st, x: s.x, y: s.y, parts: spawnParts(st, true) });
    lastChar[p.id] = p.charId;
  }
  function dissolve(p, thenIn) {
    if (!p || !W()) return;
    var v = W().visOf(p), rnd = render();
    var s = { x: v.x || 0, y: v.y || 0 };
    var st = styleFor(p);
    fx.push({ pid: p.id, kind: 'out', t0: performance.now(), dur: 700 / Math.max(0.6, st.speed), style: st, x: s.x, y: s.y, parts: spawnParts(st, false), thenIn: thenIn });
  }
  function onChar(p) {
    if (!p) return;
    var prev = lastChar[p.id];
    if (prev && prev !== p.charId && W() && W().visOf(p).shown) dissolve(p, true);
    else materialize(p, true);
  }
  function tick(now) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i], u = (now - f.t0) / f.dur;
      var v = W() && game() && game().byId(f.pid) ? W().visOf(game().byId(f.pid)) : null;
      if (f.kind === 'in') {
        if (u < 0.85) { if (v) v.scale = 0; }
        else {
          var pop = Math.min(1, (u - 0.85) / 0.15);
          var over = pop < 1 ? (pop < 0.6 ? pop / 0.6 * 1.12 : 1.12 - (pop - 0.6) / 0.4 * 0.12) : 1;
          if (v) { v.scale = over; v.shown = true; }
        }
        if (u >= 1) { if (v) v.scale = 1; fx.splice(i, 1); }
      } else {
        if (v) v.scale = Math.max(0, 1 - u);
        if (u >= 1) {
          var again = f.thenIn, pid = f.pid;
          fx.splice(i, 1);
          if (again && game()) {
            var p = game().byId(pid);
            if (p) materialize(p, true);
          } else if (v) { v.shown = false; v.scale = 0; }
        }
      }
    }
  }
  function drawShape(c, shape, x, y, r, col, spark) {
    c.fillStyle = col;
    c.beginPath();
    if (shape === 'square') { c.fillRect(x - r, y - r, r * 2, r * 2); }
    else if (shape === 'diamond') { c.moveTo(x, y - r * 1.3); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.3); c.lineTo(x - r, y); c.closePath(); c.fill(); }
    else if (shape === 'star') {
      for (var k = 0; k < 5; k++) {
        var a = -Math.PI / 2 + k * Math.PI * 2 / 5, b = a + Math.PI / 5;
        if (k === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        c.lineTo(x + Math.cos(b) * r * 0.45, y + Math.sin(b) * r * 0.45);
      }
      c.closePath(); c.fill();
    } else { c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    if (spark) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath(); c.arc(x + r * 0.3, y - r * 0.3, Math.max(0.6, r * 0.25), 0, 7); c.fill();
    }
  }
  function draw(c, rnd, now) {
    tick(now);
    for (var i = 0; i < fx.length; i++) {
      var f = fx[i], u = Math.max(0, Math.min(1, (now - f.t0) / f.dur)), st = f.style;
      var fade = f.kind === 'in' ? (u < 0.18 ? u / 0.18 : (u > 0.88 ? 1 - (u - 0.88) / 0.12 : 1)) : (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      fade = Math.max(0, Math.min(1, fade));
      /* black-hole point near the end of inbound / start of outbound */
      var hole = f.kind === 'in' ? (u > 0.7 ? Math.min(1, (u - 0.7) / 0.18) : 0) : Math.max(0, 1 - u * 1.4);
      if (hole > 0.05) {
        c.save(); c.globalAlpha = 0.85 * hole;
        c.fillStyle = '#000'; c.beginPath(); c.arc(f.x, f.y - 6, 3.5 * hole, 0, 7); c.fill();
        c.restore();
      }
      for (var j = 0; j < f.parts.length; j++) {
        var p = f.parts[j];
        var tt = Math.max(0, Math.min(1, u * st.speed));
        var ease = tt < 0.5 ? 2 * tt * tt : 1 - Math.pow(-2 * tt + 2, 2) / 2;
        var r = f.kind === 'in' ? p.r0 * (1 - ease) : p.r0 + (p.r1 - p.r0) * ease;
        /* golden spiral tightening */
        var ang = p.ang + tt * p.spin * 4 + r * st.tight * 0.15;
        var x = f.x + Math.cos(ang) * r * 1.15;
        var y = f.y - 8 + Math.sin(ang) * r * 0.72;
        c.save(); c.globalAlpha = fade * (p.spark ? 1 : 0.85);
        drawShape(c, st.shape, x, y, p.size * (p.spark ? 1.15 : 1), (j % 3 === 0) ? st.gold : st.color, p.spark);
        c.restore();
      }
    }
  }

  function applyLobbyCss() {
    var lobby = document.getElementById('lobby');
    if (lobby) lobby.classList.add('tv075-overlay');
    document.body.classList.add('tv075-lobby');
  }
  function wrapStart() {
    if (!w.RDR || RDR._tv075StartWrap || typeof RDR.startGame !== 'function') return;
    RDR._tv075StartWrap = true;
    var orig = RDR.startGame;
    RDR.startGame = function () {
      var lobby = document.getElementById('lobby');
      if (lobby && !lobby.hidden) {
        lobby.classList.add('tv075-leaving');
        setTimeout(function () {
          try { orig(); } catch (e) { if (w.console) console.error(e); }
          lobby.classList.remove('tv075-leaving');
          document.body.classList.remove('tv075-lobby');
        }, 700);
        return;
      }
      document.body.classList.remove('tv075-lobby');
      return orig();
    };
    if (typeof RDR.toLobby === 'function' && !RDR._tv075ToLobby) {
      RDR._tv075ToLobby = true;
      var tl = RDR.toLobby;
      RDR.toLobby = function () {
        var r = tl.apply(this, arguments);
        applyLobbyCss();
        return r;
      };
    }
  }
  function watchPicks() {
    var g = game(); if (!g) return;
    g.players.forEach(function (p) {
      if (p.charId && lastChar[p.id] !== p.charId) onChar(p);
    });
    /* drop leftover vis for players who left */
    if (W()) {
      Object.keys(W().vis).forEach(function (id) {
        if (!g.byId(+id) && !g.byId(id)) {
          var v = W().vis[id]; if (v) v.shown = false;
          delete lastChar[id];
        }
      });
    }
  }
  var pickTimer = 0;
  function startWatch() {
    if (pickTimer) return;
    pickTimer = setInterval(watchPicks, 200);
  }

  w.RDRLobbyFX = {
    materialize: materialize, dissolve: dissolve, onChar: onChar, draw: draw,
    applyLobbyCss: applyLobbyCss, wrapStart: wrapStart, startWatch: startWatch, styleFor: styleFor, fx: fx
  };
})(window);
