/* BUBBLE HOCKEY v0.1 - table-top rod hockey sim. Rink is 1 wide x 1.8 long. Team 0 defends the bottom goal and attacks up; team 1 is the
   point-mirror (x -> 1-x, y -> 1.8-y). Every player rides a fixed track (u = 0..1). AI slides everyone you are not touching. */
(function (root) {
  'use strict';
  var L = 1.8, PR = .022, R = .036, GW = .085, GY = .095, WIN = 5, TIME = 180;
  var T0 = [[.40, 1.62, .60, 1.62, 'G'], [.08, 1.36, .46, 1.36, 'D'], [.54, 1.36, .92, 1.36, 'D'], [.12, .42, .12, 1.14, 'W'], [.42, .58, .42, 1.18, 'C'], [.72, .42, .72, 1.14, 'W']];
  var TR = []; [0, 1].forEach(function (t) { T0.forEach(function (k) { TR.push(t ? { a: [1 - k[0], L - k[1]], b: [1 - k[2], L - k[3]], k: k[4], t: 1 } : { a: [k[0], k[1]], b: [k[2], k[3]], k: k[4], t: 0 }); }); });
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function proj(tr, x, y) { var dx = tr.b[0] - tr.a[0], dy = tr.b[1] - tr.a[1]; return cl(((x - tr.a[0]) * dx + (y - tr.a[1]) * dy) / (dx * dx + dy * dy), 0, 1); }
  function pos(tr, u) { return [tr.a[0] + (tr.b[0] - tr.a[0]) * u, tr.a[1] + (tr.b[1] - tr.a[1]) * u]; }
  function face(t) { return t ? 1 : -1; }   // y direction a team attacks
  function goalOf(t) { return t ? L - GY : GY; } // the goal line team t shoots at
  function Sim() { this.ai = [false, true]; this.diff = .85; this.reset(); }
  Sim.prototype.reset = function () { this.u = TR.map(function (tr) { return tr.k === 'G' || tr.k === 'D' ? .5 : .5; }); this.sc = [0, 0]; this.time = TIME; this.over = -1; this.grab = [-1, -1]; this.fing = [null, null]; this.side = 0; this.faceoff(); };
  Sim.prototype.faceoff = function () { this.p = [.5, L / 2]; this.v = [(Math.random() - .5) * .25, (Math.random() - .5) * .25]; this.c = -1; this.pause = 1.1; this.msg = 'FACE OFF'; this.to = -1; this.cool = -1; this.coolT = 0; this.hold = 0; this.ev = ''; };
  Sim.prototype.pp = function (i) { return pos(TR[i], this.u[i]); };
  Sim.prototype.team = function (i) { return i < 6 ? 0 : 1; };
  Sim.prototype.carryPos = function () { var i = this.c, P = this.pp(i), t = this.team(i), sx = t ? -1 : 1; return [P[0] + this.side * .034 * sx, P[1] + face(t) * (R + PR + .004)]; };
  Sim.prototype.release = function (dir, sp, to) { var i = this.c; if (i < 0) return; var m = Math.hypot(dir[0], dir[1]) || 1; this.p = this.carryPos(); this.v = [dir[0] / m * sp, dir[1] / m * sp]; this.cool = i; this.coolT = .25; this.to = to == null ? -1 : to; this.c = -1; this.hold = 0; this.side = 0; };
  Sim.prototype.shoot = function (dir, sp) { var i = this.c; if (i < 0) return; var t = this.team(i), cp = this.carryPos(), gy = goalOf(t);
    if (!dir) { var g = this.pp(t ? 0 : 6), aimX = .5 + (g[0] < .5 ? 1 : -1) * GW * .6 + (Math.random() - .5) * .05; dir = [aimX - cp[0], gy - cp[1]]; sp = 2.7; }
    this.release(dir, cl(sp || 2.6, 1.6, 3.1)); this.ev = 'shot'; };
  // pass: generous aim assist. Picks the teammate closest in angle (within 75 deg). Within 40% of that cone the pass is near-straight;
  // further off, the pass errs in proportion to how far off the flick was.
  Sim.prototype.pass = function (dir, sp) { var i = this.c; if (i < 0) return; var t = this.team(i), cp = this.carryPos(), fa = Math.atan2(dir[1], dir[0]), best = -1, bd = 9, me = this;
    var gy = goalOf(t), ga = Math.atan2(gy - cp[1], .5 - cp[0]), gd = Math.abs(Math.atan2(Math.sin(fa - ga), Math.cos(fa - ga)));
    for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), a = Math.atan2(q[1] - cp[1], q[0] - cp[0]), d = Math.atan2(Math.sin(fa - a), Math.cos(fa - a)); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = j; } }
    var CONE = 75 * Math.PI / 180, W = CONE * .4;
    if (gd < Math.min(.45, Math.abs(bd)) && (cp[1] - gy) * face(t) < 0) { this.shoot(dir, sp * 1.1); return 'shot'; }
    if (best < 0 || Math.abs(bd) > CONE) { this.release(dir, cl(sp, .8, 2.2)); return 'loose'; }
    var q2 = this.pp(best), exact = Math.atan2(q2[1] - cp[1], q2[0] - cp[0]), ad = Math.abs(bd), err = ad <= W ? ad * .12 : W * .12 + (ad - W) * .75;
    var ang = exact + Math.sign(bd) * err, dist = Math.hypot(q2[0] - cp[0], q2[1] - cp[1]);
    this.release([Math.cos(ang), Math.sin(ang)], cl(dist * 2.4 + .7, 1.1, 2.4), best); this.ev = 'pass'; return best; };
  // input from a team (local or over the net): {t:'grab',i} {t:'drag',x,y} {t:'rel'} {t:'tap'} {t:'flick',dx,dy,sp}
  Sim.prototype.input = function (team, m) {
    if (this.over >= 0) { if (m.t === 'tap') this.reset(); return; }
    if (m.t === 'grab') { this.grab[team] = (m.i >= team * 6 && m.i < team * 6 + 6) ? m.i : -1; this.fing[team] = null; }
    else if (m.t === 'drag') this.fing[team] = [m.x, m.y];
    else if (m.t === 'rel') { this.grab[team] = -1; this.fing[team] = null; }
    else if (this.c >= 0 && this.team(this.c) === team && this.pause <= 0) { if (m.t === 'tap') this.shoot(); else if (m.t === 'flick') this.pass([m.dx, m.dy], m.sp); } };
  Sim.prototype.aiCarrier = function (dt) { var i = this.c, t = this.team(i), P = this.pp(i), gy = goalOf(t); this.hold += dt;
    this.side = Math.sin(this.hold * 7 + i) * .8;
    if (this.hold < .55 + (1 - this.diff) * .8) return;
    var dg = Math.abs(P[1] - gy); if (dg < .62 || (TR[i].k === 'C' && dg < .8)) { var g = this.pp(t ? 0 : 6), ax = .5 + (g[0] < .5 ? 1 : -1) * GW * .55 + (Math.random() - .5) * .07 * (1.4 - this.diff); this.release([ax - P[0], gy - P[1]], 2.5); this.ev = 'shot'; return; }
    var best = -1, by = 9; for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), adv = Math.abs(q[1] - gy); if (adv < Math.abs(P[1] - gy) - .05 && adv < by) { by = adv; best = j; } }
    if (best < 0) best = t * 6 + 4; var cp = this.carryPos(), q2 = this.pp(best), dx = q2[0] - cp[0], dy = q2[1] - cp[1], e = (Math.random() - .5) * .3 * (1.2 - this.diff), a = Math.atan2(dy, dx) + e;
    this.release([Math.cos(a), Math.sin(a)], cl(Math.hypot(dx, dy) * 2.4 + .7, 1.1, 2.4), best); this.ev = 'pass'; };
  Sim.prototype.step = function (dt) {
    var me = this; this.ev = '';
    if (this.over >= 0) return;
    this.time -= dt; if (this.time <= 0) { this.time = 0; if (this.sc[0] !== this.sc[1]) { this.over = this.sc[0] > this.sc[1] ? 0 : 1; return; } this.msg = 'SUDDEN DEATH'; }
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) this.msg = ''; }
    // move players
    var tgt = this.c >= 0 ? this.carryPos() : [this.p[0] + this.v[0] * .18, this.p[1] + this.v[1] * .18], own = this.c >= 0 ? this.team(this.c) : -1;
    for (var i = 0; i < 12; i++) { var tr = TR[i], t = tr.t, want, spd;
      if (this.grab[t] === i && this.fing[t]) { want = proj(tr, this.fing[t][0], this.fing[t][1]); spd = 3.2;
        if (i === this.c && (tr.k === 'W' || tr.k === 'C')) this.side = cl((this.fing[t][0] - this.pp(i)[0]) * (t ? -1 : 1) / .05, -1, 1); }
      else if (i === this.c && this.ai[t]) { want = t ? 0 : 0; want = proj(tr, .5, goalOf(t)); spd = .35; }
      else if (i === this.c) { want = this.u[i]; spd = 0; this.side *= Math.exp(-dt * 2); }
      else { var lead = own === t && tr.k !== 'G' && tr.k !== 'D' ? -face(t) * -.12 : 0; want = proj(tr, tgt[0], tgt[1] + lead); spd = (this.ai[t] ? .75 + this.diff * .35 : 1.0) * (tr.k === 'G' ? 1.3 : 1); }
      var du = want - this.u[i], len = Math.hypot(tr.b[0] - tr.a[0], tr.b[1] - tr.a[1]), mx = spd * dt / len; this.u[i] += cl(du, -mx, mx); }
    if (this.pause > 0) return;
    if (this.coolT > 0) { this.coolT -= dt; if (this.coolT <= 0) this.cool = -1; }
    if (this.c >= 0) { var ct = this.team(this.c);
      if (this.ai[ct] && this.grab[ct] < 0) this.aiCarrier(dt); else { this.hold += dt; if (this.hold > 6) { this.ev = 'auto'; this.pass([0, face(ct)], 1.6); } }
      if (this.c >= 0) { var cp = this.carryPos(); this.p = cp; this.v = [0, 0];
        for (i = (1 - ct) * 6; i < (1 - ct) * 6 + 6; i++) { var q = this.pp(i); if (Math.hypot(q[0] - cp[0], q[1] - cp[1]) < R + PR + .006) { if (Math.random() < dt * 5) { this.c = i; this.hold = 0; this.side = 0; this.ev = 'steal'; } else if (Math.random() < dt * 4) { var n = [cp[0] - q[0], cp[1] - q[1]], m = Math.hypot(n[0], n[1]) || 1; this.cool = this.c; this.coolT = .3; this.c = -1; this.v = [n[0] / m * .7, n[1] / m * .7]; this.ev = 'poke'; } break; } } }
      if (this.c >= 0) return; }
    // loose puck
    var sub = 3; for (var k = 0; k < sub; k++) { var h = dt / sub; this.p[0] += this.v[0] * h; this.p[1] += this.v[1] * h; var f = Math.exp(-.55 * h); this.v[0] *= f; this.v[1] *= f;
      var x = this.p[0], y = this.p[1];
      if (y < GY && Math.abs(x - .5) < GW) { this.goal(0); return; } if (y > L - GY && Math.abs(x - .5) < GW) { this.goal(1); return; }
      if (x < PR) { this.p[0] = PR; this.v[0] = Math.abs(this.v[0]) * .8; } if (x > 1 - PR) { this.p[0] = 1 - PR; this.v[0] = -Math.abs(this.v[0]) * .8; }
      if (y < .05 + PR) { this.p[1] = .05 + PR; this.v[1] = Math.abs(this.v[1]) * .8; } if (y > L - .05 - PR) { this.p[1] = L - .05 - PR; this.v[1] = -Math.abs(this.v[1]) * .8; }
      // posts
      [[.5 - GW, GY], [.5 + GW, GY], [.5 - GW, L - GY], [.5 + GW, L - GY]].forEach(function (po) { var dx = me.p[0] - po[0], dy = me.p[1] - po[1], d = Math.hypot(dx, dy); if (d < PR + .008) { var nx = dx / d, ny = dy / d, vn = me.v[0] * nx + me.v[1] * ny; me.p = [po[0] + nx * (PR + .008), po[1] + ny * (PR + .008)]; if (vn < 0) { me.v[0] -= 1.8 * vn * nx; me.v[1] -= 1.8 * vn * ny; } me.ev = 'post'; } });
      for (i = 0; i < 12; i++) { if (i === this.cool) continue; var Q = this.pp(i), dx = this.p[0] - Q[0], dy = this.p[1] - Q[1], d = Math.hypot(dx, dy); if (d >= R + PR) continue;
        var spd2 = Math.hypot(this.v[0], this.v[1]), catchV = i === this.to ? 9 : TR[i].k === 'G' ? 1.7 : 1.25;
        if (spd2 < catchV) { this.c = i; this.hold = 0; this.side = 0; this.to = -1; if (TR[i].k === 'G') this.ev = 'save'; return; }
        var nx = dx / d, ny = dy / d, vn = this.v[0] * nx + this.v[1] * ny; this.p = [Q[0] + nx * (R + PR), Q[1] + ny * (R + PR)]; if (vn < 0) { this.v[0] -= 1.7 * vn * nx; this.v[1] -= 1.7 * vn * ny; this.v[0] *= .8; this.v[1] *= .8; } this.ev = TR[i].k === 'G' ? 'save' : 'bump'; } }
  };
  Sim.prototype.goal = function (t) { this.sc[t]++; this.ev = 'goal' + t; if (this.sc[t] >= WIN || this.time <= 0) { this.over = t; this.msg = ''; return; } this.faceoff(); this.msg = 'GOAL!'; this.pause = 1.8; this.lastGoal = t; };
  Sim.prototype.snap = function () { function r(x) { return Math.round(x * 1000) / 1000; } return { t: 's', u: this.u.map(r), p: this.p.map(r), c: this.c, sd: r(this.side), sc: this.sc, tm: Math.ceil(this.time), ov: this.over, msg: this.msg, g: this.grab.slice(), ev: this.ev }; };
  root.Bubble = { Sim: Sim, TR: TR, L: L, PR: PR, R: R, GW: GW, GY: GY, pos: pos };
})(window);
