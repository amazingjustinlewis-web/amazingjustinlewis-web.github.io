/* RED DEER RICH - TV / host page (v0.1.1). Holds the true game state, renders the board, talks to phones,
   runs the AI and (optionally) the Hue Lights Helper. */
(function () {
  'use strict';
  var C = window.RDR_CONFIG, B = window.RDR_BOARD, S = B.SPACES, AI = window.RDRAI, SFX = window.RDRSfx, Game = window.RDRGame;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = Game.money, charById = Game.charById;
  var Q = new URLSearchParams(location.search);
  var FAST = Q.has('fast') ? 4 : 1, NONET = Q.has('nonet'), LOCAL = Q.has('local');
  var game = new Game({ seed: Q.get('seed') ? +Q.get('seed') : undefined, speed: +(Q.get('speed') || FAST) });
  var rnd = new window.RDRRender($('board'), game);
  var net = null, lightsDoor = null, clients = {}, dirty = true, phoneDirty = true, lastVersion = -1;
  // the host phone is sticky: the first person to join stays host even after the turn order shuffles the seats
  // (v0.1.2 fix: before, whoever went first among the humans silently became host when the game started)
  var vipCid = null;
  var vip = function () {
    var i, p;
    if (vipCid) for (i = 0; i < game.players.length; i++) { p = game.players[i]; if (!p.ai && p.clientId === vipCid) return p; }
    for (i = 0; i < game.players.length; i++) { p = game.players[i]; if (!p.ai && p.clientId) { vipCid = p.clientId; return p; } }
    return null;
  };
  var inGame = function () { return game.phase === 'play'; };
  window.RDR = { game: game, render: rnd, sfx: SFX };
  if (Q.has('mute')) SFX.setMuted(true);
  if (Q.get('mode')) game.setMode(Q.get('mode').toLowerCase());   // regular | medium | quick (old 'full' = regular)
  if (Q.get('rules')) Q.get('rules').split(',').forEach(function (r) { var map = { jackpot: 'jackpot', fees: 'feesToPot', bullseye: 'bullseye', classic: 'payupRace', kid: 'kidMode', noperks: 'perks' }; if (map[r]) game.setRule(map[r], r !== 'classic' && r !== 'noperks'); });

  // ------------------------------------------------------------------ layout
  var box = { x: 0, y: 0, size: 100 };
  function layout() {
    var W = window.innerWidth, H = window.innerHeight, top = H * 0.064, side = W * 0.24, pad = H * 0.015;
    var size = Math.floor(Math.min(H - top - pad * 2, W - side - pad * 2));
    box = { x: Math.floor((W - side - size) / 2), y: Math.floor(top + pad + (H - top - pad * 2 - size) / 2), size: size };
    var st = document.documentElement.style; st.setProperty('--bx', box.x + 'px'); st.setProperty('--by', box.y + 'px'); st.setProperty('--bs', box.size + 'px');
    rnd.layout(W, H, box, crush.rung >= 4 ? 1 : 1.5);
    dirty = true;
  }
  window.addEventListener('resize', function () { clearTimeout(layout._t); layout._t = setTimeout(layout, 120); });

  // ------------------------------------------------------------------ Auto-Crush (frame-rate fallback)
  var LV = C.living;
  var crush = { rung: 0, auto: !Q.has('lowfx') && !Q.has('nocrush'), low: 0, high: 0, fps: 60, frames: 0, acc: 0 };
  if (Q.has('lowfx')) crush.rung = LV.maxRung;
  if (Q.get('fx') != null) crush.rung = Math.max(0, Math.min(LV.maxRung, +Q.get('fx')));
  function setRung(r, why) {
    r = Math.max(0, Math.min(LV.maxRung, r)); if (r === crush.rung) return;
    var oldLow = crush.rung >= 4; crush.rung = r; rnd.rung = r; rnd.staticKey = ''; rnd.ycKey = '';
    if ((r >= 4) !== oldLow) layout();
    SFX.setLite(r >= 5);
    crush.low = crush.high = 0; dirty = true;
    if (window.console) console.log('[auto-crush] rung ' + r + (why ? ' (' + why + ')' : ''));
  }
  rnd.rung = crush.rung;
  function crushTick(dt) {
    crush.frames++; crush.acc += dt;
    if (crush.acc < 500) return;
    crush.fps = crush.frames * 1000 / crush.acc; var span = crush.acc / 1000; crush.frames = 0; crush.acc = 0;
    if (!crush.auto || document.hidden) return;
    if (crush.fps < LV.crushBelowFps) { crush.low += span; crush.high = 0; if (crush.low >= LV.crushAfterSec) setRung(crush.rung + 1, Math.round(crush.fps) + ' fps'); }
    else if (crush.fps > LV.recoverAboveFps) { crush.high += span; crush.low = 0; if (crush.high >= LV.recoverAfterSec && crush.rung > 0) setRung(crush.rung - 1, 'recovered'); }
    else { crush.low = 0; }
  }

  // ------------------------------------------------------------------ game events -> sound, overlays, lights, phones
  var lastFind = null;       // v0.3: the latest Secret Finds card (phones offer "read more")
  var setupEdited = false;   // v0.3: once this room's setup was changed (TV or phone) or a game was played, the live settings win over a reloading host phone's saved setup
  var pingAt = {};           // v0.3: My Stuff tile taps, rate-limited per player
  var caughtPay = null;      // v0.3: set by a PAY UP catch, consumed by the rent payment right after it
  var phoneFx = {};          // per-player one-shot counters the phones watch (boom, missed, alarm, toast)
  function pfx(pid, k, extra) { var f = phoneFx[pid] = phoneFx[pid] || {}; f[k] = (f[k] || 0) + 1; if (extra) f[k + 'Data'] = extra; phoneDirty = true; }
  game.onBubble = function (p, txt) { rnd.bubble(p.id, txt, p.color); };
  game.on(function (type, d) {
    var p = d.pid != null ? game.byId(d.pid) : null;
    dirty = true; phoneDirty = true;
    lightsForEvent(type, d, p);
    switch (type) {
      case 'start': SFX.play('fanfare'); noteClearAll(); syncCash(); break;
      case 'turn': SFX.play('turn'); if (p) banner(p, 'It\'s ' + p.name + '\'s turn', p.snow ? 'Stuck in the Snowbank: roll doubles, pay ' + money(C.towFee) + ' or use a Tow Pass' : 'Roll the dice!'); pfx(d.pid, 'turn'); break;
      case 'roll': SFX.play('dice'); diceAnim(d.d, Date.now()); rnd.rollDice(d.d, d.pid, C.timing.roll / game.speed); if (p) banner(p, p.name + ' rolled ' + d.total + (d.dbl ? ' (DOUBLES!)' : ''), ''); break;
      case 'move': break;
      case 'land': if (p) { var lpr = game.props[d.sp], lown = lpr && lpr.owner >= 0 && lpr.owner !== p.id && !lpr.hocked ? game.byId(lpr.owner) : null; rnd.landBurst(p, d.sp, lown ? lown.color : null); } break;
      case 'halfway': SFX.play('cash'); if (d.exact) big(d.amount >= C.bullseyePay ? 'BULLSEYE!' : 'THE HALFWAY', '+' + money(d.amount) + ' for ' + p.name, '#7dff7d'); break;
      case 'offer': SFX.play('click'); showDeed(d.sp, true); break;
      case 'buy': SFX.play('buy'); rnd.camMoment(d.pid, 1600, 1.28); big('SOLD!', p.name + ' bought ' + S[d.sp].name, B.GROUPS[S[d.sp].group].color); break;
      case 'skipBuy': hideDeed(); break;
      case 'card': SFX.play('card'); showCard(d.deck, d.idx); if (d.deck === 'finds') lastFind = { idx: d.idx, n: (lastFind ? lastFind.n : 0) + 1, at: Date.now() }; break;
      case 'cardDone': break;      // v0.2: the card stays up (fading after a few seconds) until something replaces it
      case 'payupOpen': hideDeed(); payupBar('open', d); pfx(d.owner, 'alarm', { sp: d.sp }); break;
      case 'caught':
        SFX.play('caught'); setTimeout(function () { SFX.play('boom'); }, 150); shake(true); flash('#ff3030', (C.payup.boom || {}).flash);   // v0.3: half-strength boom
        caughtPay = { from: d.pid, to: d.owner, at: Date.now() };     // v0.3: the rent that follows explodes out of the caught token
        payupBar('caught', d); pfx(d.pid, 'boom', { amount: d.amount, owner: (game.byId(d.owner) || {}).name, sp: d.sp }); pfx(d.owner, 'gotEm', { amount: d.amount });
        break;
      case 'slipped': SFX.play('tiptoe'); payupBar('slipped', d); pfx(d.owner, 'missed', { sp: d.sp, name: p ? p.name : '' }); break;
      case 'loudAmp': banner(game.byId(d.owner), 'LOUD AMP! The window stays open 1 more second\u2026', ''); break;
      case 'passDice': hidePayupSoon(); hideDeed(); break;
      case 'tax': SFX.play('cash'); break;
      case 'pay':
        if (d.reason && /rent/.test(d.reason)) SFX.play('cash');
        if (typeof d.to === 'number') {      // player to player: the money flies token to token (trades never come through here)
          var boomPay = caughtPay && caughtPay.from === d.from && caughtPay.to === d.to && Date.now() - caughtPay.at < 1000 && /rent/.test(d.reason || '');
          if (boomPay) { caughtPay = null; rnd.payExplode(d.from, d.to, d.amount); flyCover[d.from] = flyCover[d.to] = performance.now() + 1500; }
          else { rnd.payFx(d.from, d.to, d.amount); flyCover[d.from] = flyCover[d.to] = performance.now() + 900; }    // normal rent flow (unchanged)
          if (/rent/.test(d.reason || '') && d.amount >= FX.bigRent) rnd.camMoment(d.from, 1700, 1.3);
        }
        break;
      case 'tab': pfx(d.pid, 'tab'); break;
      case 'build': SFX.play('build'); if (d.shops === 5) big('MEGA-PLEX!', S[d.sp].name, '#ffd23f'); break;
      case 'whiteout': SFX.play('whiteout'); flash('#ffffff'); big('WHITEOUT!', (p ? p.name : '') + ' hit the ditch: STUCK IN THE SNOWBANK', '#bfe6ff'); break;
      case 'free': SFX.play('click'); break;
      case 'jackpot': SFX.play('jackpot'); big('JACKPOT!', p.name + ' found the Secret Dirt Lot pot: ' + money(d.amount), '#ffd23f'); break;
      case 'perk': big(d.perk.toUpperCase() + '!', p.name + '\'s perk kicks in', p.color); break;
      case 'state':
        if (d.to === 'gold') { SFX.play('gold'); big('FULL GOLD!', p.name + ' is #1 and loaded', '#ffd23f'); }
        else if (d.from === 'gold') { SFX.play('tarnish'); big('GOLD TARNISHED', p.name + ' lost the lead', '#c0a060'); }
        else if (d.to === 'good') { SFX.play('buy'); big('DOING GOOD!', p.name + ' is moving up', '#cfe2ff'); }
        break;
      case 'bankrupt': SFX.play('crunch'); shake(); rnd.camMoment(d.pid, 2200, 1.35); big('BUSTED!', p.name + (d.owed > 0 ? ' skipped town owing ' + money(d.owed) : ' is out'), '#ff5a5a'); break;
      case 'skipped': big('LOSES A TURN', p ? p.name : '', '#ffb36b'); break;
      case 'tradeDone': pfx(d.a, 'deal'); pfx(d.b, 'deal'); tradeFade(d); syncCash([d.a, d.b]); break;   // private: no TV fanfare, tiles drift colour slowly
      case 'tradeOffer': pfx(d.to, 'offer'); break;
      case 'auctionStart': SFX.play('card'); hideDeed(); game.players.forEach(function (q) { if (!q.bankrupt) pfx(q.id, 'auction', { sp: d.sp }); }); break;
      case 'bid': SFX.play('click'); auctionBump(); break;
      case 'auctionWon': SFX.play('buy'); rnd.camMoment(d.pid, 1600, 1.28); big('SOLD AT AUCTION!', p.name + ' takes ' + S[d.sp].name + ' for ' + money(d.price), p.color === '#1d1d24' ? '#ff6a6a' : p.color); break;
      case 'auctionNone': big('NO SALE', 'The bank keeps ' + S[d.sp].name, '#c9c3d8'); break;
      case 'left': if (p) { var who = d.to != null ? game.byId(d.to) : null; big(p.name.toUpperCase() + ' LEFT THE GAME', d.how === 'ai' ? 'An AI plays their seat from here' : d.how === 'one' ? 'Everything goes to ' + (who ? who.name : '?') : d.how === 'split' ? 'Cash and deeds shared out among everyone' : money(d.amount || 0) + ' into the Dirt Lot pot \u00b7 deeds back to the bank', p.color === '#1d1d24' ? '#ff6a6a' : p.color); SFX.play('tarnish'); } break;
      case 'joined': if (p) big(p.name.toUpperCase() + ' JOINS!', (p.ai ? 'AI ' + C.ai.levels[p.ai.level].label + ' takes a seat' : 'New player') + ' \u00b7 starts with ' + money(p.cash), p.color === '#1d1d24' ? '#ff6a6a' : p.color); break;
      case 'chat': if (d.to === 'all') { pfx(-1, 'x'); } else pfx(d.to, 'msg'); break;
      case 'over': SFX.play('fanfare'); setTimeout(showResults, 2500 / FAST); break;
    }
  });

  // v0.1.1: after a private deal the traded tiles drift from the old owner's colour to the new one (TV + phone boards)
  var fades = {};
  function tradeFade(d) {
    var tr = game.tradeById(d.id), A = tr && game.byId(tr.a), Bp = tr && game.byId(tr.b); if (!A || !Bp) return;
    var list = [], now = Date.now();
    tr.aGives.props.forEach(function (sp) { list.push({ sp: sp, from: A.color }); });
    tr.bGives.props.forEach(function (sp) { list.push({ sp: sp, from: Bp.color }); });
    rnd.tradeFade(list);
    list.forEach(function (x) { fades[x.sp] = { from: x.from, at: now }; });
  }
  function fadeList() {
    var out = [], now = Date.now();
    for (var sp in fades) { var el = now - fades[sp].at; if (el >= C.tradeFadeMs) delete fades[sp]; else out.push([+sp, fades[sp].from, el]); }
    return out;
  }

  // ------------------------------------------------------------------ auction panel (v0.1.1)
  var aucKey = '';
  function auctionBump() { var el = $('auctionPop'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function renderAuction() {
    var t = game.turn, a = inGame() && t ? t.auction : null, el = $('auctionPop');
    if (!a) { if (!el.hidden) { el.hidden = true; aucKey = ''; } return; }
    var s = S[a.sp], gcol = s.group ? B.GROUPS[s.group].color : '#888', L = a.leader >= 0 ? game.byId(a.leader) : null;
    var key = a.seq + ':' + a.bids;
    if (key !== aucKey) {
      aucKey = key;
      el.innerHTML = '<div class="a-top" style="background:' + gcol + '">AUCTION \u00b7 ' + esc(s.name) + '</div>' +
        '<div class="a-mid"><div class="a-bid">' + money(a.bid) + '</div><div class="a-lead">' + (L ? chip(L) + ' <b>' + esc(L.name) + '</b> leads' : 'Opening bid \u00b7 no bids yet') + '</div>' +
        '<div class="a-hint">List price ' + money(s.price) + ' \u00b7 bid +$20 / +$50 / +$100 on your phone</div></div><div class="a-bar"><i id="aucFill"></i></div>';
      el.style.borderColor = L ? L.color : '#fff'; el.hidden = false;
    }
    var left = Math.max(0, a.endsAt - game.now), tot = game.ms(C.auction.ms), f = $('aucFill');
    if (f) { f.style.width = (100 * left / tot).toFixed(1) + '%'; f.style.background = left < tot * 0.3 ? '#ff5a5a' : '#ffd23f'; }
  }

  // ------------------------------------------------------------------ overlays
  function banner(p, who, what) { if (!p) return; $('banner').hidden = !inGame(); $('bWho').textContent = who; $('bWho').style.color = p.color === '#1d1d24' ? '#ff6a6a' : p.color; $('bWhat').textContent = what || ''; }
  // v0.2 board notifications: one at a time (#big, #cardPop and #deedPop keep their spots). Each stays up for
  // FX.noteHoldMs then fades slowly; a new one shatters whatever is showing and punches in. Purely visual: the
  // game never waits on any of this, so turns keep their pace.
  var FX = C.fx || {}, NOTE = { cur: null, t: 0, ft: 0 };
  function noteShow(id, html, pin) {
    var el = $(id);
    if (NOTE.cur) { shatterOut(NOTE.cur); if (NOTE.cur !== id) noteClear(NOTE.cur); }
    clearTimeout(NOTE.t); clearTimeout(NOTE.ft);
    el.innerHTML = html; el.hidden = false; el.classList.remove('nfade'); el.classList.remove('npunch'); void el.offsetWidth; el.classList.add('npunch');
    NOTE.cur = id; NOTE.pin = !!pin; NOTE.at = Date.now();
    if (!pin) NOTE.t = setTimeout(function () { noteFade(id); }, (FX.noteHoldMs || 6000));
  }
  function noteFade(id, quick) {
    if (NOTE.cur !== id) return;
    var el = $(id); clearTimeout(NOTE.t); clearTimeout(NOTE.ft);
    el.style.transitionDuration = quick ? '.35s' : ''; el.classList.add('nfade');
    NOTE.ft = setTimeout(function () { if (NOTE.cur === id) noteClear(id); }, quick ? 400 : (FX.noteFadeMs || 1400) + 100);
  }
  function noteClear(id) {
    var el = $(id); el.classList.remove('nfade'); el.classList.remove('npunch'); el.style.transitionDuration = '';
    if (id === 'big') el.innerHTML = ''; else el.hidden = true;
    if (NOTE.cur === id) NOTE.cur = null;
  }
  function noteClearAll() { clearTimeout(NOTE.t); clearTimeout(NOTE.ft); ['big', 'cardPop', 'deedPop'].forEach(noteClear); NOTE.cur = null; }
  // the outgoing notification breaks into a few shards that fly apart (one simple shard on crushed / old hardware)
  var SHARDS = ['polygon(0 0,55% 0,40% 55%,0 70%)', 'polygon(55% 0,100% 0,100% 60%,40% 55%)', 'polygon(0 70%,40% 55%,60% 100%,0 100%)', 'polygon(40% 55%,100% 60%,100% 100%,60% 100%)'];
  function shatterOut(id) {
    var el = $(id); if (!el || el.hidden || !el.innerHTML) return;
    var r = el.getBoundingClientRect(); if (r.width < 2) return;
    var box = document.createElement('div'); box.className = 'shd shd-' + id;
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px'; box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    var many = crush.rung < 3 && ('clipPath' in box.style || 'webkitClipPath' in box.style);
    (many ? SHARDS : [null]).forEach(function (poly, k) {
      var piece = document.createElement('div'); piece.className = 'shard ' + (many ? 'sh' + k : 'sh1x'); piece.innerHTML = el.innerHTML;
      if (poly) { piece.style.clipPath = poly; piece.style.webkitClipPath = poly; }
      box.appendChild(piece);
    });
    document.body.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 520);
  }
  function big(a, b, col) { noteShow('big', '<div class="b1" style="color:' + (col || '#ffd23f') + '">' + esc(a) + '</div><div class="b2">' + esc(b || '') + '</div>'); }
  function hideBig() { if (NOTE.cur === 'big') noteFade('big', true); }
  function shake(soft) { var b = document.body; b.classList.remove('shake'); b.classList.remove('shake-soft'); void b.offsetWidth; var k = soft ? 'shake-soft' : 'shake'; b.classList.add(k); setTimeout(function () { b.classList.remove(k); }, 500); }   // v0.3: soft = PAY UP boom at half amplitude
  function flash(col, op) { var f = $('flash'); f.style.transition = 'none'; f.style.background = col; f.style.opacity = String(op || 0.55); void f.offsetWidth; f.style.transition = 'opacity .5s'; f.style.opacity = '0'; }
  function deedHtml(sp, ask) {
    var s = S[sp], gcol = B.GROUPS[s.group].color, pr = game.props[sp], h = '<div class="deed"><div class="dtop" style="background:' + gcol + '">' + esc(s.name) + '<div class="dsub">' + esc(B.GROUPS[s.group].name) + '</div></div><div class="dbody">';
    if (s.type === 'prop') {
      var labels = ['rent', '1', '2', '3', '4', 'MP'], max = s.rents[5];
      h += '<div class="stairs">' + s.rents.map(function (r, k) { return '<div class="' + (pr.owner >= 0 && pr.shops === k ? 'on' : '') + '" style="height:' + Math.max(14, Math.round(100 * Math.sqrt(r / max))) + '%"><b>$' + r + '</b>' + labels[k] + '</div>'; }).join('') + '</div>';
      h += '<div>Shop: ' + money(B.GROUPS[s.group].shop) + ' \u00b7 full set doubles base rent</div>';
    } else if (s.type === 'whistle') h += '<div>Rent: $30 / $60 / $120 / $240 for 1-4 Whistle Stops</div><div class="story">' + esc(B.STORIES[sp] || '') + '</div>';
    else h += '<div>Rent: dice \u00d7 5 (one) or \u00d7 12 (both)</div>';
    h += '<div class="dprice">' + money(s.price) + '</div></div>' + (ask ? '<div class="dask">Buy it or pass?</div>' : '') + '</div>';
    return h;
  }
  function showDeed(sp, ask) { noteShow('deedPop', deedHtml(sp, ask), ask); }
  function hideDeed() { if (NOTE.cur === 'deedPop') noteFade('deedPop', true); }
  // v0.3 decks: Red Deer Randomness (playful) and Secret Finds (old paper, a true story + its effect)
  function cardHtml(deck, idx) {
    var c = B.DECKS[deck][idx], D = C.decks[deck];
    if (deck === 'finds') return '<div class="card finds"><div class="deck"><span class="seal">\uD83D\uDCDC</span> ' + esc(D.name) + '</div><div class="era">' + esc(c.year) + ' \u00b7 ' + esc(C.eras[c.era] || '') + '</div>' +
      '<div class="h">' + esc(c.h) + '</div><div class="story">' + esc(c.story) + '</div><div class="t">' + esc(c.t) + '</div></div>';
    return '<div class="card random"><div class="deck"><span class="dice">\u2684</span> ' + esc(D.name) + ' <span class="dice">\u2682</span></div><div class="h">' + esc(c.h) + '</div><div class="t">' + esc(c.t) + '</div></div>';
  }
  function showCard(deck, idx) { noteShow('cardPop', cardHtml(deck, idx)); if (deck === 'finds') { clearTimeout(NOTE.t); NOTE.t = setTimeout(function () { noteFade('cardPop'); }, C.storyHoldMs || 9000); } }
  function hideCard() { if (NOTE.cur === 'cardPop') noteFade('cardPop', true); }
  var puT = 0;
  function payupBar(kind, d) {
    var el = $('payupBar'), o = game.byId(d.owner), p = game.byId(d.pid);
    clearTimeout(puT); el.hidden = false; el.className = kind; el.style.borderColor = kind === 'open' && o ? o.color : '';
    if (kind === 'open') el.innerHTML = '<div class="pu1" style="color:' + (o ? o.color : '#fff') + '">PAY UP?</div><div class="pu2">' + esc(p.name) + ' is on ' + esc(o.name) + '\'s ' + esc(S[d.sp].name) + ' (' + money(d.rent) + '). ' + esc(o.name) + ', hit PAY UP before the dice pass!</div>';
    else if (kind === 'caught') { el.innerHTML = '<div class="pu1">CAUGHT!</div><div class="pu2">' + esc(o.name) + ' caught ' + esc(p.name) + ': ' + money(d.amount) + ' rent</div>'; puT = setTimeout(function () { el.hidden = true; }, 2600 / FAST); }
    else { el.innerHTML = '<div class="pu1">\u2026slipped away</div><div class="pu2">' + esc(p.name) + ' tiptoed past ' + esc(o.name) + '\'s ' + esc(S[d.sp].name) + '</div>'; puT = setTimeout(function () { el.hidden = true; }, 2200 / FAST); }
  }
  function hidePayupSoon() { var el = $('payupBar'); if (el.className === 'open') el.hidden = true; }

  // dice in the banner
  var dice = { d: [1, 1], t: 0 };
  function diceAnim(d, t) { dice.d = d; dice.t = t; }
  function drawDice() {
    var cv = $('bannerDice'), c = cv.getContext('2d'), roll = Date.now() - dice.t < C.timing.roll / FAST;
    c.clearRect(0, 0, cv.width, cv.height);
    var p = game.cur(), face = p ? p.color : '#fff', pip = p ? p.ink : '#000';
    [0, 1].forEach(function (k) {
      var v = roll ? 1 + Math.floor(Math.random() * 6) : dice.d[k], x = 10 + k * 95, y = 10, s = 80;
      c.save(); if (roll) { c.translate(x + s / 2, y + s / 2); c.rotate((Math.random() - 0.5) * 0.6); c.translate(-x - s / 2, -y - s / 2); }
      c.fillStyle = face; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.rect(x, y, s, s); c.fill(); c.stroke();
      c.fillStyle = pip; var pts = { 1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]] }[v];
      pts.forEach(function (q) { c.beginPath(); c.arc(x + q[0] * s, y + q[1] * s, 8, 0, 7); c.fill(); });
      c.restore();
    });
  }

  // ------------------------------------------------------------------ side panel + top bar
  function stateLabel(st) { return st === 'gold' ? 'GOLD' : st === 'good' ? 'DOING GOOD' : 'RAGS'; }
  function chip(p, cls) { var ch = charById(p.charId); return '<span class="chip ' + (p.state || '') + ' ' + (cls || '') + '" style="background:' + p.color + ';color:' + ch.ink + '">' + esc(window.RDRRender.initials(p.name)) + '</span>'; }
  function renderSide() {
    var g = game, cur = g.turn ? g.turn.pid : -1;
    $('cards').innerHTML = g.phase === 'lobby' ? '' : g.players.map(function (p) {
      var deeds = g.props.filter(function (pr) { return pr && pr.owner === p.id; }).length;
      var cd = countdown(p), pl = plaque(p);
      return '<div class="pcard' + (p.id === cur ? ' cur' : '') + (p.bankrupt ? ' out' : '') + '" style="border-color:' + (p.id === cur ? p.color : '') + '">' +
        '<div class="prow">' + chip(p) + '<span class="pname">' + esc(p.name) + '</span>' + (cd >= 0 ? '<span class="pcd" title="AI takes over in">\u23F1 ' + cd + '</span>' : '') +
        '<span class="pcash" data-pid="' + p.id + '">' + (p.bankrupt ? (p.left ? 'LEFT' : 'OUT') : money(Math.round(cashShown[p.id] != null ? cashShown[p.id] : p.cash))) + '</span></div>' +
        (pl ? '<div class="plaque">' + esc(pl) + '</div>' : '') +
        (p.bankrupt ? '' : '<div class="psub"><span class="badge ' + p.state + '">' + stateLabel(p.state) + '</span><span>' + deeds + ' deeds</span>' +
        (p.snow ? '<span>\u2744 stuck</span>' : '') + (p.passes.length ? '<span>\uD83D\uDE9A' + p.passes.length + '</span>' : '') + (p.skip ? '<span>\u23F8</span>' : '') +
        (p.ai ? '<span class="tag">AI ' + C.ai.levels[p.ai.level].label + '</span>' : p.aiTakeover ? '<span class="tag off">AI covering</span>' : !p.connected ? '<span class="tag off">offline</span>' : '') + '</div>') + '</div>';
    }).join('');
    renderLog(g);
    $('roundInfo').innerHTML = inGame() ? 'Round <b>' + g.round + '</b>' + (g.timed() ? ' \u00b7 <b>' + clock(Math.max(0, g.endsAt - g.now)) + '</b> left' : '') : '';
    $('potInfo').innerHTML = g.rules.jackpot && g.phase !== 'lobby' ? 'Dirt Lot pot <b>' + money(g.pot) + '</b>' : '';
    var wq = $('watchQr'), showQ = inGame() && net && net.status === 'online';
    if (wq.hidden === !!showQ) { wq.hidden = !showQ; if (showQ && wq._code !== net.code) { wq._code = net.code; drawQr(controllerUrl(net.code) + '&watch=1', $('qrSmall'), 4, 'L'); } }
    $('side').classList.toggle('crowd', g.players.length > 6);
    var rq = $('resQr'), showR = g.phase === 'over' && net && net.status === 'online';
    if (rq.hidden === !!showR) { rq.hidden = !showR; if (showR && rq._code !== net.code) { rq._code = net.code; drawQr(controllerUrl(net.code), $('qrRes'), 4, 'L'); } }
    $('joinInfo').innerHTML = net && net.status === 'online' && g.phase !== 'lobby' ? 'Join: <b>' + net.code + '</b>' : '';
    $('lightInfo').innerHTML = lightsOn() ? '\uD83D\uDCA1 <b>Hue</b>' : '';
    $('fxInfo').textContent = 'FX ' + (crush.rung ? 'crush ' + crush.rung : 'full') + (crush.auto ? '' : ' (manual)') + ' \u00b7 ' + Math.round(crush.fps) + ' fps';
    var t = g.turn, p = g.cur();
    if (inGame() && t && p) {
      $('banner').hidden = false;
      if (t.stage === 'act' || t.stage === 'roll') {
        var what = t.auction ? 'Auction: ' + S[t.auction.sp].name + ' (bid on your phone!)' : t.tab ? 'Owes ' + money(t.tab.amount) + ': raising cash\u2026' : t.buy != null ? 'Buy ' + S[t.buy].name + ' for ' + money(g.priceFor(p, t.buy)) + '?' :
          t.payup && !t.payup.done ? 'Will they pass the dice before the owner hits PAY UP?' : t.canRollAgain ? 'Doubles: roll again!' : t.stage === 'roll' ? (p.snow ? 'Stuck: roll doubles, pay the tow or use a pass' : 'Roll the dice!') : 'Pass the dice when ready';
        $('bWhat').textContent = what;
      }
    }
  }
  // v0.2 log: bigger text; with a crowded side panel it shows fewer lines instead of shrinking (trim from the top)
  var logKey = '';
  function renderLog(g) {
    var el = $('log'), last = g.log.length ? g.log[g.log.length - 1] : null, key = g.log.length + ':' + (last ? last.s : '') + ':' + g.players.length + ':' + innerHeight;
    if (key === logKey) return; logKey = key;
    el.innerHTML = g.log.slice(-(C.logLines || 9)).map(function (l) { return '<div>' + esc(l.s) + '</div>'; }).join('');
    var guard = 0; while (el.children.length > 1 && el.scrollHeight > el.clientHeight + 1 && guard++ < 20) el.removeChild(el.firstChild);
  }
  // v0.2 disconnects: seconds left before the AI covers a dropped phone (-1 = no countdown)
  function countdown(p) {
    if (!inGame() || p.ai || p.bankrupt || p.connected || p.aiTakeover || !p.offSince) return -1;
    return Math.max(0, Math.ceil((p.offSince + C.ai.takeoverAfterMs - Date.now()) / 1000));
  }
  // v0.2 out-of-game plaques beside the name
  function plaque(p) {
    if (p.left === 'ai') return 'Left town, the AI took over';
    if (p.left === 'split') return 'Left town, split their stuff';
    if (p.left === 'one') { var r = game.byId(p.leftTo); return 'Left town, gave it all to ' + (r ? r.name : 'a friend'); }
    if (p.left === 'pot') return 'Left town, threw it in the pot';
    if (p.bankrupt) return p.bustOwed > 0 ? 'Busted, owed ' + money(p.bustOwed) : 'Busted';
    return '';
  }
  // ------------------------------------------------------------------ v0.2 money feedback
  // Side panel: the total counts toward the new value and a "+$200" (player colour) or red "-$50" floats up out of it.
  // Board: $ signs pop from the token on gains, bills flutter away on losses; player-to-player payments fly token to
  // token instead (flyCover). Trades are private, so their cash is synced silently (syncCash on tradeDone).
  var cashSeen = {}, cashShown = {}, flyCover = {}, floats = 0;
  function syncCash(ids) { game.players.forEach(function (q) { if (!ids || ids.indexOf(q.id) >= 0) { cashSeen[q.id] = q.cash; cashShown[q.id] = q.cash; } }); }
  function cashEl(pid) { return document.querySelector('.pcash[data-pid="' + pid + '"]'); }
  function cashFloat(q, dlt) {
    var el = cashEl(q.id); if (!el || floats >= (crush.rung >= 3 ? 4 : 10)) return;
    var r = el.getBoundingClientRect(), f = document.createElement('div');
    f.className = 'cfloat ' + (dlt > 0 ? 'up' : 'down'); f.textContent = (dlt > 0 ? '+' : '\u2212') + money(Math.abs(dlt));
    f.style.color = dlt > 0 ? (q.color === '#1d1d24' ? '#e8e8f0' : q.color) : '#ff5a5a';
    f.style.left = Math.round(r.right) + 'px'; f.style.top = Math.round(r.top) + 'px';
    document.body.appendChild(f); floats++;
    setTimeout(function () { floats--; if (f.parentNode) f.parentNode.removeChild(f); }, FX.floatMs || 1700);
  }
  function moneyTick(now, dt) {
    if (!inGame()) return;
    game.players.forEach(function (q) {
      if (cashSeen[q.id] == null) { cashSeen[q.id] = cashShown[q.id] = q.cash; return; }
      var dlt = q.cash - cashSeen[q.id];
      if (dlt) { cashSeen[q.id] = q.cash; if (!q.bankrupt) { cashFloat(q, dlt); if (!(flyCover[q.id] > now)) rnd.moneyFx(q.id, dlt); } }
      var sh = cashShown[q.id];
      if (sh !== q.cash && !q.bankrupt) {
        var gap = q.cash - sh, step = Math.max(1, Math.abs(gap) * Math.min(1, dt / (FX.countTauMs || 170)));
        sh = gap > 0 ? Math.min(q.cash, sh + step) : Math.max(q.cash, sh - step); cashShown[q.id] = sh;
        var el = cashEl(q.id); if (el) el.textContent = money(Math.round(sh));
      }
    });
  }
  function clock(ms) { var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  // ------------------------------------------------------------------ lobby
  var aiPick = { ch: null, level: 'normal' };
  // v0.2.1 options: presets + one collapsed list (tap toggles, hold explains) + always-visible chips of what's on
  var O = window.RDROpts, optsOpen = false;
  function setHtml(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }
  function applyRules(r) { O.ordered(r).forEach(function (kv) { if (kv[0] in C.rules) game.setRule(kv[0], kv[1]); }); }
  // remember the last setup on the TV too (real TVs open plain index.html; test URLs are left alone)
  var TVKEY = 'rdr_tv_setup', tvSaved = '';
  function tvStore(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function saveTvSetup() {
    if (game.phase !== 'lobby') return;
    var r = {}; C.options.forEach(function (o) { r[o.k] = !!game.rules[o.k]; });
    var j = JSON.stringify({ rules: r, mode: game.mode }); if (j !== tvSaved) { tvSaved = j; tvStore(TVKEY, j); }
  }
  function loadTvSetup() {
    if (['local', 'nonet', 'autostart', 'ai', 'rules', 'mode', 'fresh'].some(function (k) { return Q.has(k); })) return false;
    var sv = null; try { sv = JSON.parse(tvStore(TVKEY) || 'null'); } catch (e) {}
    if (!sv || !sv.rules) return false;
    applyRules(sv.rules); if (sv.mode) game.setMode(sv.mode); tvSaved = JSON.stringify(sv); return true;
  }
  function showOptInfo(k) {
    var o = O.opt(k), el = $('optInfo'); if (!o) return;
    el.innerHTML = '<div class="oi-h">' + o.icon + ' ' + esc(o.label) + (game.rules[k] ? ' <em>on</em>' : ' <em class="off">off</em>') + '</div><div class="oi-t">' + esc(o.long) + '</div><div class="oi-x">click anywhere to close</div>';
    el.hidden = false;
  }
  function nextFreeChar(from) {
    var ids = C.characters.map(function (c) { return c.id; }), taken = game.players.map(function (p) { return p.charId; }), i = Math.max(-1, ids.indexOf(from));
    for (var k = 1; k <= ids.length; k++) { var id = ids[(i + k) % ids.length]; if (taken.indexOf(id) === -1) return id; }
    return null;
  }
  function renderLobby() {
    var g = game;
    $('pcount').textContent = g.players.length + '/' + C.maxPlayers;
    $('lobbyPlayers').innerHTML = g.players.map(function (p) {
      var ch = charById(p.charId);
      return '<li>' + chip(p) + '<span class="who">' + esc(p.name) + '<small>' + esc(ch.full + ' \u00b7 ' + ch.perk) + (p.ai ? ' \u00b7 AI ' + C.ai.levels[p.ai.level].label : p.clientId ? (p.connected ? ' \u00b7 phone' : ' \u00b7 offline') : '') + '</small></span>' +
        (p.ai || !p.connected ? '<button data-rm="' + p.id + '" aria-label="Remove">\u2716</button>' : '') + '</li>';
    }).join('') || '<li style="grid-column:1/3;color:#a59fb8">Waiting for phones\u2026 (or add AI players below)</li>';
    if (!aiPick.ch || g.players.some(function (p) { return p.charId === aiPick.ch; })) aiPick.ch = nextFreeChar(aiPick.ch);
    var ch = aiPick.ch ? charById(aiPick.ch) : null;
    $('aiChar').textContent = ch ? ch.full : 'No characters left'; $('aiChar').style.borderColor = ch ? ch.color : '';
    $('aiLevel').textContent = C.ai.levels[aiPick.level].label;
    $('aiAdd').disabled = !ch || g.players.length >= C.maxPlayers;
    var pre = O.presetOf(g.rules);
    setHtml($('presetRow'), Object.keys(C.presets).map(function (id) { return '<button data-preset="' + id + '" class="' + (pre === id ? 'on' : '') + '">' + esc(C.presets[id].label) + '<small>' + esc(C.presets[id].blurb) + '</small></button>'; }).join('') +
      (pre === 'custom' ? '<span class="custom">Custom</span>' : ''));
    setHtml($('ruleChips'), O.activeList(g.rules).map(function (o) { return '<span title="' + esc(o.short) + '">' + o.icon + ' ' + esc(o.tag) + '</span>'; }).join('') || '<span class="none">No extra options: plain rules</span>');
    setHtml($('optToggle'), 'Game options (' + O.countOn(g.rules) + ' on) <i>' + (optsOpen ? '\u25B4' : '\u25BE') + '</i>');
    $('rulesRow').hidden = !optsOpen;
    setHtml($('rulesRow'), C.options.map(function (o) { var on = !!g.rules[o.k]; return '<button class="optrow' + (on ? ' on' : '') + '" data-rule="' + o.k + '"><span class="ck">' + (on ? '\u2714' : '') + '</span><span class="ot"><b>' + o.icon + ' ' + esc(o.label) + '</b><small>' + esc(o.short) + '</small></span></button>'; }).join(''));
    saveTvSetup();
    Array.prototype.forEach.call($('modeRow').children, function (b) { b.className = 'ghost' + (b.getAttribute('data-mode') === g.mode ? ' on' : ''); });
    $('startBtn').disabled = g.players.length < C.minPlayers;
    renderHuePanel();
  }
  $('aiChar').onclick = function () { aiPick.ch = nextFreeChar(aiPick.ch); dirty = true; };
  $('aiLevel').onclick = function () { var L = Object.keys(C.ai.levels); aiPick.level = L[(L.indexOf(aiPick.level) + 1) % L.length]; dirty = true; };
  $('aiAdd').onclick = function () { if (addAI(aiPick.ch, aiPick.level)) setupEdited = true; };
  $('lobbyPlayers').onclick = function (e) { var b = e.target.closest('button'); if (b && b.getAttribute('data-rm')) { game.removePlayer(+b.getAttribute('data-rm')); setupEdited = true; dirty = phoneDirty = true; } };
  O.hold($('rulesRow'), '.optrow', function (b) { var k = b.getAttribute('data-rule'); game.setRule(k, !game.rules[k]); setupEdited = true; dirty = phoneDirty = true; }, function (b) { showOptInfo(b.getAttribute('data-rule')); });
  $('optToggle').onclick = function () { optsOpen = !optsOpen; dirty = true; };
  $('presetRow').onclick = function (e) { var b = e.target.closest('button'); if (b && C.presets[b.getAttribute('data-preset')]) { applyRules(C.presets[b.getAttribute('data-preset')].rules); setupEdited = true; dirty = phoneDirty = true; } };
  $('optInfo').onclick = function () { $('optInfo').hidden = true; };
  $('modeRow').onclick = function (e) { var b = e.target.closest('button'); if (b) { game.setMode(b.getAttribute('data-mode')); setupEdited = true; dirty = phoneDirty = true; } };
  $('startBtn').onclick = function () { startGame(); };
  $('againBtn').onclick = function () { startGame(); };
  $('lobbyBtn').onclick = function () { toLobby(); };
  // v0.3: a player tapped one of their deeds in My Stuff: that tile does a little bounce on the TV with a flash of their colour.
  // Purely visual: it never changes the game. Only your own deeds, a few per second at most.
  function pingTile(pl, sp) {
    if (!inGame() || !pl || pl.bankrupt || !(sp >= 0 && sp < 40)) return;
    var pr = game.props[sp]; if (!pr || pr.owner !== pl.id) return;
    var now = Date.now(); if (now - (pingAt[pl.id] || 0) < ((C.ping || {}).gapMs || 600)) return;
    pingAt[pl.id] = now; rnd.pingTile(sp, pl.color); dirty = true;
  }
  function addAI(charId, level) {
    if (game.phase !== 'lobby' && game.phase !== 'over' && game.phase !== 'play') return null;
    var o = { ai: level || 'normal', charId: charId || nextFreeChar(null) };
    var p = game.phase === 'play' ? game.addLatePlayer(o) : game.addPlayer(o);   // mid-game: fills an empty seat
    dirty = phoneDirty = true; return p;
  }
  function startGame() {
    if (game.players.length < C.minPlayers) return;
    SFX.unlock();
    game.aiMem = {}; phoneFx = {};
    for (var cid in clients) clients[cid].lastSent = '';
    if (!game.start()) return;
    setupEdited = true; lastFind = null;
    $('lobby').hidden = true; $('results').hidden = true; $('banner').hidden = false;
    AI.greet(game);
    requestWake(); dirty = phoneDirty = true;
  }
  function toLobby() {
    game.phase = 'lobby'; game.turn = null; game.resetBoard();
    game.players.filter(function (p) { return p.left; }).forEach(function (p) { game.removePlayer(p.id); });   // people who left come back as themselves (observers below)
    game.changed();
    for (var oc in clients) if (clients[oc].observer) {      // watchers join the next game automatically
      var np = game.addPlayer({ name: clients[oc].name, clientId: oc });
      if (np) { clients[oc] = { pid: np.id, conn: clients[oc].conn, seen: Date.now(), lastSent: '' }; send(clients[oc].conn, { t: 'welcome', pid: np.id, room: net.code }); }
    }
    stopFireworks(); $('results').hidden = true; $('lobby').hidden = false; $('banner').hidden = true; noteClearAll(); $('payupBar').hidden = true; syncCash();
    dirty = phoneDirty = true;
  }
  function statTiles(st) {
    st = st || {};
    var t = function (icon, val, label, on, cls) { return '<span class="rstat' + (on ? '' : ' zero') + (cls ? ' ' + cls : '') + '"><i>' + icon + '</i>' + val + '<b>' + label + '</b></span>'; };
    return '<div class="rstats">' +
      t('\uD83D\uDCB0', st.bigRent ? money(st.bigRent) : '\u2014', 'top rent', st.bigRent) +
      t('\uD83E\uDD1D', st.bestTrade ? '+' + money(st.bestTrade) : '\u2014', 'best deal', st.bestTrade) +
      t('\u270B', (st.caught || 0) + '\u2713 ' + (st.missed || 0) + '\u2717', 'pay up', st.caught || st.missed, 'wide') +
      t('\uD83D\uDD28', st.auctions || 0, 'auctions', st.auctions) +
      t('\u2744\uFE0F', st.snow || 0, 'snowbank', st.snow) + '</div>';
  }
  function resCard(x) {
    var c = { name: x.name, charId: x.charId, color: x.color, state: x.state };
    return chip(c) + '<div class="rname">' + esc(x.name) + '</div>' + (x.title ? '<div class="rtitle">' + esc(x.title) + '</div>' : '') +
      '<div class="rworth">' + (x.bankrupt ? (x.left ? 'left early' : x.owed > 0 ? '<span class="owed">owed ' + money(x.owed) + '</span>' : 'bankrupt') : money(x.worth)) + '<small>' + (x.bankrupt && !x.left && x.owed > 0 ? 'SKIPPED TOWN' : 'NET WORTH') + '</small></div>' + statTiles(x.stats);
  }
  function showResults() {
    var r = game.results || [];
    $('resTitle').textContent = r.length ? r[0].name.toUpperCase() + ' IS RED DEER RICH!' : 'GAME OVER';
    $('podium').innerHTML = r.slice(0, 3).map(function (x, k) {
      return '<div class="pcol p' + (k + 1) + '"><div class="podcard">' + (k === 0 ? '<div class="crown">\uD83D\uDC51</div>' : '') + resCard(x) + '</div><div class="step">' + (k + 1) + '</div></div>';
    }).join('');
    $('ground').innerHTML = r.slice(3).map(function (x) { return '<div class="gcard">' + resCard(x) + '</div>'; }).join('');
    $('results').classList.toggle('crowd', r.length > 3);
    $('results').hidden = false; $('banner').hidden = true; noteClearAll(); $('payupBar').hidden = true;
    qrDodge();
    startFireworks(r.slice(0, 3).map(function (x) { return x.color; }));
    // Hue: a second wave once the podium is up, a pickup flash in the winner's colour per big rocket, then hand back
    if (r[0]) {
      var wc = r[0].color;
      [1800, 4200, 6600].forEach(function (ms, i) { setTimeout(function () { if (game.phase === 'over') lightFx(i === 1 ? 'kill' : 'pickup', { color: wc }); }, ms / FAST); });
      setTimeout(function () { if (game.phase === 'over') lightFx('escape', { color: wc }); }, 8000 / FAST);
      setTimeout(function () { if (game.phase === 'over') lightFx('over', { escaped: true }); }, 12500 / FAST);
    }
  }

  // v0.2.1: the podium join QR is 20vh in the bottom-right corner. If a ground card would run under it (e.g. 7 players
  // on a 16:9 TV), the ground row moves out of the QR's column and its cards get a little narrower.
  // v0.3: then the whole results block (title, podium, ground, buttons) is scaled down to fit the screen when it is
  // too tall or too wide (8 players at 1080p, 4:3 TVs). Geometry comes from layout offsets, which ignore the cards'
  // drop-in animations; the scale is one CSS transform on #resBody (works on old Chromium, no CSS min()/clamp()).
  function resBoxes() {
    var body = $('resBody'), els = [$('resTitle')], out = [];
    function add(list) { for (var i = 0; i < list.length; i++) els.push(list[i]); }
    add($('podium').children); add($('ground').children); add(body.querySelectorAll('.res-btns button, .res-key'));
    els.forEach(function (el) {
      if (!el || !el.offsetWidth) return;
      var x = 0, y = 0, e = el;
      while (e && e !== body) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      if (e !== body) return;
      out.push({ el: el, x: x, y: y, w: el.offsetWidth, h: el.offsetHeight });
    });
    return out;
  }
  function qrDodge() {
    var R = $('results'), body = $('resBody'); R.classList.remove('qrdodge');
    var W = R.clientWidth, H = R.clientHeight, vh = H / 100, m = 1.2 * vh, k = 1, tx = 0, ty = 0;
    function fit() {
      body.style.transform = ''; k = 1; tx = 0; ty = 0;
      var bx = resBoxes(); if (!bx.length) return;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      bx.forEach(function (b) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
      var bw = body.offsetWidth, bh = body.offsetHeight;
      if (x0 >= m && y0 >= m && x1 <= bw - m && y1 <= bh - m) return;        // fits as it is
      k = Math.min(1, (W - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0));
      tx = (W - (x1 + x0) * k) / 2; ty = (H - (y1 + y0) * k) / 2;
      body.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    }
    var Q = $('resQr'), qx = W, qy = H;
    if (Q && !Q.hidden) { qx = Q.offsetLeft - 1 * vh; qy = Q.offsetTop - 1 * vh; }     // the whole QR block (caption + code), in results space
    function hits() {
      if (qx >= W) return false;
      var bx = resBoxes();
      for (var i = 0; i < bx.length; i++) {
        var b = bx[i], x = tx + b.x * k, y = ty + b.y * k;
        if (x < W - 0 && x + b.w * k > qx && y + b.h * k > qy) return true;
      }
      return false;
    }
    $('ground').style.paddingRight = '';
    fit();
    if (hits()) {
      R.classList.add('qrdodge');
      for (var n = 0, pad = W - qx; n < 5; n++) {        // keep the bottom row clear of the QR: pad the ground's right side, refit, repeat
        $('ground').style.paddingRight = Math.round(pad / k) + 'px'; fit();
        if (!hits()) break;
        pad += 3 * vh;
      }
    }
    R.setAttribute('data-fit', k.toFixed(3));
  }
  window.addEventListener('resize', function () { if (!$('results').hidden) qrDodge(); });

  // ------------------------------------------------------------------ fireworks (results screen)
  var fw = { parts: [], raf: 0, until: 0, next: 0, colors: [] };
  function startFireworks(colors) {
    var cv = $('fireworks'); if (!cv) return;
    cv.width = Math.round(innerWidth * (crush.rung >= 3 ? 0.5 : 1)); cv.height = Math.round(innerHeight * (crush.rung >= 3 ? 0.5 : 1));
    fw.colors = (colors || []).concat(['#ffd23f', '#ffffff', '#ff4fd8', '#3fd0ff']);
    fw.parts = []; fw.until = Date.now() + 14000; fw.next = 0;
    if (!fw.raf) fw.raf = requestAnimationFrame(fwFrame);
  }
  function stopFireworks() { fw.until = 0; }
  function fwBurst(cv) {
    var n = crush.rung >= 4 ? 30 : crush.rung >= 2 ? 50 : 80, x = cv.width * (0.15 + Math.random() * 0.7), y = cv.height * (0.12 + Math.random() * 0.3);
    var col = fw.colors[Math.floor(Math.random() * fw.colors.length)], sc = cv.width / 1600;
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 4) * sc * 1.6; fw.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: Math.random() < 0.2 ? '#fff' : col, r: (1.5 + Math.random() * 2) * sc * 1.5 }); }
    if (Math.random() < 0.5) SFX.play('pop');
  }
  function fwFrame() {
    var cv = $('fireworks'), now = Date.now();
    if (!cv || $('results').hidden || (now > fw.until && !fw.parts.length)) { fw.raf = 0; if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); return; }
    var ctx = cv.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.globalCompositeOperation = 'lighter';
    if (now < fw.until && now >= fw.next) { fwBurst(cv); fw.next = now + 500 + Math.random() * 900; }
    var g = 0.06 * cv.width / 1600;
    fw.parts = fw.parts.filter(function (p) {
      p.x += p.vx; p.y += p.vy; p.vy += g; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.012;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, p.life * 1.4); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    fw.raf = requestAnimationFrame(fwFrame);
  }

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'Enter' && (game.phase === 'lobby' || game.phase === 'over')) { startGame(); return; }
    if (k === 'm' || k === 'M') { SFX.setMuted(!SFX.muted()); big(SFX.muted() ? 'MUTED' : 'SOUND ON', '', '#fff'); }
    if (k === 'v' || k === 'V') { crush.auto = false; setRung((crush.rung + 1) % (LV.maxRung + 1), 'V key'); big('GRAPHICS ' + (crush.rung ? 'CRUSH ' + crush.rung : 'FULL'), 'V cycles the graphics level', '#fff'); }
    if ((k === 'a' || k === 'A') && !crush.auto) { crush.auto = true; big('AUTO-CRUSH ON', '', '#fff'); }
    if ((k === 'l' || k === 'L') && lightsAvailable()) setLights(!lights.enabled, lights.selected);
    if (k === 'c' || k === 'C') { game.setRule('camera', !game.rules.camera); big(game.rules.camera ? 'CAMERA ON' : 'CAMERA OFF', 'C toggles the follow camera', '#fff'); dirty = phoneDirty = true; }
    if ((k === 'i' || k === 'I') && inGame()) { if (game.players.length >= C.maxPlayers) big('TABLE FULL', C.maxPlayers + ' players max', '#fff'); else addAI(null, 'normal'); }   // mid-game: add an AI to an empty seat
    if (k === 'n' || k === 'N') rnd.cycleOffset = (rnd.cycleOffset || 0) + 120;   // jump the day/night clock ahead 2 minutes (handy for testing)
  });

  // ------------------------------------------------------------------ phones
  function controllerUrl(code) {
    var base = location.protocol === 'file:' ? C.liveControllerUrl : location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller.html';
    return base + '?room=' + code + (LOCAL ? '&local=1' : '');
  }
  function drawQr(text, cvEl, quiet, ecc) {     // quiet = white border in modules (4 is the spec; projectors like it); ecc 'L' = fewer, bigger modules
    var cv = cvEl || $('qr'), ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      var qr = window.qrcode(0, ecc || 'M'); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 2 * (quiet || 2))), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = quiet ? '#000' : '#14121b';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
    } catch (e) { ctx.fillStyle = '#000'; ctx.fillText('QR unavailable', 20, 150); }
  }
  function setNetUi(status, code, detail) {
    var ns = $('netStatus');
    if (status === 'online') {
      var url = controllerUrl(code);
      $('code').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); drawQr(url);
      ns.className = 'netstatus ok'; ns.textContent = 'Room open. Phones can join now.'; $('netBadge').textContent = '';
      openLightsDoor(code);
    } else if (status === 'offline') {
      ns.className = 'netstatus bad'; ns.textContent = 'Phone play unavailable (' + (detail || 'no connection') + '). AI-only games still work. Retrying\u2026';
      if (net && net.open) setTimeout(function () { if (net.status === 'offline') { net.tries = 0; net.open(); } }, 8000);
    } else { ns.className = 'netstatus'; ns.textContent = status === 'reconnecting' ? 'Reconnecting to the room server\u2026' : 'Connecting to the room server\u2026'; }
    dirty = true;
  }
  function send(conn, m) { if (net) net.send(conn, m); }
  function onPhoneMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    if ((m.t === 'hello' && m.role === 'lights') || conn._lights) { onLightsMessage(conn, m); return; }
    if (m.t === 'hello') {
      var cid = String(m.clientId || conn.peer).slice(0, 40), c = clients[cid], p = c ? game.byId(c.pid) : null;
      if (!p) {
        if (game.phase === 'play') {
          p = m.watch ? null : claimSeat(m.name);
          if (!p) {      // v0.1.1: no seat to claim -> watch the game (and maybe ask for an AI seat)
            if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
            clients[cid] = { observer: true, name: String(m.name || 'Guest').replace(/[<>]/g, '').trim().slice(0, 12) || 'Guest', conn: conn, seen: Date.now(), lastSent: '' };
            conn._cid = cid; send(conn, { t: 'welcome', observer: true, room: net.code }); phoneDirty = true;
            return;
          }
          if (p.clientId && clients[p.clientId] && p.clientId !== cid) { var oc = clients[p.clientId].conn; delete clients[p.clientId]; if (oc) try { oc.close(); } catch (e) {} }
          p.clientId = cid;
        } else {
          p = game.addPlayer({ name: m.name, charId: m.charId, clientId: cid });
        if (!p) { send(conn, { t: 'reject', reason: 'The room is full (' + C.maxPlayers + ' players).' }); return; }
        }
      } else if (game.phase !== 'play' && m.name) p.name = String(m.name).replace(/[<>]/g, '').trim().slice(0, 12) || p.name;
      if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
      clients[cid] = { pid: p.id, conn: conn, seen: Date.now(), lastSent: '' };
      conn._cid = cid; p.connected = true; handBack(p);
      game.changed(); dirty = phoneDirty = true;
      send(conn, { t: 'welcome', pid: p.id, room: net.code });
      return;
    }
    var cl = clients[conn._cid]; if (!cl || cl.conn !== conn) return;
    cl.seen = Date.now();
    if (cl.observer) { onObserverMessage(conn, cl, m); return; }
    var pl = game.byId(cl.pid);
    if (!pl) { send(conn, { t: 'reject', reason: 'You were removed from the room.' }); return; }
    if (!pl.connected) { pl.connected = true; dirty = true; handBack(pl); }
    if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }
    var isVip = vip() === pl, lobbyish = game.phase === 'lobby' || game.phase === 'over';
    if (m.t === 'start') { if (isVip && lobbyish) startGame(); return; }
    if (m.t === 'toLobby') { if (isVip && game.phase === 'over') toLobby(); return; }
    if (m.t === 'newGame') {        // v0.1.2: host phone ends the game early and takes everyone back to setup
      if (!isVip || game.phase === 'lobby') return;
      big('NEW GAME', (pl ? pl.name : 'The host') + ' started a new game: back to setup', '#fff');
      if (game.phase !== 'over') game.addLog('The host ended the game: back to setup.');
      toLobby(); return;
    }
    if (m.t === 'leave') { if (lobbyish) { game.removePlayer(pl.id); delete clients[conn._cid]; dirty = phoneDirty = true; } return; }
    if (m.t === 'name') { if (lobbyish) { pl.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 12) || pl.name; game.changed(); } return; }
    if (m.t === 'hue') { if (isVip) hueIntent(m); return; }
    if (m.t === 'addAI') { if (isVip && (lobbyish || inGame())) { addAI(m.charId, C.ai.levels[m.level] ? m.level : 'normal'); if (lobbyish) setupEdited = true; } return; }
    if (m.t === 'removeAI') { var q = game.byId(+m.pid); if (isVip && lobbyish && q && q.ai) { game.removePlayer(q.id); setupEdited = true; dirty = phoneDirty = true; } return; }
    if (m.t === 'rule') { if (isVip && lobbyish) { game.setRule(m.k, !!m.v); setupEdited = true; dirty = phoneDirty = true; } return; }
    if (m.t === 'pingTile') { pingTile(pl, +m.sp); return; }
    if (m.t === 'vote') { castVote(pl, m); return; }
    if (m.t === 'leaveGame') {      // v0.1.1: leave mid-game (hand the seat to an AI, split, give to one player, or into the pot)
      var lr = game.leaveGame(pl.id, String(m.how || ''), m.to);
      if (lr) { send(conn, { t: 'toast', text: lr }); return; }
      clients[conn._cid] = { observer: true, name: pl.name, conn: conn, seen: Date.now(), lastSent: '' };     // keep watching from the same phone
      send(conn, { t: 'welcome', observer: true, room: net.code }); send(conn, { t: 'toast', text: 'You left the game. You\'re watching now.' });
      dirty = phoneDirty = true; return;
    }
    if (m.t === 'mode') { if (isVip && lobbyish) { game.setMode(m.v); setupEdited = true; dirty = phoneDirty = true; } return; }
    if (m.t === 'preset') { if (isVip && lobbyish && C.presets[m.v]) { applyRules(C.presets[m.v].rules); setupEdited = true; dirty = phoneDirty = true; } return; }
    if (m.t === 'settings') {        // v0.2.1: the host phone puts back the last game's setup
      if (!isVip || game.phase !== 'lobby' || !m.rules) return;
      if (setupEdited) { dirty = phoneDirty = true; return; }     // v0.3: this room's live setup wins over a reloading phone's saved one
      setupEdited = true;
      applyRules(m.rules); if (m.mode) game.setMode(String(m.mode));
      var lvl = C.ai.levels[m.level] ? m.level : 'normal';
      for (var ai = 0; ai < Math.min(+m.addAI || 0, C.maxPlayers); ai++) if (!addAI(null, lvl)) break;
      dirty = phoneDirty = true; return;
    }
    var r = game.intent(pl.id, m);
    if (r && r !== 'wait' && m.t !== 'chat') send(conn, { t: 'toast', text: r });
    dirty = phoneDirty = true;
  }
  function onPhoneClose(conn) {
    if (conn._lights) { if (conn === lights.conn) { lights.conn = null; lights.st = null; dirty = phoneDirty = true; } return; }
    var cl = clients[conn._cid];
    if (cl && cl.conn === conn) { var p = game.byId(cl.pid); if (p) { p.connected = false; if (!p.offSince) p.offSince = Date.now(); game.changed(); dirty = true; } }
  }
  // ------------------------------------------------------------------ observers (v0.1.1): watch from the discreet QR, ask to take over an AI seat
  var votes = null, voteSeq = 0, VOTE_MS = 5000;
  function voters() { return game.players.filter(function (q) { return !q.ai && !q.bankrupt && !q.aiTakeover && q.clientId && q.connected; }); }
  function onObserverMessage(conn, cl, m) {
    if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }
    if (m.t === 'name') { cl.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 12) || cl.name; phoneDirty = true; return; }
    if (m.t === 'seatReq') {
      var p = game.byId(+m.pid);
      if (!inGame() || !p || !p.ai || p.bankrupt) { send(conn, { t: 'toast', text: 'That seat is not available.' }); return; }
      if (votes) { send(conn, { t: 'toast', text: 'Someone else is asking right now. Try again in a few seconds.' }); return; }
      if (m.name) cl.name = String(m.name).replace(/[<>]/g, '').trim().slice(0, 12) || cl.name;
      var vs = voters();
      votes = { id: ++voteSeq, cid: conn._cid, name: cl.name, pid: p.id, seat: p.name, until: Date.now() + VOTE_MS, yes: {}, no: {}, need: vs.map(function (q) { return q.id; }) };
      if (!vs.length) { resolveVote(); return; }     // nobody to ask: hand it over
      send(conn, { t: 'toast', text: 'Asking the players\u2026' }); phoneDirty = true; dirty = true;
      return;
    }
  }
  function castVote(pl, m) {
    if (!votes || +m.id !== votes.id || votes.need.indexOf(pl.id) < 0) return;
    delete votes.yes[pl.id]; delete votes.no[pl.id]; (m.yes ? votes.yes : votes.no)[pl.id] = 1;
    if (Object.keys(votes.yes).length + Object.keys(votes.no).length >= votes.need.length) resolveVote();
    phoneDirty = true;
  }
  function resolveVote() {
    var v = votes; votes = null; if (!v) return;
    var y = Object.keys(v.yes).length, n = Object.keys(v.no).length, cl = clients[v.cid], p = game.byId(v.pid);
    var okd = n === 0 || y > n;       // majority yes, or nobody objected
    if (!cl || !cl.observer || !p || !p.ai || !inGame()) okd = false;
    if (!okd) { if (cl && cl.conn) send(cl.conn, { t: 'toast', text: n ? 'The players said no this time.' : 'That seat is not available any more.' }); phoneDirty = true; return; }
    if (game.handSeat(p.id, v.name, v.cid)) return;
    clients[v.cid] = { pid: p.id, conn: cl.conn, seen: Date.now(), lastSent: '' };
    send(cl.conn, { t: 'welcome', pid: p.id, room: net.code });
    big(p.name.toUpperCase() + ' TAKES A SEAT!', 'Taking over from the AI (' + v.seat + ')', p.color === '#1d1d24' ? '#ff6a6a' : p.color);
    SFX.play('fanfare'); dirty = phoneDirty = true;
  }
  setInterval(function () { if (votes && Date.now() >= votes.until) resolveVote(); }, 250);
  function observerState(cl) {
    var fake = { id: -99, name: cl.name, charId: C.characters[0].id, color: '#888888', cash: 0, pos: 0, snow: false, snowTries: 0, passes: [], state: 'rags', bankrupt: false, ai: null, aiTakeover: null, skip: 0 };
    var st = phoneState(fake);
    st.me.observer = true; st.me.vip = false; st.me.worth = 0; st.fx = {}; st.chats = st.chats.filter(function (c) { return c[2] === 'all'; }); st.trades = [];
    st.feed = game.log.slice(-40).map(function (l) { return l.s; });
    st.seats = game.players.filter(function (q) { return q.ai && !q.bankrupt; }).map(function (q) { return [q.id, q.name, q.charId, q.color]; });
    st.asking = votes && votes.cid === cl.conn._cid ? { seat: votes.seat, left: Math.max(0, votes.until - Date.now()) } : null;
    st.voteBusy = !!votes;
    return st;
  }
  // seats whose phone is gone (AI covering or about to): a returning phone can claim one
  function awaySeats() { return game.players.filter(function (q) { return !q.ai && !q.bankrupt && q.clientId && (!q.connected || q.aiTakeover); }); }
  function claimSeat(name) {
    var away = awaySeats(), nm = String(name || '').trim().toLowerCase();
    var hit = away.filter(function (q) { return q.name.toLowerCase() === nm; })[0];
    if (!hit && away.length === 1 && away[0].aiTakeover) hit = away[0];   // only one empty seat: hand it over
    return hit || null;
  }
  function handBack(p) { p.offSince = 0; if (!p.aiTakeover) return; p.aiTakeover = null; if (inGame()) big(p.name + ' IS BACK!', 'The AI hands the seat back.', p.color); game.changed(); }
  var sweepN = 0;
  setInterval(function () {        // v0.2: every 0.5 s so the 10 s countdown hands over on time (the heavy bits still run every 3 s)
    var now = Date.now(), ch = false, full = ++sweepN % 6 === 0, counting = false;
    for (var cid in clients) {
      var cl = clients[cid], p = cl.observer ? null : game.byId(cl.pid);
      if (cl.observer && now - cl.seen > 20000) { delete clients[cid]; continue; }
      if (p && p.connected && now - cl.seen > (C.ai.lostAfterMs || 9000)) { p.connected = false; p.offSince = now; ch = true; }
      if (p && !p.connected && !p.ai && inGame() && !p.bankrupt) {
        if (!p.offSince) p.offSince = now;
        if (!p.aiTakeover && now - p.offSince >= C.ai.takeoverAfterMs) { p.aiTakeover = { level: 'normal' }; big('AI PLAYS FOR ' + p.name.toUpperCase(), 'Until their phone reconnects.', p.color); game.addLog('An AI covers ' + p.name + '\'s seat until their phone is back.'); ch = true; }
        else if (!p.aiTakeover) counting = true;
      }
    }
    if (ch) game.changed();
    if (counting) dirty = true;
    if (!full) return;
    if (lights.conn && now - lights.seen > 20000) { lights.conn = null; lights.st = null; dirty = true; }
    phoneDirty = true; for (var c2 in clients) clients[c2].lastSent = '';
  }, 500);

  function sideView(s) { return { cash: s.cash || 0, props: (s.props || []).slice(), passes: s.passes || 0 }; }
  function phoneState(p) {
    var g = game, t = g.turn, cur = g.cur(), now = g.now;
    var st = { t: 'state', phase: g.phase, mode: g.mode, rules: g.rules, pot: g.pot, round: g.round, endsIn: g.timed() && g.phase === 'play' ? Math.max(0, g.endsAt - now) : 0, maxPlayers: C.maxPlayers,
      me: { id: p.id, name: p.name, charId: p.charId, color: p.color, cash: p.cash, pos: p.pos, snow: p.snow, snowTries: p.snowTries, passes: p.passes.length, state: p.state,
        worth: g.worthOf(p), bankrupt: p.bankrupt, vip: vip() === p, aiCover: !!p.aiTakeover, skip: p.skip, place: p.place || 0, lockedCash: g.lockedCash(p) },
      fx: phoneFx[p.id] || {},
      players: g.players.map(function (q) { return { id: q.id, name: q.name, charId: q.charId, color: q.color, cash: q.cash, state: q.state, bankrupt: q.bankrupt, ai: q.ai ? q.ai.level : null,
        connected: q.connected, pos: q.pos, snow: q.snow, passes: q.passes.length, worth: g.phase === 'play' ? q.worth : 0 }; }),
      props: g.props.map(function (pr, i) { return pr ? [pr.owner, pr.shops, pr.hocked ? 1 : 0, g.locked(i) ? 1 : 0] : null; }),
      fades: fadeList(),
      feed: g.log.slice(-8).map(function (l) { return l.s; }),
      lobby: g.phase !== 'play' ? { taken: g.players.map(function (q) { return [q.charId, q.id, q.name, q.ai ? q.ai.level : '']; }) } : null,
      results: g.phase === 'over' ? g.results : null,
      hue: g.phase !== 'play' ? hueView(p) : null,
      setupEdited: setupEdited,
      lastFind: g.phase === 'play' && lastFind ? { idx: lastFind.idx, n: lastFind.n, fresh: Date.now() - lastFind.at < (C.storyHoldMs || 9000) } : null   // fresh: phones keep the whole card up while the TV shows it
    };
    if (t && g.phase === 'play' && cur) {
      var pu = t.payup, card = t.card || (t.cardDone && now - (t.card ? 0 : 0) < 1 ? t.cardDone : null);
      st.turn = { pid: t.pid, name: cur.name, color: cur.color, stage: t.stage, roll: t.roll, rollSeq: t.rollSeq, canRollAgain: t.canRollAgain,
        buy: t.buy != null ? { sp: t.buy, price: g.priceFor(cur, t.buy) } : null,
        payup: pu ? { owner: pu.owner, mover: pu.mover, sp: pu.sp, seq: pu.seq, open: !pu.done, caught: pu.caught, amount: pu.amount || 0, rent: g.rentFor(pu.sp, pu.roll, pu.dbl), graceLeft: Math.max(0, t.graceUntil - now) } : null,
        graceLeft: t.stage === 'act' ? Math.max(0, (t.graceUntil || 0) - now) : 0,
        tab: t.tab ? { amount: t.tab.amount, reason: t.tab.reason, hopeless: !!t.tab.hopeless, to: typeof t.tab.to === 'number' ? (g.byId(t.tab.to) || {}).name : t.tab.to, raise: g.liquidValue(cur) } : null,
        card: t.card ? { deck: t.card.deck, idx: t.card.idx } : null,
        auction: t.auction ? { sp: t.auction.sp, bid: t.auction.bid, leader: t.auction.leader, bids: t.auction.bids, seq: t.auction.seq, left: Math.round(Math.max(0, t.auction.endsAt - now)), total: Math.round(game.ms(C.auction.ms)) } : null,
        move: t.moving ? { from: t.moving.from, path: t.moving.path, stepMs: Math.round(t.moving.step), elapsed: Math.round(now - t.moving.start) } : null };
    }
    if (votes && votes.need.indexOf(p.id) >= 0) st.vote = { id: votes.id, name: votes.name, seat: votes.seat, left: Math.max(0, votes.until - Date.now()), mine: votes.yes[p.id] ? 'yes' : votes.no[p.id] ? 'no' : '' };
    // private: only my chats and deals
    st.chats = g.chats.filter(function (c) { return c.to === 'all' || c.to === p.id || c.from === p.id; }).slice(-150).map(function (c) { return [c.id, c.from, c.to, c.text]; });
    st.trades = g.trades.filter(function (tr) { return tr.a === p.id || tr.b === p.id; }).slice(-25).map(function (tr) {
      return { id: tr.id, a: tr.a, b: tr.b, aGives: sideView(tr.aGives), bGives: sideView(tr.bGives), v: tr.v, waiting: tr.waiting, status: tr.status, by: tr.by, why: tr.why || '', history: tr.history.map(function (h) { return [h.v, h.by]; }) };
    });
    return st;
  }
  function pushPhones() {
    if (!net) return;
    for (var cid in clients) {
      var cl = clients[cid], p = cl.observer ? null : game.byId(cl.pid);
      if ((!p && !cl.observer) || !cl.conn || !cl.conn.open) continue;
      var st = cl.observer ? observerState(cl) : phoneState(p), js = JSON.stringify(st);
      if (js === cl.lastSent) continue;
      cl.lastSent = js; net.send(cl.conn, st);
    }
  }

  // ------------------------------------------------------------------ Philips Hue via the Zombie Tiles Lights Helper (same protocol)
  var lights = { conn: null, seen: 0, st: null, enabled: false, selected: [], adopted: false, prefsRev: null };
  function lightsAvailable() { return !!(lights.conn && lights.conn.open && lights.st && lights.st.ok); }
  function lightsOn() { return lightsAvailable() && lights.enabled && lights.selected.length > 0; }
  function lightsSend(m) { if (lights.conn && lights.conn.open) try { lights.conn.send(m); } catch (e) {} }
  function lightFx(k, d) { if (!lightsOn()) return; var m = d || {}; m.t = 'fx'; m.k = k; lightsSend(m); }
  function openLightsDoor(code) {          // the existing helper dials rooms with the Zombie Tiles prefix: open a small door there too
    if (LOCAL || NONET || lightsDoor || typeof window.Peer !== 'function') return;
    lightsDoor = new window.RDRNet.Host({ code: code, fixedCode: true, prefix: C.lightsPeerPrefix,
      onMessage: function (conn, m) { if (m && ((m.t === 'hello' && m.role === 'lights') || conn._lights)) onLightsMessage(conn, m); else try { conn.send({ t: 'reject', reason: 'This is a Red Deer Rich room. Open the Red Deer Rich controller.' }); } catch (e) {} },
      onClose: onPhoneClose, onStatus: function () {} });
  }
  function lightsSync() {
    lightsSend({ t: 'lights-config', enabled: lights.enabled && lightsAvailable(), selected: lights.selected });
    if (lightsOn() && inGame()) { lightFx('start'); var p = game.cur(); if (p) lightFx('turn', { color: p.color }); }
    if (!lightsOn()) lightsSend({ t: 'fx', k: 'end', reason: 'lights switched off' });
    dirty = phoneDirty = true;
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
      dirty = phoneDirty = true; return;
    }
    if (conn !== lights.conn) return;
    lights.seen = Date.now();
    if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) {} return; }
    if (m.t === 'lights-status') {
      var first = !lights.st;
      lights.st = { ok: !!m.ok, paired: !!m.paired, reachable: !!m.reachable, mock: !!m.mock, error: String(m.error || '').slice(0, 160),
        bridge: m.bridge && m.bridge.name ? String(m.bridge.name).slice(0, 40) : 'Hue bridge', pairing: m.pairing,
        groups: (Array.isArray(m.groups) ? m.groups : []).slice(0, 40).map(function (g) { return { id: String(g.id), name: String(g.name).slice(0, 32), type: g.type === 'Zone' ? 'Zone' : 'Room', lights: +g.lights || 0 }; }) };
      var rev = m.prefs && typeof m.prefs.rev === 'number' ? m.prefs.rev : null;
      if (first) { if (!lights.adopted && m.remembered) { lights.adopted = true; setLights(!!m.remembered.enabled, m.remembered.selected || []); } else setLights(lights.enabled, lights.selected); }
      else if (rev !== null && rev !== lights.prefsRev) setLights(!!m.prefs.enabled, m.prefs.selected || []);
      if (rev !== null) lights.prefsRev = rev;
      dirty = phoneDirty = true;
    }
  }
  function lightsForEvent(type, d, p) {
    if (!lightsOn()) return;
    switch (type) {
      case 'start': lightFx('start'); break;
      case 'turn': if (p) lightFx('turn', { color: p.color }); break;
      case 'roll': lightFx('roll'); break;
      case 'payupOpen': var o = game.byId(d.owner); lightFx('fight', { style: 'charge', color: o ? o.color : '#ffffff' }); break;   // heartbeat pulses after a flash of the owner's colour
      case 'caught': lightFx('fightResult', { lost: 1 }); break;          // hard red double flash
      case 'slipped': lightFx('fightResult', {}); break;                  // fade back to base
      case 'buy': lightFx('pickup', { color: B.GROUPS[S[d.sp].group].color }); break;
      case 'auctionWon': lightFx('pickup', { color: p ? p.color : '#ffd23f' }); break;   // flash in the winner's colour
      case 'build': lightFx('helipad'); break;                            // warm gold rise
      case 'card': if (d.deck === 'random') lightFx('roll'); break;         // quick white flicker
      case 'whiteout': lightFx('boom', { color: '#bfe6ff' }); break;      // cold blue-white flash
      case 'jackpot': lightFx('escape', { color: '#ffd23f' }); break;     // party cycle
      case 'state': if (d.to === 'gold') lightFx('helipad'); break;
      case 'bankrupt': lightFx('crunch'); break;
      case 'over': lightFx('escape', { color: p ? p.color : '#ffd23f' }); break;   // the podium carries on the celebration and hands the lights back
    }
  }
  function hueView(p) {
    if (!lights.conn || !lights.st) return null;
    var st = lights.st; return { ok: st.ok, bridge: st.bridge, mock: st.mock, enabled: lights.enabled, selected: lights.selected, groups: st.ok ? st.groups : [], canEdit: vip() === p };
  }
  function renderHuePanel() {
    var el = $('huePanel'), st = lights.st, code = net && net.status === 'online' ? net.code : '';
    if (!lights.conn) { el.className = 'hue-panel off'; el.innerHTML = '\uD83D\uDCA1 Philips Hue (optional): start the Zombie Tiles <b>Lights Helper</b> on your PC' + (code ? ' and connect it to room <b>' + code + '</b>' : '') + '.'; return; }
    if (!st) { el.className = 'hue-panel'; el.innerHTML = '\uD83D\uDCA1 Lights helper connected. Checking the Hue bridge\u2026'; return; }
    if (!st.ok) { el.className = 'hue-panel'; el.innerHTML = '\uD83D\uDCA1 Lights helper connected, but the bridge is not ready (' + esc(st.error || 'not paired') + ').'; return; }
    var key = JSON.stringify([lights.enabled, lights.selected, st.groups]); if (el._key === key) return; el._key = key;
    el.className = 'hue-panel ok';
    var h = '<div class="hue-q"><span>\uD83D\uDCA1 Philips Hue found' + (st.mock ? ' (mock)' : '') + '. <b>Use lights?</b></span><button class="hb' + (lights.enabled ? ' on' : '') + '" data-hue="on">YES</button><button class="hb' + (!lights.enabled ? ' on' : '') + '" data-hue="off">NO</button></div>';
    if (lights.enabled) h += '<div>' + st.groups.map(function (g) { var on = lights.selected.indexOf(g.id) !== -1; return '<button class="hroom' + (on ? ' on' : '') + '" data-g="' + esc(g.id) + '">' + (on ? '\u2714 ' : '') + esc(g.name) + '</button>'; }).join('') + '<button class="htest" data-hue="test">Flash ticked</button></div>';
    el.innerHTML = h;
  }
  $('huePanel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var v = b.getAttribute('data-hue'), g = b.getAttribute('data-g');
    if (v === 'on' || v === 'off') hueIntent({ enabled: v === 'on' }); else if (v === 'test') hueIntent({ test: true }); else if (g) hueIntent({ toggle: g });
  });

  // ------------------------------------------------------------------ main loop
  var lastT = performance.now(), domT = 0, lastVer = -1;
  function loop() {
    var now = performance.now(), dt = Math.min(200, now - lastT); lastT = now;
    try {
      game.tick(now); AI.tick(game);
      var t = game.turn, paused = inGame() && t && (t.stage === 'card' || (t.payup && !t.payup.done) || t.stage === 'rolling');
      var band = rnd.bandLevel();
      if (inGame()) SFX.band(band.vol, band.near); else SFX.band(0, 0);
      rnd.frame(now, dt, { paused: paused, band: SFX.bandLevel ? Math.max(SFX.bandLevel(), inGame() ? band.vol * 0.3 : 0) : band.vol });
      if (Date.now() - dice.t < C.timing.roll / FAST + 100) drawDice();
      renderAuction();
      moneyTick(now, dt);
      crushTick(dt);
      if (game.version !== lastVer) { lastVer = game.version; dirty = true; phoneDirty = true; }
      if ((dirty || now - domT > 1000) && now - domT > 120) { domT = now; dirty = false; if (game.phase === 'lobby') renderLobby(); renderSide(); }
      if (phoneDirty) { phoneDirty = false; pushPhones(); }
    } catch (e) { if (window.console) console.error(e); }
    requestAnimationFrame(loop);
  }

  // v0.2: if the TV tab is ever hidden (a PC tab-cast with another tab in front), animation frames stop; keep the game,
  // the AI and the phones going on a slow timer until it's visible again (no drawing).
  setInterval(function () {
    if (!document.hidden) return;
    try {
      game.tick(performance.now()); AI.tick(game);
      if (game.version !== lastVer) { lastVer = game.version; phoneDirty = true; }
      if (phoneDirty) { phoneDirty = false; pushPhones(); }
    } catch (e) { if (window.console) console.error(e); }
  }, 250);
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }

  // boot
  if (location.protocol === 'file:') $('backLink').hidden = true;
  if (window.matchMedia && matchMedia('(max-width: 760px) and (pointer: coarse)').matches) $('phoneHint').hidden = false;
  layout();
  var roomQ = Q.get('room') ? Q.get('room').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : null;
  if (LOCAL) net = new window.RDRNet.LocalHost({ code: roomQ || 'TEST', onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else if (!NONET) net = new window.RDRNet.Host({ code: roomQ, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else setNetUi('offline', null, 'phones disabled with ?nonet');
  loadTvSetup();
  if (Q.get('ai')) {
    var spec = Q.get('ai');
    if (/^\d+$/.test(spec)) { var lv = ['normal', 'ruthless', 'easy']; for (var j = 0; j < Math.min(+spec, C.maxPlayers); j++) addAI(null, lv[j % 3]); }
    else spec.split(',').forEach(function (x) { var pr = x.split(':'); addAI(charById(pr[0]) && pr[0] === charById(pr[0]).id ? pr[0] : null, C.ai.levels[pr[1]] ? pr[1] : 'normal'); });
  }
  if (Q.has('autostart') && game.players.length >= 2) setTimeout(startGame, 300);
  window.RDR.note = function () { return NOTE; }; window.RDR.applyRules = applyRules; window.RDR.qrDodge = qrDodge; window.RDR.big = big; window.RDR.showCard = showCard; window.RDR.cashShown = cashShown; window.RDR.plaque = plaque;   // v0.2 test hooks
  window.RDR.startGame = startGame; window.RDR.addAI = addAI; window.RDR.toLobby = toLobby; window.RDR.crush = crush; window.RDR.setRung = setRung;
  window.RDR.net = function () { return net; }; window.RDR.lights = function () { return lights; }; window.RDR.clients = clients; window.RDR.phoneState = phoneState; window.RDR.controllerUrl = controllerUrl;
  window.RDR.setupEdited = function () { return setupEdited; }; window.RDR.lastFind = function () { return lastFind; };   // v0.3 test hooks
  requestAnimationFrame(loop);
})();
