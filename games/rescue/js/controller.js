/* RED DEER RESCUE - phone: join with a name/initials, vote destinations, call huddles, chat in huddles. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search), $ = function (i) { return document.getElementById(i); };
  var room = (Q.get('room') || '').toUpperCase(), LOCAL = Q.get('local') === '1', net = null, st = null;
  var pid = localStorage.getItem('rdr-pid') || ('p' + Math.random().toString(36).slice(2, 10)); localStorage.setItem('rdr-pid', pid);
  if (Q.get('pid')) pid = Q.get('pid');     // tests: several phones in one browser
  var name = Q.get('name') || localStorage.getItem('rdr-name') || '';
  $('nm').value = name; if (!room) $('rc').classList.remove('hide');
  $('go').onclick = function () {
    name = $('nm').value.trim().toUpperCase().slice(0, 10); if (!name) { $('jmsg').textContent = 'Type a name or 3 initials'; return; }
    if (!room) room = $('rc').value.trim().toUpperCase(); if (room.length !== 4) { $('jmsg').textContent = 'Room code is the 4 letters on the TV'; return; }
    localStorage.setItem('rdr-name', name); start();
  };
  if (Q.get('auto') === '1' && name && room) start();
  function start() {
    $('jmsg').textContent = 'Connecting\u2026';
    var o = { code: room, onStatus: function (s) { $('status').className = s === 'online' ? 'on' : ''; if (s === 'noroom') $('jmsg').textContent = 'No TV with code ' + room + ' yet\u2026 retrying'; },
      onOpen: function () { net.send({ t: 'hello', id: pid, name: name }); },
      onMessage: onMsg };
    net = LOCAL ? new LRNet.LocalClient(o) : new LRNet.Client(o);
  }
  function onMsg(m) {
    if (m.t === 'welcome') { $('join').classList.add('hide'); $('app').classList.remove('hide'); $('hname').textContent = m.hero.name; $('chip').style.background = m.hero.color; $('role').textContent = m.hero.role; $('pname').textContent = '\u00b7 ' + name; return; }
    if (m.t !== 'state') return; st = m; draw();
  }
  function send(m) { if (net) net.send(m); }
  function draw() {
    var m = st, me = m.me || {}, max = Math.max(1, m.total);
    $('hp').firstChild.style.width = (me.dead ? 0 : me.hp) + '%';
    $('vinfo').textContent = (m.dest ? (m.arrived ? 'at ' : '\u2192 ') + m.dest + ' \u00b7 ' : '') + 'needs ' + m.need;
    var html = m.opts.map(function (o) { return '<button class="opt' + (me.vote === o.id ? ' mine' : '') + '" data-id="' + o.id + '"><div class="bar" style="width:' + (o.v / max * 100) + '%"></div><div class="th" style="left:' + (m.need / max * 100) + '%"></div><span>' + o.ic + ' ' + o.n + '</span><em>' + o.v + '</em></button>'; }).join('');
    if ($('opts')._h !== html) { $('opts').innerHTML = html; $('opts')._h = html; }
    var hb = $('hud'); hb.classList.toggle('on', !!me.huddle);
    hb.innerHTML = m.huddle.active ? (me.huddle ? '\uD83D\uDEB6 Leave huddle' : '\uD83E\uDD1D Join huddle') : me.huddle ? '\u23F3 Huddle called (' + m.huddle.count + '/' + m.total + ') \u2014 tap to cancel' : '\uD83E\uDD1D Call a huddle (' + m.huddle.count + '/' + m.total + ')';
    $('hmsg').textContent = m.huddle.msg || '';
    $('chat').classList.toggle('hide', !m.huddle.active);
    var log = m.chat.map(function (c) { return '<div><b style="color:' + c.c + '">' + esc(c.who) + ':</b> ' + esc(c.text) + '</div>'; }).join('');
    if ($('log')._h !== log) { $('log').innerHTML = log; $('log')._h = log; }
    $('team').textContent = (me.dead ? '\uD83D\uDCA4 Your hero is down, back in a few seconds. ' : '') + 'You: \uD83D\uDC07 ' + me.ko + ' \u2B50 ' + me.stars + ' \u00b7 Team: \uD83D\uDC07 ' + m.ko + ' \u2B50 ' + m.stars + '/' + m.statues;
  }
  $('opts').onclick = function (e) { var b = e.target.closest('.opt'); if (b) send({ t: 'vote', id: b.dataset.id }); };
  $('hud').onclick = function () { send({ t: 'huddle', on: !(st && st.me && st.me.huddle) }); };
  $('quick').onclick = function (e) { if (e.target.tagName === 'BUTTON') send({ t: 'chat', text: e.target.textContent }); };
  $('send').onclick = function () { var v = $('txt').value.trim(); if (v) send({ t: 'chat', text: v }); $('txt').value = ''; };
  $('txt').onkeydown = function (e) { if (e.key === 'Enter') $('send').onclick(); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
