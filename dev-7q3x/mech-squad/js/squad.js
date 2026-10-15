/* IRON STRIDE SQUAD - simulation (no DOM, no three.js). TV is the authority. World: x,z ground, y up. */
(function (root) {
  'use strict';
  var Q = root.SQ_CONFIG, W = root.MechWorld;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  W.buildings.forEach(function (b) { b.top = W.height(b.x, b.z) + b.h; });
  // segment vs building boxes (3D slab test). returns t in 0..1 of the first hit, or -1
  function segBox(ax, ay, az, bx, by, bz, q) {
    var t0 = 0, t1 = 1, d = [bx - ax, by - ay, bz - az], o = [ax, ay, az], mn = [q.x - q.w / 2, -10, q.z - q.d / 2], mx = [q.x + q.w / 2, q.top, q.z + q.d / 2];
    for (var i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
      var u = (mn[i] - o[i]) / d[i], v = (mx[i] - o[i]) / d[i]; if (u > v) { var s = u; u = v; v = s; }
      if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return -1;
    }
    return t0;
  }
  function segWall(ax, ay, az, bx, by, bz) { var best = -1; segWall.bi = -1; for (var i = 0; i < W.buildings.length; i++) { var t = segBox(ax, ay, az, bx, by, bz, W.buildings[i]); if (t >= 0 && (best < 0 || t < best)) { best = t; segWall.bi = i; } } return best; }
  // ---------------------------------------------------------------- path grid (A*), one per body size
  var G = 3, N = Math.ceil(W.half * 2 / G), grids = {};
  function grid(pad) { if (grids[pad]) return grids[pad]; var g = new Uint8Array(N * N);
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) { var x = -W.half + (i + 0.5) * G, z = -W.half + (j + 0.5) * G; g[i * N + j] = (W.insideBuilding(x, z, pad) || Math.max(Math.abs(x), Math.abs(z)) > W.city + 4) ? 1 : 0; }
    return (grids[pad] = g); }
  function cell(v) { return clamp(Math.floor((v + W.half) / G), 0, N - 1); }
  function path(pad, x0, z0, x1, z1) {
    var g = grid(pad), s = cell(x0) * N + cell(z0), e = cell(x1) * N + cell(z1);
    if (g[e]) { var best = -1, bd = 1e9; for (var di = -6; di <= 6; di++) for (var dj = -6; dj <= 6; dj++) { var ci = cell(x1) + di, cj = cell(z1) + dj; if (ci < 0 || cj < 0 || ci >= N || cj >= N || g[ci * N + cj]) continue; var dd = di * di + dj * dj; if (dd < bd) { bd = dd; best = ci * N + cj; } } if (best < 0) return null; e = best; }
    var gs = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), open = [s], inOpen = new Uint8Array(N * N); gs[s] = 0; inOpen[s] = 1;
    var ei = Math.floor(e / N), ej = e % N, h = function (k) { return Math.hypot(Math.floor(k / N) - ei, k % N - ej); }, iter = 0;
    while (open.length && iter++ < 12000) {
      var bi = 0, bf = 1e9; for (var k = 0; k < open.length; k++) { var f = gs[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
      var cur = open[bi]; open[bi] = open[open.length - 1]; open.pop(); inOpen[cur] = 0;
      if (cur === e) break;
      var ci = Math.floor(cur / N), cj = cur % N;
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) { if (!a && !b) continue; var ni = ci + a, nj = cj + b; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; var nk = ni * N + nj; if (g[nk]) continue; if (a && b && (g[ci * N + nj] || g[ni * N + cj])) continue;
        var ng = gs[cur] + (a && b ? 1.414 : 1); if (ng < gs[nk]) { gs[nk] = ng; from[nk] = cur; if (!inOpen[nk]) { inOpen[nk] = 1; open.push(nk); } } }
    }
    if (from[e] < 0 && e !== s) return null;
    var pts = [], k2 = e; while (k2 >= 0 && k2 !== s) { pts.push([-W.half + (Math.floor(k2 / N) + 0.5) * G, -W.half + (k2 % N + 0.5) * G]); k2 = from[k2]; }
    pts.reverse(); if (pts.length) pts[pts.length - 1] = g[cell(x1) * N + cell(z1)] ? pts[pts.length - 1] : [x1, z1];
    // string-pull: drop points that are in straight line of sight on the grid
    var out = [], cx = x0, cz = z0, i2 = 0;
    while (i2 < pts.length) { var j2 = pts.length - 1; while (j2 > i2 && !clearLine(g, cx, cz, pts[j2][0], pts[j2][1])) j2--; out.push(pts[j2]); cx = pts[j2][0]; cz = pts[j2][1]; i2 = j2 + 1; }
    return out;
  }
  function clearLine(g, x0, z0, x1, z1) { var n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.5); for (var i = 1; i <= n; i++) { var x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; if (g[cell(x) * N + cell(z)]) return false; } return true; }

  // ---------------------------------------------------------------- world
  function Squad() { this.mechs = []; this.enemies = []; this.shots = []; this.events = []; this.t = 0; this.spawnT = 3; this.score = 0; this.kills = 0; this.eid = 0; this.collat = { hits: 0, n: 0, b: {} }; }
  Squad.prototype.heroScore = function () { var K = Q.collateral; return Math.round(this.score - this.collat.n * K.perBuilding - this.collat.hits * K.perHit); };
  Squad.prototype.hitBuilding = function (bi, dmg, by) { if (bi < 0) return; var c = this.collat, first = !c.b[bi]; c.b[bi] = (c.b[bi] || 0) + dmg; c.hits++; if (first) c.n++; if (by) by.stats.collat = (by.stats.collat || 0) + (first ? 1 : 0); this.ev({ k: 'bhit', bi: bi, first: first, dmg: c.b[bi] }); };
  Squad.prototype.ev = function (e) { this.events.push(e); };
  var SPAWNS = { light: [[-8, -6], [8, -6], [-8, 6], [8, 6], [0, -10], [0, 10], [-12, 0], [12, 0]], titan: [[0, -20], [-20, 0], [20, 0], [0, 20]] };
  Squad.prototype.addMech = function (o) {
    var D = Q[o.cls], n = this.mechs.filter(function (m) { return m.cls === o.cls; }).length, sp = SPAWNS[o.cls][n % SPAWNS[o.cls].length];
    var m = { mech: true, id: o.id, cls: o.cls, D: D, name: o.name, color: o.color, ai: !!o.ai, x: sp[0], z: sp[1], a: 0, aim: 0, vx: 0, vz: 0, hp: D.hp, dead: false, respawnT: 0,
      cd: {}, inp: { mx: 0, mz: 0, ax: 0, az: 0, fire: false, dash: false, jump: false }, py: gy(sp[0], sp[1]), vy: 0, air: false, fuel: 1, thrust: false, order: { path: null, target: null, auto: true }, dashT: 0, stats: { kills: 0, dmg: 0 } };
    this.mechs.push(m); return m;
  };
  Squad.prototype.removeMech = function (id) { this.mechs = this.mechs.filter(function (m) { return m.id !== id; }); };
  Squad.prototype.byId = function (id) { for (var i = 0; i < this.mechs.length; i++) if (this.mechs[i].id === id) return this.mechs[i]; return null; };
  Squad.prototype.enemy = function (id) { for (var i = 0; i < this.enemies.length; i++) if (this.enemies[i].id === id) return this.enemies[i]; return null; };
  function gy(x, z) { return W.height(x, z); }
  function feet(m) { return m.py != null ? m.py : gy(m.x, m.z); }
  function floorAt(x, z, r) { var b = W.insideBuilding(x, z, r || 0); return b ? Math.max(b.top, gy(x, z)) : gy(x, z); }
  function centerY(e) { return e.mech ? feet(e) + e.D.h * 0.5 : gy(e.x, e.z) + e.D.alt; }
  Squad.prototype.los = function (ax, ay, az, bx, by, bz) { return segWall(ax, ay, az, bx, by, bz) < 0; };
  function pushOut(m, r) { var b = W.insideBuilding(m.x, m.z, r); if (!b || (m.py != null && m.py > b.top - 1.5)) return; var dx = m.x - b.x, dz = m.z - b.z, ox = b.w / 2 + r - Math.abs(dx), oz = b.d / 2 + r - Math.abs(dz);
    if (ox < oz) m.x += Math.sign(dx) * ox; else m.z += Math.sign(dz) * oz; var lim = W.city + 2; m.x = clamp(m.x, -lim, lim); m.z = clamp(m.z, -lim, lim); }
  Squad.prototype.order = function (m, x, z) { var p = path(m.D.colR + 0.8, m.x, m.z, x, z); m.order.path = p; m.order.goal = [x, z]; if (p) this.ev({ k: 'order', id: m.id }); return !!p; };
  Squad.prototype.fire = function (m, w, tx, ty, tz, tgt) {
    var D = m.D, Wp = D[w]; if (!Wp || m.dead || (m.cd[w] || 0) > 0) return false;
    var mx = m.x + Math.sin(m.aim) * D.colR, mz = m.z + Math.cos(m.aim) * D.colR, my = feet(m) + D.muzzle, self = this;
    if (w === 'stomp') { m.cd[w] = Wp.cd; this.ev({ k: 'stomp', id: m.id, x: m.x, z: m.z, r: Wp.r });
      this.enemies.slice().forEach(function (e) { var d = Math.hypot(e.x - m.x, e.z - m.z); if (d < Wp.r + e.D.r && (e.kind === 'tank' || e.alt < 20)) { self.hurtEnemy(e, Wp.dmg * (1 - 0.5 * d / Wp.r), m); var k = Wp.knock / Math.max(1, d); e.x += (e.x - m.x) * k * 0.1; e.z += (e.z - m.z) * k * 0.1; } }); return true; }
    if (w === 'barrage') { m.cd[w] = Wp.cd; for (var i = 0; i < Wp.n; i++) { var ang = m.aim + (i - Wp.n / 2) * 0.25;
        this.shots.push({ x: mx, y: my + 6, z: mz, vx: Math.sin(ang) * 12, vy: 40 + i * 2, vz: Math.cos(ang) * 12, dmg: Wp.dmg, splash: Wp.splash, team: 0, owner: m.id, life: 7, kind: 'missile', home: tgt ? tgt.id : null, tx: tx + rnd(-6, 6), tz: tz + rnd(-6, 6), delay: i * 0.12, sp: Wp.speed }); }
      this.ev({ k: 'barrage', id: m.id }); return true; }
    var dx = tx - mx, dy = ty - my, dz = tz - mz, L = Math.hypot(dx, dy, dz) || 1, sp = Wp.speed, spr = Wp.spread || 0;
    dx = dx / L + rnd(-spr, spr); dy = dy / L + rnd(-spr, spr) * 0.5; dz = dz / L + rnd(-spr, spr);
    this.shots.push({ x: mx, y: my, z: mz, vx: dx * sp, vy: dy * sp, vz: dz * sp, dmg: Wp.dmg, splash: Wp.splash || 0, team: 0, owner: m.id, life: (Wp.range || 100) / sp, kind: w });
    m.cd[w] = Wp.cd; this.ev({ k: 'shot', id: m.id, w: w, x: mx, y: my, z: mz }); return true;
  };
  Squad.prototype.hurtEnemy = function (e, dmg, by) { if (e.hp <= 0) return; e.hp -= dmg; e.hitT = 0.2; if (by) by.stats.dmg += dmg;
    if (e.hp <= 0) { this.enemies.splice(this.enemies.indexOf(e), 1); this.score += e.D.score; this.kills++; if (by) by.stats.kills++; this.ev({ k: 'kill', kind: e.kind, x: e.x, y: centerY(e), z: e.z, by: by && by.id }); } };
  Squad.prototype.hurtMech = function (m, dmg) { if (m.dead) return; m.hp -= dmg; this.ev({ k: 'hurt', id: m.id, dmg: dmg });
    if (m.hp <= 0) { m.dead = true; m.respawnT = m.D.respawn; this.ev({ k: 'down', id: m.id, x: m.x, z: m.z }); } };
  Squad.prototype.splash = function (x, y, z, r, dmg, by) { var self = this;
    this.enemies.slice().forEach(function (e) { var d = Math.hypot(e.x - x, centerY(e) - y, e.z - z); if (d < r + e.D.r && self.los(x, y + 0.5, z, e.x, centerY(e), e.z)) self.hurtEnemy(e, dmg * (1 - 0.6 * clamp(d / r, 0, 1)), by); }); };

  Squad.prototype.step = function (dt) {
    var self = this; this.t += dt;
    // ---- mechs
    this.mechs.forEach(function (m) {
      var D = m.D; for (var k in m.cd) if (m.cd[k] > 0) m.cd[k] -= dt;
      if (m.dead) { m.respawnT -= dt; if (m.respawnT <= 0) { m.dead = false; m.hp = D.hp; var s = SPAWNS[m.cls][0]; m.x = s[0]; m.z = s[1]; m.py = gy(s[0], s[1]) + 30; m.vy = 0; m.air = true; m.fuel = 1; m.order.path = null; self.ev({ k: 'respawn', id: m.id }); } return; }
      if (m.cls === 'light') {
        var mag = Math.min(1, Math.hypot(m.inp.mx, m.inp.mz));
        var wx = m.inp.mx * D.speed, wz = m.inp.mz * D.speed;
        if (m.inp.dash && (m.cd.dash || 0) <= 0 && mag > 0.2) { m.cd.dash = D.dash.cd; m.dashT = D.dash.time; m.dashV = [m.inp.mx / mag * D.dash.speed, m.inp.mz / mag * D.dash.speed]; self.ev({ k: 'dash', id: m.id }); }
        m.inp.dash = false;
        if (m.dashT > 0) { m.dashT -= dt; wx = m.dashV[0]; wz = m.dashV[1]; }
        var k2 = 1 - Math.pow(0.0005, dt); m.vx += (wx - m.vx) * k2; m.vz += (wz - m.vz) * k2;
        m.x += m.vx * dt; m.z += m.vz * dt; if (mag > 0.15) m.a = m.a + clamp(wrap(Math.atan2(m.inp.mx, m.inp.mz) - m.a), -D.turn * dt, D.turn * dt);
        if (Math.hypot(m.inp.ax, m.inp.az) > 0.3) m.aim = Math.atan2(m.inp.ax, m.inp.az); else if (mag > 0.15) m.aim = m.a;
        if (m.inp.fire) { var tx = m.x + Math.sin(m.aim) * 60, tz = m.z + Math.cos(m.aim) * 60, ty = feet(m) + D.muzzle; var tg = self.autoTarget(m, 0.35); if (tg) { tx = tg.x; tz = tg.z; ty = centerY(tg); } self.fire(m, 'mg', tx, ty, tz); }
        pushOut(m, D.colR);
      } else {
        // titan: walks its tactical path slowly, torso turns toward the target, guns fire when they can see it
        var p = m.order.path;
        if (p && p.length) { var dx = p[0][0] - m.x, dz = p[0][1] - m.z, d = Math.hypot(dx, dz);
          if (d < 2.5) { p.shift(); if (!p.length) { m.order.path = null; self.ev({ k: 'arrive', id: m.id }); } }
          else { var want = Math.atan2(dx, dz), da = wrap(want - m.a); m.a += clamp(da, -D.turn * dt, D.turn * dt); var go = Math.abs(da) < 0.6 ? 1 : 0.25; m.x += Math.sin(m.a) * D.speed * go * dt; m.z += Math.cos(m.a) * D.speed * go * dt; m.walking = true; } }
        else m.walking = false;
        pushOut(m, D.colR);
        var t = m.order.target && self.enemy(m.order.target);
        if (!t && m.order.auto) t = self.autoTarget(m, Math.PI);
        if (t) { var wa = Math.atan2(t.x - m.x, t.z - m.z); m.aim += clamp(wrap(wa - m.aim), -1.4 * dt, 1.4 * dt);
          var lined = Math.abs(wrap(wa - m.aim)) < 0.15, my = feet(m) + D.muzzle, dist = Math.hypot(t.x - m.x, t.z - m.z);
          var sees = self.los(m.x + Math.sin(m.aim) * D.colR, my, m.z + Math.cos(m.aim) * D.colR, t.x, centerY(t), t.z);
          m.sees = sees ? t.id : null;
          if (lined && sees && dist < D.siege.range && (m.order.auto || m.inp.fire)) self.fire(m, 'siege', t.x + t.vx * dist / D.siege.speed, centerY(t), t.z + t.vz * dist / D.siege.speed, t);
        } else { m.sees = null; m.aim += clamp(wrap(m.a - m.aim), -dt, dt); }
        m.inp.fire = false;
      }
      self.vertical(m, dt);
    });
    // ---- enemies
    var alive = this.mechs.filter(function (m) { return !m.dead; }), E = Q.enemies;
    this.spawnT -= dt; var cap = Math.round(E.maxAlive[0] + (E.maxAlive[1] - E.maxAlive[0]) * clamp(this.t / E.rampSec, 0, 1));
    if (this.spawnT <= 0 && this.enemies.length < cap && alive.length) { this.spawnT = rnd(E.spawnEvery[0], E.spawnEvery[1]); this.spawn(); }
    this.enemies.forEach(function (e) {
      var D = e.D, tgt = null, bd = 1e9; if (e.hitT > 0) e.hitT -= dt;
      alive.forEach(function (m) { var d = Math.hypot(m.x - e.x, m.z - e.z) * (m.cls === 'titan' ? 0.8 : 1); if (d < bd) { bd = d; tgt = m; } });
      if (!tgt) { e.vx = e.vz = 0; return; }
      var dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz) || 1, want = e.kind === 'tank' ? (d > D.keep ? 1 : d < D.keep * 0.6 ? -0.6 : 0) : (d > 18 ? 1 : 0.2);
      var sx = dx / d, sz = dz / d; if (e.kind === 'drone') { sx += Math.sin(self.t * 1.3 + e.id) * 0.6; sz += Math.cos(self.t * 1.1 + e.id) * 0.6; }
      e.vx = sx * D.speed * want; e.vz = sz * D.speed * want; e.x += e.vx * dt; e.z += e.vz * dt;
      if (e.kind === 'tank') pushOut(e, D.r); else { var b = W.insideBuilding(e.x, e.z, 1); e.alt = b ? Math.max(D.alt, b.top - gy(e.x, e.z) + 4) : e.alt + (D.alt - e.alt) * dt; }
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = rnd(D.fire[0], D.fire[1]); var ty = centerY(tgt) + rnd(-1, 1), sy = centerY(e);
        if (self.los(e.x, sy, e.z, tgt.x, ty, tgt.z) && d < 110) { var L = Math.hypot(dx, ty - sy, dz); self.shots.push({ x: e.x, y: sy, z: e.z, vx: dx / L * D.bolt, vy: (ty - sy) / L * D.bolt, vz: dz / L * D.bolt, dmg: D.dmg, team: 1, life: 4, kind: e.kind === 'tank' ? 'shell' : 'bolt' }); self.ev({ k: 'efire', x: e.x, y: sy, z: e.z }); } }
    });
    // ---- shots: swept against buildings every step, so nothing goes through a wall
    for (var i = this.shots.length - 1; i >= 0; i--) {
      var s = this.shots[i]; if (s.delay > 0) { s.delay -= dt; continue; }
      if (s.kind === 'missile') { var ht = s.home && this.enemy(s.home); if (ht) { s.tx = ht.x; s.tz = ht.z; s.ty = centerY(ht); }
        var ddx = s.tx - s.x, ddz = s.tz - s.z, hd = Math.hypot(ddx, ddz), tY = (s.ty != null ? s.ty : gy(s.tx, s.tz) + 2), up = this.t - (s.t0 || (s.t0 = this.t)) < 0.6;
        var dvx = ddx / (hd || 1) * s.sp, dvz = ddz / (hd || 1) * s.sp, dvy = up ? 30 : (tY - s.y) / Math.max(0.3, hd / s.sp) ;
        var tr = up ? 1.5 : 4; s.vx += (dvx - s.vx) * Math.min(1, tr * dt); s.vz += (dvz - s.vz) * Math.min(1, tr * dt); s.vy += (dvy - s.vy) * Math.min(1, tr * dt); }
      else if (s.kind === 'siege' || s.kind === 'shell') s.vy -= 6 * dt;
      var x0 = s.x, y0 = s.y, z0 = s.z; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.life -= dt;
      var tw = segWall(x0, y0, z0, s.x, s.y, s.z), hit = null, hx, hy, hz;
      if (tw >= 0) { s.x = x0 + (s.x - x0) * tw; s.y = y0 + (s.y - y0) * tw; s.z = z0 + (s.z - z0) * tw; if (s.team === 0) this.hitBuilding(segWall.bi, s.dmg, this.byId(s.owner)); }
      // entity hits along the (possibly shortened) segment
      var list = s.team === 0 ? this.enemies : alive;
      for (var j = 0; j < list.length && !hit; j++) { var e2 = list[j], cy = centerY(e2), r = e2.mech ? e2.D.hitR : e2.D.r + (s.kind === 'mg' ? 0.6 : 0);
        if (e2.mech && e2.cls === 'titan') { cy = feet(e2) + e2.D.h * 0.45; }
        var sx2 = s.x - x0, sy2 = s.y - y0, sz2 = s.z - z0, L2 = sx2 * sx2 + sy2 * sy2 + sz2 * sz2 || 1, u = clamp(((e2.x - x0) * sx2 + (cy - y0) * sy2 + (e2.z - z0) * sz2) / L2, 0, 1);
        var px = x0 + sx2 * u, py = y0 + sy2 * u, pz = z0 + sz2 * u, dd = e2.mech && e2.cls === 'titan' ? Math.max(Math.hypot(px - e2.x, pz - e2.z), Math.abs(py - cy) - e2.D.h * 0.45) : Math.hypot(px - e2.x, py - cy, pz - e2.z);
        if (dd < r) { hit = e2; hx = px; hy = py; hz = pz; } }
      var ground = s.y < gy(s.x, s.z);
      if (hit || tw >= 0 || ground || s.life <= 0) {
        if (hit) { if (s.team === 0) this.hurtEnemy(hit, s.dmg, this.byId(s.owner)); else this.hurtMech(hit, s.dmg); }
        var ex = hit ? hx : s.x, ey = hit ? hy : s.y, ez = hit ? hz : s.z;
        if (s.splash && s.team === 0) this.splash(ex, ey, ez, s.splash, s.dmg * 0.7, this.byId(s.owner));
        this.ev({ k: 'impact', x: ex, y: ey, z: ez, big: s.splash ? s.splash : 0, wall: tw >= 0, team: s.team, kind: s.kind, hit: !!hit });
        this.shots.splice(i, 1);
      }
    }
  };
  // v0.6 booster jump / hover + ground slam. Rooftops count as floor, so you can land on them (and stomp them: collateral)
  Squad.prototype.vertical = function (m, dt) {
    var D = m.D, J = D.jump, G = Q.grav, fl = floorAt(m.x, m.z, 0), self = this; if (!J) return;
    if (m.cd.jump == null) m.cd.jump = 0;
    var want = m.inp.jump; m.thrust = false;
    if (!m.air) { m.fuel = Math.min(1, m.fuel + dt * J.regen);
      if (want && !m.jumpHeld && (m.cd.jump || 0) <= 0) { m.air = true; m.vy = J.v; m.py = Math.max(m.py, fl) + 0.05; if (J.cd) m.cd.jump = J.cd; this.ev({ k: 'jump', id: m.id }); }
      else if (m.py > fl + 0.6) { m.air = true; m.vy = 0; }   // walked off a roof
      else m.py = fl; }
    else {
      m.vy -= G * dt;
      if (want && J.fuel && m.fuel > 0 && m.vy < 6) { m.vy += J.hover * dt; m.fuel = Math.max(0, m.fuel - dt / J.fuel); m.thrust = true; }
      m.py += m.vy * dt;
      if (m.py <= fl) { var hard = -m.vy; m.py = fl; m.air = false; m.vy = 0;
        if (hard > J.slamV) { var f = Math.min(1.6, hard / (J.slamV * 1.6)); this.ev({ k: 'slam', id: m.id, x: m.x, y: fl, z: m.z, r: J.slamR * f, big: m.cls === 'titan' });
          this.enemies.slice().forEach(function (e) { var d = Math.hypot(e.x - m.x, e.z - m.z); if (d < J.slamR * f + e.D.r && (e.kind === 'tank' || e.alt < 16)) { self.hurtEnemy(e, J.slamDmg * f * (1 - 0.5 * d / (J.slamR * f + e.D.r)), m); e.x += (e.x - m.x) / Math.max(1, d) * 6; e.z += (e.z - m.z) / Math.max(1, d) * 6; } });
          W.buildings.forEach(function (b, bi) { var dx = Math.max(Math.abs(m.x - b.x) - b.w / 2, 0), dz = Math.max(Math.abs(m.z - b.z) - b.d / 2, 0); if (Math.hypot(dx, dz) < J.slamR * f * 0.5) self.hitBuilding(bi, J.slamDmg * f, m); }); } } }
    m.jumpHeld = want; if (m.cls === 'titan') m.inp.jump = false;
  };
  Squad.prototype.autoTarget = function (m, cone) {
    var best = null, bs = 1e9, self = this, D = m.D, my = feet(m) + D.muzzle;
    this.enemies.forEach(function (e) { var dx = e.x - m.x, dz = e.z - m.z, d = Math.hypot(dx, dz); if (d > (m.cls === 'light' ? D.mg.range : D.siege.range)) return;
      var da = Math.abs(wrap(Math.atan2(dx, dz) - m.aim)); if (da > cone) return;
      if (!self.los(m.x, my, m.z, e.x, centerY(e), e.z)) return; var s = d * (1 + da * 3); if (s < bs) { bs = s; best = e; } });
    return best;
  };
  Squad.prototype.spawn = function () {
    var E = Q.enemies, a = Math.random() * Math.PI * 2, alive = this.mechs.filter(function (m) { return !m.dead; }), c = alive[Math.floor(Math.random() * alive.length)];
    for (var tries = 0; tries < 12; tries++) { var r = rnd(E.spawnDist[0], E.spawnDist[1]), x = clamp(c.x + Math.sin(a) * r, -W.city, W.city), z = clamp(c.z + Math.cos(a) * r, -W.city, W.city); a += 0.7;
      var kind = Math.random() < clamp(0.25 + this.t / 400, 0, 0.5) ? 'tank' : 'drone';
      if (kind === 'tank' && W.insideBuilding(x, z, 4)) continue;
      var D = E[kind]; this.enemies.push({ id: ++this.eid, kind: kind, D: D, x: x, z: z, vx: 0, vz: 0, hp: D.hp, alt: D.alt, fireT: rnd(1, D.fire[1]), hitT: 0 }); return; }
  };
  // ---------------------------------------------------------------- bots (fill seats / tests)
  Squad.prototype.think = function (m, dt) {
    if (m.dead) return; var self = this;
    var near = null, bd = 1e9; this.enemies.forEach(function (e) { var d = Math.hypot(e.x - m.x, e.z - m.z); if (d < bd) { bd = d; near = e; } });
    if (m.cls === 'light') {
      m.thinkT = (m.thinkT || 0) - dt;
      if (near) { var vis = this.autoTarget(m, Math.PI); var aimAt = vis || near; m.inp.ax = Math.sin(Math.atan2(aimAt.x - m.x, aimAt.z - m.z)); m.inp.az = Math.cos(Math.atan2(aimAt.x - m.x, aimAt.z - m.z)); m.inp.fire = !!vis;
        if (m.thinkT <= 0) { m.thinkT = 1.2; var r = vis ? 22 : 6, ang = Math.atan2(m.x - near.x, m.z - near.z) + rnd(-0.8, 0.8); m.botPath = path(m.D.colR + 0.8, m.x, m.z, near.x + Math.sin(ang) * r, near.z + Math.cos(ang) * r); }
        var p = m.botPath; if (p && p.length) { var dx = p[0][0] - m.x, dz = p[0][1] - m.z, d = Math.hypot(dx, dz); if (d < 2) p.shift(); m.inp.mx = dx / (d || 1); m.inp.mz = dz / (d || 1); if (Math.random() < dt * 0.4) m.inp.dash = true; } else { m.inp.mx = m.inp.mz = 0; }
        m.jT = (m.jT || 0) - dt; if (m.jT <= 0) { m.jT = rnd(3, 7); m.jHold = rnd(0.2, 1.2); } m.inp.jump = m.jT < m.jHold; }
      else { m.inp.mx = m.inp.mz = 0; m.inp.fire = false; }
    } else {
      m.thinkT = (m.thinkT || 0) - dt;
      if (m.thinkT <= 0) { m.thinkT = 4; if (near && (!m.sees || bd > 90)) this.order(m, near.x, near.z); }
      if (near && bd < 26 && (m.cd.stomp || 0) <= 0) this.fire(m, 'stomp');
      if (near && (m.cd.barrage || 0) <= 0 && bd < 120) this.fire(m, 'barrage', near.x, 0, near.z, near);
    }
  };
  Squad.path = path; Squad.segWall = segWall;
  root.SquadSim = Squad;
})(typeof window !== 'undefined' ? window : globalThis);
