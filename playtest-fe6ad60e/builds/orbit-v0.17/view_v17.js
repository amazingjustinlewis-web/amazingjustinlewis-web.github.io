/* ORBIT BRAWL v0.1 - three.js view shared by phone cockpits, the TV spectator cam and replays.
   Ship pods: proxy built here; drop Justin's Blender pod in as models/pod.glb (nose +Y in Blender = -Z in glTF, ~1 unit long)
   and every ship uses it automatically, tinted by player colour (material named "Paint" gets the tint; others keep their colour). */
(function (root) {
  'use strict';
  var T = root.THREE, POD = 4.2;   // world length of a pod
  var GLB = null, glbWait = [];
  fetch(new URL('models/pod.glb', document.baseURI)).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(parseGlb).catch(function () {});
  function parseGlb(buf) { try {
    var dv = new DataView(buf), jl = dv.getUint32(12, true), J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
    var CT = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }, NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    function acc(i) { var a = J.accessors[i], v = J.bufferViews[a.bufferView], Ty = CT[a.componentType], o = bin + (v.byteOffset || 0) + (a.byteOffset || 0); return new Ty(buf.slice(o, o + a.count * NC[a.type] * Ty.BYTES_PER_ELEMENT)); }
    var mats = (J.materials || []).map(function (m) { var f = (m.pbrMetallicRoughness || {}).baseColorFactor || [1, 1, 1, 1]; return { name: m.name || '', c: new T.Color(f[0], f[1], f[2]) }; });
    var tpl = new T.Group();
    function node(i, parent) { var n = J.nodes[i], o = new T.Group(); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale);
      if (n.mesh != null) J.meshes[n.mesh].primitives.forEach(function (p) { var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(acc(p.attributes.POSITION), 3));
        if (p.attributes.NORMAL != null) g.setAttribute('normal', new T.BufferAttribute(acc(p.attributes.NORMAL), 3)); else g.computeVertexNormals(); if (p.indices != null) g.setIndex(new T.BufferAttribute(acc(p.indices), 1));
        var m = mats[p.material] || { name: 'Paint', c: new T.Color(1, 1, 1) }, mesh = new T.Mesh(g); mesh.userData.paint = /paint|body|hull/i.test(m.name) || p.material == null; mesh.userData.c = m.c; o.add(mesh); });
      (n.children || []).forEach(function (c) { node(c, o); }); parent.add(o); }
    (J.scenes[J.scene || 0].nodes).forEach(function (i) { node(i, tpl); });
    var bb = new T.Box3().setFromObject(tpl), sz = bb.getSize(new T.Vector3()), s = POD / Math.max(sz.x, sz.y, sz.z, .01); tpl.scale.setScalar(s);
    GLB = tpl; glbWait.forEach(function (f) { f(); }); glbWait = [];
  } catch (e) { console.warn('pod.glb failed, proxy pods stay', e); } }
  // ---- v0.12 proxy ship from Justin's "Ship design document_01": rounded wedge fuselage, big glass canopy, pink seat + two little GyroForge-style joysticks,
  // side engine nacelles (orange layer), side weapon pods (green layer), optional top fins (teal layer). Pilot = positioned geometry built from a spec so the
  // character maker can drive it later (spec: { skin, suit, helmet, visor }). Nose at -Z. Shared geometry/materials keep it phone-light.
  var GEO = null, MAT = {};
  function geo() { if (GEO) return GEO; GEO = { body: new T.SphereGeometry(.5, 12, 8), can: new T.SphereGeometry(.5, 12, 8, 0, 6.3, 0, 1.6), nac: new T.CapsuleGeometry ? new T.CapsuleGeometry(.11, .55, 3, 8) : new T.CylinderGeometry(.11, .11, .75, 8),
    gun: new T.CylinderGeometry(.035, .045, .3, 6), pod: new T.SphereGeometry(.09, 8, 6), fin: new T.ConeGeometry(.04, .22, 4), box: new T.BoxGeometry(1, 1, 1), ball: new T.SphereGeometry(.5, 10, 8), stick: new T.CylinderGeometry(.012, .012, .1, 5),
    fl: new T.ConeGeometry(.08, .5, 8) }; return GEO; }
  function mat(k, mk) { return MAT[k] || (MAT[k] = mk()); }
  function std(c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: .5, metalness: .2, flatShading: true }, o || {})); }
  var PILOT0 = { skin: '#e8b48a', suit: '#f2f2f5', helmet: '#ffffff', visor: '#3a6fa8' };
  function mesh(g, m, x, y, z, sx, sy, sz, par) { var o = new T.Mesh(g, m); o.position.set(x, y, z); if (sx != null) o.scale.set(sx, sy, sz); (par || null) && par.add(o); return o; }
  function buildPilot(spec) { spec = Object.assign({}, PILOT0, spec || {}); var G = geo(), suit = mat('s' + spec.suit, function () { return std(spec.suit); }), hel = mat('h' + spec.helmet, function () { return std(spec.helmet, { metalness: .4 }); }),
      vis = mat('v' + spec.visor, function () { return std(spec.visor, { roughness: .1, metalness: .8, emissive: 0x112233 }); }), glove = mat('glove', function () { return std(0x30343c); });
    var p = new T.Group(); p.name = 'pilot'; var torso = mesh(G.box, suit, 0, .06, 0, .16, .2, .1, p);
    var head = new T.Group(); head.position.set(0, .23, 0); p.add(head); mesh(G.ball, hel, 0, 0, 0, .14, .14, .14, head); mesh(G.ball, vis, 0, .005, -.045, .1, .07, .06, head);
    function arm(sd) { var sh = new T.Group(); sh.position.set(sd * .1, .13, 0); p.add(sh); mesh(G.box, suit, 0, -.05, -.02, .045, .1, .045, sh); var el = new T.Group(); el.position.set(0, -.1, -.03); sh.add(el);
      mesh(G.box, suit, 0, 0, -.05, .04, .04, .1, el); var hd = mesh(G.ball, glove, 0, 0, -.11, .045, .045, .045, el); sh.rotation.x = .35; el.rotation.x = .45; return { sh: sh, el: el, hand: hd }; }
    function leg(sd) { var l = new T.Group(); l.position.set(sd * .045, -.05, 0); p.add(l); mesh(G.box, suit, 0, 0, -.07, .055, .05, .15, l); mesh(G.box, suit, 0, -.07, -.14, .05, .14, .05, l); return l; }
    p.userData.rig = { head: head, torso: torso, aL: arm(-1), aR: arm(1), lL: leg(-1), lR: leg(1), spec: spec }; return p; }
  function proxyPod(col, lite) {
    var G = geo(), g = new T.Group(), paint = new T.MeshStandardMaterial({ color: col, roughness: .45, metalness: .3, flatShading: true }), dark = mat('dark', function () { return std(0x252a36, { roughness: .6 }); }), eng = mat('eng', function () { return std(0xff8a2a, { roughness: .4, metalness: .4 }); });
    var body = mesh(G.body, paint, 0, -.04, .02, .8, .3, 1.15, g); body.name = 'chunk';
    var belly = mesh(G.box, dark, 0, -.16, .05, .62, .08, .9, g); belly.name = 'chunk';
    [-1, 1].forEach(function (sd) { var n = mesh(G.nac, eng, sd * .44, -.13, .18, null, null, null, g); n.rotation.x = Math.PI / 2; n.name = 'chunk';
      var fl = mesh(G.fl, mat('flame', function () { return new T.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false }); }), sd * .44, -.13, .78); fl.rotation.x = -Math.PI / 2; fl.userData.flame = 1; g.add(fl);
      var wp = mesh(G.pod, dark, sd * .36, .03, -.12, .7, .7, 1.3, g); wp.name = 'chunk'; var b = mesh(G.gun, dark, sd * .36, .03, -.3, null, null, null, g); b.rotation.x = Math.PI / 2; });
    if (lite) { g.scale.setScalar(POD / 1.15); return g; }
    [-.05, .12, .28].forEach(function (z, i) { var f = mesh(G.fin, mat('fin', function () { return std(0x3fe0b0); }), 0, .2 - i * .015, z, 1, 1, 1, g); f.rotation.x = .5; });
    var cab = new T.Group(); cab.position.set(0, .06, -.1); cab.scale.setScalar(.75); g.add(cab);
    var pink = mat('pink', function () { return std(0xff3fa0); }); mesh(G.box, pink, 0, -.03, .07, .22, .04, .2, cab); var back = mesh(G.box, pink, 0, .12, .16, .22, .3, .04, cab); back.rotation.x = -.2;
    var sticks = [-1, 1].map(function (sd) { var b = new T.Group(); b.position.set(sd * .12, .0, -.07); cab.add(b); mesh(G.ball, pink, 0, 0, 0, .05, .03, .05, b); var s = new T.Group(); b.add(s); mesh(G.stick, dark, 0, .05, 0, null, null, null, s); mesh(G.ball, dark, 0, .1, 0, .035, .035, .035, s); return s; });
    var pl = buildPilot(); pl.position.set(0, .07, .08); cab.add(pl);
    var cn = mesh(G.can, mat('glass', function () { return new T.MeshStandardMaterial({ color: 0x9fe6ff, roughness: .05, metalness: .3, transparent: true, opacity: .28, depthWrite: false }); }), 0, .05, -.1, .46, .62, .7, g); cn.name = 'chunk';
    g.userData.cab = { sticks: sticks, pilot: pl, aim: new T.Euler(), n: 0 }; g.scale.setScalar(POD / 1.15); return g; }
  // per-frame cockpit animation: sticks follow turn rate (or own inputs), hands squeeze on triggers, head turns toward nearby ships/rocks
  var _q = new T.Quaternion(), _v = new T.Vector3(), _iq = new T.Quaternion();
  function animCab(sh, s, near, inp, dt) { var C = sh.g.userData && sh.g.userData.cab; if (!C) return; var pv = sh.pq || s.q.clone(), rx = 0, ry = 0;
    if (inp) { rx = inp.p || 0; ry = -(inp.r || inp.y || 0); } else if (dt > 0) { _q.copy(pv).invert().multiply(s.q); rx = Math.max(-1, Math.min(1, _q.x * 2 / dt / 1.9)); ry = Math.max(-1, Math.min(1, -_q.z * 2 / dt / 2.2)); }
    sh.pq = s.q.clone(); var k = 1 - Math.exp(-10 * dt); C.sticks[1].rotation.x += (rx * .45 - C.sticks[1].rotation.x) * k; C.sticks[1].rotation.z += (ry * .45 - C.sticks[1].rotation.z) * k;
    var tz = inp ? (inp.tz || 0) : .5; C.sticks[0].rotation.x += ((.5 - tz) * .6 - C.sticks[0].rotation.x) * k;
    var R = C.pilot.userData.rig, gf = (inp ? inp.fire : s.fire) ? 1 : 0, gb = inp && inp.bomb ? 1 : 0;
    R.aR.el.rotation.x = .45 + gf * .25 + (gf ? Math.sin(performance.now() / 30) * .04 : 0); R.aR.hand.scale.setScalar(gf ? .036 : .045); R.aL.el.rotation.x = .45 + gb * .25; R.aL.hand.scale.setScalar(gb ? .036 : .045);
    R.aR.sh.rotation.z = -ry * .15; R.aL.sh.rotation.z = -ry * .15;
    var hy = 0, hp = 0; if (near) { _v.copy(near).sub(s.p).applyQuaternion(_iq.copy(s.q).invert()).normalize(); hy = Math.max(-1.3, Math.min(1.3, Math.atan2(-_v.x, -_v.z))); hp = Math.max(-.5, Math.min(.9, Math.asin(Math.max(-1, Math.min(1, _v.y))))); }
    else { C.n += dt; hy = Math.sin(C.n * .4) * .35; hp = Math.sin(C.n * .27) * .1; } var kh = 1 - Math.exp(-4 * dt); R.head.rotation.y += (hy - R.head.rotation.y) * kh; R.head.rotation.x += (hp - R.head.rotation.x) * kh; }
  // break-up: chunks fly out spinning + the pilot tumbles as loose jointed pieces; all reuse the ship's own meshes (no new geometry)

  // v0.13 space ragdoll: zero-g, body keeps spin + drift (slow damping); each limb is a spring-damper swing driven by
  // centrifugal pull (-w x (w x r)) and angular-accel lag in the body frame. Base pose picked per ejection.
  var POSES = {
    limp:     { k: 14, d: 2.2, g: .22, sh: [.3, .35], el: .5, lg: [-.4, .12], spin: [2, 4.5] },
    tuck:     { k: 70, d: 7,   g: .06, sh: [1.3, .15], el: 1.9, lg: [.9, .05], spin: [4.5, 8] },
    starfish: { k: 28, d: 3.5, g: .14, sh: [0, 1.45], el: .1, lg: [-1.4, .55], spin: [1.5, 3.5] } };
  var _v1 = new T.Vector3(), _v2 = new T.Vector3(), _q = new T.Quaternion(), _qi = new T.Quaternion();
  function ragInit(pl, s) { var names = Object.keys(POSES), pn = names[Math.floor(Math.random() * names.length)], P = POSES[pn], ch = pl.children;
    var w = new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(P.spin[0] + Math.random() * (P.spin[1] - P.spin[0]));
    var J = []; function add(o, sd, arm) { if (!o) return; J.push({ o: o, sd: sd, arm: arm, el: arm ? o.children[1] : null, x: o.rotation.x, z: o.rotation.z, vx: 0, vz: 0,
      tx: arm ? P.sh[0] : P.lg[0], tz: sd * (arm ? P.sh[1] : P.lg[1]), r: o.position.clone().add(new T.Vector3(0, arm ? -.15 : -.1, arm ? 0 : -.1)), ph: Math.random() * 6 }); }
    add(ch[2], -1, 1); add(ch[3], 1, 1); add(ch[4], -1, 0); add(ch[5], 1, 0);
    return { P: P, pose: pn, w: w, w0: w.clone(), J: J, head: ch[1], hy: 0, hv: 0 }; }
  function ragStep(it, dt) { var R = it.rag, P = R.P, o = it.o; dt = Math.min(dt, .05);
    R.w.multiplyScalar(1 - .06 * dt); var dw = _v2.copy(R.w).sub(R.w0).divideScalar(dt || 1); R.w0.copy(R.w);
    var wl = R.w.length(); if (wl > 1e-4) { _q.setFromAxisAngle(_v1.copy(R.w).divideScalar(wl), wl * dt); o.quaternion.premultiply(_q); }
    _qi.copy(o.quaternion).invert(); var wL = R.w.clone().applyQuaternion(_qi), aL = dw.applyQuaternion(_qi);
    R.J.forEach(function (j) { var c = _v1.copy(wL).cross(j.r); c.crossVectors(wL, c).negate().sub(new T.Vector3().crossVectors(aL, j.r)); // centrifugal + lag
      var tx = j.tx - c.z * P.g * 6, tz = j.tz + c.x * P.g * 6; tx = Math.max(-2.4, Math.min(2.4, tx)); tz = Math.max(-1.8, Math.min(1.8, tz));
      j.vx += (P.k * (tx - j.x) - P.d * j.vx) * dt; j.vz += (P.k * (tz - j.z) - P.d * j.vz) * dt; j.x += j.vx * dt; j.z += j.vz * dt;
      j.o.rotation.x = j.x; j.o.rotation.z = j.z; if (j.el) j.el.rotation.x = P.el + Math.max(0, j.vx * .08); });
    if (R.head) { R.hv += (-wL.y * .25 - R.hy) * 20 * dt - R.hv * 3 * dt; R.hy += R.hv * dt; R.head.rotation.y = R.hy; R.head.rotation.x = -wL.x * .08; } }
  function wreck(view, sh, s) { var S = view.S, list = view.wrecks || (view.wrecks = []), g = sh.g, sc = g.scale.x, items = [];
    g.updateMatrixWorld(true); var base = s.v ? s.v.clone() : new T.Vector3();
    function fling(o, sp, spin) { var w = new T.Vector3(), q = new T.Quaternion(), sv = new T.Vector3(); o.matrixWorld.decompose(w, q, sv); var c = o.clone(); c.position.copy(w); c.quaternion.copy(q); c.scale.copy(sv); S.add(c);
      var d = w.clone().sub(g.position); if (d.lengthSq() < .01) d.set(Math.random() - .5, Math.random() - .5, Math.random() - .5); d.normalize().multiplyScalar(sp * (.6 + Math.random() * .8)).add(base.clone().multiplyScalar(.4));
      items.push({ o: c, v: d, w: new T.Vector3((Math.random() - .5) * spin, (Math.random() - .5) * spin, (Math.random() - .5) * spin) }); return c; }
    g.children.forEach(function (o) { if (o.name === 'chunk') fling(o, 9, 8); });
    var C = g.userData.cab; if (C) { var pl = fling(C.pilot, 6, 0), it = items[items.length - 1]; it.rag = ragInit(pl, s); }
    list.push({ t: 0, items: items }); if (list.length > 4) { list.shift().items.forEach(function (it) { S.remove(it.o); }); } }
  function wreckStep(view, dt) { var L = view.wrecks; if (!L) return; for (var i = L.length - 1; i >= 0; i--) { var W = L[i]; W.t += dt;
      W.items.forEach(function (it) { it.o.position.addScaledVector(it.v, dt); it.v.multiplyScalar(1 - .15 * dt); if (!it.rag) { it.o.rotation.x += it.w.x * dt; it.o.rotation.y += it.w.y * dt; it.o.rotation.z += it.w.z * dt; }
        if (it.rag) ragStep(it, dt); });
      if (W.t > 7) { W.items.forEach(function (it) { view.S.remove(it.o); }); L.splice(i, 1); } } }
  function pod(col) { if (!GLB) return proxyPod(col); var g = GLB.clone(true), c = new T.Color(col);
    g.traverse(function (m) { if (m.isMesh) m.material = new T.MeshStandardMaterial({ color: m.userData.paint ? c : m.userData.c, roughness: .45, metalness: .3 }); }); var w = new T.Group(); w.add(g); return w; }
  function rockGeo(seed) { var g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position, s = seed; function r() { s = (s * 16807) % 2147483647; return s / 2147483647; }
    var map = {}; for (var i = 0; i < p.count; i++) { var k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3); if (!map[k]) map[k] = .78 + r() * .4; p.setXYZ(i, p.getX(i) * map[k], p.getY(i) * map[k], p.getZ(i) * map[k]); }
    g.computeVertexNormals(); return g; }
  function nebulaTex() { var c = document.createElement('canvas'); c.width = 1024; c.height = 512; var x = c.getContext('2d'); x.fillStyle = '#05040d'; x.fillRect(0, 0, 1024, 512);
    var cols = ['#5a1e8a', '#1e5a8a', '#8a1e5a', '#1e8a7a', '#3a2a9a']; for (var i = 0; i < 70; i++) { var px = Math.random() * 1024, py = 140 + Math.random() * 240, r = 40 + Math.random() * 170, gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, cols[i % 5] + '55'); gr.addColorStop(1, cols[i % 5] + '00'); x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2); if (px < r) { x.save(); x.translate(1024, 0); x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); } }
    for (i = 0; i < 900; i++) { x.fillStyle = 'rgba(255,255,255,' + Math.random() * .8 + ')'; x.fillRect(Math.random() * 1024, Math.random() * 512, 1, 1); }
    var t = new T.CanvasTexture(c); return t; }

  function View(canvas, o) {
    o = o || {}; this.o = o; var phone = !!o.phone;
    var R = this.R = new T.WebGLRenderer({ canvas: canvas, antialias: !phone, powerPreference: 'high-performance' }); if (window.Perf) window.Perf.wrap(R, 'render', 'r'); R.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
    var S = this.S = new T.Scene(); this.cam = new T.PerspectiveCamera(phone ? 72 : 55, 1, .5, 4000);
    S.add(new T.HemisphereLight(0x9ab8ff, 0x2a1438, .9)); var sun = new T.DirectionalLight(0xfff0dd, 1.4); sun.position.set(.6, .8, .3); S.add(sun);
    var sky = new T.Mesh(new T.SphereGeometry(2500, 32, 16), new T.MeshBasicMaterial({ map: nebulaTex(), side: T.BackSide, depthWrite: false, fog: false })); S.add(sky); this.sky = sky;
    var sp = new Float32Array(3 * 1200); for (var i = 0; i < 1200; i++) { var v = new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(1800 + Math.random() * 500); sp.set([v.x, v.y, v.z], i * 3); }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); this.stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })); S.add(this.stars);
    // dust near the camera gives a sense of speed
    var dp = new Float32Array(3 * 300); for (i = 0; i < 900; i++) dp[i] = (Math.random() - .5) * 120; var dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    var sc = document.createElement('canvas'); sc.width = sc.height = 32; var sx = sc.getContext('2d'), sgr = sx.createRadialGradient(16, 16, 0, 16, 16, 16); sgr.addColorStop(0, 'rgba(255,255,255,1)'); sgr.addColorStop(.5, 'rgba(255,255,255,.45)'); sgr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sgr; sx.fillRect(0, 0, 32, 32); this.softTex = new T.CanvasTexture(sc);   /* v0.16 round soft sprite: no more hard squares */
    this.dust = new T.Points(dg, new T.PointsMaterial({ map: this.softTex, color: 0x8899cc, size: .35, transparent: true, opacity: .7, depthWrite: false })); S.add(this.dust);
    // arena edge: faint wire sphere
    this.edge = new T.Mesh(new T.SphereGeometry(420, 24, 12), new T.MeshBasicMaterial({ color: 0x4a7bff, wireframe: true, transparent: true, opacity: .05 })); S.add(this.edge);
    this.rocks = new T.Group(); S.add(this.rocks); this.seed = null;
    this.ships = {}; this.fxPool = []; this.bombPool = [];
    var bmax = 600; this.bmax = bmax; this.bpos = new Float32Array(bmax * 12); var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(this.bpos, 3));
    var bc = new Float32Array(bmax * 12), bi = new Uint16Array(bmax * 6); for (var ci = 0; ci < bmax; ci++) { bc.set([1, 1, .9, 1, 1, .9, .55, .06, .02, .55, .06, .02], ci * 12); bi.set([0, 1, 2, 1, 3, 2].map(function (x) { return x + ci * 4; }), ci * 6); }
    bg.setAttribute('color', new T.BufferAttribute(bc, 3)); bg.setIndex(new T.BufferAttribute(bi, 1));
    this.tracers = new T.Mesh(bg, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    var gc = document.createElement('canvas'); gc.width = gc.height = 64; var gx = gc.getContext('2d'), gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,220,150,.9)'); gr.addColorStop(.6, 'rgba(255,110,40,.3)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64);
    this.hpos = new Float32Array(bmax * 3); var hg = new T.BufferGeometry(); hg.setAttribute('position', new T.BufferAttribute(this.hpos, 3));
    this.heads = new T.Points(hg, new T.PointsMaterial({ map: new T.CanvasTexture(gc), color: 0xffffff, size: 2.6, sizeAttenuation: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.cores = new T.Points(hg, new T.PointsMaterial({ color: 0xfff4d0, size: 3, sizeAttenuation: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.heads.frustumCulled = this.cores.frustumCulled = this.tracers.frustumCulled = false; S.add(this.tracers); S.add(this.heads); S.add(this.cores);
    S.add(this.cam); this.pv = new T.Vector3(); this.st = null; this.me = 0; this.shake = 0;
    var self = this; glbWait.push(function () { Object.keys(self.ships).forEach(function (k) { self.S.remove(self.ships[k].g); }); self.ships = {}; });
  }
  View.prototype.size = function () { var w = innerWidth, h = innerHeight; this.R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); };
  View.prototype.field = function (seed) { if (seed === this.seed) return; this.seed = seed; var g = this.rocks; while (g.children.length) g.remove(g.children[0]);
    var mat = new T.MeshStandardMaterial({ color: 0x8a7f78, roughness: .95, flatShading: true });
  root.Orbit.field(seed).forEach(function (a, i) { var m = new T.Mesh(rockGeo(a.s + 1), mat); m.position.set(a.x, a.y, a.z); m.scale.setScalar(a.r); m.rotation.set(a.s % 7, a.s % 5, a.s % 3); g.add(m); }); };
  // st: { ships:[{id,p,q,col,alive,sh,hit,...}], bul:[[x,y,z,vx,vy,vz]], bombs, fx, dtx (seconds since snapshot, for bullet extrapolation) }
  View.prototype.smoke = function (st) { var T3 = T, N = 360, now = performance.now() / 1000, dt = Math.min(.05, now - (this.smT || now)); this.smT = now;
    if (!this.sm) { var g = new T3.BufferGeometry(); this.smP = new Float32Array(N * 3); this.smC = new Float32Array(N * 3); this.smA = new Float32Array(N).fill(9); this.smV = new Float32Array(N * 3); this.smF = new Uint8Array(N); this.smI = 0;
      g.setAttribute('position', new T3.BufferAttribute(this.smP, 3)); g.setAttribute('color', new T3.BufferAttribute(this.smC, 3));
      this.sm = new T3.Points(g, new T3.PointsMaterial({ map: this.softTex, size: 2.2, vertexColors: true, transparent: true, opacity: .75, depthWrite: false, blending: T3.AdditiveBlending })); this.sm.frustumCulled = false; this.S.add(this.sm); }
    var self = this; st.ships.forEach(function (s) { if (!s.alive || s.hull == null || s.hull >= 75 || s.id === self.hideId) return;   /* v0.16: no smoke from the ship the camera sits in */ var dmg = 1 - s.hull / 75, n = dmg * 40 * dt; n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      for (var j = 0; j < n; j++) { var i = self.smI = (self.smI + 1) % N, fire = s.hull < 35 && Math.random() < (35 - s.hull) / 35 * .7; self.smA[i] = fire ? .45 : 0;
        self.smP[i * 3] = s.p.x + (Math.random() - .5) * 1.5; self.smP[i * 3 + 1] = s.p.y + (Math.random() - .5) * 1.5; self.smP[i * 3 + 2] = s.p.z + (Math.random() - .5) * 1.5;
        self.smV[i * 3] = (Math.random() - .5) * 3; self.smV[i * 3 + 1] = (Math.random() - .5) * 3 + 1; self.smV[i * 3 + 2] = (Math.random() - .5) * 3; self.smF[i] = fire ? 1 : 0; } });
    for (var i = 0; i < N; i++) { var a = this.smA[i] += dt; if (a > 1.2) { this.smC[i * 3] = this.smC[i * 3 + 1] = this.smC[i * 3 + 2] = 0; continue; } var f = this.smF[i], k = 1 - a / 1.2, cq = this.cam.position, qx = this.smP[i * 3] - cq.x, qy = this.smP[i * 3 + 1] - cq.y, qz = this.smP[i * 3 + 2] - cq.z, qd = qx * qx + qy * qy + qz * qz; if (qd < 64) k *= Math.max(0, (Math.sqrt(qd) - 3) / 5);   /* v0.16 fade puffs at point blank */
      for (var c = 0; c < 3; c++) this.smP[i * 3 + c] += this.smV[i * 3 + c] * dt;
      if (f) { this.smC[i * 3] = 1 * k; this.smC[i * 3 + 1] = .45 * k * k; this.smC[i * 3 + 2] = 0; } else { this.smC[i * 3] = this.smC[i * 3 + 1] = this.smC[i * 3 + 2] = .32 * k; } }
    this.sm.geometry.attributes.position.needsUpdate = true; this.sm.geometry.attributes.color.needsUpdate = true; };
  View.prototype.draw = function (st, opt) {
    var S = this.S, self = this, seen = {}; opt = opt || {}; this.field(st.seed);
    st.ships.forEach(function (s) { var sh = self.ships[s.id]; if (!sh || sh.col !== s.col) { if (sh) S.remove(sh.g); sh = self.ships[s.id] = { g: pod(s.col), col: s.col };
        sh.bub = new T.Mesh(new T.SphereGeometry(POD * .75, 16, 10), new T.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); sh.g.add(sh.bub); sh.bub.scale.setScalar(1 / sh.g.scale.x);
        S.add(sh.g); }
      seen[s.id] = 1; if (sh.was && !s.alive && sh.g.visible !== false) wreck(self, sh, s); sh.was = s.alive; sh.g.visible = s.alive && s.id !== opt.hide; if (sh.g.visible && sh.g.userData.cab) { var nb = null, nd = 3600; st.ships.forEach(function (o) { if (o === s || !o.alive) return; var d = o.p.distanceToSquared(s.p); if (d < nd) { nd = d; nb = o.p; } }); animCab(sh, s, nb, opt.inp && s.id === opt.me ? opt.inp : null, self.fdt || 0); } sh.g.position.copy(s.p); sh.g.quaternion.copy(s.q);
      var hit = s.hit && s.sh > 0 ? 1 : 0; if (!sh.fl) { sh.fl = []; sh.g.traverse(function (m) { if (m.userData.flame) sh.fl.push(m); }); } var fk = .8 + Math.random() * .4; sh.fl.forEach(function (m) { m.scale.set(1, fk, 1); }); sh.bub.material.opacity += ((hit ? .45 : 0) - sh.bub.material.opacity) * .3; });
    var nw = performance.now() / 1000; this.fdt = Math.min(.05, nw - (this.fT || nw)); this.fT = nw; wreckStep(this, this.fdt);
    this.hideId = opt.hide || 0; this.smoke(st);   // v0.11 damage smoke -> fire
    Object.keys(this.ships).forEach(function (k) { if (!seen[k]) { S.remove(self.ships[k].g); delete self.ships[k]; } });
    var bp = this.bpos, n = Math.min(st.bul.length, this.bmax), d = st.dtx || 0, cp = this.cam.position, HW = .26, TW = .025, TL = .16; for (var i = 0; i < n; i++) { var b = st.bul[i], x = b[0] + b[3] * d, y = b[1] + b[4] * d, z = b[2] + b[5] * d;
      var vx = b[3], vy = b[4], vz = b[5], tx = x - vx * TL, ty = y - vy * TL, tz = z - vz * TL, ex = cp.x - x, ey = cp.y - y, ez = cp.z - z;   // side = dir x toCam
      var sx = vy * ez - vz * ey, sy = vz * ex - vx * ez, sz = vx * ey - vy * ex, sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      var o = i * 12; bp[o] = x + sx * HW; bp[o + 1] = y + sy * HW; bp[o + 2] = z + sz * HW; bp[o + 3] = x - sx * HW; bp[o + 4] = y - sy * HW; bp[o + 5] = z - sz * HW;
      bp[o + 6] = tx + sx * TW; bp[o + 7] = ty + sy * TW; bp[o + 8] = tz + sz * TW; bp[o + 9] = tx - sx * TW; bp[o + 10] = ty - sy * TW; bp[o + 11] = tz - sz * TW;
      this.hpos[i * 3] = x; this.hpos[i * 3 + 1] = y; this.hpos[i * 3 + 2] = z; }
    this.tracers.geometry.setDrawRange(0, n * 6); this.tracers.geometry.attributes.position.needsUpdate = true; this.heads.geometry.setDrawRange(0, n); this.heads.geometry.attributes.position.needsUpdate = true;
    function pool(arr, k, mk) { while (arr.length <= k) { var m = mk(); S.add(m); arr.push(m); } return arr[k]; }
    var bi = 0; (st.bombs || []).forEach(function (b, j) { var m = pool(self.bombPool, bi++, function () { return new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffd27a })); }); m.visible = true; m.position.set(b[0], b[1], b[2]); m.scale.setScalar(.8 + b[3] + Math.sin(performance.now() / 60) * .2); });
    for (; bi < this.bombPool.length; bi++) this.bombPool[bi].visible = false;
    var fi = 0; (st.fx || []).forEach(function (f) { var m = pool(self.fxPool, fi++, function () { return new T.Mesh(new T.SphereGeometry(1, 16, 10), new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false })); });
      var a = f[5] / f[6]; m.visible = true; m.position.set(f[1], f[2], f[3]); var wv = f[0] === 'wave'; m.scale.setScalar(f[4] * (wv ? .08 + Math.sqrt(a) * .92 : f[0] === 'spark' ? .4 + a : .25 + Math.sqrt(a) * .9)); m.material.color.set(wv ? (a < .1 ? '#ffffff' : '#9fdcff') : a < .15 ? '#ffffff' : f[7]); m.material.opacity = (1 - a) * (wv ? .32 : f[0] === 'spark' ? .9 : .55); if (m.position.distanceTo(self.cam.position) < m.scale.x + 2) m.visible = false; /* v0.16: never fill the screen with a point-blank fx ball */ });
    for (; fi < this.fxPool.length; fi++) this.fxPool[fi].visible = false;
    var c = this.cam.position, dpos = this.dust.geometry.attributes.position.array;   // wrap dust around the camera
    for (i = 0; i < 300; i++) for (var a3 = 0; a3 < 3; a3++) { var v = dpos[i * 3 + a3], cc = a3 === 0 ? c.x : a3 === 1 ? c.y : c.z; if (v - cc > 60) dpos[i * 3 + a3] -= 120; else if (cc - v > 60) dpos[i * 3 + a3] += 120; }
    this.dust.geometry.attributes.position.needsUpdate = true; this.sky.position.copy(c); this.stars.position.copy(c);
    this.R.render(S, this.cam);
  };
  // v0.14 rearview mirror: tiny low-cost second render (scissored) at the top centre, looking out the back of ship s
  View.prototype.mirrorRect = function () { var w = innerWidth, mw = Math.round(Math.max(192, Math.min(340, w * .48))), mh = Math.round(mw * .3) /* v0.16: 4x area */; return { x: Math.round((w - mw) / 2), y: 6, w: mw, h: mh }; };
  View.prototype.mirror = function (s) { var R = this.R, r = this.mirrorRect(), h = innerHeight;
    if (!this.mcam) { this.mcam = new T.PerspectiveCamera(50, 1, .5, 2500); this.mflip = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI); }
    var c = this.mcam; c.aspect = r.w / r.h; c.updateProjectionMatrix(); c.quaternion.copy(s.q).multiply(this.mflip); c.position.copy(s.p).add(new T.Vector3(0, 1.2, 3.2).applyQuaternion(s.q));
    var hv = this.holo && this.holo.visible, pv = this.pit && this.pit.visible; if (this.holo) this.holo.visible = false; if (this.pit) this.pit.visible = false;
    R.setScissorTest(true); R.setScissor(r.x, h - r.y - r.h, r.w, r.h); R.setViewport(r.x, h - r.y - r.h, r.w, r.h); var ps = [], sc = r.h / h; this.S.traverse(function (o) { if (o.isPoints && o.material) { var m = o.material; ps.push([m, m.size]); m.size = m.sizeAttenuation === false ? Math.max(1, m.size * .5) : m.size * sc; } }); /* v0.16: point size uses full canvas height, shrink for mirror */
    R.render(this.S, c); ps.forEach(function (q) { q[0].size = q[1]; });
    R.setScissorTest(false); R.setViewport(0, 0, innerWidth, h); if (this.holo) this.holo.visible = hv; if (this.pit) this.pit.visible = pv; };
  View.prototype.hold = function () { var nw = performance.now() / 1000, dt = Math.min(.05, nw - (this.fT || nw)); this.fT = nw; wreckStep(this, dt); this.R.render(this.S, this.cam); };
  View.prototype.cockpit = function (s, dt, head) {   // first person from ship s; head = optional gyro look (rotates only the camera)
    this.cam.position.copy(s.p); this.cam.quaternion.copy(s.q); if (head) this.cam.quaternion.multiply(head);
    if (!this.pit) this.pitInit(); this.pit.visible = !!head; if (head) { this.pit.position.copy(s.p); this.pit.quaternion.copy(s.q); } if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.5); var k = this.shake * .35; this.cam.position.x += (Math.random() - .5) * k; this.cam.position.y += (Math.random() - .5) * k; this.cam.rotateZ((Math.random() - .5) * k * .05); } };
  View.prototype.chase = function (s, dt, back, up, snap) { var off = new T.Vector3(0, up || 4, back || 16).applyQuaternion(s.q), want = s.p.clone().add(off), k = snap ? 1 : 1 - Math.exp(-5 * dt);
    this.cam.position.lerp(want, k); var look = s.p.clone().add(new T.Vector3(0, 0, -30).applyQuaternion(s.q)); var m = new T.Matrix4().lookAt(this.cam.position, look, new T.Vector3(0, 1, 0).applyQuaternion(s.q)); var q = new T.Quaternion().setFromRotationMatrix(m); this.cam.quaternion.slerp(q, snap ? 1 : 1 - Math.exp(-6 * dt)); };
  View.prototype.look = function (from, at, up, dt, snap) { if (from) { if (snap) this.cam.position.copy(from); else this.cam.position.lerp(from, 1 - Math.exp(-2 * dt)); } var m = new T.Matrix4().lookAt(this.cam.position, at, up || new T.Vector3(0, 1, 0)); var q = new T.Quaternion().setFromRotationMatrix(m); this.cam.quaternion.slerp(q, snap ? 1 : 1 - Math.exp(-4 * dt)); };
  View.prototype.project = function (p) { var v = p.clone().project(this.cam), behind = v.z > 1 || p.clone().sub(this.cam.position).dot(new T.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion)) < 0; return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: behind }; };

  // snapshot -> drawable state; interpolates ships between the last two snapshots
  function Snaps() { this.a = null; this.b = null; this.at = 0; this.gap = .05; this.names = {}; }
  Snaps.prototype.push = function (m) { var now = performance.now() / 1000; if (this.b) this.gap = Math.max(.02, Math.min(.2, this.gap * .8 + (now - this.at) * .2)); this.a = this.b; this.b = m; this.at = now; var N = this.names; (m.n || []).forEach(function (x) { N[x[0]] = { name: x[1], col: x[2] }; }); };
  Snaps.prototype.state = function () { if (!this.b) return null; var now = performance.now() / 1000, u = this.a ? Math.min(1.5, (now - this.at) / this.gap) : 1, A = {}, N = this.names;
    if (this.a) this.a.s.forEach(function (r) { A[r[0]] = r; });
    var ships = this.b.s.map(function (r) { var p = new T.Vector3(r[1], r[2], r[3]), q = new T.Quaternion(r[4], r[5], r[6], r[7]).normalize(), o = A[r[0]];
      if (o && o[10] && r[10]) { var p0 = new T.Vector3(o[1], o[2], o[3]); if (p0.distanceTo(p) < 40) { p0.lerp(p, u); p = p0; var q0 = new T.Quaternion(o[4], o[5], o[6], o[7]).normalize(); q0.slerp(q, Math.min(1, u)); q = q0; } }
      var nm = N[r[0]] || { name: '?', col: '#fff' }; return { id: r[0], p: p, q: q, sh: r[8], hull: r[9], alive: !!r[10], k: r[11], d: r[12], hit: !!r[13], v: new T.Vector3(r[14], r[15], r[16]), bot: !!r[17], sec: r[18], hs: r[19], killer: r[20], launch: !!r[21], en: r[22] == null ? 100 : r[22], lman: r[23] == null ? -1 : r[23], lo: r[24], lcd: r[25] || 0, fire: !!r[26], name: nm.name, col: nm.col }; });
    return { seed: this.b.seed, ships: ships, bul: this.b.b, bombs: this.b.m, fx: this.b.f, feed: this.b.k, time: this.b.tm, over: !!this.b.ov, dtx: Math.min(.2, now - this.at) }; };
  // damage hologram: wireframe of your own pod just above the crosshair, turned to show the side that was hit; 6 shield plates coloured by strength
  var NRM = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0]];
  View.prototype.holoInit = function () { var g = new T.Group(), pd = proxyPod('#7fd8ff', true), self = this; pd.traverse(function (m) { if (m.isMesh) m.material = new T.MeshBasicMaterial({ color: 0x7fe8ff, wireframe: true, transparent: true, opacity: .5, depthTest: false, depthWrite: false }); m.renderOrder = 999; });
    pd.scale.multiplyScalar(1); g.add(pd); this.holoPod = pd; this.plates = NRM.map(function (n) { var m = new T.Mesh(new T.SphereGeometry(3.2, 10, 3, 0, Math.PI * 2, 0, .62), new T.MeshBasicMaterial({ color: 0x5fdc7a, wireframe: true, transparent: true, opacity: .4, depthTest: false, depthWrite: false }));
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(n[0], n[1], n[2])); m.renderOrder = 1000; g.add(m); return m; });
    g.scale.setScalar(.3); g.position.set(0, .95, -7.5); this.cam.add(g); this.holo = g; this.holoA = 0; this.holoT = 9; this.flashT = 9; this.flashK = -1; this.holoQ = new T.Quaternion(); g.visible = false; };
  View.prototype.holoHit = function (k) { if (!this.holo) this.holoInit(); this.holoT = 0; this.flashT = 0; this.flashK = k;
    if (k >= 0) { var n = new T.Vector3().fromArray(NRM[k]), to = new T.Vector3(0, .45, 1).normalize(); this.holoQ.setFromUnitVectors(n, to); if (k === 4 || k === 5) this.holoQ.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), k === 4 ? -.25 : .25)); } };
  View.prototype.holoStep = function (sec, dt, alive) { if (!this.holo) this.holoInit(); var g = this.holo; this.holoT += dt; this.flashT += dt;
    var a = !alive ? 0 : this.holoT < 3 ? 1 : Math.max(0, 1 - (this.holoT - 3)); this.holoA += (a - this.holoA) * Math.min(1, dt * 8); g.visible = this.holoA > .02; if (!g.visible) return;
    g.quaternion.slerp(this.holoQ, Math.min(1, dt * 6)); g.scale.setScalar(.3 * Math.min(1, this.cam.aspect * 1.3)); g.position.y = this.cam.aspect < 1 ? .75 : .95; var A = this.holoA, fl = this.flashT < .4 && Math.floor(this.flashT * 12) % 2 === 0;
    this.holoPod.traverse(function (m) { if (m.isMesh) m.material.opacity = .5 * A; });
    var self = this; this.plates.forEach(function (m, i) { var v = sec ? sec[i] / 100 : 1; if (fl && i === self.flashK) { m.material.color.set('#ffffff'); m.material.opacity = .9 * A; return; }
      m.material.color.setHSL(.33 * v, 1, .55); m.material.opacity = (v > 0 ? .25 + .3 * (1 - v) : .15) * A + (i === self.flashK && self.flashT < 1.5 ? .25 * A : 0); }); };
  // speed cue: short streaks in the camera's own space, flowing past the canopy with your velocity (forward or reverse)
  View.prototype.speed = function (vl, dt, on) { var N = 90, self = this;
    if (!this.sp) { this.spP = new Float32Array(N * 3); for (var i = 0; i < N; i++) this.seedSp(i, true); var g = new T.BufferGeometry(); this.spBuf = new Float32Array(N * 6); g.setAttribute('position', new T.BufferAttribute(this.spBuf, 3));
      this.sp = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); this.sp.frustumCulled = false; this.cam.add(this.sp); }
    var P = this.spP, B = this.spBuf, v = vl.length(), k = Math.min(1, v / 50); this.sp.visible = on && v > 2; this.sp.material.opacity = .15 + .55 * k; if (!this.sp.visible) return;
    for (var j = 0; j < N; j++) { var o = j * 3; P[o] -= vl.x * dt; P[o + 1] -= vl.y * dt; P[o + 2] -= vl.z * dt;
      if (P[o + 2] > 2 || P[o + 2] < -90 || Math.abs(P[o]) > 40 || Math.abs(P[o + 1]) > 40) this.seedSp(j, false, vl);
      var L = .02 + .045 * k; B[j * 6] = P[o]; B[j * 6 + 1] = P[o + 1]; B[j * 6 + 2] = P[o + 2]; B[j * 6 + 3] = P[o] + vl.x * L; B[j * 6 + 4] = P[o + 1] + vl.y * L; B[j * 6 + 5] = P[o + 2] + vl.z * L; }
    this.sp.geometry.attributes.position.needsUpdate = true; this.sp.geometry.setDrawRange(0, Math.round(N * (.3 + .7 * k)) * 2); };
  View.prototype.seedSp = function (j, any, vl) { var P = this.spP, o = j * 3, a = Math.random() * 6.28, r = 3 + Math.random() * 30; P[o] = Math.cos(a) * r; P[o + 1] = Math.sin(a) * r;
    P[o + 2] = any ? -Math.random() * 90 : (vl && vl.z > 0 ? -1 - Math.random() * 4 : -60 - Math.random() * 30); if (vl && vl.z > 0 && !any) P[o + 2] = -Math.random() * 10 - 2; if (vl && vl.z <= 0 && !any) P[o + 2] = -85 + Math.random() * 10; };
  // full 3D cockpit (only with gyro look-around): canopy glass front/sides/overhead, glass floor below the feet, frame struts, dash
  View.prototype.pitInit = function () { var g = new T.Group(), strut = new T.MeshStandardMaterial({ color: 0x2a3348, roughness: .5, metalness: .6, flatShading: true }), dark = new T.MeshStandardMaterial({ color: 0x141a28, roughness: .8 });
    var glass = new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .07, side: T.DoubleSide, depthWrite: false });
    var shell = new T.Mesh(new T.SphereGeometry(2.2, 24, 16), glass); shell.scale.set(1, .85, 1.25); g.add(shell);
    function hoop(z, r, arc, rotZ) { var m = new T.Mesh(new T.TorusGeometry(r, .045, 6, 24, arc), strut); m.position.z = z; m.rotation.z = rotZ; g.add(m); return m; }
    hoop(-1.9, 1.15, Math.PI, 0); hoop(-.2, 1.95, Math.PI * 1.15, -.075 * Math.PI); hoop(1.5, 1.6, Math.PI * 1.2, -.1 * Math.PI);
    var spine = new T.Mesh(new T.TorusGeometry(2.1, .04, 6, 24, Math.PI * .9), strut); spine.rotation.y = Math.PI / 2; spine.rotation.x = 0; spine.position.y = -.3; spine.rotation.z = .05 * Math.PI; g.add(spine);
    [-1, 1].forEach(function (sd) { var r = new T.Mesh(new T.BoxGeometry(.08, .08, 4), strut); r.position.set(sd * 1.75, -.55, 0); g.add(r);
      var con = new T.Mesh(new T.BoxGeometry(.35, .5, 1.4), dark); con.position.set(sd * 1.3, -.95, -.4); g.add(con); });
    var dash = new T.Mesh(new T.BoxGeometry(1.8, .3, .5), dark); dash.position.set(0, -1.25, -1.75); dash.rotation.x = .5; g.add(dash);
    [-.55, 0, .55].forEach(function (x, i) { var sc = new T.Mesh(new T.PlaneGeometry(.36, .18), new T.MeshBasicMaterial({ color: [0x2a7fff, 0x4ef0e0, 0xff9f43][i], transparent: true, opacity: .55 })); sc.position.set(x * .8, -1.08, -1.63); sc.rotation.x = -1.07; g.add(sc); });
    var floor = new T.Mesh(new T.PlaneGeometry(2.6, 3.4), new T.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: .06, side: T.DoubleSide, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.5; g.add(floor);
    var fr = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(2.6, .01, 3.4)), new T.LineBasicMaterial({ color: 0x3a4a6a })); fr.position.y = -1.5; g.add(fr);
    [-.5, .5].forEach(function (x) { var l = new T.Mesh(new T.BoxGeometry(.06, .06, 3.4), strut); l.position.set(x, -1.5, 0); g.add(l); });
    var seat = new T.Mesh(new T.BoxGeometry(1, 1.4, .25), dark); seat.position.set(0, -.6, 1.35); g.add(seat);
    g.traverse(function (m) { m.renderOrder = 2; }); g.visible = false; this.S.add(g); this.pit = g; };
  View.buildPilot = buildPilot; View.proxyPod = proxyPod; View.PILOT0 = PILOT0;
  root.OrbitView = View; root.OrbitSnaps = Snaps;
})(window);
