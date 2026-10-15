/* LOST SOCK - phone controller */
(function () {
  'use strict';
  var C = window.LS_CONFIG, Q = new URLSearchParams(location.search), $ = function (id) { return document.getElementById(id); };
  var token = Q.get('tok') || localStorage.getItem('ls-token') || Math.random().toString(36).slice(2); if (!Q.get('tok')) localStorage.setItem('ls-token', token);
  var net = null, S = {}, cur = 'choose', weapon = localStorage.getItem('ls-w') || 'bazooka';
  function show(id) { if (cur === id) return; cur = id; ['choose', 'join', 'lobby', 'play', 'over'].forEach(function (s) { $(s).classList.toggle('on', s === id); }); }
  $('room').value = (Q.get('room') || '').toUpperCase(); $('name').value = Q.get('name') || localStorage.getItem('ls-name') || '';
  function join() {
    var room = $('room').value.toUpperCase().replace(/[^A-Z]/g, ''); if (room.length !== 4) { $('st').textContent = 'Enter the 4-letter code on the TV'; return; }
    var name = $('name').value.trim() || 'Sock boss'; localStorage.setItem('ls-name', name);
    var o = { code: room, onStatus: function (s) { $('st').textContent = s === 'online' ? 'Connected \u00b7 ' + room : s === 'noroom' ? 'No TV with code ' + room + ' yet\u2026' : s + '\u2026'; },
      onOpen: function () { net.send({ t: 'hello', token: token, name: name }); net.send({ t: 'wpn', w: weapon }); net.send({ t: 'pow', v: $('powr').value / 100 }); }, onMessage: onMsg };
    net = Q.get('local') === '1' ? new window.LSNet.LocalClient(o) : new window.LSNet.Client(o);
    $('joinBtn').disabled = true; $('joinBtn').textContent = 'Joining\u2026';
  }
  function phoneUrl() { var room = ($('room').value || Q.get('room') || '').toUpperCase(), n = $('cname').value.trim() || $('name').value.trim() || 'Sock boss'; localStorage.setItem('ls-name', n);
    return 'phone.html?room=' + room + '&name=' + encodeURIComponent(n) + (Q.get('local') === '1' ? '&local=1' : '') + (Q.get('tok') ? '&tok=' + Q.get('tok') : ''); }
  function goTop(u) { try { if (window.top !== window && window.top.location.host === location.host) { window.top.location.href = new URL(u, location.href).href; return; } } catch (e) {} location.href = u; }
  $('cname').value = $('name').value;
  $('chPh').onclick = function () { goTop(phoneUrl()); };
  $('chTv').onclick = function () { if ($('cname').value.trim()) $('name').value = $('cname').value.trim(); show('join'); if (Q.get('room')) join(); };
  $('togPh').onclick = function () { goTop(phoneUrl()); };
  $('joinBtn').onclick = join; if (Q.get('mode') === 'tv') { show('join'); if (Q.get('room') && (Q.get('auto') === '1' || Q.get('name') || localStorage.getItem('ls-name'))) join(); }
  $('startBtn').onclick = function () { net.send({ t: 'start' }); }; $('botsBtn').onclick = function () { net.send({ t: 'bots' }); }; $('againBtn').onclick = function () { net.send({ t: 'start' }); };
  // weapons
  function drawW() { var used = S.used || {};
    $('wpns').innerHTML = C.weapons.map(function (w) { var out = w.limit && (used[w.id] || 0) >= w.limit; return '<button data-w="' + w.id + '" class="' + (w.id === weapon ? 'sel' : '') + (out ? ' no' : '') + '">' + w.icon + '</button>'; }).join('');
    var W0 = C.weapons.filter(function (w) { return w.id === weapon; })[0]; $('wname').innerHTML = '<b>' + W0.name + '</b> ' + W0.desc; }
  $('wpns').addEventListener('click', function (e) { var b = e.target.closest('[data-w]'); if (!b) return; weapon = b.dataset.w; localStorage.setItem('ls-w', weapon); net && net.send({ t: 'wpn', w: weapon }); drawW(); });
  $('powr').oninput = function () { $('powv').textContent = this.value; net && net.send({ t: 'pow', v: this.value / 100 }); };
  $('fire').onclick = function () { net && net.send({ t: 'fire' }); if (navigator.vibrate) navigator.vibrate(40); };
  $('jump').onclick = function () { net && net.send({ t: 'jump' }); };
  // joystick: x = walk, y = aim
  var jz = $('joy'), jid = null, jx0 = 0, jy0 = 0, jv = [0, 0], mouse = false;
  function kpos(x, y) { $('knob').style.left = x + 'px'; $('knob').style.top = y + 'px'; }
  function jstart(x, y) { var r = jz.getBoundingClientRect(); jx0 = x - r.left; jy0 = y - r.top; $('base').style.left = jx0 + 'px'; $('base').style.top = jy0 + 'px'; $('base').style.display = $('knob').style.display = 'block'; kpos(jx0, jy0); }
  function jmove(x, y) { var r = jz.getBoundingClientRect(), dx = x - r.left - jx0, dy = y - r.top - jy0, m = Math.hypot(dx, dy), k = m > 60 ? 60 / m : 1; kpos(jx0 + dx * k, jy0 + dy * k);
    var vx = dx * k / 60, vy = dy * k / 60; jv = [Math.abs(vx) > 0.25 ? vx : 0, Math.abs(vy) > 0.25 ? vy : 0]; }
  function jstop() { jid = null; mouse = false; jv = [0, 0]; $('base').style.display = $('knob').style.display = 'none'; }
  jz.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; jid = t.identifier; jstart(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
  jz.addEventListener('touchmove', function (e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier === jid) jmove(t.clientX, t.clientY); } e.preventDefault(); }, { passive: false });
  jz.addEventListener('touchend', function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === jid) jstop(); }); jz.addEventListener('touchcancel', jstop);
  jz.addEventListener('mousedown', function (e) { mouse = true; jstart(e.clientX, e.clientY); }); addEventListener('mousemove', function (e) { if (mouse) jmove(e.clientX, e.clientY); }); addEventListener('mouseup', function () { if (mouse) jstop(); });
  var lastIn = '';
  setInterval(function () { if (!net || cur !== 'play' || !S.my) return; var k = jv[0].toFixed(2) + ',' + jv[1].toFixed(2); if (k === lastIn && k === '0.00,0.00') return; lastIn = k; net.send({ t: 'in', mx: +jv[0].toFixed(2), ay: +jv[1].toFixed(2) }); }, 60);
  // messages
  function onMsg(m) {
    if (m.t === 'reject') $('st').textContent = m.reason;
    if (m.t === 'welcome' && m.tv === false) { $('st').textContent = 'No TV in this game: opening it on your phone\u2026'; setTimeout(function () { goTop(phoneUrl()); }, 600); }
    if (m.t === 'st') { var was = S.my; S = m; paint(); if (m.my && !was && navigator.vibrate) navigator.vibrate([80, 60, 80]); }
  }
  var wKey = '';
  function paint() {
    var ph = S.phase;
    if (ph === 'lobby') { show('lobby'); $('leadBox').style.display = S.leader ? '' : 'none'; $('botsBtn').textContent = 'AI fill: ' + (S.bots ? 'ON' : 'OFF'); $('lNote').textContent = S.leader ? 'You are the leader: start when everyone has joined (' + S.n + ' team' + (S.n === 1 ? '' : 's') + ').' : 'Waiting for the leader to start.'; }
    else if (ph === 'over') { show('over'); $('oTitle').textContent = S.won ? 'YOUR SOCKS WON!' : S.team === undefined && !S.winner ? 'GAME OVER' : (S.winner || 'Nobody') + ' won';
      $('oTab').innerHTML = [['Damage dealt', S.dmg || 0], ['Socks KO\u2019d', S.kos || 0], ['Socks lost', S.lost || 0]].map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join(''); $('againBtn').style.display = S.leader ? '' : 'none'; }
    else { show('play');
      if (!S.team) { $('team').textContent = 'Watching'; $('turn').textContent = 'Game in progress. You join next game!'; return; }
      $('team').textContent = S.team; $('team').style.color = S.color;
      var wa = Math.round(Math.abs(S.wind) * 5); $('wind').textContent = 'Wind ' + (wa ? (S.wind < 0 ? '\u25C0'.repeat(wa) : '\u25B6'.repeat(wa)) : 'calm');
      $('socks').innerHTML = S.socks.map(function (s) { var ic = { pristine: '\uD83E\uDDE6', tattered: '\uD83E\uDE79', shredded: '\uD83E\uDDF5', lost: '\u271D' }[s[1]]; return '<span>' + ic + ' ' + s[0] + ' <small>' + s[1] + '</small></span>'; }).join('');
      $('turn').textContent = S.aiming ? 'YOUR TURN \u00b7 ' + S.who.split(' (')[0] + ' \u00b7 ' + S.timer + 's' + (S.dizzy ? ' \u00b7 dizzy!' : '') : S.my ? 'RUN! ' + S.timer + 's' : 'Up now: ' + S.who;
      $('turn').style.background = S.aiming ? S.color : S.my ? '#ffe7a0' : '#0004'; $('turn').style.color = S.aiming || S.my ? '#111' : '#fff';
      $('play').classList.toggle('dim', !S.aiming);
      var k = weapon + JSON.stringify(S.used); if (k !== wKey) { wKey = k; drawW(); } }
  }
  drawW();
})();
