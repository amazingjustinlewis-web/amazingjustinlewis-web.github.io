/* DEMOLITION DERBY - phone controller */
(function () {
  'use strict';
  var C = window.DD_CONFIG, Q = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  var token = localStorage.getItem('dd-token') || Math.random().toString(36).slice(2); localStorage.setItem('dd-token', token);
  var setup = JSON.parse(localStorage.getItem('dd-setup') || 'null') || { type: 'muscle', armour: { front: 'plate', side: 'none', back: 'none' }, boost: 'ram' };
  var net = null, S = {}, ready = false, tilt = false, joy = null, cur = 'join';
  function show(id) { if (cur === id) return; cur = id; ['join', 'garage', 'drive', 'over'].forEach(function (s) { $(s).classList.toggle('on', s === id); }); }
  $('room').value = (Q.get('room') || '').toUpperCase(); $('name').value = Q.get('name') || localStorage.getItem('dd-name') || '';
  function join() {
    var room = $('room').value.toUpperCase().replace(/[^A-Z]/g, ''); if (room.length !== 4) { $('st').textContent = 'Enter the 4-letter code on the TV'; return; }
    var name = $('name').value.trim() || 'Driver'; localStorage.setItem('dd-name', name);
    var o = { code: room, onStatus: function (s) { $('st').textContent = s === 'online' ? 'Connected \u00b7 ' + room : s === 'noroom' ? 'No TV with code ' + room + ' yet\u2026' : s + '\u2026'; },
      onOpen: function () { net.send({ t: 'hello', token: token, name: name }); }, onMessage: onMsg };
    net = Q.get('local') === '1' ? new window.DDNet.LocalClient(o) : new window.DDNet.Client(o);
    $('joinBtn').disabled = true; $('joinBtn').textContent = 'Joining\u2026';
  }
  $('joinBtn').onclick = join; if (Q.get('room') && (Q.get('auto') === '1' || Q.get('name') || localStorage.getItem('dd-name'))) join();
  // ---------------------------------------------------------------- garage
  function stat(label, v) { return '<div class="bar">' + label + '<i><s style="width:' + Math.round(v * 100) + '%"></s></i></div>'; }
  function drawGarage() {
    $('cars').innerHTML = C.cars.map(function (T) { return '<div class="car' + (setup.type === T.id ? ' sel' : '') + '" data-c="' + T.id + '"><b>' + T.name + '</b>' + stat('Speed', T.speed / 30) + stat('Weight', T.mass / 2.2) + stat('Tough', T.hp / 180) + stat('Handling', T.turn / 3.8) + '</div>'; }).join('');
    $('arm').innerHTML = ['front', 'side', 'back'].map(function (s) { return '<div class="row"><span>' + (s === 'side' ? 'Sides' : s[0].toUpperCase() + s.slice(1)) + '</span>' + ['none', 'plate', 'spike'].map(function (a) { return '<button data-a="' + s + ':' + a + '" class="' + (setup.armour[s] === a ? 'sel' : '') + '">' + C.armour[a].name + '</button>'; }).join('') + '</div>'; }).join('') + '<div class="row" style="display:block;font-size:12px;opacity:.8;line-height:1.4">' + ['none', 'plate', 'spike'].map(function (a) { return '<b>' + C.armour[a].name + ':</b> ' + C.armour[a].desc; }).join('<br>') + '</div>';
    $('bst').innerHTML = Object.keys(C.boosts).map(function (k) { var B = C.boosts[k]; return '<div class="row"><button data-b="' + k + '" class="' + (setup.boost === k ? 'sel' : '') + '" style="text-align:left"><b>' + B.name + '</b><br><small>' + B.desc + '</small></button></div>'; }).join('');
    $('readyBtn').textContent = ready ? 'READY \u2714 (tap to change)' : 'READY';
  }
  $('garage').addEventListener('click', function (e) { var t = e.target.closest('[data-c],[data-a],[data-b]'); if (!t) return;
    if (t.dataset.c) setup.type = t.dataset.c; if (t.dataset.a) { var p = t.dataset.a.split(':'); setup.armour[p[0]] = p[1]; } if (t.dataset.b) setup.boost = t.dataset.b;
    localStorage.setItem('dd-setup', JSON.stringify(setup)); sendSetup(); drawGarage(); });
  function sendSetup() { if (net) net.send({ t: 'setup', type: setup.type, armour: setup.armour, boost: setup.boost, ready: ready }); }
  $('readyBtn').onclick = function () { ready = !ready; sendSetup(); drawGarage(); };
  $('startBtn').onclick = function () { ready = true; sendSetup(); net.send({ t: 'start' }); };
  $('botsBtn').onclick = function () { net.send({ t: 'bots' }); };
  $('modeBtn').onclick = function () { net.send({ t: 'mode' }); };
  $('againBtn').onclick = function () { net.send({ t: 'start' }); };
  // ---------------------------------------------------------------- driving
  // v0.4.2: touch ANYWHERE = floating joystick (drag distance = throttle, green bars), release = neutral, long fast swipe = boost
  var jv = [0, 0], TJ = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0, t0: 0, hist: [], boosted: false, flash: 0 };
  function tR() { return C.touch.R * Math.min(innerWidth, innerHeight); }
  var dz = $('drive');
  dz.addEventListener('pointerdown', function (e) { if (TJ.on || e.target.closest('button')) return; TJ.on = true; TJ.id = e.pointerId; TJ.ox = TJ.x = e.clientX; TJ.oy = TJ.y = e.clientY; TJ.t0 = performance.now(); TJ.hist = [[TJ.t0, e.clientX, e.clientY]]; TJ.boosted = false; e.preventDefault(); });
  dz.addEventListener('pointermove', function (e) { if (!TJ.on || e.pointerId !== TJ.id) return; TJ.x = e.clientX; TJ.y = e.clientY; var now = performance.now(); TJ.hist.push([now, e.clientX, e.clientY]); while (TJ.hist.length > 2 && now - TJ.hist[0][0] > 90) TJ.hist.shift();
    var R = tR(), dx = (TJ.x - TJ.ox) / R, dy = (TJ.y - TJ.oy) / R, m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } jv = m < 0.12 ? [0, 0] : [dx, dy];
    var dist = Math.hypot(TJ.x - TJ.ox, TJ.y - TJ.oy), mn = Math.min(innerWidth, innerHeight), h0 = TJ.hist[0], v = Math.hypot(TJ.x - h0[1], TJ.y - h0[2]) / Math.max(1, now - h0[0]);
    if (!TJ.boosted && ((now - TJ.t0 < C.touch.swipeMs && dist > C.touch.swipeFrac * mn) || (v > C.touch.swipeSpeed && dist > mn * 0.3))) { TJ.boosted = true; boostTap = true; boostDown = true; setTimeout(function () { boostDown = false; }, 800); TJ.flash = 0.5; if (navigator.vibrate) navigator.vibrate(40); } });
  function tEnd(e) { if (!TJ.on || e.pointerId !== TJ.id) return; TJ.on = false; jv = [0, 0]; }
  dz.addEventListener('pointerup', tEnd); dz.addEventListener('pointercancel', tEnd);
  var lastD = performance.now();
  function drawTouch() {
    var cv = $('tjc'), now = performance.now(), dt = Math.min(0.1, (now - lastD) / 1000); lastD = now; requestAnimationFrame(drawTouch); if (cur !== 'drive') return;
    if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    var g = cv.getContext('2d'), R = tR(), mag = 0; g.clearRect(0, 0, cv.width, cv.height);
    if (TJ.on) { var ddx = TJ.x - TJ.ox, ddy = TJ.y - TJ.oy, d = Math.hypot(ddx, ddy); mag = Math.min(1, d / R); var kx = TJ.ox + (d > R ? ddx / d * R : ddx), ky = TJ.oy + (d > R ? ddy / d * R : ddy);
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([8, 6]); g.beginPath(); g.arc(TJ.ox, TJ.oy, R, 0, 7); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.strokeStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(kx, ky, R * 0.32, 0, 7); g.fill(); g.stroke(); }
    var n = 10, bh = Math.min(innerHeight * 0.42, 260), bx = 12, by = innerHeight * 0.5 + bh / 2, seg = bh / n;
    for (var i = 0; i < n; i++) { g.fillStyle = mag * n > i + 0.25 ? (i > 7 ? '#c8ff5a' : '#45e07a') : 'rgba(255,255,255,.12)'; g.fillRect(bx, by - (i + 1) * seg + 2, 16 + i * 1.6, seg - 4); }
    g.fillStyle = '#fff'; g.font = '600 13px Fredoka, sans-serif'; g.fillText('GAS', bx, by + 16);
    if (TJ.flash > 0) { TJ.flash -= dt; g.fillStyle = 'rgba(255,140,40,' + TJ.flash * 1.6 + ')'; g.font = '700 ' + Math.round(innerHeight * 0.07) + 'px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('BOOST!', innerWidth / 2, innerHeight * 0.3); g.textAlign = 'left'; }
    drawView(dt);
  }
  // v0.4.2 RACE: your own follow camera on your phone (the TV becomes a broadcast). World snapshots stream from the TV ~15x/s and are interpolated.
  var PV = null, snaps = [];
  function onWorld(w) { snaps.push({ t: performance.now(), w: w }); if (snaps.length > 4) snaps.shift(); }
  function initView() {
    var T3 = window.THREE; if (!T3 || !window.DDTrackMesh) return null; var cv = $('pv');
    var r = new T3.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'low-power' }); r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
    var sc = new T3.Scene(); sc.background = new T3.Color(0x7d95a8); sc.fog = new T3.Fog(0x7d95a8, 120, 360);
    var cam = new T3.PerspectiveCamera(50, 1, 0.5, 600); sc.add(new T3.HemisphereLight(0xfff0dd, 0x302010, 0.95)); var sun = new T3.DirectionalLight(0xffffff, 0.7); sun.position.set(30, 60, 20); sc.add(sun);
    sc.add(window.DDTrackMesh.build(T3, { trees: 80 }));
    return { r: r, sc: sc, cam: cam, cars: {}, T3: T3, cx: null };
  }
  function carObj(col) { var T3 = PV.T3, g = new T3.Group(), m = new T3.MeshLambertMaterial({ color: col, transparent: true }), b = new T3.Mesh(new T3.BoxGeometry(2.3, 0.75, 4.6), m); b.position.y = 0.6; g.add(b);
    var cab = new T3.Mesh(new T3.BoxGeometry(1.9, 0.6, 2.2), new T3.MeshLambertMaterial({ color: new T3.Color(col).multiplyScalar(0.6), transparent: true })); cab.position.set(0, 1.25, -0.2); g.add(cab);
    var tm = new T3.MeshLambertMaterial({ color: 0x151515 }); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (w) { var wh = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.5, 0.4, 10), tm); wh.rotation.z = Math.PI / 2; wh.position.set(w[0] * 1.15, 0.5, w[1] * 1.45); g.add(wh); });
    g.rotation.order = 'YXZ'; PV.sc.add(g); return { g: g, mats: [m, cab.material] }; }
  function drawView(dt) {
    var on = S.mode === 'race' && S.w && S.phase !== 'lobby' && S.phase !== 'over' && Q.get('view') !== '0';
    $('drive').classList.toggle('view', !!on); if (!on) return;
    if (!PV) { PV = initView(); if (!PV) return; }
    var cv = $('pv'); if (cv.width !== Math.round(innerWidth * PV.r.getPixelRatio())) { PV.r.setSize(innerWidth, innerHeight, false); PV.cam.aspect = innerWidth / innerHeight; PV.cam.updateProjectionMatrix(); }
    if (!snaps.length) return; var now = performance.now() - 90, a = snaps[0], b = snaps[snaps.length - 1];
    for (var i = 0; i < snaps.length - 1; i++) if (snaps[i].t <= now && snaps[i + 1].t >= now) { a = snaps[i]; b = snaps[i + 1]; }
    var k = b.t > a.t ? Math.max(0, Math.min(1, (now - a.t) / (b.t - a.t))) : 1, me = null;
    b.w.forEach(function (q) { var p = null; for (var j = 0; j < a.w.length; j++) if (a.w[j][0] === q[0]) p = a.w[j]; p = p || q;
      var o = PV.cars[q[0]] || (PV.cars[q[0]] = carObj(q[7])), x = p[1] + (q[1] - p[1]) * k, y = p[2] + (q[2] - p[2]) * k, z = p[3] + (q[3] - p[3]) * k, da = q[4] - p[4]; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      var an = p[4] + da * k, roll = p[5] + (q[5] - p[5]) * k; o.g.position.set(x, z + Math.abs(Math.sin(roll)) * 1.2 + (1 - Math.cos(roll)) * 0.6, y); o.g.rotation.set(0, an, roll);
      o.g.visible = q[6] === 0 || q[6] === 1 || (q[6] === 3 && Math.floor(performance.now() / 160) % 2 === 0);
      o.mats.forEach(function (m) { m.opacity = q[6] === 1 ? 0.45 : q[6] === 3 ? 0.6 : 1; });
      if (q[0] === S.pid) me = { x: x, y: y, z: z, a: an }; });
    if (me) { var T3 = PV.T3, ht = 58, want = new T3.Vector3(me.x, ht, me.y + ht * 0.56); if (!PV.cx) PV.cx = want.clone(); PV.cx.lerp(want, 1 - Math.pow(0.02, dt)); PV.cam.position.copy(PV.cx); PV.cam.lookAt(PV.cx.x, 0, PV.cx.z - ht * 0.56); }
    PV.r.render(PV.sc, PV.cam);
  }
  requestAnimationFrame(drawTouch);
  var boostDown = false, boostTap = false;
  $('boost').addEventListener('touchstart', function (e) { boostDown = true; boostTap = true; e.preventDefault(); }, { passive: false });
  $('boost').addEventListener('touchend', function (e) { boostDown = false; e.preventDefault(); }, { passive: false });
  $('boost').addEventListener('mousedown', function () { boostDown = true; boostTap = true; }); $('boost').addEventListener('mouseup', function () { boostDown = false; });
  var ori = { b: 0, g: 0 }, ori0 = null;
  function onOri(e) { ori.b = e.beta || 0; ori.g = e.gamma || 0; if (!ori0) ori0 = { b: ori.b, g: ori.g }; }
  $('tiltBtn').onclick = function () {
    if (tilt) { tilt = false; $('tiltBtn').textContent = 'Steer: joystick'; return; }
    function on() { tilt = true; ori0 = null; window.addEventListener('deviceorientation', onOri); $('tiltBtn').textContent = 'Steer: tilt (tap = joystick)'; flashMsg('Hold the phone flat like a wheel. Tilt forward = gas'); }
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') on(); else flashMsg('Motion not allowed'); }).catch(function () { flashMsg('Motion not allowed'); });
    else on();
  };
  var msgT = 0; function flashMsg(t) { $('msg').textContent = t; clearTimeout(msgT); msgT = setTimeout(function () { $('msg').textContent = ''; }, 2500); }
  setInterval(function () {
    if (!net || cur !== 'drive' || S.phase !== 'play') return;
    var m = { t: 'in' };
    if (tilt) { var o0 = ori0 || { b: 0, g: 0 };
      // landscape phones: gamma is forward/back, beta is the wheel. portrait: beta forward/back, gamma left/right
      var land = Math.abs(window.orientation || 0) === 90 || innerWidth > innerHeight, sgn = (window.orientation === -90) ? -1 : 1;
      var steer = land ? (ori.b - o0.b) * sgn : ori.g - o0.g, gas = land ? -(ori.g - o0.g) * sgn : -(ori.b - o0.b);
      m.s = Math.max(-1, Math.min(1, steer / 25)); m.g = Math.max(-1, Math.min(1, gas / 18 + 0.35)); }
    else m.abs = [Math.round(jv[0] * 100) / 100, Math.round(jv[1] * 100) / 100];
    if (setup.boost === 'sustain') m.b = boostDown; else if (boostTap) m.b = true;
    boostTap = false; net.send(m);
  }, 50);
  // ---------------------------------------------------------------- messages
  function onMsg(m) {
    if (m.t === 'welcome') { S.pid = m.pid; if (m.setup) { setup.type = setup.type || m.setup.type; } document.body.style.borderTop = '6px solid ' + m.color; sendSetup(); drawGarage(); }
    if (m.t === 'reject') { $('st').textContent = m.reason; }
    if (m.t === 'buzz') { if (navigator.vibrate) navigator.vibrate(m.long ? [120, 60, 220] : Math.round(25 + m.s * 90)); if (cur === 'drive') { $('drive').classList.remove('hit'); void $('drive').offsetWidth; $('drive').classList.add('hit'); } }
    if (m.t === 'st') { var pid = S.pid; S = m; S.pid = pid; if (m.w) onWorld(m.w); paint(); }
    if (m.t === 'replay') playReplay(m);
  }
  // v0.4.1: wrecked -> full-screen cinematic replay of your crash (slow-mo, camera pushes in on your car), then RESPAWNING x3
  var RP = null;
  function playReplay(m) {
    var f = m.f; if (!f || !f.length) return; RP = { m: m, t0: performance.now(), dur: (f[f.length - 1].t - f[0].t) / DD_CONFIG.replay.speed };
    $('replay').classList.add('on'); $('rtag').innerHTML = '<span>YOUR CRASH \u00b7 REPLAY</span>'; $('rresp').className = ''; if (navigator.vibrate) navigator.vibrate([200, 80, 300]); requestAnimationFrame(drawReplay);
  }
  function drawReplay() {
    if (!RP) return; var cv = $('rcv'), d = devicePixelRatio || 1, W = cv.clientWidth * d, H = cv.clientHeight * d; if (cv.width !== W) { cv.width = W; cv.height = H; }
    var g = cv.getContext('2d'), m = RP.m, f = m.f, u = Math.min(1, (performance.now() - RP.t0) / RP.dur), tt = f[0].t + (f[f.length - 1].t - f[0].t) * u, i = 0; while (i < f.length - 1 && f[i + 1].t <= tt) i++;
    var a = f[i], b = f[Math.min(f.length - 1, i + 1)], k = b.t > a.t ? (tt - a.t) / (b.t - a.t) : 0;
    function pos(id, fr) { for (var j = 0; j < fr.c.length; j++) if (fr.c[j][0] === id) return fr.c[j]; return null; }
    var me = pos(m.id, a) || a.c[0], me2 = pos(m.id, b) || me, cx = me[1] + (me2[1] - me[1]) * k, cy = me[2] + (me2[2] - me[2]) * k, ease = u * u * (3 - 2 * u), sc = Math.min(W, H) / 42 * (1 + 2.2 * ease);
    var rot = Math.sin(u * 2) * 0.25, hit = tt >= m.hitT;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = m.mode === 'race' ? '#4a6a34' : '#120c08'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2); g.rotate(rot); g.scale(sc, sc); g.translate(-cx, -cy);
    if (m.mode === 'race' && window.DDTrack) { var T = window.DDTrack; g.fillStyle = '#4e4a46'; g.beginPath(); for (var q = 0; q <= T.N; q++) { var p = T.at(q * T.STEP, T.HALF); if (q) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } for (q = T.N; q >= 0; q--) { p = T.at(q * T.STEP, -T.HALF); g.lineTo(p.x, p.y); } g.fill();
      g.strokeStyle = '#d03028'; g.lineWidth = 0.8; [-1, 1].forEach(function (sg) { g.beginPath(); for (var q = 0; q <= T.N; q++) { var p = T.at(q * T.STEP, sg * T.HALF); if (q) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke(); });
      g.fillStyle = '#3a78c8aa'; T.puddles.forEach(function (pp) { g.beginPath(); g.arc(pp.x, pp.y, pp.r, 0, 7); g.fill(); }); }
    else { g.fillStyle = '#8a6a48'; g.beginPath(); g.arc(0, 0, m.R || 40, 0, 7); g.fill(); g.strokeStyle = '#c23a2a'; g.lineWidth = 1; g.stroke(); }
    a.c.forEach(function (q) { var q2 = pos(q[0], b) || q; if (q[6] === 2) return; var x = q[1] + (q2[1] - q[1]) * k, y = q[2] + (q2[2] - q[2]) * k, an = q[4]; g.save(); g.translate(x, y); g.rotate(-an);
      g.fillStyle = q[6] === 1 ? '#2a2420' : (m.cols[q[0]] || '#888'); g.fillRect(-1, -2, 2, 4); g.fillStyle = '#0006'; g.fillRect(-0.8, -0.6, 1.6, 1.2);
      if (q[0] === m.id) { g.strokeStyle = '#fff'; g.lineWidth = 0.25; g.strokeRect(-1.2, -2.2, 2.4, 4.4); }
      if (q[6] === 1) for (var z = 0; z < 5; z++) { g.fillStyle = Math.random() < 0.5 ? '#ff6a10' : '#ffc030'; g.fillRect((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 0.5, 0.5); }
      g.restore(); });
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (hit && tt - m.hitT < 260) { g.fillStyle = 'rgba(255,240,200,' + (1 - (tt - m.hitT) / 260) + ')'; g.fillRect(0, 0, W, H); }
    if (u < 1) { requestAnimationFrame(drawReplay); return; }
    var out = (m.lives || 0) <= 0; $('rresp').textContent = out ? 'OUT \u00b7 SPECTATING' : 'RESPAWNING'; $('rresp').className = 'on'; RP = null;
    setTimeout(function () { $('replay').classList.remove('on'); $('rresp').className = ''; }, 1950);
  }
  function paint() {
    var ph = S.phase;
    if (ph === 'lobby') { show('garage'); $('leadBox').style.display = S.leader ? '' : 'none'; $('botsBtn').textContent = 'AI fill: ' + (S.bots ? 'ON' : 'OFF'); $('modeBtn').textContent = 'Mode: ' + (S.mode === 'race' ? 'RACE (tap for Derby)' : 'DERBY (tap for Race)'); $('gNote').textContent = S.leader ? 'You are the leader: start when everyone is ready.' : 'Waiting for the leader to start.'; }
    else if (ph === 'over') { show('over'); $('oTitle').textContent = S.place === 1 ? 'YOU WON THE DERBY!' : 'You placed #' + S.place + ' of ' + S.of;
      var t = S.tot || {}; $('oTab').innerHTML = [['Points', S.score], ['Round wins', t.wins], ['Wrecks dealt', t.kos], ['Ring-outs', t.ringouts], ['Crushes', t.crushes], ['Damage dealt', Math.round(t.dmg || 0)], ['Air time', (t.air || 0).toFixed(1) + 's']].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
      $('againBtn').style.display = S.leader ? '' : 'none'; }
    else { show('drive');
      var f = S.maxhp ? S.hp / S.maxhp : 0; $('hp').firstChild.style.width = (f * 100) + '%'; $('hp').firstChild.style.background = f > 0.5 ? '#7ed957' : f > 0.25 ? '#ffd23f' : '#ff4b55';
      $('lives').textContent = S.mode === 'race' && S.pos ? (S.done ? 'FINISHED' : S.cs === 'out' ? 'OUT' : 'P' + S.pos + ' \u00b7 Lap ' + S.lap + '/' + S.laps + ' ' + '\u2665'.repeat(Math.max(0, S.lives || 0))) : S.cs === 'out' ? 'OUT' : '\u2665'.repeat(Math.max(0, S.lives || 0));
      $('boost').classList.toggle('cd', (S.boost || 0) < 0.99 && setup.boost !== 'sustain'); $('boost').querySelector('s').style.width = ((S.boost || 0) * 100) + '%';
      var info = ph === 'countdown' ? 'Get ready\u2026' : ph === 'roundover' ? 'Round over' : S.cs === 'wait' ? 'Wrecked! Wait at the gate\u2026' : S.cs === 'enter' ? 'Rolling in!' : S.cs === 'out' ? 'Out this round. Watch the TV!' : S.cs === undefined ? 'You join next round' : '';
      if (!msgT || info) $('msg').textContent = info; }
  }
})();
