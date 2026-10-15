/* DEMOLITION DERBY v0.4 - RACE track: a long, wide, winding closed loop with ramps, raised side ledges,
   bumpy gravel, puddles and obstacles. Pure data + maths (no rendering): the sim and the TV both read it.
   Sim coords: x,y on the floor, z up. s = distance along the centre line, u = signed sideways offset (+ = left of travel). */
(function (root) {
  'use strict';
  var W = 26, HALF = W / 2, STEP = 2;
  // control points: a wobbly loop
  var ctl = [], K = 16;
  for (var k = 0; k < K; k++) { var th = k / K * Math.PI * 2, r = 150 + 48 * Math.sin(3 * th + 0.5) + 26 * Math.cos(5 * th + 1.2); ctl.push([Math.cos(th) * r * 1.25, Math.sin(th) * r * 0.95]); }
  function cr(p0, p1, p2, p3, t) { var t2 = t * t, t3 = t2 * t; return [0, 1].map(function (i) { return 0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3); }); }
  var dense = [];
  for (k = 0; k < K; k++) for (var j = 0; j < 40; j++) dense.push(cr(ctl[(k + K - 1) % K], ctl[k], ctl[(k + 1) % K], ctl[(k + 2) % K], j / 40));
  // resample evenly every STEP metres
  var cum = [0]; for (k = 1; k <= dense.length; k++) { var a = dense[k - 1], b = dense[k % dense.length]; cum.push(cum[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  var L0 = cum[dense.length], N = Math.round(L0 / STEP), L = N * STEP, P = [], T = [];
  for (var i = 0, q = 0; i < N; i++) { var want = i * L0 / N; while (cum[q + 1] < want) q++; var f = (want - cum[q]) / (cum[q + 1] - cum[q]), A = dense[q], B = dense[(q + 1) % dense.length]; P.push([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]); }
  for (i = 0; i < N; i++) { var n0 = P[(i + N - 1) % N], n1 = P[(i + 1) % N], dl = Math.hypot(n1[0] - n0[0], n1[1] - n0[1]); T.push([(n1[0] - n0[0]) / dl, (n1[1] - n0[1]) / dl]); }
  function F(x) { return x * L; }
  // ---------------------------------------------------------------- features (s as a fraction of the lap)
  var ramps = [{ s: F(0.115), len: 13, h: 2.7 }, { s: F(0.465), len: 12, h: 3.0 }, { s: F(0.805), len: 14, h: 2.6 }, { s: F(0.30), len: 9, h: 1.8, u0: 0, u1: HALF }];
  var ledges = [{ s0: F(0.185), s1: F(0.27), side: 1, w: 9, h: 2.8 }, { s0: F(0.575), s1: F(0.67), side: -1, w: 9, h: 3.0 }];
  var bumpy = [{ s0: F(0.345), s1: F(0.42) }, { s0: F(0.715), s1: F(0.775) }, { s0: F(0.94), s1: F(0.985) }];
  var puddles = [[F(0.155), -5, 4.5], [F(0.33), 4, 5], [F(0.52), 0, 6.5], [F(0.875), -4, 5], [F(0.895), 6, 3.5], [F(0.69), 2, 5]];
  var obst = [[F(0.06), 6, 1.6, 'tyres'], [F(0.25), -6, 1.6, 'tyres'], [F(0.44), 3, 2.2, 'block'], [F(0.545), -8, 1.6, 'tyres'], [F(0.62), 3, 2.2, 'block'], [F(0.755), -3, 1.6, 'tyres'], [F(0.92), 0, 2.4, 'block'], [F(0.955), 8, 1.6, 'tyres'], [F(0.035), -7, 1.6, 'tyres']];
  function dS(s, s0) { var d = s - s0; d = ((d % L) + L) % L; return d; }   // distance ahead of s0 (0..L)
  function at(s, u) { var fi = (((s % L) + L) % L) / STEP, i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N, f = fi - Math.floor(fi), p0 = P[i0], p1 = P[i1], t0 = T[i0], t1 = T[i1], tx = t0[0] + (t1[0] - t0[0]) * f, ty = t0[1] + (t1[1] - t0[1]) * f, tl = Math.hypot(tx, ty);
    tx /= tl; ty /= tl; return { x: p0[0] + (p1[0] - p0[0]) * f - ty * u, y: p0[1] + (p1[1] - p0[1]) * f + tx * u, tx: tx, ty: ty }; }
  // world (x,y) -> (s,u). hint = last index (search near it); -1 = full search
  function locate(x, y, hint) {
    var best = -1, bd = 1e18, i, lo, hi;
    if (hint != null && hint >= 0) { lo = hint - 30; hi = hint + 30; } else { lo = 0; hi = N - 1; }
    for (i = lo; i <= hi; i++) { var k2 = ((i % N) + N) % N, p = P[k2], d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < bd) { bd = d; best = k2; } }
    if (hint != null && hint >= 0 && bd > 900) return locate(x, y, -1);
    var p0 = P[best], t = T[best], dx = x - p0[0], dy = y - p0[1], along = dx * t[0] + dy * t[1], u = -dx * t[1] + dy * t[0];
    return { i: best, s: (best * STEP + along + L) % L, u: u, tx: t[0], ty: t[1] };
  }
  function ledgeH(s, u) { for (var k = 0; k < ledges.length; k++) { var g = ledges[k], d = dS(s, g.s0), len = dS(g.s1, g.s0); if (d > len) continue; if (g.side * u < HALF - g.w) continue; return g.h * Math.min(1, d / 16); } return 0; }
  function ledgeAt(s) { for (var k = 0; k < ledges.length; k++) { var g = ledges[k], d = dS(s, g.s0); if (d <= dS(g.s1, g.s0)) return { g: g, d: d }; } return null; }
  function isBumpy(s) { for (var k = 0; k < bumpy.length; k++) if (dS(s, bumpy[k].s0) <= dS(bumpy[k].s1, bumpy[k].s0)) return true; return false; }
  function height(s, u) {
    var h = 1.1 * Math.sin(s / L * Math.PI * 6) + 0.7 * Math.sin(s / L * Math.PI * 14 + 1);
    for (var k = 0; k < ramps.length; k++) { var r = ramps[k], d = dS(s, r.s); if (d < r.len && (r.u0 == null || (u >= r.u0 && u <= r.u1))) h += r.h * d / r.len; }
    h += ledgeH(s, u);
    if (isBumpy(s)) h += 0.2 * Math.sin(s * 1.7) * Math.sin(u * 1.3 + 0.4) + 0.12 * Math.sin(s * 4.1 + u * 0.9);
    return h;
  }
  // obstacles + puddles in world coords
  var OB = obst.map(function (o) { var w = at(o[0], o[1]); return { x: w.x, y: w.y, r: o[2], kind: o[3], s: o[0], u: o[1], h: o[3] === 'block' ? 1.6 : 1.4 }; });
  var PU = puddles.map(function (o) { var w = at(o[0], o[1]); return { x: w.x, y: w.y, r: o[2], s: o[0], u: o[1] }; });
  function puddleAt(x, y) { for (var k = 0; k < PU.length; k++) { var p = PU[k]; if ((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < p.r * p.r) return p; } return null; }
  var lastI = -1;
  function groundXY(x, y) { var l = locate(x, y, lastI); lastI = l.i; return height(l.s, Math.max(-HALF, Math.min(HALF, l.u))); }
  root.DDTrack = { W: W, HALF: HALF, L: L, N: N, STEP: STEP, P: P, T: T, at: at, locate: locate, height: height, ground: groundXY, ledgeAt: ledgeAt, isBumpy: isBumpy, puddleAt: puddleAt,
    ramps: ramps, ledges: ledges, bumpy: bumpy, obstacles: OB, puddles: PU, dS: dS, wallH: 1.5 };
})(typeof window !== 'undefined' ? window : globalThis);
