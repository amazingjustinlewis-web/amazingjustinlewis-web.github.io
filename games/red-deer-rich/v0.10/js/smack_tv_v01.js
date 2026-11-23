/* TV v0.7.5: smack timing (normal window + PERFECT sweet spot), cues to phones, wobble, combo, AI rates, buzz. */
(function (w) {
  'use strict';
  var SMACK_PRE = 450, SMACK_POST = 350, SWEET = 60;
  var PERFECT_HITS = [{ t: 0, big: 1 }, { t: 300 }, { t: 355 }, { t: 410 }, { t: 465 }, { t: 520 }, { t: 700, big: 2 }];
  var VIB_VICTIM = [600, 70, 300, 60, 180, 50, 110, 40, 60];
  var VIB_VICTIM_P = [380, 120, 45, 25, 45, 25, 45, 25, 45, 25, 45, 130, 1000, 80, 400, 60, 200, 50, 100];
  var VIB_SMACKER_P = [30, 270, 12, 43, 12, 43, 12, 43, 12, 43, 12, 170, 40];
  var OUCH = ['Ow!', 'Hey!', 'Watch it!', 'Oof!'];
  var OUCH3 = ['OK OK!', 'Too fast!', 'I felt that!'];
  var GLOAT = ['Gotcha!', 'Boing!', 'Nice one.'];

  function W() { return w.RDRWalkers; }
  function game() { return w.RDR && RDR.game; }
  function smackR(rnd) {
    var h = (W() && W().heightOf(rnd)) || 56;
    return Math.max(28, h * 1.15);
  }
  function sendToPid(pid, m) { if (w.RDR075 && RDR075.sendToPid) RDR075.sendToPid(pid, m); }
  function sendAll(m) { if (w.RDR075 && RDR075.sendAll) RDR075.sendAll(m); }

  function plan(p, ww) {
    var g = game(), rnd = w.RDR && RDR.render, out = [];
    if (!g || !W()) return out;
    var L = ww.path.length, end = ww.start + ww.durs.reduce(function (x, y) { return x + y; }, 0);
    var t1 = ww.start + Math.min(ww.durs[0] * 0.5, 120);
    var R = smackR(rnd);
    g.players.forEach(function (q) {
      if (q.id === p.id || q.bankrupt) return;
      var vq = W().visOf(q); if (W().busy(vq) || !vq.shown) return;
      var best = 1e9, tc = 0;
      for (var t = t1; t <= end; t += 8) {
        var ps = W().walkPos(p, ww, t, rnd), d = Math.hypot(ps.x - vq.x, ps.y - vq.y);
        if (d < best) { best = d; tc = t; }
      }
      if (best < R) out.push({ pid: q.id, tc: tc, d: best, done: false, tap: null, perfect: false, ai: false });
    });
    /* AI smacks at solo rates: 22% vs a human, 14% vs others; PERFECT ~3% of those */
    if (g.isBot && g.isBot(p)) {
      out.forEach(function (ps) {
        var q = g.byId(ps.pid);
        var vsHuman = q && !g.isBot(q);
        if (Math.random() < (vsHuman ? 0.22 : 0.14)) {
          ps.ai = true; ps.tap = ps.tc; ps.perfect = Math.random() < 0.03;
        }
      });
    }
    pushCues(p, ww);
    return out;
  }
  function cuePayload(p, ww, now) {
    now = now != null ? now : ((game() && game().now) || 0);
    var list = (ww.passes || []).filter(function (ps) { return !ps.done; }).map(function (ps) {
      return { pid: ps.pid, tc: ps.tc, open: ps.tc - SMACK_PRE, close: ps.tc + SMACK_POST, sweet: SWEET };
    });
    return { t: 'smackCue', walker: p.id, now: now, start: ww.start, passes: list, pre: SMACK_PRE, post: SMACK_POST, sweet: SWEET };
  }
  function pushCues(p, ww) {
    sendToPid(p.id, cuePayload(p, ww));
  }
  function cueFor(pid) {
    var g = game(); if (!g || !W()) return null;
    for (var i = 0; i < g.players.length; i++) {
      var p = g.players[i], v = W().visOf(p);
      if (!v.walk || p.id !== pid) continue;
      return cuePayload(p, v.walk);
    }
    return null;
  }
  function onTap(conn, m) {
    var g = game(); if (!g || !W()) return;
    var pid = m.pid, p = pid != null ? g.byId(pid) : null;
    if (!p) {
      var cl = w.RDR && RDR.clients;
      if (cl) {
        for (var k in cl) if (cl[k].conn === conn) p = g.byId(cl[k].pid);
      }
    }
    if (!p) return;
    var v = W().visOf(p); if (!v.walk) return;
    var now = m.at != null ? m.at : g.now;
    var best = null, bestD = 1e9;
    (v.walk.passes || []).forEach(function (ps) {
      if (ps.done || ps.tap != null) return;
      var d = Math.abs(now - ps.tc);
      if (now >= ps.tc - SMACK_PRE && now <= ps.tc + SMACK_POST && d < bestD) { bestD = d; best = ps; }
    });
    if (!best) return;
    best.tap = now;
    best.perfect = Math.abs(now - best.tc) <= SWEET;
    if (now >= best.tc) doSmack(p, best, v.walk);
  }
  function fire(p, ww, now) {
    (ww.passes || []).forEach(function (ps) {
      if (!ps.done && ps.tap != null && now >= ps.tc) doSmack(p, ps, ww);
    });
  }
  function doSmack(p, ps, ww) {
    ps.done = true;
    var g = game(); if (!g) return;
    var q = g.byId(ps.pid); if (!q || q.bankrupt) return;
    var WW = W(), v = WW.visOf(p), vq = WW.visOf(q);
    var pw = WW.cosOf(p.charId, 'smack'), dir = v.face || 1, base = 0.55 + 0.05 * pw;
    var h = WW.heightOf(w.RDR && RDR.render);
    if (!ps.perfect) {
      v.swing = { at: performance.now(), dur: 380 };
      vq.bonk = { at: performance.now(), dir: dir, amp: base, decay: 2.6 };
      WW.pows.push({ x: vq.x, y: vq.y - h * 0.95, born: performance.now(), col: p.color, txt: 'BONK!', sc: 1, life: 750 });
      WW.lsfx('smack'); setTimeout(function () { WW.lsfx('boing'); }, 70);
      sendToPid(q.id, { t: 'smackBuzz', pattern: VIB_VICTIM, perfect: false });
      sendToPid(p.id, { t: 'smackBuzz', pattern: 18, perfect: false, role: 'smacker' });
      if (w.RDRTalk && Math.random() < 0.6) RDRTalk.say(q.id, OUCH[Math.floor(Math.random() * OUCH.length)], { fromFx: true });
    } else {
      var gh = { pid: p.id, x: vq.x - dir * (h * 0.45), y: vq.y + 2, face: dir, born: performance.now(), until: performance.now() + 1250, swing: null };
      WW.ghosts.push(gh);
      PERFECT_HITS.forEach(function (hit, i) {
        setTimeout(function () {
          var tN = performance.now();
          gh.swing = { at: tN, dur: hit.big ? 260 : 55, blur: !hit.big };
          var flick = hit.big ? 0 : (i % 2 ? -1 : 1);
          vq.bonk = { at: tN, dir: hit.big ? dir : dir * flick, amp: hit.big === 2 ? base * 2.1 : hit.big ? base * 1.4 : base * 0.7, decay: hit.big === 2 ? 1.5 : 3.2, long: hit.big === 2 };
          if (hit.big === 1) { WW.pows.push({ x: vq.x, y: vq.y - h, born: tN, col: '#ffd23f', txt: 'PERFECT!', sc: 1.5, life: 900 }); WW.lsfx('ding'); WW.lsfx('smack'); }
          else if (hit.big === 2) { WW.pows.push({ x: vq.x, y: vq.y - h * 1.05, born: tN, col: p.color, txt: 'SMACK!', sc: 1.7, life: 1100 }); WW.lsfx('smack'); setTimeout(function () { WW.lsfx('boing'); }, 60); setTimeout(function () { WW.lsfx('ding'); }, 140); WW.nudge(8); }
          else { WW.lsfx('slap'); if (i === 1) WW.pows.push({ x: vq.x + h * 0.55, y: vq.y - h * 1.6, born: tN, col: '#ff5d73', txt: 'TOO FAST!', sc: 1.1, life: 700 }); }
        }, hit.t);
      });
      sendToPid(q.id, { t: 'smackBuzz', pattern: VIB_VICTIM_P, perfect: true });
      sendToPid(p.id, { t: 'smackBuzz', pattern: VIB_SMACKER_P, perfect: true, role: 'smacker' });
      if (w.RDRTalk) setTimeout(function () { RDRTalk.say(q.id, OUCH3[Math.floor(Math.random() * OUCH3.length)], { fromFx: true }); }, 900);
    }
    if (g.isBot && g.isBot(p) && Math.random() < 0.4 && w.RDRTalk) {
      setTimeout(function () { RDRTalk.say(p.id, GLOAT[Math.floor(Math.random() * GLOAT.length)], { fromFx: true }); }, ps.perfect ? 1000 : 0);
    }
    sendAll({ t: 'smackDone', from: p.id, to: q.id, perfect: !!ps.perfect });
  }
  function drawCues(c, rnd, tP) {
    var g = game(); if (!g || !W()) return;
    g.players.forEach(function (p) {
      var v = W().visOf(p); if (!v.walk) return;
      var now = g.now;
      (v.walk.passes || []).forEach(function (ps) {
        if (ps.done) return;
        var open = ps.tc - SMACK_PRE, close = ps.tc + SMACK_POST;
        if (now < open || now > close) return;
        var q = g.byId(ps.pid); if (!q) return;
        var vq = W().visOf(q), h = W().heightOf(rnd);
        var mid = (now - open) / (close - open);
        var sweetOn = Math.abs(now - ps.tc) <= SWEET;
        var r = h * 0.85 * (1 - mid * 0.7);
        c.save();
        c.strokeStyle = sweetOn ? '#ffd23f' : 'rgba(255,255,255,0.7)';
        c.lineWidth = sweetOn ? 5 : 3;
        c.beginPath(); c.arc(vq.x, vq.y - h * 0.78, Math.max(6, r), 0, Math.PI * 2); c.stroke();
        if (sweetOn) {
          c.strokeStyle = 'rgba(255,210,63,0.35)'; c.lineWidth = 10;
          c.beginPath(); c.arc(vq.x, vq.y - h * 0.78, Math.max(6, r + 4), 0, Math.PI * 2); c.stroke();
        }
        c.restore();
      });
    });
  }
  /* test hook: start a fake walk that will pass a standing player, or force a perfect */
  function testPerfect(fromId, toId) {
    var g = game(); if (!g || !W()) return false;
    var p = g.byId(fromId), q = g.byId(toId);
    if (!p || !q) return false;
    var v = W().visOf(p), vq = W().visOf(q);
    var ww = v.walk || { path: [p.pos], start: g.now, durs: [200], x0: v.x, y0: v.y, hopH: 20, passes: [], dread: 0, from: p.pos };
    var ps = { pid: q.id, tc: g.now, d: 0, done: false, tap: g.now, perfect: true, ai: false };
    ww.passes = [ps]; v.walk = ww; v.shown = true; vq.shown = true;
    doSmack(p, ps, ww);
    return true;
  }

  w.RDRSmack = {
    plan: plan, fire: fire, onTap: onTap, cueFor: cueFor, doSmack: doSmack, drawCues: drawCues,
    testPerfect: testPerfect, SMACK_PRE: SMACK_PRE, SMACK_POST: SMACK_POST, SWEET: SWEET
  };
})(window);
