/* DRIFT SIGNAL - a crew station phone. Sends intents to the TV (the bridge), renders what the TV says. */
(function () {
  'use strict';
  var C = window.SPACE_CONFIG, $ = function (id) { return document.getElementById(id); };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  $('jTitle').textContent = C.TITLE; document.title = C.TITLE.charAt(0) + C.TITLE.slice(1).toLowerCase() + ' crew station';
  var cid = Q.get('cid') || localStorage.getItem('ds-cid') || ('c' + Math.random().toString(36).slice(2, 10)); if (!Q.get('cid')) localStorage.setItem('ds-cid', cid);
  $('room').value = (Q.get('room') || '').toUpperCase(); $('name').value = Q.get('name') || localStorage.getItem('ds-name') || '';
  var net = null, me = null, S = null, sector = [], byId = {}, topo = null, sites = [], tab = null, onBridge = true;
  function send(m) { return net ? net.send(m) : false; }
  function toast(t) { var e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2200); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 15); } catch (e) {} }

  // ================================================================== join
  var dock = { t0: 0, timer: null, hellos: 0, attempt: 0 };
  function jstat(t) { $('joinStatus').textContent = t; }
  function dockWatch() {        // 'Coming aboard' never hangs silently: re-greet, then say what's wrong, keep retrying
    clearInterval(dock.timer);
    dock.timer = setInterval(function () {
      if (me) { clearInterval(dock.timer); return; }
      var secs = (Date.now() - dock.t0) / 1000, online = net && net.status === 'online';
      if (online && dock.hellos < 6) { dock.hellos++; send({ t: 'hello', clientId: cid, name: dock.name }); }
      else if (online && net.reconnect) { dock.hellos = 0; net.reconnect(); }
      if (secs > 45) { jstat('Can\u2019t reach the ship yet. Is ' + C.TITLE + ' open on the TV, and is this phone on the same Wi-Fi? Still trying\u2026'); $('joinBtn').textContent = 'TRY AGAIN'; }
      else if (secs > 12) jstat(online ? 'Linked, waiting for the bridge to answer\u2026' : 'Still docking\u2026 (try ' + Math.max(1, dock.attempt) + ')');
    }, 3000);
  }
  function join() {
    var room = $('room').value.trim().toUpperCase(), name = $('name').value.trim() || 'Crew';
    if (room.length !== 4) { jstat('Enter the 4-letter code from the bulkhead.'); return; }
    localStorage.setItem('ds-name', name); jstat('Docking\u2026'); $('joinBtn').textContent = 'COMING ABOARD\u2026';
    dock.t0 = Date.now(); dock.hellos = 0; dock.name = name;
    if (net) { if (net.code === room && net.reconnect) { net.reconnect(); dockWatch(); return; } try { net.destroy && net.destroy(); } catch (e) {} net = null; }
    var opts = { code: room, onOpen: function () { dock.hellos = 0; jstat('Linked. Coming aboard\u2026'); send({ t: 'hello', clientId: cid, name: name }); }, onMessage: onMsg,
      onAttempt: function (n) { dock.attempt = n; },
      onStatus: function (s) { $('conn').className = 'conn' + (s === 'online' ? ' on' : ''); if (s === 'noroom' && !me) jstat('No ship with code ' + room + ' yet. Is ' + C.TITLE + ' open on the TV? Retrying\u2026'); } };
    net = LOCAL ? new window.LRNet.LocalClient(opts) : new window.LRNet.Client(opts);
    dockWatch();
  }
  $('joinBtn').onclick = join;
  if (Q.has('auto') || (Q.get('room') && localStorage.getItem('ds-name') && Q.has('rejoin'))) setTimeout(join, 50);

  function onMsg(m) {
    if (!m || !m.t) return;
    if (m.t === 'reject') { clearInterval(dock.timer); jstat(m.reason); $('joinBtn').textContent = 'COME ABOARD'; return; }
    if (m.t === 'welcome') { clearInterval(dock.timer); $('joinBtn').textContent = 'COME ABOARD'; me = m.cid; sector = m.sector; byId = {}; sector.forEach(function (d) { byId[d.id] = d; }); topo = m.topo; sites = m.sites; $('join').hidden = true; $('main').hidden = false; buildCats(); buildSci(); buildSites(); buzz(30); return; }
    if (m.t === 'prompt') { showPrompt(m); return; }
    if (m.t === 'st') { S = m; render(); }
  }

  // ================================================================== tabs + ownership
  function owns(st) { return S && S.asg[st] === me; }
  function isCap() { return S && S.asg.cap === me; }
  function ownerName(st) { var c = S && S.crew.find(function (q) { return q.cid === S.asg[st]; }); return c ? c.name : '?'; }
  var lastTabsKey = '';
  function renderTabs() {
    var cap = isCap(), list = C.stations.filter(function (s) { return s.id === 'cap' ? cap : owns(s.id) || cap; });
    var key = list.map(function (s) { return s.id + (owns(s.id) ? 1 : 0); }).join() + cap;
    if (key !== lastTabsKey) {
      lastTabsKey = key;
      $('tabs').innerHTML = list.map(function (s) { return '<button data-t="' + s.id + '" style="--c:' + s.color + '" class="' + (owns(s.id) || s.id === 'cap' ? '' : 'faded') + '">' + s.short + '</button>'; }).join('') + '<button data-t="set">\u2699</button>';
      if (!tab || !list.concat([{ id: 'set' }]).some(function (s) { return s.id === tab; })) tab = cap ? 'cap' : (list.find(function (s) { return owns(s.id); }) || { id: 'set' }).id;
    }
    [].forEach.call($('tabs').children, function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    [].forEach.call(document.querySelectorAll('.pane'), function (p) { var id = p.dataset.pane, show = id === tab; p.classList.toggle('show', show); p.classList.toggle('faded', show && id !== 'cap' && id !== 'set' && !owns(id)); });
    var rem = tab !== 'cap' && tab !== 'set' && !owns(tab); $('remote').hidden = !rem; if (rem) $('remote').textContent = ownerName(tab) + ' is on ' + C.stations.find(function (s) { return s.id === tab; }).label + '. Your taps here are sent to them as requests.';
    $('myRole').innerHTML = C.stations.filter(function (s) { return s.id === 'cap' ? cap : owns(s.id) && !cap; }).map(function (s) { return '<span class="chip" style="background:' + s.color + '">' + s.short + '</span>'; }).join('') || '<span class="chip" style="background:#456">CREW</span>';
  }
  $('tabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; renderTabs(); drawAll(); };
  // any [data-act] button sends that action
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = JSON.parse(b.dataset.act); act(a);
  });
  function act(a) { a.t = 'act'; send(a); buzz(); var st = { course: 'helm', stop: 'helm', warp: 'helm', view: 'helm', orbit: 'helm', site: 'helm', descend: 'helm', liftoff: 'helm', scan: 'sci', probe: 'sci', shields: 'tac', deflector: 'tac', alert: 'tac', power: 'eng', beacon: 'com', hail: 'com', tow: 'com' }[a.a];
    if (st && !owns(st) && isCap()) toast('Request sent to ' + ownerName(st)); }
  $('bridgeBtn').onclick = function () { onBridge = !onBridge; send({ t: 'bridge', on: onBridge }); render(); };

  // ================================================================== render
  var lastLogN = -1;
  function render() {
    if (!S) return;
    renderTabs();
    var sh = S.ship, b = $('bridgeBtn'); b.textContent = onBridge ? 'ON THE BRIDGE' : 'OFF THE BRIDGE'; b.classList.toggle('on', onBridge);
    $('myName').textContent = (S.crew.find(function (c) { return c.cid === me; }) || {}).name || '';
    // captain overview
    var tgt = sh.course && byId[sh.course.id];
    $('capStatus').innerHTML = '<span>Status <b>' + (sh.loc !== 'space' ? sh.loc.toUpperCase() : sh.w > 0.5 ? 'WARP ' + sh.w : sh.orbit ? 'ORBIT' : sh.sp > 1 ? 'IMPULSE' : 'HOLDING') + '</b></span><span>Alert <b>' + (sh.alert === 'none' ? 'normal' : sh.alert) + '</b></span>' +
      '<span>Shields <b>' + sh.sh + '%</b></span><span>Hull <b>' + sh.hu + '%</b></span><span>Fuel <b>' + sh.fu + '%</b></span><span>Course <b>' + (tgt ? esc(tgt.name) : '\u2014') + '</b></span>' + (tgt ? '<span>ETA <b>' + sh.etaShip + '</b></span><span>Here <b>' + sh.eta + ' s</b></span>' : '');
    $('capView').classList.toggle('on', sh.view); $('helmView').classList.toggle('on', sh.view); $('shBtn').classList.toggle('on', sh.shUp); $('shBtn').textContent = sh.shUp ? 'Shields UP' : 'Shields DOWN'; $('beaconBtn').classList.toggle('on', sh.beacon);
    $('towBtn').disabled = !(S.ev && S.ev.kind === 'distress' && !S.ev.towing);
    renderCrew();
    var lk = S.log.length ? S.log[S.log.length - 1].n : 0;
    if (lk !== lastLogN) { lastLogN = lk; var li = function (f) { return S.log.filter(f).slice().reverse().map(function (l) { return '<li class="' + l.k + '">' + esc(l.t) + '</li>'; }).join(''); };
      $('capLog').innerHTML = li(function () { return true; }); $('sciLog').innerHTML = li(function (l) { return l.k === 'sci'; }); $('comLog').innerHTML = li(function (l) { return /alien|com|crew|urgent/.test(l.k); }); }
    $('probeList').innerHTML = S.probes.length ? S.probes.slice().reverse().map(function (p) { return '<li class="sci">Probe ' + p.n + ' \u2192 ' + esc(byId[p.id] ? byId[p.id].name : p.id) + ' \u00B7 <b>' + p.st + '</b><br><small>' + esc(p.last) + '</small></li>'; }).join('') : '<li>No probes out.</li>';
    $('tacBars').innerHTML = [['Shields', sh.sh, sh.shUp ? '#6fd8ff' : '#556'], ['Hull', sh.hu, sh.hu < 40 ? '#ff6050' : '#9effc4'], ['Fuel', sh.fu, '#ffc46b']].map(function (x) { return '<div>' + x[0] + ' ' + x[1] + '%<i><b style="width:' + x[1] + '%;background:' + x[2] + '"></b></i></div>'; }).join('');
    // landing box
    var pl = sh.orbit && byId[sh.orbit], showLand = (pl && pl.landable) || sh.loc !== 'space';
    $('landBox').hidden = !showLand;
    if (showLand) { $('lMatch').classList.toggle('done', S.land.step >= 1); $('lAlign').classList.toggle('done', S.land.step >= 2); $('lDescend').disabled = S.land.step < 2 || sh.loc !== 'space'; $('lLift').disabled = sh.loc !== 'surface'; [].forEach.call($('siteBtns').children, function (b) { b.classList.toggle('on', b.dataset.site === S.land.site); }); drawTopo(); }
    // settings
    var st = S.set, cap = isCap(); $('capSet').hidden = !cap; $('notCap').hidden = cap;
    $('modeLbl').textContent = st.preset === 'default' ? 'DEFAULT' : 'CUSTOM';
    segOn('segDanger', st.danger); segOn('segVoice', st.voice); pill('droneBtn', st.drone); pill('wildBtn', st.wild);
    if (document.activeElement !== $('hueMin') && document.activeElement !== $('hueMax')) { $('hueMin').value = st.hue.min; $('hueMax').value = st.hue.max; } $('hueLbl').textContent = st.hue.min + '% \u2013 ' + st.hue.max + '%';
    renderEnc(); updateWarpLbl(); drawAll();
  }
  function segOn(id, v) { [].forEach.call($(id).children, function (b) { b.classList.toggle('on', b.dataset.v === v); }); }
  function pill(id, on) { $(id).classList.toggle('on', !!on); $(id).textContent = on ? 'ON' : 'OFF'; }
  $('segDanger').onclick = function (e) { var v = e.target.dataset.v; if (v) send({ t: 'set', k: 'danger', v: v }); };
  $('segVoice').onclick = function (e) { var v = e.target.dataset.v; if (v) send({ t: 'set', k: 'voice', v: v }); };
  $('droneBtn').onclick = function () { send({ t: 'set', k: 'drone', v: !S.set.drone }); };
  $('wildBtn').onclick = function () { send({ t: 'set', k: 'wild', v: !S.set.wild }); };
  $('presetBtn').onclick = function () { send({ t: 'preset' }); toast('Default mode'); };
  function hue() { var a = Math.max(2, +$('hueMin').value), b = Math.max(2, +$('hueMax').value); if (b < a) { if (document.activeElement === $('hueMin')) b = a; else a = b; } $('hueMin').value = a; $('hueMax').value = b; $('hueLbl').textContent = a + '% \u2013 ' + b + '%'; send({ t: 'set', k: 'hue', v: { min: a, max: b, zone: $('hueZone').value } }); }
  $('hueMin').oninput = hue; $('hueMax').oninput = hue;
  // keep-awake (Wake Lock, like Red Deer Rich)
  var wake = { on: false, lock: null };
  function reqWake() { try { navigator.wakeLock.request('screen').then(function (l) { wake.lock = l; }).catch(function () {}); } catch (e) {} }
  $('wakeBtn').onclick = function () { if (!navigator.wakeLock) { toast('This browser can\u2019t keep the screen awake'); return; } wake.on = !wake.on; pill('wakeBtn', wake.on); if (wake.on) reqWake(); else if (wake.lock) { wake.lock.release(); wake.lock = null; } };
  document.addEventListener('visibilitychange', function () { if (wake.on && document.visibilityState === 'visible') reqWake(); });
  $('capView').onclick = $('helmView').onclick = function () { act({ a: 'view', on: !(S && S.ship.view) }); };
  $('shBtn').onclick = function () { act({ a: 'shields', on: !(S && S.ship.shUp) }); };
  $('beaconBtn').onclick = function () { act({ a: 'beacon', on: !(S && S.ship.beacon) }); };

  // ================================================================== captain: crew + drag a station onto a name
  var selChip = null, crewKey = '';
  function renderCrew() {
    if (!isCap()) return;
    var key = JSON.stringify([S.crew, S.asg, selChip]); if (key === crewKey) return; crewKey = key;
    $('stationChips').innerHTML = C.stations.map(function (s) { return '<span class="chip' + (selChip === s.id ? ' sel' : '') + '" data-st="' + s.id + '" style="background:' + s.color + '">' + s.short + '</span>'; }).join('');
    $('crewList').innerHTML = S.crew.map(function (c) {
      var sts = C.stations.filter(function (s) { return S.asg[s.id] === c.cid && (s.id === 'cap' || S.asg.cap !== c.cid); });
      if (S.asg.cap === c.cid) sts = [C.stations[0]].concat(C.stations.slice(1).filter(function (s) { return S.asg[s.id] === c.cid; }));
      return '<li data-cid="' + c.cid + '"><span class="nm">' + esc(c.name) + (c.cid === me ? ' (you)' : '') + '</span><span class="chips">' + sts.map(function (s) { return '<span class="chip" style="background:' + s.color + '">' + s.short + '</span>'; }).join('') + '</span>' + (!c.conn ? '<span class="off">signal lost</span>' : !c.on ? '<span class="off">off the bridge</span>' : '') + '</li>';
    }).join('');
  }
  var drag = null;
  $('stationChips').addEventListener('pointerdown', function (e) { var ch = e.target.closest('.chip'); if (!ch) return; drag = { st: ch.dataset.st, x: e.clientX, y: e.clientY, moved: false, el: null }; e.preventDefault(); });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) { drag.moved = true; drag.el = document.querySelector('[data-st="' + drag.st + '"]').cloneNode(true); drag.el.style.cssText += ';position:fixed;z-index:50;pointer-events:none;'; document.body.appendChild(drag.el); }
    if (drag.el) { drag.el.style.left = e.clientX - 20 + 'px'; drag.el.style.top = e.clientY - 20 + 'px'; var li = document.elementFromPoint(e.clientX, e.clientY); [].forEach.call($('crewList').children, function (x) { x.classList.toggle('drop', li && x.contains(li)); }); }
  });
  window.addEventListener('pointerup', function (e) {
    if (!drag) return; var d = drag; drag = null; if (d.el) d.el.remove(); [].forEach.call($('crewList').children, function (x) { x.classList.remove('drop'); });
    if (!d.moved) { selChip = selChip === d.st ? null : d.st; crewKey = ''; renderCrew(); return; }
    var li = document.elementFromPoint(e.clientX, e.clientY); li = li && li.closest && li.closest('#crewList li'); if (li) assign(d.st, li.dataset.cid);
  });
  $('crewList').addEventListener('click', function (e) { var li = e.target.closest('li'); if (li && selChip) { assign(selChip, li.dataset.cid); selChip = null; crewKey = ''; } });
  function assign(st, to) { send({ t: 'assign', station: st, to: to }); buzz(25); var c = S.crew.find(function (q) { return q.cid === to; }); toast((st === 'cap' ? 'Captaincy' : C.stations.find(function (s) { return s.id === st; }).label) + ' \u2192 ' + (c ? c.name : '')); }
  window.DS_assign = assign;   // for the sim harness

  // ================================================================== captain's requests + alien conversations
  var pendingPrompt = null;
  function showPrompt(m) { pendingPrompt = m; $('prT').innerHTML = '<b>' + esc(m.from) + '</b> asks: ' + esc(m.label); $('prompt').hidden = false; buzz([40, 60, 40]); }
  $('prYes').onclick = function () { if (pendingPrompt) send(pendingPrompt.a); pendingPrompt = null; $('prompt').hidden = true; buzz(); };
  $('prNo').onclick = function () { pendingPrompt = null; $('prompt').hidden = true; };
  var answered = {};
  function renderEnc() {
    var e = S.enc, show = e && e.phase === 'ask' && !answered[e.id + e.text] && onBridge;
    $('encSheet').hidden = !show; if (!show) return;
    $('encSp').textContent = '\u25C8 ' + e.sp.toUpperCase() + ' \u00B7 TRANSLATED'; $('encText').textContent = e.text; $('encLeft').textContent = 'Anyone can answer \u00B7 ' + e.left + ' s';
    var key = e.opts.map(function (o) { return o.id; }).join(); if ($('encOpts').dataset.k !== key) { $('encOpts').dataset.k = key; $('encOpts').innerHTML = e.opts.map(function (o) { return '<button data-o="' + o.id + '">' + esc(o.label) + '</button>'; }).join(''); }
  }
  $('encOpts').onclick = function (ev) { var b = ev.target.closest('button'); if (!b || !S.enc) return; send({ t: 'answer', opt: b.dataset.o }); answered[S.enc.id + S.enc.text] = true; $('encSheet').hidden = true; buzz(30); };

  // ================================================================== HELM: star map, categories, warp
  var mc = $('map'), mx = mc.getContext('2d'), view = { cx: 0, cz: -6000, s: 0.024 }, sel = null;
  function w2s(x, z) { return [mc.width / 2 + (x - view.cx) * view.s, mc.height / 2 + (z - view.cz) * view.s]; }
  function s2w(px, py) { return [(px - mc.width / 2) / view.s + view.cx, (py - mc.height / 2) / view.s + view.cz]; }
  var KCOL = { station: '#ffd27a', planet: '#6fe3ff', blackhole: '#ff9a5a', nebula: '#d08cff', comet: '#bfefff', signal: '#7dffb0', ship: '#ffb0a0' };
  function drawMap() {
    var g = mx, W = mc.width, Hh = mc.height; g.fillStyle = '#03060c'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = 'rgba(95,216,255,.07)'; g.lineWidth = 1; var step = 2000 * view.s; if (step > 20) { var o = w2s(0, 0); for (var x = o[0] % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); } for (var y = o[1] % step; y < Hh; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (!S) return; var sh = S.ship;
    if (sh.course && byId[sh.course.id]) { var a = w2s(sh.x, sh.z), b = w2s(byId[sh.course.id].x, byId[sh.course.id].z); g.setLineDash([8, 8]); g.strokeStyle = '#ffe08a'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); }
    g.font = '22px Fredoka, system-ui'; g.textAlign = 'left';
    sector.forEach(function (d) {
      var p = w2s(d.x, d.z), r = Math.max(5, d.r * view.s), c = KCOL[d.kind] || '#fff';
      g.globalAlpha = d.kind === 'nebula' ? 0.25 : 1; g.fillStyle = c; g.beginPath();
      if (d.kind === 'station') g.rect(p[0] - 7, p[1] - 7, 14, 14); else if (d.kind === 'ship') { g.moveTo(p[0], p[1] - 9); g.lineTo(p[0] + 7, p[1] + 7); g.lineTo(p[0] - 7, p[1] + 7); } else g.arc(p[0], p[1], d.kind === 'signal' ? 5 : r, 0, 6.283);
      if (d.kind === 'blackhole') { g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(p[0], p[1], r * 0.7, 0, 6.283); }
      g.fill(); g.globalAlpha = 1;
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0], p[1] - d.y * view.s * 0.5); g.stroke();   // height tick
      g.fillStyle = sel === d.id ? '#fff' : 'rgba(220,240,255,.8)'; g.fillText(d.name, p[0] + Math.max(r, 8) + 6, p[1] + 7);
      if (sel === d.id) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], Math.max(r, 8) + 8, 0, 6.283); g.stroke(); g.lineWidth = 1; }
    });
    var sp = w2s(sh.x, sh.z); g.save(); g.translate(sp[0], sp[1]); g.rotate(-sh.h + Math.PI); g.fillStyle = '#5dff9a'; g.beginPath(); g.moveTo(0, 14); g.lineTo(9, -9); g.lineTo(0, -4); g.lineTo(-9, -9); g.closePath(); g.fill(); g.restore();
    g.fillStyle = 'rgba(160,200,230,.6)'; g.fillText('2000 km grid \u00B7 ' + Math.round(1 / view.s * 100) + ' km per 100 px', 14, Hh - 14);
  }
  // pan + pinch + tap
  var ptrs = {}, gest = null;
  function mpos(e) { var r = mc.getBoundingClientRect(); return [(e.clientX - r.left) * mc.width / r.width, (e.clientY - r.top) * mc.height / r.height]; }
  mc.addEventListener('pointerdown', function (e) { mc.setPointerCapture(e.pointerId); ptrs[e.pointerId] = mpos(e); var ks = Object.keys(ptrs); gest = ks.length === 1 ? { kind: 'pan', start: ptrs[e.pointerId], view: Object.assign({}, view), moved: false } : { kind: 'pinch', d0: dist2(), s0: view.s }; });
  mc.addEventListener('pointermove', function (e) { if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = mpos(e); if (!gest) return;
    if (gest.kind === 'pan') { var p = ptrs[e.pointerId], dx = p[0] - gest.start[0], dy = p[1] - gest.start[1]; if (Math.hypot(dx, dy) > 10) gest.moved = true; if (gest.moved) { view.cx = gest.view.cx - dx / view.s; view.cz = gest.view.cz - dy / view.s; drawMap(); } }
    else { view.s = clamp(gest.s0 * dist2() / gest.d0, 0.005, 0.5); drawMap(); } });
  function dist2() { var v = Object.keys(ptrs).map(function (k) { return ptrs[k]; }); return v.length < 2 ? 1 : Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]) || 1; }
  mc.addEventListener('pointerup', function (e) { var p = ptrs[e.pointerId]; delete ptrs[e.pointerId]; if (gest && gest.kind === 'pan' && !gest.moved && p) tapMap(p); if (!Object.keys(ptrs).length) gest = null; });
  mc.addEventListener('pointercancel', function (e) { delete ptrs[e.pointerId]; gest = null; });
  mc.addEventListener('wheel', function (e) { e.preventDefault(); view.s = clamp(view.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.005, 0.5); drawMap(); }, { passive: false });
  $('zin').onclick = function () { view.s = Math.min(0.5, view.s * 1.5); drawMap(); }; $('zout').onclick = function () { view.s = Math.max(0.005, view.s / 1.5); drawMap(); };
  $('zme').onclick = function () { if (S) { view.cx = S.ship.x; view.cz = S.ship.z; } drawMap(); };
  function tapMap(p) {
    var best = null, bd = 40; sector.forEach(function (d) { var q = w2s(d.x, d.z), dd = Math.hypot(q[0] - p[0], q[1] - p[1]) - (d.kind === 'nebula' ? 0 : Math.max(0, d.r * view.s - 8)); if (dd < bd) { bd = dd; best = d; } });
    selectObj(best ? best.id : null);
  }
  function selectObj(id) {
    sel = id; drawMap(); var pop = $('pop'); if (!id) { pop.hidden = true; return; }
    var d = byId[id]; pop.hidden = false;
    pop.innerHTML = '<div class="pt">' + esc(d.name) + (d.reviews ? ' <small>' + esc(d.reviews) + '</small>' : '') + '</div><div class="pf">' + esc(d.flavour) + '</div><div class="row"><button class="act go" id="popGo">Set course</button><button class="act" data-act=\'{"a":"scan","id":"' + id + '"}\'>Scan</button><button class="act" data-act=\'{"a":"probe","id":"' + id + '"}\'>Probe</button></div>';
    $('popGo').onclick = function () { act({ a: 'course', id: id, w: +$('warp').value }); pop.hidden = true; };
    updateWarpLbl();
  }
  window.DS_select = selectObj;
  function updateWarpLbl() {
    var w = +$('warp').value, maxW = S ? S.ship.maxW : 9.9; if (w > maxW) { w = maxW; $('warp').value = w; }
    $('warpLbl').textContent = w <= 0 ? 'IMPULSE' : 'WARP ' + w.toFixed(1) + (S && maxW < 9.9 ? '  (max ' + maxW.toFixed(1) + ')' : '');
    var d = byId[sel || (S && S.ship.course && S.ship.course.id)];
    if (d && S) { var dist = Math.max(0, Math.hypot(d.x - S.ship.x, d.y - S.ship.y, d.z - S.ship.z) - d.r * 2.6), secs = dist / C.speedFor(w); $('etaLbl').textContent = esc(d.name) + ': ' + C.fmtShipTime(secs * C.nav.timeScale) + ' (\u2248' + Math.round(secs + 6) + ' s here)'; } else $('etaLbl').textContent = 'tap a destination';
  }
  $('warp').oninput = updateWarpLbl;
  $('warp').onchange = function () { if (S && S.ship.course) act({ a: 'warp', w: +$('warp').value }); };
  function buildCats() {
    $('cats').innerHTML = C.cats.map(function (c) {
      var ents = sector.filter(function (d) { return d.cat === c.id; });
      return '<details><summary>' + c.icon + ' ' + esc(c.label) + ' <small>' + ents.length + '</small></summary>' + ents.map(function (d) { return entry(d, true); }).join('') + '</details>';
    }).join('');
    $('cats').onclick = function (e) { var b = e.target.closest('[data-go]'); if (b) act({ a: 'course', id: b.dataset.go, w: +$('warp').value }); var s = e.target.closest('[data-sel]'); if (s) { selectObj(s.dataset.sel); mc.scrollIntoView({ behavior: 'smooth' }); } };
  }
  function entry(d, nav) { return '<div class="ent"><div class="en">' + esc(d.name) + (d.reviews ? ' <small>' + esc(d.reviews) + '</small>' : '') + (d.landable ? ' <span class="tag">LANDABLE</span>' : '') + '</div><div class="ef">' + esc(d.flavour) + '</div><div class="row">' + (nav ? '<button class="act go" data-go="' + d.id + '">Course</button><button class="act" data-sel="' + d.id + '">Map</button>' : '') + '<button class="act" data-act=\'{"a":"scan","id":"' + d.id + '"}\'>Scan</button><button class="act" data-act=\'{"a":"probe","id":"' + d.id + '"}\'>Probe</button></div></div>'; }
  function buildSci() { $('sciTargets').innerHTML = sector.filter(function (d) { return d.kind !== 'ship'; }).map(function (d) { return entry(d, false); }).join(''); }
  // landing
  function buildSites() {
    $('siteBtns').innerHTML = sites.map(function (s) { return '<button class="act" data-site="' + s.id + '">' + esc(s.name) + '</button>'; }).join('') + '<button class="act" data-site="auto">Auto</button>';
    $('siteBtns').onclick = function (e) { var b = e.target.closest('[data-site]'); if (b) act({ a: 'site', id: b.dataset.site === 'auto' ? 'shelf' : b.dataset.site }); };
    $('lMatch').onclick = function () { act({ a: 'orbit', step: 'match' }); }; $('lAlign').onclick = function () { act({ a: 'orbit', step: 'align' }); };
    $('lDescend').onclick = function () { act({ a: 'descend' }); }; $('lLift').onclick = function () { act({ a: 'liftoff' }); };
    $('topo').onclick = function (e) { var r = $('topo').getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height, best = sites[0], bd = 9; sites.forEach(function (s) { var d = Math.hypot(s.u - u, s.v - v); if (d < bd) { bd = d; best = s; } }); act({ a: 'site', id: best.id }); };
  }
  function drawTopo() {
    if (!topo) return; var c = $('topo'), g = c.getContext('2d'), W = c.width, Hh = c.height, rows = topo.length, cols = topo[0].length, cw = W / cols, ch = Hh / rows;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) { var h = topo[y][x]; g.fillStyle = h < 0 ? 'rgb(' + (10 + h * -1) + ',' + (40 + h * 3) + ',' + (60 + h * 3) + ')' : 'rgb(' + (70 + h * 12) + ',' + (66 + h * 10) + ',' + (60 + h * 8) + ')'; g.fillRect(x * cw, y * ch, cw + 1, ch + 1); }
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (y = 0; y < rows - 1; y++) for (x = 0; x < cols - 1; x++) { if ((topo[y][x] >= 0) !== (topo[y][x + 1] >= 0)) { g.beginPath(); g.moveTo((x + 1) * cw, y * ch); g.lineTo((x + 1) * cw, (y + 1) * ch); g.stroke(); } if ((topo[y][x] >= 0) !== (topo[y + 1][x] >= 0)) { g.beginPath(); g.moveTo(x * cw, (y + 1) * ch); g.lineTo((x + 1) * cw, (y + 1) * ch); g.stroke(); } }
    g.font = '20px Fredoka, system-ui'; sites.forEach(function (s) { var px = s.u * W, py = s.v * Hh, on = S && S.land.site === s.id; g.strokeStyle = on ? '#5dff9a' : '#ffe08a'; g.lineWidth = on ? 4 : 2; g.beginPath(); g.arc(px, py, 16, 0, 6.283); g.moveTo(px - 24, py); g.lineTo(px + 24, py); g.moveTo(px, py - 24); g.lineTo(px, py + 24); g.stroke(); g.fillStyle = '#fff'; g.fillText(s.name, px + 22, py - 10); });
  }

  // ================================================================== ENGINEERING: node power routing
  var nc = $('nodes'), nx = nc.getContext('2d'), NODES = [['shields', 'SHIELDS', '#6fd8ff'], ['engines', 'ENGINES', '#ffb347'], ['sensors', 'SENSORS', '#9d8cff'], ['life', 'LIFE SUPPORT', '#9effc4'], ['tractor', 'TRACTOR', '#7dffd0']], ndrag = null;
  function nodePos(i) { var a = -Math.PI / 2 + i / NODES.length * Math.PI * 2; return [nc.width / 2 + Math.cos(a) * 250, nc.height / 2 + Math.sin(a) * 250]; }
  function drawNodes(t) {
    if (!S) return; var g = nx, W = nc.width, Hh = nc.height, P = S.ship.pw, cx = W / 2, cy = Hh / 2; g.fillStyle = '#03060c'; g.fillRect(0, 0, W, Hh);
    NODES.forEach(function (n, i) { var p = nodePos(i), v = P[n[0]]; g.strokeStyle = n[2]; g.globalAlpha = 0.25 + v * 0.12; g.lineWidth = 2 + v * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(p[0], p[1]); g.stroke(); g.globalAlpha = 1;
      for (var k = 0; k < v; k++) { var f = ((t / 1000 * 0.5 + k / v) % 1), x = cx + (p[0] - cx) * f, y = cy + (p[1] - cy) * f; g.fillStyle = n[2]; g.beginPath(); g.arc(x, y, 5, 0, 6.283); g.fill(); } });
    g.fillStyle = '#10202c'; g.strokeStyle = '#ffd27a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 62, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = '#ffd27a'; g.textAlign = 'center'; g.font = '600 24px Fredoka'; g.fillText('REACTOR', cx, cy - 4); g.font = '20px Fredoka'; g.fillText(C.power.total + ' units', cx, cy + 22);
    NODES.forEach(function (n, i) { var p = nodePos(i), v = P[n[0]]; g.fillStyle = ndrag && ndrag.over === i ? '#1b3a50' : '#0d1826'; g.strokeStyle = n[2]; g.lineWidth = 3; g.beginPath(); g.arc(p[0], p[1], 66, 0, 6.283); g.fill(); g.stroke();
      g.fillStyle = n[2]; g.font = '600 19px Fredoka'; g.fillText(n[1], p[0], p[1] - 10); for (var k = 0; k < C.power.max; k++) { g.globalAlpha = k < v ? 1 : 0.18; g.fillRect(p[0] - 40 + k * 17, p[1] + 6, 13, 18); } g.globalAlpha = 1; });
    if (ndrag && ndrag.cur) { var a = nodePos(ndrag.from); g.strokeStyle = '#fff'; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(ndrag.cur[0], ndrag.cur[1]); g.stroke(); g.setLineDash([]); }
    var mw = C.maxWarp(P.engines);
    $('engFx').innerHTML = '<li>Engines ' + P.engines + ' \u2192 max warp <b>' + mw.toFixed(1) + '</b></li><li>Shields ' + P.shields + ' \u2192 regen and impact resistance</li><li>Sensors ' + P.sensors + ' \u2192 ' + (P.sensors >= 3 ? 'deep scans on' : 'basic scans (3+ for deep scans)') + '</li><li>Life support ' + P.life + (P.life < 1 ? ' \u2192 <b style="color:#ff8a80">crew in danger</b>' : ' \u2192 comfortable') + '</li><li>Tractor ' + P.tractor + ' \u2192 ' + (P.tractor ? 'clears comet debris, can tow ships' : 'offline') + '</li>';
  }
  function nodeAt(p) { for (var i = 0; i < NODES.length; i++) { var q = nodePos(i); if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 72) return i; } return -1; }
  function npos(e) { var r = nc.getBoundingClientRect(); return [(e.clientX - r.left) * nc.width / r.width, (e.clientY - r.top) * nc.height / r.height]; }
  nc.addEventListener('pointerdown', function (e) { var i = nodeAt(npos(e)); if (i < 0) return; nc.setPointerCapture(e.pointerId); ndrag = { from: i, cur: npos(e), over: -1 }; });
  nc.addEventListener('pointermove', function (e) { if (!ndrag) return; ndrag.cur = npos(e); ndrag.over = nodeAt(ndrag.cur); });
  nc.addEventListener('pointerup', function () { if (!ndrag) return; var to = ndrag.over, from = ndrag.from; ndrag = null; if (to >= 0 && to !== from) act({ a: 'power', from: NODES[from][0], to: NODES[to][0] }); });
  window.DS_power = function (f, t) { act({ a: 'power', from: f, to: t }); };

  function drawAll() { if (tab === 'helm') drawMap(); if (tab === 'eng') drawNodes(performance.now()); }
  (function loop(t) { requestAnimationFrame(loop); if (tab === 'eng') drawNodes(t); })(0);
  setInterval(function () { if (tab === 'helm') drawMap(); }, 400);
  window.DS = { state: function () { return S; }, me: function () { return me; }, tab: function (t) { tab = t; renderTabs(); drawAll(); }, act: act, view: view };
})();
