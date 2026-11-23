/* TV v0.7.5: walking runners on the big board (hop, hard land, snowbank march, slow jail step). */
(function (w) {
  'use strict';
  var PPL = null;
  var vis = {};
  var dust = [], pows = [], ghosts = [];
  var shake = { at: 0, amp: 0 };
  var hooked = false;
  var CSTATS = {
    justin: { custom: [{ n: 'Smack Power', v: 9, cos: 'smack' }] },
    mike:   { reach: 7, custom: [] },
    doug:   { tough: 7, custom: [] },
    drew:   { custom: [{ n: 'Hop Height', v: 10, cos: 'hop' }] },
    grace:  { cash: 6, custom: [] },
    walt:   { custom: [] },
    dez:    { tough: 7, custom: [] },
    lenore: { tough: 6, custom: [] },
    priya:  { buy: 8, custom: [] },
    minh:   { cash: 7, custom: [] },
    cody:   { cash: 7, custom: [] }
  };
  var COMMON = ['cash', 'tough', 'buy', 'reach'];

  function game() { return w.RDR && RDR.game; }
  function render() { return w.RDR && RDR.render; }
  function statsOf(id) {
    var x = CSTATS[id] || { custom: [] }, o = { custom: x.custom || [] };
    for (var i = 0; i < COMMON.length; i++) o[COMMON[i]] = x[COMMON[i]] != null ? x[COMMON[i]] : 5;
    return o;
  }
  function cosOf(charId, k) {
    var c = (statsOf(charId).custom || []).filter(function (q) { return q.cos === k; })[0];
    return c ? c.v : 5;
  }
  function hash(s) {
    s = String(s || ''); var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function darken(hex, a) {
    hex = String(hex || '#888888').replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    var n = parseInt(hex, 16); if (isNaN(n)) return '#222';
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.round(r * a)); g = Math.max(0, Math.round(g * a)); b = Math.max(0, Math.round(b * a));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function lookFor(p) {
    if (typeof w.RDRProfileLook === 'function') {
      try { var L = w.RDRProfileLook(p); if (L && w.RDRPeople) return w.RDRPeople.clean(L); } catch (e) {}
    }
    if (typeof w.RDRLookFor === 'function') {
      try { var L2 = w.RDRLookFor(p); if (L2 && w.RDRPeople) return w.RDRPeople.clean(L2); } catch (e) {}
    }
    var ch = (w.RDRGame && RDRGame.charById && RDRGame.charById(p.charId)) || {};
    var h = hash(p.charId || p.id);
    var skins = (w.RDRPeople && RDRPeople.SKINS) || ['#f1c7a1'];
    var hats = (w.RDRPeople && RDRPeople.HATS) || ['none', 'cap', 'beanie'];
    var look = {
      shirt: p.color || ch.color || '#3fa7ff',
      pants: darken(p.color || ch.color || '#3fa7ff', 0.42),
      shoes: (h % 2) ? '#111111' : '#ffffff',
      hat: ch.ink || '#ff5d73',
      hatStyle: hats[h % hats.length],
      skin: skins[h % skins.length]
    };
    return w.RDRPeople ? RDRPeople.clean(look) : look;
  }
  function heightOf(rnd) {
    var ww = (rnd && rnd.w) || 56;
    return Math.max(40, Math.min(96, ww * 1.12));
  }
  function visOf(p) {
    if (!vis[p.id]) vis[p.id] = { face: -1, walk: null, phase: -1, hop: -1, lift: 0, hold: null, march: null, jail: null, impact: 0, impactAmp: 0, swing: null, bonk: null, shown: false, scale: 0, x: 0, y: 0, charId: p.charId };
    return vis[p.id];
  }
  function busy(v) { return !!(v && (v.walk || v.march || v.jail)); }
  function posOf(p) {
    var v = vis[p.id], g = game();
    if (v && v.hold) { if (g && p.pos === v.hold.from && g.now < v.hold.until) return v.hold.sp; v.hold = null; }
    return p.pos;
  }
  function slotAt(p, sp, rnd) {
    rnd = rnd || render();
    if (!rnd || !rnd.slot) return { x: 0, y: 0 };
    var g = game();
    var fake = { id: p.id, pos: sp, snow: p.snow, bankrupt: p.bankrupt, color: p.color, charId: p.charId, name: p.name, state: p.state };
    return rnd.slot(fake, sp);
  }
  function endSpotFor(p, sp, rnd) {
    rnd = rnd || render();
    var g = game(); if (!g) return slotAt(p, sp, rnd);
    var others = g.players.filter(function (q) { return !q.bankrupt && (q.id === p.id || (!busy(vis[q.id]) && posOf(q) === sp)); });
    var fake = { id: p.id, pos: sp, snow: (sp === 10 ? true : p.snow), bankrupt: p.bankrupt, color: p.color, charId: p.charId, name: p.name, state: p.state };
    /* slot() looks at real players on that space; temporarily agree on pos */
    var saved = [];
    others.forEach(function (q) { saved.push({ q: q, pos: q.pos, snow: q.snow }); if (q.id !== p.id) { /* leave them */ } });
    var was = p.pos, ws = p.snow; p.pos = sp;
    var s = rnd.slot(p, sp);
    p.pos = was; p.snow = ws;
    return s;
  }
  function nudge(amp) {
    var t = performance.now();
    if (amp > shake.amp * Math.max(0, 1 - (t - shake.at) / 260)) shake = { at: t, amp: amp };
  }
  function puff(x, y, n, big) {
    var t = performance.now();
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      dust.push({ x: x, y: y, vx: Math.cos(a) * (big ? 55 : 38), vy: Math.sin(a) * 14 - 4, born: t, life: 420 + Math.random() * 200, r: (big ? 6 : 4) + Math.random() * 3 });
    }
    if (dust.length > 80) dust.splice(0, dust.length - 80);
  }
  var LA = null;
  function laUnlock() { try { if (!LA) { var AC = w.AudioContext || w.webkitAudioContext; if (AC) LA = new AC(); } if (LA && LA.state === 'suspended') LA.resume(); } catch (e) {} }
  document.addEventListener('pointerdown', laUnlock, { passive: true });
  function tone(type, freq, delay, t, dur, vol) {
    if (!LA) return null;
    var o = LA.createOscillator(), g = LA.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t + delay);
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(vol, t + delay + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
    o.connect(g); g.connect(LA.destination); o.start(t + delay); o.stop(t + delay + dur + 0.02);
    return o;
  }
  function lsfx(n) {
    laUnlock(); if (!LA) return;
    var t = LA.currentTime;
    try {
      if (n === 'thud') { tone('sine', 90, 0, t, 0.16, 0.28); tone('triangle', 60, 0, t, 0.12, 0.18); }
      else if (n === 'thudBig') { tone('sine', 70, 0, t, 0.28, 0.38); tone('triangle', 48, 0, t, 0.2, 0.22); }
      else if (n === 'smack') { tone('square', 180, 0, t, 0.07, 0.2); tone('sawtooth', 90, 0, t, 0.09, 0.16); }
      else if (n === 'slap') { tone('square', 240, 0, t, 0.04, 0.12); }
      else if (n === 'boing') {
        var o = tone('sine', 150, 0, t, 1.2, 0.22), lfo = LA.createOscillator(), lg = LA.createGain();
        lfo.frequency.setValueAtTime(11, t); lfo.frequency.linearRampToValueAtTime(5, t + 1.2);
        lg.gain.setValueAtTime(90, t); lg.gain.exponentialRampToValueAtTime(4, t + 1.2);
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.25);
        o.frequency.setValueAtTime(220, t);
      } else if (n === 'ding') { tone('sine', 1568, 0, t, 0.6, 0.22); tone('sine', 2093, 0, t + 0.05, 0.7, 0.14); tone('triangle', 3136, 0, t, 0.25, 0.05); }
      else if (n === 'step') { tone('triangle', 140, 0, t, 0.05, 0.08); }
    } catch (e) {}
  }
  function land(p, v, heavy) {
    v.impact = performance.now(); v.impactAmp = heavy ? 0.5 : 0.36;
    puff(v.x, v.y, heavy ? 10 : 7, heavy);
    nudge(heavy ? 7 : 4);
    lsfx(heavy ? 'thudBig' : 'thud');
  }
  function walkPos(p, ww, t, rnd) {
    var L = ww.path.length, t0 = ww.start, k = 0;
    while (k < L - 1 && t >= t0 + ww.durs[k]) { t0 += ww.durs[k]; k++; }
    var to = ww.path[k], f = Math.max(0, Math.min(1, (t - t0) / Math.max(1, ww.durs[k])));
    var a = k === 0 ? { x: ww.x0, y: ww.y0 } : slotAt({ id: -1, pos: ww.path[k - 1], snow: false, bankrupt: false }, ww.path[k - 1], rnd);
    if (k === L - 1) {
      var b = endSpotFor(p, to, rnd), fe = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
      return { x: a.x + (b.x - a.x) * fe, y: a.y + (b.y - a.y) * fe, lift: Math.sin(Math.PI * Math.min(1, f * 1.04)) * ww.hopH, phase: 0.22, face: Math.abs(b.x - a.x) > 1 ? (b.x > a.x ? 1 : -1) : 0 };
    }
    var b2 = slotAt({ id: -1, pos: to, snow: false, bankrupt: false }, to, rnd);
    return { x: a.x + (b2.x - a.x) * f, y: a.y + (b2.y - a.y) * f, lift: 0, phase: ((k + f) * 2) % 1, face: Math.abs(b2.x - a.x) > 1 ? (b2.x > a.x ? 1 : -1) : 0 };
  }
  function startWalk(p, d, rnd) {
    rnd = rnd || render();
    var v = visOf(p), g = game();
    var step = (g && g.ms && w.RDR_CONFIG && RDR_CONFIG.timing) ? g.ms(RDR_CONFIG.timing.step) : 230;
    var durs = (d.durs && d.durs.length === d.path.length) ? d.durs.slice() : d.path.map(function () { return step; });
    /* slow jail-ish cadence if this is a short hop onto / through the Snowbank */
    if (d.path.length <= 2 && d.path[d.path.length - 1] === 10) {
      durs = durs.map(function (x) { return x * 1.55; });
    }
    var hopH = ((d.dread ? 0.32 : 0.52) * heightOf(rnd)) * (0.6 + 0.08 * cosOf(p.charId, 'hop'));
    v.walk = { path: d.path.slice(), from: p.pos, start: (g && g.now) || performance.now(), durs: durs, x0: v.x, y0: v.y, dread: d.dread || 0, hopH: hopH, passes: [] };
    v.march = null; v.jail = null; v.hop = -1; v.shown = true;
    if (w.RDRSmack && RDRSmack.plan) v.walk.passes = RDRSmack.plan(p, v.walk);
    return v.walk;
  }
  function startMarch(p, rnd) {
    rnd = rnd || render();
    var v = visOf(p), e = endSpotFor(p, 10, rnd);
    v.walk = null; v.hold = null; v.lift = 0; v.shown = true;
    v.march = { x0: v.x, y0: v.y, x1: e.x, y1: e.y, start: performance.now(), steps: [430, 470, 560, 900], fired: -1 };
  }
  function stepMarch(p, v) {
    var m = v.march, el = performance.now() - m.start, t0 = 0, i = 0;
    while (i < m.steps.length && el >= t0 + m.steps[i]) { t0 += m.steps[i]; i++; }
    if (i > m.fired) {
      for (var j = m.fired + 1; j < Math.min(i, m.steps.length); j++) {
        if (j !== m.steps.length - 1) { lsfx('thud'); v.impact = performance.now(); v.impactAmp = 0.18; nudge(2); }
      }
      m.fired = Math.min(i, m.steps.length) - 1;
    }
    if (i >= m.steps.length) {
      v.march = null; v.x = m.x1; v.y = m.y1; v.lift = 0; v.phase = -1; land(p, v, true); nudge(10); return;
    }
    var n = m.steps.length, f = (el - t0) / m.steps[i], fe = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2, pr = (i + fe) / n;
    v.x = m.x0 + (m.x1 - m.x0) * pr; v.y = m.y0 + (m.y1 - m.y0) * pr;
    v.lift = Math.sin(Math.PI * f) * (i === n - 1 ? heightOf(render()) * 0.62 : heightOf(render()) * 0.22);
    v.phase = (i % 2 ? 0.25 : 0.75);
    if (Math.abs(m.x1 - m.x0) > 1) v.face = m.x1 > m.x0 ? 1 : -1;
  }
  function startJailStep(p) {
    var v = visOf(p);
    v.walk = null; v.lift = 0; v.shown = true;
    v.jail = { start: performance.now(), steps: [680, 920], fired: -1, x: v.x, y: v.y };
  }
  function stepJail(p, v) {
    var m = v.jail, el = performance.now() - m.start, t0 = 0, i = 0;
    while (i < m.steps.length && el >= t0 + m.steps[i]) { t0 += m.steps[i]; i++; }
    if (i > m.fired) {
      for (var j = m.fired + 1; j <= i && j < m.steps.length; j++) { lsfx('thud'); v.impact = performance.now(); v.impactAmp = 0.22; nudge(2); }
      m.fired = Math.min(i, m.steps.length) - 1;
    }
    if (i >= m.steps.length) { v.jail = null; v.lift = 0; v.phase = -1; v.x = m.x; v.y = m.y; return; }
    var f = (el - t0) / m.steps[i];
    v.x = m.x; v.y = m.y;
    v.lift = Math.sin(Math.PI * f) * 10;
    v.phase = (i % 2 ? 0.3 : 0.7);
  }
  function springHead(b, tNow) {
    var t = (tNow - b.at) / 1000;
    if (t > (b.long ? 3 : 1.9)) return 0;
    return b.amp * Math.exp(-t * (b.decay || 2.6)) * Math.sin(t * Math.PI * 2 * 5.2 + 0.25);
  }
  function staggerOf(b, tNow) {
    var t = (tNow - b.at) / 1000;
    if (t > 0.9) return 0;
    return t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 4.5);
  }
  function slotMap(rnd) {
    var g = game(), m = {}, out = {};
    if (!g) return out;
    g.players.forEach(function (p) {
      if (p.bankrupt) return;
      var v = visOf(p); if (busy(v)) return;
      var ps = posOf(p);
      (m[ps] = m[ps] || []).push(p.id);
    });
    Object.keys(m).forEach(function (sp) {
      m[sp].forEach(function (pid, k) {
        var p = g.byId(pid);
        out[pid] = slotAt(p, +sp, rnd);
      });
    });
    return out;
  }
  function update(nowWall, dt, rnd) {
    var g = game(); if (!g) return;
    PPL = w.RDRPeople;
    var now = (g.phase === 'play' || g.phase === 'over') ? g.now : nowWall;
    var slots = slotMap(rnd);
    var dtS = (dt || 16) / 1000;
    g.players.forEach(function (p) {
      if (p.bankrupt) return;
      var v = visOf(p);
      if (v.charId !== p.charId) v.charId = p.charId;
      if (v.march) { stepMarch(p, v); return; }
      if (v.jail) { stepJail(p, v); return; }
      if (v.walk) {
        var ww = v.walk, L = ww.path.length, t0 = ww.start, k = 0;
        while (k < L && now >= t0 + ww.durs[k]) { t0 += ww.durs[k]; k++; }
        if (k >= L) {
          v.walk = null; v.phase = -1; v.lift = 0;
          var last = ww.path[L - 1], e = endSpotFor(p, last, rnd);
          v.x = e.x; v.y = e.y;
          v.hold = { sp: last, from: ww.from, until: now + 5000 };
          land(p, v, ww.dread > 0);
        } else {
          var q = walkPos(p, ww, now, rnd); v.x = q.x; v.y = q.y; v.lift = q.lift; v.phase = q.phase; if (q.face) v.face = q.face;
          if (k !== v.hop) { v.hop = k; lsfx('step'); }
          if (w.RDRSmack && RDRSmack.fire) RDRSmack.fire(p, ww, now);
        }
        return;
      }
      if (!v.shown) return;
      var tg = slots[p.id] || slotAt(p, posOf(p), rnd), dx = tg.x - v.x, dy = tg.y - v.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        var sp = Math.max(220, d * 2.5) * dtS;
        if (d <= sp) { v.x = tg.x; v.y = tg.y; }
        else { v.x += dx / d * sp; v.y += dy / d * sp; }
        v.phase = (v.phase < 0 ? 0 : v.phase + dtS * 2.2) % 1;
        if (Math.abs(dx) > 2) v.face = dx > 0 ? 1 : -1;
      } else { v.x = tg.x; v.y = tg.y; v.phase = -1; }
    });
  }
  function draw(rnd, nowWall) {
    var g = game(); if (!g || !rnd) return;
    PPL = w.RDRPeople; if (!PPL) return;
    var c = rnd.ctx, h = heightOf(rnd);
    var tP = performance.now();
    var sh = 0;
    if (tP - shake.at < 260) sh = shake.amp * (1 - (tP - shake.at) / 260) * ((tP / 30) % 2 < 1 ? 1 : -1);
    if (sh) { c.save(); c.translate(sh, sh * 0.4); }
    var list = g.players.filter(function (p) { return !p.bankrupt && visOf(p).shown; }).map(function (p) { return { p: p, v: visOf(p) }; }).sort(function (a, b) { return a.v.y - b.v.y; });
    var cur = g.cur && g.cur();
    list.forEach(function (o) {
      var p = o.p, v = o.v, active = cur && cur.id === p.id;
      var b = v.bonk, stg = b ? staggerOf(b, tP) : 0, ox = b ? b.dir * (h * 0.16) * stg : 0, lift = v.lift || 0;
      var it = (tP - v.impact) / 1000, sq = it < 0.55 ? 1 - v.impactAmp * Math.exp(-it * 9) * Math.cos(it * 30) : lift > 4 ? 1.1 : 1;
      var sw = v.swing && tP - v.swing.at < v.swing.dur ? (tP - v.swing.at) / v.swing.dur : -1;
      var head = b ? springHead(b, tP) * b.dir * (v.face || 1) : 0;
      if (b && tP - b.at > (b.long ? 3100 : 2000)) v.bonk = null;
      var sc = (v.scale != null && v.scale !== 1) ? v.scale : 1;
      if (sc <= 0.02) return;
      var hh = h * sc * (active ? 1.08 : 1);
      var mouth = (w.RDRTalk && RDRTalk.mouthOf) ? RDRTalk.mouthOf(p.id, tP) : 0;
      if (sw >= 0 && v.swing.blur) PPL.draw(c, v.x + ox, v.y - lift, hh, lookFor(p), { walk: v.phase, face: v.face, badge: p.ink || (p.color), squash: sq, swing: (sw + 0.45) % 1, alpha: 0.35, mouth: mouth });
      PPL.draw(c, v.x + ox, v.y - lift, hh, lookFor(p), { walk: v.phase, face: v.face, badge: p.ink || p.color, squash: sq, swing: sw, head: head, tilt: b ? 0.32 * stg * b.dir * (v.face || 1) : 0, mouth: mouth, glow: active ? '#ffd23f' : null });
    });
    for (var gi = ghosts.length - 1; gi >= 0; gi--) {
      var gh = ghosts[gi];
      if (tP > gh.until) { ghosts.splice(gi, 1); continue; }
      var gp = g.byId(gh.pid); if (!gp) continue;
      var gsw = gh.swing && tP - gh.swing.at < gh.swing.dur ? (tP - gh.swing.at) / gh.swing.dur : -1;
      var fa = 1 - (tP - gh.born) / (gh.until - gh.born);
      if (gsw >= 0 && gh.swing && gh.swing.blur) PPL.draw(c, gh.x, gh.y, h, lookFor(gp), { face: gh.face, swing: (gsw + 0.45) % 1, alpha: 0.3 * fa });
      PPL.draw(c, gh.x, gh.y, h, lookFor(gp), { face: gh.face, swing: gsw, alpha: 0.75 * fa });
    }
    for (var i = dust.length - 1; i >= 0; i--) {
      var d = dust[i], a = (tP - d.born) / d.life; if (a >= 1) { dust.splice(i, 1); continue; }
      var e = 1 - Math.pow(1 - a, 2), dt = a * d.life / 1000;
      c.globalAlpha = 0.55 * (1 - a); c.fillStyle = '#d9c9a3'; c.beginPath(); c.arc(d.x + d.vx * dt * (1 - a * 0.5), d.y + d.vy * dt, d.r * (0.6 + e), 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    for (var pi = pows.length - 1; pi >= 0; pi--) {
      var pw = pows[pi], pa = (tP - pw.born) / pw.life; if (pa >= 1) { pows.splice(pi, 1); continue; }
      c.save(); c.globalAlpha = 1 - pa; c.fillStyle = pw.col || '#ffd23f';
      c.font = '800 ' + Math.round(18 * (pw.sc || 1) * (1 + pa * 0.3)) + 'px Fredoka, ui-sans-serif, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(pw.txt, pw.x, pw.y - pa * 28);
      c.restore();
    }
    if (w.RDRSmack && RDRSmack.drawCues) RDRSmack.drawCues(c, rnd, tP);
    if (w.RDRLobbyFX && RDRLobbyFX.draw) RDRLobbyFX.draw(c, rnd, tP);
    if (w.RDRTalk && RDRTalk.draw) RDRTalk.draw(c, rnd, tP);
    if (sh) c.restore();
  }
  function hookGame() {
    var g = game(); if (!g || hooked) return;
    hooked = true;
    g.on(function (type, d) {
      var p = d && d.pid != null ? g.byId(d.pid) : null;
      if (type === 'move' && p) startWalk(p, d);
      else if (type === 'whiteout' && p) startMarch(p);
      else if (type === 'stuck' && p) startJailStep(p);
      else if (type === 'start') {
        g.players.forEach(function (q) {
          var v = visOf(q); v.shown = true; if (!v.x && !v.y) { var s = slotAt(q, q.pos || 0, render()); v.x = s.x; v.y = s.y; }
        });
      }
    });
  }
  function snapToBoard() {
    var g = game(), rnd = render(); if (!g || !rnd) return;
    g.players.forEach(function (p) {
      var v = visOf(p); var s = slotAt(p, posOf(p), rnd);
      if (!v.x && !v.y) { v.x = s.x; v.y = s.y; }
    });
  }

  w.RDRWalkers = {
    vis: vis, visOf: visOf, walkPos: walkPos, startWalk: startWalk, startMarch: startMarch, startJailStep: startJailStep,
    lookFor: lookFor, heightOf: heightOf, slotAt: slotAt, endSpotFor: endSpotFor, land: land, puff: puff,
    dust: dust, pows: pows, ghosts: ghosts, nudge: nudge, lsfx: lsfx, springHead: springHead, staggerOf: staggerOf,
    statsOf: statsOf, cosOf: cosOf, hash: hash, update: update, draw: draw, hookGame: hookGame, snapToBoard: snapToBoard,
    busy: busy, posOf: posOf, replaces: function (p) { return !!(p && vis[p.id] && vis[p.id].shown); },
    CSTATS: CSTATS
  };
  w.RDRCharStats = { statsOf: statsOf, cosOf: cosOf, CSTATS: CSTATS };
})(window);
