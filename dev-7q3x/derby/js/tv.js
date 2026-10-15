/* DEMOLITION DERBY - TV host: lobby, rounds, rendering (three.js), phone networking. */
(function () {
  'use strict';
  var C = window.DD_CONFIG, A = C.arena, Q = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  var LOCAL = Q.get('local') === '1', NONET = Q.get('nonet') === '1', EMBED = window.parent !== window;
  var game = { phase: 'lobby', players: [], bots: Q.get('bots') !== '0', round: 0, rounds: +Q.get('rounds') || C.rounds, t: 0, phaseT: 0, sim: null };
  window.DD = { game: game };
  var net = null, startedPosted = false, BOT_NAMES = ['Rusty', 'Dent', 'Scrap', 'Torque', 'Crash', 'Bumper', 'Lugnut', 'Rivet'];
  var ARM = ['none', 'plate', 'spike'], BST = ['ram', 'sustain', 'dash'];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setPhase(p) { game.phase = p; game.phaseT = 0; window.ZTP_PHASE = p;
    if (p === 'countdown' && EMBED && !startedPosted) { startedPosted = true; try { parent.postMessage({ ztp: 'started' }, '*'); } catch (e) {} } }
  function humans() { return game.players.filter(function (p) { return !p.ai && !p.left; }); }
  function leader() { var h = humans().filter(function (p) { return p.connected; }); return h[0] || null; }
  function freeColor() { for (var i = 0; i < C.colors.length; i++) if (!game.players.some(function (p) { return p.color === C.colors[i]; })) return C.colors[i]; return '#fff'; }
  function addBot() { var n = game.players.filter(function (p) { return p.ai; }).length, T = C.cars[Math.floor(Math.random() * 6)];
    game.players.push({ id: 'ai' + Date.now() + n, name: BOT_NAMES[n % 8], ai: true, color: freeColor(), type: T.id, armour: { front: ARM[Math.floor(Math.random() * 3)], side: ARM[Math.floor(Math.random() * 2)], back: ARM[Math.floor(Math.random() * 2)] }, boost: BST[Math.floor(Math.random() * 3)], score: 0, ready: true }); }
  function fillBots() {
    game.players = game.players.filter(function (p) { return !p.ai; });
    if (!game.bots) return; var want = Math.max(+Q.get('fill') || 4, 2);
    while (game.players.filter(function (p) { return !p.left; }).length < Math.min(want, C.maxPlayers)) addBot();
  }
  // ---------------------------------------------------------------- match flow
  function startMatch() {
    if (game.phase !== 'lobby') return;
    fillBots(); var act = game.players.filter(function (p) { return !p.left; });
    if (act.length < 2) { flash('Need 2 cars: turn AI on or get a friend'); return; }
    game.round = 0; game.feed = []; act.forEach(function (p) { p.score = 0; p.tot = { dmg: 0, kos: 0, ringouts: 0, crushes: 0, air: 0, wins: 0 }; });
    nextRound();
  }
  function nextRound() {
    game.round++; var S = game.sim = new window.DDSim();
    game.players.filter(function (p) { return !p.left; }).forEach(function (p) { p.car = S.addCar({ id: p.id, name: p.name, color: p.color, ai: p.ai, type: p.type, armour: p.armour, boost: p.boost }); });
    S.spawnAll(); buildCars(); setPhase('countdown');
  }
  function endRound() {
    var S = game.sim, live = S.cars.filter(function (c) { return c.state === 'drive' || c.state === 'enter' || c.state === 'wait'; });
    var win = live[0] || S.byId(S.out[S.out.length - 1]);
    var order = S.out.slice().reverse(); if (win && order.indexOf(win.id) < 0) order.unshift(win.id);
    order.forEach(function (id, i) { var p = byId(id); if (!p) return; p.score += Math.max(0, S.cars.length - i - 1) + (i === 0 ? 2 : 0); });
    S.cars.forEach(function (c) { var p = byId(c.id); if (!p || !p.tot) return; ['dmg', 'kos', 'ringouts', 'crushes', 'air'].forEach(function (k) { p.tot[k] += c.st[k]; }); });
    var wp = win && byId(win.id); if (wp) wp.tot.wins++;
    game.lastWinner = wp ? wp.name : '-'; banner((wp ? wp.name : 'Nobody') + ' WINS ROUND ' + game.round, wp && wp.color);
    setPhase('roundover');
  }
  function byId(id) { for (var i = 0; i < game.players.length; i++) if (game.players[i].id === id) return game.players[i]; return null; }
  function toLobby() { game.players = game.players.filter(function (p) { return !p.ai && !p.left; }); game.players.forEach(function (p) { p.ready = false; }); game.sim = null; clearCars(); setPhase('lobby'); startedPosted = false; }
  var lastT = performance.now(), acc = 0;
  function tick() {
    var now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; game.phaseT += dt;
    var S = game.sim;
    if (game.phase === 'countdown') { var n = Math.ceil(C.countdownSec - game.phaseT); banner(n > 0 ? String(n) : 'SMASH!'); if (game.phaseT >= C.countdownSec) { setPhase('play'); setTimeout(function () { if (game.phase === 'play') banner(''); }, 700); } }
    if (game.phase === 'play' || game.phase === 'roundover') {
      if (stopT > 0) { stopT -= dt; acc = 0; } else acc += dt; while (acc >= 1 / 60) { acc -= 1 / 60;
        S.cars.forEach(function (c) { var p = byId(c.id); if (c.ai || (p && p.aiCover)) S.think(c, 1 / 60); });
        if (game.phase === 'play' || game.phaseT < 1.5) S.step(1 / 60); }
      S.events.forEach(onEvent); S.events = [];
      if (game.phase === 'play' && S.living().length <= 1 && S.cars.every(function (c) { return c.state !== 'fall'; })) endRound();
      if (game.phase === 'play' && game.phaseT > 150) endRound();   // safety
    }
    if (game.phase === 'roundover' && game.phaseT > C.roundOverSec) { banner(''); if (game.round >= game.rounds) { setPhase('over'); showPodium(); } else nextRound(); }
    if (game.phase === 'over' && game.phaseT > C.podiumSec && !EMBED) toLobby();
    // phones away for a while: AI drives their car
    game.players.forEach(function (p) { if (!p.ai) p.aiCover = !p.connected && now - (p.goneAt || now) > C.phys.aiCoverSec * 1000; });
    render(dt); ui(); sendStates(now);
    requestAnimationFrame(tick);
  }
  // ---------------------------------------------------------------- events -> fx, phones, feed
  function onEvent(e) {
    var p;
    if (e.k === 'hit') { p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: Math.min(1, e.amt / 30) }); if (e.amt > 6) sparks(e.x, e.y, e.z + 0.8, Math.min(30, 4 + e.amt * 0.6), 0xffc040); }
    if (e.k === 'crush') { sparks(e.x, e.y, 1.5, 60, 0xff7020); debris(e.x, e.y, 1.5, 14, byId(e.id) && byId(e.id).color); shake(1.4); crunch(1.3, 'metal'); hitStop(0.09); feed(nm(e.by) + ' CRUSHED ' + nm(e.id) + '!'); p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: 1 }); }
    if (e.k === 'smash' && game.sim) { var ca = game.sim.byId(e.a), cb = game.sim.byId(e.b); if (ca && cb) { var dx = cb.x - ca.x, dy = cb.y - ca.y, dl = Math.hypot(dx, dy) || 1, amt = Math.max(0, e.s - 4) * (e.ram ? 1.5 : 1); partHit(ca, dx / dl, dy / dl, amt); partHit(cb, -dx / dl, -dy / dl, amt); } }
    if (e.k === 'wall' && game.sim && e.s > 6) { var cw = game.sim.byId(e.id), wr = Math.hypot(e.x, e.y) || 1; if (cw) partHit(cw, e.x / wr, e.y / wr, (e.s - 6) * 0.8); }
    if (e.k === 'crush' && game.sim) { var cc = game.sim.byId(e.id); if (cc) partHit(cc, 0, 0, 30, true); }
    if (e.k === 'smash') { var f = Math.min(1, e.s / 30);
      shake(0.15 + f * (e.ram ? 1.3 : 0.9)); crunch(f, e.spk ? 'spike' : e.pl ? 'plate' : 'metal');
      sparks(e.x, e.y, 0.9, Math.round(8 + f * 34), e.spk ? 0xfff0a0 : e.pl ? 0xbfd8ff : 0xffc040);
      if (e.s > 10) { debris(e.x, e.y, 0.9, Math.round(2 + f * 8), e.ca); debris(e.x, e.y, 0.9, Math.round(2 + f * 8), e.cb); }
      if (e.s > 18) { flashAt3(e.x, e.y); hitStop(e.ram ? 0.08 : 0.05); } }
    if (e.k === 'bump') { /* light nudges stay quiet */ }
    if (e.k === 'wall' && e.s > 8) { shake(Math.min(0.6, e.s / 40)); crunch(Math.min(0.7, e.s / 40), 'wall'); sparks(e.x, e.y, 0.8, 8, 0xffc040); }
    if (e.k === 'boost') { var c0 = game.sim && game.sim.byId(e.id); if (c0) { boostFx(c0, e.b); whoosh(e.b); } }
    if (e.k === 'ko') { feed(e.how === 'ringout' ? nm(e.id) + ' fell out' + (e.by ? ' (thanks ' + nm(e.by) + ')' : '') : nm(e.by || e.id) === nm(e.id) ? nm(e.id) + ' wrecked' : nm(e.by) + ' wrecked ' + nm(e.id)); if (e.how === 'wreck') { boom(e.x, e.y, e.z); debris(e.x, e.y, e.z + 1, 22, byId(e.id) && byId(e.id).color); crunch(1.4, 'boom'); hitStop(0.12); } p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: 1, long: 1 }); }
    if (e.k === 'gate') feed('THE GATE OPENS');
    if (e.k === 'shrinkwarn') { feed('THE ARENA IS SHRINKING!'); banner('EDGE DROPPING!', '#ff5040'); setTimeout(function () { if (game.phase === 'play') banner(''); }, 1600); }
    if (e.k === 'shrunk') { shake(0.8); crunch(1, 'boom'); }
    if (e.k === 'land' && e.s > 8) { shake(Math.min(0.7, e.s / 25)); crunch(Math.min(0.6, e.s / 30), 'wall'); sparks(e.x, e.y, 0.2, 14, 0xd8b080); }
  }
  // ---------------------------------------------------------------- audio: synthesised crunch (no files)
  var AC = null, lastCrunch = 0;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (x) { AC = false; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  ['pointerdown', 'keydown'].forEach(function (k) { window.addEventListener(k, ac, { once: true }); });
  function noiseBuf(a, sec) { var b = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5); return b; }
  function crunch(f, kind) {
    var a = ac(); if (!a || a.state !== 'running') return; var now = a.currentTime; if (now - lastCrunch < 0.04) return; lastCrunch = now;
    var src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain(), dur = 0.18 + f * 0.35;
    src.buffer = noiseBuf(a, dur); bp.type = kind === 'boom' ? 'lowpass' : 'bandpass'; bp.frequency.value = kind === 'boom' ? 500 : kind === 'spike' ? 2600 : kind === 'plate' ? 1500 : 900; bp.Q.value = kind === 'plate' ? 6 : 1.2;
    g.gain.value = Math.min(0.9, 0.25 + f * 0.6); src.connect(bp); bp.connect(g); g.connect(a.destination); src.start(now);
    var o = a.createOscillator(), og = a.createGain(); o.type = kind === 'plate' ? 'triangle' : 'sawtooth'; o.frequency.setValueAtTime(kind === 'plate' ? 420 : 110 + f * 60, now); o.frequency.exponentialRampToValueAtTime(40, now + dur);
    og.gain.setValueAtTime(0.25 * f, now); og.gain.exponentialRampToValueAtTime(0.001, now + dur); o.connect(og); og.connect(a.destination); o.start(now); o.stop(now + dur);
  }
  function whoosh(b) { var a = ac(); if (!a || a.state !== 'running') return; var now = a.currentTime, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf(a, 0.5); f.type = 'bandpass'; f.frequency.setValueAtTime(b === 'dash' ? 2000 : 300, now); f.frequency.exponentialRampToValueAtTime(b === 'dash' ? 600 : 1400, now + 0.45); g.gain.value = 0.35; src.connect(f); f.connect(g); g.connect(a.destination); src.start(now); }
  var stopT = 0; function hitStop(s) { stopT = Math.max(stopT, s); }
  function nm(id) { var p = byId(id); return p ? p.name : '?'; }
  function feed(t) { game.feed.unshift({ t: t, at: performance.now() }); game.feed = game.feed.slice(0, 5); }
  var flashMsg = '', flashAt = 0; function flash(t) { flashMsg = t; flashAt = performance.now(); }
  var bannerTxt = null; function banner(t, col) { if (t === bannerTxt) return; bannerTxt = t; var b = $('banner'); b.textContent = t; b.style.color = col || '#ffd23f'; b.style.opacity = t ? 1 : 0; }
  // ---------------------------------------------------------------- three.js scene
  var rings = [], wallSegs = [], R3 = window.THREE, renderer, scene, cam, carMeshes = {}, gateMesh, sparkPool = [], shakeAmt = 0;
  function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
  function initGL() {
    renderer = new R3.WebGLRenderer({ canvas: $('gl'), antialias: window.devicePixelRatio < 2, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    scene = new R3.Scene(); scene.background = new R3.Color(0x120c08); scene.fog = new R3.Fog(0x120c08, 90, 170);
    cam = new R3.PerspectiveCamera(42, 1, 1, 400);
    scene.add(new R3.HemisphereLight(0xfff0dd, 0x302010, 0.9)); var sun = new R3.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 60, 20); scene.add(sun);
    // floor: dirt disc with painted rings
    // v0.2.1: centre disc + outer sectioned rings that sink away as the arena shrinks
    var SR = A.shrinkR, inner = SR[SR.length - 1];
    var floor = new R3.Mesh(new R3.CylinderGeometry(inner, inner - 0.6, 2, 72), new R3.MeshLambertMaterial({ color: 0x8a6a48 })); floor.position.y = -1; scene.add(floor);
    var ln = new R3.Mesh(new R3.RingGeometry(inner * 0.5 - 0.25, inner * 0.5 + 0.25, 72), new R3.MeshBasicMaterial({ color: 0xa88a62 })); ln.rotation.x = -Math.PI / 2; ln.position.y = 0.02; scene.add(ln);
    for (var ri = SR.length - 2; ri >= 0; ri--) { var ro = SR[ri], rin = SR[ri + 1], sh = new R3.Shape(); sh.absarc(0, 0, ro, 0, Math.PI * 2, false); var hole = new R3.Path(); hole.absarc(0, 0, rin + 0.05, 0, Math.PI * 2, true); sh.holes.push(hole);
      var gm = new R3.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: false, curveSegments: 72 }); gm.rotateX(Math.PI / 2);
      var mat = new R3.MeshLambertMaterial({ color: ri % 2 ? 0x8a6a48 : 0x7e6040, transparent: true }), rg = new R3.Group(), rm = new R3.Mesh(gm, mat); rg.add(rm);
      var edge = new R3.Mesh(new R3.RingGeometry(rin - 0.05, rin + 0.45, 72), new R3.MeshBasicMaterial({ color: 0xa88a62, transparent: true })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.02; rg.add(edge);
      scene.add(rg); rings[ri] = { g: rg, mat: mat, edge: edge, base: new R3.Color(mat.color.getHex()) }; }
    // mound (ramp)
    var mound = new R3.Mesh(new R3.ConeGeometry(A.moundR, A.moundH, 40, 1, true), new R3.MeshLambertMaterial({ color: 0xb08850 })); mound.position.y = A.moundH / 2; scene.add(mound);
    var stripe = new R3.Mesh(new R3.ConeGeometry(A.moundR * 0.35, A.moundH * 0.35, 40, 1, true), new R3.MeshLambertMaterial({ color: 0xffd23f })); stripe.position.y = A.moundH * (1 - 0.35 / 2); scene.add(stripe);
    // walls: segments along the arcs; open gaps are drop-offs
    var wm = new R3.MeshLambertMaterial({ color: 0xc23a2a }), wm2 = new R3.MeshLambertMaterial({ color: 0xeeeeee });
    A.walls.forEach(function (w) { for (var d = w[0]; d < w[1]; d += 4) {
      if (Math.abs(((d + 2 - A.gateAt + 540) % 360) - 180) < A.gateW / 2) continue;
      var a = (d + 2) * Math.PI / 180, seg = new R3.Mesh(new R3.BoxGeometry(A.R * 0.072, A.wallH, 1), ((d / 4) | 0) % 2 ? wm : wm2);
      seg.position.set(Math.sin(a) * (A.R + 0.2), A.wallH / 2, Math.cos(a) * (A.R + 0.2)); seg.rotation.y = a + Math.PI / 2; scene.add(seg); wallSegs.push({ m: seg, a: a }); } });
    var ga = A.gateAt * Math.PI / 180;
    gateMesh = new R3.Mesh(new R3.BoxGeometry(A.R * A.gateW * Math.PI / 180, A.wallH * 1.4, 1.2), new R3.MeshLambertMaterial({ color: 0x555a66 }));
    gateMesh.position.set(Math.sin(ga) * (A.R + 0.3), A.wallH * 0.7, Math.cos(ga) * (A.R + 0.3)); gateMesh.rotation.y = ga + Math.PI / 2; scene.add(gateMesh);
    // gate tunnel lane outside
    var lane = new R3.Mesh(new R3.BoxGeometry(A.R * A.gateW * Math.PI / 180, 0.5, 18), new R3.MeshLambertMaterial({ color: 0x5a4430 })); lane.position.set(Math.sin(ga) * (A.R + 9), -0.25, Math.cos(ga) * (A.R + 9)); lane.rotation.y = ga; scene.add(lane);
    // crowd stands (cheap: a dark ring of boxes far out)
    for (var i = 0; i < 48; i++) { var b = i * Math.PI * 2 / 48; if (Math.abs(Math.atan2(Math.sin(b - ga), Math.cos(b - ga))) < 0.25) continue;
      var st = new R3.Mesh(new R3.BoxGeometry(6, 3 + (i % 3), 4), new R3.MeshLambertMaterial({ color: [0x2a1e30, 0x302438, 0x261a28][i % 3] })); st.position.set(Math.sin(b) * (A.R + 22), -6, Math.cos(b) * (A.R + 22)); st.rotation.y = b; scene.add(st); }
    for (var k = 0; k < 260; k++) { var sp = new R3.Mesh(new R3.BoxGeometry(0.25, 0.25, 0.25), new R3.MeshBasicMaterial({ color: 0xffc040 })); sp.visible = false; scene.add(sp); sparkPool.push({ m: sp, life: 0 }); }
    initFx(); resize(); window.addEventListener('resize', resize);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  function clearCars() { for (var k in carMeshes) scene.remove(carMeshes[k].g); carMeshes = {}; }
  function carMesh(c) {
    var T = c.T, g = new R3.Group(), col = new R3.Color(c.color), s = T.size;
    var body = new R3.Mesh(new R3.BoxGeometry(s[0], s[2] * 0.55, s[1]), new R3.MeshLambertMaterial({ color: col })); body.position.y = s[2] * 0.45; g.add(body);
    var cab = new R3.Mesh(new R3.BoxGeometry(s[0] * 0.8, s[2] * 0.45, s[1] * (T.id === 'pickup' ? 0.35 : T.id === 'van' || T.id === 'bus' ? 0.85 : 0.5)), new R3.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.6) }));
    cab.position.set(0, s[2] * 0.95, T.id === 'pickup' ? s[1] * 0.12 : T.id === 'van' || T.id === 'bus' ? 0 : -s[1] * 0.05); g.add(cab);
    var tm = new R3.MeshLambertMaterial({ color: 0x1a1a1a });
    var boxW = []; [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (w) { var wh = new R3.Mesh(new R3.CylinderGeometry(0.45, 0.45, 0.4, 10), tm); boxW.push(wh); wh.rotation.z = Math.PI / 2; wh.position.set(w[0] * s[0] / 2, 0.45, w[1] * s[1] * 0.32); g.add(wh); });
    var sed = null, paint = body.material;
    if (window.DDSedan.ready()) {   // v0.3: Justin's sedan for every car, tinted per player; box body kept as the fallback
      body.visible = cab.visible = false; boxW.forEach(function (w) { w.visible = false; });
      paint = new R3.MeshLambertMaterial({ color: col }); var b = window.DDSedan.build(paint, SED_M.glass, SED_M.trim, SED_M.tyre);
      var mdl = new R3.Group(), sc = [s[0] / 2.0, (s[2] + 0.5) / 1.55, s[1] / 4.87]; mdl.scale.set(sc[0], sc[1], sc[2]); mdl.add(b.wrap); g.add(mdl);
      sed = { parts: b.parts, sc: sc, lost: 0 };
      for (var pn in b.parts) { var P = b.parts[pn]; P.x = P.cx * sc[0]; P.z = P.cz * sc[2]; var L = Math.hypot(P.x, P.z) || 1; P.dx = P.x / L; P.dz = P.z / L; P.ph = Math.random() * 6; }
    }
    var pm = new R3.MeshLambertMaterial({ color: 0x9aa0aa }), km = new R3.MeshLambertMaterial({ color: 0xdddddd });
    function armour(kind, place) {
      if (kind === 'none') return;
      place.forEach(function (pl) {
        if (kind === 'plate') { var m = new R3.Mesh(new R3.BoxGeometry(pl.w, s[2] * 0.5, pl.d), pm); m.position.set(pl.x, s[2] * 0.45, pl.z); g.add(m); }
        else for (var i = 0; i < 3; i++) { var sp = new R3.Mesh(new R3.ConeGeometry(0.18, 0.7, 6), km); var f = (i - 1) / 1.5;
          sp.position.set(pl.x + (pl.ax ? 0 : f * pl.w * 0.8), s[2] * 0.45, pl.z + (pl.ax ? f * pl.d * 0.8 : 0)); sp.rotation.set(pl.rx || 0, 0, pl.rz || 0); g.add(sp); }
      });
    }
    armour(c.armour.front, [{ x: 0, z: s[1] / 2 + 0.15, w: s[0] + 0.1, d: 0.3, rx: Math.PI / 2 }]);
    armour(c.armour.back, [{ x: 0, z: -s[1] / 2 - 0.15, w: s[0] + 0.1, d: 0.3, rx: -Math.PI / 2 }]);
    armour(c.armour.side, [{ x: s[0] / 2 + 0.12, z: 0, w: 0.25, d: s[1] * 0.7, ax: 1, rz: -Math.PI / 2 }, { x: -s[0] / 2 - 0.12, z: 0, w: 0.25, d: s[1] * 0.7, ax: 1, rz: Math.PI / 2 }]);
    var sh = new R3.Mesh(new R3.CircleGeometry(s[1] * 0.42, 16), new R3.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1;
    g.scale.setScalar(1.25); sh.scale.setScalar(1.25); scene.add(sh); scene.add(g);
    var tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = '<span></span><div class="hb"><i></i></div>'; tag.style.color = c.color; $('tags').appendChild(tag);
    return { g: g, sh: sh, tag: tag, body: { material: paint }, crumple: body, smoke: 0, sed: sed };
  }
  var SED_M = null;
  function sedMats() { SED_M = { glass: new R3.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.45, side: 2, depthWrite: false }), trim: new R3.MeshLambertMaterial({ color: 0x18181c, side: 2 }), tyre: new R3.MeshLambertMaterial({ color: 0x111111 }) }; }
  window.DDSedan.onReady(function () { if (!SED_M) sedMats(); if (game.sim) buildCars(); });
  // ---------------------------------------------------------------- v0.3 per-part damage
  // impact direction (world, sim coords) -> car-local, then every part facing that way takes a share: works from any angle (front, sides, rear, corners)
  function partHit(c, wx, wy, amt, roof) {
    var m = carMeshes[c.id]; if (!m || !m.sed || amt <= 0) return; var a = c.a, lz = wx * Math.sin(a) + wy * Math.cos(a), lx = wx * Math.cos(a) - wy * Math.sin(a), L = Math.hypot(lx, lz) || 1; lx /= L; lz /= L;
    var P = m.sed.parts; for (var k in P) { var p = P[k]; if (p.st >= 9) continue; var w = roof ? (p.kind === 'wheel' ? 0.1 : 0.7) : Math.pow(Math.max(0, p.dx * lx + p.dz * lz), 2);
      if (w < 0.05) continue; p.dmg += amt * w * (p.kind === 'glass' ? 2 : 1.3); partState(c, m, p); }
  }
  var LIM = { hood: [10, 22, 42], door: [18, 0, 40], trunk: [16, 0, 36], glass: [7], wheel: [80] };
  function partState(c, m, p) {
    var L = LIM[p.kind], d = p.dmg;
    if (p.kind === 'glass') { if (d > L[0]) { var w = worldOf(p.node); sparks(w.x, w.z, w.y, 14, 0xc8ecff); p.node.visible = false; p.st = 9; } return; }
    if (p.kind === 'wheel') { if (d > L[0] && m.sed.lost < 2) { m.sed.lost++; detach(c, p); c.wheelMul = (c.wheelMul || 1) * 0.82; c.pull = (c.pull || 0) + (p.x > 0 ? 0.22 : -0.22); feed(c.name + ' lost a wheel!'); } return; }
    if (d > L[2]) { detach(c, p); return; }
    if (p.kind === 'hood') { if (d > L[1]) p.st = 2; else if (d > L[0] && p.st < 1) { p.st = 1; var ms = p.node.userData.mesh; if (ms) { ms.scale.set(0.96, 0.6, 0.93); ms.rotation.z = (Math.random() - 0.5) * 0.12; } } }
    else if (d > L[0]) p.st = 2;
  }
  var V3 = null; function worldOf(o) { if (!V3) V3 = new R3.Vector3(); o.updateWorldMatrix(true, false); return o.getWorldPosition(V3.clone()); }
  var debrisParts = [];
  function detach(c, p) {
    var o = p.node; o.updateWorldMatrix(true, true); var d = o.clone(true); o.visible = false; p.st = 9;
    o.matrixWorld.decompose(d.position, d.quaternion, d.scale); scene.add(d);
    var ang = Math.random() * 6.28; d.userData.v = [c.vx * 0.5 + Math.sin(ang) * 3, 5 + Math.random() * 4, c.vy * 0.5 + Math.cos(ang) * 3]; d.userData.spin = [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8]; d.userData.life = 14; d.userData.r = p.kind === 'wheel' ? 0.5 : 0.9;
    debrisParts.push(d); if (debrisParts.length > 32) { var old = debrisParts.shift(); scene.remove(old); }
    sparks(d.position.x, d.position.z, d.position.y, 10, 0xffc040);
  }
  var EUL = null;
  function stepParts(dt, t) {
    var S = game.sim; if (!EUL) EUL = new R3.Euler();
    for (var i = debrisParts.length - 1; i >= 0; i--) { var d = debrisParts[i], u = d.userData, v = u.v, rr = Math.hypot(d.position.x, d.position.z), floorY = S && rr < S.R ? u.r * 0.4 : -99;
      u.life -= dt; v[1] -= 28 * dt; d.position.x += v[0] * dt; d.position.y += v[1] * dt; d.position.z += v[2] * dt;
      if (d.position.y < floorY) { d.position.y = floorY; v[1] = Math.abs(v[1]) > 3 ? -v[1] * 0.3 : 0; v[0] *= Math.pow(0.05, dt); v[2] *= Math.pow(0.05, dt); u.spin[0] *= 0.9; u.spin[1] *= 0.9; u.spin[2] *= 0.9; }
      EUL.set(u.spin[0] * dt, u.spin[1] * dt, u.spin[2] * dt); d.quaternion.multiply(new R3.Quaternion().setFromEuler(EUL));
      if (S) S.cars.forEach(function (c) { if (c.state !== 'drive') return; var dx = d.position.x - c.x, dz = d.position.z - c.y, dd = Math.hypot(dx, dz), sp = Math.hypot(c.vx, c.vy);   // cars knock debris around
        if (dd < 2.6 && sp > 2) { v[0] = c.vx * 1.1 + dx / dd * 3; v[2] = c.vy * 1.1 + dz / dd * 3; v[1] = Math.max(v[1], 2 + sp * 0.15); u.spin = [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10]; } });
      if (u.life < 2 && !u.fading) { u.fading = true; d.traverse(function (o) { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } }); }
      if (u.fading) d.traverse(function (o) { if (o.material) o.material.opacity = Math.max(0, u.life / 2) * (o.material.opacity > 0.5 ? 1 : 0.45); });
      if (u.life <= 0 || d.position.y < -25) { scene.remove(d); debrisParts.splice(i, 1); }
    }
    if (!S) return;
    S.cars.forEach(function (c) { var m = carMeshes[c.id]; if (!m || !m.sed) return;
      if (c.fresh) { c.fresh = false; scene.remove(m.g); scene.remove(m.sh); m.tag.remove(); carMeshes[c.id] = carMesh(c); return; }   // back through the gate: a fresh car
      var sp = Math.hypot(c.vx, c.vy), P = m.sed.parts;
      for (var k in P) { var p = P[k]; if (p.st !== 2) continue; var n = p.node, f = Math.min(1, sp / 9);
        if (p.kind === 'hood') n.rotation.x = 0.08 + (0.25 + 0.6 * Math.abs(Math.sin(t * (4 + sp * 0.4) + p.ph))) * f;   // flaps open/closed while driving
        else if (p.kind === 'trunk') n.rotation.x = -(0.25 + 0.55 * Math.abs(Math.sin(t * 3.2 + p.ph)) * (0.3 + f));
        else n.rotation.y = (p.x > 0 ? 1 : -1) * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.6 + p.ph)) * (0.3 + f));     // doors swing on their hinges
      }
      // engine: smoke past half damage, fire under the hood when it's nearly gone
      var hpf = c.hp / c.maxhp; if (c.state === 'drive' && hpf < 0.5) { var fx = c.x + Math.sin(c.a) * c.T.size[1] * 0.45, fy = c.y + Math.cos(c.a) * c.T.size[1] * 0.45;
        if (Math.random() < dt * 8) puff(fx, fy, c.z + 1.4, hpf < 0.25 ? 0x2a2a2a : 0x777777); if (hpf < 0.25 && Math.random() < dt * 24) puff(fx, fy, c.z + 1.2, Math.random() < 0.5 ? 0xff6a10 : 0xffc030, 1); }
    });
  }
  function puff(x, y, z, col, fire) { var s = sparkPool.find(function (q) { return q.life <= 0; }); if (!s) return; s.life = fire ? 0.35 + Math.random() * 0.25 : 0.9 + Math.random() * 0.6; s.up = true; s.m.visible = true; s.m.material.color.setHex(col); s.m.position.set(x, z, y); s.m.scale.setScalar(fire ? 1.1 : 1.3); s.v = [(Math.random() - 0.5) * 1.5, fire ? 3 : 2.2, (Math.random() - 0.5) * 1.5]; }
  function buildCars() { clearCars(); $('tags').innerHTML = ''; game.sim.cars.forEach(function (c) { carMeshes[c.id] = carMesh(c); }); }
  function sparks(x, y, z, n, col) { for (var i = 0; i < n; i++) { var s = sparkPool.find(function (q) { return q.life <= 0; }); if (!s) return; s.life = 0.4 + Math.random() * 0.5; s.up = false; s.m.scale.setScalar(1); s.m.visible = true; s.m.material.color.setHex(col); s.m.position.set(x, z, y); s.v = [(Math.random() - 0.5) * 18, Math.random() * 12 + 2, (Math.random() - 0.5) * 18]; } }
  var debrisPool = [], flashes = [], trails = [];
  function initFx() {
    var geo = new R3.BoxGeometry(0.5, 0.18, 0.4);
    for (var k = 0; k < 120; k++) { var m = new R3.Mesh(geo, new R3.MeshLambertMaterial({ color: 0x888888 })); m.visible = false; scene.add(m); debrisPool.push({ m: m, life: 0 }); }
    for (var f = 0; f < 6; f++) { var fl = new R3.Mesh(new R3.SphereGeometry(1, 12, 8), new R3.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false })); fl.visible = false; scene.add(fl); flashes.push({ m: fl, life: 0 }); }
    for (var t = 0; t < 8; t++) { var tr = new R3.Mesh(new R3.RingGeometry(1.4, 2.2, 24), new R3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: 2, depthWrite: false })); tr.rotation.x = -Math.PI / 2; tr.visible = false; scene.add(tr); trails.push({ m: tr, life: 0 }); }
  }
  function debris(x, y, z, n, col) { for (var i = 0; i < n; i++) { var d = debrisPool.find(function (q) { return q.life <= 0; }); if (!d) return; d.life = 1.6 + Math.random();
    d.m.visible = true; d.m.material.color.set(Math.random() < 0.35 ? '#444' : (col || '#999')); d.m.position.set(x, z, y); d.m.scale.setScalar(0.6 + Math.random() * 0.9);
    d.v = [(Math.random() - 0.5) * 16, Math.random() * 10 + 4, (Math.random() - 0.5) * 16]; d.spin = [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14]; } }
  function flashAt3(x, y) { var f = flashes.find(function (q) { return q.life <= 0; }); if (!f) return; f.life = 0.18; f.m.visible = true; f.m.position.set(x, 1, y); }
  function boostFx(c, b) { var t = trails.find(function (q) { return q.life <= 0; }); if (!t) return; t.life = 0.5; t.m.visible = true; t.b = b; t.m.position.set(c.x, c.z + 0.2, c.y);
    t.m.material.color.setHex(b === 'ram' ? 0xff4020 : b === 'dash' ? 0x40e0ff : 0xffd23f); }
  function stepFx(dt) {
    debrisPool.forEach(function (d) { if (d.life <= 0) return; d.life -= dt; var p = d.m.position; if (p.y > 0.12 || d.v[1] > 0) { d.v[1] -= 30 * dt; p.x += d.v[0] * dt; p.y += d.v[1] * dt; p.z += d.v[2] * dt; d.m.rotation.x += d.spin[0] * dt; d.m.rotation.z += d.spin[1] * dt; if (p.y < 0.12) { p.y = 0.12; d.v[1] *= -0.3; d.v[0] *= 0.5; d.v[2] *= 0.5; if (Math.abs(d.v[1]) < 1.5) d.v[1] = 0; } } if (d.life <= 0) d.m.visible = false; });
    flashes.forEach(function (f) { if (f.life <= 0) return; f.life -= dt; f.m.scale.setScalar(1 + (0.18 - f.life) * 25); f.m.material.opacity = Math.max(0, f.life / 0.18) * 0.8; if (f.life <= 0) f.m.visible = false; });
    trails.forEach(function (t) { if (t.life <= 0) return; t.life -= dt; t.m.scale.setScalar(1 + (0.5 - t.life) * (t.b === 'ram' ? 5 : 3)); t.m.material.opacity = Math.max(0, t.life / 0.5) * 0.9; if (t.life <= 0) t.m.visible = false; });
  }
  function boom(x, y, z) { sparks(x, y, z + 1, 50, 0xff5a1a); sparks(x, y, z + 1, 30, 0x333333); shake(1.2); }
  var V = null;
  function render(dt) {
    var S = game.sim, t = performance.now() / 1000;
    var tilt = game.phase === 'lobby' ? t * 0.08 : 0;
    var camR = 76, camH = 74;   // v0.3: ~12% closer
    stepParts(dt, performance.now() / 1000);
    shakeAmt *= Math.pow(0.015, dt); stepFx(dt); var sk = shakeAmt * 2.2;
    cam.position.set(Math.sin(tilt) * camR * 0.0 + Math.sin(tilt) * 0 + (Math.random() - 0.5) * sk, camH + (Math.random() - 0.5) * sk, camR * 0.56 + (Math.random() - 0.5) * sk);
    if (game.phase === 'lobby') cam.position.set(Math.sin(tilt) * 70, 55, Math.cos(tilt) * 70);
    cam.lookAt(0, 0, game.phase === 'lobby' ? 0 : 4);
    var fo = window.DD.camFollow && S && S.byId(window.DD.camFollow); if (fo) { cam.position.set(fo.x + 9, 7, fo.y + 9); cam.lookAt(fo.x, 0.8, fo.y); }   // debug close-up (tests)
    if (S) {
      // shrinking edge: barricades + gate ride inward with the edge; the doomed ring pulses red, then sinks and fades dark
      var kR = S.R / A.R; wallSegs.forEach(function (w) { w.m.position.x = Math.sin(w.a) * (S.R + 0.2); w.m.position.z = Math.cos(w.a) * (S.R + 0.2); w.m.scale.x = kR; });
      var gaA = A.gateAt * Math.PI / 180; gateMesh.position.x = Math.sin(gaA) * (S.R + 0.3); gateMesh.position.z = Math.cos(gaA) * (S.R + 0.3); gateMesh.scale.x = kR;
      rings.forEach(function (r, i) { var gone = i < S.stage, doom = S.shr && i === S.stage, u = 0, warn = 0;
        if (doom) { var sh = S.shr; warn = sh.t < A.warnSec ? 0.5 + 0.5 * Math.sin(sh.t * 12) : 0; u = Math.max(0, Math.min(1, (sh.t - A.warnSec) / A.sinkSec)); }
        if (gone) u = 1; r.g.visible = u < 1; r.g.position.y = -u * u * 14;
        r.mat.color.copy(r.base).lerp(new R3.Color(0xff3020), warn * 0.6).multiplyScalar(1 - u * 0.85); r.mat.opacity = 1 - u * u; r.edge.material.opacity = 1 - u; });
      var g = S.gate; gateMesh.position.y = A.wallH * 0.7 - (g.open > 0 ? Math.min(1, (A.gateOpenSec - g.open) * 3, g.open * 3) * A.wallH * 1.5 : 0);
      if (!V) V = new R3.Vector3();
      S.cars.forEach(function (c) { var m = carMeshes[c.id]; if (!m) return;
        var vis = c.state === 'drive' || c.state === 'fall' || c.state === 'enter';
        m.g.visible = vis; m.sh.visible = vis && c.state !== 'fall';
        m.g.position.set(c.x, c.z, c.y); m.g.rotation.y = c.a;
        var pitch = 0; if (c.air) pitch = -Math.max(-0.5, Math.min(0.5, c.vz * 0.04)); else { var r = Math.hypot(c.x, c.y); if (r < A.moundR) { var fx = Math.sin(c.a), fy = Math.cos(c.a), rad = (c.x * fx + c.y * fy) / Math.max(0.01, r); pitch = rad * Math.atan(A.moundH / A.moundR); } }
        m.g.rotation.x = c.state === 'fall' ? (A.R - Math.hypot(c.x, c.y)) * 0.08 : pitch;
        m.sh.position.set(c.x, window.DDSim.ground(c.x, c.y) + 0.05, c.y);
        var hpf = c.hp / c.maxhp; if (!m.sed) m.crumple.scale.set(1, 1 - (1 - hpf) * 0.25, 1 - (1 - hpf) * 0.12); if (c.boostT > 0 && Math.random() < dt * 30) sparks(c.x - Math.sin(c.a) * 2, c.y - Math.cos(c.a) * 2, c.z + 0.5, 1, c.boostType === 'ram' ? 0xff4020 : c.boostType === 'dash' ? 0x40e0ff : 0xffd23f); m.body.material.color.set(c.color).lerp(new R3.Color(0x222222), (1 - hpf) * 0.6);
        if (vis && hpf < 0.35 && Math.random() < dt * 12) sparks(c.x, c.y, c.z + 1.4, 1, 0x444444);
        V.set(c.x, c.z + c.T.size[2] + 1.2, c.y).project(cam);
        if (vis && c.state !== 'fall' && V.z < 1) { m.tag.style.display = ''; m.tag.style.left = ((V.x + 1) / 2 * innerWidth) + 'px'; m.tag.style.top = ((1 - V.y) / 2 * innerHeight) + 'px';
          m.tag.firstChild.textContent = c.name; var bar = m.tag.lastChild.firstChild; bar.style.width = (hpf * 100) + '%'; bar.style.background = hpf > 0.5 ? '#7ed957' : hpf > 0.25 ? '#ffd23f' : '#ff4b55'; }
        else m.tag.style.display = 'none';
      });
    }
    sparkPool.forEach(function (s) { if (s.life <= 0) return; s.life -= dt; if (s.up) { s.v[1] += 1.5 * dt; s.m.scale.multiplyScalar(1 + dt * 0.5); } else s.v[1] -= 30 * dt; s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt; if (s.m.position.y < 0.1) { s.m.position.y = 0.1; s.v[1] *= -0.4; } if (s.life <= 0) s.m.visible = false; });
    renderer.render(scene, cam);
  }
  // ---------------------------------------------------------------- DOM UI
  var uiKey = '';
  function ui() {
    var ph = game.phase, inGame = ph === 'countdown' || ph === 'play' || ph === 'roundover';
    $('lobby').style.display = ph === 'lobby' ? 'flex' : 'none'; $('podium').style.display = ph === 'over' ? 'flex' : 'none';
    $('cards').style.display = $('feed').style.display = inGame ? '' : 'none';
    $('cornerqr').style.display = inGame && net && net.status === 'online' ? '' : 'none';
    if (ph === 'lobby') {
      var L = leader(), k = JSON.stringify([game.players.map(function (p) { return [p.name, p.color, p.ready, p.connected, p.type]; }), game.bots, flashMsg, L && L.name]);
      if (k !== uiKey) { uiKey = k;
        $('plist').innerHTML = humans().map(function (p) { return '<span style="background:' + p.color + ';opacity:' + (p.connected ? 1 : 0.4) + '">' + esc(p.name) + ' \u00b7 ' + window.DDSim.carType(p.type).name + (p.ready ? ' \u2714' : '') + '</span>'; }).join('') || '<span style="background:#fff3;color:#fff">Waiting for drivers&hellip;</span>';
        $('hint').innerHTML = (L ? '<b>' + esc(L.name) + '</b> starts the derby from their phone' : 'Scan to join (up to ' + C.maxPlayers + ')') + ' \u00b7 AI fill ' + (game.bots ? 'ON' : 'OFF') + ' \u00b7 ' + game.rounds + ' rounds, ' + C.lives + ' lives each' + (flashMsg && performance.now() - flashAt < 4000 ? '<br><span style="color:#ff9">' + esc(flashMsg) + '</span>' : '') + '<br><small>Keyboard: Enter = start, B = AI on/off</small>';
      }
    }
    if (inGame && game.sim) {
      $('cards').innerHTML = game.sim.cars.map(function (c) { var p = byId(c.id), hpf = Math.max(0, c.hp / c.maxhp), out = c.state === 'out';
        return '<div class="pc' + (out ? ' out' : '') + '" style="border-color:' + c.color + '"><span class="nm">' + esc(c.name) + (c.ai ? ' <small>AI</small>' : p && p.aiCover ? ' <small>(AI)</small>' : '') + '</span>' +
          (c.state === 'wait' ? '<span class="w">at gate</span>' : '<span class="hp"><i style="width:' + (hpf * 100) + '%;background:' + (hpf > 0.5 ? '#7ed957' : hpf > 0.25 ? '#ffd23f' : '#ff4b55') + '"></i></span>') +
          '<span class="lv">' + (out ? 'OUT' : '\u2665'.repeat(Math.max(0, c.lives))) + '</span><span>' + (p ? p.score : 0) + '</span></div>'; }).join('') + '<div class="pc" style="border-color:#ffd23f;min-width:0">Round ' + game.round + '/' + game.rounds + '</div>';
      $('feed').innerHTML = (game.feed || []).filter(function (f) { return performance.now() - f.at < 6000; }).map(function (f) { return '<div>' + esc(f.t) + '</div>'; }).join('');
    }
    if (ph === 'over') { $('pbar').firstChild.style.width = Math.min(100, game.phaseT / C.podiumSec * 100) + '%'; $('pnext').textContent = EMBED ? '' : 'Back to the lobby in ' + Math.max(0, Math.ceil(C.podiumSec - game.phaseT)) + 's'; }
  }
  function ranking() { return game.players.filter(function (p) { return p.tot; }).sort(function (a, b) { return b.score - a.score || b.tot.dmg - a.tot.dmg; }); }
  function showPodium() {
    var r = ranking(), order = [r[1], r[0], r[2]], h = [22, 30, 16], medal = ['2', '1', '3'];
    $('ptitle').textContent = r[0] ? r[0].name.toUpperCase() + ' WINS THE DERBY' : 'DERBY OVER';
    $('pod').innerHTML = order.map(function (p, i) { if (!p) return ''; return '<div class="step">' + esc(p.name) + '<br><small>' + window.DDSim.carType(p.type).name + '</small><div class="blk" style="height:' + h[i] + 'vh;background:' + p.color + '">' + medal[i] + '</div></div>'; }).join('');
    $('ptab').innerHTML = '<tr><th></th><th>Points</th><th>Round wins</th><th>Wrecks dealt</th><th>Ring-outs</th><th>Crushes</th><th>Damage</th><th>Air time</th></tr>' + r.map(function (p, i) { var t = p.tot;
      return '<tr><td style="color:' + p.color + ';font-weight:600">' + (i + 1) + '. ' + esc(p.name) + '</td><td>' + p.score + '</td><td>' + t.wins + '</td><td>' + t.kos + '</td><td>' + t.ringouts + '</td><td>' + t.crushes + '</td><td>' + Math.round(t.dmg) + '</td><td>' + t.air.toFixed(1) + 's</td></tr>'; }).join('');
    for (var i = 0; i < 12; i++) setTimeout(function () { }, 0);
  }
  // ---------------------------------------------------------------- phones
  function send(conn, m) { if (net && conn) net.send(conn, m); }
  var lastSend = 0;
  function sendStates(now) {
    if (now - lastSend < 100) return; lastSend = now;
    var L = leader(), r = game.phase === 'over' ? ranking() : null;
    humans().forEach(function (p) { if (!p.conn || !p.connected) return; var c = game.sim && game.sim.byId(p.id), m = { t: 'st', phase: game.phase, leader: L === p, bots: game.bots, round: game.round, rounds: game.rounds, n: game.players.length };
      if (c) { m.hp = Math.max(0, Math.round(c.hp)); m.maxhp = c.maxhp; m.lives = c.lives; m.cs = c.state; m.boost = Math.round(c.boost * 100) / 100; m.score = p.score; }
      if (r) { var i = r.indexOf(p); m.place = i + 1; m.tot = p.tot; m.score = p.score; m.of = r.length; }
      send(p.conn, m); });
  }
  function onPhoneMessage(conn, m) {
    if (!m || !m.t) return; var p = conn._p;
    if (m.t === 'hello') {
      p = game.players.find(function (q) { return q.token && q.token === m.token; });
      if (!p) { if (humans().length >= C.maxPlayers) { send(conn, { t: 'reject', reason: 'Derby is full' }); return; }
        p = { id: 'p' + Math.random().toString(36).slice(2, 8), token: m.token, name: String(m.name || 'Driver').slice(0, 12), color: freeColor(), type: 'muscle', armour: { front: 'plate', side: 'none', back: 'none' }, boost: 'ram', score: 0, tot: { dmg: 0, kos: 0, ringouts: 0, crushes: 0, air: 0, wins: 0 } };
        if (game.phase !== 'lobby') p.spectator = true;   // joins next match
        game.players.push(p); if (game.phase === 'lobby') { var ai = game.players.filter(function (q) { return q.ai; }); if (ai.length) game.players.splice(game.players.indexOf(ai[0]), 1); } }
      else if (m.name) p.name = String(m.name).slice(0, 12);
      p.conn = conn; p.connected = true; p.left = false; conn._p = p;
      send(conn, { t: 'welcome', pid: p.id, color: p.color, room: net.code, setup: { type: p.type, armour: p.armour, boost: p.boost } }); return;
    }
    if (!p) return;
    if (m.t === 'setup' && game.phase === 'lobby') { if (window.DDSim.carType(m.type).id === m.type) p.type = m.type; if (m.armour) ['front', 'side', 'back'].forEach(function (k) { if (ARM.indexOf(m.armour[k]) >= 0) p.armour[k] = m.armour[k]; }); if (BST.indexOf(m.boost) >= 0) p.boost = m.boost; p.ready = !!m.ready; }
    if (m.t === 'start' && leader() === p) { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); }
    if (m.t === 'bots' && leader() === p && game.phase === 'lobby') game.bots = !game.bots;
    if (m.t === 'in' && game.sim) { var c = game.sim.byId(p.id); if (c && !p.aiCover) { if (m.abs) { c.inp.abs = m.abs; } else { c.inp.abs = null; c.inp.steer = +m.s || 0; c.inp.thr = +m.g || 0; } if (m.b) c.inp.boost = true; else if (c.boostType === 'sustain') c.inp.boost = false; } }
    if (m.t === 'leave') { p.left = true; p.connected = false; p.goneAt = performance.now() - 1e6; if (game.phase === 'lobby') game.players.splice(game.players.indexOf(p), 1); }
  }
  function onPhoneClose(conn) { var p = conn._p; if (p && p.conn === conn) { p.connected = false; p.goneAt = performance.now(); if (game.phase === 'lobby') setTimeout(function () { if (!p.connected && game.phase === 'lobby') { var i = game.players.indexOf(p); if (i >= 0) game.players.splice(i, 1); } }, 30000); } }
  function controllerUrl(code) { var base = location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html'; return base + '?room=' + code + (LOCAL ? '&local=1' : ''); }
  function qrSvg(text) { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  function setNetUi(st, code, detail) {
    if (st === 'online') { var url = window.ZTP_QR || controllerUrl(code); $('code').textContent = code; $('cqcode').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); $('qr').innerHTML = qrSvg(url); $('cq').innerHTML = qrSvg(url); $('netStatus').textContent = ''; }
    else $('netStatus').textContent = st === 'offline' ? 'Room server offline (' + (detail || '') + ')' : 'Connecting to the room server\u2026';
  }
  window.addEventListener('message', function (e) { var d = e.data; if (e.source !== window.parent || !d || d.ztp !== 'qr' || !d.url) return;
    if (window.ZTP_QR !== d.url) { window.ZTP_QR = d.url; if (net && net.status === 'online') setNetUi('online', net.code); } try { parent.postMessage({ ztp: 'qrok' }, '*'); } catch (x) {} });
  window.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); } if ((e.key === 'b' || e.key === 'B') && game.phase === 'lobby') game.bots = !game.bots; });
  var roomQ = (Q.get('room') || Q.get('code') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || null;
  if (LOCAL) net = new window.DDNet.LocalHost({ code: roomQ || 'TEST', onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else if (!NONET) net = new window.DDNet.Host({ code: roomQ, fixedCode: !!roomQ, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  initGL(); setPhase('lobby');
  if (Q.get('autostart') === '1') setTimeout(startMatch, 300);
  window.DD.debug = { startMatch: startMatch, toLobby: toLobby, game: game };
  requestAnimationFrame(tick);
})();
