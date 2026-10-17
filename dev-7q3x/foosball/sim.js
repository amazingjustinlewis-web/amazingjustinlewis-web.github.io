/* FOOSBALL v0.2 - top-down sim with spinning rods. Table 1 wide (x, across) by L long (y). Team 0 defends y = L (right on TV), attacks y = 0.
   Rods run across the table at fixed y. Left/right thumb slides the rod (s). Forward/back thumb ROTATES the rod (a, radians, +- 90 deg):
   the domino-shaped men roll forward/back; release springs them upright. Ball vs man = real contact against the rotating box
   (rod at height ROD.h, man hangs ROD.len, width 2HX, thickness 2HY): contact point sets the normal (face = straight, edge/corner = angled),
   the man's swing speed at the contact point adds impulse, and a slow man absorbs the ball almost dead (blanket). */
(function (root) {
  'use strict';
  var L = 1.6, BR = .018, HX = .022, HY = .013, GW = .13, WIN = 5;
  var ROD = { h: .045, len: .042 };   // rod height above the table, rod-to-toe length
  // thumb -> rotation: full 90 deg at THUMB.full table units of forward/back travel; max swing rate; spring back on release
  var THUMB = { full: .11, maxW: 60, spring: 12, aiW: 50 };
  // contact feel: restitution / tangential keep for a still man (blanket) vs a fast swing (drill)
  var HIT = { eStill: .04, eFast: .5, keepStill: .25, keepFast: .9, fastAt: 1.4, swingBoost: 1.9, maxV: 4.2 };
  var AI = { track: .75, aim: .9, react: .28 };   // AI rod tracking speed; how hard attackers try to angle shots (contact offset toward the open goal)
  var RODS = [[1, 0, 'G'], [2, .30, 'D'], [3, .27, 'A'], [5, .18, 'M'], [5, .18, 'M'], [3, .27, 'A'], [2, .30, 'D'], [1, 0, 'G']];
  var TEAM = [1, 1, 0, 1, 0, 1, 0, 0];
  var R = RODS.map(function (d, i) { var span = (d[0] - 1) * d[1], lim = Math.max(.06, (1 - span) / 2 - HX - .01); if (d[2] === 'G') lim = .22;
    return { y: L * (i + 1) / 9, n: d[0], sp: d[1], k: d[2], t: TEAM[i], lim: lim }; });
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function face(t) { return t ? 1 : -1; }   // direction team t attacks
  function Sim() { this.ai = [false, true]; this.reset(); }
  Sim.prototype.reset = function () { this.s = R.map(function () { return 0; }); this.a = R.map(function () { return 0; }); this.vs = R.map(function () { return 0; }); this.w = R.map(function () { return 0; });
    this.sc = [0, 0]; this.over = -1; this.hands = {}; this.aiT = []; this.aiA = []; this.serve(Math.random() < .5 ? 0 : 1); };
  Sim.prototype.serve = function (to) { this.b = [.5, L / 2]; this.v = [(Math.random() < .5 ? -1 : 1) * .25, face(to) * -.15 + (Math.random() - .5) * .3]; this.pause = 1.2; this.msg = 'SERVE'; this.ev = ''; };
  Sim.prototype.menX = function (r) { var d = R[r], out = []; for (var j = 0; j < d.n; j++) out.push(.5 + this.s[r] + (j - (d.n - 1) / 2) * d.sp); return out; };
  // projected footprint of a man (for drawing): y-range on the table covered by the tilted box
  Sim.prototype.foot = function (r) { var d = R[r], f = face(d.t), a = this.a[r], sn = Math.sin(a) * f, cs = Math.cos(a), ys = [];
    [[0, -HY], [0, HY], [ROD.len, -HY], [ROD.len, HY]].forEach(function (q) { ys.push(d.y + q[0] * sn + q[1] * cs); }); return [Math.min.apply(null, ys), Math.max.apply(null, ys), ROD.h - ROD.len * cs]; };
  Sim.prototype.rodAt = function (team, y, allowed) { var best = -1, bd = 9; for (var r = 0; r < 8; r++) { if (R[r].t !== team || (allowed && allowed.indexOf(r) < 0)) continue; var d = Math.abs(R[r].y - y); if (d < bd) { bd = d; best = r; } } return best; };
  // input: {t:'grab',x,y} {t:'drag',x,y} {t:'rel'} {t:'tap'}  (forward/back = rotate; flicks are no longer separate actions)
  Sim.prototype.input = function (pid, team, rods, m) {
    if (this.over >= 0) { if (m.t === 'tap') this.reset(); return; }
    var h = this.hands[pid];
    if (m.t === 'grab') { var r = this.rodAt(team, m.y, rods); if (r < 0) return; this.hands[pid] = { r: r, x0: m.x, y0: m.y, s0: this.s[r], a0: this.a[r], x: m.x, y: m.y }; }
    else if (m.t === 'drag' && h) { h.x = m.x; h.y = m.y; }
    else if (m.t === 'rel') { delete this.hands[pid]; } };
  Sim.prototype.step = function (dt) {
    this.ev = ''; if (this.over >= 0) return;
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) this.msg = ''; }
    var held = {}; for (var pid in this.hands) held[this.hands[pid].r] = this.hands[pid];
    for (var r = 0; r < 8; r++) { var d = R[r], t = d.t, f = face(t), H = held[r], ts, ta = null, men = this.menX(r), na;
      if (H) { ts = H.s0 + (H.x - H.x0); ta = cl(H.a0 + (H.y - H.y0) * f / THUMB.full * Math.PI / 2, -Math.PI / 2, Math.PI / 2); }
      else { var bx = this.b[0]; if (this.ai[t]) { this.aiRT = this.aiRT || []; this.aiBX = this.aiBX || []; if ((this.aiRT[r] = (this.aiRT[r] || 0) - dt) <= 0) { this.aiRT[r] = AI.react * (.6 + Math.random() * .8); this.aiBX[r] = bx; } bx = this.aiBX[r]; } var bi = 0, bd = 9; men.forEach(function (q, j) { var dd = Math.abs(q - bx); if (dd < bd) { bd = dd; bi = j; } }); var aimOff = 0; if (this.ai[t]) { this.aimO = this.aimO || []; if (this.aimO[r] == null || Math.random() < dt * 1.5) this.aimO[r] = this.lane(r, bx); aimOff = this.aimO[r]; }
        ts = this.s[r] + (bx - men[bi]) - aimOff;
        if (this.ai[t]) { var ahead = (this.b[1] - d.y) * f; if ((this.aiT[r] || 0) > 0) { this.aiT[r] -= dt; ta = this.aiA[r]; }
          else if (this.aiK && this.aiK[r]) { this.aiK[r] = 0; this.aiA[r] = 1.4; this.aiT[r] = .2; ta = 1.4; }
          else if (ahead > -.005 && ahead < .07 && Math.abs(men[bi] - this.b[0]) < HX + BR && Math.hypot(this.v[0], this.v[1]) < 1.2 && this.pause <= 0) { this.aiA[r] = -1.1; this.aiT[r] = .14; ta = -1.1; this.aiK = this.aiK || []; this.aiK[r] = 1; }   // wind back...
          else if (ahead < -.02 && ahead > -.07 && bd < HX + BR && this.v[1] * f < -.3) { ta = -.25; } } }
      if (!H && ta === null) { var beh = (this.b[1] - d.y) * f, vt = this.v[1] * f; if (beh < -.03 && beh > -.35 && vt > 1.6) ta = -1.5; }   // own shot coming from behind: lift the men so it passes under
      ts = cl(ts, -d.lim, d.lim); var spd = H ? 7 : this.ai[t] ? AI.track : .9, ns = this.s[r] + cl(ts - this.s[r], -spd * dt, spd * dt);
      if (ta !== null) { var mw = H ? THUMB.maxW : THUMB.aiW; na = this.a[r] + cl(ta - this.a[r], -mw * dt, mw * dt); }
      else { var w0 = this.w[r], ac = -THUMB.spring * THUMB.spring * this.a[r] - 2 * THUMB.spring * w0; w0 += ac * dt; na = this.a[r] + w0 * dt; }   // critically damped spring back to upright
      this.vs[r] = (ns - this.s[r]) / dt; this.w[r] = (na - this.a[r]) / dt; this.s[r] = ns; this.a[r] = na; }
    if (this.pause > 0) return;
    var sub = 8; for (var k = 0; k < sub; k++) { var hh = dt / sub; this.b[0] += this.v[0] * hh; this.b[1] += this.v[1] * hh; var fr = Math.exp(-.35 * hh); this.v[0] *= fr; this.v[1] *= fr;
      var x = this.b[0], y = this.b[1];
      if (y < 0 && Math.abs(x - .5) < GW) return this.goal(0); if (y > L && Math.abs(x - .5) < GW) return this.goal(1);
      if (x < BR) { this.b[0] = BR; this.v[0] = Math.abs(this.v[0]) * .8; } if (x > 1 - BR) { this.b[0] = 1 - BR; this.v[0] = -Math.abs(this.v[0]) * .8; }
      if (y < BR && Math.abs(x - .5) >= GW) { this.b[1] = BR; this.v[1] = Math.abs(this.v[1]) * .8; } if (y > L - BR && Math.abs(x - .5) >= GW) { this.b[1] = L - BR; this.v[1] = -Math.abs(this.v[1]) * .8; }
      for (r = 0; r < 8; r++) { if (Math.abs(this.b[1] - R[r].y) > ROD.len + HY + BR) continue; var ms = this.menX(r); for (var j = 0; j < ms.length; j++) this.contact(r, ms[j]); } }
    var sp2 = Math.hypot(this.v[0], this.v[1]); if (sp2 > HIT.maxV) { this.v[0] *= HIT.maxV / sp2; this.v[1] *= HIT.maxV / sp2; }
    // dead ball nudge: if it sits still out of reach for a while, roll it gently toward the middle
    // dead zone between rods (no man can reach): a slow ball there gets a gentle roll toward the nearest rod, like a slightly dished table
    if (sp2 < .25 && !this.reach()) { this.slow = (this.slow || 0) + dt; if (this.slow > 1.0) { var nr = 0, nd = 9; for (var q = 0; q < 8; q++) { var dq = R[q].y - this.b[1]; if (Math.abs(dq) < Math.abs(nd)) { nd = dq; nr = q; } } this.v[1] += Math.sign(nd) * .5 * dt * 4; this.v[0] += (.5 - this.b[0]) * .3 * dt; } } else this.slow = 0;
    if (sp2 < .02 && this.reach()) { this.still = (this.still || 0) + dt; if (this.still > 6) { this.still = 0; this.v = [(Math.random() - .5) * .6, (Math.random() - .5) * .6]; } } else this.still = 0;
  };
  // AI: pick a shot angle that threads the next opposing rod (and aims at the goal for attackers); return the contact offset that makes it
  Sim.prototype.lane = function (r, bx) { var d = R[r], f = face(d.t), best = 0, bs = -9, nxt = -1; for (var q = 0; q < 8; q++) { var dq = (R[q].y - d.y) * f; if (dq > .01 && R[q].t !== d.t && (nxt < 0 || dq < (R[nxt].y - d.y) * f)) nxt = q; }
    for (var th = -.36; th <= .36; th += .06) { var sc = 0; if (nxt >= 0) { var dy = Math.abs(R[nxt].y - d.y), px = bx + Math.tan(th) * dy, ms = this.menX(nxt); var md = 9; ms.forEach(function (m) { md = Math.min(md, Math.abs(m - px)); }); sc = md - (px < .02 || px > .98 ? .2 : 0); if (R[nxt].k === 'G') { var gy = Math.abs((d.t ? L : 0) - d.y), gxp = bx + Math.tan(th) * gy; sc += Math.abs(gxp - .5) < GW * .8 ? .05 : -.05; } }
      sc += (Math.random() - .5) * .02; if (sc > bs) { bs = sc; best = th; } }
    return -cl(best / .37, -1, 1) * .025 * AI.aim; };
  Sim.prototype.reach = function () { for (var r = 0; r < 8; r++) if (Math.abs(this.b[1] - R[r].y) < ROD.len * .9) return true; return false; };
  // ball (sphere on the table) vs one man: box in rod-local frame (x across, u along the man from the rod, w thickness)
  Sim.prototype.contact = function (r, mx) {
    var d = R[r], f = face(d.t), a = this.a[r], sn = Math.sin(a), cs = Math.cos(a);
    var dx = this.b[0] - mx, dy = (this.b[1] - d.y) * f, dz = BR - ROD.h;   // ball centre rel. to rod pivot, y measured toward the attack
    var u = dy * sn - dz * cs, w = dy * cs + dz * sn;                       // into the man's frame: u along the man (down at a=0), w across its thickness
    var cx = cl(dx, -HX, HX), cu = cl(u, 0, ROD.len), cw = cl(w, -HY, HY), ex = dx - cx, eu = u - cu, ew = w - cw, dist = Math.sqrt(ex * ex + eu * eu + ew * ew);
    if (dist >= BR) return;
    var nx, nu, nw; if (dist < 1e-7) { nx = 0; nu = 0; nw = w >= 0 ? 1 : -1; dist = 0; } else { nx = ex / dist; nu = eu / dist; nw = ew / dist; }
    var ny = (nu * sn + nw * cs), nz = (-nu * cs + nw * sn);                // back to table frame (y toward attack)
    var hn = Math.hypot(nx, ny); if (hn < .15) { nx = 0; ny = w >= 0 ? 1 : -1; hn = 1; }   // pressed straight down: push out along the face
    nx /= hn; ny /= hn; var push = (BR - dist) / Math.max(.3, hn); this.b[0] += nx * push; this.b[1] += ny * f * push;
    // man velocity at the contact point: swing about the rod (only y in the table plane) + rod slide (x)
    var cuP = cu, cwP = cw, pyRel = cuP * sn + cwP * cs, pzRel = -cuP * cs + cwP * sn, om = this.w[r];
    var mvy = -om * pzRel, mvx = this.vs[r];                                  // d/dt of rotation about x: y' = -w * z
    var bvx = this.v[0], bvy = this.v[1] * f, rvx = bvx - mvx, rvy = bvy - mvy * HIT.swingBoost, vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    var msp = Math.abs(mvy * nx * 0 + mvy * ny) + Math.abs(mvx * nx), kf = cl(msp / HIT.fastAt, 0, 1), e = HIT.eStill + (HIT.eFast - HIT.eStill) * kf, keep = HIT.keepStill + (HIT.keepFast - HIT.keepStill) * kf;
    var tx = rvx - vn * nx, ty = rvy - vn * ny; rvx = -e * vn * nx + tx * keep; rvy = -e * vn * ny + ty * keep;
    this.v[0] = rvx + mvx; this.v[1] = (rvy + mvy * HIT.swingBoost) * f;
    if (msp > HIT.fastAt * .6) this.ev = 'kick'; else if (!this.ev) this.ev = 'hit'; };
  Sim.prototype.goal = function (t) { this.sc[t]++; this.ev = 'goal' + t; if (this.sc[t] >= WIN) { this.over = t; this.msg = ''; return; } this.serve(1 - t); this.ev = 'goal' + t; this.msg = 'GOAL!'; this.pause = 1.8; };
  Sim.prototype.snap = function () { function q(x) { return Math.round(x * 1000) / 1000; } var hr = []; for (var p in this.hands) hr.push(this.hands[p].r);
    return { t: 's', s: this.s.map(q), a: this.a.map(q), b: this.b.map(q), sc: this.sc, ov: this.over, msg: this.msg, ev: this.ev, hr: hr }; };
  root.Foos = { Sim: Sim, R: R, L: L, BR: BR, HX: HX, HY: HY, GW: GW, ROD: ROD, THUMB: THUMB, HIT: HIT, face: face };
})(typeof window !== 'undefined' ? window : global);
