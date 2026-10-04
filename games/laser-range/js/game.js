/* LASER RANGE - game state and rules (no DOM). The TV owns one Game; phones only send intents.
   Screen units: x 0..1 (left -> right), y 0..1 (top -> bottom) inside the 16:9 play area.
   Distances that must look round on screen use dist(), which works in screen widths. */
(function (root) {
  'use strict';
  var C = root.LR_CONFIG, AIM = root.LRAim;
  var AR = 9 / 16;                                    // height / width of the play area
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = (ay - by) * AR; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // circle (cx, cy, r in widths) vs rect {x0, x1, y0, y1}
  function circleRect(cx, cy, r, R) { var nx = clamp(cx, R.x0, R.x1), ny = clamp(cy, R.y0, R.y1); return dist(cx, cy, nx, ny) <= r; }
  function inRect(x, y, R) { return x >= R.x0 && x <= R.x1 && y >= R.y0 && y <= R.y1; }

  // ------------------------------------------------------------------ the gallery: three rows of cover + a duck rail
  var ROWS = [
    { y: 0.50, s: 0.62, slots: [0.07, 0.2, 0.33, 0.67, 0.8, 0.93], kinds: ['crate', 'barrel', 'wall', 'crate', 'barrel', 'wall'] },   // the gap in the middle shows the sign
    { y: 0.70, s: 0.8, slots: [0.17, 0.37, 0.6, 0.83], kinds: ['wall', 'barrel', 'crate', 'wall'] },
    { y: 0.93, s: 1.0, slots: [0.08, 0.3, 0.7, 0.92], kinds: ['barrel', 'crate', 'barrel', 'wall'] }
  ];
  var RAIL_Y = 0.335;
  var COVER = { crate: { w: 0.08, h: 0.142 }, barrel: { w: 0.064, h: 0.15 }, wall: { w: 0.16, h: 0.13 } };
  var TGT = { w: 0.058, h: 0.2, goldW: 0.042, goldH: 0.15, duckW: 0.07, duckH: 0.11 };

  function Game(o) {
    o = o || {};
    this.rnd = rng(o.seed || (Date.now() & 0x7fffffff));
    this.players = []; this.nextId = 1;
    this.phase = 'lobby'; this.now = 0; this.version = 0;
    this.targets = []; this.shots = []; this.balloon = null; this.pending = [];
    this.round = 0; this.results = null; this.tid = 0;
    this.onEvent = null;
    this.buildScene();
    this.nextSpawn = 0; this.nextBalloon = 0;
  }
  var G = Game.prototype;
  G.emit = function (type, d) { if (this.onEvent) try { this.onEvent(type, d || {}); } catch (e) { if (root.console) console.error(e); } };
  G.changed = function () { this.version++; };
  G.r = function (a, b) { return a + (b - a) * this.rnd(); };
  G.pick = function (arr) { return arr[Math.floor(this.rnd() * arr.length)]; };

  G.buildScene = function () {
    var self = this, id = 0;
    this.rows = ROWS.map(function (R, ri) {
      return { y: R.y, s: R.s, idx: ri, covers: R.slots.map(function (x, i) {
        var k = R.kinds[i], d = COVER[k];
        return { id: ++id, row: ri, kind: k, x: x, w: d.w * R.s, h: d.h * R.s, hp: k === 'barrel' ? C.barrel.hp : 0, dead: false, respawnAt: 0, bornAt: -1e9, hitAt: -1e9 };
      }) };
    });
    this.covers = []; this.rows.forEach(function (R) { self.covers = self.covers.concat(R.covers); });
  };
  G.coverRect = function (c) { var R = this.rows[c.row]; return { x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: R.y - c.h, y1: R.y }; };
  G.railY = RAIL_Y;

  // ------------------------------------------------------------------ players
  G.byId = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  G.freeSeat = function () { for (var s = 0; s < C.maxPlayers; s++) { var used = false; for (var i = 0; i < this.players.length; i++) if (this.players[i].seat === s) used = true; if (!used) return s; } return -1; };
  G.addPlayer = function (o) {
    var seat = this.freeSeat(); if (seat < 0) return null;
    var col = C.colors[seat], f = C.aim.filter;
    var p = { id: this.nextId++, seat: seat, name: String(o.name || col.name).replace(/[<>]/g, '').trim().slice(0, 12) || col.name, color: col.color, ink: col.ink, colorName: col.name,
      clientId: o.clientId || null, connected: true, bot: !!o.bot,
      mode: null, calib: null, cal: null, hist: [], lastV: null, lastVAt: 0,
      tx: 0.5, ty: 0.5, cx: 0.5, cy: 0.5, fx: new AIM.OneEuro(f), fy: new AIM.OneEuro(f), hasAim: false, aimAt: 0,
      weapon: 'blaster', weaponUntil: 0, charge: null, coolUntil: 0, swipeUntil: 0, down: false,
      msg: null };
    this.resetStats(p);
    this.players.push(p); this.players.sort(function (a, b) { return a.seat - b.seat; });
    this.emit('join', { pid: p.id }); this.changed();
    return p;
  };
  G.resetStats = function (p) { p.score = 0; p.hits = 0; p.shotsFired = 0; p.barrels = 0; p.streak = 0; p.bestStreak = 0; p.golds = 0; p.oops = 0; p.blasts = 0; p.place = 0; };
  G.removePlayer = function (id) { this.players = this.players.filter(function (p) { return p.id !== id; }); this.changed(); };
  G.ready = function (p) { return p.hasAim && !p.cal; };

  // ------------------------------------------------------------------ phone intents
  G.intent = function (pid, m) {
    var p = this.byId(pid); if (!p || !m) return null;
    var now = this.now;
    switch (m.t) {
      case 'aim': {                                   // world pointing vector from the phone's gyro
        var v = m.v; if (!v || v.length !== 3 || !isFinite(v[0]) || !isFinite(v[1]) || !isFinite(v[2])) return null;
        v = AIM.norm([+v[0], +v[1], +v[2]]);
        p.lastV = v; p.lastVAt = now; p.hist.push({ t: now, v: v }); while (p.hist.length && now - p.hist[0].t > 1200) p.hist.shift();
        if (p.mode !== 'gyro') return null;
        if (p.calib) { var q = AIM.map(p.calib, v); this.setTarget(p, q.x, q.y); }
        return null;
      }
      case 'pad': {                                   // touchpad deltas in screen units
        if (p.mode !== 'pad') this.setMode(p, 'pad');
        this.setTarget(p, p.tx + clamp(+m.dx || 0, -1, 1), p.ty + clamp(+m.dy || 0, -1, 1));
        return null;
      }
      case 'mode': this.setMode(p, m.m === 'pad' ? 'pad' : 'gyro'); return null;
      case 'calStart': this.startCal(p, 'full'); return null;
      case 'recenter':
        if (p.mode === 'pad') { this.setTarget(p, 0.5, 0.5); p.fx.reset(0.5); p.fy.reset(0.5); return 'Cursor back in the middle.'; }
        if (!p.calib) { this.startCal(p, 'full'); return null; }
        this.startCal(p, 'recenter'); return null;
      case 'calSkip':                                  // no time to calibrate: centre on where the phone points now
        if (!p.lastV) return 'No motion data from your phone yet.';
        p.calib = AIM.defaultCal(p.lastV, C.aim.defaultSpanDeg); p.cal = null; p.mode = 'gyro'; this.aimReady(p); this.changed(); return null;
      case 'calBack': if (p.cal && p.cal.kind === 'full' && p.cal.step > 0) { p.cal.step--; p.cal.pts.pop(); this.changed(); } return null;
      case 'down': return this.press(p);
      case 'up': this.release(p); return null;
      case 'swipe': this.swipe(p, +m.dx || 0, +m.dy || 0); return null;
    }
    return null;
  };
  G.setTarget = function (p, x, y) { var o = C.aim.overscan; p.tx = clamp(x, -o, 1 + o); p.ty = clamp(y, -o, 1 + o); p.aimAt = this.now; };
  G.setMode = function (p, mode) {
    if (p.mode === mode) return;
    p.mode = mode; p.charge = null;
    if (mode === 'pad') { p.cal = null; this.setTarget(p, 0.5, 0.5); p.fx.reset(0.5); p.fy.reset(0.5); this.aimReady(p); }
    else if (!p.calib) this.startCal(p, 'full');
    else this.aimReady(p);
    this.changed();
  };
  G.aimReady = function (p) { if (!p.hasAim) { p.hasAim = true; p.fx.reset(p.tx); p.fy.reset(p.ty); } this.changed(); };
  G.startCal = function (p, kind) {
    p.mode = 'gyro'; p.charge = null;
    p.cal = { kind: kind, step: 0, pts: [], startedAt: this.now };
    this.emit('calStart', { pid: p.id, kind: kind }); this.changed();
  };
  G.calPoint = function (p) { if (!p.cal) return null; return p.cal.kind === 'recenter' ? { id: 'c', label: 'CENTRE', x: 0.5, y: 0.5 } : C.aim.calPoints[p.cal.step]; };
  G.sampleAim = function (p) {          // average of the readings just before the tap (skips the jolt of the tap itself)
    var w = C.aim.sampleMs, now = this.now, s = [0, 0, 0], n = 0;
    for (var i = 0; i < p.hist.length; i++) { var h = p.hist[i], age = now - h.t; if (age <= w[0] && age >= w[1]) { s[0] += h.v[0]; s[1] += h.v[1]; s[2] += h.v[2]; n++; } }
    if (n) return AIM.norm(s);
    if (p.lastV && now - p.lastVAt < 700) return p.lastV;
    return null;
  };
  G.calConfirm = function (p) {
    var v = this.sampleAim(p), pt = this.calPoint(p);
    if (!v) { this.emit('calNoData', { pid: p.id }); return 'No motion data from your phone. Tap "Use touchpad" if your phone has no motion sensor.'; }
    if (p.cal.kind === 'recenter') {
      p.calib = AIM.recenter(p.calib, v, 0.5, 0.5); p.cal = null;
      var q = AIM.map(p.calib, v); this.setTarget(p, q.x, q.y); p.fx.reset(q.x); p.fy.reset(q.y);
      this.emit('calDone', { pid: p.id, kind: 'recenter' }); this.changed(); return null;
    }
    p.cal.pts.push({ x: pt.x, y: pt.y, v: v, id: pt.id });
    p.cal.step++;
    this.emit('calPoint', { pid: p.id, step: p.cal.step, x: pt.x, y: pt.y });
    if (p.cal.step >= C.aim.calPoints.length) {
      var cal = AIM.calibrate(p.cal.pts, { minSpanDeg: C.aim.minSpanDeg, ridge: C.aim.ridge });
      if (cal.error) {
        p.cal = { kind: 'full', step: 0, pts: [], startedAt: this.now };
        this.emit('calFail', { pid: p.id, why: cal.error }); this.changed();
        return cal.error === 'too-small' ? 'The phone hardly moved between targets. Point the TOP of the phone straight at each target and try again.' : 'That did not work out. Let\'s try again.';
      }
      p.calib = cal; p.cal = null;
      var m = AIM.map(cal, v); this.setTarget(p, m.x, m.y);
      this.aimReady(p); p.fx.reset(m.x); p.fy.reset(m.y);
      this.emit('calDone', { pid: p.id, kind: 'full', fitErr: cal.fitErr, model: cal.kind });
    }
    this.changed();
    return null;
  };

  // ------------------------------------------------------------------ shooting
  G.canShoot = function () { return this.phase === 'play' || this.phase === 'lobby' || this.phase === 'over'; };
  G.scoring = function () { return this.phase === 'play'; };
  G.weaponOf = function (p) { if (p.weapon !== 'blaster' && this.now > p.weaponUntil) { p.weapon = 'blaster'; this.changed(); } return C.weapons[p.weapon]; };
  G.press = function (p) {
    if (p.cal) return this.calConfirm(p);
    if (!p.hasAim || !this.canShoot()) return null;
    p.down = true;
    var W = this.weaponOf(p);
    if (W.mode === 'hold') { if (!p.charge) { p.charge = { start: this.now }; this.emit('chargeStart', { pid: p.id }); } return null; }
    if (this.now < p.coolUntil) return null;
    p.coolUntil = this.now + W.cooldownMs;
    this.fire(p, p.cx, p.cy, W.radius, W.damage, false, 0);
    return null;
  };
  G.release = function (p) {
    p.down = false;
    if (!p.charge) return;
    var W = C.weapons.charger, held = this.now - p.charge.start; p.charge = null;
    if (held < W.minChargeMs && this.now < p.coolUntil) return;
    var f = clamp(held / W.chargeMs, 0, 1);
    p.coolUntil = this.now + W.cooldownMs;
    this.fire(p, p.cx, p.cy, W.radius + (W.maxRadius - W.radius) * f, Math.round(W.damage + (W.maxDamage - W.damage) * f), true, f);
  };
  G.chargeLevel = function (p) { return p.charge ? clamp((this.now - p.charge.start) / C.weapons.charger.chargeMs, 0, 1) : 0; };

  // what is under a point, front to back. Returns { kind: 'balloon'|'barrel'|'cover'|'target', obj } or null
  G.targetRect = function (t) {
    if (t.rail) return { x0: t.x - t.w / 2, x1: t.x + t.w / 2, y0: t.top, y1: t.top + t.h };
    var c = t.cover, R = this.coverRect(c);
    return { x0: t.x - t.w / 2, x1: t.x + t.w / 2, y0: t.top, y1: Math.min(R.y0, t.top + t.h) };
  };
  G.hittable = function (t) { return t.state === 'up' || (t.state === 'rise' && t.p > 0.35) || (t.state === 'duck' && t.p > 0.35); };
  G.pick1 = function (x, y, pad) {
    var b = this.balloon; if (b && !b.popped && dist(x, y, b.x, b.y) <= b.r + pad) return { kind: 'balloon', obj: b };
    for (var ri = this.rows.length - 1; ri >= 0; ri--) {
      var R = this.rows[ri], i;
      for (i = 0; i < R.covers.length; i++) { var c = R.covers[i]; if (c.dead) continue; if (inRect(x, y, this.coverRect(c))) return { kind: c.kind === 'barrel' ? 'barrel' : 'cover', obj: c }; }
      var best = null, bd = 1e9;
      for (i = 0; i < this.targets.length; i++) {
        var t = this.targets[i]; if (t.rail || t.row !== ri || !this.hittable(t)) continue;
        var TR = this.targetRect(t); if (TR.y1 <= TR.y0) continue;
        if (circleRect(x, y, pad, TR)) { var d = dist(x, y, (TR.x0 + TR.x1) / 2, (TR.y0 + TR.y1) / 2); if (d < bd) { bd = d; best = t; } }
      }
      if (best) return { kind: 'target', obj: best };
    }
    for (var j = 0; j < this.targets.length; j++) { var u = this.targets[j]; if (u.rail && this.hittable(u) && circleRect(x, y, pad, this.targetRect(u))) return { kind: 'target', obj: u }; }
    return null;
  };
  G.fire = function (p, x, y, radius, damage, charged, power) {
    var scoring = this.scoring(), hit = false, self = this;
    if (scoring) p.shotsFired++;
    this.emit('shot', { pid: p.id, x: x, y: y, r: radius, charged: charged, power: power, seat: p.seat, color: p.color });
    if (!charged) {
      var h = this.pick1(x, y, radius);
      if (h) {
        if (h.kind === 'balloon') { this.popBalloon(p); hit = true; }
        else if (h.kind === 'barrel') { this.hitBarrel(p, h.obj, damage); hit = true; }
        else if (h.kind === 'cover') this.emit('thunk', { pid: p.id, x: x, y: y, cover: h.obj.id });
        else { hit = this.killTarget(p, h.obj, 'shot') > 0; if (h.obj.type === 'buddy') hit = false; }
      }
    } else {                                           // charged shot: everything inside the blast circle, no cover blocking
      var b = this.balloon; if (b && !b.popped && dist(x, y, b.x, b.y) <= b.r + radius) { this.popBalloon(p); hit = true; }
      this.covers.forEach(function (c) { if (!c.dead && c.kind === 'barrel' && circleRect(x, y, radius, self.coverRect(c))) { self.hitBarrel(p, c, damage); hit = true; } });
      this.targets.slice().forEach(function (t) { if (self.hittable(t) && circleRect(x, y, radius, self.targetRect(t))) { if (self.killTarget(p, t, 'shot') > 0) hit = true; } });
    }
    if (scoring) {
      if (hit) {
        p.hits++; p.streak++; if (p.streak > p.bestStreak) p.bestStreak = p.streak;
        if (C.streakBonus.every && p.streak % C.streakBonus.every === 0) { p.score += C.streakBonus.points; this.emit('streak', { pid: p.id, n: p.streak, pts: C.streakBonus.points, x: x, y: y }); }
      } else { p.streak = 0; this.emit('miss', { pid: p.id, x: x, y: y }); }
      this.changed();
    }
    return hit;
  };
  G.award = function (p, pts) { if (!this.scoring() || !p) return; p.score = Math.max(0, p.score + pts); this.changed(); };
  G.killTarget = function (p, t, how) {
    if (t.state === 'dead') return 0;
    var T = C.targets[t.type], pts = how === 'blast' && T.points < 0 ? 0 : T.points;
    t.state = 'dead'; t.deadAt = this.now; t.by = p ? p.id : 0;
    var R = this.targetRect(t);
    if (this.scoring() && p) { this.award(p, pts); if (t.type === 'gold') p.golds++; if (t.type === 'buddy' && pts < 0) { p.oops++; p.streak = 0; } }
    this.emit('kill', { pid: p ? p.id : 0, type: t.type, pts: this.scoring() ? pts : 0, x: (R.x0 + R.x1) / 2, y: (R.y0 + R.y1) / 2, how: how, tid: t.id, color: p ? p.color : '#fff' });
    return pts > 0 ? 1 : pts < 0 ? -1 : 1;
  };
  G.hitBarrel = function (p, c, dmg) {
    if (c.dead) return;
    c.hp -= dmg || 1; c.hitAt = this.now;
    if (c.hp > 0) { this.emit('clang', { pid: p ? p.id : 0, x: c.x, y: this.coverRect(c).y0 + c.h * 0.4, hp: c.hp }); return; }
    this.explode(p, c);
  };
  G.explode = function (p, c) {
    if (c.dead) return;
    var self = this, B = C.barrel, R = this.coverRect(c), cx = c.x, cy = (R.y0 + R.y1) / 2;
    c.dead = true; c.hp = 0; c.respawnAt = this.now + B.respawnMs;
    if (p && this.scoring()) { p.barrels++; this.award(p, B.points); }
    this.emit('boom', { pid: p ? p.id : 0, x: cx, y: cy, r: B.blastRadius, cover: c.id, pts: this.scoring() ? B.points : 0, color: p ? p.color : '#fff' });
    this.targets.slice().forEach(function (t) {
      if (t.state === 'dead' || t.state === 'hidden') return;
      var TR = self.targetRect(t); if (TR.y1 <= TR.y0 && !t.rail) TR = { x0: TR.x0, x1: TR.x1, y0: t.top, y1: t.top + t.h };
      if (circleRect(cx, cy, B.blastRadius, TR)) { var k = self.killTarget(p, t, 'blast'); if (k > 0 && p && self.scoring()) self.award(p, B.blastPoints); }
    });
    this.covers.forEach(function (o) {                // chain reaction
      if (o !== c && !o.dead && o.kind === 'barrel' && circleRect(cx, cy, B.blastRadius, self.coverRect(o))) self.pending.push({ at: self.now + B.chainDelayMs, fn: function () { self.explode(p, o); } });
    });
    if (this.balloon && !this.balloon.popped && dist(cx, cy, this.balloon.x, this.balloon.y) < B.blastRadius + this.balloon.r) this.popBalloon(p);
    this.changed();
  };
  G.popBalloon = function (p) {
    var b = this.balloon; if (!b || b.popped) return;
    b.popped = true; b.poppedAt = this.now;
    if (p) { p.weapon = 'charger'; p.weaponUntil = this.now + C.weapons.powerupSec * 1000; p.charge = null; }
    this.emit('powerup', { pid: p ? p.id : 0, x: b.x, y: b.y, color: p ? p.color : '#fff' });
    this.changed();
  };
  G.swipe = function (p, dx, dy) {
    if (!p.hasAim || p.cal || !this.canShoot() || this.now < p.swipeUntil) return;
    var l = Math.sqrt(dx * dx + dy * dy); if (l < 1e-3) return;
    dx /= l; dy /= l; p.swipeUntil = this.now + C.swipe.cooldownMs;
    var s = C.swipe.speed;
    this.shots.push({ pid: p.id, x: p.cx, y: p.cy, vx: dx * s, vy: dy * s / AR * 1, born: this.now, hit: {}, left: C.swipe.pierce, color: p.color, trail: [] });
    if (this.scoring()) p.blasts++;
    this.emit('swipe', { pid: p.id, x: p.cx, y: p.cy, dx: dx, dy: dy, color: p.color });
  };

  // ------------------------------------------------------------------ round flow
  G.start = function () {
    if (!this.players.length) return false;
    var self = this;
    this.players.forEach(function (p) { self.resetStats(p); p.weapon = 'blaster'; p.charge = null; });
    this.round++; this.results = null;
    this.targets = []; this.shots = []; this.balloon = null; this.pending = [];
    this.covers.forEach(function (c) { c.dead = false; c.hp = c.kind === 'barrel' ? C.barrel.hp : 0; c.bornAt = self.now; });
    this.phase = 'countdown'; this.goAt = this.now + C.countdownSec * 1000; this.endsAt = this.goAt + C.roundSec * 1000;
    this.emit('countdown', {}); this.changed();
    return true;
  };
  G.toLobby = function () { this.phase = 'lobby'; this.results = null; this.targets = []; this.balloon = null; this.changed(); this.emit('lobby', {}); };
  G.finish = function () {
    var ps = this.players.slice().sort(function (a, b) { return b.score - a.score || b.hits - a.hits; });
    var place = 0, last = null;
    ps.forEach(function (p, i) { if (!last || p.score !== last.score) place = i + 1; p.place = place; last = p; });
    var acc = function (p) { return p.shotsFired ? p.hits / p.shotsFired : 0; };
    var awards = [];
    function best(fn, min) { var b = null; ps.forEach(function (p) { if (fn(p) >= (min || 1e-9) && (!b || fn(p) > fn(b))) b = p; }); return b; }
    if (ps.length > 1 || true) {
      var a1 = best(function (p) { return p.shotsFired >= 8 ? acc(p) : 0; }); if (a1) awards.push({ pid: a1.id, title: 'SHARPSHOOTER', text: Math.round(acc(a1) * 100) + '% accuracy' });
      var a2 = best(function (p) { return p.barrels; }); if (a2) awards.push({ pid: a2.id, title: 'DEMOLITION', text: a2.barrels + ' barrel' + (a2.barrels === 1 ? '' : 's') + ' blown up' });
      var a3 = best(function (p) { return p.bestStreak; }, 5); if (a3) awards.push({ pid: a3.id, title: 'ON FIRE', text: a3.bestStreak + ' hits in a row' });
      var a4 = best(function (p) { return p.golds; }); if (a4) awards.push({ pid: a4.id, title: 'GOLD DIGGER', text: a4.golds + ' gold target' + (a4.golds === 1 ? '' : 's') });
      var a5 = best(function (p) { return p.oops; }); if (a5) awards.push({ pid: a5.id, title: 'SORRY, GRANNY', text: 'hit ' + a5.oops + ' friendly cut-out' + (a5.oops === 1 ? '' : 's') });
    }
    this.results = { order: ps.map(function (p) { return { id: p.id, name: p.name, color: p.color, ink: p.ink, score: p.score, place: p.place, hits: p.hits, shots: p.shotsFired, acc: Math.round(acc(p) * 100), barrels: p.barrels, streak: p.bestStreak }; }), awards: awards };
    this.phase = 'over'; this.overAt = this.now;
    this.shots = [];
    this.emit('over', { winner: ps[0] ? ps[0].id : 0 }); this.changed();
  };
  G.timeLeft = function () { return this.phase === 'play' ? Math.max(0, this.endsAt - this.now) : this.phase === 'countdown' ? C.roundSec * 1000 : 0; };

  // ------------------------------------------------------------------ spawning
  G.freeCovers = function () {
    var self = this, busy = {};
    this.targets.forEach(function (t) { if (!t.rail) busy[t.cover.id] = 1; });
    return this.covers.filter(function (c) { return !c.dead && !busy[c.id] && self.now - c.bornAt > 900; });
  };
  G.spawn = function () {
    var free = this.freeCovers(); if (!free.length) return;
    var hasRail = this.targets.some(function (t) { return t.rail; });
    if (!hasRail && this.rnd() < 0.16) return this.spawnRail();
    var c = this.pick(free), type = this.pickType(), T = C.targets[type], R = this.coverRect(c), rs = this.rows[c.row].s;
    var small = type === 'gold', w = (small ? TGT.goldW : TGT.w) * rs, h = (small ? TGT.goldH : TGT.h) * rs;
    w = Math.min(w, c.w * 0.92);
    var xoff = c.kind === 'wall' ? this.r(-c.w * 0.28, c.w * 0.28) : 0;
    var t = { id: ++this.tid, type: type, row: c.row, cover: c, x: c.x + xoff, w: w, h: h, showH: h * 0.86,
      hideTop: R.y0 + 0.012, top: R.y0 + 0.012, state: 'rise', p: 0, at: this.now, upMs: this.r(T.upMs[0], T.upMs[1]) * (this.phase === 'lobby' ? 1.4 : 1), wob: this.rnd() * 6 };
    t.upTop = R.y0 - t.showH;
    this.targets.push(t);
    this.emit('up', { tid: t.id });
  };
  G.pickType = function () {
    var tot = 0, k, T = C.targets; for (k in T) tot += T[k].weight;
    var r = this.rnd() * tot; for (k in T) { r -= T[k].weight; if (r <= 0) return k; } return 'bullseye';
  };
  G.spawnRail = function () {
    var dir = this.rnd() < 0.5 ? 1 : -1, gold = this.rnd() < 0.25;
    var t = { id: ++this.tid, type: gold ? 'gold' : 'duck', rail: true, row: -1, x: dir > 0 ? -0.06 : 1.06, dir: dir, speed: this.r(0.13, 0.2) * (gold ? 1.4 : 1),
      w: gold ? TGT.goldW * 0.7 : TGT.duckW * 0.62, h: gold ? TGT.goldH * 0.55 : TGT.duckH * 0.62, state: 'up', p: 1, at: this.now };
    t.top = RAIL_Y - t.h;
    this.targets.push(t);
  };
  if (!C.targets.duck) C.targets.duck = { points: 120, upMs: [0, 0], weight: 0 };

  // ------------------------------------------------------------------ tick
  G.tick = function (now) {
    var dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0.016; this.lastNow = now; this.now = now;
    var self = this, i;
    if (this.phase === 'countdown' && now >= this.goAt) { this.phase = 'play'; this.nextSpawn = now + 300; this.nextBalloon = now + this.r(C.powerup.everyMs[0], C.powerup.everyMs[1]) * 0.6; this.emit('go', {}); this.changed(); }
    if (this.phase === 'play' && now >= this.endsAt) this.finish();
    // pending chain reactions
    if (this.pending.length) { var due = this.pending.filter(function (q) { return q.at <= now; }); this.pending = this.pending.filter(function (q) { return q.at > now; }); due.forEach(function (q) { q.fn(); }); }
    // cursors
    this.players.forEach(function (p) {
      if (!p.hasAim) return;
      p.cx = p.fx.filter(p.tx, dt); p.cy = p.fy.filter(p.ty, dt);
      if (p.charge && now - p.charge.start > 2600) self.release(p);         // lost the 'up' message: let it go
      if (p.weapon !== 'blaster' && now > p.weaponUntil) { p.weapon = 'blaster'; p.charge = null; self.emit('powerdown', { pid: p.id }); self.changed(); }
    });
    // barrels respawn
    this.covers.forEach(function (c) {
      if (!c.dead || now < c.respawnAt) return;
      var busy = self.targets.some(function (t) { return t.cover === c && t.state !== 'dead'; }); if (busy) return;
      c.dead = false; c.hp = C.barrel.hp; c.bornAt = now; self.emit('respawn', { cover: c.id }); self.changed();
    });
    // targets
    var popMs = C.popMs;
    for (i = this.targets.length - 1; i >= 0; i--) {
      var t = this.targets[i], age = now - t.at;
      if (t.rail) {
        if (t.state !== 'dead') { t.x += t.dir * t.speed * dt; if (t.x < -0.1 || t.x > 1.1) { this.targets.splice(i, 1); continue; } }
      } else {
        if (t.cover.dead && t.state !== 'dead') { t.state = 'dead'; t.deadAt = now; }
        if (t.state === 'rise') { t.p = Math.min(1, age / popMs); if (t.p >= 1) { t.state = 'up'; t.at = now; } }
        else if (t.state === 'up') { t.p = 1; if (age > t.upMs) { t.state = 'duck'; t.at = now; } }
        else if (t.state === 'duck') { t.p = Math.max(0, 1 - age / popMs); if (t.p <= 0) { this.targets.splice(i, 1); continue; } }
        var e = t.p < 1 ? 1 - Math.pow(1 - t.p, 2) : 1;
        if (t.state !== 'dead') t.top = t.hideTop + (t.upTop - t.hideTop) * e;
      }
      if (t.state === 'dead' && now - t.deadAt > 420) this.targets.splice(i, 1);
    }
    // swipe blasts
    for (i = this.shots.length - 1; i >= 0; i--) {
      var s = this.shots[i], pl = this.byId(s.pid);
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < -0.1 || s.x > 1.1 || s.y < -0.15 || s.y > 1.15 || s.left <= 0) { this.shots.splice(i, 1); continue; }
      var hitR = C.swipe.radius;
      if (this.balloon && !this.balloon.popped && dist(s.x, s.y, this.balloon.x, this.balloon.y) < this.balloon.r + hitR) this.popBalloon(pl);
      this.targets.slice().forEach(function (t) { if (!s.hit['t' + t.id] && s.left > 0 && self.hittable(t) && circleRect(s.x, s.y, hitR, self.targetRect(t))) { s.hit['t' + t.id] = 1; s.left--; self.killTarget(pl, t, 'swipe'); } });
      this.covers.forEach(function (c) { if (!s.hit['c' + c.id] && s.left > 0 && !c.dead && c.kind === 'barrel' && circleRect(s.x, s.y, hitR * 0.6, self.coverRect(c))) { s.hit['c' + c.id] = 1; s.left--; self.hitBarrel(pl, c, 1); } });
    }
    // balloon
    var b = this.balloon;
    if (b) { if (b.popped) { if (now - b.poppedAt > 600) this.balloon = null; } else { b.x += b.dir * C.powerup.speed * dt; b.y = b.y0 + Math.sin((now - b.at) / 600) * 0.025; if (b.x < -0.1 || b.x > 1.1) this.balloon = null; } }
    // spawning
    var live = this.phase === 'play' || this.phase === 'lobby' || this.phase === 'over';
    if (live && now >= this.nextSpawn) {
      var up = this.targets.filter(function (t) { return t.state !== 'dead'; }).length, maxUp = C.spawn.maxUp, gap = C.spawn.everyMs;
      if (this.phase === 'play') { var prog = 1 - this.timeLeft() / (C.roundSec * 1000); maxUp = Math.round(C.spawn.maxUp + (C.spawn.rampTo - C.spawn.maxUp) * prog); }
      else { maxUp = 3; }
      if (up < maxUp) this.spawn();
      var slow = this.phase === 'play' ? 1 : 2.2;
      this.nextSpawn = now + this.r(gap[0], gap[1]) * slow;
    }
    if (this.phase === 'play' && !this.balloon && now >= this.nextBalloon) {
      var dir = this.rnd() < 0.5 ? 1 : -1, y0 = this.r(0.16, 0.26);
      this.balloon = { x: dir > 0 ? -0.05 : 1.05, y: y0, y0: y0, dir: dir, r: 0.026, at: now, popped: false, color: this.pick(['#ff4fd8', '#3fd0ff', '#ffd23f']) };
      this.nextBalloon = now + this.r(C.powerup.everyMs[0], C.powerup.everyMs[1]);
    }
  };

  Game.dist = dist; Game.AR = AR; Game.clamp = clamp;
  root.LRGame = Game;
})(typeof window !== 'undefined' ? window : globalThis);
