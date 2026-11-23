/* GLIDE PUCK - air hockey sim. Table 1 wide x 2 long. Seat 0 defends y=0, seat 1 defends y=2.
   Puck top speed is about half a real table's (tunable MAXV). Inputs are targets in each seat's OWN frame
   (x 0..1, y 0 = own goal line .. 1 = centre line). */
(function (root) {
  var C = { W: 1, L: 2, PR: .042, MR: .07, GOAL: .32, MAXV: 2.3, MSPD: 7, AISPD: 2.1, FRIC: .25, WIN: 7 };
  function Sim() { this.p = { x: .5, y: .6, vx: 0, vy: 0 }; this.m = [{ x: .5, y: .15, vx: 0, vy: 0, tx: .5, ty: .15 }, { x: .5, y: 1.85, vx: 0, vy: 0, tx: .5, ty: 1.85 }]; this.sc = [0, 0]; this.ev = null; this.over = -1; this.wait = .8; this.ai = [false, false]; }
  Sim.prototype.input = function (seat, x, y) { var m = this.m[seat]; if (seat === 0) { m.tx = x; m.ty = y; } else { m.tx = 1 - x; m.ty = 2 - y; } };
  Sim.prototype.reset = function () { this.sc = [0, 0]; this.over = -1; this.serve(Math.random() < .5 ? 0 : 1); };
  Sim.prototype.serve = function (to) { this.p = { x: .5, y: to === 0 ? .62 : 1.38, vx: 0, vy: 0 }; this.wait = 1; this.drop = .7; };
  Sim.prototype.aiThink = function (s) {
    var p = this.p, m = this.m[s], home = s === 0 ? .14 : 1.86, mine = s === 0 ? p.y < 1 : p.y > 1, toward = s === 0 ? p.vy < .2 : p.vy > -.2;
    if (mine && toward) { m.tx = p.x + (p.x - .5) * .15; m.ty = p.y + (s === 0 ? -.07 : .07); }
    else { m.tx = .5 + (p.x - .5) * .5; m.ty = home; }
  };
  Sim.prototype.step = function (dt) {
    var self = this, p = this.p; this.ev = null;
    if (this.over >= 0) return;
    if (this.drop > 0) this.drop -= dt;
    if (this.cel > 0) { this.cel -= dt; if (this.cel <= 0) this.serve(1 - this.cw); return; }   // goal celebration: everything waits
    for (var s = 0; s < 2; s++) { if (this.ai[s]) this.aiThink(s); var m = this.m[s], sp = this.ai[s] ? C.AISPD : C.MSPD;
      var y0 = s === 0 ? C.MR : 1 + C.MR, y1 = s === 0 ? 1 - C.MR : C.L - C.MR, tx = Math.max(C.MR, Math.min(1 - C.MR, m.tx)), ty = Math.max(y0, Math.min(y1, m.ty));
      var dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), mv = Math.min(d, sp * dt), ox = m.x, oy = m.y; if (d > 1e-6) { m.x += dx / d * mv; m.y += dy / d * mv; }
      m.vx = (m.x - ox) / dt; m.vy = (m.y - oy) / dt; }
    if (this.wait > 0) { this.wait -= dt; return; }
    p.x += p.vx * dt; p.y += p.vy * dt; var f = Math.max(0, 1 - C.FRIC * dt); p.vx *= f; p.vy *= f;
    if (p.x < C.PR) { p.x = C.PR; p.vx = Math.abs(p.vx) * .9; this.ev = 'wall'; } if (p.x > 1 - C.PR) { p.x = 1 - C.PR; p.vx = -Math.abs(p.vx) * .9; this.ev = 'wall'; }
    var inGoal = Math.abs(p.x - .5) < C.GOAL / 2;
    if (p.y < C.PR && !inGoal) { p.y = C.PR; p.vy = Math.abs(p.vy) * .9; this.ev = 'wall'; } if (p.y > C.L - C.PR && !inGoal) { p.y = C.L - C.PR; p.vy = -Math.abs(p.vy) * .9; this.ev = 'wall'; }
    if (p.y < -C.PR) return this.goal(1); if (p.y > C.L + C.PR) return this.goal(0);
    this.m.forEach(function (m) { var dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), md = C.PR + C.MR; if (d >= md || d < 1e-6) return;
      var nx = dx / d, ny = dy / d; p.x = m.x + nx * md; p.y = m.y + ny * md;
      var rvx = p.vx - m.vx, rvy = p.vy - m.vy, vn = rvx * nx + rvy * ny; if (vn < 0) { p.vx -= 1.9 * vn * nx; p.vy -= 1.9 * vn * ny; self.hits = (self.hits || 0) + 1; } self.ev = 'hit'; });
    var v = Math.hypot(p.vx, p.vy); if (v > C.MAXV) { p.vx *= C.MAXV / v; p.vy *= C.MAXV / v; }
  };
  Sim.prototype.goal = function (who) { this.sc[who]++; this.ev = 'goal' + who; if (this.sc[who] >= C.WIN) { this.over = who; this.p = { x: .5, y: 1, vx: 0, vy: 0 }; } else { this.cel = 2.6; this.cw = who; this.p = { x: .5, y: who === 0 ? 2.3 : -.3, vx: 0, vy: 0 }; } };
  Sim.prototype.snap = function () { var p = this.p; return { t: 's', p: [p.x, p.y, p.vx, p.vy], m: this.m.map(function (m) { return [m.x, m.y]; }), sc: this.sc, hits: this.hits || 0, ev: this.ev, over: this.over, cel: Math.max(0, this.cel || 0), cw: this.cw == null ? -1 : this.cw, drop: Math.max(0, this.drop || 0) }; };
  root.Puck = { C: C, Sim: Sim };
})(window);
