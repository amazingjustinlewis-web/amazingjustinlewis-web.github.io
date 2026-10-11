/* WALKER v0.2 world additions: wooden backyard roller coaster (NW), petting zoo (NE), water park (SW), bumper boat lagoon (SE).
   Simple shapes only. Idle life (animals wandering, jets, chain, boats) runs in W2.update; the TV drives the rides. */
(function (root) {
  var T = root.THREE, TAU = Math.PI * 2;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function M(c, o) { o = o || {}; o.color = c; return new T.MeshLambertMaterial(o); }
  function mesh(g, m, x, y, z, parent) { var e = new T.Mesh(g, m); e.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(e); return e; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function rr(a, b) { return a + rnd() * (b - a); }
  var BOX = new T.BoxGeometry(1, 1, 1), CYL = new T.CylinderGeometry(0.5, 0.5, 1, 7);
  var _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), ZA = V(0, 0, 1), YA = V(0, 1, 0);
  function inst(geo, mat, n, scene) { var im = new T.InstancedMesh(geo, mat, n); im.count = 0; scene.add(im); return im; }
  function beam(im, a, b, w, h) { if (im.count >= im.instanceMatrix.count) return; _p.addVectors(a, b).multiplyScalar(0.5); var d = V(0, 0, 0).subVectors(b, a), L = d.length(); _q.setFromUnitVectors(ZA, d.normalize()); _s.set(w, h, L); _m.compose(_p, _q, _s); im.setMatrixAt(im.count++, _m); }
  function post(im, x, z, h, r, y0) { if (im.count >= im.instanceMatrix.count) return; _p.set(x, (y0 || 0) + h / 2, z); _q.identity(); _s.set(r * 2, h, r * 2); _m.compose(_p, _q, _s); im.setMatrixAt(im.count++, _m); }
  // fence along a polyline (closed), with an optional gap (where the kid walks in)
  function fence(F, pts, gap) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 1.8));
      for (var k = 0; k < n; k++) {
        var u0 = k / n, u1 = (k + 1) / n, p0 = V(a.x + (b.x - a.x) * u0, 0, a.z + (b.z - a.z) * u0), p1 = V(a.x + (b.x - a.x) * u1, 0, a.z + (b.z - a.z) * u1);
        var mid = p0.clone().add(p1).multiplyScalar(0.5);
        if (gap && Math.hypot(mid.x - gap.x, mid.z - gap.z) < 1.0) continue;
        post(F.posts, p0.x, p0.z, 1.25, 0.07); post(F.posts, p1.x, p1.z, 1.25, 0.07);
        beam(F.rails, p0.clone().setY(0.55), p1.clone().setY(0.55), 0.07, 0.12); beam(F.rails, p0.clone().setY(1.05), p1.clone().setY(1.05), 0.07, 0.12);
      }
    }
  }
  function circlePts(c, r, n) { var a = []; for (var i = 0; i < n; i++) { var t = i / n * TAU; a.push(V(c.x + Math.cos(t) * r, 0, c.z + Math.sin(t) * r)); } return a; }
  function rectPts(c, hx, hz) { return [V(c.x - hx, 0, c.z - hz), V(c.x + hx, 0, c.z - hz), V(c.x + hx, 0, c.z + hz), V(c.x - hx, 0, c.z + hz)]; }
  function disc(scene, r, col, x, y, z, segs) { var d = mesh(new T.CircleGeometry(r, segs || 32), M(col), x, y, z, scene); d.rotation.x = -Math.PI / 2; d.receiveShadow = true; return d; }
  function plane(scene, w, h, col, x, y, z) { var d = mesh(new T.PlaneGeometry(w, h), M(col), x, y, z, scene); d.rotation.x = -Math.PI / 2; d.receiveShadow = true; return d; }

  // ------------------------------------------------------------------ animals
  function quad(o) {
    var g = new T.Group(), m = M(o.col), dark = M('#2b1d14');
    var hip = o.h - o.girth * 0.55, lh = hip;
    var body = mesh(new T.SphereGeometry(0.5, 14, 10), m, 0, o.h - o.girth * 0.45, 0, g); body.scale.set(o.girth, o.girth * 0.95, o.len);
    var legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (s) { var p = new T.Group(); p.position.set(s[0] * o.girth * 0.28, hip, s[1] * o.len * 0.32); g.add(p); mesh(new T.CylinderGeometry(o.leg, o.leg * 0.8, lh, 6), M(o.legC || o.col), 0, -lh / 2, 0, p); mesh(new T.CylinderGeometry(o.leg * 1.05, o.leg * 1.05, 0.08, 6), M(o.hoof || '#3a2a20'), 0, -lh + 0.04, 0, p); legs.push(p); });
    var neck = new T.Group(); neck.position.set(0, o.h - o.girth * 0.25, o.len * 0.4); g.add(neck); neck.rotation.x = o.tilt;
    mesh(new T.CylinderGeometry(o.girth * 0.2, o.girth * 0.28, o.neck, 8), m, 0, o.neck / 2, 0, neck);
    if (o.mane) { var mn = mesh(new T.BoxGeometry(0.06, o.neck, 0.12), M(o.mane), 0, o.neck / 2, -o.girth * 0.2, neck); }
    var head = new T.Group(); head.position.set(0, o.neck, 0); neck.add(head); head.rotation.x = -o.tilt + 0.25;
    var hd = mesh(new T.SphereGeometry(0.5, 12, 10), m, 0, 0, o.head * 0.3, head); hd.scale.set(o.head * 0.55, o.head * 0.6, o.head * 1.1);
    mesh(new T.SphereGeometry(o.head * 0.07, 6, 5), dark, -o.head * 0.22, o.head * 0.12, o.head * 0.42, head); mesh(new T.SphereGeometry(o.head * 0.07, 6, 5), dark, o.head * 0.22, o.head * 0.12, o.head * 0.42, head);
    if (o.snout) mesh(new T.SphereGeometry(o.head * 0.22, 8, 6), M(o.snout), 0, -o.head * 0.08, o.head * 0.78, head);
    [-1, 1].forEach(function (s) { var e = mesh(new T.ConeGeometry(o.head * 0.1, o.ear, 5), m, s * o.head * 0.18, o.head * 0.32 + o.ear / 2, o.head * 0.05, head); e.rotation.z = -s * 0.25; });
    if (o.horns) [-1, 1].forEach(function (s) { var hn = mesh(new T.ConeGeometry(0.035, 0.2, 5), M('#cbb894'), s * 0.07, o.head * 0.35 + 0.08, -0.03, head); hn.rotation.x = -0.5; });
    if (o.beard) mesh(new T.ConeGeometry(0.04, 0.14, 5), M('#e8e0d0'), 0, -o.head * 0.35, o.head * 0.45, head).rotation.x = Math.PI;
    var tail = new T.Group(); tail.position.set(0, o.h - o.girth * 0.2, -o.len * 0.48); g.add(tail);
    var tl = mesh(new T.CylinderGeometry(0.04, o.tailW || 0.06, o.tail, 6), M(o.mane || o.col), 0, -o.tail / 2, -0.05, tail); tail.rotation.x = -0.35;
    g.userData = { legs: legs, neck: neck, head: head, tail: tail, o: o, tilt: o.tilt };
    return g;
  }
  function bunny(col) {
    var g = new T.Group(), m = M(col), b = mesh(new T.SphereGeometry(0.2, 12, 9), m, 0, 0.18, 0, g); b.scale.set(0.95, 0.85, 1.25);
    var head = new T.Group(); head.position.set(0, 0.3, 0.2); g.add(head);
    mesh(new T.SphereGeometry(0.13, 12, 9), m, 0, 0, 0, head);
    [-1, 1].forEach(function (s) { var e = mesh(new T.CylinderGeometry(0.035, 0.03, 0.26, 6), m, s * 0.055, 0.18, -0.02, head); e.rotation.z = -s * 0.15; mesh(new T.CylinderGeometry(0.018, 0.015, 0.2, 5), M('#ffc9d9'), s * 0.055, 0.18, 0.012, head).rotation.z = -s * 0.15; });
    mesh(new T.SphereGeometry(0.02, 6, 4), M('#2b1d14'), -0.06, 0.03, 0.1, head); mesh(new T.SphereGeometry(0.02, 6, 4), M('#2b1d14'), 0.06, 0.03, 0.1, head);
    mesh(new T.SphereGeometry(0.025, 6, 4), M('#ff9fb8'), 0, -0.01, 0.13, head);
    mesh(new T.SphereGeometry(0.07, 8, 6), M('#ffffff'), 0, 0.2, -0.26, g);
    g.userData = { head: head, legs: [], hop: true }; return g;
  }
  function duckling() {
    var g = new T.Group(), y = M('#ffe066'); mesh(new T.SphereGeometry(0.1, 10, 8), y, 0, 0.1, 0, g).scale.set(1, 0.9, 1.25);
    var head = new T.Group(); head.position.set(0, 0.2, 0.08); g.add(head); mesh(new T.SphereGeometry(0.065, 10, 8), y, 0, 0, 0, head);
    mesh(new T.ConeGeometry(0.025, 0.06, 6), M('#ff9a3d'), 0, -0.01, 0.08, head).rotation.x = Math.PI / 2;
    mesh(new T.SphereGeometry(0.012, 5, 4), M('#2b1d14'), -0.035, 0.02, 0.05, head); mesh(new T.SphereGeometry(0.012, 5, 4), M('#2b1d14'), 0.035, 0.02, 0.05, head);
    g.userData = { head: head, legs: [], waddle: true }; return g;
  }

  // ------------------------------------------------------------------ coaster
  function coaster(scene, W, C0, q) {
    var lp = [[-10, 1.2, 8], [-2, 1.2, 8], [4, 2.4, 8], [10, 6.6, 8], [16, 10.8, 8], [20, 13.6, 8], [24, 15, 8], [27.5, 14, 7.2], [31, 7, 4.5], [33, 2.6, 0], [31.5, 2.4, -6], [26, 2, -10]];
    var lc = V(16, 7.5, 0), R = 5.5;
    for (var k = 0; k < 8; k++) { var th = k * Math.PI / 4; lp.push([lc.x - Math.sin(th) * R, lc.y - Math.cos(th) * R, -11 - k / 8 * 3]); }
    lp.push([16, 2, -14], [8, 2.2, -14.5], [0, 3.2, -14.5], [-7, 3.6, -13], [-13, 3, -9], [-16, 2.2, -3], [-16, 1.6, 3], [-14, 1.2, 7]);
    var pts = lp.map(function (p) { return V(p[0] + C0.x, p[1], p[2] + C0.z); });
    var curve = new T.CatmullRomCurve3(pts, true, 'centripetal'), L = curve.getLength(), N = Math.ceil(L / 0.25), ds = L / N;
    var P = [], Tn = [], U = [], Rt = [];
    var up = V(0, 1, 0);
    for (var i = 0; i <= N; i++) { var u = i / N, p = curve.getPointAt(u % 1), t = curve.getTangentAt(u % 1).normalize(); up.sub(t.clone().multiplyScalar(up.dot(t))).normalize(); P.push(p); Tn.push(t); U.push(up.clone()); }
    function near(v) { var b = 0, bd = 1e9; for (var i = 0; i <= N; i++) { var d = P[i].distanceToSquared(v); if (d < bd) { bd = d; b = i; } } return b; }
    var iLoop0 = near(pts[12]), iLoop1 = near(pts[20]), iTw0 = near(pts[21]), iTw1 = near(pts[23]), iLift0 = near(pts[2]), iTop = near(pts[6]), iPark = near(pts[0]) + 14;
    // banking from yaw rate (not in the loop), plus one slow heartline roll in the twisty run
    var bank = []; for (i = 0; i <= N; i++) { var a = Tn[Math.max(0, i - 6)], b = Tn[Math.min(N, i + 6)], yaw = Math.atan2(a.x, a.z) - Math.atan2(b.x, b.z); while (yaw > Math.PI) yaw -= TAU; while (yaw < -Math.PI) yaw += TAU; bank.push((i > iLoop0 - 8 && i < iLoop1 + 8) || Math.abs(Tn[i].y) > 0.5 ? 0 : clamp(-yaw / (12 * ds) * 3.2, -0.75, 0.75)); }
    for (i = 0; i <= N; i++) {
      var sm = 0, n = 0; for (var j = -10; j <= 10; j++) { var ii = clamp(i + j, 0, N); sm += bank[ii]; n++; }
      var roll = sm / n + (i >= iTw0 && i <= iTw1 ? TAU * ease((i - iTw0) / (iTw1 - iTw0)) : 0);
      U[i].applyAxisAngle(Tn[i], roll); Rt.push(Tn[i].clone().cross(U[i]).normalize());
    }
    // rails
    var steel = M('#c8ccd6'), wood = M('#b7875a'), dwood = M('#8f6440');
    [-0.55, 0.55].forEach(function (o) { var rp = []; for (var i = 0; i < N; i += 4) rp.push(P[i].clone().addScaledVector(Rt[i], o)); var rc = new T.CatmullRomCurve3(rp, true); mesh(new T.TubeGeometry(rc, Math.floor(N / 2), 0.07, 5, true), steel, 0, 0, 0, scene); });
    var ties = inst(BOX, wood, Math.ceil(N / 3) + 2, scene);
    for (i = 0; i < N; i += 3) { _m.makeBasis(Rt[i], U[i], Tn[i]); _s.set(1.5, 0.12, 0.28); _m.scale(_s); _m.setPosition(P[i].clone().addScaledVector(U[i], -0.18)); ties.setMatrixAt(ties.count++, _m); }
    var posts = inst(CYL, wood, 400, scene), braces = inst(BOX, dwood, 300, scene);
    for (i = 0; i < N; i += 12) {
      if (U[i].y < 0.6 || P[i].y < 1.4 || (i > iLoop0 - 4 && i < iLoop1 + 4)) continue;
      var l = P[i].clone().addScaledVector(Rt[i], -0.7), r = P[i].clone().addScaledVector(Rt[i], 0.7), h = P[i].y - 0.3;
      post(posts, l.x, l.z, h, 0.11); post(posts, r.x, r.z, h, 0.11);
      if (h > 2.5) { beam(braces, V(l.x, 0.4, l.z), V(r.x, h - 0.2, r.z), 0.08, 0.1); beam(braces, V(l.x, h - 0.4, l.z), V(r.x, h - 0.4, r.z), 0.08, 0.12); }
    }
    // a couple of posts holding the loop up
    [iLoop0 + 6, iLoop1 - 6].forEach(function (i) { post(posts, P[i].x, P[i].z, P[i].y - 0.3, 0.14); });
    // station
    var sc = P[near(pts[0]) + 16].clone(), st = new T.Group(); scene.add(st);
    mesh(new T.BoxGeometry(10, 0.9, 2.4), wood, sc.x, 0.45, sc.z + 1.9, st);
    [[-4.6, -1.3], [4.6, -1.3], [-4.6, 3.0], [4.6, 3.0]].forEach(function (o) { mesh(new T.CylinderGeometry(0.1, 0.1, 3.4, 6), dwood, sc.x + o[0], 1.7, sc.z + o[1], st); });
    var roof = mesh(new T.BoxGeometry(10.6, 0.2, 4.6), M('#d9624e'), sc.x, 3.45, sc.z + 1, st); roof.rotation.x = 0.08;
    for (k = 0; k < 4; k++) mesh(new T.BoxGeometry(0.3, 0.3, 0.6), wood, sc.x + 5.2, 0.15 + k * 0.22, sc.z + 3.4 + k * 0.6, st);
    // chain dogs on the lift
    var chain = inst(BOX, M('#4a4a52'), 80, scene); chain.count = 80;
    // train: three cars
    var train = []; var cols = ['#e2463c', '#f2b134', '#3c8ce2'];
    for (k = 0; k < 3; k++) { var car = new T.Group(); mesh(new T.BoxGeometry(1.25, 0.4, 1.4), M(cols[k]), 0, 0.1, 0, car); mesh(new T.BoxGeometry(1.1, 0.4, 0.12), M('#7a2a22'), 0, 0.4, -0.6, car); mesh(new T.BoxGeometry(1.25, 0.08, 0.1), M('#ffd23f'), 0, 0.36, 0.66, car); [-0.5, 0.5].forEach(function (x) { mesh(new T.CylinderGeometry(0.14, 0.14, 0.12, 10), M('#333'), x, -0.1, 0.4, car).rotation.z = Math.PI / 2; mesh(new T.CylinderGeometry(0.14, 0.14, 0.12, 10), M('#333'), x, -0.1, -0.4, car).rotation.z = Math.PI / 2; }); scene.add(car); train.push(car); }
    var CO = { curve: curve, L: L, N: N, ds: ds, P: P, T: Tn, U: U, R: Rt, iLift0: iLift0, iTop: iTop, iPark: iPark, iLoop0: iLoop0, iLoop1: iLoop1, train: train, chain: chain, sTrain: iPark * ds, station: sc, yTop: P[iTop].y };
    CO.frame = function (s, out) { s = ((s % L) + L) % L; var f = s / ds, i = Math.floor(f), w = f - i, j = Math.min(N, i + 1); out = out || {}; out.p = (out.p || V(0, 0, 0)).lerpVectors(P[i], P[j], w); out.t = (out.t || V(0, 0, 0)).lerpVectors(Tn[i], Tn[j], w).normalize(); out.u = (out.u || V(0, 0, 0)).lerpVectors(U[i], U[j], w).normalize(); out.r = (out.r || V(0, 0, 0)).crossVectors(out.t, out.u).normalize(); return out; };
    var fr = {};
    CO.placeTrain = function (s) { CO.sTrain = s; for (var k = 0; k < 3; k++) { CO.frame(s - k * 1.6, fr); _m.makeBasis(fr.r, fr.u, fr.t); train[k].quaternion.setFromRotationMatrix(_m); train[k].position.copy(fr.p).addScaledVector(fr.u, 0.3); } };
    CO.placeTrain(CO.sTrain);
    CO.chainT = 0;
    CO.update = function (dt, run) { if (run) CO.chainT += dt * 2.2; var s0 = iLift0 * ds, s1 = iTop * ds, sp = (s1 - s0) / 80; for (var k = 0; k < 80; k++) { var s = s0 + ((k * sp + CO.chainT) % (s1 - s0)); CO.frame(s, fr); _m.makeBasis(fr.r, fr.u, fr.t); _s.set(0.12, 0.08, 0.22); _m.scale(_s); _m.setPosition(fr.p.clone().addScaledVector(fr.u, -0.05)); chain.setMatrixAt(k, _m); } chain.instanceMatrix.needsUpdate = true; };
    CO.update(0, true);
    W.things.push({ p: CO.station.clone(), name: 'the roller coaster', w: 'A roller coaster! Clack clack clack.' });
    return CO;
  }

  // ------------------------------------------------------------------ petting zoo
  function zoo(scene, W, Z) {
    function w(x, z) { return V(Z.x + x, 0, Z.z + z); }
    var F = { posts: inst(CYL, M('#a07850'), 700, scene), rails: inst(BOX, M('#c99a6b'), 1400, scene) };
    plane(scene, 3.2, 32, '#dcc79c', Z.x, 0.03, Z.z);
    // gate arch
    var wood = M('#a07850'); mesh(new T.CylinderGeometry(0.15, 0.15, 3.4, 8), wood, Z.x - 2, 1.7, Z.z + 15, scene); mesh(new T.CylinderGeometry(0.15, 0.15, 3.4, 8), wood, Z.x + 2, 1.7, Z.z + 15, scene);
    mesh(new T.BoxGeometry(4.8, 0.7, 0.2), M('#ffd23f'), Z.x, 3.3, Z.z + 15, scene);
    // barn
    var barn = new T.Group(); barn.position.copy(w(-11, -20)); scene.add(barn);
    mesh(new T.BoxGeometry(6, 3.6, 5), M('#c9564a'), 0, 1.8, 0, barn); var br = mesh(new T.CylinderGeometry(0.01, 3.5, 2, 4, 1), M('#7a4a3a'), 0, 4.6, 0, barn); br.rotation.y = Math.PI / 4; br.scale.set(1.25, 1, 1);
    mesh(new T.BoxGeometry(2, 2.4, 0.1), M('#fff3e0'), 0, 1.2, 2.52, barn);
    var pens = {
      horse: { shape: 'c', c: w(-10, -6), r: 7, out: w(-0.2, -6), fence: w(-2.3, -6), inside: w(-4.8, -6) },
      pony: { shape: 'c', c: w(-9, 9), r: 4.5, out: w(-0.2, 9), fence: w(-3.8, 9), inside: w(-6, 9) },
      goat: { shape: 'r', c: w(9, 9), hx: 3.5, hz: 3.5, out: w(0.4, 9), fence: w(4.8, 9), inside: w(7, 9) },
      bunny: { shape: 'r', c: w(8, 0), hx: 2.5, hz: 2.5, out: w(1.2, 0), fence: w(4.8, 0), inside: w(7, 0) },
      alpaca: { shape: 'r', c: w(9, -9), hx: 3, hz: 3, out: w(1.2, -9), fence: w(5.3, -9), inside: w(7.8, -9) },
      duck: { shape: 'r', c: w(0, -18), hx: 3.5, hz: 2.5, out: w(0, -12.6), fence: w(0, -14.8), inside: w(0, -16.6) }
    };
    for (var k in pens) {
      var pn = pens[k], gap = pn.shape === 'c' ? V(pn.c.x + pn.r, 0, pn.c.z) : (k === 'duck' ? V(pn.c.x, 0, pn.c.z + pn.hz) : V(pn.c.x - pn.hx, 0, pn.c.z));
      fence(F, pn.shape === 'c' ? circlePts(pn.c, pn.r, k === 'horse' ? 22 : 14) : rectPts(pn.c, pn.hx, pn.hz), gap);
      if (pn.shape === 'c') disc(scene, pn.r, k === 'horse' ? '#d4b98c' : '#c9b28a', pn.c.x, 0.025, pn.c.z, 28); else plane(scene, pn.hx * 2, pn.hz * 2, k === 'duck' ? '#9ad47a' : '#d8c08e', pn.c.x, 0.025, pn.c.z);
      pn.inPen = (function (pn) { return function (x, z, m) { m = m || 0.5; if (pn.shape === 'c') { var dx = x - pn.c.x, dz = z - pn.c.z, d = Math.hypot(dx, dz), R = pn.r - m; if (d > R) { x = pn.c.x + dx / d * R; z = pn.c.z + dz / d * R; } } else { x = clamp(x, pn.c.x - pn.hx + m, pn.c.x + pn.hx - m); z = clamp(z, pn.c.z - pn.hz + m, pn.c.z + pn.hz - m); } return V(x, 0, z); }; })(pn);
      pn.rand = (function (pn) { return function (m) { if (pn.shape === 'c') { var a = rnd() * TAU, d = Math.sqrt(rnd()) * (pn.r - (m || 1)); return V(pn.c.x + Math.cos(a) * d, 0, pn.c.z + Math.sin(a) * d); } return V(pn.c.x + rr(-1, 1) * (pn.hx - (m || 0.6)), 0, pn.c.z + rr(-1, 1) * (pn.hz - (m || 0.6))); }; })(pn);
    }
    // duck pond, hay bales, hutch, trough
    var dp = disc(scene, 1.2, '#79c8e8', pens.duck.c.x + 1.6, 0.04, pens.duck.c.z - 0.6, 20);
    var bales = [w(10.5, 10.8), w(8, 7.6)].map(function (p, i) { mesh(new T.BoxGeometry(1.1, 0.55, 0.7), M('#e8c75a'), p.x, 0.275, p.z, scene).rotation.y = i * 0.6; return { p: p, h: 0.55 }; });
    mesh(new T.BoxGeometry(1.6, 0.9, 1), M('#c99a6b'), pens.bunny.c.x + 1.4, 0.45, pens.bunny.c.z - 1.4, scene); mesh(new T.BoxGeometry(1.8, 0.12, 1.2), M('#d9624e'), pens.bunny.c.x + 1.4, 0.96, pens.bunny.c.z - 1.4, scene);
    mesh(new T.BoxGeometry(1.4, 0.4, 0.5), M('#9a7a5a'), pens.horse.c.x - 4, 0.6, pens.horse.c.z - 3, scene);
    var A = {
      horse: [quad({ len: 1.9, h: 1.55, girth: 0.72, leg: 0.08, neck: 0.9, tilt: 0.6, head: 0.62, ear: 0.16, col: '#a0683c', mane: '#3a2618', tail: 0.8, tailW: 0.1, snout: '#7a4a2a' })],
      pony: [quad({ len: 1.15, h: 1.0, girth: 0.6, leg: 0.07, neck: 0.55, tilt: 0.55, head: 0.45, ear: 0.12, col: '#e3c49a', mane: '#fff6e8', tail: 0.5, tailW: 0.09, snout: '#c79a72' })],
      goat: [0, 1, 2].map(function (i) { return quad({ len: 0.75, h: 0.62, girth: 0.4, leg: 0.045, neck: 0.3, tilt: 0.35, head: 0.3, ear: 0.1, col: ['#f2ece0', '#8a6a4a', '#d8cbb4'][i], tail: 0.12, horns: true, beard: true, hoof: '#555', snout: '#e0c8b8' }); }),
      bunny: ['#ffffff', '#b8b0a8', '#a8784a', '#f3e3c3'].map(bunny),
      alpaca: [quad({ len: 1.0, h: 0.95, girth: 0.68, leg: 0.07, neck: 0.75, tilt: 0.08, head: 0.34, ear: 0.16, col: '#f3e3c3', tail: 0.18, tailW: 0.1, hoof: '#6a5a4a', snout: '#e8d4b0' })],
      duck: [0, 1, 2, 3, 4].map(duckling)
    };
    var agents = [];
    for (k in A) A[k].forEach(function (g, i) { scene.add(g); var p = pens[k].rand(1); g.position.copy(p); agents.push({ kind: k, g: g, pen: pens[k], pos: p.clone(), tgt: p.clone(), wait: rr(0, 4), dist: 0, sp: { horse: 0.9, pony: 0.8, goat: 0.7, bunny: 0.9, alpaca: 0.6, duck: 0.45 }[k], i: i, y: 0, ph: rnd() * 6, hop: 0 }); });
    W.things.push({ p: w(0, 0), name: 'the petting zoo', w: 'Animals! A horse, goats and bunnies.' });
    var ZZ = { pens: pens, agents: agents, bales: bales, A: A, c: Z };
    var tmp = V(0, 0, 0);
    ZZ.update = function (dt, t, F) {
      agents.forEach(function (a) {
        if (a.ridden) return;
        var u = a.g.userData, focus = F && F.kind === a.kind ? F : null, st = focus ? focus.stage : 0;
        if (focus && st >= 2 && !(a.kind === 'duck' && st >= 4)) {
          var spread = (a.i - (A[a.kind].length - 1) / 2) * (a.kind === 'bunny' ? 0.45 : a.kind === 'goat' ? 0.75 : 0.3);
          if (st >= 4 && a.kind === 'bunny') { var ang = a.i / 4 * Math.PI + Math.atan2(F.fwd.z, F.fwd.x) - Math.PI * 0.4; a.tgt.set(F.at.x + Math.cos(ang) * 0.4, 0, F.at.z + Math.sin(ang) * 0.4); }
          else { var dir = V(F.at.x - a.pen.c.x, 0, F.at.z - a.pen.c.z); if (st >= 4) dir.set(F.fwd.x, 0, F.fwd.z).negate(); dir.normalize(); var reach = { horse: 1.5, pony: 1.05, goat: 0.75, bunny: 0.45, alpaca: 1.35, duck: 0.4 }[a.kind]; a.tgt.set(F.at.x - dir.x * reach - dir.z * spread, 0, F.at.z - dir.z * reach + dir.x * spread); }
          a.tgt.copy(a.pen.inPen(a.tgt.x, a.tgt.z, a.kind === 'horse' ? 0.9 : 0.35)); a.wait = 0; a.focused = true;
        } else if (a.focused) { a.focused = false; a.wait = rr(1, 3); a.tgt.copy(a.pos); }
        if (focus && a.kind === 'duck' && st >= 3 && F.trail) { var tp = F.trail(0.45 + a.i * 0.32); a.tgt.copy(tp); a.wait = 0; a.focused = true; }
        var d = tmp.copy(a.tgt).sub(a.pos); d.y = 0; var dl = d.length(), moving = false;
        if (a.wait > 0) a.wait -= dt;
        else if (dl > 0.08) { var sp = a.sp * (a.focused ? 1.5 : 1) * (a.kind === 'duck' && a.focused ? Math.min(3, 0.6 + dl * 2) : 1); var mv = Math.min(dl, sp * dt); a.pos.addScaledVector(d, mv / dl); a.dist += mv; moving = true; var yaw = a.focused && focus && dl < 0.7 ? Math.atan2(F.at.x - a.pos.x, F.at.z - a.pos.z) : Math.atan2(d.x, d.z), dy = yaw - a.g.rotation.y; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; a.g.rotation.y += dy * Math.min(1, dt * 4); }
        else if (!a.focused) { a.wait = rr(2, 7); a.tgt.copy(a.pen.rand(a.kind === 'horse' ? 1.5 : 0.6)); if (a.kind === 'goat' && rnd() < 0.5) { var b = bales[a.i % 2]; a.tgt.copy(b.p); } }
        else if (focus) { var fy = Math.atan2(F.at.x - a.pos.x, F.at.z - a.pos.z), dy2 = fy - a.g.rotation.y; while (dy2 > Math.PI) dy2 -= TAU; while (dy2 < -Math.PI) dy2 += TAU; a.g.rotation.y += dy2 * Math.min(1, dt * 3); }
        // legs / hops
        if (u.legs.length) u.legs.forEach(function (l, i) { l.rotation.x = moving ? Math.sin(a.dist * (a.kind === 'horse' ? 3.2 : 5.5) + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : l.rotation.x * 0.9; });
        var y = 0;
        if (a.kind === 'goat') { bales.forEach(function (b) { if (Math.hypot(a.pos.x - b.p.x, a.pos.z - b.p.z) < 0.55) y = b.h; }); a.y += (y - a.y) * Math.min(1, dt * 6); y = a.y + (Math.abs(y - a.y) > 0.05 ? Math.sin(Math.min(1, Math.abs(y - a.y) / 0.55) * Math.PI) * 0.3 : 0); }
        if (u.hop) y = moving ? Math.abs(Math.sin(a.dist * 5)) * 0.15 : 0;
        if (u.waddle) { a.g.rotation.z = moving ? Math.sin(a.dist * 16) * 0.15 : 0; }
        a.g.position.set(a.pos.x, y, a.pos.z);
        // heads: graze when idle, look up when focused, nuzzle when petted
        if (u.neck) { var graze = !moving && !a.focused && Math.sin(t * 0.3 + a.ph) > 0.2 ? 0.7 : 0; var nuz = focus && st >= 3 ? Math.sin(t * 3 + a.i) * 0.08 : 0; var tgtX = u.tilt + graze + (a.focused ? 0.15 : 0) + nuz; u.neck.rotation.x += (tgtX - u.neck.rotation.x) * Math.min(1, dt * 2); }
        if (u.head) u.head.rotation.y = a.focused ? Math.sin(t * 1.3 + a.i) * 0.15 : Math.sin(t * 0.4 + a.ph) * 0.3;
        if (u.tail) u.tail.rotation.z = Math.sin(t * (a.focused ? 6 : 1.5) + a.ph) * 0.3;
      });
    };
    return ZZ;
  }

  // ------------------------------------------------------------------ water park
  function channel(curve, n, R, col) {
    var pos = [], idx = [], segs = 10, up = V(0, 1, 0);
    for (var i = 0; i <= n; i++) { var u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u), r = t.clone().cross(up).normalize(), uu = r.clone().cross(t).normalize(); for (var j = 0; j <= segs; j++) { var f = j / segs * Math.PI; pos.push(p.x + r.x * Math.cos(f) * R - uu.x * Math.sin(f) * R, p.y + r.y * Math.cos(f) * R - uu.y * Math.sin(f) * R, p.z + r.z * Math.cos(f) * R - uu.z * Math.sin(f) * R); if (i && j) { var a = (i - 1) * (segs + 1) + j - 1, b = a + 1, c = i * (segs + 1) + j - 1, d = c + 1; idx.push(a, c, b, b, c, d); } } }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return new T.Mesh(g, M(col, { side: T.DoubleSide }));
  }
  function water(scene, W, C) {
    function w(x, y, z) { return V(C.x + x, y, C.z + z); }
    plane(scene, 38, 26, '#ece6da', C.x + 2, 0.02, C.z + 1);
    var blue = M('#5cc8f0'), white = M('#ffffff');
    // pool
    var pool = { c: w(0, 0, 8), hx: 7, hz: 4, y: 0.12 };
    mesh(new T.BoxGeometry(14, 0.1, 8), blue, pool.c.x, 0.07, pool.c.z, scene);
    [[0, -4.15, 14.6, 0.3], [0, 4.15, 14.6, 0.3], [-7.15, 0, 0.3, 8], [7.15, 0, 0.3, 8]].forEach(function (b) { mesh(new T.BoxGeometry(b[2], 0.25, b[3]), white, pool.c.x + b[0], 0.12, pool.c.z + b[1], scene); });
    // slide tower + helix slide
    var tw = w(-12, 0, 2.6), orange = M('#ffb347');
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (o) { mesh(new T.CylinderGeometry(0.12, 0.12, 8, 6), orange, tw.x + o[0], 4, tw.z + o[1], scene); });
    mesh(new T.BoxGeometry(2.6, 0.2, 2.6), M('#ff8f6b'), tw.x, 8, tw.z, scene); var tr = mesh(new T.ConeGeometry(2.1, 1.4, 4), M('#ff6b6b'), tw.x, 10, tw.z, scene); tr.rotation.y = Math.PI / 4;
    for (var k = 0; k < 9; k++) mesh(new T.BoxGeometry(1.2, 0.12, 0.5), M('#ffd23f'), tw.x + 1.6, 0.4 + k * 0.85, tw.z - 1.1 + (k % 2) * 0.5, scene);
    var hp = [], hc = w(-12, 0, 8.2), HR = 3.0;
    for (k = 0; k <= 64; k++) { var a = k / 64 * TAU * 2; hp.push(V(hc.x + Math.sin(a) * HR, 7.9 - k / 64 * 5.2, hc.z - Math.cos(a) * HR)); }
    hp.push(w(-9, 2.3, 5.4), w(-7.6, 1.1, 5.6), w(-6.2, 0.4, 5.9));
    var sc = new T.CatmullRomCurve3(hp); scene.add(channel(sc, 220, 0.7, '#ffd23f'));
    for (k = 4; k < 64; k += 8) { var sp = hp[k], ox = (sp.x - hc.x) / HR, oz = (sp.z - hc.z) / HR, R2 = HR + 1.0, px = hc.x + ox * R2, pz = hc.z + oz * R2;   // v0.3: poles stand just outside the helix with a short arm, so they don't pierce the turn below
      mesh(new T.CylinderGeometry(0.08, 0.08, sp.y - 0.3, 6), M('#e0e0e8'), px, (sp.y - 0.3) / 2, pz, scene);
      var arm = mesh(new T.BoxGeometry(0.1, 0.1, 1.05), M('#e0e0e8'), hc.x + ox * (HR + 0.5), sp.y - 0.38, hc.z + oz * (HR + 0.5), scene); arm.rotation.y = Math.atan2(ox, oz); }
    // a straight blue slide too (just to look at)
    var bs = mesh(new T.BoxGeometry(1.2, 0.2, 9.4), M('#7fb8ff'), tw.x + 2.8, 4.3, tw.z + 4.6, scene); bs.rotation.x = 0.88; bs.rotation.y = 0.35;
    // lazy river: ring of water round a little island with a palm
    var rc = w(10, 0, -3.5), rv = mesh(new T.RingGeometry(4.6, 7.6, 48), M('#6cc6e6'), rc.x, 0.07, rc.z, scene); rv.rotation.x = -Math.PI / 2;
    var rim = mesh(new T.RingGeometry(7.6, 8.1, 48), M('#d9d2c4'), rc.x, 0.08, rc.z, scene); rim.rotation.x = -Math.PI / 2;
    disc(scene, 4.6, '#9ad47a', rc.x, 0.09, rc.z, 32);
    mesh(new T.CylinderGeometry(0.15, 0.22, 4, 7), M('#a07850'), rc.x, 2, rc.z, scene); for (k = 0; k < 5; k++) { var lf = mesh(new T.ConeGeometry(0.5, 2.6, 5), M('#5fb35a'), rc.x + Math.cos(k * 1.26) * 1.0, 3.8, rc.z + Math.sin(k * 1.26) * 1.0, scene); lf.rotation.z = Math.cos(k * 1.26) * -1.3; lf.rotation.x = Math.sin(k * 1.26) * 1.3; }
    var tubes = []; var tcol = ['#ff8fc7', '#ffd23f', '#7fe0a0'];
    for (k = 0; k < 3; k++) { var tg = new T.Group(); mesh(new T.TorusGeometry(0.55, 0.22, 8, 18), M(tcol[k]), 0, 0, 0, tg).rotation.x = Math.PI / 2; var kid = W.person(['#ff8f8f', '#8fc7ff', '#b49bff'][k], 0.55, tg); kid.position.y = -0.35; scene.add(tg); tubes.push({ g: tg, a: k * 2.1, kid: kid }); }
    // splash pad + tipping bucket
    var sp0 = w(-8, 0, -4.5); disc(scene, 3.6, '#ffd8e8', sp0.x, 0.035, sp0.z, 32);
    ['#7fd7ff', '#ffe066', '#9be36b', '#c79bff', '#ff9b6b', '#7fd7ff'].forEach(function (c, i) { disc(scene, 0.35, c, sp0.x + Math.cos(i * 1.047) * 2.3, 0.045, sp0.z + Math.sin(i * 1.047) * 2.3, 14); });
    var jm = new T.MeshLambertMaterial({ color: '#d8f2ff', transparent: true, opacity: 0.6, emissive: '#6fb8e0', emissiveIntensity: 0.25 }), jets = [];
    for (k = 0; k < 7; k++) { var jx = k ? sp0.x + Math.cos(k * 1.047) * 2.3 : sp0.x + 1.2, jz = k ? sp0.z + Math.sin(k * 1.047) * 2.3 : sp0.z + 1.2; var j = mesh(new T.CylinderGeometry(0.06, 0.12, 1, 6), jm, jx, 0.5, jz, scene); jets.push({ m: j, ph: k * 0.9 }); }
    var pole = w(-8, 0, -8.6); mesh(new T.CylinderGeometry(0.18, 0.2, 6, 8), M('#ff6b6b'), pole.x, 3, pole.z, scene); mesh(new T.BoxGeometry(0.25, 0.25, 3), M('#ff6b6b'), pole.x, 6, pole.z + 1.5, scene);
    var bp = new T.Group(); bp.position.set(pole.x, 5.6, pole.z + 3); scene.add(bp);
    var bucket = mesh(new T.CylinderGeometry(0.75, 0.5, 1.0, 14, 1, true), M('#ffd23f', { side: T.DoubleSide }), 0, -0.3, 0, bp); mesh(new T.CircleGeometry(0.5, 14), M('#ffd23f', { side: T.DoubleSide }), 0, -0.8, 0, bp).rotation.x = Math.PI / 2;
    var bwater = mesh(new T.CircleGeometry(0.7, 14), M('#7fd0f0'), 0, -0.6, 0, bp); bwater.rotation.x = -Math.PI / 2;
    var drops = new T.Points(new T.BufferGeometry(), new T.PointsMaterial({ color: '#cfefff', size: 0.09, transparent: true, opacity: 0.85 }));
    var dp = new Float32Array(300 * 3), dv = new Float32Array(300 * 3); drops.geometry.setAttribute('position', new T.BufferAttribute(dp, 3)); scene.add(drops);
    // umbrellas + loungers
    [[-14, -9], [16, 9], [6, 12.5]].forEach(function (u, i) { var x = C.x + u[0], z = C.z + u[1]; mesh(new T.CylinderGeometry(0.05, 0.05, 2.4, 5), white, x, 1.2, z, scene); mesh(new T.ConeGeometry(1.4, 0.6, 8), M(['#ff8fc7', '#7fd7ff', '#ffe066'][i]), x, 2.5, z, scene); mesh(new T.BoxGeometry(0.7, 0.15, 1.8), M('#ffffff'), x + 1, 0.3, z, scene); });
    var swimmers = [W.person('#ff9a8a', 0.6), W.person('#9be3b0', 0.6)]; swimmers.forEach(function (s, i) { scene.add(s); s.userData.c = V(pool.c.x + (i ? 3 : -1), 0, pool.c.z + (i ? -1 : 1.5)); });
    W.things.push({ p: w(0, 0, 4), name: 'the water park', w: 'Water slides! Splash splash.' });
    var WP = { c: C, pool: pool, slide: sc, slideL: sc.getLength(), tower: tw, river: { c: rc, r: 6.1 }, tubes: tubes, pad: sp0, jets: jets, bucket: { pivot: bp, water: bwater, fill: 0.3, tip: 0, rate: 0.05 }, level: 0.35, drops: drops, dp: dp, dv: dv, di: 0, swimmers: swimmers };
    WP.spray = function (x, y, z, n, spd) { for (var i = 0; i < n; i++) { var k = WP.di = (WP.di + 1) % 300; dp[k * 3] = x + rr(-0.2, 0.2); dp[k * 3 + 1] = y; dp[k * 3 + 2] = z + rr(-0.2, 0.2); dv[k * 3] = rr(-1, 1) * spd * 0.3; dv[k * 3 + 1] = rr(0.6, 1) * spd; dv[k * 3 + 2] = rr(-1, 1) * spd * 0.3; } };
    WP.update = function (dt, t, ctx) {
      var lv = WP.level;
      jets.forEach(function (j, i) { var h = Math.max(0.05, lv * (1.2 + Math.sin(t * (1.3 + i * 0.2) + j.ph) * 0.9) * (i ? 1 : 1.5)); j.m.scale.y = h; j.m.position.y = h / 2; if (ctx && ctx.near && Math.random() < dt * 6 * lv) WP.spray(j.m.position.x, h, j.m.position.z, 2, 2.5); });
      var B = WP.bucket; if (B.tip <= 0) { B.fill += dt * B.rate; if (B.fill >= 1) { B.tip = 0.0001; if (WP.onTip) WP.onTip(); } } else { B.tip += dt; var tt = B.tip; B.pivot.rotation.x = tt < 0.7 ? -ease(tt / 0.7) * 2.3 : tt < 2.5 ? -2.3 : -2.3 * (1 - ease((tt - 2.5) / 1.5)); if (tt > 0.5 && tt < 1.6) WP.spray(B.pivot.position.x, B.pivot.position.y - 0.6, B.pivot.position.z + 0.3, 6, -1); if (tt > 4) { B.tip = 0; B.fill = 0; } }
      B.water.position.y = -0.75 + Math.min(1, B.fill) * 0.4; B.water.visible = B.tip <= 0;
      for (var k = 0; k < 300; k++) { if (dp[k * 3 + 1] <= -5) continue; dv[k * 3 + 1] -= 9.8 * dt; dp[k * 3] += dv[k * 3] * dt; dp[k * 3 + 1] += dv[k * 3 + 1] * dt; dp[k * 3 + 2] += dv[k * 3 + 2] * dt; if (dp[k * 3 + 1] < 0.05) dp[k * 3 + 1] = -5; }
      drops.geometry.attributes.position.needsUpdate = true;
      tubes.forEach(function (tb, i) { tb.a += dt * 0.06; var r = WP.river.r + 0.4 + Math.sin(tb.a * 3 + i) * 0.3; tb.g.position.set(WP.river.c.x + Math.cos(tb.a) * r, 0.2 + Math.sin(t * 1.5 + i) * 0.04, WP.river.c.z + Math.sin(tb.a) * r); tb.g.rotation.y = -tb.a + t * 0.1; });
      swimmers.forEach(function (s, i) { var c = s.userData.c; s.position.set(c.x + Math.sin(t * 0.2 + i * 2) * 2, -0.75 + Math.sin(t * 2 + i) * 0.05, c.z + Math.cos(t * 0.17 + i) * 1.2); s.userData.aL.rotation.x = Math.sin(t * 2 + i) * 1.2; s.userData.aR.rotation.x = -Math.sin(t * 2 + i) * 1.2; });
    };
    return WP;
  }

  // ------------------------------------------------------------------ bumper boats
  function boats(scene, W, C) {
    var r = 9; disc(scene, r, '#64c0e0', C.x, 0.06, C.z, 48);
    var rim = mesh(new T.TorusGeometry(r, 0.35, 8, 48), M('#ffd23f'), C.x, 0.2, C.z, scene); rim.rotation.x = Math.PI / 2;
    mesh(new T.BoxGeometry(3, 0.3, 2.2), M('#c99a6b'), C.x - 1, 0.25, C.z - r - 0.6, scene);
    var cols = ['#ff6b6b', '#7fd7ff', '#9be36b', '#c79bff', '#ffb347'], list = [];
    for (var k = 0; k < 5; k++) {
      var g = new T.Group(); mesh(new T.TorusGeometry(0.8, 0.32, 8, 20), M(cols[k]), 0, 0.3, 0, g).rotation.x = Math.PI / 2; mesh(new T.CylinderGeometry(0.75, 0.75, 0.3, 16), M('#ffffff'), 0, 0.25, 0, g); mesh(new T.BoxGeometry(0.5, 0.35, 0.4), M(cols[k]), 0, 0.5, -0.3, g); mesh(new T.TorusGeometry(0.1, 0.025, 6, 12), M('#333'), 0, 0.58, 0.45, g).rotation.x = -0.9;
      var kid = null; if (k > 0 && k < 4) { kid = W.person(['#ff8f8f', '#8fc7ff', '#ffd86b'][k - 1], 0.55, g); kid.position.set(0, 0.12, -0.2); }
      scene.add(g);
      var a = k * 1.25, p = k === 0 ? V(C.x - 1, 0, C.z - r + 1.6) : V(C.x + Math.cos(a) * 4.5, 0, C.z + Math.sin(a) * 4.5);
      list.push({ g: g, pos: p, vel: V(0, 0, 0), yaw: k === 0 ? 0 : rnd() * TAU, spin: 0, think: rr(0, 3), kid: kid, thrust: 0 });
    }
    W.things.push({ p: C.clone(), name: 'the bumper boats', w: 'Bumper boats! Bonk!' });
    var BB = { c: C, r: r - 1.1, list: list, me: list[0] };
    BB.update = function (dt, t) {
      list.forEach(function (b, i) {
        if (i > 0) { b.think -= dt; if (b.think < 0) { b.think = rr(2, 5); b.thrust = rnd() < 0.7 ? rr(0.6, 1.3) : 0; b.spin = rr(-0.6, 0.6); } }
        b.yaw += b.spin * dt; b.spin *= Math.pow(0.5, dt);
        if (b.thrust) { b.vel.x += Math.sin(b.yaw) * b.thrust * dt; b.vel.z += Math.cos(b.yaw) * b.thrust * dt; }
        b.vel.multiplyScalar(Math.pow(0.55, dt)); b.pos.addScaledVector(b.vel, dt);
        var dx = b.pos.x - C.x, dz = b.pos.z - C.z, d = Math.hypot(dx, dz); if (d > BB.r) { var nx = dx / d, nz = dz / d, vn = b.vel.x * nx + b.vel.z * nz; b.pos.x = C.x + nx * BB.r; b.pos.z = C.z + nz * BB.r; if (vn > 0) { b.vel.x -= 1.6 * vn * nx; b.vel.z -= 1.6 * vn * nz; b.spin += vn; } if (i > 0) b.yaw = Math.atan2(-nx, -nz) + rr(-0.6, 0.6); }
      });
      for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
        if (d < 2.1 && d > 0.001) { var nx = dx / d, nz = dz / d, ov = (2.1 - d) / 2; a.pos.x -= nx * ov; a.pos.z -= nz * ov; b.pos.x += nx * ov; b.pos.z += nz * ov; var rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz; if (rv < 0) { a.vel.x += rv * nx * 0.9; a.vel.z += rv * nz * 0.9; b.vel.x -= rv * nx * 0.9; b.vel.z -= rv * nz * 0.9; a.spin += rv * 1.2; b.spin -= rv * 1.2; if (BB.onBump && -rv > 0.25) BB.onBump(i === 0 || j === 0, -rv); } }
      }
      list.forEach(function (b, i) { b.g.position.set(b.pos.x, 0.02 + Math.sin(t * 2 + i) * 0.03, b.pos.z); b.g.rotation.y = b.yaw; b.g.rotation.z = Math.sin(t * 1.7 + i) * 0.03; if (b.kid) b.kid.userData.aL.rotation.z = 0.6 + Math.sin(t * 3 + i) * 0.3; });
    };
    return BB;
  }

  function build(scene, W, q) {
    W.CO_C = V(-30, 0, -40); W.ZOO_C = V(28, 0, -38); W.WP_C = V(-26, 0, 34); W.BL_C = V(28, 0, 32);
    W.co = coaster(scene, W, W.CO_C, q); W.zoo = zoo(scene, W, W.ZOO_C); W.wp = water(scene, W, W.WP_C); W.bb = boats(scene, W, W.BL_C);
    // little side paths from the main path to each new area
    var pm = M('#cfb08a');
    [[-34, -3.3, -36, -29], [28, 4.8, 28, -22], [-24, -4.8, -24, 22], [26, 4.8, 27, 22]].forEach(function (s) { var a = V(s[0], 0.026, s[1]), b = V(s[2], 0.026, s[3]), d = b.clone().sub(a), L = d.length(); var m = mesh(new T.PlaneGeometry(2.2, L), pm, (a.x + b.x) / 2, 0.026, (a.z + b.z) / 2, scene); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(d.x, d.z) + Math.PI; m.receiveShadow = true; });
  }
  function update(W, dt, t, F) { W.co.update(dt, true); W.zoo.update(dt, t, F && F.zoo); W.wp.update(dt, t, F && F.wp); W.bb.update(dt, t); }
  root.WalkerWorld2 = { build: build, update: update, clear: function (x, z) {
    if (x > -50 && x < 10 && z > -58 && z < -24) return false;
    if (x > 10 && x < 46 && z > -60 && z < -16) return false;
    if (x > -46 && x < -4 && z > 14 && z < 50) return false;
    if (Math.hypot(x - 28, z - 32) < 13) return false;
    if ((Math.abs(x + 35) < 3 && z < 0 && z > -30) || (Math.abs(x - 28) < 3 && z < 0 && z > -24) || (Math.abs(x + 24) < 3 && z > 0 && z < 22) || (Math.abs(x - 27) < 3 && z > 0 && z < 22)) return false;
    return true; } };
})(window);
