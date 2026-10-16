/* FOOSBALL v0.1 - top-down proxy sim. Table 1 wide (x, across) by L long (y). Team 0 defends y = L (right on TV), attacks y = 0.
   Rods run across the table at fixed y. Each rod slides along x (s) and its men swing forward/back along y (k). No spinning.
   Possession: a slow ball touching a man sticks to his front; it moves with him until a flick (pass along rod / shot) or a hard kick. */
(function (root) {
  'use strict';
  var L = 1.6, BR = .018, HX = .022, HY = .013, GW = .13, KMAX = .07, WIN = 5;
  // rods left->right. n men, spacing sp. team, role (G goalie, D defence, M midfield, A attack)
  var RODS = [[1, 0, 'G'], [2, .30, 'D'], [3, .27, 'A'], [5, .18, 'M'], [5, .18, 'M'], [3, .27, 'A'], [2, .30, 'D'], [1, 0, 'G']];
  var TEAM = [1, 1, 0, 1, 0, 1, 0, 0];
  var R = RODS.map(function (d, i) { var span = (d[0] - 1) * d[1], lim = Math.max(.06, (1 - span) / 2 - HX - .01); if (d[2] === 'G') lim = .22;
    return { y: L * (i + 1) / 9, n: d[0], sp: d[1], k: d[2], t: TEAM[i], lim: lim }; });
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function face(t) { return t ? 1 : -1; }   // direction team t attacks
  function Sim() { this.ai = [false, true]; this.ctl = [[], []]; this.reset(); }
  Sim.prototype.reset = function () { this.s = R.map(function () { return 0; }); this.k = R.map(function () { return 0; }); this.vs = R.map(function () { return 0; }); this.vk = R.map(function () { return 0; });
    this.sc = [0, 0]; this.over = -1; this.hands = {}; this.serve(Math.random() < .5 ? 0 : 1); };
  Sim.prototype.serve = function (to) { this.b = [.5, L / 2]; this.v = [(Math.random() < .5 ? -1 : 1) * .25, face(to) * -.15 + (Math.random() - .5) * .3]; this.hold = null; this.pause = 1.2; this.msg = 'SERVE'; this.ev = ''; this.cool = null; };
  Sim.prototype.men = function (r) { var d = R[r], out = []; for (var j = 0; j < d.n; j++) out.push([.5 + this.s[r] + (j - (d.n - 1) / 2) * d.sp, d.y + this.k[r]]); return out; };
  Sim.prototype.rodAt = function (team, y, allowed) { var best = -1, bd = 9; for (var r = 0; r < 8; r++) { if (R[r].t !== team || (allowed && allowed.indexOf(r) < 0)) continue; var d = Math.abs(R[r].y - y); if (d < bd) { bd = d; best = r; } } return best; };
  // input from a player id (seat): {t:'grab',x,y} {t:'drag',x,y} {t:'rel'} {t:'flick',dx,dy,sp} {t:'tap'}
  Sim.prototype.input = function (pid, team, rods, m) {
    if (this.over >= 0) { if (m.t === 'tap') this.reset(); return; }
    var h = this.hands[pid];
    if (m.t === 'grab') { var r = this.rodAt(team, m.y, rods); if (r < 0) return; this.hands[pid] = { r: r, x0: m.x, y0: m.y, s0: this.s[r], k0: this.k[r], x: m.x, y: m.y }; }
    else if (m.t === 'drag' && h) { h.x = m.x; h.y = m.y; }
    else if (m.t === 'rel') { delete this.hands[pid]; }
    else if (m.t === 'flick' || m.t === 'tap') { var hr = h ? h.r : this.lastRod && this.lastRod[pid]; this.act(team, hr, m); }
    if (this.hands[pid]) (this.lastRod = this.lastRod || {})[pid] = this.hands[pid].r; };
  Sim.prototype.act = function (team, r, m) {
    var H = this.hold; if (!H || R[H.r].t !== team || this.pause > 0) return;
    if (m.t === 'tap') { this.release([0, face(team)], 2.6); this.ev = 'shot'; return; }
    var ax = Math.abs(m.dx), ay = Math.abs(m.dy);
    if (ax > ay * 1.3 && R[H.r].n > 1) {   // sideways flick along the rod: pass to the next man that way
      var dir = m.dx > 0 ? 1 : -1, to = H.j + dir; if (to < 0 || to >= R[H.r].n) { this.release([dir, face(team) * .15], cl(m.sp, 1, 3)); this.ev = 'kick'; return; }
      this.release([dir, 0], cl(m.sp * .8, .9, 2.2)); this.passTo = { r: H.r, j: to }; this.ev = 'pass'; return; }
    var dy = m.dy * face(team) > 0 ? m.dy : -m.dy;   // shoot at roughly the flick angle, always toward their goal
    this.release([m.dx, dy], cl(m.sp, 1.2, 3.6)); this.ev = 'shot'; };
  Sim.prototype.release = function (dir, sp) { var H = this.hold; if (!H) return; var m = Math.hypot(dir[0], dir[1]) || 1; this.v = [dir[0] / m * sp, dir[1] / m * sp]; this.cool = { r: H.r, j: H.j, t: .18 }; this.hold = null; };
  Sim.prototype.step = function (dt) {
    var me = this; this.ev = '';
    if (this.over >= 0) return;
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) this.msg = ''; }
    var held = {}; for (var pid in this.hands) held[this.hands[pid].r] = this.hands[pid];
    for (var r = 0; r < 8; r++) { var d = R[r], ts = this.s[r], tk = 0, t = d.t, men = this.men(r), H = held[r];
      if (H) { ts = H.s0 + (H.x - H.x0); tk = H.k0 + (H.y - H.y0); }
      else { // assist (human team) or AI: slide the nearest man under the ball; AI also kicks
        var bx = this.b[0], bi = 0, bd = 9; men.forEach(function (q, j) { var dd = Math.abs(q[0] - bx); if (dd < bd) { bd = dd; bi = j; } });
        ts = this.s[r] + (bx - men[bi][0]); var ai = this.ai[t];
        if (ai) { this.aiT = this.aiT || []; if ((this.aiT[r] || 0) > 0) { this.aiT[r] -= dt; tk = this.aiK[r]; } else { var ahead = (this.b[1] - d.y) * face(t); if (ahead > -.01 && ahead < .09 && bd < HX + BR) tk = KMAX * face(t); else if (ahead <= -.01 && ahead > -.09 && bd < HX + BR && Math.hypot(this.v[0], this.v[1]) < .4) tk = -KMAX * face(t); (this.aiK = this.aiK || [])[r] = tk; this.aiT[r] = .3; } } }
      ts = cl(ts, -d.lim, d.lim); tk = cl(tk, -KMAX, KMAX);
      var spd = H ? 7 : this.ai[t] ? 1.2 : .9, kspd = H ? 7 : 4, ns = this.s[r] + cl(ts - this.s[r], -spd * dt, spd * dt), nk = this.k[r] + cl(tk - this.k[r], -kspd * dt, kspd * dt);
      this.vs[r] = (ns - this.s[r]) / dt; this.vk[r] = (nk - this.k[r]) / dt; this.s[r] = ns; this.k[r] = nk; }
    if (this.pause > 0) return;
    if (this.cool) { this.cool.t -= dt; if (this.cool.t <= 0) this.cool = null; }
    // possession: ball rides on the man's front; a hard forward swing kicks it
    if (this.hold) { var Hd = this.hold, q = this.men(Hd.r)[Hd.j], ft = face(R[Hd.r].t); this.b = [q[0] + Hd.off, q[1] + ft * (HY + BR)]; this.v = [this.vs[Hd.r], this.vk[Hd.r]];
      if (this.vk[Hd.r] * ft > 1.4) { this.release([this.vs[Hd.r] * .3, ft], Math.min(3.4, Math.abs(this.vk[Hd.r]) * .9)); this.ev = 'kick'; }
      else if (this.ai[R[Hd.r].t] && !held[Hd.r]) { Hd.tm = (Hd.tm || 0) + dt; if (Hd.tm > .5 + Math.random() * .6) { if (R[Hd.r].n > 1 && Math.random() < .3) this.act(R[Hd.r].t, Hd.r, { t: 'flick', dx: (Math.random() < .5 ? -1 : 1) * 3, dy: 0, sp: 1.6 }); else this.act(R[Hd.r].t, Hd.r, { t: 'flick', dx: (Math.random() - .5) * 1.2, dy: ft * 3, sp: 2.4 + Math.random() }); } }
      else { Hd.tm = (Hd.tm || 0) + dt; if (Hd.tm > 6) { this.release([0, ft], 1.5); } }
      return; }
    var sub = 4; for (var k = 0; k < sub; k++) { var h = dt / sub; this.b[0] += this.v[0] * h; this.b[1] += this.v[1] * h; var f = Math.exp(-.35 * h); this.v[0] *= f; this.v[1] *= f;
      var x = this.b[0], y = this.b[1];
      if (y < 0 && Math.abs(x - .5) < GW) return this.goal(0); if (y > L && Math.abs(x - .5) < GW) return this.goal(1);
      if (x < BR) { this.b[0] = BR; this.v[0] = Math.abs(this.v[0]) * .85; } if (x > 1 - BR) { this.b[0] = 1 - BR; this.v[0] = -Math.abs(this.v[0]) * .85; }
      if (y < BR && Math.abs(x - .5) >= GW) { this.b[1] = BR; this.v[1] = Math.abs(this.v[1]) * .85; } if (y > L - BR && Math.abs(x - .5) >= GW) { this.b[1] = L - BR; this.v[1] = -Math.abs(this.v[1]) * .85; }
      if (this.passTo) { var pt = this.passTo, pm = this.men(pt.r)[pt.j]; if (Math.abs(this.b[0] - pm[0]) < HX * .8 && Math.abs(this.b[1] - pm[1]) < HY + BR * 2.5) { this.hold = { r: pt.r, j: pt.j, off: 0 }; this.passTo = null; this.ev = 'trap'; return; } if (Math.abs(this.b[1] - R[pt.r].y) > .12) this.passTo = null; }
      // men: circle vs rectangle, moving with the rod
      for (r = 0; r < 8; r++) { var ms = this.men(r); for (var j = 0; j < ms.length; j++) { if (this.cool && this.cool.r === r && this.cool.j === j) continue;
        var cx = cl(this.b[0], ms[j][0] - HX, ms[j][0] + HX), cy = cl(this.b[1], ms[j][1] - HY, ms[j][1] + HY), dx = this.b[0] - cx, dy = this.b[1] - cy, dd = Math.hypot(dx, dy); if (dd >= BR) continue;
        var nx, ny; if (dd < 1e-6) { nx = 0; ny = this.b[1] > ms[j][1] ? 1 : -1; } else { nx = dx / dd; ny = dy / dd; }
        this.b = [cx + nx * BR, cy + ny * BR]; var rvx = this.v[0] - this.vs[r], rvy = this.v[1] - this.vk[r], vn = rvx * nx + rvy * ny, rel = Math.hypot(rvx, rvy), ft2 = face(R[r].t);
        var front = ny * ft2 > .5, target = this.passTo && this.passTo.r === r && this.passTo.j === j;
        if (front && (rel < 1.0 || target)) { this.hold = { r: r, j: j, off: cl(this.b[0] - ms[j][0], -HX, HX) * .5 }; this.passTo = null; this.ev = 'trap'; return; }
        if (vn < 0) { this.v[0] -= 1.8 * vn * nx; this.v[1] -= 1.8 * vn * ny; } var mv = Math.min(3.2, this.vs[r] * nx + this.vk[r] * ny), vb = this.v[0] * nx + this.v[1] * ny; if (mv > 0 && vb < mv) { this.v[0] += (mv - vb) * nx * 1.1; this.v[1] += (mv - vb) * ny * 1.1; } if (mv > .8 && Math.abs(ny) > .5) this.v[0] += (this.b[0] - ms[j][0]) / HX * .9 + (Math.random() - .5) * .8; if (Math.abs(ny) < .5) { var sp4 = Math.hypot(this.v[0], this.v[1]), mx4 = Math.max(Math.abs(this.vs[r]) + .2, 1.2); if (sp4 > mx4) { this.v[0] *= mx4 / sp4; this.v[1] *= mx4 / sp4; } } this.ev = 'hit'; } } }
    var sp2 = Math.hypot(this.v[0], this.v[1]); if (sp2 > 3.8) { this.v[0] *= 3.8 / sp2; this.v[1] *= 3.8 / sp2; }
    if (!this.hold && sp2 < .6) { this.slow = (this.slow || 0) + dt; if (this.slow > 3) { this.slow = 0; this.v = [(.5 - this.b[0]) * 1.5, (Math.random() - .5) * .8]; } } else this.slow = 0;
    if (Math.abs(this.v[1]) < .12 && !this.hold) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 2) { this.stuck = 0; this.v[1] = (Math.random() < .5 ? -1 : 1) * .6; } } else this.stuck = 0;
  };
  Sim.prototype.goal = function (t) { this.sc[t]++; this.ev = 'goal' + t; if (this.sc[t] >= WIN) { this.over = t; this.msg = ''; return; } this.serve(1 - t); this.ev = 'goal' + t; this.msg = 'GOAL!'; this.pause = 1.8; };
  Sim.prototype.snap = function () { function r(x) { return Math.round(x * 1000) / 1000; } var hr = []; for (var p in this.hands) hr.push(this.hands[p].r);
    return { t: 's', s: this.s.map(r), k: this.k.map(r), b: this.b.map(r), h: this.hold ? [this.hold.r, this.hold.j] : null, sc: this.sc, ov: this.over, msg: this.msg, ev: this.ev, hr: hr }; };
  root.Foos = { Sim: Sim, R: R, L: L, BR: BR, HX: HX, HY: HY, GW: GW };
})(window);
