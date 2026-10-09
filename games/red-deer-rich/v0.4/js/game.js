/* RED DEER RICH - rules engine (v0.1.1: auctions, three game lengths, late seats, 3 s PASS lock). The TV is the authority: phones and AI only send intents.
   Time-driven: the host calls game.tick(now) every frame; every delay (dice tumble, token steps, card reading,
   PAY UP grace) is a timestamp in the state, so the same engine runs in the browser and in node tests. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG, B = root.RDR_BOARD, S = B.SPACES;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function charById(id) { for (var i = 0; i < C.characters.length; i++) if (C.characters[i].id === id) return C.characters[i]; return null; }
  function clean(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n || 12); }

  function Game(opts) {
    opts = opts || {};
    this.seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
    this.rand = mulberry32(this.seed);
    this.speed = opts.speed || 1;          // timing divisor (&fast = 4, tests = huge)
    this.listeners = [];
    this.now = 0;
    this.nextId = 1;
    this.players = [];
    this.rules = {}; for (var k in C.rules) this.rules[k] = C.rules[k];
    this.mode = 'regular';
    this.phase = 'lobby';
    this.version = 0;                      // bumps on every change (host pushes phones when it moves)
    this.chats = []; this.trades = []; this.log = []; this.cardsDrawn = []; this.heckleGap = {};
    this.resetBoard();
  }
  var G = Game.prototype;
  G.on = function (fn) { this.listeners.push(fn); };
  G.emit = function (type, d) { d = d || {}; d.type = type; this.version++; try { this.trackStat(type, d); } catch (e) {} for (var i = 0; i < this.listeners.length; i++) try { this.listeners[i](type, d, this); } catch (e) { if (root.console) console.error(e); } };
  G.changed = function () { this.version++; };
  G.addLog = function (s, card) { var e = { t: this.now, s: s }; if (card) e.card = card; this.log.push(e); if (this.log.length > 60) this.log.shift(); this.changed(); };
  G.ms = function (x) { return x / this.speed; };
  G.byId = function (id) { for (var i = 0; i < this.players.length; i++) if (this.players[i].id === id) return this.players[i]; return null; };
  G.cur = function () { return this.turn ? this.byId(this.turn.pid) : null; };
  G.alive = function () { return this.players.filter(function (p) { return !p.bankrupt; }); };
  G.shuffle = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(this.rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  G.rint = function (a, b) { return a + Math.floor(this.rand() * (b - a + 1)); };

  G.resetBoard = function () {
    this.auctionQ = [];
    this.props = S.map(function (s) { return s.price ? { owner: -1, shops: 0, hocked: false } : null; });
    this.bankShops = C.bankShops; this.bankMegas = C.bankMegas;
    this.pot = C.jackpotSeed;
    this.decks = { random: this.shuffle(B.deckCards('random', C.eraFilter)), finds: this.shuffle(B.deckCards('finds', C.eraFilter)) };   // v0.3 decks (era-filterable)
    this.turn = null; this.round = 0; this.turnCount = 0; this.results = null; this.endsAt = 0; this.order = [];
  };

  // ------------------------------------------------------------------ lobby
  G.freeChar = function (prefer) {
    var taken = this.players.map(function (p) { return p.charId; });
    if (prefer && taken.indexOf(prefer) === -1 && charById(prefer)) return prefer;
    for (var i = 0; i < C.characters.length; i++) if (taken.indexOf(C.characters[i].id) === -1) return C.characters[i].id;
    return null;
  };
  G.addPlayer = function (o) {
    if (this.players.length >= C.maxPlayers) return null;
    var cid = this.freeChar(o.charId); if (!cid) return null;
    var ch = charById(cid);
    var p = { id: this.nextId++, name: clean(o.name) || ch.name, charId: cid, color: ch.color, ink: ch.ink, ai: o.ai ? { level: C.ai.levels[o.ai] ? o.ai : 'normal' } : null,
      clientId: o.clientId || null, connected: !o.clientId || o.connected !== false, cash: 0, pos: 0, snow: false, snowTries: 0, passes: [], bankrupt: false,
      skip: 0, perk: {}, laps: 0, halfwayPasses: 0, preLap: -1, state: 'rags', worth: 0, aiTakeover: null };
    if (p.ai && !o.name) p.name = ch.name;
    this.players.push(p); this.changed();
    return p;
  };
  G.removePlayer = function (id) { this.players = this.players.filter(function (p) { return p.id !== id; }); this.changed(); };
  G.setChar = function (id, charId) {
    var p = this.byId(id); if (!p || (this.phase !== 'lobby' && this.phase !== 'over')) return false;
    if (!charById(charId) || this.players.some(function (q) { return q !== p && q.charId === charId; })) return false;
    var ch = charById(charId), oldDefault = charById(p.charId);
    if (p.ai || (oldDefault && p.name === oldDefault.name)) p.name = ch.name;
    p.charId = charId; p.color = ch.color; p.ink = ch.ink; this.changed(); return true;
  };
  G.setRule = function (k, v) { if (k in C.rules && (this.phase === 'lobby' || this.phase === 'over' || k === 'camera')) { this.rules[k] = !!v; if (k === 'feesToPot' && v) this.rules.jackpot = true; if (k === 'jackpot' && !v) this.rules.feesToPot = false; this.changed(); } };
  G.setMode = function (m) { if (m === 'full') m = 'regular'; if (C.modes[m] && (this.phase === 'lobby' || this.phase === 'over')) { this.mode = m; this.changed(); } };
  G.timed = function () { return !!(C.modes[this.mode] && C.modes[this.mode].minutes && this.endsAt); };
  // v0.1.1: an AI (or a late phone) can take a seat in a running game: starting cash, at The Halfway, last in turn order
  G.addLatePlayer = function (o) {
    if (this.phase !== 'play') return this.addPlayer(o);
    var p = this.addPlayer(o); if (!p) return null;
    p.cash = C.modes[this.mode].startCash; p.pos = 0; p.state = 'rags'; p.place = 0;
    this.order.push(p.id);
    this.addLog(p.name + ' joins the game' + (p.ai ? ' (AI)' : '') + '.');
    this.emit('joined', { pid: p.id }); this.updateStates();
    return p;
  };
  G.perk = function (p, charId) { return this.rules.perks && p.charId === charId; };

  G.start = function () {
    if (this.players.length < C.minPlayers) return false;
    this.resetBoard();
    var self = this, MD = C.modes[this.mode] || C.modes.regular;
    this.players.forEach(function (p) {
      p.cash = MD.startCash; p.stats = null; p.pos = 0; p.snow = false; p.snowTries = 0; p.passes = []; p.bankrupt = false; p.skip = 0; p.bustOwed = 0; p.bustTo = null; p.leftTo = null;
      p.perk = {}; p.laps = 0; p.halfwayPasses = 0; p.preLap = -1; p.state = 'rags'; p.place = 0;
    });
    this.chats = []; this.trades = []; this.log = []; this.tradeSeq = 1; this.cardsDrawn = []; this.heckleGap = {};
    this.order = this.shuffle(this.players.map(function (p) { return p.id; }));
    this.players.sort(function (a, b) { return self.order.indexOf(a.id) - self.order.indexOf(b.id); });
    this.endsAt = 0;
    if (MD.deal === 'some') {
      var deeds = this.shuffle(S.filter(function (s) { return s.type === 'prop'; }).map(function (s) { return s.i; }));
      var each = this.players.length <= 3 ? C.quick.dealSmall : C.quick.dealBig;
      this.players.forEach(function (p) { for (var k = 0; k < each; k++) { var sp = deeds.pop(); self.props[sp].owner = p.id; } });
    } else if (MD.deal === 'all') {      // every ownable space (deeds, Whistle Stops, City Juice), round-robin
      var all = this.shuffle(this.props.map(function (pr, i) { return pr ? i : -1; }).filter(function (i) { return i >= 0; }));
      all.forEach(function (sp, k) { self.props[sp].owner = self.players[k % self.players.length].id; });
    }
    if (MD.minutes) this.endsAt = this.now + MD.minutes * 60000 / (this.speed >= 20 ? this.speed : 1);
    this.phase = 'play'; this.startedAt = this.now; this.round = 1;
    this.addLog('Game on! Turn order: ' + this.players.map(function (p) { return p.name; }).join(', '));
    this.emit('start', { order: this.order.slice() });
    this.updateStates();
    this.beginTurn(this.players[0]);
    return true;
  };

  // ------------------------------------------------------------------ helpers: ownership, rent, worth
  G.ownerOf = function (sp) { var pr = this.props[sp]; return pr && pr.owner >= 0 ? this.byId(pr.owner) : null; };
  G.ownsGroup = function (pid, group) { var self = this; return B.GROUP_MEMBERS[group].every(function (i) { return self.props[i].owner === pid; }); };
  G.groupShops = function (group) { var self = this; return B.GROUP_MEMBERS[group].map(function (i) { return self.props[i].shops; }); };
  G.countOwned = function (pid, group) { var self = this; return B.GROUP_MEMBERS[group].filter(function (i) { return self.props[i].owner === pid; }).length; };
  G.rentFor = function (sp, roll, dbl) {
    var s = S[sp], pr = this.props[sp]; if (!pr || pr.owner < 0 || pr.hocked) return 0;
    if (s.type === 'prop') return pr.shops > 0 ? s.rents[pr.shops] : s.rents[0] * (this.ownsGroup(pr.owner, s.group) ? 2 : 1);
    if (s.type === 'whistle') return B.WHISTLE_RENT[this.countOwned(pr.owner, 'whistle')] * (dbl ? 2 : 1);
    if (s.type === 'juice') return (roll || 7) * B.JUICE_MULT[this.countOwned(pr.owner, 'juice')];
    return 0;
  };
  G.shopCost = function (sp) { return B.GROUPS[S[sp].group].shop || 0; };
  G.worthOf = function (p) {
    var self = this, w = p.cash;
    this.props.forEach(function (pr, i) { if (pr && pr.owner === p.id) { w += pr.hocked ? S[i].hock : S[i].price; w += pr.shops * self.shopCost(i); } });
    return w;
  };
  G.liquidValue = function (p) {
    var self = this, v = p.cash;
    this.props.forEach(function (pr, i) { if (pr && pr.owner === p.id) { v += Math.floor(pr.shops * self.shopCost(i) * C.shopSellBack); if (!pr.hocked) v += S[i].hock; } });
    return v;
  };
  G.hasFullSet = function (p) {
    var self = this; return Object.keys(B.GROUP_MEMBERS).some(function (g) { return g !== 'whistle' && g !== 'juice' && self.ownsGroup(p.id, g); });
  };
  G.updateStates = function () {
    var self = this, alive = this.alive();
    alive.forEach(function (p) { p.worth = self.worthOf(p); });
    var top = Math.max.apply(null, alive.map(function (p) { return p.worth; }).concat([0]));
    alive.forEach(function (p) {
      var st = 'rags';
      if (p.worth >= C.states.goodNetWorth || self.hasFullSet(p)) st = 'good';
      if (p.worth >= C.states.goldNetWorth && p.worth >= top) st = 'gold';
      if (st !== p.state) { var from = p.state; p.state = st; self.emit('state', { pid: p.id, from: from, to: st }); if (st === 'gold') self.addLog(p.name + ' went FULL GOLD!'); else if (from === 'gold') self.addLog(p.name + '\'s GOLD tarnished.'); }
    });
  };

  // ------------------------------------------------------------------ money
  G.give = function (p, n, why) { p.cash += n; this.emit('cash', { pid: p.id, delta: n, why: why }); };
  G.feeDest = function () { return this.rules.jackpot && this.rules.feesToPot ? 'pot' : 'bank'; };
  // charge: pay now if possible; else the active human gets an open Tab, everyone else auto-raises or goes bankrupt
  G.charge = function (p, amount, to, reason) {
    amount = Math.max(0, Math.round(amount)); if (!amount || p.bankrupt) return true;
    if (p.cash < amount) {
      var active = this.turn && this.turn.pid === p.id;
      if (active && !this.isBot(p) && this.liquidValue(p) >= amount) {
        this.turn.tab = { to: to, amount: amount, reason: reason };
        this.addLog(p.name + ' owes ' + money(amount) + ' (' + reason + ') and has to raise cash.');
        this.emit('tab', { pid: p.id, amount: amount, to: to });
        return false;
      }
      if (active && !this.isBot(p)) {     // can't cover it even selling everything: Tab with a bankrupt button
        this.turn.tab = { to: to, amount: amount, reason: reason, hopeless: true };
        this.emit('tab', { pid: p.id, amount: amount, to: to, hopeless: true });
        return false;
      }
      if (this.liquidValue(p) < amount) { this.bankrupt(p, to, amount); return false; }    // v0.2: hopeless -> pay what you can
      this.autoRaise(p, amount);
      if (p.cash < amount) { this.bankrupt(p, to, amount); return false; }
    }
    this.transfer(p, amount, to, reason);
    return true;
  };
  G.transfer = function (p, amount, to, reason) {
    p.cash -= amount;
    var who = typeof to === 'number' ? this.byId(to) : null;
    if (who) who.cash += amount; else if (to === 'pot') this.pot += amount;
    this.emit('pay', { from: p.id, to: to, amount: amount, reason: reason });
    if (who) this.addLog(p.name + ' paid ' + who.name + ' ' + money(amount) + (reason ? ' (' + reason + ')' : ''));
    else this.addLog(p.name + ' paid ' + money(amount) + (to === 'pot' ? ' into the Dirt Lot pot' : '') + (reason ? ' (' + reason + ')' : ''));
  };
  G.settleTab = function () {
    var t = this.turn && this.turn.tab, p = this.cur(); if (!t || !p) return;
    if (p.cash >= t.amount) { this.turn.tab = null; var ok = this.charge(p, t.amount, t.to, t.reason); this.emit('tabPaid', { pid: p.id, amount: t.amount, to: t.to, auto: !!this._raising }); this.afterPay(); return ok; }
  };
  G.afterPay = function () { this.checkTrades(); this.updateStates(); };
  G.autoRaise = function (p, need) {
    var self = this, guard = 0;
    while (p.cash < need && guard++ < 200) {
      var best = -1, bestShops = 0;
      this.props.forEach(function (pr, i) { if (pr && pr.owner === p.id && pr.shops > 0 && pr.shops >= bestShops) { bestShops = pr.shops; best = i; } });
      if (best >= 0) { this.sellShop(p, best, true); continue; }
      var hk = -1, low = 1e9;
      this.props.forEach(function (pr, i) { if (pr && pr.owner === p.id && !pr.hocked && !self.groupHasShops(S[i].group) && S[i].price < low) { low = S[i].price; hk = i; } });
      if (hk >= 0) { this.hock(p, hk, true); continue; }
      break;
    }
    return p.cash >= need;
  };
  // v0.2 "Go bust, pay what I can": the bank buys the Shops back, then each deed goes the way that gives the creditor more.
  //   player creditor: a deed handed over is worth its price to them (price - unhock cost if hocked); hocking it first and
  //   handing over cash + the hocked deed is worth hock + price - unhockCost, which is always less, so deeds go over as-is.
  //   bank / pot creditor: deeds are no use to the bank, so each unhocked deed is hocked and that cash paid; the deeds then
  //   go back to the bank and (with Auctions on) are queued for auction straight after.
  // Anything still unpaid is remembered as p.bustOwed ("Skipped Town Owing $840").
  G.bustPlan = function (p, to, debt) {
    var self = this, creditor = typeof to === 'number' ? this.byId(to) : null, shopCash = 0, deeds = [];
    this.props.forEach(function (pr, i) {
      if (!pr || pr.owner !== p.id) return;
      shopCash += Math.floor(pr.shops * self.shopCost(i) * C.shopSellBack);
      var P = S[i].price, H = S[i].hock, U = self.unhockCost(i);
      var give = pr.hocked ? P - U : P, hockPay = pr.hocked ? -1 : H + (creditor ? P - U : 0);
      deeds.push({ sp: i, how: !creditor ? (pr.hocked ? 'release' : 'hock') : (hockPay > give ? 'hock' : 'give') });
    });
    var liquid = Math.max(0, p.cash) + shopCash; deeds.forEach(function (d) { if (!self.props[d.sp].hocked) liquid += S[d.sp].hock; });
    return { creditor: creditor, deeds: deeds, owed: Math.max(0, Math.round((debt || 0) - liquid)) };
  };
  G.bankrupt = function (p, to, debt) {
    if (p.bankrupt) return;
    var self = this, plan = this.bustPlan(p, to, debt), creditor = plan.creditor, gave = 0, queue = [];
    this.props.forEach(function (pr, i) {     // the bank buys every Shop back first
      if (pr && pr.owner === p.id && pr.shops) { p.cash += Math.floor(pr.shops * self.shopCost(i) * C.shopSellBack); self.returnShops(pr.shops); pr.shops = 0; }
    });
    plan.deeds.forEach(function (d) { var pr = self.props[d.sp]; if (d.how === 'hock' && !pr.hocked) { pr.hocked = true; p.cash += S[d.sp].hock; } });
    var cash = Math.max(0, p.cash);
    plan.deeds.forEach(function (d) {
      var pr = self.props[d.sp];
      if (creditor) { pr.owner = creditor.id; gave++; }                 // hocked deeds stay hocked
      else { pr.owner = -1; pr.hocked = false; queue.push(d.sp); }
    });
    p.cash = 0;
    if (creditor) { creditor.cash += cash; creditor.passes = creditor.passes.concat(p.passes); }
    else { if (to === 'pot') this.pot += cash; p.passes.forEach(function (d) { self.returnPass(d); }); }
    if (cash > 0) this.emit('pay', { from: p.id, to: creditor ? creditor.id : (to || 'bank'), amount: cash, reason: 'went bust' });
    p.passes = []; p.bankrupt = true; p.snow = false; p.place = this.alive().length + 1; p.bustOwed = plan.owed; p.bustTo = creditor ? creditor.id : (to || 'bank');
    this.trades.forEach(function (t) { if (t.status === 'open' && (t.a === p.id || t.b === p.id)) { t.status = 'cancelled'; t.why = p.name + ' went bankrupt'; } });
    this.addLog(p.name + ' went BUST' + (creditor ? ' to ' + creditor.name : '') + ': paid ' + money(cash) + (creditor && gave ? ' + ' + gave + ' deed' + (gave > 1 ? 's' : '') : '') +
      (plan.owed > 0 ? ' and skipped town owing ' + money(plan.owed) : '') + '.');
    this.checkTrades(); this.updateStates();       // (state banners first, so BUSTED! is the one left on screen)
    this.emit('bankrupt', { pid: p.id, to: creditor ? creditor.id : null, paid: cash, owed: plan.owed, deeds: gave });
    if (!creditor && queue.length && this.rules.auctions) this.auctionQ = (this.auctionQ || []).concat(queue);
    if (this.turn && this.turn.pid === p.id) { this.turn.tab = null; this.turn.payup = null; this.turn.buy = null; this.turn.canRollAgain = false; this.turn.stage = 'ended'; this.turn.endAt = this.now + this.ms(1200); }
    if (this.alive().length <= 1) this.finish('last');
  };
  // ------------------------------------------------------------------ leaving mid-game (v0.1.1)
  G.canLeave = function (p) {
    if (this.phase !== 'play') return 'No game running';
    if (!p || p.bankrupt) return 'You are already out of this game';
    var t = this.turn, self = this;
    if (t) {
      if (t.payup && !t.payup.done && (t.payup.mover === p.id || t.payup.owner === p.id)) return 'Not during a PAY UP window: try again in a moment';
      if (t.auction && t.auction.leader === p.id) return 'Not while you lead an auction';
      if (t.pid === p.id) {
        if (t.tab) return 'Settle your debt first (My Stuff: sell, mortgage or make a deal)';
        if (t.stage === 'rolling' || t.stage === 'moving' || t.stage === 'card' || t.stage === 'closing') return 'Wait until your move finishes';
        if (t.auction) return 'Wait for the auction to finish';
      }
      if (this.props.some(function (pr, i) { return pr && pr.owner === p.id && self.locked(i); })) return 'Some of your deeds are locked this turn: try again in a moment';
    }
    return '';
  };
  // how: 'ai' (an AI keeps playing the seat) | 'split' (cash + deeds shared evenly) | 'one' (everything to player `to`) | 'pot' (cash to the Dirt Lot pot, deeds back to the bank)
  G.leaveGame = function (pid, how, to) {
    var p = this.byId(pid), why = this.canLeave(p); if (why) return why;
    var self = this, others = this.alive().filter(function (q) { return q !== p; }), r = null;
    if (how === 'ai') {
      p.ai = { level: 'normal' }; p.aiTakeover = null; p.clientId = null; p.connected = true; p.left = 'ai';
      this.addLog(p.name + ' left the game. An AI plays their seat from here.');
      this.emit('left', { pid: p.id, how: 'ai' }); this.changed(); return '';
    }
    if (how === 'one') { r = this.byId(+to); if (!r || r === p || r.bankrupt) return 'Pick a player to get everything'; }
    else if (how !== 'split' && how !== 'pot') return 'Pick an option';
    if (!others.length) return 'Nobody left to take it';
    this.trades.forEach(function (t) { if (t.status === 'open' && (t.a === p.id || t.b === p.id)) { t.status = 'cancelled'; t.why = p.name + ' left the game'; } });
    var mine = []; this.props.forEach(function (pr, i) { if (pr && pr.owner === p.id) mine.push(i); });
    if (how !== 'one') mine.forEach(function (i) { var pr = self.props[i]; if (pr.shops) { p.cash += Math.floor(pr.shops * self.shopCost(i) * C.shopSellBack); self.returnShops(pr.shops); pr.shops = 0; } });   // the bank buys the Shops back first
    var cash = Math.max(0, p.cash), detail;
    if (how === 'one') {
      r.cash += cash; mine.forEach(function (i) { self.props[i].owner = r.id; }); r.passes = r.passes.concat(p.passes);
      detail = 'everything goes to ' + r.name;
    } else if (how === 'split') {
      var n = others.length, each = Math.floor(cash / n), got = {};
      others.forEach(function (q) { q.cash += each; got[q.id] = 0; });
      mine.sort(function (a, b) { return S[b].price - S[a].price; }).forEach(function (i) {    // deal the deeds out so everyone gets about the same value
        var best = others.slice().sort(function (a, b) { return (got[a.id] - got[b.id]) || (a.cash - b.cash); })[0];
        self.props[i].owner = best.id; got[best.id] += S[i].price;
      });
      p.passes.forEach(function (d, k) { others[k % n].passes.push(d); });
      detail = money(each) + ' to each player and the deeds shared out';
    } else {
      this.rules.jackpot = true; this.pot += cash;
      mine.forEach(function (i) { self.props[i].owner = -1; self.props[i].hocked = false; });
      p.passes.forEach(function (d) { self.returnPass(d); });
      detail = money(cash) + ' into the Dirt Lot pot, deeds back to the bank';
    }
    p.cash = 0; p.passes = []; p.bankrupt = true; p.left = how; p.leftTo = r ? r.id : null; p.snow = false; p.place = this.alive().length + 1; p.clientId = null;
    this.addLog(p.name + ' left the game: ' + detail + '.');
    this.emit('left', { pid: p.id, how: how, to: r ? r.id : null, amount: cash, detail: detail });
    if (this.turn && this.turn.pid === p.id) { var t = this.turn; t.buy = null; t.tab = null; t.payup = null; t.canRollAgain = false; t.stage = 'ended'; t.endAt = this.now + this.ms(1200); }
    this.checkTrades(); this.updateStates();
    if (this.alive().length <= 1) this.finish('last');
    this.changed(); return '';
  };
  // v0.1.1: an observer takes over an AI seat (after the players OK it)
  G.handSeat = function (pid, name, clientId) {
    var p = this.byId(pid); if (!p || !p.ai || p.bankrupt || this.phase !== 'play') return 'That seat is not an AI seat';
    var old = p.name; p.ai = null; p.aiTakeover = null; p.clientId = clientId; p.connected = true; p.left = null;
    p.name = clean(name) || p.name;
    if (this.aiMem) delete this.aiMem[p.id];
    this.addLog(p.name + ' takes over ' + old + '\'s seat.');
    this.emit('seatTaken', { pid: p.id, from: old }); this.changed(); return '';
  };
  G.returnShops = function (n) { if (n >= 5) { this.bankMegas++; } else this.bankShops += n; };
  G.returnPass = function (deck) { var d = this.decks[deck], src = B.DECKS[deck]; if (!d || !src) return; for (var i = 0; i < src.length; i++) if (src[i].fx.k === 'pass' && d.indexOf(i) === -1) { d.push(i); return; } };

  // ------------------------------------------------------------------ building, hocking
  G.groupHasShops = function (group) { var self = this; return B.GROUP_MEMBERS[group].some(function (i) { return self.props[i].shops > 0; }); };
  G.canBuild = function (p, sp) {
    var s = S[sp], pr = this.props[sp]; if (!s || s.type !== 'prop' || !pr || pr.owner !== p.id || p.bankrupt) return 'Not yours';
    if (!this.ownsGroup(p.id, s.group)) return 'Own the whole colour set first';
    var self = this; if (B.GROUP_MEMBERS[s.group].some(function (i) { return self.props[i].hocked; })) return 'Unmortgage the set first';
    if (pr.shops >= 5) return 'Already a Mega-Plex';
    if (this.rules.evenBuild && pr.shops > Math.min.apply(null, this.groupShops(s.group))) return 'Build evenly';
    if (this.rules.shopShortage) { if (pr.shops < 4 && this.bankShops <= 0) return 'Bank is out of Shops'; if (pr.shops === 4 && this.bankMegas <= 0) return 'No Mega-Plexes left'; }
    if (p.cash < this.shopCost(sp)) return 'Not enough cash';
    return '';
  };
  G.build = function (p, sp) {
    var why = this.canBuild(p, sp); if (why) return why;
    var pr = this.props[sp], cost = this.shopCost(sp);
    p.cash -= cost;
    if (pr.shops === 4) { this.bankMegas--; this.bankShops += 4; } else this.bankShops--;
    pr.shops++;
    this.addLog(p.name + ' built ' + (pr.shops === 5 ? 'a MEGA-PLEX' : 'a Shop') + ' on ' + S[sp].name);
    this.emit('build', { pid: p.id, sp: sp, shops: pr.shops });
    this.updateStates(); return '';
  };
  G.canSell = function (p, sp) {
    var s = S[sp], pr = this.props[sp]; if (!pr || pr.owner !== p.id || !pr.shops) return 'No Shops here';
    if (this.rules.evenBuild && pr.shops < Math.max.apply(null, this.groupShops(s.group))) return 'Sell evenly';
    return '';
  };
  G.sellShop = function (p, sp, force) {
    var why = force ? '' : this.canSell(p, sp); if (why) return why;
    var pr = this.props[sp]; if (!pr || !pr.shops) return 'No Shops here';
    var back = Math.floor(this.shopCost(sp) * C.shopSellBack);
    if (pr.shops === 5) {
      if (this.bankShops >= 4 || !this.rules.shopShortage) { this.bankMegas++; this.bankShops -= 4; pr.shops = 4; p.cash += back; }
      else { this.bankMegas++; pr.shops = 0; p.cash += back * 5; }
    } else { pr.shops--; this.bankShops++; p.cash += back; }
    this.addLog(p.name + ' sold a Shop on ' + S[sp].name);
    this.emit('sell', { pid: p.id, sp: sp }); this.updateStates(); return '';
  };
  G.hock = function (p, sp, force) {
    var pr = this.props[sp]; if (!pr || pr.owner !== p.id || pr.hocked) return 'Can\'t mortgage that';
    if (this.groupHasShops(S[sp].group)) return 'Sell the Shops in this set first';
    if (!force && this.locked(sp)) return 'Locked during this turn';
    pr.hocked = true; p.cash += S[sp].hock;
    this.addLog(p.name + ' mortgaged ' + S[sp].name + ' for ' + money(S[sp].hock));
    this.emit('hock', { pid: p.id, sp: sp }); this.updateStates(); return '';
  };
  G.unhockCost = function (sp) { return Math.ceil(S[sp].hock * (1 + C.unhockFee)); };
  G.unhock = function (p, sp) {
    var pr = this.props[sp]; if (!pr || pr.owner !== p.id || !pr.hocked) return 'Not mortgaged';
    var cost = this.unhockCost(sp); if (p.cash < cost) return 'Not enough cash';
    p.cash -= cost; pr.hocked = false;
    this.addLog(p.name + ' unmortgaged ' + S[sp].name);
    this.emit('unhock', { pid: p.id, sp: sp }); this.updateStates(); return '';
  };
  // assets the active turn holds on to: the space under the active player during a PAY UP window or open Tab
  G.locked = function (sp) {
    var t = this.turn; if (!t || this.phase !== 'play') return false;
    var p = this.cur(); if (!p) return false;
    if ((t.payup && !t.payup.done) || t.tab) return p.pos === sp;
    if (t.buy === sp) return true;
    return false;
  };
  G.lockedCash = function (p) { var t = this.turn; return t && t.tab && t.pid === p.id ? p.cash : 0; };

  // ------------------------------------------------------------------ turns
  G.isBot = function (p) { return !!(p.ai || p.aiTakeover); };
  G.beginTurn = function (p) {
    var guard = 0;
    while ((p.bankrupt || p.skip > 0) && guard++ < 40) {
      if (!p.bankrupt && p.skip > 0) { p.skip--; this.addLog(p.name + ' loses this turn.'); this.emit('skipped', { pid: p.id }); }
      p = this.nextAfter(p);
    }
    this.turnCount++;
    this.turn = { pid: p.id, stage: 'roll', doubles: 0, roll: null, rollSeq: (this.turn ? this.turn.rollSeq : 0), canRollAgain: false, buy: null, payup: null, tab: null, card: null, graceUntil: 0, startedAt: this.now, payupSeq: (this.turn ? this.turn.payupSeq : 0),
      heckle: { stalls: 0, lastAct: this.now, open: false, forever: false, lastAt: -1e9, n: 0 } };   // v0.4 Heckle
    this.emit('turn', { pid: p.id });
  };
  G.nextAfter = function (p) {
    var i = this.players.indexOf(p);
    for (var k = 1; k <= this.players.length; k++) {
      var q = this.players[(i + k) % this.players.length];
      if ((i + k) % this.players.length <= i && k > 0 && !this._wrapped) { this._wrapped = true; }
      if (!q.bankrupt) return q;
    }
    return p;
  };
  G.endTurn = function () {
    if (this.phase !== 'play') return;
    var p = this.cur();
    var i = this.players.indexOf(p), n = this.players.length, next = null, wrapped = false;
    for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (j <= i) wrapped = true; if (!this.players[j].bankrupt) { next = this.players[j]; break; } }
    if (!next) { this.finish('last'); return; }
    if (wrapped) this.round++;
    if (this.timed() && this.now >= this.endsAt) { this.finish('time'); return; }
    if (this.round > C.maxRounds) { this.finish('rounds'); return; }
    this.beginTurn(next);
  };

  // ------------------------------------------------------------------ STATS (for the results podium)
  G.statsOf = function (p) {
    if (!p.stats) p.stats = { rent: 0, bigRent: 0, bigRentSp: -1, rentBy: {}, bestTrade: 0, caught: 0, missed: 0, auctions: 0, snow: 0 };
    return p.stats;
  };
  G.sideValue = function (side) {
    var v = (side && side.cash) || 0;
    ((side && side.props) || []).forEach(function (sp) { v += S[sp].price || 0; });
    return v + ((side && side.passes) || 0) * 50;
  };
  G.trackStat = function (type, d) {
    var self = this, st = function (id) { var p = self.byId(id); return p ? self.statsOf(p) : null; }, s;
    if (type === 'pay' && typeof d.to === 'number' && /^rent on /.test(d.reason || '')) {
      s = st(d.to); if (!s) return;
      var nm = d.reason.slice(8), sp = -1;
      for (var i = 0; i < S.length; i++) if (S[i].name === nm) { sp = i; break; }
      s.rent += d.amount; s.rentBy[sp] = (s.rentBy[sp] || 0) + d.amount;
      if (d.amount > s.bigRent) { s.bigRent = d.amount; s.bigRentSp = sp; }
    } else if (type === 'caught') { s = st(d.owner); if (s) s.caught++; }
    else if (type === 'slipped') { s = st(d.owner); if (s) s.missed++; }
    else if (type === 'auctionWon') { s = st(d.pid); if (s) s.auctions++; }
    else if (type === 'whiteout') { s = st(d.pid); if (s) s.snow++; }
    else if (type === 'tradeDone') {
      var t = this.tradeById(d.id); if (!t) return;
      var gainA = this.sideValue(t.bGives) - this.sideValue(t.aGives);
      s = st(t.a); if (s && gainA > s.bestTrade) s.bestTrade = gainA;
      s = st(t.b); if (s && -gainA > s.bestTrade) s.bestTrade = -gainA;
    }
  };
  G.placeName = function (sp) { return sp >= 0 && S[sp] ? S[sp].short.replace(/ (Avenue|Street)$/, '') : ''; };
  G.topSpot = function (s) {
    var best = -1, amt = 0; Object.keys(s.rentBy).forEach(function (k) { if (+k >= 0 && s.rentBy[k] > amt) { amt = s.rentBy[k]; best = +k; } });
    return best;
  };
  // one fun title each: the strongest claim on each title wins it, nobody gets two
  G.awardTitles = function (list) {
    var self = this, titled = {}, out = {};
    var pick = function (title, metric, min) {
      var best = null, bv = min - 1e-9;
      list.forEach(function (p) { if (titled[p.id]) return; var v = metric(p); if (v >= min && v > bv) { bv = v; best = p; } });
      if (best) { titled[best.id] = 1; out[best.id] = typeof title === 'function' ? title(best) : title; }
    };
    var S_ = function (p) { return self.statsOf(p); };
    pick(function (p) { return 'Landlord of ' + self.placeName(self.topSpot(S_(p))); }, function (p) { return self.topSpot(S_(p)) >= 0 ? S_(p).rent : 0; }, 1);
    pick('Snowbank Regular', function (p) { return S_(p).snow; }, 2);
    pick('Quickest Draw in Red Deer', function (p) { return S_(p).caught; }, 3);
    pick('Auction Hawk', function (p) { return S_(p).auctions; }, 2);
    pick('Deal Maker', function (p) { return S_(p).bestTrade; }, 1);
    pick('Asleep at the Till', function (p) { return S_(p).missed; }, 2);
    list.forEach(function (p) { if (p.bankrupt && !p.left && p.bustOwed > 0) { titled[p.id] = 1; out[p.id] = 'Skipped Town Owing ' + money(p.bustOwed); } });
    list.forEach(function (p) {
      if (titled[p.id]) return;
      var s = S_(p), spot = self.topSpot(s);
      out[p.id] = p.left ? 'Gone Fishin\'' : spot >= 0 ? 'Landlord of ' + self.placeName(spot)
        : p.bankrupt ? 'Down but Not Out' : s.snow ? 'Snowbank Regular' : 'Just Passing Through';
    });
    return out;
  };

  G.finish = function (why) {
    if (this.phase === 'over') return;
    var self = this; this.updateStates();
    var ranked = this.players.slice().sort(function (a, b) {
      if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
      if (a.bankrupt) return (a.place || 99) - (b.place || 99);
      return self.worthOf(b) - self.worthOf(a);
    });
    var titles = this.awardTitles(ranked);
    this.results = ranked.map(function (p, k) {
      var st = self.statsOf(p);
      return { pid: p.id, name: p.name, charId: p.charId, color: p.color, worth: p.bankrupt ? 0 : self.worthOf(p), bankrupt: p.bankrupt, left: p.left || null, owed: p.bankrupt && !p.left ? p.bustOwed || 0 : 0, place: k + 1, state: p.state,
        title: titles[p.id], stats: { bigRent: st.bigRent, bigRentAt: self.placeName(st.bigRentSp), bestTrade: st.bestTrade, caught: st.caught, missed: st.missed, auctions: st.auctions, snow: st.snow, rent: st.rent } };
    });
    this.phase = 'over'; this.overWhy = why;
    if (this.turn) this.turn.stage = 'over';
    this.addLog(ranked[0].name + ' WINS!');
    this.emit('over', { winner: ranked[0].id, why: why });
  };

  G.rollDice = function (n) { var d = []; for (var i = 0; i < (n || 2); i++) d.push(1 + Math.floor(this.rand() * 6)); return d; };
  G.doRoll = function (p) {
    var t = this.turn, d = this.forceDice || this.rollDice(2); this.forceDice = null;
    t.roll = { d: d, total: d[0] + d[1], dbl: d[0] === d[1] }; t.rollSeq++;
    t.stage = 'rolling'; t.rollEnd = this.now + this.ms(C.timing.roll);
    t.buy = null; t.card = null; t.dblRent = false;
    this.emit('roll', { pid: p.id, d: d, total: t.roll.total, dbl: t.roll.dbl, snow: p.snow });
  };
  // after the dice stop
  G.afterRoll = function () {
    var t = this.turn, p = this.cur(), r = t.roll;
    if (p.snow) {
      if (r.dbl) { p.snow = false; p.snowTries = 0; t.canRollAgain = false; t.noExtra = true; this.addLog(p.name + ' rolled doubles and drove out of the Snowbank!'); this.emit('free', { pid: p.id, how: 'doubles' }); this.startMove(p, r.total, false); return; }
      p.snowTries++;
      if (p.snowTries >= C.snowTries) {
        this.addLog(p.name + ' called the tow truck after ' + C.snowTries + ' tries.');
        p.snow = false; p.snowTries = 0; t.noExtra = true;
        this.emit('free', { pid: p.id, how: 'tow' });
        if (!this.charge(p, C.towFee, this.feeDest(), 'tow')) { if (p.bankrupt) return; }
        this.startMove(p, r.total, false); return;
      }
      this.addLog(p.name + ' is still stuck in the Snowbank (' + p.snowTries + '/' + C.snowTries + ').');
      t.stage = 'act'; t.canRollAgain = false; this.emit('stuck', { pid: p.id, tries: p.snowTries });
      return;
    }
    if (r.dbl) t.doubles++;
    if (r.dbl && t.doubles >= C.triplesToSnowbank) { this.addLog(p.name + ' rolled doubles ' + t.doubles + ' times: WHITEOUT!'); this.sendToSnowbank(p, 'triples'); return; }
    t.canRollAgain = r.dbl && !t.noExtra;
    this.startMove(p, r.total, false);
  };
  G.startMove = function (p, steps, card) {
    var t = this.turn, path = [], pos = p.pos, dir = steps < 0 ? -1 : 1;
    for (var k = 0; k < Math.abs(steps); k++) { pos = (pos + dir + 40) % 40; path.push(pos); }
    t.stage = 'moving';
    t.moving = { from: p.pos, path: path, start: this.now, step: this.ms(C.timing.step * (card ? 0.55 : 1)), back: dir < 0 };
    t.moveEnd = this.now + t.moving.step * path.length + this.ms(C.timing.afterMove);
    this.emit('move', { pid: p.id, path: path, back: dir < 0 });
  };
  G.moveToSpace = function (p, target) {   // forward to a target (cards); collect if passing
    var steps = (target - p.pos + 40) % 40; if (steps === 0) steps = 40;
    this.startMove(p, steps, true);
  };
  G.afterMove = function () {
    var t = this.turn, p = this.cur(), m = t.moving; t.moving = null;
    var end = m.path[m.path.length - 1];
    if (!m.back) {
      var passed = false; for (var k = 0; k < m.path.length; k++) if (m.path[k] === 0) passed = true;
      if (passed) {
        var exact = end === 0, pay = exact && this.rules.bullseye ? C.bullseyePay : C.halfwayPay;
        p.halfwayPasses++; p.laps++;
        if (this.perk(p, 'cody') && p.halfwayPasses % 2 === 0) pay += 100;
        this.give(p, pay, 'halfway');
        this.addLog(p.name + (exact ? ' landed on' : ' passed') + ' THE HALFWAY: +' + money(pay) + (exact && this.rules.bullseye ? ' (BULLSEYE!)' : ''));
        this.emit('halfway', { pid: p.id, amount: pay, exact: exact });
      }
    }
    p.pos = end;
    this.land(p);
  };
  G.land = function (p) {
    var t = this.turn, s = S[p.pos], pr = this.props[p.pos];
    t.stage = 'act'; t.landedAt = this.now;
    t.graceUntil = 0;     // v0.3: no PASS DICE lockout on your own deed, an unowned one or a plain space (only where PAY UP can happen, below)
    this.emit('land', { pid: p.id, sp: p.pos });
    if (pr) {
      if (pr.owner < 0) { t.buy = p.pos; this.emit('offer', { pid: p.id, sp: p.pos }); }
      else if (pr.owner !== p.id) {
        var owner = this.byId(pr.owner);
        if (pr.hocked) this.addLog(s.name + ' is mortgaged: no rent.');
        else if (owner && !owner.bankrupt) {
          if (this.rules.payupRace) {
            t.payupSeq = (t.payupSeq || 0) + 1;
            t.payup = { owner: owner.id, sp: p.pos, mover: p.id, roll: t.roll ? t.roll.total : 7, dbl: !!t.dblRent, openedAt: this.now, caught: false, done: false, seq: t.payupSeq };
            t.graceUntil = this.now + this.ms(this.rules.kidMode ? C.payup.kidGraceMs : C.payup.graceMs);   // v0.1.1: no quick-tap sniping past PAY UP
            this.emit('payupOpen', { pid: p.id, owner: owner.id, sp: p.pos, rent: this.rentFor(p.pos, t.payup.roll, t.payup.dbl) });
          } else {
            var amt = this.rentFor(p.pos, t.roll ? t.roll.total : 7, t.dblRent);
            this.charge(p, amt, owner.id, 'rent on ' + s.name);
            if (this.perk(owner, 'minh')) this.give(owner, 10, 'regulars');
            this.afterPay();
          }
        }
      }
    } else if (s.type === 'tax') {
      this.addLog(p.name + ' hit ' + s.name + ': ' + money(s.amount));
      this.emit('tax', { pid: p.id, amount: s.amount });
      this.charge(p, s.amount, this.feeDest(), s.name); this.afterPay();
    } else if (s.type === 'random' || s.type === 'finds') {
      this.drawCard(p, s.type);
    } else if (s.type === 'whiteout') {
      this.sendToSnowbank(p, 'corner');
    } else if (s.type === 'dirtlot') {
      if (this.rules.jackpot && this.pot > 0) {
        var won = this.pot; this.give(p, won, 'jackpot'); this.pot = C.jackpotSeed;
        this.addLog(p.name + ' found THE SECRET DIRT LOT jackpot: +' + money(won) + '!');
        this.emit('jackpot', { pid: p.id, amount: won });
      } else this.emit('dirtlot', { pid: p.id });
    } else if (s.type === 'snowbank') this.emit('drivingBy', { pid: p.id });
    this.updateStates();
  };
  G.sendToSnowbank = function (p, why) {
    var t = this.turn;
    if (this.perk(p, 'dez') && !p.perk.ironNeck) {
      p.perk.ironNeck = true; this.addLog('Iron Neck! ' + p.name + ' shrugs off the WHITEOUT.');
      this.emit('perk', { pid: p.id, perk: 'Iron Neck' });
      if (t && t.pid === p.id) { t.stage = 'act'; t.canRollAgain = false; }
      return;
    }
    p.pos = 10; p.snow = true; p.snowTries = 0;
    if (t && t.pid === p.id) { t.stage = 'act'; t.canRollAgain = false; t.buy = null; }
    this.addLog(p.name + ' hit the ditch: STUCK IN THE SNOWBANK.');
    this.emit('whiteout', { pid: p.id, why: why });
  };
  G.drawCard = function (p, deck) {
    var d = this.decks[deck], idx = d.shift(), card = B.DECKS[deck][idx];
    if (card.fx.k !== 'pass') d.push(idx);
    var t = this.turn; t.stage = 'card'; t.card = { deck: deck, idx: idx, until: this.now + this.ms(C.timing.card) };
    this.addLog(p.name + ' drew ' + C.decks[deck].name + ': ' + card.h, [deck, idx]);   // v0.4: phones can open any drawn card from the history
    this.cardsDrawn.push([deck, idx, p.id, this.round]); if (this.cardsDrawn.length > 60) this.cardsDrawn.shift();
    this.emit('card', { pid: p.id, deck: deck, idx: idx });
  };
  G.applyCard = function () {
    var t = this.turn, p = this.cur(), c = t.card, card = B.DECKS[c.deck][c.idx], fx = card.fx, self = this;
    t.stage = 'act'; t.cardDone = c; t.card = null;
    var capped = function (n) { return c.deck === 'random' && self.perk(p, 'doug') ? Math.min(n, 100) : n; };
    var bless = function (n) { return c.deck === 'finds' && self.perk(p, 'grace') ? n + 25 : n; };
    switch (fx.k) {
      case 'loseTurn':
        if (this.perk(p, 'lenore') && !p.perk.unbothered) { p.perk.unbothered = true; this.addLog('Unbothered. ' + p.name + ' ignores it.'); this.emit('perk', { pid: p.id, perk: 'Unbothered' }); }
        else { p.skip++; this.addLog(p.name + ' will miss a turn.'); }
        break;
      case 'repairs':
        var shops = 0, megas = 0; this.props.forEach(function (pr) { if (pr && pr.owner === p.id) { if (pr.shops === 5) megas++; else shops += pr.shops; } });
        var amt = capped(shops * fx.shop + megas * fx.mega);
        if (amt) { this.charge(p, amt, this.feeDest(), card.h); this.afterPay(); } else this.addLog('No Shops, nothing to pay.');
        break;
      case 'pay': this.charge(p, capped(fx.n), this.feeDest(), card.h); this.afterPay(); break;
      case 'collect': this.give(p, bless(fx.n), 'card'); break;
      case 'collectEach':
        this.alive().forEach(function (q) { if (q !== p) self.charge(q, fx.n, p.id, card.h); });
        if (this.perk(p, 'grace')) this.give(p, 25, 'blessing');
        this.afterPay(); break;
      case 'whiteout': this.sendToSnowbank(p, 'card'); break;
      case 'back': this.startMove(p, -fx.n, true); break;
      case 'moveTo': this.moveToSpace(p, fx.to); break;
      case 'nearestWhistle':
        var target = B.WHISTLES.filter(function (w) { return w > p.pos; })[0]; if (target == null) target = B.WHISTLES[0];
        t.dblRent = true; this.moveToSpace(p, target); break;
      case 'pass': p.passes.push(c.deck); this.addLog(p.name + ' keeps a Tow Truck Pass.'); break;
    }
    this.emit('cardDone', { pid: p.id });
    this.updateStates();
  };

  // ------------------------------------------------------------------ PAY UP
  G.closePayup = function (silent) {
    var t = this.turn, pu = t && t.payup; if (!pu || pu.done) return;
    pu.done = true;
    if (!pu.caught && !silent) {
      var owner = this.byId(pu.owner), mover = this.byId(pu.mover);
      this.addLog(mover.name + ' slipped away from ' + owner.name + '\'s ' + S[pu.sp].name + '!');
      this.emit('slipped', { pid: pu.mover, owner: pu.owner, sp: pu.sp });
    }
  };
  G.payup = function (pid) {
    var t = this.turn, pu = t && t.payup; if (!pu || pu.done || pu.caught || pu.owner !== pid) return false;
    var owner = this.byId(pid), mover = this.byId(pu.mover); if (!owner || owner.bankrupt) return false;
    pu.caught = true; pu.caughtAt = this.now;
    var amt = this.rentFor(pu.sp, pu.roll, pu.dbl); pu.amount = amt;
    this.addLog('PAY UP! ' + owner.name + ' caught ' + mover.name + ' on ' + S[pu.sp].name + ' for ' + money(amt) + '.');
    this.emit('caught', { pid: mover.id, owner: owner.id, sp: pu.sp, amount: amt, ms: this.now - pu.openedAt });
    this.charge(mover, amt, owner.id, 'rent on ' + S[pu.sp].name);
    if (this.perk(owner, 'minh') && !mover.bankrupt) this.give(owner, 10, 'regulars');
    pu.done = true;
    this.afterPay();
    return true;
  };

  // ------------------------------------------------------------------ trades & chat
  G.sideOk = function (pid, side) {
    var p = this.byId(pid), self = this; if (!p || p.bankrupt) return 'player gone';
    side.cash = Math.max(0, Math.floor(+side.cash || 0)); side.props = (side.props || []).map(Number); side.passes = Math.max(0, Math.floor(+side.passes || 0));
    if (side.cash > p.cash - this.lockedCash(p)) return p.name + ' doesn\'t have ' + money(side.cash) + ' free';
    if (side.passes > p.passes.length) return p.name + ' doesn\'t have that many Tow Passes';
    for (var i = 0; i < side.props.length; i++) {
      var sp = side.props[i], pr = this.props[sp];
      if (!pr || pr.owner !== pid) return S[sp] ? S[sp].name + ' isn\'t ' + p.name + '\'s' : 'bad deed';
      if (this.groupHasShops(S[sp].group)) return 'Sell the Shops on ' + B.GROUPS[S[sp].group].name + ' first';
      if (this.locked(sp)) return S[sp].name + ' is locked by the active turn \uD83D\uDD12';
    }
    return '';
  };
  G.tradeValid = function (t) {
    if (t.a === t.b) return 'Can\'t trade with yourself';
    var e = this.sideOk(t.a, t.aGives) || this.sideOk(t.b, t.bGives); if (e) return e;
    var empty = function (s) { return !s.cash && !s.props.length && !s.passes; };
    if (empty(t.aGives) && empty(t.bGives)) return 'The deal is empty';
    return '';
  };
  G.proposeTrade = function (from, to, give, get) {
    if (this.phase !== 'play') return 'No game running';
    var t = { id: this.tradeSeq++, a: from, b: to, aGives: give || {}, bGives: get || {}, v: 1, waiting: to, status: 'open', by: from, history: [], ts: this.now };
    var e = this.tradeValid(t); if (e) return e;
    t.history.push({ v: 1, by: from, ts: this.now });
    this.trades.push(t); if (this.trades.length > 80) this.trades.shift();
    this.emit('tradeOffer', { id: t.id, from: from, to: to });
    return '';
  };
  G.counterTrade = function (pid, id, give, get) {
    var t = this.tradeById(id); if (!t || t.status !== 'open') return 'That deal is closed';
    if (pid !== t.a && pid !== t.b) return 'Not your deal';
    var other = pid === t.a ? t.b : t.a;
    var nt = { a: t.a, b: t.b, aGives: pid === t.a ? give : get, bGives: pid === t.a ? get : give };
    var e = this.tradeValid(nt); if (e) return e;
    t.aGives = nt.aGives; t.bGives = nt.bGives; t.v++; t.waiting = other; t.by = pid; t.ts = this.now;
    t.history.push({ v: t.v, by: pid, ts: this.now });
    this.emit('tradeOffer', { id: t.id, from: pid, to: other, counter: true });
    return '';
  };
  G.tradeById = function (id) { for (var i = 0; i < this.trades.length; i++) if (this.trades[i].id === +id) return this.trades[i]; return null; };
  G.acceptTrade = function (pid, id) {
    var t = this.tradeById(id); if (!t || t.status !== 'open' || t.waiting !== pid) return 'That deal is not waiting on you';
    var e = this.tradeValid(t); if (e) { t.status = 'stale'; t.why = e; this.emit('tradeStale', { id: t.id }); return 'Deal went stale: ' + e; }
    var A = this.byId(t.a), Bp = this.byId(t.b), self = this;
    var move = function (from, to, side) {
      from.cash -= side.cash; to.cash += side.cash;
      side.props.forEach(function (sp) { self.props[sp].owner = to.id; });
      for (var k = 0; k < side.passes; k++) to.passes.push(from.passes.pop());
    };
    move(A, Bp, t.aGives); move(Bp, A, t.bGives);
    t.status = 'accepted'; t.ts = this.now;
    this.addLog('\uD83E\uDD1D A deal went down.');
    this.emit('tradeDone', { id: t.id, a: t.a, b: t.b });
    this.checkTrades(); this.updateStates();
    if (this.turn && this.turn.tab) this.settleTab();
    return '';
  };
  G.declineTrade = function (pid, id) {
    var t = this.tradeById(id); if (!t || t.status !== 'open') return 'closed';
    if (t.waiting === pid) t.status = 'declined'; else if (pid === t.a || pid === t.b) t.status = 'cancelled'; else return 'Not your deal';
    t.ts = this.now; t.closedBy = pid;
    this.emit('tradeClosed', { id: t.id, by: pid, status: t.status });
    return '';
  };
  G.checkTrades = function () {     // offers go stale when an included asset changed hands
    var self = this;
    this.trades.forEach(function (t) {
      if (t.status !== 'open') return;
      var bad = false;
      [[t.a, t.aGives], [t.b, t.bGives]].forEach(function (x) {
        var p = self.byId(x[0]); if (!p || p.bankrupt) { bad = true; return; }
        (x[1].props || []).forEach(function (sp) { if (self.props[sp].owner !== x[0]) bad = true; });
        if ((x[1].passes || 0) > p.passes.length) bad = true;
      });
      if (bad) { t.status = 'stale'; t.why = 'something in it changed hands'; self.emit('tradeStale', { id: t.id }); }
    });
  };
  G.chat = function (from, to, text) {
    text = String(text || '').replace(/[<>]/g, '').trim().slice(0, 200); if (!text) return;
    if (to !== 'all') { to = +to; if (!this.byId(to)) return; }
    this.chats.push({ id: this.chats.length + 1, from: from, to: to, text: text, ts: this.now });
    if (this.chats.length > 400) this.chats.splice(0, 100);
    this.emit('chat', { from: from, to: to, text: text });
  };

  // ------------------------------------------------------------------ intents (phones, keyboard, AI)
  G.intent = function (pid, m) {
    var p = this.byId(pid); if (!p || !m) return 'no player';
    var t = this.turn, active = t && t.pid === pid && this.phase === 'play', r = '';
    switch (m.t) {
      case 'chat': this.chat(pid, m.to, m.text); return '';
      case 'char': return this.setChar(pid, m.id) ? '' : 'taken';
    }
    if (m.t === 'heckle') return this.heckle(pid);                       // v0.4: bankrupt players can still heckle from the rail
    if (active) this.heckleAct();                                         // any move by the active player locks the heckle button again
    if (this.phase !== 'play' || p.bankrupt) return 'not playing';
    switch (m.t) {
      case 'roll':
        if (!active) return 'not your turn';
        if (t.stage === 'roll') {
          if (t.tab) return 'Settle your Tab first';
          this.doRoll(p); return '';
        }
        if (t.stage === 'act' && t.canRollAgain && !t.tab) {
          if (this.now < t.graceUntil) return 'wait';
          if (t.auction) return 'Auction running';
          if (t.buy != null) { this.passOnBuy(); if (t.auction) return 'Auction first!'; }
          this.closePayup(); t.canRollAgain = false; this.doRoll(p); return '';
        }
        return 'can\'t roll now';
      case 'payTow':
        if (!active || t.stage !== 'roll' || !p.snow) return 'no';
        if (p.cash < C.towFee) return 'Not enough cash';
        this.charge(p, C.towFee, this.feeDest(), 'tow'); p.snow = false; p.snowTries = 0; t.noExtra = false;
        this.addLog(p.name + ' paid the tow truck.'); this.emit('free', { pid: p.id, how: 'paid' }); this.afterPay(); return '';
      case 'usePass':
        if (!active || t.stage !== 'roll' || !p.snow || !p.passes.length) return 'no';
        this.returnPass(p.passes.pop()); p.snow = false; p.snowTries = 0;
        this.addLog(p.name + ' used a Tow Truck Pass.'); this.emit('free', { pid: p.id, how: 'pass' }); this.checkTrades(); return '';
      case 'buy':
        if (!active || t.stage !== 'act' || t.buy !== p.pos) return 'Nothing to buy';
        var price = this.priceFor(p, p.pos);
        if (p.cash < price) return 'Not enough cash';
        p.cash -= price; this.props[p.pos].owner = p.id; t.buy = null;
        if (this.perk(p, 'priya') && price < S[p.pos].price) p.preLap = p.laps;
        this.addLog(p.name + ' bought ' + S[p.pos].name + ' for ' + money(price));
        this.emit('buy', { pid: p.id, sp: p.pos, price: price }); this.updateStates(); return '';
      case 'skipBuy':
        if (!active || t.buy == null) return 'no';
        this.emit('skipBuy', { pid: p.id }); this.passOnBuy(); return '';
      case 'pass':
        if (!active) return 'not your turn';
        if (t.stage !== 'act') return 'not now';
        if (t.tab) return 'Settle your Tab first';
        if (t.canRollAgain) return 'You rolled doubles: roll again';
        if (this.now < t.graceUntil) return 'wait';
        if (t.auction) return 'Auction running';
        if (t.buy != null) { this.passOnBuy(); if (t.auction) return 'Auction first!'; }
        if (t.payup && !t.payup.done) {
          var owner = this.byId(t.payup.owner);
          if (owner && this.perk(owner, 'mike')) { t.stage = 'closing'; t.closeAt = this.now + this.ms(C.payup.loudAmpMs); this.emit('loudAmp', { owner: owner.id }); return ''; }
          this.closePayup();
        }
        t.stage = 'ended'; t.endAt = this.now + this.ms(C.timing.turnGap);
        this.emit('passDice', { pid: pid });
        return '';
      case 'payup': return this.payup(pid) ? '' : 'too late';
      case 'bid': return this.bid(pid, +m.add);
      case 'build': r = this.build(p, +m.sp); return r;
      case 'sell': r = this.sellShop(p, +m.sp); if (!r && active && t.tab) this.settleTab(); return r;      // v0.4 PAID IN FULL the moment there's enough
      case 'hock': r = this.hock(p, +m.sp); if (!r && active && t.tab) this.settleTab(); return r;
      case 'unhock': return this.unhock(p, +m.sp);
      case 'raise':
        if (!active || !t.tab) return 'no tab';
        this._raising = true; this.autoRaise(p, t.tab.amount); this.settleTab(); this._raising = false; return '';
      case 'giveUp':
        if (!active || !t.tab) return 'no tab';
        if (this.liquidValue(p) >= t.tab.amount) return 'You can still raise the cash';
        var to = t.tab.to, debt = t.tab.amount; t.tab = null; this.bankrupt(p, to, debt); return '';
      case 'trade': return this.proposeTrade(pid, +m.to, m.give, m.get);
      case 'counter': return this.counterTrade(pid, +m.id, m.give, m.get);
      case 'accept': return this.acceptTrade(pid, +m.id);
      case 'decline': return this.declineTrade(pid, +m.id);
    }
    return 'unknown';
  };
  // ------------------------------------------------------------------ auctions (v0.1.1)
  G.startAuction = function (sp) {
    var t = this.turn; if (!t || t.auction || !this.props[sp] || this.props[sp].owner >= 0) return;
    this.auctionSeq = (this.auctionSeq || 0) + 1;
    t.auction = { sp: sp, bid: C.auction.start, leader: -1, bids: 0, endsAt: this.now + this.ms(C.auction.ms), seq: this.auctionSeq };
    this.addLog(S[sp].name + ' goes to auction (from ' + money(C.auction.start) + ').');
    this.emit('auctionStart', { sp: sp, bid: C.auction.start }); this.changed();
  };
  G.maxBid = function (p) { return p.cash - this.lockedCash(p); };
  G.bid = function (pid, add) {
    var t = this.turn, a = t && t.auction, p = this.byId(pid);
    if (!a) return 'No auction running';
    if (!p || p.bankrupt) return 'no';
    if (C.auction.steps.indexOf(add) < 0) return 'Bad bid';
    if (a.leader === pid) return 'You\'re already the top bidder';
    var amt = a.bid + add;
    if (amt > this.maxBid(p)) return 'Not enough cash for ' + money(amt);
    a.bid = amt; a.leader = pid; a.bids++; a.endsAt = this.now + this.ms(C.auction.ms);
    this.emit('bid', { pid: pid, amount: amt, sp: a.sp }); this.changed();
    return '';
  };
  G.endAuction = function () {
    var t = this.turn, a = t && t.auction; if (!a) return;
    t.auction = null;
    var w = a.leader >= 0 ? this.byId(a.leader) : null, s = S[a.sp];
    if (w && !w.bankrupt && w.cash >= a.bid && this.props[a.sp].owner < 0) {
      w.cash -= a.bid; this.props[a.sp].owner = w.id;
      this.addLog(w.name + ' won ' + s.name + ' at auction for ' + money(a.bid) + '.');
      this.emit('auctionWon', { pid: w.id, sp: a.sp, price: a.bid });
      this.checkTrades(); this.updateStates();
    } else {
      this.addLog('No sale: the bank keeps ' + s.name + '.');
      this.emit('auctionNone', { sp: a.sp });
    }
    this.changed();
  };
  // the active player declined (or walked past) a deed: hammer time
  G.passOnBuy = function () {
    var t = this.turn, sp = t.buy; t.buy = null;
    if (sp != null && this.rules.auctions) this.startAuction(sp);
  };
  G.priceFor = function (p, sp) {
    var price = S[sp].price;
    if (this.perk(p, 'priya') && p.preLap !== p.laps) price = Math.round(price * 0.9);
    return price;
  };

  // ------------------------------------------------------------------ heckle (v0.4 house rule)
  // Inactivity only counts while the game is waiting on the active human (roll / act stages, no auction running).
  // Stall 1 unlocks after afterMs[0], stall 2 after afterMs[1], stall 3 after afterMs[2] and then stays open for the turn.
  G.heckleAct = function () {
    var h = this.turn && this.turn.heckle; if (!h) return;
    h.lastAct = this.now;
    if (h.open && !h.forever) { h.open = false; this.emit('heckleClose', { pid: this.turn.pid }); }
  };
  G.heckleTick = function (now) {
    var t = this.turn, h = t && t.heckle, p = this.cur(); if (!h) return;
    if (!this.rules.heckle || !p || this.isBot(p)) { if (h.open) { h.open = false; h.forever = false; this.changed(); } h.lastAct = now; return; }
    if (h.forever) return;
    if (!((t.stage === 'roll' || t.stage === 'act') && !t.auction)) { h.lastAct = now; if (h.open) { h.open = false; this.changed(); } return; }
    if (!h.open && now - h.lastAct >= this.ms(C.heckle.afterMs[Math.min(h.stalls, 2)])) {
      h.open = true; h.stalls++; if (h.stalls >= 3) h.forever = true;
      this.emit('heckleOpen', { pid: p.id, stalls: h.stalls });
    }
  };
  G.heckle = function (from) {
    var t = this.turn, h = t && t.heckle, p = this.byId(from);
    if (this.phase !== 'play' || !h || !h.open || !this.rules.heckle || !p || p.id === t.pid) return 'no';
    var now = this.now, gaps = this.heckleGap || (this.heckleGap = {});
    if (now - (gaps[from] || -1e9) < C.heckle.gapMs || now - h.lastAt < C.heckle.targetGapMs) return 'wait';   // light rate limit (real time)
    gaps[from] = now; h.lastAt = now; h.n++;
    this.emit('heckle', { pid: t.pid, from: from, n: h.n });
    return '';
  };

  // ------------------------------------------------------------------ clock
  G.tick = function (now) {
    this.now = now;
    if (this.phase !== 'play' || !this.turn) return;
    var t = this.turn, guard = 0;
    if (t.auction && now >= t.auction.endsAt) this.endAuction();
    while (guard++ < 8) {
      var st = t.stage;
      if (st === 'rolling' && now >= t.rollEnd) this.afterRoll();
      else if (st === 'moving' && now >= t.moveEnd) this.afterMove();
      else if (st === 'card' && now >= t.card.until) this.applyCard();
      else if (st === 'closing' && now >= t.closeAt) {
        if (t.tab) { t.stage = 'act'; }
        else { this.closePayup(); t.stage = 'ended'; t.endAt = now + this.ms(C.timing.turnGap); this.emit('passDice', { pid: t.pid }); }
      }
      else if (st === 'ended' && now >= t.endAt) {
        if (t.auction) break;                                                   // v0.2: a bust-sale auction finishes first
        if (this.auctionQ && this.auctionQ.length) { var qsp = this.auctionQ.shift(); if (this.props[qsp] && this.props[qsp].owner < 0) this.startAuction(qsp); if (t.auction) break; continue; }
        this.endTurn(); t = this.turn; if (this.phase !== 'play') return;
      }
      else break;
      if (this.phase !== 'play') return;
      t = this.turn;
    }
    if (t.tab) { var p = this.cur(); if (p && p.cash >= t.tab.amount) this.settleTab(); }
    this.heckleTick(now);
    if (this.timed() && now >= this.endsAt && t.stage === 'roll') this.finish('time');
  };

  Game.money = money; Game.charById = charById;
  root.RDRGame = Game;
})(typeof window !== 'undefined' ? window : globalThis);
