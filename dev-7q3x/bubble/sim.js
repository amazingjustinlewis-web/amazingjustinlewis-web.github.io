/* BUBBLE HOCKEY v0.1 - table-top rod hockey sim. Rink is 1 wide x 1.8 long. Team 0 defends the bottom goal and attacks up; team 1 is the
   point-mirror (x -> 1-x, y -> 1.8-y). Every player rides a fixed track (u = 0..1). AI slides everyone you are not touching. */
(function (root) {
  'use strict';
  var L = 2.0, PR = .022, R = .034, GW = .07, GY = .128, BL = .66, REACH = .055, GOALP = 9.4, MAGR = .045, MAGK = .0007, WIN = 5, TIME = 180;
  // v0.3 tracks come from tracks.js (sketch pixels, Catmull-Rom). Team 0 = sketch green (guards y=L), team 1 = sketch blue (guards y=0).
  var TB = root.BUBBLE_TRACKS, SK = TB.sketch;
  function sk(q) { return [(q[1] - SK.y0) / (SK.y1 - SK.y0), (q[0] - SK.x0) / (SK.x1 - SK.x0) * L]; }
  function spline(P) { var out = [P[0]]; for (var j = 0; j < P.length - 1; j++) { var p0 = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], p3 = P[Math.min(P.length - 1, j + 2)];
      for (var k = 1; k <= 8; k++) { var t = k / 8, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(function (d) { return .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3); })); } } return out; }
  var TR = []; [['green', 0], ['blue', 1]].forEach(function (g) { TB[g[0]].forEach(function (k) { var p = spline(k.pts.map(sk)), cum = [0], t = g[1];
    for (var j = 1; j < p.length; j++) cum.push(cum[j - 1] + Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]));
    TR.push({ p: p, cum: cum, len: cum[cum.length - 1], k: k.k, sl: k.sl, t: t, a: p[0], b: p[p.length - 1] }); }); });
  // v0.7 tunables. SL: visual/solid stick = 25% of the track's sl; the old reach is kept by a weak blade magnet out to (sl * MAGOUT).
  var SL = .25, MAGOUT = .85, MAG2K = .00035, AISPD = .9;
  // v0.8: snag (thumb-down pick), one-timer, body checks
  var SNAG = { t: .45, spd: 4.2, free: .05 }, OT = { arm: 2.5, base: 2, press: 4, bounce: 3, max: 10, sp: 3.3 }, CHK = { min: .5, hard: 1.5, kb: .55, down: 1.5, cd: .4, maxO: .16 };
  var FO = { vz: 1.05, grabZ: .03 };   // faceoff: puck pops straight up out of the centre slot
  var HACK = { r: .14, max: Infinity, reach: .035, kick: 1.3, steal: .35 };   // slow-mo scramble: taps make your players near the puck jab at it (max = cap on players in the sphere)
  var AI = { goalieOut: .045, dMid: .22, dPress: .16, dStretch: .05, safeRe: .4, beat: .35, press: .055, rimP: .35, oneT: .4 };
  function cl(v, a, b) { return v < a ? a : v > b ? b : v; }
  function proj(tr, x, y) { var best = 0, bd = 9; for (var j = 1; j < tr.p.length; j++) { var a = tr.p[j - 1], b = tr.p[j], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, f = cl(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1), px = a[0] + dx * f - x, py = a[1] + dy * f - y, d = px * px + py * py;
    if (d < bd) { bd = d; best = (tr.cum[j - 1] + Math.sqrt(l2) * f) / tr.len; } } return best; }
  function pos(tr, u) { var s = cl(u, 0, 1) * tr.len; for (var j = 1; j < tr.p.length; j++) if (s <= tr.cum[j] || j === tr.p.length - 1) { var a = tr.p[j - 1], b = tr.p[j], f = (s - tr.cum[j - 1]) / ((tr.cum[j] - tr.cum[j - 1]) || 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } }
  function adiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
  function face(t) { return t ? 1 : -1; }   // y direction a team attacks
  function goalOf(t) { return t ? L - GY : GY; } // the goal line team t shoots at
  function Sim() { this.ai = [false, true]; this.diff = .85; this.reset(); }
  Sim.prototype.reset = function () { this.u = TR.map(function (tr) { return tr.k === 'G' || tr.k === 'D' ? .5 : .5; }); this.sc = [0, 0]; this.time = TIME; this.over = -1; this.grab = []; this.fing = []; for (var h0 = 0; h0 < 10; h0++) { this.grab.push(-1); this.fing.push(null); } this.side = 0; this.o = TR.map(function () { return [0, 0]; }); this.ko = TR.map(function () { return [0, 0]; }); this.dn = TR.map(function () { return 0; }); this.sn = TR.map(function () { return 0; }); this.ln = TR.map(function () { return 0; }); this.ot = [null, null]; this.lf = [-9, -9, -9, -9, -9, -9, -9, -9, -9, -9]; this.cd = {}; this.prevP = []; this.ang = TR.map(function (tr) { return tr.t ? Math.PI / 2 : -Math.PI / 2; }); this.faceoff(); };
  Sim.prototype.faceoff = function () { this.p = [.5, L / 2]; this.z = 0; this.vz = 0; this.launch = true; this.air = false; this.v = [(Math.random() - .5) * .25, (Math.random() - .5) * .25]; this.c = -1; this.pause = 1.1; this.msg = 'FACE OFF'; this.to = -1; this.cool = -1; this.coolT = 0; this.hold = 0; this.ev = ''; };
  Sim.prototype.pp = function (i) { var q = pos(TR[i], this.u[i]), o = this.o ? this.o[i] : null; return o ? [q[0] + o[0], q[1] + o[1]] : q; };
  Sim.prototype.team = function (i) { return i < 6 ? 0 : 1; };
  Sim.prototype.carryPos = function () { var i = this.c, P = this.pp(i), a = this.ang[i], d = R * .5 + TR[i].sl * SL * .75 + PR * .9; return [P[0] + Math.cos(a) * d, P[1] + Math.sin(a) * d]; };
  Sim.prototype.tip = function (i) { var P = this.pp(i), a = this.ang[i], d = R * .5 + TR[i].sl * SL; return [P[0] + Math.cos(a) * d, P[1] + Math.sin(a) * d]; };
  Sim.prototype.release = function (dir, sp, to, pt) { var i = this.c; if (i < 0) return; var m = Math.hypot(dir[0], dir[1]) || 1; this.ang[i] = Math.atan2(dir[1], dir[0]); this.swing = [i, .18]; this.p = this.carryPos(); if (pt) { dir = [pt[0] - this.p[0], pt[1] - this.p[1]]; m = Math.hypot(dir[0], dir[1]) || 1; } this.v = [dir[0] / m * sp, dir[1] / m * sp]; this.cool = i; this.coolT = .25; this.z = 0; this.vz = sp > 2.0 ? Math.min(.6, (sp - 2.0) * .6 * (.3 + Math.random())) : 0; this.to = to == null ? -1 : to; this.c = -1; this.hold = 0; this.side = 0; };
  Sim.prototype.shoot = function (dir, sp) { var i = this.c; if (i < 0) return; var t = this.team(i), cp = this.carryPos(), gy = goalOf(t);
    if (!dir) { var ln = this.lane(cp, t); dir = [ln[0], ln[1]]; var pt = [ln[3][0] + (Math.random() - .5) * .03, ln[3][1]]; sp = 2.8; }
    this.release(dir, cl(sp || 2.6, 1.4, 3.5), null, pt); this.ev = 'shot'; };
  // pick the most open lane to the net: sample aim points across the mouth, score by clearance from every body and stick blade on the way
  Sim.prototype.lane = function (cp, t) { var gy = goalOf(t), best = .5, bc = -1, me = this;
    for (var k = -4; k <= 4; k++) { var ax = .5 + k / 4 * GW * .45, dx = ax - cp[0], dy = gy - face(t) * .02 - cp[1], l2 = dx * dx + dy * dy, cmin = 9;
      for (var i = 0; i < 12; i++) { if (i === this.c) continue; [this.pp(i), this.tip(i)].forEach(function (q) { var f = cl(((q[0] - cp[0]) * dx + (q[1] - cp[1]) * dy) / l2, 0, 1); if (f < .02) return; var d = Math.hypot(cp[0] + dx * f - q[0], cp[1] + dy * f - q[1]); if (d < cmin) cmin = d; }); }
      cmin -= Math.abs(k) * .002; if (cmin > bc) { bc = cmin; best = ax; } }
    return [best - cp[0], gy - cp[1], bc, [best, gy - face(t) * .02]]; };
  // pass: generous aim assist. Picks the teammate closest in angle (within 75 deg). Within 40% of that cone the pass is near-straight;
  // further off, the pass errs in proportion to how far off the flick was.
  Sim.prototype.pass = function (dir, sp) { var i = this.c; if (i < 0) return; var t = this.team(i), cp = this.carryPos(), fa = Math.atan2(dir[1], dir[0]), best = -1, bd = 9, me = this;
    var gy = goalOf(t), ga = Math.atan2(gy - cp[1], .5 - cp[0]), gd = Math.abs(Math.atan2(Math.sin(fa - ga), Math.cos(fa - ga)));
    for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), a = Math.atan2(q[1] - cp[1], q[0] - cp[0]), d = Math.atan2(Math.sin(fa - a), Math.cos(fa - a)); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = j; } }
    var CONE = 75 * Math.PI / 180, W = CONE * .4;
    if (gd < Math.min(.45, Math.abs(bd)) && (cp[1] - gy) * face(t) < 0 && sp > 1.6) { this.shoot(dir, sp * 1.1); return 'shot'; }
    if (best < 0 || Math.abs(bd) > CONE) { this.release(dir, cl(sp, .8, 2.2)); return 'loose'; }
    var q2 = this.pp(best), exact = Math.atan2(q2[1] - cp[1], q2[0] - cp[0]), ad = Math.abs(bd), err = ad <= W ? ad * .12 : W * .12 + (ad - W) * .75;
    var ang = exact + Math.sign(bd) * err, dist = Math.hypot(q2[0] - cp[0], q2[1] - cp[1]);
    this.release([Math.cos(ang), Math.sin(ang)], cl(sp, .8, 3.2), best); this.ev = 'pass'; return best; };
  // input from a team (local or over the net): {t:'grab',i} {t:'drag',x,y} {t:'rel'} {t:'tap'} {t:'flick',dx,dy,sp}
  Sim.prototype.fg = function (i) { for (var h = 0; h < 10; h++) if (this.grab[h] === i && this.fing[h]) return this.fing[h]; return null; };
  Sim.prototype.held = function (t) { for (var h = t; h < 10; h += 2) if (this.grab[h] >= 0) return true; return false; };
  // hand (default = team) lets several phones share a side; allow = list of player indexes that phone may grab
  Sim.prototype.input = function (team, m, hand, allow) { if (hand == null) hand = team;
    if (this.over >= 0) { if (m.t === 'tap') this.reset(); return; }
    if ((m.t === 'tap' || m.t === 'skip') && this.msg === 'GOAL!' && this.pause > 1.05) { this.pause = 1.05; return; }   // tap-to-skip the goal pause
    if (m.t === 'tap' && this.mo && (this.c < 0 || this.team(this.c) !== team)) { this.hack(team, allow); return; }
    if (m.t === 'tap' && this.c < 0 || (m.t === 'tap' && this.team(this.c) !== team)) { if ((this.clk || 0) - this.lf[hand] < OT.arm) { this.ot[team] = { t: this.clk, hand: hand }; this.ev = 'arm'; } return; }
    if (m.t === 'grab') { var gi = (m.i >= team * 6 && m.i < team * 6 + 6 && (!allow || allow.indexOf(m.i) >= 0)) ? m.i : -1; this.grab[hand] = gi; this.fing[hand] = null;
      if (gi >= 0 && m.snag && TR[gi].k !== 'G' && gi !== this.c && this.dn[gi] <= 0 && this.clear(this.pp(gi), team) > SNAG.free) { this.sn[gi] = SNAG.t; this.ln[gi] = .4; this.ev = 'snag'; } }
    else if (m.t === 'drag') this.fing[hand] = [m.x, m.y];
    else if (m.t === 'rel') { this.grab[hand] = -1; this.fing[hand] = null; }
    else if (this.c >= 0 && this.team(this.c) === team && this.pause <= 0) { if (m.t === 'tap') this.shoot(); else if (m.t === 'flick') { this.pass([m.dx, m.dy], m.sp); this.lf[hand] = this.clk || 0; } } };
  // clearance of a point from the other team's bodies and blades
  Sim.prototype.clear = function (q, t) { var m = 9; for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { var a = this.pp(j), b = this.tip(j); m = Math.min(m, Math.hypot(a[0] - q[0], a[1] - q[1]), Math.hypot(b[0] - q[0], b[1] - q[1])); } return m; };
  // safest spot along player i's track (sampled), nudged toward the attacking end; cached for AI.safeRe seconds
  Sim.prototype.safeU = function (i) { this.spot = this.spot || []; var S = this.spot[i], now = this.clk || 0; if (S && now - S.t < AI.safeRe) return S.u;
    var tr = TR[i], t = tr.t, best = this.u[i], bs = -9; for (var k = 0; k <= 8; k++) { var u = cl(this.u[i] + (k - 4) * .06, 0, 1), q = pos(tr, u), sc = Math.min(.12, this.clear(q, t)) - Math.abs(q[1] - goalOf(t)) * .03 - Math.abs(u - this.u[i]) * .05; if (sc > bs) { bs = sc; best = u; } }
    this.spot[i] = { u: best, t: now }; return best; };
  // where a non-held player wants to be
  Sim.prototype.aiWant = function (i, tgt, own, dt) { var tr = TR[i], t = tr.t, k = tr.k; this.pk = this.pk || []; this.pk[i] = null; if (i === this.to) return this.u[i];   // pass receiver waits where the pass was aimed
    if (k === 'G') { var gy = t ? GY : L - GY, gc = [.5, gy], dx = tgt[0] - gc[0], dy = tgt[1] - gc[1], m = Math.hypot(dx, dy) || 1; return proj(tr, gc[0] + dx / m * AI.goalieOut, gc[1] + dy / m * AI.goalieOut); }   // on the puck line, squared to the shooter
    if (own === 1 - t && this.c >= 0) { var cp = this.carryPos(), mine = (cp[1] - L / 2) * face(t) < 0;   // opponent has it
      if (k === 'D' && mine && Math.abs(cp[0] - .5) < AI.dMid) { var u = proj(tr, cp[0], cp[1]), q = pos(tr, u); if (Math.hypot(q[0] - cp[0], q[1] - cp[1]) < AI.dPress) this.pk[i] = cp; return u; } }
    if (own === t && this.c >= 0) { if (k === 'W' || k === 'C') return this.safeU(i); }   // forwards hunt open one-timer spots
    var lead = own === t && k !== 'D' ? face(t) * .12 : 0; return proj(tr, tgt[0], tgt[1] + lead); };
  Sim.prototype.aiCarrier = function (dt) { var i = this.c, t = this.team(i), P = this.pp(i), gy = goalOf(t); this.hold += dt; if (this.hold > 2.6 && TR[i].k === 'G') { this.release([0, face(t)], 1.6); this.ev = 'pass'; return; }
    var P0 = this.pp(i); this.aimA = Math.atan2(gy - P0[1], .5 - P0[0]) + Math.sin(this.hold * 7 + i) * .7;
    if (this.hold < .55 + (1 - this.diff) * .8) return;
    var cpp = this.carryPos(), pres = this.clear(cpp, t) < AI.press, settled = Math.abs(this.safeU(i) - this.u[i]) < .02; this.beatT = settled ? (this.beatT || 0) + dt : 0;
    if (!pres && this.beatT < AI.beat && this.hold < 2.4) return;
    if (TR[i].k === 'D' && Math.abs(P[1] - (t ? GY : L - GY)) < .45 && Math.random() < AI.rimP) { var mates = [], me = this; for (var j = t * 6; j < t * 6 + 6; j++) if (j !== i && TR[j].k !== 'G') mates.push(j);
      var D2 = mates.filter(function (j) { return TR[j].k === 'D'; })[0], Wg = mates.filter(function (j) { return TR[j].k === 'W'; }).sort(function (a, b) { return Math.abs(me.pp(a)[0] - P[0]) - Math.abs(me.pp(b)[0] - P[0]); })[0];
      var by = t ? .05 : L - .05, tgtM, ref;
      if (D2 != null && Math.random() < .5) { tgtM = D2; var q3 = this.pp(D2); ref = [q3[0], 2 * by - q3[1]]; }   // rim behind the net off the end boards
      else if (Wg != null) { tgtM = Wg; var q4 = this.pp(Wg), bx = q4[0] < .5 ? 0 : 1; ref = [2 * bx - q4[0], q4[1]]; }   // hard around the side boards up to a forward
      if (ref) { this.release([ref[0] - cpp[0], ref[1] - cpp[1]], 2.8, tgtM); this.ev = 'rim'; return; } }
    var dg = Math.abs(P[1] - gy); if (dg < .62 || (TR[i].k === 'C' && dg < .8)) { var ln = this.lane(this.carryPos(), t); if (ln[2] < PR + .01 && this.hold < 2.2 && dg > .3) return; ln[3][0] += (Math.random() - .5) * .06 * (1.4 - this.diff); this.release([ln[0], ln[1]], 2.5, null, ln[3]); this.ev = 'shot'; return; }
    var best = -1, by = 9; for (var j = t * 6; j < t * 6 + 6; j++) { if (j === i) continue; var q = this.pp(j), adv = Math.abs(q[1] - gy); if (adv < Math.abs(P[1] - gy) - .05 && adv < by) { by = adv; best = j; } }
    if (best < 0) best = t * 6 + 4; var cp = this.carryPos(), q2 = this.pp(best), dx = q2[0] - cp[0], dy = q2[1] - cp[1], e = (Math.random() - .5) * .3 * (1.2 - this.diff), a = Math.atan2(dy, dx) + e;
    this.release([Math.cos(a), Math.sin(a)], cl(Math.hypot(dx, dy) * 2.4 + .7, 1.1, 2.4), best); this.ev = 'pass'; };
  Sim.prototype.step = function (dt) {
    var me = this, F; this.ev = ''; this.clk = (this.clk || 0) + dt;
    if (this.over >= 0) return;
    this.time -= dt; if (this.time <= 0) { this.time = 0; if (this.sc[0] !== this.sc[1]) { this.over = this.sc[0] > this.sc[1] ? 0 : 1; return; } this.msg = 'SUDDEN DEATH'; }
    if (this.swing) this.swing[1] -= dt;
    if (this.pause > 0) { this.pause -= dt; if (this.pause <= 0) { this.msg = '';
      if (this.launch) { this.launch = false; this.p = [.5, L / 2]; this.v = [(Math.random() - .5) * .16, (Math.random() - .5) * .16]; this.z = .002; this.vz = FO.vz * (.92 + Math.random() * .16); this.air = true; this.ev = 'launch'; } } }
    // move players
    var tgt = this.c >= 0 ? this.carryPos() : [this.p[0] + this.v[0] * .18, this.p[1] + this.v[1] * .18], own = this.c >= 0 ? this.team(this.c) : -1;
    for (var i = 0; i < 12; i++) { var tr = TR[i], t = tr.t, want, spd;
      if (this.dn[i] > 0) { want = this.u[i]; spd = 0; }
      else if (this.sn[i] > 0 && this.c !== i) { want = proj(tr, this.p[0], this.p[1]); spd = SNAG.spd; }
      else if ((F = this.fg(i))) { want = proj(tr, F[0], F[1]); spd = 3.2;
        }
      else if (i === this.c && this.ai[t]) { want = this.safeU(i); spd = .35 * AISPD; }
      else if (i === this.c) { want = this.u[i]; spd = 0; this.side *= Math.exp(-dt * 2); }
      else { want = this.aiWant(i, tgt, own, dt); spd = AISPD * (this.ai[t] ? .75 + this.diff * .35 : 1.0) * (tr.k === 'G' ? 1.6 : tr.k === 'D' && own >= 0 && own !== t ? .8 : 1); }
      var du = want - this.u[i], mx = spd * dt / tr.len; this.u[i] += cl(du, -mx, mx);
      // stretch off the line toward the finger: offset saturates at REACH with an inverse-cube pull back
      if (this.sn[i] > 0) this.sn[i] -= dt; if (this.ln[i] > 0) this.ln[i] -= dt;
      var oo = this.o[i], kv = this.ko[i]; if (tr.k === 'G') { oo[0] = oo[1] = 0; kv[0] = kv[1] = 0; }   // goalie stays on his crease line
      else if (kv[0] || kv[1] || this.dn[i] > 0) { oo[0] += kv[0] * dt; oo[1] += kv[1] * dt; var kd = Math.exp(-dt * 3.5); kv[0] *= kd; kv[1] *= kd; if (Math.abs(kv[0]) + Math.abs(kv[1]) < .01) kv[0] = kv[1] = 0;
        var om = Math.hypot(oo[0], oo[1]); if (om > CHK.maxO) { oo[0] *= CHK.maxO / om; oo[1] *= CHK.maxO / om; kv[0] *= -.4; kv[1] *= -.4; this.ev = 'thud'; }   // springs/bounces back at the max knockback
        var bp = pos(tr, this.u[i]), wx = bp[0] + oo[0], wy = bp[1] + oo[1]; if (wx < .03 || wx > .97) { kv[0] = -kv[0] * .5; oo[0] = cl(wx, .03, .97) - bp[0]; }
        for (var gs2 = 0; gs2 < 2; gs2++) { var gl2 = gs2 ? L - GY : GY, dr2 = gs2 ? 1 : -1, ps2 = (wy - gl2) * dr2; if (Math.abs(wx - .5) < GW + .02 && ps2 > -.02 && ps2 < .07) { kv[1] = -kv[1] * .6; kv[0] = kv[0] * .6 + (wx > .5 ? .3 : -.3); oo[1] += (ps2 < .025 ? -1 : 1) * dr2 * .01; this.ev = 'netbang'; } }
        if (this.dn[i] > 0) { this.dn[i] -= dt; var sl2 = Math.exp(-dt * 1.2); oo[0] *= sl2; oo[1] *= sl2; } else { var dk0 = Math.exp(-dt * 5); oo[0] *= dk0; oo[1] *= dk0; } }
      else if ((F = this.fg(i))) { var bq = pos(tr, this.u[i]), ddx = F[0] - bq[0], ddy = F[1] - bq[1], m = Math.hypot(ddx, ddy) || 1e-6, eff = m / Math.cbrt(1 + Math.pow(m / REACH, 3)), kk = Math.min(1, dt * 18);
        oo[0] += (ddx / m * eff - oo[0]) * kk; oo[1] += (ddy / m * eff - oo[1]) * kk; } else if (this.pk && this.pk[i]) { var pk = this.pk[i], bq2 = pos(tr, this.u[i]), ex = pk[0] - bq2[0], ey = pk[1] - bq2[1], em = Math.hypot(ex, ey) || 1e-6, ef = Math.min(em, AI.dStretch), k2 = Math.min(1, dt * 6); oo[0] += (ex / em * ef - oo[0]) * k2; oo[1] += (ey / em * ef - oo[1]) * k2; } else { var dk = Math.exp(-dt * 9); oo[0] *= dk; oo[1] *= dk; }
      var P = this.pp(i), ta;
      if (tr.k !== 'G' && (F = this.fg(i)) && Math.hypot(F[0] - P[0], F[1] - P[1]) > R * .8) ta = Math.atan2(F[1] - P[1], F[0] - P[0]);
      else if (i === this.c) ta = this.aimA != null && this.ai[t] ? this.aimA : Math.atan2(goalOf(t) - P[1], .5 - P[0]) + Math.sin(this.hold * 6 + i) * .6;
      else ta = Math.atan2(tgt[1] - P[1], tgt[0] - P[0]);
      var rate = i === this.c ? 7 : 10; this.ang[i] += cl(adiff(ta, this.ang[i]), -rate * dt, rate * dt); }
    this.checks(dt);
    if (this.pause > 0) return;
    if (this.c >= 0 && this.c !== this.lastC) this.onCatch(this.c); this.lastC = this.c;
    if (this.coolT > 0) { this.coolT -= dt; if (this.coolT <= 0) this.cool = -1; }
    if (this.c >= 0) { var ct = this.team(this.c);
      if (this.ai[ct] && !this.held(ct)) this.aiCarrier(dt); else { this.hold += dt; if (this.hold > 6) { this.ev = 'auto'; this.pass([0, face(ct)], 1.6); } }
      if (this.c >= 0) { var cp = this.carryPos(); this.p = cp; this.v = [0, 0]; this.z = 0; this.vz = 0;
        for (i = (1 - ct) * 6; i < (1 - ct) * 6 + 6; i++) { var q = this.tip(i); if (Math.hypot(q[0] - cp[0], q[1] - cp[1]) < PR + .02) { if (Math.random() < dt * 2.2) { this.c = i; this.hold = 0; this.side = 0; this.ev = 'steal'; } else if (Math.random() < dt * 2) { var n = [cp[0] - q[0], cp[1] - q[1]], m = Math.hypot(n[0], n[1]) || 1; this.cool = this.c; this.coolT = .3; this.c = -1; this.v = [n[0] / m * .7, n[1] / m * .7]; this.ev = 'poke'; } break; } } }
      if (this.c >= 0) return; }
    // loose puck
    var sub = 3; for (var k = 0; k < sub; k++) { var h = dt / sub; this.p[0] += this.v[0] * h; this.p[1] += this.v[1] * h; var f = Math.exp(-.55 * h); this.v[0] *= f; this.v[1] *= f;
      // tight inverse-square magnet around each stick blade so the puck isn't lost on tight edges
      for (var mg = 0; mg < 12 && this.z < .016; mg++) { if (mg === this.cool) continue; var bt = this.tip(mg), mx2 = bt[0] - this.p[0], my2 = bt[1] - this.p[1], md = Math.hypot(mx2, my2); var mr = Math.max(MAGR, TR[mg].sl * MAGOUT); if (md > mr || md < .004) continue; var acc = Math.min(6, MAGK / (md * md) + MAG2K / (md * md) * (1 - md / mr)); this.v[0] += mx2 / md * acc * h; this.v[1] += my2 / md * acc * h; }
      // 3D puck height: gravity, strong pull back to the ice (upward motion damped), low bounce on landing
      if (this.z > 0 || this.vz > 0) { this.vz -= 3.5 * h; if (this.vz > 0) this.vz *= Math.exp(-h * 1.4); this.z += this.vz * h; if (this.z <= 0) { this.z = 0; if (this.vz < -.18) { this.vz = -this.vz * .32; this.ev = this.ev || 'land'; } else this.vz = 0; } }
      var x = this.p[0], y = this.p[1], NH = .045, ND = .05, sp0 = Math.hypot(this.v[0], this.v[1]);
      // goal only when the puck centre (50% of it) is past the goal line, under the crossbar, inside the posts
      for (var gs = 0; gs < 2; gs++) { var gl = gs ? L - GY : GY, dir = gs ? 1 : -1, past = (y - gl) * dir, inM = Math.abs(x - .5) < GW - PR * .3;
        if (inM && past > 0 && past < ND) { if (this.z < NH) { this.goal(gs); return; } if (this.v[1] * dir > 0) { this.v[1] = -this.v[1] * .45; this.vz = Math.abs(this.vz) * .3 + .05; this.ev = 'net'; } }
        // back/sides of the net cage: bounce off from outside
        var bx = Math.abs(x - .5); if (this.z < NH && bx < GW + PR && past > ND - .004 && past < ND + PR) { this.p[1] = gl + dir * (ND + PR); this.v[1] = Math.abs(this.v[1]) * dir * .6; this.lift(sp0); this.ev = 'net'; }
        if (this.z < NH && past > 0 && past < ND && bx > GW - PR * .3 && bx < GW + PR) { var sg = x > .5 ? 1 : -1; this.p[0] = .5 + sg * (GW + PR); this.v[0] = Math.abs(this.v[0]) * sg * .6; this.lift(sp0); this.ev = 'net'; } }
      if (x < PR) { this.p[0] = PR; this.v[0] = Math.abs(this.v[0]) * .8; this.lift(sp0); } if (x > 1 - PR) { this.p[0] = 1 - PR; this.v[0] = -Math.abs(this.v[0]) * .8; this.lift(sp0); }
      if (y < .05 + PR) { this.p[1] = .05 + PR; this.v[1] = Math.abs(this.v[1]) * .8; this.lift(sp0); } if (y > L - .05 - PR) { this.p[1] = L - .05 - PR; this.v[1] = -Math.abs(this.v[1]) * .8; this.lift(sp0); }
      // posts
      [[.5 - GW, GY], [.5 + GW, GY], [.5 - GW, L - GY], [.5 + GW, L - GY]].forEach(function (po) { var dx = me.p[0] - po[0], dy = me.p[1] - po[1], d = Math.hypot(dx, dy); if (d < PR + .008) { var nx = dx / d, ny = dy / d, vn = me.v[0] * nx + me.v[1] * ny; me.p = [po[0] + nx * (PR + .008), po[1] + ny * (PR + .008)]; if (vn < 0) { me.v[0] -= 1.8 * vn * nx; me.v[1] -= 1.8 * vn * ny; } me.lift(sp0 * 1.3); me.ev = 'post'; } });
      var off = Math.random() < .5 ? 0 : 6; for (var n = 0; n < 12; n++) { i = (n + off) % 12; if (this.air && this.vz < 0 && this.z < FO.grabZ) this.air = false; if (i === this.cool || this.z > .05 || this.air || this.dn[i] > 0) continue; var Pb = this.pp(i), Tp = this.tip(i), sx = Tp[0] - Pb[0], sy = Tp[1] - Pb[1], sl2 = sx * sx + sy * sy, ff = cl(((this.p[0] - Pb[0]) * sx + (this.p[1] - Pb[1]) * sy) / sl2, 0, 1), cx = Pb[0] + sx * ff, cy = Pb[1] + sy * ff, ddx = this.p[0] - cx, ddy = this.p[1] - cy, dd = Math.hypot(ddx, ddy);
        if (ff > .45 && dd < PR + (i === this.to ? .018 : .006) && this.z < .016) { var sp3 = Math.hypot(this.v[0], this.v[1]); if (sp3 < (i === this.to ? 9 : TR[i].k === 'G' ? 1.6 : 1.2)) { this.c = i; this.hold = 0; this.to = -1; this.aimA = null; if (TR[i].k === 'G') this.ev = 'save'; return; }
          var nx2 = ddx / (dd || 1), ny2 = ddy / (dd || 1), vn2 = this.v[0] * nx2 + this.v[1] * ny2; this.p = [cx + nx2 * (PR + .006), cy + ny2 * (PR + .006)]; if (vn2 < 0) { this.v[0] -= 1.7 * vn2 * nx2; this.v[1] -= 1.7 * vn2 * ny2; } this.ev = TR[i].k === 'G' ? 'save' : 'bump'; continue; }
        var Q = this.pp(i), dx = this.p[0] - Q[0], dy = this.p[1] - Q[1], d = Math.hypot(dx, dy); if (d >= R * .5 + PR) continue;
        var spd2 = Math.hypot(this.v[0], this.v[1]), catchV = i === this.to ? 9 : TR[i].k === 'G' ? 1.7 : 1.25;
        if (spd2 < catchV) { this.c = i; this.hold = 0; this.side = 0; this.to = -1; this.aimA = null; if (TR[i].k === 'G') this.ev = 'save'; return; }
        var nx = dx / d, ny = dy / d, vn = this.v[0] * nx + this.v[1] * ny; this.p = [Q[0] + nx * (R * .5 + PR), Q[1] + ny * (R * .5 + PR)]; if (vn < 0) { this.v[0] -= 1.7 * vn * nx; this.v[1] -= 1.7 * vn * ny; this.v[0] *= .8; this.v[1] *= .8; this.lift(spd2); } this.ev = TR[i].k === 'G' ? 'save' : 'bump'; } }
  };
  // held player moving fast into an opponent body-checks him: knockback off his track, hard hits knock him down sliding
  Sim.prototype.checks = function (dt) { var pv = this.prevP, P = []; for (var i = 0; i < 12; i++) P.push(this.pp(i)); this.prevP = P; if (!pv.length || dt <= 0) return;
    for (var i = 0; i < 12; i++) { if (!this.fg(i) && this.sn[i] <= 0) continue; var ix = (P[i][0] - pv[i][0]) / dt, iy = (P[i][1] - pv[i][1]) / dt, vh = (this.vh = this.vh || [])[i] || [0, 0], hd = Math.exp(-dt * 7); if (Math.hypot(ix, iy) > Math.hypot(vh[0], vh[1]) * hd) vh = [ix, iy]; else vh = [vh[0] * hd, vh[1] * hd]; this.vh[i] = vh; var vx = vh[0], vy = vh[1], sp = Math.max(Math.hypot(vx, vy), Math.hypot(ix, iy)); if (sp < CHK.min) continue;
      for (var j = (1 - TR[i].t) * 6; j < (1 - TR[i].t) * 6 + 6; j++) { var dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy) || 1e-6, key = i * 12 + j; if (d > R * 2.1 || (this.cd[key] || 0) > this.clk) continue;
        var nx = dx / d, ny = dy / d, into = Math.max(vx * nx + vy * ny, ix * nx + iy * ny); if (into < CHK.min * .7) continue; this.cd[key] = this.clk + CHK.cd;
        var kb = CHK.kb * (TR[j].k === 'G' ? .5 : 1) * into; this.ko[j][0] += nx * kb + vx * .15; this.ko[j][1] += ny * kb + vy * .15;
        if (into > CHK.hard && TR[j].k !== 'G') { this.dn[j] = CHK.down; this.ev = 'bigcheck'; if (this.c === j) { this.c = -1; this.cool = j; this.coolT = .4; this.v = [nx * 1.2 + vx * .3, ny * 1.2 + vy * .3]; } } else this.ev = 'check';
        this.hit = { j: j, s: Math.min(1, into / 3) }; this.ln[i] = .35; this.ko[i][0] += nx * kb * .3; this.ko[i][1] += ny * kb * .3; } } };
  // armed one-timer: next own player to touch the puck fires it at the net, error cone grows with pressure / bouncing puck
  Sim.prototype.onCatch = function (i) { var t = this.team(i), A = this.ot[t]; this.ot[1 - t] = null; if (!A) return; this.ot[t] = null; if (this.clk - A.t > OT.arm + 1) return;
    var cp = this.carryPos(), gy = goalOf(t), pres = Math.max(0, 1 - this.clear(cp, t) / .08), bounce = this.z > .003 || Math.hypot(this.v[0], this.v[1]) > 2.2 ? 1 : 0, err = Math.min(OT.max, OT.base + OT.press * pres + OT.bounce * bounce) * Math.PI / 180 * (Math.random() * 2 - 1);
    var a = Math.atan2(gy - cp[1], .5 + (Math.random() - .5) * GW * .6 - cp[0]) + err; this.release([Math.cos(a), Math.sin(a)], OT.sp); this.ev = 'onetimer'; this.otFx = 1; };
  Sim.prototype.hack = function (team, allow) { var me = this, ids = []; for (var i = team * 6; i < team * 6 + 6; i++) { if (allow && allow.indexOf(i) < 0) continue; if (this.dn[i] > 0) continue; var q = this.pp(i), d = Math.hypot(q[0] - this.p[0], q[1] - this.p[1]); if (d < HACK.r) ids.push([d, i]); }
    ids.sort(function (a, b) { return a[0] - b[0]; }); ids = ids.slice(0, HACK.max); var gy = goalOf(team);
    ids.forEach(function (e) { var i = e[1], P = me.pp(i); me.ang[i] = Math.atan2(me.p[1] - P[1], me.p[0] - P[0]) + (Math.random() - .5) * .5; me.ln[i] = .22; me.swing = [i, .15]; var T = me.tip(i), dd = Math.hypot(T[0] - me.p[0], T[1] - me.p[1]);
      if (dd < HACK.reach + PR && !me.air) { if (me.c >= 0 && Math.random() < HACK.steal) { me.c = i; me.hold = 0; me.ev = 'steal'; return; } if (me.c < 0) { var a = Math.atan2(gy - me.p[1], .5 - me.p[0]) + (Math.random() - .5) * 1.2; me.v[0] += Math.cos(a) * HACK.kick; me.v[1] += Math.sin(a) * HACK.kick; me.ev = 'jab'; } } }); };
  Sim.prototype.lift = function (sp) { if (sp > 1.3 && Math.random() < .6) this.vz = Math.max(this.vz, Math.min(.4, (sp - 1.3) * .3 * Math.random())); };
  Sim.prototype.goal = function (t) { this.sc[t]++; this.ev = 'goal' + t; if (this.sc[t] >= WIN || this.time <= 0) { this.over = t; this.msg = ''; return; } this.faceoff(); this.ev = 'goal' + t; this.msg = 'GOAL!'; this.pause = GOALP; this.lastGoal = t; };
  Sim.prototype.snap = function () { function r(x) { return Math.round(x * 1000) / 1000; } return { t: 's', u: this.u.map(r), o: this.o.map(function (q) { return [r(q[0]), r(q[1])]; }), p: this.p.map(r), c: this.c, sd: r(this.side), a: this.ang.map(r), sw: this.swing && this.swing[1] > 0 ? this.swing[0] : -1, sc: this.sc, tm: Math.ceil(this.time), ov: this.over, msg: this.msg, pz: r(Math.max(0, this.pause)), z: r(this.z || 0), dn: this.dn.map(function (x) { return x > 0 ? r(x) : 0; }), ln: this.ln.map(function (x) { return x > 0 ? r(x) : 0; }), ot: this.ot.map(function (x) { return x ? 1 : 0; }), g: this.grab.slice(), ev: this.ev }; };
  root.Bubble = { Sim: Sim, TR: TR, L: L, BL: BL, GOALP: GOALP, PR: PR, R: R, GW: GW, GY: GY, pos: pos, proj: proj };
})(window);
