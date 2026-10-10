/* WALKER world: soft, sparse park. A bouncy castle (west), a playground (east), a quiet path between, rocket in the middle. */
(function (root) {
  var T = root.THREE;
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function pathZ(x) { return 5 * Math.sin(x / 14); }
  function M(c, o) { o = o || {}; o.color = c; return new T.MeshLambertMaterial(o); }
  function mesh(g, m, x, y, z, p) { var e = new T.Mesh(g, m); e.position.set(x || 0, y || 0, z || 0); e.castShadow = e.receiveShadow = !!(p && p.shadow); if (p && p.parent) p.parent.add(e); return e; }

  function person(col, s, parent) {
    var g = new T.Group(), skin = M(['#f2c9a0', '#c98e62', '#8d5a3b', '#f7d7b5'][Math.floor(rnd() * 4)]);
    mesh(new T.CylinderGeometry(0.22, 0.28, 0.75, 10), M(col), 0, 0.95, 0, { parent: g });
    mesh(new T.CylinderGeometry(0.1, 0.1, 0.6, 6), M('#56607a'), -0.11, 0.3, 0, { parent: g });
    mesh(new T.CylinderGeometry(0.1, 0.1, 0.6, 6), M('#56607a'), 0.11, 0.3, 0, { parent: g });
    var head = mesh(new T.SphereGeometry(0.22, 14, 10), skin, 0, 1.55, 0, { parent: g });
    mesh(new T.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, 1.3), M(['#4a3020', '#e8c060', '#222', '#a0522d'][Math.floor(rnd() * 4)]), 0, 1.6, -0.02, { parent: g });
    var aL = new T.Group(), aR = new T.Group(); aL.position.set(-0.3, 1.25, 0); aR.position.set(0.3, 1.25, 0);
    mesh(new T.CylinderGeometry(0.07, 0.07, 0.55, 6), M(col), 0, -0.27, 0, { parent: aL }); mesh(new T.CylinderGeometry(0.07, 0.07, 0.55, 6), M(col), 0, -0.27, 0, { parent: aR });
    g.add(aL, aR); g.userData = { head: head, aL: aL, aR: aR }; g.scale.setScalar(s || 1); if (parent) parent.add(g); return g;
  }

  function companion(type) {
    var g = new T.Group(), c = { monkey: ['#9b6a43', '#e8c39a'], dog: ['#e0b070', '#fff3dd'], bear: ['#c4875a', '#f3d6b0'] }[type] || ['#ccc', '#fff'];
    var body = mesh(new T.SphereGeometry(0.32, 16, 12), M(c[0]), 0, 0.42, 0, { parent: g }); body.scale.set(1, 0.9, type === 'dog' ? 1.35 : 1);
    if (type === 'bear') body.scale.set(1, 1.15, 1);
    var head = new T.Group(); head.position.set(0, type === 'dog' ? 0.72 : 0.85, type === 'dog' ? 0.35 : 0.05); g.add(head);
    mesh(new T.SphereGeometry(0.24, 16, 12), M(c[0]), 0, 0, 0, { parent: head });
    mesh(new T.SphereGeometry(0.13, 12, 8), M(c[1]), 0, -0.05, 0.18, { parent: head });
    mesh(new T.SphereGeometry(0.035, 8, 6), M('#2b1d14'), 0, 0, 0.3, { parent: head });
    mesh(new T.SphereGeometry(0.035, 8, 6), M('#2b1d14'), -0.09, 0.07, 0.2, { parent: head }); mesh(new T.SphereGeometry(0.035, 8, 6), M('#2b1d14'), 0.09, 0.07, 0.2, { parent: head });
    var earG = type === 'dog' ? new T.SphereGeometry(0.1, 8, 6) : new T.SphereGeometry(0.09, 10, 8);
    var e1 = mesh(earG, M(type === 'monkey' ? c[1] : c[0]), -0.2, type === 'dog' ? 0.02 : 0.16, 0, { parent: head }), e2 = mesh(earG, e1.material, 0.2, e1.position.y, 0, { parent: head });
    if (type === 'dog') { e1.scale.set(0.6, 1.6, 0.8); e2.scale.set(0.6, 1.6, 0.8); }
    if (type === 'monkey') { e1.position.y = e2.position.y = 0; e1.position.x = -0.25; e2.position.x = 0.25; }
    var feet = [];
    [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]].forEach(function (p) { feet.push(mesh(new T.SphereGeometry(0.1, 10, 8), M(c[1]), p[0], 0.08, p[1] * (type === 'dog' ? 1.6 : 1), { parent: g })); });
    var tail = mesh(type === 'monkey' ? new T.TorusGeometry(0.2, 0.04, 6, 12, 4) : new T.SphereGeometry(type === 'dog' ? 0.08 : 0.07, 8, 6), M(c[0]), 0, type === 'monkey' ? 0.5 : 0.5, -0.4, { parent: g });
    if (type === 'dog') tail.scale.set(0.6, 0.6, 2);
    g.userData = { head: head, feet: feet, tail: tail, body: body, type: type };
    g.scale.setScalar(type === 'bear' ? 1.05 : 1);
    return g;
  }

  function build(scene, q) {
    var W = { pathZ: pathZ, person: person, companion: companion, B: new T.Vector3(-46, 0, 0), P: new T.Vector3(46, 0, 0), R: new T.Vector3(0, 0, -24), POND: new T.Vector3(5, 0, 17), BENCH: new T.Vector3(-14, 0, -8), things: [], birds: [], trees: [] };
    var sky = new T.Color('#cfe8ff'); scene.background = sky; scene.fog = new T.Fog(sky, 40, 160); W.sky = sky;
    W.hemi = new T.HemisphereLight('#fff6e0', '#7fae6a', 0.62); scene.add(W.hemi);
    W.sun = new T.DirectionalLight('#fff0d0', 0.55); W.sun.position.set(30, 60, 20); scene.add(W.sun);
    if (q.shadows) { W.sun.castShadow = true; W.sun.shadow.mapSize.set(1024, 1024); var sc = W.sun.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.far = 160; }
    // ground + gentle hills
    var gg = new T.PlaneGeometry(400, 400, 60, 60); gg.rotateX(-Math.PI / 2);
    var pa = gg.attributes.position; for (var i = 0; i < pa.count; i++) { var x = pa.getX(i), z = pa.getZ(i), d = Math.sqrt(x * x + z * z); if (d > 70) pa.setY(i, (d - 70) * 0.08 * (1 + Math.sin(x * 0.05) * Math.cos(z * 0.04))); }
    gg.computeVertexNormals(); var ground = mesh(gg, M('#8fcf6e'), 0, 0, 0); ground.receiveShadow = true; scene.add(ground);
    // the path ribbon (+ branches to rocket, pond, bench)
    function ribbon(pts, w, col, y) {
      var pos = [], idx = []; for (var i = 0; i < pts.length; i++) { var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2; pos.push(pts[i].x + nx, y, pts[i].z + nz, pts[i].x - nx, y, pts[i].z - nz); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); }
      var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      var m = mesh(g, M(col, { side: T.DoubleSide }), 0, 0, 0); m.receiveShadow = true; scene.add(m); return m;
    }
    var main = []; for (var x = -40; x <= 40; x += 1) main.push({ x: x, z: pathZ(x) });
    ribbon(main.filter(function (p) { return Math.abs(p.x) <= 14; }), 3, '#d9d2c4', 0.03);
    ribbon(main.filter(function (p) { return p.x <= -13; }), 2.8, '#cfb08a', 0.025); ribbon(main.filter(function (p) { return p.x >= 13; }), 2.8, '#cfb08a', 0.025);
    ribbon([{ x: 0, z: 0 }, { x: 0, z: -10 }, { x: 0, z: -20 }], 2.2, '#d9d2c4', 0.028);
    ribbon([{ x: 1, z: pathZ(1) }, { x: 3, z: 8 }, { x: 5, z: 12 }], 2, '#cfb08a', 0.028);
    W.surface = function (x, z) { if (Math.abs(x) > 34) return 'soft'; if (Math.abs(x) <= 14 && Math.abs(z - pathZ(x)) < 2) return 'pave'; if (Math.abs(z - pathZ(x)) < 2) return 'dirt'; return 'grass'; };

    // ---- bouncy castle
    var B = W.B, castle = new T.Group(); castle.position.copy(B); scene.add(castle); W.castle = castle;
    var pink = M('#ff9fcf'), yel = M('#ffe27a'), blu = M('#8fd0ff'), grn = M('#a6eb8a');
    W.castleFloor = mesh(new T.BoxGeometry(14, 1, 14), M('#ffb8d8'), 0, 0.5, 0, { parent: castle, shadow: true }); W.floorY = 1.0;
    [[0, -7, 14, 0], [0, 7, 14, 0], [-7, 0, 14, 1]].forEach(function (w, i) { var t = mesh(new T.CapsuleGeometry ? new T.CapsuleGeometry(0.7, w[2] - 1.4, 6, 12) : new T.CylinderGeometry(0.7, 0.7, w[2], 12), [pink, blu, yel][i], w[0], 2.0, w[1], { parent: castle, shadow: true }); t.rotation.z = Math.PI / 2; if (w[3]) t.rotation.y = Math.PI / 2; });
    mesh(new T.BoxGeometry(0.4, 2.2, 14), M('#ffffff', { transparent: true, opacity: 0.25 }), -7, 3.4, 0, { parent: castle });
    [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(function (p, i) { var c = [yel, grn, blu, pink][i]; mesh(new T.CylinderGeometry(1.1, 1.2, 5, 14), c, p[0], 2.5, p[1], { parent: castle, shadow: true }); mesh(new T.SphereGeometry(1.15, 14, 10), [pink, blu, yel, grn][i], p[0], 5.4, p[1], { parent: castle }); });
    // front (east) arch posts
    mesh(new T.CylinderGeometry(0.7, 0.7, 3, 12), grn, 7, 1.5, -3.5, { parent: castle }); mesh(new T.CylinderGeometry(0.7, 0.7, 3, 12), grn, 7, 1.5, 3.5, { parent: castle });
    var arch = mesh(new T.TorusGeometry(3.5, 0.6, 10, 24, Math.PI), yel, 7, 3, 0, { parent: castle }); arch.rotation.y = Math.PI / 2;
    // hoop inside
    W.hoop = new T.Vector3(B.x - 5.5, 3.4, B.z - 5.5);
    mesh(new T.CylinderGeometry(0.12, 0.12, 2.6, 8), M('#ffffff'), -6.2, 2.3, -6.2, { parent: castle });
    var board = mesh(new T.BoxGeometry(1.4, 1, 0.1), M('#ffffff'), -5.9, 3.8, -5.9, { parent: castle }); board.rotation.y = Math.PI / 4;
    var ring = mesh(new T.TorusGeometry(0.32, 0.04, 6, 16), M('#ff6a3d'), -5.5, 3.4, -5.5, { parent: castle }); ring.rotation.x = Math.PI / 2;
    W.ball = mesh(new T.SphereGeometry(0.2, 14, 10), M('#ff8a3d'), 0, 0, 0); scene.add(W.ball); W.ballHome = new T.Vector3(B.x + 1, 1.2, B.z - 2); W.ball.position.copy(W.ballHome);
    // inflatable slide on the north side (outside), top at castle height
    var sl = mesh(new T.BoxGeometry(3, 0.5, 9), M('#7fd7ff'), 0, 2.4, -11.3, { parent: castle }); sl.rotation.x = -0.5;
    mesh(new T.BoxGeometry(3.4, 5, 1.6), M('#c79bff'), 0, 2.5, -7.8, { parent: castle, shadow: true });
    W.bSlideTop = new T.Vector3(B.x, 5.5, B.z - 7.6); W.bSlideBot = new T.Vector3(B.x, 1.4, B.z - 15.5);
    W.things.push({ p: B.clone(), name: 'the bouncy castle', w: 'Bouncy castle!' });

    // ---- playground
    var P = W.P, pg = new T.Group(); pg.position.copy(P); scene.add(pg); W.pg = pg;
    var chips = mesh(new T.CircleGeometry(14, 40), M('#e7b98a'), 0, 0.02, 0, { parent: pg }); chips.rotation.x = -Math.PI / 2; chips.receiveShadow = true;
    var red = M('#ff7a6b'), wood = M('#c99a6b'), metal = M('#8fb8ff');
    // slide tower
    [[-5, -7], [-3, -7], [-5, -5], [-3, -5]].forEach(function (p) { mesh(new T.CylinderGeometry(0.1, 0.1, 3, 8), wood, p[0], 1.5, p[1], { parent: pg }); });
    mesh(new T.BoxGeometry(2.2, 0.15, 2.2), wood, -4, 2.5, -6, { parent: pg, shadow: true }); var roof = mesh(new T.ConeGeometry(1.8, 1.2, 4), red, -4, 3.9, -6, { parent: pg }); roof.rotation.y = Math.PI / 4;
    var ps = mesh(new T.BoxGeometry(1.1, 0.12, 6), M('#ffb347'), -4, 1.35, -2.1, { parent: pg, shadow: true }); ps.rotation.x = 0.4;
    W.pSlideTop = new T.Vector3(P.x - 4, 3.6, P.z - 5.2); W.pSlideBot = new T.Vector3(P.x - 4, 1.0, P.z + 1.2);
    // swings
    var sw = new T.Group(); sw.position.set(4, 0, -6); pg.add(sw);
    [-1.8, 1.8].forEach(function (x) { var a = mesh(new T.CylinderGeometry(0.08, 0.08, 3.6, 6), metal, x, 1.7, -0.8, { parent: sw }); a.rotation.x = 0.25; var b = mesh(a.geometry, metal, x, 1.7, 0.8, { parent: sw }); b.rotation.x = -0.25; });
    var top = mesh(new T.CylinderGeometry(0.08, 0.08, 3.8, 6), metal, 0, 3.4, 0, { parent: sw }); top.rotation.z = Math.PI / 2;
    W.swings = [];
    [-0.8, 0.8].forEach(function (x) { var piv = new T.Group(); piv.position.set(x, 3.4, 0); sw.add(piv); mesh(new T.BoxGeometry(0.6, 0.06, 0.3), red, 0, -2.6, 0, { parent: piv }); mesh(new T.CylinderGeometry(0.015, 0.015, 2.6, 4), M('#666'), -0.27, -1.3, 0, { parent: piv }); mesh(new T.CylinderGeometry(0.015, 0.015, 2.6, 4), M('#666'), 0.27, -1.3, 0, { parent: piv }); W.swings.push(piv); });
    W.swingPivot = new T.Vector3(P.x + 4 - 0.8, 3.4, P.z - 6);
    // climbing dome
    var dome = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(2.6, 1)), new T.LineBasicMaterial({ color: '#4fbf6a' })); dome.position.set(6, 0.3, 5); pg.add(dome); W.domeTop = new T.Vector3(P.x + 6, 2.9, P.z + 5);
    // merry-go-round
    W.merry = new T.Group(); W.merry.position.set(-5, 0.3, 6); pg.add(W.merry);
    mesh(new T.CylinderGeometry(1.8, 1.8, 0.2, 24), M('#ffd23f'), 0, 0, 0, { parent: W.merry, shadow: true });
    for (var k = 0; k < 4; k++) { var h = mesh(new T.TorusGeometry(0.5, 0.05, 6, 12, Math.PI), [red, metal, M('#9be36b'), M('#c79bff')][k], Math.cos(k * Math.PI / 2) * 1.2, 0.1, Math.sin(k * Math.PI / 2) * 1.2, { parent: W.merry }); h.rotation.y = -k * Math.PI / 2; }
    W.merryC = new T.Vector3(P.x - 5, 0.3, P.z + 6);
    // seesaw
    mesh(new T.ConeGeometry(0.4, 0.6, 4), wood, 0, 0.3, 9, { parent: pg }); W.seesaw = mesh(new T.BoxGeometry(0.4, 0.1, 5), M('#7fd7ff'), 0, 0.62, 9, { parent: pg });
    W.seesawC = new T.Vector3(P.x, 0.62, P.z + 9);
    // sandbox
    mesh(new T.BoxGeometry(4, 0.3, 4), wood, 8, 0.15, -1, { parent: pg }); mesh(new T.BoxGeometry(3.6, 0.32, 3.6), M('#f5dca6'), 8, 0.16, -1, { parent: pg });
    mesh(new T.CylinderGeometry(0.2, 0.15, 0.3, 10), M('#ff7a6b'), 7.4, 0.45, -0.5, { parent: pg }); W.sandC = new T.Vector3(P.x + 8, 0.3, P.z - 1);
    W.sandPile = mesh(new T.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#ecc98a'), 8.6, 0.3, -1.4, { parent: pg }); W.sandPile.scale.y = 0.4;
    W.things.push({ p: W.swingPivot.clone(), name: 'swings', w: 'Swings!' }, { p: W.pSlideBot.clone(), name: 'the slide', w: 'The slide!' }, { p: W.sandC.clone(), name: 'sand', w: 'A sandbox.' });

    // ---- rocket (stub ride)
    var R = W.R, rk = new T.Group(); rk.position.copy(R); scene.add(rk); W.rocket = rk;
    mesh(new T.CylinderGeometry(3, 3.4, 0.6, 20), M('#c9c9d6'), 0, 0.3, 0, { parent: rk, shadow: true });
    mesh(new T.CylinderGeometry(1.2, 1.2, 7, 20), M('#ffffff'), 0, 4.1, 0, { parent: rk, shadow: true });
    mesh(new T.ConeGeometry(1.2, 2.4, 20), M('#ff6b6b'), 0, 8.8, 0, { parent: rk });
    mesh(new T.CircleGeometry(0.45, 16), M('#7fd7ff'), 0, 6, 1.21, { parent: rk });
    for (k = 0; k < 3; k++) { var f = mesh(new T.BoxGeometry(0.15, 2, 1.4), M('#ff6b6b'), Math.cos(k * 2.1) * 1.3, 1.6, Math.sin(k * 2.1) * 1.3, { parent: rk }); f.rotation.y = -k * 2.1; }
    W.flame = mesh(new T.ConeGeometry(0.9, 2.5, 12), new T.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0 }), 0, -0.6, 0, { parent: rk }); W.flame.rotation.x = Math.PI;
    W.things.push({ p: R.clone(), name: 'the rocket', w: 'A rocket ship!' });

    // ---- pond + ducks
    var pond = mesh(new T.CircleGeometry(5, 32), M('#79c8e8'), W.POND.x, 0.04, W.POND.z); pond.rotation.x = -Math.PI / 2; pond.scale.y = 0.7; scene.add(pond);
    W.ducks = []; for (k = 0; k < 3; k++) { var d = new T.Group(); mesh(new T.SphereGeometry(0.22, 10, 8), M(k ? '#f5f0e0' : '#ffe27a'), 0, 0.1, 0, { parent: d }).scale.set(1, 0.7, 1.4); mesh(new T.SphereGeometry(0.12, 8, 6), M(k ? '#3a7a4a' : '#ffe27a'), 0, 0.3, 0.2, { parent: d }); mesh(new T.ConeGeometry(0.05, 0.12, 6), M('#ffa040'), 0, 0.28, 0.34, { parent: d }).rotation.x = Math.PI / 2; scene.add(d); W.ducks.push(d); }
    W.things.push({ p: W.POND.clone(), name: 'ducks', w: 'Ducks on the pond.' });
    // ---- bench
    var bench = new T.Group(); bench.position.copy(W.BENCH); scene.add(bench); bench.rotation.y = 0.2;
    mesh(new T.BoxGeometry(2.4, 0.1, 0.6), wood, 0, 0.5, 0, { parent: bench }); mesh(new T.BoxGeometry(2.4, 0.5, 0.08), wood, 0, 0.85, -0.3, { parent: bench });
    W.things.push({ p: W.BENCH.clone(), name: 'a bench', w: 'A park bench.' });

    // ---- moments along the path
    W.mom = {};
    var bk = person('#6b8cff', 1); bk.position.set(-22, 0, pathZ(-22) - 4); bk.rotation.y = 0.3; scene.add(bk);
    var guitar = mesh(new T.BoxGeometry(0.6, 0.25, 0.1), M('#a0522d'), 0, 1.0, 0.3, { parent: bk }); guitar.rotation.z = 0.5;
    mesh(new T.CylinderGeometry(0.3, 0.25, 0.25, 12, 1, true), M('#5a4636', { side: T.DoubleSide }), 0.7, 0.12, 0.6, { parent: bk });
    W.mom.busker = { p: bk.position.clone(), obj: bk, look: new T.Vector3(-22, 1.3, pathZ(-22) - 4) };
    var pud = mesh(new T.CircleGeometry(0.9, 20), M('#8fd3f0'), -8, 0.05, pathZ(-8) + 2.6); pud.rotation.x = -Math.PI / 2; scene.add(pud);
    W.fish = mesh(new T.SphereGeometry(0.12, 8, 6), M('#ff9a3d'), -8, -1, pathZ(-8) + 2.6); W.fish.scale.set(0.6, 0.8, 1.6); scene.add(W.fish);
    W.mom.fish = { p: pud.position.clone(), look: new T.Vector3(-8, 0.3, pathZ(-8) + 2.6) };
    var deer = new T.Group(), dm = M('#b9855a');
    mesh(new T.BoxGeometry(0.5, 0.55, 1.3), dm, 0, 1.0, 0, { parent: deer });
    [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]].forEach(function (p) { mesh(new T.CylinderGeometry(0.05, 0.04, 0.8, 6), dm, p[0], 0.4, p[1], { parent: deer }); });
    var dneck = new T.Group(); dneck.position.set(0, 1.2, 0.55); deer.add(dneck);
    mesh(new T.CylinderGeometry(0.1, 0.14, 0.6, 8), dm, 0, 0.25, 0.1, { parent: dneck }).rotation.x = 0.4;
    mesh(new T.BoxGeometry(0.22, 0.22, 0.42), dm, 0, 0.55, 0.3, { parent: dneck });
    mesh(new T.SphereGeometry(0.08, 6, 4), M('#fff3e0'), 0, 0.68, 0.0, { parent: dneck });
    mesh(new T.ConeGeometry(0.06, 0.2, 5), dm, -0.12, 0.72, 0.2, { parent: dneck }); mesh(new T.ConeGeometry(0.06, 0.2, 5), dm, 0.12, 0.72, 0.2, { parent: dneck });
    deer.position.set(15, 0, -13); scene.add(deer); W.deer = deer; deer.userData.neck = dneck; deer.userData.home = deer.position.clone();
    W.mom.deer = { p: deer.position.clone(), look: new T.Vector3(15, 1.4, -13) };
    W.chips = []; for (k = 0; k < 2; k++) { var ch = new T.Group(); mesh(new T.SphereGeometry(0.12, 8, 6), M('#a8743f'), 0, 0.12, 0, { parent: ch }).scale.set(1, 1, 1.4); mesh(new T.SphereGeometry(0.08, 8, 6), M('#a8743f'), 0, 0.2, 0.13, { parent: ch }); mesh(new T.SphereGeometry(0.06, 6, 4), M('#5a3a20'), 0, 0.16, -0.18, { parent: ch }).scale.set(1, 3, 1); ch.position.set(22 + k, 0, pathZ(22) + 3.2); scene.add(ch); W.chips.push(ch); }
    W.mom.chip = { p: new T.Vector3(22.5, 0, pathZ(22) + 3.2), look: new T.Vector3(22.5, 0.2, pathZ(22) + 3.2) };
    var lb = new T.Group(); lb.position.set(6, 0, pathZ(6) - 5); lb.rotation.y = 0; scene.add(lb);
    mesh(new T.BoxGeometry(2.4, 0.1, 0.6), wood, 0, 0.5, 0, { parent: lb });
    W.laughers = [person('#ff9a8a', 0.95, lb), person('#9be3b0', 0.95, lb)]; W.laughers[0].position.set(-0.5, -0.25, 0); W.laughers[1].position.set(0.5, -0.25, 0);
    W.mom.laugh = { p: lb.position.clone(), look: new T.Vector3(6, 1.1, pathZ(6) - 5) };
    W.mom.ducks = { p: W.POND.clone(), look: W.POND.clone() };

    // ---- trees, bushes, flowers
    var trunk = M('#a07850'), leaves = [M('#7fc46a'), M('#94d47a'), M('#6bb86a'), M('#b6dc7a')];
    function clear(x, z) { if (Math.abs(z - pathZ(x)) < 4 && Math.abs(x) < 42) return false; if (Math.hypot(x - W.B.x, z) < 14 || Math.hypot(x - W.P.x, z) < 16 || Math.hypot(x - W.R.x, z - W.R.z) < 6 || Math.hypot(x - W.POND.x, z - W.POND.z) < 7) return false; if (Math.abs(x) < 2 && z < 0 && z > -22) return false; if (Math.abs(z + 70) < 5) return false; return true; }
    var nT = q.trees, n = 0, tries = 0;
    while (n < nT && tries++ < 2000) {
      var tx = (rnd() - 0.5) * 180, tz = (rnd() - 0.5) * 140; if (!clear(tx, tz)) continue;
      var tr = new T.Group(), s = 0.8 + rnd() * 0.7; tr.position.set(tx, 0, tz); tr.scale.setScalar(s);
      mesh(new T.CylinderGeometry(0.2, 0.3, 2, 6), trunk, 0, 1, 0, { parent: tr, shadow: q.shadows });
      if (rnd() < 0.3) mesh(new T.ConeGeometry(1.5, 4, 8), leaves[2], 0, 3.6, 0, { parent: tr, shadow: q.shadows });
      else { var lm = leaves[Math.floor(rnd() * 4)]; mesh(new T.IcosahedronGeometry(1.5, 1), lm, 0, 3, 0, { parent: tr, shadow: q.shadows }); mesh(new T.IcosahedronGeometry(1.0, 1), lm, 0.8, 2.6, 0.3, { parent: tr }); }
      scene.add(tr); W.trees.push(tr); n++;
    }
    W.things.push({ p: new T.Vector3(-30, 0, -9), name: 'a tree', w: 'A big tree.' });
    var fl = ['#ff9fcf', '#ffe27a', '#ffffff', '#c79bff'];
    for (k = 0; k < q.flowers; k++) { var fx = (rnd() - 0.5) * 90, fz = (rnd() - 0.5) * 60; if (!clear(fx, fz) && Math.abs(fz - pathZ(fx)) < 2) continue; mesh(new T.SphereGeometry(0.09, 5, 4), M(fl[k % 4]), fx, 0.15, fz, { parent: scene }); }
    // clouds
    W.clouds = []; for (k = 0; k < 9; k++) { var cl = new T.Group(), cm = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 }); for (var j = 0; j < 4; j++) mesh(new T.SphereGeometry(3 + rnd() * 3, 10, 8), cm, j * 4 - 6, rnd() * 2, rnd() * 3, { parent: cl }); cl.position.set((rnd() - 0.5) * 300, 40 + rnd() * 20, -60 - rnd() * 80); scene.add(cl); W.clouds.push(cl); W.cloudMat = cm; }
    // birds
    var bm = new T.MeshBasicMaterial({ color: '#4a4a5a', side: T.DoubleSide });
    for (k = 0; k < 6; k++) { var bd = new T.Group(), wg = new T.PlaneGeometry(0.5, 0.18); var w1 = mesh(wg, bm, -0.25, 0, 0, { parent: bd }), w2 = mesh(wg, bm, 0.25, 0, 0, { parent: bd }); bd.userData = { w1: w1, w2: w2, cx: (rnd() - 0.5) * 80, cz: (rnd() - 0.5) * 50, r: 6 + rnd() * 10, h: 9 + rnd() * 8, sp: 0.15 + rnd() * 0.2, ph: rnd() * 6 }; scene.add(bd); W.birds.push(bd); }
    W.things.push({ p: new T.Vector3(0, 10, 0), name: 'birds', w: 'Look, a bird!', sky: true });
    // far road + a car
    var road = mesh(new T.PlaneGeometry(400, 5), M('#b8b8bc'), 0, 0.05, -70); road.rotation.x = -Math.PI / 2; scene.add(road);
    W.car = new T.Group(); mesh(new T.BoxGeometry(3, 1, 1.6), M('#ff7a6b'), 0, 0.8, 0, { parent: W.car }); mesh(new T.BoxGeometry(1.6, 0.7, 1.4), M('#cfe8ff'), -0.2, 1.6, 0, { parent: W.car }); W.car.position.set(-300, 0, -70); scene.add(W.car);
    // little car you can ride (shown in front of the camera when the toggle is on)
    W.myCar = new T.Group(); mesh(new T.BoxGeometry(1.5, 0.35, 1.2), M('#ffd23f'), 0, -0.85, -0.9, { parent: W.myCar }); mesh(new T.TorusGeometry(0.22, 0.05, 6, 16), M('#555'), 0, -0.55, -0.55, { parent: W.myCar }).rotation.x = -0.6; W.myCar.visible = false;
    // rain + rainbow
    var rg = new T.BufferGeometry(), rp = new Float32Array(q.rain * 3); for (k = 0; k < q.rain; k++) { rp[k * 3] = (rnd() - 0.5) * 60; rp[k * 3 + 1] = rnd() * 25; rp[k * 3 + 2] = (rnd() - 0.5) * 60; }
    rg.setAttribute('position', new T.BufferAttribute(rp, 3)); W.rain = new T.Points(rg, new T.PointsMaterial({ color: '#cfe3ff', size: 0.12, transparent: true, opacity: 0 })); scene.add(W.rain);
    var rb = new T.Group(); ['#ff8080', '#ffb060', '#ffe070', '#90e090', '#80c0ff', '#b090ff'].forEach(function (c, i) { mesh(new T.TorusGeometry(70 - i * 2, 1, 6, 48, Math.PI), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, fog: false }), 0, 0, 0, { parent: rb }); }); rb.position.set(10, -5, -150); scene.add(rb); W.rainbow = rb;
    var sg = new T.BufferGeometry(), spp = new Float32Array(1500 * 3); for (k = 0; k < 1500; k++) { var th = rnd() * Math.PI * 2, ph = rnd() * Math.PI * 0.5, R0 = 300; spp[k * 3] = Math.cos(th) * Math.cos(ph) * R0; spp[k * 3 + 1] = Math.sin(ph) * R0 + 40; spp[k * 3 + 2] = Math.sin(th) * Math.cos(ph) * R0; }
    sg.setAttribute('position', new T.BufferAttribute(spp, 3)); W.stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); W.stars.visible = false; scene.add(W.stars);
    return W;
  }
  root.WalkerWorld = { build: build, pathZ: pathZ };
})(window);
