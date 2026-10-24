/* Phone: pick a game, play the computer, a friend at the table (private phone room), or Connect Four on the café TV. */
(function () {
  var $ = function (id) { return document.getElementById(id); }, q = new URLSearchParams(location.search), local = q.get('local') === '1';
  var BS = CafeGames.BS, C4 = CafeGames.C4, room = (q.get('room') || '').toUpperCase(), cfg = Cafe.defaults(), cafe = null, cafeOn = false;
  var me = localStorage.getItem('ztpcafe:nick') || '', game = null, tnet = null, tconn = null, tHost = false;
  try { var cached = JSON.parse(localStorage.getItem('ztpcafe:cfg:' + room)); if (cached) cfg = Cafe.merge(cached); } catch (e) {}
  if (!room) cfg.games = { battleship: true, connect4: true };
  function view(id) { document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('on', v.id === id); }); scrollTo(0, 0); }
  function theme() {
    Cafe.applyTheme(cfg); $('cname').textContent = room ? cfg.name : 'Caf\u00e9 games';
    if (cfg.logo) { $('logo').src = cfg.logo; $('logo').classList.remove('hide'); }
    document.querySelector('meta[name=theme-color]').content = cfg.accent;
    $('glist').innerHTML = Cafe.GAMES.filter(function (g) { return !g.ready || cfg.games[g.id]; }).map(function (g) {
      return '<button class="gcard' + (g.ready ? '' : ' soon') + '" data-g="' + g.id + '"' + (g.ready ? '' : ' disabled') + '><span class="i">' + g.icon + '</span><span><b>' + g.name + '</b><small>' + (g.ready ? g.blurb : 'Coming soon') + '</small></span></button>';
    }).join('');
    $('glist').querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { modes(b.dataset.g); }; });
    $('hi').textContent = me ? 'Hi ' + me + '! Pick a game' : 'Pick a game';
  }
  $('learn').href = Cafe.LEARN;

  // ------------------------------------------------ café screen connection
  function connectCafe() {
    if (!room) return;
    var o = { code: room,
      onStatus: function (s) { cafeOn = s === 'online'; $('dot').classList.toggle('on', cafeOn); },
      onOpen: function () { cafe.send({ t: 'hello', name: me || 'Guest' }); },
      onMessage: onCafe };
    cafe = local ? new LRNet.LocalClient(o) : new LRNet.Client(o);
  }
  function onCafe(m) {
    if (m.t === 'cfg') { var keepRoom = cfg.room; cfg = Cafe.merge(m.cfg); try { localStorage.setItem('ztpcafe:cfg:' + room, JSON.stringify(cfg)); } catch (e) {} theme(); if (!game) { /* refresh mode list if open */ } }
    else if (m.t === 'c4' && game && game.kind === 'tv') tvState(m);
    else if (m.t === 'c4end' && game && game.kind === 'tv') { game = null; view('vHome'); }
    else if (m.t === 'busy') { $('c4stat').textContent = m.msg; }
    else if (m.t === 'reward') showReward(m.text);
  }
  function post(gid, win, moves) { if (cafe && cafeOn && cfg.leaderboards !== false) cafe.send({ t: 'score', game: gid, name: me || 'Guest', win: win, moves: moves }); }

  // ------------------------------------------------ name, modes
  $('nickGo').onclick = function () { me = ($('nick').value.trim() || 'Guest').slice(0, 14); localStorage.setItem('ztpcafe:nick', me); if (cafe) cafe.send({ t: 'hello', name: me }); theme(); route(); };
  function modes(gid) {
    var g = Cafe.GAMES.find(function (x) { return x.id === gid; }); $('mTitle').textContent = g.icon + ' ' + g.name;
    var b = [];
    if (gid === 'connect4' && room) b.push(['tv', '\uD83D\uDCFA On the big TV' + (cafeOn ? '' : ' (connecting\u2026)'), 'alt']);
    b.push(['cpu', '\uD83E\uDD16 Play the computer', '']);
    b.push(['host', '\uD83D\uDC6B Start a game with a friend at my table', 'ghost']);
    b.push(['join', '\uD83D\uDD11 Join a friend\u2019s game', 'ghost']);
    $('modes').innerHTML = b.map(function (x) { return '<button class="' + x[2] + '" data-m="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    $('modes').querySelectorAll('[data-m]').forEach(function (x) { x.onclick = function () { startMode(gid, x.dataset.m); }; });
    view('vMode');
  }
  document.querySelectorAll('[data-back]').forEach(function (b) { b.onclick = function () { closeTable(); view('vHome'); }; });
  document.querySelectorAll('[data-quit]').forEach(function (b) { b.onclick = quit; });
  function quit() { if (game && game.kind === 'tv' && cafe) cafe.send({ t: 'c4leave' }); if (game && game.kind === 'table') tsend({ t: 'bye' }); closeTable(); game = null; view('vHome'); }
  function startMode(gid, m) {
    if (m === 'cpu') return gid === 'battleship' ? bsStart('cpu') : c4Start('cpu');
    if (m === 'tv') { game = { id: 'connect4', kind: 'tv' }; view('vC4'); $('c4stat').textContent = 'Connecting to the TV\u2026'; $('c4b').innerHTML = ''; $('c4cols').innerHTML = ''; $('c4who').textContent = ''; cafe.send({ t: 'c4join' }); return; }
    tableOpen(gid, m === 'host');
  }

  // ------------------------------------------------ table room (phone to phone)
  function closeTable() { if (tnet) { try { if (tnet.destroy) tnet.destroy(); else if (tnet.peer) tnet.peer.destroy(); } catch (e) {} } tnet = null; tconn = null; }
  function tsend(m) { if (tHost) { if (tconn) tnet.send(tconn, m); } else if (tnet) tnet.send(m); }
  function tableOpen(gid, host, code) {
    closeTable(); tHost = host; view('vTable'); $('tHost').classList.toggle('hide', !host); $('tJoin').classList.toggle('hide', host);
    if (host) {
      var o = { prefix: Cafe.TABLE_PREFIX, onStatus: function (s, c) { $('tCode').textContent = c; $('tQr').innerHTML = Cafe.qrSvg(Cafe.base() + 'play.html?table=' + c + '&g=' + gid + (room ? '&room=' + room : '') + (local ? '&local=1' : ''), 5); },
        onJoin: function (c) { if (tconn && tconn.open) return tnet.send(c, { t: 'full' }); tconn = c; },
        onMessage: function (c, m) { if (!tconn || !tconn.open) tconn = c; if (c === tconn) onTable(m); else tnet.send(c, { t: 'full' }); }, onClose: function (c) { if (c === tconn) { tconn = null; if (game) $(game.id === 'battleship' ? 'bsStat' : 'c4stat').textContent = 'Your friend left the table.'; } } };
      tnet = local ? new LRNet.LocalHost(o) : new LRNet.Host(o); game = { id: gid, kind: 'table', host: true };
    } else {
      $('tIn').value = code || ''; $('tJStat').textContent = '';
      $('tGo').onclick = function () { var c = $('tIn').value.trim().toUpperCase(); if (c.length !== 4) return; $('tJStat').textContent = 'Joining\u2026';
        var o = { code: c, prefix: Cafe.TABLE_PREFIX, onStatus: function (s) { if (s === 'noroom') $('tJStat').textContent = 'Can\u2019t find that code yet, still trying\u2026'; },
          onOpen: function () { tsend({ t: 'hi', name: me || 'Guest', g: gid }); }, onMessage: onTable };
        tnet = local ? new LRNet.LocalClient(o) : new LRNet.Client(o); game = { id: gid, kind: 'table', host: false }; };
      if (code) $('tGo').onclick();
    }
  }
  function onTable(m) {
    if (m.t === 'ping') return;
    if (m.t === 'hi') { game.id = m.g || game.id; game.foe = m.name; tsend({ t: 'hi2', name: me || 'Guest', g: game.id }); go(); }
    else if (m.t === 'hi2') { game.id = m.g; game.foe = m.name; go(); }
    else if (m.t === 'full') $('tJStat').textContent = 'That table game is already full.';
    else if (m.t === 'bye') { $(game.id === 'battleship' ? 'bsStat' : 'c4stat').textContent = (game.foe || 'Your friend') + ' left the game.'; }
    else if (game && game.onMsg) game.onMsg(m);
    function go() { var foe = game.foe; if (game.id === 'battleship') bsStart('table', foe); else c4Start('table', foe); }
  }

  // ------------------------------------------------ Battleship
  var bs;
  function bsStart(kind, foe) {
    var keep = game && game.kind === 'table' ? game : null;
    bs = { kind: kind, mine: BS.place(), foe: null, ai: null, shots: 0, turn: false, ready: false, foeReady: false, over: false, view: {} };
    game = keep ? Object.assign(keep, { id: 'battleship' }) : { id: 'battleship', kind: 'cpu' };
    game.onMsg = bsMsg; game.foe = foe || game.foe;
    $('bsWho').textContent = kind === 'cpu' ? 'Computer\u2019s waters' : (game.foe || 'Friend') + '\u2019s waters';
    $('bsShuffle').classList.remove('hide'); $('bsReady').classList.remove('hide');
    $('bsStat').textContent = 'Shuffle until you like your fleet, then tap Ready!';
    bsDraw(); view('vBS');
  }
  $('bsShuffle').onclick = function () { if (!bs.ready) { bs.mine = BS.place(); bsDraw(); } };
  $('bsReady').onclick = function () {
    bs.ready = true; $('bsShuffle').classList.add('hide'); $('bsReady').classList.add('hide');
    if (bs.kind === 'cpu') { bs.foe = BS.place(); bs.ai = new BS.AI(); bs.turn = true; bsStat(); }
    else { tsend({ t: 'bsready' }); bsTurnCheck(); }
    bsDraw();
  };
  function bsTurnCheck() { if (bs.ready && bs.foeReady) { bs.turn = !!game.host; bsStat(); } else $('bsStat').textContent = 'Waiting for ' + (game.foe || 'your friend') + ' to get ready\u2026'; }
  function bsStat() { if (!bs.over) $('bsStat').textContent = bs.turn ? 'Your turn: tap their waters to fire' : (bs.kind === 'cpu' ? 'Computer is aiming\u2026' : (game.foe || 'Friend') + ' is aiming\u2026'); }
  function bsDraw(newE, newM) {
    var N = BS.N, e = '', f = '';
    for (var c = 0; c < N * N; c++) {
      var v = bs.view[c] || ''; e += '<div data-c="' + c + '" class="' + v + (c === newE ? ' new' : '') + '"></div>';
      var s = bs.mine.shots[c] || '', ship = bs.mine.grid[c] >= 0; f += '<div class="' + (ship ? 'ship ' : '') + s + (c === newM ? ' new' : '') + '"></div>';
    }
    $('bsEnemy').innerHTML = e; $('bsFleet').innerHTML = f;
    $('bsEnemy').classList.toggle('mine', !bs.turn || bs.over);
    var sunk = Object.keys(bs.view).filter(function (k) { return bs.view[k] === 's'; }).length, left = BS.FLEET.length;
    var sunkShips = 0, seen = {}; // count ships sunk from view length is fuzzy; track explicitly
    $('bsCount').textContent = (bs.sunk || 0) + '/' + left + ' sunk \u00b7 ' + bs.shots + ' shots';
    $('bsMine').textContent = bs.mine.ships.filter(function (s) { return s.hits < s.s; }).length + ' afloat';
  }
  $('bsEnemy').addEventListener('click', function (ev) {
    var d = ev.target.closest('[data-c]'); if (!d || !bs || !bs.turn || bs.over) return; var c = +d.dataset.c; if (bs.view[c]) return;
    bs.turn = false; bs.shots++;
    if (bs.kind === 'cpu') { bsResult(c, BS.fire(bs.foe, c)); }
    else { tsend({ t: 'shot', c: c }); $('bsStat').textContent = 'Fire!'; }
  });
  function bsResult(c, r) {
    if (r.r === 'miss') bs.view[c] = 'm'; else if (r.r === 'hit') bs.view[c] = 'h'; else { r.cells.forEach(function (x) { bs.view[x] = 's'; }); bs.sunk = (bs.sunk || 0) + 1; }
    buzz(r.r === 'miss' ? 10 : 40);
    $('bsStat').textContent = r.r === 'miss' ? 'Splash, a miss.' : r.r === 'hit' ? 'Hit! \uD83D\uDCA5' : 'You sank their ' + r.ship + '!';
    bsDraw(c);
    if (r.over) return bsEnd(true);
    if (bs.kind === 'cpu') setTimeout(bsCpu, 750);
  }
  function bsCpu() {
    if (bs.over) return; var c = bs.ai.pick(), r = BS.fire(bs.mine, c); bs.ai.learn(c, r);
    bsDraw(null, c); if (r.over) return bsEnd(false);
    bs.turn = true; setTimeout(function () { if (!bs.over) { $('bsStat').textContent = (r.r === 'miss' ? 'They missed. ' : r.r === 'sunk' ? 'They sank your ' + r.ship + '! ' : 'They hit you! ') + 'Your turn.'; } }, 10);
    $('bsEnemy').classList.remove('mine');
  }
  function bsMsg(m) {
    if (m.t === 'bsready') { bs.foeReady = true; bsTurnCheck(); bsDraw(); }
    else if (m.t === 'shot') { var r = BS.fire(bs.mine, m.c); tsend({ t: 'res', c: m.c, r: r }); bsDraw(null, m.c); if (r.over) return bsEnd(false); bs.turn = true; $('bsStat').textContent = (r.r === 'miss' ? 'They missed. ' : 'They hit you! ') + 'Your turn.'; $('bsEnemy').classList.remove('mine'); }
    else if (m.t === 'res') bsResult(m.c, m.r);
    else if (m.t === 'again') { if (!bs.over) return; $('ovEnd').classList.add('hide'); bsStart('table'); }
  }
  function bsEnd(won) { bs.over = true; bsDraw(); post('battleship', won, bs.shots); end(won, won ? 'Fleet sunk in ' + bs.shots + ' shots!' : 'Your fleet went down. So close!', function () { if (bs.kind === 'table') tsend({ t: 'again' }); bsStart(bs.kind); }); }

  // ------------------------------------------------ Connect Four (phone: cpu + table; tv mirrors the screen)
  var c4;
  function c4Start(kind, foe) {
    var keep = game && game.kind === 'table' ? game : null;
    game = keep ? Object.assign(keep, { id: 'connect4' }) : { id: 'connect4', kind: 'cpu' }; game.onMsg = c4Msg; game.foe = foe || game.foe;
    c4 = { kind: kind, b: C4.make(), turn: 1, me: kind === 'table' && !game.host ? 2 : 1, win: null, moves: 0 };
    $('c4wait').classList.add('hide');
    c4Draw(); view('vC4');
  }
  function c4Draw(last, names) {
    var b = c4.b, h = '', ws = {}; if (c4.win && c4.win.cells) c4.win.cells.forEach(function (c) { ws[c[0] + ',' + c[1]] = 1; });
    for (var r = C4.H - 1; r >= 0; r--) for (var c = 0; c < C4.W; c++) { var v = C4.at(b, c, r); h += '<div class="' + (v ? 'p' + v : '') + (last && last[0] === c && last[1] === r ? ' new' : '') + (ws[c + ',' + r] ? ' win' : '') + '"></div>'; }
    $('c4b').innerHTML = h;
    var my = c4.turn === c4.me && !c4.win, col = c4.me === 1 ? '#e0533d' : '#f4c430', cs = '';
    for (c = 0; c < C4.W; c++) cs += '<button data-col="' + c + '" style="background:' + col + '"' + (my && C4.canDrop(b, c) ? '' : ' disabled') + '>\u25BC</button>';
    $('c4cols').innerHTML = cs;
    var foe = names ? names[2 - c4.me] : c4.kind === 'cpu' ? 'Computer' : (game.foe || 'Friend');
    $('c4who').innerHTML = '<span><i class="chip" style="background:' + col + '"></i>You</span><span>' + Cafe.esc(foe) + '<i class="chip" style="background:' + (c4.me === 1 ? '#f4c430' : '#e0533d') + ';margin:0 0 0 4px"></i></span>';
    $('c4stat').textContent = c4.win ? '' : my ? 'Your turn: tap a column' : foe + ' is thinking\u2026';
  }
  $('c4cols').addEventListener('click', function (e) {
    var b = e.target.closest('[data-col]'); if (!b || b.disabled) return; var col = +b.dataset.col;
    if (c4.kind === 'tv') { cafe.send({ t: 'c4move', col: col }); $('c4cols').querySelectorAll('button').forEach(function (x) { x.disabled = true; }); buzz(15); return; }
    c4Play(col, c4.me); if (c4.kind === 'table') tsend({ t: 'drop', col: col });
  });
  function c4Play(col, p) {
    var r = C4.drop(c4.b, col, p); if (r < 0) return; buzz(15); c4.moves++; c4.win = C4.winner(c4.b); c4.turn = 3 - p; c4Draw([col, r]);
    if (c4.win) { var won = c4.win.p === c4.me; setTimeout(function () { post('connect4', won, Math.ceil(c4.moves / 2)); end(won, c4.win.draw ? 'A draw!' : won ? 'Four in a row in ' + Math.ceil(c4.moves / 2) + ' moves!' : 'They got four in a row.', function () { if (c4.kind === 'table') tsend({ t: 'again' }); c4Start(c4.kind); }, c4.win.draw); }, 900); return; }
    if (c4.kind === 'cpu' && c4.turn !== c4.me) setTimeout(function () { c4Play(C4.ai(c4.b, c4.turn, 2), c4.turn); }, 550);
  }
  function c4Msg(m) { if (m.t === 'drop') c4Play(m.col, 3 - c4.me); else if (m.t === 'again' && c4.win) { $('ovEnd').classList.add('hide'); c4Start('table'); } }
  function tvState(m) {
    if (!c4 || c4.kind !== 'tv') { c4 = { kind: 'tv' }; }
    c4.b = m.board || C4.make(); c4.turn = m.turn; c4.me = m.you; c4.win = m.win;
    view('vC4'); c4Draw(null, m.names);
    $('c4wait').classList.toggle('hide', !m.waiting);
    if (m.waiting) $('c4stat').textContent = 'You\u2019re on the TV! Waiting for a second player to scan in\u2026';
    if (m.win) { var won = m.win.p === m.you; $('c4stat').textContent = m.win.draw ? 'A draw!' : won ? 'You win! \uD83C\uDF89 Look at the TV' : 'They got four in a row!'; }
  }
  $('c4cpu').onclick = function () { cafe.send({ t: 'c4cpu' }); };

  // ------------------------------------------------ end, rewards, feedback
  var againFn;
  function end(won, s, again, draw) {
    $('endIcon').textContent = draw ? '\uD83E\uDD1D' : won ? '\uD83C\uDFC6' : '\u2615'; $('endT').textContent = draw ? 'Draw' : won ? 'You won!' : 'Good game!'; $('endS').textContent = s + (cafeOn && cfg.leaderboards !== false ? ' Score sent to the caf\u00e9 board.' : '');
    againFn = again; $('ovEnd').classList.remove('hide');
    if (won) setTimeout(maybeReward, 700);
  }
  $('again').onclick = function () { $('ovEnd').classList.add('hide'); againFn && againFn(); };
  $('endHome').onclick = function () { $('ovEnd').classList.add('hide'); quit(); };
  function maybeReward() {
    var pr = Cafe.activePromos(cfg), last = +localStorage.getItem('ztpcafe:lastReward') || 0;
    if (!room || !cfg.promoRewards || !pr.length || Date.now() - last < 15 * 60000 || Math.random() > (q.get('reward') ? 1 : 0.35)) return;
    showReward(pr[Math.floor(Math.random() * pr.length)].text);
  }
  function showReward(t) {
    localStorage.setItem('ztpcafe:lastReward', Date.now());
    $('rwText').textContent = t; $('rwMeta').textContent = cfg.name + ' \u00b7 ' + (me || 'Guest') + ' \u00b7 ' + new Date().toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' \u00b7 #' + Math.random().toString(36).slice(2, 6).toUpperCase();
    $('ovReward').classList.remove('hide'); buzz([60, 40, 60]);
  }
  $('rwOk').onclick = function () { $('ovReward').classList.add('hide'); };
  $('help').onclick = function () { $('fbMsg').textContent = ''; $('ovHelp').classList.remove('hide'); };
  $('fbClose').onclick = function () { $('ovHelp').classList.add('hide'); };
  function mailto() { return 'mailto:' + Cafe.EMAIL + '?subject=' + encodeURIComponent('Caf\u00e9 games feedback (' + cfg.name + ')') + '&body=' + encodeURIComponent($('fb').value); }
  $('fb').oninput = function () { $('fbMail').href = mailto(); };
  $('fbMail').href = mailto();
  $('fbSend').onclick = function () { var t = $('fb').value.trim(); if (!t) return; Cafe.store.addFeedback({ text: t, cafe: cfg.name, name: me, at: Date.now() }).then(function () { $('fbMsg').innerHTML = 'Saved, thank you! To make sure Justin sees it, <a href="' + mailto() + '">email it too</a>.'; }); };
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  function route() {
    theme();
    if (!me) return view('vName');
    var t = q.get('table');
    if (t && !route.done) { route.done = 1; return tableOpen(q.get('g') || 'battleship', false, t.toUpperCase()); }
    view('vHome');
  }
  connectCafe(); route();
  window.CAFE_PHONE = { get bs() { return bs; }, get c4() { return c4; }, get game() { return game; }, modes: modes, startMode: startMode };
})();
