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
      onOpen: function () { if (Q.get('hero') != null) net.send({ t: 'hello', id: pid, name: name, hero: +Q.get('hero') }); else showPick(); },
      onMessage: onMsg };
    net = LOCAL ? new LRNet.LocalClient(o) : new LRNet.Client(o);
  }
  // v0.2 join screen: every hero listed, the ones other phones are using marked 'in use', downed ones 'respawning shortly'
  var pickT = 0;
  function showPick() { $('join').classList.add('hide'); $('app').classList.add('hide'); $('pick').classList.remove('hide'); net.send({ t: 'list', id: pid }); clearInterval(pickT); pickT = setInterval(function () { net.send({ t: 'list', id: pid }); }, 1500); }
  function drawPick(list) {
    $('plist').innerHTML = list.map(function (h) { return '<button class="hero' + (h.use ? ' use' : '') + (h.dead ? ' dead' : '') + (h.mine ? ' mine' : '') + '" data-i="' + h.i + '"' + (h.use ? ' disabled' : '') + '><span class="c" style="background:' + h.c + '"></span><span><b>' + esc(h.n) + '</b><span class="s">' + esc(h.r) + '</span></span>' +
      (h.use ? '<em>in use \u00b7 ' + esc(h.by) + '</em>' : h.dead ? '<em>respawning shortly</em>' : h.mine ? '<em>yours</em>' : '<em>free</em>') + '</button>'; }).join('');
  }
  $('plist').onclick = function (e) { var b = e.target.closest('.hero'); if (!b || b.disabled) return; clearInterval(pickT); net.send({ t: 'hello', id: pid, name: name, hero: +b.dataset.i }); };
  $('swap').onclick = function () { showPick(); };
  function onMsg(m) {
    if (m.t === 'roster') { drawPick(m.list); return; }
    if (m.t === 'welcome') { clearInterval(pickT); $('pick').classList.add('hide'); $('join').classList.add('hide'); $('app').classList.remove('hide'); $('hname').textContent = m.hero.name; $('chip').style.background = m.hero.color; $('role').textContent = m.hero.role; $('pname').textContent = '\u00b7 ' + name; return; }
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
