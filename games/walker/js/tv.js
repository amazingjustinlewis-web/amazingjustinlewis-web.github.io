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
  var st = { mode: 'start', place: 'path', page: 'home', act: null, energy: 0, lastTap: -9, idle: 0, route: null, dest: null, running: 0, spd: 1.5, taps: [], moments: [], momentOn: null, t: 0, rocket: null, camQ: null, windAmt: 0, zooF: null };
  var pos = V(-6, 0, W.pathZ(-6)), heading = 0;    // the kid's feet
  var camPos = V(-6, EYE, W.pathZ(-6)), camLook = V(0, EYE, W.pathZ(0)), tPos = camPos.clone(), tLook = camLook.clone(), k = 4, roll = 0, tRoll = 0, flip = 0, twist = 0;
  var glance = V(0, 0, 0), glanceT = 0, nextGlance = 6, glanceAt = null, glanceAtT = 0;
  var stride = 0, lastSurfaceStep = 0;

  var SPOTS = {
    bouncy: { door: V(W.B.x + 10, 0, W.pathZ(W.B.x + 10)), in: [V(W.B.x + 8, 0, 0), V(W.B.x + 2, 0, 1)], look: V(W.B.x - 6, 2, 0), px: -36 },
    play: { door: V(W.P.x - 12, 0, W.pathZ(W.P.x - 12)), in: [V(W.P.x - 1, 0, 2)], look: V(W.P.x + 3, 1.5, -4), px: 34 },
    rocket: { door: V(0, 0, -2), in: [V(0, 0, -10), V(0, 0, -18)], look: V(0, 6, -24), px: 0 },
    pond: { door: V(1, 0, W.pathZ(1)), in: [V(3, 0, 8), V(4, 0, 11.2)], look: V(5, 0.3, 17), px: 1 },
    bench: { door: V(-14, 0, W.pathZ(-14)), in: [V(-14, 0, -7.3)], look: V(-10, 1, 2), px: -14, sit: true },
    coaster: { door: V(-34, 0, W.pathZ(-34)), in: [V(-35, 0, -18), V(-36, 0, -27.6)], look: V(-30, 6, -40) },
    zoo: { door: V(28, 0, W.pathZ(28)), in: [V(28, 0, -14), V(28, 0, -22)], look: V(28, 1.2, -36) },
    water: { door: V(-24, 0, W.pathZ(-24)), in: [V(-24, 0, 14), V(-24, 0, 21.5)], look: V(-26, 2, 36) },
    boats: { door: V(26, 0, W.pathZ(26)), in: [V(27, 0, 14), V(27, 0, 21.2)], look: V(28, 0.5, 32) }
  };
  function groundY(x, z) { return (Math.abs(x - W.B.x) < 6.6 && Math.abs(z - W.B.z) < 6.6) ? W.floorY : 0; }
  function inCastle() { return groundY(pos.x, pos.z) > 0; }
  var PAGE_OF = { bouncy: 'bouncy', play: 'play', zoo: 'zoo', water: 'water', boats: 'water', coaster: 'rides', rocket: 'rides', pond: 'quiet', bench: 'quiet' };
  function pageFor(place) { return PAGE_OF[place] || null; }
  function placeFor(id) { var p = id.slice(0, 2); if (p === 'b_') return 'bouncy'; if (p === 'p_') return 'play'; if (p === 'z_') return 'zoo'; if (id === 'w_boats') return 'boats'; if (p === 'w_') return 'water'; if (id === 'r_coaster') return 'coaster'; if (id === 'q_sky') return 'bench'; return null; }
  var CAT_PLACE = { cat_bouncy: 'bouncy', cat_play: 'play', cat_zoo: 'zoo', cat_water: 'water' }, GO_PLACE = { q_bench: 'bench', q_pond: 'pond' };

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
    if (st.dest === dest && st.mode === 'travel') return;   // extra taps just speed us up (tap rate, see update)
    if (st.place === dest && st.mode !== 'travel') return;
    stopAct(); st.momentOn = null;
    if (st.mode !== 'travel') st.spd = settings.car ? 6 : 1.8;
    st.route = buildRoute(dest); st.dest = dest; st.mode = 'travel'; st.place = 'path'; st.ri = 0;
  }
  function walkOut(run) {
    stopAct();
    if (SPOTS[st.place]) { var sp = SPOTS[st.place], r = []; for (var i = sp.in.length - 2; i >= 0; i--) r.push(sp.in[i].clone()); r.push(sp.door.clone()); var dx = sp.door.x > 0 ? -5 : 5; r.push(V(sp.door.x + dx, 0, W.pathZ(sp.door.x + dx))); st.route = r; st.ri = 0; st.dest = null; st.mode = 'travel'; st.place = 'path'; st.spd = settings.car ? 6 : 1.8; }
  }
  function lookAhead(d) {
    var p = pos.clone(), i = st.ri, left = d;
    while (st.route && i < st.route.length) { var seg = st.route[i].clone().sub(p); seg.y = 0; var l = seg.length(); if (l >= left) return p.add(seg.multiplyScalar(left / l)); left -= l; p.copy(st.route[i]); i++; }
    return p;
  }

  // ---------------------------------------------------------------- activities
  function stopAct() { if (st.act && st.act.cleanup) st.act.cleanup(); st.act = null; flip = 0; twist = 0; tRoll = 0; hand.visible = false; handL.visible = false; bucketG.visible = false; bucketG.userData.stream.visible = false; myTube.visible = false; st.zooF = null; W.wp.level = 0.35; }
  function startAct(id) { st.act = { id: id, t: 0, lvl: 1, last: st.t, q: 0, ph: 0, phase: 'start', pt: 0, flips: [], stage: 1, mult: 1 }; actTap(st.act, true); }
  function actTap(a, first) {
    a.last = st.t; if (!first) a.lvl = Math.min(a.id.indexOf('b_') === 0 ? 8 : 6, a.lvl + 1);
    if (a.id.indexOf('b_') === 0) st.energy += 1.5;
    if (a.id.indexOf('z_') === 0) { if (!first) a.stage++; a.more = Math.max(0, a.stage - 4); a.stageT = 0; a.from = pos.clone(); }
    if (a.id === 'r_coaster' && !first) { if (a.phase === 'ride' || a.phase === 'board') a.mult = Math.min(1.5, a.mult + 0.08); else if (a.dropT === undefined) a.again = true; }
    if (a.id === 'w_slide' && !first) { a.again = true; a.mult = Math.min(1.5, (a.mult || 1) + 0.1); }
    if (a.id === 'w_river' && !first) { a.mult = Math.min(2.2, (a.mult || 1) + 0.25); a.spinT = 0; }
    if (a.id === 'w_bucket') { var B = W.wp.bucket; if (B.tip <= 0) B.fill = Math.min(1, B.fill + (first ? 0.1 : 0.17)); }
    if (a.id === 'w_float' && !first) { a.kick = 1; S.splash(false); }
    if (a.id === 'w_boats' && !first) { a.burst = 1.4; S.motor(); setTimeout(function () { S.splash(false); }, 120); window.WALKER.motor = (window.WALKER.motor || 0) + 1; }
    if (a.id === 'q_sky' && !first) { a.pick = (a.pick || 0) + 1; }
    if (a.id === 'b_flip' && a.flips.length < 4) a.flips.push(0);
    if (a.id === 'b_ball') a.q++;
    if ((a.id === 'b_slide' || a.id === 'p_slide') && !first) a.q = Math.min(3, a.q + 1);
    if (a.id === 'p_sand') { a.stage2 = (a.stage2 || 0) + 1; a.skT = 0; a.done = false; a.from2 = camPos.clone(); S.step('dirt', 2); window.WALKER.sandLog = (window.WALKER.sandLog || []).concat([SAND_STEPS[Math.min(a.stage2, SAND_STEPS.length) - 1]]); }
    if (a.id === 'b_kids') { st.energy += 3; waveT = 1.7; setTimeout(function () { S.giggle(1.2); }, 300); }
  }
  function tap(id) {
    S.init(); hideStart(); st.lastTap = st.t; st.idle = 0; st.energy += 1; st.taps.push(st.t);
    // v0.4.1: a repeat of the same choice while that trip or ride is still starting counts as eager tapping (runs faster) but doesn't restart it
    var rep = st.lastTapId === id && st.t - (st.lastTapIdT || -9) < 1.2; st.lastTapId = id; st.lastTapIdT = st.t;
    if (rep && id !== 'buddy' && id !== 'r_car' && (st.mode === 'travel' || (st.act && st.act.id === id && st.act.t < .8))) return;
    if (id === 'b_kids') waveT = 1.7;   // v0.3: a little hand waves every time
    if (st.act && st.act.id === 'r_coaster' && (st.act.phase === 'board' || st.act.phase === 'ride' || st.act.dropT !== undefined) && id !== 'r_coaster' && id !== 'buddy' && id !== 'r_car') return coasterNudge(st.act, id);
    if (id === 'buddy') return buddyTap();
    if (id === 'r_car') { applySettings({ car: !settings.car }); S.pop(); if (settings.car) S.car(); return; }
    if (id.indexOf('cat_') === 0) { var cp = CAT_PLACE[id]; if (cp && st.place !== cp && !(st.mode === 'travel' && st.dest === cp)) { st.pendingAct = null; goTo(cp); } return; }
    if (GO_PLACE[id]) { if (st.place !== GO_PLACE[id]) { st.pendingAct = null; goTo(GO_PLACE[id]); } return; }
    if (id === 'r_rocket') { if (st.place === 'rocket' && st.mode !== 'travel') return rocketTap(); goTo('rocket'); st.pendingAct = 'rocket'; return; }
    var need = placeFor(id); if (!need) return;
    if (st.place !== need || st.mode === 'travel') { goTo(need); st.pendingAct = id; return; }
    if (st.act && st.act.id === id) actTap(st.act); else { stopAct(); startAct(id); }
  }
  function back() {
    S.init(); st.lastTap = st.t; st.idle = 0;
    var fast = st.t - (st.lastBack || -9) < 1.2; st.lastBack = st.t;
    if (st.rocket) { st.rocket.t = Math.max(st.rocket.t, st.rocket.dur - 6); return; }
    if (st.momentOn) { endMoment(); return; }
    if (st.act) { stopAct(); return; }
    if (st.mode === 'travel') { if (fast) { st.taps.push(st.t, st.t); st.lastTap = st.t; return; } if (!st.dest) return; st.route = null; st.dest = null; st.mode = 'area'; st.pendingAct = null; return; }
    walkOut(fast);
  }

  // pose helpers: write into tPos / tLook
  function set(p, l, kk) { tPos.copy(p); tLook.copy(l); k = kk || 8; }
  var tmp = V(0, 0, 0);
  // v0.4.2: walk over on the ground before getting on (no more floating to a ride); a.hopT then softens the step on
  function approach(a, dt, g, look) { if (a.apDone) { if (a.hopT < 0.7) a.hopT += dt; return true; }
    if (!a.ap) { a.ap = { t: 0, from: pos.clone().setY(0) }; a.ap.d = Math.max(0.6, a.ap.from.distanceTo(g) / 1.6); }
    var A = a.ap; A.t += dt; var u = ease(clamp(A.t / A.d, 0, 1)); tmp.lerpVectors(A.from, g, u); pos.set(tmp.x, 0, tmp.z);
    set(V(tmp.x, EYE + Math.abs(Math.sin(A.t * 7)) * 0.03 * (1 - u), tmp.z), look, 5); if (u < 1) stepSounds(dt); if (A.t > A.d + 0.25) { a.apDone = true; a.hopT = 0; } return false; }
  function hopSoft(a) { if (a.hopT !== undefined && a.hopT < 0.7) k = 4 + a.hopT * 20; }
  // v0.4.2 playground slide: walk to the ladder, climb rung by rung, plop down at the top, slide with a speed-up, hop off at the bottom
  function poseLadderSlide(a, dt, L) {
    var top = W.pSlideTop, bot = W.pSlideBot, lad = W.pLadder, deck = W.pDeck, foot = V(lad.x, 0, lad.z - 0.75), RUNG = 0.35, NR = 7, SPR = 0.42;
    a.pt += dt;
    if (a.phase === 'start') { a.phase = 'walk'; a.pt = 0; a.from = pos.clone().setY(0); a.wd = Math.max(0.7, a.from.distanceTo(foot) / 1.6); }
    if (a.phase === 'walk') { var uw = ease(clamp(a.pt / a.wd, 0, 1)); tmp.lerpVectors(a.from, foot, uw); pos.set(tmp.x, 0, tmp.z); set(V(tmp.x, EYE + Math.abs(Math.sin(a.pt * 7)) * 0.03 * (1 - uw), tmp.z), V(lad.x, 1.8, lad.z), 5); if (uw < 1) stepSounds(dt); if (a.pt > a.wd + 0.3) { a.phase = 'climb'; a.pt = 0; } }
    else if (a.phase === 'climb') {   // one rung per step: quick lift, small settle bob, a soft clank
      var sp = SPR / (1 + Math.min(L, 4) * 0.1), n = a.pt / sp, i = Math.floor(n), f = n - i, lift = (Math.min(i, NR) + (i < NR ? ease(clamp(f / 0.6, 0, 1)) : 0)) * RUNG;
      var bob = i < NR ? -Math.sin(clamp((f - 0.6) / 0.4, 0, 1) * Math.PI) * 0.04 : 0;
      if (i !== a.ri && i <= NR) { a.ri = i; S.step('soft', 1); if (S.pluck) S.pluck(700 + i * 40, 0.15); }
      set(V(lad.x, EYE + lift + bob, foot.z + 0.35), V(lad.x, EYE + lift + 1.2, lad.z + 1.5), 14); pos.set(lad.x, 0, foot.z + 0.35);
      if (i >= NR) { a.phase = 'over'; a.pt = 0; a.c0 = camPos.clone(); } }
    else if (a.phase === 'over') {   // climb over onto the deck, crouched
      var uo = ease(clamp(a.pt / 0.8, 0, 1)), dk = V(deck.x, deck.y + 0.75, deck.z - 0.3); tmp.lerpVectors(a.c0, dk, uo); tmp.y += Math.sin(uo * Math.PI) * 0.08;
      set(tmp, V(bot.x, bot.y + 1, bot.z), 12); pos.set(tmp.x, 0, tmp.z); if (a.pt > 0.85) { a.phase = 'plop'; a.pt = 0; a.c0 = camPos.clone(); } }
    else if (a.phase === 'plop') {   // shuffle to the lip and plop down to sit, then a beat at the top
      var up = ease(clamp(a.pt / 0.45, 0, 1)), sit = V(top.x, deck.y + 0.8, top.z); tmp.lerpVectors(a.c0, sit, up); if (a.pt > 0.45) tmp.y = sit.y - Math.sin(clamp((a.pt - 0.45) / 0.25, 0, 1) * Math.PI) * 0.08;
      if (!a.plopped && a.pt > 0.45) { a.plopped = true; S.step('soft', 2); }
      set(tmp, V(bot.x + Math.sin(a.pt * 0.8) * 1.5, bot.y, bot.z), 10); pos.set(tmp.x, 0, tmp.z); if (a.pt > 1.6) { a.phase = 'down'; a.pt = 0; a.plopped = false; S.whee(); S.whoosh(1.5); } }
    else if (a.phase === 'down') { var dur = 2.0 / (1 + Math.min(L, 5) * 0.15), u = clamp(a.pt / dur, 0, 1), uu = u * u * u * 0.35 + u * u * 0.65; tmp.lerpVectors(V(top.x, deck.y + 0.8, top.z), bot, uu); set(tmp, V(bot.x, bot.y - 0.6, bot.z + 6), 22); pos.set(tmp.x, 0, tmp.z); tRoll = Math.sin(u * 9) * 0.04; if (u >= 1) { a.phase = 'hop'; a.pt = 0; } }
    else if (a.phase === 'hop') {   // hop off the end and land standing
      var uh = clamp(a.pt / 0.55, 0, 1), land = V(bot.x, EYE, bot.z + 1.3); tmp.lerpVectors(bot, land, ease(uh)); tmp.y += Math.sin(uh * Math.PI) * 0.35; if (uh >= 1) tmp.y -= Math.sin(clamp((a.pt - 0.55) / 0.2, 0, 1) * Math.PI) * 0.1;
      if (!a.landed && uh >= 1) { a.landed = true; S.step('dirt', 2); S.giggle && S.giggle(0.5); }
      set(tmp, V(bot.x, EYE, bot.z + 7), 16); pos.set(tmp.x, 0, tmp.z);
      if (a.pt > 1.2) { a.landed = false; if (a.q > 0) { a.q--; a.phase = 'start'; a.pt = 0; } else { a.phase = 'rest'; a.pt = 0; } } }
    else { set(V(bot.x, EYE, bot.z + 1.3), V(bot.x + Math.sin(a.t * 0.2) * 4, EYE, bot.z + 6), 2); pos.set(bot.x, 0, bot.z + 1.3); }
  }
  function poseAct(a, dt) {
    a.t += dt;
    if (st.t - a.last > (a.id.indexOf('b_') === 0 ? 4 : 7) && a.lvl > 0) { a.lvl = Math.max(0, a.lvl - 1); a.last = st.t; }
    var L = a.lvl, B = W.B, P = W.P;
    switch (a.id) {
      case 'b_bounce': case 'b_flip': case 'b_kids': {
        var freq = 0.8 + Math.min(L, 5) * 0.1; a.ph += dt * freq * Math.PI;
        var h = a.id === 'b_kids' ? 0.35 + Math.min(L, 8) * 0.12 : L === 0 ? 0.06 : 0.25 + Math.min(L, 8) * 0.42 + (a.id === 'b_flip' ? 0.8 : 0);
        var s = Math.abs(Math.sin(a.ph)); if (a.prevS !== undefined && s < a.prevS && a.down === false) {} if (a.prevS !== undefined && a.prevS < 0.12 && s >= 0.12 && L > 0) { S.boing(h); if (a.id === 'b_bounce' && L >= 4 && !a.flips.length && Math.random() < (L - 3) * 0.2) a.flips.push(0); if (L >= 6 && Math.random() < 0.3) S.giggle(0.7); } a.prevS = s;
        var wander = L >= 3 ? 1.6 : 0.4, cx = B.x + 2 + Math.sin(a.t * 0.23) * wander, cz = B.z + 1 + Math.cos(a.t * 0.19) * wander;
        pos.set(cx, 0, cz);
        var look = a.id === 'b_kids' ? V(cx - 3, W.floorY + 1, cz) : V(B.x - 6 + Math.sin(a.t * 0.1) * 3, W.floorY + 1.5 + s * 0.5, B.z + Math.cos(a.t * 0.13) * 4);
        set(V(cx, W.floorY + EYE + h * s, cz), look, 14);
        // flips: each queued flip plays near the top
        if (a.flips.length) { a.flips[0] += dt / (L >= 6 ? 1.0 : 1.3); flip = -TAU * ease(a.flips[0]); twist = L >= 5 ? TAU * ease(a.flips[0]) : 0; if (a.flips[0] >= 1) { a.flips.shift(); flip = 0; twist = 0; S.whee(); } }
        break; }
      case 'b_ball': {
        var dist = Math.max(1.8, 4.2 - L * 0.35), dir = V(1, 0, 1).normalize(), spot = V(W.hoop.x + dir.x * dist, W.floorY, W.hoop.z + dir.z * dist); pos.set(spot.x, 0, spot.z);
        var handP = V(spot.x - dir.x * 0.8, W.floorY + 0.95, spot.z - dir.z * 0.8), b = a.ball || (a.ball = { ph: 'hold', t: 0, p: W.ball.position.clone(), v: V(0, 0, 0) });
        b.t += dt; var bl = W.ball.position;
        set(V(spot.x, W.floorY + EYE, spot.z), b.ph === 'fly' ? V(W.hoop.x, W.hoop.y - 0.1, W.hoop.z).lerp(bl, 0.35) : b.ph === 'dribble' ? V(W.hoop.x, W.hoop.y - 0.6, W.hoop.z).lerp(handP.clone().setY(W.floorY), 0.6) : V(W.hoop.x, W.hoop.y - 0.2, W.hoop.z), 6);
        if (b.ph === 'hold' || b.ph === 'back') {
          if (b.ph === 'back') { bl.lerp(handP, Math.min(1, dt * 4)); if (b.t > 0.8) { b.ph = 'hold'; b.t = 0; } }
          else bl.set(handP.x, handP.y + Math.sin(a.t * 2) * 0.03, handP.z);
          if (b.ph === 'hold' && a.q > 0) { a.q--; b.ph = 'dribble'; b.t = 0; b.n = 0; }
        } else if (b.ph === 'dribble') {
          var per = 0.5, f = (b.t / per) % 1, top = handP.y - (W.floorY + 0.2);
          bl.set(handP.x, W.floorY + 0.2 + top * Math.pow(Math.abs(1 - 2 * f), 0.75), handP.z);
          var nb = Math.floor(b.t / per + 0.5); if (nb > (b.n || 0)) { b.n = nb; S.step('soft', 3); S.boing(0.05); }
          if (b.t > per * 2) { b.ph = 'rise'; b.t = 0; }
        } else if (b.ph === 'rise') {
          var rel = V(spot.x - dir.x * 0.3, W.floorY + 2.05, spot.z - dir.z * 0.3); bl.lerpVectors(handP, rel, ease(b.t / 0.35));
          if (b.t > 0.38) {
            // v0.3: no scripted outcome - the release just wobbles a little and the rim physics decides (~8 in 10 go in)
            var tg = W.hoop.clone(), jr = gauss() * SHOT_JIT, ja = Math.random() * TAU; b.rimHits = 0; b.made = false; tg.x += Math.cos(ja) * jr; tg.z += Math.sin(ja) * jr;
            var Tt = (0.8 + dist * 0.08) * (1 + gauss() * 0.02); b.p.copy(rel); b.v.set((tg.x - rel.x) / Tt, (tg.y + 0.02 - rel.y + 0.5 * 9.8 * Tt * Tt) / Tt, (tg.z - rel.z) / Tt); b.ph = 'fly'; b.t = 0; S.whoosh(0.3);
          }
        } else if (b.ph === 'fly') {
          var H = W.hoop, Bx = W.B.x - 5.9, Bz = W.B.z - 5.9;
          for (var ss = 0; ss < 6; ss++) {
            var h6 = dt / 6, py = b.p.y; b.v.y -= 9.8 * h6; b.p.addScaledVector(b.v, h6);
            var rx = b.p.x - H.x, rz = b.p.z - H.z, rh = Math.hypot(rx, rz) || 1e-4, qx = H.x + rx / rh * 0.32, qz = H.z + rz / rh * 0.32;
            var nx = b.p.x - qx, ny = b.p.y - H.y, nz = b.p.z - qz, nd = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (nd < 0.245) { nx /= nd; ny /= nd; nz /= nd; var vn = b.v.x * nx + b.v.y * ny + b.v.z * nz; if (vn < 0) { b.v.x -= 1.55 * vn * nx; b.v.y -= 1.55 * vn * ny; b.v.z -= 1.55 * vn * nz; b.rimHits++; S.pluck(520 + Math.random() * 80, 0.6); } b.p.set(qx + nx * 0.245, H.y + ny * 0.245, qz + nz * 0.245); }
            var bd = (b.p.x - Bx) * dir.x + (b.p.z - Bz) * dir.z, lat = (b.p.x - Bx) * -dir.z + (b.p.z - Bz) * dir.x, vb = b.v.x * dir.x + b.v.z * dir.z;
            if (bd < 0.25 && bd > -0.3 && Math.abs(lat) < 0.7 && Math.abs(b.p.y - 3.8) < 0.55 && vb < 0) { b.v.x -= 1.6 * vb * dir.x; b.v.z -= 1.6 * vb * dir.z; S.boing(0.2); }
            if (!b.made && py > H.y && b.p.y <= H.y && rh < 0.3) { b.made = true; S.swish(); cheer(b.rimHits === 0 ? 'swish' : 'rim'); if (Math.random() < 0.6) setTimeout(function () { S.giggle(0.7); }, 300); b.v.multiplyScalar(0.45); }
            if (b.p.y < W.floorY + 0.2) { b.p.y = W.floorY + 0.2; if (b.v.y < -1) S.step('soft', Math.min(3, -b.v.y)); b.v.y = -b.v.y * 0.55; b.v.x *= 0.8; b.v.z *= 0.8; }
            var lx = b.p.x - W.B.x, lz = b.p.z - W.B.z; if (Math.abs(lx) > 6.3) { b.v.x = -b.v.x * 0.5; b.p.x = W.B.x + Math.sign(lx) * 6.3; } if (Math.abs(lz) > 6.3) { b.v.z = -b.v.z * 0.5; b.p.z = W.B.z + Math.sign(lz) * 6.3; }
          }
          bl.copy(b.p); a.lastShot = { made: b.made, rim: b.rimHits };
          if (b.t > 3.2) { b.ph = 'back'; b.t = 0; window.WALKER.shots = (window.WALKER.shots || []).concat([a.lastShot]); }
        }
        break; }
      case 'p_slide': poseLadderSlide(a, dt, L); break;
      case 'b_slide': {
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
        if (!approach(a, dt, V(W.swingPivot.x, 0, W.swingPivot.z + 1.3), V(W.swingPivot.x, 1, W.swingPivot.z))) { pos.set(tPos.x, 0, tPos.z); break; }
        var amp = L === 0 ? 0.08 : Math.min(1.05, 0.2 + L * 0.15); a.amp = (a.amp || 0) + (amp - (a.amp || 0)) * dt * 0.7; a.ph += dt * 1.95;
        var ang = Math.sin(a.ph) * a.amp; W.swings[0].rotation.x = ang;
        var piv = W.swingPivot, r = 2.6; tmp.set(piv.x, piv.y - Math.cos(ang) * r + 0.75, piv.z - Math.sin(ang) * r);   // v0.3: seat z = -sin (matches rotation.x), so we move WITH the seat
        set(tmp, V(piv.x, tmp.y - Math.sin(ang) * 6 - 0.2, tmp.z + 8), 30); st.swingDbg = { seatZ: piv.z - Math.sin(ang) * r, camZ: tmp.z }; pos.set(tmp.x, 0, tmp.z); hopSoft(a);
        if (a.prevA !== undefined && a.prevA < 0 && ang >= 0 && a.amp > 0.4) S.whoosh(0.5); a.prevA = ang;
        break; }
      case 'p_climb': {
        var DC = V(W.domeTop.x, 0.3, W.domeTop.z), DR = 2.6, base2 = V(DC.x, 0, DC.z - 3.4);
        function domeS(th) { return V(DC.x, DC.y + Math.sin(th) * DR, DC.z - Math.cos(th) * DR); }
        a.pt += dt; if (a.phase === 'start') { a.phase = 'walk'; a.pt = 0; a.from = pos.clone(); }
        if (a.phase === 'walk') { var wdd = Math.max(0.8, a.from.distanceTo(base2) / 1.6), uw = ease(clamp(a.pt / wdd, 0, 1)); tmp.lerpVectors(a.from, base2, uw); pos.set(tmp.x, 0, tmp.z); set(V(tmp.x, EYE, tmp.z), V(DC.x, 1.3, DC.z), 4); if (uw < 1) stepSounds(dt); if (a.pt > wdd + 0.5) { a.phase = 'climb'; a.pt = 0; } }
        else if (a.phase === 'climb') {
          var cd = 5 / (1 + Math.min(L, 4) * 0.12), uc = clamp(a.pt / cd, 0, 1), th = ease(uc) * 1.35, sp1 = domeS(th), nrm = sp1.clone().sub(DC).normalize();
          var eye = sp1.clone().addScaledVector(nrm, 0.5); eye.y += 0.35 + Math.abs(Math.sin(a.pt * 5)) * 0.06;
          if (uc < 0.15) eye.lerp(V(base2.x, EYE, base2.z), 1 - uc / 0.15);
          set(eye, domeS(Math.min(1.57, th + 0.45)).setY(domeS(Math.min(1.57, th + 0.45)).y + 0.2), 8); pos.set(eye.x, 0, eye.z);
          if (Math.random() < dt * 2.5) S.step('soft', 1); if (uc >= 1) { a.phase = 'top'; a.pt = 0; S.whee(); }
        } else {
          var topE = V(DC.x, DC.y + DR + 0.75, DC.z - 0.3); a.yawT = (a.yawT || 0) + dt * (0.1 + Math.min(L, 4) * 0.06);
          var la = a.yawT + Math.PI, lr = 10;
          set(V(topE.x, topE.y + Math.sin(a.pt * 0.8) * 0.02, topE.z), V(topE.x + Math.sin(la) * lr, 1.5 + Math.sin(a.pt * 0.23) * 1.2, topE.z - Math.cos(la) * lr), 2);
          tRoll = Math.sin(a.pt * 0.4) * 0.015; pos.set(topE.x, 0, topE.z);
        }
        break; }
      case 'p_spin': {
        if (!approach(a, dt, V(W.merryC.x + 2.6, 0, W.merryC.z), V(W.merryC.x, 0.8, W.merryC.z))) break;
        var spd = Math.min(L, 5) * 0.45; a.w = (a.w || 0) + (spd - (a.w || 0)) * dt * 0.6; a.ph += a.w * dt; W.merry.rotation.y = a.ph;
        var mc = W.merryC; tmp.set(mc.x + Math.cos(a.ph) * 1.3, mc.y + 1.0, mc.z - Math.sin(a.ph) * 1.3);
        set(tmp, V(mc.x + Math.cos(a.ph) * 9, 1.0, mc.z - Math.sin(a.ph) * 9), 30); pos.set(tmp.x, 0, tmp.z); hopSoft(a);
        break; }
      case 'p_seesaw': {
        var sc = W.seesawC, pr = a.partner; if (!approach(a, dt, V(sc.x + 0.8, 0, sc.z - 3), V(sc.x, 0.6, sc.z - 2.2))) break;
        if (!pr) {
          pr = a.partner = { t: 0, who: buddy ? 'buddy' : 'kid' };
          if (pr.who === 'kid') { seesawKid.visible = true; pr.obj = seesawKid; pr.from = V(sc.x + 6, 0, sc.z + 5); } else { bud.held = true; pr.obj = buddy; pr.from = bud.pos.clone(); }
          a.cleanup = function () { seesawKid.visible = false; bud.held = false; W.seesaw.rotation.x = 0; };
        }
        pr.t += dt; var sat = pr.t > 2.7, seatF = V(sc.x, 0, sc.z + 2.2), stand = V(sc.x + 0.5, 0, sc.z + 3.1);
        var amp2 = !sat ? 0 : L === 0 ? 0.04 : Math.min(0.32, 0.1 + L * 0.05); a.amp2 = (a.amp2 || 0) + (amp2 - (a.amp2 || 0)) * Math.min(1, dt * 1.5);
        a.base = sat ? (a.base || -0.28) * Math.exp(-dt * 2) : -0.28;   // my end sits down until they hop on
        if (sat) a.ph += dt * 1.8; var an = a.base + Math.sin(a.ph) * a.amp2; W.seesaw.rotation.x = an;
        var otherY = sc.y - Math.sin(an) * 2.2, o = pr.obj;
        if (pr.t < 2) { var ur = ease(pr.t / 2); tmp.lerpVectors(pr.from, stand, ur); o.position.set(tmp.x, Math.abs(Math.sin(pr.t * 9)) * 0.12, tmp.z); o.rotation.y = Math.atan2(stand.x - pr.from.x, stand.z - pr.from.z); if (o.userData.aL) { o.userData.aL.rotation.z = Math.sin(pr.t * 9) * 0.8; o.userData.aR.rotation.z = -Math.sin(pr.t * 9) * 0.8; } }
        else if (!sat) { var uj = (pr.t - 2) / 0.7; tmp.lerpVectors(stand, seatF, uj); o.position.set(tmp.x, otherY * uj + Math.sin(uj * Math.PI) * 0.7 - (pr.who === 'kid' ? 0.3 : 0) * uj, tmp.z); o.rotation.y = Math.PI; if (!pr.boing && uj > 0.85) { pr.boing = true; S.boing(0.4); S.giggle(0.8); } }
        else { o.position.set(seatF.x, otherY - (pr.who === 'kid' ? 0.3 : 0) + 0.05, seatF.z); o.rotation.y = Math.PI; if (o.userData.aL) { o.userData.aL.rotation.z = 0.6 + Math.sin(an * 6) * 0.4; o.userData.aR.rotation.z = -0.6 - Math.sin(an * 6) * 0.4; } }
        if (pr.who === 'buddy') bud.pos.set(o.position.x, 0, o.position.z);
        tmp.set(sc.x, sc.y + 0.9 + Math.sin(an) * 2.2, sc.z - 2.2 * Math.cos(an));   // v0.3: my seat is at local z=-2.2 -> y = +2.2 sin(an)
        set(tmp, V(o.position.x, o.position.y + 0.9, o.position.z), 20); pos.set(tmp.x, 0, tmp.z); hopSoft(a); st.seesawDbg = { seatY: sc.y + Math.sin(an) * 2.2, camY: tmp.y, partner: pr.who, sat: sat };
        if (a.prevB !== undefined && a.prevB > 0 && an <= 0 && a.amp2 > 0.1) S.boing(0.3); a.prevB = an;
        break; }
      case 'p_sand': poseSand(a, dt); break;
      case 'r_coaster': poseCoaster(a, dt); break;
      case 'z_horse': case 'z_pony': case 'z_goat': case 'z_bunny': case 'z_alpaca': case 'z_duck': poseZoo(a, dt); break;
      case 'w_slide': case 'w_river': case 'w_splash': case 'w_bucket': case 'w_float': poseWater(a, dt); break;
      case 'w_boats': poseBoats(a, dt); break;
      case 'q_sky': {
        var bc = W.BENCH, gp = V(bc.x + 2.5, 0, bc.z + 2.5); pos.set(gp.x, 0, gp.z);
        var lie = ease(a.t / 2.5), cl = W.clouds[(a.pick || 0) % W.clouds.length].position;
        tmp.set(gp.x, 0.35 + (EYE - 0.35) * (1 - lie), gp.z);
        set(tmp, lie < 1 ? V(gp.x, EYE, gp.z - 6).lerp(V(gp.x + Math.sin(a.t * 0.05) * 3, 30, gp.z - 12), lie) : V(cl.x * 0.15 + gp.x * 0.85 + Math.sin(a.t * 0.05) * 4, 30, gp.z - 14 + Math.cos(a.t * 0.04) * 4), 1.2);
        tRoll = Math.sin(a.t * 0.2) * 0.04;
        break; }
    }
  }

  // ---------------------------------------------------------------- v0.2: hand, tube, overlays
  var skinM = new T.MeshLambertMaterial({ color: '#f2c9a0' });
  var hand = new T.Group(); cam.add(hand); hand.visible = false; hand.position.set(0.22, -0.4, -0.7);
  var sleeve = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 0.5, 8), new T.MeshLambertMaterial({ color: '#7fb8ff' })); sleeve.rotation.x = Math.PI / 2 - 0.25; sleeve.position.set(0, -0.05, 0.25); hand.add(sleeve);
  var palm = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), skinM); palm.scale.set(1.1, 0.6, 1.3); hand.add(palm);
  var treat = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), new T.MeshLambertMaterial({ color: '#ff9a3d' })); treat.position.set(0, 0.05, -0.02); hand.add(treat);
  var myTube = new T.Mesh(new T.TorusGeometry(0.55, 0.2, 8, 20), new T.MeshLambertMaterial({ color: '#ff8fc7' })); myTube.rotation.x = Math.PI / 2 - 0.3; myTube.position.set(0, -0.62, -0.35); myTube.visible = false; cam.add(myTube);
  var portEl = document.getElementById('port'), splashEl = document.getElementById('splashfx');
  function splashFx(big) { if (!splashEl) return; splashEl.classList.remove('go', 'big'); void splashEl.offsetWidth; splashEl.classList.add('go'); if (big) splashEl.classList.add('big'); }
  W.wp.onTip = function () { var B = W.wp.bucket.pivot.position, d = Math.hypot(pos.x - B.x, pos.z - B.z); if (d < 2.2) { setTimeout(function () { S.splash(true); splashFx(true); S.giggle(1.2); }, 450); } else if (d < 20) setTimeout(function () { S.splash(false); }, 450); };
  W.bb.onBump = function (mine, v) { if (mine) { S.boing(0.6 + v * 0.3); S.splash(false); splashFx(false); bumpShake = 0.5; if (Math.random() < 0.7) setTimeout(function () { S.giggle(1); }, 200); } else if (st.place === 'boats') S.boing(0.2); };
  var bumpShake = 0;
  var QY = new T.Quaternion(), QX = new T.Quaternion(), QB = new T.Quaternion(), MB = new T.Matrix4(), AY = V(0, 1, 0), AX = V(1, 0, 0);

  // ---------------------------------------------------------------- v0.3 extras
  function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(TAU * Math.random()); }
  var SHOT_JIT = +(q.get('jit') || 0.088);
  function coasterNudge(a, id) {
    a.mult = Math.min(1.5, a.mult + 0.08); a.after = id; S.pop();
    var pl = CAT_PLACE[id] || GO_PLACE[id] || placeFor(id) || (id === 'r_rocket' ? 'rocket' : null);
    if (pl && pl !== 'coaster' && SPOTS[pl]) { a.lookP = SPOTS[pl].look.clone(); a.lookT = 4; }
    window.WALKER.nudges = (window.WALKER.nudges || 0) + 1;
  }
  // lap bar (on the camera): 0 = up, 1 = down over your lap
  var lapPiv = new T.Group(); lapPiv.position.set(0, -0.14, -0.12); cam.add(lapPiv); lapPiv.visible = false;
  (function () { var bm = new T.MeshLambertMaterial({ color: '#ffcf3f' }), pad = new T.MeshLambertMaterial({ color: '#3a6fd8' }), arm = new T.MeshLambertMaterial({ color: '#b0b6c2' });
    var bar = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.8, 12), pad); bar.rotation.z = Math.PI / 2; bar.position.set(0, -0.14, -0.42); lapPiv.add(bar);
    [-0.36, 0.36].forEach(function (x) { var m = new T.Mesh(new T.BoxGeometry(0.04, 0.04, 0.44), arm); m.position.set(x, -0.07, -0.21); m.rotation.x = 0.32; lapPiv.add(m); var c = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), bm); c.position.set(x, -0.14, -0.42); lapPiv.add(c); }); })();
  var lapA = 1.9;
  // waving hand
  var waveT = 0, waveH = new T.Group(); cam.add(waveH); waveH.visible = false;
  (function () { var sk = new T.MeshLambertMaterial({ color: '#f2c9a0' }); var pm = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), sk); pm.scale.set(1, 1.15, 0.45); waveH.add(pm);
    for (var i = 0; i < 4; i++) { var f = new T.Mesh(new T.CylinderGeometry(0.012, 0.014, 0.075, 6), sk); f.position.set(-0.036 + i * 0.024, 0.09, 0); f.rotation.z = (i - 1.5) * 0.12; waveH.add(f); }
    var th = new T.Mesh(new T.CylinderGeometry(0.013, 0.015, 0.06, 6), sk); th.position.set(-0.07, 0.01, 0); th.rotation.z = 1.0; waveH.add(th);
    var sl = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.35, 8), new T.MeshLambertMaterial({ color: '#7fb8ff' })); sl.position.set(0, -0.22, 0); waveH.add(sl); })();
  function updateWave(dt) {
    if (waveT <= 0) { waveH.visible = false; return; } waveT -= dt; var u = 1.7 - waveT, inn = Math.min(1, u / 0.25, waveT / 0.3);
    waveH.visible = true; waveH.position.set(0.16, -0.5 + inn * 0.38, -0.55); waveH.rotation.set(0, 0, Math.sin(u * 13) * 0.45 - 0.1);
    window.WALKER.waved = (window.WALKER.waved || 0) + dt;
  }
  // second hand + bucket for the sandbox
  var handL = new T.Group(); cam.add(handL); handL.visible = false; handL.position.set(-0.22, -0.4, -0.7);
  (function () { var sl = new T.Mesh(new T.CylinderGeometry(0.055, 0.065, 0.5, 8), new T.MeshLambertMaterial({ color: '#7fb8ff' })); sl.rotation.x = Math.PI / 2 - 0.25; sl.position.set(0, -0.05, 0.25); handL.add(sl); var pm = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshLambertMaterial({ color: '#f2c9a0' })); pm.scale.set(1.1, 0.6, 1.3); handL.add(pm); })();
  var bucketG = new T.Group(); bucketG.visible = false; cam.add(bucketG);
  (function () { var bk = new T.Mesh(new T.CylinderGeometry(0.11, 0.08, 0.16, 14, 1, true), new T.MeshLambertMaterial({ color: '#ff6b6b', side: T.DoubleSide })); bucketG.add(bk); var bt = new T.Mesh(new T.CircleGeometry(0.08, 14), new T.MeshLambertMaterial({ color: '#e04848', side: T.DoubleSide })); bt.rotation.x = -Math.PI / 2; bt.position.y = -0.08; bucketG.add(bt);
    var fill = new T.Mesh(new T.CircleGeometry(0.105, 14), new T.MeshLambertMaterial({ color: '#e8c27a', side: T.DoubleSide })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06; bucketG.add(fill); bucketG.userData.fill = fill;
    var str = new T.Mesh(new T.CylinderGeometry(0.02, 0.05, 0.6, 8), new T.MeshLambertMaterial({ color: '#e8c27a' })); str.visible = false; cam.add(str); bucketG.userData.stream = str; })();
  var sandM = new T.MeshLambertMaterial({ color: '#e3bd78' }), sandWet = new T.MeshLambertMaterial({ color: '#d4a862' }), castles = [], mounds = [];
  function newCastle(x, z) {
    var g = new T.Group(); g.position.set(x, 0.32, z); scene.add(g);
    var keep = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.22, 10), sandM); keep.position.y = 0.11; g.add(keep);
    [[-0.17, -0.1], [0.17, -0.1], [0, 0.16]].forEach(function (o) { var t = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.3, 8), sandWet); t.position.set(o[0], 0.15, o[1]); g.add(t); var c = new T.Mesh(new T.ConeGeometry(0.07, 0.1, 8), sandWet); c.position.set(o[0], 0.35, o[1]); g.add(c); });
    g.scale.set(1, 0.01, 1); g.userData.deco = 0; castles.push(g); if (castles.length > 4) { var old = castles.shift(); scene.remove(old); } return g;
  }
  function decorate(g) {
    var cols = ['#ffffff', '#ffb3c8', '#7fd7ff', '#ffd23f'], n = g.userData.deco++;
    if (n === 0) { var pole = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.22, 4), new T.MeshLambertMaterial({ color: '#8a6a4a' })); pole.position.set(0, 0.33, 0); g.add(pole); var fl = new T.Mesh(new T.PlaneGeometry(0.1, 0.06), new T.MeshLambertMaterial({ color: '#ff6b6b', side: T.DoubleSide })); fl.position.set(0.05, 0.41, 0); g.add(fl); }
    for (var i = 0; i < 5; i++) { var sh = new T.Mesh(new T.SphereGeometry(0.022, 6, 4), new T.MeshLambertMaterial({ color: cols[(i + n) % 4] })); var an = (i / 5 + n * 0.1) * TAU; sh.position.set(Math.cos(an) * 0.21, 0.04 + (n % 2) * 0.12, Math.sin(an) * 0.21); g.add(sh); }
  }
  // v0.4: ONE sandcastle, built right in front of you. Each tap adds the next piece: mound, walls, towers, flag, shells (then more shells).
  var SAND_STEPS = ['mound', 'walls', 'towers', 'flag', 'shells'], sandOne = null;
  function sandPiece(stage) {
    var g = sandOne, parts = [], m;
    function add(mesh, x, y, z) { mesh.position.set(x, y, z); g.add(mesh); parts.push(mesh); return mesh; }
    if (stage === 1) { m = add(new T.Mesh(new T.SphereGeometry(0.34, 16, 10, 0, TAU, 0, Math.PI / 2), sandM), 0, 0, 0); m.scale.y = 0.55; }
    else if (stage === 2) { for (var i = 0; i < 4; i++) { var an = i * Math.PI / 2 + Math.PI / 4, w = add(new T.Mesh(new T.BoxGeometry(0.42, 0.14, 0.07), sandWet), Math.cos(an) * 0.3, 0.07, Math.sin(an) * 0.3); w.rotation.y = -an + Math.PI / 2; for (var c = -1; c <= 1; c += 2) add(new T.Mesh(new T.BoxGeometry(0.06, 0.05, 0.07), sandWet), Math.cos(an) * 0.3 + Math.cos(-an) * 0 + Math.sin(an) * c * 0.12 * -1, 0.165, Math.sin(an) * 0.3 + Math.cos(an) * c * 0.12); } add(new T.Mesh(new T.CylinderGeometry(0.15, 0.19, 0.24, 12), sandM), 0, 0.2, 0); }
    else if (stage === 3) { [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(function (o) { add(new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.3, 10), sandWet), o[0] * 0.95, 0.15, o[1] * 0.95); add(new T.Mesh(new T.ConeGeometry(0.085, 0.12, 10), sandWet), o[0] * 0.95, 0.36, o[1] * 0.95); }); add(new T.Mesh(new T.CylinderGeometry(0.09, 0.1, 0.18, 10), sandM), 0, 0.41, 0); add(new T.Mesh(new T.ConeGeometry(0.11, 0.15, 10), sandWet), 0, 0.57, 0); }
    else if (stage === 4) { add(new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.28, 4), new T.MeshLambertMaterial({ color: '#8a6a4a' })), 0, 0.76, 0); var fl = add(new T.Mesh(new T.PlaneGeometry(0.14, 0.08), new T.MeshLambertMaterial({ color: '#ff6b6b', side: T.DoubleSide })), 0.07, 0.86, 0); g.userData.flag = fl; }
    else { var cols = ['#ffffff', '#ffb3c8', '#7fd7ff', '#ffd23f', '#c79bff'], n = stage - 5; for (var k = 0; k < 8; k++) { var a2 = (k / 8 + n * 0.06) * TAU, r = 0.4 + (n % 3) * 0.07; add(new T.Mesh(k % 2 ? new T.SphereGeometry(0.045, 8, 6) : new T.ConeGeometry(0.05, 0.07, 7), new T.MeshLambertMaterial({ color: cols[(k + n) % 5] })), Math.cos(a2) * r, 0.02, Math.sin(a2) * r); } }
    parts.forEach(function (pm) { pm.userData.s = pm.scale.clone(); pm.scale.multiplyScalar(0.01); });
    g.userData.stage = stage; g.userData.parts = (g.userData.parts || 0) + parts.length; return parts;
  }
  function poseSand(a, dt) {
    var sd = W.sandC; a.skT = (a.skT || 0) + dt; var u = a.skT;
    var work = V(sd.x - 0.2, 0, sd.z - 0.35), stand = V(work.x + 0.15, 0, work.z + 1.0);
    if (!sandOne) { sandOne = new T.Group(); sandOne.position.set(work.x, 0.32, work.z); scene.add(sandOne); }
    var mv = ease(clamp(u / 1.1, 0, 1)); tmp.lerpVectors(a.from2 || camPos, V(stand.x, 0.85, stand.z), mv); if (mv < 1 && a.from2 && a.from2.distanceTo(stand) > 0.6) stepSounds(dt, 0.8);
    set(tmp, V(work.x, 0.45, work.z), 5); pos.set(tmp.x, 0, tmp.z);
    hand.visible = true; handL.visible = true; bucketG.visible = false; bucketG.userData.stream.visible = false; treat.visible = false;
    if (a.builtFor !== a.stage2) { a.builtFor = a.stage2; a.parts = sandPiece(a.stage2); }
    var w = u - 1.1, g = clamp(w / 2.2, 0, 1), busy = w > 0 && g < 1;
    a.parts.forEach(function (pm, i) { var gi = clamp(g * 1.4 - i / a.parts.length * 0.4, 0, 1); pm.scale.copy(pm.userData.s).multiplyScalar(Math.max(0.01, ease(gi))); });
    var sc2 = busy ? 1 : 0.2, low = a.stage2 >= 5 ? 0.04 : 0;
    hand.position.set(0.14 + Math.sin(a.t * 11) * 0.05 * sc2, -0.42 - low + Math.cos(a.t * 13) * 0.03 * sc2, -0.6); handL.position.set(-0.14 + Math.sin(a.t * 12 + 1) * 0.05 * sc2, -0.42 - low + Math.cos(a.t * 10) * 0.03 * sc2, -0.6);
    if (busy && Math.random() < dt * 4) S.step(a.stage2 === 1 ? 'soft' : 'dirt', 1);
    if (sandOne.userData.flag) sandOne.userData.flag.rotation.y = Math.sin(st.t * 3) * 0.3;
    if (g >= 1 && !a.done) { a.done = true; S.pop(); if (a.stage2 === 4 || a.stage2 === 5) S.giggle(0.6); }
  }
  // basketball: light on the backboard, fireworks, cheer text
  var bulbM = new T.MeshBasicMaterial({ color: '#c9c2b0' }), bulb = new T.Mesh(new T.SphereGeometry(0.13, 12, 8), bulbM); bulb.position.set(W.B.x - 5.9, 4.45, W.B.z - 5.9); scene.add(bulb);
  var glowM = new T.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0, depthWrite: false }), glow = new T.Mesh(new T.SphereGeometry(0.45, 14, 10), glowM); glow.position.copy(bulb.position); scene.add(glow);
  var sparks = [], SPC = ['#ff6b6b', '#ffd23f', '#7fd7ff', '#9be36b', '#ff8fc7', '#c79bff'];
  for (var si = 0; si < 70; si++) { var spk = new T.Mesh(new T.SphereGeometry(0.045, 6, 4), new T.MeshBasicMaterial({ color: SPC[si % SPC.length] })); spk.visible = false; scene.add(spk); sparks.push({ m: spk, v: V(0, 0, 0), life: 0 }); }
  var cheerEl = document.createElement('div'); cheerEl.id = 'cheer'; document.body.appendChild(cheerEl);
  var cheerCss = document.createElement('style'); cheerCss.textContent = '#cheer{position:fixed;left:0;right:0;top:16vh;text-align:center;font-family:Fredoka,system-ui,sans-serif;font-weight:700;color:#fff;pointer-events:none;z-index:6;opacity:0;text-shadow:0 4px 0 #0003,0 0 24px #ff8fc7}#cheer.go{animation:cheer 2.2s ease-out}#cheer.big{font-size:11vh;color:#ffd23f}#cheer.small{font-size:7vh}@keyframes cheer{0%{opacity:0;transform:scale(.5)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-3vh)}}'; document.head.appendChild(cheerCss);
  var lightT = 0, lightKind = null;
  function cheer(kind) {
    lightT = kind === 'swish' ? 2.4 : 1.6; lightKind = kind; window.WALKER.cheers = (window.WALKER.cheers || []).concat([kind]);
    cheerEl.className = ''; void cheerEl.offsetWidth; cheerEl.textContent = kind === 'swish' ? 'Nothing but net!' : 'Good shot!'; cheerEl.className = 'go ' + (kind === 'swish' ? 'big' : 'small');
    if (kind === 'swish') { var c0 = V(W.hoop.x, W.hoop.y + 1.4, W.hoop.z); sparks.forEach(function (p, i) { p.m.position.copy(c0); var th = Math.random() * TAU, ph = Math.acos(rr(-0.4, 1)), sp = rr(2.2, 4); p.v.set(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp); p.life = 1.5 + Math.random() * 0.5; p.m.visible = true; }); setTimeout(function () { S.pop(); S.whee(); }, 150); setTimeout(function () { S.pop(); }, 380); }
    else S.pluck(784, 0.6);
  }
  function updateFx(dt) {
    lightT = Math.max(0, lightT - dt);
    if (lightT > 0) { var bl = lightKind === 'swish' ? (Math.sin(lightT * 22) > -0.2 ? 1 : 0.4) : Math.min(1, lightT / 0.6) * 0.6; bulbM.color.set(lightKind === 'swish' ? '#ffe066' : '#ffcf8a'); glowM.color.set(lightKind === 'swish' ? '#ffe066' : '#ffcf8a'); glowM.opacity = bl * (lightKind === 'swish' ? 0.55 : 0.3); glow.scale.setScalar(lightKind === 'swish' ? 1.3 : 0.9); }
    else { bulbM.color.set('#c9c2b0'); glowM.opacity = 0; }
    sparks.forEach(function (p) { if (p.life <= 0) return; p.life -= dt; p.v.y -= 3.5 * dt; p.v.multiplyScalar(Math.exp(-dt * 0.8)); p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(Math.max(0.01, Math.min(1, p.life))); if (p.life <= 0) p.m.visible = false; });
    // lap bar
    var a = st.act, onC = !!(a && a.id === 'r_coaster'); lapPiv.visible = onC && lapA < 1.85;
    var want = onC && a.bar ? 0 : 1.9; lapA += (want - lapA) * Math.min(1, dt * 3.5); lapPiv.rotation.x = lapA; if (!onC) lapA = 1.9;
    updateWave(dt);
  }
  var seesawKid = W.person('#b49bff', 0.68); seesawKid.visible = false; scene.add(seesawKid);

  // ---------------------------------------------------------------- roller coaster
  function poseCoaster(a, dt) {
    var CO = W.co, fr = a.fr || (a.fr = {}), s0 = CO.iPark * CO.ds; a.pt += dt;
    if (a.phase === 'start') { a.phase = 'board'; a.pt = 0; a.from = camPos.clone(); a.dist = 0; a.v = 0; a.pause = 0; a.clank = 0; CO.placeTrain(s0); }
    if (a.phase === 'board') {
      CO.frame(s0, fr); var seat = fr.p.clone().addScaledVector(fr.u, 1.3).addScaledVector(fr.t, -0.35);
      tmp.lerpVectors(a.from, seat, ease(a.pt / 2.2)); tmp.y += Math.sin(clamp(a.pt / 2.2, 0, 1) * Math.PI) * 0.4;
      set(tmp, fr.p.clone().addScaledVector(fr.t, 8).addScaledVector(fr.u, 1.2), 10); pos.set(tmp.x, 0, tmp.z);
      a.bar = a.pt > 1.5 ? 1 : 0; if (a.pt > 1.5 && !a.barSnd) { a.barSnd = true; S.clank(); S.clank(); }
      if (a.pt > 2.5) { a.phase = 'ride'; a.pt = 0; S.pop(); }
      return;
    }
    var s = s0 + a.dist, yaw = 0, pitch = 0, dLift = CO.iLift0 * CO.ds - s0, dTop = CO.iTop * CO.ds - s0 - 0.4;
    CO.frame(s, fr);
    if (a.phase === 'ride') {
      var v;
      if (a.dist < dLift) { v = Math.min(2.4 * a.mult, a.v + dt * 1.5); }
      else if (a.dist < dTop) { v = 2.0 * a.mult; a.clank += v * dt; if (a.clank > 0.5) { a.clank = 0; S.clank(); } yaw = Math.sin(a.pt * 0.35) * 0.55; pitch = 0.05 + Math.sin(a.pt * 0.23) * 0.1; }
      else if (a.pause < 1.8) { v = Math.max(0, a.v - dt * 4); a.pause += dt; pitch = -0.5 * ease(a.pause / 1.2); if (a.pause >= 1.8) { S.whee(); S.whoosh(2); } }
      else { v = Math.max(3, Math.sqrt(Math.max(0, 2 * 9.8 * (CO.yTop + 0.7 - fr.p.y)))) * 0.88 * a.mult; var left = CO.L - a.dist; if (left < 16) v = Math.min(v, 1.2 + left * 0.5); }
      a.v = v; a.dist += v * dt;
      if (a.dist > dTop && a.pause >= 1.8) { var sl = (s % CO.L + CO.L) % CO.L, li = Math.floor(sl / CO.ds); if (li >= CO.iLoop0 && !a.looped) { a.looped = true; S.whee(); if (Math.random() < 0.7) S.giggle(0.8); } }
      st.windAmt = clamp(v / 14, 0, 1) * 0.16;
      if (v > 7 && Math.random() < dt * 0.8) S.whoosh(0.6);
      a.bar = CO.L - a.dist < 12 ? 0 : 1; if (!a.bar && !a.barUp) { a.barUp = true; S.clank(); }
      if (a.dist >= CO.L) { a.dist = CO.L; a.phase = 'done'; a.pt = 0; S.giggle(1); st.windAmt = 0; a.rides = (a.rides || 0) + 1; }
    } else if (a.phase === 'done') {
      yaw = Math.sin(a.pt * 0.25) * 0.7; pitch = Math.sin(a.pt * 0.17) * 0.12;
      if (a.again) { a.again = false; a.dropT = 0; S.clank(); }
      if (a.dropT !== undefined) { a.dropT += dt; a.bar = 1; if (a.dropT > 0.9) { a.dropT = undefined; a.dist = 0; a.v = 0; a.pause = 0; a.looped = false; a.barUp = false; a.phase = 'ride'; a.pt = 0; } }
      else { a.bar = 0; if (a.after && a.pt > 1.2) { var nx = a.after; a.after = null; stopAct(); st.place = 'coaster'; tap(nx); return; } }
    }
    CO.placeTrain(s0 + a.dist); CO.frame(s0 + a.dist, fr);
    var shake = a.v > 6 ? (Math.random() - 0.5) * 0.02 * (a.v / 10) : 0;
    tPos.copy(fr.p).addScaledVector(fr.u, 1.3).addScaledVector(fr.t, -0.35).addScaledVector(fr.r, shake); st.camHard = true; pos.set(tPos.x, 0, tPos.z);
    MB.makeBasis(fr.r, fr.u, tmp.copy(fr.t).negate()); QB.setFromRotationMatrix(MB);
    if (a.lookT > 0 && a.lookP) { a.lookT -= dt; var dl = a.lookP.clone().sub(fr.p); yaw = clamp(Math.atan2(-dl.dot(fr.r), dl.dot(fr.t)), -1.4, 1.4); pitch = 0.04; }
    a.yaw = (a.yaw || 0) + (yaw - (a.yaw || 0)) * Math.min(1, dt * 2); a.pitch = (a.pitch || 0) + (pitch - (a.pitch || 0)) * Math.min(1, dt * 2);
    QY.setFromAxisAngle(AY, a.yaw); QX.setFromAxisAngle(AX, a.pitch); st.camQ = QB.multiply(QY).multiply(QX).clone();
    tLook.copy(fr.p).addScaledVector(fr.t, 5);
  }

  // ---------------------------------------------------------------- petting zoo
  function agentsOf(kind) { return W.zoo.agents.filter(function (g) { return g.kind === kind; }); }
  function headOf(ag) { return ag.g.userData.head.getWorldPosition(V(0, 0, 0)); }
  var HE = { horse: 1.9, pony: 1.3, goat: 0.8, bunny: 0.35, alpaca: 1.9, duck: 0.25 };
  function poseZoo(a, dt) {
    var kind = a.id.slice(2), pen = W.zoo.pens[kind], stg = Math.min(4, a.stage), ags = agentsOf(kind), main = ags[0];
    a.stageT = (a.stageT || 0) + dt; a.pt += dt;
    if (!a.from) a.from = pos.clone();
    var goal = stg === 1 ? pen.out : stg <= 3 ? pen.fence : pen.inside, wd = Math.max(1.2, a.from.distanceTo(goal) / 1.3), u = clamp(a.stageT / wd, 0, 1);
    var gp = V(0, 0, 0).lerpVectors(a.from, goal, ease(u)); if (u < 1) stepSounds(dt, 1);
    var fwd = V(pen.c.x - gp.x, 0, pen.c.z - gp.z).normalize();
    // the closest animal of this kind = what we look at
    var best = main, bd = 1e9; ags.forEach(function (g) { var d = g.pos.distanceTo(gp); if (d < bd) { bd = d; best = g; } });
    var look = headOf(best), eye = EYE - (stg >= 2 ? 0.08 : 0) - (stg >= 3 ? 0.08 : 0);
    if (kind === 'bunny' || kind === 'duck') eye -= stg >= 3 ? 0.25 : 0.1;
    var F = { kind: kind, stage: stg, at: stg < 4 ? V(pen.fence.x, 0, pen.fence.z).addScaledVector(fwd, 0.8) : gp.clone().addScaledVector(fwd, 0.6), fwd: fwd };
    hand.visible = false; treat.visible = false;
    if (stg === 3) { hand.visible = u >= 1; hand.position.set(0.2 + Math.sin(a.t * 2.4) * 0.07, -0.33 + Math.sin(a.t * 4.8) * 0.02, -0.82); if (Math.random() < dt * 0.35) zooSound(kind); }
    if (stg < 4 || u < 1) { if (a.ride) endRide(a); pos.set(gp.x, 0, gp.z); set(V(gp.x, eye, gp.z), look, 3); st.zooF = F; return; }
    // stage 4: inside
    if (kind === 'horse' || kind === 'pony') {
      if (!a.ride) { a.ride = { t: 0, ang: Math.atan2(main.pos.z - pen.c.z, main.pos.x - pen.c.x), dist: 0, from: camPos.clone(), clop: 0 }; main.ridden = true; a.cleanup = function () { endRide(a); }; S.giggle(0.6); }
      var R = a.ride, rr0 = pen.r * (kind === 'horse' ? 0.58 : 0.55), sp = (kind === 'horse' ? 1.0 : 0.95) + Math.min(a.more, 5) * 0.28; R.t += dt;
      var mount = clamp(R.t / 2, 0, 1); if (mount >= 1) { R.ang += dt * sp / rr0; R.dist += sp * dt; R.clop += sp * dt; if (R.clop > (kind === 'horse' ? 0.7 : 0.45)) { R.clop = 0; S.clop(kind === 'horse' ? 1 : 0.7); } }
      var hx = pen.c.x + Math.cos(R.ang) * rr0, hz = pen.c.z + Math.sin(R.ang) * rr0; main.pos.set(hx, 0, hz); main.g.position.set(hx, 0, hz);
      var tx = -Math.sin(R.ang), tz = Math.cos(R.ang); main.g.rotation.y = Math.atan2(tx, tz);
      main.g.userData.legs.forEach(function (l, i) { l.rotation.x = mount >= 1 ? Math.sin(R.dist * (kind === 'horse' ? 3.2 : 5) + (i === 0 || i === 3 ? 0 : Math.PI)) * (0.35 + sp * 0.08) : 0; });
      var bob = kind === 'horse' ? Math.sin(R.dist * 6.4) * 0.035 : Math.abs(Math.sin(R.dist * 5)) * 0.13, seat = V(hx - tx * (kind === 'horse' ? 0.5 : 0.3), (kind === 'horse' ? 2.5 : 1.75) + bob, hz - tz * (kind === 'horse' ? 0.5 : 0.3));
      if (mount < 1) { tmp.lerpVectors(R.from, seat, ease(mount)); set(tmp, seat.clone().add(V(tx * 4, -0.6, tz * 4)), 8); }
      else { var gl = Math.sin(st.t * 0.21) * 1.4; set(seat, V(hx + tx * 5 + Math.cos(R.ang) * gl, seat.y - 1.3, hz + tz * 5 + Math.sin(R.ang) * gl), 12); tRoll = -0.04 - (kind === 'pony' ? Math.sin(R.dist * 5) * 0.015 : 0); }
      pos.set(hx, 0, hz); st.zooF = F; return;
    }
    if (kind === 'bunny') {
      var sit = ease(clamp((a.stageT - wd) / 1.5, 0, 1)); pos.set(gp.x, 0, gp.z);
      F.at = gp.clone().addScaledVector(fwd, 0.55);
      set(V(gp.x, EYE - (EYE - 0.9) * sit, gp.z), look.clone().setY(0.05), 2);
      hand.visible = sit >= 1 && Math.sin(a.t * 0.4) > -0.3; hand.position.set(0.16 + Math.sin(a.t * 2) * 0.06, -0.38, -0.6);
      if (Math.random() < dt * 0.25) S.squeak(); st.zooF = F; return;
    }
    if (kind === 'duck') {
      if (!a.walk) a.walk = { ang: Math.atan2(gp.z - pen.c.z, gp.x - pen.c.x), from: gp.clone(), t: 0 }; var Wk = a.walk; Wk.t += dt;
      var rx = 2.2, rz = 1.4, sp2 = 0.32 + Math.min(a.more, 4) * 0.08; Wk.ang += dt * sp2 / 1.8;
      var on = V(pen.c.x + Math.cos(Wk.ang) * rx, 0, pen.c.z + Math.sin(Wk.ang) * rz), w0 = ease(clamp(Wk.t / 2, 0, 1)), wp = V(0, 0, 0).lerpVectors(Wk.from, on, w0);
      pos.set(wp.x, 0, wp.z); stepSounds(dt, 0.7);
      var ahead = V(pen.c.x + Math.cos(Wk.ang + 0.6) * rx, 0, pen.c.z + Math.sin(Wk.ang + 0.6) * rz), glanceBack = Math.sin(a.t * 0.3) > -0.3;
      set(V(wp.x, EYE - 0.1, wp.z), glanceBack ? headOf(ags[2]).setY(0) : ahead.setY(0.4), 2);
      F.trail = function (d) { var aa = Wk.ang - d / 1.8; return V(pen.c.x + Math.cos(aa) * rx, 0, pen.c.z + Math.sin(aa) * rz); }; F.at = wp.clone();
      if (Math.random() < dt * 0.8) S.squeak(); st.zooF = F; return;
    }
    // goats / alpaca: feeding from the hand
    pos.set(gp.x, 0, gp.z); hand.visible = true; F.at = gp.clone().addScaledVector(fwd, 0.55);
    var near = ags.some(function (g) { return g.pos.distanceTo(F.at) < (kind === 'alpaca' ? 1.3 : 0.95); });
    a.treat = a.treat === undefined ? 1 : a.treat; if (a.more !== a.lastMore) { a.lastMore = a.more; a.treat = 1; }
    if (near && a.treat > 0) { a.treat -= dt * 0.25; if (Math.random() < dt * 2) S.munch(); } else if (a.treat <= 0 && Math.random() < dt * 0.3) a.treat = 1;
    treat.visible = a.treat > 0; treat.scale.setScalar(0.4 + Math.max(0, a.treat) * 0.8);
    hand.position.set(0.12, -0.36 + Math.sin(a.t * 1.5) * 0.01, -0.75);
    if (kind === 'alpaca' && near && Math.random() < dt * 0.3) S.hum();
    if (kind === 'goat' && Math.random() < dt * 0.2) zooSound('goat');
    set(V(gp.x, eye, gp.z), look, 2.5); st.zooF = F;
  }
  function endRide(a) { if (!a.ride) return; var m = agentsOf(a.id.slice(2))[0]; m.ridden = false; m.tgt.copy(m.pos); m.g.position.y = 0; a.ride = null; }
  function zooSound(kind) { if (kind === 'goat') { S.ctx() && (function () { var f = 480 + Math.random() * 80; S.pluck(f, 0.3); })(); } else if (kind === 'alpaca') S.hum(); else if (kind === 'bunny' || kind === 'duck') S.squeak(); else S.clop(0.4); }

  // ---------------------------------------------------------------- water park
  function poseWater(a, dt) {
    var WP = W.wp, pool = WP.pool; a.pt += dt; myTube.visible = false;
    if (a.id === 'w_slide') {
      var tw = WP.tower, foot = V(tw.x + 2.4, 0, tw.z - 1.6), top = V(tw.x + 0.3, 8.1 + EYE, tw.z + 0.4);
      if (a.phase === 'start') { a.phase = 'walk'; a.pt = 0; a.from = pos.clone(); }
      if (a.phase === 'walk') { var wd = Math.max(1, a.from.distanceTo(foot) / 2.4), u = ease(a.pt / wd); tmp.lerpVectors(a.from, foot, u); pos.set(tmp.x, 0, tmp.z); set(V(tmp.x, EYE, tmp.z), V(tw.x, 6, tw.z), 4); stepSounds(dt); if (a.pt > wd) { a.phase = 'climb'; a.pt = 0; } }
      else if (a.phase === 'climb') { var c = ease(a.pt / 4.5); tmp.lerpVectors(V(foot.x, EYE, foot.z), top, c); tmp.y += Math.sin(a.pt * 7) * 0.04 * (1 - c); set(tmp, V(tw.x + 6, tmp.y - 1.5, tw.z + 4), 6); pos.set(tmp.x, 0, tmp.z); if (a.pt > 4.5) { a.phase = 'top'; a.pt = 0; } }
      else if (a.phase === 'top') { var p0 = WP.slide.getPointAt(0.02); set(V(p0.x, p0.y + 0.9, p0.z), WP.slide.getPointAt(0.08).setY(4), 5); if (a.pt > 1.4) { a.phase = 'down'; a.pt = 0; a.s = 0; a.v = 1; S.whee(); } }
      else if (a.phase === 'down') {
        a.v = Math.min(7.5 * (a.mult || 1), a.v + dt * 4); a.s += a.v * dt; var f = Math.min(1, a.s / WP.slideL), p = WP.slide.getPointAt(f), ah = WP.slide.getPointAt(Math.min(1, f + 3 / WP.slideL));
        set(V(p.x, p.y + 0.5, p.z), ah.setY(ah.y + 0.25), 30); tRoll = f < 0.85 ? -0.28 : 0; pos.set(p.x, 0, p.z);
        if (Math.random() < dt * 2) S.whoosh(0.4);
        if (f >= 1) { a.phase = 'splash'; a.pt = 0; S.splash(true); splashFx(true); WP.spray(p.x + 1, 0.15, p.z, 30, 3); }
      } else if (a.phase === 'splash') {
        var sp = V(pool.c.x - 4.6, 0, pool.c.z - 2.2); set(V(sp.x, pool.y + 0.42 - Math.sin(clamp(a.pt / 1.2, 0, 1) * Math.PI) * 0.22, sp.z), V(sp.x + 6, 0.5, sp.z + 1), 6); pos.set(sp.x, 0, sp.z);
        if (a.pt > 1.6) { if (Math.random() < 0.8) S.giggle(0.9); a.phase = 'swim'; a.pt = 0; }
      } else if (a.phase === 'swim') {
        var s1 = V(pool.c.x - 4.6, 0, pool.c.z - 2.2), s2 = V(pool.c.x - 6.2, 0, pool.c.z - 3.2); tmp.lerpVectors(s1, s2, ease(a.pt / 3)); set(V(tmp.x, pool.y + 0.42 + Math.sin(a.pt * 2) * 0.03, tmp.z), V(tw.x, 5, tw.z + 4), 3); pos.set(tmp.x, 0, tmp.z);
        if (a.pt > 3.5) { if (a.again) { a.again = false; a.phase = 'climb'; a.pt = 0; foot.copy(pos); } else { a.phase = 'rest'; a.pt = 0; } }
      } else { set(V(pos.x, pool.y + 0.42 + Math.sin(a.pt * 1.5) * 0.03, pos.z), V(tw.x + Math.sin(a.pt * 0.1) * 4, 5, tw.z + 5), 2); if (a.again) { a.again = false; a.phase = 'climb'; a.pt = 0; } }
      return;
    }
    if (a.id === 'w_river') {
      var R = WP.river; if (!a.r) { a.r = { ang: Math.atan2(pos.z - R.c.z, pos.x - R.c.x), t: 0, from: camPos.clone(), spin: 0 }; }
      var r = a.r; r.t += dt; var enter = clamp(r.t / 2.5, 0, 1); r.ang += dt * 0.085 * (a.mult || 1) * (enter >= 1 ? 1 : 0);
      if (a.spinT !== undefined) { a.spinT += dt; r.spin = TAU * ease(a.spinT / 6); if (a.spinT > 6) { a.spinT = undefined; r.spin = 0; } }
      var px = R.c.x + Math.cos(r.ang) * (R.r - 0.8), pz = R.c.z + Math.sin(r.ang) * (R.r - 0.8), tx = -Math.sin(r.ang), tz = Math.cos(r.ang), yy = 0.62 + Math.sin(st.t * 1.4) * 0.03;
      var g0 = Math.sin(st.t * 0.13) * 1.1 + r.spin, lx = tx * Math.cos(g0) - tz * Math.sin(g0) * -1, lz = tz * Math.cos(g0) + tx * Math.sin(g0) * -1;
      lx = Math.cos(g0) * tx - Math.sin(g0) * tz; lz = Math.sin(g0) * tx + Math.cos(g0) * tz;
      if (enter < 1) { tmp.lerpVectors(r.from, V(px, yy, pz), ease(enter)); set(tmp, V(px + tx * 6, 0.6, pz + tz * 6), 6); }
      else set(V(px, yy, pz), V(px + lx * 6, 0.9 + Math.sin(st.t * 0.09) * 1.2, pz + lz * 6), 3);
      myTube.visible = enter > 0.6; pos.set(px, 0, pz); tRoll = Math.sin(st.t * 0.9) * 0.02;
      if (Math.random() < dt * 0.4) S.drip(0.8);
      return;
    }
    if (a.id === 'w_splash' || a.id === 'w_bucket') {
      var pad = WP.pad, B = WP.bucket.pivot.position, spot = a.id === 'w_bucket' ? V(B.x, 0, B.z + 0.4) : V(pad.x + 0.6, 0, pad.z + 1.6);
      if (!a.from) a.from = pos.clone(); var wd2 = Math.max(1, a.from.distanceTo(spot) / 1.4), u2 = ease(a.pt / wd2); tmp.lerpVectors(a.from, spot, u2); pos.set(tmp.x, 0, tmp.z); if (u2 < 1) stepSounds(dt);
      WP.level = a.id === 'w_splash' ? Math.min(1.1, 0.35 + a.lvl * 0.13) : 0.5;
      if (a.id === 'w_bucket') { WP.bucket.rate = 0.05 + a.lvl * 0.03; set(V(tmp.x, EYE, tmp.z), u2 < 1 ? V(B.x, 3, B.z) : V(B.x + Math.sin(a.t * 0.4) * 0.6, B.y - 0.3, B.z - 0.2), 3); }
      else { var ga = a.t * 0.18; set(V(tmp.x, EYE + (a.lvl > 3 ? Math.abs(Math.sin(a.t * 4)) * 0.08 : 0), tmp.z), V(pad.x + Math.cos(ga) * 4, 0.4 + Math.max(0, Math.sin(a.t * 0.3)) * 1.2, pad.z + Math.sin(ga) * 4), 2.5); if (Math.random() < dt * WP.level * 1.2) S.splash(false); if (a.lvl >= 4 && Math.random() < dt * 0.4) S.giggle(0.8); if (Math.random() < dt * WP.level * 0.5) splashFx(false); }
      return;
    }
    if (a.id === 'w_float') {
      if (!a.from) a.from = pos.clone(); var c2 = V(pool.c.x + Math.sin(a.t * 0.05) * 3, 0, pool.c.z + Math.cos(a.t * 0.04) * 1.6), w2 = ease(a.pt / 3);
      tmp.lerpVectors(a.from, c2, w2); pos.set(tmp.x, 0, tmp.z); a.kick = Math.max(0, (a.kick || 0) - dt);
      var lie = ease((a.pt - 2) / 2.5);
      set(V(tmp.x, pool.y + 0.4 + (EYE - 0.4) * (1 - w2) + Math.sin(a.t * 1.2) * 0.03 + a.kick * 0.05, tmp.z), V(tmp.x + 6 * (1 - lie) + Math.sin(a.t * 0.07) * 3, 1 + lie * 9, tmp.z + 1 + Math.cos(a.t * 0.06) * 3), 1.5);
      tRoll = Math.sin(a.t * 0.5) * 0.03; return;
    }
  }

  // ---------------------------------------------------------------- bumper boats
  function poseBoats(a, dt) {
    var BB = W.bb, me = BB.me; a.pt += dt;
    if (a.phase === 'start') { a.phase = 'board'; a.pt = 0; a.from = camPos.clone(); me.yaw = 0; a.cleanup = function () { me.thrust = 0; }; }
    if (a.phase === 'board') { var seat = V(me.pos.x, 1.0, me.pos.z); tmp.lerpVectors(a.from, seat, ease(a.pt / 2)); set(tmp, V(BB.c.x, 0.6, BB.c.z), 8); pos.set(tmp.x, 0, tmp.z); if (a.pt > 2.1) { a.phase = 'drive'; a.pt = 0; S.pop(); } return; }
    a.burst = Math.max(0, (a.burst || 0) - dt);
    if (a.burst > 0) { var tgt = null, bd = 1e9; BB.list.forEach(function (b, i) { if (i) { var d = b.pos.distanceTo(me.pos); if (d < bd) { bd = d; tgt = b; } } }); var want = Math.atan2(tgt.pos.x - me.pos.x, tgt.pos.z - me.pos.z), dy = want - me.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; me.yaw += dy * Math.min(1, dt * 3); me.thrust = 2.6; if (Math.random() < dt * 3) S.drip(1); }
    else { me.thrust = 0.35; me.spin += Math.sin(a.pt * 0.3) * dt * 0.15; }
    bumpShake = Math.max(0, bumpShake - dt);
    var fx = Math.sin(me.yaw), fz = Math.cos(me.yaw), sh = bumpShake * (Math.random() - 0.5) * 0.15;
    set(V(me.pos.x - fx * 0.2 + sh, 1.0 + Math.sin(st.t * 2) * 0.03, me.pos.z - fz * 0.2), V(me.pos.x + fx * 6 + Math.sin(st.t * 0.2) * 1.5, 0.7, me.pos.z + fz * 6), 25);
    tRoll = -me.spin * 0.08 + sh; pos.set(me.pos.x, 0, me.pos.z);
  }

  // ---------------------------------------------------------------- rocket ride (stub)
  function rocketTap() { if (!st.rocket) st.rocket = { t: 0, dur: 26, hi: 1 }; else st.rocket.hi = Math.min(3, st.rocket.hi + 0.5); }
  function poseRocket(r, dt) {
    r.t += dt; var R = W.R, u = r.t, alt; if (portEl) portEl.classList.toggle('on', u > 2.5 && u < r.dur - 1.5);
    if (u < 4) alt = 0; else if (u < r.dur - 8) alt = Math.pow(ease((u - 4) / 8), 1.6) * 90 * r.hi; else alt = 90 * r.hi * ease((r.dur - u) / 8);
    if (u > 2 && u < 5) S.rumble(0.3);
    W.rocket.position.y = alt; W.flame.material.opacity = (u > 3 && u < r.dur - 2) ? 0.6 + Math.random() * 0.3 : 0;
    var shake = (u > 3 && u < 9) ? 0.02 : 0;
    set(V(R.x + rr(-shake, shake), alt + 6, R.z + 1.0), V(R.x + Math.sin(u * 0.1) * 30, alt + 3 + Math.sin(u * 0.15) * 6, R.z + 40), 20);
    var sky = W.sky; var sp = clamp(alt / 120, 0, 0.85); scene.background = tmpC.copy(sky).lerp(SPACE, sp); scene.fog.color.copy(scene.background); scene.fog.far = 160 + alt * 3; W.stars.visible = sp > 0.2; W.stars.material.opacity = clamp((sp - 0.2) * 2, 0, 1); W.stars.position.y = alt;
    if (u >= r.dur) { if (portEl) portEl.classList.remove('on'); scene.fog.far = 160; W.stars.visible = false; st.rocket = null; W.rocket.position.y = 0; W.flame.material.opacity = 0; pos.set(R.x, 0, R.z + 6); st.place = 'rocket'; set(V(R.x, EYE, R.z + 6), V(R.x, 5, R.z), 3); }
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
    pos.set(p.x, 0, p.z); set(V(p.x, EYE + (mo.id === 'fish' || mo.id === 'chip' ? -0.35 : 0) + (settings.car && walk < 1 ? -0.3 : 0), p.z), mo.look, 3);
    if (walk < 1) stepSounds(dt, 1.2);
    var id = mo.id, t = mo.t;
    if (id === 'fish') { var jt = (t - 3) % 3.2; if (t > 3 && jt < 1) { W.fish.position.y = Math.sin(jt * Math.PI) * 0.7; W.fish.rotation.x = -jt * 3; if (!mo.splash || mo.splash < Math.floor((t - 3) / 3.2)) { mo.splash = Math.floor((t - 3) / 3.2) + 1; S.step('puddle', 3); } } else W.fish.position.y = -1; }
    if (id === 'deer' && t > 3) { var n = W.deer.userData.neck; n.rotation.x = Math.max(0, Math.sin((t - 3) * 2)) * 0.5 * (t < 7 ? 1 : 0); W.deer.lookAt(pos.x, 0, pos.z); }
    if (id === 'laugh' && Math.random() < dt * 1.2) { S.giggle(1); }
    if (id === 'laugh') W.laughers.forEach(function (l, i) { l.rotation.x = -Math.abs(Math.sin(t * 6 + i)) * 0.15; l.userData.aL.rotation.z = Math.sin(t * 7 + i) * 0.5; });
    if (id === 'ducks' && Math.random() < dt * 0.6) S.quack();
    if (t > 13) endMoment();
  }

  // ---------------------------------------------------------------- other kids
  var KC = ['#ff8f8f', '#8fc7ff', '#ffd86b', '#ffb36b', '#ff9fcf', '#b49bff', '#7fe0a0'];
  var kids = [0, 1, 2, 3, 4, 5, 6].map(function (i) { var g = W.person(KC[i], 0.68); scene.add(g); return { g: g, home: i < 5 ? 'bouncy' : 'play', flip: -1, ph: Math.random() * 6, pos: V(0, 0, 0), tgt: V(0, 0, 0), wander: 0, near: false }; });
  var BG = { bouncy: [V(-50, 0, 4.5), V(-51, 0, -3), V(-41, 0, -5), V(-44, 0, 4), V(-49, 0, -1)], play: [V(54, 0, -2), V(41, 0, 9)] };
  kids.forEach(function (kd, i) { var l = BG[kd.home]; kd.pos.copy(l[i % l.length]); kd.tgt.copy(kd.pos); });
  var rockAmt = 0;
  function updateKids(dt) {
    var e = st.energy, here = st.place, fwd = V(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
    rockAmt = 0;
    kids.forEach(function (kd, i) {
      var idx = kids.filter(function (o) { return o.home === kd.home; }).indexOf(kd);
      var active = idx === 0 || e > [0, 3, 6, 9, 12][idx];
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
      if (kd.home === 'bouncy') { var sb = Math.abs(Math.sin(kd.ph)); bounce = sb * (near ? 0.9 + Math.min(e, 16) * 0.05 : 0.5); if (kd.flip < 0 && near && e > 9 && kd.prevSb < 0.1 && sb >= 0.1 && Math.random() < 0.35) kd.flip = 0; kd.prevSb = sb; if (kd.flip >= 0) { kd.flip += dt / 1.0; kd.g.rotation.x = -TAU * ease(kd.flip); if (kd.flip >= 1) { kd.flip = -1; kd.g.rotation.x = 0; } } var dist = kd.pos.distanceTo(V(pos.x, 0, pos.z)); if (here === 'bouncy' && dist < 9) rockAmt += Math.abs(Math.cos(kd.ph)) * (1 - dist / 9); }
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
    else if (st.zooF && st.zooF.stage >= 2) { var zp = W.zoo.pens[st.zooF.kind].out; tgt = V(zp.x + 1.2, 0, zp.z + 0.8); }
    else if (st.act && /^(w_|r_)/.test(st.act.id) && st.act.id !== 'w_splash' && st.act.id !== 'w_bucket') { var sp0 = SPOTS[st.place]; tgt = sp0 ? sp0.in[sp0.in.length - 1].clone() : bud.pos.clone(); }
    else tgt = V(camPos.x + right.x * 1.5 + fwd.x * 1.3, 0, camPos.z + right.z * 1.5 + fwd.z * 1.3);
    if (!(bud.play && bud.play.t >= 3 && bud.play.t < 5) && !bud.held) {
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
    if (bud.happy > 1.5 && !bud.held) buddy.position.y += Math.abs(Math.sin(st.t * 8)) * 0.25;
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
    WalkerWorld2.update(W, dt, t, { zoo: st.zooF, wp: { near: Math.hypot(pos.x - W.wp.pad.x, pos.z - W.wp.pad.z) < 30 } });
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
    if (deerRun > 0) { deerRun -= dt; var away = deerRun > 9; var tg = away ? V(dh.x - 6, 0, dh.z - 26) : dh; var d = tg.clone().sub(W.deer.position); d.y = 0; var l = d.length(); if (l > 0.2) { W.deer.position.add(d.multiplyScalar(Math.min(1, (away ? 7 : 1.5) * dt / l))); W.deer.rotation.y = Math.atan2(tg.x - W.deer.position.x, tg.z - W.deer.position.z); W.deer.position.y = away ? Math.abs(Math.sin(t * 10)) * 0.3 : 0; } if (deerRun <= 0) deerRun = 0; }
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
    if (skyEv && skyEv.forced) bowA = 1;
    W.rainbow.children.forEach(function (c) { c.material.opacity = bowA * 0.55; }); W.rainbow.visible = bowA > 0.01;
    updateSky(dt, bowA);
    // Hue stub: what the lights *would* do (not sent anywhere yet)
    var lookUp = cam.getWorldDirection(tmp).y > 0.25;
    var col = bowA > 0.2 && lookUp ? '#ffb0e0' : wMix > 0.5 ? '#9fc0ff' : '#ffd9a0';
    hue = { on: !!settings.hue, color: col, bri: Math.round(settings.hueCap * (wMix > 0.5 ? 0.6 : 1)), weather: weather.ph };
  }

  // ---------------------------------------------------------------- v0.4 sky: night, flocks, shooting stars, comet, rainbow
  // Big things in the sky make the top edge of the pad glow; tapping it makes the view look up for a few seconds (nothing else changes).
  var NIGHT = { sky: new T.Color('#25335c'), hemi: new T.Color('#9aa8d8') }, nightAmt = q.get('night') ? 1 : 0, dayT = 0, DAY = 540, NIGHT0 = 410, NIGHT1 = 520;
  var skyEv = null, skyLog = [], nextFlock = rr(50, 90), nextStar = rr(15, 30), cometDone = false, forced = q.get('sky');
  var SKYPIC = { rainbow: '\uD83C\uDF08', stars: '\u2728', star: '\uD83C\uDF20', comet: '\u2604\uFE0F', flock: '\uD83D\uDC26' };
  var addMat = function (c, o) { return new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, fog: false, depthWrite: false, blending: T.AdditiveBlending }); };
  var streak = new T.Group(); (function () { var tl = new T.Mesh(new T.CylinderGeometry(0.08, 0.7, 16, 6, 1, true), addMat('#cfe8ff', 0.8)); tl.rotation.x = Math.PI / 2; tl.position.z = 8; streak.add(tl); streak.add(new T.Mesh(new T.SphereGeometry(0.9, 8, 6), addMat('#ffffff', 1))); })(); streak.visible = false; scene.add(streak);
  var comet = new T.Group(); (function () { comet.add(new T.Mesh(new T.SphereGeometry(1.4, 12, 8), addMat('#f2fbff', 1))); comet.add(new T.Mesh(new T.SphereGeometry(3.2, 12, 8), addMat('#8fd8ff', 0.25))); var tl = new T.Mesh(new T.ConeGeometry(3, 34, 14, 1, true), addMat('#a8f0e0', 0.28)); tl.rotation.x = -Math.PI / 2; tl.position.z = 17; comet.add(tl); var t2 = new T.Mesh(new T.ConeGeometry(1.4, 46, 10, 1, true), addMat('#cfe8ff', 0.22)); t2.rotation.x = -Math.PI / 2; t2.position.z = 23; t2.position.x = 2; comet.add(t2); })(); comet.visible = false; scene.add(comet);
  var flock = []; (function () { var fm = new T.MeshBasicMaterial({ color: '#3f4656', side: T.DoubleSide }), wg = new T.PlaneGeometry(0.7, 0.24); for (var i = 0; i < 11; i++) { var g = new T.Group(), a = new T.Mesh(wg, fm), b = new T.Mesh(wg, fm); a.position.x = -0.35; b.position.x = 0.35; g.add(a); g.add(b); g.userData = { w1: a, w2: b, i: i }; g.visible = false; scene.add(g); flock.push(g); } })();
  function camFwdFlat() { var f = cam.getWorldDirection(V(0, 0, 0)); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, -1); return f.normalize(); }
  function startSky(kind) {
    var f = camFwdFlat(), r = V(-f.z, 0, f.x), c = V(camPos.x, 0, camPos.z), ev = { kind: kind, t: 0, pic: SKYPIC[kind] };
    if (kind === 'flock') { ev.dur = 22; ev.a = c.clone().addScaledVector(f, 30).addScaledVector(r, -70).setY(16); ev.b = c.clone().addScaledVector(f, 18).addScaledVector(r, 70).setY(19); ev.at = function () { return flock[0].position; }; flock.forEach(function (g) { g.visible = true; }); }
    else if (kind === 'comet') { ev.dur = 40; ev.a = c.clone().addScaledVector(f, 120).addScaledVector(r, -110).setY(70); ev.b = c.clone().addScaledVector(f, 110).addScaledVector(r, 110).setY(85); ev.at = function () { return comet.position; }; comet.visible = true; }
    else if (kind === 'star') { ev.dur = 20; ev.ctr = c.clone().addScaledVector(f, 80).setY(60); ev.next = 0.6; ev.at = function () { return ev.ctr; }; }
    else if (kind === 'stars') { ev.dur = 25; ev.at = function () { return V(camPos.x, 0, camPos.z).addScaledVector(camFwdFlat(), 25).setY(45); }; }
    else if (kind === 'rainbow') { ev.dur = 1e9; ev.at = function () { return V(10, 52, -150); }; }
    skyEv = ev; skyLog.push(kind); pushState();
  }
  function endSky() { if (!skyEv) return; if (skyEv.kind === 'flock') flock.forEach(function (g) { g.visible = false; }); if (skyEv.kind === 'comet') comet.visible = false; streak.visible = false; skyEv = null; pushState(); }
  function updateSky(dt, bowA) {
    // day / night clock (night only when it isn't raining)
    dayT = (dayT + dt) % DAY; var nWant = q.get('night') ? 1 : (dayT > NIGHT0 && dayT < NIGHT1 && weather.ph !== 'rain' && weather.ph !== 'cloud') ? 1 : 0;
    nightAmt += (nWant - nightAmt) * (1 - Math.exp(-dt / 6));
    if (!st.rocket) { W.sky.lerp(NIGHT.sky, nightAmt * 0.92); scene.fog.color.copy(W.sky); W.hemi.color.lerp(NIGHT.hemi, nightAmt); W.hemi.intensity *= 1 - nightAmt * 0.45; W.sun.intensity *= 1 - nightAmt * 0.85; W.stars.visible = nightAmt > 0.15; W.stars.material.opacity = clamp((nightAmt - 0.15) * 1.4, 0, 1); W.stars.position.set(camPos.x, 0, camPos.z); }
    // pick an event
    if (!skyEv) {
      if (forced && !st.skyForcedDone) { st.skyForcedDone = true; startSky(forced); }
      else if (bowA > 0.35) startSky('rainbow');
      else if (nightAmt > 0.8) { nextStar -= dt; if (!cometDone && Math.random() < dt / 40) { cometDone = true; startSky('comet'); } else if (nextStar < 0) { nextStar = rr(30, 60); startSky(Math.random() < 0.6 ? 'star' : 'stars'); } }
      else if (nightAmt < 0.1 && weather.ph !== 'rain') { cometDone = false; nextFlock -= dt; if (nextFlock < 0) { nextFlock = rr(70, 130); startSky('flock'); } }
    }
    if (!skyEv) return;
    var e = skyEv; e.t += dt; var u = clamp(e.t / e.dur, 0, 1);
    if (e.kind === 'flock') { var hd = V(0, 0, 0).subVectors(e.b, e.a).normalize(), sd = V(-hd.z, 0, hd.x), p0 = V(0, 0, 0).lerpVectors(e.a, e.b, u); flock.forEach(function (g, i) { var row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; g.position.copy(p0).addScaledVector(hd, -row * 1.6).addScaledVector(sd, side * row * 1.4); g.position.y += Math.sin(st.t * 1.3 + i) * 0.3; g.rotation.y = Math.atan2(hd.x, hd.z); var fl = Math.sin(st.t * 7 + i * 0.7) * 0.55; g.userData.w1.rotation.z = fl; g.userData.w2.rotation.z = -fl; }); if (Math.random() < dt * 0.8) { var s1 = spat(p0, 10, 60); S.place('e_flock', s1.pan, 0.3 + s1.vol); S.via('e_flock', function () { S.bird(0.8); }); } }
    if (e.kind === 'comet') { comet.position.lerpVectors(e.a, e.b, u); comet.lookAt(V(0, 0, 0).subVectors(comet.position, V(0, 0, 0).subVectors(e.b, e.a))); var fade = Math.min(1, e.t / 4, (e.dur - e.t) / 4); comet.children.forEach(function (m, i) { m.material.opacity = [1, 0.25, 0.28, 0.22][i] * fade; }); }
    if (e.kind === 'star') { e.next -= dt; if (e.next < 0 && e.t < e.dur - 2) { e.next = rr(1.6, 3.2); e.sa = e.ctr.clone().add(V(rr(-40, 10), rr(5, 20), rr(-20, 20))); e.sv = V(rr(25, 40), rr(-14, -6), rr(-8, 8)); e.st = 0; streak.visible = true; streak.position.copy(e.sa); streak.lookAt(V(0, 0, 0).subVectors(e.sa, e.sv)); } if (streak.visible) { e.st += dt; streak.position.addScaledVector(e.sv, dt); var o = Math.sin(clamp(e.st / 1.1, 0, 1) * Math.PI); streak.children[0].material.opacity = 0.8 * o; streak.children[1].material.opacity = o; if (e.st > 1.1) streak.visible = false; } }
    if (e.kind === 'rainbow' && bowA < 0.3 && !e.forced) { endSky(); return; }
    if (e.kind === 'stars' && nightAmt < 0.6) { endSky(); return; }
    if (e.t > e.dur) endSky();
  }
  function skyTap() { S.init(); if (!skyEv) return; st.lookUp = { t: 0, dur: 5.5, at: skyEv.at }; window.WALKER.lookUps = (window.WALKER.lookUps || 0) + 1; }

  // ---------------------------------------------------------------- sounds
  var birdT = 3;
  function stepSounds(dt, mult) {
    var sp = st.running ? (st.running > 1 ? 1.4 : 1.1) : 0.7; stride += dt * (mult || 1) * (st.running ? 2.6 : 1.6);
    if (stride > sp) { stride = 0; var srf = inCastle() ? 'soft' : W.surface(pos.x, pos.z); if (Math.hypot(pos.x + 8, pos.z - W.pathZ(-8) - 2.6) < 1.2) srf = 'puddle'; if (!(settings.car && (st.mode === 'travel' || st.mode === 'moment'))) S.step(srf, st.running ? 1.4 : 1); }
  }
  // v0.4 proximity audio: every source has a spot in the world; volume follows distance, pan follows where you're facing
  var _f = V(0, 0, 0), _r = V(0, 0, 0), _up = V(0, 1, 0);
  function spat(p, near, far) {
    var dx = p.x - camPos.x, dz = p.z - camPos.z, d = Math.hypot(dx, dz);
    cam.getWorldDirection(_f); _f.y = 0; if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1); _f.normalize(); _r.crossVectors(_f, _up);
    var pan = d < 0.5 ? 0 : (dx * _r.x + dz * _r.z) / d, vol = clamp(1 - (d - near) / (far - near), 0, 1);
    vol = vol * vol; return { pan: pan * 0.85, vol: vol, d: d };
  }
  var EMIT = null;
  function emitters() {
    var bk = W.mom.busker, CO = W.co;
    return [
      { id: 'busker', p: function () { return bk.p; }, near: 3, far: 34, rate: 2.6, play: function (v) { S.pluck(pick([262, 294, 330, 392, 440, 523, 587]), 1); bk.obj.userData.head.rotation.z = Math.sin(st.t * 3) * 0.1; } },
      { id: 'coaster', p: function () { return CO.station; }, near: 6, far: 40, rate: 4, play: function () { S.clank(); } },
      { id: 'ducks', p: function () { return W.POND; }, near: 3, far: 22, rate: 0.35, play: function () { S.quack(); } },
      { id: 'chips', p: function () { return W.mom.chip.p; }, near: 2, far: 14, rate: 0.5, play: function () { S.squeak(); } },
      { id: 'laugh', p: function () { return W.mom.laugh.p; }, near: 3, far: 22, rate: 0.35, play: function () { S.giggle(0.8); } },
      { id: 'zoo', p: function () { return W.ZOO_C; }, near: 5, far: 30, rate: 0.5, play: function () { zooSound(pick(['goat', 'alpaca', 'horse', 'bunny'])); } },
      { id: 'splashpad', p: function () { return W.wp.pad; }, near: 3, far: 26, rate: 1.5, play: function () { S.drip(1.4); } },
      { id: 'bkids', p: function () { return W.B; }, near: 6, far: 30, rate: 0.5, play: function () { if (Math.random() < 0.5) S.giggle(0.7); else S.boing(0.3); } },
      { id: 'pkids', p: function () { return W.P; }, near: 6, far: 30, rate: 0.4, play: function () { if (Math.random() < 0.6) S.giggle(0.6); else S.whee(); } },
      { id: 'boats', p: function () { return W.BL_C; }, near: 5, far: 28, rate: 0.3, play: function () { S.boing(0.2); } }
    ];
  }
  var spatLog = {};
  function updateSound(dt) {
    if (!EMIT) EMIT = emitters();
    var away = st.rocket ? 0 : 1, crowdE = 0.5 + Math.min(st.energy, 8) / 10;
    // beds (looping): pond, water park, lagoon, kids' chatter near the castle and the playground
    var beds = [['pond', W.POND, 2, 16, 0.05], ['wpark', W.WP_C, 6, 34, 0.06], ['lagoon', W.BL_C, 5, 28, 0.04], ['kidsB', W.B, 6, 30, 0.035 * crowdE], ['kidsP', W.P, 6, 30, 0.03 * crowdE]];
    beds.forEach(function (b) { var s = spat(b[1], b[2], b[3]); S.place(b[0], s.pan, s.vol * b[4] * away); spatLog[b[0]] = s; });
    S.setBeds({ crowd: 0, water: weather.ph === 'rain' ? 0.02 : 0, breeze: 0.03 + wMix * 0.02, wind: st.rocket ? 0.12 : 0.02 + st.windAmt });
    // one-shot emitters: fire at their own rate, louder when close, panned to where they are
    EMIT.forEach(function (e) {
      var s = spat(e.p(), e.near, e.far); spatLog[e.id] = s; S.place('e_' + e.id, s.pan, s.vol * away);
      if (s.vol > 0.02 && away && Math.random() < dt * e.rate) S.via('e_' + e.id, function () { e.play(s.vol); });
    });
    // birds: each chirp comes from a real bird in the sky
    birdT -= dt; if (birdT < 0) { birdT = rr(2, 7); if (weather.ph !== 'rain' && !st.rocket) { var bi = W.birds[(Math.random() * W.birds.length) | 0], s = spat(bi.position, 4, 45); S.place('e_bird', s.pan, 0.35 + s.vol * 0.8); spatLog.bird = s; S.via('e_bird', function () { S.bird(1); }); } }
  }

  // ---------------------------------------------------------------- the main pose
  function update(dt) {
    st.t += dt; st.idle += dt; st.energy *= Math.exp(-dt / 14);
    tRoll = 0; st.camQ = null; st.camHard = false; if (!(st.act && st.act.id === 'r_coaster')) st.windAmt = 0;
    if (st.rocket) poseRocket(st.rocket, dt);
    else if (st.momentOn) poseMoment(st.momentOn, dt);
    else if (st.mode === 'travel') {
      // tap-to-run: speed follows how fast the buttons are being tapped, and eases back to a stroll when they stop
      var base = settings.car ? 6 : 1.8; st.taps = st.taps.filter(function (x) { return st.t - x < 2.5; });
      var rate = Math.max(0, st.taps.length - 1) / 2.5, tgtS = base + Math.min(rate, 5) * (settings.car ? 1.0 : 1.5);
      if (st.t - st.lastTap > 1.5) tgtS = base;
      st.spd += (tgtS - st.spd) * (1 - Math.exp(-dt * (tgtS > st.spd ? 3 : 0.6)));
      st.running = settings.car ? 0 : st.spd > 2.6 ? (st.spd > 5 ? 2 : 1) : 0;
      var spd = st.spd, left = spd * dt;
      while (left > 0 && st.ri < st.route.length) { var tg = st.route[st.ri], d = V(tg.x - pos.x, 0, tg.z - pos.z), l = d.length(); if (l <= left) { pos.set(tg.x, 0, tg.z); left -= l; st.ri++; } else { pos.add(d.multiplyScalar(left / l)); left = 0; } }
      var ahead = lookAhead(4 + spd * 0.6); st.bobPh = (st.bobPh || 0) + dt * (5.5 + spd * 1.1); var bob = settings.car ? Math.sin(st.t * 9) * 0.006 : Math.sin(st.bobPh) * (0.02 + clamp((spd - 1.5) / 6, 0, 1) * 0.05);
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
    // v0.4: tapped the glowing sky edge: look up toward it for a few seconds; walking / activities carry on underneath
    if (st.lookUp) { var L = st.lookUp; L.t += dt; var lw = Math.sin(clamp(L.t / L.dur, 0, 1) * Math.PI); lw = Math.min(1, lw * 1.6) * 0.92; var tg2 = L.at ? L.at() : null; if (tg2 && !st.camQ) tLook.lerp(tg2, lw); if (L.t >= L.dur) st.lookUp = null; }
    // castle rocks when other kids bounce
    if (st.place === 'bouncy' && !st.rocket) { tPos.y += rockAmt * 0.06; tRoll += Math.sin(st.t * 3.1) * rockAmt * 0.01; }
    var a = 1 - Math.exp(-k * dt); if (st.camHard) camPos.copy(tPos); else camPos.lerp(tPos, a); camLook.lerp(tLook, 1 - Math.exp(-Math.min(k, 8) * dt));
    roll += (tRoll - roll) * (1 - Math.exp(-4 * dt));
    cam.position.copy(camPos);
    if (st.camQ) { cam.quaternion.copy(st.camQ); roll = 0; }
    else { cam.lookAt(camLook); cam.rotateZ(roll); if (flip) cam.rotateX(flip); if (twist) cam.rotateY(twist); }
    var carOn = !!settings.car && (st.mode === 'travel' || (st.momentOn && st.momentOn.t < 3));
    W.myCar.visible = carOn;
    var fovT = 66 + (st.mode === 'travel' ? clamp((st.spd - (settings.car ? 6 : 1.8)) * 1.3, 0, 9) : 0); if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov += (fovT - cam.fov) * Math.min(1, dt * 2); cam.updateProjectionMatrix(); }
    if (carOn) { st.carT = (st.carT || 0) - dt; if (st.carT < 0) { st.carT = 2.4; S.car(); } }
  }
  function arrive() {
    st.mode = 'area'; st.route = null; st.place = st.dest || 'path'; st.dest = null; st.running = 0; st.idle = 0;
    if (st.pendingAct) { var p = st.pendingAct; st.pendingAct = null; if (p === 'rocket') rocketTap(); else if (placeFor(p) === st.place) startAct(p); }
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
  function stateMsg() { return { t: 'st', area: st.mode === 'travel' ? (st.pendingAct && st.pendingAct !== 'rocket' ? pageFor(placeFor(st.pendingAct)) : pageFor(st.dest)) : pageFor(st.place), place: st.place, moments: st.moments.map(function (m) { return { id: m.id, pic: m.pic }; }), sky: skyEv ? { kind: skyEv.kind, pic: skyEv.pic } : null, s: settings }; }
  var lastPush = 0;
  function pushState() { var m = stateMsg(); for (var id in phones) net.send(phones[id], m); if (localPad) localPad.setState(m); lastPush = st.t; }
  function onMsg(conn, m) {
    if (!m || !m.t) return;
    if (!phones[conn.connectionId]) { phones[conn.connectionId] = conn; nPhones++; document.body.classList.add('linked'); }
    hideStart();
    if (m.t === 'hello') { net.send(conn, stateMsg()); }
    else if (m.t === 'tap') tap(m.id);
    else if (m.t === 'back') back();
    else if (m.t === 'moment') momentTap(m.id);
    else if (m.t === 'set') applySettings(m.s);
    else if (m.t === 'sky') skyTap();
  }
  function applySettings(s) { for (var k in s) if (k in C.defaults) settings[k] = s[k]; walkerSaveSettings(settings); setBuddy(); pushState(); }
  var useLocal = q.get('local') === '1';
  var net = new (useLocal ? LRNet.LocalHost : LRNet.Host)({ code: q.get('room') || undefined, onStatus: function (s, code) { showCode(); }, onMessage: onMsg, onJoin: function (c) { if (!phones[c.connectionId]) { phones[c.connectionId] = c; nPhones++; } hideStart(); document.body.classList.add('linked'); }, onClose: function (c) { if (phones[c.connectionId]) { delete phones[c.connectionId]; nPhones--; } document.body.classList.toggle('linked', nPhones > 0); } });

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
    localPad = new WalkerPad(document.getElementById('lpad'), { compact: true, noAwake: true, send: function (m) { if (m.t === 'tap') tap(m.id); else if (m.t === 'back') back(); else if (m.t === 'moment') momentTap(m.id); else if (m.t === 'set') applySettings(m.s); else if (m.t === 'sky') skyTap(); } });
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
    update(dt); updateKids(dt); updateBuddy(dt); updateWorld(dt); updateMoments(dt); updateSound(dt); updateFx(dt);
    if (st.mode === 'start') { st.t += 0; }
    if (st.t - lastPush > 0.6) pushState();
    renderer.render(scene, cam);
    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT > 2 && !q.has('q')) { var fps = fpsN / fpsAcc; if (fps < C.quality.downBelowFps && rung < C.quality.rungs.length - 1) { slow++; if (slow > 1) { rung++; applyQ(); slow = 0; } } else slow = 0; if (fps > C.quality.upAboveFps && rung > 0) { fast++; if (fast > 6) { rung--; applyQ(); fast = 0; } } else fast = 0; fpsAcc = fpsN = fpsT = 0; }
    requestAnimationFrame(frame);
  }
  window.WALKER = { act: function () { return st.act ? { id: st.act.id, phase: st.act.phase } : null; }, cam: function () { return [camPos.x, camPos.y, camPos.z]; }, tapId: function (id) { tap(id); }, sky: function () { return { ev: skyEv && { kind: skyEv.kind, t: skyEv.t }, log: skyLog, night: nightAmt, lookUp: !!st.lookUp }; }, startSky: function (k) { endSky(); startSky(k); if (k === 'rainbow') { skyEv.forced = true; skyEv.dur = 25; W.rainbow.visible = true; } }, skyTap: function () { skyTap(); }, camDirY: function () { return cam.getWorldDirection(V(0, 0, 0)).y; }, spat: function () { return spatLog; }, srcs: function () { return S.srcs(); }, cheer: function (k) { cheer(k); }, fx: function () { return { sand: sandOne ? { stage: sandOne.userData.stage, parts: sandOne.userData.parts, groups: 1 } : null, castles: castles.length, deco: castles.map(function (c) { return c.userData.deco; }), mounds: mounds.length, lap: lapA, lapVis: lapPiv.visible, wave: waveH.visible, bulb: '#' + bulbM.color.getHexString() }; }, st: st, tap: tap, back: back, moment: momentTap, set: applySettings, settings: settings, playHere: playHere, started: function () { return started; }, hue: function () { return hue; }, pos: pos, W: W, weather: weather, step: function (sec) { for (var i = 0; i < sec * 30; i++) { update(1 / 30); updateKids(1 / 30); updateBuddy(1 / 30); updateWorld(1 / 30); updateMoments(1 / 30); updateFx(1 / 30); updateSound(1 / 30); } renderer.render(scene, cam); } };
  requestAnimationFrame(frame);
})();
