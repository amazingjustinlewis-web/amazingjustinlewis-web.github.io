/* Bubble Hockey v0.9.54 pregame intro. Original procedural anthem (WebAudio, nothing copyrighted).
   Clean: skate out, intense looks, glide to pegs, big beat -> waist-up lift + drop + wince (HP_anthem_stand, HP_peg_lift, HP_peg_wince), ref "Ooo" (REF_ooo).
   Mature (only when ZTP.sessionMode says mature): hip-height shot from behind, reach back + unzip pants flap (HP_anthem_unzip; no nudity, pants stay on, cut away at once),
   waist-up drop + stoic wince, ref "YeeEee" (REF_yee) skates in with the puck. Tap anywhere skips. Mode drop mid-intro skips the unzip shot.
   Hooks: BHI.on(), BHI.hold(), BHI.frame(r3, st, dt), BHI.cam(r3, cam, st, dt, W, H), BHI.start(r3, mode), BHI.skip(), BHI.seek(t). ?intro=0 disables. */
(function (root) {
  var T = { out: 4.5, look: 7, unzip: 10.9, beat: 12.03, drop: 12.03, ref: 13.4, end: 15.2, endM: 16.4 };
  var BPM = 84, B = 60 / BPM, A0 = .6;   // anthem: 16 beats from .6s, big final chord on beat 17 = T.beat
  var on = false, t = 0, mode = 'family', R = null, ac = null, ref = null, cam = null, home = [], snd = {}, done = false;
  var q = (root.location && root.location.search) || '', OFF = /[?&]intro=0/.test(q);
  function mature() { return mode === 'mature' && (!root.ZTP || root.ZTP.mode() === 'mature'); }
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  // ---------- audio ----------
  function AC() { if (!ac) { try { ac = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
  function note(c, out, f, t0, d, type, g, lp) { var o = c.createOscillator(), a = c.createGain(), fl = c.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp || 2000;
    a.gain.setValueAtTime(0, t0); a.gain.linearRampToValueAtTime(g, t0 + .06); a.gain.setValueAtTime(g * .8, t0 + d * .7); a.gain.linearRampToValueAtTime(0, t0 + d); o.connect(fl); fl.connect(a); a.connect(out); o.start(t0); o.stop(t0 + d + .05); }
  function timp(c, out, t0, g, f) { var o = c.createOscillator(), a = c.createGain(); o.frequency.setValueAtTime(f || 70, t0); o.frequency.exponentialRampToValueAtTime((f || 70) * .7, t0 + .5); a.gain.setValueAtTime(g, t0); a.gain.exponentialRampToValueAtTime(.001, t0 + .9); o.connect(a); a.connect(out); o.start(t0); o.stop(t0 + 1); }
  function crash(c, out, t0) { var n = c.sampleRate * 2, bf = c.createBuffer(1, n, c.sampleRate), d = bf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var s = c.createBufferSource(), h = c.createBiquadFilter(), a = c.createGain(); s.buffer = bf; h.type = 'highpass'; h.frequency.value = 5000; a.gain.value = .25; s.connect(h); h.connect(a); a.connect(out); s.start(t0); }
  var SC = [0, 2, 4, 5, 7, 9, 11, 12, 14]; function hz(deg, oct) { return 233.08 * Math.pow(2, (SC[deg - 1] + 12 * (oct || 0)) / 12); }   // Bb major, original tune
  var MEL = [1, 3, 5, 8, 7, 6, 5, 3, 4, 6, 8, 6, 5, 3, 2, 5], CH = [[1, 3, 5], [6, 8, 3], [4, 6, 8], [5, 7, 2]];
  function anthem(c, t0) { var out = c.createGain(); out.gain.value = .5; out.connect(c.destination); snd.anthem = out;
    MEL.forEach(function (d, i) { note(c, out, hz(d), t0 + A0 + i * B, B * .95, 'sawtooth', .16, 1600); note(c, out, hz(d, 1), t0 + A0 + i * B, B * .95, 'triangle', .05, 3000); });
    CH.forEach(function (ch, bar) { ch.forEach(function (d) { note(c, out, hz(d, -1), t0 + A0 + bar * 4 * B, 4 * B, 'triangle', .07, 900); }); timp(c, out, t0 + A0 + bar * 4 * B, .5); });
    for (var r = 0; r < 8; r++) timp(c, out, t0 + T.beat - .7 + r * .08, .15 + r * .04, 80);
    [1, 3, 5, 8].forEach(function (d) { note(c, out, hz(d), t0 + T.beat, 2.4, 'sawtooth', .17, 2200); note(c, out, hz(d, -1), t0 + T.beat, 2.4, 'triangle', .1, 1200); });
    timp(c, out, t0 + T.beat, .9, 55); crash(c, out, t0 + T.beat); }
  function voice(c, t0, f0s, fm, dur) { var o = c.createOscillator(), out = c.createGain(); o.type = 'sawtooth'; f0s.forEach(function (p) { o.frequency.linearRampToValueAtTime(p[1], t0 + p[0]); });
    o.frequency.setValueAtTime(f0s[0][1], t0); out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(.5, t0 + .08); out.gain.setValueAtTime(.45, t0 + dur - .25); out.gain.linearRampToValueAtTime(0, t0 + dur); out.connect(c.destination);
    fm.forEach(function (F) { var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; F.forEach(function (p) { bp.frequency.linearRampToValueAtTime(p[1], t0 + p[0]); }); bp.frequency.setValueAtTime(F[0][1], t0); o.connect(bp); bp.connect(out); });
    o.start(t0); o.stop(t0 + dur + .05); }
  function ooo(c, t0) { voice(c, t0, [[0, 210], [.5, 240], [1.3, 150]], [[[0, 430], [1.3, 380]], [[0, 820], [1.3, 700]]], 1.4); }
  function yee(c, t0) { voice(c, t0, [[0, 260], [.35, 420], [.6, 300], [1.1, 480], [1.5, 520]], [[[0, 280], [.3, 300], [1.5, 290]], [[0, 2000], [.3, 2300], [1.5, 2400]]], 1.6); }
  // ---------- ref placeholder (no ref model yet: striped figure) ----------
  function stripes() { var cv = document.createElement('canvas'); cv.width = 8; cv.height = 64; var g = cv.getContext('2d'); for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#f4f4f4'; g.fillRect(0, i * 8, 8, 8); } var tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx; }
  function mkRef(r) { var g = new THREE.Group(), H = r.introH || .05, mS = new THREE.MeshStandardMaterial({ map: stripes() }), mK = new THREE.MeshStandardMaterial({ color: 0x111111 }), mF = new THREE.MeshStandardMaterial({ color: 0xe0b090 });
    var bd = new THREE.Mesh(new THREE.CylinderGeometry(H * .16, H * .14, H * .38, 12), mS); bd.position.y = H * .62; g.add(bd);
    var lg = new THREE.Mesh(new THREE.CylinderGeometry(H * .12, H * .08, H * .44, 10), mK); lg.position.y = H * .22; g.add(lg);
    var hd = new THREE.Mesh(new THREE.SphereGeometry(H * .1, 14, 10), mF); hd.position.y = H * .9; g.add(hd); g.userData.head = hd;
    var mo = new THREE.Mesh(new THREE.TorusGeometry(H * .025, H * .008, 6, 12), mK); mo.position.set(0, H * .88, H * .095); g.add(mo); g.userData.mouth = mo;
    [-1, 1].forEach(function (s) { var a = new THREE.Mesh(new THREE.CylinderGeometry(H * .04, H * .035, H * .3, 8), mS); a.position.set(s * H * .2, H * .62, 0); g.add(a); g.userData['arm' + s] = a; });
    var pk = new THREE.Mesh(new THREE.CylinderGeometry(H * .06, H * .06, H * .03, 14), mK); pk.position.set(H * .22, H * .45, H * .08); g.add(pk); g.userData.puck = pk; g.name = 'REF'; return g; }
  // ---------- bones ----------
  function bones(r, i) { var k = r.pl[i] && r.pl[i].userData.sk; if (!k || !k.m) return null; if (!k.ibb) { var bb = {}; k.m.traverse(function (o) { if (o.name && !bb[o.name]) bb[o.name] = o; }); k.ibb = bb; } return k.ibb; }
  function pose(r, i, label, w, fb) { if (r.applyPose && r.applyPose(i, label, w)) return; var b = bones(r, i); if (b && fb) fb(b, w); }   // library pose if present, else procedural
  function waist(r) { var bi = 0, bd = 9; for (var i = 0; i < r.pl.length; i++) { var p = r.pl[i], d = Math.hypot(p.position.z - .5, p.position.x - .8); if (d < bd) { bd = d; bi = i; } } return bi; }
  function rx(b, n, a) { if (b[n]) b[n].rotateX(a); }
  // ---------- api ----------
  var BHI = root.BHI = {
    T: T, on: function () { return on; }, hold: function () { return on; }, done: function () { return done; }, time: function () { return t; }, mode: function () { return mature() ? 'mature' : 'clean'; },
    start: function (r, m) { if (OFF || on || done || !r || !r.pl) return false; R = r; on = true; t = 0; mode = m || (root.ZTP ? root.ZTP.mode() : 'family'); home = [];
      var bx = new THREE.Box3().setFromObject(r.pl[0]); var gs = new THREE.Vector3(); r.G.getWorldScale(gs); r.introH = Math.max(.005, (bx.max.y - bx.min.y) / (Math.abs(gs.y) || 1));   // player height in rink-group units
      ref = mkRef(r); r.G.add(ref); cam = new THREE.PerspectiveCamera(38, 1, .001, 50);
      var c = AC(); if (c) { anthem(c, c.currentTime); snd.t0 = c.currentTime; snd.vo = false; }
      BHI._tap = function () { BHI.skip(); }; setTimeout(function () { if (on) { root.addEventListener('pointerdown', BHI._tap, true); root.addEventListener('touchstart', BHI._tap, true); root.addEventListener('keydown', BHI._tap, true); } }, 400); return true; },
    skip: function () { if (!on) return; on = false; done = true; if (snd.anthem && ac) { try { snd.anthem.gain.setTargetAtTime(0, ac.currentTime, .1); } catch (e) {} }
      if (ref && R) R.G.remove(ref); ref = null; root.removeEventListener('pointerdown', BHI._tap, true); root.removeEventListener('touchstart', BHI._tap, true); root.removeEventListener('keydown', BHI._tap, true); if (BHI.onEnd) BHI.onEnd(); },
    seek: function (s) { t = s; },
    frame: function (r, st, dt) { if (!on || r !== R) return; t += dt; var end = mature() ? T.endM : T.end; if (t >= end) { BHI.skip(); return; }
      var c = ac, H = r.introH, n = r.pl.length, cy = 1, P;
      if (c && !snd.vo && t >= T.ref) { snd.vo = true; (mature() ? yee : ooo)(c, c.currentTime + .05); }
      for (var i = 0; i < n; i++) { P = r.pl[i]; if (!home[i]) home[i] = [P.position.z, P.position.x]; var h = home[i];
        if (t < T.out) { var u = ease((t - i * .18) / (T.out - 1.6)), gx = .97, gy = h[1] > 1 ? 1.06 : .94; P.position.z = gx + (h[0] - gx) * u; P.position.x = gy + (h[1] - gy) * u;   // skate out of the gate, fan to pegs
          if (u < 1) P.rotation.y = Math.atan2(h[0] - gx, h[1] - gy) + Math.PI; }
        else if (t < T.look) { P.position.z = h[0]; P.position.x = h[1]; P.rotation.y = h[1] > 1 ? Math.PI : 0; }   // face the other team: intense looks
        else { P.position.z = h[0]; P.position.x = h[1]; pose(r, i, 'HP_anthem_stand', .8, function (b, w) { rx(b, 'Spine', -.08 * w); rx(b, 'Head', -.05 * w); }); }
        if (mature() && t >= T.unzip && t < T.beat) pose(r, i, 'HP_anthem_unzip', ease((t - T.unzip) / .5), function (b, w) { rx(b, 'UpperArm_L', .9 * w); rx(b, 'UpperArm_R', .9 * w); rx(b, 'Spine', .12 * w); });
        if (t >= T.beat - .45 && t < T.ref + .4) { var lt = t - (T.beat - .45), lift = lt < .45 ? ease(lt / .45) : Math.max(0, 1 - (lt - .45) / .12);   // lift... then drop on the beat
          P.position.y += lift * H * .14; if (lt < .45) pose(r, i, 'HP_peg_lift', lift, function (b, w) { rx(b, 'Spine', -.1 * w); });
          else { var wv = Math.max(0, 1 - (lt - .57) / 1.2); pose(r, i, 'HP_peg_wince', wv, function (b, w) { rx(b, 'Spine', .35 * w); rx(b, 'Head', .3 * w); rx(b, 'UpperArm_L', -.2 * w); rx(b, 'UpperArm_R', -.2 * w); }); } } }
      if (ref) { var fx = .93, fy = 1, k3 = 0; if (mature() && t > T.ref + .6) { k3 = ease((t - T.ref - .6) / 1.8); fx = .93 + (.5 - .93) * k3; }
        ref.position.set(fy, 0, fx); ref.rotation.y = Math.PI; ref.userData.puck.visible = mature();
        var talk = t >= T.ref && t < T.ref + 1.5 ? 1 : 0; ref.userData.mouth.scale.set(1, talk ? 1.6 + Math.sin(t * 20) * .3 : .6, 1);
        ref.userData['arm1'].rotation.z = talk ? (mature() ? -1.6 : .6) : 0; ref.userData.head.rotation.x = talk && !mature() ? -.2 : 0;   // REF_ooo / REF_yee placeholder
        if (r.applyPose) r.applyPose(-1, mature() ? 'REF_yee' : 'REF_ooo', 1); }
      if (root.BHI_POSE_HOOK) root.BHI_POSE_HOOK(r, t, mature()); },
    cam: function (r, c0, st, dt, W, H0) { if (!on || r !== R || !cam) return null; cam.aspect = W / H0; var H = r.introH, v = new THREE.Vector3(), L = new THREE.Vector3(), G = r.G;
      function wp(x, y, h) { return G.localToWorld(new THREE.Vector3(y, h, x)); }
      if (t < T.out) { cam.position.copy(wp(.5, 1 - .02 * t, H * 9)); L.copy(wp(.75, 1, 0)); cam.fov = 50; }
      else if (t < T.look) { var a = Math.floor((t - T.out) / 1.25) % 2, i = a ? 2 : 8, p = r.pl[i].position, s = p.x > 1 ? -1 : 1;   // close-ups, alternating teams
        cam.position.copy(G.localToWorld(new THREE.Vector3(p.x + s * H * 3.4, H * .85, p.z + H * .6))); L.copy(G.localToWorld(new THREE.Vector3(p.x, H * .8, p.z))); cam.fov = 30; }
      else if (mature() && t >= T.unzip && t < T.beat) { var b0 = home[3] || [.5, .6];   // hip height from BEHIND one team's line; cut before anything could show
        cam.position.copy(wp(.5, .42, H * .45)); L.copy(wp(.5, .9, H * .45)); cam.fov = 50; }
      else if (t >= T.beat - .45 && t < T.ref) { var pw = r.pl[waist(r)], hy = pw.rotation.y, fx = Math.cos(hy), fz = -Math.sin(hy), y0 = pw.position.y;   // waist-up, from the front
        cam.position.copy(G.localToWorld(new THREE.Vector3(pw.position.x + fx * H * 3.6 + fz * H * .7, H * .62, pw.position.z + fz * H * 3.6 - fx * H * .5))); L.copy(G.localToWorld(new THREE.Vector3(pw.position.x, H * .62, pw.position.z))); cam.fov = 40; }
      else if (t >= T.ref) { var rp = ref ? ref.position : wp(.93, 1, 0); cam.position.copy(G.localToWorld(new THREE.Vector3(rp.x, H * .85, rp.z - H * 2.6))); L.copy(G.localToWorld(new THREE.Vector3(rp.x, H * .8, rp.z))); cam.fov = mature() ? 46 : 30; }
      else { var a2 = (t - T.look) * .08; cam.position.copy(wp(.5 + Math.sin(a2) * .15, -.05, H * 8)); L.copy(wp(.5, .9, 0)); cam.fov = 46; }
      cam.lookAt(L); cam.updateProjectionMatrix(); return cam; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
