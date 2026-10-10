/* WALKER - the TV (or the iPad in Play here mode). Owns the world, the kid's camera, buddies, other kids, sounds. */
(function () {
  'use strict';
  var C = window.WALKER_CONFIG, T = THREE, S = window.WSFX, q = new URLSearchParams(location.search);
  var EYE = 1.35, TAU = Math.PI * 2;
  function V(x, y, z) { return new T.Vector3(x, y, z); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function rr(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------------------------------------------------------------- renderer + auto quality
  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0, minDim = Math.min(screen.width, screen.height), maxDim = Math.max(screen.width, screen.height);
  var weak = isTouch || /SMART-TV|Tizen|Web0S|CrKey|Android/i.test(navigator.userAgent);
  var rung = q.has('q') ? +q.get('q') : (weak ? 2 : 1);
  var Q = { shadows: !weak && rung <= 1, trees: weak ? 70 : 140, flowers: weak ? 120 : 300, rain: weak ? 600 : 1500 };
  var canvas = document.getElementById('gl');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !weak, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = T.SRGBColorSpace;
  var scene = new T.Scene(), cam = new T.PerspectiveCamera(66, 1, 0.05, 400); scene.add(cam);
  var basePR = Math.min(window.devicePixelRatio || 1, 2);
  function applyQ() { renderer.setPixelRatio(basePR * C.quality.rungs[rung] / 1.2); resize(); }
  function resize() { var w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize);
  var W = WalkerWorld.build(scene, Q); cam.add(W.myCar);
  applyQ();

  // ---------------------------------------------------------------- state
  var settings = walkerLoadSettings();
  var st = { mode: 'start', place: 'path', page: 'go', act: null, energy: 0, lastTap: 0, idle: 0, route: null, dest: null, running: 0, moments: [], momentOn: null, t: 0, rocket: null };
  var pos = V(-6, 0, W.pathZ(-6)), heading = 0;    // the kid's feet
  var camPos = V(-6, EYE, W.pathZ(-6)), camLook = V(0, EYE, W.pathZ(0)), tPos = camPos.clone(), tLook = camLook.clone(), k = 4, roll = 0, tRoll = 0, flip = 0, twist = 0;
  var glance = V(0, 0, 0), glanceT = 0, nextGlance = 6, glanceAt = null, glanceAtT = 0;
  var stride = 0, lastSurfaceStep = 0;

  var SPOTS = {
    bouncy: { door: V(W.B.x + 10, 0, W.pathZ(W.B.x + 10)), in: [V(W.B.x + 8, 0, 0), V(W.B.x + 2, 0, 1)], look: V(W.B.x - 6, 2, 0), px: -36 },
    play: { door: V(W.P.x - 12, 0, W.pathZ(W.P.x - 12)), in: [V(W.P.x - 1, 0, 2)], look: V(W.P.x + 3, 1.5, -4), px: 34 },
    rocket: { door: V(0, 0, -2), in: [V(0, 0, -10), V(0, 0, -18)], look: V(0, 6, -24), px: 0 },
    pond: { door: V(1, 0, W.pathZ(1)), in: [V(3, 0, 8), V(4, 0, 11.2)], look: V(5, 0.3, 17), px: 1 },
    bench: { door: V(-14, 0, W.pathZ(-14)), in: [V(-14, 0, -7.3)], look: V(-10, 1, 2), px: -14, sit: true }
  };
  function groundY(x, z) { return (Math.abs(x - W.B.x) < 6.6 && Math.abs(z - W.B.z) < 6.6) ? W.floorY : 0; }
  function inCastle() { return groundY(pos.x, pos.z) > 0; }
  function pageFor(place) { return place === 'bouncy' ? 'bouncy' : place === 'play' ? 'play' : 'go'; }

  // ---------------------------------------------------------------- routes
  function pathX(p) { return clamp(p.x, -38, 38); }
  function buildRoute(dest) {
    var r = [], here = st.place;
    if (SPOTS[here] && here !== dest) { var sp = SPOTS[here]; for (var i = sp.in.length - 2; i >= 0; i--) r.push(sp.in[i].clone()); r.push(sp.door.clone()); }
    var x0 = r.length ? r[r.length - 1].x : pathX(pos), x1 = SPOTS[dest].door.x, step = x1 > x0 ? 2 : -2;
    if (!r.length && Math.abs(pos.z - W.pathZ(pos.x)) > 2.5) r.push(V(pos.x, 0, W.pathZ(pos.x)));
    for (var x = x0 + step; step > 0 ? x < x1 : x > x1; x += step) r.push(V(x, 0, W.pathZ(x)));
    r.push(SPOTS[dest].door.clone()); SPOTS[dest].in.forEach(function (p) { r.push(p.clone()); });
    return r;
  }
  function goTo(dest, run) {
    if (st.dest === dest && st.mode === 'travel') { st.running = Math.min(2, st.running + 1); return; }
    if (st.place === dest && st.mode !== 'travel') return;
    stopAct(); st.momentOn = null;
    st.route = buildRoute(dest); st.dest = dest; st.mode = 'travel'; st.running = run ? 1 : 0; st.place = 'path'; st.ri = 0;
  }
  function walkOut(run) {
    stopAct();
    if (SPOTS[st.place]) { var sp = SPOTS[st.place], r = []; for (var i = sp.in.length - 2; i >= 0; i--) r.push(sp.in[i].clone()); r.push(sp.door.clone()); var dx = sp.door.x > 0 ? -5 : 5; r.push(V(sp.door.x + dx, 0, W.pathZ(sp.door.x + dx))); st.route = r; st.ri = 0; st.dest = null; st.mode = 'travel'; st.place = 'path'; st.running = run ? 1 : 0; }
  }
  function lookAhead(d) {
    var p = pos.clone(), i = st.ri, left = d;
    while (st.route && i < st.route.length) { var seg = st.route[i].clone().sub(p); seg.y = 0; var l = seg.length(); if (l >= left) return p.add(seg.multiplyScalar(left / l)); left -= l; p.copy(st.route[i]); i++; }
    return p;
  }

  // ---------------------------------------------------------------- activities
  var ACT_PLACE = { b_: 'bouncy', p_: 'play' };
  function stopAct() { st.act = null; flip = 0; twist = 0; tRoll = 0; }
  function startAct(id) { st.act = { id: id, t: 0, lvl: 1, last: st.t, q: 0, ph: 0, phase: 'start', pt: 0, flips: [] }; actTap(st.act, true); }
  function actTap(a, first) {
    a.last = st.t; if (!first) a.lvl = Math.min(6, a.lvl + 1);
    if (a.id === 'b_flip' && a.flips.length < 3) a.flips.push(0);
    if (a.id === 'b_ball') a.q++;
    if ((a.id === 'b_slide' || a.id === 'p_slide') && !first) a.q = Math.min(3, a.q + 1);
    if (a.id === 'p_sand') { W.sandPile.scale.set(1 + a.lvl * 0.15, 0.4 + a.lvl * 0.12, 1 + a.lvl * 0.15); S.step('dirt', 2); if (a.lvl >= 4) S.pop(); }
    if (a.id === 'b_kids') { st.energy += 3; setTimeout(function () { S.giggle(1.2); }, 300); }
  }
  function tap(id) {
    S.init(); hideStart(); st.lastTap = st.t; st.idle = 0; st.energy += 1;
    if (id === 'buddy') return buddyTap();
    if (id.indexOf('go_') === 0) { var dest = { go_bouncy: 'bouncy', go_play: 'play', go_rocket: 'rocket', go_pond: 'pond', go_bench: 'bench' }[id]; var fast = st.t - (st.lastGo || -9) < 1.3 && st.lastGoId === id; st.lastGo = st.t; st.lastGoId = id; if (dest === 'rocket' && st.place === 'rocket') return rocketTap(); goTo(dest, fast); if (dest === 'rocket') st.pendingAct = 'rocket'; return; }
    var need = ACT_PLACE[id.slice(0, 2)];
    if (st.place !== need) { var fast2 = st.pendingAct === id; goTo(need, fast2); st.pendingAct = id; return; }
    if (st.act && st.act.id === id) actTap(st.act); else startAct(id);
  }
  function back() {
    S.init(); st.lastTap = st.t; st.idle = 0;
    var fast = st.t - (st.lastBack || -9) < 1.2; st.lastBack = st.t;
    if (st.rocket) { st.rocket.t = Math.max(st.rocket.t, st.rocket.dur - 6); return; }
    if (st.momentOn) { endMoment(); return; }
    if (st.act) { stopAct(); return; }
    if (st.mode === 'travel') { if (fast) { st.running = 1; return; } if (!st.dest) return; st.route = null; st.dest = null; st.mode = 'area'; st.pendingAct = null; return; }
    walkOut(fast);
  }

  // pose helpers: write into tPos / tLook
  function set(p, l, kk) { tPos.copy(p); tLook.copy(l); k = kk || 8; }
  var tmp = V(0, 0, 0);
  function poseAct(a, dt) {
    a.t += dt;
    if (st.t - a.last > 7 && a.lvl > 0) { a.lvl = Math.max(0, a.lvl - 1); a.last = st.t; }
    var L = a.lvl, B = W.B, P = W.P;
    switch (a.id) {
      case 'b_bounce': case 'b_flip': case 'b_kids': {
        var freq = 0.8 + Math.min(L, 4) * 0.12; a.ph += dt * freq * Math.PI;
        var h = a.id === 'b_kids' ? 0.35 : L === 0 ? 0.06 : 0.25 + Math.min(L, 6) * 0.32 + (a.id === 'b_flip' ? 0.8 : 0);
        var s = Math.abs(Math.sin(a.ph)); if (a.prevS !== undefined && s < a.prevS && a.down === false) {} if (a.prevS !== undefined && a.prevS < 0.12 && s >= 0.12 && L > 0) S.boing(h); a.prevS = s;
        var wander = L >= 3 ? 1.6 : 0.4, cx = B.x + 2 + Math.sin(a.t * 0.23) * wander, cz = B.z + 1 + Math.cos(a.t * 0.19) * wander;
        pos.set(cx, 0, cz);
        var look = a.id === 'b_kids' ? V(cx - 3, W.floorY + 1, cz) : V(B.x - 6 + Math.sin(a.t * 0.1) * 3, W.floorY + 1.5 + s * 0.5, B.z + Math.cos(a.t * 0.13) * 4);
        set(V(cx, W.floorY + EYE + h * s, cz), look, 14);
        // flips: each queued flip plays near the top
        if (a.flips.length) { a.flips[0] += dt / 1.3; flip = -TAU * ease(a.flips[0]); twist = L >= 5 ? TAU * ease(a.flips[0]) : 0; if (a.flips[0] >= 1) { a.flips.shift(); flip = 0; twist = 0; S.whee(); } }
        break; }
      case 'b_ball': {
        var d = Math.max(1.6, 4.5 - L * 0.5), spot = V(W.hoop.x + d * 0.75, W.floorY, W.hoop.z + d * 0.75); pos.set(spot.x, 0, spot.z);
        var dunk = L >= 5 && a.throwT !== undefined;
        set(V(spot.x, W.floorY + EYE + (dunk ? Math.sin(clamp(a.throwT, 0, 1) * Math.PI) * 1.6 : 0), spot.z), V(W.hoop.x, W.hoop.y - 0.3, W.hoop.z), 6);
        if (a.throwT === undefined && a.q > 0) { a.q--; a.throwT = 0; a.from = V(spot.x - 0.3, W.floorY + 1.2, spot.z - 0.3); }
        if (a.throwT !== undefined) {
          a.throwT += dt / 1.1; var t = a.throwT;
          if (t < 1) { W.ball.position.lerpVectors(a.from, W.hoop, t); W.ball.position.y += Math.sin(t * Math.PI) * (1.2 + d * 0.2); }
          else { if (!a.swished) { a.swished = true; S.swish(); if (Math.random() < 0.5) S.giggle(0.6); } W.ball.position.set(W.hoop.x, W.hoop.y - (t - 1) * 3, W.hoop.z); if (W.ball.position.y < W.floorY + 0.2) W.ball.position.y = W.floorY + 0.2; }
          if (t > 1.8) { a.throwT = undefined; a.swished = false; }
        } else { W.ball.position.set(spot.x - 0.3, W.floorY + 1.0 + Math.abs(Math.sin(a.t * 3)) * 0.15, spot.z - 0.3); }
        break; }
      case 'b_slide': case 'p_slide': {
        var top = a.id === 'b_slide' ? W.bSlideTop : W.pSlideTop, bot = a.id === 'b_slide' ? W.bSlideBot : W.pSlideBot;
        var base = a.id === 'b_slide' ? V(W.B.x + 2, W.floorY, -2) : V(W.P.x - 2.5, 0, 2.8);
        a.pt += dt;
        if (a.phase === 'start') { a.phase = 'climb'; a.pt = 0; a.from = camPos.clone(); }
        if (a.phase === 'climb') { var c = ease(a.pt / 3); tmp.lerpVectors(a.from, V(top.x, top.y, top.z + (a.id === 'b_slide' ? 0.6 : 0)), c); tmp.y += Math.sin(a.pt * 7) * 0.04 * (1 - c); set(tmp, V(bot.x, bot.y + 2 - c * 2, bot.z), 10); if (a.pt > 3) { a.phase = 'top'; a.pt = 0; } }
        else if (a.phase === 'top') { set(V(top.x, top.y, top.z), V(bot.x + Math.sin(a.pt) * 3, bot.y, bot.z), 6); if (a.pt > 1.2) { a.phase = 'down'; a.pt = 0; S.whee(); S.whoosh(1.5); } }
        else if (a.phase === 'down') { var dur = 2.2 / (1 + Math.min(L, 5) * 0.15), u = clamp(a.pt / dur, 0, 1), uu = u * u * (1.6 - 0.6 * u); tmp.lerpVectors(top, bot, uu); set(tmp, V(bot.x + (bot.x - top.x) * 3, bot.y - 1, bot.z + (bot.z - top.z) * 2), 22); tRoll = Math.sin(u * 9) * 0.05; if (u >= 1) { a.phase = 'land'; a.pt = 0; tRoll = 0; S.boing(0.5); if (Math.random() < 0.6) S.giggle(0.5); } }
        else if (a.phase === 'land') { set(V(bot.x, bot.y - 0.2, bot.z + 0.5), V(bot.x, EYE, bot.z + 6), 4); if (a.pt > 1.6) { if (a.q > 0) { a.q--; a.phase = 'climb'; a.pt = 0; a.from = camPos.clone(); } else { a.phase = 'rest'; a.pt = 0; } } }
        else { set(V(bot.x, bot.y - 0.2, bot.z + 0.8), V(bot.x + Math.sin(a.t * 0.2) * 4, EYE, bot.z + 6), 2); if (L > 0 && a.lvl > (a.restLvl || 0)) {} }
        pos.set(tPos.x, 0, tPos.z);
        break; }
      case 'b_cloud': {
        var c0 = V(W.B.x + 1, W.floorY + 0.35, 2.5); pos.set(c0.x, 0, c0.z);
        tRoll = L > 1 ? Math.sin(a.t * (0.6 + L * 0.2)) * 0.06 * L : 0;
        set(c0, V(c0.x + 0.5 + Math.sin(a.t * 0.05) * 2, c0.y + 8, c0.z + Math.cos(a.t * 0.04) * 2), 2);
        break; }
      case 'p_swing': {
        var amp = L === 0 ? 0.08 : Math.min(1.05, 0.2 + L * 0.15); a.amp = (a.amp || 0) + (amp - (a.amp || 0)) * dt * 0.7; a.ph += dt * 1.95;
        var ang = Math.sin(a.ph) * a.amp; W.swings[0].rotation.x = ang;
        var piv = W.swingPivot, r = 2.4; tmp.set(piv.x, piv.y - Math.cos(ang) * r + 0.55, piv.z + Math.sin(ang) * r);
        set(tmp, V(piv.x, tmp.y + Math.sin(ang) * 6 - 0.2, tmp.z + 8), 30); pos.set(tmp.x, 0, tmp.z);
        if (a.prevA !== undefined && a.prevA < 0 && ang >= 0 && a.amp > 0.4) S.whoosh(0.5); a.prevA = ang;
        break; }
      case 'p_climb': {
        var dt0 = W.domeTop, h2 = clamp(a.t / 4, 0, 1) * (0.6 + Math.min(L, 3) * 0.25);
        var base2 = V(W.P.x + 6, 0, W.P.z + 1.5); tmp.lerpVectors(V(base2.x, EYE, base2.z), V(dt0.x, dt0.y + EYE * 0.6, dt0.z), ease(h2));
        tmp.y += Math.sin(a.t * 6) * 0.02 * (h2 < 1 ? 1 : 0);
        var lookAng = a.t * (L >= 4 ? 0.25 : 0.08);
        set(tmp, V(tmp.x + Math.sin(lookAng) * 10, tmp.y - 1.5, tmp.z - Math.cos(lookAng) * 10), 4); pos.set(base2.x, 0, base2.z);
        break; }
      case 'p_spin': {
        var spd = Math.min(L, 5) * 0.45; a.w = (a.w || 0) + (spd - (a.w || 0)) * dt * 0.6; a.ph += a.w * dt; W.merry.rotation.y = a.ph;
        var mc = W.merryC; tmp.set(mc.x + Math.cos(a.ph) * 1.3, mc.y + 1.0, mc.z - Math.sin(a.ph) * 1.3);
        set(tmp, V(mc.x + Math.cos(a.ph) * 9, 1.0, mc.z - Math.sin(a.ph) * 9), 30); pos.set(tmp.x, 0, tmp.z);
        break; }
      case 'p_seesaw': {
        var amp2 = L === 0 ? 0.03 : Math.min(0.32, 0.1 + L * 0.05); a.ph += dt * 1.8; var an = Math.sin(a.ph) * amp2; W.seesaw.rotation.x = an;
        var sc = W.seesawC; tmp.set(sc.x, sc.y + 0.9 - Math.sin(an) * 2.2, sc.z - 2.2);
        set(tmp, V(sc.x, sc.y + 1, sc.z + 3), 20); pos.set(tmp.x, 0, tmp.z);
        if (a.prevB !== undefined && a.prevB > 0 && an <= 0 && amp2 > 0.1) S.boing(0.3); a.prevB = an;
        break; }
      case 'p_sand': {
        var sd = W.sandC; set(V(sd.x - 1.6, 0.85, sd.z + 0.6), V(sd.x + 0.5, 0.2, sd.z - 0.4), 3); pos.set(sd.x - 1.6, 0, sd.z + 0.6);
        break; }
    }
  }

  // ---------------------------------------------------------------- rocket ride (stub)
  function rocketTap() { if (!st.rocket) st.rocket = { t: 0, dur: 26, hi: 1 }; else st.rocket.hi = Math.min(3, st.rocket.hi + 0.5); }
  function poseRocket(r, dt) {
    r.t += dt; var R = W.R, u = r.t, alt;
    if (u < 4) alt = 0; else if (u < r.dur - 8) alt = Math.pow(ease((u - 4) / 8), 1.6) * 90 * r.hi; else alt = 90 * r.hi * ease((r.dur - u) / 8);
    if (u > 2 && u < 5) S.rumble(0.3);
    W.rocket.position.y = alt; W.flame.material.opacity = (u > 3 && u < r.dur - 2) ? 0.6 + Math.random() * 0.3 : 0;
    var shake = (u > 3 && u < 9) ? 0.02 : 0;
    set(V(R.x + rr(-shake, shake), alt + 6, R.z + 1.0), V(R.x + Math.sin(u * 0.1) * 30, alt + 3 + Math.sin(u * 0.15) * 6, R.z + 40), 20);
    var sky = W.sky; var sp = clamp(alt / 120, 0, 0.85); scene.background = tmpC.copy(sky).lerp(SPACE, sp); scene.fog.color.copy(scene.background); scene.fog.far = 160 + alt * 3; W.stars.visible = sp > 0.2; W.stars.material.opacity = clamp((sp - 0.2) * 2, 0, 1); W.stars.position.y = alt;
    if (u >= r.dur) { scene.fog.far = 160; W.stars.visible = false; st.rocket = null; W.rocket.position.y = 0; W.flame.material.opacity = 0; pos.set(R.x, 0, R.z + 6); st.place = 'rocket'; set(V(R.x, EYE, R.z + 6), V(R.x, 5, R.z), 3); }
  }
  var SPACE = new T.Color('#1a1a3a'), tmpC = new T.Color();

  // ---------------------------------------------------------------- moments
  var MOM = C.moments, momSeen = {};
  function updateMoments(dt) {
    var list = st.moments; list.forEach(function (m) { m.ttl -= dt; });
    st.moments = list.filter(function (m) { return m.ttl > 0 && (!st.momentOn || st.momentOn.id !== m.id); });
    if (st.mode !== 'travel') return;
    for (var id in W.mom) {
      var m = W.mom[id], d = Math.hypot(m.p.x - pos.x, m.p.z - pos.z);
      if (d < 16 && (st.t - (momSeen[id] || -999)) > 70 && st.moments.length < 3) { momSeen[id] = st.t; st.moments.push({ id: id, pic: MOM[id].pic, ttl: 22 }); pushState(); }
    }
  }
  function momentTap(id) {
    S.init(); st.idle = 0; st.lastTap = st.t; var m = W.mom[id]; if (!m) return;
    stopAct();
    var dir = V(pos.x - m.p.x, 0, pos.z - m.p.z); if (dir.length() < 0.1) dir.set(0, 0, 1); dir.normalize().multiplyScalar(id === 'deer' ? 7 : id === 'ducks' ? 5 : 3.2);
    st.momentOn = { id: id, t: 0, spot: m.p.clone().add(dir), look: m.look, resume: st.mode === 'travel' ? st.dest : null, from: pos.clone() };
    st.moments = st.moments.filter(function (x) { return x.id !== id; });
    st.mode = 'moment'; st.route = null; pushState();
    say(MOM[id].say, true);
  }
  function endMoment() { var r = st.momentOn.resume; st.momentOn = null; st.place = 'path'; st.mode = 'area'; if (r) { goTo(r, false); } }
  function poseMoment(mo, dt) {
    mo.t += dt; var walk = clamp(mo.t / 3, 0, 1), p = V(0, 0, 0).lerpVectors(mo.from, mo.spot, ease(walk));
    pos.set(p.x, 0, p.z); set(V(p.x, EYE + (mo.id === 'fish' || mo.id === 'chip' ? -0.35 : 0), p.z), mo.look, 3);
    if (walk < 1) stepSounds(dt, 1.2);
    var id = mo.id, t = mo.t;
    if (id === 'busker' && t > 2 && Math.random() < dt * 2.6) { var scale = [262, 294, 330, 392, 440, 523, 587]; S.pluck(pick(scale), 1); W.mom.busker.obj.userData.head.rotation.z = Math.sin(t * 3) * 0.1; }
    if (id === 'fish') { var jt = (t - 3) % 3.2; if (t > 3 && jt < 1) { W.fish.position.y = Math.sin(jt * Math.PI) * 0.7; W.fish.rotation.x = -jt * 3; if (!mo.splash || mo.splash < Math.floor((t - 3) / 3.2)) { mo.splash = Math.floor((t - 3) / 3.2) + 1; S.step('puddle', 3); } } else W.fish.position.y = -1; }
    if (id === 'deer' && t > 3) { var n = W.deer.userData.neck; n.rotation.x = Math.max(0, Math.sin((t - 3) * 2)) * 0.5 * (t < 7 ? 1 : 0); W.deer.lookAt(pos.x, 0, pos.z); }
    if (id === 'laugh' && Math.random() < dt * 1.2) { S.giggle(1); }
    if (id === 'laugh') W.laughers.forEach(function (l, i) { l.rotation.x = -Math.abs(Math.sin(t * 6 + i)) * 0.15; l.userData.aL.rotation.z = Math.sin(t * 7 + i) * 0.5; });
    if (id === 'ducks' && Math.random() < dt * 0.6) S.quack();
    if (t > 13) endMoment();
  }

  // ---------------------------------------------------------------- other kids
  var KC = ['#ff8f8f', '#8fc7ff', '#ffd86b', '#b49bff', '#7fe0a0'];
  var kids = [0, 1, 2, 3, 4].map(function (i) { var g = W.person(KC[i], 0.68); scene.add(g); return { g: g, home: i < 3 ? 'bouncy' : 'play', ph: Math.random() * 6, pos: V(0, 0, 0), tgt: V(0, 0, 0), wander: 0, near: false }; });
  var BG = { bouncy: [V(-50, 0, 4.5), V(-51, 0, -3), V(-41, 0, -5)], play: [V(54, 0, -2), V(41, 0, 9)] };
  kids.forEach(function (kd, i) { var l = BG[kd.home]; kd.pos.copy(l[i % l.length]); kd.tgt.copy(kd.pos); });
  var rockAmt = 0;
  function updateKids(dt) {
    var e = st.energy, here = st.place, fwd = V(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
    rockAmt = 0;
    kids.forEach(function (kd, i) {
      var idx = kids.filter(function (o) { return o.home === kd.home; }).indexOf(kd);
      var active = idx === 0 || (idx === 1 && e > 3) || (idx === 2 && e > 7);
      kd.g.visible = active || kd.g.visible && kd.fade > 0; if (!active) { kd.g.visible = false; return; }
      kd.wander -= dt;
      var near = here === kd.home && e > 5 + idx * 2;
      if (near) { var side = (idx - 1) * 1.1; kd.tgt.set(camPos.x + fwd.x * 2.8 - fwd.z * side, 0, camPos.z + fwd.z * 2.8 + fwd.x * side); }
      else if (kd.wander <= 0) { kd.wander = rr(6, 14); var l = BG[kd.home]; kd.tgt.copy(l[Math.floor(Math.random() * l.length)]).add(V(rr(-1.5, 1.5), 0, rr(-1.5, 1.5))); }
      if (kd.home === 'bouncy') { kd.tgt.x = clamp(kd.tgt.x, W.B.x - 5.5, W.B.x + 5.5); kd.tgt.z = clamp(kd.tgt.z, -5.5, 5.5); }
      var d = kd.tgt.clone().sub(kd.pos); d.y = 0; var dl = d.length(), sp = near ? 2.2 : 0.9;
      if (dl > 0.1) { kd.pos.add(d.multiplyScalar(Math.min(1, sp * dt / dl))); kd.g.rotation.y = Math.atan2(kd.tgt.x - kd.pos.x, kd.tgt.z - kd.pos.z); }
      else if (near) kd.g.rotation.y = Math.atan2(camPos.x - kd.pos.x, camPos.z - kd.pos.z);
      kd.ph += dt * (near ? 4.2 : 3.2);
      var y = groundY(kd.pos.x, kd.pos.z), bounce = 0;
      if (kd.home === 'bouncy') { bounce = Math.abs(Math.sin(kd.ph)) * (near ? 0.9 : 0.5); var dist = kd.pos.distanceTo(V(pos.x, 0, pos.z)); if (here === 'bouncy' && dist < 9) rockAmt += Math.abs(Math.cos(kd.ph)) * (1 - dist / 9); }
      else bounce = dl > 0.2 ? Math.abs(Math.sin(kd.ph * 2)) * 0.06 : 0;
      kd.g.position.set(kd.pos.x, y + bounce, kd.pos.z);
      kd.g.userData.aL.rotation.z = near ? Math.sin(kd.ph * 2) * 0.9 + 0.8 : 0.15; kd.g.userData.aR.rotation.z = near ? -Math.sin(kd.ph * 2) * 0.9 - 0.8 : -0.15;
      if (near && Math.random() < dt * 0.25) S.giggle(0.8);
    });
  }

  // ---------------------------------------------------------------- buddy
  var buddy = null, buddyType = null, bud = { pos: V(-5, 0, W.pathZ(-5) + 1.2), play: null, nextPlay: 40, dist: 0, happy: 0 };
  function setBuddy() {
    var t = settings.companion; if (t === buddyType) return; buddyType = t;
    if (buddy) { scene.remove(buddy); buddy = null; }
    if (t && t !== 'none') { buddy = W.companion(t); scene.add(buddy); bud.pos.set(camPos.x + 1, 0, camPos.z); }
  }
  var PITCH = { monkey: 1.8, dog: 1.35, bear: 0.85 };
  var lastSay = -999, saidAt = {};
  function say(text, force) {
    if (!buddy || settings.chat === 0) return;
    var gap = C.chatGap[settings.chat]; if (!force && st.t - lastSay < gap) return;
    if (force && st.t - lastSay < 3) return;
    lastSay = st.t; bud.happy = 1.2; S.speak(text, PITCH[buddyType], buddyType === 'bear' ? 0.85 : 0.95);
    window.WALKER.lastSaid = text;
  }
  function buddyTap() {
    if (!buddy) { settings.companion = 'dog'; walkerSaveSettings(settings); setBuddy(); pushState(); }
    bud.called = (bud.called || 0) + 1; bud.calledT = 0; bud.happy = 2; glanceAt = buddy; glanceAtT = 3;
    var lines = ['Hi! I\'m here!', 'Hee hee!', 'Wheee!', 'Let\'s play!', 'You\'re my best friend.'];
    say(lines[Math.min(bud.called - 1, lines.length - 1)], true);
  }
  function updateBuddy(dt) {
    if (!buddy) return; var u = buddy.userData;
    var fwd = V(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize(); var right = V(-fwd.z, 0, fwd.x);
    var tgt;
    if (bud.calledT !== undefined && bud.calledT < 4) { bud.calledT += dt; tgt = V(camPos.x + fwd.x * 1.6, 0, camPos.z + fwd.z * 1.6); }
    else if (bud.play) { bud.play.t += dt; var pl = bud.play, top = pl.top, bot = pl.bot;
      if (pl.t < 3) tgt = V(top.x, 0, top.z + 1); else if (pl.t < 5) { var uu = (pl.t - 3) / 2; tgt = V(0, 0, 0).lerpVectors(top, bot, uu); buddy.position.copy(tgt); buddy.rotation.y = Math.atan2(bot.x - top.x, bot.z - top.z); if (!pl.glanced) { pl.glanced = true; glanceAt = buddy; glanceAtT = 3; S.whee(); if (Math.random() < 0.5) say('Wheee!', true); } }
      else { bud.play = null; bud.nextPlay = st.t + rr(35, 70); tgt = bud.pos.clone(); } }
    else tgt = V(camPos.x + right.x * 1.5 + fwd.x * 1.3, 0, camPos.z + right.z * 1.5 + fwd.z * 1.3);
    if (!(bud.play && bud.play.t >= 3 && bud.play.t < 5)) {
      var d = tgt.clone().sub(bud.pos); d.y = 0; var dl = d.length(), sp = Math.min(6, 0.5 + dl * 1.6);
      if (dl > 0.15) { var mv = Math.min(dl, sp * dt); bud.pos.add(d.multiplyScalar(mv / dl)); bud.dist += mv; buddy.rotation.y = Math.atan2(tgt.x - bud.pos.x, tgt.z - bud.pos.z); }
      else { buddy.rotation.y += (Math.atan2(camPos.x - bud.pos.x, camPos.z - bud.pos.z) - buddy.rotation.y) * dt * 0.5; }
      var gy = groundY(bud.pos.x, bud.pos.z), hop = gy > 0 ? Math.abs(Math.sin(st.t * 3)) * 0.3 : 0;
      buddy.position.set(bud.pos.x, gy + hop + Math.abs(Math.sin(bud.dist * 3)) * 0.05, bud.pos.z);
    }
    u.feet.forEach(function (f, i) { f.position.y = 0.08 + Math.max(0, Math.sin(bud.dist * 6 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0))) * 0.07; });
    bud.happy = Math.max(0, bud.happy - dt * 0.5);
    u.tail.rotation.y = Math.sin(st.t * (4 + bud.happy * 8)) * (0.3 + bud.happy * 0.4);
    u.head.rotation.x = Math.sin(st.t * 0.7) * 0.08 - bud.happy * 0.1; u.head.rotation.z = Math.sin(st.t * 0.5) * 0.1;
    if (bud.happy > 1.5) buddy.position.y += Math.abs(Math.sin(st.t * 8)) * 0.25;
    if (!bud.play && st.place === 'play' && (!st.act || st.act.id !== 'p_slide') && st.t > bud.nextPlay && st.mode === 'area') bud.play = { t: 0, top: W.pSlideTop.clone().setY(0), bot: W.pSlideBot.clone().setY(0) };
    if (bud.nextPlay < st.t - 200) bud.nextPlay = st.t + 40;
    // pointing things out
    if (settings.chat > 0 && st.t - lastSay > C.chatGap[settings.chat]) {
      var best = null, bd = settings.chat === 3 ? 14 : 10;
      W.things.forEach(function (th) { var d2 = th.sky ? 8 : Math.hypot(th.p.x - pos.x, th.p.z - pos.z); if (d2 < bd && st.t - (saidAt[th.name] || -999) > 90) { best = th; bd = d2; } });
      for (var id in W.mom) { var m = W.mom[id], d3 = Math.hypot(m.p.x - pos.x, m.p.z - pos.z); if (d3 < bd && st.t - (saidAt[id] || -999) > 90) { best = { name: id, w: MOM[id].say, p: m.look }; bd = d3; } }
      if (best && (best.sky ? Math.random() < 0.01 : true)) { saidAt[best.name] = st.t; say(best.w); if (best.p) { glanceAtT = 2.5; glanceAt = { position: best.p }; } }
      else if (settings.chat === 3 && st.t - lastSay > 12) say(pick(['That\'s grass.', 'Blue sky.', 'I like walking with you.', 'Listen. A bird.', 'Look at the trees.']));
    }
  }

  // ---------------------------------------------------------------- wildlife + weather
  var carT = rr(25, 50), deerRun = 0, weather = { ph: 'sun', t: 0 }, WEA = { sun: 150, cloud: 35, rain: 45, bow: 60 }, NEXT = { sun: 'cloud', cloud: 'rain', rain: 'bow', bow: 'sun' };
  if (q.get('weather')) weather.ph = q.get('weather');
  var SUN = { sky: new T.Color('#cfe8ff'), hemi: new T.Color('#fff6e0'), int: 0.62 }, RAIN = { sky: new T.Color('#b9c6d6'), hemi: new T.Color('#d8e4f2'), int: 0.5 };
  var wMix = 0, hue = { color: '#ffd9a0', bri: 0 };
  function updateWorld(dt) {
    var t = st.t;
    W.birds.forEach(function (b) { var u = b.userData, a = t * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 2) * 0.6, u.cz + Math.sin(a) * u.r); b.rotation.y = -a; var f = Math.sin(t * 9 + u.ph) * 0.5; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
    W.clouds.forEach(function (c, i) { c.position.x += dt * (0.4 + i * 0.05); if (c.position.x > 180) c.position.x = -180; });
    W.ducks.forEach(function (d, i) { var a = t * 0.08 + i * 2; d.position.set(W.POND.x + Math.cos(a) * (2 + i * 0.6), 0.05, W.POND.z + Math.sin(a) * (1.4 + i * 0.4)); d.rotation.y = -a; });
    W.chips.forEach(function (c, i) { var j = Math.floor(t * 0.5 + i * 3) % 4; c.position.y = j === 0 ? Math.abs(Math.sin(t * 12)) * 0.1 : 0; c.rotation.y = Math.sin(t * 0.3 + i) * 2; });
    W.laughers.forEach(function (l, i) { l.userData.head.rotation.y = Math.sin(t * 0.4 + i * 3) * 0.4; });
    if (!st.act || st.act.id !== 'p_swing') W.swings[0].rotation.x *= Math.pow(0.6, dt);
    W.swings[1].rotation.x = Math.sin(t * 1.9) * (st.energy > 4 ? 0.5 : 0.08);
    if (!st.act || st.act.id !== 'p_spin') W.merry.rotation.y += dt * 0.05;
    // car on the far road; the deer runs off if it's close-ish
    carT -= dt; if (carT < 0 && W.car.position.x < -250) { W.car.position.x = -200; carT = rr(50, 90); }
    if (W.car.position.x > -250) { W.car.position.x += dt * 14; if (W.car.position.x > 220) W.car.position.x = -300; if (Math.abs(W.car.position.x - W.deer.position.x) < 45 && !deerRun && !(st.momentOn && st.momentOn.id === 'deer')) { deerRun = 18; } }
    var dh = W.deer.userData.home;
    if (deerRun > 0) { deerRun -= dt; var away = deerRun > 9; var tg = away ? V(dh.x + 22, 0, dh.z - 25) : dh; var d = tg.clone().sub(W.deer.position); d.y = 0; var l = d.length(); if (l > 0.2) { W.deer.position.add(d.multiplyScalar(Math.min(1, (away ? 7 : 1.5) * dt / l))); W.deer.rotation.y = Math.atan2(tg.x - W.deer.position.x, tg.z - W.deer.position.z); W.deer.position.y = away ? Math.abs(Math.sin(t * 10)) * 0.3 : 0; } if (deerRun <= 0) deerRun = 0; }
    else if (!(st.momentOn && st.momentOn.id === 'deer')) { W.deer.userData.neck.rotation.x = 0.9 + Math.sin(t * 0.5) * 0.1; var dd = Math.hypot(pos.x - W.deer.position.x, pos.z - W.deer.position.z); if (dd < 16) { W.deer.userData.neck.rotation.x = Math.sin(t * 1.5) > 0.7 ? 0.3 : 0; W.deer.lookAt(pos.x, 0, pos.z); } }
    // weather cycle
    weather.t += dt; if (weather.t > WEA[weather.ph] && !q.get('weather')) { weather.t = 0; weather.ph = NEXT[weather.ph]; }
    var wet = weather.ph === 'rain' ? 1 : weather.ph === 'cloud' ? 0.45 : 0; wMix += (wet - wMix) * dt * 0.15;
    if (!st.rocket) { W.sky.copy(SUN.sky).lerp(RAIN.sky, wMix); scene.background = W.sky; scene.fog.color.copy(W.sky); }
    W.hemi.color.copy(SUN.hemi).lerp(RAIN.hemi, wMix); W.hemi.intensity = SUN.int + (RAIN.int - SUN.int) * wMix; W.sun.intensity = 0.55 * (1 - wMix * 0.7);
    W.rain.material.opacity = weather.ph === 'rain' ? Math.min(0.7, W.rain.material.opacity + dt * 0.1) : Math.max(0, W.rain.material.opacity - dt * 0.2);
    W.rain.visible = W.rain.material.opacity > 0.01;
    if (W.rain.visible) { var rp = W.rain.geometry.attributes.position; for (var i = 0; i < rp.count; i++) { var y = rp.getY(i) - dt * 14; if (y < 0) y += 25; rp.setY(i, y); } rp.needsUpdate = true; W.rain.position.set(camPos.x, 0, camPos.z); if (Math.random() < dt * 8) S.drip(0.6); }
    var bowA = weather.ph === 'bow' ? Math.min(1, weather.t / 10) * Math.min(1, (WEA.bow - weather.t) / 10) : 0;
    W.rainbow.children.forEach(function (c) { c.material.opacity = bowA * 0.55; }); W.rainbow.visible = bowA > 0.01;
    // Hue stub: what the lights *would* do (not sent anywhere yet)
    var lookUp = cam.getWorldDirection(tmp).y > 0.25;
    var col = bowA > 0.2 && lookUp ? '#ffb0e0' : wMix > 0.5 ? '#9fc0ff' : '#ffd9a0';
    hue = { on: !!settings.hue, color: col, bri: Math.round(settings.hueCap * (wMix > 0.5 ? 0.6 : 1)), weather: weather.ph };
  }

  // ---------------------------------------------------------------- sounds
  var birdT = 3;
  function stepSounds(dt, mult) {
    var sp = st.running ? (st.running > 1 ? 1.4 : 1.1) : 0.7; stride += dt * (mult || 1) * (st.running ? 2.6 : 1.6);
    if (stride > sp) { stride = 0; var srf = inCastle() ? 'soft' : W.surface(pos.x, pos.z); if (Math.hypot(pos.x + 8, pos.z - W.pathZ(-8) - 2.6) < 1.2) srf = 'puddle'; if (!(settings.car && st.mode === 'travel')) S.step(srf, st.running ? 1.4 : 1); }
  }
  function updateSound(dt) {
    var dB = Math.hypot(pos.x - W.B.x, pos.z - W.B.z), dP = Math.hypot(pos.x - W.P.x, pos.z - W.P.z), dW = Math.min(Math.hypot(pos.x - W.POND.x, pos.z - W.POND.z), Math.hypot(pos.x + 8, pos.z - 2));
    var crowd = 0.035 * clamp(1 - (Math.min(dB, dP) - 8) / 16, 0, 1) * (0.5 + Math.min(st.energy, 8) / 10);
    S.setBeds({ crowd: st.rocket ? 0 : crowd, water: 0.025 * clamp(1 - dW / 9, 0, 1) + (weather.ph === 'rain' ? 0.02 : 0), breeze: 0.03 + wMix * 0.02, wind: st.rocket ? 0.12 : 0.02 });
    birdT -= dt; if (birdT < 0) { birdT = rr(4, 13) * (crowd > 0.02 ? 2 : 1); if (weather.ph !== 'rain') S.bird(crowd > 0.02 ? 0.5 : 1); }
  }

  // ---------------------------------------------------------------- the main pose
  function update(dt) {
    st.t += dt; st.idle += dt; st.energy *= Math.exp(-dt / 14);
    tRoll = 0;
    if (st.rocket) poseRocket(st.rocket, dt);
    else if (st.momentOn) poseMoment(st.momentOn, dt);
    else if (st.mode === 'travel') {
      var spd = settings.car ? 5.5 : st.running ? (st.running > 1 ? 4.6 : 3.4) : 1.5, left = spd * dt;
      while (left > 0 && st.ri < st.route.length) { var tg = st.route[st.ri], d = V(tg.x - pos.x, 0, tg.z - pos.z), l = d.length(); if (l <= left) { pos.set(tg.x, 0, tg.z); left -= l; st.ri++; } else { pos.add(d.multiplyScalar(left / l)); left = 0; } }
      var ahead = lookAhead(5); var bob = settings.car ? 0 : Math.sin(st.t * (st.running ? 11 : 6.5)) * (st.running ? 0.05 : 0.02);
      // glances: mostly look ahead, sometimes up and around
      nextGlance -= dt; if (nextGlance < 0 && glanceT <= 0) { glanceT = rr(2.5, 4); nextGlance = rr(7, 14); glance.set(rr(-4, 4), rr(0, 1) < 0.4 ? rr(3, 6) : rr(-0.5, 1), rr(-3, 3)); }
      var gw = glanceT > 0 ? Math.sin(clamp(1 - glanceT / 3.5, 0, 1) * Math.PI) : 0; glanceT -= dt;
      set(V(pos.x, groundY(pos.x, pos.z) + EYE + bob + (settings.car ? -0.3 : 0), pos.z), V(ahead.x + glance.x * gw, groundY(ahead.x, ahead.z) + EYE - 0.2 + glance.y * gw, ahead.z + glance.z * gw), 4);
      stepSounds(dt);
      if (st.ri >= st.route.length) arrive();
    } else if (st.act) poseAct(st.act, dt);
    else idlePose(dt);
    // glance at the buddy / pointed thing
    if (glanceAt && glanceAtT > 0) { glanceAtT -= dt; var w = Math.sin(clamp(1 - glanceAtT / 3, 0, 1) * Math.PI) * 0.7; tLook.lerp(glanceAt.position.clone().setY(glanceAt.position.y + 0.4), w); }
    // castle rocks when other kids bounce
    if (st.place === 'bouncy' && !st.rocket) { tPos.y += rockAmt * 0.06; tRoll += Math.sin(st.t * 3.1) * rockAmt * 0.01; }
    var a = 1 - Math.exp(-k * dt); camPos.lerp(tPos, a); camLook.lerp(tLook, 1 - Math.exp(-Math.min(k, 8) * dt));
    roll += (tRoll - roll) * (1 - Math.exp(-4 * dt));
    cam.position.copy(camPos); cam.lookAt(camLook); cam.rotateZ(roll); if (flip) cam.rotateX(flip); if (twist) cam.rotateY(twist);
    W.myCar.visible = !!settings.car && st.mode === 'travel';
  }
  function arrive() {
    st.mode = 'area'; st.route = null; st.place = st.dest || 'path'; st.dest = null; st.running = 0; st.idle = 0;
    if (st.pendingAct) { var p = st.pendingAct; st.pendingAct = null; if (p === 'rocket') rocketTap(); else if (ACT_PLACE[p.slice(0, 2)] === st.place) startAct(p); }
    pushState();
  }
  var watch = { tgt: V(0, 0, 0), t: 0 };
  function idlePose(dt) {
    var sp = SPOTS[st.place], base = V(pos.x, groundY(pos.x, pos.z) + (sp && sp.sit ? 0.95 : EYE), pos.z);
    // people-watching: after a quiet moment the view drifts slowly between kids, the buddy, trees, birds
    watch.t -= dt;
    if (watch.t <= 0) {
      watch.t = rr(7, 13); var opts = [];
      kids.forEach(function (kd) { if (kd.g.visible && kd.pos.distanceTo(pos) < 25) opts.push(kd.g.position.clone().setY(kd.g.position.y + 0.8)); });
      if (buddy) opts.push(buddy.position.clone().setY(0.6));
      if (sp) opts.push(sp.look.clone());
      opts.push(V(pos.x + rr(-12, 12), rr(1.5, 4), pos.z + rr(-12, 12)));
      watch.tgt.copy(pick(opts));
    }
    var breathe = Math.sin(st.t * 0.9) * 0.025, sway = Math.sin(st.t * 0.37) * 0.04;
    var lookT = st.idle > 10 ? watch.tgt : (sp ? sp.look : lookAhead(5).setY(EYE));
    set(V(base.x + sway, base.y + breathe, base.z), lookT, 1.2);
    tRoll = Math.sin(st.t * 0.31) * 0.012;
  }

  // ---------------------------------------------------------------- networking
  var phones = {}, nPhones = 0;
  function stateMsg() { return { t: 'st', area: st.mode === 'travel' ? (st.pendingAct && st.pendingAct.slice ? pageFor(ACT_PLACE[st.pendingAct.slice(0, 2)] || 'go') : 'go') : pageFor(st.place), moments: st.moments.map(function (m) { return { id: m.id, pic: m.pic }; }), s: settings }; }
  var lastPush = 0;
  function pushState() { var m = stateMsg(); for (var id in phones) net.send(phones[id], m); if (localPad) localPad.setState(m); lastPush = st.t; }
  function onMsg(conn, m) {
    if (!m || !m.t) return;
    if (!phones[conn.connectionId]) { phones[conn.connectionId] = conn; nPhones++; }
    hideStart();
    if (m.t === 'hello') { net.send(conn, stateMsg()); }
    else if (m.t === 'tap') tap(m.id);
    else if (m.t === 'back') back();
    else if (m.t === 'moment') momentTap(m.id);
    else if (m.t === 'set') applySettings(m.s);
  }
  function applySettings(s) { for (var k in s) if (k in C.defaults) settings[k] = s[k]; walkerSaveSettings(settings); setBuddy(); pushState(); }
  var useLocal = q.get('local') === '1';
  var net = new (useLocal ? LRNet.LocalHost : LRNet.Host)({ code: q.get('room') || undefined, onStatus: function (s, code) { showCode(); }, onMessage: onMsg, onJoin: function (c) { if (!phones[c.connectionId]) { phones[c.connectionId] = c; nPhones++; } hideStart(); }, onClose: function (c) { if (phones[c.connectionId]) { delete phones[c.connectionId]; nPhones--; } } });

  // ---------------------------------------------------------------- start screen + Play here
  var startEl = document.getElementById('start'), localPad = null;
  function showCode() {
    var url = (location.protocol === 'file:' || /localhost|127\.0\.0\.1/.test(location.host) ? location.href.replace(/index\.html.*$/, '').replace(/\?.*$/, '') + 'controller.html' : C.liveControllerUrl) + '?room=' + net.code + (useLocal ? '&local=1' : '');
    document.getElementById('code').textContent = net.code;
    try { var qr = qrcode(0, 'M'); qr.addData(url); qr.make(); document.getElementById('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) {}
    document.getElementById('mini').innerHTML = document.getElementById('qr').innerHTML; document.getElementById('minicode').textContent = net.code;
    window.WALKER.controllerUrl = url;
  }
  var started = false;
  // the overlay goes on its own flag: st.mode can drift off 'start' (idle moments etc.) before a phone arrives, which used to leave the QR up forever
  function hideStart() {
    if (started) return; started = true;
    startEl.classList.add('gone'); setTimeout(function () { startEl.style.display = 'none'; }, 900);
    if (st.mode === 'start') st.mode = 'area';
    try { S.init(); } catch (e) {}
    try { pushState(); } catch (e) {}
  }
  function playHere() {
    S.init(); hideStart(); if (localPad) return;
    document.body.classList.add('local');
    localPad = new WalkerPad(document.getElementById('lpad'), { compact: true, noAwake: true, send: function (m) { if (m.t === 'tap') tap(m.id); else if (m.t === 'back') back(); else if (m.t === 'moment') momentTap(m.id); else if (m.t === 'set') applySettings(m.s); } });
    localPad.s = settings; localPad.buildSettings(); pushState();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(function () {});
  }
  document.getElementById('here').onclick = playHere;
  document.addEventListener('pointerdown', function () { S.init(); });
  document.addEventListener('keydown', function (e) { S.init(); if (e.key === 'Enter' && !started) playHere(); });
  var tablet = isTouch && minDim >= 600 && maxDim <= 1600;
  if (tablet) { document.getElementById('here').classList.add('suggest'); setTimeout(function () { if (!started && !nPhones) playHere(); }, 7000); }
  if (q.get('auto') === 'here') setTimeout(playHere, 300);
  document.getElementById('ver').textContent = 'v' + C.version;

  // ---------------------------------------------------------------- loop + adaptive quality
  var last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, slow = 0, fast = 0;
  setBuddy();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (q.has('ff')) dt *= +q.get('ff') || 1;
    update(dt); updateKids(dt); updateBuddy(dt); updateWorld(dt); updateMoments(dt); updateSound(dt);
    if (st.mode === 'start') { st.t += 0; }
    if (st.t - lastPush > 0.6) pushState();
    renderer.render(scene, cam);
    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT > 2 && !q.has('q')) { var fps = fpsN / fpsAcc; if (fps < C.quality.downBelowFps && rung < C.quality.rungs.length - 1) { slow++; if (slow > 1) { rung++; applyQ(); slow = 0; } } else slow = 0; if (fps > C.quality.upAboveFps && rung > 0) { fast++; if (fast > 6) { rung--; applyQ(); fast = 0; } } else fast = 0; fpsAcc = fpsN = fpsT = 0; }
    requestAnimationFrame(frame);
  }
  window.WALKER = { st: st, tap: tap, back: back, moment: momentTap, set: applySettings, settings: settings, playHere: playHere, started: function () { return started; }, hue: function () { return hue; }, pos: pos, W: W, weather: weather, step: function (sec) { for (var i = 0; i < sec * 30; i++) { update(1 / 30); updateKids(1 / 30); updateBuddy(1 / 30); updateWorld(1 / 30); updateMoments(1 / 30); } renderer.render(scene, cam); } };
  requestAnimationFrame(frame);
})();
