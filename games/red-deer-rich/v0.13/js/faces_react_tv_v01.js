/* TV v0.7.8: bobbleheads and cartoon heads glance at each other.
   Look at whoever just got smacked, at the active runner or a big event, and lock eyes during trades. */
(function (w) {
  'use strict';
  var gaze = {}; /* pid -> { x, y, tx, ty, until, why, next } */

  function game() { return w.RDR && RDR.game; }
  function visOf(p) {
    var W = w.RDRWalkers;
    if (W && W.visOf && p) return W.visOf(p);
    return null;
  }
  function nowMs() { return performance.now(); }

  function aim(from, at) {
    if (!from || !at) return { x: 0, y: 0 };
    var dx = (at.x || 0) - (from.x || 0), dy = (at.y || 0) - (from.y || 0);
    var face = from.face || 1;
    var x = Math.max(-1, Math.min(1, (dx / 80) * face));
    var y = Math.max(-1, Math.min(1, dy / 90));
    return { x: x, y: y };
  }
  function setGaze(pid, why, atVis, ms) {
    var g = game(), p = g && g.byId(pid), v = visOf(p);
    if (!p || !v) return;
    var a = aim(v, atVis), rec = gaze[pid] || (gaze[pid] = { x: 0, y: 0, tx: 0, ty: 0, until: 0, why: '', next: 0 });
    rec.tx = a.x; rec.ty = a.y; rec.why = why; rec.until = nowMs() + (ms || 1400);
  }
  function lookAtPid(viewer, target, why, ms) {
    var t = visOf(target); if (!t) return;
    setGaze(viewer.id, why, t, ms);
  }

  function tick() {
    var g = game(); if (!g || !g.players) return;
    var tP = nowMs(), runner = null, ev = null;
    g.players.forEach(function (p) {
      var v = visOf(p);
      if (v && (v.walk || v.march)) runner = p;
    });
    if (!runner && g.cur && g.phase === 'play') runner = g.cur();
    var openTrade = (g.trades || []).filter(function (tr) { return tr.status === 'open'; })[0];
    g.players.forEach(function (p) {
      if (p.bankrupt) return;
      var rec = gaze[p.id] || (gaze[p.id] = { x: 0, y: 0, tx: 0, ty: 0, until: 0, why: '', next: tP + 400 });
      if (openTrade && (openTrade.a === p.id || openTrade.b === p.id)) {
        var other = g.byId(openTrade.a === p.id ? openTrade.b : openTrade.a);
        if (other) lookAtPid(p, other, 'trade', 400);
      } else if (tP < rec.until) {
        /* hold the event glance */
      } else if (runner && runner.id !== p.id) {
        lookAtPid(p, runner, 'runner', 500);
      } else if (tP > rec.next) {
        var r = Math.random();
        if (r < 0.3) { rec.tx = 0; rec.ty = 0; }
        else if (r < 0.55) { rec.tx = (Math.random() - 0.5) * 1.6; rec.ty = -1; }
        else { rec.tx = Math.random() < 0.5 ? -1 : 1; rec.ty = (Math.random() - 0.5) * 0.6; }
        rec.why = 'idle'; rec.next = tP + 900 + Math.random() * 3200;
      }
      rec.x += (rec.tx - rec.x) * 0.14;
      rec.y += (rec.ty - rec.y) * 0.14;
    });
  }

  function onEvent(type, d) {
    var g = game(); if (!g) return;
    var tP = nowMs();
    function everyoneAt(pid, why, ms) {
      var at = g.byId(pid); if (!at) return;
      g.players.forEach(function (p) { if (p.id !== pid && !p.bankrupt) lookAtPid(p, at, why, ms); });
    }
    if (type === 'smack' || type === 'bonk' || type === 'hit') everyoneAt(d && (d.to || d.pid || d.hit), 'smack', 1600);
    if (type === 'caught') everyoneAt(d && d.pid, 'caught', 1400);
    if (type === 'bankrupt') everyoneAt(d && d.pid, 'bust', 2000);
    if (type === 'jackpot' || type === 'auctionWon' || type === 'buy') everyoneAt(d && d.pid, type, 1400);
    if (type === 'card' || type === 'whiteout' || type === 'disaster') everyoneAt(d && d.pid, type, 1600);
    if (type === 'tradeOffer' && d) {
      var a = g.byId(d.from || d.a), b = g.byId(d.to || d.b);
      if (a && b) { lookAtPid(a, b, 'trade', 2400); lookAtPid(b, a, 'trade', 2400); }
    }
    void tP;
  }

  function hookGame() {
    var g = game();
    if (!g || g._facesReact078) return;
    g._facesReact078 = true;
    g.on(onEvent);
  }

  function hookPeople() {
    var PPL = w.RDRPeople; if (!PPL || PPL._facesReact078 || typeof PPL.draw !== 'function') return !!PPL;
    PPL._facesReact078 = true;
    var orig = PPL.draw;
    PPL.draw = function (c, x, y, h, look, o) {
      o = o || {};
      var pid = (o && o.selfiePid) != null ? o.selfiePid : PPL._curPid;
      if (pid == null && w.RDRWalkers && w.RDRWalkers._curPid != null) pid = w.RDRWalkers._curPid;
      var rec = pid != null ? gaze[pid] : null;
      if (rec && !o.look) o = Object.assign({}, o, { look: { x: rec.x, y: rec.y } });
      if (rec && o.selfie) o.selfie = Object.assign({}, o.selfie, { gx: rec.x, gy: rec.y });
      return orig.call(this, c, x, y, h, look, o);
    };
    return true;
  }

  /* Walkers set _curPid while drawing each runner if we wrap W.draw slightly. */
  function hookWalkers() {
    var W = w.RDRWalkers; if (!W || W._facesReact078 || typeof W.draw !== 'function') return !!W;
    W._facesReact078 = true;
    var orig = W.draw.bind(W);
    W.draw = function (rnd, nowWall) {
      var g = game(), PPL = w.RDRPeople;
      if (g && PPL && W.visOf) {
        /* tag current pid around each existing draw by wrapping once more? orig draws all.
           We set _curPid by wrapping vis walk: hook lookFor is clothing, not glance.
           Instead, temporarily wrap PPL.draw is already adding gaze via vis scan:
           we find which player is at this x,y. */
        var prev = PPL.draw;
        PPL.draw = function (c, x, y, h, look, o) {
          var hit = null, best = 1e9;
          g.players.forEach(function (p) {
            var v = W.visOf(p); if (!v || !v.shown) return;
            var d = Math.abs((v.x || 0) - x) + Math.abs((v.y || 0) - y);
            if (d < best) { best = d; hit = p; }
          });
          if (hit) PPL._curPid = hit.id;
          var r = prev.call(this, c, x, y, h, look, o);
          PPL._curPid = null;
          return r;
        };
        orig(rnd, nowWall);
        PPL.draw = prev;
        return;
      }
      orig(rnd, nowWall);
    };
    return true;
  }

  /* Smack hook: walkers emit bonk on vis; also listen if a global smack bus exists. */
  function hookSmack() {
    var S = w.RDRSmack; if (S && !S._facesReact078 && S.on) { S._facesReact078 = true; S.on(function (d) { onEvent('smack', d); }); }
  }

  function boot() { hookGame(); hookPeople(); hookWalkers(); hookSmack(); tick(); }
  boot();
  setInterval(boot, 500);
  (function loop() { tick(); requestAnimationFrame(loop); })();
  w.RDRFacesReact = { gaze: function () { return gaze; }, lookAtPid: lookAtPid, onEvent: onEvent };
})(window);
