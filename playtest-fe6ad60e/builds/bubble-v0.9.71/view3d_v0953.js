/* v0.9.52 (view): procedural LEG LAYER on top of any pose (skaters + goalies), live, in replays and highlights.
   Authored poses = upper body, feet square and directly under the player. Each frame, after the clips / BH_POSE_HOOK, the leg bones
   (Thigh/Shin/Foot/Toe _L/_R) are pulled to the captured square stance and then driven by the player's motion:
   stride (alternating kick-back + push, length and cadence scale with speed, forward lean on Hips), small shuffle steps at low speed,
   glide when coasting, crossover hint on hard turns, hockey-stop stance + snow spray on sharp decel. Goalies: shuffle / butterfly from lateral speed.
   Tunables: R3.LEGS (root.BH_LEGS). ?legs=0 = v0.9.48 behaviour. Pose library: anim/poses_v01/index.json + HP_<label>_v01.json (see applyPose).
   Copy of view3d_v0948.js. */
/* v0.9.48 (view): highlight cinema on TV AND phones (same view, no mirroring).
   - Event recorder runs on both devices from snapshot counters (fx check/bigcheck/knockdown/poke, rx glass, fight KO, score, st.ev extras);
     clips are 30 fps, capped at HL.cap (30) for the whole game, lowest score dropped; a per-stretch list feeds whistle replays.
   - Whistle/stoppage (st.wh++ that is not a period end or fight start): 1-2 best clips of that stretch, ~3 s each at 0.5x around the moment.
   - Period end: intermission montage (behind the glass, low corner, overhead swoop, end glass) aimed at the players, until the break ends.
   - Game end: reel also starts on phones (st.ov >= 0); the moment itself plays in slow motion. Tap (phone or TV) skips any of these.
   - Generic pose hook: root.BH_POSE_HOOK(r3, {mode, kind, t, k, players}) is called each frame of a replay/intermission (no-op by default).
   Copy of view3d_v0946.js. */
/* v0.9.43 (view): players 20% smaller (?pscale= default 1.2, visual only); goalies now use the animated player model posed from Justin's 3 hand-posed goalie
   poses (anim/goalie_v01: ready, lowL, lowR; evaluated from ReadyStance.blend with leg IK baked), blending toward the near post's low pose by the puck's lateral
   offset and threat in his half (~0.2 s smoothing). Visual only; pegs fallback unchanged; ?gpose=0 keeps the old goalie proxy. Copy of view3d_v0942.js. */
/* v0.9.42 (view): fight camera half as far (?fcam= distance scale, default 0.5), fighters slowly circle each other (faster during exchanges) with a lagged,
   damped camera that keeps them side-on, light blood spray on hits once a fighter is below ~30% balance (?blood=0 or ?family=1 turns it off; the kit has no
   content-mode flag yet), and the other 10 players mill about near their spots facing the fight instead of freezing. Copy of view3d_v0941.js. */
/* v0.9.46: replays and fight cinematics on the phone were left/right mirrored against the TV. Root cause: the phone's portrait View
   (x right, y down) was a REFLECTION of the TV's landscape View (screen = rink y,x), and the 3D group was mirrored (G.scale.z = -1)
   to match it, so every perspective camera on the phone (replays, moments, fights) showed a mirror image of the TV world.
   Fix: view_v0946.js flips x in portrait so the phone is the TV rotated 90deg, and the phone group is no longer mirrored.
   v0.9.41: same as view3d_v0940.js plus cineCam (shot director: bar dolly, orbit, ice drift, over-the-jumbotron, corner pan) replacing domeCam when the host passes opt.cine. */
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
    var g = this.gl = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); g.setPixelRatio(Math.min(this.phone && ANIM ? AVP.T[AVP.start].pr : 2, devicePixelRatio || 1)); g.setClearColor(0x0c1226); if (root.Perf) root.Perf.wrap(g, 'render', 'r');
    var sc = this.scene = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, .55)); var dl = new THREE.DirectionalLight(0xffffff, .55); dl.position.set(.6, 3, 1.2); sc.add(dl);
    var G = this.G = new THREE.Group(); sc.add(G);   // v0.9.46: no phone mirror; the portrait View is now a rotation of the TV's
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
    this.proc = proc; this.loadArena(proc); if (ANIM) { this.loadAnim(); this.loadPoses(); } else if (!CYL.on) this.loadSkaters();
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
  var HP012 = /[?&]hp012(=1)?(&|$)/.test(location.search);   // v0.9.27 dev flag: Justin's rig 012 + mocap clips (implies ?cyl=0)
  // v0.9.37 ANIM: rig ZTP_Rig_v03 mocap clips from anim/v01 (idle_ready, skate_stride_loop, faceoff_draw, onetimer_slap, body_check) on the TV by default.
  // ?anim=0 = the v0.9.36 look (cylinders). v0.9.38: phones (pad.html) load GLTFLoader too (see AVP safeguards). Missing model -> old skater loaders.
  var ANIM = !/[?&]anim=0/.test(location.search) && !HP012 && !!(window.THREE && THREE.GLTFLoader);
  // v0.9.38 phones: pad.html loads GLTFLoader too, so phones get the mocap players everywhere (live, replays, cinematics). Graduated quality,
  // biased to full: tier 0 full (pr 1.5) > 1 pr 1.0 > 2 only the AVP.near skaters nearest the puck animated, rest pegs > 3 pr .75 all pegs.
  // Step down after AVP.bad 1 s windows under AVP.lo fps, step back up after AVP.good windows over AVP.hi. Logged to console + localStorage
  // 'bh-anim-perf' + Perf.cur.anim (minikit perf log). ?anim=0 off, ?avtier=N pins a tier.
  var ZQ = (window.ZTP && ZTP.quality) || null;   // shared minikit/quality.js tier (high/medium/low/minimal = AVP.T[0..3]); ?q= pins, remembered per device
  var AVP = { T: [{ pr: 1.5, n: 12 }, { pr: 1, n: 12 }, { pr: 1, n: 6 }, { pr: .75, n: 0 }], warm: 3,
    pin: ZQ && ZQ.pinned ? ZQ.idx : (location.search.match(/[?&]avtier=(\d)/) || [])[1] };
  AVP.start = AVP.pin != null ? +AVP.pin : (ZQ ? ZQ.idx : 0);
  // v0.9.39: ?rspd= replay speed vs v0.9.38 (default .5 = half speed; also slows mocap playback during replays). ?pscale= player model size (default 1.5, visual only).
  var RSPD = Math.max(.1, Math.min(2, parseFloat((location.search.match(/[?&]rspd=([\d.]+)/) || [])[1]) || .5)), PSC = Math.max(.5, Math.min(3, parseFloat((location.search.match(/[?&]pscale=([\d.]+)/) || [])[1]) || 1.2));
  var CYL = { on: !/[?&]cyl=0/.test(location.search) && !HP012 && !ANIM, h: .04 * PSC, r: .5 * PSC, mark: .75 };
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
    p.userData.body = p.children.slice(); if (PSC !== 1) p.userData.body.forEach(function (o) { o.position.multiplyScalar(PSC); o.scale.multiplyScalar(PSC); });
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
      '<div class="b3rep" style="position:absolute;left:3vw;top:3vh;font:700 3.6vmin Fredoka,sans-serif;color:#fff;background:#d8344c;padding:.3em .8em;border-radius:.4em;opacity:0">\u25CF INSTANT REPLAY <span style="font-weight:400;opacity:.8;font-size:.7em">\u00b7 tap to skip</span></div><div class="b3fade" style="position:absolute;inset:0;background:#000;opacity:0;pointer-events:none"></div><div class="b3bars" style="position:absolute;inset:0;opacity:0;box-shadow:inset 0 9vh 0 #000,inset 0 -9vh 0 #000"></div>';
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
  // v0.9.24 board ping: short low knock + a tick (player bounced off the boards)
  function bthud() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), o2 = AC.createOscillator(), g2 = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(70, t + .16); g.gain.setValueAtTime(.22, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o2.type = 'triangle'; o2.frequency.setValueAtTime(1400, t); g2.gain.setValueAtTime(.05, t); g2.gain.exponentialRampToValueAtTime(.001, t + .07); o.connect(g); o2.connect(g2); g.connect(AC.destination); g2.connect(AC.destination); o.start(t); o2.start(t); o.stop(t + .22); o2.stop(t + .08); } catch (e) {} }
  function ping() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(2300, t); o.frequency.exponentialRampToValueAtTime(1800, t + .25); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + .32); } catch (e) {} }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ftAt(F, t) { var b = null; for (var i = 0; i < F.length && F[i].t <= t; i++) b = F[i]; return b ? b.ft || null : null; }
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
    this.fightPlace(st, this._dt || 0);
    this.skPose(st, this._dt || 0);
    var pz = st.pz || 0, h = 0, px = st.p[0], py = st.p[1]; this.puck.visible = (!(pz > 0) || !!st.pg) && !st.gone;   // faceoff: hidden in the slot until it launches
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
    if (!this.rep && (!(st.pz > 0) || st.pg)) { this.hist.push({ t: this.clock, p: st.p.slice(), u: st.u.slice(), o: (st.o || st.u.map(function () { return [0, 0]; })).map(function (q) { return q.slice(); }), a: (st.a || st.u.map(function () { return 0; })).slice(), c: st.c, z: st.z || 0, e: st.ev || '', tk: st.tk || null, gc: st.gc ? st.gc.slice() : null, ft: st.ft || null });
      while (this.hist.length && this.hist[0].t < this.clock - 7) this.hist.shift(); }
    // buzzer right before the puck is spat out (pz counts down; pop starts at .55)
    if (st.pz > .02 && st.pz < .5 && !this.buzzed) { this.buzzed = true; buzz(); } if (!(st.pz > 0)) this.buzzed = false;
    var fdv = this.d.querySelector('.b3fade'); if (this.fadeOut > 0) { this.fadeOut -= dt; fdv.style.opacity = Math.max(0, this.fadeOut / CINE.fade); } else if (!(this.rep && this.rep.cine)) fdv.style.opacity = 0;
    if (this.phone && st.rp && this.rep && !this.rep.hl) { this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3ban').style.opacity = 0; this.d.querySelector('.b3flash').style.opacity = 0; }
    // tap-to-skip: the sim cut the pause short, so end the replay too
    if (this.rep && st.pz > 0 && st.pz < 1.1) { if (this.rep.cine) this.fadeOut = CINE.fade * .5; this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3bars').style.opacity = 0; this.d.querySelector('.b3ban').style.opacity = 0; this.d.querySelector('.b3flash').style.opacity = 0; }
    // goal detection by score change (works on remote phones too)
    var tot = st.sc[0] + st.sc[1]; if (this.sc != null && tot > this.sc && this.hist.length > 10) this.goal(st.sc[0] > this.lastSc[0] ? 0 : 1);
    this.sc = tot; this.lastSc = st.sc.slice();
    if (this.phone) { var mtg = st.mo ? st.mo.c : 0; if (st.mo) this.pmoPt = st.mo.pt; if (this.rep) { mtg = 1; this.pmoPt = [.5, this.rep.gy]; } this.pzc = this.pzc || 0; this.pzc += (mtg - this.pzc) * (1 - Math.exp(-dt * PHONE_ZIP)); }   // fast in / fast out, slow tapers; tighter going in
    this.hlRec(st); this.whRec(st);
    if (this.phone) this.phoneMir(-1);   // v0.9.46: live top-down view uses the reflected group
    var cam = this.setTop(opt.action ? st : null, dt), show = st, MO = opt.moment && !this.rep ? opt.moment : null, R = this.rep, flash = this.d.querySelector('.b3flash'), ban = this.d.querySelector('.b3ban');
    if (R && st.pg) R.F.push({ t: this.clock, p: st.p.slice(), u: st.u.slice(), o: (st.o || st.u.map(function () { return [0, 0]; })).map(function (q) { return q.slice(); }), a: (st.a || st.u.map(function () { return 0; })).slice(), c: st.c, z: st.z || 0, gc: st.gc ? st.gc.slice() : null });
    if (R && R.cine) { var crs = this.cineStep(R, st, dt, W, H); if (crs) { show = crs.show; cam = crs.cam; } else R = null; }
    else if (R) { R.t += (this.phone && R.t >= R.wait && (this.pzc || 0) < .97) ? 0 : dt; var T = R.t - R.wait;   // phones: hold the cut until the zip-zoom-in has landed
      if (R.t < R.wait && R.hl) { var k = R.t / R.wait; flash.style.opacity = 0; ban.style.opacity = Math.min(1, R.t * 3) * (k < .75 ? 1 : (1 - k) / .25) * .85; ban.style.transform = 'scale(1)'; }
      else if (R.t < R.wait) { var k = R.t / R.wait; flash.style.opacity = Math.max(0, .85 - k * 2.5) * (1 + Math.sin(R.t * 40) * .2); ban.style.opacity = Math.min(1, R.t * 5) * (k < .85 ? 1 : (1 - k) / .15); ban.style.transform = 'scale(' + (1 + Math.max(0, .25 - R.t) * 2) + ')';
        if (Math.random() < dt * 5) { var gy = R.team ? L - B.GY : B.GY; this.emit(.2 + Math.random() * .6, gy + (R.team ? -1 : 1) * (.1 + Math.random() * .4), .15 + Math.random() * .2, 70, R.team ? 0x9fd4ff : 0xffb3be, .5, 1.3, 1); }
        if (Math.random() < dt * 22) this.camFlash(); }
      else { ban.style.opacity = 0; flash.style.opacity = 0; var seg = null, acc = 0; for (var si = 0; si < R.segs.length; si++) { var sg = R.segs[si], dur = (sg[1] - sg[0]) / sg[2] + REP_TAIL; if (T < acc + dur) { seg = sg; break; } acc += dur; }
        if (!seg) { this.rep = null; this.d.querySelector('.b3rep').style.opacity = 0; this.d.querySelector('.b3bars').style.opacity = 0; if (!R.hl) this.hlAdd({ k: 'goal', s: HLK.goal[0] + Math.random(), F: R.F.filter(function (f) { return f.t >= R.F[R.F.length - 1].t - HL.pre - HL.post - REP_POST; }), team: R.team, t: this.clock }); if (this.reelOn) this.reelNext(); else if (R.wr) this.wrNext(); }
        else { var ct = Math.min(seg[1], seg[0] + (T - acc) * seg[2]), fr = frameAt(R.F, R.F[0].t + ct); show = { p: fr.p, u: fr.u, o: fr.o, a: fr.a, c: fr.c, z: fr.z, gc: fr.gc, ft: ftAt(R.F, R.F[0].t + ct), sc: st.sc, sw: -1 }; this.d.querySelector('.b3rep').style.opacity = 1; this.poseCall('replay', R.kind || 'goal', ct, seg[2] < 1 ? 1 : 0, show); this.d.querySelector('.b3bars').style.opacity = this.phone ? 0 : 1;
          cam = this.persp; cam.aspect = W / H; cam.updateProjectionMatrix(); if (this.phone) this.phoneMir(1); this.shot(seg[3], fr, R, dt, seg !== R.cur); R.cur = seg; } } }
        if (MO && !R) {   // crazy-moment camera: swoops from high over the impact point down toward ice level as time slows
      if (this.phone) this.phoneMir(1); var Gq = this.G, P3 = function (x, y, h) { return Gq.localToWorld(L3(x, y, h)); }, c = MO.c, d = MO.dir, sd = MO.pt[0] < .5 ? 1 : -1, hi = P3(MO.pt[0] - d[0] * .15, MO.pt[1] - d[1] * .15, 1.25), lo = P3(MO.pt[0] - d[0] * .34 + sd * .12, MO.pt[1] - d[1] * .34, .085);
      cam = this.persp; cam.aspect = W / H; cam.fov = 50 - c * 8; var wp = hi.lerp(lo, c), wl = P3(MO.pt[0], MO.pt[1], .005); if (!this.mcs || this.lastCam !== this.persp) { this.mcs = { p: wp.clone() }; this.mls = { p: wl.clone() }; } else { camLim(this.mcs, wp, dt, CAMLIM.v * 2.5, CAMLIM.a * 3); camLim(this.mls, wl, dt, CAMLIM.lv, CAMLIM.la); } cam.position.copy(this.mcs.p); cam.up.set(0, 1, 0); cam.lookAt(this.mls.p); cam.updateProjectionMatrix(); }
this.cheerAnim(dt);
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
    cam = opt.cine != null ? this.cineCam(cam, st, opt.cine, dt, W, H) : this.domeCam(cam, st, opt.dome ? 1 : 0, dt, W, H);   // v0.9.41
    cam = this.fightCam(cam, st, dt, W, H);   // v0.9.40 fight: low side view
    cam = this.interCam(cam, st, dt, W, H);   // v0.9.48 period-end montage
    if (this.phone && st.ov >= 0 && !this.reelOn && !this.reelDone && !this.rep && (this.ovT = (this.ovT || 0) + dt) > 3) this.startReel(HL.reel); if (!(st.ov >= 0)) { this.ovT = 0; if (this.phone) this.reelDone = false; }
    this.pts.material.size = cam === this.ortho ? Math.max(4, this.V.s * .018) * Math.min(2, devicePixelRatio || 1) : .012; this.pts.material.sizeAttenuation = true;
    this.markers(cam, cam === this.ortho && (this.az || 1) > 1.05);
    var mwv = st.mw || 0, pyv = st.p[1], nowv = performance.now() / 1000; this.nets.forEach(function (n, k) { var ms = n.userData.mesh; if (ms) { var w = (k ? pyv > L / 2 : pyv < L / 2) ? mwv : 0, sx = ms.scale.x < 0 ? -1 : 1; ms.scale.set(sx * (1 + w * .12 * Math.sin(nowv * 38)), 1 + w * .05 * Math.sin(nowv * 31 + 1), 1 + w * .04 * Math.sin(nowv * 27)); } });
    // v0.9.24 board ping: sparks + flash at the contact, small board shake, knock sound (BPING tunable)
    if (st.bpg && this.lastBpg != null && st.bpg[0] !== this.lastBpg && !this.rep) { var bi = st.bpg[1], bq = B.pos(B.TR[bi], st.u[bi]), bo = st.o ? st.o[bi] : [0, 0], bx = bq[0] + bo[0] - st.bpg[2] * B.R * .5, by = bq[1] + bo[1] - st.bpg[3] * B.R * .5; this.emit(bx, by, .03, BPING.n, 0xfff2c0, BPING.sp, .35, 1); this.bShake = BPING.t; bthud(); }
    if (st.bpg) this.lastBpg = st.bpg[0];
    this.ripFx(st, dt);
    this.possFx(st, dt);
    if (this.bShake > 0) { this.bShake -= dt; var ka = Math.max(0, this.bShake / BPING.t) * BPING.amp, jx = (Math.random() - .5) * ka, jz = (Math.random() - .5) * ka; if (this.arena) { this.arena.position.x = L / 2 + jx; this.arena.position.z = .5 + jz; } (this.proc || []).forEach(function (m) { if (m.userData.p0 == null) m.userData.p0 = m.position.clone(); m.position.set(m.userData.p0.x + jx, m.userData.p0.y, m.userData.p0.z + jz); }); if (this.bShake <= 0) { if (this.arena) this.arena.position.set(L / 2, 0, .5); (this.proc || []).forEach(function (m) { if (m.userData.p0) m.position.copy(m.userData.p0); }); } }
    if ((st.ev === 'post' || st.ev === 'bar') && this.lastPing !== st) { this.lastPing = st; ping(); }
    if (st.wh != null && this.lastWh != null && st.wh !== this.lastWh) whistle(); this.lastWh = st.wh;
    var rep = !!this.rep; this.nets.forEach(function (n) { var l = n.userData.light; if (!l) return; if (l.t > 0) l.t -= dt; if (!rep) l.rep = false; l.on = l.t > 0 || l.rep;
      var k = l.on ? .75 + .25 * Math.sin(performance.now() / 90) : 0; l.dome.material.color.setHex(l.on ? 0xff3030 : 0x551018); l.spin.rotation.y += dt * 9; l.spin.children.forEach(function (b) { b.children[0].material.opacity = k * .8; }); l.halo.material.opacity = k * .9; });
    this.lastCam = cam; var dS = 0, D = this.dof; if (D && D.ok && this.dofOn && cam.isPerspectiveCamera) dS = R ? (R.hl ? DOFK.reel : R.cine && R.dofK != null ? R.dofK : DOFK.replay) : MO ? DOFK.replay * .7 : DOFK.live;
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
  // v0.9.27 ?hp012: rig 012 GLB (60 deform joints + 12-joint stick). Faces +Z in glTF (old skater faces -Z) -> yaw + PI. Clips: ready (faceoff wait),
  // idle (standing still), glide (skating, retargeted old pose), check (one-shot on own body check), stick (one-shot on swing / lunge). Falls back to player_skater.glb.
  // v0.9.28: player_hp012_v05.glb adds Justin's own mocap (m_idle, m_skate, m_fopose, m_fodraw, m_check); old clips stay as fallbacks, v04 GLB if v05 fails.
  var HPK = { url: 'player_hp012_v05.glb', drawRate: 1.2, yaw: Math.PI / 2 + Math.PI, h: .085, tint: .85, idleV: .02, idleT: .6, fade: 8, oneFade: 10, stickRate: 1.6, stickS: [1.2, 2.6], checkRate: 1.1 };
  R3.prototype.loadSkaters = function () { var self = this; if (!THREE.GLTFLoader || /noskaters/.test(location.search) || (this.phone && !/skaters=1/.test(location.search))) return;
    var go = function (cfg, hp, fail) { fetch(cfg.url).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
      self.pl.forEach(function (p, i) { var tr = B.TR[i]; if (tr.k === 'G') return;
        new THREE.GLTFLoader().parse(buf.slice(0), '', function (g) { var sticks = [], m = g.scene, box = new THREE.Box3().setFromObject(m), ht = box.max.y - box.min.y || 1.6, sc = cfg.h / ht;
          m.traverse(function (o) { if (!o.isMesh) return; o.frustumCulled = false; if (/^GK_/.test(o.name)) { o.material = new THREE.MeshStandardMaterial({ color: GGEAR.col(o.name, new THREE.Color(COLS[tr.t])), roughness: .55, side: THREE.DoubleSide }); return; } if (isG && GGEAR.on && /stick/i.test(o.name)) { o.visible = false; return; } if (/^stick$/i.test(o.name)) { o.material = o.material.clone(); sticks.push(o); return; } var mt = o.material; if (mt && mt.name === 'Jersey') { mt = o.material = mt.clone(); mt.color.set(COLS[tr.t]).lerp(new THREE.Color(0xffffff), 1 - cfg.tint); } });
          var wrap = new THREE.Group(); m.scale.setScalar(sc); m.rotation.y = cfg.yaw; wrap.add(m); p.add(wrap);
          var mix = new THREE.AnimationMixer(m), clip = function (n) { var c = THREE.AnimationClip.findByName(g.animations, n); return c && mix.clipAction(c); };
          if (hp) { var A = { glide: clip('m_skate') || clip('glide'), ready: clip('m_fopose') || clip('ready'), idle: clip('m_idle') || clip('idle'), check: clip('m_check') || clip('check'), stick: clip('stick'), draw: clip('m_fodraw') }, mfo = !!clip('m_fopose');
            if (!A.glide || !A.ready) { wrap.parent.remove(wrap); return; }
            ['glide', 'ready', 'idle'].forEach(function (n) { if (A[n]) { A[n].play(); A[n].setEffectiveWeight(n === 'glide' ? 1 : 0); } });
            ['check', 'stick', 'draw'].concat(mfo ? ['ready'] : []).forEach(function (n) { if (A[n]) { A[n].setLoop(THREE.LoopOnce, 1); A[n].clampWhenFinished = true; } });
            p.userData.sk = { m: wrap, mix: mix, hp: A, wb: { glide: 1, ready: 0, idle: 0 }, one: null, ow: 0, still: 0, sticks: sticks, lp: null };
          } else { var aG = clip('glide'), aF = clip('faceoff'); [aG, aF].forEach(function (a) { if (a) { a.play(); a.setEffectiveWeight(0); } }); if (aG) aG.setEffectiveWeight(1);
            p.userData.sk = { m: wrap, mix: mix, g: aG, f: aF, w: 0, sticks: sticks }; }
          p.userData.body.forEach(function (o) { o.visible = false; }); }, function () { if (fail && i === 0) fail(); }); }); }).catch(function () { if (fail) fail(); }); };
    var HPK4 = Object.assign({}, HPK, { url: 'player_hp012_v04.glb' });
    if (HP012) go(HPK, true, function () { if (self._hp5Fell) return; self._hp5Fell = true; self.pl.forEach(function (p) { var k = p.userData.sk; if (k && k.m.parent) k.m.parent.remove(k.m); p.userData.sk = null; }); go(HPK4, true, function () { if (!self._hpFell) { self._hpFell = true; self.pl.forEach(function (p) { var k = p.userData.sk; if (k && k.m.parent) k.m.parent.remove(k.m); p.userData.sk = null; }); go(SKATER, false); } }); }); else go(SKATER, false); };
  // v0.9.52 goalie gear: Justin's ReadyStance rig exported with the goalie stick (re-parented to Hand_R), blocker (Hand_R), catcher (Hand_L) and the two
  // leg pads (Shin_L / Shin_R) as bone children: goalie_gear_v01.glb. Goalies load it instead of the skater base model (no skater stick). ?ggear=0 = old model.
  var GGEAR = { on: !/[?&]ggear=0/.test(location.search), url: 'goalie_gear_v01.glb?b=952', col: function (n, team) { if (/Stk/.test(n)) return /Blade/.test(n) ? 0x222222 : 0xd9c7a0; if (/Pad/.test(n)) return 0xf4f4f4; return team.clone().lerp(new THREE.Color(0xffffff), .45); } }; R3.GGEAR = GGEAR;
  var AV = { dir: 'anim/v01/', base: 'HP_idle_ready_v01', clips: { idle: 'HP_idle_ready_v01', skate: 'HP_skate_stride_loop_v01', draw: 'HP_faceoff_draw_v01', slap: 'HP_onetimer_slap_v01', check: 'HP_body_check_v01',
      fstance: '../v02/HP_fight_stance_v01', phR: '../v02/HP_punch_high_R_v01', phL: '../v02/HP_punch_high_L_v01', plR: '../v02/HP_punch_low_R_v02', plL: '../v02/HP_punch_low_L_v01', dh: '../v02/HP_dodge_high_v01', dl: '../v02/HP_dodge_low_v01', esc: '../v02/HP_escape_lean_v01', grab: '../v02/HP_grab_jersey_v01', pull: '../v02/HP_grabbed_pullaway_v01' },   // v0.9.40 fight clips
    h: .085, yaw: Math.PI / 2, fade: .15, skateV: .012, minRate: .6, maxRate: 1.8, moveV: .006, lead: .06, cols: null };
  R3.prototype.loadAnim = function () { var self = this, ld = function (n) { return new Promise(function (ok) { new THREE.GLTFLoader().load(AV.dir + n + '.glb', ok, null, function () { ok(null); }); }); },
      meta = function (n) { return fetch(AV.dir + n + '.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }, keys = Object.keys(AV.clips);
    Promise.all(keys.map(function (k) { return Promise.all([ld(AV.clips[k]), meta(AV.clips[k])]); })).then(function (res) {
      var G = {}, M = {}; keys.forEach(function (k, j) { var g = res[j][0]; if (g && g.animations.length) { G[k] = new THREE.AnimationClip('a_' + k, -1, [].concat.apply([], g.animations.map(function (c) { return c.tracks; }))); } M[k] = res[j][1] || {}; });
      if (!G.idle) { console.warn('[anim] v01 clips missing, falling back'); self.loadSkaters(); return; }
      self.avMeta = M; var parsed = 0; self.gPoses = null;
      if (GPOSE.on) Promise.all(GPOSE.n.map(function (n) { return fetch(GPOSE.dir + 'G_' + n + '_v01.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); })).then(function (r) { if (r.every(Boolean)) { self.gPoses = {}; GPOSE.n.forEach(function (n, j) { self.gPoses[n] = r[j].bones; }); console.log('[anim] goalie poses on'); } });
      fetch(AV.dir + AV.base + '.glb').then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
      self.pl.forEach(function (p, i) { var tr = B.TR[i]; if (tr.k === 'G' && !GPOSE.on) return; var isG = tr.k === 'G';
        (isG && GGEAR.on ? function (cb) { new THREE.GLTFLoader().load(GGEAR.url, cb, null, function () { console.warn('[anim] goalie gear glb failed, base model'); new THREE.GLTFLoader().parse(buf.slice(0), '', cb, function () {}); }); } : function (cb) { new THREE.GLTFLoader().parse(buf.slice(0), '', cb, function () {}); })(function (g) { var m = g.scene, box = new THREE.Box3().setFromObject(m), ht = box.max.y - box.min.y || 1.8, sc = AV.h * PSC / ht, sticks = [], col = new THREE.Color(COLS[tr.t]);
        m.traverse(function (o) { if (!o.isMesh) return; o.frustumCulled = false; if (/^GK_/.test(o.name)) { o.material = new THREE.MeshStandardMaterial({ color: GGEAR.col(o.name, col), roughness: .55, side: THREE.DoubleSide }); return; } if (isG && GGEAR.on && /stick/i.test(o.name)) { o.visible = false; return; } if (/stick/i.test(o.name)) { o.material = new THREE.MeshStandardMaterial({ color: 0x8c5c2e, roughness: .7 }); sticks.push(o); }
          else if (/^Body/i.test(o.name)) o.material = new THREE.MeshStandardMaterial({ color: col, roughness: .6 }); else if (/^Head/i.test(o.name)) o.material = new THREE.MeshStandardMaterial({ color: 0xe8c39e, roughness: .8 }); });
        var wrap = new THREE.Group(); m.scale.setScalar(sc); m.rotation.y = AV.yaw; wrap.add(m); p.add(wrap);
        if (isG) { var gb = {}; m.traverse(function (o) { if (o.name && !gb[o.name]) gb[o.name] = o; }); p.userData.sk = { m: wrap, mm: m, av: null, gk: { b: gb, w: [0, 0], sc: sc }, sticks: sticks }; p.userData.body.forEach(function (o) { o.visible = false; }); parsed++; return; }
        var mix = new THREE.AnimationMixer(m), A = {}; for (var k in G) { A[k] = mix.clipAction(G[k]); if (k === 'idle' || k === 'skate' || k === 'fstance') { A[k].play(); A[k].setEffectiveWeight(k === 'idle' ? 1 : 0); A[k].time = Math.random() * G[k].duration; } else { A[k].setLoop(THREE.LoopOnce, 1); A[k].clampWhenFinished = true; } }
        p.userData.sk = { m: wrap, mix: mix, av: A, wb: { idle: 1, skate: 0, fstance: 0 }, one: null, ow: 0, sticks: sticks };
        p.userData.body.forEach(function (o) { o.visible = false; }); parsed++; }); }); }).catch(function () { console.warn('[anim] base model failed, falling back'); self.avMeta = null; self.loadSkaters(); });
      console.log('[anim] v01 on: ' + Object.keys(G).join(','));
    }); };
  R3.prototype.avPeg = function (p, on) { var k = p.userData.sk; if (!k) return; if (on && !k.peg) { var r = B.R * CYL.r, tr = B.TR[this.pl.indexOf(p)], g = new THREE.Group(),
      c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, CYL.h, 16), new THREE.MeshLambertMaterial({ color: COLS[tr.t] })); c.position.y = CYL.h / 2; g.add(c);
      var w = new THREE.Mesh(new THREE.CircleGeometry(r * CYL.mark, 3), new THREE.MeshBasicMaterial({ color: 0xffffff })); w.rotation.x = -Math.PI / 2; w.scale.set(1.25, .7, 1); w.position.y = CYL.h + .0015; g.add(w); p.add(g); k.peg = g; }
    if (k.peg) k.peg.visible = !!on; k.m.visible = !on; k.pegged = !!on; };
  R3.prototype.avSetTier = function (t, fps) { var q = this.avq, T = AVP.T[t]; q.tier = t; this.gl.setPixelRatio(Math.min(T.pr, devicePixelRatio || 1)); this.W = -1;
    var rec = { t: Date.now(), build: 'v0.9.46', tier: t, q: ZQ ? ZQ.tiers[t] : t, pr: T.pr, anim: T.n, fps: Math.round(fps || 0), ua: navigator.userAgent, scr: screen.width + 'x' + screen.height, dpr: devicePixelRatio, cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0 };
    console.log('[anim] phone tier ' + t + ' (pr ' + T.pr + ', animated ' + T.n + ') at ' + rec.fps + ' fps'); window.BH_ANIM_TIER = t;
    try { var L = JSON.parse(localStorage.getItem('bh-anim-perf') || '[]'); L.push(rec); localStorage.setItem('bh-anim-perf', JSON.stringify(L.slice(-100))); } catch (e) {}
    if (root.Perf) { root.Perf.anim = rec; if (root.Perf.cur) root.Perf.cur.anim = rec; } };
  R3.prototype.avFps = function (dt) { if (!this.phone || !this.avMeta || !(dt > 0) || dt > .5) return; var q = this.avq;
    if (!q) { var self = this; q = this.avq = { t: 0, n: 0, w: 0, tier: 0, fs: [] }; this.avSetTier(AVP.start, 0); if (ZQ) ZQ.onChange(function (t) { if (self.avMeta) self.avSetTier(t, ZQ.fps); }); }
    q.t += dt; if (q.t < AVP.warm) return; q.w += dt; q.n++; if (q.w < 1) return; var fps = q.n / q.w; q.w = 0; q.n = 0; window.BH_ANIM_FPS = fps;
    q.fs.push(fps); if (q.fs.length >= 10) { console.log('[anim] phone fps avg ' + Math.round(q.fs.reduce(function (a, b) { return a + b; }, 0) / q.fs.length) + ' tier ' + q.tier); q.fs = []; }
    if (ZQ) ZQ.sample(fps); };
  R3.prototype.avPick = function () { var q = this.avq, n = this.phone && q ? AVP.T[q.tier].n : 12, on = {}; if (n < 12 && n > 0 && this.puck) { var pp = this.puck.position, self = this,
      ix = []; this.pl.forEach(function (p, i) { if (p.userData.sk && (p.userData.sk.av || p.userData.sk.gk)) ix.push([p.position.distanceToSquared(pp), i]); }); ix.sort(function (a, b) { return a[0] - b[0]; }); ix.slice(0, n).forEach(function (x) { on[x[1]] = 1; }); }
    for (var i = 0; i < 12; i++) { var p = this.pl[i]; if (!p.userData.sk || !(p.userData.sk.av || p.userData.sk.gk)) continue; this.avPeg(p, n === 0 || (n < 12 && !on[i])); } };
  // ---- v0.9.49 procedural legs ----
  var LEGS = root.BH_LEGS = { on: !/[?&]legs=0/.test(location.search), vRun: .14, vMin: .012, vShuf: .05, cad0: 1.1, cad1: 2.6, amp0: .28, amp1: .6, lean: .3, crouch: .25,
      glideT: .35, turnW: 2.6, brakeA: 2.2, stopA: .9, stopV: .06, gLat: .025, gFly: .09, fade: 6, sprayN: 10 };
  var LB = ['Thigh_L', 'Shin_L', 'Foot_L', 'Toe_L', 'Thigh_R', 'Shin_R', 'Foot_R', 'Toe_R'], _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion(), _le = new THREE.Euler();
  // bone-local axes (measured): Thigh +X = hip flex (foot forward), Shin -X = knee bend, Hips +X = lean forward, Thigh_L +Z / Thigh_R -Z = leg out, Thigh Y = toe out (twist)
  var rot = function (b, x, y, z) { if (!b || !(x || y || z)) return; _le.set(x, y, z, 'XYZ'); b.quaternion.multiply(_lq.setFromEuler(_le)); };
  R3.prototype.legPose = function (st, dt) { if (!LEGS.on || !dt) return; var C = LEGS, rd = this.rep ? RSPD : 1;
    for (var i = 0; i < 12; i++) { var p = this.pl[i], k = p.userData.sk; if (!k || k.pegged || !(k.av || k.gk)) continue; var isG = !!k.gk;
      if (!k.lb) { k.lb = {}; var bb = k.gk ? k.gk.b : null; if (!bb) { bb = {}; k.m.traverse(function (o) { if (o.name && !bb[o.name]) bb[o.name] = o; }); } k.lb.b = bb; k.lb.sq = {}; LB.forEach(function (n) { if (bb[n]) k.lb.sq[n] = bb[n].quaternion.clone(); }); k.lb.ph = Math.random() * 6.3; k.lb.w = {}; k.lb.v = 0; k.lb.h = p.rotation.y; k.lb.co = 0; k.lb.sp = 0; }
      var Lg = k.lb, b = Lg.b; if (isG && !this.gPoses) continue;
      if (Lg.pre) for (var rn in Lg.pre) { var rb = b[rn]; if (rb && rb.quaternion.equals(Lg.last[rn])) rb.quaternion.copy(Lg.pre[rn]); }   // nobody reset this bone since our last write: undo it (no drift)
      Lg.pre = {}; Lg.last = {}; LB.concat(['Hips']).forEach(function (n) { if (b[n]) Lg.pre[n] = b[n].quaternion.clone(); });
      var sp = this.spr && this.spr[i], vx = sp ? sp.vx : 0, vz = sp ? sp.vz : 0, v = Math.hypot(vx, vz), hy = p.rotation.y, fx = Math.cos(hy), fz = -Math.sin(hy);
      var vf = vx * fx + vz * fz, vl = -vx * fz + vz * fx, acc = (v - Lg.v) / dt, dh = Math.atan2(Math.sin(hy - Lg.h), Math.cos(hy - Lg.h)) / dt; Lg.v = v; Lg.h = hy;
      Lg.acc = (Lg.acc || 0) + (acc - (Lg.acc || 0)) * Math.min(1, dt * 8); Lg.turn = (Lg.turn || 0) + (dh - (Lg.turn || 0)) * Math.min(1, dt * 6);
      var off = (this.ftIdx && this.ftIdx[i] != null) || (st && ((st.kd && st.kd[i] > 0) || (st.dn && st.dn[i] > 0))), W = off ? 0 : 1 - (k.ow || 0) * .6, e = Math.min(1, dt * C.fade);
      Lg.W = (Lg.W == null ? W : Lg.W) + (W - (Lg.W == null ? W : Lg.W)) * e; if (Lg.W < .01) { Lg.pre = null; continue; }
      // targets (0..1) for each mode, smoothed
      var vn = Math.min(1.3, v / C.vRun), mov = v > C.vMin ? 1 : 0, stop = !isG && Lg.acc < -C.stopA && v > C.stopV ? 1 : 0; Lg.co = Lg.acc < .05 && v > C.vShuf ? Lg.co + dt : 0;
      var tg = isG ? { sh: Math.min(1, Math.abs(vl) / C.gLat) * (Math.abs(vl) < C.gFly ? 1 : 0), bf: Math.abs(vl) >= C.gFly || (st && st.gr && st.gr[B.TR[i].t]) ? 1 : 0 }
        : { st: mov && v >= C.vShuf && !stop ? 1 : 0, sh: mov && v < C.vShuf ? 1 : 0, gl: Lg.co > C.glideT && !stop ? 1 : 0, cx: Math.abs(Lg.turn) > C.turnW && v > C.vShuf ? 1 : 0, sp: stop, bk: stop && Lg.acc < -C.brakeA ? 1 : 0 };
      if (tg.bk && !(Lg.w.bk > .1)) Lg.bks = vl >= 0 ? 1 : -1;   // v0.9.53 hard sideways stop: hips turn 90 deg across the travel
      for (var n in tg) { Lg.w[n] = (Lg.w[n] || 0) + (tg[n] - (Lg.w[n] || 0)) * e; }
      var w = Lg.w, ws = w.st || 0, wg = w.gl || 0, push = ws * (1 - wg);
      // phase: cadence scales with speed (shuffle quick and small)
      var cad = isG ? 3 + Math.abs(vl) * 20 : (ws > (w.sh || 0) ? C.cad0 + (C.cad1 - C.cad0) * Math.min(1, vn) : 2.6); Lg.ph += dt * rd * cad * Math.PI * 2 * Math.max(push, w.sh || 0, isG ? w.sh || 0 : 0, .0001 + (1 - wg) * .0);
      // 1) pull leg bones to the square stance (feet under the player) by layer weight, keep whatever is above the hips
      if (!isG) for (var bn in Lg.sq) { var bo = b[bn]; if (bo) bo.quaternion.slerp(Lg.sq[bn], Lg.W); }
      var ww = Lg.W * this.footSync(k, Lg, dt, v);
      if (!isG) { var A = (C.amp0 + (C.amp1 - C.amp0) * Math.min(1, vn)) * push + .12 * (w.sh || 0), cr = C.crouch * Math.min(1, vn) * ws + .1 * wg + .35 * (w.sp || 0);
        for (var sd = 0; sd < 2; sd++) { var L = sd === 0, sg = L ? 1 : -1, ph = Lg.ph + sd * Math.PI, kick = Math.max(0, Math.sin(ph)), rec = Math.max(0, -Math.sin(ph)), T = b[L ? 'Thigh_L' : 'Thigh_R'], S = b[L ? 'Shin_L' : 'Shin_R'], F = b[L ? 'Foot_L' : 'Foot_R'];
          // stride: kick back + out (push), recover forward with knee lift; glide = both knees soft, legs together; crouch deepens with speed
          var tx = -A * kick + A * .55 * rec + cr * .7, tz = sg * A * .55 * kick, sx = -A * .9 * rec - cr * 1.2 - .15 * kick * A, fxr = cr * .45 + A * .3 * kick;
          // crossover hint: outside leg steps over the inside one on a hard turn
          var cs = Lg.turn > 0 ? -1 : 1, outside = (L ? 1 : -1) === cs, cw = w.cx || 0; if (outside) { tz -= sg * .45 * cw * rec; tx += .25 * cw * rec; } else tz += sg * .12 * cw;
          // hockey stop: both feet turned sideways, knees bent, weight back
          var stw = Math.max(w.sp || 0, (w.bk || 0) * 1.25), ty = sg * .9 * stw * (L ? 1 : .8);
          rot(T, tx * ww, ty * ww, tz * ww); rot(S, sx * ww, 0, 0); rot(F, fxr * ww, 0, 0); }
        if ((w.bk || 0) > .02) rot(b.Hips, -.3 * w.bk * ww, (Lg.bks || 1) * 1.2 * w.bk * ww, 0);
        this.skateRef(k, Lg, v, ww);
        rot(b.Hips, (C.lean * Math.min(1, vn) * ws - .22 * (w.sp || 0)) * ww, 0, 0);
        if ((w.sp || 0) > .5 && !Lg.spr && sp) { Lg.spr = 1; this.emit(sp.z, sp.x, .004, C.sprayN, 0xf4fbff, .25, .45, 1); } if ((w.sp || 0) < .2) Lg.spr = 0; }
      else { var gLib = k.gk && k.gk.lib, bfw = gLib ? 0 : w.bf || 0, shw = (w.sh || 0) * (1 - bfw) * (gLib ? k.gk.shuf : 1), dir = vl > 0 ? 1 : -1;
        for (var gs = 0; gs < 2; gs++) { var GL = gs === 0, gsg = GL ? 1 : -1, gph = Lg.ph + gs * Math.PI, st1 = Math.max(0, Math.sin(gph)) * shw, lead = (GL ? 1 : -1) === dir ? 1 : 0;
          // shuffle: lead pad steps out, trail pad follows; butterfly: knees in and down, pads flared out
          rot(b[GL ? 'Thigh_L' : 'Thigh_R'], (.35 * bfw + .1 * st1) * ww, (-gsg * .9 * bfw) * ww, (gsg * (.18 * st1 * (lead ? 1.4 : .6) + .5 * bfw)) * ww);
          rot(b[GL ? 'Shin_L' : 'Shin_R'], (-1.3 * bfw - .25 * st1) * ww, 0, (gsg * .35 * bfw) * ww); } }
      for (var ln in Lg.pre) Lg.last[ln] = b[ln].quaternion.clone(); } };
  // optional authored pose library: anim/poses_v01/index.json = ["label", ...] -> HP_<label>_v01.json { bones: { Name: [qx,qy,qz,qw(,px,py,pz)] } }
  var PLIB = { dir: 'anim/poses_v01/', legs: /^(Thigh|Shin|Foot|Toe|IK_Thigh|IK_Shin|IKC_Foot|POLE_Leg|MCH_(Heel|Tip|Ball|FootIK|ToeIK))/ }; R3.PLIB = PLIB;
  R3.prototype.loadPoses = function () { var self = this; this.poses = {}; fetch(PLIB.dir + 'index.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (L0) {
      (Array.isArray(L0) ? L0 : (L0 && L0.poses) || []).forEach(function (n) { fetch(PLIB.dir + (/^(G|HP)_/.test(n) ? n : 'HP_' + n) + '_v01.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) { if (j && j.bones) { self.poses[n] = j.bones; self.poseMeta = self.poseMeta || {}; self.poseMeta[n] = j; } }); }); }); };
  // blend a library pose onto player i (weight w); leg bones are skipped, the leg layer owns them. Call from root.BH_POSE_HOOK.
  R3.prototype.applyPose = function (i, label, w) { var P = this.poses && this.poses[label], k = this.pl[i] && this.pl[i].userData.sk; if (!P || !k) return false; w = w == null ? 1 : w;
    var bb = (k.lb && k.lb.b) || (k.gk && k.gk.b); if (!bb) { bb = {}; k.m.traverse(function (o) { if (o.name && !bb[o.name]) bb[o.name] = o; }); k.lb = k.lb || null; }
    for (var n in P) { if (PLIB.legs.test(n)) continue; var b = bb[n], a = P[n]; if (!b) continue; b.quaternion.slerp(_lq2.set(a[0], a[1], a[2], a[3]), w); if (a.length > 4 && n !== 'Hips' && n !== 'COG') b.position.lerp(new THREE.Vector3(a[4], a[5], a[6]), w); } return true; };
  // ---- v0.9.53 pose hooks (all optional data; missing poses = procedural fallback) ----
  // FOOT MARKERS: any pose in poses_v01/index.json may carry meta {foot:'Lback'|'Rback'|'square', step:'L'|'R', lower:0..1}. When the pose plays (applyPose w > .3) the
  // leg layer pulls its stride phase so that foot is the pushing (back) one, 'square' quiets the stride, step = one quick step on that foot, lower = how much the
  // authored pose owns the legs (0 = procedural legs, 1 = authored legs). Clip keys may do the same: meta.keys = [{t, foot, step, lower}] (t s from the clip start).
  var FTV2 = { twist: .55, byR: .2, byPush: .07, byT: .5 }, SK = { lv: ['gentle', 'medium', 'fast'], vv: [.3, .75, 1.15], w: .85 }, SHT = { wind: .38, fr: 1 / 30, hit: .06, fol: .4, back: .25, late: .12, win: .25 };
  R3.FTV2 = FTV2; R3.SK = SK; R3.SHT = SHT;
  var oAP = R3.prototype.applyPose; R3.prototype.applyPose = function (i, label, w) { var r = oAP.call(this, i, label, w), M = this.poseMeta && this.poseMeta[label], k = this.pl[i] && this.pl[i].userData.sk;
    if (r && M && k && (w == null || w > .3) && (M.foot || M.step || M.lower != null)) this.footMark(i, M); return r; };
  R3.prototype.footMark = function (i, m) { var k = this.pl[i] && this.pl[i].userData.sk; if (!k) return; var o = k.fm || (k.fm = {}); o.foot = m.foot || o.foot; o.lower = m.lower != null ? m.lower : o.lower; o.at = this.clock || 0; if (m.step && m.step !== o.stepS) { o.step = m.step; o.stepT = .25; } o.stepS = m.step; };
  R3.prototype.footSync = function (k, Lg, dt, v) { var f = k.fm; if (!f || (this.clock || 0) - f.at > .4) return 1; var tgt = f.foot === 'Lback' ? Math.PI / 2 : f.foot === 'Rback' ? Math.PI * 1.5 : null;
    if (tgt != null) { var d = Math.atan2(Math.sin(tgt - Lg.ph), Math.cos(tgt - Lg.ph)); Lg.ph += d * Math.min(1, dt * 8); }
    if (f.stepT > 0) { f.stepT -= dt; Lg.ph += (f.step === 'L' ? 1 : -1) * dt * 6; }
    return (1 - (f.lower || 0)) * (f.foot === 'square' ? .4 : 1); };
  // SKATE REFERENCES: HP_skate_gentle|medium|fast _L / _R (left / right kickoff; or meta.foot 'Lback'/'Rback') = authored leg positions per stride state. Blended by actual speed
  // (SK.vv = speed in run units where each level is full) and by stride phase between the L and R kickoffs, laid over the procedural stride (weight SK.w).
  R3.prototype.skateRef = function (k, Lg, v, ww) { var P = this.poses, M = this.poseMeta || {}; if (!P) return; var refs = [];
    SK.lv.forEach(function (n, li) { var l = P['HP_skate_' + n + '_L'], r = P['HP_skate_' + n + '_R'], b0 = P['HP_skate_' + n];
      if (!l && b0 && M['HP_skate_' + n] && M['HP_skate_' + n].foot === 'Lback') l = b0; if (!r && b0 && M['HP_skate_' + n] && M['HP_skate_' + n].foot === 'Rback') r = b0; if (l && r) refs.push([SK.vv[li], l, r]); });
    if (!refs.length) return; var vn = v / LEGS.vRun, a = refs[0], b = refs[0], f = 0; for (var q = 0; q < refs.length; q++) { if (refs[q][0] <= vn) a = refs[q]; if (refs[q][0] >= vn) { b = refs[q]; break; } b = refs[q]; }
    if (b !== a) f = Math.max(0, Math.min(1, (vn - a[0]) / (b[0] - a[0]))); var u = (Math.sin(Lg.ph) + 1) / 2, mv = Math.min(1, v / LEGS.vMin / 2), W = SK.w * ww * mv;
    var bb = Lg.b; LB.concat(['Hips']).forEach(function (n) { var bo = bb[n]; if (!bo) return; var x = [a[1][n], a[2][n], b[1][n], b[2][n]]; if (!x[0] || !x[1] || !x[2] || !x[3]) return;
      _lq.set(x[1][0], x[1][1], x[1][2], x[1][3]).slerp(_lq2.set(x[0][0], x[0][1], x[0][2], x[0][3]), u); var qb = new THREE.Quaternion(x[3][0], x[3][1], x[3][2], x[3][3]).slerp(new THREE.Quaternion(x[2][0], x[2][1], x[2][2], x[2][3]), u);
      _lq.slerp(qb, f); bo.quaternion.slerp(_lq, W); }); Lg.ref = [a[0], b[0], Math.round(f * 100) / 100]; };
  // RELATIVE DIRECTION: where a rink point (x, y) is from player i: 'front' | 'left' | 'right' | 'behind' (+ angle a, rad, + = his left). Used by transitions and hooks.
  // GRADED MISSES (no shot after the puck went by): closest approach H.md vs MISS (rink units, blade/capture circle ~ .03): far = clean blend back ('back'), near = light
  // wobble follow-through while skating ('wobble'), within inches = full swing at air ('air'), extreme near miss x MISS.fall chance = off-balance fall ('fall': tumble on the
  // existing rig, then HP_getup_back / HP_getup_front blended into skating; the sim keeps steering him on his peg/control path so he rejoins it in an arc).
  var MISS = { near: .07, inch: .03, xtr: .015, fall: .03, fallT: .75, upT: .7 }; R3.MISS = MISS;
  R3.prototype.shotMiss = function (H, st) { var d = H.md == null ? 9 : H.md; H.t = 0; H.ph = d > MISS.near ? 'back' : d > MISS.inch ? 'wobble' : (d < MISS.xtr && Math.random() < (root.BH_MISSFALL != null ? root.BH_MISSFALL : MISS.fall)) ? 'fall' : 'air';
    if (H.ph === 'fall') { H.face = Math.random() < .5 ? 'back' : 'front'; H.sd = Math.random() < .5 ? 1 : -1; } try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'shot', phase: 'miss', grade: H.ph, d: d, players: [{ i: H.i, g: this.pl[H.i] }] }); } catch (e) { } };
  R3.prototype.shotFall = function (H, st, rd) { var p = this.pl[H.i], k = p && p.userData.sk, m = k && k.m; if (!m) { this.shT = null; return; }
    if (H.ph === 'fall') { var u = Math.min(1, H.t / MISS.fallT), e = Math.sin(Math.min(1, u * 1.6) * Math.PI / 2);   // simple tumble: tip over, bounce, settle
      m.rotation.x = (H.face === 'back' ? -1 : 1) * 1.35 * e + Math.sin(u * 14) * .08 * (1 - u); m.rotation.z = H.sd * .35 * e; m.position.y = -Math.abs(Math.sin(u * 9)) * .002 * (1 - u);
      if (H.t > MISS.fallT) { H.ph = 'getup'; H.t = 0; } }
    else { var g = Math.min(1, H.t / MISS.upT), ez = g * g * (3 - 2 * g); m.rotation.x = (H.face === 'back' ? -1 : 1) * 1.35 * (1 - ez); m.rotation.z = H.sd * .35 * (1 - ez); m.position.y = 0;
      this.applyPose(H.i, 'HP_getup_' + H.face, 1 - ez); if (g >= 1) { m.rotation.x = m.rotation.z = 0; this.shT = null; } }
    try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: H.ph, face: H.face, t: H.t, players: [{ i: H.i, g: p }] }); } catch (e) { } };
  // HAIL-MARY DIVE: a sustained hard slide (|du/dt| > DIVE.v for DIVE.t s) toward a loose puck (st.c < 0) within DIVE.r, or across a shot lane (block attempt) =
  // dive that way: HP_dive_1..3 in sequence (+ procedural lean placeholder), BH_POSE_HOOK {mode:'dive', dir, kind:'loose'|'block'}. Visual only (scoring untouched).
  var DIVE = { on: !/[?&]dive=0/.test(location.search), v: .9, t: .3, r: .16, T: .9, cd: 2.5 }; R3.DIVE = DIVE;
  R3.prototype.diveStep = function (st, dt) { if (!DIVE.on || !st || !st.u || this.ftIdx || this.rep) return; var D = this.dv || (this.dv = { u: st.u.slice(), h: st.u.map(function () { return 0; }), cd: st.u.map(function () { return 0; }), on: {} });
    for (var i = 0; i < st.u.length; i++) { var p = this.pl[i], du = dt > 0 ? (st.u[i] - D.u[i]) / dt : 0; D.u[i] = st.u[i]; D.cd[i] -= dt; if (!p || B.TR[i].k === 'G') continue;
      D.h[i] = Math.abs(du) > DIVE.v ? D.h[i] + dt : 0; var O = D.on[i];
      if (!O && D.h[i] > DIVE.t && D.cd[i] <= 0) { var P = p.position, dx = st.p[0] - P.z, dy = st.p[1] - P.x, dd = Math.hypot(dx, dy), pv = st.pv || [0, 0], kind = null;
        if (st.c < 0 && dd < DIVE.r) kind = Math.hypot(pv[0], pv[1]) > .6 && B.TR[i].t !== (st.to >= 0 ? B.TR[st.to].t : -1) ? 'block' : 'loose';
        if (kind) { O = D.on[i] = { t: 0, s: du > 0 ? 1 : -1, kind: kind, dir: this.relDir(i, st.p[0], st.p[1]).dir }; D.cd[i] = DIVE.cd; } }
      if (O) { O.t += dt; var u = O.t / DIVE.T, k = p.userData.sk, m = k && k.m, n = Math.min(3, 1 + Math.floor(u * 3)), lean = Math.sin(Math.min(1, u) * Math.PI);
        if (m) m.rotation.z = O.s * .9 * lean; this.applyPose(i, 'HP_dive_' + n, lean); try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'dive', step: n, kind: O.kind, dir: O.dir, players: [{ i: i, g: p }] }); } catch (e) { }
        if (u >= 1) { if (m) m.rotation.z = 0; delete D.on[i]; } } } };
  // KNOCKED OFF THE PEG (st.dn / st.kd): a sheared-metal stub stays on the ice where he left the peg (fades PEG.stubT s). The sim keeps the player on his peg (link never
  // lost); the view slides his body off on residual momentum, then on the get-up: control eases in over PEG.ctrlN frames, he sprints (PEG.vmax) back to the (possibly
  // moving) peg along an arc. PEG.longP of returns go the long way round the nearest player; passing within PEG.near of someone = HP_frustrate_L|R|F (by relDir) on him
  // and HP_stumble_shove for a few frames on the bystander (BH_POSE_HOOK {mode:'frustrate'} / {mode:'shove'}).
  var PEG = { on: !/[?&]pegfx=0/.test(location.search), stubT: 4, fric: 1.6, push: 1, ctrlN: 4, vmax: .55, arc: .9, longP: .08, near: .035, shoveT: .15, maxR: .25, jumpR: .06, jumpT: .5, jumpH: .035, splay: .7, settleT: .45, spring: [90, 7] }; R3.PEG = PEG;
  R3.prototype.pegStep = function (st, dt) { if (!PEG.on || !st || !st.dn || this.rep || !(dt > 0)) return; var me = this, R = this.pr || (this.pr = { o: {}, pv: {}, stubs: [], sh: {} });
    for (var i = 0; i < this.pl.length; i++) { var p = this.pl[i]; if (!p || !B.TR[i] || B.TR[i].k === 'G') continue; var P = p.position, down = st.dn[i] > 0 || (st.kd && st.kd[i] > 0), O = R.o[i], q = R.pv[i];
      var vx = q ? (P.z - q[0]) / dt : 0, vy = q ? (P.x - q[1]) / dt : 0; R.pv[i] = [P.z, P.x];
      if (down && !O) { O = R.o[i] = { ph: 'down', x: 0, y: 0, vx: vx * PEG.push, vy: vy * PEG.push, n: 0 }; this.pegStub(P.z, P.x); }
      if (!O) continue;
      if (O.ph === 'down') { if (!down) { O.ph = 'get'; O.n = 0; var r0 = Math.hypot(O.x, O.y), lg = Math.random() < PEG.longP; O.sg = Math.random() < .5 ? 1 : -1;
          if (lg) { var bj = -1, bd = 9; for (var j = 0; j < this.pl.length; j++) if (j !== i && this.pl[j]) { var dd = Math.hypot(this.pl[j].position.z - (P.z + O.x), this.pl[j].position.x - (P.x + O.y)); if (dd < bd) { bd = dd; bj = j; } } O.lg = bj; O.arc = Math.PI * .9; } else O.arc = PEG.arc; O.a0 = Math.atan2(O.y, O.x); O.r0 = r0 || 1e-3; O.k = 0; } }
      var e = Math.exp(-dt * PEG.fric);
      if (O.ph === 'down') { O.x += O.vx * dt; O.y += O.vy * dt; O.vx *= e; O.vy *= e; }
      else { O.n++; var c = Math.min(1, O.n / PEG.ctrlN); O.x += O.vx * dt * (1 - c); O.y += O.vy * dt * (1 - c); O.vx *= e; O.vy *= e;   // residual slide fades as control eases in
        if (O.ph === 'jump' || O.ph === 'land') { this.pegJump(i, O, P, dt); if (O.done) { delete R.o[i]; continue; } }
        else if (c >= 1) { if (O.k === 0) { O.a0 = Math.atan2(O.y, O.x); O.r0 = Math.hypot(O.x, O.y) || 1e-3; } O.k = Math.min(1, O.k + dt * PEG.vmax / (O.r0 * (1 + O.arc * .6))); var r = O.r0 * (1 - O.k), a = O.a0 + O.sg * O.arc * Math.sin(O.k * Math.PI) * .5 + O.sg * O.arc * O.k * 0; O.x = Math.cos(a) * r; O.y = Math.sin(a) * r;
          if (!O.fr) for (var j2 = 0; j2 < this.pl.length; j2++) { var pj = this.pl[j2]; if (j2 === i || !pj || R.o[j2]) continue; if (Math.hypot(pj.position.z - (P.z + O.x), pj.position.x - (P.x + O.y)) < PEG.near) { O.fr = 1; var rd = this.relDir(i, pj.position.z, pj.position.x).dir, lab = 'HP_frustrate_' + (rd === 'left' ? 'L' : rd === 'right' ? 'R' : 'F'); O.frL = lab; O.frT = .5; R.sh[j2] = PEG.shoveT;
              try { if (root.BH_POSE_HOOK) { root.BH_POSE_HOOK(this, { mode: 'frustrate', pose: lab, dir: rd, players: [{ i: i, g: p }], target: j2 }); root.BH_POSE_HOOK(this, { mode: 'shove', pose: 'HP_stumble_shove', players: [{ i: j2, g: pj }], by: i }); } } catch (er) { } break; } }
          if (Math.hypot(O.x, O.y) < PEG.jumpR || O.k >= 1) { O.ph = 'jump'; O.jt = 0; O.jx = O.x; O.jy = O.y; } } }
      var m = Math.hypot(O.x, O.y); if (m > PEG.maxR) { O.x *= PEG.maxR / m; O.y *= PEG.maxR / m; } P.z += O.x; P.x += O.y; R.pv[i] = [P.z - O.x, P.x - O.y];
      if (O.frT > 0) { O.frT -= dt; this.applyPose(i, O.frL, Math.min(1, O.frT * 4)); } }
    for (var k in R.sh) { if (R.sh[k] <= 0) { delete R.sh[k]; continue; } R.sh[k] -= dt; var b = this.pl[k]; if (b) { b.position.x += Math.sin(R.sh[k] * 60) * .003; this.applyPose(+k, 'HP_stumble_shove', 1); } }
    R.stubs = R.stubs.filter(function (S) { S.t += dt; var a = 1 - Math.max(0, (S.t - PEG.stubT * .6) / (PEG.stubT * .4)); S.m.material.opacity = a; if (a <= 0) { me.G.remove(S.m); S.m.geometry.dispose(); S.m.material.dispose(); return false; } return true; }); };
  // PEG JUMP: close to his peg he leaps back on: HP_pegjump_launch -> _air (legs splay out then fold in) -> _land (limbs flop down, settle on springs into his exact play
  // position + facing; the sim position is the target so it always ends exact). Placeholder = damped springs (PEG.spring = [stiffness, damping]) on arms, legs and head.
  R3.prototype.pegJump = function (i, O, P, dt) { var p = this.pl[i], k = p.userData.sk, bb = (k && k.lb && k.lb.b) || {}, S = O.sp || (O.sp = { x: 0, v: 0 }), K = PEG.spring;
    O.jt += dt; var hk = function (ph, u) { try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'pegjump', phase: ph, u: u, players: [{ i: i, g: p }] }); } catch (e) { } }.bind(this);
    if (O.ph === 'jump') { var u = Math.min(1, O.jt / PEG.jumpT), ez = u * u * (3 - 2 * u); O.x = O.jx * (1 - ez); O.y = O.jy * (1 - ez); P.y += Math.sin(u * Math.PI) * PEG.jumpH;
      var sp = Math.sin(Math.min(1, u * 1.8) * Math.PI) * PEG.splay * (u < .55 ? 1 : 1 - (u - .55) / .45);   // splay out, then fold in
      if (bb.Thigh_L) bb.Thigh_L.rotateZ(-sp); if (bb.Thigh_R) bb.Thigh_R.rotateZ(sp); if (bb.Shin_L) bb.Shin_L.rotateX(sp * .8); if (bb.Shin_R) bb.Shin_R.rotateX(sp * .8);
      var lab = u < .2 ? 'HP_pegjump_launch' : 'HP_pegjump_air'; this.applyPose(i, lab, 1); hk(u < .2 ? 'launch' : 'air', u); S.v -= dt * 3 * Math.cos(u * Math.PI);   // limbs lag the rise / fall
      if (u >= 1) { O.ph = 'land'; O.jt = 0; S.v += 2.2; } }
    else { O.x = O.y = 0; var a = -K[0] * S.x - K[1] * S.v; S.v += a * dt; S.x += S.v * dt; this.applyPose(i, 'HP_pegjump_land', Math.max(0, 1 - O.jt / PEG.settleT)); hk('land', O.jt / PEG.settleT);
      if (O.jt > PEG.settleT * 2 && Math.abs(S.x) < .002) O.done = 1; }
    var f = S.x; ['UpperArm_L', 'UpperArm_R', 'Head', 'Thigh_L', 'Thigh_R'].forEach(function (n, q) { var b = bb[n]; if (b) b.rotateX(f * (q === 2 ? .35 : q > 2 ? .25 : .6)); }); };
  R3.prototype.pegStub = function (x, y) { var R = this.pr; if (R.stubs.length > 6) return; var g = new THREE.CylinderGeometry(.0035, .004, .006, 7, 1, false), pos = g.attributes.position;
    for (var v = 0; v < pos.count; v++) if (pos.getY(v) > 0) pos.setY(v, .003 + (Math.sin(v * 2.7) * .5 + .5) * .004 * (pos.getX(v) > 0 ? 1 : .4));   // sheared, jagged top
    g.computeVertexNormals(); var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .9, roughness: .35, transparent: true })); m.position.copy(L3(x, y, .002)); m.rotation.y = Math.random() * 6; this.G.add(m); R.stubs.push({ m: m, t: 0 }); };
  R3.prototype.relDir = function (i, x, y) { var p = this.pl[i]; if (!p) return { dir: 'front', a: 0 }; var hy = p.rotation.y, fx = Math.cos(hy), fz = -Math.sin(hy), dx = y - p.position.x, dz = x - p.position.z;
    var fw = dx * fx + dz * fz, lt = -dx * fz + dz * fx, a = Math.atan2(lt, fw), A = Math.abs(a); return { dir: A < Math.PI / 4 ? 'front' : A > Math.PI * .75 ? 'behind' : a > 0 ? 'left' : 'right', a: a }; };
  R3.relDirOf = function (fwdX, fwdY, tx, ty) { var a = Math.atan2(fwdX * ty - fwdY * tx, fwdX * tx + fwdY * ty), A = Math.abs(a); return A < Math.PI / 4 ? 'front' : A > Math.PI * .75 ? 'behind' : a > 0 ? 'left' : 'right'; };
  // ARRIVAL-TIMED SHOTS: pass on its way (st.to = receiver, st.pv = puck velocity): predict arrival on his blade, ramp HP_shot_windup so it is full SHT.fr (1 frame) before
  // arrival, HP_shot_impact (stick bend) at contact, then HP_shot_follow if he shoots (st.sht) within SHT.win s, else blend back to skating over SHT.back s.
  // Arrival already closer than SHT.late s when first seen = off-balance: HP_shot_catchweight instead of the follow. BH_POSE_HOOK gets {mode:'shot', phase, w, dir}.
  R3.prototype.shotTime = function (st, dt) { if (!st || this.ftIdx) { this.shT = null; return; } var H = this.shT, rd = (dt || 0) * (this.rep ? RSPD : 1), to = st.to, pv = st.pv;
    if (to >= 0 && st.c < 0 && pv && Math.hypot(pv[0], pv[1]) > .2 && this.pl[to]) { var P = this.pl[to].position, rx = P.z - st.p[0], ry = P.x - st.p[1], v2 = pv[0] * pv[0] + pv[1] * pv[1], ta = (rx * pv[0] + ry * pv[1]) / v2;
      if (!H || H.i !== to || H.ph === 'follow' || H.ph === 'back') H = this.shT = { i: to, ph: 'windup', late: ta < SHT.late, t: 0, ta: ta }; else H.ta = ta; }
    if (!H) return; H.t += rd; var w = 0; if (H.ph === 'windup' || H.ph === 'impact') { var Pp = this.pl[H.i].position, md = Math.hypot(Pp.z - st.p[0], Pp.x - st.p[1]); H.md = Math.min(H.md == null ? 9 : H.md, md); }
    if (H.ph === 'fall' || H.ph === 'getup') return this.shotFall(H, st, rd);
    if (H.ph === 'windup') { if (st.to !== H.i && st.c !== H.i) { H.ph = 'back'; H.t = 0; } else { H.ta -= 0; var lead = H.ta - SHT.fr; w = Math.max(0, Math.min(1, 1 - lead / SHT.wind)); w = w * w * (3 - 2 * w); if (H.ta <= 0 || st.c === H.i) { H.ph = 'impact'; H.t = 0; } } }
    if (H.ph === 'impact') { w = 1; var sh = st.sht && st.sht[1] === H.i && st.sht[0] !== this.shSeen; if (sh) { this.shSeen = st.sht[0]; H.ph = 'follow'; H.t = 0; } else if (H.t > SHT.win) { this.shotMiss(H, st); } }
    if (H.ph === 'fall' || H.ph === 'getup') return;
    if (H.ph === 'wobble') { w = .5 * (1 - H.t / SHT.fol) * (1 + .3 * Math.sin(H.t * 30)); if (H.t > SHT.fol) { this.shotT = null; this.shT = null; return; } H.lab0 = 'HP_shot_follow'; }
    if (H.ph === 'air') { w = 1 - Math.max(0, (H.t - SHT.fol * .7) / (SHT.fol * .5)); if (H.t > SHT.fol * 1.2) { this.shT = null; return; } }
    if (H.ph === 'follow') { w = 1 - Math.max(0, (H.t - SHT.fol * .6) / (SHT.fol * .4)); if (H.t > SHT.fol) { this.shT = null; return; } }
    if (H.ph === 'back') { w = 1 - H.t / SHT.back; if (w <= 0) { this.shT = null; return; } }
    var lab = H.ph === 'wobble' || H.ph === 'air' ? 'HP_shot_follow' : H.ph === 'windup' ? 'HP_shot_windup' : H.ph === 'impact' ? 'HP_shot_impact' : H.ph === 'follow' ? (H.late ? 'HP_shot_catchweight' : 'HP_shot_follow') : 'HP_shot_windup';
    if (!this.applyPose(H.i, lab, w) && lab === 'HP_shot_catchweight') this.applyPose(H.i, 'HP_shot_follow', w);
    H.w = Math.round(w * 100) / 100; H.lab = lab; try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'shot', phase: H.ph, late: H.late, w: w, t: H.ta, players: [{ i: H.i, g: this.pl[H.i] }], dir: this.relDir(H.i, st.p[0], st.p[1]).dir }); } catch (e) { } };
  // FIGHT ROLE POSES: the sim's combo move (st.ft.mv / la, Bubble.CB.mv[move].poses = {anticipation, hit, recovery}) picks the role by time since the tap; the pose plays
  // over the clip when it exists (BH_POSE_HOOK {mode:'fight', move, role, stance}). Stance (st.ft.st: 0 = left lead, 1 = right lead) is sent as a foot marker.
  R3.prototype.fightRoles = function (st) { var F = st && st.ft, CB = B.CB; this.ftRole = null; if (!F || !F.mv || !CB) return; var out = [];
    for (var s = 0; s < 2; s++) { var i = s ? F.b : F.a, M = CB.mv[F.mv[s]]; this.footMark(i, { foot: F.st[s] ? 'Rback' : 'Lback', lower: 1 }); if (!M) continue; var tl = F.t - F.la[s];
      var role = tl < M.wind * .75 ? 'anticipation' : tl < M.wind + .06 ? 'hit' : tl < M.busy + .25 ? 'recovery' : null; if (!role) continue; var nm = M.poses && M.poses[role], u = role === 'recovery' ? 1 - (tl - M.wind - .06) / (M.busy + .19) : 1;
      if (nm) this.applyPose(i, nm, Math.max(0, Math.min(1, u))); out.push([s, F.mv[s], role]); try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'fight', move: F.mv[s], role: role, stance: F.st[s], step: F.cs[s], players: [{ i: i, g: this.pl[i] }] }); } catch (e) { } }
    this.ftRole = out; };
  // screen side of the two fighters (index 0 = F.a on the left, 1 = F.b on the left), with a little hysteresis
  R3.prototype.ftSideL = function (F) { var C = this.ftC, T = THREE; if (!C || !C.p || !this.persp) return null; var G = this.G, pc = this.persp, pr = function (q) { var v = G.localToWorld(new T.Vector3(q[1], .03, q[0])); pc.updateMatrixWorld(); v.project(pc); return v.x; };
    var d = pr(C.p[1]) - pr(C.p[0]); if (this.ftSL == null || C.id !== this.ftSLid) { this.ftSL = d >= 0 ? 0 : 1; this.ftSLid = C.id; } else if (Math.abs(d) > .04) this.ftSL = d > 0 ? 0 : 1; return this.ftSL; };
  R3.LEGS = LEGS;
  var GPOSE = { on: !/[?&]gpose=0/.test(location.search), dir: 'anim/goalie_v01/', n: ['ready', 'lowL', 'lowR'], tau: .2, lat: .16, near: .1, far: .8 };
  var _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _gp = new THREE.Vector3();
  // v0.9.43 goalie poses: puck in the goalie's model space (glTF: +Z = where he faces, +X = his left). Lean toward the near post's low pose by lateral offset x threat.
  // v0.9.52 goalie move poses (Justin's ReadyStance frames 1-8 in anim/poses_v01): the sim picks the move (st.gm[team] = [mode, target x, serial]) and the
  // save area to match; here we snap/blend to the pose in GM2.fr frames (1-3 @30fps), side-picked pads/launches by each pose's 'cover' (+1 = model +X = his left).
  var GM2 = { on: !/[?&]gm=0/.test(location.search), fps: 30, fr: [3, 2, 1, 2, 1, 2, 3], shuf: .35, drift: .035, lab: ['G_neutral', 'G_ready', 'pad', 'G_lowblock', 'launch', 'G_smother', 'post'], postW: .7 }; R3.GM2 = GM2;
  var _g51 = new THREE.Vector3(), _g52 = new THREE.Vector3(), _g53 = new THREE.Vector3();
  R3.prototype.gkPose = function (st, dt) { var L = this.poses || {}, M = this.poseMeta || {}; if (!GM2.on || !L.G_ready || !L.G_neutral || !L.G_padL || !L.G_launchR) return this.gkPose0(st, dt); root.BH_GK = this;
    var rd = (dt || 0) * (this.rep ? RSPD : 1);
    for (var i = 0; i < 12; i++) { var k = this.pl[i].userData.sk; if (!k || !k.gk || k.pegged) continue; var g = k.gk, tm = B.TR[i].t, gm = st && st.gm ? st.gm[tm] : null, mode = gm ? gm[0] : 1;
      if (this.ftIdx || !st || st.ov >= 0) mode = st && st.ov >= 0 ? 0 : 1;
      if (root.BH_GKF) { var sf = this.spr && this.spr[i]; mode = root.BH_GKF[0]; gm = [mode, (sf ? sf.z : .5) + root.BH_GKF[1]]; }   // test hook: force a goalie move [mode, x offset]
      var lab = GM2.lab[mode] || 'G_ready'; if (lab === 'post') lab = 'launch';   // v0.9.53 post lock: launch-side pose held part way against the post
      if (lab === 'pad' || lab === 'launch') { var sp = this.spr && this.spr[i], off = gm ? gm[1] - (sp ? sp.z : .5) : 0;   // rink x offset of the target (group z = rink x)
        this.G.updateWorldMatrix(true, false); k.mm.updateWorldMatrix(true, false); _g51.set(0, 0, 0); _g52.set(0, 0, 1); this.G.localToWorld(_g51); this.G.localToWorld(_g52); k.mm.worldToLocal(_g51); k.mm.worldToLocal(_g52);
        var sx = (_g52.x - _g51.x) * (off >= 0 ? 1 : -1) >= 0 ? 1 : -1, A = lab === 'pad' ? ['G_padL', 'G_padR'] : ['G_launchL', 'G_launchR'];
        lab = (M[A[1]] && M[A[1]].cover === sx) ? A[1] : (M[A[0]] && M[A[0]].cover === sx) ? A[0] : A[sx > 0 ? 1 : 0]; }
      g.lib = 1; g.shuf = mode <= 1 ? GM2.shuf : 0; g.out = g.out || {};
      if (lab !== g.cur || mode !== g.mode) { g.from = {}; for (var on in g.out) g.from[on] = g.out[on]; g.cur = lab; g.tb = 0; g.dur = (GM2.fr[mode] || 2) / GM2.fps; g.mode = mode; g.lab = lab; }
      g.tb += rd; var a = Math.min(1, g.tb / (g.dur || .05)), ez = a * a * (3 - 2 * a) * (mode === 6 ? GM2.postW : 1), P = L[lab] || L.G_ready;
      for (var n in P) { var b = g.b[n]; if (!b) continue; var c = P[n], f = g.from && g.from[n] || c; _gq.set(f[0], f[1], f[2], f[3]); _gq2.set(c[0], c[1], c[2], c[3]); b.quaternion.copy(_gq).slerp(_gq2, ez);
        if (c.length > 4) b.position.set(f[4] + (c[4] - f[4]) * ez, f[5] + (c[5] - f[5]) * ez, f[6] + (c[6] - f[6]) * ez);
        var o = g.out[n] || (g.out[n] = []); o[0] = b.quaternion.x; o[1] = b.quaternion.y; o[2] = b.quaternion.z; o[3] = b.quaternion.w; if (c.length > 4) { o[4] = b.position.x; o[5] = b.position.y; o[6] = b.position.z; } }
      if (mode === 0) { var tt = this.clock || 0, sb = g.b.Spine1, hb = g.b.Hips; if (sb) sb.rotateY(Math.sin(tt * .7 + i) * GM2.drift); if (hb) hb.rotateZ(Math.sin(tt * .45 + i * 2) * GM2.drift * .5); }   // neutral: subtle drift
      this.gkLook(k, g, rd); g.dbg = [mode, lab, Math.round(a * 100) / 100]; } };
  // v0.9.52 head + neck track the puck inside a GLOOK.cone (rad) cone, yaw and pitch combined, split Neck/Head, smoothed
  var GLOOK = { on: !/[?&]glook=0/.test(location.search), cone: 40 * Math.PI / 180, neck: .4, k: 9 }, _gl1 = new THREE.Vector3(), _gl2 = new THREE.Vector3(), _glq = new THREE.Quaternion(), _glq2 = new THREE.Quaternion(), _glm = new THREE.Matrix4(); R3.GLOOK = GLOOK;
  R3.prototype.gkLook = function (k, g, rd) { var hb = g.b.Head, nb = g.b.Neck; if (!GLOOK.on || !hb || !nb || !this.puck) return; k.mm.updateMatrixWorld(true);
    this.puck.getWorldPosition(_gl1); k.mm.worldToLocal(_gl1); hb.getWorldPosition(_gl2); k.mm.worldToLocal(_gl2); _gl1.sub(_gl2);   // puck from the head, in model space (+Z facing, +X his left, +Y up)
    var yw = Math.atan2(_gl1.x, _gl1.z), pt = Math.atan2(_gl1.y, Math.hypot(_gl1.x, _gl1.z)), mg = Math.hypot(yw, pt); if (mg > GLOOK.cone) { yw *= GLOOK.cone / mg; pt *= GLOOK.cone / mg; }
    var L = g.look || (g.look = [0, 0]), e = 1 - Math.exp(-(rd || 0) * GLOOK.k); L[0] += (yw - L[0]) * e; L[1] += (pt - L[1]) * e;
    var self = this; [[nb, GLOOK.neck], [hb, 1 - GLOOK.neck]].forEach(function (q) { var b = q[0], w = q[1]; b.parent.updateMatrixWorld(true);
      _glm.copy(k.mm.matrixWorld).invert().multiply(b.parent.matrixWorld); _glq2.setFromRotationMatrix(_glm);   // model <- parent rotation
      _glq.setFromAxisAngle(_gl2.set(0, 1, 0), L[0] * w).multiply(new THREE.Quaternion().setFromAxisAngle(_gl1.set(-1, 0, 0), L[1] * w));   // model-space yaw then pitch (up = +)
      var pinv = _glq2.clone().invert(); b.quaternion.premultiply(pinv.multiply(_glq).multiply(_glq2)); b.updateMatrixWorld(true); }); };
  R3.prototype.gkPose0 = function (st, dt) { root.BH_GK = this; var P = this.gPoses; if (!P) return; var e = 1 - Math.exp(-(dt || 0) / GPOSE.tau);
    for (var i = 0; i < 12; i++) { var k = this.pl[i].userData.sk; if (!k || !k.gk || k.pegged) continue; var g = k.gk, wl = 0, wr = 0;
      if (st && this.puck) { k.mm.updateWorldMatrix(true, false); this.puck.getWorldPosition(_gp); k.mm.worldToLocal(_gp); var lat = _gp.x * g.sc, fwd = _gp.z * g.sc; g.dbg = [lat, fwd];
        var thr = fwd < -.03 ? 0 : Math.max(0, Math.min(1, 1 - (fwd - GPOSE.near) / (GPOSE.far - GPOSE.near))), s = Math.max(-1, Math.min(1, lat / GPOSE.lat)) * thr;
        if (s > 0) wl = s; else wr = -s; }
      if (this.ftIdx || (st && st.pz > 0)) wl = wr = 0;
      g.w[0] += (wl - g.w[0]) * e; g.w[1] += (wr - g.w[1]) * e; var side = g.w[0] >= g.w[1] ? P.lowL : P.lowR, w = Math.max(g.w[0], g.w[1]);
      for (var n in P.ready) { var b = g.b[n]; if (!b) continue; var a = P.ready[n], c = side[n] || a; _gq.set(a[0], a[1], a[2], a[3]); _gq2.set(c[0], c[1], c[2], c[3]); b.quaternion.copy(_gq).slerp(_gq2, w);
        if (a.length > 4) b.position.set(a[4] + (c[4] - a[4]) * w, a[5] + (c[5] - a[5]) * w, a[6] + (c[6] - a[6]) * w); } } };
  // v0.9.52 high-glove catch hook: the sim catches an airborne puck inside a player's catch sphere (st.hc = [player, serial, height]). If Justin's 3 stills
  // exist (poses_v01: HP_catch1/2/3 for skaters, G_catch1/2/3 for goalies = reach high, halfway, to the ice) they play over HC.t s; until then BH_POSE_HOOK
  // gets {mode:'catch', kind:'high'} each frame of the catch with t 0..1 so a pose can be dropped in.
  var HC = { t: .3, fr: [0, .35, 1] }; R3.HC = HC;
  R3.prototype.hcatch = function (st, dt) { var hc = st && st.hc; if (hc && hc[1] !== this.hcSeen) { if (this.hcSeen != null || !this.rep) this.hcRun = { i: hc[0], t: 0, z: hc[2] }; this.hcSeen = hc[1]; }
    var H = this.hcRun; if (!H) return; H.t += (dt || 0) * (this.rep ? RSPD : 1); var u = Math.min(1, H.t / HC.t), k = this.pl[H.i] && this.pl[H.i].userData.sk, pre = k && k.gk ? 'G_' : 'HP_', L = this.poses || {};
    var seq = [L[pre + 'catch1'], L[pre + 'catch2'], L[pre + 'catch3']]; if (seq[0] && seq[1] && seq[2] && k) { var s3 = u < .5 ? 0 : 1, w = u < .5 ? u / .5 : (u - .5) / .5, w0 = Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - Math.max(0, (u - .85) / .15));
        this.applyPose(H.i, pre + 'catch' + (s3 + 1), w0 * (1 - w)); this.applyPose(H.i, pre + 'catch' + (s3 + 2), w0 * w); }
    try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'catch', kind: 'high', t: u, players: [{ i: H.i, g: this.pl[H.i] }], z: H.z }); } catch (e) { }
    if (u >= 1) this.hcRun = null; };
  R3.prototype.avOne = function (k, n, t0) { var a = k.av[n]; if (!a) return; if (k.one && k.one !== a) k.one.stop(); k.hold = 0; a.reset(); a.time = Math.max(0, t0 || 0); a.timeScale = 1; a.setEffectiveWeight(1); a.play(); k.one = a; };
  R3.prototype.avPose = function (st, dt, chk) { var fo = st && st.pz > 0 ? 1 : 0, sw = st ? st.sw : -1, M = this.avMeta || {}, hs = function (n) { return (M[n] && M[n].hit_s) || .4; };
    var newSw = sw >= 0 && sw !== this.avSw ? sw : -1; this.avSw = sw;
    for (var i = 0; i < 12; i++) { var k = this.pl[i].userData.sk; if (!k || !k.av) continue; var A = k.av;
      var sp = this.spr && this.spr[i], v = sp ? Math.hypot(sp.vx, sp.vz) : 0, base = !fo && v > AV.moveV && A.skate && !LEGS.on ? 'skate' : 'idle', fti = this.ftIdx ? this.ftIdx[i] : null; if (fti != null) base = A.fstance ? 'fstance' : 'idle';
      if (fti != null && this.ftOne && this.ftOne[i]) { var fo1 = this.ftOne[i]; this.ftOne[i] = null; if (A[fo1[0]]) this.avOne(k, fo1[0], Math.max(0, hs(fo1[0]) - fo1[1])); }
      if (A.skate) A.skate.timeScale = Math.max(AV.minRate, Math.min(AV.maxRate, v / AV.skateV));
      if (fo && !k.fo && A.draw) { this.avOne(k, 'draw', 0); A.draw.paused = true; k.hold = 1; } if (!fo && k.fo && A.draw) { k.hold = 0; A.draw.paused = false; this.avOne(k, 'draw', hs('draw') - AV.lead); } k.fo = fo;   // crouch on the dot (held at frame 0), snap on the drop
      if (chk === i && A.check) this.avOne(k, 'check', hs('check') - .25);
      if (newSw === i && A.slap && !(k.one === A.check && A.check.isRunning())) this.avOne(k, 'slap', hs('slap') - AV.lead);   // hit marker lands on the puck release
      var on = k.one && (k.one.isRunning() || (k.hold && k.one === A.draw)) ? 1 : 0, e = Math.min(1, dt / AV.fade); k.ow += (on - k.ow) * e; if (k.one) k.one.setEffectiveWeight(k.ow);
      for (var n in k.wb) { k.wb[n] += ((n === base ? 1 : 0) - k.wb[n]) * e; if (A[n]) A[n].setEffectiveWeight(k.wb[n] * (1 - k.ow)); }
      if (!k.pegged) k.mix.update(this.rep ? dt * RSPD : dt); } };
  // ---- v0.9.40 FIGHT MODE (view): fighters square off at the fight spot, sticks hidden, flame aura in team colour, low side camera, balance meters. Others idle where they stand.
  var FTQ = typeof location !== 'undefined' ? location.search : '', FTqn = function (k, d) { var m = new RegExp('[?&]' + k + '=([\\d.]+)').exec(FTQ); return m ? parseFloat(m[1]) : d; };
  var FTV = { blood: !/[?&](blood=0|family=1|kid=1)/.test(FTQ), fcam: Math.max(.15, FTqn('fcam', .5)), gap: .03, gapGrab: .019, camD: 3.4, camH: .5, look: .48, intro: 1.6, aura: 1 };
  function flameTex(col) { var c = document.createElement('canvas'); c.width = 64; c.height = 128; var x = c.getContext('2d'), cc = new THREE.Color(col), rgb = function (a) { return 'rgba(' + (cc.r * 255 | 0) + ',' + (cc.g * 255 | 0) + ',' + (cc.b * 255 | 0) + ',' + a + ')'; };
    var g = x.createRadialGradient(32, 92, 4, 32, 80, 60); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.25, rgb(.85)); g.addColorStop(.7, rgb(.25)); g.addColorStop(1, rgb(0)); x.fillStyle = g;
    x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(52, 40, 64, 70, 60, 100); x.bezierCurveTo(56, 124, 8, 124, 4, 100); x.bezierCurveTo(0, 70, 12, 40, 32, 2); x.fill(); var t = new THREE.CanvasTexture(c); return t; }
  R3.prototype.fightHud = function (F, st) { if (typeof document === 'undefined') return; var h = this.ftHud;
    if (!h) { h = this.ftHud = document.createElement('div'); h.id = 'fthud'; h.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:' + (this.phone ? '9vh' : '12vh') + ';width:min(80vw,640px);z-index:8;pointer-events:none;display:none;font:700 ' + (this.phone ? '3.4vw' : '18px') + ' Fredoka,sans-serif;color:#fff;text-shadow:0 2px 4px #000';
      h.innerHTML = '<div style="text-align:center;letter-spacing:.15em;margin-bottom:4px" id="ftt">FIGHT</div><div style="display:flex;gap:4%"><div style="flex:1;height:14px;border-radius:7px;background:#0008;overflow:hidden;border:2px solid #fff8"><div id="ftb0" style="height:100%;width:100%;float:right"></div></div><div style="flex:1;height:14px;border-radius:7px;background:#0008;overflow:hidden;border:2px solid #fff8"><div id="ftb1" style="height:100%;width:100%"></div></div></div>'; document.body.appendChild(h); }
    if (!F) { h.style.display = 'none'; return; } h.style.display = 'block'; var ta = B.TR[F.a].t, tb = B.TR[F.b].t, b0 = h.querySelector('#ftb0'), b1 = h.querySelector('#ftb1'), lt = ta === 0 ? 0 : 1; var sl = this.ftSideL(F); if (sl != null) lt = sl;   // v0.9.53: left meter = whoever is on the left of the screen (follows swaps)
    var hpL = lt === 0 ? F.hp[0] : F.hp[1], hpR = lt === 0 ? F.hp[1] : F.hp[0]; b0.style.width = (hpL * 100).toFixed(0) + '%'; b1.style.width = (hpR * 100).toFixed(0) + '%'; b0.style.background = '#' + new THREE.Color(COLS[B.TR[lt === 0 ? F.a : F.b].t]).getHexString(); b1.style.background = '#' + new THREE.Color(COLS[B.TR[lt === 0 ? F.b : F.a].t]).getHexString();
    var rs = { graze: 'GRAZED', hitH: 'HIT!', hitL: 'BODY SHOT', miss: 'DODGED', grab: 'GRABBED!', pull: 'BROKE FREE', stuck: 'HELD' }[F.res] || ''; h.querySelector('#ftt').textContent = F.ph === 'intro' ? 'FIGHT!' : F.ph === 'end' ? 'DOWN!' : (rs || 'BALANCE'); };
  R3.prototype.fightPlace = function (st, dt) { var F = st && st.ft, self = this; this.ftT = (this.ftT || 0) + dt; this.fightHud(F, st);
    if (!F) { if (this.ftWas) { this.ftWas.forEach(function (i) { var p = self.pl[i], k = p.userData.sk; if (k) k.sticks.forEach(function (o) { o.visible = true; }); if (!k) p.userData.stick.visible = p.userData.blade.visible = true; }); this.ftWas = null; this.ftIdx = null; this.ftC = null; }
      (this.aura || []).forEach(function (a) { a.visible = false; }); return; }
    var fi = [F.a, F.b], ph = AV.h * PSC; if (!this.ftC || this.ftC.id !== F.id) { var pa = this.pl[F.a].position, pb = this.pl[F.b].position, mx = (pa.z + pb.z) / 2, my = (pa.x + pb.x) / 2;
      this.ftC = { id: F.id, x: mx < .5 ? .36 : .64, y: Math.max(.3, Math.min(L - .3, my)), p: [[pa.z, pa.x], [pb.z, pb.x]], n: F.n.slice(), rn: F.rn, rec: [0, 0], a: 0, ad: Math.random() < .5 ? 1 : -1, ca: 0, home: {} }; this.ftOne = {}; }
    var C = this.ftC; this.ftWas = fi; this.ftIdx = {}; this.ftIdx[F.a] = 0; this.ftIdx[F.b] = 1; this.ftOne = this.ftOne || {};
    if (F.rn !== C.rn) { C.rn = F.rn; var d = 1 - F.rs; if (F.res === 'hitH' || F.res === 'hitL') { C.rec[d] = 1; bthud(); var dp = C.p[d]; this.emit(dp[0], dp[1] + (d ? -1 : 1) * .012, ph * (F.res === 'hitH' ? .85 : .55), 10, 0xffffff, .12, .25, 1);
      var hpv = F.hp[d]; if (FTV.blood && hpv < .3) { var nb = Math.round(4 + (.3 - hpv) / .3 * 14); this.emit(dp[0], dp[1], ph * (F.res === 'hitH' ? .82 : .55), nb, 0xd8101c, .11, .7, 1.2); C.bl = C.bl || [0, 0]; C.bl[d] = 1; } } else if (F.res === 'pull') C.rec[F.rs] = .6; }
    var gap = F.gr >= 0 ? FTV.gapGrab : FTV.gap, e = 1 - Math.exp(-dt * 5);
    var actv = C.act ? Math.max(C.act[0], C.act[1]) : 0; if (F.ph === 'fight') { C.a += C.ad * dt * (.1 + actv * .9); if (Math.abs(C.a) > .75) { C.a = Math.sign(C.a) * .75; C.ad = -C.ad; } }   // v0.9.42 gentle circling, bounded so the camera stays on the open side
    if (F.scr && F.scr !== C.scr) { C.scr = F.scr; C.tw = (C.tw || 0) + (F.scd || 1) * FTV2.twist; C.byN = (C.byN || 0) + 1; }   // v0.9.53 big twist: small scramble round, camera follows
    C.tw = C.tw || 0; var ux = Math.sin(C.a + C.tw), uy = Math.cos(C.a + C.tw);
    if (FTV.blood && C.bl) for (var bs = 0; bs < 2; bs++) if (F.hp[bs] < .3 && F.ph !== 'intro' && Math.random() < dt * (3 + (.3 - F.hp[bs]) * 20)) { var bq = C.p[bs]; this.emit(bq[0], bq[1], ph * (.5 + Math.random() * .3), 1, 0xc8101a, .03, .6, 1.4); }
    for (var s = 0; s < 2; s++) { var i = fi[s], p = this.pl[i], k = p.userData.sk, sg = s ? 1 : -1, gd = sg * (gap + C.rec[s] * .014), tx = C.x + ux * gd, ty = C.y + uy * gd, q = C.p[s]; C.rec[s] = Math.max(0, C.rec[s] - dt * 3);
      q[0] += (tx - q[0]) * e; q[1] += (ty - q[1]) * e; p.position.set(q[1], 0, q[0]); p.rotation.set(0, (s ? Math.PI : 0) - C.a - C.tw, 0);
      if (k) k.sticks.forEach(function (o) { o.visible = false; }); p.userData.stick.visible = p.userData.blade.visible = false; if (p.userData.ring) p.userData.ring.visible = false;
      if (F.n[s] !== C.n[s]) { C.n[s] = F.n[s]; var a = F.k[s], W = (B.FT && B.FT.wind) || {}, nm = a === 'hi' ? (F.sd[s] ? 'phR' : 'phL') : a === 'lo' ? (F.sd[s] ? 'plR' : 'plL') : a === 'esc' ? (F.gr === fi[1 - s] ? 'pull' : 'esc') : a; this.ftOne[i] = [nm, W[a] || .15]; C.act = C.act || [0, 0]; C.act[s] = .45; }
      C.act = C.act || [0, 0]; C.act[s] = Math.max(0, C.act[s] - dt);
      if (!k || !k.av || k.pegged) { p.position.y = Math.abs(Math.sin(this.ftT * 7 + s * 1.7)) * .004; if (C.act[s] > 0) p.rotateZ(-.35 * Math.sin(C.act[s] / .45 * Math.PI)); }   // pegs fallback: bob + lunge
      if (C.rec[s] > 0) p.rotateZ(C.rec[s] * .25);
      if (F.ph === 'end' && s !== F.w) { var lie = Math.min(1, F.t / .35); p.rotateZ(lie * Math.PI / 2 * .92); p.position.y = lie * .01; }
      // aura: flame sprite + rising sparks in team colour (phone: only your fighter)
      var tm = B.TR[i].t, mine = !this.phone || tm === this.V.team; this.aura = this.aura || []; var au = this.aura[s];
      if (!au || au.userData.t !== tm) { if (au) this.G.remove(au); au = this.aura[s] = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(COLS[tm]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); au.userData.t = tm; this.G.add(au); }
      au.visible = FTV.aura && mine && !(F.ph === 'end' && s !== F.w); if (au.visible) { var fl = 1 + Math.sin(this.ftT * 13 + s) * .06 + Math.sin(this.ftT * 29) * .04; au.position.set(q[1], ph * .62, q[0]); au.scale.set(ph * .95 * fl, ph * 1.55 * (2 - fl), 1); au.material.opacity = .55 + .2 * Math.sin(this.ftT * 17 + s * 2);
        if (Math.random() < dt * 40) this.emit(q[0] + (Math.random() - .5) * .012, q[1] + (Math.random() - .5) * .012, ph * (.2 + Math.random() * .6), 1, COLS[tm], .04, .6, -.25); } }
    // v0.9.42: everyone else mills about near where they stopped, facing the fight, kept clear of the circle and the camera lane
    var sxo = C.x < .5 ? 1 : -1, vx = Math.cos(C.ca) * sxo, vy = -Math.sin(C.ca) * sxo, tt = this.ftT;
    for (var j = 0; j < 12; j++) { if (j === F.a || j === F.b) continue; var pl = this.pl[j], pj = pl.position, H = C.home[j]; if (!H) H = C.home[j] = { x: pj.z, y: pj.x, ph: Math.random() * 6.3, f: .25 + Math.random() * .25, r: .012 + Math.random() * .014, cx: pj.z, cy: pj.x };
      var hx = H.x + Math.sin(tt * H.f + H.ph) * H.r, hy = H.y + Math.sin(tt * H.f * .77 + H.ph * 1.3) * H.r, dx = hx - C.x, dy = hy - C.y, dd = Math.hypot(dx, dy), al = dx * vx + dy * vy, pe = -dx * vy + dy * vx;
      if (al > -.03 && Math.abs(pe) < .16) { pe = pe < 0 ? -.16 : .16; hx = C.x + al * vx - pe * vy; hy = C.y + al * vy + pe * vx; }   // out of the camera lane
      else if (dd < .14 && dd > 1e-4) { hx = C.x + dx / dd * .14; hy = C.y + dy / dd * .14; }
      if (C.byN && H.byN !== C.byN) { H.byN = C.byN; if (dd < FTV2.byR) { H.x += dx / (dd || 1) * FTV2.byPush; H.y += dy / (dd || 1) * FTV2.byPush; H.jb = FTV2.byT; try { if (root.BH_POSE_HOOK) root.BH_POSE_HOOK(this, { mode: 'jumpback', players: [{ i: j, g: pl }], dir: this.relDir(j, C.x, C.y) }); } catch (e2) { } } }   // v0.9.53 the fight lurched at him: jump back
      var em = 1 - Math.exp(-dt * (H.jb > 0 ? 6 : 1.5)); H.cx += (hx - H.cx) * em; H.cy += (hy - H.cy) * em; pj.z = H.cx; pj.x = H.cy; if (H.jb > 0) { H.jb -= dt; pl.position.y = Math.sin(Math.max(0, H.jb) / FTV2.byT * Math.PI) * .008; this.ftJB = this.ftJB || {}; this.ftJB[j] = Math.max(0, H.jb) / FTV2.byT; }
      pl.rotation.set(0, -Math.atan2(C.x - H.cx, C.y - H.cy), 0); } };
  R3.prototype.fightCam = function (cam, st, dt, W, H) { var F = st && st.ft, C = this.ftC; if (!F || !C || this.rep) return cam; if (this.phone) this.phoneMir(1); this.puck.visible = false; if (this.pshad) this.pshad.material.opacity = 0; if (this.glow) this.glow.material.opacity = 0; var G = this.G, P3 = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, ph = AV.h * PSC;
    var u = F.ph === 'intro' ? Math.min(1, F.t / FTV.intro) : 1, e = u * u * (3 - 2 * u), cd = FTV.camD * FTV.fcam * (this.phone && W < H ? 1.6 : 1), dist = ph * (cd + (1 - e) * 5), hh = ph * (FTV.camH * (this.phone ? 1.4 : 1) + (1 - e) * 4.5), sx = C.x < .5 ? 1 : -1;   // camera on the open side of the rink
    C.ca += (C.a + (C.tw || 0) - C.ca) * (1 - Math.exp(-dt * (C.tw ? 2 : 1.2)));   // lagged, damped follow of the circling
    var pc = this.persp; pc.aspect = W / H; pc.fov = this.phone && W < H ? 62 : 44; if (pc.near !== .005) pc.near = .005; pc.updateProjectionMatrix();
    pc.position.copy(P3(C.x + sx * dist * Math.cos(C.ca), C.y - sx * dist * Math.sin(C.ca) + Math.sin(this.ftT * .3) * ph * .2, hh)); pc.up.set(0, 1, 0); pc.lookAt(P3(C.x, C.y, ph * FTV.look)); return pc; };
  R3.prototype.hpOne = function (k, n, rate, t0) { var a = k.hp[n]; if (!a || k.one === a && a.isRunning()) return; if (k.one && k.one !== a) k.one.stop(); a.reset(); a.timeScale = rate || 1; a.time = t0 || 0; a.setEffectiveWeight(1); a.play(); k.one = a; k.oneEnd = t0 && n === 'stick' ? HPK.stickS[1] : null; };
  R3.prototype.skPose = function (st, dt) { var fo = st && st.pz > 0 ? 1 : 0, f = st && st.fx, chk = -1;
    if (f && f[0] !== this.hpChkN) { if (this.hpChkN != null && (f[1] === 'C' || f[1] === 'B' || f[1] === 'K')) chk = f[2]; this.hpChkN = f[0]; }
    this.avFps(dt); if (this.avMeta) { if (this.phone) this.avPick(); this.avPose(st, dt, chk); this.gkPose(st, dt); this.hcatch(st, dt); this.poseCall('frame', this.rep ? 'replay' : 'live', this.clock, 0, st); this.pegStep(st, dt); this.legPose(st, dt); this.shotTime(st, dt); this.diveStep(st, dt); this.fightRoles(st); return; }
    for (var i = 0; i < 12; i++) { var k = this.pl[i].userData.sk; if (!k) continue;
      if (!k.hp) { k.w += (fo - k.w) * Math.min(1, dt * (fo ? SKATER.blendIn : SKATER.blendOut)); if (k.g) k.g.setEffectiveWeight(1 - k.w); if (k.f) k.f.setEffectiveWeight(k.w); k.mix.update(dt); continue; }
      var sp = this.spr && this.spr[i], v = sp ? Math.hypot(sp.vx, sp.vz) : 1; k.still = v < HPK.idleV ? k.still + dt : 0;
      var base = fo ? 'ready' : (k.still > HPK.idleT || !st ? 'idle' : 'glide'), e = Math.min(1, dt * HPK.fade);
      if (fo && !k.fo && k.hp.ready) { k.hp.ready.reset(); k.hp.ready.play(); } if (!fo && k.fo && k.hp.draw) this.hpOne(k, 'draw', HPK.drawRate); k.fo = fo;
      if (chk === i) this.hpOne(k, 'check', HPK.checkRate);
      var lnv = st && st.ln ? st.ln[i] : 0, sw = st && st.sw === i, trig = lnv > 0 || sw; if (trig && !k.lt && !(k.one === k.hp.check && k.one.isRunning())) this.hpOne(k, 'stick', HPK.stickRate, HPK.stickS[0]); k.lt = trig;
      if (k.one && k.oneEnd && k.one.time >= k.oneEnd) k.one.stop();
      var on = k.one && k.one.isRunning() ? 1 : 0; k.ow += (on - k.ow) * Math.min(1, dt * HPK.oneFade); if (k.one) k.one.setEffectiveWeight(k.ow);
      for (var n in k.wb) { k.wb[n] += ((n === base ? 1 : 0) - k.wb[n]) * e; if (k.hp[n]) k.hp[n].setEffectiveWeight(k.wb[n] * (1 - k.ow)); }
      k.mix.update(dt); } };
  var ARENA_URL = 'arena_classic.glb', ARENA_UNIT = .62, ARENA_HIDE = /^(rink_surface|post_[lr]_|crossbar_|net_mesh_|goal_light_|serve_slot)/;
  R3.prototype.loadArena = function (proc) { var self = this; if (this.phone || !THREE.GLTFLoader || /noarena/.test(location.search)) return;
    new THREE.GLTFLoader().load(ARENA_URL, function (g) { var A = g.scene; A.scale.setScalar(1 / ARENA_UNIT); A.rotation.y = -Math.PI / 2; A.position.set(L / 2, 0, .5);
      A.traverse(function (o) { if (!o.isMesh) return; if (ARENA_HIDE.test(o.name)) { o.visible = false; return; }
        if (/glass_dome/.test(o.name)) { o.material = new THREE.MeshPhongMaterial({ color: 0xdff0ff, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide, shininess: 90, specular: 0x88aacc }); o.renderOrder = 3; }
        else if (/boards/.test(o.name)) o.material.side = THREE.DoubleSide; });
      self.G.add(A); self.arena = A; proc.forEach(function (m) { m.visible = false; }); }, undefined, function () { /* keep the procedural arena */ }); };
  R3.prototype.goal = function (team) { var nl = this.nets[team] && this.nets[team].userData.light; if (nl) { nl.t = 4.5; nl.rep = true; }
    if (CINE.on && !this.phone && !this.reelOn) { var cp = this.cinePlan(team); if (cp) { var bn = this.d.querySelector('.b3ban'); bn.textContent = 'GOAL!'; bn.style.fontSize = ''; bn.style.color = team ? '#3aa8ff' : '#ff5a6e'; this.rep = cp; this.lastCine = cp.cine; return; } }
    var F = this.hist.slice(); while (F.length > 2 && Math.hypot(F[F.length - 1].p[0] - .5, F[F.length - 1].p[1] - L / 2) < .02) F.pop();   // drop the reset frame
    var D = this.phone ? 2.0 : 3.6, t1 = F[F.length - 1].t; F = F.filter(function (f) { return f.t >= t1 - D; }); if (F.length < 4) return; D = t1 - F[0].t;
    var ban = this.d.querySelector('.b3ban'); ban.textContent = 'GOAL!'; ban.style.fontSize = ''; ban.style.color = team ? '#3aa8ff' : '#ff5a6e';
    // angle 1: high 3/4 view 1.5x out, normal speed; angle 2: 1.2x out at 75%; angle 3: close net cam at 2/3 of the old slow-mo (.2)
    var a1 = this.phone ? 1.4 : 2.0, a2 = this.phone ? .8 : 1.2, a3 = this.phone ? .35 : .45;
    var r1 = RSPD, r2 = .75 / 1.1 * RSPD, r3 = .2 * 2 / 3 / 1.15 * RSPD, segs = [[Math.max(0, D - a1), D + REP_POST * r1, r1, 'top'], [Math.max(0, D - a2), D + REP_POST * r2, r2, 'side'], [Math.max(0, D - a3), D + REP_POST * r3, r3, 'net']];
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
    else if (kind === 'focus' && R.fp) { var fx0 = R.fp[0], fy0 = R.fp[1], fs = fx0 < .5 ? -1 : 1; want = P(fx0 < .5 ? -.1 : 1.1, fy0 - R.dir * .22, .1); look = P(fx0 * .8 + fr.p[0] * .2, fy0 * .8 + fr.p[1] * .2, .03); }
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
  // ---- v0.9.23 pass -> redirect/one-timer cinematic (TV): speed-ramped replay built on the recorded history ----
  // Trigger: the last touches before the goal are [teammate pass] -> [receiver touch (one-timer or deflection)], nobody else touched it in between
  // (sim touch log st.tk), receiver had it <= hold s, any skaters/goalies of the scoring team. Celebration (horn/lights/banner) first, then:
  // frozen orbit around the whole bar -> accelerating zoom down to the passer -> slow-mo off his stick -> fast -> slow-mo off the receiver's stick
  // -> fast -> steady slow-mo ~final s of game time, pulling back over the last half (goal, goalies, players, bar) -> fade to faceoff. ?cine=0 disables.
  // v0.9.25 max-rip + dispenser fx (visual only; thresholds live in sim.js RIP / SRV)
  var RIPFX = { fireN: 3, crackT: 3.2, netT: 2.4, tearT: 3, srvN: 26, blastN: 60 };
  function crackTex() { var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'); x.strokeStyle = 'rgba(230,245,255,.95)'; x.lineCap = 'round';
    for (var k = 0; k < 14; k++) { var a = k / 14 * 6.283 + Math.random() * .3, r = 0, px = 128, py = 128; x.lineWidth = 2.6; x.beginPath(); x.moveTo(px, py); while (r < 120) { r += 10 + Math.random() * 14; a += (Math.random() - .5) * .5; px = 128 + Math.cos(a) * r; py = 128 + Math.sin(a) * r; x.lineTo(px, py); x.lineWidth *= .9; } x.stroke(); }
    for (var q = 1; q < 4; q++) { x.lineWidth = 1.2; x.beginPath(); for (var k2 = 0; k2 <= 24; k2++) { var a2 = k2 / 24 * 6.283, rr = q * 26 + Math.random() * 8; x[k2 ? 'lineTo' : 'moveTo'](128 + Math.cos(a2) * rr, 128 + Math.sin(a2) * rr); } x.stroke(); }
    var t = new THREE.CanvasTexture(c); return t; }
  function smash() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime, n = AC.sampleRate * .6, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2) * (Math.random() < .02 ? 3 : 1); var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = .5; src.buffer = b; src.connect(f); f.connect(g); g.connect(AC.destination); src.start(t); } catch (e) {} }
  function chug() { if (root.BH_MUTE) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime; for (var k = 0; k < 3; k++) { var o = AC.createOscillator(), g = AC.createGain(); o.type = 'square'; o.frequency.setValueAtTime(70 + k * 8, t + k * .11); g.gain.setValueAtTime(0, t + k * .11); g.gain.linearRampToValueAtTime(.08, t + k * .11 + .01); g.gain.exponentialRampToValueAtTime(.001, t + k * .11 + .09); o.connect(g); g.connect(AC.destination); o.start(t + k * .11); o.stop(t + k * .11 + .1); } } catch (e) {} }
  R3.prototype.ripFx = function (st, dt) { var me = this, rep = !!this.rep, now = performance.now() / 1000;
    // burning puck: flame particles off the puck while st.fi (tier 1..3 = hotter)
    if (st.fi && this.puck.visible) { var pw = this.puck.position, n = RIPFX.fireN * st.fi; for (var k = 0; k < n; k++) this.emitW(pw.x, pw.y + .006, pw.z, k % 3 ? 0xff7a1a : 0xffd040, .12, .28, -.4); }
    // rip events (counter in st.rx)
    if (st.rx && this.lastRx != null && st.rx[0] !== this.lastRx && !rep) { var kd = st.rx[1];
      if (kd === 'glass') { var gx = st.rx[2], gy = st.rx[3], gz = st.rx[4]; if (!this.crack) { this.crack = new THREE.Sprite(new THREE.SpriteMaterial({ map: crackTex(), transparent: true, depthWrite: false })); this.G.add(this.crack); }
        this.crack.position.copy(L3(gx, gy, gz + .05)); this.crack.scale.set(.32, .32, 1); this.crack.material.opacity = 1; this.crackEnd = now + RIPFX.crackT; this.emit(gx, gy, gz + .05, 90, 0xdff4ff, .9, .9, 1); this.emit(gx, gy, gz + .05, 30, 0xff8a30, .6, .5, 1); this.bShake = .35; smash(); }
      if (kd === 'netoff' || kd === 'tear') { var nt = this.nets[st.rx[2]]; if (nt) { nt.userData.knock = { end: now + (kd === 'netoff' ? RIPFX.netT : RIPFX.tearT), t: 1, k: kd, sx: (Math.random() - .5) * .06, r: (Math.random() - .5) * .5 }; this.emit(.5, st.rx[2] ? B.L - B.GY : B.GY, .03, 40, kd === 'tear' ? 0xffffff : 0xffc040, .5, .6, 1); bthud(); } } }
    if (st.rx) this.lastRx = st.rx[0];
    if (this.crack) { var cr = this.crackEnd - now; this.crack.material.opacity = Math.max(0, Math.min(1, cr)); this.crack.visible = cr > 0; }
    this.nets.forEach(function (n, k) { var q = n.userData.knock; if (n.userData.p0 == null) n.userData.p0 = n.position.clone(); if (!q) return; q.t = q.end - now; var f = Math.max(0, Math.min(1, q.t * 2)), ms = n.userData.mesh;
      if (q.k === 'netoff') { n.position.set(n.userData.p0.x + (k ? .05 : -.05) * f, n.userData.p0.y, n.userData.p0.z + q.sx * f); n.rotation.y = q.r * f; n.rotation.x = (k ? .25 : -.25) * f; }
      else if (ms) { ms.traverse(function (o) { if (o.material && o.material.opacity != null) { if (o.userData.op0 == null) o.userData.op0 = o.material.opacity; o.material.transparent = true; o.material.opacity = o.userData.op0 * (1 - .8 * f); } }); }
      if (q.t <= 0) { n.position.copy(n.userData.p0); n.rotation.set(0, 0, 0); if (ms) ms.traverse(function (o) { if (o.userData.op0 != null) o.material.opacity = o.userData.op0; }); n.userData.knock = null; } });
    // dispenser serves: pulse open with fiery sparks (more for a blast), mechanical chug
    if (st.srv && this.lastSrv != null && st.srv[0] !== this.lastSrv && !rep) { var kd2 = st.srv[1]; if (kd2 !== 'dot') { var nn = kd2 === 'blast' ? RIPFX.blastN : RIPFX.srvN; this.emit(.5, B.L / 2, .01, nn, 0xff9a2a, kd2 === 'blast' ? .8 : .45, .5, 1); this.emit(.5, B.L / 2, .01, nn >> 1, 0xffe080, .3, .35, 1); this.srvPulse = .5; chug(); } }
    if (st.srv) this.lastSrv = st.srv[0];
    if (this.srvPulse > 0) { this.srvPulse -= Math.min(.05, Math.max(dt, .016)); if (!this.srvRing) { this.srvRing = new THREE.Mesh(new THREE.RingGeometry(.012, .03, 24), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, depthWrite: false, side: THREE.DoubleSide })); this.srvRing.rotation.x = -Math.PI / 2; this.srvRing.position.copy(L3(.5, B.L / 2, .002)); this.G.add(this.srvRing); } var pf = Math.max(0, this.srvPulse / .5); this.srvRing.material.opacity = pf; this.srvRing.scale.setScalar(1 + (1 - pf) * 1.5); this.srvRing.visible = pf > 0; } };
  // world-space (group-local) emitter for the flame trail
  R3.prototype.emitW = function (x, y, z, col, spd, life, grav) { if (this.parts.length >= this.NP) return; var c = new THREE.Color(col), a = Math.random() * 7, v = spd * (.3 + Math.random() * .7); this.parts.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(Math.cos(a) * v * .4, v * .5, Math.sin(a) * v * .4), l: life * (.6 + Math.random() * .4), l0: life, c: c, g: grav }); };
  // v0.9.26 possession border: a line round the whole rink in the colour of the team with the puck (fades over fade s when it changes). TV adds a soft additive glow; phone = plain colour line. ?pglow=0 off
  var PGLOW = { on: !/[?&]pglow=0/.test(location.search), col: [0xff5a6e, 0x3aa8ff], h: .074, glow: .6, line: .95, fade: .35, pad: .015 };
  R3.prototype.possFx = function (st, dt) { if (!PGLOW.on) return; var me = this, P = this.pB;
    if (!P) { var r = .12 + PGLOW.pad, x0 = -PGLOW.pad, y0 = -PGLOW.pad, w = L + 2 * PGLOW.pad, hh = 1 + 2 * PGLOW.pad, sh = new THREE.Shape(); sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); sh.lineTo(x0 + w, y0 + hh - r); sh.quadraticCurveTo(x0 + w, y0 + hh, x0 + w - r, y0 + hh); sh.lineTo(x0 + r, y0 + hh); sh.quadraticCurveTo(x0, y0 + hh, x0, y0 + hh - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
      var pts = sh.getSpacedPoints(160).map(function (q) { return new THREE.Vector3(q.x, PGLOW.h, q.y); }), cv = new THREE.CatmullRomCurve3(pts, true);
      P = this.pB = { col: new THREE.Color(PGLOW.col[0]), tgt: -1, a: 0 };
      P.line = new THREE.Mesh(new THREE.TubeGeometry(cv, 320, this.phone ? .006 : .004, 6, true), new THREE.MeshBasicMaterial({ color: P.col, transparent: true, opacity: 0, depthWrite: false })); this.G.add(P.line);
      if (!this.phone) { P.glow = new THREE.Mesh(new THREE.TubeGeometry(cv, 320, .018, 8, true), new THREE.MeshBasicMaterial({ color: P.col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); this.G.add(P.glow); } }
    var tm = st.c >= 0 ? (st.c < 6 ? 0 : 1) : P.tgt; if (st.pg || (st.pz > 0 && st.c < 0)) tm = -1;
    if (tm !== P.tgt) { P.tgt = tm; P.dip = 1; }
    if (P.dip > 0) { P.dip -= dt / PGLOW.fade; if (P.dip <= .5 && P.tgt >= 0) P.col.setHex(PGLOW.col[P.tgt]); }
    var want = P.tgt >= 0 ? 1 : 0, dipK = P.dip > 0 ? Math.abs(P.dip - .5) * 2 : 1; P.a += (want - P.a) * Math.min(1, dt / PGLOW.fade * 3); var k = P.a * dipK, pulse = .85 + .15 * Math.sin(performance.now() / 260);
    P.line.material.color.copy(P.col); P.line.material.opacity = k * PGLOW.line; if (P.glow) { P.glow.material.color.copy(P.col); P.glow.material.opacity = k * PGLOW.glow * pulse; } };
  var BPING = { n: 14, sp: .35, t: .16, amp: .006 };   // v0.9.24 board ping fx: sparks, spark speed, shake s, shake amplitude (units)
  R3.BPING = BPING;
  var CINE = { on: !/[?&]cine=0/.test(location.search), wait: 3.0, blackIn: .35, orbit: 3.6, orbitDeg: 300, orbitR: [6.5, 8.5], orbitH: 2.0, zoom: 1.6, zoomFov: [58, 44],
    preP: 1.0, offP: .03, preS: .5, offS: B.PR, nearG: 2 * B.PR, final: 4.0, hold: .4, maxGap: 2.5,
    slowP: .22, slowS: .18, slowG: .25, fast: 1.7, ease: 4, look: .3, fade: .9, budget: 45,
    pull: { at: .5, x: .55, y: .38, h: .36 }, cam: { v: 2.6, a: 11, lv: 2.6, la: 13 }, domeQ: .85, edge: .035, fov: 46, dofBar: .15 };
  R3.CINE = CINE; root.BubbleCINE = CINE;
  function ppos(f, i) { var q = B.pos(B.TR[i], f.u[i]), o = f.o ? f.o[i] : [0, 0]; return [q[0] + o[0], q[1] + o[1]]; }
  function cineClamp(x, y, h) { x = Math.max(CINE.edge, Math.min(1 - CINE.edge, x)); y = Math.max(CINE.edge, Math.min(L - CINE.edge, y)); h = Math.max(.03, h);   // inside the boards, above the ice
    var dx = (x - .5) / .70, dy = (y - L / 2) / 1.05, dz = h / .58, q = dx * dx + dy * dy + dz * dz;   // and inside the glass dome (sim DOME ellipsoid)
    if (q > CINE.domeQ) { var k = Math.sqrt(CINE.domeQ / q); x = .5 + (x - .5) * k; y = L / 2 + (y - L / 2) * k; h = Math.max(.03, h * k); } return [x, y, h]; }
  function tmOf(i) { return i < 6 ? 0 : 1; }
  R3.prototype.cineNo = function (why) { this.cineWhy = why; return null; };
  R3.prototype.cinePlan = function (team) { this.cineWhy = '';
    var F = this.hist.slice(); while (F.length > 2 && Math.hypot(F[F.length - 1].p[0] - .5, F[F.length - 1].p[1] - L / 2) < .02) F.pop(); var n = F.length; if (n < 20) return this.cineNo('short history');
    var T = []; for (var q = 1; q < n; q++) { var a0 = F[q - 1].tk, a1 = F[q].tk; if (a0 && a1 && a0[0] !== a1[0]) T.push({ q: q, i: a1[1], t: F[q].t }); }
    while (T.length && T[T.length - 1].i >= 0 && B.TR[T[T.length - 1].i].k === 'G' && tmOf(T[T.length - 1].i) !== team) T.pop();   // a goalie getting a piece of it on the way in still counts
    if (!T.length) return this.cineNo('no touches'); var last = T[T.length - 1], rc = last.i; if (rc < 0 || tmOf(rc) !== team) return this.cineNo('last touch not the scoring team');
    var a = T.length - 1; while (a > 0 && T[a - 1].i === rc) a--; if (a === 0) return this.cineNo('no pass before the receiver');
    var pv = T[a - 1], pa = pv.i; if (pa < 0 || tmOf(pa) !== team) return this.cineNo('previous touch not a teammate (opponent/scramble)');
    var ks = last.q; for (var q1 = T[a].q - 1; q1 < n; q1++) if (F[q1].c === rc) ks = Math.min(n - 1, q1 + 1); if (F[ks].t - T[a].t > CINE.hold) return this.cineNo('receiver held it');
    var kp = pv.q; for (var q2 = Math.max(0, pv.q - 1); q2 < T[a].q; q2++) if (F[q2].c === pa) kp = q2 + 1;
    if (F[n - 1].t - F[ks].t > CINE.maxGap) return this.cineNo('shot too long before the goal');
    var gy = team ? L - B.GY : B.GY, dir = team ? 1 : -1, T0 = F[0].t, find = function (from, fn, def) { for (var z = from; z < n; z++) if (fn(F[z])) return F[z].t - T0; return def; };
    var tpr = F[kp].t - T0, ts = F[ks].t - T0, tg = find(ks, function (f) { return (f.p[1] - gy) * dir > 0; }, F[n - 1].t - T0);
    var tpOff = find(kp, function (f) { return Math.hypot(f.p[0] - F[kp].p[0], f.p[1] - F[kp].p[1]) > CINE.offP; }, tpr + .05), tsOff = find(ks, function (f) { return Math.hypot(f.p[0] - F[ks].p[0], f.p[1] - F[ks].p[1]) > CINE.offS; }, ts + .03);
    var tgN = Math.min(tg, find(ks, function (f) { return (f.p[1] - gy) * dir > -CINE.nearG; }, tg)); tsOff = Math.min(tsOff, tg); tpOff = Math.min(tpOff, T[a].t - T0);
    var t0 = Math.max(0, tpr - CINE.preP), pp = ppos(F[kp], pa), ps = ppos(F[ks], rc), pd = [ps[0] - pp[0], ps[1] - pp[1]], pm = Math.hypot(pd[0], pd[1]) || 1; pd = [pd[0] / pm, pd[1] / pm];
    var net = [.5, gy + dir * .015];
    // receiver angle: ring around him; want receiver + net both in frame (small separation, receiver nearer), puck arriving from the side, inside dome/boards
    var best = null; for (var k = 0; k < 24; k++) { var th = k / 24 * Math.PI * 2, c = cineClamp(ps[0] + Math.cos(th) * .24, ps[1] + Math.sin(th) * .24, .11), moved = Math.hypot(c[0] - ps[0] - Math.cos(th) * .24, c[1] - ps[1] - Math.sin(th) * .24);
      var vs = [ps[0] - c[0], ps[1] - c[1]], vn = [net[0] - c[0], net[1] - c[1]], ds = Math.hypot(vs[0], vs[1]) || 1, dn = Math.hypot(vn[0], vn[1]) || 1, sep = Math.acos(Math.max(-1, Math.min(1, (vs[0] * vn[0] + vs[1] * vn[1]) / ds / dn))) * 180 / Math.PI;
      var sc = Math.abs(sep - 16) / 10 + (sep > CINE.fov * .42 ? 5 : 0) + (dn < ds ? 4 : 0) + moved * 20 + Math.abs((vs[0] * pd[0] + vs[1] * pd[1]) / ds) * .6;
      if (!best || sc < best.s) best = { s: sc, c: c }; }
    var sx = ps[0] < .5 ? -1 : 1, fc = cineClamp(.5 + sx * .2, gy - dir * .17, .1), pb = [.5 - sx * CINE.pull.x, gy - dir * CINE.pull.y, CINE.pull.h];   // net-side cam; pull-back point out past the far boards (bar behind the goal)
    var P = { F: F, team: team, gy: gy, dir: dir, sh: rc, pa: pa, pd: pd, net: net, t0: t0, tpr: tpr, tpOff: tpOff, ts: ts, tsOff: tsOff, tgN: tgN, tg: tg, scam: best.c, fcam: fc, pb: pb, k: 1, redirect: F[ks].t - T[a].t < .02 };
    for (var it = 0; it < 6; it++) { if (this.cineDur(P) <= CINE.budget) break; P.k *= 1.2; }
    P.est = this.cineDur(P); return { cine: P, F: F, team: team, t: 0, wait: CINE.wait, segs: [], gy: gy, dir: dir, ct: t0, r: 0 };
  };
  R3.prototype.cineZones = function (P) { var s = function (r) { return Math.min(1, r * P.k); }, Z = [];
    Z.push([P.t0, P.tpOff, s(CINE.slowP), 'pass']);
    var s0 = Math.max(P.tpOff, P.ts - CINE.preS); if (s0 > P.tpOff + .01) Z.push([P.tpOff, s0, CINE.fast, 'travel']);
    Z.push([s0, P.tsOff, s(CINE.slowS), 'shot']);
    var g0 = Math.max(P.tsOff, P.tgN); if (g0 > P.tsOff + .01) Z.push([P.tsOff, g0, CINE.fast, 'fly']);
    Z.push([g0, g0 + CINE.final, s(CINE.slowG), 'goal']); return { Z: Z, g0: g0, end: g0 + CINE.final }; };
  R3.prototype.cineRate = function (P, c) { var z = (P.zones || (P.zones = this.cineZones(P))).Z; for (var q = 0; q < z.length; q++) if (c < z[q][1]) return z[q][2]; return z[z.length - 1][2]; };
  R3.prototype.cineTgt = function (P, c, r) { return Math.min(this.cineRate(P, c), this.cineRate(P, c + Math.max(r, .05) * CINE.look)); };
  R3.prototype.cineDur = function (P) { P.zones = null; var Z = this.cineZones(P), c = P.t0, r = 0, t = CINE.wait + CINE.orbit + CINE.zoom, h = 1 / 60;
    while (c < Z.end && t < 200) { r += (this.cineTgt(P, c, r) - r) * (1 - Math.exp(-h * CINE.ease)); c += r * h; t += h; } return t + CINE.fade; };
  R3.prototype.cineEndRep = function (R) { this.rep = null; this.cineEnd = true; var d = this.d; ['.b3rep', '.b3bars', '.b3ban', '.b3flash'].forEach(function (k) { d.querySelector(k).style.opacity = 0; }); this.fadeOut = CINE.fade;
    if (!this.phone) this.hlAdd({ k: 'goal', s: HLK.goal[0] + 1 + Math.random(), F: R.F.filter(function (f) { return f.t >= R.F[0].t + R.cine.t0 && f.t <= R.F[0].t + R.cine.tg + 1.4; }), team: R.team, t: this.clock }); };
  R3.prototype.cineStep = function (R, st, dt, W, H) { var P = R.cine, Z = P.zones || (P.zones = this.cineZones(P)), d = this.d, flash = d.querySelector('.b3flash'), ban = d.querySelector('.b3ban'), fade = d.querySelector('.b3fade');
    R.t += dt; if (R.t < R.wait) { var kw = R.t / R.wait; flash.style.opacity = Math.max(0, .85 - kw * 2.5) * (1 + Math.sin(R.t * 40) * .2); ban.style.opacity = Math.min(1, R.t * 5) * (kw < .85 ? 1 : (1 - kw) / .15); ban.style.transform = 'scale(' + (1 + Math.max(0, .25 - R.t) * 2) + ')';
      if (Math.random() < dt * 5) this.emit(.2 + Math.random() * .6, R.gy + (R.team ? -1 : 1) * (.1 + Math.random() * .4), .15 + Math.random() * .2, 70, R.team ? 0x9fd4ff : 0xffb3be, .5, 1.3, 1); if (Math.random() < dt * 22) this.camFlash();
      fade.style.opacity = Math.max(0, 1 - (R.wait - R.t) / CINE.blackIn); this.cheerK = 1; this.cineDbg = { ph: 'celebrate', ct: R.ct, r: 1, D: R.t - R.wait }; return null; }   // live celebration, dips to black at the end
    ban.style.opacity = 0; flash.style.opacity = 0; d.querySelector('.b3rep').style.opacity = 1; d.querySelector('.b3bars').style.opacity = 1;
    var D = R.t - R.wait, T0 = R.F[0].t, phase, u = 0, G = this.G, W3 = function (v) { return G.localToWorld(L3(v[0], v[1], v[2])); }, sm = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    if (D < CINE.orbit) { phase = 'orbit'; R.ct = P.t0; R.r = 0; u = D / CINE.orbit; }
    else if (D < CINE.orbit + CINE.zoom) { phase = 'zoom'; R.ct = P.t0; R.r = 0; u = (D - CINE.orbit) / CINE.zoom; }
    else { R.r += (this.cineTgt(P, R.ct, R.r) - R.r) * (1 - Math.exp(-dt * CINE.ease)); R.ct += R.r * dt * RSPD; phase = 'play';
      if (R.ct >= Z.end - CINE.slowG * P.k * CINE.fade) fade.style.opacity = Math.min(1, (R.ct - (Z.end - CINE.slowG * P.k * CINE.fade)) / (CINE.slowG * P.k * CINE.fade)); else fade.style.opacity = 0;
      if (R.ct >= Z.end) { this.cineEndRep(R); return null; } }
    if (phase !== 'play') fade.style.opacity = phase === 'orbit' ? Math.max(0, 1 - D / CINE.blackIn) : 0;
    var fr = frameAt(R.F, T0 + R.ct), show = { p: fr.p, u: fr.u, o: fr.o, a: fr.a, c: fr.c, z: fr.z, gc: fr.gc, sc: st.sc, sw: -1 };
    var cam = this.persp, want, look, zone = 'pass'; for (var q = 0; q < Z.Z.length; q++) if (R.ct < Z.Z[q][1]) { zone = Z.Z[q][3]; break; } if (R.ct >= Z.end) zone = 'goal';
    var pp = ppos(fr, P.pa), ps = ppos(fr, P.sh), pk = [fr.p[0], fr.p[1], .012 + (fr.z || 0)], side = pp[0] < .5 ? 1 : -1, nrm = [-P.pd[1] * side, P.pd[0] * side];
    var pcam = cineClamp(pp[0] - P.pd[0] * .2 + nrm[0] * .09, pp[1] - P.pd[1] * .2 + nrm[1] * .09, .075), plook = [pp[0] + P.pd[0] * .06, pp[1] + P.pd[1] * .06, .015];
    if (phase !== 'play') {   // frozen: orbit the whole bar, ending on the passer's bearing, then dive at him faster and faster
      var bx = pcam[0] - .5, by = pcam[1] - L / 2, thE = Math.atan2(bx / CINE.orbitR[0], by / CINE.orbitR[1]), uo = phase === 'orbit' ? .5 - .5 * Math.cos(Math.PI * u) : 1, th = thE - (1 - uo) * CINE.orbitDeg * Math.PI / 180;
      var oc = [.5 + CINE.orbitR[0] * Math.sin(th), L / 2 + CINE.orbitR[1] * Math.cos(th), CINE.orbitH], ol = [.5, L / 2, -.4];
      if (phase === 'orbit') { want = oc; look = ol; cam.fov = CINE.zoomFov[0]; R.dofK = CINE.dofBar; }
      else { var e = u * u * u, el = u * u * (3 - 2 * u); want = [lerp(oc[0], pcam[0], e), lerp(oc[1], pcam[1], e), lerp(oc[2], pcam[2], e)]; look = [lerp(ol[0], plook[0], el), lerp(ol[1], plook[1], el), lerp(ol[2], plook[2], el)]; cam.fov = lerp(CINE.zoomFov[0], CINE.zoomFov[1], el); R.dofK = lerp(CINE.dofBar, DOFK.replay, e); }
      R.cs = { p: W3(want) }; R.ls = { p: W3(look) }; cam.near = .03; }
    else { cam.near = .005; R.dofK = DOFK.replay; var direct = false;
      if (zone === 'pass') { want = pcam; look = [lerp(plook[0], pk[0], .5), lerp(plook[1], pk[1], .5), .015]; }
      else if (zone === 'travel' || zone === 'shot') { want = P.scam; look = zone === 'travel' ? [lerp(pk[0], ps[0], .6), lerp(pk[1], ps[1], .6), .015] : [lerp(ps[0], P.net[0], .3), lerp(ps[1], P.net[1], .3), .02]; }
      else if (zone === 'fly' || R.ct < Z.g0 + CINE.final * CINE.pull.at) { want = P.fcam; look = [lerp(pk[0], P.net[0], .45), lerp(pk[1], P.net[1], .45), .02]; R.pull0 = null; }
      else {   // last half: slow pull back revealing the goal, goalies, players and the bar
        var kp = sm((R.ct - Z.g0 - CINE.final * CINE.pull.at) / (CINE.final * (1 - CINE.pull.at))); if (!R.pull0) R.pull0 = { p: R.cs.p.clone(), l: R.ls.p.clone() };
        var wl = [lerp(pk[0], P.net[0], .45), lerp(pk[1], P.net[1], .45), .02], wl2 = [.5, P.gy - P.dir * .25, .03];
        R.cs.p.copy(R.pull0.p).lerp(W3(P.pb), kp); R.ls.p.copy(R.pull0.l).lerp(W3([lerp(wl[0], wl2[0], kp), lerp(wl[1], wl2[1], kp), lerp(wl[2], wl2[2], kp)]), Math.min(1, kp * 1.5)); direct = true; cam.fov = CINE.fov + kp * 6; }
      if (!direct) { camLim(R.cs, W3(want), dt, CINE.cam.v, CINE.cam.a); camLim(R.ls, W3(look), dt, CINE.cam.lv, CINE.cam.la); cam.fov = CINE.fov; } }
    this.cheerK = R.ct >= P.tg ? 1 : 0; this.cheerRate = phase === 'play' ? R.r : 0;
    cam.aspect = W / H; cam.position.copy(R.cs.p); cam.up.set(0, 1, 0); cam.lookAt(R.ls.p); cam.updateProjectionMatrix(); R.zone = phase === 'play' ? zone : phase; this.cineDbg = { ph: R.zone, ct: R.ct, r: R.r, D: D };
    return { show: show, cam: cam }; };
  // patrons bounce while a goal is being celebrated (live + in the cinematic once the puck is in, at replay speed)
  R3.prototype.cheerAnim = function (dt) { var P = this.pats; if (!P) return; var live = this.rep && !this.rep.cine && !this.rep.hl && this.rep.t < this.rep.wait, cine = this.rep && this.rep.cine; if (!cine) { this.cheerK = live ? 1 : 0; this.cheerRate = 1; }
    this.chA = (this.chA || 0) + ((this.cheerK || 0) - (this.chA || 0)) * Math.min(1, dt * (cine ? 3 * (this.cheerRate || 0) + .01 : 3)); this.chT = (this.chT || 0) + dt * (cine ? (this.cheerRate || 0) : 1); var k = this.chA, t = this.chT;
    for (var i = 0; i < P.length; i++) { var o = P[i], h = k * o.a * Math.abs(Math.sin(t * 6 + o.ph)); o.m[0].position.y = o.y[0] + h; o.m[1].position.y = o.y[1] + h; } };
  R3.prototype.phoneMir = function (z) { return;   // v0.9.46 kept as a no-op: the group is never mirrored now
     var G = this.G; if (G && G.scale.z !== z) { G.scale.z = z; G.updateMatrixWorld(true); } };
  R3.prototype.replaying = function () { return !!this.rep; };
  // ---- highlights (TV): small capped clip buffer, post-game reel ----
  var HL = { cap: 30, pre: 3.0, post: 1.4, fps: 30, reel: 180, wait: 1.1, same: 1.2 };
  var HLK = { goal: [10, 'GOAL'], post: [6, 'OFF THE POST'], bar: [6.5, 'OFF THE BAR'], rim: [3, 'JUST WIDE'], bigcheck: [5, 'BIG HIT'], steal: [3, 'TAKEAWAY'], poke: [2.5, 'POKE CHECK'], glove: [5, 'GLOVE SAVE'], onetimer: [5.5, 'ONE-TIMER'], check: [2, 'BODY CHECK'], knockdown: [6, 'KNOCKED DOWN'], fightko: [8, 'DOWN GOES HE!'], glass: [7, 'THROUGH THE GLASS'] };
  var WR = { n: 2, min: 2, pre: .9, post: .6, rate: .5, wait: .6 }, IM = { shot: 2.6, k: 1.1 }; R3.WR = WR; R3.IM = IM;
  R3.HL = HL; R3.HLK = HLK; root.BubbleHL = HL;
  R3.prototype.hlEv = function (st) { var e = [], fx = st.fx, rx = st.rx, F = st.ft, k0 = st.ev;
    if (fx && fx.length > 1 && this.hlFx !== fx[0]) { if (this.hlFx != null) { var i = fx[2], q = i >= 0 && st.u[i] != null ? B.pos(B.TR[i], st.u[i]) : st.p; e.push([{ C: 'check', B: 'bigcheck', K: 'knockdown', P: 'poke' }[fx[1]], [q[0], q[1]]]); } this.hlFx = fx[0]; }
    if (rx && rx.length > 1 && this.hlRx !== rx[0]) { if (this.hlRx != null && rx[1] === 'glass') e.push(['glass', st.p.slice()]); this.hlRx = rx[0]; }
    var fe = F && F.ph === 'end'; if (fe && !this.hlFe && this.ftC) e.push(['fightko', [this.ftC.x, this.ftC.y]]); this.hlFe = fe;
    if (k0 && HLK[k0] && !/^(goal|poke|bigcheck|check|knockdown|glass|fightko)$/.test(k0)) e.push([k0, st.p.slice()]);
    return e; };
  R3.prototype.hlRec = function (st) { this.hl = this.hl || []; this.hlP = this.hlP || []; var me = this, EV = this.hlEv(st);
    EV.forEach(function (ev) { var k = ev[0]; if (!(k && HLK[k] && !me.reelOn && !me.rep && (!(st.pz > 0) || st.ft || !me.hlPz))) return; var lp = me.hlP[me.hlP.length - 1];
      if (lp && me.clock - lp.t < HL.same) { if (HLK[k][0] > HLK[lp.k][0]) { lp.k = k; lp.s = HLK[k][0] + Math.random(); lp.p = ev[1]; lp.t = me.clock; lp.at = me.clock + HL.post; } }
      else me.hlP.push({ k: k, t: me.clock, at: me.clock + HL.post, p: ev[1], s: HLK[k][0] + Math.random() * 1.5 }); });
    this.hlPz = st.pz > 0; this.hlFlush(false); };
  R3.prototype.hlFlush = function (now) { var me = this;
    if (this.rep || this.reelOn) { this.hlP = this.hlP.filter(function (q) { return me.clock - q.t < 8; }); return; }
    while (this.hlP.length && (now || this.clock >= this.hlP[0].at)) { var q = this.hlP.shift(), t0 = q.t - HL.pre, F = this.hist.filter(function (f) { return f.t >= t0; }); if (F.length < 20) continue;
      var gy = q.p[1] < L / 2 ? B.GY : L - B.GY; this.hlAdd({ k: q.k, s: q.s, F: F, team: gy === B.GY ? 0 : 1, t: q.t, p: q.p }); } };
  // ---- v0.9.48 whistle replays: best 1-2 moments of the stretch since the last stoppage, slow motion ----
  R3.prototype.whRec = function (st) { var w = st.wh || 0, me = this; if (this.whN == null) { this.whN = w; this.whT = this.clock; return; } if (w === this.whN) return; this.whN = w;
    var per = /^(END OF|OVERTIME|FINAL|TIED|SHOOTOUT)/.test(st.msg || '') || st.ev === 'period' || st.ov >= 0, t0 = this.whT; this.whT = this.clock;
    if (per) { this.imStart(st); return; } if (st.msg === 'FIGHT!' || st.msg === 'GOAL!' || this.reelOn || this.rep) return;
    this.hlFlush(true); var C = (this.hl || []).filter(function (c) { return c.t >= t0 && c.k !== 'goal' && HLK[c.k][0] >= WR.min; }).sort(function (a, b) { return b.s - a.s; }).slice(0, WR.n).sort(function (a, b) { return a.t - b.t; });
    if (!C.length) return; this.wrQ = C; this.wrOn = true; this.wrNext(); };
  R3.prototype.clipRep = function (c, slowCam, full) { var t0 = c.F[0].t, span = c.F[c.F.length - 1].t - t0, te = Math.max(0, Math.min(span, (c.t || t0) - t0)), a = Math.max(0, te - WR.pre), b = Math.min(span, te + WR.post), fp = c.p || null;
    var sl = fp && c.k !== 'goal' ? 'focus' : slowCam, segs = full ? [] : [[a, b, WR.rate, sl]]; if (full) { if (a > .05) segs.push([0, a, 1, 'top']); segs.push([a, b, WR.rate, sl]); if (span - b > .05) segs.push([b, span, 1, 'top']); }
    var ban = this.d.querySelector('.b3ban'); ban.textContent = HLK[c.k][1]; ban.style.color = c.k === 'goal' ? (c.team ? '#3aa8ff' : '#ff5a6e') : '#ffffffdd'; ban.style.fontSize = '7vmin';
    return { F: c.F, team: c.team, t: 0, wait: full ? HL.wait : WR.wait, segs: segs, gy: c.team ? L - B.GY : B.GY, dir: c.team ? 1 : -1, hl: true, kind: c.k, fp: fp }; };
  R3.prototype.wrNext = function () { var c = this.wrQ && this.wrQ.shift(); if (!c) { this.wrOn = false; return; } this.rep = this.clipRep(c, 'side', false); this.rep.wr = true; };
  R3.prototype.wrBusy = function () { return !!(this.wrOn || (this.rep && this.rep.wr)); };
  // ---- v0.9.48 intermission: cinematic views from outside the glass while the players skate around ----
  R3.prototype.imStart = function (st) { if (this.reelOn) return; this.rep = null; this.wrOn = false; this.wrQ = []; this.im = { t: 0, o: Math.floor(Math.random() * 4) }; };
  R3.prototype.cinemaOn = function () { return !!(this.rep || this.im || this.reelOn); };
  R3.prototype.interCam = function (cam, st, dt, W, H) { var M = this.im; if (!M) return cam; var bars = this.d.querySelector('.b3bars');
    if (this.rep || this.reelOn || st.ft || !(st.pz > IM.k) || st.ov >= 0) { if (M.t > .1 || !(st.pz > IM.k) || this.reelOn) { this.im = null; bars.style.opacity = 0; } return cam; }
    M.t += dt; var G = this.G, P = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, cx = 0, cy = 0, n = 0;
    st.u.forEach(function (u, i) { var q = B.pos(B.TR[i], u), o = st.o ? st.o[i] : [0, 0]; cx += q[0] + o[0]; cy += q[1] + o[1]; n++; }); cx = n ? cx / n : .5; cy = n ? cy / n : L / 2;
    var si = Math.floor(M.t / IM.shot), k = (M.t % IM.shot) / IM.shot, kind = (si + M.o) % 4, want, look = P(cx, cy, .03);
    if (kind === 0) want = P(-.14, cy - .35 + k * .7, .09);   // behind the side glass, dolly along
    else if (kind === 1) want = P(1.07, (cy < L / 2 ? -.07 : L + .07), .045 + k * .03);   // low corner
    else if (kind === 2) { want = P(.5 + .15 * Math.sin(k * 3), L * (.18 + k * .64), 1.25 - k * .45); look = P(cx, cy, 0); }   // overhead swoop
    else want = P(.5 + (k - .5) * .5, (cy < L / 2 ? L + .16 : -.16), .13);   // end glass, behind the net
    cam = this.persp; cam.aspect = W / H; cam.fov = kind === 2 ? 55 : 42; if (si !== M.si || !M.cs) { M.si = si; M.cs = { p: want.clone() }; M.ls = { p: look.clone() }; } else { camLim(M.cs, want, dt, CAMLIM.v * 1.5, CAMLIM.a * 1.5); camLim(M.ls, look, dt, CAMLIM.lv, CAMLIM.la); }
    cam.position.copy(M.cs.p); cam.up.set(0, 1, 0); cam.lookAt(M.ls.p); cam.updateProjectionMatrix(); bars.style.opacity = this.phone ? 0 : 1;
    this.poseCall('inter', ['glass', 'corner', 'swoop', 'end'][kind], M.t, 0, st); return cam; };
  R3.prototype.skipCinema = function () { var any = !!(this.rep || this.im || this.reelOn || this.wrOn); if (this.reelOn) this.skipReel(); this.wrOn = false; this.wrQ = []; if (this.rep && this.rep.hl) this.rep = null; this.im = null; var d = this.d; ['.b3rep', '.b3bars', '.b3ban', '.b3flash'].forEach(function (k) { d.querySelector(k).style.opacity = 0; }); return any; };
  // generic pose hook for labelled poses later: root.BH_POSE_HOOK = function (r3, info) { ... } (info.players = [{i, g}] scene groups)
  R3.prototype.poseCall = function (mode, kind, t, slow, st) { var h = root.BH_POSE_HOOK; if (typeof h !== 'function') return; var me = this; try { h(this, { mode: mode, kind: kind, t: t, slow: slow, st: st, players: (this.pl || []).map(function (g, i) { return { i: i, g: g }; }) }); } catch (e) { if (!this.poseErr) { this.poseErr = 1; console.warn('BH_POSE_HOOK', e); } } };
  R3.prototype.hlAdd = function (c) { var D = [], lt = -1; c.F.forEach(function (f) { if (f.t - lt >= 1 / HL.fps - 1e-4) { D.push(f); lt = f.t; } }); c.F = D; if (D.length < 10) return;   // downsampled to HL.fps
    var H = this.hl = this.hl || []; H.push(c); while (H.length > HL.cap) { var mi = 0; for (var i = 1; i < H.length; i++) if (H[i].s < H[mi].s) mi = i; H.splice(mi, 1); } };
  R3.prototype.hlDur = function (c) { return c.F[c.F.length - 1].t - c.F[0].t + HL.wait + (WR.pre + WR.post) * (1 / WR.rate - 1); };
  R3.prototype.startReel = function (dur) { dur = dur || HL.reel; var H = (this.hl || []).slice().sort(function (a, b) { return b.s - a.s; }), pick = [], tot = 0, me = this;
    H.forEach(function (c) { var d = me.hlDur(c); if (tot + d <= dur || !pick.length) { pick.push(c); tot += d; } }); if (!pick.length) return false;
    var best = pick[0]; pick = pick.slice(1).sort(function (a, b) { return a.t - b.t; }); pick.push(best);   // chronological, ending on the best
    this.reelQ = pick; this.reelOn = true; this.reelLen = tot; this.reelNext(); return true; };
  R3.prototype.reelNext = function () { var c = this.reelQ && this.reelQ.shift(); if (!c) { this.reelOn = false; this.reelDone = true; return; }
    var ban = this.d.querySelector('.b3ban'); ban.textContent = HLK[c.k][1]; ban.style.color = c.k === 'goal' ? (c.team ? '#3aa8ff' : '#ff5a6e') : '#ffffffdd'; ban.style.fontSize = '7vmin';
    this.rep = this.clipRep(c, 'side', true); };
  R3.prototype.skipReel = function () { if (!this.reelOn) return; this.reelQ = []; this.reelOn = false; this.reelDone = true; this.rep = null; var d = this.d; ['.b3rep', '.b3bars', '.b3ban', '.b3flash'].forEach(function (k) { d.querySelector(k).style.opacity = 0; }); d.querySelector('.b3ban').style.fontSize = ''; };

  // ---- v0.9.36 jumbotron: a proxy scoreboard cube hanging on cables over centre ice, above the dome (period, clock, score) + a slow orbit around it for goal settles and period breaks ----
  var DCAM = { r: 1.15, h: 1.0, look: .5, speed: .16, ease: 1.6, fov: 42, bh: .70 };
  R3.DCAM = DCAM;
  R3.prototype.buildBoard = function () { var cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; var tx = new THREE.CanvasTexture(cv), m = new THREE.MeshBasicMaterial({ map: tx }), dk = new THREE.MeshBasicMaterial({ color: 0x111116 });
    var g = new THREE.Group(), box = new THREE.Mesh(new THREE.BoxGeometry(.36, .17, .36), [m, m, dk, dk, m, m]); box.position.y = .085; g.add(box);
    [-.12, .12].forEach(function (z) { var cab = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .5, 6), dk); cab.position.set(z, .42, z); g.add(cab); }); [0, .17].forEach(function (y) { var rim = new THREE.Mesh(new THREE.BoxGeometry(.38, .014, .38), new THREE.MeshBasicMaterial({ color: 0xc8a040 })); rim.position.y = y; g.add(rim); });
    g.position.copy(L3(.5, L / 2, DCAM.bh)); g.visible = false; this.G.add(g); this.board = { g: g, cv: cv, tx: tx, key: '' }; };
  R3.prototype.drawBoard = function (st) { var B2 = this.board, per = st.per || 1, ps = per > (B.PER ? B.PER.n : 3) ? 'OT' : ['1ST', '2ND', '3RD', '4TH', '5TH'][per - 1], tm = Math.max(0, st.tm || 0), cl = st.pon ? Math.floor(tm / 60) + ':' + ('0' + (tm % 60)).slice(-2) : '--:--', sc = st.sc || [0, 0], key = ps + cl + sc.join(); if (key === B2.key) return; B2.key = key;
    var x = B2.cv.getContext('2d'); x.fillStyle = '#0b0b10'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#3a3a48'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 248); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 64px monospace'; x.fillStyle = '#ffb02a'; x.shadowColor = '#ff8a00'; x.shadowBlur = 14; x.fillText(ps + '  ' + cl, 256, 70);
    x.font = 'bold 96px monospace'; x.shadowBlur = 18; x.fillStyle = '#ff5a6e'; x.shadowColor = '#ff2a40'; x.fillText(sc[0], 130, 180); x.fillStyle = '#3aa8ff'; x.shadowColor = '#1a7aff'; x.fillText(sc[1], 382, 180); x.fillStyle = '#ddd'; x.shadowBlur = 0; x.font = 'bold 30px monospace'; x.fillText('RED        BLUE', 256, 124); B2.tx.needsUpdate = true; };
  R3.prototype.domeCam = function (cam, st, want, dt, W, H) { if (this.phone || !this.G) return cam; if (!this.board) this.buildBoard(); var o = this.dcs = this.dcs || { k: 0, a: 0 };
    o.k += (want - o.k) * (1 - Math.exp(-dt * DCAM.ease * (want ? 1 : 2.2))); if (o.k < .003 && !want) { o.k = 0; this.board.g.visible = false; o.a = -1; return cam; }
    if (o.a < 0 || o.a == null) o.a = Math.random() * 6.3; o.a += dt * DCAM.speed; this.board.g.visible = true; this.drawBoard(st); this.board.g.rotation.y = Math.sin(this.clock * .5) * .04;
    var G = this.G, P3 = function (x, y, h) { return G.localToWorld(L3(x, y, h)); }, pc = this.persp, e = o.k * o.k * (3 - 2 * o.k), ctr = P3(.5, L / 2, DCAM.look), op = P3(.5 + DCAM.r * Math.sin(o.a), L / 2 + DCAM.r * 1.35 * Math.cos(o.a), DCAM.h);
    var from = cam.position.clone(), q0 = cam.quaternion.clone(); pc.aspect = W / H; pc.fov = DCAM.fov; pc.near = .02; pc.updateProjectionMatrix(); pc.position.copy(from).lerp(op, e); pc.up.set(0, 1, 0); pc.lookAt(ctr); var q1 = pc.quaternion.clone(); pc.quaternion.copy(q0).slerp(q1, Math.min(1, e * 1.2)); return pc; };
  // end a regular (non-cinematic) goal replay early (host caps the goal pause)
  R3.prototype.endRep = function () { if (!this.rep || this.rep.hl || this.rep.cine) return; this.rep = null; var d = this.d; ['.b3rep', '.b3bars', '.b3ban', '.b3flash'].forEach(function (k) { d.querySelector(k).style.opacity = 0; }); };
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
    var pats = []; function box(w, h, d, x, y, z, c) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(cx + x, y, cz + z); R.add(m); return m; }
    function person(x, z, c, sit) { var hgt = sit ? 2.1 : 2.8, b = new THREE.Mesh(new THREE.CylinderGeometry(.3, .36, hgt * .62, 8), M(c)); b.position.set(cx + x, F + hgt * .31 + (sit ? .7 : 0), cz + z); R.add(b); var hd = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), M(0x4a3428)); hd.position.set(cx + x, F + hgt * .62 + .2 + (sit ? .7 : 0), cz + z); R.add(hd); pats.push({ m: [b, hd], y: [b.position.y, hd.position.y], ph: Math.random() * 6.3, a: sit ? .25 : .45 }); }
    var fl = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), M(0x1e130c)); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, F, cz); R.add(fl);
    [[0, ROOM.d / 2, ROOM.w, 0], [0, -ROOM.d / 2, ROOM.w, 0], [ROOM.w / 2, 0, ROOM.d, 1], [-ROOM.w / 2, 0, ROOM.d, 1]].forEach(function (q) { var wl = new THREE.Mesh(new THREE.PlaneGeometry(q[2], ROOM.h), M(0x2a1a12)); wl.position.set(cx + q[0], F + ROOM.h / 2, cz + q[1]); wl.rotation.y = q[3] ? (q[0] > 0 ? -Math.PI / 2 : Math.PI / 2) : (q[1] > 0 ? Math.PI : 0); R.add(wl); });
    box(1, 1.2, 1, -L / 2 - 2.2, F + .6, .4, 0x1c1a1e); box(1, 1.2, 1, L / 2 + 2.2, F + .6, -.5, 0x1c1a1e); person(-L / 2 - 3.4, -.6, 0x3a3a4a, false); person(L / 2 + 3.6, 1.0, 0x4a3030, false);   // stools / crates past both ends of the table
    box(11, 1.8, 1.1, 0, F + .9, 7.5, 0x3a2010); box(11.3, .1, 1.4, 0, F + 1.85, 7.5, 0x6a3c1c); box(11, 3, .5, 0, F + 3.2, 9.6, 0x1e120a);   // bar counter, top, back shelf
    for (var k = -3; k <= 3; k++) box(.25, .6, .25, k * 1.4, F + 2.6, 9.25, [0x3d7a3a, 0x9a5a20, 0x5a2a6a][(k + 3) % 3]);   // bottles
    [[-6, -5.5], [6.5, -5.8], [-8, 3], [8, 3.4]].forEach(function (t, i) { box(1.6, .08, 1.6, t[0], F + 1.2, t[1], 0x4a2e18); box(.16, 1.2, .16, t[0], F + .6, t[1], 0x1a100a); person(t[0] + 1.2, t[1] + .3, [0x5a5f7a, 0x7a4a4a, 0x4a6a5a, 0x6a5a3a][i], true); });
    [[-3, 6.4, 0x3a3448], [-.5, 6.5, 0x483c2a], [2.4, 6.3, 0x2c3440], [-4.5, -7, 0x382c2c], [4.8, -6.8, 0x2c2c3c]].forEach(function (q) { person(q[0], q[1], q[2], false); });
    // v0.9.23 placeholder bar props (silhouettes): stools along the bar, pool table, dartboard, wall TV, neon sign, a crowd watching the table
    for (var st2 = -4; st2 <= 4; st2 += 1.6) { box(.5, .08, .5, st2, F + 1.25, 6.4, 0x2a1a10); box(.1, 1.25, .1, st2, F + .62, 6.4, 0x140c08); }
    box(4.4, .9, 2.4, -8.5, F + .45, -1.2, 0x2a1608); box(4, .06, 2, -8.5, F + .93, -1.2, 0x1f5a2c);   // pool table
    var dart = new THREE.Mesh(new THREE.CircleGeometry(.5, 24), M(0x1a1a1a)); dart.position.set(cx - ROOM.w / 2 + .05, F + 2.6, cz - 4); dart.rotation.y = Math.PI / 2; R.add(dart); var dr = new THREE.Mesh(new THREE.RingGeometry(.2, .32, 24), M(0x8a2020)); dr.position.copy(dart.position); dr.position.x += .01; dr.rotation.y = Math.PI / 2; R.add(dr);
    box(.15, 1.6, 2.8, ROOM.w / 2 - .1, F + 3, -2, 0x0a0a0a); var tvs = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.35), M(0x24486a)); tvs.position.set(cx + ROOM.w / 2 - .2, F + 3, cz - 2); tvs.rotation.y = -Math.PI / 2; R.add(tvs);   // wall TV
    var nc = document.createElement('canvas'); nc.width = 256; nc.height = 64; var nx = nc.getContext('2d'); nx.font = 'bold 44px sans-serif'; nx.textAlign = 'center'; nx.shadowColor = '#ff4fa0'; nx.shadowBlur = 16; nx.fillStyle = '#ffd0ea'; nx.fillText('BUBBLE BAR', 128, 47);
    var neon = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true, depthWrite: false })); neon.position.set(cx, F + 4.4, cz + ROOM.d / 2 - .1); neon.rotation.y = Math.PI; R.add(neon);
    [[-2.6, -3.2], [-1, -3.4], [.8, -3.3], [2.5, -3.1], [-2, 3.3], [0, 3.5], [2.2, 3.2], [-L / 2 - 2.6, 1.6], [L / 2 + 2.8, -1.4]].forEach(function (q, i) { person(q[0], q[1], [0x3a4a6a, 0x6a3a3a, 0x4a5a3a, 0x5a4a6a, 0x6a5a3a, 0x3a5a5a][i % 6], false); });   // crowd around the table
    // warm dim lamps (pendants over tables + bar); a cooler bright light over the rink itself
    var glowM = new THREE.SpriteMaterial({ map: dotTex('rgba(255,170,90,1)'), color: ROOM.warm, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending });
    [[-3, 7.5], [3, 7.5], [-6, -5.5], [6.5, -5.8], [-8, 3], [8, 3.4]].forEach(function (q) { var sh = new THREE.Mesh(new THREE.ConeGeometry(.4, .35, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb860, side: THREE.DoubleSide })); sh.position.set(cx + q[0], F + 4.2, cz + q[1]); R.add(sh); var gw = new THREE.Sprite(glowM); gw.scale.set(3, 3, 1); gw.position.copy(sh.position); gw.position.y -= .3; R.add(gw); var pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ color: 0x5a3a20, transparent: true, opacity: .5, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(cx + q[0], F + .01, cz + q[1]); R.add(pool); });
    var sp = new THREE.SpotLight(0xf4f8ff, ROOM.rink, 6, .7, .6, 1); sp.position.set(cx, 2.4, cz); sp.target.position.set(cx, 0, cz); R.add(sp); R.add(sp.target);   // the one extra real light: over the rink
    G.add(R); this.room = R; this.pats = pats; this.scene.children.forEach(function (o) { if (o.isHemisphereLight) { o.intensity = .42; o.groundColor.setHex(0x3a2a20); } }); this.gl.setClearColor(0x120a06); };
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
  // ---- v0.9.41 cinematic shot director (TV). mode 1 = stoppage / after-goal settle (always on, frames the ice), 2 = watch-mode live play (alternates
  // CINE.liveOn s of cine shots with CINE.liveOff s of the normal camera, framing the puck). Shots blend into each other over CINE.blend s; jumbotron cube shown. ----
  var CINE = { dur0: 6, dur1: 10, blend: 1.8, ease: 1.4, liveOn: [14, 22], liveOff: [10, 16], shots: ['bar', 'orbit', 'ice', 'jumbo', 'pan', 'bar', 'orbit'] };
  R3.CINE = CINE;
  function rr(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  R3.prototype.cineShot = function (sh, u, f) { var L2 = L / 2, d = sh.dir, a;
    switch (sh.n) {
      case 'bar': return { p: [-.62, sh.y0 + d * u * .055, .30], l: [.5 + (f[0] - .5) * .5, sh.y0 + d * u * .055 + (f[1] - sh.y0) * .35, .03], fov: 36 };   // sideways dolly just outside the dome, from the bar
      case 'orbit': a = sh.a0 + d * u * .085; return { p: [.5 + 1.2 * Math.sin(a), L2 + 1.55 * Math.cos(a), .58], l: [.5 + (f[0] - .5) * .6, L2 + (f[1] - L2) * .6, 0], fov: 40 };
      case 'ice': return { p: [sh.x0 + d * u * .022, sh.e ? L - .1 : .1, .035], l: [.5 + (f[0] - .5) * .4, L2 + (f[1] - L2) * .3, .02], fov: 50 };   // low ice-level drift from behind a net
      case 'jumbo': a = sh.a0 + d * u * .06; return { p: [.5 + .3 * Math.sin(a), L2 + .42 * Math.cos(a), 1.02], l: [.5 + (f[0] - .5) * .7, L2 + (f[1] - L2) * .7, 0], fov: 56 };   // over the jumbotron cube, looking down past it
      default: var k = Math.min(1, u / Math.max(1, sh.dur)), k2 = k * k * (3 - 2 * k); return { p: [sh.e ? 1.32 : -.32, sh.e ? L + .32 : -.32, .5], l: [.5 + (f[0] - .5) * .3 + (k2 - .5) * .5 * d, L2 + (f[1] - L2) * .3 + (k2 - .5) * .6, 0], fov: 38 };   // corner pan
    } };
  R3.prototype.cineCam = function (cam, st, mode, dt, W, H) { if (this.phone || !this.G || this.rep || (st && st.ft)) { if (this.cn) this.cn.k = 0; if (this.board) this.board.g.visible = false; return cam; }
    if (!this.board) this.buildBoard(); var o = this.cn = this.cn || { k: 0, sh: null, t: 0, live: false, lt: rr(CINE.liveOff), last: null, from: null, bt: 9, fx: [.5, L / 2], i: Math.floor(Math.random() * 5) };
    if (mode === 2) { o.lt -= dt; if (o.lt <= 0) { o.live = !o.live; o.lt = rr(o.live ? CINE.liveOn : CINE.liveOff); } } else { o.live = false; o.lt = Math.min(o.lt, 4); }
    var want = mode === 1 || (mode === 2 && o.live) ? 1 : 0; o.k += (want - o.k) * (1 - Math.exp(-dt * CINE.ease * (want ? 1 : 1.6))); if (o.k < .003 && !want) { o.k = 0; o.sh = null; this.board.g.visible = false; return cam; }
    var tf = mode === 2 && st ? [st.p[0], st.p[1]] : [.5 + (st ? (st.p[0] - .5) * .2 : 0), L / 2]; o.fx[0] += (tf[0] - o.fx[0]) * (1 - Math.exp(-dt * 1.2)); o.fx[1] += (tf[1] - o.fx[1]) * (1 - Math.exp(-dt * 1.2));
    if (!o.sh || o.t >= o.sh.dur) { if (o.sh && o.last) { o.from = o.last; o.bt = 0; } o.i = (o.i + 1 + Math.floor(Math.random() * 2)) % CINE.shots.length; o.sh = { n: CINE.shots[o.i], dur: rr([CINE.dur0, CINE.dur1]), dir: Math.random() < .5 ? -1 : 1, y0: L * (.3 + Math.random() * .4), x0: .2 + Math.random() * .6, a0: Math.random() * 6.3, e: Math.random() < .5 }; o.t = 0; }
    o.t += dt; o.bt += dt; var s = this.cineShot(o.sh, o.t, o.fx), G = this.G, P3 = function (q) { return G.localToWorld(L3(q[0], q[1], q[2])); }, pos = P3(s.p), look = P3(s.l), fov = s.fov;
    if (o.from && o.bt < CINE.blend) { var b = o.bt / CINE.blend; b = b * b * (3 - 2 * b); pos = o.from.pos.clone().lerp(pos, b); look = o.from.look.clone().lerp(look, b); fov = o.from.fov + (fov - o.from.fov) * b; }
    o.last = { pos: pos.clone(), look: look.clone(), fov: fov };
    this.board.g.visible = true; this.drawBoard(st); this.board.g.rotation.y = Math.sin(this.clock * .5) * .04;
    var pc = this.persp, e = o.k * o.k * (3 - 2 * o.k), q0 = cam.quaternion.clone(), from = cam.position.clone(); pc.aspect = W / H; pc.fov = fov; pc.near = .02; pc.updateProjectionMatrix(); pc.position.copy(from).lerp(pos, e); pc.up.set(0, 1, 0); pc.lookAt(look); var q1 = pc.quaternion.clone(); pc.quaternion.copy(q0).slerp(q1, Math.min(1, e * 1.2)); this.focusPt = look; return pc; };
  root.Bubble3D = R3;
})(window);
