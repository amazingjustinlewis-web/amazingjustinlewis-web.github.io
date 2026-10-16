/* DEMOLITION DERBY - TV host: lobby, rounds, rendering (three.js), phone networking. */
(function () {
  'use strict';
  var C = window.DD_CONFIG, A = C.arena, Q = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  var LOCAL = Q.get('local') === '1', NONET = Q.get('nonet') === '1', EMBED = window.parent !== window;
  var game = { phase: 'lobby', players: [], bots: Q.get('bots') !== '0', round: 0, rounds: +Q.get('rounds') || C.rounds, t: 0, phaseT: 0, sim: null, mode: Q.get('mode') === 'race' ? 'race' : 'derby', cam: Q.get('cam') || 'auto' };
  function setMode(m) { game.mode = m === 'race' ? 'race' : 'derby'; game.rounds = +Q.get('rounds') || (game.mode === 'race' ? C.race.rounds : C.rounds); uiKey = ''; }
  setTimeout(function () { setMode(game.mode); }, 0);
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
    game.round++; var S = game.sim = new window.DDSim(game.mode); showWorld(game.mode);
    game.players.filter(function (p) { return !p.left; }).forEach(function (p) { p.car = S.addCar({ id: p.id, name: p.name, color: p.color, ai: p.ai, type: p.type, armour: p.armour, boost: p.boost }); });
    S.spawnAll(); buildCars(); setPhase('countdown');
  }
  function endRound() {
    var S = game.sim, live = S.cars.filter(function (c) { return c.state === 'drive' || c.state === 'enter' || c.state === 'wait'; });
    var win = live[0] || S.byId(S.out[S.out.length - 1]);
    var order = S.out.slice().reverse(); if (win && order.indexOf(win.id) < 0) order.unshift(win.id);
    if (S.mode === 'race') { order = S.order().map(function (c) { return c.id; }); win = S.byId(order[0]); }
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
        S.cars.forEach(function (c) { var p = byId(c.id); if (c.ai || (p && p.aiCover)) { if (S.mode === 'race') S.thinkRace(c, 1 / 60); else S.think(c, 1 / 60); } });
        if (game.phase === 'play' || game.phaseT < 1.5) S.step(1 / 60); }
      S.events.forEach(onEvent); S.events = [];
      if (S.mode === 'race') { if (game.phase === 'play') { var hum = S.cars.filter(function (c) { return !c.ai; }), fin = function (c) { return c.done || c.state === 'out'; }, allDone = S.cars.every(fin) || (hum.length && hum.every(fin)) || S.cars.filter(function (c) { return !fin(c); }).length === 0;
          if (S.finish.length && !S.firstT) S.firstT = game.phaseT; if (allDone || (S.firstT && game.phaseT - S.firstT > C.race.finishWaitSec) || game.phaseT > 420) endRound(); } }
      else {
      if (game.phase === 'play' && S.living().length <= 1 && S.cars.every(function (c) { return c.state !== 'fall' && c.state !== 'wreck'; })) endRound();
      if (game.phase === 'play' && game.phaseT > 150) endRound(); }   // safety
    }
    if (game.phase === 'roundover' && game.phaseT > C.roundOverSec) { banner(''); if (game.round >= game.rounds) { setPhase('over'); showPodium(); } else nextRound(); }
    if (game.phase === 'over' && game.phaseT > C.podiumSec && !EMBED) toLobby();
    // phones away for a while: AI drives their car
    game.players.forEach(function (p) { if (!p.ai) p.aiCover = !p.connected && now - (p.goneAt || now) > C.phys.aiCoverSec * 1000; });
    pollPads(); touchTick(dt); render(dt); ui(); sendStates(now);
    requestAnimationFrame(tick);
  }
  // ---------------------------------------------------------------- events -> fx, phones, feed
  function onEvent(e) {
    var p;
    if (e.k === 'hit') { p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: Math.min(1, e.amt / 30) }); if (e.amt > 6) sparks(e.x, e.y, e.z + 0.8, Math.min(30, 4 + e.amt * 0.6), 0xffc040);
      var hc = game.sim && game.sim.byId(e.id); if (hc) { if (e.zone >= 0) { var za = e.zone * Math.PI / 4; partHitLocal(hc, Math.sin(za), Math.cos(za), e.amt * 1.1); } else partHitLocal(hc, 0, 0, e.amt, true); } }   // v0.4: model damage driven by the 8 hit zones
    if (e.k === 'crush') { sparks(e.x, e.y, 1.5, 60, 0xff7020); debris(e.x, e.y, 1.5, 14, byId(e.id) && byId(e.id).color); shake(1.4); crunch(1.3, 'metal'); hitStop(0.09); feed(nm(e.by) + ' CRUSHED ' + nm(e.id) + '!'); p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: 1 }); }
    if (e.k === 'smash') { var f = Math.min(1, e.s / 30);
      shake(0.15 + f * (e.ram ? 1.3 : 0.9)); crunch(f, e.spk ? 'spike' : e.pl ? 'plate' : 'metal');
      sparks(e.x, e.y, 0.9, Math.round(8 + f * 34), e.spk ? 0xfff0a0 : e.pl ? 0xbfd8ff : 0xffc040);
      if (e.s > 10) { debris(e.x, e.y, 0.9, Math.round(2 + f * 8), e.ca); debris(e.x, e.y, 0.9, Math.round(2 + f * 8), e.cb); }
      if (e.s > 18) { flashAt3(e.x, e.y); hitStop(e.ram ? 0.08 : 0.05); } }
    if (e.k === 'bump') { /* light nudges stay quiet */ }
    if (e.k === 'wall' && e.s > 8) { shake(Math.min(0.6, e.s / 40)); crunch(Math.min(0.7, e.s / 40), 'wall'); sparks(e.x, e.y, 0.8, 8, 0xffc040); }
    if (e.k === 'boost') { var c0 = game.sim && game.sim.byId(e.id); if (c0) { boostFx(c0, e.b); whoosh(e.b); } }
    if (e.k === 'ko') { feed(e.how === 'ringout' ? nm(e.id) + ' fell out' + (e.by ? ' (thanks ' + nm(e.by) + ')' : '') : nm(e.by || e.id) === nm(e.id) ? nm(e.id) + ' wrecked' : nm(e.by) + ' wrecked ' + nm(e.id)); if (e.how === 'wreck') { boom(e.x, e.y, e.z); debris(e.x, e.y, e.z + 1, 22, byId(e.id) && byId(e.id).color); crunch(1.4, 'boom'); hitStop(0.12); var wc = game.sim && game.sim.byId(e.id); if (wc) wreckFx(wc); } p = byId(e.id); if (p && p.conn) send(p.conn, { t: 'buzz', s: 1, long: 1 }); }
    if (e.k === 'gate') feed('THE GATE OPENS');
    if (e.k === 'smash' && e.s > 12) bumpAct(Math.min(1, e.s / 30), e.x, e.y);
    if (e.k === 'jump') { var jc = game.sim && game.sim.byId(e.id); if (jc) bumpAct(0.45, jc.x, jc.y); }
    if (e.k === 'ko' && e.how === 'wreck') onCrash(e);
    if (e.k === 'cleared') { var cl = game.sim && game.sim.byId(e.id); if (cl) { flashAt3(cl.x, cl.y); sparks(cl.x, cl.y, cl.z + 1, 20, 0xffffff); } }
    if (e.k === 'lap') { if (!game.sim.byId(e.id).ai) feed(nm(e.id) + ': LAP ' + e.lap + '/' + game.sim.laps); }
    if (e.k === 'finish') { feed(nm(e.id) + ' FINISHED #' + e.place + ' (' + e.t.toFixed(1) + 's)'); if (e.place === 1) { banner(nm(e.id) + ' WINS!', byId(e.id) && byId(e.id).color); setTimeout(function () { if (game.phase === 'play') banner(''); }, 1800); } }
    if (e.k === 'roof') { feed(nm(e.id) + ' is on the roof!'); sparks(e.x, e.y, 0.5, 16, 0xffc040); crunch(0.8, 'metal'); }
    if (e.k === 'splash') { for (var si = 0; si < 14; si++) sparks(e.x, e.y, 0.3, 1, 0x7ab8ff); }
    if (e.k === 'land' && carMeshes[e.id]) carMeshes[e.id].susV = (carMeshes[e.id].susV || 0) - Math.min(14, e.s) * 0.12;
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
    cam = new R3.PerspectiveCamera(42, 1, 1, 1000); pipCam = new R3.PerspectiveCamera(46, 1.6, 0.5, 400);
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
    arenaObjs = scene.children.filter(function (o) { return !o.isLight; });
    for (var k = 0; k < 260; k++) { var sp = new R3.Mesh(new R3.BoxGeometry(0.25, 0.25, 0.25), new R3.MeshBasicMaterial({ color: 0xffc040 })); sp.visible = false; scene.add(sp); sparkPool.push({ m: sp, life: 0 }); }
    initFx(); resize(); window.addEventListener('resize', resize);
  }
  // ---------------------------------------------------------------- v0.4 race track meshes (built on first use)
  var arenaObjs = [], trackG = null;
  function showWorld(mode) {
    if (mode === 'race' && !trackG) buildTrack();
    arenaObjs.forEach(function (o) { o.visible = mode !== 'race'; }); if (trackG) trackG.visible = mode === 'race';
    scene.background.setHex(mode === 'race' ? 0x7d95a8 : 0x120c08); scene.fog.color.setHex(mode === 'race' ? 0x7d95a8 : 0x120c08); scene.fog.near = mode === 'race' ? 320 : 90; scene.fog.far = mode === 'race' ? 950 : 170;
  }
  function buildTrack() { trackG = window.DDTrackMesh.build(R3); scene.add(trackG); }
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
  function clearCars() { for (var k in carMeshes) { scene.remove(carMeshes[k].g); if (carMeshes[k].aimR) { scene.remove(carMeshes[k].aimR); scene.remove(carMeshes[k].aimT); } } carMeshes = {}; }
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
    var aimR = null, aimT = null;
    if (!c.ai) { aimR = new R3.Mesh(new R3.RingGeometry(2.6, 3.0, 40), new R3.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false })); aimR.rotation.x = -Math.PI / 2; scene.add(aimR);
      var tg = new R3.BufferGeometry(); tg.setAttribute('position', new R3.Float32BufferAttribute([0, 0, 0.75, -0.5, 0, -0.35, 0.5, 0, -0.35], 3)); aimT = new R3.Mesh(tg, new R3.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: 2, depthWrite: false })); aimT.visible = false; aimT.scale.setScalar(1.7); scene.add(aimT); }
    return { aimR: aimR, aimT: aimT, g: g, sh: sh, tag: tag, body: { material: paint }, crumple: body, smoke: 0, sed: sed };
  }
  var SED_M = null;
  function sedMats() { SED_M = { glass: new R3.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.45, side: 2, depthWrite: false }), trim: new R3.MeshLambertMaterial({ color: 0x18181c, side: 2 }), tyre: new R3.MeshLambertMaterial({ color: 0x111111 }) }; }
  window.DDSedan.onReady(function () { if (!SED_M) sedMats(); if (game.sim) buildCars(); });
  // ---------------------------------------------------------------- v0.3 per-part damage
  // impact direction (world, sim coords) -> car-local, then every part facing that way takes a share: works from any angle (front, sides, rear, corners)
  function partHit(c, wx, wy, amt, roof) { var a = c.a; partHitLocal(c, wx * Math.cos(a) - wy * Math.sin(a), wx * Math.sin(a) + wy * Math.cos(a), amt, roof); }
  function partHitLocal(c, lx, lz, amt, roof) {
    var m = carMeshes[c.id]; if (!m || !m.sed || amt <= 0 || c.state === 'wreck') return; var L = Math.hypot(lx, lz) || 1; lx /= L; lz /= L;
    var P = m.sed.parts; for (var k in P) { var p = P[k]; if (p.st >= 9) continue; var w = roof ? (p.kind === 'wheel' ? 0.1 : 0.7) : Math.pow(Math.max(0, p.dx * lx + p.dz * lz), 2);
      if (w < 0.05) continue; p.dmg += amt * w * (p.kind === 'glass' ? 2 : 1.3); partState(c, m, p); }
  }
  var LIM = { hood: [16, 36, 70], door: [28, 0, 66], trunk: [26, 0, 60], glass: [12], wheel: [130] };   // v0.4: x~1.65 (cars last 2x longer, damage still shows hit by hit)
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
  // v0.4 destruction: falls apart (doors, hood, boot, a wheel or two fly off), burns, fades to ~30%, flashes, gone
  function wreckFx(c) {
    var m = carMeshes[c.id]; if (!m) return; m.wreck = true; m.mats = [];
    if (m.sed) { var P = m.sed.parts, n = 0; for (var k in P) { var p = P[k]; if (p.st >= 9) continue; if (p.kind === 'door' || p.kind === 'hood' || p.kind === 'trunk' || (p.kind === 'wheel' && n++ < 2) || (p.kind === 'glass')) { if (p.kind === 'glass') { p.node.visible = false; p.st = 9; } else detach(c, p); } } }
    m.g.traverse(function (o) { if (o.material && !o.userData.wm) { o.material = o.material.clone(); o.material.userData = { o0: o.material.transparent ? o.material.opacity : 1 }; o.material.transparent = true; o.userData.wm = 1; m.mats.push(o.material); } });
    m.mats.forEach(function (mt) { if (mt.color) mt.color.lerp(new R3.Color(0x1a1410), 0.7); });
  }
  var EUL = null;
  function stepParts(dt, t) {
    var S = game.sim; if (!EUL) EUL = new R3.Euler();
    for (var i = debrisParts.length - 1; i >= 0; i--) { var d = debrisParts[i], u = d.userData, v = u.v, rr = Math.hypot(d.position.x, d.position.z), floorY = S && S.mode === 'race' ? window.DDSim.ground(d.position.x, d.position.z) + u.r * 0.4 : S && rr < S.R ? u.r * 0.4 : -99;
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
      if (c.fresh) { c.fresh = false; scene.remove(m.g); if (m.aimR) { scene.remove(m.aimR); scene.remove(m.aimT); } scene.remove(m.sh); m.tag.remove(); carMeshes[c.id] = carMesh(c); return; }   // back through the gate: a fresh car
      var sp = Math.hypot(c.vx, c.vy), P = m.sed.parts;
      for (var k in P) { var p = P[k]; if (p.st !== 2) continue; var n = p.node, f = Math.min(1, sp / 9);
        if (p.kind === 'hood') n.rotation.x = 0.08 + (0.25 + 0.6 * Math.abs(Math.sin(t * (4 + sp * 0.4) + p.ph))) * f;   // flaps open/closed while driving
        else if (p.kind === 'trunk') n.rotation.x = -(0.25 + 0.55 * Math.abs(Math.sin(t * 3.2 + p.ph)) * (0.3 + f));
        else n.rotation.y = (p.x > 0 ? 1 : -1) * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.6 + p.ph)) * (0.3 + f));     // doors swing on their hinges
      }
      // engine: smoke past half damage, fire under the hood when it's nearly gone
      if (c.state === 'wreck') { if (Math.random() < dt * 30) puff(c.x + (Math.random() - 0.5) * 2, c.y + (Math.random() - 0.5) * 2, c.z + 1, Math.random() < 0.6 ? 0xff6a10 : 0xffc030, 1); if (Math.random() < dt * 10) puff(c.x, c.y, c.z + 1.8, 0x2a2a2a); }
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
  // v0.4 camera: wide / close / dynamic (TV default: derby = wide fixed view, race = dynamic pack framing). Always the same 3/4 direction, so 'push up' = away from you on screen
  var CAMS = ['wide', 'close', 'dynamic'], camC = null, camHt = 74;
  function camMode() { return game.cam !== 'auto' ? game.cam : game.mode === 'race' || touchP ? 'dynamic' : 'wide'; }
  function camRig(S, dt, sk) {
    if (!camC) camC = new R3.Vector3(0, 0, 4); var mode = camMode(), race = S.mode === 'race';
    if (race && !touchP && game.cam === 'auto') { director(S, dt); return; } if ($('shotLbl')) $('shotLbl').textContent = '';
    if (mode === 'wide' && !race) { camC.set(0, 0, 4); camHt = 74; return; }
    var me = touchP && S.byId(touchP.id), act = S.cars.filter(function (c) { return c.state === 'drive' || c.state === 'wreck' || c.state === 'enter'; }), focus = [];
    if (me && (me.state === 'drive' || me.state === 'wreck')) focus = [me]; else { focus = act.filter(function (c) { return !c.ai; }); if (!focus.length) focus = race ? S.order().filter(function (c) { return c.state === 'drive'; }).slice(0, 1) : act; }
    if (!focus.length) focus = act.length ? act : S.cars;
    var cx = 0, cy = 0; focus.forEach(function (c) { cx += c.x; cy += c.y; }); cx /= focus.length; cy /= focus.length;
    var spread = 0; focus.forEach(function (c) { spread = Math.max(spread, Math.hypot(c.x - cx, c.y - cy)); });
    if (mode === 'dynamic' && me) { var near = 1e9; act.forEach(function (o) { if (o !== me) near = Math.min(near, Math.hypot(o.x - me.x, o.y - me.y)); }); spread = Math.min(near, 40) * 0.8; }
    var ht = mode === 'close' ? 22 : mode === 'wide' ? 150 : Math.max(30, Math.min(120, spread * 1.5 + 26));
    if (race && mode === 'dynamic') {   // v0.4.1: 2.5x further out by default; soft zoom-in on action, all the way in on a crash
      ht *= C.race.camOut; var pack = 0; act.forEach(function (o) { if (Math.hypot(o.x - cx, o.y - cy) < 14) pack++; });
      ACT.v = Math.max(ACT.v * Math.pow(0.45, dt), pack >= 3 ? 0.35 + Math.min(0.25, (pack - 3) * 0.08) : 0);
      var cr = ACT.crash && performance.now() < ACT.crash.until ? ACT.crash : null;
      if (cr) { var cc = S.byId(cr.id); if (cc) { cx += (cc.x - cx) * 0.85; cy += (cc.y - cy) * 0.85; } ht = 24; }
      else { ht = ht * (1 - 0.55 * Math.min(1, ACT.v)); if (ACT.v > 0.2 && ACT.x != null) { cx += (ACT.x - cx) * 0.4 * ACT.v; cy += (ACT.y - cy) * 0.4 * ACT.v; } }
    }
    if (me && mode !== 'wide') { var sp = Math.hypot(me.vx, me.vy); ht += sp * 0.35; cx += me.vx * 0.35; cy += me.vy * 0.35; }
    var k = 1 - Math.pow(0.04, dt); camC.x += (cx - camC.x) * k; camC.z += (cy - camC.z) * k; camHt += (ht - camHt) * (1 - Math.pow(ht < camHt ? 0.35 : 0.25, dt));
    cam.position.set(camC.x + (Math.random() - 0.5) * sk, camHt + (Math.random() - 0.5) * sk, camC.z + camHt * 0.56 + (Math.random() - 0.5) * sk); cam.lookAt(camC.x, 0, camC.z);
  }
  // ---------------------------------------------------------------- v0.4.1 action zoom + crash replays (PiP on the shared screen, full screen on the wrecked player's phone)
  var ACT = { v: 0, x: null, y: null, crash: null }, REC = [], recT = 0, pipCam = null, PIP = null;
  function bumpAct(v, x, y) { if (v > ACT.v) { ACT.v = v; ACT.x = x; ACT.y = y; } }
  function recFrame(S) { var now = performance.now(); if (now - recT < 50) return; recT = now;
    REC.push({ t: now, c: S.cars.map(function (c) { return [c.id, +c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +c.a.toFixed(3), +(c.roll || 0).toFixed(2), c.state === 'wreck' ? 1 : c.state === 'drive' || c.state === 'enter' ? 0 : 2]; }) });
    while (REC.length && now - REC[0].t > 5000) REC.shift(); }
  function onCrash(e) {
    var now = performance.now(); ACT.crash = { id: e.id, until: now + 2600 };
    PIP = { id: e.id, t0: now - C.replay.before * 1000, t1: now + C.replay.after * 1000, start: now + C.replay.after * 1000, x: e.x, y: e.y, full: touchP && touchP.id === e.id };
    var p = byId(e.id);
    setTimeout(function () { var fr = REC.filter(function (f) { return f.t >= PIP0(e, now) && f.t <= now + C.replay.after * 1000; }); if (!fr.length || !game.sim) return;
      var cols = {}; game.sim.cars.forEach(function (c) { cols[c.id] = c.color; });
      if (p && p.conn) send(p.conn, { t: 'replay', id: e.id, mode: game.sim.mode, hitT: now, f: fr, cols: cols, lives: game.sim.byId(e.id).lives, R: game.sim.R }); }, C.replay.after * 1000 + 30);
  }
  function PIP0(e, now) { return now - C.replay.before * 1000; }
  function renderPip(S) {
    if (!PIP) return false; var now = performance.now(); if (now < PIP.start) return false;
    var dur = (PIP.t1 - PIP.t0) / C.replay.speed, u = (now - PIP.start) / dur; if (u > 1) { if (PIP.full && !PIP.resp) { PIP.resp = now; respawnFlash(); } PIP = null; return false; }
    var tt = PIP.t0 + (PIP.t1 - PIP.t0) * u, f = null; for (var i = 0; i < REC.length; i++) { if (REC[i].t >= tt) { f = REC[i]; break; } } if (!f) return false;
    var saved = [];
    f.c.forEach(function (q) { var m = carMeshes[q[0]]; if (!m) return; saved.push([m, m.g.position.clone(), m.g.rotation.clone(), m.g.visible]); m.g.position.set(q[1], q[3], q[2]); m.g.rotation.set(0, q[4], q[5]); m.g.visible = q[6] !== 2; });
    var me = f.c.filter(function (q) { return q[0] === PIP.id; })[0] || [0, PIP.x, PIP.y, 0, 0], orb = 0.6 + u * 1.4;
    pipCam.position.set(me[1] + Math.sin(orb) * 11, me[3] + 5.5, me[2] + Math.cos(orb) * 11); pipCam.lookAt(me[1], me[3] + 0.8, me[2]);
    var W = innerWidth, H = innerHeight, pw = PIP.full ? W : Math.round(W * 0.34), ph = PIP.full ? H : Math.round(pw / 1.6), px = PIP.full ? 0 : W - pw - Math.round(W * 0.015), py = PIP.full ? 0 : Math.round(H * 0.12);
    pipCam.aspect = pw / ph; pipCam.updateProjectionMatrix();
    renderer.setScissorTest(true); renderer.setViewport(px, py, pw, ph); renderer.setScissor(px, py, pw, ph); renderer.render(scene, pipCam);
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    saved.forEach(function (sv) { sv[0].g.position.copy(sv[1]); sv[0].g.rotation.copy(sv[2]); sv[0].g.visible = sv[3]; });
    var el = $('pipLbl'); el.style.display = ''; el.style.left = (PIP.full ? 0 : px) + 'px'; el.style.bottom = py + 'px'; el.style.width = pw + 'px'; el.style.height = ph + 'px'; el.className = PIP.full ? 'full' : '';
    el.firstChild.textContent = (PIP.full ? 'YOUR CRASH' : 'REPLAY \u00b7 ' + nm(PIP.id)) + (tt > PIP.t1 - C.replay.after * 1000 ? ' \uD83D\uDCA5' : '');
    return true;
  }
  function respawnFlash() { var b = $('resp'); if (!b) return; var me = touchP && game.sim && game.sim.byId(touchP.id); b.textContent = me && me.lives <= 0 ? 'OUT \u00b7 SPECTATING' : 'RESPAWNING'; b.className = 'on'; setTimeout(function () { b.className = ''; }, 1900); }
  // ---------------------------------------------------------------- v0.4.2 race broadcast director: calm held shots, hard cuts, prefers action. Players drive on their own phones.
  var DIR = { shot: null, t: 0, hold: 0, n: 0, pos: null, look: null };
  function actionAt(S, c) { var n = 0; S.cars.forEach(function (o) { if (o !== c && o.state === 'drive' && Math.hypot(o.x - c.x, o.y - c.y) < 22) n++; }); return n + (c.air ? 1.5 : 0) + (!c.ai ? 0.6 : 0); }
  function pickCar(S, not) { var best = null, bs = -1; S.cars.forEach(function (c) { if (c.state !== 'drive' || c === not) return; var sc = actionAt(S, c) + Math.random() * 0.8; if (sc > bs) { bs = sc; best = c; } }); return best; }
  function cutTo(S, kind) {
    var TR = window.DDTrack, c = pickCar(S, kind === 'chase' && DIR.shot && DIR.shot.c), now = performance.now();
    DIR.n++; DIR.t = 0; DIR.hold = 5 + Math.random() * 3;
    if (kind === 'heli' || !c) { DIR.shot = { k: 'heli', ang: Math.random() * 6.28 }; DIR.hold = 7 + Math.random() * 2; return; }
    if (kind === 'trackside') { var ahead = (c.s + Math.max(25, Math.hypot(c.vx, c.vy) * 2.6)) % TR.L, sd = Math.random() < 0.5 ? -1 : 1, w = TR.at(ahead, sd * (TR.HALF + 7)), lk = TR.at(ahead - 8, 0);
      DIR.shot = { k: 'trackside', c: c, pos: new R3.Vector3(w.x, TR.height(ahead, sd * TR.HALF) + 3.5 + Math.random() * 3, w.y), look: new R3.Vector3(lk.x, TR.height(ahead - 8, 0) + 1, lk.y) }; DIR.hold = 4.5 + Math.random() * 2; return; }
    DIR.shot = { k: 'chase', c: c, back: 13 + Math.random() * 5, up: 4.5 + Math.random() * 2.5, side: (Math.random() - 0.5) * 6 }; DIR.pos = null;
  }
  function director(S, dt) {
    var now = performance.now(), cr = ACT.crash && now < ACT.crash.until ? S.byId(ACT.crash.id) : null; DIR.t += dt;
    if (cr) { if (!DIR.shot || DIR.shot.k !== 'crash' || DIR.shot.c !== cr) { DIR.shot = { k: 'crash', c: cr, ang: Math.random() * 6.28 }; DIR.t = 0; DIR.hold = 2.6; } }
    else if (!DIR.shot || DIR.t > DIR.hold || (DIR.shot.c && DIR.shot.c.state !== 'drive' && DIR.shot.k !== 'heli')) {
      var prev = DIR.shot ? DIR.shot.k : 'heli', pack = S.cars.some(function (c) { return c.state === 'drive' && actionAt(S, c) >= 2; }), r = Math.random();
      cutTo(S, prev === 'heli' ? (r < 0.65 ? 'chase' : 'trackside') : pack ? (r < 0.6 ? 'chase' : r < 0.85 ? 'trackside' : 'heli') : (r < 0.4 ? 'chase' : r < 0.65 ? 'trackside' : 'heli'));
    }
    var sh = DIR.shot, c = sh.c; cam.fov = 42;
    if (sh.k === 'heli') { var a = sh.ang + DIR.t * 0.05, R = 520; cam.fov = 40; cam.position.set(Math.sin(a) * R, 330, Math.cos(a) * R); cam.lookAt(0, 0, 0); }
    else if (sh.k === 'trackside') { cam.fov = 38; cam.position.copy(sh.pos); cam.lookAt(sh.look); }
    else if (sh.k === 'crash') { var oa = sh.ang + DIR.t * 0.35; cam.position.set(c.x + Math.sin(oa) * 12, c.z + 6, c.y + Math.cos(oa) * 12); cam.lookAt(c.x, c.z + 0.8, c.y); }
    else { var fx = Math.sin(c.a), fy = Math.cos(c.a), want = new R3.Vector3(c.x - fx * sh.back + fy * sh.side, c.z + sh.up, c.y - fy * sh.back - fx * sh.side);
      if (!DIR.pos) DIR.pos = want.clone(); else DIR.pos.lerp(want, 1 - Math.pow(0.08, dt));   // soft chase, never a whip-pan
      cam.position.copy(DIR.pos); cam.lookAt(c.x + fx * 6, c.z + 1, c.y + fy * 6); }
    cam.updateProjectionMatrix();
    var lb = $('shotLbl'); if (lb) lb.textContent = sh.k === 'heli' ? 'HELI CAM' : sh.k === 'trackside' ? 'TRACKSIDE' : sh.k === 'crash' ? 'CRASH CAM' : 'CHASE \u00b7 ' + nm(c.id);
  }
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
    if (S && game.phase !== 'lobby') camRig(S, dt, sk);
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
        var vis = c.state === 'drive' || c.state === 'fall' || c.state === 'enter' || c.state === 'wreck';
        if (c.state === 'wait' && c.ghost && c.spawnS != null) { if (!c.ghostDone) { c.ghostDone = true; c.fresh = true; } var gw = window.DDTrack.at(c.spawnS, 0); m.g.visible = Math.floor(performance.now() / 160) % 2 === 0; m.g.position.set(gw.x, window.DDTrack.height(c.spawnS, 0) + C.wreck.dropH, gw.y); m.g.rotation.set(0, Math.atan2(gw.tx, gw.ty), 0); m.sh.visible = true; m.sh.position.set(gw.x, window.DDTrack.height(c.spawnS, 0) + 0.05, gw.y); if (m.aimR) m.aimR.visible = false; m.tag.style.display = 'none'; return; }
        m.g.visible = vis; m.sh.visible = vis && c.state !== 'fall';
        if (m.aimR) { var gy0 = window.DDSim.ground(c.x, c.y) + 0.08, ab = c.inp.abs, held = vis && c.state === 'drive' && ab && Math.hypot(ab[0], ab[1]) > 0.25, ta0 = held ? Math.atan2(ab[0], ab[1]) : 0;
          m.aimR.visible = vis && c.state !== 'fall'; m.aimR.position.set(c.x, gy0, c.y); m.aimT.visible = !!held;
          if (held) { m.aimT.position.set(c.x + Math.sin(ta0) * 4.2, gy0 + 0.6 + Math.sin(performance.now() / 180) * 0.12, c.y + Math.cos(ta0) * 4.2); m.aimT.rotation.y = ta0; } }
        // v0.4: pitch + roll follow the ground under the wheels, plus body lean, suspension bob, gravel rattle and the flip/roof roll
        var GR = window.DDSim.ground, fx = Math.sin(c.a), fy = Math.cos(c.a), hl = c.T.size[1] * 0.5, hw = c.T.size[0] * 0.5, pitch = 0, groll = 0;
        if (c.air) pitch = -Math.max(-0.5, Math.min(0.5, c.vz * 0.04));
        else { pitch = -Math.atan2(GR(c.x + fx * hl, c.y + fy * hl) - GR(c.x - fx * hl, c.y - fy * hl), hl * 2); groll = Math.atan2(GR(c.x + fy * hw, c.y - fx * hw) - GR(c.x - fy * hw, c.y + fx * hw), hw * 2); }
        m.susV = (m.susV || 0) + (-(m.sus || 0) * 140 - (m.susV || 0) * 9) * dt; m.sus = Math.max(-0.5, Math.min(0.4, (m.sus || 0) + m.susV * dt));
        var spd = Math.hypot(c.vx, c.vy), lean = c.air || c.state !== 'drive' ? 0 : -(c.steerS || 0) * Math.min(1, spd / 20) * 0.09, rat = c.rattle ? (Math.random() - 0.5) * 0.07 * c.rattle : 0;
        var roll = c.roll + groll + lean + rat, lift = Math.abs(Math.sin(c.roll)) * hw * 1.2 + (1 - Math.cos(c.roll)) * 0.5 * c.T.size[2] * 1.15;
        m.g.rotation.order = 'YXZ'; m.g.position.set(c.x, c.z + lift + (m.sus || 0) + (c.rattle ? Math.random() * 0.07 * c.rattle : 0), c.y); m.g.rotation.y = c.a;
        m.g.rotation.x = c.state === 'fall' ? (A.R - Math.hypot(c.x, c.y)) * 0.08 : pitch + (m.sus || 0) * 0.15 + rat; m.g.rotation.z = roll;
        if (m.wreck && m.mats) { var wt = c.state === 'wreck' ? c.wreckT : 0, fadeEnd = C.wreck.sec - C.wreck.flashSec, op = wt < fadeEnd ? 1 - (1 - C.wreck.fadeTo) * (wt / fadeEnd) : C.wreck.fadeTo;
          m.mats.forEach(function (mt) { mt.opacity = op * (mt.userData && mt.userData.o0 ? mt.userData.o0 : 1); }); if (wt >= fadeEnd) m.g.visible = vis && Math.floor(wt * 12) % 2 === 0; }
        m.sh.position.set(c.x, window.DDSim.ground(c.x, c.y) + 0.05, c.y);
        var hpf = c.hp / c.maxhp; if (m.wreck) hpf = 0; if (!m.sed) m.crumple.scale.set(1, 1 - (1 - hpf) * 0.25, 1 - (1 - hpf) * 0.12); if (c.boostT > 0 && Math.random() < dt * 30) sparks(c.x - Math.sin(c.a) * 2, c.y - Math.cos(c.a) * 2, c.z + 0.5, 1, c.boostType === 'ram' ? 0xff4020 : c.boostType === 'dash' ? 0x40e0ff : 0xffd23f); if (!m.wreck) m.body.material.color.set(c.color).lerp(new R3.Color(0x222222), (1 - hpf) * 0.6);
        if (vis && hpf < 0.35 && Math.random() < dt * 12) sparks(c.x, c.y, c.z + 1.4, 1, 0x444444);
        V.set(c.x, c.z + c.T.size[2] + 1.2, c.y).project(cam);
        if (vis && c.state !== 'fall' && c.state !== 'wreck' && V.z < 1) { m.tag.style.display = ''; m.tag.style.left = ((V.x + 1) / 2 * innerWidth) + 'px'; m.tag.style.top = ((1 - V.y) / 2 * innerHeight) + 'px';
          m.tag.firstChild.textContent = c.name; var bar = m.tag.lastChild.firstChild; bar.style.width = (hpf * 100) + '%'; bar.style.background = hpf > 0.5 ? '#7ed957' : hpf > 0.25 ? '#ffd23f' : '#ff4b55'; }
        else m.tag.style.display = 'none';
      });
    }
    sparkPool.forEach(function (s) { if (s.life <= 0) return; s.life -= dt; if (s.up) { s.v[1] += 1.5 * dt; s.m.scale.multiplyScalar(1 + dt * 0.5); } else s.v[1] -= 30 * dt; s.m.position.x += s.v[0] * dt; s.m.position.y += s.v[1] * dt; s.m.position.z += s.v[2] * dt; if (s.m.position.y < 0.1) { s.m.position.y = 0.1; s.v[1] *= -0.4; } if (s.life <= 0) s.m.visible = false; });
    renderer.render(scene, cam);
    if (S && game.phase !== 'lobby') { recFrame(S); if (!renderPip(S)) $('pipLbl').style.display = 'none'; }
  }
  // ---------------------------------------------------------------- DOM UI
  var uiKey = '';
  function ui() {
    var ph = game.phase, inGame = ph === 'countdown' || ph === 'play' || ph === 'roundover';
    $('lobby').style.display = ph === 'lobby' ? 'flex' : 'none'; $('podium').style.display = ph === 'over' ? 'flex' : 'none';
    $('cards').style.display = $('feed').style.display = inGame ? '' : 'none';
    $('cornerqr').style.display = inGame && net && net.status === 'online' ? '' : 'none';
    if (ph === 'lobby') {
      var L = leader(), k = JSON.stringify([game.players.map(function (p) { return [p.name, p.color, p.ready, p.connected, p.type, p.boost, p.armour.front]; }), game.bots, flashMsg, L && L.name, game.mode, game.cam]);
      if (k !== uiKey) { uiKey = k;
        $('plist').innerHTML = humans().map(function (p) { return '<span style="background:' + p.color + ';opacity:' + (p.connected ? 1 : 0.4) + '">' + esc(p.name) + ' \u00b7 ' + window.DDSim.carType(p.type).name + (p.pad != null ? ' \u00b7 ' + C.boosts[p.boost].name + ' \u00b7 ' + C.armour[p.armour.front].name : '') + (p.ready ? ' \u2714' : '') + '</span>'; }).join('') || '<span style="background:#fff3;color:#fff">Waiting for drivers&hellip;</span>';
        $('hint').innerHTML = (L ? '<b>' + esc(L.name) + '</b> starts the derby from their phone' : 'Scan to join (up to ' + C.maxPlayers + ')') + ' \u00b7 AI fill ' + (game.bots ? 'ON' : 'OFF') + ' \u00b7 ' + (game.mode === 'race' ? 'RACE: ' + C.race.laps + ' laps, ' + C.lives + ' lives, ' + game.rounds + ' race' + (game.rounds > 1 ? 's' : '') : 'DERBY: ' + game.rounds + ' rounds, ' + C.lives + ' lives each') + (flashMsg && performance.now() - flashAt < 4000 ? '<br><span style="color:#ff9">' + esc(flashMsg) + '</span>' : '') + '<br><small>Controller: A = join / start \u00b7 D-pad = car + boost \u00b7 X = armour \u00b7 Menu = settings. Y = Derby/Race. Keyboard: Enter = start, B = AI on/off, M = Derby/Race, C = camera</small>';
        $('modeTag').textContent = game.mode === 'race' ? 'RACE' : 'DERBY'; $('h1').textContent = game.mode === 'race' ? 'DEMOLITION RACE' : 'DEMOLITION DERBY'; $('sub').textContent = game.mode === 'race' ? 'Long winding track: jumps, ledges, puddles, gravel. First across the line after ' + C.race.laps + ' laps wins. Wrecks respawn on the track.' : 'Pick a car on your phone. Last car rolling wins the round.';
        if ($('tMode')) { $('tMode').textContent = 'Mode: ' + (game.mode === 'race' ? 'Race' : 'Derby'); $('tCar').textContent = 'Car: ' + (touchP ? window.DDSim.carType(touchP.type).name : ''); $('tBoost').textContent = 'Boost: ' + (touchP ? C.boosts[touchP.boost].name : ''); }
      }
    }
    if (inGame && game.sim) {
      $('cards').innerHTML = game.sim.cars.map(function (c) { var p = byId(c.id), hpf = Math.max(0, c.hp / c.maxhp), out = c.state === 'out';
        return '<div class="pc' + (out ? ' out' : '') + '" style="border-color:' + c.color + '"><span class="nm">' + esc(c.name) + (c.ai ? ' <small>AI</small>' : p && p.aiCover ? ' <small>(AI)</small>' : '') + '</span>' +
          (c.state === 'wait' ? '<span class="w">' + (game.sim.mode === 'race' ? 'respawning' : 'at gate') + '</span>' : c.state === 'wreck' ? '<span class="w">WRECKED</span>' : '<span class="hp"><i style="width:' + (hpf * 100) + '%;background:' + (hpf > 0.5 ? '#7ed957' : hpf > 0.25 ? '#ffd23f' : '#ff4b55') + '"></i></span>') +
          '<span class="lv">' + (game.sim.mode === 'race' ? (c.done ? 'FIN #' + (game.sim.finish.indexOf(c.id) + 1) : out ? 'OUT' : 'P' + (game.sim.order().indexOf(c) + 1) + ' \u00b7 L' + Math.min(game.sim.laps, c.lap + 1) + ' ' + '\u2665'.repeat(Math.max(0, c.lives))) : out ? 'OUT' : '\u2665'.repeat(Math.max(0, c.lives))) + '</span><span>' + (p ? p.score : 0) + '</span></div>'; }).join('') + '<div class="pc" style="border-color:#ffd23f;min-width:0">' + (game.sim.mode === 'race' ? 'Race ' : 'Round ') + game.round + '/' + game.rounds + '</div>';
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
    if (now - lastSend < (game.sim && game.sim.mode === 'race' ? 66 : 100)) return; lastSend = now;
    var W = game.sim && game.sim.mode === 'race' && game.phase !== 'lobby' ? game.sim.cars.map(function (c) { var ws = c.state === 'wait' && c.ghost && c.spawnS != null ? window.DDTrack.at(c.spawnS, 0) : null; return [c.id, +(ws ? ws.x : c.x).toFixed(2), +(ws ? ws.y : c.y).toFixed(2), +(ws ? window.DDTrack.height(c.spawnS, 0) + C.wreck.dropH : c.z).toFixed(2), +(ws ? Math.atan2(ws.tx, ws.ty) : c.a).toFixed(3), +(c.roll || 0).toFixed(2), c.state === 'drive' || c.state === 'enter' ? 0 : c.state === 'wreck' ? 1 : ws ? 3 : 2, c.color]; }) : null;
    var L = leader(), r = game.phase === 'over' ? ranking() : null;
    humans().forEach(function (p) { if (!p.conn || !p.connected) return; var c = game.sim && game.sim.byId(p.id), m = { t: 'st', phase: game.phase, leader: L === p, bots: game.bots, round: game.round, rounds: game.rounds, n: game.players.length, mode: game.mode };
      if (W) m.w = W;
      if (c && game.sim.mode === 'race') { m.pos = game.sim.order().indexOf(c) + 1; m.lap = Math.min(game.sim.laps, c.lap + 1); m.laps = game.sim.laps; m.done = c.done; }
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
    if (m.t === 'mode' && leader() === p && game.phase === 'lobby') setMode(game.mode === 'race' ? 'derby' : 'race');
    if (m.t === 'in' && game.sim) { var c = game.sim.byId(p.id); if (c && !p.aiCover) { if (m.abs) { c.inp.abs = m.abs; } else { c.inp.abs = null; c.inp.steer = +m.s || 0; c.inp.thr = +m.g || 0; } if (m.b) c.inp.boost = true; else if (c.boostType === 'sustain') c.inp.boost = false; } }
    if (m.t === 'leave') { p.left = true; p.connected = false; p.goneAt = performance.now() - 1e6; if (game.phase === 'lobby') game.players.splice(game.players.indexOf(p), 1); }
  }
  function onPhoneClose(conn) { var p = conn._p; if (p && p.conn === conn) { p.connected = false; p.goneAt = performance.now(); if (game.phase === 'lobby') setTimeout(function () { if (!p.connected && game.phase === 'lobby') { var i = game.players.indexOf(p); if (i >= 0) game.players.splice(i, 1); } }, 30000); } }
  // ---------------------------------------------------------------- v0.3.1 Xbox / standard gamepads (up to 4), alongside phones
  // A joins (lobby) / boosts. Left stick steers, RT gas, LT brake + reverse, RB boost too. Lobby: D-pad left/right = car, up/down = boost type, A again = start (pad leader). Menu = settings.
  var PADSET = window.ZTPPad ? window.ZTPPad.init({ game: 'derby', sticks: { L: 'Steer', R: 'Not used' }, invert: false, extra: [['classic', 'Classic steering (left/right)']], corner: 'br' }) : null, padP = {}, MAXPADS = 4;
  window.addEventListener('gamepaddisconnected', function (e) { var p = padP[e.gamepad.index]; if (p) { p.connected = false; p.goneAt = performance.now(); if (game.phase === 'lobby') { game.players.splice(game.players.indexOf(p), 1); delete padP[e.gamepad.index]; } } });
  function pollPads() {
    var gp = navigator.getGamepads ? navigator.getGamepads() : []; if (!gp) return;
    for (var i = 0; i < gp.length; i++) { var g = gp[i]; if (!g || !g.connected) continue;
      var B = g.buttons.map(function (b) { return b ? (typeof b === 'object' ? b.value : b) : 0; }), p = padP[i], pr = (p && p.prevB) || (pollPads.pre[i] || []), dn = function (k) { return (B[k] || 0) > 0.5 && !((pr[k] || 0) > 0.5); };
      pollPads.pre[i] = B;
      if (PADSET && PADSET.isOpen()) { if (p) p.prevB = B; continue; }
      if (!p) { if (dn(0) && Object.keys(padP).length < MAXPADS && humans().length < C.maxPlayers) {
          p = padP[i] = { id: 'pad' + i + '-' + Date.now().toString(36), name: 'Pad ' + (i + 1), pad: i, color: freeColor(), type: 'muscle', armour: { front: 'plate', side: 'none', back: 'none' }, boost: 'ram', score: 0, connected: true, ready: true, tot: { dmg: 0, kos: 0, ringouts: 0, crushes: 0, air: 0, wins: 0 } };
          if (game.phase !== 'lobby') p.spectator = true; game.players.push(p); if (game.phase === 'lobby') { var ai = game.players.filter(function (q) { return q.ai; }); if (ai.length) game.players.splice(game.players.indexOf(ai[0]), 1); }
          flash(p.name + ' joined'); p.prevB = B; } continue; }
      p.connected = true; p.prevB = B;
      if (game.phase === 'lobby') {
        var ct = C.cars.map(function (c) { return c.id; }), ci = ct.indexOf(p.type);
        if (dn(15)) p.type = ct[(ci + 1) % ct.length]; if (dn(14)) p.type = ct[(ci + ct.length - 1) % ct.length];
        if (dn(12) || dn(13)) { var bi = BST.indexOf(p.boost); p.boost = BST[(bi + (dn(12) ? 1 : 2)) % 3]; }
        if (dn(2)) { var k = ['plate', 'spike', 'none'], ai2 = k.indexOf(p.armour.front); p.armour = { front: k[(ai2 + 1) % 3], side: k[(ai2 + 1) % 3] === 'spike' ? 'none' : k[(ai2 + 1) % 3], back: 'none' }; }
        if (dn(3)) setMode(game.mode === 'race' ? 'derby' : 'race');
        if (dn(0) && (leader() === p || !leader() || leader().pad != null)) startMatch(); continue; }
      if (game.phase === 'over') { if (dn(0)) toLobby(); continue; }
      var c = game.sim && game.sim.byId(p.id); if (!c || p.aiCover) continue;
      var rd = PADSET ? PADSET.read(g) : { L: [g.axes[0] || 0, g.axes[1] || 0] }, sx = Math.abs(rd.L[0]) < 0.15 ? 0 : rd.L[0];
      var trig = (B[7] || 0) - (B[6] || 0);
      if (PADSET && PADSET.opts.classic) { c.inp.abs = null; c.inp.trig = null; c.inp.steer = Math.max(-1, Math.min(1, sx * 1.15)); c.inp.thr = trig; }
      else { var ax = rd.L[0], ay = rd.L[1], mg = Math.hypot(ax, ay); c.inp.trig = trig; c.inp.abs = mg > 0.25 ? [ax, ay] : [0, 0]; }   // stick-aim: screen up = arena far side (-y), matches the 3/4 camera
      var bp = (B[0] || 0) > 0.5 || (B[5] || 0) > 0.5; if (c.boostType === 'sustain') c.inp.boost = bp; else if (dn(0) || dn(5)) c.inp.boost = true;
    }
  }
  pollPads.pre = {};
  // ---------------------------------------------------------------- v0.4 phone-screen play: touch anywhere = floating joystick, drag distance = throttle (green bar), release = neutral, long fast swipe = boost
  var touchP = null, TJ = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, t0: 0, hist: [], boosted: false, hold: 0 };
  var TOUCHY = Q.get('touch') === '1' || 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  function addTouch() {
    if (touchP) return; touchP = { id: 'touch-' + Date.now().toString(36), name: Q.get('name') || 'You', touch: true, color: freeColor(), type: 'muscle', armour: { front: 'plate', side: 'none', back: 'none' }, boost: 'ram', score: 0, connected: true, ready: true, tot: { dmg: 0, kos: 0, ringouts: 0, crushes: 0, air: 0, wins: 0 } };
    if (game.phase !== 'lobby') touchP.spectator = true; game.players.unshift(touchP); var ai = game.players.filter(function (q) { return q.ai; }); if (ai.length && game.phase === 'lobby') game.players.splice(game.players.indexOf(ai[0]), 1);
    document.body.classList.add('touchplay'); flash('You joined on this screen'); uiKey = '';
  }
  function tjCar() { return touchP && game.sim && game.phase === 'play' ? game.sim.byId(touchP.id) : null; }
  function tjR() { return C.touch.R * Math.min(innerWidth, innerHeight); }
  function onTDown(e) {
    if (!touchP || TJ.on || game.phase === 'lobby' || game.phase === 'over' || (e.target.closest && e.target.closest('button'))) return;
    TJ.on = true; TJ.id = e.pointerId; TJ.ox = TJ.x = e.clientX; TJ.oy = TJ.y = e.clientY; TJ.t0 = performance.now(); TJ.hist = [[TJ.t0, e.clientX, e.clientY]]; TJ.boosted = false; e.preventDefault && e.preventDefault();
  }
  function onTMove(e) { if (!TJ.on || e.pointerId !== TJ.id) return; TJ.x = e.clientX; TJ.y = e.clientY; var now = performance.now(); TJ.hist.push([now, e.clientX, e.clientY]); while (TJ.hist.length > 2 && now - TJ.hist[0][0] > 90) TJ.hist.shift();
    var dist = Math.hypot(TJ.x - TJ.ox, TJ.y - TJ.oy), mn = Math.min(innerWidth, innerHeight), h0 = TJ.hist[0], v = Math.hypot(TJ.x - h0[1], TJ.y - h0[2]) / Math.max(1, now - h0[0]);
    if (!TJ.boosted && ((now - TJ.t0 < C.touch.swipeMs && dist > C.touch.swipeFrac * mn) || (v > C.touch.swipeSpeed && dist > mn * 0.3))) { TJ.boosted = true; TJ.hold = 0.8; var c = tjCar(); if (c) c.inp.boost = true; TJ.flash = 0.5; } }
  function onTUp(e) { if (!TJ.on || e.pointerId !== TJ.id) return; TJ.on = false; var c = tjCar(); if (c) { c.inp.abs = [0, 0]; c.inp.trig = null; } }
  window.addEventListener('pointerdown', onTDown, { passive: false }); window.addEventListener('pointermove', onTMove); window.addEventListener('pointerup', onTUp); window.addEventListener('pointercancel', onTUp);
  function touchTick(dt) {
    var c = tjCar(); if (c && !touchP.aiCover) { if (TJ.on) { var R = tjR(), dx = (TJ.x - TJ.ox) / R, dy = (TJ.y - TJ.oy) / R, m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } c.inp.trig = null; c.inp.abs = m < 0.12 ? [0, 0] : [dx, dy]; }
      if (TJ.hold > 0) { TJ.hold -= dt; if (c.boostType === 'sustain') c.inp.boost = TJ.hold > 0; } }
    var cv = $('tj'); if (!cv) return; if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    var g2 = cv.getContext('2d'); g2.clearRect(0, 0, cv.width, cv.height); if (!touchP || game.phase === 'lobby' || game.phase === 'over') return;
    var R = tjR(), mag = 0;
    if (TJ.on) { var ddx = TJ.x - TJ.ox, ddy = TJ.y - TJ.oy, d = Math.hypot(ddx, ddy); mag = Math.min(1, d / R); var kx = TJ.ox + (d > R ? ddx / d * R : ddx), ky = TJ.oy + (d > R ? ddy / d * R : ddy);
      g2.lineWidth = 3; g2.strokeStyle = 'rgba(255,255,255,.35)'; g2.setLineDash([8, 6]); g2.beginPath(); g2.arc(TJ.ox, TJ.oy, R, 0, 7); g2.stroke(); g2.setLineDash([]);
      g2.fillStyle = 'rgba(255,255,255,.28)'; g2.strokeStyle = 'rgba(255,255,255,.8)'; g2.beginPath(); g2.arc(kx, ky, R * 0.32, 0, 7); g2.fill(); g2.stroke(); }
    // throttle bar graph (green) on the side
    var n = 10, bh = Math.min(innerHeight * 0.42, 260), bx = 14, by = innerHeight * 0.5 + bh / 2, seg = bh / n;
    for (var i = 0; i < n; i++) { var lit = mag * n > i + 0.25; g2.fillStyle = lit ? (i > 7 ? '#c8ff5a' : '#45e07a') : 'rgba(255,255,255,.12)'; g2.fillRect(bx, by - (i + 1) * seg + 2, 16 + i * 1.6, seg - 4); }
    g2.fillStyle = '#fff'; g2.font = '600 13px Fredoka, sans-serif'; g2.fillText('GAS', bx, by + 16);
    if (TJ.flash > 0) { TJ.flash -= dt; g2.fillStyle = 'rgba(255,140,40,' + TJ.flash * 1.6 + ')'; g2.font = '700 ' + Math.round(innerHeight * 0.08) + 'px Fredoka, sans-serif'; g2.textAlign = 'center'; g2.fillText('BOOST!', innerWidth / 2, innerHeight * 0.3); g2.textAlign = 'left'; }
    if (c) { var bb = c.boost || 0; g2.fillStyle = 'rgba(0,0,0,.5)'; g2.fillRect(bx, by + 24, 60, 7); g2.fillStyle = '#ffd23f'; g2.fillRect(bx, by + 24, 60 * bb, 7); }
  }
  function tjButtons() {
    $('tPlay').onclick = function () { addTouch(); };
    $('tCar').onclick = function () { if (!touchP) return; var ct = C.cars.map(function (c) { return c.id; }); touchP.type = ct[(ct.indexOf(touchP.type) + 1) % ct.length]; uiKey = ''; };
    $('tBoost').onclick = function () { if (!touchP) return; touchP.boost = BST[(BST.indexOf(touchP.boost) + 1) % 3]; uiKey = ''; };
    $('tMode').onclick = function () { setMode(game.mode === 'race' ? 'derby' : 'race'); };
    $('tStart').onclick = function () { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); };
    $('tView').onclick = function () { cycleCam(); };
    if (TOUCHY) document.body.classList.add('touchy');
  }
  function controllerUrl(code) { var base = location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html'; return base + '?room=' + code + (LOCAL ? '&local=1' : ''); }
  function qrSvg(text) { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  function setNetUi(st, code, detail) {
    if (st === 'online') { var url = window.ZTP_QR || controllerUrl(code); $('code').textContent = code; $('cqcode').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); $('qr').innerHTML = qrSvg(url); $('cq').innerHTML = qrSvg(url); $('netStatus').textContent = ''; }
    else $('netStatus').textContent = st === 'offline' ? 'Room server offline (' + (detail || '') + ')' : 'Connecting to the room server\u2026';
  }
  window.addEventListener('message', function (e) { var d = e.data; if (e.source !== window.parent || !d || d.ztp !== 'qr' || !d.url) return;
    if (window.ZTP_QR !== d.url) { window.ZTP_QR = d.url; if (net && net.status === 'online') setNetUi('online', net.code); } try { parent.postMessage({ ztp: 'qrok' }, '*'); } catch (x) {} });
  window.addEventListener('keydown', function (e) { if (e.key === 'Enter') { if (game.phase === 'lobby') startMatch(); else if (game.phase === 'over') toLobby(); } if ((e.key === 'b' || e.key === 'B') && game.phase === 'lobby') game.bots = !game.bots; if ((e.key === 'm' || e.key === 'M') && game.phase === 'lobby') setMode(game.mode === 'race' ? 'derby' : 'race'); if (e.key === 'c' || e.key === 'C') cycleCam(); });
  function cycleCam() { var cur = camMode(), i = CAMS.indexOf(cur); game.cam = CAMS[(i + 1) % 3]; flash('View: ' + game.cam); if ($('tView')) $('tView').textContent = 'View: ' + game.cam; }
  var roomQ = (Q.get('room') || Q.get('code') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || null;
  if (LOCAL) net = new window.DDNet.LocalHost({ code: roomQ || 'TEST', onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else if (!NONET) net = new window.DDNet.Host({ code: roomQ, fixedCode: !!roomQ, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  initGL(); setPhase('lobby'); tjButtons(); if (Q.get('play') === '1') addTouch();
  if (Q.get('autostart') === '1') setTimeout(startMatch, 300);
  window.DD.debug = { cut: function (k) { cutTo(game.sim, k); }, dir: DIR, act: ACT, pip: function () { return PIP; }, camHt: function () { return camHt; }, startMatch: startMatch, toLobby: toLobby, game: game, setMode: setMode, addTouch: addTouch, cam: function (m) { game.cam = m; }, touchP: function () { return touchP; } };
  requestAnimationFrame(tick);
})();
