/* RED DEER RICH - phone controller (v0.1.1 .. v0.5). Four tabs (My Turn, My Stuff, Board, Deals & Chat) that adapt to
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
  var ui = { sel: 0, thread: null, builder: null, seen: JSON.parse(store.get('rdr_seen') || '{}'), carIdx: 0, aiChar: null, aiLevel: 'normal', lastRollSeq: -1, diceT: 0, graceUntil: 0, fades: {},
    stuffView: store.get('rdr_stuffView') === 'list' ? 'list' : 'cards', heckleAt: 0, heckToast: 0 };      // v0.4: My Stuff view is remembered (cards by default)
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function send(m) { if (net) net.send(m); }
  function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 2400); }
  function pById(id) { if (!st) return null; for (var i = 0; i < st.players.length; i++) if (st.players[i].id === id) return st.players[i]; return null; }
  function initials(n) { return R.initials(n || '?'); }
  function chip(p, cls) { if (!p) return ''; var ch = charById(p.charId); return '<span class="' + (cls || 'mini-chip') + '" style="background:' + p.color + ';color:' + ch.ink + ';border-color:' + (p.state === 'gold' ? '#ffd23f' : '#fff') + '">' + esc(initials(p.name)) + '</span>'; }
  // v0.4: a player's real piece (same crowns / accessories as the TV board) in a little canvas
  function pieceCv(p, px, cls) { if (!p) return ''; return '<canvas class="pc ' + (cls || '') + '" data-pc="' + p.id + '" width="' + px * 2 + '" height="' + px * 2 + '" style="width:' + px + 'px;height:' + px + 'px"></canvas>'; }
  function paintPieces(root) {
    if (!root) return; var list = root.querySelectorAll('canvas[data-pc]');
    for (var i = 0; i < list.length; i++) { var cv = list[i], q = pById(+cv.getAttribute('data-pc')); if (!q) continue; var W = cv.width, c = cv.getContext('2d'); c.clearRect(0, 0, W, W); R.drawPiece(c, q, W / 2, W * 0.57, W * 0.27, 0); }
  }
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
    if (prev && prev.me && s.me && prev.phase === 'play' && s.phase === 'play' && !s.me.observer && prev.me.id === s.me.id && prev.me.cash !== s.me.cash) cashFx(s.me.cash - prev.me.cash);   // v0.5
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
    if (inc('gotEm')) { SFX.play('cash'); vib([30, 40, 30]); toast('CAUGHT! +' + money((f.gotEmData || {}).amount), 2600); }   // cha-ching + light vibration for the catcher
    if (inc('turn') && st.turn && st.turn.pid === st.me.id) { SFX.play('turn'); vib([40, 60, 40]); if (tab !== 'turn') { var busy = ui.builder || (document.activeElement && document.activeElement.id === 'chatText'); if (busy) toast('Your turn!'); else setTimeout(function () { setTab('turn'); }, 0); } }
    if (inc('offer')) { SFX.play('click'); vib(30); toast('\uD83E\uDD1D New deal offer'); }
    if (inc('deal')) { SFX.play('deal'); vib(60); toast('Deal CEMENTED!'); }
    if (inc('msg')) { vib(15); }
    if (inc('auction') && !st.me.bankrupt) { SFX.play('click'); vib([50, 40, 50]); toast('\uD83D\uDD28 AUCTION! Bid with the buttons at the top', 2600); }
    if (inc('tab')) { vib([100, 50, 100]); }
    if (inc('paid')) paidInFull(f.paidData || {});                                                  // v0.4 PAID IN FULL
    if (inc('disaster')) disasterAlert(f.disasterData || {}, true);                                   // v0.5 Disasters: the owner's phone
    if (inc('repaired')) { var rd = f.repairedData || {}; if (rd.sp != null) { SFX.play('repair'); vib(30); toast('\uD83D\uDD27 ' + S[rd.sp].name + ' is open again' + (rd.how === 'rush' ? ' (rush repair)' : ''), 2200); if (!$('disSheet').hidden && ui.disSp === rd.sp) $('disSheet').hidden = true; } }
    if (inc('heckled')) heckled(Math.min(6, (f.heckled || 0) - (lastFx.heckled || 0)), f.heckledData || {});   // v0.4 Heckle
    lastFx = JSON.parse(JSON.stringify(f));
  }
  function boom(d) {
    hidePayup();
    $('boomSub').innerHTML = esc(d.owner || 'The owner') + ' hit PAY UP first.<br>Rent: ' + money(d.amount) + (d.sp != null ? ' on ' + esc(S[d.sp].name) : '');
    $('boom').hidden = false; SFX.play('boom'); setTimeout(function () { SFX.play('drain'); }, 220); vib([40, 50, 40]);   // v0.3: half-strength boom, a "funds removed" coin drain, light vibration
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
      var tm = st.timer || { min: null, eff: 0 };
      $('hTimer').innerHTML = '\u23F1 ' + (tm.eff ? tm.eff + ' min' : 'No timer');
      $('hTimer').classList.toggle('on', !!tm.eff);
      $('hModeInfo').textContent = C.modes[st.mode] ? C.modes[st.mode].label + ': ' + C.modes[st.mode].blurb + ' \u00b7 start with ' + money(C.modes[st.mode].startCash) + ' \u00b7 ' + (tm.eff ? 'ends after ' + tm.eff + ' min' : 'no timer') + (tm.min == null ? ' (mode default)' : '') : '';
      $('startBtn').disabled = st.players.length < 2;
      var h = st.hue;
      $('hHue').innerHTML = h && h.ok ? '<div class="hb-title">\uD83D\uDCA1 Philips Hue found. Use lights?</div><div class="chips"><button data-hue="on" class="' + (h.enabled ? 'on' : '') + '">Yes</button><button data-hue="off" class="' + (!h.enabled ? 'on' : '') + '">No</button>' +
        (h.enabled ? h.groups.map(function (g) { return '<button data-hueg="' + esc(g.id) + '" class="' + (h.selected.indexOf(g.id) !== -1 ? 'on' : '') + '">' + esc(g.name) + '</button>'; }).join('') : '') + '</div>' : '';
    }
  }
  function drawCarousel(ch) {
    var cv = $('carCv'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
    ['rags', 'good', 'gold'].forEach(function (s, k) {
      var x = 60 + k * 120, y = 70;
      R.drawPiece(c, { charId: ch.id, color: ch.color, name: ch.name, state: s }, x, y, 30, Date.now());
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
  function setupNow() { var r = {}; C.options.forEach(function (o) { r[o.k] = !!st.rules[o.k]; }); return { rules: r, mode: st.mode, timer: st.timer ? st.timer.min : null, ai: st.players.filter(function (p) { return p.ai; }).length, level: ui.aiLevel }; }
  var saveT = 0;
  function saveSetupSoon() { clearTimeout(saveT); saveT = setTimeout(function () { if (st && st.me && st.me.vip && st.phase !== 'play') store.set('rdr_setup', JSON.stringify(setupNow())); }, 700); }
  function restoreSetup() {
    if (ui.restored || !st || st.phase !== 'lobby') return; ui.restored = true;
    if (st.setupEdited) return;     // v0.3: rejoining a room whose setup was already changed (TV or phone): the live settings win
    var saved = null; try { saved = JSON.parse(store.get('rdr_setup') || 'null'); } catch (e) {}
    if (!saved || !saved.rules) return;
    if (saved.level && C.ai.levels[saved.level]) ui.aiLevel = saved.level;
    var nAi = st.players.filter(function (p) { return p.ai; }).length, add = Math.max(0, Math.min((saved.ai | 0) - nAi, C.maxPlayers - st.players.length));
    var msg = { t: 'settings', rules: saved.rules, mode: saved.mode, addAI: add, level: ui.aiLevel }; if ('timer' in saved) msg.timer = saved.timer; send(msg);
    toast('Set up like last time. Change anything below.', 2400);
  }
  $('hostBox').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-mode')) { send({ t: 'mode', v: b.getAttribute('data-mode') }); saveSetupSoon(); }
    if (b.getAttribute('data-preset')) { send({ t: 'preset', v: b.getAttribute('data-preset') }); vib(20); SFX.play('click'); saveSetupSoon(); }
    if (b.getAttribute('data-hue')) send({ t: 'hue', enabled: b.getAttribute('data-hue') === 'on' });
    if (b.getAttribute('data-hueg')) send({ t: 'hue', toggle: b.getAttribute('data-hueg') });
  });
  $('hTimer').onclick = function () { var ch = C.timerChoices || [0, 20, 30, 45, 60, 90], cur = st.timer ? st.timer.eff || 0 : 0, i = ch.indexOf(cur); send({ t: 'timer', v: ch[(i + 1) % ch.length] }); vib(15); SFX.play('click'); saveSetupSoon(); };   // v0.5
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
    var pc = $('myPiece');
    if (me.observer) { pc.hidden = true; $('myName').textContent = '\uD83D\uDC40 Watching'; var ob = $('myBadge'); ob.className = 'badge'; ob.textContent = 'OBSERVER \u00b7 ' + me.name; $('myCash').textContent = ''; return; }
    pc.hidden = false;
    var pk = [p.charId, p.color, p.state, p.name, me.snow].join('|');     // v0.4: my real piece, redrawn only when it changes
    if (pc._k !== pk) { pc._k = pk; var pcx = pc.getContext('2d'); pcx.clearRect(0, 0, pc.width, pc.height); R.drawPiece(pcx, { charId: p.charId, color: p.color, name: p.name, state: p.state, snow: me.snow }, pc.width / 2, pc.height * 0.57, pc.width * 0.27, 0); }
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
    var hk = !mine && t.heckle && st.rules.heckle;      // v0.4 Heckle: a tiny button beside a stalling player's name
    h += '<div class="whose">' + (mine ? '<b style="color:#ffd23f">YOUR TURN</b>' : pieceCv(cur, 40, 'wpc') + '<span><b>' + esc(t.name) + '</b>\'s turn</span>' +
      (hk ? '<button class="heckle' + (t.heckle.forever ? ' hot' : '') + '" data-act="heckle" aria-label="Heckle ' + esc(t.name) + '">\uD83D\uDE02</button>' : '')) + '</div>';
    h += '<div class="dicebox" id="diceBox">' + wakeBtn() + '<canvas id="pdice" width="360" height="180"></canvas>' + (mine && (t.stage === 'roll' || t.canRollAgain) ? '<div class="swipe">Swipe up' + (shk.on ? ', shake' : '') + ' or tap ROLL</div>' : '') + '</div>';
    if (me.bankrupt) h += '<div class="info">You\'re bankrupt. Stick around: you can still chat and watch.</div>';
    else if (mine) {
      if (t.tab) {
        h += '<div class="info warn"><b>You owe ' + money(t.tab.amount) + '</b> (' + esc(t.tab.reason) + ').<br>Sell Shops or mortgage deeds in <b>My Stuff</b>, or make a deal: it pays itself the moment you have enough. Or let it raise the cash for you.</div>';
        if (!t.tab.hopeless) {
          var pl = t.tab.plan;    // v0.5 smarter auto-raise: show the plan, OK runs it, or do it by hand in My Stuff
          if (pl && pl.text) h += '<div class="plan"><small>Auto-raise plan</small><b>' + boldMoney(esc(pl.text)) + '</b></div><div class="twoup"><button class="act buy" data-act="raise">OK, DO IT</button><button class="act" data-act="byHand">ADJUST BY HAND</button></div>';
          else h += '<button class="act buy" data-act="raise">AUTO-RAISE CASH</button>';
        }
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
      if (st.round <= 1) h += '<div class="info">PAY UP zone: when someone lands on your deed, a giant button takes over this phone. Hit it before they pass the dice.</div>';
      if (me.snow) h += '<div class="info">\u2744 You\'re in the Snowbank, but you can still trade, build and hit PAY UP.</div>';
    }
    if (setH($('turnMain'), h)) paintPieces($('turnMain'));
    var side = '';
    if (t.card) { var cd = B.DECKS[t.card.deck][t.card.idx]; side += cardHtml(t.card.deck, cd, t.card.idx); }
    else if (st.lastFind && st.lastFind.fresh && B.FINDS[st.lastFind.idx]) side += cardHtml('finds', B.FINDS[st.lastFind.idx], st.lastFind.idx);
    else if (st.lastFind) { var lf = B.FINDS[st.lastFind.idx]; if (lf) side += '<div class="lastfind"><span>\uD83D\uDCDC Latest Secret Find<br><b>' + esc(lf.h) + '</b></span><button data-act="readFind" data-idx="' + st.lastFind.idx + '">READ MORE</button></div>'; }
    side += historyHtml(st.feed, st.feedCard, false);
    if (st.endsIn) side = '<div class="info timeleft">\u23F1 ' + clock(st.endsIn) + ' left' + (C.modes[st.mode] ? ' \u00b7 ' + C.modes[st.mode].label : '') + '</div>' + side;
    setH($('turnSide'), side);
    if (t.roll && t.rollSeq !== ui.lastRollSeq) { ui.lastRollSeq = t.rollSeq; ui.diceT = Date.now(); }
    drawDice(); updatePass(); bindSwipe();
  }
  // v0.3 decks: Red Deer Randomness (playful) and Secret Finds (old paper; a true story, with READ MORE)
  function cardHtml(deck, cd, idx) {
    if (deck === 'finds') return '<div class="pcard finds"><div class="deck">\uD83D\uDCDC ' + esc(C.decks.finds.name) + '</div><div class="era">' + esc(cd.year) + ' \u00b7 ' + esc(C.eras[cd.era] || '') + '</div><div class="h">' + esc(cd.h) + '</div><div class="story">' + esc(cd.story) + '</div><div class="fxl">' + esc(cd.t) + '</div>' +
      '<button class="readmore" data-act="readFind" data-idx="' + idx + '">READ MORE</button></div>';
    return '<div class="pcard random"><div class="deck">\u2684 ' + esc(C.decks.random.name) + '</div><div class="h">' + esc(cd.h) + '</div><div>' + esc(cd.t) + '</div></div>';
  }
  function openFind(idx) {
    var c = B.FINDS[idx]; if (!c) return;
    $('findSheet').classList.remove('rand'); $('fsDeck').textContent = '\uD83D\uDCDC SECRET FINDS';
    $('fsEra').textContent = c.year + ' \u00b7 ' + (C.eras[c.era] || ''); $('fsH').textContent = c.h; $('fsStory').textContent = c.story; $('fsMore').textContent = c.more || '';
    $('fsFx').textContent = 'Card: ' + c.t; $('fsSrc').textContent = c.src && c.src.length ? 'Source: ' + c.src.map(function (u) { return u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; }).join(', ') : '';
    $('findSheet').hidden = false;
  }
  $('findSheet').onclick = function (e) { if (e.target === $('findSheet') || e.target === $('fsOk')) $('findSheet').hidden = true; };
  // ---- v0.4 game history: every drawn card (both decks, anyone's) can be tapped open, like Secret Finds' READ MORE
  function boldMoney(h) { return String(h).replace(/(\u2212|-|\+)?\$[0-9][0-9,]*/g, function (m) { return '<b class="amt">' + m + '</b>'; }); }   // v0.5
  var NAMED = null;
  function spInLine(l) {     // v0.5: the first deed a history line names (longest names first, so "Gasoline Alley West" beats "Gasoline Alley")
    if (!NAMED) { NAMED = []; for (var i = 0; i < 40; i++) if (S[i].price) NAMED.push(i); NAMED.sort(function (a, b) { return S[b].name.length - S[a].name.length; }); }
    for (var k = 0; k < NAMED.length; k++) if (l.indexOf(S[NAMED[k]].name) >= 0) return NAMED[k];
    return -1;
  }
  function feedLines(feed, cards, newestFirst, evs) {
    evs = evs || st.feedEv || [];
    var rows = (feed || []).map(function (l, i) {
      var cd = cards && cards[i], ev = evs[i];
      if (cd) return '<button class="fline ' + cd[0] + '" data-act="readCard" data-deck="' + cd[0] + '" data-idx="' + cd[1] + '"><span>' + (cd[0] === 'finds' ? '\uD83D\uDCDC ' : '\u2684 ') + boldMoney(esc(l)) + '</span><i>READ</i></button>';
      if (ev) return '<button class="fline ev" data-act="readEv" data-e="' + ev[0] + '" data-sp="' + ev[1] + '"><span>' + boldMoney(esc(l)) + '</span><i>MORE</i></button>';
      var sp = spInLine(l);
      if (sp >= 0) return '<div class="fline deed" data-act="deed" data-sp="' + sp + '">' + boldMoney(esc(l)) + '</div>';
      return '<div>' + boldMoney(esc(l)) + '</div>';
    });
    if (newestFirst) rows.reverse();
    return rows.join('');
  }
  function historyHtml(feed, cards) {
    var n = (st.cards || []).length;
    return '<div class="hist-h"><span>History</span>' + (n ? '<button class="cardsbtn" data-act="cardList">\uD83C\uDCCF Cards drawn (' + n + ')</button>' : '') + '</div><div class="feed">' + feedLines(feed, cards, false) + '</div>';
  }
  function openCard(deck, idx) {
    if (deck === 'finds') { openFind(idx); return; }
    var c = B.DECKS.random[idx]; if (!c) return;
    var fs = $('findSheet'); fs.classList.add('rand');
    $('fsDeck').textContent = '\u2684 ' + C.decks.random.name.toUpperCase(); $('fsEra').textContent = c.era && C.eras[c.era] ? C.eras[c.era] : '';
    $('fsH').textContent = c.h; $('fsStory').textContent = c.t; $('fsMore').textContent = ''; $('fsFx').textContent = ''; $('fsSrc').textContent = '';
    fs.hidden = false;
  }
  function openCardList() {
    var list = (st.cards || []).slice().reverse();
    setH($('clRows'), list.map(function (x) {
      var c = B.DECKS[x[0]] && B.DECKS[x[0]][x[1]]; if (!c) return '';
      var who = pById(x[2]);
      return '<button class="clrow ' + x[0] + '" data-act="readCard" data-deck="' + x[0] + '" data-idx="' + x[1] + '"><span class="ic">' + (x[0] === 'finds' ? '\uD83D\uDCDC' : '\u2684') + '</span><span class="t"><b>' + esc(c.h) + '</b><small>' + esc(who ? who.name : '?') + ' \u00b7 round ' + x[3] + '</small></span><i>READ</i></button>';
    }).join('') || '<div class="muted">No cards yet.</div>');
    $('cardList').hidden = false;
  }
  $('cardList').addEventListener('click', function (e) { if (e.target === $('cardList') || e.target === $('clOk')) $('cardList').hidden = true; });

  // ---- v0.4 PAID IN FULL: the debt cleared itself the moment the cash was there
  function paidInFull(d) {
    var el = $('paid');
    $('paidSub').textContent = money(d.amount) + (d.to ? ' to ' + d.to : '') + ' \u2714';
    el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
    SFX.play('paid'); vib([40, 60, 40, 60, 180]);
    clearTimeout(paidInFull._t); paidInFull._t = setTimeout(function () { el.hidden = true; }, 2700);
  }
  $('paid').onclick = function () { $('paid').hidden = true; };

  // ---- v0.4 Heckle: laughing faces float up the stalling player's phone; the heckler sees a little one leave the button
  function spawnFace(x, y, size, rise) {
    var box = $('faces'), F = C.heckle.faces; if (box.children.length > 24) return;
    var el = document.createElement('span'); el.className = 'face'; el.textContent = F[Math.floor(Math.random() * F.length)];
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.fontSize = size + 'px';
    el.style.setProperty('--dx', ((Math.random() - 0.5) * 80).toFixed(0) + 'px'); el.style.setProperty('--rise', (rise || 0.8 * innerHeight).toFixed(0) + 'px');
    el.style.setProperty('--rot', ((Math.random() - 0.5) * 50).toFixed(0) + 'deg'); el.style.animationDuration = (1.5 + Math.random() * 0.9).toFixed(2) + 's';
    box.appendChild(el); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  }
  function heckled(n, d) {
    for (var i = 0; i < Math.min(9, 3 * Math.max(1, n)); i++) (function (k) { setTimeout(function () { spawnFace(innerWidth * (0.1 + Math.random() * 0.8), innerHeight * (0.82 + Math.random() * 0.12), 34 + Math.random() * 30); }, k * 90); })(i);
    vib([25, 35, 25]); SFX.play('heckle');
    if (Date.now() - ui.heckToast > 5000 && d.from) { ui.heckToast = Date.now(); toast('\uD83D\uDE02 ' + d.from + ' is heckling you. Do something!', 1600); }
  }
  function doHeckle(btn) {
    var now = Date.now(); if (now - ui.heckleAt < 280) return; ui.heckleAt = now;
    send({ t: 'heckle' }); vib(10);
    var r = btn.getBoundingClientRect(); spawnFace(r.left + r.width / 2 - 12, r.top, 22, 120);
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  }
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
  function doRoll(viaShake) { if (!viaShake) askMotion(); var t = st.turn; if (t && t.pid === st.me.id && (t.stage === 'roll' || t.canRollAgain)) { send({ t: 'roll' }); vib(40); SFX.play('dice'); ui.diceT = Date.now(); drawDice(); } }

  // ------------------------------------------------------------------ My Stuff
  function myDeeds() { var out = []; st.props.forEach(function (pr, i) { if (pr && pr[0] === st.me.id) out.push(i); }); return out; }
  function ownsGroup(pid, gr) { return B.GROUP_MEMBERS[gr].every(function (i) { return st.props[i][0] === pid; }); }
  function rentNow(sp) {
    var s = S[sp], pr = st.props[sp]; if (pr[2]) return 0;
    var dm = pr[4]; if (dm && dm[1]) return 0;                                   // v0.5 closed for repairs
    if (dm) { var full = rentBase(sp); return typeof full === 'number' ? Math.floor(full / 2) : full + ' \u00f7 2'; }
    return rentBase(sp);
  }
  function rentBase(sp) {
    var s = S[sp], pr = st.props[sp];
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
  // v0.4 My Stuff: a slim header (view switch top-left, cash, worth), then either the deed LIST or the CARDS (cover flow)
  var ICON_LIST = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  var ICON_CARDS = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="8" y="3" width="9" height="15" rx="2" fill="currentColor"/><rect x="2.5" y="6" width="7" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-10 6 12)"/><rect x="15" y="6" width="7" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(10 18 12)"/></svg>';
  function sortedDeeds() { return myDeeds().sort(function (a, b) { var ga = S[a].group, gb = S[b].group; return ga === gb ? boardRank(a) - boardRank(b) : firstRank(ga) - firstRank(gb); }); }
  function firstRank(gr) { return Math.min.apply(null, B.GROUP_MEMBERS[gr].map(boardRank)); }
  function deedInfo(sp) {
    var s = S[sp], pr = st.props[sp], me = st.me, gr = s.group, G = B.GROUPS[gr], members = B.GROUP_MEMBERS[gr];
    var full = ownsGroup(me.id, gr), shops = pr[1], setShops = members.map(function (i) { return st.props[i][1]; });
    var anyShops = setShops.some(function (x) { return x > 0; }), anyMort = members.some(function (i) { return st.props[i][2]; });
    var cost = G.shop || 0, back = Math.floor(cost * C.shopSellBack), even = st.rules.evenBuild;
    return { s: s, G: G, members: members, have: members.filter(function (i) { return st.props[i][0] === me.id; }).length, full: full, shops: shops, mort: !!pr[2], lock: !!pr[3], cost: cost, back: back,
      canB: s.type === 'prop' && full && !anyMort && shops < 5 && (!even || shops <= Math.min.apply(null, setShops)) && me.cash >= cost && !pr[3],
      canS: shops > 0 && (!even || shops >= Math.max.apply(null, setShops)),
      canM: !pr[2] && !anyShops && !pr[3], unCost: Math.ceil(s.hock * (1 + C.unhockFee)) };
  }
  function rentStr(sp) { var r = rentNow(sp); return typeof r === 'number' ? money(r) : r; }
  function renderStuff() {
    var me = st.me, deeds = sortedDeeds(), G = C.states, max = G.goldNetWorth * 1.15, pct = function (v) { return Math.min(100, v / max * 100); }, cards = ui.stuffView === 'cards';
    $('tab-stuff').classList.toggle('cards', cards);
    var t = st.turn, owe = t && t.tab && t.pid === me.id;
    var h = '<div class="stuffhead"><button class="viewsw" data-act="stuffView" aria-label="' + (cards ? 'Show my deeds as a list' : 'Show my deeds as cards') + '">' + (cards ? ICON_LIST : ICON_CARDS) + '</button>' +
      '<div class="sh-cash">' + money(me.cash) + '<small>cash</small></div><div class="sh-worth"><span class="badge ' + me.state + '">' + (me.state === 'gold' ? 'GOLD' : me.state === 'good' ? 'DOING GOOD' : 'RAGS') + '</span><small>worth ' + money(me.worth) + '</small></div></div>';
    h += '<div class="meter slim"><div class="fill" style="width:' + pct(me.worth) + '%"></div><span class="mk" style="left:' + pct(G.goodNetWorth) + '%"></span><span class="mk gold" style="left:' + pct(G.goldNetWorth) + '%"></span></div>';
    if (me.passes || me.lockedCash) h += '<div class="sh-extra">' + (me.passes ? '\uD83D\uDE9A ' + me.passes + ' Tow Pass' + (me.passes > 1 ? 'es' : '') : '') + (me.lockedCash ? ' \uD83D\uDD12 ' + money(me.lockedCash) + ' locked for your Tab' : '') + '</div>';
    if (owe) h += '<div class="info warn slim">You owe <b>' + money(t.tab.amount) + '</b>. Sell or mortgage below: it pays itself the moment you have enough.</div>';
    setH($('stuffMain'), h);
    if (cards) { $('flowBox').hidden = false; renderFlow(deeds); setH($('stuffSide'), moreHtml()); }
    else { $('flowBox').hidden = true; closeSet(true); setH($('stuffSide'), listHtml(deeds) + moreHtml()); }
  }
  function listHtml(deeds) {
    var me = st.me, groups = {}, order = [], out = '';
    deeds.forEach(function (sp) { var gr = S[sp].group; if (!groups[gr]) { groups[gr] = []; order.push(gr); } groups[gr].push(sp); });
    order.forEach(function (gr) {
      var G2 = B.GROUPS[gr], full = ownsGroup(me.id, gr);
      out += '<div class="grp"><div class="grp-h"><span class="sw" style="background:' + G2.color + '"></span>' + G2.name + (full && G2.shop ? ' \u00b7 FULL SET' : ' \u00b7 ' + groups[gr].length + '/' + B.GROUP_MEMBERS[gr].length) + '</div>';
      groups[gr].forEach(function (sp) {
        var I = deedInfo(sp), s = I.s, shops = I.shops;
        var stat = I.mort ? 'MORTGAGED' : shops === 5 ? 'MEGA-PLEX' : shops ? shops + ' Shop' + (shops > 1 ? 's' : '') : 'no Shops';
        out += '<div class="deedrow' + (I.mort ? ' hocked' : '') + (st.props[sp][4] ? ' damaged' : '') + '" data-act="pingTile" data-sp="' + sp + '" style="border-left-color:' + G2.color + '"><div class="dn">' + (I.lock ? '\uD83D\uDD12 ' : '') + esc(s.name) + '<small>' + stat + ' \u00b7 rent ' + rentStr(sp) + '</small>' + dmgBadge(sp) + '</div>' + rushBtn(sp, 'sbtn');
        if (s.type === 'prop' && I.full && !I.mort) out += '<button class="sbtn buy" data-act="build" data-sp="' + sp + '"' + (I.canB ? '' : ' disabled') + '>' + (shops === 4 ? 'MEGA' : 'BUY') + ' <small>(\u2212' + money(I.cost) + ')</small></button><button class="sbtn" data-act="sell" data-sp="' + sp + '"' + (I.canS ? '' : ' disabled') + '>SELL <small>(+' + money(I.back) + ')</small></button>';
        out += I.mort ? '<button class="sbtn" data-act="unhock" data-sp="' + sp + '"' + (me.cash >= I.unCost ? '' : ' disabled') + '>UNMORTGAGE <small>(\u2212' + money(I.unCost) + ')</small></button>' : '<button class="sbtn" data-act="hock" data-sp="' + sp + '"' + (I.canM ? '' : ' disabled') + '>MORTGAGE <small>(+' + money(s.hock) + ')</small></button>';
        out += '</div>';
      });
      out += '</div>';
    });
    return out || '<div class="info">No deeds yet. Land on one and hit BUY!</div>';
  }
  function moreHtml() {
    var me = st.me, h = '<button class="ghost morebtn" data-act="moreToggle">\u22EF ' + (ui.moreOpen ? 'Less' : 'Leave or new game') + '</button>';
    if (ui.moreOpen) { if (!me.bankrupt) h += '<button class="ghost leavebtn" data-act="leave">\uD83D\uDEAA Leave game\u2026</button>'; if (me.vip) h += '<button class="ghost leavebtn" data-act="newgame">\uD83D\uDD04 New game (back to setup)\u2026</button>'; }
    return h;
  }

  // ---- v0.4 cards view: an iPod-style cover flow on a slight arc. Swipe with momentum, tap the front card (or pinch
  // open) to unfold its colour set, tap a side card to bring it to the front. The front card carries BUY / SELL at the
  // top; MORTGAGE flips it over to a Confirm on the back. Mortgaged cards stay flipped, with Unmortgage on the back.
  var flow = { pos: 0, target: null, vel: 0, els: {}, order: [], raf: 0, drag: null, flip: {}, open: null, cw: 200, ch: 284, last: 0, touches: 0, pinch: null };
  function cardFront(sp) {
    var I = deedInfo(sp), s = I.s, col = gcol(sp), h = '';
    if (s.type === 'prop') {
      if (I.full && !I.mort) h += '<div class="fc-btns"><button class="fb buy" data-act="build" data-sp="' + sp + '"' + (I.canB ? '' : ' disabled') + '>' + (I.shops === 4 ? 'MEGA' : 'BUY') + '<small>(\u2212' + money(I.cost) + ')</small></button><button class="fb sell" data-act="sell" data-sp="' + sp + '"' + (I.canS ? '' : ' disabled') + '>SELL<small>(+' + money(I.back) + ')</small></button></div>';
      else h += '<div class="fc-btns need">' + (I.full ? 'Unmortgage the set to build' : 'Own all ' + I.members.length + ' to build \u00b7 ' + I.have + '/' + I.members.length) + '</div>';
    } else h += '<div class="fc-btns need">' + (s.type === 'whistle' ? 'Whistle Stop' : 'Utility') + ' \u00b7 ' + I.have + '/' + I.members.length + '</div>';
    h += '<div class="fc-band" style="background:' + col + '"><b>' + (I.lock ? '\uD83D\uDD12 ' : '') + esc(s.name) + '</b><small>' + esc(I.G.name) + '</small></div><div class="fc-body">';
    if (st.props[sp][4]) h += '<div class="fc-dmg">' + dmgBadge(sp) + rushBtn(sp, 'fb rush') + '</div>';      // v0.5
    if (s.type === 'prop') {
      var cur = I.mort ? -1 : I.shops;
      h += '<div class="ladder">' + s.rents.map(function (r, k) { return '<div class="lr' + (k === cur ? ' on' : '') + '"><span>' + (k === 0 ? (I.full ? 'Rent \u00d72 (set)' : 'Rent') : k === 5 ? 'Mega-Plex' : '\uD83C\uDFE0'.repeat(k)) + '</span><b>' + money(k === 0 && I.full ? r * 2 : r) + '</b></div>'; }).join('') + '</div>';
      h += I.full && !I.mort && I.shops < 5 ? '<div class="fc-next">Next ' + (I.shops === 4 ? 'Mega-Plex' : 'Shop #' + (I.shops + 1)) + ' <b>' + money(I.cost) + '</b> \u2192 rent ' + money(s.rents[I.shops + 1]) + '</div>' : '<div class="fc-next">' + (I.shops === 5 ? 'Maxed out: Mega-Plex' : 'Rent now ' + rentStr(sp)) + '</div>';
    } else if (s.type === 'whistle') {
      var nW = B.WHISTLES.filter(function (w) { return st.props[w][0] === st.me.id; }).length;
      h += '<div class="ladder">' + [1, 2, 3, 4].map(function (k) { return '<div class="lr' + (k === nW && !I.mort ? ' on' : '') + '"><span>' + k + ' stop' + (k > 1 ? 's' : '') + '</span><b>' + money(B.WHISTLE_RENT[k]) + '</b></div>'; }).join('') + '</div><div class="fc-next">Rent now ' + rentStr(sp) + '</div>';
    } else {
      var nJ = B.GROUP_MEMBERS.juice.filter(function (w) { return st.props[w][0] === st.me.id; }).length;
      h += '<div class="ladder">' + [1, 2].map(function (k) { return '<div class="lr' + (k === nJ && !I.mort ? ' on' : '') + '"><span>Own ' + k + '</span><b>dice \u00d7' + B.JUICE_MULT[k] + '</b></div>'; }).join('') + '</div><div class="fc-next">Rent is the dice roll times that</div>';
    }
    h += '<div class="fc-foot"><span>Price ' + money(s.price) + '</span><button class="fb mort" data-act="flipMort" data-sp="' + sp + '"' + (I.canM ? '' : ' disabled') + '>MORTGAGE<small>(+' + money(s.hock) + ')</small></button></div></div>';
    return h;
  }
  function cardBack(sp) {
    var I = deedInfo(sp), s = I.s, col = gcol(sp);
    var h = '<div class="fc-band slim" style="background:' + col + '"><b>' + esc(s.name) + '</b></div><div class="fc-backbody">';
    if (I.mort) h += '<div class="stamp">MORTGAGED</div><button class="fb confirm unm" data-act="unhock" data-sp="' + sp + '"' + (st.me.cash >= I.unCost ? '' : ' disabled') + '>UNMORTGAGE<small>(\u2212' + money(I.unCost) + ')</small></button><div class="faint">No rent while it\u2019s mortgaged. You got ' + money(s.hock) + ' for it. Price ' + money(s.price) + '.</div>';
    else h += '<div class="bv"><small>Mortgage for</small><b>+' + money(s.hock) + '</b></div><button class="fb confirm" data-act="hock" data-sp="' + sp + '">CONFIRM</button><div class="faint">No rent from it (now ' + rentStr(sp) + ') until you pay ' + money(I.unCost) + ' to unmortgage. No building on the set meanwhile.</div><button class="fb cancel" data-act="flipBack" data-sp="' + sp + '">Cancel</button>';
    return h + '</div>';
  }
  function makeCard(sp) {
    var el = document.createElement('div'); el.className = 'fcard'; el.setAttribute('data-sp', sp);
    el.innerHTML = '<div class="fc-rot"><div class="fc-face fc-front"></div><div class="fc-face fc-back"></div></div>';
    el._f = el.querySelector('.fc-front'); el._b = el.querySelector('.fc-back'); return el;
  }
  function fillCard(el, sp) {
    var pr = st.props[sp]; if (pr[2]) delete flow.flip[sp];
    setH(el._f, cardFront(sp)); setH(el._b, cardBack(sp));
    el.classList.toggle('flipped', !!pr[2] || !!flow.flip[sp]); el.classList.toggle('mort', !!pr[2]);
    el.style.setProperty('--gc', gcol(sp));
  }
  function landscape() { return !!(window.matchMedia && matchMedia('(orientation: landscape) and (min-width: 560px)').matches); }
  function sizeFlow() {
    var box = $('flowBox'), W = box.clientWidth || 360, cw, ch;
    if (landscape()) { var H = $('tab-stuff').clientHeight - $('stuffMain').offsetHeight - 30; ch = Math.max(190, Math.min(330, H - 24)); cw = ch / 1.42; }
    else { var Hp = $('tab-stuff').clientHeight - $('stuffMain').offsetHeight - 70; cw = Math.min(300, W * 0.74, Hp > 200 ? Hp / 1.42 : 999); cw = Math.max(170, cw); ch = cw * 1.42; }   // v0.5: bigger portrait cards
    flow.cw = cw; flow.ch = ch; flow.land = landscape();
    box.style.height = Math.round(ch + 34) + 'px';
    box.style.setProperty('--cw', cw.toFixed(1) + 'px'); box.style.setProperty('--ch', ch.toFixed(1) + 'px');
  }
  function initFlow(box) {
    box._init = true;
    box.innerHTML = '<div class="flow" id="flowStage"></div><div class="flow-empty" hidden>No deeds yet. Land on one and hit BUY!</div><div class="flow-hint">Swipe \u00b7 tap the front card to open its set</div>';
    var stg = $('flowStage');
    stg.addEventListener('pointerdown', function (e) {
      if (flow.open || flow.drag || flow.touches >= 2 || e.button > 0 || e.target.closest('button')) return;
      flow.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: flow.pos, moved: false, target: e.target, samples: [[performance.now(), flow.pos]] };
      flow.vel = 0; flow.target = null;
    });
    stg.addEventListener('pointermove', function (e) {
      var d = flow.drag; if (!d || e.pointerId !== d.id) return;
      var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved) { if (Math.abs(dx) < 7) return; if (Math.abs(dy) > Math.abs(dx) * 1.3) { flow.drag = null; return; } d.moved = true; try { stg.setPointerCapture(e.pointerId); } catch (er) {} }
      var n = flow.order.length, p = d.pos0 - dx / (flow.cw * 0.42);
      if (p < 0) p *= 0.35; else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35;
      flow.pos = p; var now = performance.now(); d.samples.push([now, p]); while (d.samples.length > 2 && now - d.samples[0][0] > 90) d.samples.shift();
      layoutFlow();
    });
    function up(e) {
      var d = flow.drag; if (!d || e.pointerId !== d.id) return; flow.drag = null;
      if (!d.moved) { flowTap(d.target); return; }
      var a = d.samples[0], b = d.samples[d.samples.length - 1], dt = b[0] - a[0];
      flow.vel = dt > 5 ? (b[1] - a[1]) / dt : 0; flow.vel = Math.max(-0.03, Math.min(0.03, flow.vel));
      flow.target = clampI(Math.round(flow.pos + flow.vel * 260)); kick();
    }
    stg.addEventListener('pointerup', up); stg.addEventListener('pointercancel', function (e) { if (flow.drag && flow.drag.id === e.pointerId) { flow.drag = null; flow.target = clampI(Math.round(flow.pos)); kick(); } });
    stg.addEventListener('wheel', function (e) { if (flow.open) return; var dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (Math.abs(dd) < 4) return; e.preventDefault(); var now = Date.now(); if (now - (flow.wheelAt || 0) < 140) return; flow.wheelAt = now; flow.target = clampI(Math.round(flow.target == null ? flow.pos : flow.target) + (dd > 0 ? 1 : -1)); flow.vel = 0; kick(); }, { passive: false });
    // pinch open on the wheel unfolds the front card's set; pinch closed on the unfolded set folds it back
    var host = $('tab-stuff').parentNode;
    function dist(e) { var a = e.touches[0], b = e.touches[1]; return Math.max(10, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)); }
    host.addEventListener('touchstart', function (e) { if (tab !== 'stuff' || ui.stuffView !== 'cards') return; flow.touches = e.touches.length; if (e.touches.length === 2) { flow.pinch = { d0: dist(e), done: false }; flow.drag = null; } }, { passive: true });
    host.addEventListener('touchmove', function (e) {
      if (!flow.pinch || e.touches.length !== 2) return; e.preventDefault();
      var r = dist(e) / flow.pinch.d0; if (flow.pinch.done) return;
      if (!flow.open && r > 1.25) { flow.pinch.done = true; openFrontSet(); } else if (flow.open && r < 0.8) { flow.pinch.done = true; closeSet(); }
    }, { passive: false });
    host.addEventListener('touchend', function (e) { flow.touches = e.touches.length; if (e.touches.length < 2) flow.pinch = null; });
    $('flowSet').addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      var c = e.target.closest('.fcard'); if (!c) { closeSet(); return; }
      if (!c.classList.contains('ghost')) ping(+c.getAttribute('data-sp'));
    });
    window.addEventListener('resize', function () { if (tab === 'stuff' && ui.stuffView === 'cards' && st) { sizeFlow(); layoutFlow(); if (flow.open) renderSet(true); } });
  }
  function clampI(i) { return Math.max(0, Math.min(flow.order.length - 1, i)); }
  function ping(sp) { if (!(sp >= 0)) return; send({ t: 'pingTile', sp: sp }); vib(12); }
  function flowTap(target) {
    var el = target && target.closest && target.closest('.fcard'); if (!el) return;
    var sp = +el.getAttribute('data-sp'), i = flow.order.indexOf(sp); if (i < 0) return;
    ping(sp);
    if (Math.abs(i - flow.pos) < 0.5) openSet(S[sp].group); else { flow.target = i; flow.vel = 0; kick(); SFX.play('click'); }
  }
  function renderFlow(deeds) {
    var box = $('flowBox'); if (!box._init) initFlow(box);
    sizeFlow();
    var stg = $('flowStage'), old = flow.order, front = old.length ? old[clampI(Math.round(flow.pos))] : null;
    deeds.forEach(function (sp) { if (!flow.els[sp]) { flow.els[sp] = makeCard(sp); stg.appendChild(flow.els[sp]); } });
    Object.keys(flow.els).forEach(function (k) { if (deeds.indexOf(+k) < 0) { var e = flow.els[k]; if (e.parentNode) e.parentNode.removeChild(e); delete flow.els[k]; } });
    var changed = old.join() !== deeds.join(); flow.order = deeds.slice();
    if (changed && front != null && deeds.indexOf(front) >= 0) { flow.pos = deeds.indexOf(front); flow.target = null; flow.vel = 0; }
    flow.pos = Math.max(0, Math.min(Math.max(0, deeds.length - 1), flow.pos));
    deeds.forEach(function (sp) { fillCard(flow.els[sp], sp); });
    box.querySelector('.flow-empty').hidden = deeds.length > 0; box.querySelector('.flow-hint').hidden = !deeds.length;
    layoutFlow();
    if (flow.open) renderSet(false);
  }
  function layoutFlow() {
    var cw = flow.cw, land = flow.land, gap = cw * (land ? 0.62 : 0.43), step = cw * (land ? 0.13 : 0.07);
    flow.order.forEach(function (sp, i) {
      var el = flow.els[sp]; if (!el) return;
      var d = i - flow.pos, ad = Math.abs(d), sg = d < 0 ? -1 : 1, a1 = Math.min(1, ad);
      if (ad > 9.5) { if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden'; return; }
      if (el.style.visibility) el.style.visibility = '';
      var x = ad <= 1 ? d * gap : sg * (gap + (ad - 1) * step), z = -a1 * cw * 0.55 - Math.max(0, ad - 1) * 7;
      var y = Math.pow(Math.min(ad, 8), 1.45) * cw * 0.016, ry = -sg * a1 * 56, rz = sg * Math.min(ad, 8) * 1.5;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';
      el.style.zIndex = String(1000 - Math.round(ad * 10));
      var fr = ad < 0.5; if (el.classList.contains('front') !== fr) el.classList.toggle('front', fr);
    });
  }
  // critically damped spring toward the target card, starting with the swipe's momentum (no overshoot, no hard stop)
  function kick() { if (!flow.raf) { flow.last = performance.now(); flow.raf = requestAnimationFrame(flowAnim); } }
  function flowAnim() {
    flow.raf = 0; if (flow.drag) return;
    var now = performance.now(), dt = Math.min(100, now - flow.last), w = 0.0155; flow.last = now;
    if (!flow.order.length) return;
    if (flow.target == null) flow.target = clampI(Math.round(flow.pos));
    for (var n = Math.ceil(dt / 4), hh = dt / n, k = 0; k < n; k++) { var acc = w * w * (flow.target - flow.pos) - 2 * w * flow.vel; flow.vel += acc * hh; flow.pos += flow.vel * hh; }
    if (Math.abs(flow.target - flow.pos) < 0.002 && Math.abs(flow.vel) < 0.0004) { flow.pos = flow.target; flow.vel = 0; layoutFlow(); return; }
    layoutFlow(); flow.raf = requestAnimationFrame(flowAnim);
  }
  function openFrontSet() { var sp = flow.order[clampI(Math.round(flow.pos))]; if (sp != null) { ping(sp); openSet(S[sp].group); } }
  function openSet(gr) { flow.open = gr; renderSet(true); SFX.play('card'); vib(15); }
  function closeSet(quiet) {
    if (!flow.open) return; flow.open = null; var o = $('flowSet');
    if (quiet) { o.hidden = true; return; }
    o.classList.add('closing'); setTimeout(function () { if (!flow.open) o.hidden = true; o.classList.remove('closing'); }, 200);
  }
  function renderSet(fresh) {
    var o = $('flowSet'), gr = flow.open; if (!gr) return;
    var members = B.GROUP_MEMBERS[gr].slice().sort(function (a, b) { return boardRank(a) - boardRank(b); }), n = members.length, land = landscape();
    o.hidden = false;
    var W = o.clientWidth - 24, H = o.clientHeight - 44, cols = land ? n : (n === 1 ? 1 : 2), rows = Math.ceil(n / cols), gap = 10;
    var cw = Math.min((W - (cols - 1) * gap) / cols, (H - (rows - 1) * gap) / rows / 1.42, 260), key = gr + ':' + members.map(function (sp) { return st.props[sp][0] === st.me.id ? 1 : 0; }).join('') + ':' + Math.round(cw) + ':' + cols;
    if (fresh || o._key !== key) {
      o._key = key;
      o.innerHTML = '<div class="fs-title"><span class="sw" style="background:' + B.GROUPS[gr].color + '"></span>' + esc(B.GROUPS[gr].name) + '<small>tap outside or pinch to close</small></div><div class="fs-grid" style="--cw:' + cw.toFixed(1) + 'px;--ch:' + (cw * 1.42).toFixed(1) + 'px;grid-template-columns:repeat(' + cols + ',var(--cw))"></div>';
      var grid = o.querySelector('.fs-grid');
      members.forEach(function (sp, i) {
        var el;
        if (st.props[sp][0] === st.me.id) { el = makeCard(sp); el.classList.add('front'); }
        else { el = document.createElement('div'); el.className = 'fcard ghost'; el.setAttribute('data-sp', sp); }
        el.style.animationDelay = (i * 45) + 'ms'; grid.appendChild(el);
      });
    }
    Array.prototype.forEach.call(o.querySelectorAll('.fs-grid .fcard'), function (el) {
      var sp = +el.getAttribute('data-sp');
      if (el.classList.contains('ghost')) { var ow = pById(st.props[sp][0]); setH(el, '<div class="fc-face"><div class="fc-band" style="background:' + gcol(sp) + '"><b>' + esc(S[sp].name) + '</b></div><div class="ghost-t">' + (ow ? pieceCv(ow, 30) + '<span>' + esc(ow.name) + '</span>' : 'For sale<br>' + money(S[sp].price)) + '</div></div>') && paintPieces(el); el.style.setProperty('--gc', gcol(sp)); }
      else fillCard(el, sp);
    });
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
      if (pr && pr[0] >= 0 && pr[1]) h += '<b class="sh">' + (pr[1] === 5 ? 'MP' : pr[1] + 'S') + '</b>';
      if (pr && pr[4]) h += '<i class="dmg' + (pr[4][1] ? ' closed' : '') + '">' + ((B.DISASTERS[pr[4][2]] || {}).icon || '\uD83D\uDD27') + pr[4][0] + '</i>';   // v0.5
      h += '</div>';
    }
    h += '<div class="mid">RED DEER<br>RICH<small>' + (st.rules.jackpot ? 'Dirt Lot pot ' + money(st.pot) : 'Round ' + st.round) + '</small></div>';
    setH($('mini'), h);
    paintOwners(); renderDots(); renderSeats(); renderObserver();
    var s0 = S[ui.sel], pr0 = st.props[ui.sel], side = '';
    if (s0.price) {
      var o0 = pr0[0] >= 0 ? pById(pr0[0]) : null;
      side += '<div class="deedcard"><div class="top" style="background:' + gcol(ui.sel) + '">' + esc(s0.name) + '</div><div class="body">';
      if (pr0[4]) side += '<div class="dmgline">' + dmgBadge(ui.sel) + '</div>';
      side += 'Owner: <b>' + (o0 ? esc(o0.name) : 'the bank (for sale)') + '</b>' + (pr0[2] ? ' \u00b7 MORTGAGED' : '') + (pr0[3] ? ' \u00b7 \uD83D\uDD12' : '') + '<br>Price ' + money(s0.price) + ' \u00b7 mortgage ' + money(s0.hock);
      if (s0.type === 'prop') { var mx = s0.rents[5]; side += '<div class="stairs">' + s0.rents.map(function (r, k) { return '<div class="' + (o0 && pr0[1] === k ? 'on' : '') + '" style="height:' + Math.max(16, Math.round(100 * Math.sqrt(r / mx))) + '%"><b>$' + r + '</b>' + ['rent', '1', '2', '3', '4', 'MP'][k] + '</div>'; }).join('') + '</div>Shop cost ' + money(B.GROUPS[s0.group].shop) + '. Full set doubles base rent.'; }
      else if (s0.type === 'whistle') side += '<br>Rent $30/$60/$120/$240 for 1-4 stops.<br><i>' + esc(B.STORIES[ui.sel] || '') + '</i>';
      else side += '<br>Rent: dice \u00d7 5 (one) or \u00d7 12 (both).';
      side += '</div></div>';
    } else side += '<div class="info"><b>' + esc(s0.name) + '</b><br>' + esc({ halfway: 'Collect $250 when you pass or land.', snowbank: 'Stuck: roll doubles (3 tries), use a Tow Truck Pass or pay $60. Just Driving By otherwise.', dirtlot: st.rules.jackpot ? 'Land here exactly to win the pot (' + money(st.pot) + ').' : 'A free rest stop behind the caragana bushes. Shhh.', whiteout: 'Straight to the Snowbank. No $250.', tax: 'Pay ' + money(s0.amount) + '.', random: 'Draw a RED DEER RANDOMNESS card (weather, traffic, everyday chaos).', finds: 'Draw a SECRET FINDS card (a true story from Red Deer history).' }[s0.type] || '') + '</div>';
    side += '<h3>Standings</h3>' + st.players.slice().sort(function (a, b) { return (a.bankrupt - b.bankrupt) || (b.worth - a.worth); }).map(function (p) { return '<div class="standing">' + chip(p) + '<span class="nm">' + esc(p.name) + (p.ai ? ' <small class="muted">AI</small>' : '') + '</span><span>' + (p.bankrupt ? 'OUT' : money(p.cash) + ' \u00b7 <span class="badge ' + p.state + '">' + (p.state === 'gold' ? 'GOLD' : p.state === 'good' ? 'GOOD' : 'RAGS') + '</span>') + '</span></div>'; }).join('');
    var R2 = st.rules, on = [];
    if (R2.jackpot) on.push('Dirt Lot Jackpot (pot ' + money(st.pot) + ')'); if (R2.feesToPot) on.push('Fees feed the pot'); if (R2.bullseye) on.push('Bullseye Halfway $500');
    on.push(R2.payupRace ? 'PAY UP race' + (R2.kidMode ? ' (Kid Mode 4 s)' : '') : 'Automatic rent'); if (R2.perks) on.push('Character perks'); if (R2.auctions) on.push('Auctions on passed deeds'); if (R2.heckle) on.push('Heckle'); if (R2.disasters) on.push('Disasters'); if (st.timer && st.timer.eff) on.push('Timer ' + st.timer.eff + ' min');
    side += '<h3>House rules</h3><div class="info">' + on.map(esc).join('<br>') + '<br>Game length: ' + (C.modes[st.mode] ? C.modes[st.mode].label : st.mode) + (st.endsIn ? ' (' + clock(st.endsIn) + ' left)' : '') + '</div>';
    setH($('boardSide'), side);
  }
  // v0.4 owned tiles: a hard outline in the owner's colour that feathers inward (no wash); after a private deal it drifts over ~10 s
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
      if (!col) { el.style.boxShadow = ''; continue; }
      el.style.boxShadow = ownerShadow(col, pr[2]);
    }
  }
  function ownerShadow(col, mort) {
    var rgb = Math.round(col[0]) + ',' + Math.round(col[1]) + ',' + Math.round(col[2]), a = mort ? (C.ownerLine || {}).mortgagedAlpha || 0.45 : 1;
    return 'inset 0 0 0 2px rgba(' + rgb + ',' + a + '), inset 0 0 6px 2px rgba(' + rgb + ',' + (0.55 * a).toFixed(2) + ')';
  }
  setInterval(function () { if (tab === 'board' && st && st.phase === 'play' && Object.keys(ui.fades).length) paintOwners(); }, 250);
  $('mini').addEventListener('click', function (e) { if (zm.dragged) { zm.dragged = false; return; } var c = e.target.closest('.c'); if (c) { ui.sel = +c.getAttribute('data-sp'); renderBoard(); if (S[ui.sel].price) openDeed(ui.sel); } });   // v0.5: any deed opens its card

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
    setH($('obsFeed'), feedLines(st.feed, st.feedCard, true));
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
    $('tab-msgs').className = 'tab' + (ui.thread != null || ui.builder ? ' open' : '') + (ui.builder && ui.builder.map ? ' mapmode' : '');
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
    var b = { partner: pid || null, give: { cash: 0, props: [], passes: 0 }, get: { cash: 0, props: [], passes: 0 }, editId: null, v: 1, map: store.get('rdr_tradeView') === 'map', lit: {} };   // v0.4: map view remembered
    if (fromTrade) { var meA = fromTrade.a === st.me.id; b.partner = meA ? fromTrade.b : fromTrade.a; b.give = JSON.parse(JSON.stringify(meA ? fromTrade.aGives : fromTrade.bGives)); b.get = JSON.parse(JSON.stringify(meA ? fromTrade.bGives : fromTrade.aGives)); b.editId = fromTrade.id; b.v = fromTrade.v + 1; }
    ui.builder = b; ui.builderBuilt = false; renderMsgs();
  }
  function renderBuilder() {
    var b = ui.builder, side = $('msgSide'), me = st.me;
    if (b.map) { renderTradeMap(b, side); return; }
    if (!ui.builderBuilt) {
      side.innerHTML = '<div class="builder"><div class="row" style="align-items:center"><button class="ghost" data-act="closeBuilder">\u2190</button><h3 style="flex:1;margin:0">' + (b.editId ? 'Edit deal (counter v' + b.v + ')' : 'New deal') + '</h3><button class="ghost mapsw" data-act="bMap">\uD83D\uDDFA\uFE0F Map</button></div>' +
        '<div class="hb-title">Deal with:</div><div class="partners" id="bPartners"></div>' +
        '<div class="bcols"><div class="bcol"><h4>YOU GIVE</h4><div class="cashrow">\uD83D\uDCB5 <input type="number" min="0" step="10" inputmode="numeric" id="bGiveCash" value="' + (b.give.cash || 0) + '"></div><div class="cashrow" data-cash="give"><button data-add="10">+10</button><button data-add="50">+50</button><button data-add="100">+100</button><button data-add="0">0</button></div><div class="tray" id="bGiveTray"></div></div>' +
        '<div class="bcol"><h4>YOU GET</h4><div class="cashrow">\uD83D\uDCB5 <input type="number" min="0" step="10" inputmode="numeric" id="bGetCash" value="' + (b.get.cash || 0) + '"></div><div class="cashrow" data-cash="get"><button data-add="10">+10</button><button data-add="50">+50</button><button data-add="100">+100</button><button data-add="0">0</button></div><div class="tray" id="bGetTray"></div></div></div>' +
        '<div class="bmini-row"><div class="tboard small" id="bMini">' + tradeBoardHtml() + '</div><div class="hist muted">Deeds in the deal light up here. Only you see this map.<br>\uD83D\uDD12 = locked by the active turn. Deeds in a set with Shops can\'t be traded.</div></div>' +
        '<button class="cement" data-act="cement">CEMENT</button></div>';
      ui.builderBuilt = true; side._h = null;
      $('bGiveCash').addEventListener('input', function () { b.give.cash = Math.max(0, Math.floor(+this.value || 0)); });
      $('bGetCash').addEventListener('input', function () { b.get.cash = Math.max(0, Math.floor(+this.value || 0)); });
    }
    setH($('bPartners'), partnerButtons(b));
    var tray = function (pid, side, sel) {
      if (pid == null) return '<span class="muted">Pick who to deal with first.</span>';
      var h = '', groupShops = function (sp) { return B.GROUP_MEMBERS[S[sp].group].some(function (i) { return st.props[i][1] > 0; }); };
      st.props.forEach(function (pr, sp) {
        if (!pr || pr[0] !== pid) return;
        var locked = pr[3] || groupShops(sp), on = sel.props.indexOf(sp) !== -1;
        h += '<button data-tray="' + side + '" data-sp="' + sp + '" class="' + (on ? 'in' : '') + '" style="border-left-color:' + gcol(sp) + '"' + (locked && !on ? ' disabled' : '') + '>' + (locked ? '\uD83D\uDD12 ' : '') + esc(S[sp].short) + (pr[2] ? ' (M)' : '') + '</button>';
      });
      var passes = pid === me.id ? me.passes : (pById(pid) || {}).passes || 0;
      if (passes) h += '<button data-tray="' + side + '" data-pass="1" class="' + (sel.passes ? 'in' : '') + '">\uD83D\uDE9A Tow Pass' + (sel.passes ? ' \u00d7' + sel.passes : '') + '</button>';
      return h || '<span class="muted">no deeds</span>';
    };
    setH($('bGiveTray'), tray(me.id, 'give', b.give));
    setH($('bGetTray'), tray(b.partner, 'get', b.get));
    paintTradeBoard($('bMini'), b, false);
  }
  function builderClick(e) {
    var b = ui.builder; if (!b) return false;
    var el = e.target.closest('button'); if (!el) return false;
    if (el.getAttribute('data-partner')) { var np = +el.getAttribute('data-partner'); if (np !== b.partner) { b.partner = np; b.get = { cash: 0, props: [], passes: 0 }; if ($('bGetCash')) $('bGetCash').value = 0; } renderBuilder(); return true; }
    if (el.getAttribute('data-rm')) { var rs = b[el.getAttribute('data-rm')], ri = rs.props.indexOf(+el.getAttribute('data-sp')); if (ri >= 0) rs.props.splice(ri, 1); SFX.play('click'); renderBuilder(); return true; }   // v0.4 map: take a deed back out
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

  // ---- v0.4 trade board: one small private board used by both trade views. Only the two traders' deeds show (everything
  // else is very faint); tapped / dealt deeds light up. It's drawn only on this phone, never on the TV.
  function tradeBoardHtml() {
    var h = '';
    for (var i = 0; i < 40; i++) { var rc = cellPos(i), corner = i % 10 === 0; h += '<div class="tc' + (corner ? ' corner' : '') + '" data-sp="' + i + '" style="grid-row:' + rc[0] + ';grid-column:' + rc[1] + '">' + (S[i].type === 'prop' ? '<i class="tb" style="background:' + gcol(i) + '"></i>' : '') + (corner ? '' : '<span>' + esc(S[i].short) + '</span>') + '</div>'; }
    return h + '<div class="tmid"></div>';
  }
  function paintTradeBoard(root, b, map) {
    if (!root) return; var me = st.me.id, pa = b.partner, deal = b.give.props.concat(b.get.props), cells = root.querySelectorAll('.tc');
    for (var n = 0; n < cells.length; n++) {
      var el = cells[n], sp = +el.getAttribute('data-sp'), pr = st.props[sp], ow = pr ? pr[0] : -1, ours = ow >= 0 && (ow === me || ow === pa);
      var cls = 'tc' + (sp % 10 === 0 ? ' corner' : '') + (!ours ? ' faint' : ow === me ? ' mine' : ' theirs') + (deal.indexOf(sp) >= 0 ? (map ? ' indeal' : ' lit') : '') + (map && b.lit[sp] ? ' lit' : '') + (ours && tradeLocked(sp) ? ' locked' : '');
      if (el.className !== cls) el.className = cls;
      var sh = ours ? ownerShadow(hexRgb((pById(ow) || {}).color), pr[2]) : '';
      if (el._sh !== sh) { el._sh = sh; el.style.boxShadow = sh; }
    }
  }
  function tradeLocked(sp) { var pr = st.props[sp]; return !!(pr && (pr[3] || B.GROUP_MEMBERS[S[sp].group].some(function (i) { return st.props[i][1] > 0; }))); }

  // ---- v0.4 trade MAP: drag their deed onto your piece (or yours onto theirs); cash sliders above each piece pour money
  // across. Reset clears it; Submit goes through the same offer / counter flow as CEMENT.
  function renderTradeMap(b, side) {
    var me = st.me, P = b.partner != null ? pById(b.partner) : null;
    if (!ui.builderBuilt) {
      side.innerHTML = '<div class="builder map"><div class="tm-layout">' +
        '<div class="tm-hdr"><div class="row" style="align-items:center"><button class="ghost" data-act="closeBuilder">\u2190</button><h3 style="flex:1;margin:0">' + (b.editId ? 'Counter (v' + b.v + ')' : 'New deal') + '</h3><button class="ghost mapsw" data-act="bMap">\u2630 List</button></div><div class="partners" id="bPartners"></div></div>' +
        '<div class="tm-wrap" id="tmWrap"><div class="tboard map" id="tmBoard">' + tradeBoardHtml() + '</div><div class="tm-mid" id="tmMid">' +
          ['me', 'them'].map(function (k) { var sl = k === 'me' ? 'give' : 'get'; return '<div class="tm-side" data-side="' + k + '"><div class="tm-name" id="tmName_' + k + '"></div><div class="tm-bank" id="tmBank_' + k + '"></div>' +
            '<div class="tm-row"><div class="tm-slider" data-sl="' + sl + '" id="tmSl_' + sl + '"><i class="tm-fill"></i><b class="tm-knob"></b></div><div class="tm-tokcol"><div class="tm-amt" id="tmAmt_' + sl + '"></div><div class="tm-tok" id="tmTok_' + k + '"></div></div></div>' +
            '<div class="tm-recv" id="tmRecv_' + k + '"></div></div>'; }).join('') +
        '</div></div>' +
        '<div class="tm-ctl"><div class="tm-btns"><button class="ghost" data-act="tmReset">RESET</button><button class="cement" data-act="cement">SUBMIT</button></div><div class="hist muted">Drag their deeds onto your piece, yours onto theirs. Slide up to add cash. Tap a deed to light it up: only you see this map.</div></div>' +
        '</div></div>';
      ui.builderBuilt = true; side._h = null; ui.tmTok = '';
      bindTradeMap(b);
    }
    setH($('bPartners'), partnerButtons(b));
    paintTradeBoard($('tmBoard'), b, true);
    var tk = me.charId + me.state + ':' + (P ? P.id + P.state : '');
    if (ui.tmTok !== tk) { ui.tmTok = tk; setH($('tmTok_me'), pieceCv(pById(me.id) || me, 46)); setH($('tmTok_them'), P ? pieceCv(P, 46) : '<span class="tm-q">?</span>'); paintPieces($('tmWrap')); }
    setH($('tmName_me'), 'You'); setH($('tmName_them'), P ? esc(P.name) : 'Pick who');
    setH($('tmBank_me'), money(me.cash)); setH($('tmBank_them'), P ? money(P.cash) : '\u2014');
    setH($('tmRecv_me'), recvHtml(b.get, 'get')); setH($('tmRecv_them'), recvHtml(b.give, 'give'));
    sliderPaint(b, 'give'); sliderPaint(b, 'get');
  }
  function partnerButtons(b) { return st.players.filter(function (p) { return p.id !== st.me.id && !p.bankrupt; }).map(function (p) { return '<button data-partner="' + p.id + '" class="' + (b.partner === p.id ? 'on' : '') + '">' + chip(p) + esc(p.name) + '</button>'; }).join(''); }
  function recvHtml(sideObj, k) {
    var h = sideObj.props.map(function (sp) { return '<button class="tm-bar" data-rm="' + k + '" data-sp="' + sp + '" style="--gc:' + gcol(sp) + '"><span>' + esc(S[sp].short) + '</span><i>\u2715</i></button>'; }).join('');
    if (sideObj.passes) h += '<span class="tm-bar pass">\uD83D\uDE9A Pass \u00d7' + sideObj.passes + '</span>';
    if (sideObj.cash > 0) { var nB = Math.min(7, 1 + Math.floor(Math.log(sideObj.cash / 25 + 1) / Math.log(1.9))); h += '<div class="tm-stack"><span class="bills">' + new Array(nB + 1).join('<i></i>') + '</span><b>' + money(sideObj.cash) + '</b></div>'; }
    return h;
  }
  function sliderMax(b, k) { if (k === 'give') return Math.max(0, st.me.cash); var P = b.partner != null ? pById(b.partner) : null; return P ? Math.max(0, P.cash) : 0; }
  function sliderPaint(b, k) {
    var el = $('tmSl_' + k); if (!el) return; var mx = sliderMax(b, k), v = Math.min(b[k].cash || 0, mx), f = mx ? v / mx : 0;
    el.querySelector('.tm-fill').style.height = (f * 100).toFixed(1) + '%'; el.querySelector('.tm-knob').style.bottom = (f * 100).toFixed(1) + '%';
    el.classList.toggle('off', !mx);
    setH($('tmAmt_' + k), v ? (k === 'give' ? '\u2192 ' : '\u2190 ') + money(v) : '');
  }
  function pourMoney(fromK, toK, n) {
    var mid = $('tmMid'), a = $('tmTok_' + fromK), z = $('tmTok_' + toK); if (!mid || !a || !z) return;
    var mr = mid.getBoundingClientRect(), ar = a.getBoundingClientRect(), zr = z.getBoundingClientRect();
    for (var i = 0; i < n; i++) (function (k) {
      if (mid.querySelectorAll('.tm-bill').length > 14) return;
      var bill = document.createElement('i'); bill.className = 'tm-bill';
      var x0 = ar.left - mr.left + ar.width / 2 + (Math.random() - 0.5) * 16, y0 = ar.top - mr.top + ar.height / 2;
      var x1 = zr.left - mr.left + zr.width / 2 + (Math.random() - 0.5) * 16, y1 = zr.top - mr.top + zr.height * 0.9;
      bill.style.left = x0 + 'px'; bill.style.top = y0 + 'px'; mid.appendChild(bill);
      setTimeout(function () { bill.style.transform = 'translate(' + (x1 - x0).toFixed(0) + 'px,' + (y1 - y0).toFixed(0) + 'px) rotate(' + ((Math.random() - 0.5) * 70).toFixed(0) + 'deg)'; bill.style.opacity = '0.15'; }, 16 + k * 60);
      setTimeout(function () { if (bill.parentNode) bill.parentNode.removeChild(bill); }, 700 + k * 60);
    })(i);
  }
  function bindTradeMap(b) {
    // cash sliders (vertical): slide up to add cash; money pours from the giver's piece to the other one
    Array.prototype.forEach.call(document.querySelectorAll('.tm-slider'), function (el) {
      var k = el.getAttribute('data-sl'), drag = false, lastPour = 0, lastV = 0;
      function setFrom(y) {
        var bb = ui.builder; if (!bb) return; var r = el.getBoundingClientRect(), mx = sliderMax(bb, k); if (!mx) return;
        var f = Math.max(0, Math.min(1, (r.bottom - y) / r.height)), step = mx > 2000 ? 50 : 10, v = Math.min(mx, Math.round(f * mx / step) * step);
        if (v === bb[k].cash) return;
        var up = v > bb[k].cash; bb[k].cash = v; sliderPaint(bb, k);
        var mine = k === 'give'; setH($(mine ? 'tmRecv_them' : 'tmRecv_me'), recvHtml(bb[k], k));
        var now = Date.now(); if (now - lastPour > 70 && Math.abs(v - lastV) >= step) { lastPour = now; lastV = v; pourMoney(up === mine ? 'me' : 'them', up === mine ? 'them' : 'me', 1); if (up) SFX.play('click'); }
      }
      el.addEventListener('pointerdown', function (e) { drag = true; try { el.setPointerCapture(e.pointerId); } catch (er) {} setFrom(e.clientY); e.preventDefault(); });
      el.addEventListener('pointermove', function (e) { if (drag) setFrom(e.clientY); });
      el.addEventListener('pointerup', function () { drag = false; }); el.addEventListener('pointercancel', function () { drag = false; });
    });
    // deeds: drag onto a piece to add, tap to light it up
    var board = $('tmBoard'), dd = null;
    board.addEventListener('pointerdown', function (e) {
      var c = e.target.closest('.tc'); if (!c || c.classList.contains('corner')) return;
      dd = { sp: +c.getAttribute('data-sp'), x0: e.clientX, y0: e.clientY, ghost: null, id: e.pointerId, faint: c.classList.contains('faint') };
      try { board.setPointerCapture(e.pointerId); } catch (er) {}
    });
    board.addEventListener('pointermove', function (e) {
      if (!dd || e.pointerId !== dd.id || dd.faint) return;
      if (!dd.ghost) {
        if (Math.abs(e.clientX - dd.x0) + Math.abs(e.clientY - dd.y0) < 8) return;
        if (tradeLocked(dd.sp)) { toast('\uD83D\uDD12 Locked: ' + (st.props[dd.sp][3] ? 'part of the active turn' : 'its set has Shops')); dd = null; return; }
        var g = dd.ghost = document.createElement('div'); g.className = 'tm-ghost'; g.style.setProperty('--gc', gcol(dd.sp)); g.textContent = S[dd.sp].short; document.body.appendChild(g); vib(10);
      }
      dd.ghost.style.left = e.clientX + 'px'; dd.ghost.style.top = e.clientY + 'px';
      var over = sideAt(e.clientX, e.clientY); Array.prototype.forEach.call(document.querySelectorAll('.tm-side'), function (s2) { s2.classList.toggle('over', s2 === over); });
    });
    function end(e) {
      var d = dd; dd = null; if (!d) return;
      Array.prototype.forEach.call(document.querySelectorAll('.tm-side'), function (s2) { s2.classList.remove('over'); });
      var bb = ui.builder; if (!bb) { if (d.ghost) d.ghost.remove(); return; }
      if (!d.ghost) { if (e.type === 'pointerup') { if (!d.faint) { bb.lit[d.sp] = !bb.lit[d.sp]; paintTradeBoard(board, bb, true); } SFX.play('click'); vib(8); if (S[d.sp].price) openDeed(d.sp); } return; }   // v0.5: tap = light it AND open its card
      var over = sideAt(e.clientX, e.clientY), k = over && over.getAttribute('data-side'), ow = st.props[d.sp][0], ok = false;
      if (k === 'them' && ow === st.me.id && bb.partner != null && bb.give.props.indexOf(d.sp) < 0) { bb.give.props.push(d.sp); ok = true; }
      if (k === 'me' && ow === bb.partner && bb.get.props.indexOf(d.sp) < 0) { bb.get.props.push(d.sp); ok = true; }
      var g = d.ghost;
      if (ok) { g.classList.add('drop'); SFX.play('buy'); vib(20); renderBuilder(); }
      else { g.classList.add('back'); }          // wrong way (or nowhere): nothing happens
      setTimeout(function () { g.remove(); }, 260);
    }
    board.addEventListener('pointerup', end); board.addEventListener('pointercancel', end);
  }
  function sideAt(x, y) { var list = document.querySelectorAll('.tm-side'); for (var i = 0; i < list.length; i++) { var r = list[i].getBoundingClientRect(); if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6) return list[i]; } return null; }

  // ------------------------------------------------------------------ actions (event delegation)
  document.addEventListener('click', function (e) {
    if (!st) return;
    if (tab === 'msgs' && builderClick(e)) return;
    var tcl = e.target.closest('.tboard:not(.map) .tc'); if (tcl && S[+tcl.getAttribute('data-sp')].price) { openDeed(+tcl.getAttribute('data-sp')); return; }   // v0.5
    var el = e.target.closest('[data-act],[data-thread],[data-quick]'); if (!el) return;
    if (el.getAttribute('data-thread')) { var th = el.getAttribute('data-thread'); ui.thread = th === 'all' ? 'all' : +th; ui.builder = null; renderMsgs(); return; }
    if (el.getAttribute('data-quick')) { sendChat(el.getAttribute('data-quick')); return; }
    var act = el.getAttribute('data-act'), sp = el.getAttribute('data-sp');
    switch (act) {
      case 'roll': doRoll(); break;
      case 'buy': case 'skipBuy': case 'payTow': case 'usePass': case 'raise': case 'giveUp': send({ t: act }); vib(30); if (act === 'buy') SFX.play('buy'); break;
      case 'pass': send({ t: 'pass' }); vib(40); SFX.play('click'); break;
      case 'build': case 'sell': case 'hock': case 'unhock': send({ t: act, sp: +sp }); vib(25); if (act === 'hock' || act === 'unhock') delete flow.flip[+sp]; if (act === 'build') SFX.play('build'); if (act === 'hock' || act === 'unhock') SFX.play('card'); break;   // v0.4: no confirmation for BUY / SELL
      case 'heckle': doHeckle(el); break;
      case 'rush': send({ t: 'rush', sp: +sp }); vib([30, 30, 60]); SFX.play('build'); $('disSheet').hidden = true; break;          // v0.5
      case 'byHand': ui.stuffView = 'list'; store.set('rdr_stuffView', 'list'); setTab('stuff'); break;
      case 'readEv': openEvent(+el.getAttribute('data-e'), +sp, false); break;
      case 'deed': openDeed(+sp); break;
      case 'wake': toggleWake(); break;                                                     // v0.4
      case 'readCard': $('cardList').hidden = true; openCard(el.getAttribute('data-deck'), +el.getAttribute('data-idx')); break;
      case 'cardList': openCardList(); break;
      case 'stuffView': ui.stuffView = ui.stuffView === 'cards' ? 'list' : 'cards'; store.set('rdr_stuffView', ui.stuffView); SFX.play('click'); vib(10); renderStuff(); break;
      case 'moreToggle': ui.moreOpen = !ui.moreOpen; renderStuff(); break;
      case 'flipMort': flow.flip[+sp] = true; SFX.play('card'); vib(15); renderStuff(); break;
      case 'flipBack': delete flow.flip[+sp]; SFX.play('click'); renderStuff(); break;
      case 'bMap': if (ui.builder) { ui.builder.map = !ui.builder.map; store.set('rdr_tradeView', ui.builder.map ? 'map' : 'list'); ui.builderBuilt = false; SFX.play('click'); renderMsgs(); } break;
      case 'tmReset': if (ui.builder) { ui.builder.give = { cash: 0, props: [], passes: 0 }; ui.builder.get = { cash: 0, props: [], passes: 0 }; ui.builder.lit = {}; SFX.play('click'); vib(15); renderBuilder(); } break;
      case 'pingTile': if (e.target.closest('.dbadge')) { openDeed(+sp); break; } send({ t: 'pingTile', sp: +sp }); vib(12); el.classList.add('pinged'); setTimeout(function () { el.classList.remove('pinged'); }, 350); break;   // v0.3: bounce my tile on the TV (changes nothing)
      case 'readFind': openFind(+el.getAttribute('data-idx')); break;
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
    if (t.pid === me.id && t.tab) return 'Settle your debt first (sell, mortgage or make a deal).';
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


  // ================================================================== v0.5
  // ---- Disasters: repair badge, RUSH REPAIR button, the owner's alert, and the history sheet
  function dmgOf(sp) { var pr = st.props[sp]; return pr && pr[4] ? { left: pr[4][0], closed: !!pr[4][1], e: B.DISASTERS[pr[4][2]] || {}, ei: pr[4][2], cost: pr[4][3] } : null; }
  function dmgBadge(sp) {
    var d = dmgOf(sp); if (!d) return '';
    return '<span class="dbadge' + (d.closed ? ' closed' : '') + '">' + (d.e.icon || '\uD83D\uDD27') + ' ' + (d.closed ? 'CLOSED' : 'HALF RENT') + ' \u00b7 ' + d.left + ' turn' + (d.left > 1 ? 's' : '') + '</span>';
  }
  function rushBtn(sp, cls) {
    var d = dmgOf(sp); if (!d || st.props[sp][0] !== st.me.id || st.me.bankrupt) return '';
    return '<button class="' + cls + ' rushb" data-act="rush" data-sp="' + sp + '"' + (st.me.cash >= d.cost ? '' : ' disabled') + '>\uD83D\uDD27 RUSH REPAIR <small>(\u2212' + money(d.cost) + ')</small></button>';
  }
  function openEvent(ei, sp, alert) {
    var e = B.DISASTERS[ei]; if (!e || !S[sp]) return;
    var d = dmgOf(sp), pr = st.props[sp], o = pById(pr[0]), mine = pr[0] === st.me.id, live = d && d.ei === ei;
    ui.disSp = sp;
    var h = '<div class="os-card dis-card sev' + e.sev + (e.mode === 'closed' ? ' closed' : '') + '"><div class="dis-ic">' + e.icon + '</div><div class="dis-sev">' + esc(B.SEV_NAMES[e.sev] || '') + ' \u00b7 ' + (e.when === 'night' ? 'night' : e.when === 'day' ? 'day' : 'any time') + '</div>' +
      '<div class="dis-h">' + esc(e.h) + '</div><div class="dis-where"><span class="sw" style="background:' + gcol(sp) + '"></span>' + (mine ? 'Your ' : '') + '<b>' + esc(S[sp].name) + '</b>' + (o && !mine ? ' (' + esc(o.name) + ')' : '') + '</div>' +
      '<div class="dis-eff">' + (e.mode === 'closed' ? '<b>CLOSED</b>: no rent' : '<b>HALF RENT</b>') + ' for ' + e.sev + ' turn' + (e.sev > 1 ? 's' : '') + '</div><div class="dis-t">' + esc(e.t) + '</div>';
    if (live) h += '<div class="dis-left">\uD83D\uDD27 ' + d.left + ' turn' + (d.left > 1 ? 's' : '') + ' of repairs left</div>' + (mine ? rushBtn(sp, 'big-btn') : '');
    else h += '<div class="dis-left done">\u2714 Repaired</div>';
    h += '<button class="big-btn ghostbtn" data-dis="ok">' + (live && mine ? 'WAIT IT OUT' : 'CLOSE') + '</button></div>';
    var el = $('disSheet'); el.innerHTML = h; el.hidden = false;
    if (alert) { var c = el.querySelector('.dis-card'); c.classList.add('alert'); }
  }
  function disasterAlert(d, fresh) {
    if (d.sp == null) return;
    SFX.play('disaster' + Math.max(1, Math.min(3, d.sev || 1))); vib(d.sev >= 3 ? [120, 60, 120, 60, 200] : [80, 50, 80]);
    openEvent(d.e, d.sp, fresh);
  }
  $('disSheet').addEventListener('click', function (e) { if (e.target === $('disSheet') || e.target.closest('[data-dis]')) $('disSheet').hidden = true; });

  // ---- Deed card from any map: front = value and rent, back = every Shop / Mega-Plex step. Tap to flip.
  function openDeed(sp) {
    var s = S[sp]; if (!s || !s.price) return;
    ui.deedSp = sp; ui.deedFlip = false; renderDeed(); $('deedSheet').hidden = false; SFX.play('card'); vib(10);
  }
  function renderDeed() {
    var sp = ui.deedSp, s = S[sp], pr = st.props[sp], o = pr[0] >= 0 ? pById(pr[0]) : null, col = gcol(sp), G = B.GROUPS[s.group] || {}, set = o && ownsGroup(o.id, s.group), cur = pr[2] ? -1 : pr[1];
    var front = '<div class="dd-band" style="background:' + col + '"><small>' + esc(G.name || '') + '</small><b>' + esc(s.name) + '</b></div><div class="dd-body">' +
      '<div class="dd-owner">' + (o ? chip(o) + ' <b>' + esc(o.name) + '</b>' + (o.id === st.me.id ? ' (you)' : '') : 'For sale \u00b7 the bank') + (pr[2] ? ' \u00b7 <span class="hk">MORTGAGED</span>' : '') + '</div>' + (pr[4] ? '<div class="dd-dmg">' + dmgBadge(sp) + '</div>' : '') +
      '<div class="dd-val"><span>Price<b>' + money(s.price) + '</b></span><span>Mortgage<b>' + money(s.hock) + '</b></span><span>Rent now<b>' + (o ? rentStr(sp) : '\u2014') + '</b></span></div>';
    var back = '<div class="dd-band slim" style="background:' + col + '"><b>' + esc(s.name) + '</b><small>building costs</small></div><div class="dd-body">';
    if (s.type === 'prop') {
      front += '<div class="ladder">' + s.rents.map(function (r, k) { return '<div class="lr' + (o && k === cur ? ' on' : '') + '"><span>' + (k === 0 ? 'Rent' + (set ? ' \u00d72 (set)' : '') : k === 5 ? 'Mega-Plex' : k + ' Shop' + (k > 1 ? 's' : '')) + '</span><b>' + money(k === 0 && set ? r * 2 : r) + '</b></div>'; }).join('') + '</div>';
      var cost = G.shop || 0, sell = Math.floor(cost * C.shopSellBack), tot = 0;
      back += '<div class="steps">' + [1, 2, 3, 4, 5].map(function (k) { tot += cost; return '<div class="st' + (o && pr[1] >= k ? ' built' : '') + '"><span>' + (k === 5 ? '\uD83C\uDFE8 Mega-Plex' : '\uD83C\uDFE0 Shop ' + k) + '</span><span>' + money(cost) + '</span><span class="tot">' + money(tot) + ' in</span><b>\u2192 ' + money(s.rents[k]) + '</b></div>'; }).join('') + '</div>' +
        '<div class="dd-note">Each step costs ' + money(cost) + '; selling one back returns ' + money(sell) + '. All ' + B.GROUP_MEMBERS[s.group].length + ' in the set are needed to build' + (st.rules.evenBuild ? ', evenly' : '') + '. Unmortgage costs ' + money(Math.ceil(s.hock * (1 + C.unhockFee))) + '.</div>';
    } else if (s.type === 'whistle') {
      front += '<div class="ladder">' + [1, 2, 3, 4].map(function (k) { return '<div class="lr"><span>' + k + ' stop' + (k > 1 ? 's' : '') + '</span><b>' + money(B.WHISTLE_RENT[k]) + '</b></div>'; }).join('') + '</div>';
      back += '<div class="dd-note">Whistle Stops have no Shops or Mega-Plex: rent grows with how many stops the owner has. Unmortgage costs ' + money(Math.ceil(s.hock * (1 + C.unhockFee))) + '.</div>' + (B.STORIES[sp] ? '<div class="dd-note"><i>' + esc(B.STORIES[sp]) + '</i></div>' : '');
    } else {
      front += '<div class="ladder">' + [1, 2].map(function (k) { return '<div class="lr"><span>Own ' + k + '</span><b>dice \u00d7' + B.JUICE_MULT[k] + '</b></div>'; }).join('') + '</div>';
      back += '<div class="dd-note">Utilities have no Shops or Mega-Plex: rent is the dice roll times 5 (one) or 12 (both). Unmortgage costs ' + money(Math.ceil(s.hock * (1 + C.unhockFee))) + '.</div>';
    }
    front += '<div class="dd-hint">tap to flip \u21BB</div></div>'; back += '<div class="dd-hint">tap to flip back \u21BB</div></div>';
    var mine = pr[0] === st.me.id;
    setH($('deedSheet'), '<div class="dd-wrap"><div class="dd-card' + (ui.deedFlip ? ' flipped' : '') + '" style="--gc:' + col + '"><div class="dd-rot"><div class="dd-face dd-front">' + front + '</div><div class="dd-face dd-back">' + back + '</div></div></div>' +
      '<div class="dd-btns">' + (mine ? rushBtn(sp, 'big-btn') : '') + '<button class="big-btn ghostbtn" data-dd="close">CLOSE</button></div></div>');
    paintPieces($('deedSheet'));
  }
  $('deedSheet').addEventListener('click', function (e) {
    if (e.target.closest('[data-act]')) return;           // RUSH REPAIR goes through the normal action handler
    if (e.target === $('deedSheet') || e.target.closest('[data-dd]')) { $('deedSheet').hidden = true; return; }
    var c = e.target.closest('.dd-card'); if (c) { ui.deedFlip = !ui.deedFlip; c.classList.toggle('flipped', ui.deedFlip); SFX.play('card'); vib(8); }
  });

  // ---- Shake to roll (one tap of permission on iOS, then a firm shake rolls when a roll is available)
  var shk = { on: false, asked: false, last: 0, prev: null };
  function canRollNow() { var t = st && st.turn; return !!(t && st.phase === 'play' && t.pid === st.me.id && (t.stage === 'roll' || t.canRollAgain) && !t.tab && !st.me.bankrupt); }
  function onMotion(e) {
    var a = e.accelerationIncludingGravity || e.acceleration; if (!a || a.x == null) return;
    var p = shk.prev; shk.prev = [a.x, a.y, a.z]; if (!p) return;
    var jerk = Math.abs(a.x - p[0]) + Math.abs(a.y - p[1]) + Math.abs((a.z || 0) - (p[2] || 0)), now = Date.now();
    if (jerk < ((C.shake && C.shake.jerk) || 28)) return;
    if (now - shk.last < ((C.shake && C.shake.debounceMs) || 1500)) return;
    if (!canRollNow()) return;
    shk.last = now; doRoll(true);
  }
  function startMotion() { if (shk.on) return; shk.on = true; window.addEventListener('devicemotion', onMotion); if (st && st.phase === 'play' && tab === 'turn') renderTurn(); }
  function askMotion() {
    if (shk.on || shk.asked || typeof DeviceMotionEvent === 'undefined') return; shk.asked = true;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {         // iOS 13+: needs a tap (this ROLL tap is it)
      try { DeviceMotionEvent.requestPermission().then(function (r) { if (r === 'granted') { store.set('rdr_motion', '1'); startMotion(); toast('\uD83D\uDCF3 Shake to roll is on', 1800); } }).catch(function () {}); } catch (e) {}
    } else startMotion();
  }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) startMotion();   // Android: no prompt needed

  // ---- Keep the screen awake (Wake Lock API): remembered per phone, re-acquired when the page comes back
  var wake = { want: store.get('rdr_wake') === '1', lock: null };
  function wakeOk() { return !!(navigator.wakeLock && navigator.wakeLock.request); }
  function wakeBtn() { if (!wakeOk()) return ''; return '<button class="wakebtn' + (wake.want ? ' on' : '') + '" data-act="wake" aria-pressed="' + wake.want + '" aria-label="Keep screen awake">' + (wake.want ? '\uD83D\uDD06' : '\uD83C\uDF19') + '<small>' + (wake.want ? 'Awake' : 'Sleep') + '</small></button>'; }
  function acquireWake() {
    if (!wakeOk() || !wake.want || wake.lock || document.visibilityState !== 'visible') return;
    try { navigator.wakeLock.request('screen').then(function (l) { wake.lock = l; if (l && l.addEventListener) l.addEventListener('release', function () { wake.lock = null; }); }).catch(function () { wake.lock = null; }); } catch (e) {}
  }
  function releaseWake() { var l = wake.lock; wake.lock = null; if (l && l.release) try { l.release(); } catch (e) {} }
  function toggleWake() {
    wake.want = !wake.want; store.set('rdr_wake', wake.want ? '1' : '0');
    if (wake.want) acquireWake(); else releaseWake();
    toast(wake.want ? '\uD83D\uDD06 Screen stays on' : '\uD83C\uDF19 Screen can sleep', 1400); vib(12); SFX.play('click');
    if (st && st.phase === 'play' && tab === 'turn') renderTurn();
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { wake.lock = null; acquireWake(); } });
  document.addEventListener('pointerdown', function () { if (wake.want && !wake.lock) acquireWake(); }, true);
  acquireWake();

  // ---- Cash animation: money in pops dollar signs (cha-ching), money out crunches
  function cashFx(delta) {
    if (!delta) return;
    var el = $('myCash'), r = el.getBoundingClientRect(), box = $('cashFx'), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var lab = document.createElement('span'); lab.className = 'cf-lab ' + (delta > 0 ? 'in' : 'out'); lab.textContent = (delta > 0 ? '+' : '\u2212') + money(Math.abs(delta));
    lab.style.left = cx + 'px'; lab.style.top = (cy + 4) + 'px'; box.appendChild(lab); setTimeout(function () { lab.remove(); }, 1500);
    el.classList.remove('cash-in', 'cash-out'); void el.offsetWidth;
    if (delta > 0) {
      el.classList.add('cash-in'); SFX.play('cashIn');
      var n = Math.min(9, 3 + Math.floor(Math.log(delta / 20 + 1) * 1.6));
      for (var i = 0; i < n; i++) (function (k) {
        var d = document.createElement('span'); d.className = 'cf-pop'; d.textContent = '$';
        d.style.left = (cx + (Math.random() - 0.5) * 30) + 'px'; d.style.top = cy + 'px';
        d.style.setProperty('--dx', ((Math.random() - 0.5) * 140).toFixed(0) + 'px'); d.style.setProperty('--dy', (40 + Math.random() * 70).toFixed(0) + 'px');
        d.style.animationDelay = (k * 45) + 'ms'; d.style.fontSize = (16 + Math.random() * 14).toFixed(0) + 'px';
        box.appendChild(d); setTimeout(function () { d.remove(); }, 1300 + k * 45);
      })(i);
    } else { el.classList.add('cash-out'); SFX.play('cashOut'); vib(18); }
    clearTimeout(cashFx._t); cashFx._t = setTimeout(function () { el.classList.remove('cash-in', 'cash-out'); }, 900);
  }

  window.RDRC = { state: function () { return st; }, send: send, setTab: setTab, ui: ui, openBuilder: openBuilder, join: join,
    flow: flow, openSet: openSet, closeSet: closeSet, openFrontSet: openFrontSet, openCard: openCard, openCardList: openCardList, renderStuff: renderStuff, renderBuilder: renderBuilder, flowTo: function (i) { flow.target = clampI(i); flow.vel = 0; kick(); },
    openDeed: openDeed, openEvent: openEvent, disasterAlert: disasterAlert, cashFx: cashFx, onMotion: onMotion, startMotion: startMotion, shk: shk, wake: wake, toggleWake: toggleWake, sizeFlow: sizeFlow, spInLine: spInLine };   // v0.5 hooks   // v0.4 test hooks
})();
