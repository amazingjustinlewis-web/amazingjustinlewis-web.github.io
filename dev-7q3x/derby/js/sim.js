/* DEMOLITION DERBY - arcade sim (no rendering). TV is the authority.
   World: x,y on the floor (arena centre 0,0), z up. Heading a: 0 = +y, car forward = (sin a, cos a). */
(function (root) {
  'use strict';
  var C = root.DD_CONFIG, A = C.arena, P = C.phys;
  var D2R = Math.PI / 180;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function carType(id) { for (var i = 0; i < C.cars.length; i++) if (C.cars[i].id === id) return C.cars[i]; return C.cars[0]; }
  function ground(x, y) { var r = Math.sqrt(x * x + y * y); return r < A.moundR ? A.moundH * (1 - r / A.moundR) : 0; }
  // is there a wall at polar angle (deg, measured atan2(x,y))? gate counts as open when gateOpen
  function wallAt(deg, gateOpen) {
    deg = ((deg % 360) + 360) % 360;
    for (var i = 0; i < A.walls.length; i++) {
      var w = A.walls[i], a0 = ((w[0] % 360) + 360) % 360, span = w[1] - w[0], d = ((deg - a0) % 360 + 360) % 360;
      if (d <= span) { if (gateOpen && Math.abs(wrap((deg - A.gateAt) * D2R)) < (A.gateW / 2) * D2R) return false; return true; }
    }
    return false;
  }

  function Sim() { this.R = A.R; this.stage = 0; this.cars = []; this.t = 0; this.gate = { open: 0, timer: A.gateEverySec, queue: [] }; this.events = []; }
  Sim.prototype.addCar = function (o) {
    var T = carType(o.type), arm = o.armour || { front: 'none', side: 'none', back: 'none' };
    var AR = C.armour, spd = AR[arm.front].spd * AR[arm.side].spd * AR[arm.side].spd * AR[arm.back].spd;
    var mass = T.mass + C.armour[arm.front].mass + C.armour[arm.side].mass * 2 + C.armour[arm.back].mass;
    var hpMul = 1;
    var c = { id: o.id, name: o.name, color: o.color, ai: !!o.ai, type: T.id, T: T, armour: arm, boostType: o.boost || 'ram',
      mass: mass, spdMul: spd, bRate: Math.pow(1.15, ['front', 'side', 'side', 'back'].filter(function (k) { return arm[k] === 'none'; }).length), maxhp: Math.round(T.hp * hpMul), hp: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, a: 0, air: false,
      lives: C.lives, alive: false, state: 'wait', fall: 0, inp: { steer: 0, thr: 0, boost: false, abs: null },
      boost: 1, boostT: 0, cd: 0, lastHit: null, lastHitT: -99, airT: 0, hitCd: {},
      st: { dmg: 0, taken: 0, kos: 0, ringouts: 0, crushes: 0, air: 0, wins: 0, place: 0, survived: 0 } };
    this.cars.push(c); return c;
  };
  Sim.prototype.spawnAll = function () {
    var n = this.cars.length, self = this; this.gate = { open: 0, timer: A.gateEverySec, queue: [] };
    this.cars.forEach(function (c, i) {
      var ang = (i / n) * Math.PI * 2 + 0.3, r = A.R * 0.62;
      c.x = Math.sin(ang) * r; c.y = Math.cos(ang) * r; c.z = 0; c.vx = c.vy = c.vz = 0; c.a = ang + Math.PI;
      c.hp = c.maxhp; c.alive = true; c.state = 'drive'; c.lives = C.lives; c.boost = 1; c.cd = 0; c.boostT = 0; c.fall = 0; c.lastHit = null; c.air = false; c.placeT = 0;
    });
    this.out = []; this.t = 0; this.R = A.R; this.stage = 0; this.n0 = n; this.shr = null; this.stageT = 0;
  };
  Sim.prototype.ev = function (e) { this.events.push(e); };
  Sim.prototype.knockout = function (c, how) {
    if (c.state !== 'drive' && c.state !== 'fall') return;
    var killer = c.lastHit && this.t - c.lastHitT < 5 ? this.byId(c.lastHit) : null;
    if (killer && killer !== c) { killer.st.kos++; if (how === 'ringout') killer.st.ringouts++; }
    c.lives--; c.alive = false; if (c.air) { c.st.air += this.t - c.airStart; c.air = false; } c.hp = 0;
    this.ev({ k: 'ko', id: c.id, by: killer ? killer.id : null, how: how, x: c.x, y: c.y, z: c.z, lives: c.lives });
    if (c.lives > 0) { c.state = 'wait'; this.gate.queue.push(c.id); } else { c.state = 'out'; this.out.push(c.id); c.st.survived = this.t; }
  };
  Sim.prototype.byId = function (id) { for (var i = 0; i < this.cars.length; i++) if (this.cars[i].id === id) return this.cars[i]; return null; };
  Sim.prototype.living = function () { return this.cars.filter(function (c) { return c.state === 'drive' || c.state === 'wait' || c.state === 'fall' || c.state === 'enter'; }); };

  Sim.prototype.damage = function (c, amt, from, side) {
    if (amt <= 0.5 || c.state !== 'drive') return 0;
    amt = Math.min(amt, c.hp + 0.01); c.hp -= amt; c.st.taken += amt;
    if (from) { from.st.dmg += amt; c.lastHit = from.id; c.lastHitT = this.t; }
    this.ev({ k: 'hit', id: c.id, by: from ? from.id : null, amt: amt, side: side, x: c.x, y: c.y, z: c.z });
    if (c.hp <= 0) this.knockout(c, 'wreck');
    return amt;
  };
  function sideOf(c, nx, ny) {     // which side of car c faces direction (nx,ny)
    var fx = Math.sin(c.a), fy = Math.cos(c.a), d = fx * nx + fy * ny;
    return d > 0.7 ? 'front' : d < -0.7 ? 'back' : 'side';
  }
  function armSide(c, s) { return s === 'front' ? c.armour.front : s === 'back' ? c.armour.back : c.armour.side; }
  function boostDmg(c) { var B = C.boosts[c.boostType]; return c.boostT > 0 ? B.dmg : 1; }

  Sim.prototype.step = function (dt) {
    var self = this, cars = this.cars; this.t += dt;
    // v0.2.1 shrinking arena: warn, then the outer ring sinks and its edge becomes drop-off
    var SR = A.shrinkR; this.stageT += dt;
    if (!this.shr && this.stage < SR.length - 1) { var liv = this.living().length, frac = liv / Math.max(2, this.n0), want = frac <= 0.34 || liv <= 2 ? 3 : frac <= 0.5 ? 2 : frac <= 0.75 ? 1 : 0;
      if (want > this.stage || this.stageT > A.stageMaxSec) { this.shr = { from: SR[this.stage], to: SR[this.stage + 1], t: 0 }; this.ev({ k: 'shrinkwarn', stage: this.stage + 1 }); } }
    if (this.shr) { var sh = this.shr; sh.t += dt; var u = clamp((sh.t - A.warnSec) / A.sinkSec, 0, 1); u = u * u * (3 - 2 * u); this.R = sh.from + (sh.to - sh.from) * u;
      if (sh.t >= A.warnSec + A.sinkSec) { this.stage++; this.R = sh.to; this.shr = null; this.stageT = 0; this.ev({ k: 'shrunk', stage: this.stage }); } }
    // gate: opens every gateEverySec while someone is waiting to come in
    var g = this.gate;
    if (g.open > 0) { g.open -= dt; }
    else if (g.queue.length) { g.timer -= dt; if (g.timer <= 0) { g.open = A.gateOpenSec; g.timer = A.gateEverySec; this.ev({ k: 'gate' }); g.entering = g.queue.splice(0, 3); g.entering.forEach(function (id, j) {
      var c = self.byId(id), ga = A.gateAt * D2R, r = self.R + 4 + j * 6; c.x = Math.sin(ga) * r; c.y = Math.cos(ga) * r; c.z = 0; c.a = ga + Math.PI; c.vx = -Math.sin(ga) * 14; c.vy = -Math.cos(ga) * 14; c.vz = 0;
      c.hp = c.maxhp; c.state = 'enter'; c.air = false; c.lastUp = 0; c.alive = true; c.boost = 1; c.fall = 0; }); } }
    cars.forEach(function (c) {
      if (c.state === 'enter') {     // rolls in through the gate on rails
        c.x += c.vx * dt; c.y += c.vy * dt; if (Math.sqrt(c.x * c.x + c.y * c.y) < self.R - 5) { c.state = 'drive'; c.spawnSafe = 1.5; self.ev({ k: 'enter', id: c.id }); } return;
      }
      if (c.state === 'fall') { c.vz -= P.grav * dt; c.z += c.vz * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.spin * dt; if (c.z < -18) self.knockout(c, 'ringout'); return; }
      if (c.state !== 'drive') return;
      if (c.spawnSafe > 0) c.spawnSafe -= dt;
      var T = c.T, B = C.boosts[c.boostType], inp = c.inp;
      var fx = Math.sin(c.a), fy = Math.cos(c.a), fwd = c.vx * fx + c.vy * fy;
      // absolute (joystick) input -> steer + throttle
      var steer = inp.steer, thr = inp.thr;
      if (inp.abs) { var m = Math.min(1, Math.hypot(inp.abs[0], inp.abs[1])); if (m > 0.15) { var ta = Math.atan2(inp.abs[0], inp.abs[1]), d = wrap(ta - c.a);
        if (Math.abs(d) > 2.4 && fwd < 4) { thr = -m; steer = clamp(-wrap(ta + Math.PI - c.a) * 2.5, -1, 1); } else { thr = m * (Math.abs(d) > 1.6 ? 0.4 : 1); steer = clamp(d * 2.5, -1, 1); } } else { thr = 0; steer = 0; } }
      // boost
      var mul = 1;
      if (c.boostType === 'sustain') { if (inp.boost && c.boost > 0.02) { c.boostT = 0.1; c.boost = Math.max(0, c.boost - dt / B.dur); mul = B.mul; thr = Math.max(thr, 1); } else { c.boostT = 0; c.boost = Math.min(1, c.boost + dt * c.bRate * B.regen / B.dur * 3); } }
      else {
        if (c.cd > 0) c.cd -= dt * c.bRate; c.boost = c.cd > 0 ? 1 - c.cd / B.cd : 1;
        if (inp.boost && c.cd <= 0) { c.cd = B.cd; if (c.boostType === 'dash') { c.vx += fx * B.kick; c.vy += fy * B.kick; c.boostT = 0.35; if (!c.air) { c.air = true; c.airStart = self.t; c.vz = B.hop; c.z += 0.05; } } else c.boostT = B.dur; self.ev({ k: 'boost', id: c.id, b: c.boostType }); inp.boost = false; }
        if (c.boostT > 0) { c.boostT -= dt; if (c.boostType === 'ram') { mul = B.mul; thr = 1; } }
      }
      var top = T.speed * c.spdMul * (mul > 1 ? 1 + (mul - 1) * 0.5 : 1);
      if (!c.air) {
        c.thrS = c.thrS || 0; if (thr > c.thrS) c.thrS = Math.min(thr, c.thrS + dt / A.thrRampSec); else c.thrS = thr;   // v0.2.1: gas ramps in gradually
        var thrE = thr > 0 ? c.thrS : thr, acc = T.accel * mul * thrE * (thr > 0 ? 0.55 + 0.45 * clamp(1 - fwd / Math.max(1, top), 0, 1) : 1); if (thr < 0) acc *= 0.6;
        if ((thr > 0 && fwd < top) || (thr < 0 && fwd > -top * 0.5)) { c.vx += fx * acc * dt; c.vy += fy * acc * dt; }
        var sp = Math.hypot(c.vx, c.vy), turn = T.turn * clamp(Math.abs(fwd) / 6, 0, 1) * (fwd < 0 ? -1 : 1);
        c.a = wrap(c.a + steer * turn * dt * (c.boostT > 0 && c.boostType === 'ram' ? 0.6 : 1));
        // grip: kill sideways slide
        fx = Math.sin(c.a); fy = Math.cos(c.a); fwd = c.vx * fx + c.vy * fy;
        var lat = c.vx * fy - c.vy * fx, keep = Math.pow(1 - T.grip, dt * 6);
        lat *= keep; fwd *= thr === 0 ? Math.pow(0.35, dt) : Math.pow(0.85, dt);
        c.vx = fx * fwd + fy * lat; c.vy = fy * fwd - fx * lat;
        if (sp > top * 1.6) { c.vx *= top * 1.6 / sp; c.vy *= top * 1.6 / sp; }
      }
      // vertical: follow the mound, launch off its crest
      var g0 = ground(c.x, c.y);
      c.x += c.vx * dt; c.y += c.vy * dt;
      var g1 = ground(c.x, c.y);
      if (!c.air) { var vzG = (g1 - g0) / dt; c.z = g1;
        if (g1 < g0 && c.lastUp > 2.5) { c.air = true; c.airStart = self.t; c.vz = c.lastUp; c.z = g0; self.ev({ k: 'jump', id: c.id }); }
        else { c.lastUp = Math.max(0, vzG); c.vz = 0; } }
      else { c.vz -= P.grav * dt; c.z += c.vz * dt; if (c.z <= g1) { var hard = -c.vz; c.z = g1; c.vz = 0; c.air = false; c.st.air += self.t - c.airStart; self.ev({ k: 'land', id: c.id, s: hard, x: c.x, y: c.y }); } }
      // ring-out / walls
      var r = Math.hypot(c.x, c.y);
      if (r > self.R - 1.4) {
        var deg = Math.atan2(c.x, c.y) / D2R, nx = c.x / r, ny = c.y / r;
        if (wallAt(deg, g.open > 0) && c.z < A.wallH + 0.5) {
          var vn = c.vx * nx + c.vy * ny;
          if (vn > 0) { c.vx -= (1 + P.wallBounce) * vn * nx; c.vy -= (1 + P.wallBounce) * vn * ny; var s = sideOf(c, nx, ny); if (vn > P.minHit + 4) self.damage(c, (vn - P.minHit - 4) * 0.8 * C.sideMul[s] * C.armour[armSide(c, s)].take, null, s); self.ev({ k: 'wall', id: c.id, s: vn, x: c.x, y: c.y }); }
          c.x = nx * (self.R - 1.4); c.y = ny * (self.R - 1.4);
        } else if (r > self.R + 0.6) { c.state = 'fall'; c.vz = Math.min(c.vz, 0); c.spin = (Math.random() - 0.5) * 4; self.ev({ k: 'fall', id: c.id, x: c.x, y: c.y }); }
      }
    });
    // car vs car
    for (var i = 0; i < cars.length; i++) for (var j = i + 1; j < cars.length; j++) {
      var a = cars[i], b = cars[j]; if (a.state !== 'drive' || b.state !== 'drive') continue;
      var dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), rad = (a.T.size[1] + b.T.size[1]) * 0.36 + (a.T.size[0] + b.T.size[0]) * 0.12;
      if (dist >= rad || dist < 1e-4) continue;
      var dz = a.z - b.z;
      var nx = dx / dist, ny = dy / dist;
      // landing on top: the falling one crushes the lower one
      if (Math.abs(dz) > 0.9) {
        var top = dz > 0 ? a : b, low = dz > 0 ? b : a;
        if (top.air && top.vz < -2) { var key = top.id + '>' + low.id; if (!(self.t < (top.hitCd[key] || 0))) { top.hitCd[key] = self.t + 0.8;
          var dmg = P.crushDmg * (0.6 + top.mass * 0.5) * Math.min(1.6, -top.vz / 10);
          self.damage(low, dmg, top, 'roof'); top.st.crushes++; top.vz = 7; low.vx *= 0.3; low.vy *= 0.3; self.ev({ k: 'crush', id: low.id, by: top.id, x: low.x, y: low.y }); } }
        continue;
      }
      var ma = a.mass * (a.boostT > 0 && a.boostType === 'ram' ? C.boosts.ram.massMul : 1), mb = b.mass * (b.boostT > 0 && b.boostType === 'ram' ? C.boosts.ram.massMul : 1);
      var over = rad - dist, mt = ma + mb;
      a.x -= nx * over * mb / mt; a.y -= ny * over * mb / mt; b.x += nx * over * ma / mt; b.y += ny * over * ma / mt;
      var rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;   // < 0 = closing
      if (rvn >= 0) continue;
      var jimp = -(1 + P.carBounce) * rvn / (1 / ma + 1 / mb), sa = sideOf(a, nx, ny), sb = sideOf(b, -nx, -ny), ka = C.armour[armSide(a, sa)].push, kb = C.armour[armSide(b, sb)].push;
      a.vx -= jimp * nx / ma * ka; a.vy -= jimp * ny / ma * ka; b.vx += jimp * nx / mb * kb; b.vy += jimp * ny / mb * kb;
      var hit = -rvn; if (hit < P.minHit) {   // slow contact: spikes still grind
        var gk = a.id + '~' + b.id; if (!(self.t < (a.hitCd[gk] || 0))) { a.hitCd[gk] = self.t + 0.5;
          if (C.armour[armSide(a, sa)].grind) self.damage(b, C.armour[armSide(a, sa)].grind * C.armour[armSide(b, sb)].take, a, sb);
          if (C.armour[armSide(b, sb)].grind) self.damage(a, C.armour[armSide(b, sb)].grind * C.armour[armSide(a, sa)].take, b, sa); }
        self.ev({ k: 'bump', id: a.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); continue; }
      // who drove into whom: the faster one along the normal is the attacker (deals more, takes less)
      var aIn = a.vx * nx + a.vy * ny, bIn = -(b.vx * nx + b.vy * ny);
      var base = (hit - P.minHit) * P.dmgScale * 2.2;
      function deal(v, tgt, sv, sAtt, att, push) {
        var arm = C.armour[armSide(tgt, sv)], spikes = C.armour[armSide(att, sAtt)].deal * (hit / 15);
        var d = base * C.sideMul[sv] * arm.take * (0.6 + 0.4 * att.mass / tgt.mass) * boostDmg(att) * push + spikes * arm.take;
        if (tgt.spawnSafe > 0) d *= 0.3; return self.damage(tgt, d, att, sv);
      }
      var tot = Math.max(0.1, Math.abs(aIn) + Math.abs(bIn)), pa = clamp(aIn / tot, 0, 1), pb = clamp(bIn / tot, 0, 1);
      deal(0, b, sb, sa, a, 0.4 + pa * 0.9); deal(0, a, sa, sb, b, 0.4 + pb * 0.9);
      var spk = C.armour[armSide(a, sa)].deal > 0 || C.armour[armSide(b, sb)].deal > 0, pl = armSide(a, sa) === 'plate' || armSide(b, sb) === 'plate';
      self.ev({ k: 'smash', a: a.id, b: b.id, s: hit, spk: spk, pl: pl, ram: (a.boostT > 0 && a.boostType === 'ram') || (b.boostT > 0 && b.boostType === 'ram'), ca: a.color, cb: b.color, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  };
  // ---------------------------------------------------------------- AI driver
  Sim.prototype.think = function (c, dt) {
    if (c.state !== 'drive') return;
    c.aiT = (c.aiT || 0) - dt;
    var self = this, best = null, bd = 1e9, B = C.boosts[c.boostType], ER = this.shr ? this.shr.to : this.R;   // AI plans for the edge that is coming
    // pick a target: close, weakened, and ideally near an open drop-off (easy ring-out)
    if (c.aiT <= 0 || !c.target || !this.byId(c.target) || this.byId(c.target).state !== 'drive') {
      c.aiT = 1.8 + Math.random() * 1.8; c.target = null; c.ramp = c.boostType === 'dash' ? false : Math.random() < 0.12;
      this.cars.forEach(function (o) { if (o === c || o.state !== 'drive' || o.spawnSafe > 0) return;
        var ro = Math.hypot(o.x, o.y), gap = ro > ER - 10 && !wallAt(Math.atan2(o.x, o.y) / D2R, false) ? 0.6 : 1;
        var d = Math.hypot(o.x - c.x, o.y - c.y) * (0.45 + 0.55 * o.hp / o.maxhp) * gap * (0.8 + Math.random() * 0.4); if (d < bd) { bd = d; best = o; } });
      if (best) c.target = best.id;
    }
    // unstick: pressed on the gas but barely moving -> reverse out, turned
    var sp = Math.hypot(c.vx, c.vy);
    if (c.rev > 0) { c.rev -= dt; c.inp.abs = null; c.inp.thr = -1; c.inp.steer = c.revS; c.inp.boost = false; return; }
    c.stuckT = sp < 2 && !c.air ? (c.stuckT || 0) + dt : 0;
    if (c.stuckT > 0.9) { c.stuckT = 0; c.rev = 0.7; c.revS = Math.random() < 0.5 ? -1 : 1; return; }
    var t = c.target && this.byId(c.target), tx = 0, ty = 0, dist0 = 99;
    if (c.ramp) { var ang = Math.atan2(c.x, c.y); tx = -Math.sin(ang) * 2; ty = -Math.cos(ang) * 2; if (Math.hypot(c.x, c.y) < 4) c.ramp = false; }
    else if (t) {
      dist0 = Math.hypot(t.x - c.x, t.y - c.y); var lead = Math.min(0.7, dist0 / 28);
      tx = t.x + t.vx * lead; ty = t.y + t.vy * lead;
      // flank: when far, aim for a point beside the target so we T-bone its weak side instead of its front
      var tf = [Math.sin(t.a), Math.cos(t.a)], rel = [(c.x - t.x) / Math.max(1, dist0), (c.y - t.y) / Math.max(1, dist0)];
      if (dist0 > 9 && tf[0] * rel[0] + tf[1] * rel[1] > 0.5) { var sd = (tf[0] * rel[1] - tf[1] * rel[0]) > 0 ? 1 : -1; tx += tf[1] * 6 * sd; ty -= tf[0] * 6 * sd; }
      // push it outward when it is near a gap: come from the arena side
      var rt = Math.hypot(t.x, t.y); if (rt > ER - 14 && dist0 > 6) { tx -= t.x / rt * 4; ty -= t.y / rt * 4; }
    }
    var r = Math.hypot(c.x, c.y), dx = tx - c.x, dy = ty - c.y;
    // edge sense: look ahead along velocity, much more careful over open drop-offs
    var px = c.x + c.vx * 0.5, py = c.y + c.vy * 0.5, pr = Math.hypot(px, py), open = !wallAt(Math.atan2(px, py) / D2R, this.gate.open > 0), lim = open ? ER - 6 : ER - 4;
    if (pr > lim) { var w = clamp((pr - lim) / 5, 0, 1); dx = dx * (1 - w) - px / pr * 25 * w; dy = dy * (1 - w) - py / pr * 25 * w; }
    var want = Math.atan2(dx, dy), d = wrap(want - c.a), dist = Math.hypot(dx, dy);
    c.inp.abs = null; c.inp.steer = clamp(d * 2.4, -1, 1);
    c.inp.thr = Math.abs(d) > 2.2 ? (sp > 8 ? -0.5 : 0.5) : Math.abs(d) > 1.2 ? 0.6 : 1;
    if (open && pr > ER - 4 && Math.abs(d) > 1) c.inp.thr = -1;    // brake hard before a drop
    var lined = Math.abs(d) < 0.25 && t && !c.ramp, safe = pr < ER - 12;
    if (c.boostType === 'sustain') c.inp.boost = lined && dist0 < 26 && c.boost > 0.25 && safe;
    else if (c.boostType === 'ram') c.inp.boost = lined && dist0 < 13 && dist0 > 4 && safe;
    else c.inp.boost = (lined && dist0 < 8 && dist0 > 3) || (open && pr > ER - 6 && Math.abs(d) < 0.6);   // hop-crush or hop to safety
  };
  Sim.ground = ground; Sim.wallAt = wallAt; Sim.carType = carType;
  root.DDSim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
