/* Café TV screen: menu track around the border with idle pawns, rotating centre panels, phone hub, Connect Four on the TV. */
(function () {
  var $ = function (id) { return document.getElementById(id); }, q = new URLSearchParams(location.search), local = q.get('local') === '1';
  var cfg, scores = [], net, tiles = [], pawns = [], C4 = CafeGames.C4, phones = {};
  var FACE = '<circle cx="15" cy="20" r="2.2" fill="#3b2a20"/><circle cx="25" cy="20" r="2.2" fill="#3b2a20"/><path d="M16 25q4 3.5 8 0" stroke="#3b2a20" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12" cy="24" r="1.8" fill="#f59a8a" opacity=".7"/><circle cx="28" cy="24" r="1.8" fill="#f59a8a" opacity=".7"/>';
  var CHARS = [
    '<svg viewBox="0 0 40 40"><path d="M7 12h24l-2.5 22a3 3 0 0 1-3 2.6h-13a3 3 0 0 1-3-2.6z" fill="#fff" stroke="#c9b49a" stroke-width="1.5"/><rect x="5" y="9" width="28" height="5" rx="2.5" fill="var(--accent)"/><path d="M31 17h3a4 4 0 0 1 0 8h-3.6" stroke="#c9b49a" stroke-width="2.4" fill="none"/>' + FACE + '</svg>',
    '<svg viewBox="0 0 40 40"><ellipse cx="20" cy="22" rx="13" ry="15" fill="#7a4a2a"/><path d="M20 8q-5 14 0 28" stroke="#4f2c16" stroke-width="2" fill="none"/>' + FACE.replace(/#3b2a20/g, '#fff') + '</svg>',
    '<svg viewBox="0 0 40 40"><path d="M3 28q4-16 17-17t17 17q-5 4-9 1-4 4-8 3-4 1-8-3-4 3-9-1z" fill="#e9a94f" stroke="#b9772a" stroke-width="1.5"/><path d="M13 13l3 16M27 13l-3 16M20 11v19" stroke="#c98a3a" stroke-width="1.4"/>' + FACE + '</svg>',
    '<svg viewBox="0 0 40 40"><path d="M8 36h24l-3-22H11z" fill="var(--accent2)"/><ellipse cx="20" cy="14" rx="9" ry="3" fill="#fff"/><path d="M20 12q2-6 7-7" stroke="#e0533d" stroke-width="2.6" fill="none" stroke-linecap="round"/>' + FACE + '</svg>'
  ];

  // ------------------------------------------------ border track
  function layout() {
    var st = $('stage'); st.querySelectorAll('.tile,.pawn').forEach(function (e) { e.remove(); }); tiles = [];
    var items = cfg.menu.slice(), sets = [[7, 3], [8, 4], [10, 5], [12, 6]], pick = sets[3];
    for (var i = 0; i < sets.length; i++) if (2 * sets[i][0] + 2 * sets[i][1] >= items.length + 1) { pick = sets[i]; break; }
    var T = pick[0], S = pick[1], n = 2 * T + 2 * S, fillers = ['\u2615 Sip', '\u2764 Rest', '\u2B50 Bonus'];
    var list = [{ name: 'START', start: true }].concat(items);
    while (list.length < n) list.push(list.length % 6 === 0 ? { name: 'Golden Bean' } : { name: fillers[list.length % 3] });
    list = list.slice(0, n);
    var W = innerWidth, H = innerHeight, m = H * 0.015, gap = H * 0.008;
    var tw = (W - 2 * m - (T - 1) * gap) / T, th = (H - 2 * m - (S + 1) * gap) / (S + 2), tw2 = Math.min(tw, W * 0.12);
    var cats = {}, pal = ['#2f6f5e', '#c8682f', '#7b5ea7', '#3a7bbf', '#c4486a', '#6a8f2f'];
    var pos = [];
    for (i = 0; i < T; i++) pos.push([m + i * (tw + gap), m, tw, th]);
    for (i = 0; i < S; i++) pos.push([W - m - tw2, m + (i + 1) * (th + gap), tw2, th]);
    for (i = T - 1; i >= 0; i--) pos.push([m + i * (tw + gap), H - m - th, tw, th]);
    for (i = S - 1; i >= 0; i--) pos.push([m, m + (i + 1) * (th + gap), tw2, th]);
    list.forEach(function (it, k) {
      var p = pos[k], d = document.createElement('div'), gold = /golden bean/i.test(it.name);
      d.className = 'tile' + (gold ? ' gold' : '') + (it.start ? ' start' : '');
      if (it.cat && !(it.cat in cats)) cats[it.cat] = pal[Object.keys(cats).length % pal.length];
      if (it.cat && !gold) d.style.setProperty('--c', cats[it.cat]);
      d.style.cssText += ';left:' + p[0] + 'px;top:' + p[1] + 'px;width:' + p[2] + 'px;height:' + p[3] + 'px';
      d.innerHTML = (it.cat && !gold ? '<i class="k"></i>' : '') + (gold ? '<div style="font-size:3vh">\uD83E\uDED8\u2728</div>' : '') + '<div class="n">' + Cafe.esc(it.name) + '</div>' + (it.price ? '<div class="p">$' + Cafe.esc(it.price) + '</div>' : '');
      st.appendChild(d); tiles.push({ el: d, x: p[0] + p[2] / 2, y: p[1] + p[3] / 2, gold: gold });
    });
    var c = $('center'); c.style.left = (m + tw2 + gap * 3) + 'px'; c.style.right = (m + tw2 + gap * 3) + 'px'; c.style.top = (m + th + gap * 3) + 'px'; c.style.bottom = (m + th + gap * 3) + 'px';
    pawns = CHARS.map(function (svg, k) { var e = document.createElement('div'); e.className = 'pawn'; e.innerHTML = '<i>' + svg + '</i>'; st.appendChild(e); var pw = { el: e, at: (k * 5) % tiles.length }; place(pw); return pw; });
    var cr = $('corner'); cr.style.right = (m + tw2 + gap * 3) + 'px'; cr.style.bottom = (m + th + gap * 3) + 'px';
  }
  function place(p) { var t = tiles[p.at]; p.el.style.left = t.x + (pawns.indexOf(p) - 1.5) * 8 + 'px'; p.el.style.top = t.y + 'px'; }
  function stepPawn(p, left) {
    if (!left) { var t = tiles[p.at]; t.el.classList.add('hit'); setTimeout(function () { t.el.classList.remove('hit'); }, 300); if (t.gold) goldBean(); return; }
    p.at = (p.at + 1) % tiles.length; p.el.classList.remove('hop'); void p.el.offsetWidth; p.el.classList.add('hop'); place(p);
    setTimeout(function () { stepPawn(p, left - 1); }, 600);
  }
  var lastGold = 0;
  function goldBean() { if (Date.now() - lastGold < 20000) return; lastGold = Date.now(); var pr = Cafe.activePromos(cfg); toast('\u2728 Golden Bean! ' + (pr.length ? pr[Math.floor(Math.random() * pr.length)].text + ' for winners today' : 'Lucky landing!')); }
  var turnI = 0;
  function idleTurn() {     // one pawn at a time rolls a die and hops along
    if (!pawns.length) return; var p = pawns[turnI++ % pawns.length]; stepPawn(p, 1 + Math.floor(Math.random() * 6));
  }

  // ------------------------------------------------ centre panels
  var panels = [], pi = 0, paused = false;
  function buildPanels() {
    $('cName').textContent = cfg.name; document.title = cfg.name + ' \u00b7 Caf\u00e9 games';
    if (cfg.logo) { $('logo').src = cfg.logo; $('logo').classList.remove('hide'); }
    var g = Cafe.GAMES.filter(function (x) { return x.ready && cfg.games[x.id]; }).concat(Cafe.GAMES.filter(function (x) { return !x.ready; }));
    $('glist').innerHTML = g.map(function (x) { return '<div class="g' + (x.ready ? '' : ' soon') + '"><div class="i">' + x.icon + '</div><b>' + x.name + '</b><span>' + (x.ready ? x.blurb : 'Coming soon') + '</span></div>'; }).join('');
    panels = [{ id: 'pWelcome', t: 14000 }];
    cfg.specials.forEach(function (s) { panels.push({ id: 'pSpecial', t: 8000, s: s }); panels.push({ id: 'pWelcome', t: 9000 }); });
    if (cfg.leaderboards) panels.push({ id: 'pBoard', t: 11000 });
    panels.push({ id: 'pGames', t: 10000 });
    if (cfg.promoRewards && Cafe.activePromos(cfg).length) panels.push({ id: 'pPromo', t: 8000 });
  }
  function renderBoards() {
    var games = Cafe.GAMES.filter(function (x) { return x.ready && cfg.games[x.id]; });
    $('lbs').innerHTML = games.map(function (g) {
      var b = Cafe.board(scores, g.id);
      return '<div class="lb"><h3>' + g.icon + ' ' + g.name + '</h3>' + (b.length ? '<ol>' + b.map(function (p) { return '<li>' + Cafe.esc(p.name) + ' \u00b7 ' + p.wins + ' win' + (p.wins === 1 ? '' : 's') + (p.best ? ' <span class="e">(best ' + p.best + (g.id === 'battleship' ? ' shots' : ' moves') + ')</span>' : '') + '</li>'; }).join('') + '</ol>' : '<div class="e">Nobody yet. Be the first!</div>') + '</div>';
    }).join('');
  }
  function show(i) {
    var p = panels[i % panels.length]; document.querySelectorAll('.panel').forEach(function (e) { e.classList.remove('on'); });
    if (p.id === 'pSpecial') $('spText').textContent = p.s;
    if (p.id === 'pPromo') { var pr = Cafe.activePromos(cfg); $('prText').textContent = pr[Math.floor(Math.random() * pr.length)].text; }
    if (p.id === 'pBoard') renderBoards();
    $(p.id).classList.add('on'); return p.t;
  }
  function rotate() { if (paused) return setTimeout(rotate, 1000); var t = show(pi++); setTimeout(rotate, q.get('fast') ? 2500 : t); }
  var tt; function toast(s) { var e = $('toast'); e.textContent = s; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { e.classList.remove('on'); }, 5000); }

  // ------------------------------------------------ Connect Four on the TV
  var g4 = null;
  function c4Start() {
    paused = true; document.querySelectorAll('.panel').forEach(function (e) { e.classList.remove('on'); }); $('c4').classList.add('on');
    g4.board = C4.make(); g4.turn = 1; g4.win = null; g4.moves = 0; c4Render(); c4Send();
    if (g4.seats[1] === 'cpu' && g4.turn === 2) setTimeout(c4Cpu, 700);
  }
  function seatName(i) { var s = g4.seats[i]; return s === 'cpu' ? 'The TV \uD83D\uDCFA' : s ? s.name : 'waiting\u2026'; }
  function c4Render(last) {
    $('c4top').innerHTML = [1, 2].map(function (p) { return '<span class="' + (g4.turn === p && !g4.win && g4.board ? 'turn' : '') + '"><i class="chip" style="background:' + (p === 1 ? '#e0533d' : '#f4c430') + '"></i>' + Cafe.esc(seatName(p - 1)) + '</span>'; }).join('<span>vs</span>');
    var h = '', winSet = {}; if (g4.win && g4.win.cells) g4.win.cells.forEach(function (c) { winSet[c[0] + ',' + c[1]] = 1; });
    for (var r = C4.H - 1; r >= 0; r--) for (var c = 0; c < C4.W; c++) { var v = g4.board ? C4.at(g4.board, c, r) : 0; h += '<div class="' + (v ? 'p' + v : '') + (last && last[0] === c && last[1] === r ? ' new' : '') + (winSet[c + ',' + r] ? ' win' : '') + '"></div>'; }
    $('c4b').innerHTML = h;
    $('c4msg').textContent = !g4.board ? 'Waiting for a second player\u2026 scan and pick Connect Four!' : g4.win ? (g4.win.draw ? "It's a draw!" : seatName(g4.win.p - 1) + ' wins! \uD83C\uDF89') : seatName(g4.turn - 1) + ', your move';
  }
  function c4Send() {
    g4.seats.forEach(function (s, i) { if (s && s !== 'cpu') net.send(s.conn, { t: 'c4', board: g4.board, turn: g4.turn, you: i + 1, win: g4.win, names: [seatName(0), seatName(1)], waiting: !g4.board }); });
  }
  function c4Move(p, col) {
    if (!g4 || !g4.board || g4.win || g4.turn !== p) return; var r = C4.drop(g4.board, col, p); if (r < 0) return;
    g4.moves++; g4.win = C4.winner(g4.board); g4.turn = 3 - p; c4Render([col, r]); c4Send();
    if (g4.win) return c4End();
    if (g4.seats[g4.turn - 1] === 'cpu') setTimeout(c4Cpu, 650);
  }
  function c4Cpu() { if (g4 && !g4.win) c4Move(g4.turn, C4.ai(g4.board, g4.turn, 2)); }
  function c4End() {
    var w = g4.win; g4.seats.forEach(function (s, i) {
      if (!s || s === 'cpu') return; var won = w.p === i + 1;
      addScore({ game: 'connect4', name: s.name, win: won, moves: Math.ceil(g4.moves / 2) });
      if (won) maybeReward(s.conn);
    });
    setTimeout(c4Close, 9000);
  }
  function c4Close() { if (!g4) return; g4.seats.forEach(function (s) { if (s && s !== 'cpu') net.send(s.conn, { t: 'c4end' }); }); g4 = null; $('c4').classList.remove('on'); paused = false; }
  function c4Join(conn, name, vsTv) {
    if (g4 && g4.board && !g4.win) return net.send(conn, { t: 'busy', msg: 'A game is on the TV right now. Play on your phone, you\u2019re up next!' });
    if (g4 && g4.win) c4Close();
    if (!g4) { g4 = { seats: [{ conn: conn, name: name }, null] }; clearTimeout(g4.wait); }
    else if (g4.seats[0].conn === conn) {} else g4.seats[1] = { conn: conn, name: name };
    if (vsTv && !g4.seats[1]) g4.seats[1] = 'cpu';
    paused = true; document.querySelectorAll('.panel').forEach(function (e) { e.classList.remove('on'); }); $('c4').classList.add('on');
    if (g4.seats[1]) c4Start(); else { c4Render(); c4Send(); toast(name + ' wants to play Connect Four on the TV!'); }
  }
  function c4Leave(conn) {
    if (!g4) return; var i = g4.seats.findIndex(function (s) { return s && s.conn === conn; }); if (i < 0) return;
    if (g4.board && !g4.win) { g4.seats[i] = 'cpu'; toast('The TV takes over for ' + (i ? 'yellow' : 'red')); if (g4.turn === i + 1) setTimeout(c4Cpu, 600); if (g4.seats.every(function (s) { return s === 'cpu'; })) c4Close(); else c4Send(); }
    else c4Close();
  }

  // ------------------------------------------------ scores + rewards
  function addScore(e) { e.at = Date.now(); Cafe.store.addScore(cfg, e).then(function (l) { scores = l; }); if (e.win) toast('\uD83C\uDFC6 ' + e.name + ' won ' + (e.game === 'battleship' ? 'Battleship in ' + e.moves + ' shots!' : 'Connect Four!')); }
  function maybeReward(conn) { var pr = Cafe.activePromos(cfg); if (!cfg.promoRewards || !pr.length || Math.random() > (q.get('reward') ? 1 : 0.35)) return; net.send(conn, { t: 'reward', text: pr[Math.floor(Math.random() * pr.length)].text }); }
  function phoneCfg() { return { name: cfg.name, logo: cfg.logo, accent: cfg.accent, accent2: cfg.accent2, bg: cfg.bg, games: cfg.games, promos: cfg.promos, promoRewards: cfg.promoRewards, leaderboards: cfg.leaderboards, menu: [], specials: cfg.specials.slice(0, 1) }; }

  // ------------------------------------------------ boot
  Promise.resolve(q.get('demo') ? null : Cafe.cfgFromHash()).then(function (h) { return h || (q.get('demo') ? null : Cafe.store.loadConfig().then(function (c) { return c ? Cafe.merge(c) : null; })); }).then(function (c) {
    cfg = c || Cafe.demo(); Cafe.applyTheme(cfg);
    Cafe.store.getScores(cfg).then(function (l) { scores = l; });
    layout(); buildPanels(); rotate(); setInterval(idleTurn, 2600); addEventListener('resize', layout);
    var o = {
      code: q.get('room') || cfg.room || undefined, fixedCode: !!(q.get('room') || cfg.room),
      onStatus: function (s, code) {
        $('dot').classList.toggle('on', s === 'online'); $('code').textContent = code;
        var url = Cafe.base() + 'play.html?room=' + code + (local ? '&local=1' : '');
        $('qr').innerHTML = Cafe.qrSvg(url, 8); $('miniqr').innerHTML = Cafe.qrSvg(url, 4); window.CAFE_PLAY_URL = url;
      },
      onJoin: function (conn) { phones[conn.connectionId] = { conn: conn, cfgSent: 1 }; net.send(conn, { t: 'cfg', cfg: phoneCfg() }); },
      onMessage: function (conn, m) {
        var ph = phones[conn.connectionId] || (phones[conn.connectionId] = { conn: conn });
        if (m.t === 'hello') { if (!ph.cfgSent) { ph.cfgSent = 1; net.send(conn, { t: 'cfg', cfg: phoneCfg() }); } ph.name = String(m.name || 'Guest').slice(0, 16); if (!ph.greeted) { ph.greeted = 1; toast('\uD83D\uDC4B ' + ph.name + ' joined'); } }
        else if (m.t === 'score' && /^(battleship|connect4)$/.test(m.game)) { addScore({ game: m.game, name: String(m.name || ph.name || 'Guest').slice(0, 16), win: !!m.win, moves: +m.moves || 0 }); if (m.win && m.wantReward) maybeReward(conn); }
        else if (m.t === 'c4join') c4Join(conn, ph.name || 'Guest', m.vsTv);
        else if (m.t === 'c4move' && g4) { var i = g4.seats.findIndex(function (s) { return s && s.conn === conn; }); if (i >= 0) c4Move(i + 1, m.col | 0); }
        else if (m.t === 'c4cpu' && g4 && !g4.seats[1]) { g4.seats[1] = 'cpu'; c4Start(); }
        else if (m.t === 'c4leave') c4Leave(conn);
      },
      onClose: function (conn) { delete phones[conn.connectionId]; c4Leave(conn); }
    };
    net = local ? new LRNet.LocalHost(o) : new LRNet.Host(o);
    window.CAFE_SCREEN = { cfg: cfg, toast: toast, show: show, showId: function (id) { for (var i = 0; i < panels.length; i++) if (panels[i].id === id) return show(i); }, get g4() { return g4; } };
  });
})();
