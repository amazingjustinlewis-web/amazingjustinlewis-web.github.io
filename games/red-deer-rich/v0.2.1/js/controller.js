/* RED DEER RICH - phone controller (v0.1.1). Four tabs (My Turn, My Stuff, Board, Deals & Chat) that adapt to
   portrait (bottom tab bar) and landscape (left rail + two panes). PAY UP and BOOM take over the whole screen. */
(function () {
  'use strict';
  var O = window.RDROpts, C = window.RDR_CONFIG, B = window.RDR_BOARD, S = B.SPACES, SFX = window.RDRSfx, R = window.RDRRender;
  var $ = function (id) { return document.getElementById(id); };
  // only touch the DOM when the markup really changed, so taps and holds survive frequent state pushes
  var setH = function (el, h) { if (!el || el._h === h) return false; el._h = h; el.innerHTML = h; return true; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); };
  var charById = function (id) { for (var i = 0; i < C.characters.length; i++) if (C.characters[i].id === id) return C.characters[i]; return C.characters[0]; };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var Q = new URLSearchParams(location.search), LOCAL = Q.has('local');
  var clientId = (Q.get('cid') || store.get('rdr_client')) || ('P' + Math.random().toString(36).slice(2, 10)); if (!Q.get('cid')) store.set('rdr_client', clientId);
  var net = null, st = null, lastFx = null, tab = 'turn', joined = false;
  var ui = { sel: 0, thread: null, builder: null, seen: JSON.parse(store.get('rdr_seen') || '{}'), carIdx: 0, aiChar: null, aiLevel: 'normal', lastRollSeq: -1, diceT: 0, graceUntil: 0, fades: {} };
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function send(m) { if (net) net.send(m); }
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 2400); }
  function pById(id) { if (!st) return null; for (var i = 0; i < st.players.length; i++) if (st.players[i].id === id) return st.players[i]; return null; }
  function initials(n) { return R.initials(n || '?'); }
  function chip(p, cls) { if (!p) return ''; var ch = charById(p.charId); return '<span class="' + (cls || 'mini-chip') + '" style="background:' + p.color + ';color:' + ch.ink + ';border-color:' + (p.state === 'gold' ? '#ffd23f' : '#fff') + '">' + esc(initials(p.name)) + '</span>'; }
  function gcol(sp) { var s = S[sp]; return s.group ? B.GROUPS[s.group].color : '#888'; }
  function show(id) { ['join', 'lobby', 'game', 'over'].forEach(function (k) { $(k).hidden = k !== id; }); }

  // ------------------------------------------------------------------ join
  $('room').value = (Q.get('room') || store.get('rdr_room') || '').toUpperCase().slice(0, 4);
  $('name').value = Q.get('name') || store.get('rdr_name') || '';
  $('room').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('joinBtn').onclick = join;
  function join() {
    var code = $('room').value.trim(), name = $('name').value.trim();
    if (!name && Q.has('watch')) name = 'Guest';
    if (code.length !== 4) { $('joinStatus').textContent = 'Type the 4-letter room code from the TV.'; return; }
    if (!name) { $('joinStatus').textContent = 'Type your name.'; $('name').focus(); return; }
    store.set('rdr_room', code); store.set('rdr_name', name);
    SFX.unlock(); joined = true;
    $('joinStatus').textContent = 'Connecting\u2026';
    var opts = { code: code, onOpen: function () { send({ t: 'hello', clientId: clientId, name: name, charId: store.get('rdr_char') || undefined, watch: Q.has('watch') && !ui.seated }); },
      onMessage: onMsg, onStatus: function (s) { var cls = s === 'online' ? 'conn on' : s === 'noroom' || s === 'offline' ? 'conn bad' : 'conn'; ['lConn', 'gConn'].forEach(function (k) { $(k).className = cls; });
        if (!st) $('joinStatus').textContent = s === 'noroom' ? 'No room ' + code + ' yet. Is the game open on the TV?' : s === 'online' ? 'Joined!' : 'Connecting\u2026'; } };
    if (net && net.destroy) net.destroy();
    net = LOCAL ? new window.RDRNet.LocalClient(opts) : new window.RDRNet.Client(opts);
  }
  if (Q.get('room') && (($('name').value && Q.has('auto')) || Q.has('watch'))) setTimeout(join, 50);   // the TV's mid-game QR (&watch) opens straight into Observer mode

  function onMsg(m) {
    if (!m) return;
    if (m.t === 'welcome') { $('lRoom').textContent = m.room; if (!m.observer && ui.observer) { ui.seated = true; toast('You\'re in! Have fun.', 2600); vib([40, 40, 120]); setTimeout(function () { setTab('turn'); }, 0); } ui.observer = !!m.observer; return; }
    if (m.t === 'reject') { $('joinStatus').textContent = m.reason; show('join'); st = null; return; }
    if (m.t === 'toast') { toast(m.text); SFX.play('buzz'); return; }
    if (m.t === 'state') onState(m);
  }

  // ------------------------------------------------------------------ state
  function onState(s) {
    var prev = st; st = s;
    ui.graceUntil = s.turn && s.turn.graceLeft ? Date.now() + s.turn.graceLeft : 0;
    (s.fades || []).forEach(function (f) { var cur = ui.fades[f[0]]; if (!cur || cur.from !== f[1] || Math.abs((Date.now() - f[2]) - cur.t0) > 1500) ui.fades[f[0]] = { from: f[1], t0: Date.now() - f[2] }; });
    handleFx(prev);
    if (s.phase === 'lobby') { show('lobby'); renderLobby(); return; }
    if (s.phase === 'over') { show('over'); renderOver(); hidePayup(); return; }
    show('game');
    var obs = !!s.me.observer; document.body.classList.toggle('observer', obs);
    if (obs && tab !== 'board') setTab('board');
    renderHead(); renderAuction(); renderTab(); renderBadges(); payupOverlay(); renderVote();
  }
  function handleFx(prev) {
    var f = st.fx || {};
    if (!lastFx || st.phase !== 'play' && !prev) { lastFx = JSON.parse(JSON.stringify(f)); return; }
    var inc = function (k) { return (f[k] || 0) > (lastFx[k] || 0); };
    if (inc('boom')) boom(f.boomData || {});
    if (inc('missed')) { SFX.play('trombone'); vib([60, 80, 60, 80, 300]); toast('\uD83C\uDFBA ' + ((f.missedData || {}).name || 'They') + ' slipped away\u2026 too slow!', 3200); }
    if (inc('gotEm')) { SFX.play('cash'); vib([30, 40, 30]); toast('CAUGHT! +' + money((f.gotEmData || {}).amount), 2600); }
    if (inc('turn') && st.turn && st.turn.pid === st.me.id) { SFX.play('turn'); vib([40, 60, 40]); if (tab !== 'turn') { var busy = ui.builder || (document.activeElement && document.activeElement.id === 'chatText'); if (busy) toast('Your turn!'); else setTimeout(function () { setTab('turn'); }, 0); } }
    if (inc('offer')) { SFX.play('click'); vib(30); toast('\uD83E\uDD1D New deal offer'); }
    if (inc('deal')) { SFX.play('deal'); vib(60); toast('Deal CEMENTED!'); }
    if (inc('msg')) { vib(15); }
    if (inc('auction') && !st.me.bankrupt) { SFX.play('click'); vib([50, 40, 50]); toast('\uD83D\uDD28 AUCTION! Bid with the buttons at the top', 2600); }
    if (inc('tab')) { vib([100, 50, 100]); }
    lastFx = JSON.parse(JSON.stringify(f));
  }
  function boom(d) {
    hidePayup();
    $('boomSub').innerHTML = esc(d.owner || 'The owner') + ' hit PAY UP first.<br>Rent: ' + money(d.amount) + (d.sp != null ? ' on ' + esc(S[d.sp].name) : '');
    $('boom').hidden = false; SFX.play('boom'); vib([200, 60, 200, 60, 400]);
    clearTimeout(boom._t); boom._t = setTimeout(function () { $('boom').hidden = true; }, 2600);
  }
  $('boom').onclick = function () { $('boom').hidden = true; };

  // PAY UP takeover (owner's phone, whatever tab is open)
  var puLoop = 0;
  function payupOverlay() {
    var pu = st.turn && st.turn.payup, mine = pu && pu.open && !pu.caught && pu.owner === st.me.id && !st.me.bankrupt;
    if (mine) {
      if ($('payup').hidden) { $('payup').hidden = false; vib([80, 40, 80, 40, 80]); SFX.play('payupAlarm'); clearInterval(puLoop); puLoop = setInterval(function () { SFX.play('payupAlarm'); vib(40); }, 650); }
      var mover = pById(pu.mover);
      $('puWho').innerHTML = chip(mover) + ' <b>' + esc(mover ? mover.name : '') + '</b> landed on your <b>' + esc(S[pu.sp].name) + '</b>';
      $('puSub').textContent = 'Rent ' + money(pu.rent) + '. Hit it before they pass the dice!';
    } else hidePayup();
  }
  function hidePayup() { if (!$('payup').hidden) $('payup').hidden = true; clearInterval(puLoop); puLoop = 0; }
  $('puBtn').addEventListener('pointerdown', function (e) { e.preventDefault(); send({ t: 'payup' }); vib(80); SFX.play('caught'); hidePayup(); });

  // ------------------------------------------------------------------ lobby
  function renderLobby() {
    var taken = {}; (st.lobby ? st.lobby.taken : []).forEach(function (x) { taken[x[0]] = x; });
    if (!renderLobby.init) { renderLobby.init = true; ui.carIdx = Math.max(0, C.characters.map(function (c) { return c.id; }).indexOf(st.me.charId)); }
    var ch = C.characters[ui.carIdx], tk = taken[ch.id], mine = ch.id === st.me.charId;
    $('carName').textContent = ch.full; $('carName').style.color = ch.color === '#1d1d24' ? '#ff6a6a' : ch.color;
    $('carRole').textContent = ch.role + (ch.band ? ' \u00b7 Trow Punx' : '');
    $('carLine').textContent = ch.line; $('carPerk').innerHTML = '<b>' + esc(ch.perk) + ':</b> ' + esc(ch.perkText);
    $('carTaken').textContent = mine ? '\u2714 This is you' : tk ? 'Taken by ' + tk[2] : '';
    $('carCard').className = 'car-card' + (tk && !mine ? ' taken' : ''); $('carCard').style.borderColor = mine ? ch.color : 'transparent';
    $('pickBtn').disabled = !!tk; $('pickBtn').textContent = mine ? 'PICKED!' : tk ? 'TAKEN' : 'PICK ' + ch.name;
    drawCarousel(ch);
    setH($('lPlayers'), st.players.map(function (p) { return '<span>' + chip(p) + esc(p.name) + (p.ai ? ' (AI)' : '') + '</span>'; }).join(''));
    var host = st.me.vip; $('hostBox').hidden = !host;
    var act = O.activeList(st.rules), pre = O.presetOf(st.rules);
    setH($('waitHost'), host ? '' : 'Waiting for the host to start\u2026 (' + st.players.length + ' players)<div class="rulechips">' + (pre !== 'custom' ? '<b>' + esc(C.presets[pre].label) + '</b>' : '<b>Custom</b>') +
      act.map(function (o) { return '<span>' + o.icon + ' ' + esc(o.tag) + '</span>'; }).join('') + '</div>');
    if (host) {
      restoreSetup();
      var free = C.characters.filter(function (c) { return !taken[c.id]; });
      if (!ui.aiChar || taken[ui.aiChar]) ui.aiChar = free.length ? free[0].id : null;
      $('hAiChar').textContent = ui.aiChar ? charById(ui.aiChar).name : 'full'; $('hAiLevel').textContent = C.ai.levels[ui.aiLevel].label;
      // v0.2.1 setup: presets, ONE collapsed options line, big START with length + AI count pickers beside it
      setH($('hPresets'), Object.keys(C.presets).map(function (id) { var P = C.presets[id]; return '<button data-preset="' + id + '" class="' + (pre === id ? 'on' : '') + '">' + esc(P.label) + '<small>' + esc(P.blurb) + '</small></button>'; }).join('') +
        '<span class="custom' + (pre === 'custom' ? ' on' : '') + '">' + (pre === 'custom' ? 'Custom' : '') + '</span>');
      $('hOptLabel').textContent = 'Game options (' + O.countOn(st.rules) + ' on)';
      $('hOpts').hidden = !ui.optsOpen; $('hOptToggle').setAttribute('aria-expanded', ui.optsOpen ? 'true' : 'false'); $('hOptToggle').classList.toggle('open', !!ui.optsOpen);
      setH($('hOptRows'), C.options.map(function (o) {
        var on = !!st.rules[o.k];
        return '<button class="optrow' + (on ? ' on' : '') + '" data-rule="' + o.k + '" role="checkbox" aria-checked="' + on + '"><span class="ck">' + (on ? '\u2714' : '') + '</span><span class="ot"><b>' + o.icon + ' ' + esc(o.label) + '</b><small>' + esc(o.short) + '</small></span></button>';
      }).join(''));
      var nAi = st.players.filter(function (p) { return p.ai; }).length;
      $('hAiCount').textContent = 'AI ' + nAi; $('hAiMinus').disabled = !nAi;
      $('hAiAdd').disabled = !ui.aiChar || st.players.length >= C.maxPlayers;
      setH($('hMode'), ['regular', 'medium', 'quick'].map(function (k) { return '<button data-mode="' + k + '" class="' + (st.mode === k ? 'on' : '') + '">' + C.modes[k].label + '</button>'; }).join(''));
      $('hModeInfo').textContent = C.modes[st.mode] ? C.modes[st.mode].label + ': ' + C.modes[st.mode].blurb + ' \u00b7 start with ' + money(C.modes[st.mode].startCash) : '';
      $('startBtn').disabled = st.players.length < 2;
      var h = st.hue;
      $('hHue').innerHTML = h && h.ok ? '<div class="hb-title">\uD83D\uDCA1 Philips Hue found. Use lights?</div><div class="chips"><button data-hue="on" class="' + (h.enabled ? 'on' : '') + '">Yes</button><button data-hue="off" class="' + (!h.enabled ? 'on' : '') + '">No</button>' +
        (h.enabled ? h.groups.map(function (g) { return '<button data-hueg="' + esc(g.id) + '" class="' + (h.selected.indexOf(g.id) !== -1 ? 'on' : '') + '">' + esc(g.name) + '</button>'; }).join('') : '') + '</div>' : '';
    }
  }
  function drawCarousel(ch) {
    var cv = $('carCv'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    var fake = { shapeAccent: R.prototype.shapeAccent };
    ['rags', 'good', 'gold'].forEach(function (s, k) {
      var x = 60 + k * 120, y = 70;
      R.prototype.drawToken.call(fake, c, { charId: ch.id, color: ch.color, name: ch.name, state: s }, x, y, 30, false, Date.now());
      c.fillStyle = '#a59fb8'; c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(s === 'rags' ? 'RAGS' : s === 'good' ? 'DOING GOOD' : 'GOLD', x, 140);
    });
  }
  function carStep(d) { ui.carIdx = (ui.carIdx + d + C.characters.length) % C.characters.length; SFX.play('click'); renderLobby(); }
  $('carPrev').onclick = function () { carStep(-1); }; $('carNext').onclick = function () { carStep(1); };
  (function () { var x0 = null; var el = $('carousel'); el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true }); el.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) carStep(dx < 0 ? 1 : -1); x0 = null; }); })();
  $('pickBtn').onclick = function () { var id = C.characters[ui.carIdx].id; store.set('rdr_char', id); send({ t: 'char', id: id }); vib(30); SFX.play('buy'); };
  $('hAiChar').onclick = function () { var taken = {}; (st.lobby ? st.lobby.taken : []).forEach(function (x) { taken[x[0]] = 1; }); var ids = C.characters.map(function (c) { return c.id; }), i = ids.indexOf(ui.aiChar); for (var k = 1; k <= ids.length; k++) { var id = ids[(i + k) % ids.length]; if (!taken[id]) { ui.aiChar = id; break; } } renderLobby(); };
  $('hAiLevel').onclick = function () { var L = Object.keys(C.ai.levels); ui.aiLevel = L[(L.indexOf(ui.aiLevel) + 1) % L.length]; renderLobby(); };
  $('hAiAdd').onclick = function () { send({ t: 'addAI', charId: ui.aiChar, level: ui.aiLevel }); saveSetupSoon(); };
  $('hAiMinus').onclick = function () { var ais = st.players.filter(function (p) { return p.ai; }); if (ais.length) send({ t: 'removeAI', pid: ais[ais.length - 1].id }); saveSetupSoon(); };
  $('hOptToggle').onclick = function () { ui.optsOpen = !ui.optsOpen; SFX.play('click'); renderLobby(); };
  // option rows: tap toggles, press-and-hold explains (and does not toggle)
  O.hold($('hOptRows'), '.optrow', function (row) { var k = row.getAttribute('data-rule'); send({ t: 'rule', k: k, v: !st.rules[k] }); vib(15); saveSetupSoon(); },
    function (row) { showOptInfo(row.getAttribute('data-rule')); vib([20, 30, 20]); });
  function showOptInfo(k) { var o = O.opt(k); if (!o) return; $('osH').textContent = o.icon + ' ' + o.label + (st.rules[k] ? ' (on)' : ' (off)'); $('osShort').textContent = o.short; $('osT').textContent = o.long; $('optSheet').hidden = false; }
  $('optSheet').onclick = function (e) { if (e.target === $('optSheet') || e.target === $('osOk')) $('optSheet').hidden = true; };
  // v0.2.1 remember last game: the host phone keeps the last-used setup and puts it back when it hosts again
  function setupNow() { var r = {}; C.options.forEach(function (o) { r[o.k] = !!st.rules[o.k]; }); return { rules: r, mode: st.mode, ai: st.players.filter(function (p) { return p.ai; }).length, level: ui.aiLevel }; }
  var saveT = 0;
  function saveSetupSoon() { clearTimeout(saveT); saveT = setTimeout(function () { if (st && st.me && st.me.vip && st.phase !== 'play') store.set('rdr_setup', JSON.stringify(setupNow())); }, 700); }
  function restoreSetup() {
    if (ui.restored || !st || st.phase !== 'lobby') return; ui.restored = true;
    var saved = null; try { saved = JSON.parse(store.get('rdr_setup') || 'null'); } catch (e) {}
    if (!saved || !saved.rules) return;
    if (saved.level && C.ai.levels[saved.level]) ui.aiLevel = saved.level;
    var nAi = st.players.filter(function (p) { return p.ai; }).length, add = Math.max(0, Math.min((saved.ai | 0) - nAi, C.maxPlayers - st.players.length));
    send({ t: 'settings', rules: saved.rules, mode: saved.mode, addAI: add, level: ui.aiLevel });
    toast('Set up like last time. Change anything below.', 2400);
  }
  $('hostBox').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-mode')) { send({ t: 'mode', v: b.getAttribute('data-mode') }); saveSetupSoon(); }
    if (b.getAttribute('data-preset')) { send({ t: 'preset', v: b.getAttribute('data-preset') }); vib(20); SFX.play('click'); saveSetupSoon(); }
    if (b.getAttribute('data-hue')) send({ t: 'hue', enabled: b.getAttribute('data-hue') === 'on' });
    if (b.getAttribute('data-hueg')) send({ t: 'hue', toggle: b.getAttribute('data-hueg') });
  });
  $('startBtn').onclick = function () { if (st) store.set('rdr_setup', JSON.stringify(setupNow())); send({ t: 'start' }); };
  function renderOver() {
    var r = st.results || [];
    $('oTitle').textContent = r.length ? r[0].name + ' is RED DEER RICH!' : 'GAME OVER';
    setH($('oList'), r.map(function (x) { return '<li>' + esc(x.name) + ' \u2014 ' + (x.bankrupt ? (x.left ? 'left' : x.owed > 0 ? 'bust, owed ' + money(x.owed) : 'bankrupt') : money(x.worth)) + (x.title ? '<br><small class="otitle">' + esc(x.title) + '</small>' : '') + '</li>'; }).join(''));
    $('againBtn').hidden = $('lobbyBtn').hidden = !st.me.vip; $('oWait').textContent = st.me.vip ? '' : 'Waiting for the host\u2026';
  }
  $('againBtn').onclick = function () { send({ t: 'start' }); }; $('lobbyBtn').onclick = function () { send({ t: 'toLobby' }); };

  // ------------------------------------------------------------------ header + tabs
  function renderHead() {
    var me = st.me, p = pById(me.id) || me;
    if (me.observer) { $('myName').textContent = '\uD83D\uDC40 Watching'; var ob = $('myBadge'); ob.className = 'badge'; ob.textContent = 'OBSERVER \u00b7 ' + me.name; $('myCash').textContent = ''; return; }
    $('myChip').outerHTML = chip(p, 'mychip').replace('class="mychip"', 'class="mychip" id="myChip"');
    $('myName').textContent = me.name + (me.aiCover ? ' (AI covering)' : '');
    var b = $('myBadge'); b.className = 'badge ' + me.state; b.textContent = me.bankrupt ? 'BANKRUPT' : me.state === 'gold' ? 'GOLD' : me.state === 'good' ? 'DOING GOOD' : 'RAGS';
    $('myCash').textContent = me.bankrupt ? 'OUT' : money(me.cash);
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setTab(b.getAttribute('data-tab')); });
  function setTab(t) { tab = t; Array.prototype.forEach.call($('tabs').children, function (b) { b.className = b.getAttribute('data-tab') === t ? 'on' : ''; }); ['turn', 'stuff', 'board', 'msgs'].forEach(function (k) { $('tab-' + k).hidden = k !== t; }); renderTab(); renderBadges(); }
  function renderTab() { if (!st || st.phase !== 'play') return; if (tab === 'turn') renderTurn(); else if (tab === 'stuff') renderStuff(); else if (tab === 'board') renderBoard(); else renderMsgs(); }
  function unreadFor(key) { var last = ui.seen[key] || 0; return st.chats.filter(function (c) { var k = c[2] === 'all' ? 'all' : String(c[1] === st.me.id ? c[2] : c[1]); return k === String(key) && c[0] > last && c[1] !== st.me.id; }).length; }
  function waitingDeals(pid) { return st.trades.filter(function (t) { return t.status === 'open' && t.waiting === st.me.id && (pid == null || t.a === pid || t.b === pid); }).length; }
  function renderBadges() {
    if (!st || !st.chats) return;
    var n = unreadFor('all'); st.players.forEach(function (p) { if (p.id !== st.me.id) n += unreadFor(p.id); });
    var d = waitingDeals(null), el = $('bMsgs'); el.textContent = d ? '\uD83E\uDD1D' + d : n; el.className = 'dot' + (n || d ? ' show' : '');
    var myTurn = st.turn && st.turn.pid === st.me.id; $('bTurn').textContent = '!'; $('bTurn').className = 'dot' + (myTurn && tab !== 'turn' ? ' show' : '');
  }

  // ------------------------------------------------------------------ My Turn
  function renderTurn() {
    var t = st.turn, me = st.me, mine = t && t.pid === me.id, h = '';
    if (!t) { setH($('turnMain'), '<div class="info">Waiting\u2026</div>'); return; }
    var cur = pById(t.pid);
    h += '<div class="whose">' + (mine ? '<b style="color:#ffd23f">YOUR TURN</b>' : chip(cur) + '<b>' + esc(t.name) + '</b>\'s turn') + '</div>';
    h += '<div class="dicebox" id="diceBox"><canvas id="pdice" width="360" height="180"></canvas>' + (mine && (t.stage === 'roll' || t.canRollAgain) ? '<div class="swipe">Swipe up on the dice to throw, or tap ROLL</div>' : '') + '</div>';
    if (me.bankrupt) h += '<div class="info">You\'re bankrupt. Stick around: you can still chat and watch.</div>';
    else if (mine) {
      if (t.tab) {
        h += '<div class="info warn"><b>You owe ' + money(t.tab.amount) + '</b> (' + esc(t.tab.reason) + ').<br>Sell Shops or hock deeds in <b>My Stuff</b>, make a deal, or raise it automatically.</div>';
        if (!t.tab.hopeless) h += '<button class="act buy" data-act="raise">AUTO-RAISE CASH</button>';
        else h += '<div class="info">Even selling everything only raises ' + money(t.tab.raise) + '. Going bust sells your Shops back and pays ' + esc(t.tab.to === 'bank' || t.tab.to === 'pot' ? 'the bank' : t.tab.to) + ' everything you have' + (t.tab.amount > t.tab.raise ? ': you skip town owing ' + money(t.tab.amount - t.tab.raise) : '') + '.</div><button class="act bust" data-act="giveUp">GO BUST, PAY WHAT I CAN</button>';
      }
      if (t.stage === 'roll') {
        if (me.snow) {
          h += '<div class="info">\u2744 Stuck in the Snowbank (try ' + (me.snowTries + 1) + ' of ' + C.snowTries + '). Roll doubles to drive out.</div>';
          h += '<div class="twoup"><button class="act small" data-act="payTow"' + (me.cash < C.towFee ? ' disabled' : '') + '>PAY TOW ' + money(C.towFee) + '</button><button class="act small" data-act="usePass"' + (me.passes ? '' : ' disabled') + '>TOW PASS (' + me.passes + ')</button></div>';
        }
        h += '<button class="act roll" data-act="roll"' + (t.tab ? ' disabled' : '') + '>ROLL</button>';
      } else if (t.stage === 'rolling' || t.stage === 'moving') h += '<div class="info">Moving\u2026</div>';
      else if (t.stage === 'card') h += '<div class="info">Reading the card\u2026</div>';
      else if (t.stage === 'act' || t.stage === 'closing') {
        if (t.buy) { var s = S[t.buy.sp]; h += '<div class="info"><span class="sw" style="background:' + gcol(t.buy.sp) + '"></span><b>' + esc(s.name) + '</b> is for sale.</div><div class="twoup"><button class="act buy" data-act="buy"' + (me.cash < t.buy.price ? ' disabled' : '') + '>BUY ' + money(t.buy.price) + '</button><button class="act" data-act="skipBuy">' + (st.rules.auctions ? 'PASS (AUCTION)' : 'PASS') + '</button></div>'; }
        if (t.auction) h += '<div class="info">\uD83D\uDD28 Auction running for <b>' + esc(S[t.auction.sp].name) + '</b>. Anyone can bid (you too!) with the buttons at the top.</div>';
        if (t.payup && t.payup.open) { var o = pById(t.payup.owner); h += '<div class="info warn">You\'re on ' + esc(o ? o.name : '') + '\'s deed! Pass the dice before they hit PAY UP\u2026</div>'; }
        if (t.payup && t.payup.caught) h += '<div class="info warn">Caught! Rent ' + money(t.payup.amount) + '.</div>';
        if (t.stage === 'closing') h += '<div class="info">LOUD AMP: the window stays open a moment longer\u2026</div>';
        else if (t.canRollAgain) h += '<button class="act roll" data-act="roll" id="passBtn"' + (t.tab ? ' disabled' : '') + '>DOUBLES! ROLL AGAIN</button>';
        else h += '<button class="act pass" data-act="pass" id="passBtn"' + (t.tab ? ' disabled' : '') + '>PASS DICE</button>';
      }
    } else {
      var pu = t.payup;
      if (pu && pu.open) { var ow = pById(pu.owner), mv = pById(pu.mover); h += '<div class="info warn">' + esc(mv.name) + ' is on ' + esc(ow.name) + '\'s ' + esc(S[pu.sp].name) + '. ' + (pu.owner === me.id ? '<b>HIT PAY UP!</b>' : 'Will ' + esc(ow.name) + ' catch them?') + '</div>'; }
      else if (t.buy) h += '<div class="info">' + esc(t.name) + ' is thinking about buying ' + esc(S[t.buy.sp].name) + '.' + (st.rules.auctions ? ' If they pass, it goes to auction.' : '') + '</div>';
      if (t.auction) h += '<div class="info">\uD83D\uDD28 <b>' + esc(S[t.auction.sp].name) + '</b> is up for auction. Bid with the buttons at the top!</div>';
      h += '<div class="info">PAY UP zone: when someone lands on your deed, a giant button takes over this phone. Hit it before they pass the dice.</div>';
      if (me.snow) h += '<div class="info">\u2744 You\'re in the Snowbank, but you can still trade, build and hit PAY UP.</div>';
    }
    setH($('turnMain'), h);
    var side = '';
    if (t.card) { var cd = (t.card.deck === 'hail' ? B.HAIL : B.POT)[t.card.idx]; side += cardHtml(t.card.deck, cd); }
    side += '<div class="feed">' + st.feed.map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>';
    if (st.endsIn) side = '<div class="info">' + (C.modes[st.mode] ? C.modes[st.mode].label : '') + ' game: ' + clock(st.endsIn) + ' left</div>' + side;
    setH($('turnSide'), side);
    if (t.roll && t.rollSeq !== ui.lastRollSeq) { ui.lastRollSeq = t.rollSeq; ui.diceT = Date.now(); }
    drawDice(); updatePass(); bindSwipe();
  }
  function cardHtml(deck, cd) { return '<div class="pcard ' + deck + '"><div class="deck">' + (deck === 'hail' ? 'HAILSTONE' : 'POTLUCK') + '</div><div class="h">' + esc(cd.h) + '</div><div>' + esc(cd.t) + '</div><div class="fact">(' + esc(cd.fact) + ')</div></div>'; }
  function clock(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function updatePass() {
    var b = $('passBtn'); if (!b || !st.turn) return;
    var left = ui.graceUntil - Date.now(), wait = st.turn.stage === 'act' && left > 0;   // v0.1.1: locked 3 s after every landing
    b.disabled = !!st.turn.tab || wait || !!st.turn.auction;
    if (st.turn.auction) b.textContent = 'AUCTION RUNNING\u2026';
    else if (wait) b.textContent = (st.turn.canRollAgain ? 'ROLL AGAIN' : 'PASS DICE') + ' (' + (left / 1000).toFixed(1) + ')';
    else b.textContent = st.turn.canRollAgain ? 'DOUBLES! ROLL AGAIN' : 'PASS DICE';
  }
  setInterval(function () { if (tab === 'turn' && st && st.turn) updatePass(); }, 150);
  function drawDice() {
    var cv = $('pdice'); if (!cv || !st.turn) return;
    var c = cv.getContext('2d'), r = st.turn.roll, rolling = Date.now() - ui.diceT < 800, p = pById(st.turn.pid) || { color: '#fff' }, ink = charById(p.charId).ink;
    c.clearRect(0, 0, cv.width, cv.height);
    [0, 1].forEach(function (k) {
      var v = rolling ? 1 + Math.floor(Math.random() * 6) : r ? r.d[k] : k + 5, x = 20 + k * 180, y = 20, s = 140;
      c.save(); if (rolling) { c.translate(x + s / 2, y + s / 2); c.rotate((Math.random() - .5)); c.translate(-x - s / 2, -y - s / 2); }
      c.fillStyle = p.color; c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.rect(x, y, s, s); c.fill(); c.stroke();
      c.fillStyle = ink; ({ 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]] })[v].forEach(function (q) { c.beginPath(); c.arc(x + q[0] * s, y + q[1] * s, 13, 0, 7); c.fill(); });
      c.restore();
    });
    if (rolling) requestAnimationFrame(drawDice);
  }
  function bindSwipe() {
    var el = $('diceBox'); if (!el) return; var y0 = null;
    el.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy < -40) doRoll(); });
    el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') y0 = e.clientY; });
    el.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && y0 != null && e.clientY - y0 < -40) doRoll(); });
  }
  function doRoll() { var t = st.turn; if (t && t.pid === st.me.id && (t.stage === 'roll' || t.canRollAgain)) { send({ t: 'roll' }); vib(40); SFX.play('dice'); ui.diceT = Date.now(); drawDice(); } }

  // ------------------------------------------------------------------ My Stuff
  function myDeeds() { var out = []; st.props.forEach(function (pr, i) { if (pr && pr[0] === st.me.id) out.push(i); }); return out; }
  function ownsGroup(pid, gr) { return B.GROUP_MEMBERS[gr].every(function (i) { return st.props[i][0] === pid; }); }
  function rentNow(sp) {
    var s = S[sp], pr = st.props[sp]; if (pr[2]) return 0;
    if (s.type === 'prop') return pr[1] ? s.rents[pr[1]] : s.rents[0] * (ownsGroup(pr[0], s.group) ? 2 : 1);
    if (s.type === 'whistle') return B.WHISTLE_RENT[B.WHISTLES.filter(function (w) { return st.props[w][0] === pr[0]; }).length];
    return 'dice\u00d7' + B.JUICE_MULT[B.GROUP_MEMBERS.juice.filter(function (w) { return st.props[w][0] === pr[0]; }).length];
  }
  function boardRank(sp) {
    if (sp > 20 && sp < 30) return sp - 21;            // top row 21..29, left to right
    if (sp > 10 && sp < 20) return 10 + (19 - sp);     // left side 19..11, top to bottom
    if (sp > 30 && sp < 40) return 20 + (sp - 31);     // right side 31..39, top to bottom
    return 30 + (10 - sp);                             // bottom row 9..1, left to right
  }
  function renderStuff() {
    var me = st.me, deeds = myDeeds(), G = C.states, max = G.goldNetWorth * 1.15, pct = function (v) { return Math.min(100, v / max * 100); };
    var h = '<div class="muted">Cash</div><div class="bigcash">' + money(me.cash) + '</div>';
    h += '<div class="meter"><div class="fill" style="width:' + pct(me.worth) + '%"></div><span class="mk" style="left:' + pct(G.goodNetWorth) + '%">Doing Good ' + money(G.goodNetWorth) + '</span><span class="mk" style="left:' + pct(G.goldNetWorth) + '%">GOLD ' + money(G.goldNetWorth) + '</span></div>';
    h += '<div class="muted">Net worth ' + money(me.worth) + ' \u00b7 <span class="badge ' + me.state + '">' + (me.state === 'gold' ? 'GOLD' : me.state === 'good' ? 'DOING GOOD' : 'RAGS') + '</span> \u00b7 GOLD needs ' + money(G.goldNetWorth) + ' and #1</div>';
    h += '<div class="info">\uD83D\uDE9A Tow Truck Passes: <b>' + me.passes + '</b>' + (me.lockedCash ? '<br>\uD83D\uDD12 ' + money(me.lockedCash) + ' locked for your open Tab' : '') + '</div>';
    setH($('stuffMain'), h);
    var groups = {}; deeds.forEach(function (sp) { (groups[S[sp].group] = groups[S[sp].group] || []).push(sp); });
    // v0.2: deeds in the order you see them on the board: top row left to right, left side top to bottom,
    // right side top to bottom, bottom row left to right. Sets appear in order of their first deed.
    var out = '', order = [];
    deeds.slice().sort(function (a, b) { return boardRank(a) - boardRank(b); }).forEach(function (sp) { if (order.indexOf(S[sp].group) < 0) order.push(S[sp].group); });
    Object.keys(groups).forEach(function (gr) { groups[gr].sort(function (a, b) { return boardRank(a) - boardRank(b); }); });
    order.forEach(function (gr) {
      if (!groups[gr]) return; var G2 = B.GROUPS[gr], full = ownsGroup(me.id, gr), groupShops = B.GROUP_MEMBERS[gr].some(function (i) { return st.props[i][1] > 0; });
      out += '<div class="grp"><div class="grp-h"><span class="sw" style="background:' + G2.color + '"></span>' + G2.name + (full && G2.shop ? ' \u00b7 FULL SET (Shop ' + money(G2.shop) + ')' : ' \u00b7 ' + groups[gr].length + '/' + B.GROUP_MEMBERS[gr].length) + '</div>';
      groups[gr].forEach(function (sp) {
        var pr = st.props[sp], s = S[sp], shops = pr[1], lock = pr[3];
        var stat = pr[2] ? 'HOCKED (unhock ' + money(Math.ceil(s.hock * 1.1)) + ')' : shops === 5 ? 'MEGA-PLEX' : shops ? shops + ' Shop' + (shops > 1 ? 's' : '') : 'no Shops';
        out += '<div class="deedrow' + (pr[2] ? ' hocked' : '') + '" style="border-left-color:' + G2.color + '"><div class="dn">' + (lock ? '\uD83D\uDD12 ' : '') + esc(s.name) + '<small>' + stat + ' \u00b7 rent ' + (typeof rentNow(sp) === 'number' ? money(rentNow(sp)) : rentNow(sp)) + '</small></div>';
        if (s.type === 'prop' && full && !pr[2]) out += '<button class="sbtn" data-act="build" data-sp="' + sp + '"' + (shops >= 5 ? ' disabled' : '') + '>+ ' + (shops === 4 ? 'MEGA' : 'SHOP') + '</button><button class="sbtn" data-act="sell" data-sp="' + sp + '"' + (shops ? '' : ' disabled') + '>\u2212 SELL</button>';
        out += pr[2] ? '<button class="sbtn" data-act="unhock" data-sp="' + sp + '">UNHOCK</button>' : '<button class="sbtn" data-act="hock" data-sp="' + sp + '"' + (groupShops || lock ? ' disabled' : '') + '>HOCK +' + money(s.hock) + '</button>';
        out += '</div>';
      });
      out += '</div>';
    });
    out = out || '<div class="info">No deeds yet. Land on one and hit BUY!</div>';
    if (!me.bankrupt) out += '<button class="ghost leavebtn" data-act="leave">\uD83D\uDEAA Leave game\u2026</button>';
    if (st.me.vip) out += '<button class="ghost leavebtn" data-act="newgame">\uD83D\uDD04 New game (back to setup)\u2026</button>';
    setH($('stuffSide'), out);
  }

  // ------------------------------------------------------------------ Board / Info
  function cellPos(i) { if (i === 0) return [11, 11]; if (i < 10) return [11, 11 - i]; if (i === 10) return [11, 1]; if (i < 20) return [11 - (i - 10), 1]; if (i === 20) return [1, 1]; if (i < 30) return [1, 1 + (i - 20)]; if (i === 30) return [1, 11]; return [1 + (i - 30), 11]; }
  function renderBoard() {
    var h = '';
    for (var i = 0; i < 40; i++) {
      var s = S[i], rc = cellPos(i), pr = st.props[i], corner = i % 10 === 0;
      h += '<div class="c' + (corner ? ' corner' : s.type !== 'prop' ? ' np' : '') + (ui.sel === i ? ' sel' : '') + '" data-sp="' + i + '" style="grid-row:' + rc[0] + ';grid-column:' + rc[1] + '">';
      if (corner) h += esc(['HALF-WAY', 'SNOW-BANK', 'DIRT LOT', 'WHITE-OUT'][i / 10]);
      else {     // v0.1.1: clean info-only cells, names only (no icons)
        if (s.type === 'prop') h += '<div class="band" style="background:' + gcol(i) + '"></div>';
        h += '<span class="nm">' + esc(s.short) + '</span>';
      }
      if (pr && pr[0] >= 0) { h += '<div class="own"></div>'; if (pr[1]) h += '<b class="sh">' + (pr[1] === 5 ? 'MP' : pr[1] + 'S') + '</b>'; }
      h += '</div>';
    }
    h += '<div class="mid">RED DEER<br>RICH<small>' + (st.rules.jackpot ? 'Dirt Lot pot ' + money(st.pot) : 'Round ' + st.round) + '</small></div>';
    setH($('mini'), h);
    paintOwners(); renderDots(); renderSeats(); renderObserver();
    var s0 = S[ui.sel], pr0 = st.props[ui.sel], side = '';
    if (s0.price) {
      var o0 = pr0[0] >= 0 ? pById(pr0[0]) : null;
      side += '<div class="deedcard"><div class="top" style="background:' + gcol(ui.sel) + '">' + esc(s0.name) + '</div><div class="body">';
      side += 'Owner: <b>' + (o0 ? esc(o0.name) : 'the bank (for sale)') + '</b>' + (pr0[2] ? ' \u00b7 HOCKED' : '') + (pr0[3] ? ' \u00b7 \uD83D\uDD12' : '') + '<br>Price ' + money(s0.price) + ' \u00b7 hock ' + money(s0.hock);
      if (s0.type === 'prop') { var mx = s0.rents[5]; side += '<div class="stairs">' + s0.rents.map(function (r, k) { return '<div class="' + (o0 && pr0[1] === k ? 'on' : '') + '" style="height:' + Math.max(16, Math.round(100 * Math.sqrt(r / mx))) + '%"><b>$' + r + '</b>' + ['rent', '1', '2', '3', '4', 'MP'][k] + '</div>'; }).join('') + '</div>Shop cost ' + money(B.GROUPS[s0.group].shop) + '. Full set doubles base rent.'; }
      else if (s0.type === 'whistle') side += '<br>Rent $30/$60/$120/$240 for 1-4 stops.<br><i>' + esc(B.STORIES[ui.sel] || '') + '</i>';
      else side += '<br>Rent: dice \u00d7 5 (one) or \u00d7 12 (both).';
      side += '</div></div>';
    } else side += '<div class="info"><b>' + esc(s0.name) + '</b><br>' + esc({ halfway: 'Collect $250 when you pass or land.', snowbank: 'Stuck: roll doubles (3 tries), use a Tow Truck Pass or pay $60. Just Driving By otherwise.', dirtlot: st.rules.jackpot ? 'Land here exactly to win the pot (' + money(st.pot) + ').' : 'A free rest stop behind the caragana bushes. Shhh.', whiteout: 'Straight to the Snowbank. No $250.', tax: 'Pay ' + money(s0.amount) + '.', hail: 'Draw a HAILSTONE card (weather, traffic, chaos).', potluck: 'Draw a POTLUCK card (neighbours, family, community).' }[s0.type] || '') + '</div>';
    side += '<h3>Standings</h3>' + st.players.slice().sort(function (a, b) { return (a.bankrupt - b.bankrupt) || (b.worth - a.worth); }).map(function (p) { return '<div class="standing">' + chip(p) + '<span class="nm">' + esc(p.name) + (p.ai ? ' <small class="muted">AI</small>' : '') + '</span><span>' + (p.bankrupt ? 'OUT' : money(p.cash) + ' \u00b7 <span class="badge ' + p.state + '">' + (p.state === 'gold' ? 'GOLD' : p.state === 'good' ? 'GOOD' : 'RAGS') + '</span>') + '</span></div>'; }).join('');
    var R2 = st.rules, on = [];
    if (R2.jackpot) on.push('Dirt Lot Jackpot (pot ' + money(st.pot) + ')'); if (R2.feesToPot) on.push('Fees feed the pot'); if (R2.bullseye) on.push('Bullseye Halfway $500');
    on.push(R2.payupRace ? 'PAY UP race' + (R2.kidMode ? ' (Kid Mode 4 s)' : '') : 'Automatic rent'); if (R2.perks) on.push('Character perks'); if (R2.auctions) on.push('Auctions on passed deeds');
    side += '<h3>House rules</h3><div class="info">' + on.map(esc).join('<br>') + '<br>Game length: ' + (C.modes[st.mode] ? C.modes[st.mode].label : st.mode) + (st.endsIn ? ' (' + clock(st.endsIn) + ' left)' : '') + '</div>';
    setH($('boardSide'), side);
  }
  // owned tiles get a wash + border in the owner's colour; after a private deal it drifts over ~10 s
  function hexRgb(hx) { hx = String(hx || '#888888'); return [parseInt(hx.substr(1, 2), 16), parseInt(hx.substr(3, 2), 16), parseInt(hx.substr(5, 2), 16)]; }
  function ownerRgb(i) {
    var pr = st.props[i], o = pr && pr[0] >= 0 ? pById(pr[0]) : null; if (!o) return null;
    var to = hexRgb(o.color), f = ui.fades[i]; if (!f) return to;
    var k = (Date.now() - f.t0) / C.tradeFadeMs; if (k >= 1) { delete ui.fades[i]; return to; }
    k = k * k * (3 - 2 * k); var a = hexRgb(f.from);
    return [a[0] + (to[0] - a[0]) * k, a[1] + (to[1] - a[1]) * k, a[2] + (to[2] - a[2]) * k];
  }
  function paintOwners() {
    var cells = $('mini').children;
    for (var n = 0; n < cells.length; n++) {
      var el = cells[n], sp = el.getAttribute('data-sp'); if (sp == null) continue;
      var pr = st.props[+sp], col = ownerRgb(+sp);
      if (!col) { el.style.backgroundImage = ''; el.style.boxShadow = ''; continue; }
      var rgb = Math.round(col[0]) + ',' + Math.round(col[1]) + ',' + Math.round(col[2]);
      var oa = pr[2] ? C.ownerTint.phoneFillHocked : C.ownerTint.phoneFill; el.style.backgroundImage = 'linear-gradient(rgba(' + rgb + ',' + oa + '),rgba(' + rgb + ',' + oa + '))';   // v0.2.1: x0.8
      el.style.boxShadow = 'inset 0 0 0 2px rgb(' + rgb + ')';
      var own = el.querySelector('.own'); if (own) { own.style.background = 'rgb(' + rgb + ')'; own.style.opacity = pr[2] ? 0.45 : 1; }
    }
  }
  setInterval(function () { if (tab === 'board' && st && st.phase === 'play' && Object.keys(ui.fades).length) paintOwners(); }, 250);
  $('mini').addEventListener('click', function (e) { if (zm.dragged) { zm.dragged = false; return; } var c = e.target.closest('.c'); if (c) { ui.sel = +c.getAttribute('data-sp'); renderBoard(); } });

  // v0.1.1: one small dot per player in their colour; the active one pulses and steps along its path while moving
  var dotEls = {};
  function dotPos(i, k, n) {
    var rc = cellPos(i), cx = (rc[1] - 0.5) / 11 * 100, cy = (rc[0] - 0.5) / 11 * 100;
    if (n > 1) { var off = [[-1.9, -1.9], [1.9, 1.9], [1.9, -1.9], [-1.9, 1.9], [0, -2.6], [0, 2.6], [-2.6, 0], [2.6, 0]][k % 8]; cx += off[0]; cy += off[1]; }
    return [cx, cy];
  }
  function livePos(p) {
    var mv = ui.mv; if (!mv || mv.pid !== p.id) return p.pos;
    var idx = Math.floor((Date.now() - mv.start) / mv.stepMs);
    if (idx >= mv.path.length + 3) { ui.mv = null; return p.pos; }
    return idx <= 0 ? mv.from : mv.path[Math.min(idx, mv.path.length) - 1];
  }
  function renderDots() {
    var box = $('miniDots'); if (!box || !st || !st.players) return;
    var t = st.turn, m = t && t.move;
    if (m && t.stage === 'moving') { var key = t.rollSeq + ':' + m.from + ':' + m.path.join(','); if (!ui.mv || ui.mv.key !== key) ui.mv = { key: key, pid: t.pid, from: m.from, path: m.path, stepMs: Math.max(60, m.stepMs), start: Date.now() - m.elapsed }; }
    var live = st.players.filter(function (p) { return !p.bankrupt; }), at = {};
    live.forEach(function (p) { var i = livePos(p); (at[i] = at[i] || []).push(p.id); p._lp = i; });
    var seen = {};
    live.forEach(function (p) {
      var el = dotEls[p.id];
      if (!el || el.parentNode !== box) { el = dotEls[p.id] = document.createElement('i'); el.className = 'pd'; box.appendChild(el); }
      seen[p.id] = 1;
      var list = at[p._lp], xy = dotPos(p._lp, list.indexOf(p.id), list.length);
      var left = xy[0].toFixed(2) + '%', top = xy[1].toFixed(2) + '%';
      if (el.style.left !== left) el.style.left = left; if (el.style.top !== top) el.style.top = top;
      el.style.background = p.color;
      var cls = 'pd' + (t && t.pid === p.id ? ' active' : '') + (ui.mv && ui.mv.pid === p.id ? ' moving' : '');
      if (el.className !== cls) el.className = cls;
      el.title = p.name;
    });
    for (var id in dotEls) if (!seen[id]) { if (dotEls[id].parentNode) dotEls[id].parentNode.removeChild(dotEls[id]); delete dotEls[id]; }
  }
  setInterval(function () { if (tab === 'board' && st && st.phase === 'play') renderDots(); }, 90);

  // v0.1.1 Observer mode (from the TV's mid-game QR): clean board, standings, history, and ask to take over an AI seat
  function renderObserver() {
    var el = $('obsBox'); if (!el) return;
    if (!st.me.observer) { if (el.innerHTML) el.innerHTML = ''; return; }
    if (!$('obsSeats')) el.innerHTML = '<div class="obsbox"><b>Want to play?</b><div class="muted small">Take over an AI seat. The players get 5 seconds to say no.</div><input id="obsName" maxlength="12" placeholder="Your name"><div id="obsSeats"></div><h3>Game history</h3><div class="feed" id="obsFeed"></div></div>';
    var inp = $('obsName'); if (!inp.value && document.activeElement !== inp && st.me.name !== 'Guest') inp.value = st.me.name;
    var h;
    if (st.asking) h = '<div class="info">Asking the players about <b>' + esc(st.asking.seat) + '</b>\u2026</div>';
    else if (st.seats && st.seats.length) h = st.seats.map(function (s2) { return '<button class="big-btn obsreq" data-obs="' + s2[0] + '"' + (st.voteBusy ? ' disabled' : '') + '><span class="mini-chip" style="background:' + s2[3] + ';color:' + charById(s2[2]).ink + '">' + esc(initials(s2[1])) + '</span>PLAY AS ' + esc(s2[1]) + '</button>'; }).join('');
    else h = '<div class="muted small">No AI seats right now. You\'ll join the next game automatically.</div>';
    setH($('obsSeats'), h);
    setH($('obsFeed'), st.feed.slice().reverse().map(function (l) { return '<div>' + esc(l) + '</div>'; }).join(''));
  }
  $('obsBox').addEventListener('click', function (e) {
    var b = e.target.closest('[data-obs]'); if (!b || b.disabled) return;
    var nm = ($('obsName') ? $('obsName').value : '').trim();
    if (!nm) { toast('Type your name first'); var i = $('obsName'); if (i) i.focus(); return; }
    store.set('rdr_name', nm); send({ t: 'seatReq', pid: +b.getAttribute('data-obs'), name: nm }); vib(30); SFX.play('click');
  });
  // the 5-second yes/no prompt every player gets when an observer asks for an AI seat
  function renderVote() {
    var el = $('voteBar'), v = st.vote;
    if (!v || v.mine || ui.voted === v.id) { if (!el.hidden) el.hidden = true; return; }
    if (ui.voteId !== v.id) { ui.voteId = v.id; ui.voteEnd = Date.now() + v.left; vib(30); }
    setH(el, '<div class="vb-t"><b>' + esc(v.name) + '</b> wants to take over <b>' + esc(v.seat) + '</b> (AI)</div><div class="vb-b"><button data-vote="1">YES</button><button data-vote="0">NO</button></div><div class="tbar"><i id="voteT"></i></div>');
    el.hidden = false; tickVote();
  }
  function tickVote() { var f = $('voteT'), el = $('voteBar'); if (!f || el.hidden) return; var left = ui.voteEnd - Date.now(); if (left <= 0) { el.hidden = true; return; } f.style.width = (left / 50).toFixed(1) + '%'; }
  setInterval(tickVote, 100);
  $('voteBar').addEventListener('click', function (e) { var b = e.target.closest('[data-vote]'); if (!b) return; send({ t: 'vote', id: ui.voteId, yes: b.getAttribute('data-vote') === '1' }); ui.voted = ui.voteId; $('voteBar').hidden = true; vib(20); });

  // v0.1.1: the host can fill an empty seat with an AI player mid-game
  function renderSeats() {
    var el = $('seatBox'); if (!el) return;
    if (!st.me.vip) { setH(el, ''); return; }
    var n = st.players.length, max = st.maxPlayers || C.maxPlayers, full = n >= max;
    setH(el, '<div class="seatbox"><b>Seats ' + n + '/' + max + '</b> <span class="muted small">(host)</span><div class="row"><button class="ghost" data-seat="level">AI: ' + esc(C.ai.levels[ui.aiLevel].label) + '</button><button class="go" data-seat="add"' + (full ? ' disabled' : '') + '>+ ADD AI PLAYER</button></div><div class="muted small">' + (full ? 'The table is full.' : 'Fills an empty seat right now: the AI starts at The Halfway with starting cash and plays after everyone else.') + '</div><button class="ghost newgamebtn" data-seat="new">\uD83D\uDD04 NEW GAME (back to setup)</button></div>');
  }
  $('seatBox').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var k = b.getAttribute('data-seat');
    if (k === 'level') { var L = Object.keys(C.ai.levels); ui.aiLevel = L[(L.indexOf(ui.aiLevel) + 1) % L.length]; renderSeats(); }
    if (k === 'add') { send({ t: 'addAI', level: ui.aiLevel }); vib(30); SFX.play('buy'); toast('Adding an AI player\u2026'); }
    if (k === 'new') openNewGame();
  });

  // v0.1.1: pinch-zoom + pan (touch), wheel (desktop), + / - / fit buttons; taps still select spaces
  var zm = { s: 1, x: 0, y: 0, dragged: false, max: 4 };
  function applyZoom(ease) {
    var w = $('miniWrap'), el = $('miniZoom'), W = w.clientWidth || 1, Hh = w.clientHeight || W;
    zm.s = Math.max(1, Math.min(zm.max, zm.s));
    zm.x = Math.min(0, Math.max(W - W * zm.s, zm.x)); zm.y = Math.min(0, Math.max(Hh - Hh * zm.s, zm.y));
    el.classList.toggle('ease', !!ease);
    el.style.transform = 'translate(' + zm.x.toFixed(1) + 'px,' + zm.y.toFixed(1) + 'px) scale(' + zm.s.toFixed(3) + ')';
    w.classList.toggle('zoomed', zm.s > 1.01);
  }
  function zoomAt(f, cx, cy, ease) { var ns = Math.max(1, Math.min(zm.max, zm.s * f)), k = ns / zm.s; zm.x = cx - (cx - zm.x) * k; zm.y = cy - (cy - zm.y) * k; zm.s = ns; applyZoom(ease); }
  (function () {
    var w = $('miniWrap'), tch = null;
    function rel(t) { var r = w.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; }
    function two(e) { var a = rel(e.touches[0]), b = rel(e.touches[1]); return { d: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; }
    function startOne(t) { var p = rel(t); tch = { pinch: false, p0: p, x: zm.x, y: zm.y }; }
    w.addEventListener('touchstart', function (e) {
      if (e.touches.length >= 2) { var g = two(e); tch = { pinch: true, d: g.d, c: g.c, s: zm.s, x: zm.x, y: zm.y }; zm.dragged = true; e.preventDefault(); }
      else if (e.touches.length === 1) { startOne(e.touches[0]); zm.dragged = false; }
    }, { passive: false });
    w.addEventListener('touchmove', function (e) {
      if (!tch) return;
      if (tch.pinch && e.touches.length >= 2) {
        var g = two(e), ns = Math.max(1, Math.min(zm.max, tch.s * g.d / tch.d)), k = ns / tch.s;
        zm.s = ns; zm.x = g.c[0] - (tch.c[0] - tch.x) * k; zm.y = g.c[1] - (tch.c[1] - tch.y) * k; applyZoom(false); e.preventDefault();
      } else if (!tch.pinch && zm.s > 1.01) {
        var p = rel(e.touches[0]), dx = p[0] - tch.p0[0], dy = p[1] - tch.p0[1];
        if (Math.abs(dx) + Math.abs(dy) > 6) zm.dragged = true;
        zm.x = tch.x + dx; zm.y = tch.y + dy; applyZoom(false); e.preventDefault();
      }
    }, { passive: false });
    w.addEventListener('touchend', function (e) { if (e.touches.length === 1) startOne(e.touches[0]); else if (!e.touches.length) tch = null; });
    w.addEventListener('wheel', function (e) { e.preventDefault(); var p = rel(e); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, p[0], p[1], false); }, { passive: false });
    var md = null;
    w.addEventListener('mousedown', function (e) { if (e.target.closest('.zbtns')) return; md = { p0: [e.clientX, e.clientY], x: zm.x, y: zm.y }; zm.dragged = false; });
    window.addEventListener('mousemove', function (e) { if (!md || zm.s <= 1.01) return; var dx = e.clientX - md.p0[0], dy = e.clientY - md.p0[1]; if (Math.abs(dx) + Math.abs(dy) > 6) zm.dragged = true; zm.x = md.x + dx; zm.y = md.y + dy; applyZoom(false); });
    window.addEventListener('mouseup', function () { md = null; });
    w.querySelector('.zbtns').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      var k = b.getAttribute('data-z'), W = w.clientWidth, Hh = w.clientHeight;
      if (k === 'in') zoomAt(1.5, W / 2, Hh / 2, true); else if (k === 'out') zoomAt(1 / 1.5, W / 2, Hh / 2, true); else { zm.s = 1; zm.x = zm.y = 0; applyZoom(true); }
    });
    window.addEventListener('resize', function () { applyZoom(false); });
  })();

  // ------------------------------------------------------------------ auctions (v0.1.1): sticky bar on every game tab
  function renderAuction() {
    var el = $('auctionBar'), a = st && st.phase === 'play' && st.turn ? st.turn.auction : null;
    if (!a) { if (!el.hidden) el.hidden = true; ui.auc = null; return; }
    if (!ui.auc || ui.auc.seq !== a.seq || ui.auc.bids !== a.bids) ui.auc = { seq: a.seq, bids: a.bids, end: Date.now() + a.left, total: Math.max(1, a.total) };
    var me = st.me, room = me.cash - (me.lockedCash || 0), lead = a.leader === me.id, L = pById(a.leader), s = S[a.sp];
    setH(el, '<div class="a1"><span class="sw" style="background:' + gcol(a.sp) + '"></span><span class="nm">\uD83D\uDD28 AUCTION: ' + esc(s.name) + '</span><span class="bd">' + money(a.bid) + '</span></div>' +
      '<div class="a2">' + (lead ? '<b>You\'re winning!</b>' : L ? chip(L) + '<b>' + esc(L.name) + '</b> leads' : 'No bids yet') + ' \u00b7 list price ' + money(s.price) + (me.bankrupt ? '' : ' \u00b7 you can bid up to ' + money(room)) + '</div>' +
      '<div class="tbar"><i id="aucT"></i></div><div class="bids">' + C.auction.steps.map(function (add) { return '<button data-bid="' + add + '"' + (me.bankrupt || lead || a.bid + add > room ? ' disabled' : '') + '>+$' + add + '</button>'; }).join('') + '</div>');
    el.className = 'aucbar' + (lead ? ' leading' : ''); el.hidden = false; tickAuction();
  }
  function tickAuction() { var f = $('aucT'); if (!f || !ui.auc) return; var left = Math.max(0, ui.auc.end - Date.now()), k = left / ui.auc.total; f.style.width = (k * 100).toFixed(1) + '%'; f.style.background = k < 0.3 ? '#ff5a5a' : '#ffd23f'; }
  setInterval(tickAuction, 100);
  $('auctionBar').addEventListener('click', function (e) { var b = e.target.closest('button[data-bid]'); if (!b || b.disabled) return; send({ t: 'bid', add: +b.getAttribute('data-bid') }); vib(25); SFX.play('click'); });

  // ------------------------------------------------------------------ Messages & Trades
  var chatInput = document.createElement('div'); chatInput.className = 'chatbar'; chatInput.innerHTML = '<input id="chatText" maxlength="200" placeholder="Message\u2026" autocomplete="off"><button id="chatSend">SEND</button>';
  var quickLines = ['\uD83D\uDC4D', 'Deal?', 'No way!', 'PAY UP! \uD83E\uDD18', 'Nice one', '\uD83D\uDE02'];
  function threadKey() { return ui.thread == null ? null : String(ui.thread); }
  function renderMsgs() {
    var others = st.players.filter(function (p) { return p.id !== st.me.id; });
    var h = '<div class="threads"><button class="newdeal" data-act="newDeal">+ DEAL</button>';
    h += '<button data-thread="all" class="' + (threadKey() === 'all' ? 'on' : '') + '"><span class="mini-chip" style="background:#f2c230;color:#1a1420">\uD83D\uDCAC</span><span class="tn">Table Talk<small>' + esc(lastLine('all')) + '</small></span>' + (unreadFor('all') ? '<span class="cnt">' + unreadFor('all') + '</span>' : '') + '</button>';
    others.forEach(function (p) {
      var u = unreadFor(p.id), d = waitingDeals(p.id);
      h += '<button data-thread="' + p.id + '" class="' + (threadKey() === String(p.id) ? 'on' : '') + '">' + chip(p) + '<span class="tn">' + esc(p.name) + (p.ai ? ' <small style="display:inline">AI</small>' : '') + (p.bankrupt ? ' <small style="display:inline">(out)</small>' : '') + '<small>' + esc(lastLine(p.id)) + '</small></span>' + (d ? '<span class="cnt deal">\uD83E\uDD1D' + d + '</span>' : '') + (u ? '<span class="cnt">' + u + '</span>' : '') + '</button>';
    });
    h += '</div>';
    setH($('msgMain'), h);
    $('tab-msgs').className = 'tab' + (ui.thread != null || ui.builder ? ' open' : '');
    if (ui.builder) { renderBuilder(); return; }
    renderThread();
  }
  function lastLine(key) { var m = st.chats.filter(function (c) { return key === 'all' ? c[2] === 'all' : (c[2] !== 'all' && (c[1] === key || c[2] === key)); }).pop(); if (!m) return key === 'all' ? 'Everyone' : 'Say hi or make a deal'; var p = pById(m[1]); return (m[1] === st.me.id ? 'You' : p ? p.name : '?') + ': ' + m[3]; }
  function renderThread() {
    var side = $('msgSide');
    if (ui.thread == null) { setH(side, '<div class="info">Pick a thread, or tap <b>+ DEAL</b> to build a trade. Messages are private: the TV never shows them.</div>'); return; }
    var key = threadKey(), other = key === 'all' ? null : pById(+key);
    var h = '<div class="row" style="align-items:center;margin-bottom:6px"><button class="ghost" data-act="back">\u2190</button><b style="flex:1">' + (other ? chip(other) + esc(other.name) : 'Table Talk (everyone)') + '</b>' + (other && !other.bankrupt ? '<button class="go" data-act="dealWith" data-pid="' + other.id + '">+ DEAL</button>' : '') + '</div>';
    if (other) { var ts = st.trades.filter(function (t) { return t.a === other.id || t.b === other.id; }).slice().reverse(); ts.filter(function (t) { return t.status === 'open'; }).concat(ts.filter(function (t) { return t.status !== 'open'; }).slice(0, 2)).forEach(function (t) { h += dealCard(t); }); }
    h += '<div class="msgs">';
    st.chats.filter(function (c) { return key === 'all' ? c[2] === 'all' : (c[2] !== 'all' && (c[1] === +key || c[2] === +key)); }).slice(-60).forEach(function (c) {
      var p = pById(c[1]), me = c[1] === st.me.id;
      h += '<div class="msg' + (me ? ' me' : '') + '">' + (me ? '' : '<div class="from" style="color:' + (p ? p.color : '#fff') + '">' + esc(p ? p.name : '?') + '</div>') + esc(c[3]) + '</div>';
    });
    h += '</div><div class="quick">' + quickLines.map(function (q) { return '<button data-quick="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>';
    var keep = document.activeElement && document.activeElement.id === 'chatText';
    if (setH(side, h)) { side.appendChild(chatInput); if (keep) $('chatText').focus(); side.scrollTop = side.scrollHeight; }
    var last = st.chats.length ? st.chats[st.chats.length - 1][0] : 0;
    if ((ui.seen[key] || 0) < last) { ui.seen[key] = last; store.set('rdr_seen', JSON.stringify(ui.seen)); renderBadges(); }
  }
  function itemList(side, ownerId) {
    var out = (side.props || []).map(function (sp) { return '<span class="dc-item" style="border-left:5px solid ' + gcol(sp) + '">' + esc(S[sp].short) + '</span>'; });
    if (side.cash) out.unshift('<span class="dc-item">\uD83D\uDCB5 ' + money(side.cash) + '</span>');
    if (side.passes) out.push('<span class="dc-item">\uD83D\uDE9A Tow Pass \u00d7' + side.passes + '</span>');
    return out.join('') || '<span class="muted">nothing</span>';
  }
  function dealCard(t) {
    var meA = t.a === st.me.id, myGive = meA ? t.aGives : t.bGives, myGet = meA ? t.bGives : t.aGives, other = pById(meA ? t.b : t.a);
    var stat = { open: t.waiting === st.me.id ? 'YOUR MOVE' : 'waiting for ' + (other ? other.name : ''), accepted: 'CEMENTED \u2714', declined: 'declined', stale: 'stale', cancelled: 'cancelled' }[t.status];
    var h = '<div class="dealcard' + (t.status === 'open' && t.waiting === st.me.id ? ' mine' : '') + '"><div class="dh">\uD83E\uDD1D Deal v' + t.v + ' \u00b7 ' + (t.by === st.me.id ? 'you' : esc(other ? other.name : '')) + '<span class="st">' + esc(stat) + '</span></div>';
    h += '<div class="sides"><div class="side"><h4>WHAT I GIVE</h4>' + itemList(myGive) + '</div><div class="side"><h4>WHAT I GET</h4>' + itemList(myGet) + '</div></div>';
    if (t.why && t.status !== 'open') h += '<div class="hist">' + esc(t.why) + '</div>';
    h += '<div class="hist">' + t.history.map(function (x) { var p = pById(x[1]); return 'v' + x[0] + ' ' + (x[1] === st.me.id ? 'you' : p ? esc(p.name) : '?'); }).join(' \u2192 ') + '</div>';
    if (t.status === 'open') {
      if (t.waiting === st.me.id) h += '<div class="btns"><button class="hold" data-hold="' + t.id + '">HOLD TO ACCEPT<span class="bar"></span></button><button data-act="decline" data-id="' + t.id + '">DECLINE</button><button data-act="edit" data-id="' + t.id + '">EDIT</button></div>';
      else h += '<div class="btns"><button data-act="decline" data-id="' + t.id + '">CANCEL</button><button data-act="edit" data-id="' + t.id + '">EDIT</button></div>';
    }
    return h + '</div>';
  }
  // trade builder: YOU GIVE | YOU GET, tap deeds to move them in, cash chips + number, CEMENT
  function openBuilder(pid, fromTrade) {
    var b = { partner: pid || null, give: { cash: 0, props: [], passes: 0 }, get: { cash: 0, props: [], passes: 0 }, editId: null, v: 1 };
    if (fromTrade) { var meA = fromTrade.a === st.me.id; b.partner = meA ? fromTrade.b : fromTrade.a; b.give = JSON.parse(JSON.stringify(meA ? fromTrade.aGives : fromTrade.bGives)); b.get = JSON.parse(JSON.stringify(meA ? fromTrade.bGives : fromTrade.aGives)); b.editId = fromTrade.id; b.v = fromTrade.v + 1; }
    ui.builder = b; ui.builderBuilt = false; renderMsgs();
  }
  function renderBuilder() {
    var b = ui.builder, side = $('msgSide'), me = st.me;
    if (!ui.builderBuilt) {
      side.innerHTML = '<div class="builder"><div class="row" style="align-items:center"><button class="ghost" data-act="closeBuilder">\u2190</button><h3 style="flex:1;margin:0">' + (b.editId ? 'Edit deal (counter v' + b.v + ')' : 'New deal') + '</h3></div>' +
        '<div class="hb-title">Deal with:</div><div class="partners" id="bPartners"></div>' +
        '<div class="bcols"><div class="bcol"><h4>YOU GIVE</h4><div class="cashrow">\uD83D\uDCB5 <input type="number" min="0" step="10" inputmode="numeric" id="bGiveCash" value="' + (b.give.cash || 0) + '"></div><div class="cashrow" data-cash="give"><button data-add="10">+10</button><button data-add="50">+50</button><button data-add="100">+100</button><button data-add="0">0</button></div><div class="tray" id="bGiveTray"></div></div>' +
        '<div class="bcol"><h4>YOU GET</h4><div class="cashrow">\uD83D\uDCB5 <input type="number" min="0" step="10" inputmode="numeric" id="bGetCash" value="' + (b.get.cash || 0) + '"></div><div class="cashrow" data-cash="get"><button data-add="10">+10</button><button data-add="50">+50</button><button data-add="100">+100</button><button data-add="0">0</button></div><div class="tray" id="bGetTray"></div></div></div>' +
        '<button class="cement" data-act="cement">CEMENT</button><div class="hist muted" style="margin-top:6px">Tap deeds to put them in the deal. \uD83D\uDD12 = locked by the active turn. Deeds in a set with Shops can\'t be traded.</div></div>';
      ui.builderBuilt = true; side._h = null;
      $('bGiveCash').addEventListener('input', function () { b.give.cash = Math.max(0, Math.floor(+this.value || 0)); });
      $('bGetCash').addEventListener('input', function () { b.get.cash = Math.max(0, Math.floor(+this.value || 0)); });
    }
    setH($('bPartners'), st.players.filter(function (p) { return p.id !== me.id && !p.bankrupt; }).map(function (p) { return '<button data-partner="' + p.id + '" class="' + (b.partner === p.id ? 'on' : '') + '">' + chip(p) + esc(p.name) + '</button>'; }).join(''));
    var tray = function (pid, side, sel) {
      if (pid == null) return '<span class="muted">Pick who to deal with first.</span>';
      var h = '', groupShops = function (sp) { return B.GROUP_MEMBERS[S[sp].group].some(function (i) { return st.props[i][1] > 0; }); };
      st.props.forEach(function (pr, sp) {
        if (!pr || pr[0] !== pid) return;
        var locked = pr[3] || groupShops(sp), on = sel.props.indexOf(sp) !== -1;
        h += '<button data-tray="' + side + '" data-sp="' + sp + '" class="' + (on ? 'in' : '') + '" style="border-left-color:' + gcol(sp) + '"' + (locked && !on ? ' disabled' : '') + '>' + (locked ? '\uD83D\uDD12 ' : '') + esc(S[sp].short) + (pr[2] ? ' (H)' : '') + '</button>';
      });
      var passes = pid === me.id ? me.passes : (pById(pid) || {}).passes || 0;
      if (passes) h += '<button data-tray="' + side + '" data-pass="1" class="' + (sel.passes ? 'in' : '') + '">\uD83D\uDE9A Tow Pass' + (sel.passes ? ' \u00d7' + sel.passes : '') + '</button>';
      return h || '<span class="muted">no deeds</span>';
    };
    setH($('bGiveTray'), tray(me.id, 'give', b.give));
    setH($('bGetTray'), tray(b.partner, 'get', b.get));
  }
  function builderClick(e) {
    var b = ui.builder; if (!b) return false;
    var el = e.target.closest('button'); if (!el) return false;
    if (el.getAttribute('data-partner')) { var np = +el.getAttribute('data-partner'); if (np !== b.partner) { b.partner = np; b.get = { cash: 0, props: [], passes: 0 }; $('bGetCash').value = 0; } renderBuilder(); return true; }
    if (el.getAttribute('data-tray')) {
      var side = b[el.getAttribute('data-tray')];
      if (el.getAttribute('data-pass')) { var maxP = el.getAttribute('data-tray') === 'give' ? st.me.passes : (pById(b.partner) || {}).passes || 0; side.passes = side.passes >= maxP ? 0 : side.passes + 1; }
      else { var sp = +el.getAttribute('data-sp'), i = side.props.indexOf(sp); if (i === -1) side.props.push(sp); else side.props.splice(i, 1); }
      SFX.play('click'); renderBuilder(); return true;
    }
    var row = el.parentNode && el.parentNode.getAttribute && el.parentNode.getAttribute('data-cash');
    if (row) { var add = +el.getAttribute('data-add'), s2 = b[row]; s2.cash = add ? (s2.cash || 0) + add : 0; $(row === 'give' ? 'bGiveCash' : 'bGetCash').value = s2.cash; return true; }
    return false;
  }

  // ------------------------------------------------------------------ actions (event delegation)
  document.addEventListener('click', function (e) {
    if (!st) return;
    if (tab === 'msgs' && builderClick(e)) return;
    var el = e.target.closest('[data-act],[data-thread],[data-quick]'); if (!el) return;
    if (el.getAttribute('data-thread')) { var th = el.getAttribute('data-thread'); ui.thread = th === 'all' ? 'all' : +th; ui.builder = null; renderMsgs(); return; }
    if (el.getAttribute('data-quick')) { sendChat(el.getAttribute('data-quick')); return; }
    var act = el.getAttribute('data-act'), sp = el.getAttribute('data-sp');
    switch (act) {
      case 'roll': doRoll(); break;
      case 'buy': case 'skipBuy': case 'payTow': case 'usePass': case 'raise': case 'giveUp': send({ t: act }); vib(30); if (act === 'buy') SFX.play('buy'); break;
      case 'pass': send({ t: 'pass' }); vib(40); SFX.play('click'); break;
      case 'build': case 'sell': case 'hock': case 'unhock': send({ t: act, sp: +sp }); vib(25); if (act === 'build') SFX.play('build'); break;
      case 'leave': openLeave(1); break;
      case 'newgame': openNewGame(); break;
      case 'newDeal': openBuilder(typeof ui.thread === 'number' ? ui.thread : null); break;
      case 'dealWith': openBuilder(+el.getAttribute('data-pid')); break;
      case 'closeBuilder': ui.builder = null; renderMsgs(); break;
      case 'back': ui.thread = null; renderMsgs(); break;
      case 'decline': send({ t: 'decline', id: +el.getAttribute('data-id') }); vib(20); break;
      case 'edit': var tr = st.trades.filter(function (t) { return t.id === +el.getAttribute('data-id'); })[0]; if (tr) openBuilder(null, tr); break;
      case 'cement':
        var b = ui.builder; if (!b.partner) { toast('Pick who to deal with'); return; }
        var msg = b.editId ? { t: 'counter', id: b.editId, give: b.give, get: b.get } : { t: 'trade', to: b.partner, give: b.give, get: b.get };
        send(msg); SFX.play('deal'); vib([30, 30, 80]);
        ui.thread = b.partner; ui.builder = null; renderMsgs(); toast('CEMENTED! Offer sent.'); break;
    }
  });
  // v0.1.1 Leave game: strong confirm, then pick what happens to your stuff
  function leaveBlock() {
    var t = st && st.turn, me = st && st.me; if (!t || !me) return '';
    if (t.payup && t.payup.open && (t.payup.mover === me.id || t.payup.owner === me.id)) return 'You can\'t leave during a PAY UP window.';
    if (t.pid === me.id && t.tab) return 'Settle your debt first (sell, hock or make a deal).';
    if (t.auction && t.auction.leader === me.id) return 'You can\'t leave while you lead an auction.';
    if (t.pid === me.id && (t.stage === 'rolling' || t.stage === 'moving' || t.stage === 'card')) return 'Wait until your move finishes.';
    return '';
  }
  function openLeave(step) {
    var el = $('leaveBox'), others = st.players.filter(function (p) { return p.id !== st.me.id && !p.bankrupt; }), blk = leaveBlock(), h;
    if (step === 1) h = '<div class="lv-t">Leave the game?</div><div class="lv-s">Are you sure? <b>You can\'t come back into this game</b> once you leave.</div>' + (blk ? '<div class="info warn">' + esc(blk) + '</div>' : '') +
      '<button class="big-btn red" data-lv="sure"' + (blk ? ' disabled' : '') + '>YES, I WANT TO LEAVE</button><button class="big-btn ghostbtn" data-lv="cancel">CANCEL</button>';
    else h = '<div class="lv-t">What happens to your stuff?</div><div class="lv-s">' + money(st.me.cash) + ' cash and ' + myDeeds().length + ' deeds.</div>' +
      '<button class="lv-opt" data-lv="ai"><b>Hand my character to an AI</b><small>An AI keeps playing your seat with everything you own.</small></button>' +
      '<button class="lv-opt" data-lv="split"' + (others.length ? '' : ' disabled') + '><b>Split it evenly</b><small>Cash and deeds shared among the ' + others.length + ' other players (Shops sold back to the bank first).</small></button>' +
      '<div class="lv-opt lv-one"><b>Give everything to one player</b><small>' + others.map(function (p) { return '<button class="lv-pick" data-lv="one" data-to="' + p.id + '">' + chip(p) + esc(p.name) + '</button>'; }).join('') + '</small></div>' +
      '<button class="lv-opt" data-lv="pot"><b>Throw it all into the Dirt Lot pot</b><small>Cash goes into the jackpot; deeds go back to the bank (Shops sold back).</small></button>' +
      '<button class="big-btn ghostbtn" data-lv="cancel">CANCEL</button>';
    el.innerHTML = '<div class="lv-card">' + h + '</div>'; el.hidden = false; vib(20);
  }
  // v0.1.2: the host can end the game and bring everyone back to setup (same room, nobody re-scans, no recasting)
  function openNewGame() {
    var el = $('leaveBox');
    el.innerHTML = '<div class="lv-card"><div class="lv-t">Start a new game?</div><div class="lv-s">Are you sure? <b>This game ends right now</b> for everyone, with no winner. All phones go back to setup in the same room, so nobody has to scan again.</div>' +
      '<button class="big-btn red" data-lv="newgame-yes">YES, NEW GAME</button><button class="big-btn ghostbtn" data-lv="cancel">CANCEL</button></div>';
    el.hidden = false; vib(20);
  }
  $('leaveBox').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lv]'); if (!b || b.disabled) { if (e.target === $('leaveBox')) $('leaveBox').hidden = true; return; }
    var k = b.getAttribute('data-lv');
    if (k === 'cancel') { $('leaveBox').hidden = true; return; }
    if (k === 'newgame-yes') { send({ t: 'newGame' }); $('leaveBox').hidden = true; vib([30, 30, 90]); toast('Back to setup\u2026'); return; }
    if (k === 'sure') { openLeave(2); return; }
    send({ t: 'leaveGame', how: k, to: k === 'one' ? +b.getAttribute('data-to') : null }); $('leaveBox').hidden = true; vib([40, 40, 120]);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'chatText') sendChat(); });
  chatInput.addEventListener('click', function (e) { if (e.target.id === 'chatSend') sendChat(); });
  function sendChat(text) {
    var inp = $('chatText'), t = text || (inp ? inp.value : ''); if (!t.trim() || ui.thread == null) return;
    send({ t: 'chat', to: ui.thread, text: t.trim() }); if (!text && inp) inp.value = ''; vib(10);
  }
  // hold-to-accept (1 s)
  var hold = null;
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('[data-hold]'); if (!b) return; e.preventDefault();
    var bar = b.querySelector('.bar'), t0 = Date.now(), id = +b.getAttribute('data-hold');
    hold = { id: id, timer: setInterval(function () { var f = (Date.now() - t0) / 1000; if (bar) bar.style.width = Math.min(100, f * 100) + '%'; if (f >= 1) { clearInterval(hold.timer); hold = null; send({ t: 'accept', id: id }); vib([40, 40, 120]); SFX.play('deal'); } }, 30) };
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { document.addEventListener(ev, function () { if (hold) { clearInterval(hold.timer); hold = null; var bars = document.querySelectorAll('.hold .bar'); Array.prototype.forEach.call(bars, function (x) { x.style.width = '0'; }); } }); });

  window.RDRC = { state: function () { return st; }, send: send, setTab: setTab, ui: ui, openBuilder: openBuilder, join: join };
})();
