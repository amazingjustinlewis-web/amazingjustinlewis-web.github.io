/* LASER RANGE - phone controller (v0.1). Dead simple: aim by pointing the phone (or drag the touchpad),
   big SHOOT button at the bottom (tap, or hold to charge when you have the charge cannon), swipe to blast. */
(function () {
  'use strict';
  var C = window.LR_CONFIG, AIM = window.LRAim, SFX = window.LRSfx;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var setH = function (el, h) { if (el._h === h) return; el._h = h; el.innerHTML = h; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local');
  var clientId = Q.get('cid') || store.get('lr_client') || ('P' + Math.random().toString(36).slice(2, 10)); if (!Q.get('cid')) store.set('lr_client', clientId);
  var net = null, st = null, lastFx = null, joined = false;
  var sensor = { mode: null, listening: false, got: false, v: null, sentV: null, sentAt: 0, events: 0, denied: false };
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function send(m) { return net ? net.send(m) : false; }
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 2600); }
  function show(id) { ['join', 'main'].forEach(function (k) { $(k).hidden = k !== id; }); }

  // ------------------------------------------------------------------ join
  $('room').value = (Q.get('room') || store.get('lr_room') || '').toUpperCase().slice(0, 4);
  $('name').value = Q.get('name') || store.get('lr_name') || '';
  $('room').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('joinBtn').onclick = function () { join(true); };
  function join(gesture) {
    var code = $('room').value.trim(), name = $('name').value.trim();
    if (code.length !== 4) { $('joinStatus').textContent = 'Type the 4-letter room code from the TV.'; return; }
    if (!name) { $('joinStatus').textContent = 'Type your name.'; $('name').focus(); return; }
    store.set('lr_room', code); store.set('lr_name', name);
    if (gesture) { SFX.unlock(); goFullscreen(); }
    requestWake();
    joined = true; $('joinStatus').textContent = 'Connecting\u2026';
    var opts = { code: code, onOpen: function () { send({ t: 'hello', clientId: clientId, name: name }); },
      onMessage: onMsg, onStatus: function (s) { $('conn').className = 'conn' + (s === 'online' ? ' on' : s === 'noroom' || s === 'offline' ? ' bad' : '');
        if (!st) $('joinStatus').textContent = s === 'noroom' ? 'No room ' + code + ' yet. Is Laser Range open on the TV?' : s === 'online' ? 'Joined!' : s === 'offline' ? 'Cannot reach the room server. Check the Wi-Fi.' : 'Connecting\u2026'; } };
    if (net && net.destroy) net.destroy();
    net = LOCAL ? new window.LRNet.LocalClient(opts) : new window.LRNet.Client(opts);
  }
  // reload / rejoin: same room in the link and a saved name -> straight back in
  if (Q.get('room') && $('name').value && (Q.has('auto') || store.get('lr_room') === $('room').value)) setTimeout(function () { join(false); }, 50);
  function goFullscreen() {     // keeps swipes away from the browser's own gestures (Android; iPhones ignore this)
    try { var d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen && /Android/i.test(navigator.userAgent)) d.requestFullscreen().then(function () { try { screen.orientation.lock('portrait').catch(function () {}); } catch (e) {} }).catch(function () {}); } catch (e) {}
  }
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && joined) requestWake(); });

  function onMsg(m) {
    if (!m) return;
    if (m.t === 'welcome') {
      show('main'); document.documentElement.style.setProperty('--pc', m.color);
      if (sensor.mode) send({ t: 'mode', m: sensor.mode }); else setupSensors();
      return;
    }
    if (m.t === 'reject') { $('joinStatus').textContent = m.reason; show('join'); st = null; if (net && net.destroy) net.destroy(); net = null; return; }
    if (m.t === 'toast') { toast(m.text, 4200); vib(80); return; }
    if (m.t === 'state') onState(m);
  }

  // ------------------------------------------------------------------ motion sensor
  function needsPermission() { return typeof window.DeviceOrientationEvent !== 'undefined' && typeof window.DeviceOrientationEvent.requestPermission === 'function'; }
  function setupSensors() {
    if (sensor.mode) return;
    if (Q.has('pad')) { setMode('pad'); return; }
    if (typeof window.DeviceOrientationEvent === 'undefined') { noSensor('This browser has no motion sensor support.'); return; }
    // Android: events just start flowing. iPhone/iPad: nothing arrives until we ask from a tap, so then show the button.
    listen(900, function () { if (needsPermission() && !sensor.asked) $('perm').hidden = false; else noSensor('No motion sensor found on this phone.'); });
  }
  $('permBtn').onclick = function () {
    SFX.unlock(); sensor.asked = true;
    try {
      window.DeviceOrientationEvent.requestPermission().then(function (r) {
        if (r === 'granted') { $('perm').hidden = true; listen(1800); }
        else { sensor.denied = true; $('permMsg').textContent = 'Motion access was refused. To allow it: close this tab, open the link again and tap Allow. Using the touchpad for now.'; setTimeout(function () { $('perm').hidden = true; setMode('pad'); }, 2600); }
      }).catch(function () { $('permMsg').textContent = 'Could not ask for motion access. Using the touchpad.'; setTimeout(function () { $('perm').hidden = true; setMode('pad'); }, 1800); });
    } catch (e) { $('perm').hidden = true; listen(1800); }
  };
  $('permPad').onclick = function () { $('perm').hidden = true; setMode('pad'); };
  function listen(waitMs, onNone) {
    if (!sensor.listening) { window.addEventListener('deviceorientation', onOrient, true); sensor.listening = true; }
    clearTimeout(sensor.wait);
    sensor.wait = setTimeout(function () { if (sensor.got || sensor.mode) return; if (onNone) onNone(); else noSensor('No motion sensor found on this phone.'); }, waitMs || 1800);
  }
  function noSensor(why) { toast(why + ' Drag on the pad to aim.', 4200); setMode('pad'); }
  function onOrient(e) {
    if (e.alpha == null || e.beta == null) return;            // no gyro / compass (some phones report only tilt)
    sensor.events++;
    sensor.v = AIM.vec(e.alpha, e.beta, e.gamma, C.aim.axis);
    if (!sensor.got) { sensor.got = true; clearTimeout(sensor.wait); if (!sensor.mode) setMode('gyro'); }
  }
  function setMode(m) {
    sensor.mode = m; send({ t: 'mode', m: m });
    if (m === 'gyro' && !sensor.listening) listen(1800);
    render();
  }
  setInterval(function () {            // stream the aim to the TV
    if (sensor.mode !== 'gyro' || !sensor.v || !net) return;
    var v = sensor.v, s = sensor.sentV, now = Date.now();
    if (s && Math.abs(v[0] - s[0]) + Math.abs(v[1] - s[1]) + Math.abs(v[2] - s[2]) < 0.0004 && now - sensor.sentAt < 400) return;
    if (send({ t: 'aim', v: [+v[0].toFixed(5), +v[1].toFixed(5), +v[2].toFixed(5)] })) { sensor.sentV = v; sensor.sentAt = now; }
  }, Math.round(1000 / C.aim.sendHz));

  // ------------------------------------------------------------------ touchpad (aim) and swipe (blast)
  var zone = $('zone'), pad = { id: null, x: 0, y: 0, ax: 0, ay: 0 }, sw = null;
  zone.addEventListener('pointerdown', function (e) {
    e.preventDefault(); try { zone.setPointerCapture(e.pointerId); } catch (x) {}
    if (sensor.mode === 'pad') { pad.id = e.pointerId; pad.x = e.clientX; pad.y = e.clientY; }
    sw = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
  });
  zone.addEventListener('pointermove', function (e) {
    if (sensor.mode === 'pad' && pad.id === e.pointerId) { pad.ax += e.clientX - pad.x; pad.ay += e.clientY - pad.y; pad.x = e.clientX; pad.y = e.clientY; }
  });
  function zoneUp(e) {
    if (pad.id === e.pointerId) pad.id = null;
    if (!sw || sw.id !== e.pointerId) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = Date.now() - sw.t, d = Math.sqrt(dx * dx + dy * dy); sw = null;
    if (sensor.mode !== 'pad' && d >= C.swipe.minDistPx && dt <= C.swipe.maxMs) blast(dx, dy, e.clientX, e.clientY);
  }
  zone.addEventListener('pointerup', zoneUp); zone.addEventListener('pointercancel', function (e) { if (pad.id === e.pointerId) pad.id = null; sw = null; });
  setInterval(function () {
    if (!pad.ax && !pad.ay) return;
    var w = zone.clientWidth || 300, k = C.pad.sensitivity / w;
    if (send({ t: 'pad', dx: +(pad.ax * k).toFixed(4), dy: +(pad.ay * k * 16 / 9).toFixed(4) })) { pad.ax = 0; pad.ay = 0; }
  }, Math.round(1000 / C.aim.sendHz));
  function blast(dx, dy, x, y) {
    if (!st || !st.me.hasAim || st.me.cal) return;
    var now = Date.now(); if (now < (blast.until || 0)) return; blast.until = now + C.swipe.cooldownMs;
    send({ t: 'swipe', dx: +dx.toFixed(1), dy: +dy.toFixed(1) }); vib([20, 30, 40]);
    var r = zone.getBoundingClientRect(), b = document.createElement('div'); b.className = 'blast'; b.style.left = (x - r.left) + 'px'; b.style.top = (y - r.top) + 'px'; zone.appendChild(b); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 500);
  }

  // ------------------------------------------------------------------ SHOOT button (tap, or hold to charge; flick off it to blast)
  var shoot = $('shoot'), press = null;
  shoot.addEventListener('pointerdown', function (e) {
    e.preventDefault(); try { shoot.setPointerCapture(e.pointerId); } catch (x) {}
    if (press) return;
    SFX.unlock();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), flicked: false };
    send({ t: 'down' }); shoot.classList.add('down'); vib(12);
    if (st && st.me.hold && !st.me.cal) { shoot.style.setProperty('--charge', C.weapons.charger.chargeMs + 'ms'); shoot.classList.add('charging'); }
  });
  shoot.addEventListener('pointermove', function (e) {
    if (!press || press.id !== e.pointerId || press.flicked) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y, r = shoot.getBoundingClientRect();
    var outside = e.clientX < r.left - 10 || e.clientX > r.right + 10 || e.clientY < r.top - 10;
    if (outside && Date.now() - press.t < 500 && Math.sqrt(dx * dx + dy * dy) > C.swipe.minDistPx) { press.flicked = true; blast(dx, dy, e.clientX, Math.max(r.top, e.clientY)); }
  });
  function shootUp(e) {
    if (!press || press.id !== e.pointerId) return;
    press = null; send({ t: 'up' }); shoot.classList.remove('down'); shoot.classList.remove('charging');
  }
  shoot.addEventListener('pointerup', shootUp); shoot.addEventListener('pointercancel', shootUp);
  shoot.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ------------------------------------------------------------------ tool buttons
  $('recBtn').onclick = function () { send({ t: 'recenter' }); vib(15); };
  $('modeBtn').onclick = function () {
    if (sensor.mode === 'pad') {
      if (needsPermission() && !sensor.got) { $('perm').hidden = false; return; }
      if (!sensor.got) { listen(1800, function () {}); toast('Looking for the motion sensor\u2026'); sensor.mode = null; setTimeout(function () { if (!sensor.got) { sensor.mode = 'pad'; toast('No motion sensor found. Staying on the touchpad.'); render(); } }, 1900); return; }
      setMode('gyro');
    } else setMode('pad');
  };
  $('calBtn').onclick = function () { if (sensor.mode !== 'gyro') { $('modeBtn').onclick(); return; } send({ t: 'calStart' }); };
  $('panel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var a = b.getAttribute('data-a');
    if (a === 'start') send({ t: 'start' }); else if (a === 'again') send({ t: 'start' }); else if (a === 'lobby') send({ t: 'toLobby' });
    else if (a === 'skip') send({ t: 'calSkip' }); else if (a === 'back') send({ t: 'calBack' }); else if (a === 'pad') setMode('pad');
    vib(10);
  });

  // ------------------------------------------------------------------ state from the TV
  function onState(s) {
    var prev = st; st = s;
    handleFx(prev);
    if (s.me.mode && sensor.mode && s.me.mode !== sensor.mode && (!prev || prev.me.mode === s.me.mode)) send({ t: 'mode', m: sensor.mode });   // TV forgot (e.g. it reloaded)
    render();
  }
  function handleFx(prev) {
    var f = st.fx || {};
    if (!lastFx) { lastFx = JSON.parse(JSON.stringify(f)); return; }
    var inc = function (k) { return (f[k] || 0) > (lastFx[k] || 0); };
    if (inc('boom')) vib([60, 30, 120]); else if (inc('hit')) vib(30);
    if (inc('oops')) { vib([80, 60, 80]); toast('Oops! That was granny. -100'); }
    if (inc('power')) { vib([40, 40, 40, 40, 120]); toast('\u26A1 CHARGE CANNON! Hold SHOOT to charge, let go to fire.', 3500); }
    if (inc('calok')) vib(25);
    if (inc('caldone')) { vib([30, 50, 90]); }
    if (inc('calfail')) vib([100, 60, 100]);
    lastFx = JSON.parse(JSON.stringify(f));
  }
  var CAL_POS = { tl: [10, 14], tr: [90, 14], br: [90, 86], bl: [10, 86], c: [50, 50] };
  function render() {
    if (!st) return;
    var me = st.me, ph = st.phase, h = '';
    $('myName').textContent = me.name; $('myScore').textContent = me.score;
    $('chip').style.background = me.color;
    var pd = sensor.mode === 'pad';
    zone.className = pd ? 'pad' : '';
    $('modeBtn').textContent = pd ? '\uD83D\uDCF1 Motion' : '\u270B Touchpad';
    $('calBtn').hidden = pd;
    var lbl = 'SHOOT', cls = '';
    if (!sensor.mode) {
      h = '<div class="big">Setting up aiming\u2026</div><div class="sub">Waiting for the motion sensor</div><div class="row"><button class="smallbtn" data-a="pad">Use the touchpad</button></div>'; cls = 'idle';
    } else if (me.cal) {
      var c = me.cal;
      if (c.kind === 'recenter') h = '<div class="big">Point at the <b>middle</b> of the TV</div><div class="sub">then tap the button below</div>';
      else {
        h = '<div class="big">Point the top of your phone at the <b>' + esc(c.label) + '</b> target</div><div class="sub">Hold it steady, then tap the button (' + (c.step + 1) + ' of ' + c.total + ')</div>';
        h += '<div class="tv">' + C.aim.calPoints.map(function (p, i) { var pos = CAL_POS[p.id] || [p.x * 100, p.y * 100]; return '<i class="' + (i < c.step ? 'done' : i === c.step ? 'on' : '') + '" style="left:' + pos[0] + '%;top:' + pos[1] + '%"></i>'; }).join('') + '</div>';
        h += '<div class="row">' + (c.step > 0 ? '<button class="smallbtn" data-a="back">\u21A9 Back</button>' : '') + '<button class="smallbtn" data-a="skip">Skip</button></div>';
      }
      lbl = 'AIM &amp; TAP'; cls = 'cal';
    } else if (!me.hasAim) {
      h = '<div class="big">Getting ready\u2026</div>'; cls = 'idle';
    } else if (ph === 'lobby') {
      h = '<div class="big">Ready! Try the practice targets.</div>';
      if (me.vip) h += '<div class="row"><button class="startbtn" data-a="start">START ROUND</button></div>';
      else h += '<div class="sub">Waiting for the host to start\u2026</div>';
    } else if (ph === 'countdown') {
      h = '<div class="big">Get ready\u2026 ' + (st.goIn || '') + '</div><div class="sub">' + C.roundSec + ' seconds. Most points wins!</div>';
    } else if (ph === 'play') {
      var t = st.timeLeft; h = '<div class="big">' + Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2) + '</div>';
      h += me.weapon === 'charger' ? '<div class="sub" style="color:var(--gold)">\u26A1 CHARGE CANNON ' + me.weaponLeft + 's: hold, then let go</div>' : '<div class="sub">Tap SHOOT &middot; swipe the pad for a blast</div>';
      if (me.hold) lbl = 'HOLD &amp;<br>RELEASE';
    } else if (ph === 'over') {
      var pl = ['1st', '2nd', '3rd', '4th'];
      h = '<div class="big">' + (me.place ? pl[me.place - 1] + ' place!' : 'Round over') + '</div>';
      if (st.results) h += '<div class="results">' + st.results.map(function (r) { return '<div><span>' + pl[r[3] - 1] + '</span><span style="color:' + r[1] + '">' + esc(r[0]) + ' <small>' + r[4] + '%</small></span><span>' + r[2] + '</span></div>'; }).join('') + '</div>';
      if (me.vip) h += '<div class="row"><button class="startbtn" data-a="again">PLAY AGAIN</button><button class="smallbtn" data-a="lobby">Lobby</button></div>';
    }
    setH($('panel'), h);
    if ($('shootLbl')._h !== lbl) { $('shootLbl')._h = lbl; $('shootLbl').innerHTML = lbl; }
    shoot.className = cls + (press ? ' down' : '') + (press && me.hold && !me.cal ? ' charging' : '');
    setH($('zoneHint'), pd ? 'Drag here to aim<br><small>flick off SHOOT for a blast</small>' : me.cal ? 'Hold the phone like a TV remote:<br>its <b>top edge</b> points at the target' : 'Swipe here to fire a blast');
  }
  window.LRPhone = { sensor: sensor, state: function () { return st; }, setMode: setMode };
})();
