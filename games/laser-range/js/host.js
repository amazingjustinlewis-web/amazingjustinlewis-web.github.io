/* LASER RANGE - TV / host page (v0.1). Holds the game state, renders the gallery, talks to phones,
   runs the optional Hue Lights Helper hook and the automatic low-detail fallback. */
(function () {
  'use strict';
  var C = window.LR_CONFIG, SFX = window.LRSfx, Game = window.LRGame;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var Q = new URLSearchParams(location.search);
  var NONET = Q.has('nonet'), LOCAL = Q.has('local');
  if (Q.get('round')) C.roundSec = Math.max(5, +Q.get('round'));
  var game = new Game({ seed: Q.get('seed') ? +Q.get('seed') : undefined });
  var rnd = new window.LRRender($('cv'), game);
  var net = null, lightsDoor = null, clients = {}, phoneDirty = true, domDirty = true;
  var clock = function () { return performance.now(); };
  game.now = clock();
  window.LR = { game: game, render: rnd, sfx: SFX, clients: clients };
  if (Q.has('mute')) SFX.setMuted(true);

  // ------------------------------------------------------------------ layout + automatic low detail
  var detail = { low: Q.has('lowfx'), auto: !Q.has('lowfx') && !Q.has('hifx'), frames: 0, acc: 0, fps: 60, bad: 0, good: 0, drops: 0 };
  function layout() { rnd.low = detail.low; rnd.layout(window.innerWidth, window.innerHeight, detail.low ? C.lowfx.scale : Math.min(1, window.devicePixelRatio || 1)); SFX.setLite(detail.low); domDirty = true; }
  window.addEventListener('resize', function () { clearTimeout(layout._t); layout._t = setTimeout(layout, 150); });
  function setLow(v, why) { if (detail.low === v) return; detail.low = v; detail.bad = detail.good = 0; layout(); if (window.console) console.log('[detail] ' + (v ? 'LOW' : 'normal') + (why ? ' (' + why + ')' : '')); }
  function detailTick(dt) {
    detail.frames++; detail.acc += dt; if (detail.acc < 500) return;
    detail.fps = detail.frames * 1000 / detail.acc; var span = detail.acc / 1000; detail.frames = 0; detail.acc = 0;
    $('fxInfo').textContent = (detail.low ? 'low detail' : '') + (Q.has('fps') ? ' ' + Math.round(detail.fps) + ' fps' : '');
    if (!detail.auto || document.hidden) return;
    var L = C.lowfx;
    if (!detail.low && detail.fps < L.belowFps) { detail.bad += span; if (detail.bad >= L.afterSec) { detail.drops++; setLow(true, Math.round(detail.fps) + ' fps'); } } else detail.bad = 0;
    // try full detail again after a while (each new drop waits twice as long, so a weak TV does not flip-flop)
    if (detail.low && detail.drops && detail.fps > L.recoverAboveFps) { detail.good += span; if (detail.good >= L.recoverAfterSec * Math.pow(2, detail.drops - 1)) setLow(false, 'recovered'); } else detail.good = 0;
  }

  // ------------------------------------------------------------------ game events -> render, sound, lights, phones
  var phoneFx = {};
  function pfx(pid, k) { if (!pid) return; var f = phoneFx[pid] = phoneFx[pid] || {}; f[k] = (f[k] || 0) + 1; phoneDirty = true; }
  game.onEvent = function (type, d) {
    var p = d.pid ? game.byId(d.pid) : null;
    rnd.event(type, d, p);
    switch (type) {
      case 'join': SFX.play('join'); break;
      case 'shot': SFX.play(d.charged ? 'bigzap' : 'zap', { seat: d.seat, power: d.power }); break;
      case 'kill': SFX.play(d.type === 'gold' ? 'gold' : d.type === 'buddy' && d.pts < 0 ? 'oops' : 'pop'); pfx(d.pid, d.pts < 0 ? 'oops' : 'hit'); break;
      case 'thunk': SFX.play('thunk'); break;
      case 'clang': SFX.play('clang'); pfx(d.pid, 'hit'); break;
      case 'boom': SFX.play('boom'); pfx(d.pid, 'boom'); hueBoom(); break;
      case 'swipe': SFX.play('swoosh'); break;
      case 'powerup': SFX.play('balloon'); SFX.play('powerup'); pfx(d.pid, 'power'); break;
      case 'up': SFX.play('up'); break;
      case 'calPoint': SFX.play('calok'); pfx(d.pid, 'calok'); break;
      case 'calDone': SFX.play('caldone'); pfx(d.pid, 'caldone'); break;
      case 'calFail': SFX.play('oops'); pfx(d.pid, 'calfail'); break;
      case 'countdown': countdown(); lightFx('start'); break;
      case 'go': big('GO!', '', 700); SFX.play('go'); break;
      case 'over': SFX.play('buzzer'); setTimeout(function () { SFX.play('fanfare'); }, 900); lightFx('over', { escaped: true }); break;
      case 'lobby': lightFx('end', { reason: 'back to the lobby' }); break;
    }
    domDirty = true;
    if (type !== 'up' && type !== 'shot') phoneDirty = true;
  };
  var cdTimer = null;
  function countdown() {
    var n = C.countdownSec; clearInterval(cdTimer);
    big(String(n), 'Get ready!', 900); SFX.play('beep');
    cdTimer = setInterval(function () { n--; if (n <= 0 || game.phase !== 'countdown') { clearInterval(cdTimer); return; } big(String(n), 'Get ready!', 900); SFX.play('beep'); }, 1000);
  }
  function big(text, sub, ms) { var el = $('big'); el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : ''); el.className = 'on'; clearTimeout(big._t); big._t = setTimeout(function () { el.className = ''; }, ms || 1200); }

  // ------------------------------------------------------------------ DOM: lobby, HUD, results
  function vip() { for (var i = 0; i < game.players.length; i++) { var p = game.players[i]; if (!p.bot && p.connected) return p; } return null; }
  function status(p) {
    if (!p.connected) return ['reconnecting\u2026', ''];
    if (p.cal) return p.cal.kind === 'recenter' ? ['re-centring', ''] : ['calibrating ' + p.cal.step + '/' + C.aim.calPoints.length, ''];
    if (p.hasAim) return [p.mode === 'pad' ? 'ready (touchpad) \u2714' : 'ready \u2714', 'ok'];
    if (p.mode === null) return ['enabling aiming\u2026', ''];
    return ['getting ready\u2026', ''];
  }
  var lastDom = '';
  function renderDom() {
    var ph = game.phase, calib = game.players.some(function (p) { return !!p.cal; });
    var lobbyish = ph === 'lobby';
    $('lobby').className = lobbyish && !calib ? '' : 'tuck';
    $('strip').hidden = !(net && net.code) || ph === 'over' || (lobbyish && !calib);
    if (net && net.code) $('stripCode').textContent = net.code;
    var stripMsg = calib ? 'Calibrating: point the top of your phone at your coloured target and tap' : ph === 'play' && game.players.length < C.maxPlayers ? 'Late joiners welcome' : '';
    $('stripMsg').textContent = stripMsg;
    $('hud').hidden = !(ph === 'play' || ph === 'countdown');
    $('results').hidden = ph !== 'over';
    // lobby list
    var key = JSON.stringify([ph, game.players.map(function (p) { return [p.id, p.name, status(p)[0]]; }), vip() && vip().id]);
    if (key !== lastDom) {
      lastDom = key;
      $('lobbyPlayers').innerHTML = game.players.map(function (p) { var s = status(p); return '<li><span class="dot" style="background:' + p.color + '"></span>' + esc(p.name) + (p.bot ? ' <small>(bot)</small>' : '') + '<span class="st ' + s[1] + '">' + esc(s[0]) + '</span></li>'; }).join('');
      var ready = game.players.filter(function (p) { return game.ready(p); }).length;
      $('startHint').textContent = !game.players.length ? 'Scan the code to join (up to ' + C.maxPlayers + ' players).' : ready ? (vip() ? vip().name + ': press START on your phone' : 'Press Enter to start') + ' \u00B7 shoot the practice targets while you wait' : 'Follow the steps on your phone to set up aiming.';
    }
    // HUD scores
    if (ph === 'play' || ph === 'countdown') {
      var cards = '';
      for (var s = 0; s < C.maxPlayers; s++) {
        var p = null; for (var i = 0; i < game.players.length; i++) if (game.players[i].seat === s) p = game.players[i];
        if (!p) { cards += '<div class="sc empty"></div>'; continue; }
        cards += '<div class="sc' + (p.connected ? '' : ' off') + '" style="border-color:' + p.color + '"><span class="nm" style="color:' + p.color + '">' + esc(p.name) + '</span>' + (p.weapon === 'charger' ? '<span class="wp">\u26A1' + Math.ceil(Math.max(0, p.weaponUntil - game.now) / 1000) + '</span>' : '') + '<span class="pts">' + p.score + '</span></div>';
      }
      if ($('scores')._h !== cards) { $('scores')._h = cards; $('scores').innerHTML = cards; }
      var tl = Math.ceil(game.timeLeft() / 1000), txt = Math.floor(tl / 60) + ':' + ('0' + tl % 60).slice(-2);
      if ($('timer').textContent !== txt) { $('timer').textContent = txt; $('timer').className = tl <= 10 && ph === 'play' ? 'low' : ''; if (tl <= 5 && tl > 0 && ph === 'play') SFX.play('tick'); }
    }
    if (ph === 'over' && game.results && $('results')._r !== game.round) {
      $('results')._r = game.round;
      var R = game.results, w = R.order[0];
      $('resTitle').innerHTML = R.order.length > 1 ? '<span style="color:' + w.color + '">' + esc(w.name) + '</span> WINS!' : 'TIME!';
      var pl = ['1st', '2nd', '3rd', '4th'];
      $('resList').innerHTML = R.order.map(function (r) { return '<li class="' + (r.place === 1 ? 'first' : '') + '" style="border-color:' + r.color + '"><span class="pl">' + pl[r.place - 1] + '</span><span class="nm" style="color:' + r.color + '">' + esc(r.name) + '</span><span class="stats">' + r.hits + ' hits &middot; ' + r.acc + '% accuracy &middot; ' + r.barrels + ' barrels &middot; best streak ' + r.streak + '</span><span class="pts">' + r.score + '</span></li>'; }).join('');
      $('awards').innerHTML = R.awards.map(function (a) { var p = game.byId(a.pid); return '<div class="aw" style="border-color:' + (p ? p.color : '#fff') + '"><b>' + esc(a.title) + '</b><span>' + esc(p ? p.name : '') + ': ' + esc(a.text) + '</span></div>'; }).join('');
    }
    renderHuePanel();
  }

  // ------------------------------------------------------------------ keyboard (TV remote / laptop)
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'Enter' || k === ' ') { if (game.phase === 'lobby' || game.phase === 'over') game.start(); e.preventDefault(); }
    else if (k === 'Escape' || k === 'Backspace') { if (game.phase !== 'lobby') game.toLobby(); }
    else if (k === 'm' || k === 'M') SFX.setMuted(!SFX.muted());
    else if (k === 'd' || k === 'D') { detail.auto = false; setLow(!detail.low, 'D key'); }
    else if (k === 'b' || k === 'B') addBot();
    else if ((k === 'l' || k === 'L') && lightsAvailable()) setLights(!lights.enabled, lights.selected);
  });

  // ------------------------------------------------------------------ phones
  function controllerUrl(code) {
    var base = location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html';
    return base + '?room=' + code + (LOCAL ? '&local=1' : '');
  }
  function drawQr(text) {
    var cv = $('qr'), ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = '#0d0a18';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
    } catch (e) { ctx.fillStyle = '#000'; ctx.fillText('QR unavailable', 20, 150); }
  }
  function setNetUi(st, code, detailTxt) {
    var ns = $('netStatus');
    if (st === 'online') {
      var url = controllerUrl(code);
      $('code').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); drawQr(url);
      ns.className = 'netstatus ok'; ns.textContent = 'Room open. Phones can join now.'; $('netBadge').textContent = '';
      openLightsDoor(code);
    } else if (st === 'offline') {
      ns.className = 'netstatus bad'; ns.textContent = 'Phones cannot join right now (' + (detailTxt || 'no connection') + '). Retrying\u2026';
      $('netBadge').textContent = 'room server offline';
      if (net && net.open) setTimeout(function () { if (net.status === 'offline') { net.tries = 0; net.open(); } }, 8000);
    } else { ns.className = 'netstatus'; ns.textContent = st === 'reconnecting' ? 'Reconnecting to the room server\u2026' : 'Connecting to the room server\u2026'; }
    domDirty = true;
  }
  function send(conn, m) { if (net) net.send(conn, m); }
  function onPhoneMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    if ((m.t === 'hello' && m.role === 'lights') || conn._lights) { onLightsMessage(conn, m); return; }
    game.now = clock();
    if (m.t === 'hello') {
      var cid = String(m.clientId || conn.peer).slice(0, 40), c = clients[cid], p = c ? game.byId(c.pid) : null;
      if (!p) { p = game.addPlayer({ name: m.name, clientId: cid }); if (!p) { send(conn, { t: 'reject', reason: 'The range is full (' + C.maxPlayers + ' players). Wait for the next round.' }); return; } }
      else if (m.name) p.name = String(m.name).replace(/[<>]/g, '').trim().slice(0, 12) || p.name;
      if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
      clients[cid] = { pid: p.id, conn: conn, seen: Date.now(), lastSent: '', sentAt: 0 };
      conn._cid = cid; p.connected = true; p.offSince = 0;
      send(conn, { t: 'welcome', pid: p.id, room: net.code, seat: p.seat, color: p.color });
      game.changed(); phoneDirty = domDirty = true;
      return;
    }
    var cl = clients[conn._cid]; if (!cl || cl.conn !== conn) return;
    cl.seen = Date.now();
    var pl = game.byId(cl.pid);
    if (!pl) { send(conn, { t: 'reject', reason: 'You were removed from the room. Join again.' }); return; }
    if (!pl.connected) { pl.connected = true; pl.offSince = 0; domDirty = true; }
    if (m.t === 'aim' || m.t === 'pad') { game.intent(pl.id, m); return; }      // 30x a second: no state push
    if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }
    var isVip = vip() === pl;
    if (m.t === 'start') { if (isVip && (game.phase === 'lobby' || game.phase === 'over')) game.start(); return; }
    if (m.t === 'toLobby') { if (isVip && game.phase !== 'lobby') game.toLobby(); return; }
    if (m.t === 'leave') { game.removePlayer(pl.id); delete clients[conn._cid]; phoneDirty = domDirty = true; return; }
    if (m.t === 'name') { pl.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 12) || pl.name; game.changed(); return; }
    var r = game.intent(pl.id, m);
    if (typeof r === 'string') send(conn, { t: 'toast', text: r });
    phoneDirty = domDirty = true;
  }
  function onPhoneClose(conn) {
    if (conn._lights) { if (conn === lights.conn) { lights.conn = null; lights.st = null; domDirty = true; } return; }
    var cl = clients[conn._cid];
    if (cl && cl.conn === conn) { var p = game.byId(cl.pid); if (p) { p.connected = false; p.offSince = Date.now(); p.charge = null; game.changed(); domDirty = true; } }
  }
  setInterval(function () {
    var now = Date.now();
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (!p) { delete clients[cid]; continue; }
      if (p.connected && now - cl.seen > 12000) { p.connected = false; p.offSince = now; p.charge = null; domDirty = true; }
      if (!p.connected && game.phase === 'lobby' && now - (p.offSince || now) > 30000) { game.removePlayer(p.id); delete clients[cid]; domDirty = true; }   // gone for good
      cl.lastSent = '';
    }
    if (lights.conn && now - lights.seen > 20000) { lights.conn = null; lights.st = null; domDirty = true; }
    phoneDirty = true;
  }, 3000);
  function phoneState(p) {
    var g = game, pt = g.calPoint(p), W = C.weapons[p.weapon] || C.weapons.blaster;
    return { t: 'state', phase: g.phase, round: g.round,
      timeLeft: Math.ceil(g.timeLeft() / 1000), goIn: g.phase === 'countdown' ? Math.max(0, Math.ceil((g.goAt - g.now) / 1000)) : 0,
      me: { id: p.id, name: p.name, color: p.color, ink: p.ink, seat: p.seat, colorName: p.colorName, score: p.score, place: p.place, mode: p.mode, hasAim: p.hasAim, calibrated: !!p.calib,
        cal: p.cal ? { kind: p.cal.kind, step: p.cal.step, total: p.cal.kind === 'recenter' ? 1 : C.aim.calPoints.length, label: pt ? pt.label : '', id: pt ? pt.id : '' } : null,
        weapon: p.weapon, weaponLabel: W.label, hold: W.mode === 'hold', weaponLeft: p.weapon !== 'blaster' ? Math.ceil(Math.max(0, p.weaponUntil - g.now) / 1000) : 0,
        vip: vip() === p, hits: p.hits, shots: p.shotsFired, barrels: p.barrels },
      fx: phoneFx[p.id] || {},
      players: g.players.map(function (q) { return [q.name, q.color, q.score, g.ready(q) ? 1 : 0]; }),
      canStart: g.players.some(function (q) { return g.ready(q); }),
      results: g.phase === 'over' && g.results ? g.results.order.map(function (r) { return [r.name, r.color, r.score, r.place, r.acc]; }) : null
    };
  }
  var pushT = 0;
  function pushPhones(now) {
    if (!net || now - pushT < 120) return; pushT = now; phoneDirty = false;
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (!p || !cl.conn || !cl.conn.open) continue;
      var js = JSON.stringify(phoneState(p));
      if (js === cl.lastSent) continue;
      cl.lastSent = js; net.send(cl.conn, JSON.parse(js));
    }
  }

  // ------------------------------------------------------------------ bots (testing / demo): ?bots=N or the B key
  var bots = [];
  function addBot() {
    var p = game.addPlayer({ name: ['ROBO', 'BOLT', 'ZAPP', 'PIXEL'][bots.length % 4], bot: true }); if (!p) return;
    game.intent(p.id, { t: 'mode', m: 'pad' });
    bots.push({ pid: p.id, aimAt: null, next: 0, skill: 0.6 + Math.random() * 0.35 });
  }
  function botTick(now) {
    bots = bots.filter(function (b) { return !!game.byId(b.pid); });
    bots.forEach(function (b) {
      var p = game.byId(b.pid); if (!p.hasAim) return;
      var cand = game.targets.filter(function (t) { return game.hittable(t) && t.type !== 'buddy'; });
      if (!b.aimAt || game.targets.indexOf(b.aimAt) < 0 || b.aimAt.state === 'dead' || !game.hittable(b.aimAt)) {
        var bar = game.covers.filter(function (c) { return c.kind === 'barrel' && !c.dead; });
        b.aimAt = cand.length ? cand[Math.floor(Math.random() * cand.length)] : null;
        b.barrel = !b.aimAt || Math.random() < 0.12 ? bar[Math.floor(Math.random() * bar.length)] : null;
      }
      var tx = p.tx, ty = p.ty;
      if (b.barrel && !b.barrel.dead) { var R = game.coverRect(b.barrel); tx = b.barrel.x; ty = (R.y0 + R.y1) / 2; }
      else if (b.aimAt) { var TR = game.targetRect(b.aimAt); tx = (TR.x0 + TR.x1) / 2; ty = (TR.y0 + TR.y1) / 2; }
      else { tx = 0.5 + Math.sin(now / 1300 + p.seat) * 0.3; ty = 0.55 + Math.cos(now / 1700 + p.seat) * 0.2; }
      var k = 0.09 * b.skill; game.setTarget(p, p.tx + (tx - p.tx) * k + (Math.random() - 0.5) * 0.004, p.ty + (ty - p.ty) * k + (Math.random() - 0.5) * 0.004);
      var close = Game.dist(p.cx, p.cy, tx, ty) < 0.02;
      if (now > b.next && (close || Math.random() < 0.004)) {
        b.next = now + 280 + Math.random() * 500 / b.skill;
        if (p.weapon === 'charger') { game.intent(p.id, { t: 'down' }); setTimeout(function () { game.now = clock(); game.intent(p.id, { t: 'up' }); }, 300 + Math.random() * 700); }
        else { game.intent(p.id, { t: 'down' }); game.intent(p.id, { t: 'up' }); }
      }
      if (Math.random() < 0.0015) game.intent(p.id, { t: 'swipe', dx: Math.random() - 0.5, dy: -Math.random() });
    });
  }

  // ------------------------------------------------------------------ Philips Hue via the Zombie Tiles Lights Helper (same protocol)
  var lights = { conn: null, seen: 0, st: null, enabled: false, selected: [], adopted: false, prefsRev: null, lastBoom: 0 };
  function lightsAvailable() { return !!(lights.conn && lights.conn.open && lights.st && lights.st.ok); }
  function lightsOn() { return lightsAvailable() && lights.enabled && lights.selected.length > 0; }
  function lightsSend(m) { if (lights.conn && lights.conn.open) try { lights.conn.send(m); } catch (e) {} }
  function lightFx(k, d) { if (!lightsOn()) return; var m = d || {}; m.t = 'fx'; m.k = k; lightsSend(m); }
  function hueBoom() {                     // barrel explosion: white flash then orange, at most once per hueBoomGapMs
    var now = Date.now(); if (now - lights.lastBoom < C.hueBoomGapMs) return; lights.lastBoom = now;
    if (lightsOn() && game.phase !== 'play') lightFx('start');     // practice in the lobby: the helper needs a session first
    lightFx('boom', { color: C.hue.boom.color });
  }
  function openLightsDoor(code) {          // the existing helper dials rooms with the Zombie Tiles prefix: open a small door there too
    if (LOCAL || NONET || lightsDoor || typeof window.Peer !== 'function') return;
    lightsDoor = new window.LRNet.Host({ code: code, fixedCode: true, prefix: C.lightsPeerPrefix,
      onMessage: function (conn, m) { if (m && ((m.t === 'hello' && m.role === 'lights') || conn._lights)) onLightsMessage(conn, m); else try { conn.send({ t: 'reject', reason: 'This is a Laser Range room. Open the Laser Range controller.' }); } catch (e) {} },
      onClose: onPhoneClose, onStatus: function () {} });
  }
  function lightsSync() {
    lightsSend({ t: 'lights-config', enabled: lights.enabled && lightsAvailable(), selected: lights.selected });
    if (lightsOn() && game.phase === 'play') lightFx('start');
    if (!lightsOn()) lightsSend({ t: 'fx', k: 'end', reason: 'lights switched off' });
    domDirty = true;
  }
  function setLights(enabled, selected) {
    var ids = (lights.st && lights.st.groups || []).map(function (g) { return g.id; });
    lights.enabled = !!enabled; lights.selected = (selected || []).map(String).filter(function (id) { return ids.indexOf(id) !== -1; });
    lightsSync();
  }
  function hueIntent(m) {
    if (!lightsAvailable()) return;
    if (typeof m.enabled === 'boolean') setLights(m.enabled, lights.selected);
    if (m.toggle != null) { var id = String(m.toggle), sel = lights.selected.slice(), i = sel.indexOf(id); if (i === -1) sel.push(id); else sel.splice(i, 1); setLights(lights.enabled, sel); }
    if (m.test) lightsSend({ t: 'lights-test', groups: lights.selected });
  }
  function onLightsMessage(conn, m) {
    if (m.t === 'hello') {
      if (lights.conn && lights.conn !== conn) try { lights.conn.close(); } catch (e) {}
      conn._lights = true; lights.conn = conn; lights.seen = Date.now(); lights.st = null;
      try { conn.send({ t: 'lights-welcome', room: net ? net.code : '', fx: C.hue }); } catch (e) {}
      domDirty = true; return;
    }
    if (conn !== lights.conn) return;
    lights.seen = Date.now();
    if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} return; }
    if (m.t === 'lights-status') {
      var first = !lights.st;
      lights.st = { ok: !!m.ok, paired: !!m.paired, reachable: !!m.reachable, mock: !!m.mock, error: String(m.error || '').slice(0, 160),
        bridge: m.bridge && m.bridge.name ? String(m.bridge.name).slice(0, 40) : 'Hue bridge',
        groups: (Array.isArray(m.groups) ? m.groups : []).slice(0, 40).map(function (g) { return { id: String(g.id), name: String(g.name).slice(0, 32) }; }) };
      var rev = m.prefs && typeof m.prefs.rev === 'number' ? m.prefs.rev : null;
      if (first) { if (!lights.adopted && m.remembered) { lights.adopted = true; setLights(!!m.remembered.enabled, m.remembered.selected || []); } else setLights(lights.enabled, lights.selected); }
      else if (rev !== null && rev !== lights.prefsRev) setLights(!!m.prefs.enabled, m.prefs.selected || []);
      if (rev !== null) lights.prefsRev = rev;
      domDirty = true;
    }
  }
  function renderHuePanel() {
    var el = $('huePanel'), st = lights.st, code = net && net.status === 'online' ? net.code : '';
    var key = JSON.stringify([!!lights.conn, st, lights.enabled, lights.selected, code]); if (el._key === key) return; el._key = key;
    if (!lights.conn) { el.className = 'hue-panel off'; el.innerHTML = '\uD83D\uDCA1 Philips Hue (optional): start the Zombie Tiles <b>Lights Helper</b> on your PC' + (code ? ' and connect it to room <b>' + code + '</b>' : '') + '. Barrels flash the lights.'; return; }
    if (!st) { el.className = 'hue-panel'; el.innerHTML = '\uD83D\uDCA1 Lights helper connected. Checking the Hue bridge\u2026'; return; }
    if (!st.ok) { el.className = 'hue-panel'; el.innerHTML = '\uD83D\uDCA1 Lights helper connected, but the bridge is not ready (' + esc(st.error || 'not paired') + ').'; return; }
    el.className = 'hue-panel ok';
    var h = '\uD83D\uDCA1 Hue found' + (st.mock ? ' (mock)' : '') + '. Flash on explosions? <button class="hb' + (lights.enabled ? ' on' : '') + '" data-hue="on">YES</button><button class="hb' + (!lights.enabled ? ' on' : '') + '" data-hue="off">NO</button>';
    if (lights.enabled) h += '<div>' + st.groups.map(function (g) { var on = lights.selected.indexOf(g.id) !== -1; return '<button class="hroom' + (on ? ' on' : '') + '" data-g="' + esc(g.id) + '">' + (on ? '\u2714 ' : '') + esc(g.name) + '</button>'; }).join('') + '<button class="htest" data-hue="test">Flash ticked</button></div>';
    el.innerHTML = h;
  }
  $('huePanel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var v = b.getAttribute('data-hue'), g = b.getAttribute('data-g');
    if (v === 'on' || v === 'off') hueIntent({ enabled: v === 'on' }); else if (v === 'test') hueIntent({ test: true }); else if (g) hueIntent({ toggle: g });
  });

  // ------------------------------------------------------------------ main loop
  var lastT = clock(), domT = 0, lastVer = -1;
  function loop() {
    var now = clock(), dt = Math.min(200, now - lastT); lastT = now;
    try {
      game.tick(now);
      if (bots.length) botTick(now);
      rnd.frame(now, { dt: dt });
      detailTick(dt);
      if (game.version !== lastVer) { lastVer = game.version; domDirty = true; phoneDirty = true; }
      if ((domDirty && now - domT > 100) || now - domT > 500) { domT = now; domDirty = false; renderDom(); }
      if (phoneDirty || game.phase === 'play') pushPhones(now);
    } catch (e) { if (window.console) console.error(e); }
    requestAnimationFrame(loop);
  }
  function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(function () {}); } catch (e) {} }

  // boot
  if (location.protocol === 'file:') $('backLink').hidden = true;
  if (window.matchMedia && matchMedia('(max-width: 760px) and (pointer: coarse)').matches) $('phoneHint').hidden = false;
  layout(); requestWake();
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); }); } catch (e) {}   // repaint the sign/crates once Fredoka has loaded
  var roomQ = Q.get('room') ? Q.get('room').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : null;
  if (LOCAL) net = new window.LRNet.LocalHost({ code: roomQ || 'TEST', onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else if (!NONET) net = new window.LRNet.Host({ code: roomQ, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else setNetUi('offline', null, 'phones disabled with ?nonet');
  for (var bi = 0; bi < Math.min(C.maxPlayers, +(Q.get('bots') || 0)); bi++) addBot();
  if (Q.has('autostart') && game.players.length) setTimeout(function () { game.start(); }, 400);
  window.LR.addBot = addBot; window.LR.net = function () { return net; }; window.LR.lights = function () { return lights; }; window.LR.detail = detail; window.LR.setLow = setLow; window.LR.phoneState = phoneState; window.LR.lightsMessage = onLightsMessage;
  requestAnimationFrame(loop);
})();
