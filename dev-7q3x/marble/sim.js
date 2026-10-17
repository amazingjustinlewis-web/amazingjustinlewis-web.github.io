/* Marble Rush - authoritative sim (runs on the TV; also loads in node for tests). Track = dense samples with a frame each; marbles = spheres on it. */
(function (root) {
  'use strict';
  var DS = 0.25;                       // sample spacing (m)
  var PHYS = { g: 16, r: 0.5, rest: 0.12, fric: 0.06, steer: 15, push: 4, air: 0.25, boost: 26, railH: 0.9, hit: 0.95, bump: 1.6, maxV: 42, respawn: 1.4, offDist: 9, offY: 10 };
  // jump: tap = small hop, hold charges up to a big jump (charge 0..1 sent by the phone); only when grounded (+ brief coyote time), cooldown after
  var JUMP = { small: 4.5, big: 12, coyote: 0.12, cool: 0.7, gate: false };
  var RACE = { count: 3.2, after: 25, results: 9 };
  function V(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; } function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; } function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); } function nrm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function ease(u) { return (1 - Math.cos(Math.PI * u)) / 2; }

  // ---------- track builder (turtle) ----------
  function build() {
    var S = [], p = V(0, 40, 0), yaw = 0, cur = { w: 8, rail: true };
    function dir() { return V(Math.sin(yaw), 0, Math.cos(yaw)); } function right() { return V(-Math.cos(yaw), 0, Math.sin(yaw)); }
    function push(q, o) { var s = { p: q, w: o.w || cur.w, rail: !!o.rail, gap: !!o.gap, boost: !!o.boost, bank: o.bank || 0, rgt: right(), up: o.up || null, tag: o.tag || '' }; S.push(s); }
    function straight(L, dy, o) { o = o || {}; var n = Math.max(1, Math.round(L / DS)), p0 = p.slice(), d = dir(), pr = o.prof || ease;
      for (var k = 1; k <= n; k++) { var u = k / n, q = add(p0, mul(d, L * u)); q[1] = p0[1] + dy * pr(u); push(q, o); if (o.boostAt && u > o.boostAt[0] && u < o.boostAt[1]) S[S.length - 1].boost = true; } p = S[S.length - 1].p.slice(); }
    function curve(ang, R, dy, o) { o = o || {}; var arc = Math.abs(ang) * R, n = Math.max(1, Math.round(arc / DS)), y0 = p[1], sg = ang > 0 ? 1 : -1, q = p.slice();
      for (var k = 1; k <= n; k++) { var u = k / n; yaw -= sg * Math.abs(ang) / n; q = add(q, mul(dir(), arc / n)); q[1] = y0 + dy * ease(u); push(q.slice(), { w: o.w, rail: o.rail, bank: sg * (o.bank || 0) * Math.sin(Math.PI * Math.min(1, u * 1.15)), tag: o.tag }); } p = q.slice(); }
    function loop(R, off) { var d = dir(), rg = right(), up = V(0, 1, 0), c = add(p, mul(up, R)), p0 = p.slice(), n = Math.round(2 * Math.PI * R / DS);
      for (var k = 1; k <= n; k++) { var th = 2 * Math.PI * k / n, q = add(add(c, add(mul(up, -Math.cos(th) * R), mul(d, Math.sin(th) * R))), mul(rg, off * ease(k / n))); push(q, { rail: true, up: nrm(add(mul(up, Math.cos(th)), mul(d, -Math.sin(th)))), w: 6, tag: 'loop' }); }
      p = add(p0, mul(rg, off)); S[S.length - 1].p = p.slice(); }
    function gap(L, dy) { var n = Math.round(L / DS), p0 = p.slice(), d = dir(); for (var k = 1; k <= n; k++) { var u = k / n, q = add(p0, mul(d, L * u)); q[1] = p0[1] + dy * u; push(q, { gap: true }); } p = S[S.length - 1].p.slice(); }
    var sq = function (u) { return u * u; }, hump = function (u) { return u + 0.08 * Math.sin(u * Math.PI * 6) / 1; };
    straight(10, 0, { w: 9, rail: true, tag: 'start' });                       // start pen + gate
    straight(42, -22, { w: 8, rail: true, prof: function (u) { return u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); } });   // the big drop
    straight(18, 0, { w: 7, boostAt: [.3, .6] });
    straight(9, 1.8, { w: 6.5, prof: sq, tag: 'ramp' }); gap(7, -2.2); straight(16, -3, { w: 8, rail: false, prof: function (u) { return u; } });   // jump 1
    curve(Math.PI / 2, 24, -3, { w: 7, rail: true, bank: 0.42 });            // banked right
    straight(22, -9, { w: 6.5 }); straight(10, 0, { w: 7, boostAt: [.1, .9] });   // over-drop + boost into the loop
    loop(7.5, 4);
    straight(8, 0, { w: 7, rail: true });
    curve(-Math.PI * 2 / 3, 22, -4, { w: 7, rail: true, bank: 0.42 });      // banked left
    straight(10, -2, { w: 6.5, boostAt: [.2, .8] });
    straight(8, 1.6, { w: 6.5, prof: sq, tag: 'ramp' }); gap(6, -2); straight(14, -3, { w: 8, prof: function (u) { return u; } });   // jump 2
    curve(Math.PI / 3, 30, -3, { w: 6.5, rail: false, bank: 0.25 });
    straight(30, -5, { w: 6, prof: function (u) { return u - Math.sin(u * Math.PI * 6) * 0.12; } });   // rollers: little over-drops
    straight(28, 0, { w: 8, rail: true, tag: 'finish' }); straight(16, 0, { w: 8, rail: true, tag: 'runout' });
    // frames
    for (var i = 0; i < S.length; i++) { var a = S[Math.max(0, i - 1)].p, b = S[Math.min(S.length - 1, i + 1)].p, T = nrm(sub(b, a)), s = S[i], up;
      if (s.up) up = s.up; else { var b0 = s.bank; up = add(mul(V(0, 1, 0), Math.cos(b0)), mul(s.rgt, Math.sin(b0))); }
      var N = nrm(sub(up, mul(T, dot(up, T)))), B = cross(T, N); s.T = T; s.N = N; s.B = B; s.i = i; }
    var fin = 0, cps = [], startI = 0; for (i = 0; i < S.length; i++) { if (S[i].tag === 'finish' && !fin) fin = i + Math.round(10 / DS); }
    for (i = Math.round(60 / DS); i < fin; i += Math.round(40 / DS)) { var j = i; while (j < fin && (S[j].gap || S[j].tag === 'loop' || S[j].tag === 'ramp')) j++; if (!S[j].gap) cps.push(j); }
    return { S: S, fin: fin, cps: cps, gate: Math.round(9 / DS), DS: DS };
  }

  // ---------- sim ----------
  function Sim() { this.tr = build(); this.m = []; this.phase = 'lobby'; this.t = 0; this.cd = 0; this.order = []; this.gateOpen = false; this.ev = []; }
  Sim.prototype.slot = function (k, i0) { var s = this.tr.S[i0], n = Math.max(1, this.m.length), w = s.w - 1.4, l = n === 1 ? 0 : -w / 2 + w * (k / (n - 1)); return add(add(s.p, mul(s.B, l)), mul(s.N, PHYS.r)); };
  Sim.prototype.add = function (id, col, name) { var m = { id: id, col: col, name: name || 'Player', p: [0, 0, 0], v: [0, 0, 0], i: 4, in: [0, 0], chg: 0, jcool: 0, cp: 4, dead: 0, fin: 0, ground: false, air: 0, spin: [0, 0, 0] }; this.m.push(m); this.lineUp(); return m; };
  Sim.prototype.remove = function (id) { this.m = this.m.filter(function (m) { return m.id !== id; }); if (this.phase === 'lobby') this.lineUp(); };
  Sim.prototype.lineUp = function () { var me = this; this.m.forEach(function (m, k) { m.i = 4 + (k % 2) * 4; m.p = me.slot(k, Math.round((k % 2 ? 4 : 6) / DS)); m.v = [0, 0, 0]; m.fin = 0; m.dead = 0; m.cp = m.i; m.place = 0; }); };
  Sim.prototype.input = function (id, x, y) { var m = this.m.filter(function (q) { return q.id === id; })[0]; if (m) { m.in[0] = Math.max(-1, Math.min(1, x)); m.in[1] = Math.max(-1, Math.min(1, y)); } };
  Sim.prototype.charge = function (id, c) { var m = this.m.filter(function (q) { return q.id === id; })[0]; if (m) m.chg = Math.max(0, Math.min(1, +c || 0)); };
  Sim.prototype.jump = function (id, pw) { var m = this.m.filter(function (q) { return q.id === id; })[0]; if (!m) return false; m.chg = 0;
    if (m.dead > 0 || m.fin || m.jcool > 0 || !(m.ground || m.air < JUMP.coyote)) return false;
    if (!JUMP.gate && (this.phase === 'count')) return false;
    var S = this.tr.S, s = S[m.i], p = Math.max(0, Math.min(1, +pw || 0)), vn = dot(m.v, s.N); if (vn < 0) m.v = sub(m.v, mul(s.N, vn));
    m.v = add(m.v, mul(s.N, JUMP.small + (JUMP.big - JUMP.small) * p)); m.jcool = JUMP.cool; m.ground = false; m.air = JUMP.coyote; this.ev.push('jump:' + m.id); return true; };
  Sim.prototype.start = function () { if (this.phase !== 'lobby' && this.phase !== 'results') return; this.lineUp(); this.phase = 'count'; this.cd = RACE.count; this.gateOpen = false; this.order = []; this.t = 0; this.ev.push('count'); };
  Sim.prototype.near = function (m) { var S = this.tr.S, best = m.i, bd = 1e9, lo = Math.max(0, m.i - 14), hi = Math.min(S.length - 1, m.i + 14);
    for (var i = lo; i <= hi; i++) { var d = sub(m.p, S[i].p), q = dot(d, d); if (q < bd) { bd = q; best = i; } } m.i = best; return Math.sqrt(bd); };
  Sim.prototype.respawn = function (m) { var S = this.tr.S, s = S[m.cp], k = this.m.indexOf(m), l = ((k % 3) - 1) * 1.6; m.p = add(add(s.p, mul(s.B, l)), mul(s.N, PHYS.r + 0.6)); m.v = mul(s.T, 13); m.i = m.cp; m.dead = 0; m.air = 0; this.ev.push('respawn:' + m.id); };
  Sim.prototype.step = function (dt) { var h = 1 / 120, n = Math.min(8, Math.max(1, Math.round(dt / h))); for (var k = 0; k < n; k++) this.sub(dt / n); };
  Sim.prototype.sub = function (dt) {
    var me = this, S = this.tr.S, P = PHYS;
    if (this.phase === 'count') { this.cd -= dt; if (this.cd <= 0) { this.phase = 'race'; this.gateOpen = true; this.t = 0; this.ev.push('go'); } }
    if (this.phase === 'race' || this.phase === 'finishing') { this.t += dt; }
    if (this.phase === 'finishing') { this.after -= dt; if (this.after <= 0 || this.m.every(function (m) { return m.fin; })) { this.phase = 'results'; this.resT = RACE.results; this.ev.push('results'); } }
    if (this.phase === 'results') { this.resT -= dt; if (this.resT <= 0) { this.phase = 'lobby'; this.lineUp(); } }
    var held = this.phase === 'lobby' || this.phase === 'count';
    this.m.forEach(function (m) {
      if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) me.respawn(m); return; }
      var s = S[m.i]; if (m.jcool > 0) m.jcool -= dt;
      m.v[1] -= P.g * dt;
      var ctl = m.ground ? 1 : P.air, sideFlat = nrm([s.B[0], 0, s.B[2]]);
      if (!m.fin) { m.v = add(m.v, mul(s.B, m.in[0] * P.steer * ctl * dt)); m.v = add(m.v, mul(s.T, m.in[1] * P.push * ctl * dt)); }
      if (m.ground && s.boost) m.v = add(m.v, mul(s.T, P.boost * dt));
      var sp = len(m.v); if (sp > P.maxV) m.v = mul(m.v, P.maxV / sp);
      m.p = add(m.p, mul(m.v, dt));
      if (held) { var gx = S[me.tr.gate]; var ahead = dot(sub(m.p, gx.p), gx.T) + P.r; if (ahead > 0) { m.p = sub(m.p, mul(gx.T, ahead)); var vt = dot(m.v, gx.T); if (vt > 0) m.v = sub(m.v, mul(gx.T, vt * 1.3)); } }
      var e0 = S[0], e1 = S[S.length - 1], bk = dot(sub(m.p, e0.p), e0.T) - P.r, fw = dot(sub(m.p, e1.p), e1.T) + P.r;   // walls at both ends
      if (bk < 0) { m.p = sub(m.p, mul(e0.T, bk)); var vb = dot(m.v, e0.T); if (vb < 0) m.v = sub(m.v, mul(e0.T, vb * 1.4)); }
      if (fw > 0) { m.p = sub(m.p, mul(e1.T, fw)); var vf = dot(m.v, e1.T); if (vf > 0) m.v = sub(m.v, mul(e1.T, vf * 1.4)); }
      if (m.fin) m.v = mul(m.v, 1 - 1.2 * dt);
      var dist = me.near(m); s = S[m.i];
      var d = sub(m.p, s.p), hgt = dot(d, s.N), lat = dot(d, s.B), hw = s.w / 2; m.ground = false;
      if (!s.gap && Math.abs(lat) <= hw + 0.05 && hgt < P.r && hgt > -1.4) {
        m.p = add(m.p, mul(s.N, P.r - hgt)); var vn = dot(m.v, s.N); if (vn < 0) { m.v = sub(m.v, mul(s.N, vn * (1 + (vn < -6 ? P.rest : 0)))); if (vn < -6) me.ev.push('land:' + m.id); }
        m.v = mul(m.v, 1 - P.fric * dt); m.ground = true; m.air = 0;
        if (!s.gap && s.tag !== 'loop' && s.tag !== 'ramp') { for (var c = me.tr.cps.length - 1; c >= 0; c--) if (m.i >= me.tr.cps[c]) { m.cp = Math.max(m.cp, me.tr.cps[c]); break; } }
      } else m.air += dt;
      if (s.rail && !s.gap && hgt < P.railH + P.r && hgt > -1.4 && Math.abs(lat) > hw - P.r && Math.abs(lat) < hw + 0.6) { var sg = lat > 0 ? 1 : -1; m.p = sub(m.p, mul(s.B, (Math.abs(lat) - (hw - P.r)) * sg)); var vl = dot(m.v, s.B); if (vl * sg > 0) { m.v = sub(m.v, mul(s.B, vl * 1.5)); if (Math.abs(vl) > 4) me.ev.push('rail:' + m.id); } }
      if (!held && (dist > P.offDist || m.p[1] < s.p[1] - P.offY)) { m.dead = P.respawn; me.ev.push('fall:' + m.id); }
      if (!m.fin && (me.phase === 'race' || me.phase === 'finishing') && m.i >= me.tr.fin) { m.fin = me.t; me.order.push(m.id); me.ev.push('fin:' + m.id); if (me.phase === 'race') { me.phase = 'finishing'; me.after = RACE.after; } }
      // rolling spin (visual)
      if (m.ground) { var w = cross(s.N, m.v); m.spin = mul(w, 1 / P.r); }
    });
    // marble <-> marble
    var M = this.m.filter(function (m) { return m.dead <= 0; });
    for (var a = 0; a < M.length; a++) for (var b = a + 1; b < M.length; b++) { var A = M[a], Bm = M[b], dd = sub(Bm.p, A.p), L = len(dd), mn = 2 * P.r;
      if (L < mn && L > 1e-6) { var nn = mul(dd, 1 / L), ov = (mn - L) / 2; A.p = sub(A.p, mul(nn, ov)); Bm.p = add(Bm.p, mul(nn, ov)); var rv = dot(sub(Bm.v, A.v), nn);
        if (rv < 0) { var j = -(1 + P.hit) * rv / 2 * P.bump; A.v = sub(A.v, mul(nn, j)); Bm.v = add(Bm.v, mul(nn, j)); if (rv < -3) this.ev.push('hit'); } } }
    // places
    var list = this.m.slice().sort(function (x, y) { if (x.fin && y.fin) return x.fin - y.fin; if (x.fin) return -1; if (y.fin) return 1; return y.i - x.i; }); list.forEach(function (m, k) { m.place = k + 1; });
  };
  Sim.prototype.prog = function (m) { return Math.min(1, m.i / this.tr.fin); };
  root.Marble = { JUMP: JUMP, Sim: Sim, PHYS: PHYS, RACE: RACE, build: build, util: { add: add, sub: sub, mul: mul, dot: dot, cross: cross, len: len, nrm: nrm } };
})(typeof window !== 'undefined' ? window : global);
