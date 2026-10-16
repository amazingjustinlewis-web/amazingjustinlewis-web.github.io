/* BUBBLE HOCKEY v0.4 - Three.js renderer. Gameplay/physics stay 2D (sim.js). The 2D View (view.js) still owns the
   screen<->rink mapping for touches; the default orthographic top-down camera is built from that same mapping, so it
   looks exactly like the old 2D view. Rink coords (x across 0..1, y along 0..L, h up) -> group-local (y, h, x).
   Phones mirror the group (scale.z = -1) because the portrait mapping is a reflection of the landscape one.
   Goals: fireworks + banner + crowd flash, then a cinematic replay of recorded history (low tracking cam, ice-level
   side cam and net-cam at ~20% speed), then back to top-down for the faceoff serve. */
(function (root) {
  'use strict';
  var B = root.Bubble, COLS = [0xff5a6e, 0x3aa8ff], L = B.L;
  function R3(canvas, V, opt) {
    opt = opt || {}; this.V = V; this.phone = !!opt.phone; this.cv = canvas;
    var g = this.gl = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); g.setPixelRatio(Math.min(2, devicePixelRatio || 1)); g.setClearColor(0x0c1226);
    var sc = this.scene = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, .55)); var dl = new THREE.DirectionalLight(0xffffff, .55); dl.position.set(.6, 3, 1.2); sc.add(dl);
    var G = this.G = new THREE.Group(); sc.add(G); if (this.phone) G.scale.z = -1;
    this.ortho = new THREE.OrthographicCamera(0, 1, 0, -1, .01, 50); this.persp = new THREE.PerspectiveCamera(52, 1, .005, 40);
    this.build(); this.hist = []; this.clock = 0; this.rep = null; this.sc = null; this.fw = []; this.trail = [];
    this.dom(); this.held = -1;
  }
  function L3(x, y, h) { return new THREE.Vector3(y, h || 0, x); }   // rink -> group-local
  R3.prototype.build = function () {
    var G = this.G, mat = function (c, o) { return new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); };
    // ice texture: markings, track grooves, serve slot
    var CW = 2048, CH = 1024, cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; var c = cv.getContext('2d');
    var P = function (x, y) { return [y / L * CW, x * CH]; }, S = CH;
    var gr = c.createLinearGradient(0, 0, CW, 0); gr.addColorStop(0, '#e3ecf7'); gr.addColorStop(.5, '#f5f9fd'); gr.addColorStop(1, '#e3ecf7'); c.fillStyle = gr; c.fillRect(0, 0, CW, CH);
    function ln(a, b, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    ln(P(0, L / 2), P(1, L / 2), '#d8344c', S * .012); [B.BL, L - B.BL].forEach(function (y) { ln(P(0, y), P(1, y), '#2f6fd1', S * .016); }); [B.GY, L - B.GY].forEach(function (y) { ln(P(0, y), P(1, y), '#d8344c', S * .005); });
    var m = P(.5, L / 2); c.strokeStyle = '#2f6fd1'; c.lineWidth = S * .005; c.beginPath(); c.arc(m[0], m[1], S * .1, 0, 7); c.stroke();
    [[.25, .36], [.75, .36], [.25, L - .36], [.75, L - .36]].forEach(function (f) { var q = P(f[0], f[1]); c.strokeStyle = '#d8344c88'; c.beginPath(); c.arc(q[0], q[1], S * .075, 0, 7); c.stroke(); c.fillStyle = '#d8344c'; c.beginPath(); c.arc(q[0], q[1], S * .008, 0, 7); c.fill(); });
    [B.GY, L - B.GY].forEach(function (y, k) { var q = P(.5, y); c.fillStyle = '#5aa0ff44'; c.beginPath(); c.arc(q[0], q[1], S * B.GW * 1.2, k ? Math.PI / 2 : -Math.PI / 2, k ? Math.PI * 1.5 : Math.PI / 2); c.fill(); });
    c.lineCap = 'round'; c.lineJoin = 'round'; B.TR.forEach(function (tr) { function path(col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); tr.p.forEach(function (q, k) { var Q = P(q[0], q[1]); if (k) c.lineTo(Q[0], Q[1]); else c.moveTo(Q[0], Q[1]); }); c.stroke(); }
      path('#c3ccd6aa', S * .017); path('#3a4558aa', S * .008); });
    var sw = S * .016, sl = S * .08; m = [Math.round(L / 2 / L * CW), Math.round(.5 * CH)]; c.fillStyle = '#aab3bf'; c.fillRect(m[0] - sw / 2 - 3, m[1] - sl / 2 - 3, sw + 6, sl + 6); c.fillStyle = '#05070c'; c.fillRect(m[0] - sw / 2, m[1] - sl / 2, sw, sl);
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    var ice = new THREE.Mesh(new THREE.PlaneGeometry(L, 1), new THREE.MeshLambertMaterial({ map: tex })); ice.rotation.x = -Math.PI / 2; ice.position.set(L / 2, 0, .5); G.add(ice);
    // boards (rounded rect ring) + yellow kickplate + cabinet
    function rr(w, h, r, x, y) { var s = new THREE.Shape(); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
    function ring(pad, th, hgt, col, y0) { var o = rr(L + 2 * (pad + th), 1 + 2 * (pad + th), .14 + pad + th, -pad - th, -pad - th), hole = rr(L + 2 * pad, 1 + 2 * pad, .12 + pad, -pad, -pad); o.holes.push(hole);
      var geo = new THREE.ExtrudeGeometry(o, { depth: hgt, bevelEnabled: false }), me = new THREE.Mesh(geo, mat(col)); me.rotation.x = Math.PI / 2; me.position.y = y0 + hgt; G.add(me); return me; }
    ring(0, .03, .07, 0xf6f8fb, 0); ring(-.004, .012, .018, 0xf2c230, 0); ring(.03, .1, .02, 0x24356a, -.0);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(L + .5, .3, 1.5), mat(0x18244a)); cab.position.set(L / 2, -.16, .5); G.add(cab);
    // nets: red frame + translucent mesh box
    var self = this; this.nets = [];
    [[B.GY, -1], [L - B.GY, 1]].forEach(function (gq) { var n = new THREE.Group(), red = mat(0xd8344c), d = .05 * gq[1], hh = .045;
      [-B.GW, B.GW].forEach(function (z) { var post = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, hh, 8), red); post.position.set(0, hh / 2, z); n.add(post); });
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, B.GW * 2, 8), red); bar.rotation.x = Math.PI / 2; bar.position.set(0, hh, 0); n.add(bar);
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(d), hh, B.GW * 2), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .35, side: THREE.DoubleSide })); mesh.position.set(d / 2, hh / 2, 0); n.add(mesh);
      var lt = new THREE.Group(), dome = new THREE.Mesh(new THREE.SphereGeometry(.009, 12, 8, 0, 7, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x551018 })), base = new THREE.Mesh(new THREE.CylinderGeometry(.008, .009, .004, 12), mat(0x222222));
      base.position.y = .002; dome.position.y = .004; lt.add(base); lt.add(dome); var spin = new THREE.Group(); spin.position.y = .008; lt.add(spin);
      [0, Math.PI].forEach(function (a) { var bm = new THREE.Mesh(new THREE.PlaneGeometry(.2, .07), new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide })); var bh = new THREE.Group(); bh.rotation.y = a; bm.rotation.x = -Math.PI / 2 + .35; bm.position.set(.1, 0, 0); bh.add(bm); spin.add(bh); });
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex('rgba(255,40,40,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending })); halo.scale.set(.11, .11, 1); halo.position.y = .008; lt.add(halo);
      lt.position.set(d * .6, hh + .004, 0); n.add(lt); n.userData.light = { dome: dome, spin: spin, halo: halo, t: 0 };
      n.position.copy(L3(.5, gq[0])); G.add(n); self.nets.push(n); });
    // players: solid team-colour cylinders + stick + blade; blob shadow
    this.pl = B.TR.map(function (tr) { var p = new THREE.Group(); man(p, COLS[tr.t], tr.k === 'G');
      var len = B.R * .5 + tr.sl * .25, st = new THREE.Mesh(new THREE.BoxGeometry(len, .008, .009), mat(0x5a3a1c)); st.position.set(len / 2, .012, 0); p.add(st);
      var bl = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .03), mat(0x111111)); bl.position.set(len, .008, -.008); p.add(bl);
      var sh = new THREE.Mesh(new THREE.CircleGeometry(B.R * .62, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .18 })); sh.rotation.x = -Math.PI / 2; sh.position.set(.006, .001, .006); p.add(sh);
      p.userData.stick = st; p.userData.blade = bl; p.userData.len = len;
      // controller ring in the grabbing person's colour; the gap inside it (body edge to inner radius) is kept free for a future health ring
      var rg = new THREE.Mesh(new THREE.RingGeometry(B.R * .85, B.R * 1.05, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthWrite: false })); rg.rotation.x = -Math.PI / 2; rg.position.y = .0025; rg.visible = false; p.add(rg); p.userData.ring = rg; G.add(p); return p; });
    var pk = this.puck = new THREE.Mesh(new THREE.CylinderGeometry(B.PR, B.PR, .012, 20), mat(0x111111)); G.add(pk);
    var gm = new THREE.SpriteMaterial({ map: dotTex('rgba(150,220,255,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }); this.glow = new THREE.Sprite(gm); this.glow.scale.set(.09, .09, 1); G.add(this.glow);
    // trail + fireworks + held-player particles share one Points buffer
    this.NP = 900; var pg = new THREE.BufferGeometry(); this.pPos = new Float32Array(this.NP * 3); this.pCol = new Float32Array(this.NP * 3); pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .018, vertexColors: true, map: dotTex('#fff'), transparent: true, depthWrite: false })); this.pts.frustumCulled = false; G.add(this.pts); this.parts = [];
    this.NF = this.phone ? 140 : 700; var fg = new THREE.BufferGeometry(); this.fPos = new Float32Array(this.NF * 3); this.fCol = new Float32Array(this.NF * 3); fg.setAttribute('position', new THREE.BufferAttribute(this.fPos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(this.fCol, 3));
    this.fpts = new THREE.Points(fg, new THREE.PointsMaterial({ size: .02, vertexColors: true, map: dotTex('#fff'), transparent: true, depthWrite: false })); this.fpts.frustumCulled = false; G.add(this.fpts); this.fl = []; this.fsp = 0;
  };
  // simple beefy proxy skater: radius ~B.R/2, height .05 (legs, pants, jersey torso, shoulders, helmet head). Goalie gets pads.
  function man(p, col, goalie, opa) { var M = function (c) { return new THREE.MeshLambertMaterial(opa ? { color: c, transparent: true, opacity: opa, depthWrite: false } : { color: c }); }, r = B.R * .5, dark = M(0x1a1d26), jer = M(col);
    [-1, 1].forEach(function (sd) { var lg = new THREE.Mesh(new THREE.BoxGeometry(r * .55, .018, r * (goalie ? .8 : .55)), goalie ? M(0xeeeeee) : dark); lg.position.set(0, .009, sd * r * .45); p.add(lg); });
    var pant = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r * .8, .008, 14), dark); pant.position.y = .022; p.add(pant);
    var tor = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * .85, .016, 14), jer); tor.position.y = .034; p.add(tor);
    var sh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.0, 14, 8, 0, 7, 0, Math.PI / 2), jer); sh.scale.y = .45; sh.position.y = .042; p.add(sh);
    var hd = new THREE.Mesh(new THREE.SphereGeometry(r * .5, 12, 10), M(goalie ? 0xf2f2f2 : 0x20242e)); hd.position.y = .05 - r * .45; p.add(hd);
    var arm = new THREE.Group(), ab = new THREE.Mesh(new THREE.BoxGeometry(r * .45, .022, r * .45), jer), gl = new THREE.Mesh(new THREE.SphereGeometry(r * .42, 8, 6), dark); ab.position.y = .011; gl.position.y = .024; arm.add(ab); arm.add(gl); arm.position.set(0, .042, -r * .95); arm.visible = false; p.add(arm); p.userData.arm = arm;
    return p; }
  function beamTex() { var c = document.createElement('canvas'); c.width = 128; c.height = 32; var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 14); x.lineTo(128, 0); x.lineTo(128, 32); x.lineTo(0, 18); x.fill(); return new THREE.CanvasTexture(c); }
  function dotTex(col) { var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  R3.prototype.dom = function () {
    var d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden';
    d.innerHTML = '<div class="b3flash" style="position:absolute;inset:0;opacity:0;background:radial-gradient(circle,#fff,#fff0 70%)"></div><div class="b3ban" style="position:absolute;left:0;right:0;top:38%;text-align:center;font:700 16vmin Fredoka,sans-serif;opacity:0;-webkit-text-stroke:3px #0008"></div>' +
      '<div class="b3rep" style="position:absolute;left:3vw;top:3vh;font:700 3.6vmin Fredoka,sans-serif;color:#fff;background:#d8344c;padding:.3em .8em;border-radius:.4em;opacity:0">\u25CF INSTANT REPLAY <span style="font-weight:400;opacity:.8;font-size:.7em">\u00b7 tap to skip</span></div><div class="b3bars" style="position:absolute;inset:0;opacity:0;box-shadow:inset 0 9vh 0 #000,inset 0 -9vh 0 #000"></div>';
    document.body.appendChild(d); this.d = d; this.flashes = [];
  };
  // breakaway: carrier with no skater (goalie excluded) between him and the net within BREAK.dist. Camera eases toward that end.
  var BREAK_ZOOM_PCT = 100;   // Justin: scale the breakaway zoom by percent (0 = off, 100 = default gentle, 200 = double)
  var BREAK = { dist: .95, lane: .14 };
  R3.prototype.breakaway = function (st) { var i = st.c, t = i < 6 ? 0 : 1, q = B.pos(B.TR[i], st.u[i]), gy = t ? L - B.GY : B.GY, dy = gy - q[1]; if (Math.abs(dy) > BREAK.dist || Math.hypot(.5 - q[0], dy) > BREAK.dist) return null;
    for (var j = (1 - t) * 6; j < (1 - t) * 6 + 6; j++) { if (B.TR[j].k === 'G') continue; var p = B.pos(B.TR[j], st.u[j]); if (st.o) p = [p[0] + st.o[j][0], p[1] + st.o[j][1]]; var f = (p[1] - q[1]) / dy; if (f <= 0 || f >= 1) continue; var lx = q[0] + (.5 - q[0]) * f; if (Math.abs(p[0] - lx) < BREAK.lane) return null; }
    return [.5, gy]; };
  // small edge markers for players pushed off-screen by the zoom; smaller the further away
  R3.prototype.markers = function (cam, on) { if (!this.mk) { this.mk = []; for (var i = 0; i < 12; i++) { var d = document.createElement('div'); d.style.cssText = 'position:absolute;border-radius:50%;pointer-events:none;z-index:3;border:2px solid #fff;display:none;transform:translate(-50%,-50%)'; d.style.background = '#' + (i < 6 ? 'ff5a6e' : '3aa8ff'); this.d.appendChild(d); this.mk.push(d); } }
    var W = this.cv.clientWidth, H = this.cv.clientHeight, v = new THREE.Vector3();
    for (i = 0; i < 12; i++) { var m = this.mk[i]; if (!on) { m.style.display = 'none'; continue; } this.pl[i].getWorldPosition(v); v.project(cam); var ax = Math.abs(v.x), ay = Math.abs(v.y), out = Math.max(ax, ay); if (out <= 1) { m.style.display = 'none'; continue; }
      var k = .96 / out, sz = Math.max(5, 16 / (1 + (out - 1) * 3)); m.style.display = 'block'; m.style.width = m.style.height = sz + 'px'; m.style.left = ((v.x * k + 1) / 2 * W) + 'px'; m.style.top = ((1 - v.y * k) / 2 * H) + 'px'; m.style.opacity = .85; } };
  var PHONE_ZIP = 7;   // phones: zip-zoom rate, same in and out for replays and live moments (exponential: fast, then a slow taper)
  var PHONE_MO_ZOOM = 1.4;   // phones: extra top-down zoom at full slow-mo (1.4 = 2.4x)
  R3.prototype.setTop = function (st, dt) {   // orthographic camera that reproduces the 2D View mapping exactly
    var V = this.V, W = this.cv.clientWidth, H = this.cv.clientHeight, a = V.s2w(0, 0), bx = V.s2w(1, 0), by = V.s2w(0, -1), cam = this.ortho, G = this.G;
    var o = G.localToWorld(L3(a[0], a[1], 5)), right = G.localToWorld(L3(bx[0], bx[1], 5)).sub(o).normalize(), up = G.localToWorld(L3(by[0], by[1], 5)).sub(o).normalize();
    cam.position.copy(o); cam.up.copy(up); cam.lookAt(o.clone().add(new THREE.Vector3(0, -1, 0))); cam.left = 0; cam.right = W / V.s; cam.top = 0; cam.bottom = -H / V.s;
    // action camera (TV): tighten slowly on a held puck, open back out quickly on release
    var z = this.az || 1; if (st) { var held = st.c >= 0 && !(st.pz > 0) && !this.rep, bk = held ? this.breakaway(st) : null; this.bk = (this.bk || 0) + ((bk ? 1 : 0) - (this.bk || 0)) * Math.min(1, dt * (bk ? 1.5 : 4));
      var zt = held ? 1.45 + (BREAK_ZOOM_PCT / 100 * .1) * this.bk : 1; z += zt > z ? (zt - z) * (1 - Math.exp(-dt * (.55 + this.bk))) : (zt - z) * (1 - Math.exp(-dt * 6));
      if (held) { var fx = st.p[0], fy = st.p[1]; if (bk) { fx += (.5 - fx) * .3 * this.bk; fy += (bk[1] - fy) * .25 * this.bk; } var fs = V.w2s(fx, fy); this.af = this.af ? [this.af[0] + (fs[0] - this.af[0]) * Math.min(1, dt * 3), this.af[1] + (fs[1] - this.af[1]) * Math.min(1, dt * 3)] : fs; } }
    else if (this.phone && this.pzc > .002 && this.pmoPt) { z = 1 + this.pzc * PHONE_MO_ZOOM; this.af = V.w2s(this.pmoPt[0], this.pmoPt[1]); } else z = 1; this.az = z;
    if (z > 1.001 && this.af) { var k = (z - 1) / .45 * .7, px2 = (this.af[0] - W / 2) * k, py2 = (this.af[1] - H / 2) * k, c1 = V.w2s(-.07, -.07), c2 = V.w2s(1.07, L + .07);
      // keep the zoomed window over the rink (no panning out past the boards)
      var x0 = Math.min(c1[0], c2[0]), x1 = Math.max(c1[0], c2[0]), y0 = Math.min(c1[1], c2[1]), y1 = Math.max(c1[1], c2[1]), hw = W / 2 / z, hh = H / 2 / z;
      var cx = W / 2 + px2, cy = H / 2 + py2; cx = x1 - x0 > 2 * hw ? Math.max(x0 + hw, Math.min(x1 - hw, cx)) : (x0 + x1) / 2; cy = y1 - y0 > 2 * hh ? Math.max(y0 + hh, Math.min(y1 - hh, cy)) : (y0 + y1) / 2;
      var dx = (cx - W / 2) / V.s, dy = (cy - H / 2) / V.s; cam.position.addScaledVector(right, dx).addScaledVector(up, -dy); }
    cam.zoom = z; cam.updateProjectionMatrix(); return cam;
  };
  var AC = null; function buzz() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); var t = AC.currentTime, o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.value = 196; o2.type = 'square'; o2.frequency.value = 203; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .03); g.gain.setValueAtTime(.18, t + .42); g.gain.linearRampToValueAtTime(0, t + .5);
      o.connect(g); o2.connect(g); g.connect(AC.destination); o.start(t); o2.start(t); o.stop(t + .52); o2.stop(t + .52); } catch (e) {} }
  root.BubbleBuzz = buzz;
  function lerp(a, b, k) { return a + (b - a) * k; }
  function frameAt(F, t) { var i = 1; while (i < F.length - 1 && F[i].t < t) i++; var a = F[i - 1], b = F[i], k = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
    return { p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k)], u: a.u.map(function (v, j) { return lerp(v, b.u[j], k); }), o: a.o.map(function (v, j) { return [lerp(v[0], b.o[j][0], k), lerp(v[1], b.o[j][1], k)]; }),
      a: a.a.map(function (v, j) { return v + Math.atan2(Math.sin(b.a[j] - v), Math.cos(b.a[j] - v)) * k; }), c: k < .5 ? a.c : b.c, gc: (k < .5 ? a : b).gc, z: lerp(a.z || 0, b.z || 0, k), pz: 0 }; }
  var SPRING_W = 160;   // visual smoothing stiffness (rad/s); higher = tighter. ~6 ms time constant: lag ~2v/W, about .012 at a fast 1 rink-width/s
  var REP_TAIL = .4;   // each replay angle holds ~0.4 s on its last frame
  R3.prototype.place = function (st) { this.spr = this.spr || [];
    for (var i = 0; i < 12; i++) { var tr = B.TR[i], q = B.pos(tr, st.u[i]), o = st.o ? st.o[i] : [0, 0], p = this.pl[i], an = st.a ? st.a[i] : 0;
      var tg = L3(q[0] + o[0], q[1] + o[1], 0), sp = this.spr[i], h = this._dt || 0;   // visual-only critically damped spring (sim keeps true positions)
      if (!sp || h <= 0 || Math.hypot(sp.x - tg.x, sp.z - tg.z) > .15) sp = this.spr[i] = { x: tg.x, z: tg.z, vx: 0, vz: 0 };
      else { var ex = Math.exp(-SPRING_W * h), e1 = sp.x - tg.x, j1 = sp.vx + SPRING_W * e1, e2 = sp.z - tg.z, j2 = sp.vz + SPRING_W * e2; sp.x = tg.x + (e1 + j1 * h) * ex; sp.vx = (sp.vx - j1 * SPRING_W * h) * ex; sp.z = tg.z + (e2 + j2 * h) * ex; sp.vz = (sp.vz - j2 * SPRING_W * h) * ex; }
      p.position.set(sp.x, 0, sp.z); var rgc = st.gc && st.gc[i]; p.userData.ring.visible = !!rgc; if (rgc) p.userData.ring.material.color.set(rgc); p.rotation.set(0, Math.atan2(-Math.cos(an), Math.sin(an)), 0); p.userData.stick.material.color.setHex(st.sw === i ? 0xffffff : 0x5a3a1c);
      var lnv = st.ln ? st.ln[i] : 0, dnv = st.dn ? st.dn[i] : 0, sk = p.userData.stick, bl = p.userData.blade, ln0 = p.userData.len, ext = 1 + Math.min(1, lnv / .3) * 2.2;   // snag/check lunge: lean in, stick shoots out
      sk.scale.x = ext; sk.position.x = ln0 * ext / 2; bl.position.x = ln0 * ext; p.position.y = 0;
      if (dnv > 0) { var tt = 1.5 - dnv, lie = tt < .25 ? tt / .25 : dnv < .45 ? dnv / .45 : 1; p.userData.spin = (p.userData.spin || (Math.random() - .5) * 16); p.rotateY(p.userData.spin * Math.max(0, 1 - tt) * .05); p.rotateZ(lie * Math.PI / 2 * .92); p.position.y = lie * .01 + Math.abs(Math.sin(tt * 9)) * .006 * Math.max(0, 1 - tt * 2); }
      else { p.userData.spin = 0; if (lnv > 0) p.rotateZ(-Math.min(1, lnv / .3) * .55); } }
    var pz = st.pz || 0, h = 0, px = st.p[0], py = st.p[1]; this.puck.visible = !(pz > 0) || !!st.pg;   // faceoff: hidden in the slot until it launches
    if (st.z) h = st.z; this.puck.position.copy(L3(px, py, .006 + h)); var gs = 1 + h * 7; this.puck.scale.set(gs, 1, gs);
    if (!this.pshad) { this.pshad = new THREE.Mesh(new THREE.CircleGeometry(B.PR, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, depthWrite: false })); this.pshad.rotation.x = -Math.PI / 2; this.G.add(this.pshad); }
    this.pshad.position.copy(L3(px + h * .45, py + h * .3, .0015)); this.pshad.scale.setScalar(1 + h * 2.5); this.pshad.material.opacity = this.puck.visible && h > .004 ? Math.max(.22, .5 - h * 1.6) : 0;
    // proxy glove grab: players near an airborne puck lean in and reach up
    for (var gi = 0; gi < 12; gi++) { var pl = this.pl[gi], q0 = pl.position, dd = Math.hypot(q0.z - px, q0.x - py), reach = this.puck.visible && h > .02 && st.c < 0 && !(st.dn && st.dn[gi] > 0) ? Math.max(0, 1 - dd / .16) : 0, arm = pl.userData.arm;
      arm.visible = reach > 0; if (reach > 0) { pl.rotateZ(-reach * .3); arm.rotation.set(0, 0, -.5 + reach * .3); arm.scale.y = 1 + reach * .8; } } return [px, py];
  };
  R3.prototype.emit = function (x, y, h, n, col, spd, life, grav) { for (var k = 0; k < n && this.parts.length < this.NP; k++) { var a = Math.random() * 7, e = Math.random() * 1.4 - .2, v = spd * (.4 + Math.random() * .6);
      this.parts.push({ p: L3(x, y, h), v: new THREE.Vector3(Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + (grav ? spd * .3 : 0), Math.sin(a) * Math.cos(e) * v), c: new THREE.Color(col), l: life * (.6 + Math.random() * .5), l0: life, g: grav || 0 }); } };
  R3.prototype.render = function (st, dt, opt) {
    opt = opt || {}; this.clock += dt; var W = this.cv.clientWidth, H = this.cv.clientHeight; if (this.W !== W || this.H !== H) { this.W = W; this.H = H; this.gl.setSize(W, H, false); }
    // record history (skip while paused)
    if (!this.rep && (!(st.pz > 0) || st.pg)) { this.hist.push({ t: this.clock, p: st.p.slice(), u: st.u.slice(), o: (st.o || st.u.map(function () { return [0, 0]; })).map(function (q) { return q.slice(); }), a: (st.a || st.u.map(function () { return 0; })).slice(), c: st.c, z: st.z || 0, gc: st.gc ? st.gc.slice() : null });
      while (this.hist.length && this.hist[0].t < this.clock - 5) this.hist.shift(); }
    // buzzer right before the puck is spat out (pz counts down; pop starts at .55)
    if (st.pz > .02 && st.pz < .5 && !this.buzzed) { this.buzzed = true; buzz(); } if (!(st.pz > 0)) this.buzzed = false;
    // tap-to-skip: the sim cut the pause short, so end the replay too
    if (this.rep && st.pz > 0 && st.pz < 1.1) { this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3bars').style.opacity = 0; this.d.querySelector('.b3ban').style.opacity = 0; this.d.querySelector('.b3flash').style.opacity = 0; }
    // goal detection by score change (works on remote phones too)
    var tot = st.sc[0] + st.sc[1]; if (this.sc != null && tot > this.sc && this.hist.length > 10) this.goal(st.sc[0] > this.lastSc[0] ? 0 : 1);
    this.sc = tot; this.lastSc = st.sc.slice();
    if (this.phone) { var mtg = st.mo ? st.mo.c : 0; if (st.mo) this.pmoPt = st.mo.pt; if (this.rep) { mtg = 1; this.pmoPt = [.5, this.rep.gy]; } this.pzc = this.pzc || 0; this.pzc += (mtg - this.pzc) * (1 - Math.exp(-dt * PHONE_ZIP)); }   // fast in / fast out, slow tapers; tighter going in
    var cam = this.setTop(opt.action ? st : null, dt), show = st, MO = opt.moment && !this.rep ? opt.moment : null, R = this.rep, flash = this.d.querySelector('.b3flash'), ban = this.d.querySelector('.b3ban');
    if (R) { R.t += dt; var T = R.t - R.wait;
      if (R.t < R.wait) { var k = R.t / R.wait; flash.style.opacity = Math.max(0, .85 - k * 2.5) * (1 + Math.sin(R.t * 40) * .2); ban.style.opacity = Math.min(1, R.t * 5) * (k < .85 ? 1 : (1 - k) / .15); ban.style.transform = 'scale(' + (1 + Math.max(0, .25 - R.t) * 2) + ')';
        if (Math.random() < dt * 5) { var gy = R.team ? L - B.GY : B.GY; this.emit(.2 + Math.random() * .6, gy + (R.team ? -1 : 1) * (.1 + Math.random() * .4), .15 + Math.random() * .2, 70, R.team ? 0x9fd4ff : 0xffb3be, .5, 1.3, 1); }
        if (Math.random() < dt * 22) this.camFlash(); }
      else { ban.style.opacity = 0; flash.style.opacity = 0; var seg = null, acc = 0; for (var si = 0; si < R.segs.length; si++) { var sg = R.segs[si], dur = (sg[1] - sg[0]) / sg[2] + REP_TAIL; if (T < acc + dur) { seg = sg; break; } acc += dur; }
        if (!seg) { this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3bars').style.opacity = 0; }
        else { var ct = Math.min(seg[1], seg[0] + (T - acc) * seg[2]), fr = frameAt(R.F, R.F[0].t + ct); show = { p: fr.p, u: fr.u, o: fr.o, a: fr.a, c: fr.c, z: fr.z, gc: fr.gc, sc: st.sc, sw: -1 }; this.d.querySelector('.b3rep').style.opacity = 1; this.d.querySelector('.b3bars').style.opacity = this.phone ? 0 : 1;
          cam = this.persp; cam.aspect = W / H; cam.updateProjectionMatrix(); this.shot(seg[3], fr, R, dt, seg !== R.cur); R.cur = seg; } } }
        if (MO && !R) {   // crazy-moment camera: swoops from high over the impact point down toward ice level as time slows
      var Gq = this.G, P3 = function (x, y, h) { return Gq.localToWorld(L3(x, y, h)); }, c = MO.c, d = MO.dir, sd = MO.pt[0] < .5 ? 1 : -1, hi = P3(MO.pt[0] - d[0] * .15, MO.pt[1] - d[1] * .15, 1.25), lo = P3(MO.pt[0] - d[0] * .34 + sd * .12, MO.pt[1] - d[1] * .34, .085);
      cam = this.persp; cam.aspect = W / H; cam.fov = 50 - c * 8; cam.position.copy(hi.lerp(lo, c)); cam.up.set(0, 1, 0); cam.lookAt(P3(MO.pt[0], MO.pt[1], .005)); cam.updateProjectionMatrix(); }
this._dt = dt; var pp = this.place(show); this.refStep(show, dt);
    // puck trail + glow at speed (visual only)
    var lt = this.trail; lt.push([pp[0], pp[1]]); if (lt.length > 8) lt.shift(); var sp = lt.length > 1 ? Math.hypot(lt[lt.length - 1][0] - lt[lt.length - 2][0], lt[lt.length - 1][1] - lt[lt.length - 2][1]) / Math.max(dt, .001) : 0;
    this.glow.position.copy(this.puck.position); this.glow.material.opacity = Math.max(0, Math.min(.8, (sp - .6) * .5)) * (this.puck.visible ? 1 : 0);
    // comet thread: a thin gold ribbon behind the puck, tapering to nothing and fading fast; length/brightness scale mildly with speed
    this.fsp += (sp - this.fsp) * Math.min(1, dt * 8); this.ribbon(pp, this.puck.position.y, this.puck.visible, dt);
    // the player under your thumb sparkles (phone)
    if (opt.held >= 0) { var hp = this.pl[opt.held].position; for (k = 0; k < 2; k++) { var a = Math.random() * 7, rr2 = B.R * (1.1 + Math.random() * .5); this.parts.push({ p: new THREE.Vector3(hp.x + Math.cos(a) * rr2, .055, hp.z + Math.sin(a) * rr2), v: new THREE.Vector3(Math.cos(a) * .08, .05, Math.sin(a) * .08), c: new THREE.Color(k % 2 ? 0xffb300 : 0xff5a00), l: .7, l0: .7, g: 0 }); } }
    // particles
    var P = this.parts, n = 0, pos = this.pPos, col = this.pCol; this.parts = P.filter(function (p) { p.l -= dt; if (p.l <= 0) return false; p.v.y -= p.g * .9 * dt; p.p.addScaledVector(p.v, dt); return true; });
    this.parts.forEach(function (p) { if (n >= 900) return; var f = Math.min(1, p.l / p.l0 * 1.5); pos[n * 3] = p.p.x; pos[n * 3 + 1] = p.p.y; pos[n * 3 + 2] = p.p.z; col[n * 3] = lerp(1, p.c.r, f); col[n * 3 + 1] = lerp(1, p.c.g, f); col[n * 3 + 2] = lerp(1, p.c.b, f); n++; });
    for (var z = n; z < 900; z++) pos[z * 3 + 1] = -9; this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    this.pts.material.size = cam === this.ortho ? Math.max(4, this.V.s * .018) * Math.min(2, devicePixelRatio || 1) : .012; this.pts.material.sizeAttenuation = true;
    this.markers(cam, cam === this.ortho && (this.az || 1) > 1.05);
    var rep = !!this.rep; this.nets.forEach(function (n) { var l = n.userData.light; if (!l) return; if (l.t > 0) l.t -= dt; if (!rep) l.rep = false; l.on = l.t > 0 || l.rep;
      var k = l.on ? .75 + .25 * Math.sin(performance.now() / 90) : 0; l.dome.material.color.setHex(l.on ? 0xff3030 : 0x551018); l.spin.rotation.y += dt * 9; l.spin.children.forEach(function (b) { b.children[0].material.opacity = k * .8; }); l.halo.material.opacity = k * .9; });
    this.lastCam = cam; this.gl.render(this.scene, cam);
  };
  // screen -> rink through whatever camera drew the last frame (keeps touches right while zoomed)
  R3.prototype.toRink = function (X, Y) { var cam = this.lastCam; if (!cam) return null; var r = this.cv.getBoundingClientRect(), nd = new THREE.Vector2((X - r.left) / r.width * 2 - 1, -((Y - r.top) / r.height) * 2 + 1), rc = this.rc || (this.rc = new THREE.Raycaster());
    rc.setFromCamera(nd, cam); var o = rc.ray.origin, d = rc.ray.direction; if (Math.abs(d.y) < 1e-6) return null; var t = -o.y / d.y, w = o.clone().addScaledVector(d, t), l = this.G.worldToLocal(w); return [l.z, l.x]; };
  var TRAIL = { n: 40, w: .0075, life: .11, lifeK: .05, minSp: .35 };
  R3.prototype.ribbon = function (pp, h, vis, dt) { var T = this.rib; if (!T) { var g = new THREE.BufferGeometry(), N = TRAIL.n, idx = [];
      for (var k = 0; k < N - 1; k++) { var a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 8), 4));
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 2; this.G.add(m);
      if (this.fpts) this.fpts.visible = false; T = this.rib = { m: m, pts: [], t: 0 }; }
    T.t += dt; var P = T.pts, last = P[P.length - 1];
    if (!vis || (last && Math.hypot(last.x - pp[0], last.y - pp[1]) > .25)) P.length = 0;   // hidden puck or a cut/teleport
    if (vis && dt > 0) P.push({ x: pp[0], y: pp[1], h: h, t: T.t });
    var spd = Math.max(0, this.fsp - TRAIL.minSp), life = TRAIL.life + Math.min(.12, spd * TRAIL.lifeK), bright = Math.min(1, spd / 2.4);
    while (P.length && (T.t - P[0].t > life || P.length > TRAIL.n)) P.shift();
    var pos = T.m.geometry.attributes.position.array, col = T.m.geometry.attributes.color.array, n = P.length;
    for (var k = 0; k < TRAIL.n; k++) { var j = Math.min(n - 1, k), q = P[n - 1 - j]; if (!q || n < 2) { for (var z = 0; z < 6; z++) pos[k * 6 + z] = 0; col[k * 8 + 3] = col[k * 8 + 7] = 0; continue; }
      var q2 = P[Math.max(0, n - 2 - j)], q1 = P[Math.min(n - 1, n - j)], dx = q1.x - q2.x, dy = q1.y - q2.y, m2 = Math.hypot(dx, dy) || 1, f = Math.min(1, (T.t - q.t) / life), w = TRAIL.w * (.4 + bright * .6) * Math.pow(1 - f, 1.6), nx = -dy / m2 * w, ny = dx / m2 * w;
      var A = L3(q.x + nx, q.y + ny, q.h + .002), Bv = L3(q.x - nx, q.y - ny, q.h + .002); pos[k * 6] = A.x; pos[k * 6 + 1] = A.y; pos[k * 6 + 2] = A.z; pos[k * 6 + 3] = Bv.x; pos[k * 6 + 4] = Bv.y; pos[k * 6 + 5] = Bv.z;
      var al = Math.pow(1 - f, 2.2) * (.15 + bright * .85) * (k >= n ? 0 : 1); for (var e = 0; e < 2; e++) { var o = k * 8 + e * 4; col[o] = 1; col[o + 1] = .62 + .2 * (1 - f); col[o + 2] = .08 + .3 * (1 - f) * bright; col[o + 3] = al; } }
    T.m.geometry.attributes.position.needsUpdate = true; T.m.geometry.attributes.color.needsUpdate = true; };
  R3.prototype.camFlash = function () { var f = document.createElement('div'), s = 4 + Math.random() * 10; f.style.cssText = 'position:absolute;width:' + s + 'px;height:' + s + 'px;border-radius:50%;background:#fff;box-shadow:0 0 14px 6px #fff;left:' + (Math.random() * 100) + '%;top:' + (Math.random() < .5 ? Math.random() * 14 : 86 + Math.random() * 14) + '%;transition:opacity .25s;opacity:1';
    this.d.appendChild(f); setTimeout(function () { f.style.opacity = 0; }, 60); setTimeout(function () { f.remove(); }, 400); };
  R3.prototype.goal = function (team) { var nl = this.nets[team] && this.nets[team].userData.light; if (nl) { nl.t = 4.5; nl.rep = true; }
    var F = this.hist.slice(); while (F.length > 2 && Math.hypot(F[F.length - 1].p[0] - .5, F[F.length - 1].p[1] - L / 2) < .02) F.pop();   // drop the reset frame
    var D = this.phone ? 2.0 : 3.6, t1 = F[F.length - 1].t; F = F.filter(function (f) { return f.t >= t1 - D; }); if (F.length < 4) return; D = t1 - F[0].t;
    var ban = this.d.querySelector('.b3ban'); ban.textContent = 'GOAL!'; ban.style.color = team ? '#3aa8ff' : '#ff5a6e';
    // angle 1: high 3/4 view 1.5x out, normal speed; angle 2: 1.2x out at 75%; angle 3: close net cam at 2/3 of the old slow-mo (.2)
    var a1 = this.phone ? 1.4 : 2.0, a2 = this.phone ? .8 : 1.2, a3 = this.phone ? .35 : .45;
    var segs = [[Math.max(0, D - a1), D, 1, 'top'], [Math.max(0, D - a2), D, .75 / 1.1, 'side'], [Math.max(0, D - a3), D, .2 * 2 / 3 / 1.15, 'net']];
    this.rep = { F: F, team: team, t: 0, wait: this.phone ? 1.2 : 1.5, segs: segs, gy: team ? L - B.GY : B.GY, dir: team ? 1 : -1 };
  };
  R3.prototype.shot = function (kind, fr, R, dt, cut) {   // replay cameras, all at ice level
    var cam = this.persp, G = this.G, pk = new THREE.Vector3(fr.p[0], 0, fr.p[1]), want, look;
    var P = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, puck = P(fr.p[0], fr.p[1], .01);
    if (kind === 'top') { var sd = fr.p[0] < .5 ? -1 : 1; want = P(fr.p[0] + sd * .3, fr.p[1] - R.dir * .55, .5); look = P(fr.p[0], fr.p[1] + R.dir * .1, 0); }
    else if (kind === 'track') { var dx = R.gy - fr.p[1], side = fr.p[0] < .5 ? -1 : 1; want = P(fr.p[0] + side * .2, fr.p[1] - R.dir * .38, .07); look = P(fr.p[0], fr.p[1] + R.dir * .12, .01); }
    else if (kind === 'side') { var sx = fr.p[0] < .5 ? .95 : .05; sx = .5 + (sx - .5) * 1.2; want = P(sx, R.gy - R.dir * .41, .14); look = P(fr.p[0], fr.p[1], .015); }
    else { want = P(.5 + (fr.p[0] < .5 ? -.03 : .03), R.gy + R.dir * .045, .115); look = P(fr.p[0], fr.p[1], 0); }
    if (cut || !R.cp) { R.cp = want.clone(); R.cl = look.clone(); } else { var k = 1 - Math.exp(-dt * (kind === 'track' || kind === 'top' ? 4 : 10)); R.cp.lerp(want, k); R.cl.lerp(look, 1 - Math.exp(-dt * 12)); }
    cam.position.copy(R.cp); cam.up.set(0, 1, 0); cam.lookAt(R.cl); cam.fov = kind === 'net' ? 60 : 50; cam.updateProjectionMatrix();
  };
  // ref: 50% see-through, follows play at half player speed, no effect on the game. Hard contact knocks him over (cosmetic).
  R3.prototype.refStep = function (st, dt) { var F = this.ref; if (!F) { F = this.ref = { g: man(new THREE.Group(), 0xf4f4f4, false, .5), x: .9, y: L / 2, down: 0, prev: [], hd: 0 };
      var stripe = new THREE.Mesh(new THREE.CylinderGeometry(B.R * .52, B.R * .45, .005, 14), new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: .5, depthWrite: false })); stripe.position.y = .034; F.g.add(stripe); this.G.add(F.g); }
    if (!dt) return; var tx = st.p[0] < .5 ? Math.min(.92, st.p[0] + .32) : Math.max(.08, st.p[0] - .32), ty = st.p[1] - (st.p[1] - L / 2) * .25, g = F.g;
    for (var i = 0; i < 12; i++) { var q = this.pl[i].position, pv = F.prev[i]; if (pv && !F.down) { var sp = Math.hypot(q.x - pv[0], q.z - pv[1]) / dt, d = Math.hypot(q.z - F.x, q.x - F.y); if (d < B.R * .9 && sp > .7) { F.down = 2.2; F.dir = Math.atan2(q.x - pv[0], q.z - pv[1]); F.vx = Math.sin(F.dir) * .35; F.vy = Math.cos(F.dir) * .35; F.spin = (Math.random() - .5) * 14; } } F.prev[i] = [q.x, q.z]; }
    if (F.down > 0) { F.down -= dt; var t = 2.2 - F.down; F.x += F.vy * dt; F.y += F.vx * dt; F.vx *= Math.exp(-dt * 3); F.vy *= Math.exp(-dt * 3);
      var lie = t < .3 ? t / .3 : F.down < .5 ? F.down / .5 : 1; g.rotation.set(0, g.rotation.y + F.spin * dt * (1 - t / 2.2), 0); g.rotateX(lie * Math.PI / 2 * .95); g.position.y = lie * .008; if (F.down <= 0) { F.down = 0; g.rotation.set(0, 0, 0); g.position.y = 0; } }
    else { var dx = tx - F.x, dy = ty - F.y, m = Math.hypot(dx, dy), v = .5; if (m > .01) { var k = Math.min(m, v * dt) / m; F.x += dx * k; F.y += dy * k; F.hd = Math.atan2(dx, dy); } g.rotation.set(0, F.hd, 0); }
    F.x = Math.max(.04, Math.min(.96, F.x)); F.y = Math.max(.12, Math.min(L - .12, F.y)); g.position.x = F.y; g.position.z = F.x; };
  R3.prototype.replaying = function () { return !!this.rep; };
  root.Bubble3D = R3;
})(window);
