/* DRIFT SIGNAL - the TV: the ship's bridge. Authority for the whole game; phones send intents. */
(function () {
  'use strict';
  var C = window.SPACE_CONFIG, T = window.THREE, SFX = window.SSFX, W = window.SWorld;
  var $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local'), NONET = Q.has('nonet');
  var UA = navigator.userAgent, SLOW = /CrKey|Tizen|Web0S|webOS|SMART-TV|SmartTV|AFT[A-Z]|BRAVIA|Android TV/i.test(UA);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; }, lerp = function (a, b, t) { return a + (b - a) * t; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  document.title = titleCase(C.TITLE) + ' - bridge | Zero to Phi';
  function titleCase(s) { return s.toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  if (Q.has('mute')) SFX.mute(true);

  // ================================================================== renderer + quality
  var Qy = C.quality, rung = Q.has('q') ? clamp(+Q.get('q'), 0, Qy.rungs.length - 1) : SLOW ? 3 : (navigator.hardwareConcurrency || 4) <= 4 ? 2 : 1;
  var FX = Q.has('fx') ? +Q.get('fx') : Qy.rungs[rung].fx;
  var canvas = $('gl'), renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !SLOW && rung <= 1, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shots') });
  renderer.setClearColor(0x02030a);
  var scene = new T.Scene(), camera = new T.PerspectiveCamera(62, 16 / 9, 0.5, 60000);
  scene.add(camera);
  var H = W.build(T, scene, FX), surf = null;
  camera.add(H.streaks); camera.add(H.shield);
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Qy.rungs[rung].scale)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    [$('frame'), $('hud')].forEach(function (c) { c.width = w; c.height = h; });
    frameDirty = true;
  }
  var frameDirty = true; window.addEventListener('resize', resize);

  // ================================================================== ship state
  var ship = {
    pos: new T.Vector3(C.shipStart.x, C.shipStart.y, C.shipStart.z), quat: new T.Quaternion(), speed: 0, warp: 0, course: null, mode: 'idle', eta: 0,
    shields: 100, shieldsUp: true, hull: 100, fuel: 100, power: Object.assign({}, C.power.start), alert: 'none', alertManual: null, view: false, beacon: false,
    loc: 'space', tilt: 0, shake: 0, orbit: null, gear: 0, gearOk: true, deflT: 0
  };
  ship.quat.setFromEuler(new T.Euler(0, 0, 0));
  var settings = loadSettings();
  function loadSettings() {
    var d = { preset: 'default', danger: 'medium', voice: 'occasional', drone: false, wild: true, hue: { min: 10, max: 80, zone: '' } };
    try { var s = JSON.parse(localStorage.getItem('ds-settings') || 'null'); if (s) { d = Object.assign(d, s); d.hue = Object.assign({ min: 10, max: 80, zone: '' }, s.hue || {}); } } catch (e) {}
    if (Q.has('danger')) d.danger = Q.get('danger');
    return d;
  }
  function saveSettings() { try { localStorage.setItem('ds-settings', JSON.stringify(settings)); } catch (e) {} SFX.VOICE.mode = settings.voice; SFX.bed('drone', settings.drone); }
  SFX.VOICE.mode = Q.has('voice') ? Q.get('voice') : settings.voice;
  var defs = {}; C.sector.forEach(function (d) { defs[d.id] = d; });
  var logLines = [], logSeq = 0;
  function log(text, kind) { logLines.push({ n: ++logSeq, t: text, k: kind || '' }); if (logLines.length > 40) logLines.shift(); dirty = true; }
  function say(text, tone, detail) { SFX.say(text, tone, detail); log(text, tone === 'urgent' ? 'urgent' : tone === 'alert' ? 'alert' : 'cpu'); hudNote(text, tone); }
  var notes = [];
  function hudNote(text, tone) { notes.push({ text: text, tone: tone || 'calm', t: 0 }); if (notes.length > 3) notes.shift(); }

  // ================================================================== navigation + AI pilot
  var tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), UP = new T.Vector3(0, 1, 0), ZERO = new T.Vector3();
  function objPos(id, out) { var o = H.objs[id]; return out.copy(o ? o.position : tmpV.set(0, 0, 0)); }
  function standoff(d) { return d.kind === 'nebula' ? d.r * 0.35 : d.kind === 'blackhole' ? d.r * 4.2 : d.kind === 'comet' ? 0 : d.kind === 'signal' ? 120 : d.r * C.nav.arriveGap + 60; }
  function aimPoint(d, out) {   // where the AI flies to (comets: into the tail, to see the shield light show)
    objPos(d.id, out);
    if (d.kind === 'comet') out.addScaledVector(H.objs.comet.userData.tail.dir, 700);
    return out;
  }
  function setCourse(id, w) {
    var d = defs[id]; if (!d || ship.loc !== 'space') return;
    w = clamp(+w || 0, 0, C.maxWarp(ship.power.engines));
    ship.course = { id: id, w: w }; ship.mode = 'align'; ship.orbit = null; land.step = 0; land.site = null;
    var dist = Math.max(0, aimPoint(d, tmpV).distanceTo(ship.pos) - standoff(d));
    SFX.play('course');
    say('Course laid in for ' + d.name + (w > 0 ? ', warp ' + w.toFixed(1) : ', impulse') + '. Estimated ' + C.fmtShipTime(dist / C.speedFor(w) * C.nav.timeScale) + '.', 'calm');
    dirty = true;
  }
  function allStop() { if (ship.course) say('All stop.', 'calm', true); ship.course = null; ship.mode = 'idle'; dirty = true; }
  function avoid(dir, target) {
    // steer around big bodies that sit between us and the target (3D: pushes up/down as well as sideways)
    C.sector.forEach(function (d) {
      if (d.id === target || d.kind === 'signal' || d.kind === 'nebula') return;
      var R = d.kind === 'blackhole' ? d.r * 3.5 : d.kind === 'comet' ? 80 : d.r * 1.6;
      var o = H.objs[d.id].position, rel = tmpV2.copy(o).sub(ship.pos), along = rel.dot(dir);
      if (along < 0 || along > 4000 + R) return;
      var perp = rel.addScaledVector(dir, -along), pd = perp.length();
      if (pd < R) { if (pd < 1) perp.set(0, 1, 0); else perp.multiplyScalar(1 / pd); dir.addScaledVector(perp, -(R - pd) / R * 1.4).normalize(); }
    });
    // and debris: comet nucleus + raider are small, only nudge when close
    return dir;
  }
  function pilot(dt) {
    var c = ship.course, maxW = C.maxWarp(ship.power.engines);
    if (ship.orbit) {   // parked in orbit: drift around the planet
      var od = defs[ship.orbit.id], op = H.objs[od.id].position; ship.orbit.a += dt * 0.012;
      var R = standoff(od); tmpV.set(Math.cos(ship.orbit.a) * R, od.r * 0.25, Math.sin(ship.orbit.a) * R).add(op);
      ship.pos.lerp(tmpV, 1 - Math.exp(-dt * 0.6)); faceToward(tmpV2.copy(op).sub(ship.pos).normalize(), dt, 0.25); ship.speed = 6; return;
    }
    if (!c) { ship.speed = lerp(ship.speed, 0, 1 - Math.exp(-dt * 0.8)); ship.warp = lerp(ship.warp, 0, 1 - Math.exp(-dt * 1.5)); ship.pos.addScaledVector(fwd(tmpV), ship.speed * dt); return; }
    var d = defs[c.id], goal = aimPoint(d, new T.Vector3()), to = goal.clone().sub(ship.pos), dist = to.length(), gap = dist - standoff(d);
    var dir = avoid(to.normalize(), c.id);
    var ang = faceToward(dir, dt, 1);
    var w = Math.min(c.w, maxW), vmax = C.speedFor(w);
    var brake = Math.max(C.nav.impulse * 0.4, gap * 0.9);
    var want = ang > 0.35 ? C.nav.impulse * 0.35 : ang > 0.08 ? Math.min(vmax, C.nav.impulse * 1.2) : vmax;
    want = Math.min(want, brake);
    if (gap < 4) want = 0;
    var k = want > ship.speed ? C.nav.accel * (w > 3 ? 0.5 : 1) : 2.2;
    ship.speed = lerp(ship.speed, want, 1 - Math.exp(-dt * k));
    ship.warp = ship.speed > C.nav.impulse * 1.8 ? Math.max(0, Math.pow(ship.speed / C.nav.warpK, 1 / C.nav.warpExp)) : 0;
    ship.pos.addScaledVector(fwd(tmpV), ship.speed * dt);
    ship.mode = ang > 0.08 && ship.speed < C.nav.impulse ? 'align' : ship.warp > 0.5 ? 'warp' : 'impulse';
    ship.eta = ship.speed > 1 ? gap / Math.max(ship.speed, 1) : gap / Math.max(1, vmax);
    ship.fuel = Math.max(0, ship.fuel - dt * ship.warp * 0.004);
    if (gap < 6 && ship.speed < 8) arrive(d);
  }
  function arrive(d) {
    ship.course = null; ship.mode = 'idle'; ship.speed = 0;
    say('Arrived at ' + d.name + '.', 'calm');
    if (d.kind === 'planet') { ship.orbit = { id: d.id, a: Math.atan2(ship.pos.z - H.objs[d.id].position.z, ship.pos.x - H.objs[d.id].position.x) }; if (d.landable) say('Planet is landable. Helm: match orbit, align the descent corridor, then pick a landing site.', 'calm', true); }
    if (d.kind === 'station') { stationApproach = { id: d.id, t: 0 }; say(d.name + ' approach control: hold position. Docking clearance is coming in a later version.', 'calm', true); }
    dirty = true;
  }
  var stationApproach = null;
  function fwd(out) { return out.set(0, 0, -1).applyQuaternion(ship.quat); }
  function faceToward(dir, dt, rate) {   // slow, smooth turns; returns angle left
    tmpM.lookAt(ZERO, dir, UP); tmpQ.setFromRotationMatrix(tmpM);
    var ang = ship.quat.angleTo(tmpQ); if (ang < 1e-4) return 0;
    var step = Math.min(1, C.nav.turnRate * rate * dt / ang * (0.4 + Math.min(1, ang) * 0.6));
    ship.quat.slerp(tmpQ, step); return ang;
  }

  // ================================================================== hazards: comet tail, black hole, nebula
  var simT = 0, impacts = 0, alertState = 'none', lastAlert = 'none';
  function addImpact(strength) {
    var u = H.shieldU, i = impacts++ % 8, dir = tmpV.set((Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 0.8, -1).normalize();
    u.hits.value[i].set(dir.x, dir.y, dir.z, u.t.value);
    if (ship.shieldsUp && ship.shields > 0) { ship.shields = Math.max(0, ship.shields - strength * (1.4 - ship.power.shields * 0.15)); SFX.play(strength > 2 ? 'shieldHit' : 'impact'); }
    else { ship.hull = Math.max(5, ship.hull - strength * 0.7); ship.shake = Math.max(ship.shake, 0.4); SFX.play('impact'); }
    dirty = true;
  }
  var tailHitAcc = 0, inTail = false, bhZone = 0, bhCool = 0;
  function hazards(dt) {
    var cm = H.objs.comet, td = cm.userData.tail, rel = tmpV.copy(ship.pos).sub(cm.position), along = rel.dot(td.dir);
    var perp = rel.addScaledVector(td.dir, -along).length(), wasIn = inTail;
    inTail = ship.loc === 'space' && along > 40 && along < td.len && perp < td.rad * (0.4 + along / td.len * 1.6);
    if (inTail && !wasIn) say('Entering the comet tail. Debris impacts on the shields.', 'alert');
    if (inTail) { tailHitAcc += dt * (4 - Math.min(3, ship.power.tractor * 0.6)) * (ship.deflT > 0 ? 0.15 : 1); while (tailHitAcc > 1) { tailHitAcc -= 1 + Math.random() * 0.4; addImpact(0.8 + Math.random() * 1.6); } }
    if (storm && storm.t > 0) { storm.t -= dt; storm.acc += dt * 6 * (ship.deflT > 0 ? 0.2 : 1); while (storm.acc > 1) { storm.acc -= 1; addImpact(1 + Math.random() * 2); } if (storm.t <= 0) { say('Storm has passed.', 'calm', true); storm = null; } }
    // black hole: the pull grows as you get closer; the computer burns away on its own once it's red
    var bd = defs.bh, bp = H.objs.bh.position, dist = ship.pos.distanceTo(bp) / bd.r, z = dist < C.blackHole.danger ? 2 : dist < C.blackHole.warn ? 1 : 0;
    if (ship.loc === 'space' && dist < 6.5) {
      var pull = 22 / Math.max(0.6, dist * dist) * 9;
      ship.pos.addScaledVector(tmpV2.copy(bp).sub(ship.pos).normalize(), pull * dt * (ship.course && ship.course.escape ? 0.2 : 1));
      if (z === 2) { ship.shields = Math.max(0, ship.shields - dt * 4); if (ship.shields <= 0) ship.hull = Math.max(8, ship.hull - dt * 2); ship.shake = Math.max(ship.shake, 0.25); }
    }
    if (z !== bhZone) {
      if (z === 1 && bhZone === 0) say('Gravitational shear increasing. We are drifting toward the Quiet Eye.', 'alert');
      if (z === 2) { say('Red alert. Event horizon proximity. Emergency burn.', 'urgent'); SFX.play('alarm'); escapeBurn(); }
      bhZone = z; dirty = true;
    }
    if (ship.deflT > 0) ship.deflT -= dt;
    // shields regen, life support
    if (ship.shieldsUp && !inTail && !(storm && storm.t > 0) && bhZone < 2) ship.shields = Math.min(100, ship.shields + dt * ship.power.shields * 0.6);
    var a = ship.alertManual || (bhZone === 2 || ship.hull < 30 ? 'red' : bhZone === 1 || inTail || ev.active && ev.active.alert || (storm && storm.t > 0) || ship.shields < 25 || ship.power.life < 1 ? 'yellow' : 'none');
    if (a !== alertState) { if (a === 'red') SFX.play('alarm'); else if (a === 'yellow' && alertState === 'none') SFX.play('yellow'); alertState = a; dirty = true; }
  }
  function escapeBurn() {
    var bp = H.objs.bh.position, out = ship.pos.clone().sub(bp).normalize().multiplyScalar(defs.bh.r * 6).add(bp);
    ship.orbit = null; ship.course = { id: '_escape', w: 0, escape: true }; escapePoint = out;
  }
  var escapePoint = null, storm = null;
  defs._escape = { id: '_escape', kind: 'point', name: 'safe distance', r: 0 };
  H.objs._escape = { position: new T.Vector3() };
  var _aim = aimPoint; aimPoint = function (d, out) { if (d.id === '_escape') { out.copy(escapePoint); return out; } return _aim(d, out); };
  var _standoff = standoff; standoff = function (d) { return d.id === '_escape' ? 0 : _standoff(d); };

  // ================================================================== probes + scans
  var probes = [], probeSeq = 0, scans = {};
  function corrupt(s, p) { var G = '\u2592\u2591#%/\\:~'; return s.split('').map(function (c) { return c !== ' ' && Math.random() < p ? G[Math.random() * G.length | 0] : c; }).join(''); }
  function readingsFor(d) {
    var R = C.rng((d.seed || d.id.length * 977) + probeSeq);
    if (d.kind === 'planet') { var rec = W.planetRecipe(d); return [
      'Atmosphere: ' + (rec.gas ? 'hydrogen ' + (80 + R() * 10 | 0) + '%, helium' : 'nitrogen ' + (60 + R() * 20 | 0) + '%, argon trace, oxygen ' + (R() * 22 | 0) + '%'),
      'Surface water: ' + Math.round(rec.water * 100) + '%. Mean temperature ' + (-60 + R() * 90 | 0) + '\u00B0C',
      'Gravity ' + (0.4 + R() * 1.6).toFixed(2) + ' g. Magnetic field ' + (R() < 0.5 ? 'weak, wandering' : 'strong, steady'),
      d.water ? 'Motion on the surface. Large. Slow. Not weather.' : 'Mineral traces: ' + ['iron', 'olivine', 'rare isotopes', 'quartz'][R() * 4 | 0] ];
    }
    if (d.kind === 'blackhole') return ['Accretion disk temperature 4.1 million kelvin', 'Clock drift 1.0004... 1.003... 1.02', 'Tidal stress rising. Hull of the probe stretching', 'Light is arriving from behind me', 'I can see the back of my own antenna', 'Signal frequency dropping. Everything is red', 'Still here. Still falling. Still'];
    if (d.kind === 'nebula') return ['Ionised hydrogen, glowing at 656 nanometres', 'Three protostars inside, still forming', 'Dust density high. Sensors fogging'];
    if (d.kind === 'station') return ['Station transponder: ' + d.name, 'Reactor output nominal' + (d.id === 'home' ? '-ish' : ''), 'Customer satisfaction: ' + (d.reviews || 'n/a')];
    if (d.kind === 'comet') return ['Nucleus: dirty ice and dust, 52 m across', 'Off-gassing 4 tonnes per second', 'Tail particles: mostly sand-sized. Shields will hold'];
    return ['Source located', d.flavour, 'Signal repeating'];
  }
  function launchProbe(id) {
    var d = defs[id]; if (!d || d.kind === 'point') return;
    var p = { n: ++probeSeq, id: id, pos: ship.pos.clone().addScaledVector(fwd(tmpV), 20), speed: 260, t: 0, next: 2.5, lines: readingsFor(d), li: 0, st: 'outbound', spr: new T.Sprite(H.probeMat) };
    p.spr.scale.set(12, 12, 1); scene.add(p.spr); probes.push(p);
    SFX.play('probe'); say('Probe ' + p.n + ' away toward ' + d.name + '.', 'calm', true); log('PROBE ' + p.n + ' launched \u2192 ' + d.name, 'sci');
  }
  function updateProbes(dt) {
    probes.forEach(function (p) {
      if (p.st === 'silent' || p.st === 'holding') { if (p.spr.parent && p.st === 'silent') scene.remove(p.spr); return; }
      var d = defs[p.id], tp = aimPoint(d, tmpV), to = tmpV2.copy(tp).sub(p.pos), dist = to.length();
      p.t += dt;
      var sp = p.speed * (d.kind === 'blackhole' ? 1 + 12 / Math.max(0.5, dist / d.r) : 1);
      if (d.kind === 'blackhole' && dist < d.r * 7) sp = Math.min(sp, dist * 0.08 + 8);   // time dilation: it seems to slow as it falls
      if (dist > (d.kind === 'planet' ? d.r * 1.9 : d.kind === 'blackhole' ? d.r * 1.02 : standoff(d) * 0.5 + 30)) p.pos.addScaledVector(to.normalize(), Math.min(dist, sp * dt));
      else if (d.kind === 'planet' && p.st !== 'captured') { p.st = 'captured'; preading(p, 'Captured by the gravity well. Telemetry fading.'); p.next = 4; }
      else if (d.kind === 'blackhole') { if (p.st !== 'silent') { preading(p, '\u2014 \u2014 \u2014  signal lost'); p.st = 'silent'; SFX.play('static', { d: 0.4, v: 0.2 }); say('Probe ' + p.n + ' has crossed the event horizon. Signal lost.', 'calm'); } return; }
      else if (d.kind !== 'planet' && p.li >= p.lines.length) { p.st = 'holding'; preading(p, 'Holding station. Readings complete.'); return; }
      if (p.st === 'captured') { p.pos.lerp(H.objs[d.id].position, dt * 0.1); }
      p.spr.position.copy(p.pos);
      p.next -= dt;
      if (p.next <= 0) {
        p.next = 2.6;
        if (p.st === 'captured') { p.st = 'silent'; preading(p, 'Probe silent.'); say('Probe ' + p.n + ' has gone silent in the gravity well of ' + d.name + '.', 'calm', true); return; }
        if (p.li < p.lines.length) {
          var line = p.lines[p.li++];
          if (d.kind === 'blackhole') { if (!p.d0) p.d0 = dist; var cp = clamp(Math.pow(clamp(1 - (dist - d.r) / Math.max(1, p.d0 - d.r), 0, 1), 1.6) * 0.95, 0, 0.92); p.noise = cp; line = corrupt(line, cp); SFX.play('static', { d: 0.6 + cp, v: 0.04 + cp * 0.12 }); }
          preading(p, line);
        } else if (d.kind === 'blackhole') preading(p, corrupt('...still...falling...', 0.9));
      }
    });
  }
  function preading(p, text) { p.last = text; log('P' + p.n + ' \u203A ' + text, 'sci'); SFX.play('reading'); hudTicker = { text: 'PROBE ' + p.n + ' \u203A ' + text, t: 5, noise: p.noise || 0 }; dirty = true; }
  var hudTicker = null;
  function scan(id) {
    var d = defs[id]; if (!d) return;
    SFX.play('chirp'); scans[id] = { t: 2.2, d: d };
    setTimeout(function () {
      var dist = H.objs[id].position.distanceTo(ship.pos), lines = [d.name.toUpperCase() + ' \u00B7 ' + Math.round(dist) + ' km', d.flavour];
      if (d.kind === 'planet') { var r = W.planetRecipe(d); lines.push('Seed ' + d.seed + ' \u00B7 water ' + Math.round(r.water * 100) + '% \u00B7 ' + (r.rings ? 'ringed' : 'no rings') + (d.landable ? ' \u00B7 LANDABLE' : '')); }
      if (ship.power.sensors >= 3) lines.push('Deep scan: ' + readingsFor(d)[0]);
      scans[id] = { lines: lines, t: 9 }; lines.forEach(function (l, i) { log((i ? '  ' : 'SCAN \u203A ') + l, 'sci'); });
      say('Scan complete. ' + d.name + '.', 'calm', true);
    }, 1800 - ship.power.sensors * 200);
  }

  // ================================================================== landing on Thalassa (water world)
  var land = { step: 0, site: null, phase: '', t: 0, depth: 2.2 };
  var SITES = [ { id: 'shelf', name: 'Shoreline shelf', u: 0.36, v: 0.44, depth: 2.3, note: 'Shallow. Recommended.' }, { id: 'isle', name: 'Basalt island', u: 0.62, v: 0.58, depth: 3.6, note: 'Rocky, mostly dry' }, { id: 'open', name: 'Open water', u: 0.5, v: 0.3, depth: 1.1, note: 'Deep. Not advised.' } ];
  var topo = (function () {   // a small height grid the phones draw as a topo map (same seed as the planet)
    var nz = (function (seed) { var R = C.rng(seed * 31), P = []; for (var i = 0; i < 4096; i++) P.push(R()); return function (x, y) { var s = 0, a = 0.5, f = 1; for (var o = 0; o < 4; o++) { var xi = Math.floor(x * f), yi = Math.floor(y * f), xf = x * f - xi, yf = y * f - yi; xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); var g = function (i, j) { return P[((i & 63) + ((j & 63) << 6))]; }; var v = lerp(lerp(g(xi, yi), g(xi + 1, yi), xf), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), xf), yf); s += v * a; a *= 0.5; f *= 2; } return s; }; })(4471);
    var g = []; for (var y = 0; y < 20; y++) { var row = []; for (var x = 0; x < 32; x++) row.push(Math.round(clamp((nz(x / 5, y / 5) - 0.5) * 2.4 + 0.1, -1, 1) * 9)); g.push(row); }
    SITES.forEach(function (s) { var gx = Math.round(s.u * 31), gy = Math.round(s.v * 19); g[gy][gx] = s.id === 'isle' ? 4 : s.id === 'shelf' ? 0 : -6; if (s.id === 'isle') { g[gy][gx + 1] = 3; g[gy + 1][gx] = 2; } });
    return g;
  })();
  function orbitStep(step) {
    if (ship.loc !== 'space' || !ship.orbit || !defs[ship.orbit.id].landable) { say('We need to be in orbit of a landable world first.', 'calm'); return; }
    if (step === 'match' && land.step < 1) { land.step = 1; SFX.play('burn'); say('Orbit matched. Holding a stable track.', 'calm'); }
    else if (step === 'align' && land.step === 1) { land.step = 2; SFX.play('burn'); say('Descent corridor aligned. Choose a landing site.', 'calm'); }
    dirty = true;
  }
  function pickSite(id) { if (land.step < 2) return; var s = SITES.find(function (q) { return q.id === id; }) || SITES[0]; land.site = s.id; land.depth = s.depth; land.step = 3; say('Landing site: ' + s.name + '. ' + s.note, 'calm'); dirty = true; }
  function descend() {
    if (land.step < 2) { say('Match orbit and align the corridor first.', 'calm'); return; }
    if (!land.site) pickSite('shelf');
    land.phase = 'entry'; land.t = 0; ship.loc = 'descent'; ship.course = null; ship.speed = 0; ship.orbit = null; ship.view = false; SFX.play('burn');
    say('Beginning descent. Atmospheric entry in ten seconds.', 'alert'); dirty = true;
  }
  function liftoff() {
    if (ship.loc !== 'surface') return; land.phase = 'lift'; land.t = 0; ship.loc = 'ascent'; SFX.play('burn'); say('Lifting off. Retracting gear.', 'alert'); dirty = true;
  }
  var ATMO = [ [0.0, 'rgba(255,140,60,0)'], [0.2, 'rgba(255,120,50,.55)'], [0.45, 'rgba(255,190,120,.6)'], [0.65, 'rgba(90,190,200,.7)'], [0.85, 'rgba(160,175,180,.95)'], [1, 'rgba(110,128,134,0)'] ];
  function atmoColor(k) { for (var i = 1; i < ATMO.length; i++) if (k <= ATMO[i][0]) return ATMO[i][1]; return ATMO[ATMO.length - 1][1]; }
  var surfCam = { y: 420, x: 0, z: 120, roll: 0, pitch: -0.25, yaw: 0 };
  function updateLanding(dt) {
    land.t += dt; var t = land.t, ov = $('atmo');
    if (land.phase === 'entry') {   // 0-7 s: dive at the planet in space; 7-12 s: coloured atmosphere layers
      var pl = H.objs.thal.position, R = defs.thal.r;
      if (t < 7) { var dir = tmpV.copy(pl).sub(ship.pos).normalize(); faceToward(dir, dt, 3); ship.pos.addScaledVector(dir, Math.max(0, ship.pos.distanceTo(pl) - R * 1.02) * dt * 0.45); ship.shake = Math.max(ship.shake, t / 7 * 0.3); }
      var k = clamp((t - 4) / 9, 0, 1); ov.style.background = 'linear-gradient(180deg,' + atmoColor(k) + ',' + atmoColor(Math.min(1, k + 0.15)) + ')'; ov.style.opacity = k > 0.97 ? (1 - (k - 0.97) * 30) : 1;
      if (t > 7.5 && !surf) surf = W.buildSurface(T, FX);
      if (t > 9) { ship.loc = 'descentSurf'; land.phase = 'descend'; land.t = 0; surfCam.y = 420; surfCam.z = 220; }
      return;
    }
    if (land.phase === 'descend') {   // 0-16 s: drop through the cloud deck to the water
      var k2 = clamp(t / 4, 0, 1); ov.style.background = 'linear-gradient(180deg,rgba(150,165,170,' + (0.95 * (1 - k2)).toFixed(2) + '),rgba(110,128,134,' + (0.8 * (1 - k2)).toFixed(2) + '))';
      var e = clamp(t / 16, 0, 1), ease = 1 - Math.pow(1 - e, 2.4);
      surfCam.y = lerp(420, 7, ease); surfCam.z = lerp(220, 0, ease); surfCam.pitch = lerp(-0.35, 0.02, ease); ship.shake = Math.max(ship.shake, 0.12 * (1 - e));
      if (surfCam.y < 130 && !land.gearCalled) { land.gearCalled = true; land.gearT = 0; SFX.play('gear'); say(ship.gearOk ? 'Landing gear down.' : 'Landing gear failure.', 'calm'); }
      ship.speed = 0; if (t >= 16) { land.phase = 'touch'; land.t = 0; SFX.play('thud'); ship.shake = 0.35; say('Contact. Soft landing.', 'calm', true); }
      return;
    }
    if (land.phase === 'touch') {   // soft... then it settles, jarringly, half in the water and a bit crooked
      if (t > 1.6 && !land.settled) { land.settled = true; SFX.play('thud'); SFX.play('splash'); ship.shake = 0.9; say('The ground gave way. We are listing five degrees. Water at the lower hull.', 'alert'); }
      if (land.settled) { var s = clamp((t - 1.6) / 0.9, 0, 1), b = 1 - Math.pow(1 - s, 3); surfCam.y = lerp(7, land.depth, b) + Math.sin(s * 9) * (1 - s) * 0.6; ship.tilt = lerp(0, 5.5, b) + Math.sin(s * 11) * (1 - s) * 2; surfCam.pitch = lerp(0.02, -0.03, b); }
      if (t > 3.2) { land.phase = 'landed'; land.t = 0; ship.loc = 'surface'; aliensT = 6; glassT = Q.has('glass') ? 4 : 28; dirty = true; }
      return;
    }
    if (land.phase === 'lift') {
      var l = clamp(t / 14, 0, 1); ship.tilt = lerp(ship.tilt, 0, dt * 2); surfCam.y = lerp(land.depth, 500, l * l); surfCam.pitch = lerp(0, 0.5, clamp(t / 3, 0, 1)) - l * 0.2; ship.shake = 0.2 * (1 - l);
      if (t > 1 && !land.gearUp) { land.gearUp = true; SFX.play('gear'); land.gearT = 0; }
      if (t > 9) { var k3 = clamp((t - 9) / 5, 0, 1); ov.style.background = 'linear-gradient(180deg,' + atmoColor(1 - k3) + ',' + atmoColor(Math.max(0, 0.85 - k3)) + ')'; ov.style.opacity = 1; }
      if (t > 14) { ship.loc = 'space'; land.phase = ''; ov.style.opacity = 0; land = { step: 0, site: null, phase: '', t: 0, depth: 2.2 }; ship.tilt = 0;
        var pl2 = H.objs.thal.position; ship.orbit = { id: 'thal', a: 0.3 }; ship.pos.set(pl2.x + Math.cos(0.3) * standoff(defs.thal), pl2.y + defs.thal.r * 0.25, pl2.z + Math.sin(0.3) * standoff(defs.thal));
        say('Orbit regained. Thalassa below.', 'calm'); dirty = true; }
    }
  }
  var aliensT = 0, glassT = 0, landedT = 0;
  function updateSurface(dt) {
    var S = surf;
    S.userData.waterU.t.value += dt; landedT += dt;
    if (ship.loc !== 'surface') return;
    // distant watchers: rise, stare for a long time, sink
    S.userData.aliens.forEach(function (a) {
      var u = a.userData; u.t += dt;
      if (u.state === 'under' && u.t > 0) { u.state = 'rise'; u.t = 0; u.dur = 15 + Math.random() * 15; a.position.x = u.home.x + (Math.random() - 0.5) * 120; if (Math.random() < 0.5) SFX.play('creature'); }
      if (u.state === 'rise') { a.position.y = lerp(-26, -2.5, clamp(u.t / 5, 0, 1)); if (u.t > 5) { u.state = 'stare'; u.t = 0; } }
      if (u.state === 'stare') { a.position.y = -2.5 + Math.sin(u.t * 0.7) * 0.25; a.rotation.z = Math.sin(u.t * 0.3) * 0.03; if (u.t > u.dur) { u.state = 'sink'; u.t = 0; } }
      if (u.state === 'sink') { a.position.y = lerp(-2.5, -30, clamp(u.t / 4, 0, 1)); if (u.t > 4) { u.state = 'under'; u.t = -(12 + Math.random() * 30); } }
      a.lookAt(camera.position.x, a.position.y, camera.position.z);
    });
    // the one at the glass
    var n = S.userData.nearAlien, nu = n.userData; glassT -= dt;
    if (nu.state === 'under' && glassT <= 0) { nu.state = 'rise'; nu.t = 0; SFX.play('creature'); }
    if (nu.state !== 'under') {
      nu.t += dt; var base = camera.position;
      var rise = nu.state === 'rise' ? clamp(nu.t / 3.5, 0, 1) : nu.state === 'sink' ? 1 - clamp(nu.t / 3, 0, 1) : 1;
      n.position.set(base.x + 1.2, base.y - 16.4 + rise * 2.6 + Math.sin(simT * 0.8) * 0.08, base.z - 7.2); n.lookAt(base.x, n.position.y, base.z);
      if (nu.state === 'rise' && nu.t > 3.5) { nu.state = 'stare'; nu.t = 0; say('Lifeform at the forward glass.', 'calm', true); }
      if (nu.state === 'stare' && nu.t > 9) { nu.state = 'sink'; nu.t = 0; }
      if (nu.state === 'sink' && nu.t > 3) { nu.state = 'under'; glassT = 45 + Math.random() * 30; }
    }
    $('breath').style.opacity = nu.state === 'stare' ? (0.25 + Math.sin(simT * 1.3) * 0.15).toFixed(2) : 0;
  }

  // ================================================================== random events (data-driven: C.events) + encounters
  var ev = { active: null, cool: 25 };
  function pickEvent(forceId) {
    if (forceId) return C.events.find(function (e) { return e.id === forceId; });
    var wild = settings.preset === 'default' && settings.wild && Math.random() < C.wildChance;
    var pool = C.events.filter(function (e) { return !!e.wild === wild; }), tot = pool.reduce(function (s, e) { return s + e.weight; }, 0), r = Math.random() * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) return pool[i]; } return pool[0];
  }
  function startEvent(e) {
    if (!e || ev.active || ship.loc !== 'space') return false;
    var A = ev.active = { def: e, t: 0, alert: e.tone !== 'calm' };
    say(e.say, e.tone);
    var ahead = fwd(new T.Vector3());
    if (e.kind === 'storm') { storm = { t: 18, acc: 0 }; ev.active = null; ev.cool = 40; return true; }
    if (e.kind === 'raider') { H.raider.visible = true; A.a = 0; A.dur = 45; SFX.play('raider'); setTimeout(function () { startEncounter('raider'); }, 6000); }
    if (e.kind === 'envoy' || e.kind === 'alien') { A.ship = makeEnvoy(); A.ship.position.copy(ship.pos).addScaledVector(ahead, 900).add(new T.Vector3(200, 80, 0)); scene.add(A.ship); A.dur = 70; setTimeout(function () { startEncounter('envoy'); }, 3500); }
    if (e.kind === 'distress') { A.ship = H.objs.drifter.clone(); A.ship.scale.setScalar(0.7); A.ship.position.copy(ship.pos).addScaledVector(ahead, 520).add(new T.Vector3(-90, -30, 0)); scene.add(A.ship); A.dur = 75; A.tow = 0; log('COMMS \u203A Distress: "Our engines are dead and the current is pulling us apart!"', 'com'); }
    if (e.kind === 'colossus') { A.ship = W.makeColossus(T, H.glow); A.ship.position.copy(ship.pos).addScaledVector(ahead, 3900).add(new T.Vector3(0, 250, 0)); A.ship.lookAt(ship.pos); A.ship.scale.setScalar(0.01); scene.add(A.ship); A.dur = 50; SFX.play('raider'); allStop(); }
    dirty = true; return true;
  }
  function makeEnvoy() {
    var g = new T.Group(), m = new T.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x16303a });
    var core = new T.Mesh(new T.OctahedronGeometry(30, 0), m); core.scale.set(1, 0.4, 2.4); g.add(core);
    for (var i = 0; i < 3; i++) { var r = new T.Mesh(new T.TorusGeometry(46 + i * 10, 1.2, 4, 40), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6, blending: T.AdditiveBlending })); r.rotation.y = i * 1.05; g.add(r); }
    var gl = new T.Sprite(new T.SpriteMaterial({ map: H.glow, color: 0x9fe8ff, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.set(220, 220, 1); g.add(gl);
    return g;
  }
  function endEvent() { var A = ev.active; if (!A) return; if (A.ship && A.ship !== H.raider) scene.remove(A.ship); H.raider.visible = false; ev.active = null; ev.cool = 45; if (enc && !enc.done) enc.done = true; dirty = true; }
  function updateEvents(dt) {
    ev.cool -= dt;
    var rate = C.danger[settings.danger] || 0;
    if (!ev.active && ev.cool <= 0 && ship.loc === 'space' && Math.random() < rate * dt) startEvent(pickEvent());
    var A = ev.active; if (!A) return; A.t += dt;
    var ahead = fwd(tmpV);
    if (A.def.kind === 'raider') {   // no combat: it just circles, matches you and shows off
      A.a += dt * 0.22; var rr = 260 + Math.sin(A.t * 0.3) * 80;
      var right = tmpV2.set(1, 0, 0).applyQuaternion(ship.quat);
      H.raider.position.copy(ship.pos).addScaledVector(ahead, Math.cos(A.a) * rr + 200).addScaledVector(right, Math.sin(A.a) * rr).add(new T.Vector3(0, Math.sin(A.t * 0.4) * 60, 0));
      H.raider.lookAt(ship.pos); if (A.t > A.dur) { say('The raider has broken off. For now.', 'calm'); endEvent(); }
    } else if (A.def.kind === 'envoy' || A.def.kind === 'alien') {
      A.ship.rotation.y += dt * 0.3; A.ship.children.forEach(function (c, i) { if (i) c.rotation.x += dt * (0.3 + i * 0.2); });
      if (enc && enc.left) A.ship.position.addScaledVector(tmpV2.set(0, 0.2, -1).applyQuaternion(ship.quat), dt * (A.t * 30));
      if (A.t > A.dur) endEvent();
    } else if (A.def.kind === 'distress') {
      A.ship.rotation.z += dt * 0.4 * (1 - A.tow); A.ship.rotation.x += dt * 0.25 * (1 - A.tow);
      if (A.towing) { A.tow = Math.min(1, A.tow + dt / 8); A.ship.position.lerp(tmpV2.copy(ship.pos).addScaledVector(ahead, 260), dt * 0.25); beam(A.ship.position); if (A.tow >= 1 && !A.outcome) distressOutcome(A); }
      if (A.t > A.dur) { if (!A.outcome) say('The distress signal has faded.', 'calm'); endEvent(); }
    } else if (A.def.kind === 'colossus') {   // a colossal ship slips out of another dimension in front of you
      var k = A.t, sc = k < 8 ? 0.01 : Math.min(1, (k - 8) / 6); A.ship.scale.setScalar(Math.max(0.01, sc));
      A.ship.userData.rift.material.opacity = 0.55 * (k < 8 ? k / 8 : Math.max(0, 1 - (k - 14) / 6));
      A.ship.position.addScaledVector(tmpV2.set(1, 0, 0).applyQuaternion(A.ship.quaternion), dt * 70);
      ship.shake = Math.max(ship.shake, k > 6 && k < 16 ? 0.25 : 0); if (k > 9 && k < 30 && Math.random() < dt * 2) addImpact(0.5);
      if (k > 12 && !A.said) { A.said = true; say('Mass estimate... forty kilometres. It is not acknowledging us. I do not think it can see us.', 'alert'); }
      if (k > 34 && !A.leaving) { A.leaving = true; say('It is folding back out of our dimension.', 'calm'); }
      if (A.leaving) { A.ship.userData.rift.material.opacity = Math.min(0.5, (k - 34) / 6); A.ship.scale.setScalar(Math.max(0.01, 1 - (k - 38) / 6)); }
      if (A.t > A.dur) endEvent();
    }
  }
  var beamLine = null;
  function beam(to) {
    if (!beamLine) { beamLine = new T.Mesh(new T.CylinderGeometry(1.5, 5, 1, 8, 1, true), new T.MeshBasicMaterial({ color: 0x3fbf90, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false })); scene.add(beamLine); }
    var from = tmpV2.copy(ship.pos).add(new T.Vector3(0, -10, -40).applyQuaternion(ship.quat)), mid = from.clone().add(to).multiplyScalar(0.5), len = from.distanceTo(to);
    beamLine.position.copy(mid); beamLine.scale.set(1, len, 1); beamLine.lookAt(to); beamLine.rotateX(Math.PI / 2); beamLine.visible = true; beamLine.userData.t = 0.2;
  }
  function tow(by) {
    var A = ev.active; if (!A || A.def.kind !== 'distress' || A.towing) return;
    if (ship.power.tractor < 1) { say('Tractor beam has no power. Engineering, route power to the tractor.', 'alert'); return; }
    A.towing = true; SFX.play('deflector'); say('Tractor beam locked. Towing them clear.', 'calm');
  }
  function distressOutcome(A) {
    var pool = C.distressOutcomes, tot = pool.reduce(function (s, o) { return s + o.weight; }, 0), r = Math.random() * tot, o = pool[0];
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { o = pool[i]; break; } }
    if (Q.get('outcome')) o = pool.find(function (x) { return x.id === Q.get('outcome'); }) || o;
    A.outcome = o.id; if (o.id === 'steal') { ship.fuel = Math.max(0, ship.fuel - 15); ship.shake = 0.5; }
    say(o.text, o.id === 'steal' ? 'alert' : 'calm'); A.dur = A.t + 12;
  }
  // ---- alien conversations: shallow trees, translated text with per-species style; crew phones answer
  var enc = null;
  function startEncounter(id) {
    var d = C.encounters[id]; if (!d) return;
    enc = { id: id, d: d, sp: C.species[d.species], text: d.open, t: 0, wait: d.wait, phase: 'ask' };
    SFX.play('chirp'); log((enc.sp.name) + ' \u203A ' + d.open, 'alien'); dirty = true;
  }
  function answer(member, optId) {
    if (!enc || enc.phase !== 'ask') return;
    var o = enc.d.options.find(function (x) { return x.id === optId; }); if (!o) return;
    enc.phase = 'reply'; enc.t = 0; bubble(member.name, o.label); log(member.name + ' said: ' + o.label, 'crew');
    setTimeout(function () {
      if (!enc) return; enc.text = o.reply; enc.t = 0; enc.phase = 'done'; enc.mood = o.mood; log(enc.sp.name + ' \u203A ' + o.reply, 'alien'); SFX.play('chirp');
      if (o.mood === 'gift') { log('CARGO \u203A Received: ' + (enc.id === 'envoy' ? 'a star chart of calm currents' : 'nothing, but they left'), 'com'); }
      if (o.mood === 'hostile') { addImpact(3); addImpact(2); ship.shake = 0.5; }
      if (o.mood !== 'neutral' && ev.active) { enc.left = true; ev.active.dur = Math.min(ev.active.dur, ev.active.t + 14); }
      dirty = true;
    }, 2800);
    dirty = true;
  }
  function updateEncounter(dt) {
    if (!enc) return; enc.t += dt;
    if (enc.phase === 'ask' && enc.t > enc.wait) { enc.phase = 'done'; enc.text = enc.d.ignore; enc.t = 0; log(enc.sp.name + ' \u203A ' + enc.d.ignore, 'alien'); enc.left = true; if (ev.active) ev.active.dur = Math.min(ev.active.dur, ev.active.t + 12); dirty = true; }
    if (enc.phase === 'done' && enc.t > 12) { enc = null; dirty = true; }
  }
  function translated(e) {   // the computer 'translating': smooth / clicks / struggling
    var full = e.text, k = clamp(e.t * 28 / full.length, 0, 1), n = Math.floor(full.length * k), s = full.slice(0, n), st = e.sp.style;
    if (st === 'clicks') s = s.replace(/ /g, function () { return Math.random() < 0.08 ? ' tk ' : ' '; });
    if (st === 'struggle' || (st === 'clicks' && k < 1)) s = corrupt(s, st === 'struggle' ? clamp(0.6 - e.t * 0.12, 0, 0.6) : 0.05);
    if (k < 1) s += (Math.random() < 0.5 ? '\u2588' : '');
    return s;
  }
  var bubbles = [];
  function bubble(name, text) { var d = document.createElement('div'); d.className = 'bubble'; d.innerHTML = '<b>' + esc(name) + ' said:</b> ' + esc(text); $('bubbles').appendChild(d); SFX.play('blip'); setTimeout(function () { d.remove(); }, 7000); }

  // ================================================================== crew + stations + networking
  var crew = [], asg = {}, net = null, dirty = true;
  var ORDER = ['helm', 'sci', 'tac', 'eng', 'com'];
  var ACT_STATION = { course: 'helm', stop: 'helm', warp: 'helm', view: 'helm', orbit: 'helm', site: 'helm', descend: 'helm', liftoff: 'helm', scan: 'sci', probe: 'sci', shields: 'tac', deflector: 'tac', alert: 'tac', power: 'eng', beacon: 'com', hail: 'com', tow: 'com' };
  var LABEL = { course: 'Set course', stop: 'All stop', warp: 'Change warp', view: 'View screen', orbit: 'Orbit step', site: 'Landing site', descend: 'Begin descent', liftoff: 'Lift off', scan: 'Scan', probe: 'Launch probe', shields: 'Shields', deflector: 'Deflector pulse', alert: 'Alert level', power: 'Reroute power', beacon: 'Distress beacon', hail: 'Hail', tow: 'Tractor tow' };
  function member(cid) { return crew.find(function (m) { return m.cid === cid; }); }
  function active() { return crew.filter(function (m) { return m.connected && m.onBridge; }); }
  function rebalance() {
    var act = active(), cap = member(asg.cap);
    if (!cap || !cap.connected || !cap.onBridge) { cap = act[0] || null; asg.cap = cap ? cap.cid : null; }
    C.stations.forEach(function (s) { var m = member(asg[s.id]); if (!m || !m.connected || !m.onBridge) asg[s.id] = asg.cap; });
    // anyone on the bridge without a station gets the next one the captain is still holding
    act.forEach(function (m) {
      if (m.cid === asg.cap) return;
      var has = ORDER.some(function (id) { return asg[id] === m.cid; });
      if (!has) { var free = ORDER.find(function (id) { return asg[id] === asg.cap; }); if (free) { asg[free] = m.cid; log(m.name + ' takes ' + C.stations.find(function (s) { return s.id === free; }).label + '.', 'crew'); } }
    });
    dirty = true;
  }
  function onMessage(conn, m) {
    if (!m || !m.t) return;
    var me = crew.find(function (q) { return q.conn === conn; });
    if (m.t === 'hello') {
      me = member(m.clientId); var isNew = !me;
      if (!me) {
        if (crew.filter(function (q) { return q.connected; }).length >= C.maxCrew) { net.send(conn, { t: 'reject', reason: 'The bridge is full (' + C.maxCrew + ' crew). Watch the big screen!' }); return; }
        me = { cid: m.clientId, name: String(m.name || 'Crew').slice(0, 14), onBridge: true }; crew.push(me);
      }
      var first = isNew && crew.filter(function (q) { return q.connected; }).length === 0 && !asg.cap;
      me.conn = conn; me.connected = true; me.seen = performance.now(); if (m.name) me.name = String(m.name).slice(0, 14);
      // welcome FIRST: nothing cosmetic (sound, voice, log) may stand between a phone and its welcome
      net.send(conn, { t: 'welcome', cid: me.cid, sector: C.sector.map(function (d) { return { id: d.id, kind: d.kind, cat: d.cat, name: d.name, x: d.x, y: d.y, z: d.z, r: d.r, flavour: d.flavour, landable: !!d.landable, reviews: d.reviews }; }), topo: topo, sites: SITES });
      try { rebalance(); sendState(true); } catch (e) { if (window.console) console.error(e); }
      if (isNew) try { SFX.play('join'); log(me.name + ' came aboard.', 'crew'); if (first) say('Welcome aboard, Captain ' + me.name + '.', 'calm'); else say(me.name + ' is on the bridge.', 'calm', true); } catch (e) {}
      return;
    }
    if (!me) return;
    me.connected = true; me.seen = performance.now();
    switch (m.t) {
      case 'ping': return;
      case 'bridge': me.onBridge = !!m.on; log(me.name + (m.on ? ' is back on the bridge.' : ' stepped off the bridge.'), 'crew'); SFX.play(m.on ? 'join' : 'leave'); rebalance(); break;
      case 'assign': if (asg.cap === me.cid && C.stations.some(function (s) { return s.id === m.station; }) && member(m.to) && member(m.to).connected) {
        var tgt = member(m.to);
        if (m.station === 'cap') { var old = asg.cap; C.stations.forEach(function (s) { if (asg[s.id] === old) asg[s.id] = tgt.cid; else if (asg[s.id] === tgt.cid) asg[s.id] = old; }); asg.cap = tgt.cid; say(tgt.name + ' has the conn. Captain on deck.', 'calm'); }
        else { asg[m.station] = tgt.cid; log(tgt.name + ' assigned to ' + C.stations.find(function (s) { return s.id === m.station; }).label + '.', 'crew'); SFX.play('chirp'); }
        dirty = true; } break;
      case 'act': act(me, m); break;
      case 'answer': answer(me, m.opt); break;
      case 'set': if (asg.cap === me.cid) setSetting(m.k, m.v); break;
      case 'preset': if (asg.cap === me.cid) { settings = Object.assign(settings, C.presets.default, { preset: 'default' }); saveSettings(); say('Default mode restored.', 'calm', true); dirty = true; } break;
    }
  }
  function setSetting(k, v) {
    if (k === 'hue') { settings.hue = { min: clamp(Math.round(+v.min || 2), 2, 100), max: clamp(Math.round(+v.max || 100), 2, 100), zone: String(v.zone || '').slice(0, 40) }; if (settings.hue.max < settings.hue.min) settings.hue.max = settings.hue.min; }
    else if (k === 'danger' && C.danger[v] != null) settings.danger = v;
    else if (k === 'voice' && /^(off|occasional|detailed)$/.test(v)) settings.voice = v;
    else if (k === 'drone') settings.drone = !!v;
    else if (k === 'wild') settings.wild = !!v;
    else return;
    if (k !== 'hue') { var D = C.presets.default; settings.preset = settings.danger === D.danger && settings.voice === D.voice && settings.drone === D.drone && settings.wild === D.wild ? 'default' : 'custom'; }
    saveSettings(); SFX.play('blip'); dirty = true;
  }
  function act(me, m) {
    var st = ACT_STATION[m.a]; if (!st) return;
    var owner = member(asg[st]);
    if (asg[st] !== me.cid) {
      if (asg.cap !== me.cid) return;
      if (owner && owner.connected && owner.cid !== me.cid && !m.override) {   // captain taps a crew member's station: it becomes a request on their phone
        net.send(owner.conn, { t: 'prompt', from: me.name, a: m, label: (LABEL[m.a] || m.a) + (m.id && defs[m.id] ? ': ' + defs[m.id].name : m.label ? ': ' + m.label : '') });
        hudNote('Captain \u2192 ' + C.stations.find(function (s) { return s.id === st; }).label + ': ' + (LABEL[m.a] || m.a), 'calm'); log('Captain requests ' + (LABEL[m.a] || m.a) + ' from ' + owner.name, 'crew'); SFX.play('chirp'); dirty = true; return;
      }
    }
    switch (m.a) {
      case 'course': setCourse(m.id, m.w); break;
      case 'stop': allStop(); break;
      case 'warp': if (ship.course) { ship.course.w = clamp(+m.w || 0, 0, C.maxWarp(ship.power.engines)); dirty = true; } break;
      case 'view': ship.view = !!m.on; SFX.play('blip'); say(ship.view ? 'View screen.' : 'Window.', 'calm', true); break;
      case 'orbit': orbitStep(m.step); break;
      case 'site': pickSite(m.id); break;
      case 'descend': descend(); break;
      case 'liftoff': liftoff(); break;
      case 'scan': scan(m.id); break;
      case 'probe': launchProbe(m.id); break;
      case 'shields': ship.shieldsUp = !!m.on; SFX.play('deflector'); say(ship.shieldsUp ? 'Shields up.' : 'Shields down.', 'calm'); break;
      case 'deflector': if (ship.shields >= 10) { ship.shields -= 10; ship.deflT = 20; SFX.play('deflector'); for (var i = 0; i < 5; i++) addImpact(0.01); say('Deflector pulse. Debris pushed clear.', 'calm', true); } break;
      case 'alert': ship.alertManual = m.level === 'auto' ? null : m.level; say(m.level === 'red' ? 'Red alert.' : m.level === 'yellow' ? 'Yellow alert.' : 'Standing down.', m.level === 'red' ? 'urgent' : 'calm'); break;
      case 'power': var p = ship.power;
        if (p[m.from] != null && p[m.to] != null && m.from !== m.to && p[m.from] > 0 && p[m.to] < C.power.max) { p[m.from]--; p[m.to]++; SFX.play('tap');
          if (p.life < 1) say('Life support at minimum. Crew comfort... declining.', 'alert');
          if (ship.course && ship.course.w > C.maxWarp(p.engines)) { ship.course.w = C.maxWarp(p.engines); say('Engine power reduced. Maximum warp ' + ship.course.w.toFixed(1) + '.', 'calm'); } }
        break;
      case 'beacon': ship.beacon = !!m.on; say(ship.beacon ? 'Distress beacon active on all frequencies.' : 'Beacon off.', 'alert'); break;
      case 'hail': if (enc) break; if (ev.active && ev.active.def.kind === 'raider') startEncounter('raider'); else if (ev.active && /envoy|alien/.test(ev.active.def.kind)) startEncounter('envoy'); else say('Hailing frequencies open. Nobody is answering. Which is honestly relaxing.', 'calm'); break;
      case 'tow': tow(me); break;
    }
    dirty = true;
  }
  function onClose(conn) { crew.forEach(function (m) { if (m.conn === conn) { m.connected = false; m.lostAt = performance.now(); } }); dirty = true; }
  setInterval(function () {   // grace period: stations go back to the captain 15 s after a phone drops
    var ch = false; crew = crew.filter(function (m) { if (!m.connected && performance.now() - (m.lostAt || 0) > 15000) { log(m.name + ' left the ship.', 'crew'); SFX.play('leave'); ch = true; return false; } return true; });
    if (ch || crew.some(function (m) { return !m.connected; })) rebalance();
  }, 2000);
  var lastSend = 0;
  function sendState(force) {
    var now = performance.now(); if (!net || (!force && now - lastSend < (dirty ? 120 : 400))) return; lastSend = now; dirty = false;
    var c = ship.course, gap = c && defs[c.id] ? Math.max(0, aimPoint(defs[c.id], tmpV).distanceTo(ship.pos) - standoff(defs[c.id])) : 0;
    var e = new T.Euler().setFromQuaternion(ship.quat, 'YXZ');
    var base = { t: 'st', ship: { x: Math.round(ship.pos.x), y: Math.round(ship.pos.y), z: Math.round(ship.pos.z), h: +e.y.toFixed(2), w: +ship.warp.toFixed(1), sp: Math.round(ship.speed), mode: ship.mode, course: c ? { id: c.id, w: c.w } : null,
        eta: c ? Math.round(ship.eta) : 0, etaShip: c ? C.fmtShipTime(ship.eta * C.nav.timeScale) : '', gap: Math.round(gap), sh: Math.round(ship.shields), shUp: ship.shieldsUp, hu: Math.round(ship.hull), fu: Math.round(ship.fuel), pw: ship.power, maxW: C.maxWarp(ship.power.engines),
        alert: alertState, view: ship.view, beacon: ship.beacon, loc: ship.loc, orbit: ship.orbit && ship.orbit.id, defl: ship.deflT > 0 },
      crew: crew.map(function (m) { return { cid: m.cid, name: m.name, on: m.onBridge, conn: !!m.connected }; }), asg: asg,
      probes: probes.slice(-6).map(function (p) { return { n: p.n, id: p.id, st: p.st, last: p.last || '' }; }), log: logLines.slice(-14),
      land: { step: land.step, site: land.site, phase: land.phase }, set: settings,
      ev: ev.active ? { kind: ev.active.def.kind, towing: !!ev.active.towing, outcome: ev.active.outcome || null } : null,
      enc: enc ? { id: enc.id, phase: enc.phase, sp: enc.sp.name, text: enc.phase === 'ask' ? enc.d.open : enc.text, opts: enc.phase === 'ask' ? enc.d.options.map(function (o) { return { id: o.id, label: o.label }; }) : [], left: Math.max(0, Math.round(enc.wait - enc.t)) } : null };
    crew.forEach(function (m) { if (m.connected && m.conn) net.send(m.conn, base); });
  }
  function startNet() {
    if (NONET) return;
    var code = (Q.get('room') || '').toUpperCase().slice(0, 4) || undefined;
    var opts = { code: code, fixedCode: !!code, onMessage: onMessage, onClose: onClose, onStatus: function (st, cd) {
      roomCode = cd || net.code; netStatus = st;
      joinUrl = (location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html') + '?room=' + roomCode + (LOCAL ? '&local=1' : '');
      makeQr(joinUrl); frameDirty = true;
    } };
    net = LOCAL ? new window.LRNet.LocalHost(opts) : new window.LRNet.Host(opts);
  }
  var roomCode = '----', netStatus = 'connecting', joinUrl = '', qrM = null;
  function makeQr(text) { try { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); qrM = q; } catch (e) { qrM = null; } }

  // ================================================================== the bulkhead (drawn once) + the holographic HUD (every frame)
  var fctx = $('frame').getContext('2d'), hctx = $('hud').getContext('2d');
  function winRect(w, h) { return { x0: w * 0.04, x1: w * 0.96, y0: h * 0.055, y1: h * 0.76, ch: h * 0.07 }; }
  function winPath(g, r) { g.beginPath(); g.moveTo(r.x0 + r.ch, r.y0); g.lineTo(r.x1 - r.ch, r.y0); g.lineTo(r.x1, r.y0 + r.ch); g.lineTo(r.x1, r.y1 - r.ch * 0.6); g.lineTo(r.x1 - r.ch * 2.2, r.y1); g.lineTo(r.x0 + r.ch * 2.2, r.y1); g.lineTo(r.x0, r.y1 - r.ch * 0.6); g.lineTo(r.x0, r.y0 + r.ch); g.closePath(); }
  function drawFrame() {
    frameDirty = false; var c = $('frame'), w = c.width, h = c.height, g = fctx, r = winRect(w, h); g.clearRect(0, 0, w, h);
    var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b212b'); gr.addColorStop(0.5, '#10141b'); gr.addColorStop(0.78, '#1d2430'); gr.addColorStop(1, '#0a0d12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1; for (var y = h * 0.8; y < h; y += h * 0.045) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // struts: two slim diagonal ribs at the top corners make it read as a physical canopy
    g.fillStyle = '#151a22'; [[r.x0 + r.ch, r.x0 + w * 0.2], [r.x1 - r.ch, r.x1 - w * 0.2]].forEach(function (s) { g.beginPath(); g.moveTo(s[0] - 6, r.y0); g.lineTo(s[0] + 6, r.y0); g.lineTo(s[1] + 4, 0); g.lineTo(s[1] - 4, 0); g.fill(); });
    g.save(); g.globalCompositeOperation = 'destination-out'; winPath(g, r); g.fill(); g.restore();
    // rim: bevel + a soft cyan light strip just inside the glass
    winPath(g, r); g.lineWidth = Math.max(4, h * 0.008); g.strokeStyle = '#3a4554'; g.stroke();
    g.save(); winPath(g, r); g.lineWidth = 2; g.strokeStyle = 'rgba(120,220,255,.55)'; g.shadowColor = '#5fd8ff'; g.shadowBlur = 14; g.stroke(); g.restore();
    // console top surface
    var cy = r.y1 + h * 0.02, cg = g.createLinearGradient(0, cy, 0, h); cg.addColorStop(0, '#2a3340'); cg.addColorStop(0.15, '#161c25'); cg.addColorStop(1, '#0b0e13'); g.fillStyle = cg;
    g.beginPath(); g.moveTo(w * 0.02, h); g.lineTo(w * 0.1, cy); g.lineTo(w * 0.9, cy); g.lineTo(w * 0.98, h); g.fill();
    g.strokeStyle = 'rgba(140,200,255,.18)'; g.beginPath(); g.moveTo(w * 0.1, cy); g.lineTo(w * 0.9, cy); g.stroke();
    // engraved name in the console
    g.font = '600 ' + Math.round(h * 0.022) + 'px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(C.TITLE.split('').join(' '), w * 0.5 + 1, h * 0.965 + 1); g.fillStyle = 'rgba(160,190,220,.22)'; g.fillText(C.TITLE.split('').join(' '), w * 0.5, h * 0.965);
    // the QR code, etched into a brushed plate in the bulkhead (high contrast so it scans off a projector)
    var qs = Math.round(h * 0.205), qx = Math.round(w * 0.955 - qs), qy = Math.round(h - qs - h * 0.018);
    var pg = g.createLinearGradient(qx, qy, qx + qs, qy + qs); pg.addColorStop(0, '#e4e8ec'); pg.addColorStop(0.5, '#cfd5db'); pg.addColorStop(1, '#e9edf0'); g.fillStyle = pg; roundRect(g, qx - 6, qy - 6, qs + 12, qs + 12, 8); g.fill();
    g.strokeStyle = '#59636f'; g.lineWidth = 2; g.stroke();
    if (qrM) { var n = qrM.getModuleCount(), m = Math.floor(qs / (n + 2)), o = Math.floor((qs - m * n) / 2);
      for (var rr = 0; rr < n; rr++) for (var cc = 0; cc < n; cc++) if (qrM.isDark(rr, cc)) { var x = qx + o + cc * m, yy = qy + o + rr * m; g.fillStyle = '#10161d'; g.fillRect(x, yy, m, m); }
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; for (rr = 0; rr < n; rr++) for (cc = 0; cc < n; cc++) if (qrM.isDark(rr, cc) && !(rr + 1 < n && qrM.isDark(rr + 1, cc))) { g.beginPath(); g.moveTo(qx + o + cc * m, qy + o + (rr + 1) * m + 0.5); g.lineTo(qx + o + (cc + 1) * m, qy + o + (rr + 1) * m + 0.5); g.stroke(); } }
    g.textAlign = 'right'; g.fillStyle = 'rgba(190,225,255,.75)'; g.font = '600 ' + Math.round(h * 0.02) + 'px Fredoka, system-ui, sans-serif'; g.fillText('SCAN TO COME ABOARD', qx - 18, qy + qs * 0.3);
    g.font = '700 ' + Math.round(h * 0.05) + 'px Fredoka, system-ui, sans-serif'; g.fillStyle = '#e8f6ff'; g.fillText(roomCode, qx - 18, qy + qs * 0.62);
    g.font = Math.round(h * 0.015) + 'px system-ui, sans-serif'; g.fillStyle = 'rgba(160,190,220,.6)'; g.fillText(joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '') || 'connecting\u2026', qx - 18, qy + qs * 0.82);
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  var HC = '#8fe6ff', HC2 = 'rgba(143,230,255,', proj = new T.Vector3();
  function bar(g, x, y, w, h, v, col, label) { g.fillStyle = HC2 + '.12)'; g.fillRect(x, y, w, h); g.fillStyle = col; g.fillRect(x, y, w * clamp(v / 100, 0, 1), h); g.fillStyle = HC2 + '.85)'; g.textAlign = 'left'; g.fillText(label, x, y - 4); g.textAlign = 'right'; g.fillText(Math.round(v) + '%', x + w, y - 4); }
  function drawHud(dt) {
    var c = $('hud'), w = c.width, h = c.height, g = hctx, r = winRect(w, h), f = Math.round(h * 0.019);
    g.clearRect(0, 0, w, h); g.font = '500 ' + f + 'px Fredoka, system-ui, sans-serif'; g.lineWidth = 1.5;
    var space = ship.loc === 'space' || ship.loc === 'descent';
    // alert wash
    if (alertState !== 'none') { var pulse = 0.5 + 0.5 * Math.sin(simT * (alertState === 'red' ? 6 : 3)); g.save(); winPath(g, r); g.lineWidth = 10; g.strokeStyle = (alertState === 'red' ? 'rgba(255,50,50,' : 'rgba(255,200,60,') + (0.25 + pulse * 0.4).toFixed(2) + ')'; g.stroke(); g.restore();
      g.textAlign = 'center'; g.font = '700 ' + Math.round(f * 1.2) + 'px Fredoka, system-ui'; g.fillStyle = alertState === 'red' ? 'rgba(255,90,80,' + (0.5 + pulse * 0.5) + ')' : 'rgba(255,210,90,.85)'; g.fillText(alertState === 'red' ? 'RED ALERT' : 'YELLOW ALERT', w / 2, r.y0 + f * 4.4); g.font = '500 ' + f + 'px Fredoka, system-ui'; }
    // heading tape
    var e = new T.Euler().setFromQuaternion(ship.quat, 'YXZ'), hd = ((-e.y * 180 / Math.PI) % 360 + 360) % 360, tx = w / 2, ty = r.y0 + f * 1.6;
    g.strokeStyle = HC2 + '.5)'; g.fillStyle = HC2 + '.75)'; g.textAlign = 'center';
    for (var dd = -40; dd <= 40; dd += 5) { var deg = Math.round(hd / 5) * 5 + dd, px = tx + (deg - hd) * w * 0.0045; if (Math.abs(px - tx) > w * 0.18) continue; var big = ((deg % 30) + 30) % 30 === 0; g.beginPath(); g.moveTo(px, ty); g.lineTo(px, ty - (big ? f * 0.7 : f * 0.35)); g.stroke(); if (big) g.fillText(((deg % 360) + 360) % 360 + '', px, ty + f * 1.05); }
    g.beginPath(); g.moveTo(tx, ty + f * 0.2); g.lineTo(tx - 5, ty + f * 0.55); g.lineTo(tx + 5, ty + f * 0.55); g.fill();
    g.fillText('PITCH ' + Math.round(e.x * 57.3) + '\u00B0', tx, ty + f * 2.2);
    // left block: speed / warp / course
    var lx = r.x0 + w * 0.02, ly = r.y0 + h * 0.13; g.textAlign = 'left';
    g.font = '700 ' + Math.round(f * 1.9) + 'px Fredoka, system-ui'; g.fillStyle = ship.warp > 0.5 ? '#c9b8ff' : HC; g.fillText(ship.loc !== 'space' ? (ship.loc === 'surface' ? 'LANDED' : 'DESCENT') : ship.warp > 0.5 ? 'WARP ' + ship.warp.toFixed(1) : ship.speed > 1 ? 'IMPULSE' : ship.orbit ? 'ORBIT' : 'HOLDING', lx, ly);
    g.font = '500 ' + f + 'px Fredoka, system-ui'; g.fillStyle = HC2 + '.8)';
    var lines = [Math.round(ship.speed) + ' km/s'];
    if (ship.course && defs[ship.course.id]) { lines.push('\u2192 ' + defs[ship.course.id].name.toUpperCase()); lines.push('ETA ' + C.fmtShipTime(ship.eta * C.nav.timeScale) + ' ship time'); lines.push('(' + Math.round(ship.eta) + ' s here)'); }
    if (ship.orbit) lines.push('ORBITING ' + defs[ship.orbit.id].name.toUpperCase());
    if (ship.loc !== 'space') lines.push('ALT ' + Math.max(0, Math.round((surfCam.y - land.depth) * 12)) + ' m');
    lines.forEach(function (l, i) { g.fillText(l, lx, ly + f * (1.6 + i * 1.35)); });
    // right block: shields / hull / fuel / power
    var rx = r.x1 - w * 0.17, bw = w * 0.15, ry = r.y0 + h * 0.11;
    bar(g, rx, ry, bw, 6, ship.shields, ship.shieldsUp ? '#6fd8ff' : '#556', ship.shieldsUp ? 'SHIELDS' : 'SHIELDS DOWN'); bar(g, rx, ry + f * 2.4, bw, 6, ship.hull, ship.hull < 40 ? '#ff6050' : '#9effc4', 'HULL'); bar(g, rx, ry + f * 4.8, bw, 6, ship.fuel, '#ffc46b', 'FUEL');
    g.textAlign = 'left'; g.fillStyle = HC2 + '.8)'; var pk = ['shields', 'engines', 'sensors', 'life', 'tractor'], pl = ['SHD', 'ENG', 'SNS', 'LIFE', 'TRAC'];
    pk.forEach(function (k, i) { var y = ry + f * (7 + i * 1.25); g.fillText(pl[i], rx, y); for (var j = 0; j < C.power.max; j++) { g.fillStyle = j < ship.power[k] ? '#ffb347' : HC2 + '.15)'; g.fillRect(rx + bw * 0.38 + j * bw * 0.125, y - f * 0.65, bw * 0.1, f * 0.6); } g.fillStyle = HC2 + '.8)'; });
    // contact markers
    if (space && !ship.view) C.sector.forEach(function (d) {
      var o = H.objs[d.id]; proj.copy(o.position).project(camera); if (proj.z > 1 || Math.abs(proj.x) > 0.95 || Math.abs(proj.y) > 0.95) return;
      var sx = (proj.x + 1) / 2 * w, sy = (1 - proj.y) / 2 * h; if (sy > r.y1 - 10 || sy < r.y0) return;
      var tgt = ship.course && ship.course.id === d.id, dist = o.position.distanceTo(ship.pos), s = tgt ? 16 : 9;
      g.strokeStyle = tgt ? '#ffe08a' : HC2 + '.55)'; g.fillStyle = g.strokeStyle;
      g.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { g.moveTo(sx + q[0] * s, sy + q[1] * s * 0.5); g.lineTo(sx + q[0] * s, sy + q[1] * s); g.lineTo(sx + q[0] * s * 0.5, sy + q[1] * s); }); g.stroke();
      g.textAlign = 'left'; g.fillText(d.name + '  ' + (dist > 9999 ? (dist / 1000).toFixed(1) + 'k' : Math.round(dist)), sx + s + 6, sy + 4);
    });
    if (space && !ship.view && ev.active && (ev.active.ship || H.raider.visible)) { var es = ev.active.ship || H.raider; proj.copy(es.position).project(camera); if (proj.z < 1 && Math.abs(proj.x) < 0.95) { var ex = (proj.x + 1) / 2 * w, ey = (1 - proj.y) / 2 * h; g.strokeStyle = ev.active.def.kind === 'raider' ? '#ff6a6a' : '#c9b8ff'; g.strokeRect(ex - 20, ey - 20, 40, 40); g.fillStyle = g.strokeStyle; g.fillText(ev.active.def.kind === 'raider' ? 'UNKNOWN VESSEL' : ev.active.def.kind === 'distress' ? 'DISTRESS' : ev.active.def.kind === 'colossus' ? 'MASS: ??? ' : 'VELITH ENVOY', ex + 26, ey); } }
    // view screen
    if (ship.view) { g.fillStyle = 'rgba(120,220,255,.05)'; for (var yy = r.y0; yy < r.y1; yy += 4) g.fillRect(r.x0, yy, r.x1 - r.x0, 1); g.textAlign = 'left'; g.fillStyle = HC; g.font = '700 ' + f + 'px Fredoka'; var vt = viewTarget(); g.fillText('VIEW SCREEN \u00B7 MAG \u00D7' + Math.round(62 / camera.fov) + (vt ? ' \u00B7 ' + vt.name.toUpperCase() : ''), r.x0 + w * 0.02, r.y1 - h * 0.03); g.font = '500 ' + f + 'px Fredoka'; }
    // scans
    var sy0 = r.y0 + h * 0.42; Object.keys(scans).forEach(function (id) { var sc = scans[id]; sc.t -= dt; if (sc.t <= 0) { delete scans[id]; return; } if (!sc.lines) { g.fillStyle = HC2 + '.8)'; g.textAlign = 'left'; g.fillText('SCANNING ' + sc.d.name.toUpperCase() + ' ' + '\u25AE'.repeat(1 + (simT * 4 | 0) % 6), lx, sy0); sy0 += f * 1.4; return; }
      g.globalAlpha = clamp(sc.t, 0, 1); sc.lines.forEach(function (l, i) { g.fillStyle = i ? HC2 + '.75)' : '#ffe08a'; wrap(g, l, lx, sy0, w * 0.26, f * 1.25); sy0 += f * (i === 1 ? 2.6 : 1.3); }); g.globalAlpha = 1; });
    // probe ticker
    if (hudTicker && hudTicker.t > 0) { hudTicker.t -= dt; g.globalAlpha = clamp(hudTicker.t, 0, 1); g.textAlign = 'left'; g.fillStyle = '#9dffd6'; var tt = hudTicker.noise > 0.2 ? corrupt(hudTicker.text, hudTicker.noise * 0.4) : hudTicker.text; g.fillText(tt, lx, r.y1 - h * 0.075); g.globalAlpha = 1; }
    // computer lines
    notes.forEach(function (n, i) { n.t += dt; }); notes = notes.filter(function (n) { return n.t < 7; });
    notes.forEach(function (n, i) { g.globalAlpha = clamp(7 - n.t, 0, 1); g.textAlign = 'center'; g.fillStyle = n.tone === 'urgent' ? '#ff8a80' : n.tone === 'alert' ? '#ffd27a' : HC; g.fillText(n.text, w / 2, r.y1 - h * 0.035 - (notes.length - 1 - i) * f * 1.4); }); g.globalAlpha = 1;
    // alien translation
    if (enc) { var bx = w * 0.27, bw2 = w * 0.46, by = r.y0 + h * 0.12; g.fillStyle = 'rgba(8,14,22,.6)'; g.fillRect(bx, by, bw2, h * 0.15); g.strokeStyle = enc.sp.color; g.strokeRect(bx, by, bw2, h * 0.15);
      g.textAlign = 'left'; g.fillStyle = enc.sp.color; g.font = '700 ' + f + 'px Fredoka'; g.fillText('\u25C8 ' + enc.sp.name.toUpperCase() + ' \u00B7 COMPUTER TRANSLATION' + (enc.sp.style === 'struggle' ? ' (UNCERTAIN)' : ''), bx + 14, by + f * 1.4);
      g.font = '500 ' + Math.round(f * 1.15) + 'px Fredoka'; g.fillStyle = '#eaf6ff'; wrap(g, translated(enc), bx + 14, by + f * 3, bw2 - 28, f * 1.4);
      if (enc.phase === 'ask') { g.fillStyle = HC2 + '.7)'; g.font = '500 ' + f + 'px Fredoka'; g.fillText('Crew: answer on your phones \u00B7 ' + Math.max(0, Math.ceil(enc.wait - enc.t)) + ' s', bx + 14, by + h * 0.15 - f * 0.6); } g.font = '500 ' + f + 'px Fredoka'; }
    // landing gear diagram
    if (land.gearT != null && land.gearT < 6) { land.gearT += dt; var gx = r.x1 - w * 0.15, gy = r.y1 - h * 0.2, k = clamp(land.gearT / 1.8, 0, 1), down = !land.gearUp; if (!down) k = 1 - k;
      g.strokeStyle = HC; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + w * 0.1, gy); g.lineTo(gx + w * 0.11, gy + 10); g.lineTo(gx - 6, gy + 10); g.closePath(); g.stroke();
      [0.2, 0.8].forEach(function (q) { var x = gx + w * 0.1 * q; g.beginPath(); g.moveTo(x, gy + 10); g.lineTo(x + 6 * k, gy + 10 + 22 * k); g.lineTo(x + 14 * k, gy + 10 + 22 * k); g.stroke(); });
      g.fillStyle = k >= 1 ? '#9effc4' : '#ffd27a'; g.textAlign = 'left'; g.fillText(down ? (k >= 1 ? 'GEAR DOWN \u2714' : 'GEAR DEPLOYING') : 'GEAR RETRACTING', gx, gy - 8); }
    // crew list on the console (left)
    var cx = w * 0.12, cy = r.y1 + h * 0.07; g.textAlign = 'left'; g.font = '600 ' + Math.round(f * 0.9) + 'px Fredoka'; g.fillStyle = 'rgba(190,225,255,.6)'; g.fillText('CREW ' + active().length + '/' + C.maxCrew + (active().length ? '' : ' \u00B7 scan the plate to come aboard'), cx, cy);
    crew.forEach(function (m, i) { var sts = C.stations.filter(function (s) { return asg[s.id] === m.cid; }), y = cy + f * 1.25 * (i + 1); if (i > 5) return;
      g.fillStyle = !m.connected ? 'rgba(255,255,255,.3)' : !m.onBridge ? 'rgba(255,255,255,.45)' : '#e8f6ff'; g.fillText(m.name, cx, y);
      var sx2 = cx + w * 0.09; if (!m.connected) { g.fillText('signal lost\u2026', sx2, y); return; } if (!m.onBridge) { g.fillText('off the bridge', sx2, y); return; }
      (asg.cap === m.cid ? [C.stations[0]] : sts).forEach(function (s) { g.fillStyle = s.color; g.fillText(s.short, sx2, y); sx2 += g.measureText(s.short).width + 10; });
      if (asg.cap === m.cid && sts.length > 1) { g.fillStyle = 'rgba(190,225,255,.5)'; g.fillText('+' + (sts.length - 1) + ' stations', sx2, y); } });
    if (ship.beacon && (simT * 2 | 0) % 2) { g.fillStyle = '#ff6a6a'; g.textAlign = 'center'; g.fillText('\u25C9 DISTRESS BEACON ACTIVE', w / 2, r.y1 + h * 0.06); }
  }
  function wrap(g, text, x, y, mw, lh) { var words = String(text).split(' '), line = ''; for (var i = 0; i < words.length; i++) { var t = line + words[i] + ' '; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); y += lh; line = words[i] + ' '; } else line = t; } g.fillText(line, x, y); }
  function viewTarget() {
    if (ev.active && (ev.active.ship || H.raider.visible)) return { name: ev.active.def.kind === 'raider' ? 'unknown vessel' : 'contact', pos: (ev.active.ship || H.raider).position, r: ev.active.def.kind === 'colossus' ? 1500 : 60 };
    var id = ship.course ? ship.course.id : ship.orbit ? ship.orbit.id : lastFocus; var d = defs[id]; if (!d || d.kind === 'point') return null;
    return { name: d.name, pos: H.objs[id].position, r: d.kind === 'blackhole' ? d.r * 5 : d.kind === 'comet' ? 300 : d.r };
  }
  var lastFocus = 'thal';

  // ================================================================== frame loop
  var last = performance.now(), fpsN = 0, fpsT = 0, lowT = 0, highT = 0, fps = 60, frameN = 0, camQ = new T.Quaternion(), shakeV = new T.Vector3();
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.1, (now - last) / 1000); last = now; simT += dt; frameN++;
    fpsN++; fpsT += dt; if (fpsT >= 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; autoQuality(); }
    if (ship.loc === 'space') { pilot(dt); hazards(dt); updateEvents(dt); }
    else { hazards(dt); updateLanding(dt); }
    if (ship.loc === 'descentSurf' || ship.loc === 'surface' || ship.loc === 'ascent') updateSurface(dt);
    updateProbes(dt); updateEncounter(dt);
    H.shieldU.t.value = simT; H.shieldU.base.value = ship.deflT > 0 ? 0.8 : 0;
    if (beamLine && beamLine.visible) { beamLine.userData.t -= dt; if (beamLine.userData.t < 0) beamLine.visible = false; }
    // world animation
    Object.keys(H.objs).forEach(function (id) { var o = H.objs[id], u = o.userData; if (!u || !u.def) return;
      if (u.clouds) u.clouds.rotation.y += dt * 0.006; if (u.body) u.body.rotation.y += dt * 0.003; if (u.spin) o.rotation.z += dt * u.spin; if (u.diskU) u.diskU.t.value = simT;
      if (u.blink) o.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(simT * 2.3));
      if (u.tail) { var tl = u.tail, a = tl.geo.attributes.position.array; for (var i = 0; i < tl.n; i++) { var s = (tl.seed[i * 4] + simT * 0.012 * tl.seed[i * 4 + 3]) % 1, sp = tl.rad * (0.15 + s * 1.6); a[i * 3] = tl.dir.x * tl.len * s + tl.seed[i * 4 + 1] * sp; a[i * 3 + 1] = tl.dir.y * tl.len * s + tl.seed[i * 4 + 2] * sp; a[i * 3 + 2] = tl.dir.z * tl.len * s + (tl.seed[i * 4 + 1] - tl.seed[i * 4 + 2]) * sp; } tl.geo.attributes.position.needsUpdate = true; }
    });
    // camera
    ship.shake = Math.max(0, ship.shake - dt * 0.6); shakeV.set((Math.random() - 0.5), (Math.random() - 0.5), 0).multiplyScalar(ship.shake * ship.shake * 1.2);
    var onSurf = ship.loc === 'descentSurf' || ship.loc === 'surface' || ship.loc === 'ascent';
    if (!onSurf) {
      camera.position.copy(ship.pos).add(shakeV);
      camQ.copy(ship.quat); var fov = 62 + Math.min(14, ship.warp * 1.4);
      var vt = ship.view ? viewTarget() : null;
      if (vt) { tmpM.lookAt(camera.position, vt.pos, UP); tmpQ.setFromRotationMatrix(tmpM); camQ.copy(tmpQ); var dist = vt.pos.distanceTo(camera.position); fov = clamp(2 * Math.atan(vt.r * 2.4 / dist) * 57.3, 0.8, 62); }
      camera.quaternion.slerp(camQ, ship.view ? 1 - Math.exp(-dt * 3) : 1); camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 2.5)); camera.updateProjectionMatrix();
    } else {
      camera.position.set(surfCam.x, surfCam.y, surfCam.z).add(shakeV); camera.rotation.set(surfCam.pitch, surfCam.yaw, ship.tilt * Math.PI / 180, 'YXZ'); camera.fov = 62; camera.updateProjectionMatrix();
    }
    var tiltCss = 'rotate(' + (ship.tilt * 0.35).toFixed(2) + 'deg) scale(' + (ship.tilt ? 1.03 : 1) + ')'; $('frame').style.transform = tiltCss; $('hud').style.transform = tiltCss;
    H.sky.position.copy(camera.position);
    // dust parallax + warp streaks
    var wv = clamp(ship.warp / 9.9, 0, 1), wOn = ship.warp > 0.6 && !onSurf;
    H.dust.visible = !onSurf && ship.warp < 2; if (H.dust.visible && (frameN % (rung > 2 ? 3 : 1) === 0)) { var dp = H.dust.geometry.attributes.position.array; for (var i = 0; i < dp.length; i += 3) { dp[i] = ship.pos.x + (((dp[i] - ship.pos.x + 300) % 600) + 600) % 600 - 300; dp[i + 1] = ship.pos.y + (((dp[i + 1] - ship.pos.y + 300) % 600) + 600) % 600 - 300; dp[i + 2] = ship.pos.z + (((dp[i + 2] - ship.pos.z + 300) % 600) + 600) % 600 - 300; } H.dust.geometry.attributes.position.needsUpdate = true; }
    H.streaks.visible = wOn; if (wOn) { var sa = H.streaks.geometry.attributes.position.array, ca = H.streaks.geometry.attributes.color.array, ss = H.streakSeed, len = 6 + wv * 140, vz = 40 + wv * 900, col = new T.Color().setHSL(0.6 - wv * 0.15, 0.7, 0.75), col2 = new T.Color().setHSL(wv > 0.85 ? 0.98 : 0.66, 0.8, 0.6);
      for (i = 0; i < H.streakN; i++) { ss[i * 3 + 2] += vz * dt; if (ss[i * 3 + 2] > 0) ss[i * 3 + 2] -= 400; var x = ss[i * 3], y = ss[i * 3 + 1], z = ss[i * 3 + 2]; sa[i * 6] = x; sa[i * 6 + 1] = y; sa[i * 6 + 2] = z; sa[i * 6 + 3] = x; sa[i * 6 + 4] = y; sa[i * 6 + 5] = z - len;
        ca[i * 6] = col.r; ca[i * 6 + 1] = col.g; ca[i * 6 + 2] = col.b; ca[i * 6 + 3] = col2.r * 0.2; ca[i * 6 + 4] = col2.g * 0.2; ca[i * 6 + 5] = col2.b * 0.2; }
      H.streaks.geometry.attributes.position.needsUpdate = true; H.streaks.geometry.attributes.color.needsUpdate = true; H.streaks.material.opacity = clamp((ship.warp - 0.6) / 2, 0, 1); }
    $('warpglow').style.opacity = wOn ? (0.15 + wv * 0.6).toFixed(2) : 0; $('warpglow').style.background = 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 25%, ' + (wv > 0.85 ? 'rgba(255,80,160,.35)' : 'rgba(90,120,255,.3)') + ' 75%)';
    SFX.setWarp(ship.warp); if (wOn && !wasWarp) SFX.play('warpIn'); if (!wOn && wasWarp) SFX.play('warpOut'); wasWarp = wOn;
    camera.updateMatrixWorld(true);
    renderer.render(onSurf && surf ? surf : scene, camera);
    if (frameDirty) drawFrame();
    if (rung < 3 || frameN % 2 === 0) drawHud(rung < 3 ? dt : dt * 2);
    sendState(false);
    if (Q.has('fps') && frameN % 30 === 0) $('fxInfo').textContent = Math.round(fps) + ' fps \u00B7 q' + rung + ' \u00B7 ' + renderer.info.render.calls + ' calls';
  }
  var wasWarp = false;
  function autoQuality() {
    if (Q.has('q')) return;
    if (fps < Qy.downBelowFps) { lowT++; highT = 0; if (lowT >= Qy.downAfterSec && rung < Qy.rungs.length - 1) { rung++; lowT = 0; resize(); } }
    else if (fps > Qy.upAboveFps) { highT++; lowT = 0; if (highT >= Qy.upAfterSec && rung > 1) { rung--; highT = 0; resize(); } } else { lowT = 0; highT = 0; }
  }
  // ================================================================== boot
  $('ttl').textContent = C.TITLE; $('ver').textContent = 'v' + C.version;
  setTimeout(function () { $('title').classList.add('gone'); }, Q.has('shots') ? 200 : 7000);
  ['pointerdown', 'keydown'].forEach(function (ev2) { window.addEventListener(ev2, function () { SFX.unlock(); SFX.bed('drone', settings.drone); }, { passive: true }); });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'm' || e.key === 'M') SFX.mute(); if (e.key === 'v' || e.key === 'V') ship.view = !ship.view;
    var n = +e.key; if (n >= 1 && n <= 9 && C.sector[n - 1]) setCourse(C.sector[n - 1].id, 9);
  });
  resize(); startNet(); SFX.unlock(); log('Systems nominal.', 'cpu');
  if (Q.has('nonet')) { roomCode = 'TEST'; makeQr(C.liveControllerUrl + '?room=TEST'); frameDirty = true; }
  requestAnimationFrame(tick);
  // test / debug hooks (the sim harness drives these)
  window.SPACE = { ship: ship, defs: defs, H: H, crew: function () { return crew; }, asg: function () { return asg; }, settings: function () { return settings; }, land: function () { return land; }, setCourse: setCourse, launchProbe: launchProbe, probes: probes,
    event: function (id) { ev.active = null; return startEvent(pickEvent(id)); }, encounter: startEncounter, glass: function () { glassT = 0; }, enc: function () { return enc; }, ev: function () { return ev; },
    jump: function (id, k) { var d = defs[id], o = H.objs[id].position; ship.course = null; ship.orbit = null; ship.speed = 0; ship.pos.copy(o).add(new T.Vector3(0, d.r * 0.3, standoff(d) * (k || 1) + d.r * 0.2)); faceNow(o); },
    face: function (id) { faceNow(H.objs[id].position); }, log: function () { return logLines; }, alert: function () { return alertState; }, fps: function () { return fps; }, rung: function () { return rung; }, calls: function () { return renderer.info.render.calls; }, lastSpoken: function () { return SFX.lastText(); } };
  function faceNow(p) { tmpM.lookAt(ship.pos, p, UP); ship.quat.setFromRotationMatrix(tmpM); camera.quaternion.copy(ship.quat); }
})();
