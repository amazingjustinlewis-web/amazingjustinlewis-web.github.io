/* Zero to Phi dev kit - AI playtest panel v0.4: Red Deer Rich adapter v0.3.
   v0.4: TV index_v077 + controller_v077 (explore-after-pick lobby), curious AIs keep browsing after they pick (never
   unpick), host mode (auto / me / first AI) and pace (catch window) from the panel, a viewer URL for the breakout
   window, and soundHook() so the panel can light up / gate each phone's sound effects.
   v0.1 notes:
   One shared room: the panel opens the real TV board (rdr-phone/index.html) and points every simulated phone at the
   real phone controller (rdr-phone/controller.html?room=CODE). Each phone is driven by an autopilot that only reads
   what that phone can see (RDRC.state(), the phone's own private state) and taps the real buttons in its DOM.
   No game code is changed. Anyone (Justin's own phone) can scan the room QR and join the same game.

   Adapter contract (see panel_v01.js, ZTPSim.register):
     tv: { w, h }, phone: { portrait: [w,h], landscape: [w,h] }, lengths
     tvUrl(o) / phoneUrl(o, persona) / joinUrl(o)      o = { code, local, speed, length }
     tvInfo(win)          -> { ok, online, code, status, phase, round, turnPid, turnName, players: [...] }
     tvLog(win, cursor)   -> { lines: [string], cursor }
     setPaused(win, on), setSpeed(win, x), forceStart(win), muteTv(win, on)
     phoneReady(win)      -> bool
     phoneInfo(win)       -> { screen, cash, label } for the stat strip
     pilot(persona, human, api) -> { tick(now), ready() }   api: see panel_v01.js */
(function () {
  'use strict';
  var BASE = '../rdr-phone/';
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function vis(el) { if (!el) return false; if (el.hidden) return false; for (var e = el; e && e.nodeType === 1; e = e.parentElement) { if (e.hidden) return false; } return el.getClientRects().length > 0; }

  var A = {
    id: 'rdr', name: 'Red Deer Rich', ver: 'TV + phones (dev v0.7.7)',
    tv: { w: 1920, h: 1080 },
    phone: { portrait: [390, 844], landscape: [844, 390] },
    lengths: [['regular', 'Regular'], ['medium', 'Medium'], ['quick', 'Quick']],
    minPlayers: 2,
    tvUrl: function (o) { return BASE + 'index_v077.html?room=' + o.code + '&mute=1' + (o.local ? '&local=1' : '') + (o.speed > 1 ? '&speed=' + o.speed : '') + '&sim=1'; },
    viewerUrl: function (o) { return new URL(BASE + 'index_v077.html?viewer=' + o.code + (o.local ? '&local=1' : '') + '&mute=1', location.href).href; },
    phoneUrl: function (o, p) { return BASE + 'controller_v077.html?room=' + o.code + '&auto=1&name=' + encodeURIComponent(p.name) + '&cid=' + encodeURIComponent('sim-' + p.id + '-' + o.code) + (o.local ? '&local=1' : '') + '&sim=1'; },
    joinUrl: function (o) { return new URL(BASE + 'controller_v077.html?room=' + o.code, location.href).href; },
    tvInfo: function (w) {
      var R = w && w.RDR; if (!R || !R.game) return { ok: false };
      var g = R.game, net = R.net && R.net(), cur = g.turn && g.players.filter(function (q) { return q.id === g.turn.pid; })[0];
      return { ok: true, online: !!net && net.status === 'online', code: net ? net.code : '', status: net ? net.status : 'none', phase: g.phase, round: g.round || 0,
        paused: !!g.paused, turnPid: g.turn ? g.turn.pid : null, turnName: cur ? cur.name : '', stage: g.turn ? g.turn.stage : '',
        players: g.players.map(function (q) { return { id: q.id, name: q.name, cash: q.cash, color: q.color, ai: !!q.ai, bankrupt: !!q.bankrupt, connected: q.connected !== false }; }) };
    },
    tvLog: function (w, cur) {
      var g = w && w.RDR && w.RDR.game; if (!g || !g.log) return { lines: [], cursor: cur };
      var out = [], i, L = g.log; cur = cur || { last: null, seen: 0 };
      var start = 0; if (cur.last) { i = L.indexOf(cur.last); start = i >= 0 ? i + 1 : 0; }
      for (i = start; i < L.length; i++) out.push(L[i].s);
      return { lines: out, cursor: { last: L.length ? L[L.length - 1] : cur.last } };
    },
    setPaused: function (w, on) { try { if (w.RDR && w.RDR.game && w.RDR.game.phase === 'play') w.RDR.setPause(on); } catch (e) {} },
    setSpeed: function (w, x) { try { if (w.RDR && w.RDR.game) w.RDR.game.speed = x; } catch (e) {} },
    forceStart: function (w) { try { if (w.RDR && w.RDR.game.phase !== 'play') w.RDR.startGame(); } catch (e) {} },
    muteTv: function (w, on) { try { w.RDR.sfx.setMuted(on); } catch (e) {} },
    mutePhone: function (w, on) { try { w.RDRSfx.setMuted(on); } catch (e) {} },
    // every effect a phone plays goes through RDRSfx.play (the controller looks it up on the shared object each time)
    soundHook: function (w, cb) { try { var S = w.RDRSfx; if (!S || S._simHooked) return false; var orig = S.play; S._simHooked = true; S.play = function (n) { try { cb(n); } catch (e) {} return orig.apply(this, arguments); }; return true; } catch (e) { return false; } },
    unlockPhone: function (w) { try { w.RDRSfx.unlock(); } catch (e) {} },
    setCatch: function (w, sec) { try { var g = w.RDR.game; if (g && g.phase !== 'play' && g.catchSec !== sec) { g.catchSec = sec; g.changed && g.changed(); } } catch (e) {} },
    phoneReady: function (w) { return !!(w && w.RDRC && w.document && w.document.getElementById('join')); },
    phoneInfo: function (w) {
      var C = w && w.RDRC, st = C && C.state(); if (!st) return { screen: 'join', label: 'joining\u2026' };
      var me = st.me || {};
      return { screen: st.phase, cash: me.cash, label: st.phase === 'play' ? (me.bankrupt ? 'BUST' : money(me.cash)) + ' \u00b7 worth ' + money(me.worth || 0) : st.phase === 'lobby' ? 'in the lobby' : 'game over',
        myTurn: !!(st.turn && st.turn.pid === me.id), vip: !!me.vip };
    },
    pilot: function (p, h, api) { return new Pilot(p, h, api); }
  };

  // ------------------------------------------------------------------ autopilot
  function Pilot(p, h, api) {
    this.p = p; this.h = h; this.api = api; this.todo = []; this.picked = false; this.browseAt = 0; this.chatAt = Date.now() + 20000 + Math.random() * 40000;
    this.heckleAt = 0; this.builtTurn = -1; this.lastTurnKey = ''; this.aucKey = ''; this.aucNext = 0; this.carSteps = Math.floor(Math.random() * 4); this.joinedAt = Date.now();
    this.voteKey = ''; this.sheetKey = ''; this.puKey = ''; this.buyKey = ''; this.aiAdded = false; this.overKey = '';
    var res = 60 + p.smarts * 22; if (p.quirk === 'saver') res *= 1.8; if (p.quirk === 'spender') res *= 0.4; if (p.temper >= 8) res *= 0.8; this.reserve = res;
  }
  var P = Pilot.prototype;
  P.doc = function () { var w = this.api.win(); return w && w.document; };
  P.$ = function (id) { var d = this.doc(); return d && d.getElementById(id); };
  P.q = function (sel) { var d = this.doc(); return d && d.querySelector(sel); };
  P.qa = function (sel) { var d = this.doc(); return d ? Array.prototype.slice.call(d.querySelectorAll(sel)) : []; };
  P.ready = function () { return this.picked; };
  P.B = function () { var w = this.api.win(); return w && w.RDR_BOARD; };
  P.spName = function (sp) { var B = this.B(); return B && B.SPACES[sp] ? B.SPACES[sp].name : 'a deed'; };
  P.tab = function () { var b = this.q('#tabs button.on'); return b ? b.getAttribute('data-tab') : 'turn'; };
  // queue a step: weight = decision size (null = plain reaction), cap = caption, fn = the tap (re-finds its element)
  P.step = function (weight, cap, fn) { this.todo.push({ w: weight, cap: cap, fn: fn }); };
  P.tapSel = function (sel, what) { var self = this; return function () { var el = typeof sel === 'function' ? sel() : self.q(sel); if (!el || !vis(el) || el.disabled) return false; return self.api.tap(el, what); }; };
  P.goTab = function (t, cap) { if (this.tab() !== t) this.step(null, cap || null, this.tapSel('#tabs button[data-tab="' + t + '"]', t + ' tab')); };

  P.tick = function (now) {
    var api = this.api, w = api.win(); if (!w || !w.RDRC) return;
    if (this.todo.length) { var s = this.todo.shift(), d = s.w == null ? this.h.react() : this.h.think(s.w); api.plan(d, s.cap, s.fn); return; }
    var mv = this.$('mvNo'); if (mv && vis(mv)) { this.step(0.6, 'skips the "move game" pop-up', this.tapSel('#mvNo')); return; }
    var st = w.RDRC.state(), scr = ['join', 'lobby', 'game', 'over'].filter(function (k) { var e = w.document.getElementById(k); return e && !e.hidden; })[0];
    if (!st || scr === 'join') { if (now - this.joinedAt > 12000 && vis(this.$('joinBtn'))) { this.joinedAt = now; this.step(null, 'taps JOIN again', this.tapSel('#joinBtn')); } return; }
    if (scr === 'lobby') return this.lobby(st, now);
    if (scr === 'over') return this.over(st, now);
    if (scr === 'game') return this.game(st, now);
  };

  P.lobby = function (st, now) {
    var pk = this.$('pickBtn'), self = this, w = this.api.win(), L = w.RDRC.lobby ? w.RDRC.lobby() : null;
    if (!this.picked) {
      if (L && L.locked) { this.picked = true; this.api.log('picked ' + (pk && pk.textContent ? '' : '') + 'and is locked in'); this.curAt = now + this.curGap(); return; }
      if (this.carSteps > 0) { this.carSteps--; this.step(0.35, pick(['swipes through the characters\u2026', 'checks out the next character', 'browsing characters\u2026']), this.tapSel('#carNext')); return; }
      if (pk && pk.disabled) { this.step(0.2, 'that one\'s taken, next\u2026', this.tapSel('#carNext')); return; }
      if (pk && /^(PICK|KEEP) /.test(pk.textContent || '')) { var nm = pk.textContent.replace(/^(PICK|KEEP) /, ''); this.step(0.5, 'picks ' + nm, function () { var ok = self.tapSel('#pickBtn')(); if (ok) self.api.log('picks ' + nm); return ok; }); return; }
      if (!L && pk && /PICKED/.test(pk.textContent)) this.picked = true;      // old controller
      return;
    }
    // host phone: setup + START (unless the panel says a human runs the lobby)
    var hostOk = st.me.vip && this.api.ctx.hostMode() !== 'me';
    if (hostOk) {
      if (this.api.ctx.solo() && !this.aiAdded && st.players.length < 2) { this.aiAdded = true; this.step(0.5, 'adds a computer player so there are two', this.tapSel('#hAiAdd')); return; }
      var cs = this.api.ctx.catchSec(), sel = this.$('hCatch');
      if (sel && vis(sel) && +sel.value !== cs && this.catchSet !== cs) { this.catchSet = cs; this.step(0.5, 'sets the catch window to ' + cs + ' s', function () { var e = self.$('hCatch'); if (!e) return true; self.api.tap(e, 'catch window'); e.value = String(cs); e.dispatchEvent(new w.Event('change', { bubbles: true })); return true; }); return; }
      if (this.api.ctx.wantStart()) {
        var len = this.api.ctx.length();
        if (st.mode !== len && vis(this.q('#hMode button[data-mode="' + len + '"]'))) { this.step(0.4, 'sets the length: ' + len, this.tapSel('#hMode button[data-mode="' + len + '"]')); return; }
        if (st.players.length >= 2) { this.step(0.6, 'taps START GAME', function () { var ok = self.tapSel('#startBtn')(); if (ok) self.api.log('starts the game (' + st.players.length + ' players)', 'big'); return ok; }); return; }
      }
    }
    // curious: keep exploring after the pick (other characters, the options, turning the phone); never unpick
    if (now > (this.curAt || 0)) {
      this.curAt = now + this.curGap();
      var c = this.h.curious();
      if (this.h.chance(0.25 + c * 0.7)) {
        var r = Math.random();
        if (st.me.vip && r < 0.3 && vis(this.$('hOptToggle'))) {
          this.step(0.4, 'peeks at the game options', this.tapSel('#hOptToggle'));
          this.step(1.4, 'reads the options\u2026', function () { return true; });
          this.step(0.3, 'closes the options', function () { var o = self.$('hOpts'); return o && !o.hidden ? self.tapSel('#hOptToggle')() : true; });
        } else if (r < 0.82) {
          var n = 1 + Math.floor(Math.random() * (2 + c * 3)), dir = Math.random() < 0.7 ? '#carNext' : '#carPrev';
          for (var k = 0; k < n; k++) this.step(0.3 + Math.random() * 0.4, k ? pick(['and the next\u2026', 'ooh, who\'s this?', 'reads the perk\u2026']) : 'curious: browses the other characters', this.tapSel(dir));
          if (Math.random() < 0.5) { this.step(1, null, function () { return true; }); }
        } else if (this.api.rotate) { this.api.rotate('curious: turns the phone to see'); }
        return;
      }
    }
    this.api.idle(st.me.vip && this.api.ctx.hostMode() === 'me' ? 'host phone, waiting for you to start\u2026' : st.me.vip ? this.api.ctx.startNote() : 'waiting for the host\u2026');
  };
  P.curGap = function () { var c = this.h.curious(); return (5000 + (1 - c) * 16000) * (0.6 + Math.random() * 0.8) / this.api.speed(); };

  P.over = function (st, now) {
    var key = (st.results || []).map(function (r) { return r.name; }).join(',');
    if (this.overKey !== key) { this.overKey = key; var r = (st.results || [])[0]; if (r) this.api.caption(r.name === st.me.name ? '\uD83C\uDFC6 WON! ' + money(r.worth) : 'game over, ' + r.name + ' won'); this.overAt = now; }
    if (st.me.vip && this.api.ctx.autoReplay() && now - this.overAt > 9000 / this.api.speed() && vis(this.$('againBtn'))) { this.overAt = now + 1e9; this.step(0.5, 'taps PLAY AGAIN', this.tapSel('#againBtn')); }
  };

  P.game = function (st, now) {
    var me = st.me, t = st.turn, h = this.h, self = this, api = this.api;
    if (vis(this.$('pausePh'))) { api.idle('\u23F8 paused'); return; }
    if (me.observer) { api.idle('watching'); return; }
    // 1. PAY UP takeover: the most urgent thing on the phone
    var pu = this.$('payup');
    if (vis(pu) && t && t.payup) {
      var k = 'pu' + t.payup.seq;
      if (this.puKey !== k) { this.puKey = k; api.log('PAY UP alert on ' + this.spName(t.payup.sp)); }
      api.plan(h.react(0.75), '\u270B PAY UP! goes for it', this.tapSel('#puBtn'), true); return;
    }
    if (vis(this.$('boom'))) { if (h.chance(0.5)) this.step(null, 'groans, dismisses CAUGHT', this.tapSel('#boom')); else api.idle('\uD83D\uDCA5 got caught\u2026'); return; }
    // 2. votes
    var vb = this.$('voteBar');
    if (vis(vb) && this.voteKey !== 'v' + (st.vote && st.vote.id)) { this.voteKey = 'v' + (st.vote && st.vote.id); var yes = h.chance(0.55 + (5 - this.p.temper) * 0.04); this.step(0.5, 'votes ' + (yes ? 'YES' : 'NO') + ' on the seat swap', this.tapSel('#voteBar [data-vote="' + (yes ? 1 : 0) + '"]')); return; }
    var sv = this.q('#svBar [data-act="svYes"]');
    if (sv && vis(sv)) { var y2 = h.chance(0.6 + (5 - this.p.temper) * 0.03); var vk = 'sv' + (st.svote ? JSON.stringify(st.svote).length : ''); if (this.voteKey !== vk) { this.voteKey = vk; this.step(0.6, 'votes ' + (y2 ? 'yes' : 'no') + ' on a setting', this.tapSel('#svBar [data-act="' + (y2 ? 'svYes' : 'svNo') + '"]')); return; } }
    // 3. sheets / pop-ups covering the screen: read a moment, then close
    var sheets = [['findSheet', '#fsOk'], ['cardList', '#clOk'], ['optSheet', '#osOk'], ['deedSheet', null], ['disSheet', null], ['setSheet', null]];
    for (var i = 0; i < sheets.length; i++) { var sh = this.$(sheets[i][0]); if (vis(sh)) { var ok = sheets[i][1]; this.step(0.9, 'reads it, closes', ok ? this.tapSel(ok) : function () { var e = self.$(sheets[i][0]); return e ? self.api.tap(e, 'close') : false; }.bind(null)); return; } }
    // 4. auctions: everyone can bid
    if (t && t.auction && vis(this.$('auctionBar')) && this.auction(st, now)) return;
    if (!t) { api.idle('waiting\u2026'); return; }
    var mine = t.pid === me.id, key = t.pid + ':' + (t.rollSeq || 0) + ':' + st.round;
    if (mine) return this.myTurn(st, now);
    this.offTurn(st, now);
  };

  P.auction = function (st, now) {
    var a = st.turn.auction, me = st.me, B = this.B(); if (!B || me.bankrupt) return false;
    var k = 'a' + a.seq; if (this.aucKey !== k) { this.aucKey = k; this.aucNext = 0; this.aucVal = this.value(a.sp, st, true); this.aucMax = 0; }
    if (a.leader === me.id) { this.api.idle('\uD83D\uDD28 leading at ' + money(a.bid)); return true; }
    if (now < this.aucNext) return false;
    var room = me.cash - (me.lockedCash || 0) - this.reserve * 0.4, cap = Math.min(this.aucVal, room), steps = [20, 50, 100], self = this;
    var fit = steps.filter(function (s) { return a.bid + s <= cap; });
    if (!fit.length) { this.aucNext = now + 3000; if (!this.aucMax) { this.aucMax = 1; this.api.caption('\uD83D\uDD28 lets ' + this.spName(a.sp) + ' go (too rich)'); } return false; }
    var add = this.p.temper >= 8 || this.p.quirk === 'spender' ? fit[fit.length - 1] : fit[0];
    if (a.bid < 60 && this.p.temper >= 6 && fit.indexOf(50) >= 0) add = 50;
    this.aucNext = now + 1500 / this.api.speed();
    this.api.plan(this.h.think(0.25), '\uD83D\uDD28 bids +$' + add + ' on ' + this.spName(a.sp), function () { var ok = self.tapSel('#auctionBar button[data-bid="' + add + '"]')(); if (ok) self.api.log('bids +$' + add + ' (' + money(a.bid + add) + ') on ' + self.spName(a.sp)); return ok; });
    return true;
  };

  // what a deed is worth to this person (noisy, persona-shaped)
  P.value = function (sp, st, auction) {
    var B = this.B(), s = B.SPACES[sp], p = this.p, me = st.me, mem = B.GROUP_MEMBERS[s.group] || [], mine = 0, theirs = 0;
    mem.forEach(function (m) { var pr = st.props[m]; if (!pr || pr[0] == null || pr[0] < 0) return; if (pr[0] === me.tm) mine++; else theirs++; });
    var v = s.price * (auction ? 0.55 + p.smarts * 0.06 : 1);
    if (p.smarts >= 5) { if (mine === mem.length - 1) v *= 1.6; else if (mine) v *= 1.2; if (theirs === mem.length - 1) v *= 1.3; else if (theirs >= 2 && !mine) v *= 0.8; }
    if (p.quirk === 'spender') v *= 1.3; if (p.quirk === 'saver') v *= 0.8; v *= 1 + (p.temper - 5) * 0.03;
    v *= 1 + (Math.random() - 0.5) * (0.5 - p.smarts * 0.04);
    return v;
  };

  P.myTurn = function (st, now) {
    var t = st.turn, me = st.me, h = this.h, self = this, api = this.api, tk = t.pid + ':' + t.rollSeq + ':' + st.round;
    if (this.lastTurnKey !== st.round + ':' + t.pid) { this.lastTurnKey = st.round + ':' + t.pid; api.log('\u2014 my turn (round ' + st.round + ', ' + money(me.cash) + ')'); }
    if (this.tab() !== 'turn') { var fab = this.$('myTurnFab'); this.step(null, 'notices it\'s their turn', fab && vis(fab) ? this.tapSel('#myTurnFab') : this.tapSel('#tabs button[data-tab="turn"]')); return; }
    if (vis(this.q('#turnMain [data-act="raise"]'))) { this.step(0.8, 'owes money, taps AUTO-RAISE', this.tapSel('#turnMain [data-act="raise"]')); return; }
    if (vis(this.q('#turnMain [data-act="giveUp"]'))) { this.step(1, 'sighs\u2026 goes bust', this.tapSel('#turnMain [data-act="giveUp"]')); return; }
    if (t.stage === 'roll') {
      if (me.snow) {
        if (me.passes && h.chance(0.6)) { this.step(0.5, 'uses a Tow Pass', this.tapSel('#turnMain [data-act="usePass"]')); return; }
        if (this.p.smarts >= 6 && me.cash > this.reserve + 100 && h.chance(0.5)) { this.step(0.6, 'pays the tow', this.tapSel('#turnMain [data-act="payTow"]')); return; }
      }
      this.step(0.15, pick(['rolls\u2026', 'shakes the dice\u2026', 'ROLL!', 'blows on the dice, rolls']), this.tapSel('#turnMain [data-act="roll"]'));
      return;
    }
    if (t.stage !== 'act') { api.idle(t.stage === 'card' ? 'reading the card\u2026' : 'watching their piece move\u2026'); return; }
    if (t.buy && this.buyKey !== tk + ':' + t.buy.sp) {
      this.buyKey = tk + ':' + t.buy.sp;
      var s = this.B().SPACES[t.buy.sp], price = t.buy.price, want;
      if (me.cash < price) want = false;
      else if (this.p.smarts < 4) want = h.chance(this.p.quirk === 'saver' ? 0.45 : 0.82);
      else want = this.value(t.buy.sp, st, false) >= price * 0.9 && me.cash - price >= this.reserve * (this.p.smarts / 10);
      var mis = me.cash >= price && h.misreads(); if (mis) want = !want;
      var big = price / Math.max(1, me.cash), hes = Math.min(1.6, 0.5 + big * 1.6) * (this.p.quirk === 'secondguess' ? 1.5 : 1);
      var cap = (hes > 1 ? 'hesitates\u2026 ' : '') + (want ? 'buys ' : 'passes on ') + s.name + (mis ? ' (misread it!)' : '');
      if (this.p.quirk === 'secondguess' && h.chance(0.3)) this.step(0.6, 'hovers over BUY\u2026 hmm', function () { return true; });
      this.step(hes, cap, function () { var ok = self.tapSel('#turnMain [data-act="' + (want ? 'buy' : 'skipBuy') + '"]')(); if (ok) self.api.log((want ? 'buys ' : 'passes on ') + s.name + ' (' + money(price) + ')' + (mis ? ' after misreading it' : ''), want ? 'buy' : ''); else self.buyKey = ''; return ok; });
      return;
    }
    if (t.buy) return;  // tap still in flight / missed: next tick re-checks
    // smart players build before passing (once per turn)
    if (this.builtTurn !== tk && this.p.smarts >= 5 && this.buildPlan(st)) { this.builtTurn = tk; return; }
    var pb = this.$('passBtn');
    if (pb && vis(pb)) {
      if (pb.disabled) { api.idle('waiting out the catch window\u2026'); return; }
      var escape = t.payup && t.payup.open, again = t.canRollAgain;
      this.step(escape ? 0.05 : 0.25, again ? 'DOUBLES! rolls again' : escape ? 'passes FAST before PAY UP!' : pick(['passes the dice', 'done, passes', 'PASS DICE']), this.tapSel('#passBtn'));
    }
  };

  P.buildPlan = function (st) {
    var me = st.me, self = this, B = this.B(), any = false;
    st.props.forEach(function (pr, sp) {
      if (!pr || pr[0] !== me.tm || pr[2] || B.SPACES[sp].type !== 'prop') return;
      var mem = B.GROUP_MEMBERS[B.SPACES[sp].group]; if (mem.every(function (m) { return st.props[m] && st.props[m][0] === me.tm; }) && pr[1] < 5) any = true;
    });
    if (!any) return false;
    if (me.cash < this.reserve + 120) return false;
    this.goTab('stuff', 'opens My Stuff to build');
    this.step(0.3, 'switches to the list view', function () { var sw = self.q('#tab-stuff.cards .viewsw'); return sw ? self.api.tap(sw, 'list view') : true; });
    this.step(0.8, 'buys a Shop', function () {
      var bs = self.qa('#tab-stuff [data-act="build"]').filter(function (b) { return !b.disabled && vis(b); });
      if (!bs.length) return true;
      var b = bs[Math.floor(Math.random() * bs.length)], c = +((b.textContent.match(/\$([\d,]+)/) || [0, '0'])[1].replace(/,/g, ''));
      if (st.me.cash - c < self.reserve) { self.api.caption('thinks a Shop costs too much right now'); return true; }
      var ok = self.api.tap(b, 'build'); if (ok) self.api.log('buys a Shop (' + money(c) + ')', 'buy'); return ok;
    });
    this.goTabLater('turn');
    return true;
  };
  P.goTabLater = function (t) { var self = this; this.step(null, null, function () { var b = self.q('#tabs button[data-tab="' + t + '"]'); return b && self.tab() !== t ? self.api.tap(b, t) : true; }); };

  P.offTurn = function (st, now) {
    var t = st.turn, h = this.h, api = this.api, p = this.p, self = this;
    // heckle a stalling player
    if (t.heckle && st.rules.heckle && now > this.heckleAt && (p.temper >= 6 || p.quirk === 'trashtalk') && this.tab() === 'turn' && vis(this.q('#turnMain [data-act="heckle"]'))) {
      this.heckleAt = now + (8000 + Math.random() * 15000) / api.speed();
      this.step(0.2, '\uD83D\uDE02 heckles ' + t.name, function () { var ok = self.tapSel('#turnMain [data-act="heckle"]')(); if (ok) self.api.log('heckles ' + t.name + ' for stalling'); return ok; }); return;
    }
    // chat: trash-talkers and lively people
    if (now > this.chatAt) {
      this.chatAt = now + (p.quirk === 'trashtalk' ? 25000 : 70000 + (10 - p.temper) * 9000) * (0.6 + Math.random()) / api.speed();
      if (p.temper >= 5 || p.quirk === 'trashtalk' || h.chance(0.25)) {
        this.goTab('msgs', 'opens Deals & Chat');
        this.step(0.3, null, function () { var th = self.q('#msgMain [data-thread="all"], #msgSide [data-thread="all"]'); return th && !self.q('[data-quick]') ? self.api.tap(th, 'thread') : true; });
        this.step(0.6, 'types something to the table', function () { var qs = self.qa('[data-quick]').filter(vis); if (!qs.length) return true; var b = qs[Math.floor(Math.random() * qs.length)]; var ok = self.api.tap(b, 'chat'); if (ok) self.api.log('says "' + b.getAttribute('data-quick') + '" to the table'); return ok; });
        this.goTabLater('turn');
        return;
      }
    }
    // browsing between turns
    if (now > this.browseAt) {
      this.browseAt = now + (p.quirk === 'browser' ? 9000 : 16000 + (1 - h.curious()) * 30000) * (0.5 + Math.random()) / api.speed();
      if (p.quirk === 'browser' || h.chance(0.12 + h.curious() * 0.6)) {
        var tb = pick(['stuff', 'board', 'stuff', 'msgs']);
        this.goTab(tb, pick(['peeks at ', 'checks ', 'scrolls through ']) + (tb === 'stuff' ? 'My Stuff' : tb === 'board' ? 'the board' : 'the chat'));
        this.step(1.2, 'looks around\u2026', function () { return true; });
        this.goTabLater('turn');
        return;
      }
    }
    // smart players on a full set may build off-turn (manage: live)
    if (st.manage === 'live' && this.p.smarts >= 7 && this.builtTurn !== 'off' + st.round && h.chance(0.02) && this.buildPlan(st)) { this.builtTurn = 'off' + st.round; return; }
    // stray mis-tap: occasionally a low-skill player bumps a tab
    if (h.chance(0.0003 * (11 - p.skill))) { var tb2 = pick(['board', 'stuff']); this.goTab(tb2, 'bumps the ' + tb2 + ' tab by accident'); this.goTabLater('turn'); return; }
    api.idle(t.payup && t.payup.open ? 'watching the PAY UP race' : t.auction ? 'watching the auction' : 'watching ' + t.name + '\u2026');
  };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  (window.ZTPSimGames = window.ZTPSimGames || {}).rdr = A;
})();
