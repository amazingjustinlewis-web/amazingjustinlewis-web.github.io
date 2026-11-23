/* TV v0.7.6: when a turn passes, the current runner tosses the dice with its arm; they fly off and fade,
   fade into the next runner's hand, then that runner shakes and throws them onto the board where they land. */
(function (w) {
  'use strict';
  var st = { mode: 'idle', from: null, to: null, t0: 0, dice: null, forced: false };
  var TOSS = 700, FADE_IN = 450, HOLD = 280, SHAKE = 620;

  function game() { return w.RDR && RDR.game; }
  function W() { return w.RDRWalkers; }
  function vis(p) { return W() && p ? W().visOf(p) : null; }

  function handPos(p, rnd) {
    var v = vis(p); if (!v || !rnd) return { x: 0, y: 0, face: 1 };
    var h = (W() && W().heightOf(rnd)) || 56;
    var face = v.face || 1;
    return { x: v.x + face * h * 0.38, y: v.y - h * 0.62, face: face, vx: v.x, vy: v.y, h: h };
  }

  function beginToss(fromP, toP) {
    if (!fromP || !toP) return;
    st.mode = 'toss'; st.from = fromP.id; st.to = toP.id; st.t0 = performance.now(); st.dice = null;
    var v = vis(fromP); if (v) v.swing = { at: performance.now(), dur: 380 };
  }

  function beginCatch(toP, dice) {
    st.mode = 'in'; st.to = toP && toP.id; st.t0 = performance.now(); st.dice = dice || st.dice;
  }

  function beginShake(toP, dice) {
    st.mode = 'shake'; st.to = toP && toP.id; st.t0 = performance.now(); st.dice = dice || st.dice;
    var v = vis(toP); if (v) { v.phase = 0; v.swing = { at: performance.now(), dur: SHAKE }; }
  }

  function wrapRoll() {
    var rnd = w.RDR && RDR.render;
    if (!rnd || rnd._tv076Dice || typeof rnd.rollDice !== 'function') return !!rnd;
    rnd._tv076Dice = rnd.rollDice.bind(rnd);
    rnd.rollDice = function (d, pid, dur, f) {
      var g = game(), p = g && g.byId(pid);
      st.dice = d && d.slice ? d.slice() : d;
      st.to = pid;
      if (st.mode === 'idle' || st.mode === 'hold') {
        beginShake(p, st.dice);
        st.pending = { d: st.dice, pid: pid, dur: dur, f: f };
        return;
      }
      if (st.mode === 'shake' || st.mode === 'in' || st.mode === 'toss') {
        st.pending = { d: st.dice, pid: pid, dur: dur, f: f };
        return;
      }
      return rnd._tv076Dice(d, pid, dur, f);
    };
    return true;
  }

  function hookTurns() {
    var g = game();
    if (!g || g._tv076DiceHook) return !!g;
    g._tv076DiceHook = true;
    g.on(function (type, d) {
      if (type === 'turn') {
        var cur = g.byId(d.pid), prev = hookTurns._prev && g.byId(hookTurns._prev);
        if (prev && cur && prev.id !== cur.id) beginToss(prev, cur);
        else if (cur) beginCatch(cur, st.dice);
        hookTurns._prev = d.pid;
      }
      if (type === 'start') {
        hookTurns._prev = null;
        st.mode = 'idle'; st.pending = null;
      }
    });
    return true;
  }

  function update(now) {
    wrapRoll(); hookTurns();
    var g = game(), rnd = w.RDR && RDR.render;
    if (!g || !rnd) return;
    var t = now || performance.now();
    if (st.mode === 'toss') {
      if (t - st.t0 >= TOSS) {
        var nxt = g.byId(st.to);
        if (nxt) beginCatch(nxt, st.dice);
        else st.mode = 'idle';
      }
    } else if (st.mode === 'in') {
      if (t - st.t0 >= FADE_IN) { st.mode = 'hold'; st.t0 = t; }
    } else if (st.mode === 'hold') {
      if (st.pending && t - st.t0 >= HOLD) beginShake(g.byId(st.to), st.pending.d);
    } else if (st.mode === 'shake') {
      var v = vis(g.byId(st.to));
      if (v) v.phase = ((t - st.t0) / 140) % 1;
      if (t - st.t0 >= SHAKE) {
        var pend = st.pending;
        st.mode = 'idle'; st.pending = null;
        if (v) v.phase = -1;
        if (pend && rnd._tv076Dice) rnd._tv076Dice(pend.d, pend.pid, pend.dur, pend.f);
      }
    }
  }

  function drawDie(c, x, y, sz, rot, col, ink, val, a) {
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, a)); c.translate(x, y); c.rotate(rot || 0);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(3, sz * 0.4, sz * 0.5, sz * 0.16, 0, 0, 7); c.fill();
    var r = sz * 0.18;
    c.beginPath();
    if (c.roundRect) c.roundRect(-sz / 2, -sz / 2, sz, sz, r);
    else c.rect(-sz / 2, -sz / 2, sz, sz);
    c.fillStyle = col || '#fff'; c.fill(); c.lineWidth = Math.max(1.2, sz * 0.06); c.strokeStyle = '#fff'; c.stroke();
    c.fillStyle = ink || '#111';
    var q = sz * 0.26, pr = Math.max(1.2, sz * 0.085);
    var pips = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[val || 5];
    (pips || [[0, 0]]).forEach(function (pp) { c.beginPath(); c.arc(pp[0] * q, pp[1] * q, pr, 0, 7); c.fill(); });
    c.restore();
  }

  function draw(c, rnd, now) {
    update(now);
    if (st.mode === 'idle' || !rnd) return;
    var g = game(); if (!g) return;
    var fromP = g.byId(st.from), toP = g.byId(st.to);
    var a0 = handPos(fromP, rnd), a1 = handPos(toP, rnd);
    var sz = Math.max(11, (rnd.w || 24) * 0.42);
    var col = (toP || fromP || {}).color || '#fff';
    var ink = '#1a1408';
    try { if (toP && w.RDRGame) ink = (RDR_CONFIG.characters.filter(function (ch) { return ch.id === toP.charId; })[0] || {}).ink || ink; } catch (e) {}
    var t = (now - st.t0), x, y, a, rot;
    if (st.mode === 'toss') {
      var u = Math.min(1, t / TOSS), e = 1 - Math.pow(1 - u, 2);
      var lift = Math.sin(u * Math.PI) * (a0.h || 56) * 1.6;
      x = a0.x + (a0.x + a0.face * 80 - a0.x) * e;
      y = a0.y - lift - e * 20;
      a = 1 - u; rot = u * 6;
      drawDie(c, x - 10, y, sz, rot, (fromP || {}).color || col, ink, 5, a);
      drawDie(c, x + 10, y + 4, sz, -rot, (fromP || {}).color || col, ink, 3, a);
    } else if (st.mode === 'in' || st.mode === 'hold' || st.mode === 'shake') {
      var hp = a1;
      var wob = st.mode === 'shake' ? Math.sin(t / 40) * 5 : 0;
      a = st.mode === 'in' ? Math.min(1, t / FADE_IN) : 1;
      if (st.mode === 'shake' && t > SHAKE - 80) a = Math.max(0, 1 - (t - (SHAKE - 80)) / 80);
      rot = st.mode === 'shake' ? Math.sin(t / 35) * 0.5 : 0;
      drawDie(c, hp.x - 8 + wob, hp.y + wob * 0.3, sz, rot, col, ink, 4, a);
      drawDie(c, hp.x + 9 - wob * 0.4, hp.y + 3, sz, -rot, col, ink, 6, a);
    }
  }

  function test(fromId, toId) {
    var g = game(); if (!g) return false;
    var a = g.byId(fromId) || g.players[0], b = g.byId(toId) || g.players[1] || a;
    if (!a) return false;
    beginToss(a, b || a);
    st.dice = [5, 3];
    return true;
  }

  w.RDRDiceHandoff = { update: update, draw: draw, beginToss: beginToss, wrapRoll: wrapRoll, hookTurns: hookTurns, test: test, state: st };
})(window);
