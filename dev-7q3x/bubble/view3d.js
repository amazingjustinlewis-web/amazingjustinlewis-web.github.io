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
    var g = this.gl = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); g.setPixelRatio(Math.min(2, devicePixelRatio || 1)); g.setClearColor(0x0c1226); if (root.Perf) root.Perf.wrap(g, 'render', 'r');
    var sc = this.scene = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, .55)); var dl = new THREE.DirectionalLight(0xffffff, .55); dl.position.set(.6, 3, 1.2); sc.add(dl);
    var G = this.G = new THREE.Group(); sc.add(G); if (this.phone) G.scale.z = -1;
    this.ortho = new THREE.OrthographicCamera(0, 1, 0, -1, .01, 50); this.persp = new THREE.PerspectiveCamera(52, 1, .005, 40);
    this.build(); if (!this.phone) { this.buildRoom(); this.bc = new THREE.PerspectiveCamera(38, 16 / 9, .02, 60); this.dof = new DOF(g); }
    this.camMode = 'bcast'; this.dofOn = true; this.hist = []; this.clock = 0; this.rep = null; this.sc = null; this.fw = []; this.trail = [];
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
    // round the ice corners to the boards (r = .12 units) so nothing pokes past the arena model's corner boards
    c.globalCompositeOperation = 'destination-in'; var rc = .12 * CH; c.beginPath(); c.moveTo(rc, 0); c.arcTo(CW, 0, CW, CH, rc); c.arcTo(CW, CH, 0, CH, rc); c.arcTo(0, CH, 0, 0, rc); c.arcTo(0, 0, CW, 0, rc); c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over';
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    var ice = new THREE.Mesh(new THREE.PlaneGeometry(L, 1), new THREE.MeshLambertMaterial({ map: tex, alphaTest: .5 })); ice.rotation.x = -Math.PI / 2; ice.position.set(L / 2, 0, .5); G.add(ice);
    // boards (rounded rect ring) + yellow kickplate + cabinet
    function rr(w, h, r, x, y) { var s = new THREE.Shape(); s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
    function ring(pad, th, hgt, col, y0) { var o = rr(L + 2 * (pad + th), 1 + 2 * (pad + th), .14 + pad + th, -pad - th, -pad - th), hole = rr(L + 2 * pad, 1 + 2 * pad, .12 + pad, -pad, -pad); o.holes.push(hole);
      var geo = new THREE.ExtrudeGeometry(o, { depth: hgt, bevelEnabled: false }), me = new THREE.Mesh(geo, mat(col)); me.rotation.x = Math.PI / 2; me.position.y = y0 + hgt; G.add(me); return me; }
    var proc = [ring(0, .03, .07, 0xf6f8fb, 0), ring(-.004, .012, .018, 0xf2c230, 0), ring(.03, .1, .02, 0x24356a, -.0)];
    var cab = new THREE.Mesh(new THREE.BoxGeometry(L + .5, .3, 1.5), mat(0x18244a)); cab.position.set(L / 2, -.16, .5); G.add(cab); proc.push(cab);
    this.loadArena(proc); if (!CYL.on) this.loadSkaters();
    // nets: red frame + translucent mesh box
    var self = this; this.nets = [];
    // model hook: window.BubbleNetModel(side, dims) may return a Group with children named 'post_l', 'post_r', 'crossbar' (metal) and 'mesh' (soft, wobbles); origin on the goal line centre, +x into the net
    [[B.GY, -1], [L - B.GY, 1]].forEach(function (gq, side) { var n = new THREE.Group(), red = mat(0xd8344c), d = .05 * gq[1], hh = .045, custom = root.BubbleNetModel ? root.BubbleNetModel(side, { depth: .05, height: hh, halfWidth: B.GW }) : null;
      if (custom) { custom.scale.x *= gq[1]; n.add(custom); n.userData.mesh = custom.getObjectByName('mesh'); } else {
      [-B.GW, B.GW].forEach(function (z, k) { var post = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, hh, 8), red); post.name = k ? 'post_r' : 'post_l'; post.position.set(0, hh / 2, z); n.add(post); });
      var bar = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, B.GW * 2, 8), red); bar.name = 'crossbar'; bar.rotation.x = Math.PI / 2; bar.position.set(0, hh, 0); n.add(bar);
      var mg = new THREE.BoxGeometry(Math.abs(d), hh, B.GW * 2); mg.translate(Math.abs(d) / 2, hh / 2, 0); var mesh = new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: .35, side: THREE.DoubleSide })); mesh.name = 'mesh'; mesh.scale.x = gq[1]; n.add(mesh); n.userData.mesh = mesh; }
      var lt = new THREE.Group(), dome = new THREE.Mesh(new THREE.SphereGeometry(.009, 12, 8, 0, 7, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x551018 })), base = new THREE.Mesh(new THREE.CylinderGeometry(.008, .009, .004, 12), mat(0x222222));
      base.position.y = .002; dome.position.y = .004; lt.add(base); lt.add(dome); var spin = new THREE.Group(); spin.position.y = .008; lt.add(spin);
      [0, Math.PI].forEach(function (a) { var bm = new THREE.Mesh(new THREE.PlaneGeometry(.2, .07), new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xff2a2a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide })); var bh = new THREE.Group(); bh.rotation.y = a; bm.rotation.x = -Math.PI / 2 + .35; bm.position.set(.1, 0, 0); bh.add(bm); spin.add(bh); });
      var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex('rgba(255,40,40,1)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending })); halo.scale.set(.11, .11, 1); halo.position.y = .008; lt.add(halo);
      lt.position.set(d * .6, hh + .004, 0); n.add(lt); n.userData.light = { dome: dome, spin: spin, halo: halo, t: 0 };
      n.position.copy(L3(.5, gq[0])); G.add(n); self.nets.push(n); });
    // players: solid team-colour cylinders + stick + blade; blob shadow
    this.pl = B.TR.map(function (tr) { var p = new THREE.Group(); man(p, COLS[tr.t], tr.k === 'G'); if (CYL.on) cyl(p, COLS[tr.t], tr.k === 'G');
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
  // v0.9.20 temporary look (?cyl=0 = v0.9.19 proxies/skaters): plain team cylinder, flat white facing wedge on top (engine-chosen facing, sim fa), straight stick from the centre toward the puck
  var CYL = { on: !/[?&]cyl=0/.test(location.search), h: .04, r: .5, mark: .75 };
  function cyl(p, col, goalie) { while (p.children.length) p.remove(p.children[0]); var r = B.R * CYL.r, c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, CYL.h, 20), new THREE.MeshLambertMaterial({ color: goalie ? new THREE.Color(col).lerp(new THREE.Color(0xffffff), .35) : col })); c.position.y = CYL.h / 2; p.add(c); p.userData.cm = c.material;
    var fm = new THREE.Group(), w = new THREE.Mesh(new THREE.CircleGeometry(r * CYL.mark, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); w.rotation.x = -Math.PI / 2; w.scale.set(1.25, .7, 1); fm.add(w); fm.position.y = CYL.h + .0015; p.add(fm); p.userData.fm = fm; p.userData.body = []; }
  // v0.9.21 3D check wedge (TV + phone 3D): feathered red cone on the ice from the checker toward the hit, fades over CHKW.ms
  var CHKW = { ms: 380, len: .2, spread: 1.0, op: .9 }, chkTex = null;
  function chkTexture() { if (chkTex) return chkTex; var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); g.filter = 'blur(5px)'; var gr = g.createRadialGradient(8, 64, 0, 8, 64, 120); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,40,40,.95)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(8, 64); g.lineTo(124, 10); g.lineTo(124, 118); g.closePath(); g.fill(); chkTex = new THREE.CanvasTexture(c); return chkTex; }
  function man(p, col, goalie, opa) { var M = function (c) { return new THREE.MeshLambertMaterial(opa ? { color: c, transparent: true, opacity: opa, depthWrite: false } : { color: c }); }, r = B.R * .5, dark = M(0x1a1d26), jer = M(col);
    [-1, 1].forEach(function (sd) { var lg = new THREE.Mesh(new THREE.BoxGeometry(r * .55, .018, r * (goalie ? .8 : .55)), goalie ? M(0xeeeeee) : dark); lg.position.set(0, .009, sd * r * .45); p.add(lg); });
    var pant = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r * .8, .008, 14), dark); pant.position.y = .022; p.add(pant);
    var tor = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * .85, .016, 14), jer); tor.position.y = .034; p.add(tor);
    var sh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.0, 14, 8, 0, 7, 0, Math.PI / 2), jer); sh.scale.y = .45; sh.position.y = .042; p.add(sh);
    var hd = new THREE.Mesh(new THREE.SphereGeometry(r * .5, 12, 10), M(goalie ? 0xf2f2f2 : 0x20242e)); hd.position.y = .05 - r * .45; p.add(hd);
    p.userData.body = p.children.slice();
    var arm = new THREE.Group(), ab = new THREE.Mesh(new THREE.BoxGeometry(r * .45, .022, r * .45), jer), gl = new THREE.Mesh(new THREE.SphereGeometry(r * .42, 8, 6), dark); ab.position.y = .011; gl.position.y = .024; arm.add(ab); arm.add(gl); arm.position.set(0, .042, -r * .95); arm.visible = false; p.add(arm); p.userData.arm = arm;
    return p; }
  function beamTex() { var c = document.createElement('canvas'); c.width = 128; c.height = 32; var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 14); x.lineTo(128, 0); x.lineTo(128, 32); x.lineTo(0, 18); x.fill(); return new THREE.CanvasTexture(c); }
  // phone held-player cue: thick feathered ring + soft glow under the thumb + feathered tether between them
  var CUE = { ringIn: .85, ringOut: 1.55, solid: .45, feather: .55, ringA: .9, glowR: .8, glowA: .45, tetherW: .5, tetherA: .3 };
  function ringTex() { var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'), ri = CUE.ringIn / CUE.ringOut, rs = ri + (1 - ri) * CUE.solid, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(Math.max(0, ri - .02), 'rgba(255,255,255,0)'); g.addColorStop(ri, 'rgba(255,255,255,1)'); g.addColorStop(rs, 'rgba(255,255,255,1)'); g.addColorStop(Math.min(1, rs + (1 - rs) * (1 - CUE.feather) * .5), 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
  function tetherTex() { var c = document.createElement('canvas'); c.width = 64; c.height = 64; var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  R3.prototype.thumbCue = function (held, dt) { var G = this.puck.parent, c = this.cue;
    if (!c) { function m(t) { return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false }); } function pl(t) { var q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m(t)); q.rotation.x = -Math.PI / 2; q.renderOrder = 3; G.add(q); return q; }
      c = this.cue = { ring: pl(ringTex()), glow: pl(dotTex('rgba(255,255,255,1)')), teth: pl(tetherTex()), a: 0, last: -1 }; c.teth.rotation.order = 'YXZ'; }
    var on = held >= 0 && this.pl[held]; if (on) c.last = held; c.a += ((on ? 1 : 0) - c.a) * Math.min(1, dt * (on ? 14 : 8)); var i = c.last, vis = c.a > .01 && i >= 0;
    [c.ring, c.glow, c.teth].forEach(function (q) { q.visible = vis; }); if (!vis) return;
    var p = this.pl[i], hp = p.position, rgm = p.userData.ring, col = rgm.material.color; if (on) rgm.visible = false;
    var d = B.R * CUE.ringOut * 2; c.ring.scale.set(d, d, 1); c.ring.position.set(hp.x, .003, hp.z); c.ring.material.color.copy(col); c.ring.material.opacity = CUE.ringA * c.a;
    var T = this.V.thumb; if (on && T) { c.tp = L3(T[0], T[1], 0); } if (!c.tp) { c.glow.visible = c.teth.visible = false; return; }
    var gx = c.tp.x, gz = c.tp.z, g = B.R * CUE.glowR * 2; c.glow.scale.set(g, g, 1); c.glow.position.set(gx, .0035, gz); c.glow.material.color.copy(col); c.glow.material.opacity = CUE.glowA * c.a;
    var dx = gx - hp.x, dz = gz - hp.z, len = Math.hypot(dx, dz); c.teth.visible = len > B.R * .3; c.teth.position.set((gx + hp.x) / 2, .0032, (gz + hp.z) / 2); c.teth.rotation.set(-Math.PI / 2, Math.atan2(-dz, dx), 0, 'YXZ'); c.teth.scale.set(len, B.R * CUE.tetherW * 2, 1); c.teth.material.color.copy(c.glow.material.color); c.teth.material.opacity = CUE.tetherA * c.a; };
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
  var AC = null; function buzz() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); var t = AC.currentTime, o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.value = 196; o2.type = 'square'; o2.frequency.value = 203; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .03); g.gain.setValueAtTime(.18, t + .42); g.gain.linearRampToValueAtTime(0, t + .5);
      o.connect(g); o2.connect(g); g.connect(AC.destination); o.start(t); o2.start(t); o.stop(t + .52); o2.stop(t + .52); } catch (e) {} }
  root.BubbleBuzz = buzz;
  function whistle() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime, o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 38; lg.gain.value = 180; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.14, t + .03); g.gain.setValueAtTime(.14, t + .55); g.gain.linearRampToValueAtTime(0, t + .65); o.connect(g); g.connect(AC.destination); o.start(t); l.start(t); o.stop(t + .7); l.stop(t + .7); } catch (e) {} }
  function ping() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(2300, t); o.frequency.exponentialRampToValueAtTime(1800, t + .25); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .32); } catch (e) {} }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function frameAt(F, t) { var i = 1; while (i < F.length - 1 && F[i].t < t) i++; var a = F[i - 1], b = F[i], k = Math.max(0, Math.min(1, (t - a.t) / ((b.t - a.t) || 1)));
    return { p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k)], u: a.u.map(function (v, j) { return lerp(v, b.u[j], k); }), o: a.o.map(function (v, j) { return [lerp(v[0], b.o[j][0], k), lerp(v[1], b.o[j][1], k)]; }),
      a: a.a.map(function (v, j) { return v + Math.atan2(Math.sin(b.a[j] - v), Math.cos(b.a[j] - v)) * k; }), c: k < .5 ? a.c : b.c, gc: (k < .5 ? a : b).gc, z: lerp(a.z || 0, b.z || 0, k), pz: 0 }; }
  var SPRING_W = 160;   // visual smoothing stiffness (rad/s); higher = tighter. ~6 ms time constant: lag ~2v/W, about .012 at a fast 1 rink-width/s
  var CHASE = { minSp: 1.8, p: .4, rate: .18, pre: .4 };   // chase-cam variant: shots faster than minSp replace angle 2 with probability p; very slow (rate), from ~pre s before the goal
  var CAMLIM = { v: 1.6, a: 6, lv: 1.2, la: 5 };   // replay / slow-mo camera limits: position and look-target max speed (rink units/s) and acceleration
  function camLim(S, want, dt, mv, ma) { if (!S.v) S.v = new THREE.Vector3(); if (dt <= 0) return; var w = 7, e = want.clone().sub(S.p), acc = e.multiplyScalar(w * w).addScaledVector(S.v, -2 * w); if (acc.length() > ma) acc.setLength(ma); S.v.addScaledVector(acc, dt); if (S.v.length() > mv) S.v.setLength(mv); S.p.addScaledVector(S.v, dt); }
  var REP_TAIL = 0, REP_POST = 1.8;   // each angle shows ~1.2 s (replay time) of live footage after the goal: puck bouncing in the net (was a 0.4 s freeze)
  R3.prototype.place = function (st) { this.spr = this.spr || [];
    for (var i = 0; i < 12; i++) { var tr = B.TR[i], q = B.pos(tr, st.u[i]), o = st.o ? st.o[i] : [0, 0], p = this.pl[i], an = st.a ? st.a[i] : 0;
      var tg = L3(q[0] + o[0], q[1] + o[1], 0), sp = this.spr[i], h = this._dt || 0;   // visual-only critically damped spring (sim keeps true positions)
      if (!sp || h <= 0 || Math.hypot(sp.x - tg.x, sp.z - tg.z) > .15) sp = this.spr[i] = { x: tg.x, z: tg.z, vx: 0, vz: 0 };
      else { var ex = Math.exp(-SPRING_W * h), e1 = sp.x - tg.x, j1 = sp.vx + SPRING_W * e1, e2 = sp.z - tg.z, j2 = sp.vz + SPRING_W * e2; sp.x = tg.x + (e1 + j1 * h) * ex; sp.vx = (sp.vx - j1 * SPRING_W * h) * ex; sp.z = tg.z + (e2 + j2 * h) * ex; sp.vz = (sp.vz - j2 * SPRING_W * h) * ex; }
      p.position.set(sp.x, 0, sp.z); var rgc = st.gc && st.gc[i]; p.userData.ring.visible = !!rgc; if (rgc) p.userData.ring.material.color.set(rgc); p.rotation.set(0, Math.atan2(-Math.cos(an), Math.sin(an)), 0); if (p.userData.fm) { var fav = st.fa ? st.fa[i] : an; p.userData.fm.rotation.y = Math.atan2(-Math.cos(fav), Math.sin(fav)) - Math.atan2(-Math.cos(an), Math.sin(an)); } p.userData.stick.material.color.setHex(st.sw === i ? 0xffffff : 0x5a3a1c);
      var lnv = st.ln ? st.ln[i] : 0, dnv = st.dn ? st.dn[i] : 0, sk = p.userData.stick, bl = p.userData.blade, ln0 = p.userData.len, ext = 1 + Math.min(1, lnv / .3) * 2.2;   // snag/check lunge: lean in, stick shoots out
      sk.scale.x = ext; sk.position.x = ln0 * ext / 2; bl.position.x = ln0 * ext; p.position.y = 0;
      var skm = p.userData.sk; if (skm) { sk.visible = bl.visible = ext > 1.05; var swc = st.sw === i ? 0xffffff : 0x8c5c2e; skm.sticks.forEach(function (o) { o.material.color.setHex(swc); }); }
      var kdv = st.kd ? st.kd[i] : 0; if (p.userData.cm) p.userData.cm.emissive.setRGB(kdv > .7 ? 1 : 0, kdv > .7 ? .85 : 0, kdv > .7 ? .85 : 0);
      if (kdv > 0) { var kup = Math.min(1, (1 - kdv) / .15) * Math.min(1, kdv / .3); p.userData.kdA = p.userData.kdA || (Math.random() < .5 ? 1 : -1); p.rotateZ(p.userData.kdA * kup * 1.0); p.position.y = kup * .006; }   // v0.9.21 knockdown: quick tip + white flash, back up as it ends
      else if (dnv > 0) { var tt = 1.5 - dnv, lie = tt < .25 ? tt / .25 : dnv < .45 ? dnv / .45 : 1; p.userData.spin = (p.userData.spin || (Math.random() - .5) * 16); p.rotateY(p.userData.spin * Math.max(0, 1 - tt) * .05); p.rotateZ(lie * Math.PI / 2 * .92); p.position.y = lie * .01 + Math.abs(Math.sin(tt * 9)) * .006 * Math.max(0, 1 - tt * 2); }
      else { p.userData.spin = 0; if (lnv > 0) p.rotateZ(-Math.min(1, lnv / .3) * .55); }
      if (tr.k === 'G') { var grv = st.gr ? st.gr[tr.t] : 0, rp = p.userData.rpad; if (!rp) { rp = p.userData.rpad = new THREE.Mesh(new THREE.BoxGeometry(.012, .02, .03), new THREE.MeshLambertMaterial({ color: tr.t ? 0x3aa8ff : 0xff5a6e })); rp.name = 'reachPad'; this.G.add(rp); }   // proxy blocker/pad (Justin's model reach animation drops in later)
        rp.visible = !!grv; if (grv) { var gx = sp.z, gz = sp.x; p.position.z += grv * .008; p.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), grv * .5)); rp.position.copy(L3(gx + grv * (B.R * .5 + .012), gz, .01)); rp.scale.set(1, 1, .6 + Math.abs(grv) * .7); } } }
    this.skPose(st, this._dt || 0);
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
  R3.prototype.chkFx = function (st, dt) { var f = st && st.fx, L0 = this.chkL = this.chkL || [];
    if (f && f[0] !== this.chkN) { var first = this.chkN == null; this.chkN = f[0]; if (!first && (f[1] === 'C' || f[1] === 'B' || f[1] === 'K')) { var i = f[2], q = B.pos(B.TR[i], st.u[i]), o = st.o ? st.o[i] : [0, 0], big = f[1] !== 'C' ? 1.35 : 1, ln = CHKW.len * big, g = new THREE.PlaneGeometry(ln, ln * CHKW.spread); g.translate(ln / 2, 0, 0); g.rotateX(-Math.PI / 2);
        var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: chkTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })), an = Math.atan2(f[4], f[3]); m.position.copy(L3(q[0] + o[0], q[1] + o[1], .004)); m.rotation.y = Math.atan2(-Math.cos(an), Math.sin(an)); m.renderOrder = 4; this.G.add(m); L0.push({ m: m, t: 0 }); } }
    for (var k = L0.length - 1; k >= 0; k--) { var e = L0[k]; e.t += dt * 1000 / CHKW.ms; var a = e.t < .25 ? e.t / .25 : Math.max(0, 1 - (e.t - .25) / .75); e.m.material.opacity = a * CHKW.op; e.m.scale.setScalar(.7 + .4 * Math.min(1, e.t * 1.5)); if (e.t >= 1) { this.G.remove(e.m); e.m.geometry.dispose(); e.m.material.dispose(); L0.splice(k, 1); } } };
  R3.prototype.render = function (st, dt, opt) {
    opt = opt || {}; this.clock += dt; this.chkFx(st, dt); var W = this.cv.clientWidth, H = this.cv.clientHeight; if (this.W !== W || this.H !== H) { this.W = W; this.H = H; this.gl.setSize(W, H, false); }
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
    if (!this.phone) this.hlRec(st);
    var cam = this.setTop(opt.action ? st : null, dt), show = st, MO = opt.moment && !this.rep ? opt.moment : null, R = this.rep, flash = this.d.querySelector('.b3flash'), ban = this.d.querySelector('.b3ban');
    if (R && st.pg) R.F.push({ t: this.clock, p: st.p.slice(), u: st.u.slice(), o: (st.o || st.u.map(function () { return [0, 0]; })).map(function (q) { return q.slice(); }), a: (st.a || st.u.map(function () { return 0; })).slice(), c: st.c, z: st.z || 0, gc: st.gc ? st.gc.slice() : null });
    if (R) { R.t += (this.phone && R.t >= R.wait && (this.pzc || 0) < .97) ? 0 : dt; var T = R.t - R.wait;   // phones: hold the cut until the zip-zoom-in has landed
      if (R.t < R.wait && R.hl) { var k = R.t / R.wait; flash.style.opacity = 0; ban.style.opacity = Math.min(1, R.t * 3) * (k < .75 ? 1 : (1 - k) / .25) * .85; ban.style.transform = 'scale(1)'; }
      else if (R.t < R.wait) { var k = R.t / R.wait; flash.style.opacity = Math.max(0, .85 - k * 2.5) * (1 + Math.sin(R.t * 40) * .2); ban.style.opacity = Math.min(1, R.t * 5) * (k < .85 ? 1 : (1 - k) / .15); ban.style.transform = 'scale(' + (1 + Math.max(0, .25 - R.t) * 2) + ')';
        if (Math.random() < dt * 5) { var gy = R.team ? L - B.GY : B.GY; this.emit(.2 + Math.random() * .6, gy + (R.team ? -1 : 1) * (.1 + Math.random() * .4), .15 + Math.random() * .2, 70, R.team ? 0x9fd4ff : 0xffb3be, .5, 1.3, 1); }
        if (Math.random() < dt * 22) this.camFlash(); }
      else { ban.style.opacity = 0; flash.style.opacity = 0; var seg = null, acc = 0; for (var si = 0; si < R.segs.length; si++) { var sg = R.segs[si], dur = (sg[1] - sg[0]) / sg[2] + REP_TAIL; if (T < acc + dur) { seg = sg; break; } acc += dur; }
        if (!seg) { this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3bars').style.opacity = 0; if (!R.hl && !this.phone) this.hlAdd({ k: 'goal', s: HLK.goal[0] + Math.random(), F: R.F.filter(function (f) { return f.t >= R.F[R.F.length - 1].t - HL.pre - HL.post - REP_POST; }), team: R.team, t: this.clock }); if (this.reelOn) this.reelNext(); }
        else { var ct = Math.min(seg[1], seg[0] + (T - acc) * seg[2]), fr = frameAt(R.F, R.F[0].t + ct); show = { p: fr.p, u: fr.u, o: fr.o, a: fr.a, c: fr.c, z: fr.z, gc: fr.gc, sc: st.sc, sw: -1 }; this.d.querySelector('.b3rep').style.opacity = 1; this.d.querySelector('.b3bars').style.opacity = this.phone ? 0 : 1;
          cam = this.persp; cam.aspect = W / H; cam.updateProjectionMatrix(); this.shot(seg[3], fr, R, dt, seg !== R.cur); R.cur = seg; } } }
        if (MO && !R) {   // crazy-moment camera: swoops from high over the impact point down toward ice level as time slows
      var Gq = this.G, P3 = function (x, y, h) { return Gq.localToWorld(L3(x, y, h)); }, c = MO.c, d = MO.dir, sd = MO.pt[0] < .5 ? 1 : -1, hi = P3(MO.pt[0] - d[0] * .15, MO.pt[1] - d[1] * .15, 1.25), lo = P3(MO.pt[0] - d[0] * .34 + sd * .12, MO.pt[1] - d[1] * .34, .085);
      cam = this.persp; cam.aspect = W / H; cam.fov = 50 - c * 8; var wp = hi.lerp(lo, c), wl = P3(MO.pt[0], MO.pt[1], .005); if (!this.mcs || this.lastCam !== this.persp) { this.mcs = { p: wp.clone() }; this.mls = { p: wl.clone() }; } else { camLim(this.mcs, wp, dt, CAMLIM.v * 2.5, CAMLIM.a * 3); camLim(this.mls, wl, dt, CAMLIM.lv, CAMLIM.la); } cam.position.copy(this.mcs.p); cam.up.set(0, 1, 0); cam.lookAt(this.mls.p); cam.updateProjectionMatrix(); }
this._dt = dt; var pp = this.place(show); this.refStep(show, dt);
    // puck trail + glow at speed (visual only)
    var lt = this.trail; lt.push([pp[0], pp[1]]); if (lt.length > 8) lt.shift(); var sp = lt.length > 1 ? Math.hypot(lt[lt.length - 1][0] - lt[lt.length - 2][0], lt[lt.length - 1][1] - lt[lt.length - 2][1]) / Math.max(dt, .001) : 0;
    this.glow.position.copy(this.puck.position); this.glow.material.opacity = Math.max(0, Math.min(.8, (sp - .6) * .5)) * (this.puck.visible ? 1 : 0);
    // comet thread: a thin gold ribbon behind the puck, tapering to nothing and fading fast; length/brightness scale mildly with speed
    this.fsp += (sp - this.fsp) * Math.min(1, dt * 8); this.ribbon(pp, this.puck.position.y, this.puck.visible, dt);
    // the player under your thumb sparkles (phone)
    this.thumbCue(opt.held, dt);
    // particles
    var P = this.parts, n = 0, pos = this.pPos, col = this.pCol; this.parts = P.filter(function (p) { p.l -= dt; if (p.l <= 0) return false; p.v.y -= p.g * .9 * dt; p.p.addScaledVector(p.v, dt); return true; });
    this.parts.forEach(function (p) { if (n >= 900) return; var f = Math.min(1, p.l / p.l0 * 1.5); pos[n * 3] = p.p.x; pos[n * 3 + 1] = p.p.y; pos[n * 3 + 2] = p.p.z; col[n * 3] = lerp(1, p.c.r, f); col[n * 3 + 1] = lerp(1, p.c.g, f); col[n * 3 + 2] = lerp(1, p.c.b, f); n++; });
    for (var z = n; z < 900; z++) pos[z * 3 + 1] = -9; this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    if (!this.phone && this.bc && this.camMode === 'bcast' && cam === this.ortho) cam = this.bcastCam(st, dt, W, H);
    cam = this.orbitCam(cam, R, MO, dt, W, H);
    this.pts.material.size = cam === this.ortho ? Math.max(4, this.V.s * .018) * Math.min(2, devicePixelRatio || 1) : .012; this.pts.material.sizeAttenuation = true;
    this.markers(cam, cam === this.ortho && (this.az || 1) > 1.05);
    var mwv = st.mw || 0, pyv = st.p[1], nowv = performance.now() / 1000; this.nets.forEach(function (n, k) { var ms = n.userData.mesh; if (ms) { var w = (k ? pyv > L / 2 : pyv < L / 2) ? mwv : 0, sx = ms.scale.x < 0 ? -1 : 1; ms.scale.set(sx * (1 + w * .12 * Math.sin(nowv * 38)), 1 + w * .05 * Math.sin(nowv * 31 + 1), 1 + w * .04 * Math.sin(nowv * 27)); } });
    if ((st.ev === 'post' || st.ev === 'bar') && this.lastPing !== st) { this.lastPing = st; ping(); }
    if (st.wh != null && this.lastWh != null && st.wh !== this.lastWh) whistle(); this.lastWh = st.wh;
    var rep = !!this.rep; this.nets.forEach(function (n) { var l = n.userData.light; if (!l) return; if (l.t > 0) l.t -= dt; if (!rep) l.rep = false; l.on = l.t > 0 || l.rep;
      var k = l.on ? .75 + .25 * Math.sin(performance.now() / 90) : 0; l.dome.material.color.setHex(l.on ? 0xff3030 : 0x551018); l.spin.rotation.y += dt * 9; l.spin.children.forEach(function (b) { b.children[0].material.opacity = k * .8; }); l.halo.material.opacity = k * .9; });
    this.lastCam = cam; var dS = 0, D = this.dof; if (D && D.ok && this.dofOn && cam.isPerspectiveCamera) dS = R ? (R.hl ? DOFK.reel : DOFK.replay) : MO ? DOFK.replay * .7 : DOFK.live;
    this.dofS = (this.dofS || 0) + (dS - (this.dofS || 0)) * Math.min(1, dt * 4);
    if (D && this.dofS > .03) { var fp = R && R.ls ? R.ls.p : MO && this.mls ? this.mls.p : (this.focusPt || this.puck.getWorldPosition(new THREE.Vector3())); D.render(this.scene, cam, this.dofS, cam.position.distanceTo(fp), dt); }
    else this.gl.render(this.scene, cam);
  };
  // screen -> rink through whatever camera drew the last frame (keeps touches right while zoomed)
  R3.prototype.toRink = function (X, Y) { var cam = this.lastCam; if (!cam) return null; var r = this.V.unrot ? { left: 0, top: 0, width: this.cv.clientWidth, height: this.cv.clientHeight } : this.cv.getBoundingClientRect(), nd = new THREE.Vector2((X - r.left) / r.width * 2 - 1, -((Y - r.top) / r.height) * 2 + 1), rc = this.rc || (this.rc = new THREE.Raycaster());
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
  // Justin's arena model (Blender, metres, rink centred at origin, long axis +Y, ice at z=0, 1 game unit = ARENA_UNIT m).
  // TV only; the procedural boards/cabinet stay as the fallback until it loads. The game keeps its own ice markings, nets and lights.
  // v0.9.6: Justin's skater GLB (player_skater.glb, 23 deform joints, actions 'glide' + 'faceoff'). Skaters only (goalies keep the padded proxy).
  // Glide during play, blend to faceoff while the puck waits in the slot, back to glide when it drops. Proxy stays as fallback; the model's own stick
  // is used; the proxy stick/blade only shows during a lunge (stick shoots out) and the model stick turns white on a swing like the proxy did. ?noskaters disables; phones off unless ?skaters=1.
  var SKATER = { url: 'player_skater.glb', yaw: Math.PI / 2, h: .085, blendIn: 3.5, blendOut: 6, tint: .85 };
  R3.prototype.loadSkaters = function () { var self = this; if (!THREE.GLTFLoader || /noskaters/.test(location.search) || (this.phone && !/skaters=1/.test(location.search))) return;
    fetch(SKATER.url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
      self.pl.forEach(function (p, i) { var tr = B.TR[i]; if (tr.k === 'G') return;
        new THREE.GLTFLoader().parse(buf.slice(0), '', function (g) { var sticks = [], m = g.scene, box = new THREE.Box3().setFromObject(m), ht = box.max.y - box.min.y || 1.6, sc = SKATER.h / ht;
          m.traverse(function (o) { if (!o.isMesh) return; if (o.name === 'stick') { o.material = o.material.clone(); sticks.push(o); return; } o.frustumCulled = false; var mt = o.material; if (mt && mt.name === 'Jersey') { mt = o.material = mt.clone(); mt.color.set(COLS[tr.t]).lerp(new THREE.Color(0xffffff), 1 - SKATER.tint); } });
          var wrap = new THREE.Group(); m.scale.setScalar(sc); m.rotation.y = SKATER.yaw; wrap.add(m); p.add(wrap);
          var mix = new THREE.AnimationMixer(m), clip = function (n) { return THREE.AnimationClip.findByName(g.animations, n); }, aG = clip('glide') && mix.clipAction(clip('glide')), aF = clip('faceoff') && mix.clipAction(clip('faceoff'));
          [aG, aF].forEach(function (a) { if (a) { a.play(); a.setEffectiveWeight(0); } }); if (aG) aG.setEffectiveWeight(1);
          p.userData.sk = { m: wrap, mix: mix, g: aG, f: aF, w: 0, sticks: sticks }; p.userData.body.forEach(function (o) { o.visible = false; }); }, function () {}); }); }).catch(function () {}); };
  R3.prototype.skPose = function (st, dt) { var fo = st && st.pz > 0 ? 1 : 0; for (var i = 0; i < 12; i++) { var k = this.pl[i].userData.sk; if (!k) continue;
      k.w += (fo - k.w) * Math.min(1, dt * (fo ? SKATER.blendIn : SKATER.blendOut)); if (k.g) k.g.setEffectiveWeight(1 - k.w); if (k.f) k.f.setEffectiveWeight(k.w); k.mix.update(dt); } };
  var ARENA_URL = 'arena_classic.glb', ARENA_UNIT = .62, ARENA_HIDE = /^(rink_surface|post_[lr]_|crossbar_|net_mesh_|goal_light_|serve_slot)/;
  R3.prototype.loadArena = function (proc) { var self = this; if (this.phone || !THREE.GLTFLoader || /noarena/.test(location.search)) return;
    new THREE.GLTFLoader().load(ARENA_URL, function (g) { var A = g.scene; A.scale.setScalar(1 / ARENA_UNIT); A.rotation.y = -Math.PI / 2; A.position.set(L / 2, 0, .5);
      A.traverse(function (o) { if (!o.isMesh) return; if (ARENA_HIDE.test(o.name)) { o.visible = false; return; }
        if (/glass_dome/.test(o.name)) { o.material = new THREE.MeshPhongMaterial({ color: 0xdff0ff, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide, shininess: 90, specular: 0x88aacc }); o.renderOrder = 3; }
        else if (/boards/.test(o.name)) o.material.side = THREE.DoubleSide; });
      self.G.add(A); self.arena = A; proc.forEach(function (m) { m.visible = false; }); }, undefined, function () { /* keep the procedural arena */ }); };
  R3.prototype.goal = function (team) { var nl = this.nets[team] && this.nets[team].userData.light; if (nl) { nl.t = 4.5; nl.rep = true; }
    var F = this.hist.slice(); while (F.length > 2 && Math.hypot(F[F.length - 1].p[0] - .5, F[F.length - 1].p[1] - L / 2) < .02) F.pop();   // drop the reset frame
    var D = this.phone ? 2.0 : 3.6, t1 = F[F.length - 1].t; F = F.filter(function (f) { return f.t >= t1 - D; }); if (F.length < 4) return; D = t1 - F[0].t;
    var ban = this.d.querySelector('.b3ban'); ban.textContent = 'GOAL!'; ban.style.fontSize = ''; ban.style.color = team ? '#3aa8ff' : '#ff5a6e';
    // angle 1: high 3/4 view 1.5x out, normal speed; angle 2: 1.2x out at 75%; angle 3: close net cam at 2/3 of the old slow-mo (.2)
    var a1 = this.phone ? 1.4 : 2.0, a2 = this.phone ? .8 : 1.2, a3 = this.phone ? .35 : .45;
    var r1 = 1, r2 = .75 / 1.1, r3 = .2 * 2 / 3 / 1.15, segs = [[Math.max(0, D - a1), D + REP_POST * r1, r1, 'top'], [Math.max(0, D - a2), D + REP_POST * r2, r2, 'side'], [Math.max(0, D - a3), D + REP_POST * r3, r3, 'net']];
    // hard/clean shot: sometimes swap angle 2 for a very slow chase cam off the stick into the net
    var n = F.length, ts = -1, sp = 0; for (var q = n - 1; q > 0 && F[n - 1].t - F[q].t < 1.2; q--) { var f0 = F[q - 1], f1 = F[q], v = Math.hypot(f1.p[0] - f0.p[0], f1.p[1] - f0.p[1]) / ((f1.t - f0.t) || 1); if (v > sp) sp = v; if (f0.c >= 0) { ts = f1.t - F[0].t; break; } }
    this.lastShotSp = sp; var force = root.BH_CHASE; if ((sp > CHASE.minSp && Math.random() < CHASE.p) || force) { var st0 = Math.max(0, ts >= 0 ? Math.max(ts - .05, D - CHASE.pre) : D - CHASE.pre), f2 = frameAt(F, F[0].t + st0), f3 = frameAt(F, F[0].t + Math.min(D, st0 + .08)), dv = [f3.p[0] - f2.p[0], f3.p[1] - f2.p[1]], dm = Math.hypot(dv[0], dv[1]) || 1;
      segs[1] = [st0, D + REP_POST * CHASE.rate, CHASE.rate, 'chase']; this.chaseDir = dm > .004 ? [dv[0] / dm, dv[1] / dm] : [0, R0dir(team)]; }
    this.rep = { F: F, team: team, t: 0, wait: this.phone ? 1.2 : 1.5, segs: segs, gy: team ? L - B.GY : B.GY, dir: team ? 1 : -1 };
  };
  function R0dir(team) { return team ? 1 : -1; }
  R3.prototype.shot = function (kind, fr, R, dt, cut) {   // replay cameras, all at ice level
    var cam = this.persp, G = this.G, pk = new THREE.Vector3(fr.p[0], 0, fr.p[1]), want, look;
    var P = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, puck = P(fr.p[0], fr.p[1], .01);
    if (cut || R.sd == null) R.sd = fr.p[0] < .5 ? -1 : 1;   // shot spot side picked once per angle, then held
    if (kind === 'chase') { var cd = this.chaseDir || [0, R.dir], inNet = (fr.p[1] - R.gy) * R.dir > 0, back = inNet ? .16 : .09; want = P(fr.p[0] - cd[0] * back + R.sd * .03, fr.p[1] - cd[1] * back, .035 + (fr.z || 0)); look = P(fr.p[0] + cd[0] * .05, fr.p[1] + cd[1] * .05, .008 + (fr.z || 0)); if (inNet) { want = P(.5 - cd[0] * .14 + R.sd * .03, R.gy - R.dir * .14, .05); look = P(fr.p[0], fr.p[1], .01); } }
    else if (kind === 'top') { var sd = R.sd; want = P(fr.p[0] + sd * .3, fr.p[1] - R.dir * .55, .5); look = P(fr.p[0], fr.p[1] + R.dir * .1, 0); }
    else if (kind === 'track') { var dx = R.gy - fr.p[1], side = fr.p[0] < .5 ? -1 : 1; want = P(fr.p[0] + side * .2, fr.p[1] - R.dir * .38, .07); look = P(fr.p[0], fr.p[1] + R.dir * .12, .01); }
    else if (kind === 'side') { var sx = R.sd < 0 ? .95 : .05; sx = .5 + (sx - .5) * 1.2; want = P(sx, R.gy - R.dir * .41, .14); look = P(fr.p[0], fr.p[1], .015); }
    else if (kind !== 'chase') { want = P(.5 + (R.sd < 0 ? -.03 : .03), R.gy + R.dir * .045, .115); look = P(fr.p[0], fr.p[1], 0); }
    var ch = kind === 'chase' ? 2.2 : 1; if (cut || !R.cs) { R.cs = { p: want.clone() }; R.ls = { p: look.clone() }; } else { camLim(R.cs, want, dt, CAMLIM.v * ch, CAMLIM.a * ch); camLim(R.ls, look, dt, CAMLIM.lv * ch, CAMLIM.la * ch); }   // smoothed, rate-limited position + look-at: no whip
    cam.position.copy(R.cs.p); cam.up.set(0, 1, 0); cam.lookAt(R.ls.p); cam.fov = kind === 'net' ? 60 : kind === 'chase' ? 40 : 50; cam.updateProjectionMatrix();
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
  // ---- highlights (TV): small capped clip buffer, post-game reel ----
  var HL = { cap: 14, pre: 3.0, post: 1.4, fps: 30, reel: 180, wait: 1.1, same: 1.2 };
  var HLK = { goal: [10, 'GOAL'], post: [6, 'OFF THE POST'], bar: [6.5, 'OFF THE BAR'], rim: [3, 'JUST WIDE'], bigcheck: [5, 'BIG HIT'], steal: [3, 'TAKEAWAY'], poke: [2.5, 'POKE CHECK'], glove: [5, 'GLOVE SAVE'], onetimer: [5.5, 'ONE-TIMER'] };
  R3.HL = HL; R3.HLK = HLK; root.BubbleHL = HL;
  R3.prototype.hlRec = function (st) { this.hl = this.hl || []; this.hlP = this.hlP || []; var k = st.ev, me = this;
    if (k && HLK[k] && k !== 'goal' && !this.reelOn && !this.rep && !(st.pz > 0)) { var lp = this.hlP[this.hlP.length - 1];
      if (lp && this.clock - lp.t < HL.same) { if (HLK[k][0] > HLK[lp.k][0]) { lp.k = k; lp.s = HLK[k][0] + Math.random(); } }
      else this.hlP.push({ k: k, t: this.clock, at: this.clock + HL.post, p: st.p.slice(), s: HLK[k][0] + Math.random() * 1.5 }); }
    if (this.rep || this.reelOn) { this.hlP = this.hlP.filter(function (q) { return me.clock - q.t < 8; }); return; }
    while (this.hlP.length && this.clock >= this.hlP[0].at) { var q = this.hlP.shift(), t0 = q.t - HL.pre, F = this.hist.filter(function (f) { return f.t >= t0; }); if (F.length < 20) continue;
      var gy = q.p[1] < L / 2 ? B.GY : L - B.GY; this.hlAdd({ k: q.k, s: q.s, F: F, team: gy === B.GY ? 0 : 1, t: q.t }); } };
  R3.prototype.hlAdd = function (c) { var D = [], lt = -1; c.F.forEach(function (f) { if (f.t - lt >= 1 / HL.fps - 1e-4) { D.push(f); lt = f.t; } }); c.F = D; if (D.length < 10) return;   // downsampled to HL.fps
    var H = this.hl = this.hl || []; H.push(c); while (H.length > HL.cap) { var mi = 0; for (var i = 1; i < H.length; i++) if (H[i].s < H[mi].s) mi = i; H.splice(mi, 1); } };
  R3.prototype.hlDur = function (c) { return c.F[c.F.length - 1].t - c.F[0].t + HL.wait; };
  R3.prototype.startReel = function (dur) { dur = dur || HL.reel; var H = (this.hl || []).slice().sort(function (a, b) { return b.s - a.s; }), pick = [], tot = 0, me = this;
    H.forEach(function (c) { var d = me.hlDur(c); if (tot + d <= dur || !pick.length) { pick.push(c); tot += d; } }); if (!pick.length) return false;
    var best = pick[0]; pick = pick.slice(1).sort(function (a, b) { return a.t - b.t; }); pick.push(best);   // chronological, ending on the best
    this.reelQ = pick; this.reelOn = true; this.reelLen = tot; this.reelNext(); return true; };
  R3.prototype.reelNext = function () { var c = this.reelQ && this.reelQ.shift(); if (!c) { this.reelOn = false; this.reelDone = true; return; }
    var ban = this.d.querySelector('.b3ban'); ban.textContent = HLK[c.k][1]; ban.style.color = c.k === 'goal' ? (c.team ? '#3aa8ff' : '#ff5a6e') : '#ffffffdd'; ban.style.fontSize = '7vmin';
    var span = c.F[c.F.length - 1].t - c.F[0].t; this.rep = { F: c.F, team: c.team, t: 0, wait: HL.wait, segs: [[0, span, 1, 'top']], gy: c.team ? L - B.GY : B.GY, dir: c.team ? 1 : -1, hl: true, kind: c.k }; };
  R3.prototype.skipReel = function () { if (!this.reelOn) return; this.reelQ = []; this.reelOn = false; this.reelDone = true; this.rep = null; var d = this.d; ['.b3rep', '.b3bars', '.b3ban', '.b3flash'].forEach(function (k) { d.querySelector(k).style.opacity = 0; }); d.querySelector('.b3ban').style.fontSize = ''; };
  // ---- attract-mode orbit: alternating segments, slow orbit around the dome, eased in and out of the normal camera ----
  var ORB = { onMin: 20, onMax: 40, offMin: 20, offMax: 40, speed: .07, rx: 1.7, ry: 2.4, h: 1.15, ease: .35 };
  R3.ORB = ORB;
  R3.prototype.orbitCam = function (cam, R, MO, dt, W, H) { var o = this.orb = this.orb || { k: 0, on: false, left: ORB.offMin, a: 0 };
    if (!this.orbitOn) { o.on = false; o.left = ORB.offMin * .5; } else { o.left -= dt; if (o.left <= 0) { o.on = !o.on; o.left = o.on ? ORB.onMin + Math.random() * (ORB.onMax - ORB.onMin) : ORB.offMin + Math.random() * (ORB.offMax - ORB.offMin); } }
    var want = o.on && !R && !MO ? 1 : 0; o.k += (want - o.k) * (1 - Math.exp(-dt * (R || MO ? 6 : ORB.ease))); if (o.k < .002 || (cam !== this.ortho && cam !== this.bc)) { if (o.k < .002) o.k = 0; if (this.persp.near !== .005) { this.persp.near = .005; this.persp.updateProjectionMatrix(); } return cam; }
    o.a += dt * ORB.speed * (.4 + .6 * o.k); var G = this.G, P3 = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, ctr = P3(.5, L / 2, 0), oc = cam, pc = this.persp;
    pc.aspect = W / H; pc.fov = 45; pc.near = .1; pc.updateProjectionMatrix(); var back = new THREE.Vector3(0, 0, 1).applyQuaternion(oc.quaternion), hh = (L / 2 + .25) / Math.tan(22.5 * Math.PI / 180) / Math.max(1, pc.aspect), top = cam === this.bc ? cam.position.clone() : ctr.clone().addScaledVector(back, hh);
    var op = P3(.5 + ORB.rx * Math.sin(o.a), L / 2 + ORB.ry * Math.cos(o.a), ORB.h), e = o.k * o.k * (3 - 2 * o.k);
    pc.position.copy(top).lerp(op, e); var q0 = oc.quaternion.clone(); pc.up.set(0, 1, 0); pc.lookAt(ctr); var q1 = pc.quaternion.clone(); pc.quaternion.copy(q0).slerp(q1, Math.min(1, e * 1.3)); return pc; };
  // ---- v0.9.7 bar room proxy (TV): boxes around the table, warm dim lights; the rink keeps the brightest light ----
  var ROOM = { floor: -1.5, w: 26, d: 20, h: 5.5, warm: 0xffb36b, rink: .5 };   // game units (1 = .62 m); room is unlit MeshBasic (baked warm shading) so it costs ~nothing per pixel
  R3.prototype.buildRoom = function () { var G = this.G, R = new THREE.Group(), M = function (c) { return new THREE.MeshBasicMaterial({ color: c }); }, cx = L / 2, cz = .5, F = ROOM.floor;
    function box(w, h, d, x, y, z, c) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(cx + x, y, cz + z); R.add(m); return m; }
    function person(x, z, c, sit) { var hgt = sit ? 2.1 : 2.8, b = new THREE.Mesh(new THREE.CylinderGeometry(.3, .36, hgt * .62, 8), M(c)); b.position.set(cx + x, F + hgt * .31 + (sit ? .7 : 0), cz + z); R.add(b); var hd = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), M(0x4a3428)); hd.position.set(cx + x, F + hgt * .62 + .2 + (sit ? .7 : 0), cz + z); R.add(hd); }
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), M(0x1e130c)); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, F, cz); R.add(fl);
    [[0, ROOM.d / 2, ROOM.w, 0], [0, -ROOM.d / 2, ROOM.w, 0], [ROOM.w / 2, 0, ROOM.d, 1], [-ROOM.w / 2, 0, ROOM.d, 1]].forEach(function (q) { var wl = new THREE.Mesh(new THREE.PlaneGeometry(q[2], ROOM.h), M(0x2a1a12)); wl.position.set(cx + q[0], F + ROOM.h / 2, cz + q[1]); wl.rotation.y = q[3] ? (q[0] > 0 ? -Math.PI / 2 : Math.PI / 2) : (q[1] > 0 ? Math.PI : 0); R.add(wl); });
    box(1, 1.2, 1, -L / 2 - 2.2, F + .6, .4, 0x1c1a1e); box(1, 1.2, 1, L / 2 + 2.2, F + .6, -.5, 0x1c1a1e); person(-L / 2 - 3.4, -.6, 0x3a3a4a, false); person(L / 2 + 3.6, 1.0, 0x4a3030, false);   // stools / crates past both ends of the table
    box(11, 1.8, 1.1, 0, F + .9, 7.5, 0x3a2010); box(11.3, .1, 1.4, 0, F + 1.85, 7.5, 0x6a3c1c); box(11, 3, .5, 0, F + 3.2, 9.6, 0x1e120a);   // bar counter, top, back shelf
    for (var k = -3; k <= 3; k++) box(.25, .6, .25, k * 1.4, F + 2.6, 9.25, [0x3d7a3a, 0x9a5a20, 0x5a2a6a][(k + 3) % 3]);   // bottles
    [[-6, -5.5], [6.5, -5.8], [-8, 3], [8, 3.4]].forEach(function (t, i) { box(1.6, .08, 1.6, t[0], F + 1.2, t[1], 0x4a2e18); box(.16, 1.2, .16, t[0], F + .6, t[1], 0x1a100a); person(t[0] + 1.2, t[1] + .3, [0x5a5f7a, 0x7a4a4a, 0x4a6a5a, 0x6a5a3a][i], true); });
    [[-3, 6.4, 0x3a3448], [-.5, 6.5, 0x483c2a], [2.4, 6.3, 0x2c3440], [-4.5, -7, 0x382c2c], [4.8, -6.8, 0x2c2c3c]].forEach(function (q) { person(q[0], q[1], q[2], false); });
    // warm dim lamps (pendants over tables + bar); a cooler bright light over the rink itself
    var glowM = new THREE.SpriteMaterial({ map: dotTex('rgba(255,170,90,1)'), color: ROOM.warm, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
    [[-3, 7.5], [3, 7.5], [-6, -5.5], [6.5, -5.8], [-8, 3], [8, 3.4]].forEach(function (q) { var sh = new THREE.Mesh(new THREE.ConeGeometry(.4, .35, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb860, side: THREE.DoubleSide })); sh.position.set(cx + q[0], F + 4.2, cz + q[1]); R.add(sh); var gw = new THREE.Sprite(glowM); gw.scale.set(3, 3, 1); gw.position.copy(sh.position); gw.position.y -= .3; R.add(gw); var pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ color: 0x5a3a20, transparent: true, opacity: .5, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(cx + q[0], F + .01, cz + q[1]); R.add(pool); });
    var sp = new THREE.SpotLight(0xf4f8ff, ROOM.rink, 6, .7, .6, 1); sp.position.set(cx, 2.4, cz); sp.target.position.set(cx, 0, cz); R.add(sp); R.add(sp.target);   // the one extra real light: over the rink
    G.add(R); this.room = R; this.scene.children.forEach(function (o) { if (o.isHemisphereLight) { o.intensity = .42; o.groundColor.setHex(0x3a2a20); } }); this.gl.setClearColor(0x120a06); };
  // ---- v0.9.7 broadcast camera (TV default): gentle 3/4 view from the near side, low enough that puck lift reads ----
  var BCAST = { side: -.62, h: .62, back: 0, fov: 40, follow: .55, across: .25, k: 1.1, look: -.04 };
  R3.BCAST = BCAST;
  R3.prototype.bcastCam = function (st, dt, W, H) { var c = this.bc, G = this.G, b = this.bcs = this.bcs || { y: L / 2, x: .5 };
    var py = st.p[1], px = st.p[0], ty = L / 2 + (py - L / 2) * BCAST.follow, tx = .5 + (px - .5) * BCAST.across, k = 1 - Math.exp(-dt * BCAST.k); b.y += (ty - b.y) * k; b.x += (tx - b.x) * k;
    var pos = G.localToWorld(L3(BCAST.side, b.y, BCAST.h)), look = G.localToWorld(L3(b.x, b.y, BCAST.look)); c.aspect = W / H; c.fov = BCAST.fov; c.updateProjectionMatrix(); c.position.copy(pos); c.up.set(0, 1, 0); c.lookAt(look); this.focusPt = G.localToWorld(L3(px, py, .02)); return c; };
  // ---- v0.9.7 depth of field: one extra pass (scene -> RT with depth, then a 16-tap disk blur scaled by circle of confusion) ----
  var DOFK = { live: 0, replay: 1, reel: 1, maxPx: 7, range: .35, slowMs: 45, slowFor: 4 };
  R3.DOFK = DOFK;
  function DOF(gl) { this.gl = gl; this.rt = null; var q = this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tC: { value: null }, tD: { value: null }, near: { value: .01 }, far: { value: 40 }, focus: { value: 1 }, range: { value: DOFK.range }, maxB: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D tC; uniform sampler2D tD; uniform float near, far, focus, range, maxB; uniform vec2 res; varying vec2 vUv;' +
        'float lin(float d){ return near * far / (far - d * (far - near)); } float coc(vec2 uv){ return clamp(abs(lin(texture2D(tD, uv).x) - focus) / (range * focus), 0., 1.) * maxB; }' +
        'void main(){ float c0 = coc(vUv); vec4 acc = texture2D(tC, vUv); float wsum = 1.; if (c0 > .5) { for (int i = 0; i < 16; i++) { float fi = float(i); float r = sqrt((fi + .5) / 16.) * c0; float a = fi * 2.39996; vec2 o = vec2(cos(a), sin(a)) * r / res; float cs = coc(vUv + o); float w = smoothstep(0., 1., cs / max(r, .5) + .2); acc += texture2D(tC, vUv + o) * w; wsum += w; } }' +
        ' gl_FragColor = acc / wsum; }' }));
    this.sc = new THREE.Scene(); this.sc.add(q); this.oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.slow = 0; this.ok = true; }
  DOF.prototype.render = function (scene, cam, strength, focus, dt) { var gl = this.gl, sz = gl.getDrawingBufferSize(new THREE.Vector2());
    if (!this.rt || this.rt.width !== sz.x || this.rt.height !== sz.y) { if (this.rt) this.rt.dispose(); this.rt = new THREE.WebGLRenderTarget(sz.x, sz.y); this.rt.depthTexture = new THREE.DepthTexture(sz.x, sz.y); this.rt.depthTexture.type = THREE.UnsignedIntType; }
    var u = this.quad.material.uniforms; u.tC.value = this.rt.texture; u.tD.value = this.rt.depthTexture; u.near.value = cam.near; u.far.value = cam.far; u.focus.value = Math.max(.02, focus); u.maxB.value = DOFK.maxPx * strength * (sz.y / 1080); u.res.value.set(sz.x, sz.y);
    gl.setRenderTarget(this.rt); gl.render(scene, cam); gl.setRenderTarget(null); gl.render(this.sc, this.oc);
    // weak-device fallback: if frames stay slow with DOF on, switch it off for the session
    if (dt > DOFK.slowMs / 1000) this.slow += dt; else this.slow = Math.max(0, this.slow - dt * .5); if (this.slow > DOFK.slowFor) { this.ok = false; console.warn('Bubble: DOF auto-off (slow frames)'); } };
  root.Bubble3D = R3;
})(window);
