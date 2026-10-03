/* ZOMBIE TILES - TV / host glue: lobby, board loop, overlays, hot-seat input, phone networking. */
(function () {
  'use strict';
  var C = window.ZT_CONFIG, W = C.weapons;
  var Q = new URLSearchParams(location.search);
  var FAST = Q.has('fast'), SEED = Q.has('seed') ? +Q.get('seed') : null, NONET = Q.has('nonet');
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var dirty = true, phoneDirty = true;
  var game = new window.ZTGame({ speed: FAST ? 0.08 : 1, onChange: function () { dirty = true; phoneDirty = true; }, onEvent: onEvent });
  var rnd = new window.ZTRender($('board'));
  window.ZT = { game: game, render: rnd, config: C };     // handy for testing / tinkering in the console

  // ------------------------------------------------------------ sound (tiny synth, M to mute)
  var AC = null, muted = Q.has('mute');
  function tone(f, d, type, vol, slide) {
    if (muted) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      var o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
    } catch (e) {}
  }
  function rattle() { for (var i = 0; i < 7; i++) setTimeout(function () { tone(300 + Math.random() * 500, 0.04, 'triangle', 0.05); }, i * 60 + Math.random() * 40); }

  // ------------------------------------------------------------ events -> juice
  function playerById(id) { return game.byId(id); }
  function big(text, sub, color) {
    var el = document.createElement('div'); el.className = 'b'; if (color) el.style.setProperty('--bc', color);
    el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('big').innerHTML = ''; $('big').appendChild(el);
  }
  function onEvent(type, d) {
    var p = d.pid ? playerById(d.pid) : null;
    switch (type) {
      case 'start': rnd.snap(game); big('FIND THE HELIPAD', 'Explore tile by tile. Watch out for zombies.', '#b6ff7a'); tone(220, 0.4, 'sawtooth', 0.05, 110); break;
      case 'turn': if (p) { tone(660, 0.08); tone(990, 0.1, 'square', 0.04); } break;
      case 'roll': rattle(); break;
      case 'step': tone(180 + Math.random() * 40, 0.05, 'triangle', 0.04); break;
      case 'bump': tone(90, 0.08, 'square', 0.04); break;
      case 'pickup': if (p) rnd.pop(d.kind === 'heart' ? '+1 \u2665' : d.kind === 'ammo' ? 'AMMO' : W[d.kind].short.toUpperCase() + '!', p.x, p.y, d.kind === 'heart' ? '#ff6b88' : '#ffd65a'); tone(880, 0.08, 'square', 0.05, 1320); break;
      case 'draw': big(d.tpl === 'helipad' ? 'THE HELIPAD!' : 'NEW TILE', d.tpl === 'helipad' ? 'Reach a gate. The guard says YES... or NO.' : 'Rotate it and attach it', d.tpl === 'helipad' ? '#ffd65a' : '#9ad8ff'); tone(330, 0.25, 'sine', 0.06, 660); break;
      case 'tile': break;
      case 'lunge': tone(120, 0.2, 'sawtooth', 0.05, 80); break;
      case 'fightStart': tone(140, 0.3, 'sawtooth', 0.07, 70); break;
      case 'fightRoll': rattle(); break;
      case 'fightResult':
        var f = game.fight;
        if (f) {
          if (f.lost) { rnd.pop('-' + f.lost + ' \u2665', f.px, f.py, '#ff4a5a', true); rnd.shake = Math.min(1.2, 0.4 + f.lost * 0.3); tone(90, 0.35, 'sawtooth', 0.08, 50); }
          if (f.zdead) { rnd.pop('KILL!', f.x, f.y, '#6dff9e', true); tone(520, 0.12, 'square', 0.06, 260); }
          else if (f.zdmg) rnd.pop('-1 HP', f.x, f.y, '#ffd65a');
        }
        break;
      case 'gate': if (!d.yes) { big('NO!', 'The guard shakes his head. Try another gate.', '#ff3b4e'); tone(110, 0.4, 'square', 0.06); } break;
      case 'escape': big(p.name + ' ESCAPED!', Ordinal(d.place) + ' place. The chopper takes them aboard.', p.color); [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 'square', 0.05); }, i * 110); }); break;
      case 'death': big('LEFT FOR DEAD', p.name + ' will rise in ' + C.riseAfterRounds + ' full round' + (C.riseAfterRounds > 1 ? 's' : '') + '...', '#ff3b4e'); rnd.shake = 1.2; tone(70, 0.8, 'sawtooth', 0.08, 40); break;
      case 'rise': big(p.name + ' RISES!', p.status === 'zombie' ? 'Now playing as a zombie' : 'A new zombie joins the horde', '#b6ff7a'); tone(60, 0.9, 'sawtooth', 0.08, 120); break;
      case 'round': if (d.round > 1) big('ROUND ' + d.round, d.moved ? 'The dead shuffle...' : '', '#c9b7ff'); break;
      case 'over': tone(392, 0.3, 'square', 0.05); break;
    }
    if (type === 'escape' || type === 'death' || type === 'fightResult' || type === 'over' || type === 'rise') phoneDirty = true;
  }
  var Ordinal = window.ZTGame.ordinal;

  // ------------------------------------------------------------ layout + loop
  function layout() {
    var w = innerWidth, h = innerHeight;
    rnd.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
    var top = $('top').getBoundingClientRect().height, side = $('side').getBoundingClientRect().width, ban = $('banner').getBoundingClientRect().height;
    rnd.setArea({ x: 0, y: top + 8, w: w - side, h: h - top - ban - 40 });
  }
  addEventListener('resize', layout);
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (dirty) { dirty = false; updateDom(); }
    rnd.frame(game, dt, now);
    if (phoneDirty) { phoneDirty = false; pushPhones(); }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ DOM updates
  var lastRollSeq = 0, lastFightSeq = -1, lastFightStage = '', stopDice = null, stopF1 = null, stopF2 = null;
  function heartsHtml(n) { var s = ''; for (var i = 0; i < C.maxHearts; i++) s += i < n ? '\u2665' : '<span class="e">\u2665</span>'; return s; }
  function weaponCanvas(kind) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    if (kind !== 'none') window.ZTRender.drawItem(cv.getContext('2d'), kind, 32, 32, 52);
    return cv;
  }
  function actor() { var id = game.actorId(); return id ? game.byId(id) : null; }
  function tvControls(p) { return !!p && (p.local || !p.connected || Q.get('hotseat') === 'all'); }

  function updateDom() {
    var g = game, ph = g.phase;
    $('lobby').hidden = ph !== 'lobby';
    $('results').hidden = ph !== 'over';
    if (ph === 'lobby') { renderLobby(); return; }
    if (ph === 'over') renderResults();
    $('roundInfo').innerHTML = 'Round <b>' + g.round + '</b>';
    $('deckInfo').innerHTML = 'Tiles left <b>' + g.deck.length + '</b>';
    $('joinInfo').innerHTML = net && net.status === 'online' ? 'Room <b>' + net.code + '</b>' : '';
    // cards
    var cards = $('cards'); cards.innerHTML = '';
    var cur = g.curP();
    g.players.forEach(function (p) {
      var el = document.createElement('div');
      var out = p.status !== 'alive' && p.status !== 'zombie';
      el.className = 'card' + (p === cur && ph !== 'over' ? ' cur' : '') + (out ? ' out' : '');
      el.style.setProperty('--c', p.color);
      var tag = p.local ? 'HOT-SEAT' : (p.connected ? 'PHONE' : 'RECONNECTING');
      var stat = p.status === 'escaped' ? '<div class="cstat esc">ESCAPED ' + Ordinal(p.place).toUpperCase() + '!</div>'
        : p.status === 'dead' ? '<div class="cstat dead">Left for dead (rises soon)</div>'
        : p.status === 'zombie' ? '<div class="cstat zom">Zombie (hunting)</div>'
        : p.status === 'spectator' ? '<div class="cstat dead">Spectating</div>' : '';
      el.innerHTML = '<div class="cname"><span class="dot"></span>' + esc(p.name) + '<span class="tag' + (p.local || p.connected ? '' : ' off') + '">' + tag + '</span></div>' +
        (p.status === 'alive' ? '<div class="crow">' + (C.showHeartsOnTV ? '<span class="hearts">' + heartsHtml(p.hearts) + '</span>' : '') + '<span class="weap"></span></div>' : '') + stat;
      var wp = el.querySelector('.weap');
      if (wp) { wp.appendChild(weaponCanvas(p.weapon)); wp.appendChild(document.createTextNode(W[p.weapon].short)); }
      cards.appendChild(el);
    });
    $('log').innerHTML = g.messages.slice(-4).map(function (m) { return '<div>' + esc(m) + '</div>'; }).join('');
    // banner
    var a = actor(), tv = tvControls(a);
    var who = cur ? '<span style="color:' + cur.color + '">' + esc(cur.name) + '</span>' : '';
    var what = '', sub = '';
    var key = function (k, phone) { return tv ? '<kbd>' + k + '</kbd>' : phone; };
    switch (ph) {
      case 'roll': what = 'Roll to move: ' + key('ENTER', 'press ROLL on your phone'); break;
      case 'rolling': what = 'Rolling...'; break;
      case 'plan': what = 'Plan your path: <b>' + g.plan.length + '</b> / ' + g.movesLeft + ' squares, then ' + key('ENTER', 'EXECUTE'); sub = 'Press the opposite direction to back up. Execute with 0 squares to stay put.'; break;
      case 'exec': what = 'Moving... ' + g.movesLeft + ' left'; break;
      case 'place': what = 'New tile! ' + (tv ? '<kbd>\u25C0 \u25B6</kbd> rotate &middot; <kbd>\u25B2 \u25BC</kbd> other spot &middot; <kbd>ENTER</kbd> place' : '\u25C0 \u25B6 rotate \u00b7 \u25B2 \u25BC other spot \u00b7 EXECUTE places it'); sub = g.place && g.place.slots.length > 1 ? g.place.slots.length + ' places it could go' : ''; break;
      case 'fight': what = 'FIGHT!'; break;
      case 'zturn': what = 'Zombie turn: ' + key('ENTER', 'press LURCH on your phone'); break;
      case 'zmoving': what = 'Lurching...'; break;
      case 'escape': what = 'ESCAPED!'; break;
      case 'between': case 'roundEnd': what = ''; break;
    }
    $('bWho').innerHTML = who; $('bWhat').innerHTML = what; $('bSub').textContent = sub || g.lastMsg || '';
    // banner dice
    if (g.roll && g.roll.seq !== lastRollSeq) {
      lastRollSeq = g.roll.seq; if (stopDice) stopDice();
      stopDice = window.ZTDice.animate($('bannerDice'), g.roll.d, g.roll.kind === 'zombie' ? 'zombie' : g.roll.dice, C.timing.roll * game.speed);
    } else if (!g.roll && lastRollSeq !== -1 && (ph === 'roll' || ph === 'zturn')) {
      if (stopDice) stopDice(); stopDice = null; $('bannerDice').getContext('2d').clearRect(0, 0, 240, 120);
    }
    // hot-seat pad
    $('pad').hidden = !(a && tv);
    if (a && tv) {
      $('padWho').innerHTML = '<span style="color:' + a.color + '">' + esc(a.name) + '</span>';
      $('padRoll').textContent = ph === 'zturn' ? 'LURCH' : ph === 'fight' ? 'FIGHT' : 'ROLL';
      $('padExec').textContent = ph === 'place' ? 'PLACE' : ph === 'plan' ? 'GO' : ph === 'roll' || ph === 'fight' || ph === 'zturn' ? 'ROLL' : 'GO';
    }
    renderFight();
  }

  function renderFight() {
    var f = game.fight, ov = $('fight');
    if (!f) { ov.hidden = true; lastFightStage = ''; return; }
    ov.hidden = false;
    var p = game.byId(f.pid), z = game.zombieById(f.zid), tv = tvControls(p);
    $('fpName').innerHTML = '<span style="color:' + p.color + '">' + esc(p.name) + '</span>';
    var bonus = f.stage === 'await' ? W[p.weapon].bonus : f.bonus;
    $('fpWeap').textContent = W[f.stage === 'await' ? p.weapon : f.weapon].label + ' (+' + bonus + ')' + (f.note ? ' \u00b7 ' + f.note : '') + ((f.stage === 'await' ? p.hearts <= C.fight.weakHearts : f.weak) ? ' \u00b7 WEAK (needs +' + C.fight.cleanMarginWeak + ' for a clean kill)' : '');
    $('fzName').textContent = f.zname ? f.zname.toUpperCase() + ' (ZOMBIE)' : 'ZOMBIE';
    $('fzHp').textContent = (z ? z.hp : 0) + ' HP' + (f.attackerPid ? ' \u00b7 attacking!' : '');
    var key = f.seq + ':' + f.stage;
    if (key === lastFightStage) return;
    lastFightStage = key;
    var res = $('fRes'), pr = $('fPrompt');
    if (f.stage === 'await') {
      [$('fpDice'), $('fzDice')].forEach(function (cv) { var c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = '700 120px Fredoka'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('? ?', cv.width / 2, cv.height / 2); });
      $('fpTot').textContent = ''; $('fzTot').textContent = '';
      res.className = 'fresult'; res.innerHTML = '';
      pr.className = 'fprompt blink'; pr.innerHTML = esc(p.name) + ', ' + (tv ? 'press <b>ENTER</b> to roll!' : 'press <b>ROLL</b> on your phone!');
    } else if (f.stage === 'rolling') {
      pr.className = 'fprompt'; pr.textContent = '';
      if (stopF1) stopF1(); if (stopF2) stopF2();
      stopF1 = window.ZTDice.animate($('fpDice'), f.p, f.dice, C.timing.roll * game.speed);
      stopF2 = window.ZTDice.animate($('fzDice'), f.z, 'zombie', C.timing.roll * game.speed * 1.08);
    } else if (f.stage === 'result') {
      window.ZTDice.still($('fpDice'), f.p, f.dice); window.ZTDice.still($('fzDice'), f.z, 'zombie');
      $('fpTot').textContent = f.p[0] + '+' + f.p[1] + (f.bonus ? '+' + f.bonus : '') + ' = ' + f.ptotal;
      $('fzTot').textContent = f.z[0] + '+' + f.z[1] + ' = ' + f.ztotal;
      res.className = 'fresult ' + f.outcome;
      var sub = f.text.replace(f.title, '').trim();
      res.innerHTML = esc(p.hearts <= 0 ? 'LEFT FOR DEAD' : f.title) + '<small>Margin ' + (f.margin > 0 ? '+' : '') + f.margin + (sub ? ' \u00b7 ' + esc(sub) : '') + '</small>';
    }
  }

  // ------------------------------------------------------------ lobby
  var hsDice = 0;
  function renderLobby() {
    var ul = $('lobbyPlayers'); ul.innerHTML = '';
    for (var i = 0; i < C.maxPlayers; i++) {
      var p = game.players[i], li = document.createElement('li');
      if (!p) { li.className = 'empty'; li.textContent = 'Waiting for player ' + (i + 1) + '...'; ul.appendChild(li); continue; }
      li.style.setProperty('--c', p.color);
      li.innerHTML = '<span class="dot"></span><span>' + esc(p.name) + (i === 0 ? ' <span class="kind">(starts the game)</span>' : '') +
        '<br><span class="kind">' + (p.local ? 'Hot-seat (this screen)' : p.connected ? 'Phone' : 'Phone (reconnecting)') + ' \u00b7 ' + esc(window.ZTDice.style(p.dice).name) + ' dice</span></span>';
      var cv = document.createElement('canvas'); cv.width = 240; cv.height = 120; li.appendChild(cv);
      window.ZTDice.still(cv, [5, 6], p.dice);
      var rm = document.createElement('button'); rm.className = 'rm'; rm.innerHTML = '&times;'; rm.setAttribute('aria-label', 'Remove ' + p.name);
      rm.onclick = (function (id) { return function () { game.removePlayer(id); }; })(p.id);
      li.appendChild(rm);
      ul.appendChild(li);
    }
    $('pcount').textContent = game.players.length + '/' + C.maxPlayers;
    $('startBtn').disabled = !game.players.length;
    $('hsDice').textContent = 'Dice: ' + C.dice[hsDice].name;
    $('hsAdd').disabled = game.players.length >= C.maxPlayers;
  }
  $('hsDice').onclick = function () { hsDice = (hsDice + 1) % C.dice.length; dirty = true; };
  function addHotseat(name) {
    var p = game.addPlayer({ name: name || $('hsName').value || ('Player ' + (game.players.length + 1)), dice: C.dice[hsDice].id, local: true });
    $('hsName').value = ''; hsDice = (hsDice + 1) % C.dice.length;
    return p;
  }
  $('hsAdd').onclick = function () { addHotseat(); };
  $('hsName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.stopPropagation(); addHotseat(); } });
  $('startBtn').onclick = function () { startGame(); };
  $('againBtn').onclick = function () { startGame(); };
  $('lobbyBtn').onclick = function () { game.phase = 'lobby'; game.changed(); };
  function startGame() { if (!game.players.length) return; requestWake(); game.start(SEED); layout(); rnd.snap(game); }

  function renderResults() {
    var r = game.results || [];
    $('resTitle').textContent = r.some(function (x) { return x.escaped; }) ? 'THE CHOPPER LIFTS OFF!' : 'THE HORDE WINS...';
    $('resList').innerHTML = r.map(function (x) {
      return '<li class="' + (x.escaped ? 'esc' : '') + '" style="--c:' + x.color + '"><span class="pl' + (x.escaped ? '' : ' skull') + '">' + (x.escaped ? Ordinal(x.place) : '\u2620') + '</span>' + esc(x.name) + '<span class="lab">' + esc(x.label) + '</span></li>';
    }).join('');
  }

  // ------------------------------------------------------------ hot-seat input (keyboard + on-screen pad)
  function act(m) {
    var a = actor();
    if (game.phase === 'over' && m.t === 'exec') { startGame(); return; }
    if (!a || !tvControls(a)) return;
    if (m.t === 'roll' && (game.phase === 'plan' || game.phase === 'place')) return;
    game.intent(a.id, m);
  }
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key;
    if (k === 'm' || k === 'M') { muted = !muted; return; }
    if (game.phase === 'lobby') {
      if (k === 'Enter' && document.activeElement === document.body && game.players.length) { startGame(); e.preventDefault(); }
      return;
    }
    var map = { ArrowUp: { t: 'dir', d: 'U' }, ArrowDown: { t: 'dir', d: 'D' }, ArrowLeft: { t: 'dir', d: 'L' }, ArrowRight: { t: 'dir', d: 'R' },
      w: { t: 'dir', d: 'U' }, s: { t: 'dir', d: 'D' }, a: { t: 'dir', d: 'L' }, d: { t: 'dir', d: 'R' },
      Enter: { t: 'exec' }, ' ': { t: 'exec' }, r: { t: 'roll' }, Backspace: { t: 'undo' }, z: { t: 'undo' }, Escape: { t: 'clear' }, q: { t: 'rot', v: -1 }, e: { t: 'rot', v: 1 } };
    var m = map[k] || map[k.toLowerCase && k.toLowerCase()];
    if (!m) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && (k === 'Enter' || k === ' ')) return;  // let focused buttons click
    e.preventDefault();
    act(m);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#pad button'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-k');
      act(k === 'exec' ? { t: 'exec' } : k === 'roll' ? { t: game.phase === 'plan' ? 'exec' : 'roll' } : k === 'undo' ? { t: 'undo' } : { t: 'dir', d: k });
      b.blur();
    });
  });

  // ------------------------------------------------------------ networking
  var net = null, clients = {};     // clientId -> { pid, conn, seen, lastSent }
  function controllerUrl(code) {
    var base = location.protocol === 'file:' ? C.liveControllerUrl : new URL('controller.html', location.href.split('?')[0]).href;
    return base + '?room=' + code;
  }
  function drawQr(text) {
    var cv = $('qr'), ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = '#14121b';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
    } catch (e) { ctx.fillStyle = '#000'; ctx.fillText('QR unavailable', 20, 150); }
  }
  function setNetUi(status, code, detail) {
    var ns = $('netStatus');
    if (status === 'online') {
      var url = controllerUrl(code);
      $('code').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); drawQr(url);
      ns.className = 'netstatus ok'; ns.textContent = 'Room open. Phones can join now.';
      $('netBadge').textContent = '';
    } else if (status === 'offline') {
      ns.className = 'netstatus bad'; ns.textContent = 'Phone play unavailable (' + (detail || 'no connection') + '). Hot-seat still works. Retrying...';
      $('netBadge').textContent = game.phase !== 'lobby' ? 'Phones offline: ' + (detail || '') : '';
      if (net) setTimeout(function () { if (net.status === 'offline') { net.tries = 0; net.open(); } }, 8000);
    } else {
      ns.className = 'netstatus'; ns.textContent = status === 'reconnecting' ? 'Reconnecting to the room server...' : 'Connecting to the room server...';
      $('netBadge').textContent = game.phase !== 'lobby' && status === 'reconnecting' ? 'Room server reconnecting (phones already joined keep working)' : '';
    }
    dirty = true;
  }
  function onPhoneMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      var cid = String(m.clientId || conn.peer).slice(0, 40), c = clients[cid];
      var p = c ? game.byId(c.pid) : null;
      if (!p) {
        if (game.phase !== 'lobby' && game.phase !== 'over') { net.send(conn, { t: 'reject', reason: 'A game is already running. Join when it finishes!' }); return; }
        p = game.addPlayer({ name: m.name, dice: m.dice, local: false, clientId: cid });
        if (!p) { net.send(conn, { t: 'reject', reason: 'The room is full (' + C.maxPlayers + ' players).' }); return; }
      } else if (game.phase === 'lobby' || game.phase === 'over') {
        if (m.name) p.name = String(m.name).replace(/[^\w \-'!.?]/g, '').trim().slice(0, 12) || p.name;
        if (m.dice) game.intent(p.id, { t: 'dice', id: m.dice });
      }
      if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
      clients[cid] = { pid: p.id, conn: conn, seen: Date.now(), lastSent: '' };
      conn._cid = cid;
      p.connected = true;
      game.changed();
      net.send(conn, { t: 'welcome', pid: p.id, room: net.code });
      return;
    }
    var cl = clients[conn._cid];
    if (!cl || cl.conn !== conn) return;
    cl.seen = Date.now();
    var pl = game.byId(cl.pid);
    if (!pl) { net.send(conn, { t: 'reject', reason: 'You were removed from the room.' }); return; }
    if (!pl.connected) { pl.connected = true; dirty = true; }
    if (m.t === 'ping') { net.send(conn, { t: 'pong' }); return; }
    if (m.t === 'start' || m.t === 'again') {
      if (game.players[0] === pl && (game.phase === 'lobby' || game.phase === 'over')) startGame();
      return;
    }
    if (m.t === 'leave') { if (game.phase === 'lobby') { game.removePlayer(pl.id); delete clients[conn._cid]; } return; }
    game.intent(pl.id, m);
  }
  function onPhoneClose(conn) {
    var cl = clients[conn._cid];
    if (cl && cl.conn === conn) { var p = game.byId(cl.pid); if (p) { p.connected = false; game.changed(); } }
  }
  setInterval(function () {               // phones that went quiet (asleep) show as reconnecting; hot-seat keys can cover for them
    var now = Date.now(), ch = false;
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (p && p.connected && now - cl.seen > 15000) { p.connected = false; ch = true; }
    }
    if (ch) game.changed();
    phoneDirty = true;                   // heartbeat: resend state every few seconds
    for (var c2 in clients) clients[c2].lastSent = '';
  }, 3000);

  function phoneState(p) {
    var g = game, a = g.actorId(), cur = g.curP && g.phase !== 'lobby' ? g.curP() : null, f = g.fight;
    var mode = 'wait';
    if (g.phase === 'lobby') mode = 'lobby';
    else if (g.phase === 'over') mode = 'over';
    else if (p.status === 'dead') mode = 'dead';
    else if (p.status === 'escaped') mode = 'escaped';
    else if (p.status === 'spectator') mode = 'spectate';
    else if (a === p.id) mode = g.phase;                    // roll | plan | place | fight | zturn
    else if (f && f.pid === p.id) mode = 'fightview';
    else if (cur === p && (g.phase === 'rolling' || g.phase === 'exec' || g.phase === 'zmoving')) mode = g.phase;
    var st = {
      t: 'state', phase: g.phase, mode: mode, round: g.round || 1,
      you: { id: p.id, name: p.name, color: p.color, dice: p.dice, hearts: p.hearts, maxHearts: C.maxHearts, ammo: p.ammo, weapon: p.weapon,
        status: p.status, place: p.place, deadChoice: p.deadChoice, vip: g.players[0] === p },
      cur: cur ? { id: cur.id, name: cur.name, color: cur.color, zombie: cur.status === 'zombie' } : null,
      movesLeft: g.movesLeft || 0, planLen: g.plan ? g.plan.length : 0,
      roll: g.roll && g.roll.pid === p.id ? { seq: g.roll.seq, d: g.roll.d, total: g.roll.total, kind: g.roll.kind } : null,
      fight: f && f.pid === p.id ? { seq: f.seq, stage: f.stage, p: f.stage !== 'await' ? f.p : null, z: f.stage !== 'await' ? f.z : null, bonus: f.bonus, ptotal: f.ptotal, ztotal: f.ztotal,
        outcome: f.stage === 'result' ? f.outcome : null, text: f.stage === 'result' ? f.text : null, title: f.title || null, attacker: f.attackerPid ? (g.byId(f.attackerPid) || {}).name : null } : null,
      place: g.phase === 'place' && g.place ? { slots: g.place.slots.length, tile: window.ZT_TILES.byId[g.place.tpl].name } : null,
      msg: g.lastMsg || '',
      lobby: g.phase === 'lobby' ? g.players.map(function (q) { return { name: q.name, color: q.color, dice: q.dice, local: q.local }; }) : null,
      results: g.phase === 'over' ? g.results : null
    };
    return st;
  }
  function pushPhones() {
    if (!net) return;
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (!p || !cl.conn || !cl.conn.open) continue;
      var st = phoneState(p), js = JSON.stringify(st);
      if (js === cl.lastSent) continue;
      cl.lastSent = js;
      net.send(cl.conn, st);
    }
  }

  // ------------------------------------------------------------ misc
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && game.phase !== 'lobby') { wake = null; requestWake(); } });

  // boot
  if (location.protocol === 'file:') $('backLink').hidden = true;
  if (window.matchMedia && matchMedia('(max-width: 760px) and (pointer: coarse)').matches) $('phoneHint').hidden = false;
  layout();
  if (!NONET) net = new window.ZTNet.Host({ code: Q.get('room') ? Q.get('room').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : null, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else setNetUi('offline', null, 'phones disabled with ?nonet');
  var hs = +Q.get('hotseat');
  if (hs > 0) { var names = ['Maya', 'Leo', 'Ava', 'Sam']; for (var i = 0; i < Math.min(hs, 4); i++) { hsDice = i; addHotseat(names[i]); } }
  if (Q.has('autostart') && game.players.length) startGame();
  window.ZT.startGame = startGame; window.ZT.addHotseat = addHotseat; window.ZT.net = function () { return net; };
  requestAnimationFrame(loop);
})();
