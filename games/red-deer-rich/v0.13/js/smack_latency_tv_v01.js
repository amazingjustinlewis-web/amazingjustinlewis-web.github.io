/* TV v0.7.10: judge smack taps with the phone's input time plus a clock offset,
   and widen the window a little to cover one-way delay. Also records pings for
   the latency test room. */
(function (w) {
  'use strict';
  var offsets = {}; /* pid -> { off, rtt, at, n, jitter } */
  var PRE_PAD = 140, POST_PAD = 180; /* extra ms of window for lag */

  function game() { return w.RDR && RDR.game; }
  function rec(pid) { return offsets[pid] || (offsets[pid] = { off: 0, rtt: 0, at: 0, n: 0, jitter: 0 }); }
  function notePing(pid, tPhone, tTv, rtt) {
    if (pid == null) return;
    var r = rec(pid);
    /* off ~= tTv - tPhone, so tTvApprox = tPhone + off */
    var off = tTv - tPhone;
    if (r.n) {
      var d = off - r.off;
      r.jitter = r.jitter * 0.7 + Math.abs(d) * 0.3;
      r.off = r.off * 0.6 + off * 0.4;
      if (rtt != null) r.rtt = r.rtt * 0.6 + rtt * 0.4;
    } else {
      r.off = off; r.rtt = rtt || 0; r.jitter = 0;
    }
    r.n++; r.at = Date.now();
  }
  function gameTimeFromPhone(pid, tPhone, fallback) {
    if (tPhone == null) return fallback;
    var r = offsets[pid];
    return tPhone + (r && r.n ? r.off : 0);
  }

  function hookSmack() {
    var S = w.RDRSmack; if (!S || S._tv0710Lag || typeof S.onTap !== 'function') return !!S;
    S._tv0710Lag = true;
    var orig = S.onTap.bind(S);
    var pre = S.SMACK_PRE, post = S.SMACK_POST;
    S.onTap = function (conn, m) {
      m = m || {};
      var g = game(), pid = m.pid, nowG = g ? g.now : 0;
      var tPhone = m.atPhone != null ? m.atPhone : (m.at != null ? m.at : null);
      /* If the phone stamped a wall/game estimate, convert with the offset. */
      if (tPhone != null && m.clock === 'phone') {
        m.at = gameTimeFromPhone(pid, tPhone, nowG);
      } else if (m.at != null && m.clock === 'game') {
        /* already in game time, but compensate one-way if we have rtt */
        var r = pid != null ? offsets[pid] : null;
        if (r && r.rtt) m.at = m.at + Math.min(120, r.rtt / 2);
      }
      /* Temporarily widen the window for this tap. */
      S.SMACK_PRE = pre + PRE_PAD;
      S.SMACK_POST = post + POST_PAD;
      try { return orig(conn, m); }
      finally { S.SMACK_PRE = pre; S.SMACK_POST = post; }
    };
    return true;
  }

  function hookNet() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.o || hookNet._on) return !!net;
    hookNet._on = true;
    var orig = net.o.onMessage;
    net.o.onMessage = function (conn, m) {
      if (m && (m.t === 'ping' || m.t === 'latPing')) {
        var tTv = (game() && game().now) || (typeof performance !== 'undefined' ? performance.now() : Date.now());
        var pid = m.pid;
        if (pid == null && w.RDR && RDR.clients) {
          for (var k in RDR.clients) if (RDR.clients[k].conn === conn) pid = RDR.clients[k].pid;
        }
        if (m.t === 'latPing' || m.echo) {
          try { if (conn && conn.send) conn.send({ t: 'latPong', tPhone: m.tPhone, tTv: tTv, pid: pid }); } catch (e) {}
        }
        if (m.tPhone != null && m.tTvEcho != null) notePing(pid, m.tPhone, m.tTvEcho, m.rtt);
      }
      if (m && m.t === 'smackTap' && m.tPhone != null && m.at == null) {
        m.clock = m.clock || 'phone';
      }
      return orig && orig.apply(this, arguments);
    };
    return true;
  }

  function loop() { hookSmack(); hookNet(); setTimeout(loop, 400); }
  loop();
  w.RDRSmackLag = { notePing: notePing, of: function (pid) { return offsets[pid]; }, all: function () { return offsets; } };
})(window);
