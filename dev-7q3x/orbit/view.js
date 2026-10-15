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
  function proxyPod(col) {   // simple pod: nose at -Z
    var g = new T.Group(), paint = new T.MeshStandardMaterial({ color: col, roughness: .45, metalness: .3, flatShading: true }), dark = new T.MeshStandardMaterial({ color: 0x252a36, roughness: .6, flatShading: true });
    var body = new T.Mesh(new T.SphereGeometry(.5, 10, 8), paint); body.scale.set(.72, .55, 1.15); g.add(body);
    var can = new T.Mesh(new T.SphereGeometry(.3, 10, 6, 0, 6.3, 0, 1.4), new T.MeshStandardMaterial({ color: 0x9fe6ff, roughness: .1, metalness: .6, emissive: 0x113344 })); can.position.set(0, .2, -.2); can.scale.set(1, .8, 1.4); g.add(can);
    [-1, 1].forEach(function (sd) { var w = new T.Mesh(new T.BoxGeometry(.55, .05, .35), dark); w.position.set(sd * .5, -.05, .2); w.rotation.z = sd * -.25; g.add(w);
      var e = new T.Mesh(new T.CylinderGeometry(.12, .15, .4, 8), dark); e.rotation.x = Math.PI / 2; e.position.set(sd * .32, -.05, .5); g.add(e);
      var gl = new T.Mesh(new T.CircleGeometry(.1, 8), new T.MeshBasicMaterial({ color: 0x7fd8ff })); gl.position.set(sd * .32, -.05, .71); g.add(gl); });
    g.scale.setScalar(POD / 1.15); return g;
  }
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
    var R = this.R = new T.WebGLRenderer({ canvas: canvas, antialias: !phone, powerPreference: 'high-performance' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
    var S = this.S = new T.Scene(); this.cam = new T.PerspectiveCamera(phone ? 72 : 55, 1, .5, 4000);
    S.add(new T.HemisphereLight(0x9ab8ff, 0x2a1438, .9)); var sun = new T.DirectionalLight(0xfff0dd, 1.4); sun.position.set(.6, .8, .3); S.add(sun);
    var sky = new T.Mesh(new T.SphereGeometry(2500, 32, 16), new T.MeshBasicMaterial({ map: nebulaTex(), side: T.BackSide, depthWrite: false, fog: false })); S.add(sky); this.sky = sky;
    var sp = new Float32Array(3 * 1200); for (var i = 0; i < 1200; i++) { var v = new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(1800 + Math.random() * 500); sp.set([v.x, v.y, v.z], i * 3); }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); this.stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })); S.add(this.stars);
    // dust near the camera gives a sense of speed
    var dp = new Float32Array(3 * 300); for (i = 0; i < 900; i++) dp[i] = (Math.random() - .5) * 120; var dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    this.dust = new T.Points(dg, new T.PointsMaterial({ color: 0x8899cc, size: .35, transparent: true, opacity: .7 })); S.add(this.dust);
    // arena edge: faint wire sphere
    this.edge = new T.Mesh(new T.SphereGeometry(420, 24, 12), new T.MeshBasicMaterial({ color: 0x4a7bff, wireframe: true, transparent: true, opacity: .05 })); S.add(this.edge);
    this.rocks = new T.Group(); S.add(this.rocks); this.seed = null;
    this.ships = {}; this.fxPool = []; this.bombPool = [];
    var bmax = 600; this.bpos = new Float32Array(bmax * 6); var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(this.bpos, 3));
    this.tracers = new T.LineSegments(bg, new T.LineBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: .95, blending: T.AdditiveBlending })); this.tracers.frustumCulled = false; S.add(this.tracers);
    this.pv = new T.Vector3(); this.st = null; this.me = 0; this.shake = 0;
    var self = this; glbWait.push(function () { Object.keys(self.ships).forEach(function (k) { self.S.remove(self.ships[k].g); }); self.ships = {}; });
  }
  View.prototype.size = function () { var w = innerWidth, h = innerHeight; this.R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); };
  View.prototype.field = function (seed) { if (seed === this.seed) return; this.seed = seed; var g = this.rocks; while (g.children.length) g.remove(g.children[0]);
    var mat = new T.MeshStandardMaterial({ color: 0x8a7f78, roughness: .95, flatShading: true });
    root.Orbit.field(seed).forEach(function (a, i) { var m = new T.Mesh(rockGeo(a.s + 1), mat); m.position.set(a.x, a.y, a.z); m.scale.setScalar(a.r); m.rotation.set(a.s % 7, a.s % 5, a.s % 3); g.add(m); }); };
  // st: { ships:[{id,p,q,col,alive,sh,hit,...}], bul:[[x,y,z,vx,vy,vz]], bombs, fx, dtx (seconds since snapshot, for bullet extrapolation) }
  View.prototype.draw = function (st, opt) {
    var S = this.S, self = this, seen = {}; opt = opt || {}; this.field(st.seed);
    st.ships.forEach(function (s) { var sh = self.ships[s.id]; if (!sh || sh.col !== s.col) { if (sh) S.remove(sh.g); sh = self.ships[s.id] = { g: pod(s.col), col: s.col };
        sh.bub = new T.Mesh(new T.SphereGeometry(POD * .75, 16, 10), new T.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); sh.g.add(sh.bub); sh.bub.scale.setScalar(1 / sh.g.scale.x);
        S.add(sh.g); }
      seen[s.id] = 1; sh.g.visible = s.alive && s.id !== opt.hide; sh.g.position.copy(s.p); sh.g.quaternion.copy(s.q);
      var hit = s.hit && s.sh > 0 ? 1 : 0; sh.bub.material.opacity += ((hit ? .45 : 0) - sh.bub.material.opacity) * .3; });
    Object.keys(this.ships).forEach(function (k) { if (!seen[k]) { S.remove(self.ships[k].g); delete self.ships[k]; } });
    var bp = this.bpos, n = Math.min(st.bul.length, 600), d = st.dtx || 0; for (var i = 0; i < n; i++) { var b = st.bul[i], x = b[0] + b[3] * d, y = b[1] + b[4] * d, z = b[2] + b[5] * d; bp[i * 6] = x; bp[i * 6 + 1] = y; bp[i * 6 + 2] = z; bp[i * 6 + 3] = x - b[3] * .035; bp[i * 6 + 4] = y - b[4] * .035; bp[i * 6 + 5] = z - b[5] * .035; }
    this.tracers.geometry.setDrawRange(0, n * 2); this.tracers.geometry.attributes.position.needsUpdate = true;
    function pool(arr, k, mk) { while (arr.length <= k) { var m = mk(); S.add(m); arr.push(m); } return arr[k]; }
    var bi = 0; (st.bombs || []).forEach(function (b, j) { var m = pool(self.bombPool, bi++, function () { return new T.Mesh(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffd27a })); }); m.visible = true; m.position.set(b[0], b[1], b[2]); m.scale.setScalar(.8 + b[3] + Math.sin(performance.now() / 60) * .2); });
    for (; bi < this.bombPool.length; bi++) this.bombPool[bi].visible = false;
    var fi = 0; (st.fx || []).forEach(function (f) { var m = pool(self.fxPool, fi++, function () { return new T.Mesh(new T.SphereGeometry(1, 16, 10), new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false })); });
      var a = f[5] / f[6]; m.visible = true; m.position.set(f[1], f[2], f[3]); m.scale.setScalar(f[4] * (f[0] === 'spark' ? .4 + a : .25 + Math.sqrt(a) * .9)); m.material.color.set(a < .15 ? '#ffffff' : f[7]); m.material.opacity = (1 - a) * (f[0] === 'spark' ? .9 : .55); });
    for (; fi < this.fxPool.length; fi++) this.fxPool[fi].visible = false;
    var c = this.cam.position, dpos = this.dust.geometry.attributes.position.array;   // wrap dust around the camera
    for (i = 0; i < 300; i++) for (var a3 = 0; a3 < 3; a3++) { var v = dpos[i * 3 + a3], cc = a3 === 0 ? c.x : a3 === 1 ? c.y : c.z; if (v - cc > 60) dpos[i * 3 + a3] -= 120; else if (cc - v > 60) dpos[i * 3 + a3] += 120; }
    this.dust.geometry.attributes.position.needsUpdate = true; this.sky.position.copy(c); this.stars.position.copy(c);
    this.R.render(S, this.cam);
  };
  View.prototype.cockpit = function (s, dt) {   // first person from ship s
    this.cam.position.copy(s.p); this.cam.quaternion.copy(s.q); if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.5); var k = this.shake * .35; this.cam.position.x += (Math.random() - .5) * k; this.cam.position.y += (Math.random() - .5) * k; this.cam.rotateZ((Math.random() - .5) * k * .05); } };
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
      var nm = N[r[0]] || { name: '?', col: '#fff' }; return { id: r[0], p: p, q: q, sh: r[8], hull: r[9], alive: !!r[10], k: r[11], d: r[12], hit: !!r[13], v: new T.Vector3(r[14], r[15], r[16]), bot: !!r[17], name: nm.name, col: nm.col }; });
    return { seed: this.b.seed, ships: ships, bul: this.b.b, bombs: this.b.m, fx: this.b.f, feed: this.b.k, time: this.b.tm, over: !!this.b.ov, dtx: Math.min(.2, now - this.at) }; };
  root.OrbitView = View; root.OrbitSnaps = Snaps;
})(window);
