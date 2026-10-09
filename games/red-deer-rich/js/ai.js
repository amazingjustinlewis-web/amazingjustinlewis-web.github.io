/* RED DEER RICH - AI players (v0.1.1: auction bidding): simple buy / build / trade valuation, PAY UP reflexes, canned chat.
   RDRAI.tick(game) is called by the host after game.tick(); bots act only through game.intent(), like phones. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG, B = root.RDR_BOARD, S = B.SPACES, A = C.ai;

  function mem(g, p) { g.aiMem = g.aiMem || {}; return g.aiMem[p.id] || (g.aiMem[p.id] = { next: 0, payup: {}, trade: {}, lastPropose: -99, chatSeen: 0, said: {} }); }
  function lvl(p) { return A.levels[(p.ai && p.ai.level) || 'normal'] || A.levels.normal; }
  function rnd(g, a) { return a[0] + g.rand() * (a[1] - a[0]); }
  function think(g) { return g.ms(rnd(g, A.thinkMs)); }
  function line(g, p, kind) {
    var set = A.lines[kind] || {}, pool = (set[p.charId] && g.rand() < 0.6) ? set[p.charId] : set._ || ['...'];
    return pool[Math.floor(g.rand() * pool.length)];
  }
  function say(g, p, to, kind, bubble) {
    var txt = line(g, p, kind);
    g.chat(p.id, to, txt);
    if (bubble && g.onBubble) g.onBubble(p, txt);
    return txt;
  }

  // ---------------------------------------------------------------- valuation
  function groupSize(gr) { return B.GROUP_MEMBERS[gr].length; }
  function worthTo(g, pid, sp, mode) {      // mode 'get' = value of receiving sp; 'lose' = value of giving it away
    var s = S[sp], gr = s.group, have = g.countOwned(pid, gr), size = groupSize(gr);
    var after = mode === 'get' ? have + 1 : have, v = s.price;
    if (s.type === 'prop') {
      if (after === size) v = s.price * 2.6;                       // completes (or currently completes) a set
      else v = s.price * (1 + 0.45 * (after - 1) / size);
    } else if (s.type === 'whistle') v = s.price * (1 + 0.3 * (after - 1));
    if (g.props[sp].hocked) v -= s.hock * 0.6;
    return v;
  }
  function completesFor(g, pid, props) {   // groups pid would complete by receiving props
    var out = [];
    props.forEach(function (sp) {
      var gr = S[sp].group; if (S[sp].type !== 'prop') return;
      var missing = B.GROUP_MEMBERS[gr].filter(function (i) { return g.props[i].owner !== pid; });
      if (missing.every(function (i) { return props.indexOf(i) !== -1; }) && out.indexOf(gr) === -1) out.push(gr);
    });
    return out;
  }
  function evalTrade(g, p, t) {             // net value of the deal for bot p (positive = good for p)
    var mine = t.a === p.id ? t.aGives : t.bGives, theirs = t.a === p.id ? t.bGives : t.aGives, other = t.a === p.id ? t.b : t.a;
    var v = (theirs.cash || 0) - (mine.cash || 0) + 25 * ((theirs.passes || 0) - (mine.passes || 0));
    (theirs.props || []).forEach(function (sp) { v += worthTo(g, p.id, sp, 'get'); });
    (mine.props || []).forEach(function (sp) { v -= worthTo(g, p.id, sp, 'lose'); });
    var theyComplete = completesFor(g, other, mine.props || []), iComplete = completesFor(g, p.id, theirs.props || []);
    theyComplete.forEach(function (gr) { var gp = B.GROUP_MEMBERS[gr].reduce(function (s, i) { return s + S[i].price; }, 0); v -= gp * (iComplete.length ? 0.25 : 0.5); });
    if ((mine.cash || 0) > p.cash - lvl(p).reserve * 0.5) v -= 200;    // would leave the bot broke
    return v;
  }
  function wantBuy(g, p, sp) {
    var L = lvl(p), price = g.priceFor(p, sp), s = S[sp];
    if (p.cash < price) return false;
    var have = s.group ? g.countOwned(p.id, s.group) : 0, size = s.group ? groupSize(s.group) : 1;
    var helps = have > 0 || s.type === 'whistle';
    var blocks = g.players.some(function (q) { return q !== p && !q.bankrupt && s.group && g.countOwned(q.id, s.group) === size - 1; });
    var reserve = L.reserve * (helps || blocks ? 0.35 : 1);
    if (g.rand() > L.buyBias && !helps) return false;
    return p.cash - price >= reserve;
  }
  // v0.1.1 auctions: what is this deed worth to the bot right now?
  function auctionValue(g, p, sp) {
    var s = S[sp], lv = (p.ai && p.ai.level) || 'normal', f = { easy: 0.7, normal: 0.9, ruthless: 1.05 }[lv] || 0.9;
    var v = s.price * f;
    if (s.group) {
      var have = g.countOwned(p.id, s.group), size = groupSize(s.group);
      if (have === size - 1) v *= 1.6;                      // completes my set
      else if (have > 0 || s.type === 'whistle') v *= 1.2;  // helps
      if (g.players.some(function (q) { return q !== p && !q.bankrupt && g.countOwned(q.id, s.group) === size - 1; })) v *= 1.3;   // blocks someone
    }
    var cap = g.maxBid(p) - lvl(p).reserve * 0.5;
    return Math.max(0, Math.min(v, cap));
  }
  function manage(g, p) {                    // unhock, then build evenly while there's spare cash
    var L = lvl(p), did = false, reserve = L.reserve * 1.4;
    g.props.forEach(function (pr, i) {
      if (pr && pr.owner === p.id && pr.hocked && p.cash - g.unhockCost(i) > reserve * 2 && g.rand() < L.build) { if (!g.intent(p.id, { t: 'unhock', sp: i })) did = true; }
    });
    // v0.5 Disasters: rush a repair when the business is worth it and the cash is comfortable (sets with Shops first)
    g.props.forEach(function (pr, i) {
      if (!pr || pr.owner !== p.id || !pr.dmg) return;
      var cost = g.rushCost(i), base = g.rentBase(i, 7, false), lost = (pr.dmg.mode === 'closed' ? base : base / 2) * pr.dmg.left;
      if (lost * (0.6 + L.build) > cost && p.cash - cost > reserve * 1.5) { if (!g.intent(p.id, { t: 'rush', sp: i })) did = true; }
    });
    if (g.rand() > L.build) return did;
    for (var guard = 0; guard < 12; guard++) {
      var best = -1, bestShops = 9;
      g.props.forEach(function (pr, i) {
        if (!pr || pr.owner !== p.id || S[i].type !== 'prop') return;
        if (!g.canBuild(p, i) && p.cash - g.shopCost(i) >= reserve && pr.shops < bestShops) { bestShops = pr.shops; best = i; }
      });
      if (best < 0) break;
      if (g.intent(p.id, { t: 'build', sp: best })) break;
      did = true;
    }
    return did;
  }
  function nearSets(g, pid) {               // colour groups where pid owns all but one deed (no Shops yet)
    return Object.keys(B.GROUP_MEMBERS).filter(function (gr) {
      if (gr === 'whistle' || gr === 'juice' || g.groupHasShops(gr)) return false;
      var mem = B.GROUP_MEMBERS[gr], mine = mem.filter(function (i) { return g.props[i].owner === pid; });
      return mine.length === mem.length - 1 && mem.some(function (i) { return g.props[i].owner >= 0 && g.props[i].owner !== pid; });
    }).map(function (gr) { var sp = B.GROUP_MEMBERS[gr].filter(function (i) { return g.props[i].owner !== pid; })[0]; return { gr: gr, sp: sp, owner: g.props[sp].owner }; });
  }
  function proposeTrade(g, p) {
    var L = lvl(p), m = mem(g, p);
    if (g.rand() > L.trade + 0.25) return false;
    var wants = nearSets(g, p.id);
    for (var k = 0; k < wants.length; k++) {
      var w = wants[k], owner = g.byId(w.owner), sp = w.sp;
      if (!owner || owner.bankrupt || g.locked(sp)) continue;
      var key = sp + ':' + owner.id; if (m.trade[key] && g.turnCount - m.trade[key] < 8) continue;
      m.trade[key] = g.turnCount;
      var give = { cash: 0, props: [], passes: 0 }, get = { cash: 0, props: [sp], passes: 0 };
      // 1) swap: they also need a deed I hold to finish a set
      var theirs = nearSets(g, owner.id).filter(function (x) { return x.owner === p.id && x.gr !== w.gr && !g.locked(x.sp); })[0];
      if (theirs) {
        give.props = [theirs.sp];
        var diff = Math.round((S[sp].price - S[theirs.sp].price) / 10) * 10;
        if (diff > 0) give.cash = Math.min(diff, Math.max(0, p.cash - L.reserve)); else get.cash = Math.min(-diff, owner.cash);
      } else {
        var cash = Math.round(S[sp].price * (2.1 + g.rand() * 0.9) / 10) * 10;
        if (p.cash - cash >= L.reserve * 0.6) give.cash = cash;
        else {                                  // sweeten with a deed that doesn't hand them a set
          var spare = -1;
          g.props.forEach(function (q, i) {
            if (spare >= 0 || !q || q.owner !== p.id || S[i].group === w.gr || g.groupHasShops(S[i].group) || g.locked(i)) return;
            if (completesFor(g, owner.id, [i]).length || g.ownsGroup(p.id, S[i].group)) return;
            if (nearSets(g, p.id).some(function (x) { return x.gr === S[i].group; })) return;
            spare = i;
          });
          if (spare < 0) continue;
          give.props = [spare]; give.cash = Math.max(0, Math.min(p.cash - L.reserve * 0.6, Math.round((S[sp].price * 2.2 - S[spare].price) / 10) * 10));
        }
      }
      var err = g.proposeTrade(p.id, owner.id, give, get);
      if (!err) { say(g, p, owner.id, 'offer'); return true; }
    }
    return false;
  }

  // ---------------------------------------------------------------- main loop
  function tick(g) {
    if (g.phase !== 'play') return;
    var now = g.now, t = g.turn;
    g.players.forEach(function (p) {
      if (p.bankrupt || !g.isBot(p)) return;
      var m = mem(g, p), L = lvl(p);
      // PAY UP reflexes (on or off turn)
      var pu = t && t.payup;
      if (pu && !pu.done && pu.owner === p.id) {
        var lv = (p.ai && p.ai.level) || 'normal';
        if (!m.payup[pu.seq + ':' + g.turnCount]) m.payup[pu.seq + ':' + g.turnCount] = pu.openedAt + g.ms(rnd(g, C.payup.aiReflexMs[lv] || C.payup.aiReflexMs.normal));
        if (now >= m.payup[pu.seq + ':' + g.turnCount]) { if (g.payup(p.id)) { var mover = g.byId(pu.mover); say(g, p, mover.id, 'caught', true); if (mover && g.isBot(mover)) say(g, mover, p.id, 'gotCaught', false); } }
      }
      // deals waiting on this bot
      g.trades.forEach(function (tr) {
        if (tr.status !== 'open' || tr.waiting !== p.id) return;
        var k = tr.id + ':' + tr.v;
        if (!m.trade[k]) { m.trade[k] = now + think(g) * 2; return; }
        if (now < m.trade[k]) return;
        var v = evalTrade(g, p, tr), other = tr.a === p.id ? tr.b : tr.a;
        var need = L === A.levels.ruthless ? 60 : L === A.levels.easy ? -40 : 15;
        if (v >= need) { if (!g.acceptTrade(p.id, tr.id)) say(g, p, other, 'accepted', false); else g.declineTrade(p.id, tr.id); }
        else { g.declineTrade(p.id, tr.id); say(g, p, other, 'declined', false); }
      });
      // chat replies (rate-limited, only to messages sent straight to this bot)
      for (var ci = m.chatSeen; ci < g.chats.length; ci++) {
        var c = g.chats[ci];
        if (c.to === p.id && c.from !== p.id && !(g.byId(c.from) || {}).ai && (!m.said.chat || now - m.said.chat > g.ms(4000))) { m.said.chat = now; m.replyAt = now + think(g) * 2; m.replyTo = c.from; }
      }
      m.chatSeen = g.chats.length;
      if (m.replyAt && now >= m.replyAt) { say(g, p, m.replyTo, 'chat', false); m.replyAt = 0; }

      // auction bidding (anyone, on or off turn)
      var au = t && t.auction;
      if (au && au.leader !== p.id) {
        var key = au.seq + ':' + au.bids;
        if (m.bidKey !== key) { m.bidKey = key; m.bidAt = now + g.ms(rnd(g, C.auction.aiReactMs)); }
        else if (now >= m.bidAt) {
          var val = auctionValue(g, p, au.sp), gap = val - au.bid, add = gap > 180 ? 50 : 20;
          if (gap >= add && au.bid + add <= g.maxBid(p)) g.intent(p.id, { t: 'bid', add: add });
          m.bidAt = Infinity;
        }
      }
      if (!t || t.pid !== p.id) return;
      // ---- my turn
      if (now < m.next) return;
      if (t.stage === 'roll') {
        if (m.turnSeen !== g.turnCount) { m.turnSeen = g.turnCount; m.next = now + think(g); return; }
        if (t.tab) { g.intent(p.id, { t: 'raise' }); if (t.tab) g.intent(p.id, { t: 'giveUp' }); return; }
        manage(g, p);
        if (g.turnCount - m.lastPropose >= A.tradeEveryTurns) { m.lastPropose = g.turnCount; proposeTrade(g, p); }
        if (p.snow) {
          var unowned = g.props.filter(function (pr) { return pr && pr.owner < 0; }).length;
          if (p.passes.length && unowned > 6) { g.intent(p.id, { t: 'usePass' }); m.next = now + think(g); return; }
          if (unowned > 8 && p.cash - C.towFee > L.reserve * 2) { g.intent(p.id, { t: 'payTow' }); m.next = now + think(g); return; }
        }
        g.intent(p.id, { t: 'roll' });
        m.next = now + g.ms(200);
        return;
      }
      if (t.stage === 'act') {
        if (t.auction) return;
        if (t.tab) { g.intent(p.id, { t: 'raise' }); if (g.turn === t && t.tab) g.intent(p.id, { t: 'giveUp' }); m.next = now + think(g); return; }
        if (t.buy != null) {
          if (m.buySeen !== t.landedAt) { m.buySeen = t.landedAt; m.next = now + think(g); return; }
          if (wantBuy(g, p, t.buy)) g.intent(p.id, { t: 'buy' }); else g.intent(p.id, { t: 'skipBuy' });
          m.next = now + think(g) * 0.5; return;
        }
        if (m.manageSeen !== t.landedAt) { m.manageSeen = t.landedAt; manage(g, p); }
        // PAY UP window on someone else's deed: pass the dice after a random pause (never before the grace ends)
        if (t.payup && !t.payup.done) {
          if (m.passFor !== t.payup.seq + ':' + g.turnCount) { m.passFor = t.payup.seq + ':' + g.turnCount; m.passAt = Math.max(t.graceUntil, t.payup.openedAt + g.ms(rnd(g, C.payup.aiPassDiceMs))); }
          if (now < m.passAt) return;
        }
        if (t.canRollAgain) { g.intent(p.id, { t: 'roll' }); m.next = now + g.ms(200); return; }
        g.intent(p.id, { t: 'pass' });
        m.next = now + g.ms(300);
      }
    });
  }
  function greet(g) {
    var bots = g.players.filter(function (p) { return p.ai; });
    bots.slice(0, 2).forEach(function (p) { say(g, p, 'all', 'greet', true); });
  }
  // coach-style hint for a human (not used yet by phones; handy for tests)
  root.RDRAI = { tick: tick, auctionValue: auctionValue, greet: greet, evalTrade: evalTrade, wantBuy: wantBuy, worthTo: worthTo, say: say, line: line };
})(typeof window !== 'undefined' ? window : globalThis);
