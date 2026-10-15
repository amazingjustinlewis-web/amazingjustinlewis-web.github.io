/* IRON STRIDE SQUAD - TV: lobby, gamepads, phones, overhead 3D view. */
(function () {
  'use strict';
  var T = window.THREE, Q = window.SQ_CONFIG, W = window.MechWorld, U = new URLSearchParams(location.search), $ = function (i) { return document.getElementById(i); };
  var LOCAL = U.get('local') === '1', NONET = U.get('nonet') === '1';
  var S = new window.SquadSim(), phase = 'lobby', players = [], net = null, colorI = 0;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function addPlayer(o) { o.color = Q.colors[colorI++ % Q.colors.length]; o.id = o.id || ('p' + Math.random().toString(36).slice(2, 7)); players.push(o); if (phase === 'play') o.mech = S.addMech({ id: o.id, cls: o.cls, name: o.name, color: o.color, ai: o.ai }); return o; }
  function start() { if (phase !== 'lobby') return;
    if (U.get('bots') === '1' || !players.length) { if (!players.some(function (p) { return p.cls === 'light'; })) addPlayer({ name: 'Bot Strider', cls: 'light', ai: true }); if (!players.some(function (p) { return p.cls === 'titan'; })) addPlayer({ name: 'Bot Titan', cls: 'titan', ai: true }); }
    phase = 'play'; players.forEach(function (p) { p.mech = S.addMech({ id: p.id, cls: p.cls, name: p.name, color: p.color, ai: p.ai }); }); buildMechs(); msg('STRIDE OUT', 1500); }
  var msgT = 0; function msg(t, ms) { $('msg').textContent = t; msgT = performance.now() + (ms || 1500); }
  // ---------------------------------------------------------------- gamepads + keyboard (Striders)
  var pads = {}, keys = {};
  function pollPads() {
    var gp = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < gp.length; i++) { var g = gp[i]; if (!g || !g.connected) continue;
      var p = pads[g.index], b = function (k) { return g.buttons[k] && (g.buttons[k].pressed || g.buttons[k].value > 0.5); };
      if (!p) { if (b(0) || b(9)) { p = pads[g.index] = addPlayer({ name: 'Pad ' + (g.index + 1), cls: 'light', pad: g.index }); p.prevA = true; } continue; }
      if (phase === 'lobby' && b(9) && !p.prevS) start(); p.prevS = b(9);
      var m = p.mech; if (!m) { p.prevA = b(0); continue; }
      var dz = function (v) { return Math.abs(v) < 0.18 ? 0 : v; };
      m.inp.mx = dz(g.axes[0] || 0); m.inp.mz = dz(g.axes[1] || 0); m.inp.ax = dz(g.axes[2] || 0); m.inp.az = dz(g.axes[3] || 0);
      m.inp.fire = b(7) || (g.buttons[7] && g.buttons[7].value > 0.3); m.inp.jump = b(0) || b(6); if ((b(1) || b(4)) && !p.prevB) m.inp.dash = true; p.prevB = b(1) || b(4); p.prevA = b(0);
    }
  }
  var kbP = null;
  window.addEventListener('keydown', function (e) { keys[e.code] = true;
    if (e.code === 'Enter') { if (!kbP) kbP = addPlayer({ name: 'Keyboard', cls: 'light' }); else if (phase === 'lobby') start(); }
    if (e.code === 'ShiftLeft' && kbP && kbP.mech) kbP.mech.inp.dash = true; });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  function pollKeys() { if (!kbP || !kbP.mech) return; var m = kbP.mech, k = function (c) { return keys[c] ? 1 : 0; };
    m.inp.mx = k('KeyD') - k('KeyA'); m.inp.mz = k('KeyS') - k('KeyW'); m.inp.ax = k('ArrowRight') - k('ArrowLeft'); m.inp.az = k('ArrowDown') - k('ArrowUp'); m.inp.fire = !!keys.KeyF || (m.inp.ax || m.inp.az) !== 0; m.inp.jump = !!keys.Space; }
  // ---------------------------------------------------------------- phones (Titans)
  function onMsg(conn, d) {
    if (!d || !d.t) return; var p = conn._p;
    if (d.t === 'hello') { p = players.find(function (q) { return q.token && q.token === d.token; });
      if (!p) { if (players.filter(function (q) { return q.cls === 'titan' && !q.ai; }).length >= Q.maxPhones) { net.send(conn, { t: 'reject', reason: 'All Titan bays are full' }); return; }
        p = addPlayer({ name: String(d.name || 'Titan').slice(0, 12), cls: 'titan', token: d.token }); }
      p.conn = conn; conn._p = p; net.send(conn, { t: 'welcome', id: p.id, color: p.color, phase: phase }); return; }
    if (!p) return; var m = p.mech;
    if (d.t === 'start') start();
    if (!m) return;
    if (d.t === 'move') { S.order(m, +d.x, +d.z); m.order.target = d.keep ? m.order.target : m.order.target; }
    if (d.t === 'target') { m.order.target = d.id || null; }
    if (d.t === 'stop') { m.order.path = null; }
    if (d.t === 'jump') m.inp.jump = true;
    if (d.t === 'auto') m.order.auto = !!d.on;
    if (d.t === 'fire') { var t = m.order.target && S.enemy(m.order.target);
      if (d.w === 'stomp') S.fire(m, 'stomp');
      else if (d.w === 'barrage') { var tx = t ? t.x : m.x + Math.sin(m.aim) * 60, tz = t ? t.z : m.z + Math.cos(m.aim) * 60; S.fire(m, 'barrage', tx, 0, tz, t); }
      else if (d.w === 'siege') m.inp.fire = true; }
  }
  function onClose(conn) { /* the Titan stands still until the phone comes back (token rejoin) */ }
  var lastSend = 0;
  function sendPhones(now) { if (!net || now - lastSend < 100) return; lastSend = now;
    var ms = S.mechs.map(function (m) { return [Math.round(m.x), Math.round(m.z), m.cls === 'titan' ? 1 : 0, m.color, m.dead ? 1 : 0]; }), es = S.enemies.map(function (e) { return [e.id, Math.round(e.x), Math.round(e.z), e.kind === 'tank' ? 1 : 0]; });
    players.forEach(function (p) { if (!p.conn) return; var m = p.mech, o = { t: 'st', phase: phase, score: S.heroScore(), collat: S.collat.n, m: ms, e: es };
      if (m) o.me = { x: +m.x.toFixed(1), z: +m.z.toFixed(1), a: +m.a.toFixed(2), aim: +m.aim.toFixed(2), hp: Math.round(m.hp), max: m.D.hp, dead: m.dead, resp: Math.ceil(m.respawnT), path: m.order.path, tgt: m.order.target, sees: m.sees, auto: m.order.auto,
        air: m.air, cd: { jump: +(Math.max(0, m.cd.jump || 0) / Q.titan.jump.cd).toFixed(2), siege: +(Math.max(0, m.cd.siege || 0) / Q.titan.siege.cd).toFixed(2), barrage: +(Math.max(0, m.cd.barrage || 0) / Q.titan.barrage.cd).toFixed(2), stomp: +(Math.max(0, m.cd.stomp || 0) / Q.titan.stomp.cd).toFixed(2) } };
      net.send(p.conn, o); });
  }
  var room = (U.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || null;
  function onStatus(st, code) { if (st !== 'online') return; var url = location.href.replace(/[^/]*([?#].*)?$/, '') + 'phone.html?room=' + code + (LOCAL ? '&local=1' : '');
    $('code').textContent = code; var q = window.qrcode(0, 'M'); q.addData(url); q.make(); $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  if (LOCAL) net = new window.LRNet.LocalHost({ code: room || 'TEST', onStatus: onStatus, onMessage: onMsg, onClose: onClose });
  else if (!NONET) net = new window.LRNet.Host({ code: room, onStatus: onStatus, onMessage: onMsg, onClose: onClose });
  // ---------------------------------------------------------------- scene
  var renderer = new T.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'low-power' }); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  var scene = new T.Scene(); scene.background = new T.Color(0x9fb8cc); scene.fog = new T.Fog(0x9fb8cc, 260, 620);
  var cam = new T.PerspectiveCamera(45, 1, 1, 1500);
  scene.add(new T.HemisphereLight(0xeaf2ff, 0x40382c, 0.95)); var sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(80, 160, 60); scene.add(sun);
  var BM = [];
  (function () { var g = new T.PlaneGeometry(W.half * 2 + 120, W.half * 2 + 120, 90, 90); g.rotateX(-Math.PI / 2); var p = g.attributes.position; for (var i = 0; i < p.count; i++) p.setY(i, W.height(p.getX(i), p.getZ(i))); g.computeVertexNormals();
    scene.add(new T.Mesh(g, new T.MeshLambertMaterial({ color: 0x6f7a5a })));
    var rm = new T.MeshLambertMaterial({ color: 0x3c4148 }); W.roads.forEach(function (r) { var a = new T.Mesh(new T.BoxGeometry(W.roadW, 0.4, W.city * 2 + 20), rm); a.position.set(r, 1.2, 0); scene.add(a); var b = new T.Mesh(new T.BoxGeometry(W.city * 2 + 20, 0.4, W.roadW), rm); b.position.set(0, 1.25, r); scene.add(b); });
    W.buildings.forEach(function (b) { var gy = W.height(b.x, b.z), m = new T.Mesh(new T.BoxGeometry(b.w, b.top + 6, b.d), new T.MeshLambertMaterial({ color: new T.Color().setHSL(0.55 + b.hue * 0.15, 0.12, 0.42 + b.hue * 0.2) })); m.position.set(b.x, (b.top - 6) / 2, b.z); scene.add(m); BM.push(m); m.base = m.material.color.clone();
      var roof = new T.Mesh(new T.BoxGeometry(b.w * 0.9, 0.6, b.d * 0.9), new T.MeshLambertMaterial({ color: 0x2c333b })); roof.position.set(b.x, b.top + 0.3, b.z); scene.add(roof); });
  })();
  function floorAt(x, z) { var b = W.insideBuilding(x, z, 0); return b ? Math.max(b.top, W.height(x, z)) : W.height(x, z); }
  function mechMesh(m) {
    var g = new T.Group(), col = new T.Color(m.color), dark = col.clone().multiplyScalar(0.45), mb = new T.MeshLambertMaterial({ color: col }), md = new T.MeshLambertMaterial({ color: dark }), mg = new T.MeshLambertMaterial({ color: 0x333a40 });
    var legs = []; [-1, 1].forEach(function (s) { var l = new T.Mesh(new T.BoxGeometry(1.1, 5, 1.4), md); l.position.set(s * 1.6, 2.5, 0); g.add(l); legs.push(l); var f = new T.Mesh(new T.BoxGeometry(1.6, 0.6, 2.4), mg); f.position.set(s * 1.6, 0.3, 0.3); g.add(f); });
    var torso = new T.Group(); torso.position.y = 6.2; g.add(torso);
    var body = new T.Mesh(new T.BoxGeometry(4.2, 2.6, 3.2), mb); torso.add(body);
    var cock = new T.Mesh(new T.BoxGeometry(2, 1, 1.2), new T.MeshLambertMaterial({ color: 0x1b2630, emissive: 0x0a3040 })); cock.position.set(0, 0.5, 1.6); torso.add(cock);
    [-1, 1].forEach(function (s) { var gun = new T.Mesh(new T.BoxGeometry(0.7, 0.7, 3.4), mg); gun.position.set(s * 2.6, -0.2, 1.4); torso.add(gun); });
    if (m.cls === 'titan') { [-1, 1].forEach(function (s) { var pod = new T.Mesh(new T.BoxGeometry(1.4, 1.2, 1.6), md); pod.position.set(s * 1.4, 1.9, -0.6); torso.add(pod); }); }
    g.scale.setScalar(m.D.scale * (m.cls === 'light' ? 1.15 : 1));
    var ring = new T.Mesh(new T.RingGeometry(m.D.hitR * 0.9, m.D.hitR * 1.05, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false })); ring.rotation.x = -Math.PI / 2;
    var shadow = new T.Mesh(new T.CircleGeometry(m.D.hitR * 0.8, 24), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
    var jets = []; [-1, 1].forEach(function (s) { var j = new T.Mesh(new T.ConeGeometry(0.7, 3, 8), new T.MeshBasicMaterial({ color: 0x7ad8ff, transparent: true, opacity: 0.85 })); j.rotation.x = Math.PI; j.position.set(s * 1.6, -1.3, 0); j.visible = false; g.add(j); jets.push(j); });
    scene.add(g); scene.add(ring);
    var tag = document.createElement('div'); tag.style.color = m.color; tag.innerHTML = '<span></span><i><b></b></i>'; $('tags').appendChild(tag);
    return { g: g, torso: torso, legs: legs, ring: ring, tag: tag, shadow: shadow, jets: jets, base: m.D.scale * (m.cls === 'light' ? 1.15 : 1) };
  }
  var MM = {}; function buildMechs() { S.mechs.forEach(function (m) { if (!MM[m.id]) MM[m.id] = mechMesh(m); }); }
  var EM = {}, droneGeo = new T.SphereGeometry(1.6, 10, 8), tankGeo = new T.BoxGeometry(4.4, 2.2, 6), eMat = new T.MeshLambertMaterial({ color: 0xd8343a }), eHit = new T.MeshLambertMaterial({ color: 0xffffff });
  function enemyMesh(e) { var g = new T.Group(), b = new T.Mesh(e.kind === 'tank' ? tankGeo : droneGeo, eMat); g.add(b); if (e.kind === 'tank') { var tur = new T.Mesh(new T.BoxGeometry(2.4, 1.2, 3.6), eMat); tur.position.y = 1.6; g.add(tur); } else { var rot = new T.Mesh(new T.BoxGeometry(5, 0.2, 0.6), new T.MeshLambertMaterial({ color: 0x222222 })); rot.position.y = 1.4; g.add(rot); g.rot = rot; } g.body = b; scene.add(g); return g; }
  var shotPool = []; for (var i = 0; i < 260; i++) { var sm = new T.Mesh(new T.SphereGeometry(1, 6, 4), new T.MeshBasicMaterial({ color: 0xffd84a })); sm.visible = false; scene.add(sm); shotPool.push(sm); }
  var fx = []; for (var k = 0; k < 40; k++) { var fm = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0xffa030, transparent: true, depthWrite: false })); fm.visible = false; scene.add(fm); fx.push({ m: fm, life: 0 }); }
  function boom(x, y, z, r, col) { var f = fx.find(function (q) { return q.life <= 0; }); if (!f) return; f.life = f.max = 0.25 + r * 0.03; f.r = r; f.m.visible = true; f.m.position.set(x, y, z); f.m.material.color.setHex(col || 0xffa030); }
  var shake = 0;
  function onEvent(e) {
    if (e.k === 'impact') { if (e.big) { boom(e.x, e.y, e.z, e.big, 0xffa030); shake = Math.max(shake, e.big / 14); } else boom(e.x, e.y, e.z, e.wall ? 1.4 : 1, e.team ? 0xff4a3a : 0xffe066); }
    if (e.k === 'kill') boom(e.x, e.y, e.z, e.kind === 'tank' ? 9 : 5, 0xff7a20);
    if (e.k === 'stomp') { boom(e.x, W.height(e.x, e.z) + 1, e.z, e.r, 0xd8c8a0); shake = Math.max(shake, 1.2); }
    if (e.k === 'slam') { boom(e.x, e.y + 1, e.z, e.r, 0xd8c8a0); shake = Math.max(shake, e.big ? 2 : 0.9); }
    if (e.k === 'jump') boom(S.byId(e.id).x, S.byId(e.id).py + 0.5, S.byId(e.id).z, 3, 0x7ad8ff);
    if (e.k === 'bhit') { var bm = BM[e.bi]; if (bm) { bm.material.color.copy(bm.base).lerp(new T.Color(0x2a1a10), Math.min(0.75, e.dmg / 60)); } if (e.first) { var bb = W.buildings[e.bi]; boom(bb.x, bb.top, bb.z, 6, 0xff5030); msg('CITY DAMAGE \u2212' + Q.collateral.perBuilding, 900); } }
    if (e.k === 'down') { boom(e.x, W.height(e.x, e.z) + 4, e.z, 10, 0xff3020); }
  }
  // ---------------------------------------------------------------- loop
  var last = performance.now(), acc = 0, V = new T.Vector3(), camC = new T.Vector3(0, 0, 0), camD = 200;
  function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); } resize(); addEventListener('resize', resize);
  function tick() {
    var now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    pollPads(); pollKeys();
    if (phase === 'play') { acc += dt; while (acc >= 1 / 60) { acc -= 1 / 60; S.mechs.forEach(function (m) { if (m.ai) S.think(m, 1 / 60); }); S.step(1 / 60); } S.events.forEach(onEvent); S.events = []; buildMechs(); }
    // camera: frame every living mech; titans need room
    var live = S.mechs.filter(function (m) { return !m.dead; }), cx = 0, cz = 0, sp = 0;
    if (phase === 'play' && live.length) { live.forEach(function (m) { cx += m.x; cz += m.z; }); cx /= live.length; cz /= live.length; live.forEach(function (m) { sp = Math.max(sp, Math.hypot(m.x - cx, m.z - cz) + m.D.hitR * 2); }); }
    else { cx = Math.sin(now / 9000) * 40; cz = Math.cos(now / 9000) * 40; sp = 90; }
    camC.lerp(V.set(cx, 0, cz), 1 - Math.pow(0.1, dt)); camD += (Math.max(170, sp * 2.6) - camD) * (1 - Math.pow(0.2, dt)); shake *= Math.pow(0.02, dt);
    cam.position.set(camC.x + (Math.random() - 0.5) * shake * 2, camD * 1.05, camC.z + camD * 0.45 + (Math.random() - 0.5) * shake * 2); cam.lookAt(camC.x, 0, camC.z);
    S.mechs.forEach(function (m) { var o = MM[m.id]; if (!o) return; var gy = m.air ? floorAt(m.x, m.z) : m.py, alt = Math.max(0, m.py - gy), lift = Math.min(1, alt / (m.cls === 'titan' ? 40 : 22)); o.g.visible = o.ring.visible = o.shadow.visible = !m.dead; o.g.position.set(m.x, m.py, m.z);
      o.g.scale.setScalar(o.base * (1 + 0.2 * lift)); o.shadow.position.set(m.x, gy + 0.25, m.z); o.shadow.scale.setScalar(1 + 0.5 * lift); o.shadow.material.opacity = 0.5 - 0.32 * lift; o.ring.material.opacity = 0.7 - 0.4 * lift;
      o.jets.forEach(function (j) { j.visible = m.thrust || (m.air && m.vy > 4); j.scale.y = 0.7 + Math.random() * 0.6; }); o.g.rotation.y = m.a; o.torso.rotation.y = m.aim - m.a;
      var walk = m.cls === 'light' ? Math.hypot(m.vx, m.vz) > 1 : m.walking, ph = now / (m.cls === 'light' ? 120 : 520);
      o.legs[0].rotation.x = walk ? Math.sin(ph) * 0.5 : 0; o.legs[1].rotation.x = walk ? -Math.sin(ph) * 0.5 : 0; o.ring.position.set(m.x, gy + 1.5, m.z); if (m.air) { o.legs[0].rotation.x = 0.35; o.legs[1].rotation.x = -0.2; }
      V.set(m.x, m.py + m.D.h * (m.cls === 'titan' ? 0.25 : 1.3), m.z).project(cam); o.tag.style.display = m.dead ? 'none' : ''; o.tag.style.left = (V.x + 1) / 2 * innerWidth + 'px'; o.tag.style.top = (1 - V.y) / 2 * innerHeight + 'px';
      o.tag.firstChild.textContent = m.name; o.tag.lastChild.firstChild.style.width = Math.max(0, m.hp / m.D.hp * 100) + '%'; });
    var seen = {}; S.enemies.forEach(function (e) { var g = EM[e.id] || (EM[e.id] = enemyMesh(e)); seen[e.id] = 1; g.position.set(e.x, W.height(e.x, e.z) + (e.kind === 'tank' ? 1.1 : e.alt), e.z); g.rotation.y = Math.atan2(e.vx, e.vz); g.body.material = e.hitT > 0 ? eHit : eMat; if (g.rot) g.rot.rotation.y += dt * 30; });
    for (var id in EM) if (!seen[id]) { scene.remove(EM[id]); delete EM[id]; }
    shotPool.forEach(function (m, i) { var s = S.shots[i]; if (!s || s.delay > 0) { m.visible = false; return; } m.visible = true; m.position.set(s.x, s.y, s.z); m.scale.setScalar(s.kind === 'mg' ? 0.35 : s.kind === 'siege' ? 1.6 : s.kind === 'missile' ? 0.9 : 0.6); m.material.color.setHex(s.team ? 0xff4a3a : s.kind === 'mg' ? 0xffe066 : 0xff8a3d); });
    fx.forEach(function (f) { if (f.life <= 0) return; f.life -= dt; var u = 1 - f.life / f.max; f.m.scale.setScalar(f.r * (0.3 + u)); f.m.material.opacity = 0.9 * (1 - u); if (f.life <= 0) f.m.visible = false; });
    renderer.render(scene, cam); ui(); sendPhones(now);
    requestAnimationFrame(tick);
  }
  var uiK = '';
  function ui() {
    $('lobby').style.display = phase === 'lobby' ? 'flex' : 'none'; $('msg').style.opacity = now() < msgT ? 1 : 0;
    if (phase === 'lobby') { var k = players.map(function (p) { return p.name + p.cls; }).join();
      if (k !== uiK) { uiK = k; $('plist').innerHTML = players.map(function (p) { return '<span style="background:' + p.color + '">' + esc(p.name) + ' \u00b7 ' + (p.cls === 'titan' ? 'Titan (phone)' : 'Strider (pad)') + '</span>'; }).join('') || '<span style="background:#fff3;color:#fff">Press A on a controller, or scan with a phone</span>';
        $('hint').innerHTML = 'Start: Start on a controller, the phone\u2019s Start button, or Enter. Empty roles get a bot.<br><small>Pads: left stick walk, right stick aim, RT fire, A jump (hold = hover), B/LB dash. Keyboard: Enter join, WASD walk, arrows aim + fire, Space jump/hover, Shift dash. Shots and slams that hit buildings cost hero points</small>'; } return; }
    $('hud').innerHTML = S.mechs.map(function (m) { return '<div class="pc" style="border-color:' + m.color + '">' + esc(m.name) + ' <small>' + (m.cls === 'titan' ? 'TITAN' : 'STRIDER') + (m.ai ? ' \u00b7 bot' : '') + '</small><br>' + (m.dead ? 'Rebuilding ' + Math.ceil(m.respawnT) + 's' : 'Hull ' + Math.max(0, Math.round(m.hp)) + ' \u00b7 kills ' + m.stats.kills) + '</div>'; }).join('');
    $('score').innerHTML = 'HERO SCORE <b>' + S.heroScore() + '</b><br><small>Combat ' + S.score + ' \u00b7 Wrecked ' + S.kills + ' \u00b7 City damage: ' + S.collat.n + ' building' + (S.collat.n === 1 ? '' : 's') + ' hit (fewer = better)</small>';
  }
  function now() { return performance.now(); }
  if (U.get('autostart') === '1') setTimeout(start, 500);
  window.SQ = { BM: BM, S: S, start: start, players: players, phase: function () { return phase; } };
  requestAnimationFrame(tick);
})();
