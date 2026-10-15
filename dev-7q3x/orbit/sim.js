/* ORBIT BRAWL v0.1 - shared sim (host only: TV, or the phone that hosts). Ships fly in a sphere arena with asteroids.
   Ship forward is -Z (same as glTF / a Blender pod with its nose on +Y). Units ~ metres; a pod is about 4 m. */
(function (root) {
  'use strict';
  var T = root.THREE, V = function (x, y, z) { return new T.Vector3(x || 0, y || 0, z || 0); };
  var C = { R: 420, SPEED: 46, STRAFE: 30, BOOSTDRAG: 1.6, TURN: 1.9, SHIELD: 100, HULL: 100, BUL: 230, BLIFE: 1.1, RATE: 0.09, DMG: 7,
    BOMB_MAX: 1.6, RESPAWN: 3, ROUND: 180, SHIP_R: 2.6, FILL: 8, MAX: 20 };
  var COLS = ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f', '#c77dff', '#ff9f43', '#4ef0e0', '#ff7fd0', '#b8ff5a', '#ffffff'];
  var BOTN = ['Vex', 'Nyx', 'Orrin', 'Kestra', 'Juno', 'Rook', 'Talon', 'Pip', 'Zed', 'Mira', 'Quill', 'Sable', 'Dax', 'Lumo', 'Echo', 'Fen', 'Brix', 'Ivo', 'Wren', 'Cass'];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function randDir() { var v = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); return v.lengthSq() < 1e-4 ? V(0, 0, 1) : v.normalize(); }
  // seeded asteroids so every screen builds the same field from one seed
  function rng(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function field(seed) { var r = rng(seed || 7), out = [];
    for (var i = 0; i < 46; i++) { var d = V(r() * 2 - 1, (r() * 2 - 1) * .7, r() * 2 - 1); if (d.length() < .15) continue; d.multiplyScalar(C.R * .85); out.push({ x: d.x, y: d.y, z: d.z, r: 6 + Math.pow(r(), 2.2) * 30, s: (r() * 1e6) | 0 }); }
    return out; }
  function Sim(seed) {
    this.seed = seed || ((Math.random() * 1e6) | 0); this.rocks = field(this.seed); this.ships = []; this.bul = []; this.bombs = []; this.fx = []; this.feed = []; this.t = 0; this.time = C.ROUND; this.over = false; this.nid = 1; this.ev = [];
  }
  Sim.prototype.free = function () { for (var k = 0; k < 40; k++) { var p = randDir().multiplyScalar(rnd(60, C.R * .8)), ok = true;
      this.rocks.forEach(function (a) { if (p.distanceTo(V(a.x, a.y, a.z)) < a.r + 14) ok = false; }); if (ok) return p; } return V(0, 0, 0); };
  Sim.prototype.add = function (o) {
    var used = this.ships.map(function (s) { return s.col; }), col = COLS.filter(function (c) { return used.indexOf(c) < 0; })[0] || COLS[this.ships.length % COLS.length];
    var s = { id: this.nid++, key: o.key || null, name: o.name || 'Pilot', bot: !!o.bot, col: col, p: V(), v: V(), q: new T.Quaternion(), inp: { tx: 0, tz: 0, p: 0, y: 0, r: 0, fire: false },
      sh: C.SHIELD, hull: C.HULL, alive: true, dead: 0, cd: 0, hitT: 9, k: 0, d: 0, charge: 0, last: null };
    this.spawn(s); this.ships.push(s); return s;
  };
  Sim.prototype.remove = function (s) { this.ships = this.ships.filter(function (x) { return x !== s; }); };
  Sim.prototype.spawn = function (s) { s.p.copy(this.free()); s.v.set(0, 0, 0); var m = new T.Matrix4().lookAt(s.p, V(0, 0, 0), V(0, 1, 0)); s.q.setFromRotationMatrix(m); s.sh = C.SHIELD; s.hull = C.HULL; s.alive = true; s.hitT = 9; s.spawnT = this.t; };
  // keep 'fill' ships in play: bots join/leave as people come and go
  Sim.prototype.fill = function (n) { var hum = this.ships.filter(function (s) { return !s.bot; }).length, bots = this.ships.filter(function (s) { return s.bot; }), want = Math.max(0, Math.min(C.MAX, n) - hum);
    while (bots.length > want) this.remove(bots.pop());
    while (bots.length < want) { var nm = BOTN.filter(function (n) { return !this.ships.some(function (s) { return s.name === n; }); }, this)[0] || 'Bot'; bots.push(this.add({ name: nm, bot: true })); } };
  Sim.prototype.fwd = function (s) { return V(0, 0, -1).applyQuaternion(s.q); };
  Sim.prototype.damage = function (s, n, by, kind) {
    if (!s.alive || this.t - s.spawnT < 1.5) return; var shield = s.sh > 0; s.sh -= n; if (s.sh < 0) { s.hull += s.sh; s.sh = 0; } s.hitT = 0;
    this.ev.push({ e: 'hit', id: s.id, sh: shield ? 1 : 0, by: by ? by.id : 0 });
    if (s.hull <= 0) { s.alive = false; s.dead = C.RESPAWN; s.d++; if (by && by !== s) by.k++;
      this.fx.push({ k: 'boom', x: s.p.x, y: s.p.y, z: s.p.z, r: 10, t: 0, life: 1.2, col: s.col });
      this.ev.push({ e: 'kill', id: s.id, by: by ? by.id : 0, kind: kind });
      this.feed.unshift({ a: by && by !== s ? by.name : '', ac: by ? by.col : '#fff', b: s.name, bc: s.col, kind: kind, t: this.t }); this.feed.length = Math.min(this.feed.length, 5); }
  };
  Sim.prototype.bomb = function (s, c) { if (!s.alive) return; c = Math.max(0, Math.min(1, c)); var f = this.fwd(s);
    this.bombs.push({ id: this.nid++, o: s, p: s.p.clone().addScaledVector(f, 5), v: s.v.clone().addScaledVector(f, 55 + 95 * c), c: c, t: 0, fuse: 2.4 });
    this.ev.push({ e: 'throw', id: s.id }); };
  Sim.prototype.bot = function (s, dt) {
    var me = this, best = null, bd = 1e9, f = this.fwd(s);
    this.ships.forEach(function (o) { if (o === s || !o.alive) return; var d = o.p.distanceTo(s.p) * (o.bot ? 1 : .8); if (d < bd) { bd = d; best = o; } });
    if (!s.bt || this.t > s.btT) { s.btT = this.t + rnd(5, 9); s.bt = best; s.skill = s.skill || rnd(.55, .9); s.wob = randDir(); }
    var tg = s.bt && s.bt.alive ? s.bt : best, aim = V(); if (!tg) { aim.copy(s.p).negate(); }
    else { var d = tg.p.distanceTo(s.p); aim.copy(tg.p).addScaledVector(tg.v, d / C.BUL * s.skill).sub(s.p).addScaledVector(s.wob, d * .12 * (1 - s.skill)); }
    // dodge rocks + bounds
    this.rocks.forEach(function (a) { var ap = V(a.x, a.y, a.z), d = ap.distanceTo(s.p) - a.r; if (d < 30) aim.addScaledVector(s.p.clone().sub(ap).normalize(), (30 - d) * 6); });
    if (s.p.length() > C.R * .85) aim.addScaledVector(s.p, -2);
    var loc = aim.clone().normalize().applyQuaternion(s.q.clone().invert());   // in ship frame
    var ang = Math.acos(Math.max(-1, Math.min(1, -loc.z)));
    s.inp.y = Math.max(-1, Math.min(1, -loc.x * 3)); s.inp.p = Math.max(-1, Math.min(1, loc.y * 3)); s.inp.r = 0;
    var dist = tg ? tg.p.distanceTo(s.p) : 999;
    s.inp.tz = dist < 25 ? -.4 : ang > 1.2 ? .35 : 1; s.inp.tx = Math.sin(this.t * .7 + s.id) * .5;
    s.inp.fire = !!tg && ang < .09 && dist < 210 && Math.random() < s.skill + .1;
    if (tg && dist > 45 && dist < 130 && ang < .15 && Math.random() < dt * .12) this.bomb(s, rnd(.2, .9));
  };
  Sim.prototype.step = function (dt) {
    var me = this; this.t += dt; if (!this.over) { this.time -= dt; if (this.time <= 0) { this.time = 0; this.over = true; this.ev.push({ e: 'over' }); } }
    var qd = new T.Quaternion(), e = new T.Euler();
    this.ships.forEach(function (s) {
      if (!s.alive) { s.dead -= dt; if (s.dead <= 0 && !me.over) me.spawn(s); return; }
      if (s.bot) me.bot(s, dt);
      var I = s.inp; s.hitT += dt;
      if (!s.bot && s.hitT > 3 && s.sh < C.SHIELD) s.sh = Math.min(C.SHIELD, s.sh + 22 * dt); if (s.bot && s.hitT > 4) s.sh = Math.min(C.SHIELD, s.sh + 15 * dt);
      e.set(I.p * C.TURN * .8 * dt, I.y * C.TURN * dt, (I.r * 2.2 - I.y * .35) * dt, 'XYZ'); qd.setFromEuler(e); s.q.multiply(qd).normalize();
      var want = V(I.tx * C.STRAFE, 0, -(I.tz >= 0 ? I.tz * C.SPEED + 8 : I.tz * C.SPEED * .5)).applyQuaternion(s.q);
      s.v.lerp(want, 1 - Math.exp(-C.BOOSTDRAG * dt)); s.p.addScaledVector(s.v, dt);
      // bounds: soft push back
      var L = s.p.length(); if (L > C.R) { s.v.addScaledVector(s.p, -(L - C.R) * .08 * dt * 10 / L); if (L > C.R + 60) s.p.multiplyScalar((C.R + 60) / L); }
      me.rocks.forEach(function (a) { var dx = s.p.x - a.x, dy = s.p.y - a.y, dz = s.p.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), m = a.r + C.SHIP_R;
        if (d < m) { var n = V(dx, dy, dz).divideScalar(d || 1), vn = s.v.dot(n); s.p.copy(V(a.x, a.y, a.z).addScaledVector(n, m)); if (vn < 0) { s.v.addScaledVector(n, -vn * 1.6); if (-vn > 12) me.damage(s, -vn * .9, null, 'rock'); } } });
      s.cd -= dt; if (I.fire && s.cd <= 0) { s.cd = C.RATE; var f = me.fwd(s), side = (s.gs = -(s.gs || 1)) * 1.1, r = V(1, 0, 0).applyQuaternion(s.q);
        // light aim assist: bend toward an enemy inside ~5 degrees
        var best = null, bc = .996; me.ships.forEach(function (o) { if (o === s || !o.alive) return; var to = o.p.clone().sub(s.p), d = to.length(); if (d > 260) return; var c = to.divideScalar(d).dot(f); if (c > bc) { bc = c; best = o; } });
        var dir = f.clone(); if (best) { var d2 = best.p.distanceTo(s.p); dir = best.p.clone().addScaledVector(best.v, d2 / C.BUL).sub(s.p).normalize(); }
        var p0 = s.p.clone().addScaledVector(r, side).addScaledVector(f, 3);
        me.bul.push({ o: s, p: p0, v: dir.multiplyScalar(C.BUL).add(s.v), t: 0 }); me.ev.push({ e: 'fire', id: s.id }); }
    });
    // bullets (swept test against ships + rocks)
    var seg = V(), tmp = V();
    this.bul = this.bul.filter(function (b) { b.t += dt; if (b.t > C.BLIFE) return false; seg.copy(b.v).multiplyScalar(dt); var len = seg.length(); seg.divideScalar(len);
      for (var i = 0; i < me.ships.length; i++) { var s = me.ships[i]; if (s === b.o || !s.alive) continue; tmp.copy(s.p).sub(b.p); var u = Math.max(0, Math.min(len, tmp.dot(seg))); if (tmp.addScaledVector(seg, -u).lengthSq() < 9) { me.damage(s, C.DMG, b.o, 'gun'); me.fx.push({ k: 'spark', x: s.p.x, y: s.p.y, z: s.p.z, r: 3, t: 0, life: .25, col: s.sh > 0 ? '#7fd8ff' : '#ffb347' }); return false; } }
      b.p.addScaledVector(seg, len);
      for (var j = 0; j < me.rocks.length; j++) { var a = me.rocks[j], dx = b.p.x - a.x, dy = b.p.y - a.y, dz = b.p.z - a.z; if (dx * dx + dy * dy + dz * dz < a.r * a.r) return false; }
      return true; });
    this.bombs = this.bombs.filter(function (b) { b.t += dt; b.p.addScaledVector(b.v, dt); var go = b.t > b.fuse;
      if (b.t > .35) me.ships.forEach(function (s) { if (s !== b.o && s.alive && s.p.distanceTo(b.p) < 7) go = true; });
      me.rocks.forEach(function (a) { if (b.p.distanceTo(V(a.x, a.y, a.z)) < a.r) go = true; });
      if (!go) return true;
      var R = 16 + 18 * b.c, hits = 0, kills = 0; me.fx.push({ k: 'bomb', x: b.p.x, y: b.p.y, z: b.p.z, r: R, t: 0, life: 1.1, col: '#ffd27a' });
      me.ships.forEach(function (s) { if (!s.alive) return; var d = s.p.distanceTo(b.p); if (d > R) return; var was = s.alive; me.damage(s, (55 + 70 * b.c) * (1 - d / R * .6), b.o, 'bomb'); if (s !== b.o) { hits++; if (was && !s.alive) kills++; }
        s.v.addScaledVector(s.p.clone().sub(b.p).normalize(), 40 * (1 - d / R)); });
      me.ev.push({ e: 'boom', id: b.o.id, x: b.p.x, y: b.p.y, z: b.p.z, r: R, hits: hits, kills: kills });
      return false; });
    this.fx = this.fx.filter(function (f) { f.t += dt; return f.t < f.life; });
  };
  // compact network snapshot (rounded) - phones and the TV draw from this
  function r1(x) { return Math.round(x * 10) / 10; } function r3(x) { return Math.round(x * 1000) / 1000; }
  Sim.prototype.snap = function () { var me = this; return { t: 's', T: r1(this.t), tm: Math.ceil(this.time), ov: this.over ? 1 : 0, seed: this.seed,
    s: this.ships.map(function (s) { return [s.id, r1(s.p.x), r1(s.p.y), r1(s.p.z), r3(s.q.x), r3(s.q.y), r3(s.q.z), r3(s.q.w), Math.round(s.sh), Math.round(s.hull), s.alive ? 1 : 0, s.k, s.d, s.hitT < .25 ? 1 : 0, r1(s.v.x), r1(s.v.y), r1(s.v.z), s.bot ? 1 : 0]; }),
    n: this.ships.map(function (s) { return [s.id, s.name, s.col]; }),
    b: this.bul.map(function (b) { return [r1(b.p.x), r1(b.p.y), r1(b.p.z), r1(b.v.x), r1(b.v.y), r1(b.v.z)]; }),
    m: this.bombs.map(function (b) { return [r1(b.p.x), r1(b.p.y), r1(b.p.z), r1(b.c)]; }),
    f: this.fx.map(function (f) { return [f.k, r1(f.x), r1(f.y), r1(f.z), f.r, r1(f.t), f.life, f.col]; }),
    k: this.feed.slice(0, 4) }; };
  root.Orbit = { Sim: Sim, C: C, field: field, COLS: COLS };
})(window);
