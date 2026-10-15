/* IRON STRIDE SQUAD - phone: tactical Titan controls on a heading-free top-down map. */
(function () {
  'use strict';
  var U = new URLSearchParams(location.search), $ = function (i) { return document.getElementById(i); }, W = window.MechWorld;
  var tok = localStorage.getItem('sq-token') || Math.random().toString(36).slice(2); localStorage.setItem('sq-token', tok);
  $('room').value = (U.get('room') || '').toUpperCase(); $('name').value = localStorage.getItem('sq-name') || '';
  var net = null, st = null, zoom = 3, cvs = $('map'), ctx = cvs.getContext('2d'), flash = null;
  function send(m) { if (net) net.send(m); }
  $('go').onclick = function () { var code = $('room').value.toUpperCase().replace(/[^A-Z]/g, ''); if (code.length !== 4) { $('st').textContent = 'Enter the 4-letter room code on the TV'; return; }
    localStorage.setItem('sq-name', $('name').value);
    var o = { code: code, onStatus: function (s) { $('st').textContent = s === 'online' ? '' : s; }, onOpen: function () { send({ t: 'hello', token: tok, name: $('name').value || 'Titan' }); }, onMessage: onMsg };
    net = U.get('local') === '1' ? new window.LRNet.LocalClient(o) : new window.LRNet.Client(o); };
  function onMsg(m) { if (m.t === 'welcome') { $('join').style.display = 'none'; $('play').style.display = 'flex'; $('me').style.color = m.color; resize(); }
    if (m.t === 'reject') $('st').textContent = m.reason; if (m.t === 'st') { st = m; hud(); } }
  function resize() { var r = cvs.getBoundingClientRect(), d = devicePixelRatio || 1; cvs.width = r.width * d; cvs.height = r.height * d; } addEventListener('resize', resize);
  // map transform: world (x,z) -> screen; centred on the Titan, north up (same as the TV: up on screen = -z)
  function ctr() { return st && st.me ? [st.me.x, st.me.z] : [0, 0]; }
  function w2s(x, z) { var c = ctr(), d = devicePixelRatio || 1; return [cvs.width / 2 + (x - c[0]) * zoom * d, cvs.height / 2 + (z - c[1]) * zoom * d]; }
  function s2w(px, py) { var c = ctr(), d = devicePixelRatio || 1; return [c[0] + (px * d - cvs.width / 2) / (zoom * d), c[1] + (py * d - cvs.height / 2) / (zoom * d)]; }
  cvs.addEventListener('pointerup', function (e) { if (!st || !st.me) return; var r = cvs.getBoundingClientRect(), w = s2w(e.clientX - r.left, e.clientY - r.top), best = null, bd = 26 / zoom;
    (st.e || []).forEach(function (en) { var d = Math.hypot(en[1] - w[0], en[2] - w[1]); if (d < bd) { bd = d; best = en; } });
    if (best) { send({ t: 'target', id: best[0] }); flash = { x: best[1], z: best[2], t: performance.now(), c: '#ff4a3a' }; }
    else { send({ t: 'move', x: w[0], z: w[1] }); flash = { x: w[0], z: w[1], t: performance.now(), c: '#7dff6a' }; }
    if (navigator.vibrate) navigator.vibrate(15); });
  $('zi').onclick = function () { zoom = Math.min(6, zoom * 1.35); }; $('zo').onclick = function () { zoom = Math.max(0.8, zoom / 1.35); };
  $('bSiege').onclick = function () { send({ t: 'fire', w: 'siege' }); }; $('bBarrage').onclick = function () { send({ t: 'fire', w: 'barrage' }); if (navigator.vibrate) navigator.vibrate([20, 30, 20]); };
  $('bJump').onclick = function () { send({ t: 'jump' }); if (navigator.vibrate) navigator.vibrate(40); };
  $('bStomp').onclick = function () { send({ t: 'fire', w: 'stomp' }); if (navigator.vibrate) navigator.vibrate(60); };
  $('bAuto').onclick = function () { send({ t: 'auto', on: !(st && st.me && st.me.auto) }); }; $('bHold').onclick = function () { send({ t: 'stop' }); }; $('bClear').onclick = function () { send({ t: 'target', id: null }); };
  $('start').onclick = function () { send({ t: 'start' }); };
  function hud() { var me = st.me; $('start').style.display = st.phase === 'lobby' ? 'block' : 'none'; $('sc').textContent = 'Hero ' + st.score + ' \u00b7 city dmg ' + (st.collat || 0);
    if (!me) { $('info').innerHTML = '<span>Waiting for the TV to start</span>'; return; }
    $('hp').firstChild.style.width = Math.max(0, me.hp / me.max * 100) + '%';
    ['siege', 'barrage', 'jump', 'stomp'].forEach(function (k) { var b = $('b' + k[0].toUpperCase() + k.slice(1)); b.classList.toggle('cd', me.cd[k] > 0); b.querySelector('s').style.width = (me.cd[k] * 100) + '%'; });
    $('bAuto').textContent = 'Auto-fire ' + (me.auto ? 'ON' : 'OFF'); $('bAuto').classList.toggle('on', me.auto);
    $('info').innerHTML = me.dead ? '<span>Titan down \u00b7 rebuilding in ' + me.resp + 's</span>' : me.tgt ? (me.sees === me.tgt ? '<span style="color:#7dff6a">Locked \u00b7 clear shot</span>' : '<span style="color:#ffb02e">Locked \u00b7 no line of sight: a building is in the way</span>') : me.path ? '<span>Walking\u2026</span>' : '<span>Tap the map to walk \u00b7 tap a red enemy to lock</span>'; }
  function draw() {
    var d = devicePixelRatio || 1; ctx.fillStyle = '#16202a'; ctx.fillRect(0, 0, cvs.width, cvs.height);
    if (st) {
      ctx.strokeStyle = '#2a3642'; ctx.lineWidth = W.roadW * zoom * d; W.roads.forEach(function (r) { var a = w2s(r, -W.city), b = w2s(r, W.city), c = w2s(-W.city, r), e = w2s(W.city, r); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.stroke(); });
      W.buildings.forEach(function (b) { var p = w2s(b.x - b.w / 2, b.z - b.d / 2); ctx.fillStyle = 'hsl(205,12%,' + (30 + b.h / 2) + '%)'; ctx.fillRect(p[0], p[1], b.w * zoom * d, b.d * zoom * d); });
      var me = st.me;
      if (me && me.path && me.path.length) { ctx.strokeStyle = '#7dff6a'; ctx.setLineDash([8 * d, 6 * d]); ctx.lineWidth = 3 * d; ctx.beginPath(); var p0 = w2s(me.x, me.z); ctx.moveTo(p0[0], p0[1]); me.path.forEach(function (q) { var p = w2s(q[0], q[1]); ctx.lineTo(p[0], p[1]); }); ctx.stroke(); ctx.setLineDash([]); }
      (st.e || []).forEach(function (en) { var p = w2s(en[1], en[2]); ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); if (en[3]) ctx.rect(p[0] - 5 * d, p[1] - 5 * d, 10 * d, 10 * d); else ctx.arc(p[0], p[1], 4.5 * d, 0, 7); ctx.fill();
        if (me && me.tgt === en[0]) { ctx.strokeStyle = me.sees === en[0] ? '#7dff6a' : '#ffb02e'; ctx.lineWidth = 2.5 * d; ctx.strokeRect(p[0] - 11 * d, p[1] - 11 * d, 22 * d, 22 * d); var mp = w2s(me.x, me.z); ctx.setLineDash([4 * d, 5 * d]); ctx.beginPath(); ctx.moveTo(mp[0], mp[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); ctx.setLineDash([]); } });
      (st.m || []).forEach(function (m) { if (m[4]) return; var p = w2s(m[0], m[1]); ctx.fillStyle = m[3]; ctx.beginPath(); ctx.arc(p[0], p[1], (m[2] ? Math.max(6, 14 * zoom * 0.5) : 4) * d, 0, 7); ctx.globalAlpha = m[2] ? 0.55 : 1; ctx.fill(); ctx.globalAlpha = 1; });
      if (me && !me.dead) { var c = w2s(me.x, me.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * d; ctx.beginPath(); ctx.arc(c[0], c[1], 14 * zoom * 0.5 * d + 4 * d, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + Math.sin(me.aim) * 40 * d, c[1] + Math.cos(me.aim) * 40 * d); ctx.stroke(); }
      if (flash && performance.now() - flash.t < 500) { var f = w2s(flash.x, flash.z), u = (performance.now() - flash.t) / 500; ctx.strokeStyle = flash.c; ctx.globalAlpha = 1 - u; ctx.lineWidth = 3 * d; ctx.beginPath(); ctx.arc(f[0], f[1], (8 + u * 20) * d, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    requestAnimationFrame(draw);
  }
  if (U.get('room') && U.get('auto') === '1') $('go').onclick();
  window.SQP = { get st() { return st; }, send: send };
  requestAnimationFrame(draw);
})();
