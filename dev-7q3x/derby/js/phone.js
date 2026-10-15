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
  var jz = $('joy'), jid = null, jx0 = 0, jy0 = 0, jv = [0, 0];
  function kpos(x, y) { $('knob').style.left = x + 'px'; $('knob').style.top = y + 'px'; }
  jz.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; jid = t.identifier; var r = jz.getBoundingClientRect(); jx0 = t.clientX - r.left; jy0 = t.clientY - r.top;
    $('base').style.left = jx0 + 'px'; $('base').style.top = jy0 + 'px'; $('base').style.display = $('knob').style.display = 'block'; kpos(jx0, jy0); e.preventDefault(); }, { passive: false });
  jz.addEventListener('touchmove', function (e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== jid) continue; var r = jz.getBoundingClientRect(), dx = t.clientX - r.left - jx0, dy = t.clientY - r.top - jy0, m = Math.hypot(dx, dy), k = m > 65 ? 65 / m : 1; kpos(jx0 + dx * k, jy0 + dy * k); jv = [dx * k / 65, dy * k / 65]; } e.preventDefault(); }, { passive: false });
  function jend(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === jid) { jid = null; jv = [0, 0]; $('base').style.display = $('knob').style.display = 'none'; } }
  jz.addEventListener('touchend', jend); jz.addEventListener('touchcancel', jend);
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
    if (m.t === 'welcome') { if (m.setup) { setup.type = setup.type || m.setup.type; } document.body.style.borderTop = '6px solid ' + m.color; sendSetup(); drawGarage(); }
    if (m.t === 'reject') { $('st').textContent = m.reason; }
    if (m.t === 'buzz') { if (navigator.vibrate) navigator.vibrate(m.long ? [120, 60, 220] : Math.round(25 + m.s * 90)); if (cur === 'drive') { $('drive').classList.remove('hit'); void $('drive').offsetWidth; $('drive').classList.add('hit'); } }
    if (m.t === 'st') { S = m; paint(); }
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
