/* Mini Golf v0.3 (dev) - v0.2 + anonymous play metrics test (ztp-kit_v02 gameStart/gameEnd). Was: Mini Golf v0.2 (dev) - 3x power (curved), glide-then-settle roll. - cannon.js physics + three.js. Pull back from the ball (slingshot) to aim + set power.
   4 starter holes: Jump, Windmill spinner, Loop, Elevator. Hot-seat 1-4 players, own ball colours, ball-to-ball toggle.
   Test hooks: ?hole=1..4  ?shot (auto-shoots for headless screenshots)  window.__mg */
(function () {
  'use strict';
  var mode = Proto.init(), Q = new URLSearchParams(location.search);
  var MET = window.ZTPMetrics, run = MET ? MET.gameStart('minigolf', { ver: 'v0.3', mode: mode }) : null;
  var R = new THREE.WebGLRenderer({ canvas: document.getElementById('cv'), antialias: true }); R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  R.shadowMap.enabled = !/Android|iPhone|iPad/.test(navigator.userAgent) || Q.has('hq');
  var scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd3ff); scene.fog = new THREE.Fog(0x8fd3ff, 25, 70);
  var cam = new THREE.PerspectiveCamera(58, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 0.75)); var sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(6, 14, 4); sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -14; sun.shadow.camera.right = sun.shadow.camera.top = 14; sun.shadow.mapSize.set(1024, 1024); scene.add(sun); scene.add(sun.target);
  var lawn = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: 0x4f9a46 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -2.2; scene.add(lawn);

  var world = new CANNON.World(); world.gravity.set(0, -9.82, 0); world.broadphase = new CANNON.NaiveBroadphase(); world.solver.iterations = 12;
  var mGround = new CANNON.Material('g'), mBall = new CANNON.Material('b'), mWall = new CANNON.Material('w');
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mGround, { friction: 0.25, restitution: 0.25 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mWall, { friction: 0.05, restitution: 0.65 }));
  world.addContactMaterial(new CANNON.ContactMaterial(mBall, mBall, { friction: 0.05, restitution: 0.8 }));
  var COL = { green: 0x37b24d, wall: 0xf4f1e8, wood: 0xb5733a, red: 0xe64545, blue: 0x3d7bea, yel: 0xffc83a };
  var BR = 0.12, MAXV = 31.5, cupR = mode === 'kid' ? 0.3 : 0.2;
  var opts = { collide: true, players: 1 };
  try { Object.assign(opts, JSON.parse(localStorage.getItem('mg:opts') || '{}')); } catch (e) {}
  function saveOpts() { try { localStorage.setItem('mg:opts', JSON.stringify(opts)); } catch (e) {} }

  // ---------- course building ----------
  var built = [], movers = [], boosts = [];
  function quatX(a) { var q = new CANNON.Quaternion(); q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), a); return q; }
  function quatY(a) { var q = new CANNON.Quaternion(); q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), a); return q; }
  // parts: [[hx,hy,hz, ox,oy,oz, color, isWall]]
  function body(parts, pos, quat, type) {
    var b = new CANNON.Body({ mass: 0, type: type || CANNON.Body.STATIC }); b.collisionFilterGroup = 1; b.collisionFilterMask = -1;
    var g = new THREE.Group();
    parts.forEach(function (p) { var sh = new CANNON.Box(new CANNON.Vec3(p[0], p[1], p[2])); sh.material = p[7] ? mWall : mGround; b.addShape(sh, new CANNON.Vec3(p[3], p[4], p[5]));
      var m = new THREE.Mesh(new THREE.BoxGeometry(p[0] * 2, p[1] * 2, p[2] * 2), new THREE.MeshLambertMaterial({ color: p[6] })); m.position.set(p[3], p[4], p[5]); m.castShadow = m.receiveShadow = true; g.add(m); });
    b.position.set(pos[0], pos[1], pos[2]); if (quat) b.quaternion.copy(quat); world.addBody(b); scene.add(g); g.position.copy(b.position); g.quaternion.copy(b.quaternion);
    built.push({ b: b, g: g }); if (type) movers.push({ b: b, g: g }); return b; }
  // straight lane: floor top at y, from z0 to z1 (z1<z0), width w, centred x, with side walls
  function lane(x, y, z0, z1, w, noWalls) { var L = (z0 - z1) / 2, zc = (z0 + z1) / 2, parts = [[w / 2, 0.1, L, 0, -0.1, 0, COL.green]];
    if (!noWalls) { parts.push([0.075, 0.15, L, -w / 2 - 0.075, 0.05, 0, COL.wall, 1], [0.075, 0.15, L, w / 2 + 0.075, 0.05, 0, COL.wall, 1]); }
    return body(parts, [x, y, zc]); }
  function endWall(x, y, z, w) { return body([[w / 2 + 0.15, 0.15, 0.075, 0, 0.05, 0, COL.wall, 1]], [x, y, z]); }
  function deco(obj) { scene.add(obj); built.push({ g: obj }); }
  function cupAt(x, y, z) { var c = new THREE.Mesh(new THREE.CircleGeometry(cupR, 24), new THREE.MeshBasicMaterial({ color: 0x111111 })); c.rotation.x = -Math.PI / 2; c.position.set(x, y + 0.003, z); deco(c);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1), new THREE.MeshLambertMaterial({ color: 0xffffff })); pole.position.set(x, y + 0.55, z); deco(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshLambertMaterial({ color: COL.red, side: THREE.DoubleSide })); flag.position.set(x + 0.2, y + 0.98, z); deco(flag); return new THREE.Vector3(x, y, z); }

  var HOLES = [
    { name: 'The Jump', par: 3, build: function () {
      lane(0, 0, 1, -6, 2.2); endWall(0, 0, 1, 2.2);
      var a = Math.atan2(0.6, 2); body([[1.1, 0.1, 1.05, 0, -0.1, 0, COL.yel], [0.075, 0.15, 1.05, -1.175, 0.05, 0, COL.wall, 1], [0.075, 0.15, 1.05, 1.175, 0.05, 0, COL.wall, 1]], [0, 0.3, -7], quatX(a));
      lane(0, 0.15, -9.6, -15, 2.4); endWall(0, 0.15, -15, 2.4);
      return { tee: [0, 0, 0], cup: cupAt(0, 0.15, -13.6) }; } },
    { name: 'Windmill', par: 3, build: function () {
      lane(0, 0, 1, -12, 2.6); endWall(0, 0, 1, 2.6); endWall(0, 0, -12, 2.6);
      var sp = body([[1.15, 0.12, 0.08, 0, 0.12, 0, COL.red, 1], [0.12, 0.25, 0.12, 0, 0.25, 0, COL.wood, 1]], [0, 0, -5.5], null, CANNON.Body.KINEMATIC); sp.angularVelocity.set(0, 1.7, 0);
      body([[0.6, 0.4, 0.1, -0.75, 0.4, 0, COL.wood, 1], [0.6, 0.4, 0.1, 0.75, 0.4, 0, COL.wood, 1]], [0, 0, -8.2]);  // windmill gate: gap in the middle
      var blades = new THREE.Group(); for (var i = 0; i < 4; i++) { var bl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.03), new THREE.MeshLambertMaterial({ color: 0xffffff })); bl.position.y = 0.65; var arm = new THREE.Group(); arm.add(bl); arm.rotation.z = i * Math.PI / 2; blades.add(arm); }
      blades.position.set(0, 1.35, -8.05); deco(blades); movers.push({ spin: blades });
      var house = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.6, 0.18), new THREE.MeshLambertMaterial({ color: COL.wood })); house.position.set(0, 1.1, -8.2); deco(house);
      return { tee: [0, 0, 0], cup: cupAt(0.4, 0, -10.6) }; } },
    { name: 'The Loop', par: 3, build: function () {
      var Rl = 0.95, N = 30, cz = -5, XO = 0.95, w = 0.7;
      lane(0, 0, 1, cz, 0.9); endWall(0, 0, 1, 0.9);
      var pad = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ color: 0xff8a1f })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.004, -3); deco(pad);
      for (var c = 0; c < 3; c++) { var ch = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); ch.rotation.set(-Math.PI / 2, 0, 0); ch.scale.y = 0.6; ch.position.set(0, 0.01, -2.6 - c * 0.35); deco(ch); }
      boosts.push({ x: 0, z: -3, hw: 0.4, hz: 0.6, v: 7.8 });
      for (var i = 0; i < N; i++) { var ph = (i + 0.5) / N * Math.PI * 2, x = XO * ph / (Math.PI * 2), y = Rl - Rl * Math.cos(ph), z = cz - Rl * Math.sin(ph), th = 0.06, seg = Rl * Math.PI * 2 / N * 0.56;
        body([[w / 2, th, seg, 0, -th, 0, i % 2 ? COL.blue : 0x5b93ff], [0.04, 0.09, seg, -w / 2 - 0.04, 0.05, 0, COL.wall, 1], [0.04, 0.09, seg, w / 2 + 0.04, 0.05, 0, COL.wall, 1]], [x, y, z], quatX(ph)); }
      lane(XO, 0, cz, cz - 2, 0.9); lane(XO, 0, cz - 2, -14, 3); endWall(XO, 0, -14, 3);
      return { tee: [0, 0, 0], cup: cupAt(XO + 0.5, 0, -12.4) }; } },
    { name: 'Elevator', par: 4, build: function () {
      lane(0, 0, 1, -5, 2); endWall(0, 0, 1, 2);
      body([[0.075, 1.1, 0.8, -1.075, 0.4, 0, COL.wall, 1], [0.075, 1.1, 0.8, 1.075, 0.4, 0, COL.wall, 1], [1, 0.1, 0.8, 0, -1.1, 0, 0x555555]], [0, 0, -5.8]);   // shaft
      var el = body([[0.98, 0.08, 0.75, 0, -0.08, 0, COL.yel]], [0, 0, -5.8], null, CANNON.Body.KINEMATIC); el.velocity.set(0, 0.55, 0); el.userData = { lo: -0.8, hi: 1.5, shaft: [-1, 1, -6.6, -5] };
      body([[1.4, 1.3, 3.4, 0, 0.2, 0, 0x2f9e44]], [0, 0, -10]); lane(0, 1.5, -6.6, -13.4, 2.8); endWall(0, 1.5, -13.4, 2.8);
      var gate = body([[0.5, 0.15, 0.08, 0, 0.15, 0, COL.red, 1]], [0, 1.5, -9.5], null, CANNON.Body.KINEMATIC); gate.velocity.set(0.9, 0, 0); gate.userData = { xlo: -0.85, xhi: 0.85 };
      return { tee: [0, 0, 0], cup: cupAt(-0.5, 1.5, -12.3) }; } }
  ];

  // ---------- players + balls ----------
  var PCOL = ['#ff5a5a', '#3d7bea', '#ffc83a', '#b56cff'];
  try { var av = Acct.avatar(); if (av && av.shirt) PCOL[0] = av.shirt; } catch (e) {}
  if (localStorage.getItem('mg:color')) PCOL[0] = localStorage.getItem('mg:color');
  var players = [], cur = 0, holeIx = Math.max(0, Math.min(3, (+Q.get('hole') || 1) - 1)), hole = null, state = 'aim', restT = 0;
  function ballMesh(c) { var m = new THREE.Mesh(new THREE.SphereGeometry(BR, 24, 16), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })); m.castShadow = true; scene.add(m); return m; }
  function newGame() { players.forEach(function (p) { if (p.b) world.removeBody(p.b); scene.remove(p.m); });
    players = []; for (var i = 0; i < opts.players; i++) players.push({ name: i === 0 ? (Acct.initials() || 'P1') : 'P' + (i + 1), color: PCOL[i], total: 0, strokes: 0, done: false, b: null, m: ballMesh(PCOL[i]), cards: [] });
    loadHole(Q.get('hole') ? holeIx : 0); }
  function filt(b) { b.collisionFilterGroup = 2; b.collisionFilterMask = opts.collide ? (1 | 2) : 1; }
  function loadHole(i) { holeIx = i; built.forEach(function (o) { if (o.b) world.removeBody(o.b); scene.remove(o.g); }); built = []; movers = [];
    boosts = []; hole = HOLES[i].build(); players.forEach(function (p) { if (p.b) world.removeBody(p.b); p.b = null; p.m.visible = false; p.strokes = 0; p.done = false; });
    cur = 0; spawn(players[0]); state = 'aim'; Proto.toast('Hole ' + (i + 1) + ' \u00b7 ' + HOLES[i].name + '<br><small>Par ' + HOLES[i].par + '</small>', 1800); hudUp(); }
  // v0.2 roll model: near-frictionless glide at speed, decel grows as speed drops (inverse-square-ish), smooth settle.
  function rollDecel(v) { return 0.3 + 1.4 / (1 + (v / 0.9) * (v / 0.9)); }
  world.addEventListener('postStep', function () { var h = world.dt || 1 / 360;
    players.forEach(function (q) { var b = q.b; if (!b) return; var v = b.velocity, hs = Math.hypot(v.x, v.z);
      if (v.y > 2.5) v.y = 2.5;
      if (hs > 32) { v.x *= 32 / hs; v.z *= 32 / hs; hs = 32; }
      if (hs < 1e-4 || Math.abs(v.y) > 0.8) return;
      var ns = Math.max(0, hs - rollDecel(hs) * h); if (ns < 0.12) ns *= Math.exp(-5 * h);
      v.x *= ns / hs; v.z *= ns / hs; }); });
  function spawn(p) { if (p.b) return; var b = new CANNON.Body({ mass: 0.046, shape: new CANNON.Sphere(BR), material: mBall, linearDamping: 0.03, angularDamping: 0.35 });
    b.position.set(hole.tee[0] + (players.indexOf(p) - (players.length - 1) / 2) * 0.32, hole.tee[1] + BR + 0.02, hole.tee[2]); filt(b); b.allowSleep = false; world.addBody(b); p.b = b; p.last = b.position.clone(); p.m.visible = true; }
  function hudUp() { var p = players[cur]; Proto.hud('Hole ' + (holeIx + 1) + '/4 \u00b7 Par ' + HOLES[holeIx].par + ' \u00b7 <span style="color:' + p.color + '">\u25cf</span> ' + p.name + ' \u00b7 Stroke ' + (p.strokes + 1) + (players.length > 1 ? '' : ' \u00b7 Total ' + p.total)); }

  // ---------- input: pull back slingshot ----------
  var cv = R.domElement, drag = null, ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpV = new THREE.Vector3();
  var aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(aimLine); aimLine.visible = false;
  var band = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x222222, dashSize: 0.08, gapSize: 0.06 })); scene.add(band); band.visible = false;
  var dots = []; for (var d = 0; d < 8; d++) { var dm = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); dm.visible = false; scene.add(dm); dots.push(dm); }
  function groundPt(e) { var r = cv.getBoundingClientRect(); ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, cam); var b = players[cur].b; plane.constant = -b.position.y; return ray.ray.intersectPlane(plane, new THREE.Vector3()); }
  function shotVec(pt) { var b = players[cur].b.position, v = new THREE.Vector3(b.x - pt.x, 0, b.z - pt.z), len = v.length(), pw = Math.min(1, len / 2.4); if (len > 1e-4) v.multiplyScalar(1 / len); return { dir: v, pw: pw }; }
  function showAim(pt) { var b = players[cur].b.position, s = shotVec(pt), B = new THREE.Vector3(b.x, b.y, b.z);
    aimLine.geometry.setFromPoints([B, B.clone().addScaledVector(s.dir, 0.3 + s.pw * 2.2)]); aimLine.material.color.setHSL(0.33 - s.pw * 0.33, 1, 0.55); aimLine.visible = true;
    band.geometry.setFromPoints([B, new THREE.Vector3(pt.x, b.y, pt.z)]); band.computeLineDistances(); band.visible = true;
    dots.forEach(function (dm, i) { dm.visible = true; dm.position.copy(B).addScaledVector(s.dir, (i + 1) / 8 * (0.3 + s.pw * 2.2)); dm.scale.setScalar(1 - i * 0.08); });
    Proto.hud('Power ' + Math.round(s.pw * 100) + '% \u00b7 release to putt'); }
  function hideAim() { aimLine.visible = band.visible = false; dots.forEach(function (dm) { dm.visible = false; }); }
  cv.addEventListener('pointerdown', function (e) { if (state !== 'aim') return; var pt = groundPt(e); if (!pt) return; drag = { id: e.pointerId }; cv.setPointerCapture(e.pointerId); showAim(pt); });
  cv.addEventListener('pointermove', function (e) { if (!drag || drag.id !== e.pointerId) return; var pt = groundPt(e); if (pt) { drag.pt = pt; showAim(pt); } });
  function release(e) { if (!drag || drag.id !== e.pointerId) return; var pt = drag.pt; drag = null; hideAim(); hudUp(); if (!pt) return; var s = shotVec(pt); if (s.pw < 0.06) return; shoot(s.dir, s.pw); }
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', function () { drag = null; hideAim(); hudUp(); });
  function shoot(dir, pw) { var p = players[cur]; p.last = p.b.position.clone(); p.b.wakeUp(); var sp = MAXV * Math.pow(pw, 1.7); p.b.velocity.set(dir.x * sp, 0, dir.z * sp); p.strokes++; state = 'roll'; restT = 0; sfx(220 + pw * 300); }
  var AC = null; function sfx(f) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.15, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + 0.15); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.16); } catch (e) {} }

  function nextTurn() { var n = players.length; for (var k = 1; k <= n; k++) { var j = (cur + k) % n; if (!players[j].done) { cur = j; spawn(players[j]); state = 'aim'; hudUp(); return; } }
    // hole finished
    state = 'between'; players.forEach(function (p) { p.total += p.strokes; p.cards.push(p.strokes); });
    Proto.toast(players.map(function (p) { return '<span style="color:' + p.color + '">' + p.name + '</span> ' + p.strokes; }).join(' \u00b7 '), 2400);
    setTimeout(function () { if (holeIx < HOLES.length - 1) loadHole(holeIx + 1); else endRound(); }, 2600); }
  function endRound() { var par = HOLES.reduce(function (a, h) { return a + h.par; }, 0), p = players[0], diff = p.total - par;
    Proto.toast('Round done!<br><small>' + p.total + ' strokes (' + (diff > 0 ? '+' : '') + diff + ')</small>', 4000);
    Proto.finish('minigolf', { score: Math.max(1, 100 - diff * 5), label: p.total + ' strokes, par ' + par, title: 'Round done: ' + p.total + ' strokes', sub: 'Par ' + par + ' \u00b7 4 starter holes' });
    if (MET && run) MET.gameEnd(run, { result: 'done' });
    state = 'over'; }

  Proto.menu([
    { label: 'Ball-to-ball hits', type: 'toggle', get: function () { return opts.collide; }, set: function (v) { opts.collide = v; saveOpts(); players.forEach(function (p) { if (p.b) filt(p.b); }); } },
    { label: 'Players (same phone)', type: 'select', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], get: function () { return String(opts.players); }, set: function (v) { opts.players = +v; saveOpts(); newGame(); } },
    { label: 'My ball colour', type: 'select', options: [['#ff5a5a', 'Red'], ['#3d7bea', 'Blue'], ['#ffc83a', 'Gold'], ['#b56cff', 'Purple'], ['#2ee6a6', 'Mint'], ['#ffffff', 'White'], ['#ff8a1f', 'Orange']], get: function () { return PCOL[0]; }, set: function (v) { PCOL[0] = v; localStorage.setItem('mg:color', v); players[0].color = v; players[0].m.material.color.set(v); hudUp(); } },
    { label: 'Hole', type: 'select', options: HOLES.map(function (h, i) { return [String(i), (i + 1) + '. ' + h.name]; }), get: function () { return String(holeIx); }, set: function (v) { loadHole(+v); } },
    { label: 'Restart round', btn: 'Restart', set: newGame },
    { label: 'Your sketches', btn: 'Soon', set: function () { Proto.toast('Import from your old mini golf sketches: coming later', 2200); } }
  ]);

  // ---------- loop ----------
  var camPos = new THREE.Vector3(0, 3, 4), camLook = new THREE.Vector3(), last = performance.now(), spinT = 0;
  function resize() { var w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 68 : 55; cam.updateProjectionMatrix(); } addEventListener('resize', resize); resize();
  function frame(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; spinT += dt;
    movers.forEach(function (o) { if (o.spin) { o.spin.rotation.z += dt * 1.4; return; } var b = o.b, u = b.userData;
      if (u && u.hi != null) { if (b.position.y >= u.hi) b.velocity.y = -0.55; else if (b.position.y <= u.lo) b.velocity.y = 0.55; }
      if (u && u.shaft) players.forEach(function (q) { var p = q.b && q.b.position; if (p && p.x > u.shaft[0] && p.x < u.shaft[1] && p.z > u.shaft[2] && p.z < u.shaft[3] && p.y < b.position.y + BR - 0.03 && p.y > b.position.y - 0.6) { p.y = b.position.y + BR; if (q.b.velocity.y < b.velocity.y) q.b.velocity.y = b.velocity.y; } });
      if (u && u.xhi != null) { if (b.position.x >= u.xhi) b.velocity.x = -0.9; else if (b.position.x <= u.xlo) b.velocity.x = 0.9; } });
    world.step(1 / 360, dt, 20);
    movers.forEach(function (o) { if (o.b) { o.g.position.copy(o.b.position); o.g.quaternion.copy(o.b.quaternion); } });
    players.forEach(function (p) { if (p.b) { p.m.position.copy(p.b.position); p.m.quaternion.copy(p.b.quaternion); } });
    players.forEach(function (q) { var bb = q.b; if (!bb) return; boosts.forEach(function (z) { if (Math.abs(bb.position.x - z.x) < z.hw && Math.abs(bb.position.z - z.z) < z.hz && bb.velocity.z < -0.5 && bb.velocity.z > -z.v) { bb.velocity.z = -z.v; if (!q.bz) sfx(660); q.bz = 1; } else q.bz = 0; }); });
    var p = players[cur], b = p.b;
    if (b && state === 'roll') { var hs = Math.hypot(b.velocity.x, b.velocity.z), dx = b.position.x - hole.cup.x, dz = b.position.z - hole.cup.z;
      if (Math.hypot(dx, dz) < cupR && Math.abs(b.position.y - BR - hole.cup.y) < 0.15 && hs < 2.6) { p.done = true; world.removeBody(b); p.b = null; p.m.visible = false; sfx(880); setTimeout(function () { sfx(1180); }, 120);
        Proto.toast(p.strokes === 1 ? 'HOLE IN ONE!' : p.strokes - HOLES[holeIx].par <= -1 ? 'Birdie!' : 'In the cup!', 1500); state = 'wait'; setTimeout(nextTurn, 1300); }
      else if (b.position.y < -2) { b.position.copy(p.last); b.velocity.setZero(); b.angularVelocity.setZero(); p.strokes++; Proto.toast('Out of bounds +1', 1200); state = 'aim'; hudUp(); }
      else { if (hs < 0.07 && Math.abs(b.velocity.y) < 0.6) restT += dt; else restT = 0;
        if (restT > 0.6) { b.velocity.x = b.velocity.z = 0; b.angularVelocity.setZero(); if (p.strokes >= 10) { p.done = true; Proto.toast('Max strokes', 1000); world.removeBody(b); p.b = null; p.m.visible = false; } state = 'wait'; setTimeout(nextTurn, 350); } } }
    // camera: behind the active ball looking at the cup
    var tgt = b ? b.position : (players.find(function (q) { return q.b; }) || {}).b; tgt = tgt ? tgt.position || tgt : new CANNON.Vec3(hole.tee[0], hole.tee[1], hole.tee[2]);
    var T = new THREE.Vector3(tgt.x, tgt.y, tgt.z), dir = new THREE.Vector3(hole.cup.x - T.x, 0, hole.cup.z - T.z); if (dir.lengthSq() < 0.01) dir.set(0, 0, -1); dir.normalize();
    var back = innerWidth < innerHeight ? 3.6 : 3.2; camPos.lerp(tmpV.copy(T).addScaledVector(dir, -back).add(new THREE.Vector3(0, 2.6, 0)), Math.min(1, dt * 3)); camLook.lerp(T.clone().addScaledVector(dir, 1.8), Math.min(1, dt * 4));
    cam.position.copy(camPos); cam.lookAt(camLook); sun.position.set(T.x + 6, T.y + 14, T.z + 4); sun.target.position.copy(T);
    R.render(scene, cam); requestAnimationFrame(frame); }
  newGame(); camPos.set(hole.tee[0], 2.6, 3.2); requestAnimationFrame(frame);
  window.__mg = { shoot: function (dx, dz, pw) { if (state === 'aim') shoot(new THREE.Vector3(dx, 0, dz).normalize(), pw); }, state: function () { return { state: state, hole: holeIx, cur: cur, players: players.map(function (p) { return { s: p.strokes, t: p.total, done: p.done, pos: p.b && p.b.position.toArray() }; }) }; } };
  if (Proto.headless) setTimeout(function () { window.__mg.shoot(0, -1, +(Q.get('pw') || 0.8)); }, 800);
})();
