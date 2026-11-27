/* Red Deer Rich solo v0.11: this phone hosts a PeerJS (or ?local=1 BroadcastChannel) room
   so friends can join with the existing controller_v077 page and protocol.
   The local player stays on the solo UI; remotes are ordinary human seats in RDR.game.
   Mid-game joiners take an AI seat (or watch, then can ask to sit). Phase 2 (live move to TV) is not in this file. */
(function (root) {
  'use strict';
  var C = root.RDR_CONFIG;
  var CTRL = 'controller_v077.html';
  var net = null, clients = {}, phoneDirty = true, phoneFx = {}, lastFind = null, setupEdited = true;
  var votes = null, voteSeq = 0, VOTE_MS = 5000;
  var sv = null, svSeq = 0, svDone = null;
  var hooks = { getGame: function () { return null; }, getMeId: function () { return 0; }, onFriends: function () {}, toast: function () {} };
  var meClientId = 'solo-host-me';
  var publishTimer = 0;

  function game() { return hooks.getGame && hooks.getGame(); }
  function meId() { return hooks.getMeId && hooks.getMeId(); }
  function meP() { var g = game(); return g ? g.byId(meId()) : null; }
  function inGame() { var g = game(); return !!(g && g.phase === 'play'); }
  function send(conn, m) { if (net && conn) net.send(conn, m); }
  function localFlag() { return /[?&]local=1/.test(location.search) ? '&local=1' : ''; }
  function dir() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }
  function looksCode(s) { var t = String(s || '').toUpperCase().replace(/[^A-Z]/g, ''); return t.length === 4 ? t : ''; }
  function controllerUrl(code) {
    var u = new URL(CTRL, location.href);
    u.search = 'room=' + encodeURIComponent(code) + localFlag() + '&inv=1&auto=1';
    return u.href;
  }
  function openUrl(code) {
    var u = new URL('../open/index_v01.html', location.href);
    u.search = 'game=rdr&room=' + encodeURIComponent(code) +
      '&join=' + encodeURIComponent('../rdr-phone/' + CTRL) +
      '&tv=' + encodeURIComponent('../rdr-phone/index_v078.html') + localFlag();
    return u.href;
  }
  function vip() { return meP(); }
  function voters() {
    var g = game(); if (!g) return [];
    return g.players.filter(function (q) { return !q.ai && !q.bankrupt && !q.aiTakeover && q.connected; });
  }
  function toast(t) { if (hooks.toast) hooks.toast(t); }

  function sideView(s) { return { cash: s.cash || 0, props: (s.props || []).slice(), passes: s.passes || 0 }; }
  function raisePlan(p, need) {
    var g = game(); if (!g || !g.planRaise) return null;
    var pl = g.planRaise(p, need);
    return { text: g.planText(pl), total: pl.total, covers: pl.covers, steps: pl.steps.length };
  }
  function fadeList() { return []; }
  function hueView() { return null; }
  function svView(p) {
    if (!sv) return null;
    var live = voters().map(function (q) { return q.id; });
    var need = sv.need.filter(function (id) { return live.indexOf(id) >= 0 || id === sv.by; });
    var y = need.filter(function (id) { return sv.yes[id]; }).length, n = need.filter(function (id) { return sv.no[id]; }).length;
    return { id: sv.id, k: sv.k, v: sv.v, label: sv.label, by: sv.by, byName: sv.byName, left: Math.max(0, sv.until - Date.now()), y: y, no: n, n: Math.max(1, need.length), pct: 85,
      mine: sv.yes[p.id] ? 'yes' : sv.no[p.id] ? 'no' : '', canVote: need.indexOf(p.id) >= 0,
      votes: need.map(function (id) { var q = game().byId(id) || {}; return [id, q.name, q.color, q.charId, sv.yes[id] ? 1 : sv.no[id] ? -1 : 0]; }) };
  }

  function phoneState(p) {
    var g = game(), now = g.now, t = g.turn, cur = g.cur();
    var st = { t: 'state', phase: g.phase, mode: g.mode, rules: g.rules, pot: g.pot, round: g.round,
      endsIn: g.timed && g.timed() && g.phase === 'play' ? Math.max(0, g.endsAt - now) : 0, maxPlayers: C.maxPlayers,
      me: { id: p.id, name: p.name, charId: p.charId, color: p.color, cash: p.cash, pos: p.pos, snow: p.snow, snowTries: p.snowTries, passes: p.passes.length, state: p.state,
        worth: g.worthOf ? g.worthOf(p) : 0, bankrupt: p.bankrupt, vip: vip() === p, aiCover: !!p.aiTakeover, skip: p.skip, place: p.place || 0, lockedCash: g.lockedCash ? g.lockedCash(p) : 0, tm: g.oid ? g.oid(p) : p.id, team: g.teamName ? g.teamName(p) : '' },
      fx: phoneFx[p.id] || {},
      players: g.players.map(function (q) { return { id: q.id, name: q.name, charId: q.charId, color: q.color, cash: q.cash, state: q.state, bankrupt: q.bankrupt, ai: q.ai ? q.ai.level : null,
        connected: q.connected !== false, pos: q.pos, snow: q.snow, passes: (q.passes || []).length, worth: g.phase === 'play' && g.worthOf ? g.worthOf(q) : 0, tm: g.oid ? g.oid(q) : q.id, team: q.team != null ? q.team : -1 }; }),
      props: g.props ? g.props.map(function (pr, i) { return pr ? [pr.owner, pr.shops, pr.hocked ? 1 : 0, g.locked && g.locked(i) ? 1 : 0, pr.dmg && pr.owner >= 0 ? [pr.dmg.left, pr.dmg.mode === 'closed' ? 1 : 0, pr.dmg.e, g.rushCost ? g.rushCost(i) : 0] : 0] : null; }) : [],
      fades: fadeList(),
      feed: (g.log || []).slice(-14).map(function (l) { return l.s; }),
      feedCard: (g.log || []).slice(-14).map(function (l) { return l.card || 0; }),
      feedEv: (g.log || []).slice(-14).map(function (l) { return l.ev || 0; }),
      cards: g.phase === 'play' ? (g.cardsDrawn || []).slice(-40) : [],
      lobby: g.phase !== 'play' ? { taken: g.players.map(function (q) { return [q.charId, q.id, q.name, q.ai ? q.ai.level : '']; }) } : null,
      results: g.phase === 'over' ? g.results : null,
      hue: g.phase !== 'play' ? hueView(p) : null,
      setupEdited: setupEdited,
      lastFind: g.phase === 'play' && lastFind ? { idx: lastFind.idx, n: lastFind.n, fresh: Date.now() - lastFind.at < ((C.cardHoldMs) || 12000) } : null,
      manage: g.manageMode, myQueue: { n: (p.queue || []).length, list: p.queue || [], fails: (p.queueFails || []).map(function (f) { return [f.m.t, f.m.sp, f.why]; }) },
      catchSec: g.catchSec, paused: !!g.paused, timerOn: !!g.endsAt, timerLeft: g.endsAt ? 0 : (g.timerLeft || 0),
      svote: svView(p), svDone: svDone && Date.now() - svDone.at < 4000 ? svDone : null,
      timer: { min: g.timerMin, eff: g.timerFor ? g.timerFor() : 0 },
      hostKind: 'phone'
    };
    if (t && g.phase === 'play' && cur) {
      var pu = t.payup;
      st.turn = { pid: t.pid, name: cur.name, color: cur.color, stage: t.stage, roll: t.roll, rollSeq: t.rollSeq, canRollAgain: t.canRollAgain,
        buy: t.buy != null ? { sp: t.buy, price: g.priceFor(cur, t.buy) } : null,
        payup: pu ? { owner: pu.owner, mover: pu.mover, sp: pu.sp, seq: pu.seq, open: !pu.done, caught: pu.caught, amount: pu.amount || 0, rent: g.rentFor ? g.rentFor(pu.sp, pu.roll, pu.dbl) : 0, graceLeft: Math.max(0, t.graceUntil - now) } : null,
        graceLeft: t.stage === 'act' ? Math.max(0, (t.graceUntil || 0) - now) : 0,
        tab: t.tab ? { amount: t.tab.amount, reason: t.tab.reason, hopeless: !!t.tab.hopeless, to: typeof t.tab.to === 'number' ? (g.byId(t.tab.to) || {}).name : t.tab.to, raise: g.liquidValue ? g.liquidValue(cur) : 0, plan: t.pid === p.id ? raisePlan(cur, t.tab.amount) : null } : null,
        card: t.card ? { deck: t.card.deck, idx: t.card.idx } : null,
        auction: t.auction ? { sp: t.auction.sp, bid: t.auction.bid, leader: t.auction.leader, bids: t.auction.bids, seq: t.auction.seq, left: Math.round(Math.max(0, (t.auction.T ? (t.auction.t0 + t.auction.T) : t.auction.endsAt) - now)), total: Math.round(t.auction.T || g.ms(C.auction.ms)) } : null,
        move: t.moving ? { from: t.moving.from, path: t.moving.path, stepMs: Math.round(t.moving.step), elapsed: Math.round(now - t.moving.start) } : null,
        heckle: t.heckle && t.heckle.open && g.rules.heckle ? { stalls: t.heckle.stalls, forever: t.heckle.forever } : null };
    }
    if (votes && votes.need.indexOf(p.id) >= 0) st.vote = { id: votes.id, name: votes.name, seat: votes.seat, left: Math.max(0, votes.until - Date.now()), mine: votes.yes[p.id] ? 'yes' : votes.no[p.id] ? 'no' : '' };
    st.chats = (g.chats || []).filter(function (c) { return c.to === 'all' || c.to === p.id || c.from === p.id; }).slice(-150).map(function (c) { return [c.id, c.from, c.to, c.text]; });
    st.trades = (g.trades || []).filter(function (tr) { return tr.a === p.id || tr.b === p.id; }).slice(-25).map(function (tr) {
      return { id: tr.id, a: tr.a, b: tr.b, aGives: sideView(tr.aGives), bGives: sideView(tr.bGives), v: tr.v, waiting: tr.waiting, status: tr.status, by: tr.by, why: tr.why || '', history: (tr.history || []).map(function (h) { return [h.v, h.by]; }) };
    });
    return st;
  }
  function observerState(cl) {
    var g = game(), fake = { id: -99, name: cl.name, charId: C.characters[0].id, color: '#888888', cash: 0, pos: 0, snow: false, snowTries: 0, passes: [], state: 'rags', bankrupt: false, ai: null, aiTakeover: null, skip: 0, queue: [] };
    var st = phoneState(fake);
    st.me.observer = true; st.me.vip = false; st.me.worth = 0; st.fx = {}; st.chats = st.chats.filter(function (c) { return c[2] === 'all'; }); st.trades = [];
    st.feed = (g.log || []).slice(-40).map(function (l) { return l.s; }); st.feedCard = (g.log || []).slice(-40).map(function (l) { return l.card || 0; }); st.feedEv = (g.log || []).slice(-40).map(function (l) { return l.ev || 0; });
    st.seats = g.players.filter(function (q) { return q.ai && !q.bankrupt; }).map(function (q) { return [q.id, q.name, q.charId, q.color]; });
    st.asking = votes && votes.cid === (cl.conn && cl.conn._cid) ? { seat: votes.seat, left: Math.max(0, votes.until - Date.now()) } : null;
    st.voteBusy = !!votes;
    return st;
  }
  function pushPhones() {
    if (!net) return;
    var g = game(); if (!g) return;
    for (var cid in clients) {
      var cl = clients[cid], p = cl.observer ? null : g.byId(cl.pid);
      if ((!p && !cl.observer) || !cl.conn || !cl.conn.open) continue;
      var st = cl.observer ? observerState(cl) : phoneState(p), js = JSON.stringify(st);
      if (js === cl.lastSent) continue;
      cl.lastSent = js; net.send(cl.conn, st);
    }
  }

  function awaySeats() {
    var g = game(); if (!g) return [];
    return g.players.filter(function (q) { return !q.ai && !q.bankrupt && q.clientId && q.clientId !== meClientId && (!q.connected || q.aiTakeover); });
  }
  function claimSeat(name) {
    var away = awaySeats(), nm = String(name || '').trim().toLowerCase();
    var hit = away.filter(function (q) { return q.name.toLowerCase() === nm; })[0];
    if (!hit && away.length === 1 && away[0].aiTakeover) hit = away[0];
    return hit || null;
  }
  function handBack(p) { p.offSince = 0; if (!p.aiTakeover) return; p.aiTakeover = null; toast(p.name + ' is back'); if (game()) game().changed(); }

  function resolveVote() {
    var v = votes; votes = null; if (!v) return;
    var y = Object.keys(v.yes).length, n = Object.keys(v.no).length, cl = clients[v.cid], p = game() && game().byId(v.pid);
    var okd = n === 0 || y > n;
    if (okd && cl && p && game().handSeat) {
      var why = game().handSeat(p.id, cl.name, v.cid);
      if (!why) { cl.observer = false; cl.pid = p.id; send(cl.conn, { t: 'welcome', pid: p.id, room: net.code }); toast(cl.name + ' takes over ' + p.name); }
      else send(cl.conn, { t: 'toast', text: why });
    } else if (cl) send(cl.conn, { t: 'toast', text: 'The table said no.' });
    phoneDirty = true;
  }
  function onObserverMessage(conn, cl, m) {
    if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }
    if (m.t === 'name') { cl.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 12) || cl.name; phoneDirty = true; return; }
    if (m.t === 'queueJoin' || m.t === 'queueLeave' || m.t === 'queueVote') { return; } /* open-games page may send these; stubbed here */
    if (m.t === 'seatReq') {
      var g = game(), p = g && g.byId(+m.pid);
      if (!inGame() || !p || !p.ai || p.bankrupt) { send(conn, { t: 'toast', text: 'That seat is not available.' }); return; }
      if (votes) { send(conn, { t: 'toast', text: 'Someone else is asking right now. Try again in a few seconds.' }); return; }
      if (m.name) cl.name = String(m.name).replace(/[<>]/g, '').trim().slice(0, 12) || cl.name;
      var vs = voters().filter(function (q) { return q.id !== meId(); });
      votes = { id: ++voteSeq, cid: conn._cid, name: cl.name, pid: p.id, seat: p.name, until: Date.now() + VOTE_MS, yes: {}, no: {}, need: vs.map(function (q) { return q.id; }) };
      /* the local host phone auto-yes so a friend can sit without a second controller vote */
      var host = meP(); if (host) votes.yes[host.id] = 1;
      if (!vs.length) { resolveVote(); return; }
      send(conn, { t: 'toast', text: 'Asking the players\u2026' }); phoneDirty = true;
      toast(cl.name + ' wants to take ' + p.name + '\'s seat');
    }
  }
  function castVote(pl, m) {
    if (!votes || +m.id !== votes.id || votes.need.indexOf(pl.id) < 0) return;
    delete votes.yes[pl.id]; delete votes.no[pl.id]; (m.yes ? votes.yes : votes.no)[pl.id] = 1;
    if (Object.keys(votes.yes).length + Object.keys(votes.no).length >= votes.need.length) resolveVote();
    phoneDirty = true;
  }

  function onPhoneMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    var g = game();
    if (!g) { send(conn, { t: 'reject', reason: 'This phone is still starting up.' }); return; }
    if (m.t === 'hello' && m.role && m.role !== 'pad') { send(conn, { t: 'reject', reason: 'This is a phone-hosted Red Deer Rich room. Open the Red Deer Rich controller.' }); return; }
    if (m.t === 'hello') {
      var cid = String(m.clientId || conn.peer || conn.connectionId || ('c' + Date.now())).slice(0, 40);
      var c = clients[cid], p = c && !c.observer ? g.byId(c.pid) : null;
      if (!p) {
        if (g.phase === 'play') {
          p = m.watch ? null : claimSeat(m.name);
          if (!p && !m.watch) {
            var ais = g.players.filter(function (q) { return q.ai && !q.bankrupt; });
            if (ais.length && g.handSeat) {
              var seat = ais[0];
              if (!g.handSeat(seat.id, m.name, cid)) p = seat;
            }
          }
          if (!p) {
            if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
            clients[cid] = { observer: true, name: String(m.name || 'Guest').replace(/[<>]/g, '').trim().slice(0, 12) || 'Guest', conn: conn, seen: Date.now(), lastSent: '' };
            conn._cid = cid; send(conn, { t: 'welcome', observer: true, room: net.code }); phoneDirty = true;
            toast((m.name || 'A friend') + ' is watching (no open seat)');
            hooks.onFriends();
            return;
          }
          if (p.clientId && clients[p.clientId] && p.clientId !== cid) { var oc = clients[p.clientId].conn; delete clients[p.clientId]; if (oc) try { oc.close(); } catch (e2) {} }
          p.clientId = cid;
        } else {
          p = g.addPlayer({ name: m.name, charId: m.charId, clientId: cid });
          if (!p) { send(conn, { t: 'reject', reason: 'The room is full (' + C.maxPlayers + ' players).' }); return; }
          toast((p.name || 'A friend') + ' joined your room');
        }
      } else if (g.phase !== 'play' && m.name) p.name = String(m.name).replace(/[<>]/g, '').trim().slice(0, 12) || p.name;
      if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e3) {}
      clients[cid] = { pid: p.id, conn: conn, seen: Date.now(), lastSent: '' };
      conn._cid = cid; p.connected = true; p.clientId = cid; handBack(p);
      g.changed(); phoneDirty = true;
      send(conn, { t: 'welcome', pid: p.id, room: net.code });
      hooks.onFriends();
      return;
    }
    var cl = clients[conn._cid]; if (!cl || cl.conn !== conn) return;
    cl.seen = Date.now();
    if (cl.observer) { onObserverMessage(conn, cl, m); return; }
    var pl = g.byId(cl.pid);
    if (!pl) { send(conn, { t: 'reject', reason: 'You were removed from the room.' }); return; }
    if (!pl.connected) { pl.connected = true; handBack(pl); }
    if (m.t === 'ping') { send(conn, { t: 'pong' }); return; }
    var isVip = vip() === pl, lobbyish = g.phase === 'lobby' || g.phase === 'over';
    if (m.t === 'start') { if (hooks.onRemoteStart && ((isVip && lobbyish) || (g.phase === 'over'))) hooks.onRemoteStart(); return; }
    if (m.t === 'leave') { if (lobbyish) { g.removePlayer(pl.id); delete clients[conn._cid]; phoneDirty = true; hooks.onFriends(); toast(pl.name + ' left'); } return; }
    if (m.t === 'name') { if (lobbyish) { pl.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 12) || pl.name; g.changed(); hooks.onFriends(); } return; }
    if (m.t === 'vote') { castVote(pl, m); return; }
    if (m.t === 'leaveGame') {
      var lr = g.leaveGame(pl.id, String(m.how || ''), m.to);
      if (lr) { send(conn, { t: 'toast', text: lr }); return; }
      clients[conn._cid] = { observer: true, name: pl.name, conn: conn, seen: Date.now(), lastSent: '' };
      send(conn, { t: 'welcome', observer: true, room: net.code }); send(conn, { t: 'toast', text: 'You left the game. You\'re watching now.' });
      phoneDirty = true; hooks.onFriends(); return;
    }
    /* host-phone settings: the local player is VIP; remotes cannot change lobby rules */
    if (m.t === 'addAI' || m.t === 'removeAI' || m.t === 'rule' || m.t === 'mode' || m.t === 'timer' || m.t === 'preset' || m.t === 'settings' || m.t === 'manage' || m.t === 'catch' || m.t === 'newGame' || m.t === 'toLobby' || m.t === 'hue') {
      send(conn, { t: 'toast', text: 'The person with this phone sets those from the setup screen.' });
      return;
    }
    var r = g.intent(pl.id, m);
    if (r && r !== 'wait' && m.t !== 'chat') send(conn, { t: 'toast', text: r });
    phoneDirty = true;
  }
  function onPhoneClose(conn) {
    var cl = clients[conn._cid];
    if (cl && cl.conn === conn) {
      var g = game(), p = g && g.byId(cl.pid);
      if (p) { p.connected = false; if (!p.offSince) p.offSince = Date.now(); g.changed(); }
      hooks.onFriends();
    }
  }

  function onStatus(s, code, detail) {
    root.__ZTP_NET = net;
    if (hooks.onStatus) hooks.onStatus(s, code, detail);
    publish();
  }

  function publish() {
    if (!net || !net.code) return;
    var g = game(), nHuman = 0, nAll = 0, open = 0;
    if (g) {
      nAll = g.players.length;
      nHuman = g.players.filter(function (p) { return !p.ai; }).length;
      open = Math.max(0, (C.maxPlayers || 8) - nAll);
      if (g.phase === 'play') open = g.players.filter(function (p) { return p.ai && !p.bankrupt; }).length;
    }
    var rec = {
      game: 'rdr', title: 'Red Deer Rich', room: net.code, status: net.status,
      phase: g ? g.phase : 'lobby', players: nHuman, seats: nAll, open: open,
      join: controllerUrl(net.code), openPage: openUrl(net.code),
      host: 'phone', local: /[?&]local=1/.test(location.search), at: Date.now()
    };
    if (root.ZTPOpenGames && ZTPOpenGames.publish) try { ZTPOpenGames.publish(rec); } catch (e) {}
  }

  function hookEvents(g) {
    if (!g || g._soloHostHooked) return;
    g._soloHostHooked = true;
    g.on(function (type, d) {
      phoneDirty = true;
      if (type === 'card' && d && d.deck === 'finds') lastFind = { idx: d.idx, n: (lastFind ? lastFind.n : 0) + 1, at: Date.now() };
      var pid = d && d.pid, k = null;
      if (type === 'turn') k = 'turn';
      else if (type === 'auctionStart') k = 'auction';
      else if (type === 'payupOpen') k = 'alarm';
      else if (type === 'tab') k = 'tab';
      if (k && pid) { var f = phoneFx[pid] = phoneFx[pid] || {}; f[k] = (f[k] || 0) + 1; }
    });
  }

  function start(opts) {
    hooks = opts || hooks;
    if (net) return net;
    var Q = new URLSearchParams(location.search);
    var code = Q.get('hostroom') ? String(Q.get('hostroom')).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : (root.RDRNet && RDRNet.makeCode ? RDRNet.makeCode() : 'TEST');
    var LOCAL = Q.get('local') === '1';
    if (!root.RDRNet) { onStatus('offline', null, 'net.js did not load'); return null; }
    if (LOCAL) net = new root.RDRNet.LocalHost({ code: code || 'TEST', onStatus: onStatus, onMessage: onPhoneMessage, onClose: onPhoneClose });
    else net = new root.RDRNet.Host({ code: code, onStatus: onStatus, onMessage: onPhoneMessage, onClose: onPhoneClose });
    root.__ZTP_NET = net;
    var sweepN = 0;
    setInterval(function () {
      var g = game(), now = Date.now(), ch = false, full = ++sweepN % 6 === 0;
      if (votes && now >= votes.until) resolveVote();
      if (sv && now >= sv.until) { svDone = { label: sv.label, ok: false, why: 'time ran out', at: now }; sv = null; phoneDirty = true; }
      for (var cid in clients) {
        var cl = clients[cid], p = cl.observer ? null : (g && g.byId(cl.pid));
        if (cl.observer && now - cl.seen > 20000) { delete clients[cid]; continue; }
        if (p && p.connected && now - cl.seen > ((C.ai && C.ai.lostAfterMs) || 9000)) { p.connected = false; p.offSince = now; ch = true; }
        if (p && !p.connected && !p.ai && inGame() && !p.bankrupt) {
          if (!p.offSince) p.offSince = now;
          if (!p.aiTakeover && now - p.offSince >= ((C.ai && C.ai.takeoverAfterMs) || 20000)) {
            p.aiTakeover = { level: 'normal' };
            if (g.addLog) g.addLog('An AI covers ' + p.name + '\'s seat until their phone is back.');
            toast('AI is covering ' + p.name + ' for now');
            ch = true;
          }
        }
      }
      if (ch && g) g.changed();
      if (full) { phoneDirty = true; for (var c2 in clients) clients[c2].lastSent = ''; }
      if (phoneDirty) { phoneDirty = false; pushPhones(); }
      if (g && g.version !== start._ver) { start._ver = g.version; phoneDirty = true; hookEvents(g); }
    }, 200);
    publishTimer = setInterval(publish, 2500);
    publish();
    return net;
  }

  function remotes() {
    var g = game(); if (!g) return [];
    return g.players.filter(function (p) { return !p.ai && p.id !== meId(); });
  }

  root.RDRSoloHost = {
    start: start,
    net: function () { return net; },
    code: function () { return net && looksCode(net.code); },
    status: function () { return net ? net.status : 'offline'; },
    joinUrl: function () { var c = this.code(); return c ? openUrl(c) : ''; },
    controllerUrl: function () { var c = this.code(); return c ? controllerUrl(c) : ''; },
    remotes: remotes,
    clients: function () { return clients; },
    friends: remotes,
    hookEvents: hookEvents,
    push: function () { phoneDirty = true; pushPhones(); publish(); },
    publish: publish,
    openUrl: openUrl,
    controllerFile: CTRL
  };
})(window);
