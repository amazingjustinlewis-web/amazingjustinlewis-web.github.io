/* LASER RANGE - aiming maths (shared by the phone, the TV and the tests). No DOM.
   1. Phone: DeviceOrientation (alpha, beta, gamma) -> a pointing vector in the world frame (x east, y north, z up).
      We build the full rotation matrix (W3C order Z-X'-Y'') instead of using the angles directly, so the
      alpha 359->0 wrap, beta past +-90 and gamma's +-90 flip never cause jumps: the vector is continuous.
   2. Calibration (TV): the 5 vectors recorded while pointing at the 5 targets are projected onto a flat
      "virtual screen" facing the centre target (gnomonic / tangent-plane projection: a flat TV is a plane, so
      straight lines stay straight), then a least-squares affine fit maps that plane to screen units (0..1).
   3. Re-centre: gyros drift mostly around the vertical axis. We spin the reference frame around world-up so
      the current vector lands on the target again, then remove any small leftover offset. */
(function (root) {
  'use strict';
  var D2R = Math.PI / 180;
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function rotZ(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }

  // rotation matrix rows for DeviceOrientation (degrees), W3C spec: R = Rz(alpha) * Rx(beta) * Ry(gamma)
  function matrix(alpha, beta, gamma) {
    var a = (alpha || 0) * D2R, b = (beta || 0) * D2R, g = (gamma || 0) * D2R;
    var ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    return [
      [ca * cg - sa * sb * sg, -cb * sa, ca * sg + cg * sa * sb],
      [cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb],
      [-cb * sg, sb, cb * cg]
    ];
  }
  // world-frame pointing vector. axis 'top' = the phone's top edge (device +Y), 'back' = out of the camera side (device -Z)
  function vec(alpha, beta, gamma, axis) {
    var R = matrix(alpha, beta, gamma);
    if (axis === 'back') return [-R[0][2], -R[1][2], -R[2][2]];
    return [R[0][1], R[1][1], R[2][1]];
  }
  // the inverse, for tests and the simulator: (pointing vector, roll in degrees) -> W3C-range {alpha, beta, gamma}
  function euler(dir, rollDeg, axis) {
    var y = norm(dir), up = [0, 0, 1];
    var z = add(up, y, -dot(up, y)); if (dot(z, z) < 1e-6) z = [0, 1, 0]; z = norm(z);
    var x = cross(y, z);
    if (rollDeg) { var r = rollDeg * D2R, c = Math.cos(r), s = Math.sin(r), x2 = add(x.map(function (q) { return q * c; }), z, s), z2 = add(z.map(function (q) { return q * c; }), x, -s); x = x2; z = z2; }
    var cols;                                                       // device axes (X, Y, Z) as columns of R
    if (axis === 'back') { var Z = [-y[0], -y[1], -y[2]], Y = z, X = cross(Y, Z); cols = [X, Y, Z]; }
    else cols = [x, y, z];
    var R = [[cols[0][0], cols[1][0], cols[2][0]], [cols[0][1], cols[1][1], cols[2][1]], [cols[0][2], cols[1][2], cols[2][2]]];
    var beta = Math.asin(Math.max(-1, Math.min(1, R[2][1]))) / D2R;
    var alpha = Math.atan2(-R[0][1], R[1][1]) / D2R, gamma = Math.atan2(-R[2][0], R[2][2]) / D2R;
    if (gamma >= 90 || gamma < -90) {                             // W3C keeps gamma in [-90, 90): use the twin solution
      gamma += gamma >= 90 ? -180 : 180; beta = 180 - beta; alpha += 180;
    }
    beta = ((beta + 180) % 360 + 360) % 360 - 180; alpha = (alpha % 360 + 360) % 360;
    return { alpha: alpha, beta: beta, gamma: gamma };
  }

  // ---------------------------------------------------------------- calibration
  function basis(c) {
    c = norm(c);
    var r = cross(c, [0, 0, 1]);
    r = dot(r, r) < 1e-4 ? [1, 0, 0] : norm(r);                    // pointing straight up/down: any horizontal 'right' will do
    return { c: c, r: r, u: cross(r, c) };
  }
  function plane(B, v) {      // gnomonic projection onto the plane 1 unit in front of the centre direction
    var s = dot(v, B.c); if (s < 0.08) s = 0.08;                  // ~85 degrees off the screen: clamp instead of flipping
    return [dot(v, B.r) / s, dot(v, B.u) / s];
  }
  function solveN(M, b) {     // tiny Gaussian elimination with partial pivoting (n <= 8)
    var n = b.length, A = [], i, j, k;
    for (i = 0; i < n; i++) A.push(M[i].concat(b[i]));
    for (i = 0; i < n; i++) {
      var p = i; for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
      var t = A[i]; A[i] = A[p]; A[p] = t;
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (k = 0; k < n; k++) if (k !== i) { var f = A[k][i] / A[i][i]; for (j = i; j <= n; j++) A[k][j] -= f * A[i][j]; }
    }
    var out = []; for (i = 0; i < n; i++) out.push(A[i][n] / A[i][i]); return out;
  }
  function lsq(rows, rhs) {   // least squares via the normal equations
    var n = rows[0].length, M = [], b = [], i, j, k;
    for (i = 0; i < n; i++) { M.push([]); b.push(0); for (j = 0; j < n; j++) M[i].push(0); }
    for (k = 0; k < rows.length; k++) for (i = 0; i < n; i++) { b[i] += rows[k][i] * rhs[k]; for (j = 0; j < n; j++) M[i][j] += rows[k][i] * rows[k][j]; }
    return solveN(M, b);
  }
  function inv3(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function applyH(H, u, v) { var w = H[6] * u + H[7] * v + H[8]; if (Math.abs(w) < 1e-9) w = 1e-9; return { x: (H[0] * u + H[1] * v + H[2]) / w, y: (H[3] * u + H[4] * v + H[5]) / w, w: w }; }
  // pts: [{x, y, v:[...]}] (screen units + recorded vector). Returns a calibration or { error }
  // With 4+ points we fit a perspective map (homography: exact for a flat TV seen from any angle);
  // if that comes out unstable we fall back to an affine fit (exact when you sit square-on).
  function calibrate(pts, opts) {
    opts = opts || {};
    if (!pts || pts.length < 3) return { error: 'need at least 3 points' };
    var cen = null, i;
    for (i = 0; i < pts.length; i++) if (Math.abs(pts[i].x - 0.5) < 0.02 && Math.abs(pts[i].y - 0.5) < 0.02) cen = pts[i].v;
    if (!cen) { cen = [0, 0, 0]; for (i = 0; i < pts.length; i++) cen = add(cen, norm(pts[i].v), 1); }
    var B = basis(cen), P = pts.map(function (p) { return plane(B, norm(p.v)); });
    // spread check: did the phone really move between targets?
    var minU = 1e9, maxU = -1e9, minV = 1e9, maxV = -1e9;
    P.forEach(function (q) { minU = Math.min(minU, q[0]); maxU = Math.max(maxU, q[0]); minV = Math.min(minV, q[1]); maxV = Math.max(maxV, q[1]); });
    var minSpan = Math.tan((opts.minSpanDeg || 4) * D2R);
    if (maxU - minU < minSpan || maxV - minV < minSpan) return { error: 'too-small' };
    var base = { c: B.c, r: B.r, u: B.u };
    function fitErr(cal) { var e = 0; for (var k = 0; k < pts.length; k++) { var m = map(cal, pts[k].v); e += Math.sqrt(Math.pow(m.x - pts[k].x, 2) + Math.pow((m.y - pts[k].y) * 9 / 16, 2)); } return e / pts.length; }
    // affine: [u v 1] -> x, y
    var rows = P.map(function (q) { return [q[0], q[1], 1]; });
    var X = lsq(rows, pts.map(function (p) { return p.x; })), Y = lsq(rows, pts.map(function (p) { return p.y; }));
    if (!X || !Y || Math.abs(X[0] * Y[1] - X[1] * Y[0]) < 1e-6) return { error: 'degenerate' };
    var aff = { c: base.c, r: base.r, u: base.u, H: [X[0], X[1], X[2], Y[0], Y[1], Y[2], 0, 0, 1] };
    aff.fitErr = fitErr(aff); aff.kind = 'affine';
    if (pts.length < 4 || opts.affine) return aff;
    // homography (h33 = 1): h0 u + h1 v + h2 - x h6 u - x h7 v = x, and the same for y
    var hr = [], hb = [];
    for (i = 0; i < pts.length; i++) {
      var u = P[i][0], v = P[i][1], x = pts[i].x, y = pts[i].y;
      hr.push([u, v, 1, 0, 0, 0, -x * u, -x * v]); hb.push(x);
      hr.push([0, 0, 0, u, v, 1, -y * u, -y * v]); hb.push(y);
    }
    var lam = opts.ridge != null ? opts.ridge : 0.1;              // gently pull the perspective terms to 0 (steadier with shaky hands)
    hr.push([0, 0, 0, 0, 0, 0, lam, 0]); hb.push(0); hr.push([0, 0, 0, 0, 0, 0, 0, lam]); hb.push(0);
    var h = lsq(hr, hb);
    if (h) {
      var hom = { c: base.c, r: base.r, u: base.u, H: h.concat([1]), kind: 'perspective' };
      // sane? the denominator must stay positive over the whole calibrated area (plus a margin), and the fit must not be worse
      var okd = true, mu = (maxU - minU) * 0.6, mv = (maxV - minV) * 0.6, cu = (maxU + minU) / 2, cv = (maxV + minV) / 2;
      [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].forEach(function (s) { if (applyH(hom.H, cu + s[0] * mu, cv + s[1] * mv).w < 0.35) okd = false; });
      hom.fitErr = fitErr(hom);
      if (okd && hom.fitErr <= aff.fitErr + 1e-9 && inv3(hom.H)) return hom;   // (else: affine)
    }
    return aff;
  }
  function map(cal, v) {
    var q = plane(cal, norm(v)), m = applyH(cal.H, q[0], q[1]);
    return { x: m.x, y: m.y };
  }
  // the world direction that maps to screen point (x, y) under cal
  function unmap(cal, x, y) {
    var Hi = inv3(cal.H) || [1, 0, 0, 0, 1, 0, 0, 0, 1], q = applyH(Hi, x, y);
    return norm(add(add(cal.c, cal.r, q.x), cal.u, q.y));
  }
  // before calibrating: centre on the current direction, spanDeg = degrees of turn across the screen
  function defaultCal(v, spanDeg) {
    var B = basis(v), sx = Math.tan(spanDeg.x / 2 * D2R) * 2, sy = Math.tan(spanDeg.y / 2 * D2R) * 2;
    return { c: B.c, r: B.r, u: B.u, H: [1 / sx, 0, 0.5, 0, -1 / sy, 0.5, 0, 0, 1], fitErr: 0, kind: 'default' };
  }
  // re-centre: the player says "v points at screen (tx, ty) right now"
  function recenter(cal, v, tx, ty) {
    v = norm(v);
    var want = unmap(cal, tx, ty);                                 // where cal thinks (tx, ty) is
    var ang = Math.atan2(v[1], v[0]) - Math.atan2(want[1], want[0]);
    if (Math.abs(v[2]) > 0.97 || Math.abs(want[2]) > 0.97) ang = 0;
    var out = { c: norm(rotZ(cal.c, ang)), r: norm(rotZ(cal.r, ang)), u: norm(rotZ(cal.u, ang)), H: cal.H.slice(), fitErr: cal.fitErr, kind: cal.kind };
    var m = map(out, v), dx = tx - m.x, dy = ty - m.y, H = out.H;  // leftover (mostly pitch): shift the screen mapping (T * H)
    H[0] += dx * H[6]; H[1] += dx * H[7]; H[2] += dx * H[8]; H[3] += dy * H[6]; H[4] += dy * H[7]; H[5] += dy * H[8];
    return out;
  }

  // ---------------------------------------------------------------- one-euro filter (smooth when still, quick when moving)
  function OneEuro(o) { this.o = o; this.x = null; this.dx = 0; }
  OneEuro.prototype.alpha = function (cut, dt) { var tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / dt); };
  OneEuro.prototype.filter = function (x, dt) {
    if (this.x === null || !(dt > 0)) { this.x = x; this.dx = 0; return x; }
    var dx = (x - this.x) / dt, ad = this.alpha(this.o.dCutoff, dt);
    this.dx = this.dx + ad * (dx - this.dx);
    var cut = this.o.minCutoff + this.o.beta * Math.abs(this.dx), a = this.alpha(cut, dt);
    this.x = this.x + a * (x - this.x);
    return this.x;
  };
  OneEuro.prototype.reset = function (x) { this.x = x == null ? null : x; this.dx = 0; };

  root.LRAim = { matrix: matrix, vec: vec, euler: euler, calibrate: calibrate, map: map, unmap: unmap, defaultCal: defaultCal, recenter: recenter,
    OneEuro: OneEuro, norm: norm, dot: dot, cross: cross, rotZ: rotZ };
})(typeof window !== 'undefined' ? window : globalThis);
