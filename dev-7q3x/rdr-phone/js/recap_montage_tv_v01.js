/* TV v0.7.6 recap montage: a ring buffer of real events (buys, rent, losses, big rolls, smacks, catches)
   replays as overlapping, faded vignettes in the liminal space above the board during a recap show.
   Ordinary vignettes run at 1/4 game speed. Combo smacks (especially a triple slap past a group) are
   featured: larger ethereal victims stand still, spaced as they were, while the slapper runs past and
   replays the slap sequence at HALF speed. */
(function (w) {
  'use strict';
  var MAX = 48;
  var buf = [];
  var active = [];
  var on = false;
  var startedAt = 0;
  var recapLines = 0;
  var recapLine = 0;
  var hookedSmack = false;
  var openCombo = null;

  function game() { return w.RDR && RDR.game; }
  function W() { return w.RDRWalkers; }
  function nowMs() { return (game() && game().now) || performance.now(); }

  function push(ev) {
    if (!ev) return;
    ev.t = ev.t != null ? ev.t : Date.now();
    ev.gameNow = ev.gameNow != null ? ev.gameNow : nowMs();
    ev.lap = ev.lap || 0;
    buf.push(ev);
    if (buf.length > MAX) buf.shift();
  }

  function flushCombo() {
    if (!openCombo || !openCombo.hits.length) { openCombo = null; return; }
    var ev = openCombo;
    ev.n = ev.hits.length;
    ev.combo = ev.n >= 2;
    ev.kind = ev.combo ? 'smackCombo' : 'smack';
    ev.pri = ev.n >= 3 ? 100 + ev.n : (ev.n === 2 ? 80 : 40);
    /* include every involved runner's last known position */
    ev.involved = ev.involved || ev.hits.map(function (h) { return { pid: h.pid, x: h.x, y: h.y }; });
    push(ev);
    openCombo = null;
  }

  function noteSmack(p, ps, ww) {
    var g = game(), WW = W(); if (!g || !WW || !p || !ps) return;
    var q = g.byId(ps.pid); if (!q) return;
    var v = WW.visOf(p), vq = WW.visOf(q);
    if (!openCombo || openCombo.walker !== p.id || openCombo.walk !== ww) {
      flushCombo();
      var others = [];
      (ww && ww.passes || []).forEach(function (pass) {
        var o = g.byId(pass.pid), vo = o && WW.visOf(o);
        if (vo) others.push({ pid: o.id, x: vo.x, y: vo.y });
      });
      openCombo = {
        kind: 'smackCombo', walker: p.id, walk: ww, hits: [],
        wx0: v.x, wy0: v.y, face: v.face || 1,
        color: p.color, charId: p.charId, name: p.name,
        involved: others, gameNow: nowMs()
      };
    }
    openCombo.hits.push({
      pid: q.id, name: q.name, color: q.color, charId: q.charId,
      x: vq.x, y: vq.y, wx: v.x, wy: v.y,
      perfect: !!ps.perfect, tc: ps.tc, at: nowMs()
    });
    openCombo.wx1 = v.x; openCombo.wy1 = v.y;
  }

  function hookSmack() {
    if (hookedSmack || !w.RDRSmack || typeof RDRSmack.doSmack !== 'function') return !!w.RDRSmack;
    hookedSmack = true;
    var orig = RDRSmack.doSmack.bind(RDRSmack);
    RDRSmack.doSmack = function (p, ps, ww) {
      try { noteSmack(p, ps, ww); } catch (e) {}
      return orig(p, ps, ww);
    };
    return true;
  }

  function hookGame() {
    var g = game(); if (!g || g._tv076Montage) return !!g;
    g._tv076Montage = true;
    g.on(function (type, d) {
      if (type === 'buy' || type === 'auctionWon') {
        var p = g.byId(d.pid); if (!p) return;
        var v = W() && W().visOf(p);
        push({ kind: 'buy', pid: p.id, name: p.name, color: p.color, charId: p.charId, sp: d.sp, amount: d.amount || d.bid,
          x: v ? v.x : 0, y: v ? v.y : 0, pri: 30 });
      } else if (type === 'pay' && d && /rent/.test(d.reason || '')) {
        var a = g.byId(d.from), b = g.byId(d.to);
        var va = a && W() && W().visOf(a), vb = b && W() && W().visOf(b);
        push({ kind: 'rent', from: d.from, to: d.to, amount: d.amount, reason: d.reason,
          ax: va ? va.x : 0, ay: va ? va.y : 0, bx: vb ? vb.x : 0, by: vb ? vb.y : 0,
          aName: a && a.name, bName: b && b.name, aColor: a && a.color, bColor: b && b.color,
          aChar: a && a.charId, bChar: b && b.charId, pri: 50 });
      } else if (type === 'sell' || type === 'hock' || type === 'bankrupt') {
        var p2 = g.byId(d.pid); if (!p2) return;
        var v2 = W() && W().visOf(p2);
        push({ kind: 'lose', pid: p2.id, name: p2.name, color: p2.color, charId: p2.charId, sp: d.sp, how: type,
          x: v2 ? v2.x : 0, y: v2 ? v2.y : 0, deeds: d.deeds, pri: 45 });
      } else if (type === 'roll') {
        var tot = d.total || ((d.d && d.d[0] || 0) + (d.d && d.d[1] || 0));
        if (tot >= 10 || d.dbl) {
          var p3 = g.byId(d.pid), v3 = p3 && W() && W().visOf(p3);
          push({ kind: 'roll', pid: d.pid, name: p3 && p3.name, color: p3 && p3.color, charId: p3 && p3.charId,
            d: d.d, total: tot, dbl: !!d.dbl, x: v3 ? v3.x : 0, y: v3 ? v3.y : 0, pri: 25 });
        }
      } else if (type === 'caught') {
        var mover = g.byId(d.pid), own = g.byId(d.owner);
        var vm = mover && W() && W().visOf(mover), vo = own && W() && W().visOf(own);
        push({ kind: 'caught', pid: d.pid, owner: d.owner, amount: d.amount, sp: d.sp,
          ax: vm ? vm.x : 0, ay: vm ? vm.y : 0, bx: vo ? vo.x : 0, by: vo ? vo.y : 0,
          aName: mover && mover.name, bName: own && own.name, aColor: mover && mover.color, bColor: own && own.color,
          aChar: mover && mover.charId, bChar: own && own.charId, pri: 60 });
      } else if (type === 'start') {
        buf.length = 0; openCombo = null;
      }
    });
    return true;
  }

  function pickEvents() {
    flushCombo();
    var list = buf.slice().sort(function (a, b) { return (b.pri || 0) - (a.pri || 0) || b.t - a.t; });
    var out = [], used = {};
    list.forEach(function (ev) {
      if (out.length >= 5) return;
      var key = ev.kind + ':' + (ev.walker || ev.pid || ev.from || '') + ':' + (ev.n || ev.sp || ev.total || ev.amount || '');
      if (used[key]) return;
      used[key] = 1;
      out.push(ev);
    });
    /* always try to include at least one combo if we have one */
    var combo = list.filter(function (e) { return e.kind === 'smackCombo' && e.n >= 2; })[0];
    if (combo && out.indexOf(combo) < 0) { out.unshift(combo); if (out.length > 5) out.pop(); }
    return out;
  }

  function lookOf(charId, color) {
    if (W() && W().lookFor) {
      try { return W().lookFor({ charId: charId, color: color, ink: color }); } catch (e) {}
    }
    return { shirt: color || '#3fa7ff', pants: '#2b3550', shoes: '#fff', hat: color, hatStyle: 'cap', skin: '#f1c7a1' };
  }

  function startVignettes(events, board) {
    var rnd = w.RDR && RDR.render;
    var cx = board ? board.cx : (rnd ? rnd.bx + rnd.S / 2 : 400);
    var cy = board ? board.cy : (rnd ? rnd.by + rnd.S * 0.34 : 200);
    var S = rnd ? rnd.S : 800;
    active = events.map(function (ev, i) {
      var half = ev.kind === 'smackCombo' && ev.n >= 2;
      var dur = half ? 5200 : 3800;
      /* stagger starts so 2–3 overlap */
      var delay = i * 900;
      var ang = (i * 2.399) + 0.4;
      var rad = S * (0.08 + (i % 3) * 0.05);
      return {
        ev: ev, half: half, dur: dur, delay: delay,
        x: cx + Math.cos(ang) * rad,
        y: cy + Math.sin(ang) * rad * 0.55,
        driftA: ang, driftR: 10 + i * 4, rot: (i % 2 ? 1 : -1) * 0.08,
        t0: 0
      };
    });
  }

  function start(opts) {
    opts = opts || {};
    flushCombo();
    hookSmack(); hookGame();
    var evs = opts.events || pickEvents();
    if (!evs.length && opts.force) evs = demoEvents();
    if (!evs.length) { on = false; active = []; return false; }
    on = true; startedAt = performance.now(); recapLine = 0;
    recapLines = (opts.lines && opts.lines.length) || 4;
    startVignettes(evs, opts.board);
    if (w.RDRRecap) RDRRecap.playing = true;
    return true;
  }

  function stop() {
    on = false; active = [];
    if (w.RDRRecap) RDRRecap.playing = false;
  }

  function wrapRecap() {
    var R = w.RDRRecap;
    if (!R || R._tv076Montage || typeof R.play !== 'function') return !!R;
    R._tv076Montage = true;
    var orig = R.play.bind(R);
    R.play = function (showId, ev, game, done) {
      var lines = [];
      try { if (typeof R.scriptFor === 'function') lines = R.scriptFor(showId, ev, game) || []; } catch (e) {}
      start({ lines: lines });
      var wrapped = function () { stop(); if (typeof done === 'function') done.apply(this, arguments); };
      var ret = orig(showId, ev, game, wrapped);
      /* also watch the internal speaking flag / caption */
      var n = 0, id = setInterval(function () {
        n++;
        var speaking = R.playing || (R.state && R.state.on);
        /* recap_v01 uses a closed-over `speaking`; caption #rrecP.on is a reliable tell */
        var cap = document.getElementById('rrecP');
        var vis = cap && cap.classList.contains('on');
        if (vis) R.playing = true;
        if ((!vis && n > 8) || n > 800) { clearInterval(id); if (on) stop(); }
      }, 200);
      return ret;
    };
    var sl = R.showLine;
    if (typeof sl === 'function') {
      R.showLine = function () {
        recapLine++;
        return sl.apply(this, arguments);
      };
    }
    return true;
  }

  function vignetteMask(c, x, y, r) {
    var g = c.createRadialGradient(x, y, r * 0.35, x, y, r);
    g.addColorStop(0, 'rgba(16,12,24,0.42)');
    g.addColorStop(0.7, 'rgba(16,12,24,0.22)');
    g.addColorStop(1, 'rgba(16,12,24,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }

  function drawPerson(c, x, y, h, charId, color, o) {
    var PPL = w.RDRPeople; if (!PPL) return;
    var look = lookOf(charId, color);
    o = o || {};
    PPL.draw(c, x, y, h, look, o);
    if (o.selfiePid != null && w.RDRSelfie) RDRSelfie.drawFor(c, { id: o.selfiePid }, x, y, h, o);
  }

  function drawCombo(c, vg, u, now) {
    var ev = vg.ev, hits = ev.hits || [];
    if (!hits.length) return;
    var rate = 0.5; /* half speed featured replay */
    var play = Math.max(0, Math.min(1, u / rate)); /* but u is already 0..1 over vg.dur, so map time as if duration covers the sequence at 0.5x */
    /* treat the vignette duration as the half-speed window */
    var t = u; /* 0..1 over featured duration */
    var xs = hits.map(function (h) { return h.x; }), ys = hits.map(function (h) { return h.y; });
    xs.push(ev.wx0 || hits[0].wx, ev.wx1 || hits[hits.length - 1].wx);
    ys.push(ev.wy0 || hits[0].wy, ev.wy1 || hits[hits.length - 1].wy);
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var spanX = Math.max(40, maxX - minX), spanY = Math.max(20, maxY - minY);
    var scale = Math.min(2.4, 180 / Math.max(spanX, 1), 90 / Math.max(spanY, 1));
    var midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    function map(x, y) { return { x: vg.x + (x - midX) * scale, y: vg.y + (y - midY) * scale }; }
    var h = 52 * 1.7; /* larger ethereal victims */
    /* victims stand still, slowly drifting / scrubbing */
    var drift = Math.sin(now / 1800 + vg.driftA) * 6;
    hits.forEach(function (hit, i) {
      var p = map(hit.x, hit.y);
      var fade = 0.55 + 0.2 * Math.sin(now / 1400 + i);
      drawPerson(c, p.x + drift, p.y, h, hit.charId, hit.color, { walk: -1, face: ev.face || 1, alpha: fade, glow: 'rgba(230,220,255,0.35)', selfiePid: hit.pid });
    });
    /* slapper runs past at half speed along the recorded path */
    var path = [];
    path.push({ x: ev.wx0 != null ? ev.wx0 : hits[0].wx, y: ev.wy0 != null ? ev.wy0 : hits[0].wy, t: 0 });
    hits.forEach(function (hit, i) {
      var u0 = (i + 0.5) / (hits.length + 0.5);
      path.push({ x: hit.wx, y: hit.wy, t: u0, hit: hit, i: i });
    });
    path.push({ x: ev.wx1 != null ? ev.wx1 : hits[hits.length - 1].wx, y: ev.wy1 != null ? ev.wy1 : hits[hits.length - 1].wy, t: 1 });
    var tt = t, k = 0;
    while (k < path.length - 1 && tt >= path[k + 1].t) k++;
    var a = path[k], b = path[Math.min(k + 1, path.length - 1)];
    var f = (b.t - a.t) > 1e-6 ? (tt - a.t) / (b.t - a.t) : 1;
    f = Math.max(0, Math.min(1, f));
    var sp = map(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
    var face = (b.x >= a.x) ? 1 : -1;
    /* swing when near a hit */
    var swing = -1, popping = null;
    hits.forEach(function (hit, i) {
      var ht = path[i + 1] ? path[i + 1].t : (i + 0.5) / (hits.length + 0.5);
      var dlt = tt - ht;
      if (dlt >= -0.04 && dlt <= 0.18) {
        swing = Math.max(0, Math.min(0.99, (dlt + 0.04) / 0.16));
        if (dlt >= 0 && dlt < 0.14) popping = hit;
      }
    });
    drawPerson(c, sp.x, sp.y, 52 * 1.45, ev.charId, ev.color, { walk: (tt * 3) % 1, face: face, swing: swing, alpha: 0.9, glow: '#ffd23f', selfiePid: ev.walker });
    if (popping) {
      var vp = map(popping.x, popping.y);
      c.save();
      c.globalAlpha = 0.85;
      c.fillStyle = popping.perfect ? '#ffd23f' : ev.color || '#fff';
      c.font = '800 16px Fredoka, ui-sans-serif, sans-serif';
      c.textAlign = 'center';
      c.fillText(popping.perfect ? 'PERFECT!' : 'SMACK!', vp.x, vp.y - h * 1.05);
      c.restore();
    }
  }

  function drawMoney(c, x0, y0, x1, y1, u, col, amt) {
    var n = 6;
    for (var i = 0; i < n; i++) {
      var tt = (u * 0.9 - i * 0.08);
      if (tt < 0 || tt > 1) continue;
      var e = 1 - Math.pow(1 - tt, 2);
      var x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(tt * Math.PI) * 18;
      c.save(); c.globalAlpha = 0.8 * (1 - tt * 0.3);
      c.fillStyle = col || '#9dff9d';
      c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill();
      c.restore();
    }
    if (amt && u > 0.15 && u < 0.9) {
      c.save(); c.globalAlpha = 0.8; c.fillStyle = '#9dff9d';
      c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center';
      c.fillText('$' + Math.round(amt), (x0 + x1) / 2, (y0 + y1) / 2 - 22);
      c.restore();
    }
  }

  function drawSimple(c, vg, u, now) {
    var ev = vg.ev, x = vg.x, y = vg.y, h = 44;
    if (ev.kind === 'buy') {
      drawPerson(c, x, y, h, ev.charId, ev.color, { walk: -1, alpha: 0.8, selfiePid: ev.pid });
      c.save(); c.globalAlpha = 0.7; c.fillStyle = ev.color || '#ffd23f';
      c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center';
      c.fillText('BOUGHT', x, y - h * 1.15);
      c.restore();
    } else if (ev.kind === 'rent') {
      var a = { x: x - 40, y: y }, b = { x: x + 40, y: y };
      drawPerson(c, a.x, a.y, h, ev.aChar, ev.aColor, { walk: -1, face: 1, alpha: 0.8, selfiePid: ev.from });
      drawPerson(c, b.x, b.y, h, ev.bChar, ev.bColor, { walk: -1, face: -1, alpha: 0.8, selfiePid: ev.to });
      drawMoney(c, a.x, a.y - 30, b.x, b.y - 30, u, ev.bColor, ev.amount);
    } else if (ev.kind === 'lose') {
      drawPerson(c, x, y, h, ev.charId, ev.color, { walk: -1, alpha: 0.7 - u * 0.3, selfiePid: ev.pid });
      c.save(); c.globalAlpha = 0.65; c.fillStyle = '#ff8a8a';
      c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center';
      c.fillText(ev.how === 'bankrupt' ? 'BUST' : 'LOST', x, y - h * 1.15);
      c.restore();
    } else if (ev.kind === 'roll') {
      drawPerson(c, x, y + 8, h, ev.charId, ev.color, { walk: (u * 2) % 1, alpha: 0.85, selfiePid: ev.pid });
      c.save(); c.globalAlpha = 0.85; c.fillStyle = '#ffd23f';
      c.font = '800 18px Fredoka, sans-serif'; c.textAlign = 'center';
      c.fillText((ev.d ? ev.d[0] + '+' + ev.d[1] : ev.total) + (ev.dbl ? '  doubles' : ''), x, y - h);
      c.restore();
    } else if (ev.kind === 'caught') {
      var a2 = { x: x - 36, y: y }, b2 = { x: x + 36, y: y };
      drawPerson(c, a2.x, a2.y, h, ev.aChar, ev.aColor, { walk: -1, alpha: 0.8, squash: 0.85, selfiePid: ev.pid });
      drawPerson(c, b2.x, b2.y, h, ev.bChar, ev.bColor, { walk: -1, face: -1, alpha: 0.85, swing: Math.min(0.99, u * 1.4), selfiePid: ev.owner });
      c.save(); c.globalAlpha = 0.85; c.fillStyle = '#ff5d73';
      c.font = '800 16px Fredoka, sans-serif'; c.textAlign = 'center';
      c.fillText('CAUGHT!', x, y - h * 1.2);
      c.restore();
    } else if (ev.kind === 'smack' && ev.hits && ev.hits[0]) {
      drawCombo(c, vg, u, now);
    }
  }

  function draw(c, rnd, now) {
    hookSmack(); hookGame();
    if (W() && openCombo) {
      /* flush a combo once that walk is over */
      var p = game() && game().byId(openCombo.walker);
      var v = p && W().visOf(p);
      if (!v || !v.walk || v.walk !== openCombo.walk) flushCombo();
    }
    if (!on || !c || !rnd) return;
    var wall = now || performance.now();
    c.save();
    /* sit above the board, in the open middle / sky — already in board space if the caller is inside the clip;
       we draw in board coordinates around the centre-upper third. */
    for (var i = 0; i < active.length; i++) {
      var vg = active[i];
      var local = wall - startedAt - vg.delay;
      if (local < 0) continue;
      if (!vg.t0) vg.t0 = wall;
      var u = (wall - startedAt - vg.delay) / vg.dur;
      if (u > 1.15) continue;
      var fade = u < 0.12 ? u / 0.12 : (u > 0.82 ? Math.max(0, 1 - (u - 0.82) / 0.25) : 1);
      if (fade <= 0) continue;
      var dx = Math.cos(wall / 2600 + vg.driftA) * vg.driftR;
      var dy = Math.sin(wall / 3200 + vg.driftA) * vg.driftR * 0.45;
      var x = vg.x + dx, y = vg.y + dy;
      c.save();
      c.globalAlpha = fade;
      c.translate(x, y);
      c.rotate(Math.sin(wall / 4000) * vg.rot);
      c.translate(-x, -y);
      var rad = vg.half ? rnd.S * 0.28 : rnd.S * 0.18;
      vignetteMask(c, x, y, rad);
      c.beginPath(); c.arc(x, y, rad, 0, 7); c.clip();
      var vg2 = { ev: vg.ev, half: vg.half, dur: vg.dur, x: x, y: y, driftA: vg.driftA };
      if (vg.half || vg.ev.kind === 'smackCombo') drawCombo(c, vg2, Math.max(0, Math.min(1, u)), wall);
      else drawSimple(c, vg2, Math.max(0, Math.min(1, u)), wall);
      c.restore();
    }
    c.restore();
  }

  function demoEvents() {
    var g = game(), pls = (g && g.players) || [];
    function P(i, fallback) { return pls[i] || pls[0] || fallback; }
    var a = P(0, { id: 1, name: 'A', color: '#ff5d73', charId: 'priya' });
    var b = P(1, { id: 2, name: 'B', color: '#3fa7ff', charId: 'drew' });
    var c = P(2, { id: 3, name: 'C', color: '#ffd23f', charId: 'doug' });
    var d = P(3, { id: 4, name: 'D', color: '#5ef2c8', charId: 'grace' });
    var rnd = w.RDR && RDR.render;
    var ox = rnd ? rnd.bx + rnd.S * 0.5 : 400, oy = rnd ? rnd.by + rnd.S * 0.7 : 400;
    return [
      {
        kind: 'smackCombo', pri: 110, n: 3, combo: true, walker: a.id, name: a.name, color: a.color, charId: a.charId,
        face: 1, wx0: ox - 80, wy0: oy, wx1: ox + 90, wy1: oy,
        hits: [
          { pid: b.id, name: b.name, color: b.color, charId: b.charId, x: ox - 20, y: oy + 4, wx: ox - 28, wy: oy, perfect: false },
          { pid: c.id, name: c.name, color: c.color, charId: c.charId, x: ox + 18, y: oy - 6, wx: ox + 10, wy: oy, perfect: true },
          { pid: d.id, name: d.name, color: d.color, charId: d.charId, x: ox + 55, y: oy + 8, wx: ox + 46, wy: oy, perfect: false }
        ]
      },
      { kind: 'rent', pri: 50, from: b.id, to: a.id, amount: 220, ax: 0, ay: 0, bx: 0, by: 0,
        aName: b.name, bName: a.name, aColor: b.color, bColor: a.color, aChar: b.charId, bChar: a.charId },
      { kind: 'buy', pri: 30, pid: c.id, name: c.name, color: c.color, charId: c.charId, amount: 180 },
      { kind: 'caught', pri: 60, pid: d.id, owner: a.id, amount: 140, aName: d.name, bName: a.name,
        aColor: d.color, bColor: a.color, aChar: d.charId, bChar: a.charId }
    ];
  }

  function test() {
    /* mid-recap look: soft caption + montage with a featured triple slap */
    start({ events: demoEvents(), lines: ['one', 'two', 'three', 'four'], force: true });
    if (w.RDRRecap && RDRRecap.showLine && RDRRecap.SHOWS) {
      var show = RDRRecap.SHOWS['gary-stu'] || RDRRecap.SHOWS[Object.keys(RDRRecap.SHOWS)[0]];
      if (show) RDRRecap.showLine(show, { who: 0, text: 'And then — a triple slap right down Gasoline Alley.' });
    }
    return true;
  }

  w.RDRMontage = {
    push: push, buf: buf, start: start, stop: stop, draw: draw,
    hookGame: hookGame, hookSmack: hookSmack, wrapRecap: wrapRecap,
    test: test, demoEvents: demoEvents, flushCombo: flushCombo,
    isOn: function () { return on; }
  };
})(window);
