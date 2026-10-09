/* IRON STRIDE - TV / host (v0.1). Owns the world, the mech, the enemies and the rules; renders the cockpit view;
   talks to the phones (pilot = seat 0, co-pilot gunner = seat 1). Mouse + keys fallback for a laptop with no phone. */
(function () {
  'use strict';
  var C = window.MECH_CONFIG, Wd = window.MechWorld, SFX = window.MechSfx, T = window.THREE;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local'), NONET = Q.has('nonet');
  var D2R = Math.PI / 180, clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; }, lerp = function (a, b, t) { return a + (b - a) * t; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var wrapA = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  if (Q.has('mute')) SFX.setMuted(true);
  if (/Android|iPhone|iPad/i.test(navigator.userAgent) && !Q.has('tv')) $('phoneHint').hidden = false;

  // ================================================================== renderer + quality ladder
  var canvas = $('gl');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
  var scene = new T.Scene(), SKY = new T.Color('#9cc7e6');
  scene.background = SKY; scene.fog = new T.Fog(SKY, 90, 290);
  var camera = new T.PerspectiveCamera(62, 16 / 9, 0.3, 600); camera.rotation.order = 'YXZ';
  scene.add(new T.HemisphereLight(0xdfefff, 0x5a5040, 0.85));
  var sun = new T.DirectionalLight(0xfff1d6, 0.75); sun.position.set(80, 140, 40); scene.add(sun);
  var cockpit = new window.MechCockpit($('frame'), $('hud'));
  var UA = navigator.userAgent, SLOW = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test(UA);
  var QL = C.quality, qual = { rung: SLOW ? 3 : (navigator.hardwareConcurrency || 8) <= 4 ? 2 : 1, auto: Q.get('fx') == null, low: 0, high: 0, drops: 0, fps: 60, frames: 0, acc: 0 };
  if (Q.get('fx') != null) qual.rung = clamp(+Q.get('fx') || 0, 0, QL.rungs.length - 1);
  function fxk() { return QL.rungs[qual.rung].fx; }
  function layout() {
    var w = window.innerWidth, h = window.innerHeight, r = QL.rungs[qual.rung];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, r.scale)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1.5 ? 70 : 62; camera.updateProjectionMatrix();
    cockpit.layout(w, h, Math.min(1, r.scale) * Math.min(1.5, window.devicePixelRatio || 1));
    SFX.setLite(qual.rung >= 3);
  }
  window.addEventListener('resize', function () { clearTimeout(layout._t); layout._t = setTimeout(layout, 120); });
  function qualTick(dt) {
    qual.frames++; qual.acc += dt; if (qual.acc < 1) return;
    qual.fps = qual.frames / qual.acc; var span = qual.acc; qual.frames = 0; qual.acc = 0;
    $('fxInfo').textContent = (qual.rung >= 3 ? 'low detail' : '') + (Q.has('fps') ? ' ' + Math.round(qual.fps) + ' fps r' + qual.rung : '');
    if (!qual.auto || document.hidden) return;
    if (qual.fps < QL.downBelowFps) { qual.low += span; qual.high = 0; if (qual.low >= QL.downAfterSec && qual.rung < QL.rungs.length - 1) { qual.rung++; qual.drops++; qual.low = 0; layout(); console.log('[quality] down to rung ' + qual.rung); } }
    else if (qual.fps > QL.upAboveFps) { qual.high += span; qual.low = 0; if (qual.high >= QL.upAfterSec * Math.pow(2, qual.drops) && qual.rung > 0 && !SLOW) { qual.rung--; qual.high = 0; layout(); console.log('[quality] up to rung ' + qual.rung); } }
    else { qual.low = 0; qual.high = 0; }
  }

  // ================================================================== geometry helpers (merge many parts into one draw call)
  var tmpC = new T.Color();
  function part(list, geo, color, x, y, z, ry, rx) {
    var g = geo.index ? geo.toNonIndexed() : geo; if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x || 0, y || 0, z || 0);
    var n = g.attributes.position.count, col = new Float32Array(n * 3); tmpC.set(color);
    for (var i = 0; i < n; i++) { col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); list.push(g); return g;
  }
  function merge(list) {
    var n = 0; list.forEach(function (g) { n += g.attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), o = 0;
    list.forEach(function (g) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o); o += g.attributes.position.count * 3; });
    var out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere(); return out;
  }
  var MAT = new T.MeshLambertMaterial({ vertexColors: true });
  var box = function (w, h, d) { return new T.BoxGeometry(w, h, d); };

  // ================================================================== world
  (function buildGround() {
    var S = 380, N = 76, g = new T.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2); g = g.toNonIndexed();
    var p = g.attributes.position, col = new Float32Array(p.count * 3), c = new T.Color();
    for (var i = 0; i < p.count; i += 3) {          // per triangle: height per vertex, one colour per face (faceted look)
      var cx = 0, cz = 0;
      for (var j = 0; j < 3; j++) { var x = p.getX(i + j), z = p.getZ(i + j); p.setY(i + j, Wd.height(x, z)); cx += x / 3; cz += z / 3; }
      var e = Math.max(Math.abs(cx), Math.abs(cz)), road = false;
      Wd.roads.forEach(function (r) { if ((Math.abs(cx - r) < Wd.roadW / 2 || Math.abs(cz - r) < Wd.roadW / 2) && e < Wd.city - 2) road = true; });
      if (road) c.set('#4a4d55'); else if (e < Wd.city - 4) c.set('#7f8a76'); else c.setHSL(0.26 - Math.min(0.12, (e - Wd.city) / 300), 0.35, 0.36 + ((i * 7919) % 10) / 160);
      if (!road && e < Wd.city - 4 && ((i * 31) % 7) === 0) c.offsetHSL(0, 0, -0.03);
      for (j = 0; j < 3; j++) { col[(i + j) * 3] = c.r; col[(i + j) * 3 + 1] = c.g; col[(i + j) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); g.computeVertexNormals();
    scene.add(new T.Mesh(g, MAT));
    // road markings: one merged mesh of dashes
    var parts = [];
    Wd.roads.forEach(function (r) { for (var t = -Wd.city + 8; t < Wd.city - 8; t += 8) { if (Wd.roads.some(function (q) { return Math.abs(t - q) < 6; })) continue; part(parts, box(0.4, 0.05, 3), '#e8e2c4', r, Wd.height(r, t) + 0.12, t); part(parts, box(3, 0.05, 0.4), '#e8e2c4', t, Wd.height(t, r) + 0.12, r); } });
    scene.add(new T.Mesh(merge(parts), MAT));
  })();
  var PAL = ['#c9b79c', '#a7b4c2', '#d8c9a8', '#8e9bab', '#c4a58a', '#b7c2b0', '#d1d6dc'];
  (function buildCity() {
    var parts = [];
    Wd.buildings.forEach(function (b) {
      var base = Wd.height(b.x, b.z) - 2, colr = PAL[Math.floor(b.hue * PAL.length)]; b.base = base; b.top = base + b.h + 2;
      part(parts, box(b.w, b.h + 2, b.d), colr, b.x, base + (b.h + 2) / 2, b.z);
      for (var y = base + 6; y < b.top - 3; y += 4.2) part(parts, box(b.w + 0.3, 1.3, b.d + 0.3), '#3c4a5c', b.x, y, b.z);     // window bands
      part(parts, box(b.w * 0.9, 0.8, b.d * 0.9), '#6d6a66', b.x, b.top + 0.4, b.z);
      if (b.hue > 0.6) part(parts, box(2.5, 2.5, 2.5), '#8a8f96', b.x + b.w * 0.2, b.top + 1.6, b.z - b.d * 0.15);              // roof unit
    });
    // the mech bay: a pad, pillars, roof and back wall, open to the south (z-)
    var B = Wd.bay, by = Wd.height(B.x, B.z);
    part(parts, box(B.w, 0.4, B.d), '#3a414c', B.x, by + 0.1, B.z);
    for (var s = -1; s <= 1; s += 2) { part(parts, box(1.6, 16, 1.6), '#59606b', B.x + s * B.w / 2, by + 8, B.z - B.d / 2); part(parts, box(1.6, 16, B.d), '#4c535e', B.x + s * B.w / 2, by + 8, B.z); }
    part(parts, box(B.w + 2, 1.4, B.d + 2), '#2f343c', B.x, by + 16.5, B.z); part(parts, box(B.w, 16, 1), '#3d434d', B.x, by + 8, B.z + B.d / 2);
    for (var st = -4; st <= 4; st++) part(parts, box(1.4, 0.06, 0.6), st % 2 ? '#ffb02e' : '#222', B.x + st * 1.4, by + 0.33, B.z - B.d / 2 + 0.8);
    part(parts, box(8, 2, 0.4), '#ffb02e', B.x, by + 14, B.z - B.d / 2 - 0.4);
    part(parts, box(3, 6, 3), '#5a6270', B.x - 7, by + 3, B.z + 7); part(parts, box(3, 6, 3), '#5a6270', B.x + 7, by + 3, B.z + 7);
    scene.add(new T.Mesh(merge(parts), MAT));
    // pad glow strip (separate so it can blink)
    bayLight = new T.Mesh(box(B.w - 2, 0.08, 1.2), new T.MeshBasicMaterial({ color: 0x5dc8ff })); bayLight.position.set(B.x, by + 0.35, B.z); scene.add(bayLight);
    // trees: one instanced mesh
    var tp = []; part(tp, new T.ConeGeometry(2.4, 6, 6), '#4f8a4a', 0, 5.5, 0); part(tp, new T.CylinderGeometry(0.4, 0.5, 2.6, 5), '#6b4b32', 0, 1.3, 0);
    var trees = new T.InstancedMesh(merge(tp), MAT, Wd.trees.length), m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
    Wd.trees.forEach(function (t, i) { sc.set(t.s, t.s, t.s); m.compose(new T.Vector3(t.x, Wd.height(t.x, t.z) - 0.2, t.z), q, sc); trees.setMatrixAt(i, m); });
    scene.add(trees);
  })();
  var bayLight;
  // barrels: one instanced mesh, a destroyed barrel is scaled to zero
  var barrels = Wd.barrels.map(function (b) { return { x: b.x, z: b.z, y: Wd.height(b.x, b.z), alive: true, hp: 1 }; });
  var barrelMesh = (function () { var bp = []; part(bp, new T.CylinderGeometry(0.9, 0.9, 2.2, 10), '#d8362b', 0, 1.1, 0); part(bp, new T.CylinderGeometry(0.93, 0.93, 0.25, 10), '#f2d24b', 0, 1.6, 0); part(bp, new T.CylinderGeometry(0.93, 0.93, 0.25, 10), '#7a1c16', 0, 0.5, 0); return new T.InstancedMesh(merge(bp), MAT, barrels.length); })();
  function setBarrel(i) { var b = barrels[i], m = new T.Matrix4(); if (b.alive) m.makeTranslation(b.x, b.y, b.z); else m.makeScale(0, 0, 0); barrelMesh.setMatrixAt(i, m); barrelMesh.instanceMatrix.needsUpdate = true; }
  barrels.forEach(function (b, i) { setBarrel(i); }); scene.add(barrelMesh);
  var cloudParts = []; for (var ci = 0; ci < 14; ci++) { var a = ci / 14 * Math.PI * 2 + rand(0, 0.3), r = rand(220, 280); part(cloudParts, box(rand(30, 60), rand(5, 9), rand(14, 24)), '#f4f8fc', Math.cos(a) * r, rand(70, 110), Math.sin(a) * r, a); }
  var clouds = new T.Mesh(merge(cloudParts), new T.MeshBasicMaterial({ vertexColors: true, fog: false })); scene.add(clouds);

  // ================================================================== enemy + projectile models
  var DRONE_GEO = (function () { var p = []; var b = new T.IcosahedronGeometry(1.5, 0); b.scale(1.3, 0.75, 1.3); part(p, b, '#ffc93a', 0, 0, 0); part(p, box(1.1, 0.5, 0.4), '#1b1d22', 0, 0.05, -1.65); part(p, box(0.5, 0.25, 0.1), '#ff3b2e', 0, 0.1, -1.88); part(p, box(5.2, 0.15, 0.5), '#3c3f46', 0, 0.75, 0); part(p, box(0.5, 0.15, 5.2), '#3c3f46', 0, 0.75, 0); part(p, box(0.35, 0.35, 1.4), '#2a2d33', 0, -0.9, -0.4); return merge(p); })();
  var TANK_GEO = (function () { var p = []; part(p, box(4.4, 1.6, 6.4), '#7d8a4e', 0, 1.3, 0); part(p, box(1.3, 1.5, 7), '#2b2e2a', -2.6, 0.75, 0); part(p, box(1.3, 1.5, 7), '#2b2e2a', 2.6, 0.75, 0); part(p, box(2.8, 1.2, 2.8), '#6b7842', 0, 2.7, 0.3); part(p, box(0.45, 0.45, 4.2), '#3a3f2c', 0, 2.75, -2.8); part(p, box(0.8, 0.3, 0.8), '#ff3b2e', 0, 3.4, 0.8); return merge(p); })();
  var BOLT_MAT = new T.MeshBasicMaterial({ color: 0xff7a2a }), ROCKET_GEO = (function () { var p = []; part(p, new T.CylinderGeometry(0.22, 0.22, 1.4, 6), '#e9edf2', 0, 0, 0, 0, Math.PI / 2); part(p, new T.ConeGeometry(0.22, 0.5, 6), '#ff4b3a', 0, 0, -0.95, 0, -Math.PI / 2); return merge(p); })();
  var boltGeo = new T.IcosahedronGeometry(0.55, 0);
  function pool(n, make) { var a = []; for (var i = 0; i < n; i++) { var o = make(i); o.visible = false; scene.add(o); a.push(o); } return a; }
  var boltPool = pool(24, function () { return new T.Mesh(boltGeo, BOLT_MAT); });
  var rocketPool = pool(16, function () { return new T.Mesh(ROCKET_GEO, MAT); });
  var flashPool = pool(8, function () { return new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffb040, transparent: true, depthWrite: false })); });
  var railBeam = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 1, 6, 1, true), new T.MeshBasicMaterial({ color: 0x9af6ff, transparent: true, depthWrite: false })); railBeam.visible = false; scene.add(railBeam);
  // particles: a single Points cloud with a fixed pool
  var PN = 500, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), parts = [];
  for (var pi = 0; pi < PN; pi++) { parts.push({ life: 0 }); pPos[pi * 3 + 1] = -999; }
  var pGeo = new T.BufferGeometry(); pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
  var points = new T.Points(pGeo, new T.PointsMaterial({ size: 1.4, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })); points.frustumCulled = false; scene.add(points);
  var pNext = 0;
  function emit(n, x, y, z, spd, colA, colB, life, up, grav) {
    n = Math.max(1, Math.round(n * fxk())); var ca = new T.Color(colA), cb = new T.Color(colB || colA);
    for (var i = 0; i < n; i++) {
      var p = parts[pNext], k = pNext * 3; pNext = (pNext + 1) % PN;
      var th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI - Math.PI / 2, s = spd * (0.4 + Math.random() * 0.6);
      p.life = p.max = life * (0.6 + Math.random() * 0.6); p.vx = Math.cos(th) * Math.cos(ph) * s; p.vy = Math.abs(Math.sin(ph)) * s * (up || 1); p.vz = Math.sin(th) * Math.cos(ph) * s; p.g = grav == null ? 9 : grav;
      pPos[k] = x; pPos[k + 1] = y; pPos[k + 2] = z; var t = Math.random(); pCol[k] = lerp(ca.r, cb.r, t); pCol[k + 1] = lerp(ca.g, cb.g, t); pCol[k + 2] = lerp(ca.b, cb.b, t);
    }
  }
  function tickParticles(dt) {
    for (var i = 0; i < PN; i++) { var p = parts[i]; if (p.life <= 0) continue; var k = i * 3; p.life -= dt; if (p.life <= 0) { pPos[k + 1] = -999; continue; }
      p.vy -= p.g * dt; p.vx *= 0.985; p.vz *= 0.985; pPos[k] += p.vx * dt; pPos[k + 1] += p.vy * dt; pPos[k + 2] += p.vz * dt; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }
  // tracers: one LineSegments with a pool
  var TN = 48, tPos = new Float32Array(TN * 6), tCol = new Float32Array(TN * 6), tLife = new Float32Array(TN), tNext = 0;
  var tGeo = new T.BufferGeometry(); tGeo.setAttribute('position', new T.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new T.BufferAttribute(tCol, 3));
  var tracers = new T.LineSegments(tGeo, new T.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })); tracers.frustumCulled = false; scene.add(tracers);
  function tracer(a, b, color) { var i = tNext; tNext = (tNext + 1) % TN; var c = new T.Color(color); tPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); tCol.set([c.r * 0.6, c.g * 0.6, c.b * 0.6, c.r, c.g, c.b], i * 6); tLife[i] = 0.07; }
  function tickTracers(dt) { for (var i = 0; i < TN; i++) if (tLife[i] > 0) { tLife[i] -= dt; if (tLife[i] <= 0) for (var j = 0; j < 6; j++) tPos[i * 6 + j] = 0; } tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true; }
  var flashes = [];
  function flash(x, y, z, size, color) { var m = flashPool.find(function (f) { return !f.visible; }); if (!m) return; m.visible = true; m.position.set(x, y, z); m.material.color.set(color || 0xffb040); m.material.opacity = 1; flashes.push({ m: m, t: 0, size: size }); }
  function tickFlashes(dt) { for (var i = flashes.length - 1; i >= 0; i--) { var f = flashes[i]; f.t += dt; var u = f.t / 0.45; if (u >= 1) { f.m.visible = false; flashes.splice(i, 1); continue; } f.m.scale.setScalar(f.size * (0.3 + u)); f.m.material.opacity = 1 - u; } }

  // ================================================================== the mech
  var M = { x: 0, z: -2, legYaw: 0, torso: 0, pitch: 0, speed: 0, phase: 0, lastStep: 0, hull: C.mech.hull, path: [], pathIdx: 0, pathV: 0, autopilot: true, walk: 0, turn: 0,
    pad: 0, padRel: -1, travel: 0, faceTo: null, bob: 0, dip: 0, dipV: 0, shake: 0, braceT: 0, braceCd: 0, eject: null, down: 0, inBay: false, score: 0, kills: 0, hurt: 0, swap: 0 };
  var WEAP = C.weapons.map(function (w) { return { def: w, mag: w.mag, res: w.id === 'rocket' ? 24 : w.id === 'rail' ? 8 : 0, resMax: w.id === 'rocket' ? 24 : w.id === 'rail' ? 8 : 0, reload: -1, cool: 0 }; });
  var GUN2 = { def: C.weapons[0], mag: 60, res: 0, resMax: 0, reload: -1, cool: 0, magMax: 60 };
  var wsel = 0;
  var legs = (function () {
    var g = new T.Group(), mk = function (side) {
      var hip = new T.Group(); hip.position.set(side * 2.1, 6.4, -1.6); g.add(hip);
      var tp = []; part(tp, box(1.5, 3.6, 1.7), '#5b6472', 0, -1.8, 0); var thigh = new T.Mesh(merge(tp), MAT); hip.add(thigh);
      var knee = new T.Group(); knee.position.set(0, -3.5, 0); hip.add(knee);
      var sp = []; part(sp, box(1.3, 3.4, 1.4), '#4a525e', 0, -1.7, 0.2); part(sp, box(2.2, 0.7, 3.4), '#2f343c', 0, -3.3, -0.4); part(sp, box(0.6, 0.6, 0.6), '#ffb02e', 0, 0, -0.75); knee.add(new T.Mesh(merge(sp), MAT));
      return { hip: hip, knee: knee };
    };
    var hp = []; part(hp, box(1.8, 1.8, 1.8), '#4f5764', -2.1, 6.5, -1.6); part(hp, box(1.8, 1.8, 1.8), '#4f5764', 2.1, 6.5, -1.6); part(hp, box(2.6, 0.7, 0.9), '#3c434e', 0, 6.1, -1.6); g.add(new T.Mesh(merge(hp), MAT));
    var L = mk(-1), R = mk(1); g.userData = { L: L, R: R }; scene.add(g); return g;
  })();
  var chin = (function () { var p = []; part(p, box(1.6, 0.6, 1.6), '#59616d', 2.6, -2.2, -0.6); part(p, box(1.6, 0.6, 1.6), '#59616d', -2.6, -2.2, -0.6); part(p, box(0.9, 0.9, 3.8), '#2c3036', 2.6, -2.2, -2.2); part(p, box(0.8, 0.8, 3), '#2c3036', -2.6, -2.2, -2.0); var m = new T.Mesh(merge(p), MAT); scene.add(m); return m; })();
  var shadow = new T.Mesh(new T.CircleGeometry(4.5, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  var muzzle = new T.Vector3();
  function muzzleOf(side) { muzzle.set(side * 2.6, -2.2, -4.2).applyEuler(new T.Euler(M.pitch * 0.5, M.torso, 0, 'YXZ')).add(camera.position); return muzzle.clone(); }

  function hurtMech(dmg, from) {
    if (M.eject || M.down > 0) return;
    var k = M.braceT > 0 ? 0.4 : 1; M.hull = Math.max(0, M.hull - dmg * k); M.hurt = Math.min(1, M.hurt + 0.35 * k + 0.1); M.shake = Math.max(M.shake, 0.5 * k);
    SFX.play(M.braceT > 0 ? 'clang' : 'hurt'); notify('hurt');
    if (M.hull <= 0) { M.down = 3.5; SFX.play('alarm'); SFX.play('boom', { s: 1.4 }); big('MECH DOWN', 'rebooting at the bay', 2600); notify('down'); }
  }
  function respawn() { M.x = Wd.bay.x; M.z = Wd.bay.z - 6; M.legYaw = M.torso = Math.PI; M.hull = C.mech.hull; M.path = []; M.pathV++; M.down = 0; WEAP.forEach(function (w) { w.mag = w.def.mag; w.res = w.resMax; w.reload = -1; }); big('REBOOTED', 'all systems go', 1400); SFX.play('bay'); }

  // ================================================================== enemies
  var enemies = [], bolts = [], rockets = [], spawnT = 3, playT = 0;
  function spawnEnemy() {
    var alive = enemies.length, E = C.enemies, maxA = Math.round(lerp(E.maxAlive[0], E.maxAlive[1], Math.min(1, playT / E.rampSec)));
    if (alive >= maxA) return;
    var kind = Math.random() < (playT > 40 ? 0.4 : 0.15) ? 'tank' : 'drone', side = Math.random() < 0.5 ? -1 : 1;
    var ang = M.torso + side * rand(55, 105) * D2R, d = E.spawnDist, lim = Wd.half - 10;
    var x = clamp(M.x - Math.sin(ang) * d, -lim, lim), z = clamp(M.z - Math.cos(ang) * d, -lim, lim);
    if (kind === 'tank') { var rx = nearestRoad(x), rz = nearestRoad(z); if (Math.abs(rx - x) < Math.abs(rz - z)) x = rx; else z = rz; if (Wd.insideBuilding(x, z, 4)) kind = 'drone'; }
    var def = E[kind], mesh = new T.Mesh(kind === 'tank' ? TANK_GEO : DRONE_GEO, MAT); scene.add(mesh);
    var e = { kind: kind, def: def, mesh: mesh, x: x, z: z, y: kind === 'tank' ? Wd.height(x, z) : rand(12, 20), hp: def.hp, fire: rand(def.fireEvery[0], def.fireEvery[1]) + 1.5, orbit: rand(0, Math.PI * 2), orbitR: rand(28, 48), hitT: 0, yaw: 0 };
    enemies.push(e); SFX.play('warn');
  }
  function nearestRoad(v) { var best = Wd.roads[0]; Wd.roads.forEach(function (r) { if (Math.abs(r - v) < Math.abs(best - v)) best = r; }); return best; }
  function enemyPos(e) { return new T.Vector3(e.x, e.y + (e.kind === 'tank' ? 2 : 0), e.z); }
  function tickEnemies(dt) {
    var eye = camera.position;
    enemies.forEach(function (e) {
      var dx = M.x - e.x, dz = M.z - e.z, dist = Math.sqrt(dx * dx + dz * dz) || 1;
      if (e.kind === 'drone') {
        e.orbit += dt * 0.25; var tx = M.x + Math.cos(e.orbit) * e.orbitR, tz = M.z + Math.sin(e.orbit) * e.orbitR;
        var ddx = tx - e.x, ddz = tz - e.z, dd = Math.sqrt(ddx * ddx + ddz * ddz) || 1, sp = Math.min(e.def.speed, dd * 1.5);
        e.x += ddx / dd * sp * dt; e.z += ddz / dd * sp * dt; e.y += (Math.max(10, Wd.height(e.x, e.z) + 13 + Math.sin(playT + e.orbit) * 3) - e.y) * dt;
      } else {
        var want = dist > e.def.keepDist ? 1 : -0.2, nx = e.x + dx / dist * e.def.speed * want * dt, nz = e.z + dz / dist * e.def.speed * want * dt;
        if (!Wd.insideBuilding(nx, nz, 3)) { e.x = nx; e.z = nz; } else if (!Wd.insideBuilding(nx, e.z, 3)) e.x = nx; else if (!Wd.insideBuilding(e.x, nz, 3)) e.z = nz;
        e.y = Wd.height(e.x, e.z);
      }
      e.yaw = Math.atan2(-dx, -dz);
      e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y = e.yaw;
      if (e.kind === 'drone') e.mesh.rotation.z = Math.sin(playT * 3 + e.orbit) * 0.15;
      e.hitT = Math.max(0, e.hitT - dt); e.mesh.scale.setScalar(1 + e.hitT * 0.8);
      e.fire -= dt;
      if (e.fire <= 0 && dist < 120 && !M.eject && M.down <= 0) {
        e.fire = rand(e.def.fireEvery[0], e.def.fireEvery[1]);
        var src = enemyPos(e), tgt = eye.clone().add(new T.Vector3(rand(-3, 3), rand(-3, 1), rand(-3, 3))), m = boltPool.find(function (b) { return !b.visible; });
        if (m) { m.visible = true; m.position.copy(src); m.scale.setScalar(e.kind === 'tank' ? 1.4 : 1); bolts.push({ m: m, v: tgt.sub(src).normalize().multiplyScalar(e.kind === 'tank' ? e.def.shellSpeed : e.def.boltSpeed), dmg: e.def.damage, life: 5 }); }
        SFX.play('servo');
      }
    });
    for (var i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i]; b.m.position.addScaledVector(b.v, dt); b.life -= dt;
      var p = b.m.position, hitMe = p.distanceTo(eye) < 4.2;
      if (hitMe || b.life <= 0 || p.y < Wd.height(p.x, p.z) || hitsBuilding(p)) {
        if (hitMe) { hurtMech(b.dmg); emit(10, p.x, p.y, p.z, 8, '#ffb040', '#ff3b2e', 0.4); }
        else if (b.life > 0) emit(6, p.x, p.y, p.z, 6, '#ffb040', '#777', 0.4);
        b.m.visible = false; bolts.splice(i, 1);
      }
    }
  }
  function hitsBuilding(p) { var b = Wd.insideBuilding(p.x, p.z, 0); return b && p.y < b.top ? b : null; }
  function killEnemy(e, by) {
    var i = enemies.indexOf(e); if (i < 0) return; enemies.splice(i, 1); scene.remove(e.mesh);
    var p = enemyPos(e); explode(p, e.kind === 'tank' ? 1.4 : 1, false);
    M.score += e.def.score; M.kills++; notify('kill');
  }
  function damageEnemy(e, dmg, by) { e.hp -= dmg; e.hitT = 0.25; SFX.play('hit'); if (e.hp <= 0) killEnemy(e, by); }
  function explode(p, s, splash, by) {
    flash(p.x, p.y, p.z, 4.5 * s, 0xffa030); emit(34 * s, p.x, p.y, p.z, 16 * s, '#ffe066', '#ff4a1a', 0.8, 1.2); emit(16 * s, p.x, p.y, p.z, 5, '#555', '#999', 1.6, 1.5, -1.5);
    SFX.play('boom', { s: s }); var d = p.distanceTo(camera.position); M.shake = Math.max(M.shake, clamp(1.2 * s - d / 90, 0, 1));
    if (splash) splashDamage(p, splash.r, splash.dmg, by);
  }
  function splashDamage(p, r, dmg, by) {
    enemies.slice().forEach(function (e) { var d = enemyPos(e).distanceTo(p); if (d < r + e.def.radius) damageEnemy(e, d < r * 0.5 ? dmg : Math.ceil(dmg / 2), by); });
    barrels.forEach(function (b, i) { if (b.alive && Math.hypot(b.x - p.x, b.z - p.z) < r) setTimeout(function () { blowBarrel(i, by); }, 120 + Math.random() * 120); });
    if (camera.position.distanceTo(p) < r * 0.8) hurtMech(4);
  }
  function blowBarrel(i, by) { var b = barrels[i]; if (!b.alive) return; b.alive = false; setBarrel(i); M.score += C.barrel.score; explode(new T.Vector3(b.x, b.y + 1.2, b.z), 1.2, { r: C.barrel.splash, dmg: C.barrel.damage }, by); notify('boom'); }

  // ================================================================== aiming: seats, filtered crosshair, hidden assist
  var seats = [null, null];         // {cid, conn, name, connected, ax, ay, hist, fire, lock, calStep, kb}
  function newSeat(i, o) { return Object.assign({ seat: i, ax: 0, ay: 0, hist: [], fire: false, fireT: 0, lock: null, lockT: 0, charge: 0, charging: false, calStep: -1, steady: 1, connected: true, color: C.seats[i].color }, o); }
  var aimFilt = [0, 1].map(function () { return [new window.LRAim.OneEuro(C.aim.filter), new window.LRAim.OneEuro(C.aim.filter)]; });
  function setAim(s, x, y) {
    var now = performance.now() / 1000, f = aimFilt[s.seat];
    s.ax = clamp(f[0].filter(x, now - (s.lastT || now - 0.03) || 0.03), -1.08, 1.08); s.ay = clamp(f[1].filter(y, now - (s.lastT || now - 0.03) || 0.03), -1.08, 1.08); s.lastT = now;
    s.hist.push([now, s.ax, s.ay]); while (s.hist.length && now - s.hist[0][0] > C.assist.windowMs / 1000) s.hist.shift();
  }
  var proj = new T.Vector3();
  function steadiness(s) {        // RMS crosshair speed over the window -> 1 steady .. 0 shaky
    var h = s.hist; if (h.length < 3) return s.steady;
    var sum = 0, n = 0; for (var i = 1; i < h.length; i++) { var dt = h[i][0] - h[i - 1][0]; if (dt <= 0) continue; var vx = (h[i][1] - h[i - 1][1]) / dt, vy = (h[i][2] - h[i - 1][2]) / dt; sum += vx * vx + vy * vy; n++; }
    var rms = n ? Math.sqrt(sum / n) : 0; s.steady = lerp(s.steady, clamp(1 - rms / C.assist.shakyAt, 0, 1), 0.3); return s.steady;
  }
  function targetsOnScreen() {
    var out = [], asp = camera.aspect;
    enemies.forEach(function (e) { proj.copy(enemyPos(e)).project(camera); if (proj.z < 1 && Math.abs(proj.x) < 1.2 && Math.abs(proj.y) < 1.2) out.push({ e: e, x: proj.x, y: proj.y, d: camera.position.distanceTo(enemyPos(e)), asp: asp }); });
    barrels.forEach(function (b, i) { if (!b.alive) return; var p = new T.Vector3(b.x, b.y + 1.1, b.z); if (p.distanceTo(camera.position) > 110) return; proj.copy(p).project(camera); if (proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1) out.push({ b: i, x: proj.x, y: proj.y, d: p.distanceTo(camera.position), asp: asp }); });
    return out;
  }
  function assist(s) { return s.intent || { x: s.ax, y: s.ay, t: null, tight: 1, R: 0.1 }; }
  function shotAim(s) {           // v0.2: shots go to the intent reticle, spread by steadiness
    var a = assist(s), sp = lerp(C.assist.spreadShaky, C.assist.spreadSteady, a.tight);
    return { x: a.x + (Math.random() - 0.5) * 2 * sp, y: a.y + (Math.random() - 0.5) * 2 * sp * camera.aspect, t: a.t, tight: a.tight };
  }
  function tickIntent(s, dt) {    // v0.2 intent reticle: smoothed estimate of where the player means to aim, pulled onto the locked target
    var A = C.assist, st = steadiness(s), R = lerp(A.radiusShaky, A.radiusSteady, st), pull = lerp(A.pullShaky, A.pullSteady, st), now = performance.now();
    var best = null, bestD = 1e9, list = targetsOnScreen();
    list.forEach(function (t) {
      var dx = t.x - s.ax, dy = (t.y - s.ay) / t.asp, sizeBonus = clamp(30 / t.d, 0, 0.12), d = Math.sqrt(dx * dx + dy * dy) - sizeBonus;
      if (t.b != null) d += 0.02;          // enemies first, barrels when it's clear you mean the barrel
      var sticky = s.lock && ((t.e && s.lock.e === t.e) || (t.b != null && s.lock.b === t.b)) && now - s.lockT < A.stickyMs;
      if (sticky) d -= R * 0.5;
      if (d < R && d < bestD) { best = t; bestD = d; }
    });
    if (best) { s.lock = best; s.lockT = now; } else if (s.lock && now - s.lockT > A.stickyMs) s.lock = null;
    var L = phase === 'play' ? best : null, grav = L ? pull * Math.pow(clamp(1 - Math.max(0, bestD) / R, 0, 1), 1.5) : 0;   // soft magnetism, stronger the closer you hover
    var gx = s.ax + (L ? (L.x - s.ax) * grav : 0), gy = s.ay + (L ? (L.y - s.ay) * grav : 0);
    if (s.ix == null) { s.ix = s.ax; s.iy = s.ay; }
    var k = 1 - Math.exp(-dt / lerp(A.intentTauShaky, A.intentTauSteady, st));
    s.ix += (gx - s.ix) * k; s.iy += (gy - s.iy) * k;
    s.intent = { x: s.ix, y: s.iy, t: L, tight: st, R: R };
  }
  // ray vs world: nearest of enemies, barrels, buildings, ground
  var ray = new T.Raycaster();
  function castFrom(x, y) { ray.setFromCamera({ x: x, y: y }, camera); return ray.ray; }
  function sphereT(r, c, rad) { var oc = r.origin.clone().sub(c), b = oc.dot(r.direction), cc = oc.lengthSq() - rad * rad, h = b * b - cc; if (h < 0) return -1; var t = -b - Math.sqrt(h); return t > 0 ? t : -1; }
  function boxT(r, b) {
    var o = r.origin, d = r.direction, mn = [b.x - b.w / 2, b.base, b.z - b.d / 2], mx = [b.x + b.w / 2, b.top, b.z + b.d / 2], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z], t0 = 0, t1 = 1e9;
    for (var i = 0; i < 3; i++) { if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < mn[i] || oo[i] > mx[i]) return -1; continue; } var a = (mn[i] - oo[i]) / dd[i], c = (mx[i] - oo[i]) / dd[i]; if (a > c) { var tt = a; a = c; c = tt; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1; }
    return t0;
  }
  function worldT(r, maxT) {      // buildings + ground only
    var best = maxT || 320;
    Wd.buildings.forEach(function (b) { var t = boxT(r, b); if (t > 0 && t < best) best = t; });
    for (var t = 2; t < best; t += 2) { var p = r.at(t, proj); if (p.y < Wd.height(p.x, p.z)) { best = t - 1; break; } }
    return best;
  }
  function hitscan(r, pierce) {
    var wall = worldT(r), hits = [];
    enemies.forEach(function (e) { var t = sphereT(r, enemyPos(e), e.def.radius); if (t > 0 && t < wall) hits.push({ t: t, e: e }); });
    barrels.forEach(function (b, i) { if (!b.alive) return; var t = sphereT(r, new T.Vector3(b.x, b.y + 1.1, b.z), 1.3); if (t > 0 && t < wall) hits.push({ t: t, b: i }); });
    hits.sort(function (a, b) { return a.t - b.t; });
    if (!pierce) hits = hits.slice(0, 1);
    return { hits: hits, end: r.at(hits.length && !pierce ? hits[0].t : wall, new T.Vector3()), wallT: wall };
  }

  // ================================================================== weapons
  function curW(s) { return s.seat === 1 ? GUN2 : WEAP[wsel]; }
  function startReload(w, s) { if (w.reload >= 0) return; if (w.resMax && w.res <= 0) { if (s.seat === 0) { flashMsg(w.def.short + ' EMPTY - rearm at the bay', '#ff8a5a'); SFX.play('dry'); } return; } w.reload = 0; SFX.play('reload'); if (s.seat === 0) cockpit.cmd('reload'); notify('reload'); }
  function tickLocks(s, dt) {     // v0.3 rocket lock-on: forgiving cone around the intent reticle, up to C.lock.max targets
    var L = C.lock; s.locks = s.locks || [];
    if (curW(s).def.id !== 'rocket' || phase !== 'play' || M.eject || M.down > 0) { s.locks.length = 0; return; }
    var a = assist(s), asp = camera.aspect, seen = {};
    s.locks.forEach(function (l) { l.seen = false; });
    targetsOnScreen().forEach(function (t) {
      if (!t.e) return; var d = Math.hypot(t.x - a.x, (t.y - a.y) / asp) - clamp(25 / t.d, 0, 0.1);
      var l = s.locks.find(function (q) { return q.e === t.e; });
      if (!l && d < L.radius) { l = { e: t.e, p: 0, on: false, out: 0 }; s.locks.push(l); }
      if (!l) return; l.seen = true; l.x = t.x; l.y = t.y;
      if (d < (l.on ? L.keepRadius : L.radius)) { l.out = 0; if (!l.on) { var lockedN = s.locks.filter(function (q) { return q.on; }).length; if (lockedN < L.max) { l.p += dt / L.acquireSec; if (l.p >= 1) { l.on = true; l.p = 1; SFX.play('lockon'); notify('lock'); } } } }
      else l.out += dt;
    });
    for (var i = s.locks.length - 1; i >= 0; i--) { var l = s.locks[i]; if (!l.seen || enemies.indexOf(l.e) < 0 || l.out > (l.on ? L.loseSec : 0.15)) s.locks.splice(i, 1); }
    if (s.locks.some(function (q) { return !q.on; }) && !s.lockBeep) { SFX.play('lock'); s.lockBeep = 0.16; }
    s.lockBeep = Math.max(0, (s.lockBeep || 0) - dt);
  }
  function tickWeapon(s, dt) {
    var w = curW(s), def = w.def;
    if (w.reload >= 0) { w.reload += dt / (s.seat === 1 ? 2 : def.reloadSec); if (w.reload >= 1) { var need = (w.magMax || def.mag) - w.mag, take = w.resMax ? Math.min(need, w.res) : need; w.mag += take; if (w.resMax) w.res -= take; w.reload = -1; SFX.play('loaded'); } }
    w.cool = Math.max(0, w.cool - dt);
    if (M.eject || M.down > 0 || phase !== 'play') { s.charging = false; s.charge = 0; return; }
    if (s.seat === 0 && M.swap > 0) return;
    if (def.id === 'rail') {
      if (s.fire && w.reload < 0 && w.mag > 0 && w.cool <= 0) { if (!s.charging) { s.charging = true; s.charge = 0; SFX.play('charge', { d: def.chargeSec }); } s.charge = Math.min(1, s.charge + dt / def.chargeSec); }
      else if (!s.fire && s.charging) { s.charging = false; if (s.charge >= def.minCharge) fireRail(s, w, s.charge); s.charge = 0; }
      return;
    }
    if (s.fire && w.cool <= 0) {
      if (w.reload >= 0) return;
      if (w.mag <= 0) { startReload(w, s); return; }
      if (def.id === 'rocket' && rocketSalvo(s, w)) return;
      w.cool = 60 / def.rpm; w.mag--; if (def.id === 'cannon') fireCannon(s); else fireRocket(s);
      if (w.mag <= 0) startReload(w, s);
    }
  }
  var lastAim = [null, null];
  function fireCannon(s) {
    var a = shotAim(s), side = s.seat === 1 ? -1 : (M.alt = -(M.alt || 1)), r = castFrom(a.x + rand(-1, 1) * C.weapons[0].spread, a.y + rand(-1, 1) * C.weapons[0].spread), h = hitscan(r, false), from = muzzleOf(s.seat === 1 ? -1 : 1);
    tracer(from, h.end, s.seat === 1 ? '#7af0ff' : '#ffe27a'); SFX.play('cannon'); M.shake = Math.max(M.shake, 0.06); cockpit.cmd('fire');
    emit(2, from.x, from.y, from.z, 3, '#fff3b0', '#ffb040', 0.08, 1, 0);
    if (h.hits.length) { var x = h.hits[0]; if (x.e) { damageEnemy(x.e, 1, s.seat); emit(4, h.end.x, h.end.y, h.end.z, 9, '#fff', '#ffd23f', 0.25); } else blowBarrel(x.b, s.seat); }
    else emit(3, h.end.x, h.end.y, h.end.z, 5, '#c9c1a8', '#8a8170', 0.4);
    lastAim[s.seat] = a;
  }
  function rocketSalvo(s, w) {     // every locked target gets a rocket, staggered
    var on = (s.locks || []).filter(function (l) { return l.on; }); if (!on.length) return false;
    on = on.slice(0, w.mag); w.mag -= on.length; w.cool = 60 / w.def.rpm * Math.max(1, on.length * 0.8);
    on.forEach(function (l, i) { setTimeout(function () { fireRocket(s, l.e); }, i * 130); });
    if (w.mag <= 0) startReload(w, s); return true;
  }
  function fireRocket(s, lockT) {
    var a = shotAim(s), r = castFrom(a.x, a.y), from = muzzleOf(rockets.length % 2 ? -1 : 1), m = rocketPool.find(function (q) { return !q.visible; });
    if (!m) return; m.visible = true; m.position.copy(from);
    var dir = r.direction.clone();
    if (lockT) dir.y += 0.25;
    rockets.push({ m: m, v: dir.multiplyScalar(C.weapons[1].speed * 0.55), locked: !!lockT, target: lockT || (a.t && a.t.e ? a.t.e : null), life: 4, seat: s.seat, smoke: 0 });
    SFX.play('rocket'); M.shake = Math.max(M.shake, 0.2); cockpit.cmd('fire');
  }
  function tickRockets(dt) {
    var def = C.weapons[1];
    for (var i = rockets.length - 1; i >= 0; i--) {
      var k = rockets[i], p = k.m.position; k.life -= dt;
      var sp = Math.min(def.speed, k.v.length() + 60 * dt);
      if (k.target && enemies.indexOf(k.target) >= 0) { var want = enemyPos(k.target).sub(p).normalize(); k.v.normalize().lerp(want, clamp((k.locked ? def.lockHoming : def.homing) * dt, 0, 1)).normalize(); } else k.v.normalize();
      k.v.multiplyScalar(sp); p.addScaledVector(k.v, dt); k.m.lookAt(p.clone().add(k.v));
      k.m.rotateY(Math.PI);
      k.smoke -= dt; if (k.smoke <= 0) { k.smoke = 0.03 / fxk(); emit(1, p.x, p.y, p.z, 1, '#ddd', '#aaa', 0.7, 1, -1); }
      var hit = k.life <= 0 || p.y < Wd.height(p.x, p.z) || hitsBuilding(p) || enemies.some(function (e) { return enemyPos(e).distanceTo(p) < e.def.radius + 0.8; }) || barrels.some(function (b) { return b.alive && Math.hypot(b.x - p.x, b.z - p.z) < 1.5 && p.y < b.y + 2.5; });
      if (hit) { explode(p.clone(), 1.1, { r: def.splash, dmg: def.damage }, k.seat); k.m.visible = false; rockets.splice(i, 1); }
    }
  }
  var rail = { t: 0 };
  function fireRail(s, w, charge) {
    var def = w.def, a = shotAim(s), r = castFrom(a.x, a.y), h = hitscan(r, true), from = muzzleOf(1), dmg = Math.round(lerp(def.damage, def.maxDamage, charge));
    w.mag--; w.cool = 0.4; if (w.mag <= 0) startReload(w, s);
    h.hits.forEach(function (x) { if (x.e) damageEnemy(x.e, dmg, s.seat); else blowBarrel(x.b, s.seat); });
    var mid = from.clone().add(h.end).multiplyScalar(0.5), len = from.distanceTo(h.end);
    railBeam.visible = true; railBeam.position.copy(mid); railBeam.scale.set(0.6 + charge * 1.6, len, 0.6 + charge * 1.6); railBeam.lookAt(h.end); railBeam.rotateX(Math.PI / 2); rail.t = 0.35;
    flash(h.end.x, h.end.y, h.end.z, 2 + charge * 2, 0x9af6ff); emit(18 * charge + 6, h.end.x, h.end.y, h.end.z, 14, '#ffffff', '#7af0ff', 0.5);
    SFX.play('rail', { p: 0.5 + charge * 0.5 }); M.shake = Math.max(M.shake, 0.35 + charge * 0.4); cockpit.cmd('fire'); notify('rail');
  }
  function setMove(x, y) {        // pad vector relative to the torso: y forward, x right
    var m = Math.min(1, Math.hypot(x, y));
    if (m > 0.05) { M.travel = M.torso - Math.atan2(x, y); if (M.pad <= 0.05 && M.path.length) { M.path = []; M.pathV++; } }
    M.pad = m;
  }
  function fireOnce(s) {          // v0.2: a quick tap on the thumb pad fires one shot of the current weapon
    var w = curW(s); if (phase !== 'play' || M.eject || M.down > 0 || w.reload >= 0 || (s.seat === 0 && M.swap > 0)) return;
    if (w.mag <= 0) { startReload(w, s); return; }
    if (w.def.id === 'rail') { fireRail(s, w, 0.4); return; }
    if (w.def.id === 'rocket' && w.cool <= 0 && rocketSalvo(s, w)) return;
    if (w.cool > 0) return; w.cool = 60 / w.def.rpm; w.mag--; if (w.def.id === 'cannon') fireCannon(s); else fireRocket(s); if (w.mag <= 0) startReload(w, s);
  }
  function selectWeapon(i) { if (i === wsel || !WEAP[i]) return; wsel = i; M.swap = 0.35; SFX.play('select'); cockpit.cmd('weapon'); if (seats[0]) { seats[0].charging = false; seats[0].charge = 0; } notify('weapon'); }

  // ================================================================== movement
  function setPath(pts) {
    pts = (pts || []).filter(function (p) { return p && isFinite(p[0]) && isFinite(p[1]); }).map(function (p) { var l = Wd.half - 12; return [clamp(p[0], -l, l), clamp(p[1], -l, l)]; });
    M.path = pts; M.pathIdx = 0; M.pathV++;
    var bd = 1e9; for (var i = 0; i < Math.ceil(pts.length / 2); i++) { var d = Math.hypot(pts[i][0] - M.x, pts[i][1] - M.z); if (d < bd) { bd = d; M.pathIdx = i; } }   // join the path where it passes closest if (pts.length) { M.autopilot = true; cockpit.cmd('map'); SFX.play('beep2'); }
  }
  function tickMech(dt) {
    var target = 0, desired = M.legYaw;
    if (M.padRel >= 0 && M.pad > 0) { if (M.padRel > 0) M.padRel = Math.max(0, M.padRel - dt); else { M.pad *= Math.exp(-dt / C.pad.decaySec); if (M.pad < 0.06) { M.pad = 0; M.padRel = -1; } } }   // v0.3 momentum after a swipe
    if (M.down > 0) { M.down -= dt; if (M.down <= 0) respawn(); }
    else if (M.eject) { /* standing still while the pilot is out */ }
    else if (M.pad > 0.05) {     // v0.2 thumb pad: walk toward the dragged direction (legs turn around to back up)
      var dT = wrapA(M.travel - M.legYaw), back = Math.abs(dT) > 2.0; desired = back ? M.travel + Math.PI : M.travel;
      target = C.mech.walkSpeed * M.pad * (back ? -C.mech.backSpeed : 1) * clamp(Math.cos(wrapA(desired - M.legYaw)) * 1.3, 0.12, 1);
    }
    else if (M.autopilot && M.path.length) {
      while (M.pathIdx < M.path.length - 1 && Math.hypot(M.path[M.pathIdx][0] - M.x, M.path[M.pathIdx][1] - M.z) < C.mech.lookahead) M.pathIdx++;
      var p = M.path[M.pathIdx], dx = p[0] - M.x, dz = p[1] - M.z, d = Math.hypot(dx, dz);
      if (M.pathIdx === M.path.length - 1 && d < C.mech.arriveDist) { M.path = []; M.pathV++; flashMsg('WAYPOINT REACHED', '#5dff9a'); SFX.play('beep'); }
      else { desired = Math.atan2(-dx, -dz); var diff = Math.abs(wrapA(desired - M.legYaw)); target = C.mech.walkSpeed * clamp(Math.cos(diff) * 1.2, 0.15, 1) * clamp(d / 6 + 0.3, 0.3, 1); }
    } else if (M.walk) { desired = M.walk > 0 ? M.torso : M.legYaw; target = C.mech.walkSpeed * (M.walk > 0 ? 1 : -0.5); }
    if (M.turn) desired = M.legYaw + M.turn;
    if (M.faceTo != null) { var fd = wrapA(M.faceTo - M.torso), fr = C.mech.faceDegPerSec * D2R * dt; M.torso += clamp(fd, -fr, fr); if (Math.abs(fd) < 0.01) M.faceTo = null; }
    if (M.braceT > 0) target = 0;
    var tr = C.mech.turnDegPerSec * D2R * dt, dd = wrapA(desired - M.legYaw); M.legYaw += clamp(dd, -tr, tr);
    if (!M.autopilot && !M.walk && !M.turn && M.pad <= 0.05) { /* manual + idle: legs slowly settle under the torso */ var dd2 = wrapA(M.torso - M.legYaw); if (Math.abs(dd2) > 0.6) M.legYaw += clamp(dd2, -tr * 0.5, tr * 0.5); }
    M.speed += clamp(target - M.speed, -10 * dt, 4 * dt);
    var nx = M.x - Math.sin(M.legYaw) * M.speed * dt, nz = M.z - Math.cos(M.legYaw) * M.speed * dt, lim = Wd.half - 12;
    nx = clamp(nx, -lim, lim); nz = clamp(nz, -lim, lim);
    Wd.buildings.forEach(function (b) {   // push out of buildings
      var px = b.w / 2 + C.mech.radius - Math.abs(nx - b.x), pz = b.d / 2 + C.mech.radius - Math.abs(nz - b.z);
      if (px > 0 && pz > 0) { if (px < pz) nx += px * Math.sign(nx - b.x); else nz += pz * Math.sign(nz - b.z); }
    });
    M.x = nx; M.z = nz;
    // stride: two footfalls per cycle
    if (Math.abs(M.speed) > 0.3) {
      var before = M.phase; M.phase += dt / C.mech.strideSec * clamp(Math.abs(M.speed) / C.mech.walkSpeed, 0.45, 1.1);
      if (Math.floor(before * 2) !== Math.floor(M.phase * 2)) footfall(Math.floor(M.phase * 2) % 2);
    } else M.phase += (Math.round(M.phase * 2) / 2 - M.phase) * Math.min(1, dt * 4);
    // bay
    var B = Wd.bay, inBay = Math.abs(M.x - B.x) < B.w / 2 - 1 && Math.abs(M.z - B.z) < B.d / 2 - 1;
    if (inBay && !M.inBay) { SFX.play('bay'); cockpit.cmd('bay'); big('MECH BAY', 'rearm + repair', 1400); WEAP.forEach(function (w) { w.res = w.resMax; if (w.mag < w.def.mag && w.reload < 0) startReload(w, seats[0] || { seat: 0 }); }); notify('bay'); }
    if (inBay) M.hull = Math.min(C.mech.hull, M.hull + C.bay.repairPerSec * dt);
    M.inBay = inBay;
    M.braceT = Math.max(0, M.braceT - dt); M.braceCd = Math.max(0, M.braceCd - dt);
    M.swap = Math.max(0, M.swap - dt); M.hurt = Math.max(0, M.hurt - dt * 0.9); M.shake = Math.max(0, M.shake - dt * 2.2);
    // spring for the footfall dip
    M.dipV += (-M.dip * 60 - M.dipV * 9) * dt; M.dip += M.dipV * dt;
  }
  function footfall(side) {
    var fx = M.x - Math.cos(M.legYaw) * 2.1 * (side ? 1 : -1), fz = M.z + Math.sin(M.legYaw) * 2.1 * (side ? 1 : -1);
    SFX.play('stomp', { k: 0.9 + Math.random() * 0.2 }); M.dipV -= 3.2; M.shake = Math.max(M.shake, 0.12);
    emit(10, fx, Wd.height(fx, fz) + 0.3, fz, 4, '#b8ad95', '#8c8370', 0.9, 0.5, 2);
  }
  function brace() { if (M.braceCd > 0 || M.eject) return; M.braceT = 2.6; M.braceCd = 4; SFX.play('brace'); cockpit.cmd('brace'); M.shake = Math.max(M.shake, 0.3); flashMsg('BRACED: armour up, legs locked', '#ffb02e'); notify('brace'); }
  function eject() {
    if (M.eject || M.down > 0) return; cockpit.cmd('eject');
    setTimeout(function () { M.eject = { t: 0, vy: 34, y: 0 }; SFX.play('eject'); cockpit.visible = false; cockpit.drawFrame(); big('EJECT!', 'canopy away', 1500); emit(30, camera.position.x, camera.position.y + 2, camera.position.z, 12, '#ffd27a', '#888', 1); notify('eject'); }, 450);
  }
  function tickEject(dt) {
    var e = M.eject; if (!e) return; e.t += dt; e.vy -= 22 * dt; if (e.y > 20 && e.vy < -3) e.vy = -3;   // parachute
    e.y = Math.max(0, e.y + e.vy * dt);
    if (e.t > 6.5) { M.eject = null; cockpit.visible = true; cockpit.drawFrame(); big('BACK IN THE SEAT', 'canopy resealed', 1400); SFX.play('bay'); }
  }

  // ================================================================== torso + camera from the pilot's crosshair
  function steer(dt) {
    var s = seats[0], A = C.aim;
    if (s && !M.eject && M.down <= 0 && s.calStep < 0) {
      var ex = Math.abs(s.ax) - A.edge; if (ex > 0) M.torso -= Math.sign(s.ax) * Math.pow(Math.min(1, ex / (1 - A.edge)), A.turnCurve || 1.5) * A.turnDegPerSec * D2R * dt;
      var ey = Math.abs(s.ay) - A.pitchEdge; if (ey > 0) M.pitch = clamp(M.pitch + Math.sign(s.ay) * Math.pow(ey / (1 - A.pitchEdge), 1.5) * A.pitchDegPerSec * D2R * dt, A.pitchLimitDeg[0] * D2R, A.pitchLimitDeg[1] * D2R);
      if (ex > 0.05 && !steer.whir) { SFX.play('servo'); steer.whir = 1; } else if (ex <= 0) steer.whir = 0;
    }
    if (phase === 'lobby') M.torso += dt * 0.06;
    if (kbMode && (keys.q || keys.e)) { M.faceTo = null; M.torso += (keys.q ? 1 : -1) * A.turnDegPerSec * 0.8 * D2R * dt; }
  }
  function placeCamera(dt) {
    var gy = Wd.height(M.x, M.z), ph = M.phase * Math.PI * 2, crouch = M.braceT > 0 ? -1.6 : 0;
    M.crouch = lerp(M.crouch || 0, crouch, Math.min(1, dt * 8));
    var bob = -Math.abs(Math.sin(ph)) * 0.38 * clamp(Math.abs(M.speed) / C.mech.walkSpeed, 0, 1);
    var sh = M.shake * M.shake, sx = (Math.random() - 0.5) * sh * 0.9, sy = (Math.random() - 0.5) * sh * 0.9;
    var fx = -Math.sin(M.torso), fz = -Math.cos(M.torso);
    camera.position.set(M.x + fx * 0.8, gy + C.mech.eyeHeight + bob + M.dip * 0.6 + M.crouch, M.z + fz * 0.8);
    camera.rotation.set(M.pitch + sy * 0.05, M.torso + sx * 0.05, Math.sin(ph) * 0.012 * clamp(Math.abs(M.speed) / C.mech.walkSpeed, 0, 1) + sx * 0.02);
    if (M.eject) { camera.position.y += M.eject.y; camera.rotation.x = -0.55 - Math.min(0.5, M.eject.t * 0.1); camera.rotation.z = Math.sin(M.eject.t * 1.3) * 0.08; }
    chin.position.copy(camera.position); chin.rotation.set(M.pitch * 0.5, M.torso, 0, 'YXZ'); chin.visible = !M.eject || M.eject.y > 3;
    if (M.eject) chin.position.y -= M.eject.y;
    legs.position.set(M.x, gy + M.crouch * 0.5, M.z); legs.rotation.y = M.legYaw;
    var L = legs.userData.L, R = legs.userData.R, sw = Math.sin(ph) * 0.5 * clamp(Math.abs(M.speed) / C.mech.walkSpeed, 0, 1);
    L.hip.rotation.x = sw; R.hip.rotation.x = -sw; L.knee.rotation.x = Math.max(0, -Math.cos(ph)) * 0.7 - M.crouch * 0.3; R.knee.rotation.x = Math.max(0, Math.cos(ph)) * 0.7 - M.crouch * 0.3;
    if (M.crouch < -0.1) { L.hip.rotation.x -= M.crouch * 0.3; R.hip.rotation.x -= M.crouch * 0.3; }
    shadow.position.set(M.x, gy + 0.15, M.z);
  }

  // ================================================================== networking: phones
  var phase = 'lobby', net = null, kbMode = false;
  function vipSeat() { return seats[0]; }
  function onMessage(conn, m) {
    if (!m || !m.t) return;
    var s = seats.find(function (q) { return q && q.conn === conn; });
    if (m.t === 'hello') {
      var idx = seats.findIndex(function (q) { return q && q.cid === m.clientId; });
      if (idx < 0) idx = !seats[0] || (!seats[0].connected && !seats[0].kb) ? 0 : !seats[1] || !seats[1].connected ? 1 : -1;
      if (idx < 0) { net.send(conn, { t: 'reject', reason: 'The cockpit is full (pilot + gunner). Watch the TV!' }); return; }
      if (idx === 0 && kbMode) { kbMode = false; $('kbHelp').hidden = true; }
      seats[idx] = newSeat(idx, { cid: m.clientId, conn: conn, name: String(m.name || 'Pilot').slice(0, 12) });
      net.send(conn, { t: 'welcome', seat: idx, role: C.seats[idx].role, color: C.seats[idx].color, phase: phase, weapons: C.weapons.map(function (w) { return w.short; }) });
      SFX.play('join'); lobbyDirty = true; sendState(true); return;
    }
    if (!s) return;
    s.connected = true; s.seen = performance.now();
    switch (m.t) {
      case 'aim': setAim(s, +m.x || 0, +m.y || 0); break;
      case 'pad': setAim(s, s.ax + (+m.dx || 0), s.ay - (+m.dy || 0)); break;
      case 'cal': s.calStep = m.step == null ? -1 : +m.step; if (m.done) { SFX.play('beep2'); lobbyDirty = true; s.ready = true; } else if (m.step >= 0) SFX.play('beep'); break;
      case 'fire': s.fire = !!m.d; if (s.fire && phase === 'lobby' && s.seat === 0 && s.ready) startGame(); break;
      case 'weapon': if (s.seat === 0) selectWeapon(+m.i); break;
      case 'reload': startReload(curW(s), s); break;
      case 'goto': if (s.seat === 0) setPath([[+m.x, +m.z]]); break;
      case 'path': if (s.seat === 0) setPath(m.pts); break;
      case 'clear': if (s.seat === 0) { M.path = []; M.pathV++; } break;
      case 'auto': if (s.seat === 0) { M.autopilot = !!m.on; cockpit.cmd('auto'); SFX.play('click'); flashMsg(M.autopilot ? 'AUTOPILOT ON' : 'MANUAL: hold STRIDE to walk', '#5dff9a'); } break;
      case 'walk': if (s.seat === 0) M.walk = +m.d || 0; break;
      case 'move': if (s.seat === 0) { setMove(+m.x || 0, +m.y || 0); M.padRel = m.rel ? C.pad.holdSec : -1; } break;
      case 'face': if (s.seat === 0 && isFinite(+m.a)) { M.faceTo = wrapA((M.faceTo != null ? M.faceTo : M.torso) - (+m.a)); SFX.play('servo'); } break;
      case 'tap': fireOnce(s); break;
      case 'brace': brace(); break;
      case 'eject': if (s.seat === 0) eject(); break;
      case 'hands': cockpit.handsOn = !!m.on; flashMsg('HOLO HANDS ' + (m.on ? 'ON' : 'OFF'), '#7af0ff'); break;
      case 'start': if (s.seat === 0) startGame(); break;
      case 'ping': break;
    }
    phoneDirty = true;
  }
  function onClose(conn) { lobbyDirty = true; seats.forEach(function (s) { if (s && s.conn === conn) { s.connected = false; s.fire = false; } }); lobbyDirty = true; }
  var notes = [];
  function notify(k) { notes.push(k); phoneDirty = true; }
  var phoneDirty = true, lastSend = 0, sentPathV = -1;
  function sendState(force) {
    var now = performance.now(); if (!net || (!force && !phoneDirty && now - lastSend < (phase === 'play' ? 80 : 200)) || (!force && now - lastSend < 70)) return;
    lastSend = now; phoneDirty = false;
    var en = enemies.map(function (e) { return [Math.round(e.x), Math.round(e.z), e.kind === 'tank' ? 1 : 0]; });
    var base = { t: 'st', phase: phase, hull: Math.round(M.hull), x: +M.x.toFixed(1), z: +M.z.toFixed(1), ly: +M.legYaw.toFixed(2), ty: +M.torso.toFixed(2), en: en, auto: M.autopilot, hands: cockpit.handsOn, score: M.score,
      bay: M.inBay, tv: [+wrapA(M.torso - (M.speed < 0 ? M.legYaw + Math.PI : M.legYaw)).toFixed(2), +clamp(Math.abs(M.speed) / C.mech.walkSpeed, 0, 1).toFixed(2)], brace: M.braceT > 0, ej: !!M.eject, down: M.down > 0, pathV: M.pathV, notes: notes.splice(0) };
    seats.forEach(function (s) {
      if (!s || !s.conn || !s.connected) return;
      var w = curW(s), msg = Object.assign({}, base, { seat: s.seat, w: s.seat === 0 ? wsel : 0, ammo: s.seat === 0 ? WEAP.map(function (q) { return [q.mag, q.res, q.reload >= 0 ? +q.reload.toFixed(2) : -1, q.def.mag, q.resMax]; }) : [[GUN2.mag, 0, GUN2.reload >= 0 ? +GUN2.reload.toFixed(2) : -1, 60, 0]], locks: (s.locks || []).filter(function (l) { return l.on; }).length, charge: +(s.charge || 0).toFixed(2), ready: !!s.ready });
      if (sentPathV !== M.pathV) msg.path = M.path.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; });
      net.send(s.conn, msg);
    });
    sentPathV = M.pathV;
  }
  function startGame() {
    if (phase === 'play') return; phase = 'play'; playT = 0; spawnT = 2.5; $('lobby').hidden = true; $('strip').hidden = !net || !!seats[1];
    big('SYSTEMS ONLINE', 'drones inbound', 1800); SFX.play('go'); phoneDirty = true; sendState(true);
  }
  function startNet() {
    if (NONET) { $('netStatus').textContent = 'offline (?nonet)'; return; }
    var code = (Q.get('room') || '').toUpperCase().slice(0, 4) || undefined;
    var opts = { code: code, fixedCode: !!code, onMessage: onMessage, onClose: onClose, onStatus: function (st, c) {
      $('code').textContent = c || net.code; $('stripCode').textContent = c || net.code;
      $('netStatus').textContent = st === 'online' ? 'Room open' : st === 'offline' ? 'Cannot reach the room server. Play with mouse + keys, or check the internet.' : 'Connecting to the room server\u2026';
      var url = (location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html') + '?room=' + (c || net.code) + (LOCAL ? '&local=1' : '');
      $('joinUrl').textContent = url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''); drawQr(url);
    } };
    net = LOCAL ? new window.LRNet.LocalHost(opts) : new window.LRNet.Host(opts);
  }
  function drawQr(text) {
    var cv = $('qr'), ctx = cv.getContext('2d');
    try { var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make(); var n = qr.getModuleCount(), s = Math.floor(300 / (n + 4)), o = Math.floor((300 - s * n) / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 300); ctx.fillStyle = '#000'; for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(o + c * s, o + r * s, s, s); } catch (e) {}
  }
  var lobbyDirty = true;
  function renderLobby() {
    if (!lobbyDirty) return; lobbyDirty = false;
    var h = ''; seats.forEach(function (s, i) { if (!s) return; h += '<li><span class="role" style="background:' + C.seats[i].color + '">' + C.seats[i].role + '</span>' + esc(s.name || 'Mouse') + '<span class="st">' + (s.kb ? 'mouse + keys' : !s.connected ? 'reconnecting\u2026' : s.ready ? 'calibrated \u2714' : 'calibrating\u2026') + '</span></li>'; });
    $('lobbyPlayers').innerHTML = h; $('strip').hidden = phase !== 'play' || !net || !!(seats[1] && seats[1].connected);
    $('startHint').textContent = !seats[0] ? 'Waiting for a pilot\u2026' : seats[0].ready || seats[0].kb ? 'Pilot: tap START on your phone (or press FIRE)' : 'Pilot is calibrating\u2026';
  }

  // ================================================================== mouse + keys (a laptop with no phone; also handy for testing)
  function kbStart() {
    if (seats[0] && seats[0].connected && !seats[0].kb) return;
    kbMode = true; seats[0] = newSeat(0, { kb: true, name: 'Mouse', ready: true }); $('kbHelp').hidden = false; lobbyDirty = true; startGame();
  }
  $('kbBtn').onclick = function (e) { e.preventDefault(); SFX.unlock(); kbStart(); };
  window.addEventListener('mousemove', function (e) { if (!kbMode || !seats[0]) return; setAim(seats[0], e.clientX / window.innerWidth * 2 - 1, 1 - e.clientY / window.innerHeight * 2); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('mousedown', function (e) {
    if (!kbMode || !seats[0] || phase !== 'play') return;
    if (e.button === 2) { var r = castFrom(e.clientX / window.innerWidth * 2 - 1, 1 - e.clientY / window.innerHeight * 2), t = worldT(r), p = r.at(t, new T.Vector3()); if (t < 300) setPath([[p.x, p.z]]); return; }
    if (e.button === 0) seats[0].fire = true;
  });
  window.addEventListener('mouseup', function (e) { if (kbMode && seats[0] && e.button === 0) seats[0].fire = false; });
  var keys = {};
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase(); if (keys[k]) return; keys[k] = true;
    if (k === 'm') SFX.setMuted(!SFX.muted());
    if (k === 'h') { cockpit.handsOn = !cockpit.handsOn; flashMsg('HOLO HANDS ' + (cockpit.handsOn ? 'ON' : 'OFF'), '#7af0ff'); }
    if (k === 'enter' && phase === 'lobby' && (seats[0] && seats[0].ready)) startGame();
    if (!kbMode) return;
    if (k >= '1' && k <= '3') selectWeapon(+k - 1);
    if (k === 'r') startReload(WEAP[wsel], seats[0]);
    if (k === 'b') brace();
    if (k === 'x') eject();
    if (k === 'p') { M.autopilot = !M.autopilot; cockpit.cmd('auto'); }
    kbMove();
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; kbMove(); });
  function kbMove() { if (!kbMode) return; var x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), y = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), m = Math.hypot(x, y) || 1; setMove(x / m, y / m); }

  // ================================================================== HUD state + messages
  var msg = { text: '', color: '', t: 0 };
  function flashMsg(t, c) { msg.text = t; msg.color = c; msg.t = 2.4; }
  function big(text, sub, ms) { var el = $('big'); el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : ''); el.className = 'on'; clearTimeout(big._t); big._t = setTimeout(function () { el.className = ''; }, ms || 1200); }
  var CAL_MARK = [{ x: 0, y: 0, label: 'CENTRE' }, { x: -0.9, y: 0, label: 'LEFT EDGE' }, { x: 0.9, y: 0, label: 'RIGHT EDGE' }];
  function hudState(dt) {
    msg.t -= dt;
    var cross = [], cal = [];
    seats.forEach(function (s) {
      if (!s || (!s.connected && !s.kb)) return;
      if (s.calStep >= 0 && s.calStep < 3) { var m = CAL_MARK[s.calStep]; cal.push({ x: m.x, y: m.y, label: (s.seat ? 'GUNNER: ' : '') + m.label, color: s.color }); return; }
      if (M.eject) return;
      var a = assist(s), L = a && a.t ? { x: a.t.x, y: a.t.y, r: 14 + 26 * (1 - a.tight) + clamp(60 / a.t.d, 0, 20), tight: a.tight } : null;
      cross.push({ locks: (s.locks || []).map(function (l) { return { x: l.x, y: l.y, p: l.p, on: l.on }; }), x: s.ax, y: s.ay, ix: a.x, iy: a.y, tight: a.tight, color: s.color, lock: L, charge: s.charging ? s.charge : 0 });
    });
    var cs = Math.cos(M.torso), sn = Math.sin(M.torso);
    function rel(x, z) { var dx = x - M.x, dz = z - M.z; return [-(dx * cs - dz * sn) * -1, -(dx * sn + dz * cs)]; }   // [right, forward] in torso frame
    var togo = null; if (M.path.length) { togo = 0; var px = M.x, pz = M.z; for (var i = M.pathIdx; i < M.path.length; i++) { togo += Math.hypot(M.path[i][0] - px, M.path[i][1] - pz); px = M.path[i][0]; pz = M.path[i][1]; } }
    return {
      heading: -M.torso / D2R, hull: M.hull / C.mech.hull, score: M.score, wsel: wsel, swap: M.swap / 0.35,
      weapons: WEAP.map(function (w) { return { short: w.def.short, color: w.def.color, mag: w.mag, magMax: w.def.mag, res: w.res, resMax: w.resMax, reload: w.reload }; }),
      blips: enemies.map(function (e) { var r = rel(e.x, e.z); return [r[0], r[1], e.kind]; }), radarBay: rel(Wd.bay.x, Wd.bay.z),
      radarPath: M.path.length ? [[0, 0]].concat(M.path.slice(M.pathIdx).map(function (p) { return rel(p[0], p[1]); })) : null,
      legDir: wrapA(M.torso - M.legYaw), autopilot: M.autopilot, toGo: togo, speedTxt: Math.abs(M.speed) > 0.3 ? (Math.abs(M.speed) * 3.6).toFixed(0) + ' km/h' : 'STANDING',
      braced: M.braceT > 0, hurt: M.hurt, status: M.down > 0 ? 'MECH DOWN' : M.inBay ? 'BAY: REPAIRING' : M.braceT > 0 ? 'BRACED' : M.hull < 30 ? 'HULL CRITICAL' : 'SYSTEMS NOMINAL',
      cross: cross, cal: cal, msg: msg.t > 0 ? msg.text : (seats[0] && seats[0].kb && phase === 'play' && playT < 6 ? 'Right-click the ground to walk there' : ''), msgColor: msg.color
    };
  }

  // ================================================================== main loop
  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now; if (dt <= 0) return;
    qualTick(dt);
    if (phase === 'play') {
      playT += dt; spawnT -= dt; if (spawnT <= 0) { spawnT = rand(C.enemies.spawnEvery[0], C.enemies.spawnEvery[1]) * (playT < 20 ? 1.4 : 1); spawnEnemy(); }
      tickEnemies(dt);
    }
    steer(dt); tickMech(dt); tickEject(dt);
    seats.forEach(function (s) { if (s) { tickIntent(s, dt); tickLocks(s, dt); tickWeapon(s, dt); } });
    tickRockets(dt); tickParticles(dt); tickTracers(dt); tickFlashes(dt);
    if (rail.t > 0) { rail.t -= dt; railBeam.material.opacity = Math.max(0, rail.t / 0.35); if (rail.t <= 0) railBeam.visible = false; }
    bayLight.material.color.setHSL(0.55, 1, 0.45 + 0.2 * Math.sin(now / 300));
    placeCamera(dt);
    renderer.render(scene, camera);
    cockpit.draw(hudState(dt), dt);
    renderLobby(); sendState(false);
  }
  layout(); startNet(); requestAnimationFrame(frame);
  if (Q.has('kb')) setTimeout(kbStart, 200);
  window.MECH = { _cam: camera, M: M, seats: seats, enemies: enemies, barrels: barrels, WEAP: WEAP, qual: qual, renderer: renderer, setPath: setPath, startGame: startGame, spawn: spawnEnemy, selectWeapon: selectWeapon, phase: function () { return phase; }, cockpit: cockpit, info: function () { return renderer.info.render; } };
})();
