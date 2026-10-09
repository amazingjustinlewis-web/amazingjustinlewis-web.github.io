/* IRON STRIDE - phone controller (v0.1). Portrait. COMBAT tab: weapons, motion aim, big FIRE. MAP tab: topographic map,
   tap to walk or draw a path (smoothed into a Bezier curve), autopilot, brace, eject. Pilot = seat 0, gunner = seat 1. */
(function () {
  'use strict';
  var C = window.MECH_CONFIG, AIM = window.LRAim, Wd = window.MechWorld, A = C.aim;
  var $ = function (id) { return document.getElementById(id); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local');
  var clientId = Q.get('cid') || store.get('ms_client') || ('P' + Math.random().toString(36).slice(2, 10)); if (!Q.get('cid')) store.set('ms_client', clientId);
  var net = null, st = null, me = { seat: 0 }, joined = false, vibOn = store.get('ms_vib') !== '0';
  var D2R = Math.PI / 180, clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  function vib(p) { if (!vibOn) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function send(m) { return net ? net.send(m) : false; }
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 2600); }

  // ------------------------------------------------------------------ join
  $('room').value = (Q.get('room') || store.get('ms_room') || '').toUpperCase().slice(0, 4);
  $('name').value = Q.get('name') || store.get('ms_name') || '';
  $('room').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('joinBtn').onclick = function () { join(true); };
  function join(gesture) {
    var code = $('room').value.trim(), name = $('name').value.trim();
    if (code.length !== 4) { $('joinStatus').textContent = 'Type the 4-letter room code from the TV.'; return; }
    if (!name) { $('joinStatus').textContent = 'Type a call sign.'; $('name').focus(); return; }
    store.set('ms_room', code); store.set('ms_name', name);
    if (gesture) goFullscreen();
    requestWake(); joined = true; $('joinStatus').textContent = 'Connecting\u2026';
    var opts = { code: code, onOpen: function () { send({ t: 'hello', clientId: clientId, name: name }); }, onMessage: onMsg,
      onStatus: function (s) { $('conn').className = 'conn' + (s === 'online' ? ' on' : s === 'noroom' || s === 'offline' ? ' bad' : '');
        if (!st) $('joinStatus').textContent = s === 'noroom' ? 'No room ' + code + ' yet. Is Iron Stride open on the TV?' : s === 'online' ? 'Joined!' : s === 'offline' ? 'Cannot reach the room server. Check the Wi-Fi.' : 'Connecting\u2026'; } };
    if (net && net.destroy) net.destroy();
    net = LOCAL ? new window.LRNet.LocalClient(opts) : new window.LRNet.Client(opts);
  }
  if (Q.get('room') && $('name').value && (Q.has('auto') || store.get('ms_room') === $('room').value)) setTimeout(function () { join(false); }, 60);
  function goFullscreen() { try { var d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen && /Android/i.test(navigator.userAgent)) d.requestFullscreen().then(function () { try { screen.orientation.lock('portrait').catch(function () {}); } catch (e) {} }).catch(function () {}); } catch (e) {} }
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && joined) requestWake(); });

  function onMsg(m) {
    if (!m) return;
    if (m.t === 'welcome') {
      me = m; $('join').hidden = true; $('main').hidden = false; document.documentElement.style.setProperty('--pc', m.color);
      $('role').textContent = m.role; $('myName').textContent = $('name').value;
      document.body.classList.toggle('gunner', m.seat === 1);
      [].forEach.call(document.querySelectorAll('.pilot'), function (el) { el.hidden = m.seat !== 0; });
      $('mapTab').hidden = m.seat !== 0;
      buildWeapons(m.seat === 0 ? m.weapons : ['CANNON']);
      if (!sensor.mode) setupSensors(); else if (sensor.mode === 'gyro' && !cal.done) startCal();
      vib(30); return;
    }
    if (m.t === 'reject') { $('joinStatus').textContent = m.reason; $('join').hidden = false; $('main').hidden = true; if (net && net.destroy) net.destroy(); net = null; return; }
    if (m.t === 'st') onState(m);
  }

  // ------------------------------------------------------------------ motion sensor (same approach as Laser Range)
  var sensor = { mode: null, listening: false, got: false, v: null, recent: [] };
  function needsPermission() { return typeof window.DeviceOrientationEvent !== 'undefined' && typeof window.DeviceOrientationEvent.requestPermission === 'function'; }
  function setupSensors() {
    if (sensor.mode) return;
    if (Q.has('pad')) { setMode('pad'); return; }
    if (typeof window.DeviceOrientationEvent === 'undefined') { noSensor('This browser has no motion sensor.'); return; }
    listen(900, function () { if (needsPermission() && !sensor.asked) $('perm').hidden = false; else noSensor('No motion sensor found.'); });
  }
  $('permBtn').onclick = function () {
    sensor.asked = true;
    try { window.DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') { $('perm').hidden = true; listen(1800); } else { $('permMsg').textContent = 'Motion access was refused. Using the touchpad.'; setTimeout(function () { $('perm').hidden = true; setMode('pad'); }, 2000); } })
      .catch(function () { $('perm').hidden = true; setMode('pad'); }); } catch (e) { $('perm').hidden = true; listen(1800); }
  };
  $('permPad').onclick = function () { $('perm').hidden = true; setMode('pad'); };
  function listen(waitMs, onNone) {
    if (!sensor.listening) { window.addEventListener('deviceorientation', onOrient); sensor.listening = true; }
    clearTimeout(sensor.wait);
    sensor.wait = setTimeout(function () { if (sensor.got || sensor.mode) return; if (onNone) onNone(); else noSensor('No motion sensor found.'); }, waitMs || 1800);
  }
  function noSensor(why) { toast(why + ' Drag on the pad to aim.', 4000); setMode('pad'); }
  function onOrient(e) {
    if (e.alpha == null || e.beta == null) return;
    sensor.v = AIM.vec(e.alpha, e.beta, e.gamma, 'top');
    var now = performance.now(); sensor.recent.push([now, sensor.v]); while (sensor.recent.length && now - sensor.recent[0][0] > 600) sensor.recent.shift();
    if (!sensor.got) { sensor.got = true; clearTimeout(sensor.wait); if (!sensor.mode) setMode('gyro'); }
  }
  function setMode(m) {
    sensor.mode = m; $('modeBtn').textContent = m === 'pad' ? 'Touchpad' : 'Motion';
    $('zone').classList.toggle('pad', m === 'pad'); $('zoneHint').textContent = m === 'pad' ? 'Drag here to aim (push to the edge to turn)' : 'Swing the phone to turn \u00b7 tilt to aim';
    if (m === 'gyro' && !sensor.listening) listen(1800);
    if (m === 'gyro' && !cal.done && me.role) startCal();
    if (m === 'pad') { $('cal').hidden = true; send({ t: 'cal', step: null, done: true }); }
  }
  $('modeBtn').onclick = function () { setMode(sensor.mode === 'pad' ? 'gyro' : 'pad'); };
  // yaw / pitch of the pointing vector (world frame: x east, y north, z up)
  function yp(v) { return [Math.atan2(v[0], v[1]), Math.asin(clamp(v[2], -1, 1))]; }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function avgV(fromMs, toMs) {   // the aim averaged over a window before now (skips the jolt of the tap itself)
    var now = performance.now(), s = [0, 0, 0], n = 0;
    sensor.recent.forEach(function (r) { var age = now - r[0]; if (age <= fromMs && age >= toMs) { s[0] += r[1][0]; s[1] += r[1][1]; s[2] += r[1][2]; n++; } });
    return n ? AIM.norm(s) : sensor.v;
  }

  // ------------------------------------------------------------------ calibration: centre, left edge, right edge
  var saved = null; try { saved = JSON.parse(store.get('ms_cal') || 'null'); } catch (e) {}
  var cal = { step: -1, done: false, yaw0: 0, pitch0: 0, half: (saved && saved.half) || A.defaultSpanDeg / 2 * D2R, tmp: {} };
  var CAL_TXT = ['Point the top of your phone at the <b>CENTRE</b> of the TV', 'Now point at the <b>LEFT EDGE</b> of the TV', 'Now the <b>RIGHT EDGE</b> of the TV'];
  function startCal() { cal.step = 0; showCal(); }
  function showCal() { $('cal').hidden = false; $('calStep').textContent = (cal.step + 1) + ' / 3'; $('calText').innerHTML = CAL_TXT[cal.step]; send({ t: 'cal', step: cal.step }); }
  $('calTap').onclick = function () {
    var v = avgV(380, 70); if (!v) { toast('No motion data yet. Move the phone a little.'); return; }
    var a = yp(v); vib(25);
    if (cal.step === 0) { cal.yaw0 = a[0]; cal.pitch0 = a[1]; }
    else if (cal.step === 1) cal.tmp.L = wrap(a[0] - cal.yaw0);
    else if (cal.step === 2) {
      var R = wrap(a[0] - cal.yaw0), span = (R - cal.tmp.L) / 0.9;
      if (span < A.minSpanDeg * D2R) { toast('Those were too close together. Swing to each edge of the TV.'); cal.step = 1; showCal(); return; }
      cal.half = span / 2; cal.yaw0 = wrap(cal.yaw0 + (R + cal.tmp.L) / 2 * 0.5);
      store.set('ms_cal', JSON.stringify({ half: cal.half }));
      return finishCal();
    }
    cal.step++; showCal();
  };
  $('calSkip').onclick = function () { var v = sensor.v; if (v) { var a = yp(v); cal.yaw0 = a[0]; cal.pitch0 = a[1]; } finishCal(); };
  function finishCal() { cal.step = -1; cal.done = true; $('cal').hidden = true; send({ t: 'cal', step: null, done: true }); toast('Calibrated. Push to the edges of the TV to turn.'); vib([20, 40, 20]); }
  $('calBtn').onclick = function () { if (sensor.mode === 'gyro') startCal(); else toast('Calibration is for motion aiming.'); };
  $('recBtn').onclick = function () { if (sensor.v) { var a = yp(sensor.v); cal.yaw0 = a[0]; cal.pitch0 = a[1]; vib(20); toast('Re-centred'); } };
  // stream the aim (screen units: x -1 left .. 1 right, y -1 bottom .. 1 top)
  setInterval(function () {
    if (sensor.mode !== 'gyro' || !sensor.v || !net || cal.step >= 0) return;
    var a = yp(sensor.v), x = wrap(a[0] - cal.yaw0) / cal.half, y = (a[1] - cal.pitch0) / (cal.half * 0.5625);
    send({ t: 'aim', x: +clamp(x, -1.3, 1.3).toFixed(4), y: +clamp(y, -1.3, 1.3).toFixed(4) });
  }, Math.round(1000 / A.sendHz));
  // touchpad
  var zone = $('zone'), pad = { id: null, x: 0, y: 0, ax: 0, ay: 0 };
  zone.addEventListener('pointerdown', function (e) { if (sensor.mode !== 'pad') return; e.preventDefault(); try { zone.setPointerCapture(e.pointerId); } catch (x) {} pad.id = e.pointerId; pad.x = e.clientX; pad.y = e.clientY; });
  zone.addEventListener('pointermove', function (e) { if (pad.id !== e.pointerId) return; pad.ax += e.clientX - pad.x; pad.ay += e.clientY - pad.y; pad.x = e.clientX; pad.y = e.clientY; });
  zone.addEventListener('pointerup', function () { pad.id = null; }); zone.addEventListener('pointercancel', function () { pad.id = null; });
  setInterval(function () { if (!pad.ax && !pad.ay) return; var k = 2.6 / (zone.clientWidth || 300); if (send({ t: 'pad', dx: +(pad.ax * k).toFixed(4), dy: +(pad.ay * k).toFixed(4) })) { pad.ax = 0; pad.ay = 0; } }, 33);

  // ------------------------------------------------------------------ tabs
  var tab = 'combat';
  [].forEach.call($('tabs').children, function (b) { b.onclick = function () { tab = b.getAttribute('data-tab'); [].forEach.call($('tabs').children, function (x) { x.classList.toggle('on', x === b); }); ['combat', 'map', 'set'].forEach(function (t) { $('tab-' + t).hidden = t !== tab; }); if (tab === 'map') drawMap(); }; });

  // ------------------------------------------------------------------ weapons + FIRE
  function buildWeapons(names) {
    var h = ''; names.forEach(function (n, i) { h += '<button data-i="' + i + '" style="--wc:' + C.weapons[i].color + '">' + n + '<small>-</small><i></i></button>'; });
    $('weapons').innerHTML = h;
    [].forEach.call($('weapons').children, function (b) { b.onclick = function () { if (me.seat !== 0) return; send({ t: 'weapon', i: +b.getAttribute('data-i') }); vib(15); }; });
  }
  var fire = $('fire'), firing = null;
  fire.addEventListener('pointerdown', function (e) { e.preventDefault(); try { fire.setPointerCapture(e.pointerId); } catch (x) {} if (firing != null) return; firing = e.pointerId; send({ t: 'fire', d: 1 }); fire.classList.add('down'); vib(12); });
  function fireUp(e) { if (firing !== e.pointerId) return; firing = null; send({ t: 'fire', d: 0 }); fire.classList.remove('down'); }
  fire.addEventListener('pointerup', fireUp); fire.addEventListener('pointercancel', fireUp);
  $('startBtn').onclick = function () { send({ t: 'start' }); vib(40); };
  $('braceBtn').onclick = $('brace2').onclick = function () { send({ t: 'brace' }); vib([40, 30, 80]); };
  var stride = $('strideBtn');
  stride.addEventListener('pointerdown', function (e) { e.preventDefault(); send({ t: 'walk', d: 1 }); stride.classList.add('on'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { stride.addEventListener(ev, function () { send({ t: 'walk', d: 0 }); stride.classList.remove('on'); }); });
  $('autoBtn').onclick = function () { var on = !(st && st.auto); send({ t: 'auto', on: on }); vib(15); };
  $('clearBtn').onclick = function () { send({ t: 'clear' }); vib(10); };
  // eject: press and hold 0.8 s
  var ej = null, ejBtn = $('ejectBtn');
  ejBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); ej = performance.now(); (function grow() { if (ej == null) return; var u = (performance.now() - ej) / 800; $('ejectBar').style.width = Math.min(100, u * 100) + '%'; if (u >= 1) { ej = null; $('ejectBar').style.width = '0'; send({ t: 'eject' }); vib([60, 40, 200]); return; } requestAnimationFrame(grow); })(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { ejBtn.addEventListener(ev, function () { ej = null; $('ejectBar').style.width = '0'; }); });
  var hands = store.get('ms_hands') !== '0';
  function setHandsBtn() { $('handsBtn').textContent = hands ? 'ON' : 'OFF'; $('handsBtn').classList.toggle('on', hands); }
  $('handsBtn').onclick = function () { hands = !hands; store.set('ms_hands', hands ? '1' : '0'); setHandsBtn(); send({ t: 'hands', on: hands }); };
  $('vibBtn').onclick = function () { vibOn = !vibOn; store.set('ms_vib', vibOn ? '1' : '0'); this.textContent = vibOn ? 'ON' : 'OFF'; this.classList.toggle('on', vibOn); };
  setHandsBtn(); if (!vibOn) { $('vibBtn').textContent = 'OFF'; $('vibBtn').classList.remove('on'); }

  // ------------------------------------------------------------------ state from the TV
  var path = [], lastHull = 100;
  function onState(s) {
    var first = !st; st = s; if (first && me.seat === 0 && s.hands !== hands) send({ t: 'hands', on: hands });
    if (s.path) path = s.path;
    $('hull').textContent = s.hull + '%'; $('hull').style.color = s.hull > 50 ? '#5dff9a' : s.hull > 25 ? '#ffd23f' : '#ff4b3a';
    if (s.hull < lastHull - 0.5) vib(s.hull < 25 ? [80, 40, 80] : 60); lastHull = s.hull;
    (s.notes || []).forEach(function (n) { if (n === 'kill') vib([15, 20, 30]); if (n === 'boom') vib(50); if (n === 'down') vib([200, 100, 400]); if (n === 'rail') vib(90); });
    var btns = $('weapons').children;
    for (var i = 0; i < btns.length && s.ammo[i]; i++) {
      var a = s.ammo[i]; btns[i].classList.toggle('on', i === s.w);
      btns[i].querySelector('small').textContent = a[2] >= 0 ? 'loading\u2026' : a[0] + (a[4] ? ' / ' + a[1] : '');
      btns[i].querySelector('i').style.width = (a[2] >= 0 ? a[2] * 100 : 0) + '%';
    }
    var cw = s.ammo[me.seat === 0 ? s.w : 0], rail = me.seat === 0 && s.w === 2;
    fire.classList.toggle('reload', cw && cw[2] >= 0);
    $('fireLbl').textContent = cw && cw[2] >= 0 ? 'LOADING' : rail ? 'CHARGE' : 'FIRE';
    $('fireSub').textContent = rail ? 'hold to charge, let go to fire' : me.seat === 0 && s.w === 1 ? 'tap for one rocket, hold for a volley' : 'hold to keep firing';
    $('chargeBar').style.width = (s.charge * 100) + '%';
    $('startBtn').hidden = !(s.phase === 'lobby' && me.seat === 0);
    $('autoBtn').innerHTML = 'AUTOPILOT <b>' + (s.auto ? 'ON' : 'OFF') + '</b>'; $('autoBtn').classList.toggle('on', s.auto);
    $('strideBtn').hidden = me.seat !== 0 || s.auto;
    if (tab === 'map') drawMap();
  }

  // ------------------------------------------------------------------ topographic map
  var mc = $('map'), mx = mc.getContext('2d'), MS = mc.width, half = Wd.half, base = null;
  function w2c(x, z) { return [(x + half) / (2 * half) * MS, (z + half) / (2 * half) * MS]; }
  function c2w(px, py) { return [px / MS * 2 * half - half, py / MS * 2 * half - half]; }
  function buildBase() {           // contours (marching squares) + roads + buildings + bay, drawn once
    base = document.createElement('canvas'); base.width = base.height = MS; var c = base.getContext('2d');
    c.fillStyle = '#122119'; c.fillRect(0, 0, MS, MS);
    var N = 75, cell = 2 * half / N, H = [];
    for (var j = 0; j <= N; j++) { H.push([]); for (var i = 0; i <= N; i++) H[j].push(Wd.height(-half + i * cell, -half + j * cell)); }
    for (var lv = -3; lv < 30; lv += 1.2) {
      var major = Math.abs(lv % 6) < 0.01; c.strokeStyle = major ? 'rgba(140,220,160,.55)' : 'rgba(110,190,130,.25)'; c.lineWidth = major ? 1.6 : 1; c.beginPath();
      for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
        var a = H[j][i], b = H[j][i + 1], d = H[j + 1][i], e = H[j + 1][i + 1], pts = [];
        function ed(h1, h2, x1, y1, x2, y2) { if ((h1 < lv) !== (h2 < lv)) { var t = (lv - h1) / (h2 - h1); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } }
        ed(a, b, i, j, i + 1, j); ed(b, e, i + 1, j, i + 1, j + 1); ed(d, e, i, j + 1, i + 1, j + 1); ed(a, d, i, j, i, j + 1);
        for (var p = 0; p + 1 < pts.length; p += 2) { c.moveTo(pts[p][0] / N * MS, pts[p][1] / N * MS); c.lineTo(pts[p + 1][0] / N * MS, pts[p + 1][1] / N * MS); }
      }
      c.stroke();
    }
    c.fillStyle = 'rgba(160,170,180,.28)';
    Wd.roads.forEach(function (r) { var a = w2c(r - Wd.roadW / 2, -Wd.city), b = w2c(r + Wd.roadW / 2, Wd.city); c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); a = w2c(-Wd.city, r - Wd.roadW / 2); b = w2c(Wd.city, r + Wd.roadW / 2); c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); });
    Wd.buildings.forEach(function (b) { var a = w2c(b.x - b.w / 2, b.z - b.d / 2), s = MS / (2 * half); c.fillStyle = 'rgba(30,40,52,.95)'; c.fillRect(a[0], a[1], b.w * s, b.d * s); c.strokeStyle = 'rgba(150,170,190,.6)'; c.lineWidth = 1; c.strokeRect(a[0], a[1], b.w * s, b.d * s); });
    var B = Wd.bay, a2 = w2c(B.x - B.w / 2, B.z - B.d / 2), s2 = MS / (2 * half);
    c.strokeStyle = '#5dc8ff'; c.lineWidth = 3; c.strokeRect(a2[0], a2[1], B.w * s2, B.d * s2); c.fillStyle = '#5dc8ff'; c.font = '600 16px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText('BAY', a2[0] + B.w * s2 / 2, a2[1] + B.d * s2 / 2 + 6);
    c.fillStyle = 'rgba(200,230,210,.6)'; c.font = '600 18px Fredoka, sans-serif'; c.fillText('N', MS / 2, 22);
  }
  var drawing = null, preview = null;
  function drawMap() {
    if (!base) buildBase();
    mx.drawImage(base, 0, 0);
    var P = preview || path;
    if (P && P.length) {
      mx.strokeStyle = preview ? '#ffffff' : '#ffd27a'; mx.lineWidth = 4; mx.setLineDash(preview ? [] : [10, 6]); mx.beginPath();
      if (st && !preview) { var s0 = w2c(st.x, st.z); mx.moveTo(s0[0], s0[1]); }
      P.forEach(function (p, i) { var q = w2c(p[0], p[1]); if (i || preview || !st) { if (i === 0 && (preview || !st)) mx.moveTo(q[0], q[1]); else mx.lineTo(q[0], q[1]); } else mx.lineTo(q[0], q[1]); });
      mx.stroke(); mx.setLineDash([]);
      var e = w2c(P[P.length - 1][0], P[P.length - 1][1]); mx.fillStyle = '#ffd27a'; mx.beginPath(); mx.arc(e[0], e[1], 7, 0, Math.PI * 2); mx.fill();
    }
    if (drawing && drawing.pts.length > 1) { mx.strokeStyle = 'rgba(255,255,255,.35)'; mx.lineWidth = 2; mx.beginPath(); drawing.pts.forEach(function (p, i) { if (i) mx.lineTo(p[0], p[1]); else mx.moveTo(p[0], p[1]); }); mx.stroke(); }
    if (!st) return;
    st.en.forEach(function (e) { var q = w2c(e[0], e[1]); mx.fillStyle = e[2] ? '#ff6a3d' : '#ffd23f'; mx.beginPath(); mx.arc(q[0], q[1], e[2] ? 7 : 5, 0, Math.PI * 2); mx.fill(); });
    var m = w2c(st.x, st.z);
    mx.fillStyle = 'rgba(255,176,46,.18)'; mx.beginPath(); mx.moveTo(m[0], m[1]); mx.arc(m[0], m[1], 70, -Math.PI / 2 - st.ty - 0.8, -Math.PI / 2 - st.ty + 0.8); mx.closePath(); mx.fill();   // torso view cone
    mx.save(); mx.translate(m[0], m[1]); mx.rotate(-st.ly); mx.fillStyle = '#ffb02e'; mx.strokeStyle = '#000'; mx.lineWidth = 2;
    mx.beginPath(); mx.moveTo(0, -13); mx.lineTo(9, 10); mx.lineTo(0, 5); mx.lineTo(-9, 10); mx.closePath(); mx.fill(); mx.stroke(); mx.restore();
  }
  function evPt(e) { var r = mc.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * MS, (e.clientY - r.top) / r.height * MS]; }
  mc.addEventListener('pointerdown', function (e) { e.preventDefault(); try { mc.setPointerCapture(e.pointerId); } catch (x) {} drawing = { id: e.pointerId, pts: [evPt(e)] }; preview = null; });
  mc.addEventListener('pointermove', function (e) { if (!drawing || drawing.id !== e.pointerId) return; var p = evPt(e), l = drawing.pts[drawing.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 3) { drawing.pts.push(p); drawMap(); } });
  mc.addEventListener('pointerup', function (e) {
    if (!drawing || drawing.id !== e.pointerId) return; var pts = drawing.pts; drawing = null;
    var len = 0; for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (len < 18) { var w = c2w(pts[0][0], pts[0][1]); send({ t: 'goto', x: +w[0].toFixed(1), z: +w[1].toFixed(1) }); preview = [w]; vib(15); }
    else { var curve = bezierPath(pts); preview = curve; send({ t: 'path', pts: curve.map(function (p) { return [+p[0].toFixed(1), +p[1].toFixed(1)]; }) }); vib([10, 30, 10]); }
    drawMap(); setTimeout(function () { preview = null; drawMap(); }, 900);
  });
  mc.addEventListener('pointercancel', function () { drawing = null; });
  // finger stroke -> simplified (Ramer-Douglas-Peucker) -> Catmull-Rom spline as cubic Beziers -> evenly spaced world points
  function rdp(p, eps) {
    if (p.length < 3) return p.slice(); var a = p[0], b = p[p.length - 1], dm = 0, idx = 0, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (var i = 1; i < p.length - 1; i++) { var d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / L; if (d > dm) { dm = d; idx = i; } }
    if (dm < eps) return [a, b]; return rdp(p.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(p.slice(idx), eps));
  }
  function bezierPath(pts) {
    var P = rdp(pts, 6).map(function (p) { return c2w(p[0], p[1]); }), out = [];
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      var b1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], b2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      for (var k = 0; k < 12; k++) { var t = k / 12, u = 1 - t; out.push([u * u * u * p1[0] + 3 * u * u * t * b1[0] + 3 * u * t * t * b2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * b1[1] + 3 * u * t * t * b2[1] + t * t * t * p2[1]]); }
    }
    out.push(P[P.length - 1]);
    var even = [out[0]], acc = 0;      // resample every ~3 m
    for (i = 1; i < out.length; i++) { acc += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); if (acc >= 3 || i === out.length - 1) { even.push(out[i]); acc = 0; } }
    return even.slice(0, 160);
  }
  window.MP = { state: function () { return st; }, me: function () { return me; }, cal: cal, sensor: sensor, bezierPath: bezierPath, send: send };
})();
