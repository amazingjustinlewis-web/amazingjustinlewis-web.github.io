/* TV v0.7.6: when the board is full or mid-game, phones can enter a queue for the next game.
   Queued players see a party screen and vote Play locally vs Wait for the TV. Unanimous votes get a
   fast 3-2-1 countdown anyone can cancel. Votes can change at any time. */
(function (w) {
  'use strict';
  var q = []; /* { cid, pid, name, color, charId, vote }  vote: 'tv'|'local'|null */
  var count = { on: false, t0: 0, dir: null, left: 3 };
  var COUNT_MS = 900;

  function game() { return w.RDR && RDR.game; }

  function snapshot() {
    return {
      t: 'queue',
      players: q.map(function (p) { return { cid: p.cid, name: p.name, color: p.color, charId: p.charId, vote: p.vote }; }),
      counting: count.on, dir: count.dir, left: count.left
    };
  }

  function sendAll(m) { if (w.RDR075) RDR075.sendAll(m); else if (w.RDR076) RDR076.sendAll(m); }
  function sendToClient(c, m) { if (w.RDR075) RDR075.sendToClient(c, m); else if (w.RDR076) RDR076.sendToClient(c, m); }

  function broadcast() { sendAll(snapshot()); }

  function find(cid) { for (var i = 0; i < q.length; i++) if (q[i].cid === cid) return q[i]; return null; }

  function add(conn, m) {
    var cid = m.cid || (conn && (conn.peer || conn.id)) || ('q' + Date.now());
    if (find(cid)) { broadcast(); return; }
    var g = game(), name = (m.name || 'Player').slice(0, 16);
    var color = '#ffd23f', charId = null;
    if (g) {
      /* try to match an observer already in the room */
      g.players.forEach(function () {});
    }
    q.push({ cid: cid, conn: conn, name: name, color: color, charId: charId, vote: null });
    count.on = false; count.dir = null;
    broadcast();
  }

  function leave(cid) {
    q = q.filter(function (p) { return p.cid !== cid; });
    count.on = false;
    broadcast();
  }

  function setVote(cid, vote) {
    var p = find(cid); if (!p) return;
    if (vote !== 'tv' && vote !== 'local' && vote != null) vote = null;
    p.vote = vote || null;
    /* changing a vote always cancels a countdown */
    count.on = false; count.dir = null;
    maybeCount();
    broadcast();
  }

  function unanimous() {
    if (!q.length) return null;
    var v = q[0].vote;
    if (!v) return null;
    for (var i = 1; i < q.length; i++) if (q[i].vote !== v) return null;
    return v;
  }

  function maybeCount() {
    var dir = unanimous();
    if (!dir) { count.on = false; count.dir = null; return; }
    if (count.on && count.dir === dir) return;
    count.on = true; count.dir = dir; count.t0 = performance.now(); count.left = 3;
    broadcast();
  }

  function tick() {
    if (!count.on) return;
    var el = performance.now() - count.t0;
    var left = 3 - Math.floor(el / COUNT_MS);
    if (left !== count.left) { count.left = left; broadcast(); }
    if (el >= COUNT_MS * 3) {
      var dir = count.dir;
      count.on = false; count.left = 0;
      fire(dir);
      broadcast();
    }
  }

  function fire(dir) {
    if (dir === 'local') {
      var room = 'L' + Math.random().toString(36).slice(2, 6).toUpperCase();
      sendAll({ t: 'queueGo', dir: 'local', room: room, url: 'index.html?phonehost=1&local=1&room=' + room });
    } else {
      sendAll({ t: 'queueGo', dir: 'tv' });
    }
  }

  function clientOf(conn) {
    var cl = w.RDR && RDR.clients;
    if (!cl || !conn) return null;
    for (var k in cl) if (cl[k].conn === conn) return cl[k];
    return null;
  }

  function onMessage(conn, m) {
    if (!m || !m.t) return false;
    if (m.t === 'queueJoin') { add(conn, m); return true; }
    if (m.t === 'queueLeave') {
      var c = clientOf(conn); leave((m.cid) || (c && (c.cid || c.id)) || (conn && conn.peer));
      return true;
    }
    if (m.t === 'queueVote') {
      var c2 = clientOf(conn);
      var cid = m.cid || (c2 && (c2.cid || c2.id)) || (conn && conn.peer);
      setVote(cid, m.vote);
      return true;
    }
    return false;
  }

  function hookEnd() {
    var g = game(); if (!g || g._tv076QueueEnd) return !!g;
    g._tv076QueueEnd = true;
    g.on(function (type) {
      if (type === 'over' || type === 'toLobby' || type === 'start') {
        /* next game: keep the queue listed; countdown cancels on start */
        if (type === 'start') { count.on = false; }
      }
    });
    return true;
  }

  setInterval(tick, 120);

  w.RDRQueue = {
    onMessage: onMessage, snapshot: snapshot, broadcast: broadcast,
    add: add, leave: leave, setVote: setVote, list: function () { return q; },
    hookEnd: hookEnd, tick: tick
  };
})(window);
